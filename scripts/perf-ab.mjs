#!/usr/bin/env node
// ─── Interleaved A/B/A/B performance runner ─────────────────────────────────
//
// Drives a HEADED Chrome on a private profile over CDP, loads the same page
// twice under two different variant flags, and reports whether the change won.
// Procedure and past results: `PERF-LEDGER.md`.
//
// ── Two things here are not incidental ──
//
// HEADED, with a visible attached canvas. A headless run of this project's
// particle benchmark reported 25.4 ms and 3.98 ms for the SAME untouched arm on
// consecutive runs: a canvas that is never composited lets the browser skip the
// raster work you are trying to price, and `getImageData` does not reliably
// force it. Headless is fine for correctness, never for paint cost.
//
// PRIVATE PROFILE. The shared MCP Chrome profile is usually locked by another
// session; this spawns its own so it never fights for it, and never has to
// close a browser that belongs to someone's open work.
//
// ── Usage ──
//
//   pnpm dev                                   # in another terminal
//   pnpm perf:ab --a "perf=smoke-legacy" --b ""
//
//   --base <url>      page under test   (default the dev server's game route)
//   --a / --b <qs>    query fragment appended to each arm; `--b ""` means "the
//                     shipping path, no flags". A is conventionally the
//                     BASELINE so a negative delta reads as an improvement.
//   --reps <n>        repetitions of each arm, interleaved      (default 6)
//   --throttle <n>    CPU throttling rate; 4 ≈ a mid-range 2021 Android (4)
//   --frames <n>      frames recorded per run                   (default 600)
//   --metric <k>      workP95 | workP50 | intervalP95           (workP95)
//   --chrome <path>   Chrome executable
//
// The page must publish `window.__perf` and set `window.__perfDone`; both come
// free from `installPerfProbe` in `src/use/usePerfProbe.ts`.

import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fallback
}

const CHROME = arg('chrome', process.env.CHROME_PATH
  ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe')
const BASE = arg('base', 'http://127.0.0.1:5173/?perfprobe=1')
const A_QS = arg('a', '')
const B_QS = arg('b', '')
const REPS = Number(arg('reps', 6))
const THROTTLE = Number(arg('throttle', 4))
const FRAMES = Number(arg('frames', 600))
const METRIC = arg('metric', 'workP95')
const PORT = Number(arg('port', 9400 + Math.floor(Math.random() * 400)))
const PROFILE = arg('profile', mkdtempSync(join(tmpdir(), 'perf-ab-')))

const withQs = (base, qs) => {
  const u = new URL(base)
  u.searchParams.set('perfprobe', '1')
  u.searchParams.set('perfframes', String(FRAMES))
  for (const pair of qs.split('&').filter(Boolean)) {
    const [k, v = ''] = pair.split('=')
    u.searchParams.set(k, v)
  }
  return u.toString()
}

const ARMS = [
  ['A_base', withQs(BASE, A_QS), A_QS],
  ['B_test', withQs(BASE, B_QS), B_QS]
]

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  // Without these the browser quietly throttles a window it thinks is idle or
  // occluded, and a rep that happened to be behind another window reads as a
  // regression that has nothing to do with the code.
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--window-size=520,1000',
  'about:blank'
], { stdio: 'ignore' })

const api = `http://127.0.0.1:${PORT}/json`

const waitForChrome = async () => {
  for (let i = 0; i < 160; i++) {
    try {
      const r = await fetch(`${api}/version`)
      if (r.ok) return r.json()
    } catch { /* not up yet */ }
    await sleep(250)
  }
  throw new Error('Chrome did not expose a debugging port')
}

let msgId = 0
const connect = wsUrl => {
  const ws = new WebSocket(wsUrl)
  const pending = new Map()
  const ready = new Promise((res, rej) => {
    ws.onopen = () => res()
    ws.onerror = e => rej(new Error(`ws error ${e?.message ?? ''}`))
  })
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data)
    const p = m.id && pending.get(m.id)
    if (!p) return
    pending.delete(m.id)
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result)
  }
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++msgId
    pending.set(id, { res, rej })
    ws.send(JSON.stringify({ id, method, params }))
  })
  return { ws, ready, send }
}

const runOnce = async url => {
  const t = await (await fetch(`${api}/new?about:blank`, { method: 'PUT' })).json()
  const { ws, ready, send } = connect(t.webSocketDebuggerUrl)
  await ready
  try {
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
    await send('Page.navigate', { url })
    for (let i = 0; i < 1200; i++) {
      await sleep(500)
      const r = await send('Runtime.evaluate', {
        expression: 'window.__perfDone ? JSON.stringify(window.__perf) : ""',
        returnByValue: true
      })
      if (r?.result?.value) return JSON.parse(r.result.value)
    }
    throw new Error(`run did not finish: ${url}`)
  } finally {
    ws.close()
    await fetch(`${api}/close/${t.id}`).catch(() => {})
  }
}

const median = a => {
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** The flags an arm's query string asked for, so a typo can be caught. */
const wanted = qs => qs.split('&')
  .filter(p => p.startsWith('perf='))
  .flatMap(p => p.slice(5).split(','))
  .filter(Boolean)

const version = await waitForChrome()
console.log(`browser    ${version.Browser}`)
console.log(`base       ${BASE}`)
console.log(`arms       A "${A_QS || '(none)'}"   B "${B_QS || '(none)'}"`)
console.log(`throttle   ${THROTTLE}x    frames/rep ${FRAMES}    reps ${REPS}`)
console.log(`metric     ${METRIC}\n`)

const runs = { A_base: [], B_test: [] }
for (let rep = 0; rep < REPS; rep++) {
  // Flip the order on odd reps. Thermal drift, CPU boost and background load
  // all trend one way across a session, and a fixed A-then-B order hands that
  // drift to whichever arm runs first as a free win.
  const order = rep % 2 === 0 ? ARMS : [...ARMS].reverse()
  for (const [name, url, qs] of order) {
    const r = await runOnce(url)
    // An unrecognised flag is silently false, which yields a clean, confident,
    // completely worthless A-versus-A result. Refuse to produce one.
    for (const f of wanted(qs)) {
      if (!r.variants?.includes(f)) {
        throw new Error(`arm ${name} asked for "${f}" but the page reported [${r.variants ?? ''}]`)
      }
    }
    runs[name].push(r)
    console.log(`rep ${String(rep + 1).padStart(2)} ${name}  ` +
      `workP50=${r.workP50.toFixed(3)}  workP95=${r.workP95.toFixed(3)}  ` +
      `intervalP95=${r.intervalP95.toFixed(2)}  longTasks=${r.longTasks}  ` +
      `heap=${(r.heapSlope / 1024).toFixed(1)}KB/f`)
  }
}

const pick = r => r[METRIC]
const A = runs.A_base.map(pick)
const B = runs.B_test.map(pick)
const mA = median(A)
const mB = median(B)
const delta = (mB - mA) / mA * 100
const improve = -delta

// Paired, not unpaired. Each rep runs both arms back to back, so the question
// is whether B beat A rep for rep — not whether the gap clears one arm's spread
// across the session, which drift inflates for both arms equally.
const wins = A.filter((a, i) => B[i] < a).length
const disjoint = Math.max(...B) < Math.min(...A)

console.log('')
console.log(`median-of-rep ${METRIC}   A ${mA.toFixed(3)} ms  ->  B ${mB.toFixed(3)} ms   (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)`)
console.log(`paired wins for B        ${wins}/${A.length} reps`)
console.log(`ranges                   A [${Math.min(...A).toFixed(3)}, ${Math.max(...A).toFixed(3)}]  ` +
  `B [${Math.min(...B).toFixed(3)}, ${Math.max(...B).toFixed(3)}]  ${disjoint ? 'DISJOINT' : 'overlapping'}`)

// Secondary metrics that can veto a win outright.
const iA = median(runs.A_base.map(r => r.intervalP95))
const iB = median(runs.B_test.map(r => r.intervalP95))
const hA = median(runs.A_base.map(r => r.heapSlope))
const hB = median(runs.B_test.map(r => r.heapSlope))
console.log(`RAF interval p95         A ${iA.toFixed(2)} ms -> B ${iB.toFixed(2)} ms`)
console.log(`heap slope               A ${(hA / 1024).toFixed(1)} KB/f -> B ${(hB / 1024).toFixed(1)} KB/f`)
console.log('')

if (iB > iA * 1.05) {
  console.log('VERDICT: NOT a win — RAF interval regressed >5%. CPU time was traded for GPU time.')
} else if (wins === A.length && disjoint && improve >= 5) {
  console.log('VERDICT: keep — won every rep, ranges do not overlap')
} else if (improve >= 5 && wins / A.length >= 0.8) {
  console.log('VERDICT: keep')
} else if (improve >= 3) {
  console.log('VERDICT: marginal — keep only if it also removes complexity')
} else if (improve > -3) {
  console.log('VERDICT: revert to the simpler code, and log the null result')
} else {
  console.log('VERDICT: regression — revert')
}
console.log('\nRecord this run in PERF-LEDGER.md, then delete the losing branch and its flag.')

chrome.kill()
process.exit(0)
