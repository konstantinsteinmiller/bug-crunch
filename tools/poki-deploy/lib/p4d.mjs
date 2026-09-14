// Poki for Developers — the Versions page, driven.
//
// The flow is exactly the one a human runs: open Versions, "Upload New
// Version", pick the zip, type a name, submit, wait for the row to reach Ready.
// Everything below is about the three ways doing that programmatically differs
// from doing it by hand.
//
// 1. THE NAME FIELD IS A REACT CONTROLLED INPUT. Assigning `.value` moves the
//    pixels and nothing else: React's own state never hears about it, and it
//    submits EMPTY — which the form rejects as "Required", after the upload has
//    already started. Write through the native value setter and dispatch a
//    bubbling `input` event so React's synthetic listener picks it up.
//
// 2. THE FILE INPUT CANNOT BE FED FROM PAGE JS. `DOM.setFileInputFiles` is the
//    only way in, and it needs a CDP node id — so this module reaches for the
//    DOM domain rather than evaluating a script.
//
// 3. THE VERSION ID IS ONLY DISCOVERABLE FROM THE ROW. Each row carries an
//    `input[name="version-label-<uuid>"]`, and that uuid is the version id —
//    the same one the game is served under
//    (`<gameId>.gdn.poki.com/<versionId>/index.html`) and the same one the
//    Inspector takes as `?game=poki-<versionId>`. There is no other place to
//    read it, which is why upload and QA have to be one pipeline: the QA pass
//    cannot address the build unless the upload step hands it that id.

import { basename, resolve } from 'node:path'
import { sleep } from './chrome.mjs'

const LOGIN_HOSTS = ['accounts.google.com', 'auth.poki.io', '/signin']

export const versionsUrl = (team, gameId) => `https://app.poki.dev/${team}/games/${gameId}/versions`
export const teamUrl = team => `https://app.poki.dev/${team}`

/**
 * ─── Finding a game by NAME ─────────────────────────────────────────────────
 *
 * The dashboard at `app.poki.dev/<team>` lists every game in a sidebar, and the
 * obvious approach — read the games out of their links — does not work, because
 * THE GAME ROWS ARE NOT LINKS. Measured on the real page: the whole dashboard
 * carries four anchors, none of them a game. A row is a plain
 * `<div class="sc-ZGQWe">` with `cursor: pointer` and a React click handler.
 *
 * Clicking one does not navigate either. It EXPANDS that game's section in
 * place — `location.href` stays on the dashboard — and the submenu that appears
 * is where the real anchors live:
 *
 *   /<team>/games/<uuid>            Overview
 *   /<team>/games/<uuid>/versions   Versions      ← the id comes out of here
 *   /<team>/games/<uuid>/errors     Errors
 *   …
 *
 * So the sequence is the one a person performs: find the row by its name, click
 * it, read the uuid out of the Versions link it reveals.
 *
 * Nothing here matches on a class name. `sc-ZGQWe` is a styled-components hash
 * that will move the next time somebody edits a stylesheet; what is stable is
 * the TEXT a human reads and the `/games/<uuid>/versions` URL shape the rest of
 * this pipeline already depends on.
 */

const UUID_IN_GAMES_URL = /\/games\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

/**
 * Click the sidebar row whose OWN text is `name`.
 *
 * "Own text" — direct child text nodes only — is what stops this matching the
 * sidebar container, whose `innerText` contains every game name at once and
 * would therefore match any of them.
 */
const CLICK_GAME = `(name) => {
  const want = name.trim().toLowerCase()
  for (const el of document.querySelectorAll('div,li,button,span,a')) {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').replace(/\\s+/g, ' ').trim()
    if (own.toLowerCase() !== want) continue
    ;(el.closest('a,button,[role=button],li') || el).click()
    return true
  }
  return false
}`

/** Whatever the sidebar is offering, for an error message worth reading. */
const LIST_SIDEBAR = `(() => {
  const out = []
  for (const el of document.querySelectorAll('div,li,button,span,a')) {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').replace(/\\s+/g, ' ').trim()
    if (!own || own.length > 40) continue
    if (getComputedStyle(el).cursor !== 'pointer') continue
    if (!out.includes(own)) out.push(own)
  }
  return out
})()`

/** Every `/games/<uuid>/versions` link currently on the page. */
const VERSIONS_LINKS = `[...document.querySelectorAll('a[href*="/games/"]')].map(a => a.getAttribute('href')).filter(h => /\\/versions$/.test(h || ''))`

/**
 * Find a game's id from its NAME, so a project only has to know what it calls
 * itself. The uuid is otherwise something a human copies out of a URL by hand,
 * which is the only manual step in setting this pipeline up.
 *
 * The name must match a row EXACTLY (case- and whitespace-insensitive). No
 * prefix or substring fallback, deliberately: with "Glyphyx" and "Glyphyx
 * Deluxe" in one sidebar, a loose match picks whichever the DOM happened to
 * yield first and uploads a build to the wrong game — a mistake nobody catches
 * until it is live. A name that does not match exactly throws, listing what the
 * sidebar actually offers, and the fix is one line of config.
 */
export const resolveGameId = async (cdp, { team, gameName, loginTimeoutMs = 300000, onLoginNeeded, log }) => {
  const url = teamUrl(team)
  await cdp.navigate(url)
  await waitForSignIn(cdp, { url, loginTimeoutMs, onLoginNeeded, isReady: hasDashboard })

  const before = new Set(await cdp.eval(VERSIONS_LINKS).catch(() => []))

  // The sidebar renders after its own fetch, so a miss is "not yet" before it
  // is "not there".
  let clicked = false
  for (let i = 0; i < 10 && !clicked; i++) {
    clicked = await cdp.eval(`(${CLICK_GAME})(${JSON.stringify(gameName)})`).catch(() => false)
    if (!clicked) await sleep(1000)
  }
  if (!clicked) {
    const names = await cdp.eval(LIST_SIDEBAR).catch(() => [])
    throw new Error(`no game called "${gameName}" on ${url}. The sidebar offers:\n${names.map(n => `  ${n}`).join('\n')}`)
  }

  // The click expands the section; the Versions anchor appears a tick later.
  // A row that was ALREADY open collapses instead, so if nothing new shows up,
  // click once more to toggle it back open.
  let href = null
  for (let i = 0; i < 12 && !href; i++) {
    await sleep(500)
    const links = await cdp.eval(VERSIONS_LINKS).catch(() => [])
    href = links.find(h => !before.has(h)) ?? null
    if (!href && i === 5) await cdp.eval(`(${CLICK_GAME})(${JSON.stringify(gameName)})`).catch(() => false)
  }
  // Nothing NEW appeared and nothing was open before: the one on the page is it.
  if (!href && before.size === 1) href = [...before][0]

  const id = UUID_IN_GAMES_URL.exec(href || '')?.[1]?.toLowerCase()
  if (!id) throw new Error(`clicked "${gameName}" but no /games/<uuid>/versions link appeared — has the P4D sidebar changed?`)
  log?.(`resolved "${gameName}" → ${id}`)
  return id
}

/** True once the dashboard itself has rendered (not an SSO hop). */
const hasDashboard = async cdp => {
  const href = await cdp.eval('location.href')
  if (LOGIN_HOSTS.some(h => href.includes(h))) return false
  return cdp.eval(`/Poki for Developers/i.test(document.title) && /\\bGAMES\\b/.test(document.body.innerText || '')`)
}

/**
 * Park on `url` until the human has signed in, and never touch the login form.
 * That account is the user's, a 2FA prompt is not something a script should be
 * poking at, and the persistent profile means this happens once.
 */
const waitForSignIn = async (cdp, { url, loginTimeoutMs, onLoginNeeded, isReady }) => {
  if (await isReady(cdp).catch(() => false)) return
  onLoginNeeded?.()
  const deadline = Date.now() + loginTimeoutMs
  while (Date.now() < deadline) {
    await sleep(3000)
    const href = await cdp.eval('location.href').catch(() => '')
    // Landed back on P4D but somewhere else? Walk it to where we were going.
    if (href.startsWith('https://app.poki.dev') && !href.includes('/signin') && href !== url) {
      await cdp.navigate(url)
    }
    if (await isReady(cdp).catch(() => false)) return
  }
  throw new Error(`still not signed in to P4D after ${Math.round(loginTimeoutMs / 1000)}s — sign in to the Chrome window that opened, then re-run`)
}

/** Reads every version row: id, label, filename, status. */
const READ_ROWS = `(() => {
  const inputs = [...document.querySelectorAll('input[name^="version-label-"]')]
  return inputs.map(inp => {
    let row = inp
    for (let i = 0; i < 8 && row.parentElement; i++) {
      row = row.parentElement
      if (/Ready|Processing|Pending|Failed|Error/i.test(row.innerText || '')) break
    }
    const text = (row.innerText || '').replace(/\\s+/g, ' ')
    return {
      id: inp.name.replace('version-label-', ''),
      label: inp.value,
      status: (text.match(/Ready|Processing|Pending|Failed|Error/i) || [''])[0],
      text: text.slice(0, 160),
    }
  })
})()`

export const readVersions = cdp => cdp.eval(READ_ROWS)

/** True once the page is the real Versions page and not an SSO hop. */
const isSignedIn = async cdp => {
  const href = await cdp.eval('location.href')
  if (LOGIN_HOSTS.some(h => href.includes(h))) return false
  return cdp.eval(`!!document.querySelector('input[name^="version-label-"]')
    || /Upload New Version/i.test(document.body.innerText || '')`)
}

/**
 * Open Versions, waiting for a human to sign in on the first ever run.
 * Never tries to drive the Google login itself — that account is the user's,
 * and a 2FA prompt is not something a script should be poking at.
 */
export const openVersions = async (cdp, { team, gameId, loginTimeoutMs = 300000, onLoginNeeded }) => {
  const url = versionsUrl(team, gameId)
  await cdp.navigate(url)
  await waitForSignIn(cdp, { url, loginTimeoutMs, onLoginNeeded, isReady: isSignedIn })
  return url
}

/** Set a React-controlled input's value so React actually sees it. */
const SET_REACT_INPUT = `(sel, value) => {
  const el = typeof sel === 'string' ? document.querySelector(sel) : sel
  if (!el) return false
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}`

/**
 * Upload one zip as a new version.
 * Returns the new version's id — the handle everything downstream needs.
 */
export const uploadVersion = async (cdp, {
  zipPath, name, notes = '', optimizeImages = true, pollMs = 5000, processingTimeoutMs = 900000, log,
}) => {
  const zip = resolve(zipPath)
  const before = await readVersions(cdp)

  // A name already in the list means two different builds would share one
  // label, and the Versions page is then the only record of which is which.
  if (before.some(v => v.label.trim() === name.trim())) {
    throw new Error(`a version named "${name}" already exists — bump the version (or pass --version) rather than shipping two builds under one name`)
  }

  // ── open the Create Version modal ────────────────────────────────────────
  const opened = await cdp.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /upload new version/i.test(x.innerText || ''))
    if (!b) return false
    b.click(); return true
  })()`)
  if (!opened) throw new Error('no "Upload New Version" button on the Versions page — is this the right game, and is the page loaded?')
  await sleep(1200)

  // ── the file ─────────────────────────────────────────────────────────────
  await cdp.send('DOM.enable')
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' })
  if (!nodeId) throw new Error('the Create Version modal has no file input — Poki may have changed the upload form')
  await cdp.send('DOM.setFileInputFiles', { files: [zip], nodeId })
  log?.(`attached ${basename(zip)}`)
  await sleep(1500)

  // ── the name, and the notes ──────────────────────────────────────────────
  const named = await cdp.eval(`(${SET_REACT_INPUT})(
    [...document.querySelectorAll('input[placeholder="Set a custom label"]')].find(i => !i.readOnly),
    ${JSON.stringify(name)})`)
  if (!named) throw new Error('could not find the version Name field in the modal')
  if (notes) {
    await cdp.eval(`(${SET_REACT_INPUT})(document.querySelector('textarea'), ${JSON.stringify(notes)})`)
  }

  // Poki re-encodes images server-side when this is on. It is checked by
  // default and worth leaving on — it is the same figure the Inspector then
  // reports as the real initial download.
  await cdp.eval(`(() => {
    const cb = document.querySelector('input[name="optimize_images"]')
    if (cb && cb.checked !== ${optimizeImages}) cb.click()
    return cb ? cb.checked : null
  })()`)

  // ── submit ───────────────────────────────────────────────────────────────
  const submitted = await cdp.eval(`(() => {
    const b = [...document.querySelectorAll('button[type=submit]')].find(x => /upload/i.test(x.innerText || ''))
    if (!b || b.disabled) return false
    b.click(); return true
  })()`)
  if (!submitted) throw new Error('the modal\'s Upload button was missing or disabled — the zip or the name was not accepted')
  log?.('uploading…')

  // ── wait for the new row, then for it to finish processing ───────────────
  const knownIds = new Set(before.map(v => v.id))
  const deadline = Date.now() + processingTimeoutMs
  let id = null
  while (Date.now() < deadline) {
    await sleep(pollMs)
    let rows = []
    try { rows = await readVersions(cdp) } catch { continue }
    const fresh = rows.find(v => !knownIds.has(v.id))
    if (fresh) {
      if (!id) { id = fresh.id; log?.(`version ${id} created`) }
      if (/ready/i.test(fresh.status)) return { id: fresh.id, label: fresh.label, status: fresh.status }
      if (/failed|error/i.test(fresh.status)) {
        throw new Error(`Poki rejected the upload: ${fresh.text}`)
      }
    }
  }
  throw new Error(id
    ? `version ${id} never reached "Ready" — check ${await cdp.eval('location.href')}`
    : 'no new version row ever appeared — the upload did not go through')
}

/** Rename an existing version (the pencil next to its label). */
export const renameVersion = async (cdp, { id, name }) => {
  const done = await cdp.eval(`(async () => {
    const inp = document.querySelector('input[name="version-label-${id}"]')
    if (!inp) return 'no such version row'
    let row = inp
    for (let i = 0; i < 8 && row.parentElement; i++) { row = row.parentElement; if (row.querySelector('button[title="Edit"]')) break }
    const edit = row.querySelector('button[title="Edit"], button[aria-label="Edit"]')
    if (edit) { edit.click(); await new Promise(r => setTimeout(r, 400)) }
    const proto = HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(inp, ${JSON.stringify(name)})
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
    return 'ok'
  })()`)
  if (done !== 'ok') throw new Error(`rename failed: ${done}`)
}

/** The URL the Inspector takes for a version. */
export const inspectorUrl = versionId => `https://inspector.poki.dev/?game=poki-${versionId}`

/** Where the build is actually served — handy in a report, and the origin the
 *  QA pass attaches to. */
export const gameFrameOrigin = (gameId, versionId) => `https://${gameId}.gdn.poki.com/${versionId}/`
