#!/usr/bin/env node
// ─── Interleaved A/B over REAL GAMEPLAY ─────────────────────────────────────
//
// The sibling of `perf-ab.mjs`, and the one to reach for when the thing under
// test is anywhere in the renderer. Procedure and results: `PERF-LEDGER.md`.
//
// ── Why this exists ──
//
// `perf-ab.mjs` loads the page and waits. In this game that measures the
// TUTORIAL: the squad holds its column until the first pointer event arrives,
// so a run with no input never draws a gate, a crate, a foe or a single glyph.
// A draw-call breakdown over 1 504 frames of such a run contains zero
// `fillText` calls, and a screenshot at 26 s still reads "Swipe to move your
// squad". Two arms compared that way are two empty roads.
//
// So this one plays: one `pointerdown`, then a slow sine steer across the lane
// for the whole run, identical in both arms. `workP50` at 6x throttle goes from
// 1.7 ms to 7.7 ms — the difference between measuring the menu and measuring
// the game.
//
// The input is installed IN THE PAGE rather than driven over CDP. A websocket
// round trip per pointer event is, under throttling, exactly as slow and as
// variable as the thing being measured; in-page it is one RAF loop writing a
// deterministic sine.
//
// ── Two properties that are not incidental ──
//
// A LONG, UNTHROTTLED SETTLE before the clock starts. The idle sprite baker
// builds the stage's monster strips in the first seconds of play at ~12 ms a
// frame. An A/A that started measuring at 3 s reported 48 long tasks in one arm
// and 9 in the other — a 34 % spread between two identical arms.
//
// A FRESH BROWSER PER MEASUREMENT. Chrome degrades across repeated navigations
// of this page: an A/A at 4 reps in one browser returned 1 320, 604, 93 and then
// 0 recorded frames on successive runs. Each arm therefore runs as its own
// child process, and this script re-spawns itself with `--once` to do it.
//
// ── Usage ──
//
//   pnpm dev                                    # in another terminal
//   pnpm perf:play --a "perf=<thing>-legacy" --b ""
//   pnpm perf:play --a "tier=high" --b "tier=min"      # price a quality tier
//
//   --base <url>      page under test        (default the dev server's root)
//   --a / --b <qs>    query fragment per arm; `--b ""` is the shipping path
//   --reps <n>        repetitions of each arm, interleaved          (default 3)
//   --throttle <n>    CPU throttling rate; 6 is this project's ceiling — see
//                     the 12x row in the ledger                     (default 6)
//   --seconds <n>     recorded seconds per rep                     (default 22)
//   --stage <n>       seed a save that RESUMES on stage n           (default: none)
//   --chrome <path>   Chrome executable
//
// ── --stage, and why it is not optional for most experiments ──
//
// A fresh profile is a fresh save, and a fresh save starts on stage 1: three
// survivors, one gate, a handful of props, no miniboss and no boss. That is a
// perfectly good measurement of the OPENING, and a useless one for anything
// whose cost scales with what is on the road — monster counts, bullet counts,
// particle budgets, the sprite cache. It is the same trap the header above
// describes for input, one layer further in: two arms compared on stage 1 are
// two nearly empty roads.
//
// `--stage n` writes a plausible save (progress, coins, a few upgrade levels)
// into `localStorage` BEFORE any app script runs, so the arm opens on a road
// with the population the change is actually about. Both arms get the identical
// seed, so it cannot favour either.
//
// Pin the tier with `?tier=` on BOTH arms whenever the change could move it.
// Without that, an arm that is genuinely faster keeps a higher tier, draws more,
// and hands back a comparison between two different games.

import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback
}

const CHROME = arg('chrome', process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe')
const BASE = arg('base', 'http://127.0.0.1:5173/')
const A_QS = arg('a', '')
const B_QS = arg('b', '')
const REPS = Number(arg('reps', 3))
const THROTTLE = Number(arg('throttle', 6))
const SECONDS = Number(arg('seconds', 22))
const STAGE = Number(arg('stage', 0))
const ONCE = argv.includes('--once')

/** The target profile: a 2021 mid-range Android, portrait. */
const W = 412
const H = 915
const DPR = 2

// ─── One arm, one browser ───────────────────────────────────────────────────

const runOnce = async (qs) => {
  const port = 9500 + Math.floor(Math.random() * 400)
  const profile = mkdtempSync(join(tmpdir(), 'perf-play-'))
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    // HEADED, with a visible attached canvas. A canvas that is never composited
    // lets the browser skip the raster work you are trying to price — see the
    // headless row in `PERF-LEDGER.md`.
    `--window-size=${W + 40},${H + 120}`,
    'about:blank'
  ], { stdio: 'ignore' })

  const json = async (path) => {
    for (let i = 0; i < 80; i++) {
      try { return await (await fetch(`http://127.0.0.1:${port}${path}`)).json() } catch { await sleep(300) }
    }
    throw new Error('no CDP endpoint — is Chrome at the path given by --chrome?')
  }

  const conn = new WebSocket((await json('/json/version')).webSocketDebuggerUrl)
  await new Promise(r => { conn.onopen = r })
  let id = 0
  const pending = new Map()
  conn.onmessage = e => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  }
  const send = (method, params = {}, session) => new Promise(res => {
    const mid = ++id
    pending.set(mid, res)
    conn.send(JSON.stringify({ id: mid, method, params, ...(session ? { sessionId: session } : {}) }))
  })

  const { result: { targetInfos } } = await send('Target.getTargets')
  const page = targetInfos.find(t => t.type === 'page')
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true })
  await send('Page.enable', {}, sessionId)
  await send('Runtime.enable', {}, sessionId)
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: DPR, mobile: true }, sessionId)
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId)

  const evalIn = (expression) =>
    send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)

  if (STAGE > 0) {
    // Before ANY app script on the page. Written post-boot it races the state
    // layer's own debounced persist and loses, and the arm then measures the
    // tutorial while claiming to measure stage 22.
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { localStorage.setItem('splatix_state', JSON.stringify({
        ts_stage: ${STAGE}, ts_coins: 50000, ts_best_stage: ${STAGE - 1},
        ts_onboarded: true, ts_tutorial_seen: true, ts_results_seen: 6,
        ts_shop_spotlight_seen: true, ts_guard_hint_seen: true,
        ts_lever_hint_seen: true, ts_runs: 40,
        ts_upgrades: { squad: 10, power: 10, rate: 6, range: 4, scavenge: 5 }
      })) } catch (e) {}`
    }, sessionId)
  }

  const url = new URL(BASE)
  url.searchParams.set('perfprobe', '1')
  // Never self-terminate — this runner owns the clock.
  url.searchParams.set('perfframes', '1000000')
  for (const pair of qs.split('&').filter(Boolean)) {
    const [k, v = ''] = pair.split('=')
    url.searchParams.set(k, v)
  }

  await send('Page.navigate', { url: url.toString() }, sessionId)
  await sleep(6000)

  const drive = await evalIn(`(() => {
    const cv = document.querySelector('canvas')
    if (!cv) return 'no canvas'
    // Draw-call counting, per frame, by method. Not a timing — a count, which is
    // the one renderer number that is exact rather than statistical.
    window.__dc = 0; window.__dcFrames = 0; window.__by = {}
    const P = CanvasRenderingContext2D.prototype
    for (const m of ['drawImage','fill','stroke','fillRect','strokeRect','fillText','strokeText','clip']) {
      const orig = P[m]
      P[m] = function () { window.__dc++; window.__by[m] = (window.__by[m]||0)+1; return orig.apply(this, arguments) }
    }
    const count = () => { window.__dcFrames++; requestAnimationFrame(count) }
    requestAnimationFrame(count)

    // Pointer capture would route later moves to the element directly; the game
    // does not need it and the stub keeps synthetic events flowing.
    cv.setPointerCapture = () => {}
    cv.releasePointerCapture = () => {}
    const fire = (type, x, extra) => cv.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true,
      cancelable: true, clientX: x, clientY: ${Math.round(H * 0.7)}, ...extra
    }))
    fire('pointerdown', ${Math.round(W / 2)}, { button: 0, buttons: 1 })
    const t0 = performance.now()
    const tick = (t) => {
      // A 5 s period across 70 % of the lane: slow enough to actually collect
      // the gates and crates it steers into, wide enough to meet the pillars.
      fire('pointermove', ${W / 2} + Math.sin((t - t0) / 5000 * Math.PI * 2) * ${W * 0.35}, { buttons: 1 })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return 'driving'
  })()`)
  if (drive.result?.result?.value !== 'driving') {
    throw new Error(`input driver failed: ${JSON.stringify(drive.result?.result?.value)}`)
  }

  await sleep(12000)                                    // unthrottled settle: let the baker finish
  await send('Emulation.setCPUThrottlingRate', { rate: THROTTLE }, sessionId)
  await sleep(3000)                                     // let the throttle step settle
  await evalIn('window.__perfProbe.reset(); window.__dc = 0; window.__dcFrames = 0; window.__by = {}')
  await sleep(SECONDS * 1000)

  const r = await evalIn(`JSON.stringify(Object.assign(window.__perfProbe.summary(), {
    dcPerFrame: +(window.__dc / Math.max(1, window.__dcFrames)).toFixed(1),
    by: Object.fromEntries(Object.entries(window.__by)
      .map(([k, v]) => [k, +(v / Math.max(1, window.__dcFrames)).toFixed(1)]))
  }))`)

  conn.close()
  chrome.kill()
  return JSON.parse(r.result.result.value)
}

if (ONCE) {
  const s = await runOnce(A_QS)
  console.log(JSON.stringify(s))
  process.exit(0)
}

// ─── Interleaved driver ─────────────────────────────────────────────────────

const self = fileURLToPath(import.meta.url)
const runArm = (qs) => {
  const out = execFileSync(process.execPath, [
    self, '--once', '--base', BASE, '--a', qs,
    '--throttle', String(THROTTLE), '--seconds', String(SECONDS), '--chrome', CHROME,
    // Forwarded, so both arms open on the same road. A child that fell back to
    // stage 1 while the parent reported "--stage 22" would be the worst kind of
    // wrong: a clean number about a different game.
    '--stage', String(STAGE)
  ], { encoding: 'utf8' })
  return JSON.parse(out.trim().split('\n').pop())
}

console.log(`base       ${BASE}`)
console.log(`arms       A "${A_QS || '(none)'}"   B "${B_QS || '(none)'}"`)
console.log(`profile    ${W}x${H} @ DPR ${DPR}, ${THROTTLE}x CPU, scripted sine steer`)
console.log(`reps       ${REPS} interleaved, ${SECONDS}s recorded each, fresh browser per run\n`)

const rows = { A: [], B: [] }
for (let rep = 1; rep <= REPS; rep++) {
  // Order flips on odd reps so neither arm is systematically first.
  const order = rep % 2 ? [['A', A_QS], ['B', B_QS]] : [['B', B_QS], ['A', A_QS]]
  for (const [name, qs] of order) {
    const s = runArm(qs)
    rows[name].push(s)
    console.log(`rep ${rep} ${name}  frames=${s.frames} workP50=${s.workP50} workP95=${s.workP95} `
      + `intervalP50=${s.intervalP50} intervalP95=${s.intervalP95} longTasks=${s.longTasks} `
      + `draws/frame=${s.dcPerFrame}`)
  }
}

const median = (xs) => {
  const a = [...xs].sort((x, y) => x - y)
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
const col = (arm, k) => rows[arm].map(s => s[k])

console.log('\nmedian-of-rep:')
for (const k of ['workP50', 'workP95', 'workP99', 'intervalP50', 'intervalP95', 'longTasks', 'dcPerFrame']) {
  const a = median(col('A', k))
  const b = median(col('B', k))
  const d = a === 0 ? 0 : ((b - a) / a) * 100
  console.log(`  ${k.padEnd(12)} A ${a.toFixed(2).padStart(8)}  ->  B ${b.toFixed(2).padStart(8)}`
    + `   (${d >= 0 ? '+' : ''}${d.toFixed(1)}%)`)
}

const wins = rows.A.filter((a, i) => rows.B[i] && rows.B[i].workP95 < a.workP95).length
console.log(`\n  paired wins for B on workP95   ${wins}/${REPS}`)
console.log(`  ranges   A [${Math.min(...col('A', 'workP95'))}, ${Math.max(...col('A', 'workP95'))}]`
  + `   B [${Math.min(...col('B', 'workP95'))}, ${Math.max(...col('B', 'workP95'))}]`)
console.log('\n  The A/A noise floor on this harness is ~1% on workP95; anything under')
console.log('  ~5% with overlapping ranges is not a result. Record it in PERF-LEDGER.md.')
