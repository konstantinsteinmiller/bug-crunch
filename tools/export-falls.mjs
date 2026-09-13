#!/usr/bin/env node
/**
 * ─── The squad's fall sheet, exported ───────────────────────────────────────
 *
 *   pnpm dev --port 2050                 # in one terminal
 *   node tools/export-falls.mjs          # in another; writes art-sheets/
 *   node tools/export-falls.mjs http://localhost:2050/
 *   node tools/export-falls.mjs --check  # exit 1 if the reference is missing
 *                                        # or the index has no entry for it
 *
 * WHY THIS EXISTS, AND WHEN TO DELETE IT.
 *
 * Every other reference sheet is rendered by the bench (`/#/art-sheets`), which
 * walks the manifest's walks, stills and boss deaths and knows a painter for
 * each. It does not know one for a survivor lying down, and the sheet it would
 * have to learn is two lines in `ArtSheets.vue`:
 *
 *     // beside renderWalkAlpha / renderDeathAlpha
 *     const renderFallAlpha = (f: FallSpec): HTMLCanvasElement => { ...panels... }
 *     //   each panel: paintSurvivorDownPanel(ctx, col, f.poses[row], f.panelW, f.panelH)
 *     // and in buildIndex(), a third block beside BOSS_DEATHS.map over SURVIVOR_FALLS
 *
 * The moment those land, this tool is dead weight: delete it and run
 * `pnpm art:export`. Until then it renders the same sheet the same way — through
 * the game's OWN painter (`heroSprites.paintSurvivorDownPanel`), in a real page
 * served by the dev server, measured with the bench's own fit arithmetic and
 * written through the bench's own save endpoint. Nothing here is a lookalike
 * drawing: a reference that agreed with itself and not with the renderer is the
 * one failure this whole pipeline exists to prevent.
 *
 * Own Chrome profile, own port — never the shared debugging profile, which
 * belongs to whatever the user has open.
 *
 * ORDERING. A full `pnpm art:export` rewrites `sheet-index.json` from the
 * bench's own manifest walk, which has no entry for this sheet — so it drops the
 * one this tool appends. Run this AFTER any export, and before `pnpm
 * slice-sheets` (the slicer cuts what the index describes and nothing else).
 * `--check` is the guard: it says so rather than letting the sheet go missing
 * quietly.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHEETS = join(ROOT, 'art-sheets')
const INDEX = join(SHEETS, 'sheet-index.json')

const ARGS = process.argv.slice(2)
const CHECK = ARGS.includes('--check')
const APP = ARGS.find((a) => !a.startsWith('--')) ?? 'http://localhost:2050/'

// ─── --check: is the sheet in the pipeline at all? ──────────────────────────

if (CHECK) {
  const problems = []
  if (!existsSync(INDEX)) problems.push('art-sheets/sheet-index.json is missing — run pnpm art:export')
  else {
    const index = JSON.parse(readFileSync(INDEX, 'utf-8'))
    const entry = (index.walks ?? []).find((w) => w.falls)
    if (!entry) problems.push('sheet-index.json has no fall sheet — run node tools/export-falls.mjs')
    else if (!existsSync(join(SHEETS, entry.file))) {
      problems.push(`art-sheets/${entry.file} is missing — run node tools/export-falls.mjs`)
    } else if (!entry.fit) problems.push('the fall sheet has no measured fit — re-run node tools/export-falls.mjs')
  }
  for (const p of problems) console.error(`  ! ${p}`)
  if (problems.length === 0) console.log('  = the fall sheet is exported, measured and in the index')
  process.exit(problems.length ? 1 : 0)
}

// ─── The page ───────────────────────────────────────────────────────────────

const PORT = 9900 + Math.floor(Math.random() * 200)
const PROFILE = mkdtempSync(join(tmpdir(), 'sv-fall-'))

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].find((p) => existsSync(p))
if (!CHROME) { console.error('no chrome'); process.exit(1) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--window-size=1200,900',
  APP
], { stdio: 'ignore', detached: false })

const cleanup = () => {
  try { child.kill() } catch { /* already gone */ }
  try { rmSync(PROFILE, { recursive: true, force: true }) } catch { /* locked */ }
}

/**
 * Rendered IN THE PAGE.
 *
 * `boxOf` and the fit it feeds are the bench's, copied rather than adapted —
 * same alpha threshold, same speck filter, same fractions — because the slicer
 * normalises every return onto this number and a second opinion about it would
 * resize the painting in play. If the bench's copy ever changes, this changes
 * with it (or, better, this file goes away; see the header).
 */
const RENDER = `(async () => {
  const FIT_ALPHA = 140
  const hero = await import('/src/game/heroSprites.ts')
  const sheet = await import('/src/game/artSheet.ts')
  const f = sheet.SURVIVOR_FALLS[0]
  if (!f) throw new Error('SURVIVOR_FALLS is empty')

  const alpha = document.createElement('canvas')
  alpha.width = f.w
  alpha.height = f.h
  const ctx = alpha.getContext('2d')
  for (let i = 0; i < f.frames; i++) {
    const col = i % f.cols
    const row = Math.floor(i / f.cols)
    ctx.save()
    ctx.translate(col * f.panelW, row * f.panelH)
    // Clipped to its own panel, exactly as the bake's frame clips it: a boot or
    // a dropped gun that overruns the frame is cut off in play, and left
    // unclipped here it lands in the NEXT panel and is measured as that body.
    ctx.beginPath()
    ctx.rect(0, 0, f.panelW, f.panelH)
    ctx.clip()
    hero.paintSurvivorDownPanel(ctx, col, f.poses[row], f.panelW, f.panelH)
    ctx.restore()
  }

  const boxOf = (cv, ox, oy, W, H) => {
    const d = cv.getContext('2d').getImageData(ox, oy, W, H).data
    const N = W * H
    const solid = new Uint8Array(N)
    for (let k = 0; k < N; k++) if (d[k * 4 + 3] > FIT_ALPHA) solid[k] = 1
    const seen = new Uint8Array(N)
    const stack = []
    let x0 = W, y0 = H, x1 = -1, y1 = -1
    for (let k0 = 0; k0 < N; k0++) {
      if (!solid[k0] || seen[k0]) continue
      let n = 0
      let cx0 = W, cy0 = H, cx1 = -1, cy1 = -1
      seen[k0] = 1
      stack.push(k0)
      while (stack.length) {
        const k = stack.pop()
        n++
        const x = k % W
        const y = (k / W) | 0
        if (x < cx0) cx0 = x
        if (x > cx1) cx1 = x
        if (y < cy0) cy0 = y
        if (y > cy1) cy1 = y
        if (x > 0 && solid[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; stack.push(k - 1) }
        if (x < W - 1 && solid[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; stack.push(k + 1) }
        if (y > 0 && solid[k - W] && !seen[k - W]) { seen[k - W] = 1; stack.push(k - W) }
        if (y < H - 1 && solid[k + W] && !seen[k + W]) { seen[k + W] = 1; stack.push(k + W) }
      }
      if (Math.min(cx1 - cx0 + 1, cy1 - cy0 + 1) <= 3 || n < 16) continue
      if (cx0 < x0) x0 = cx0
      if (cx1 > x1) x1 = cx1
      if (cy0 < y0) y0 = cy0
      if (cy1 > y1) y1 = cy1
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 }
  }

  let x0 = f.panelW, y0 = f.panelH, x1 = -1, y1 = -1
  const perPanel = []
  for (let i = 0; i < f.frames; i++) {
    const b = boxOf(alpha, (i % f.cols) * f.panelW, Math.floor(i / f.cols) * f.panelH, f.panelW, f.panelH)
    perPanel.push(b && {
      w: +((b.x1 - b.x0 + 1) / f.panelW).toFixed(3),
      h: +((b.y1 - b.y0 + 1) / f.panelH).toFixed(3)
    })
    if (!b) continue
    if (b.x0 < x0) x0 = b.x0
    if (b.y0 < y0) y0 = b.y0
    if (b.x1 > x1) x1 = b.x1
    if (b.y1 > y1) y1 = b.y1
  }
  if (x1 < 0) throw new Error('the fall sheet rendered empty — nothing solid in any panel')
  const fit = {
    h: (y1 - y0 + 1) / f.panelH,
    w: (x1 - x0 + 1) / f.panelW,
    bottom: (y1 + 1) / f.panelH,
    cx: ((x0 + x1) / 2) / f.panelW
  }

  // Flat magenta under it — the chroma contract every reference keeps.
  const cv = document.createElement('canvas')
  cv.width = f.w
  cv.height = f.h
  const g = cv.getContext('2d')
  g.fillStyle = '#ff00ff'
  g.fillRect(0, 0, cv.width, cv.height)
  g.drawImage(alpha, 0, 0)

  const name = f.file + '.png'
  const res = await fetch('/__art/save-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, dataUrl: cv.toDataURL('image/png') })
  })
  if (!res.ok) throw new Error(name + ': ' + res.status + ' ' + await res.text())

  return JSON.stringify({
    name,
    perPanel,
    entry: {
      id: f.id,
      file: name,
      width: f.w,
      height: f.h,
      cols: f.cols,
      rows: f.rows,
      frames: f.frames,
      kind: f.kind,
      panel: { w: f.panelW, h: f.panelH },
      fit,
      faces: f.faces,
      anchor: 'feet',
      tight: false,
      maxEdge: f.maxEdge,
      target: f.target,
      // Marks this hero-kind entry as the FALL sheet rather than a survivor's
      // walk: \`tools/art-models.mjs\` builds the squad's character model from
      // the walks and must not take a column of this one for a survivor.
      falls: true
    }
  })
})()`

let ws
try {
  let target = null
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(500)
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      target = list.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'))
    } catch { /* not up yet */ }
  }
  if (!target) throw new Error('no page target')

  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no })

  let id = 0
  const pending = new Map()
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  }
  const send = (method, params = {}) => new Promise((ok) => {
    const n = ++id
    pending.set(n, ok)
    ws.send(JSON.stringify({ id: n, method, params }))
  })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    const bad = r.result?.exceptionDetails
    if (bad) throw new Error(bad.exception?.description ?? bad.text ?? 'eval failed')
    return r.result?.result?.value
  }

  await send('Runtime.enable')
  await send('Page.enable')

  // The dev server has to be THIS project's: a stale server from another game
  // answers happily on the same port and the sheet lands in the wrong repo.
  let title = ''
  for (let i = 0; i < 30; i++) {
    title = await evaluate('document.title')
    if (title) break
    await sleep(1000)
  }
  console.log(`page: ${APP} — ${title || '(no title)'}`)
  if (!/splatix/i.test(title)) {
    throw new Error(`not splatix: the page at ${APP} is titled "${title}". `
      + 'Start this project\'s dev server (pnpm dev --port 2050) or pass its URL.')
  }

  const out = JSON.parse(await evaluate(RENDER))
  console.log(`  ✓ art-sheets/${out.name}`)
  for (let i = 0; i < out.perPanel.length; i++) {
    const p = out.perPanel[i]
    console.log(`      panel ${i + 1}: ${p ? `${(p.w * 100).toFixed(0)}% of the panel wide, ${(p.h * 100).toFixed(0)}% tall` : 'EMPTY'}`)
  }

  // ── The index entry ──
  // Replaced in place when it is already there, so re-running is safe and the
  // file's order does not churn.
  const index = JSON.parse(readFileSync(INDEX, 'utf-8'))
  index.walks = index.walks ?? []
  const at = index.walks.findIndex((w) => w.id === out.entry.id && w.kind === out.entry.kind)
  if (at >= 0) index.walks[at] = out.entry
  else index.walks.push(out.entry)
  writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`, 'utf-8')
  const f = out.entry.fit
  console.log(`  ✓ art-sheets/sheet-index.json  ${at >= 0 ? 'updated' : 'appended'} ${out.entry.id}`
    + `  fit ${(f.w * 100).toFixed(0)}% x ${(f.h * 100).toFixed(0)}%, bottom ${(f.bottom * 100).toFixed(0)}%`)
  console.log('\nNext: paste the "Survivors, down" block from art-sheets/PROMPTS-DEATHS.md'
    + ' with art-sheets/models/survivors.png and art-sheets/fall-survivors.png,'
    + ' or run pnpm art:desk and queue it.')
} catch (err) {
  console.error('ERROR:', err.message)
  process.exitCode = 1
} finally {
  try { ws?.close() } catch { /* closed */ }
  cleanup()
}
