// ─── In-page performance probe ──────────────────────────────────────────────
//
// Percentiles of work-per-frame and RAF interval, long-task count and heap
// slope, published on `window.__perf` for the A/B runner (`scripts/perf-ab.mjs`)
// to read back. See `PERF-LEDGER.md` for the procedure.
//
// ── Why percentiles and not mean fps ──
//
// Mean fps is dominated by the good frames. A device alternating 8 ms and 60 ms
// frames averages out looking fine and feels awful; the number that matches the
// felt experience is the tail. So the probe keeps the distribution and reports
// p50/p95/p99, and the primary metric is p95 work-per-frame.
//
// ── Why work-per-frame AND interval ──
//
// Work-per-frame is the time inside your own update+draw: it is what an
// optimization actually moves, and it stays meaningful when the loop is
// vsync-capped and every interval reads 16.7 ms. But it is CPU-side only, so a
// change that trades CPU for GPU can improve it while the game gets worse. The
// RAF interval is what absorbs GPU backpressure. Neither alone is safe; the
// runner reports both, and a "win" that improves work while regressing interval
// is not a win.
//
// ── Cost when off ──
//
// Disabled by default and resolved once at boot. Every entry point is then a
// call that reads one `const` boolean and returns, which V8 inlines away. When
// ON, the hot path writes into preallocated `Float64Array` ring buffers and
// allocates nothing; sorting happens only when the summary is read.
//
// Enable with `?perfprobe=1` or `localStorage.setItem('perfprobe', 'true')`.

const enabled = (() => {
  try {
    if (new URLSearchParams(window.location.search).has('perfprobe')) return true
    return localStorage.getItem('perfprobe') === 'true'
  } catch {
    return false
  }
})()

/** Frames retained. At 60 fps this is ~2.7 minutes, past the 60 s the procedure
 *  asks for, and the buffers cost 128 KB total. Older frames are overwritten. */
const CAPACITY = 10_000

const work = new Float64Array(CAPACITY)
const interval = new Float64Array(CAPACITY)
let count = 0
let head = 0

/** Frames dropped before recording starts. JIT warmup and first-frame asset
 *  work are not what any experiment is about. */
const WARMUP_FRAMES = 120
let warm = 0

let frameOpen = 0
let lastFrameAt = 0
let longTasks = 0
let heapFirst = 0
let heapLast = 0
let heapSamples = 0

// Phase timers. A fixed, pre-registered list rather than a Map keyed by string,
// so naming a phase costs an array index and not a hash per frame.
const PHASES = ['step', 'draw'] as const
export type PerfPhase = (typeof PHASES)[number]
const phaseTotal = new Float64Array(PHASES.length)
const phaseOpen = new Float64Array(PHASES.length)

if (enabled && typeof PerformanceObserver !== 'undefined') {
  try {
    new PerformanceObserver(list => { longTasks += list.getEntries().length })
      .observe({ entryTypes: ['longtask'] })
  } catch {
    // Not supported everywhere; the rest of the probe still works.
  }
}

/** Call at the top of the RAF callback, with the timestamp RAF handed you. */
export const frameStart = enabled
  ? (t: number): void => {
      if (lastFrameAt !== 0 && warm >= WARMUP_FRAMES) {
        interval[head] = t - lastFrameAt
      }
      lastFrameAt = t
      frameOpen = performance.now()
    }
  : (_t: number): void => {}

/** Call at the very end of the RAF callback. */
export const frameEnd = enabled
  ? (): void => {
      const spent = performance.now() - frameOpen
      if (warm < WARMUP_FRAMES) { warm++; return }
      work[head] = spent
      head = (head + 1) % CAPACITY
      if (count < CAPACITY) count++

      // Heap slope needs two points and a frame count; Chrome only.
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
      if (mem) {
        if (heapSamples === 0) heapFirst = mem.usedJSHeapSize
        heapLast = mem.usedJSHeapSize
        heapSamples++
      }
    }
  : (): void => {}

const phaseIndex = (p: PerfPhase): number => (p === 'step' ? 0 : 1)

export const phaseStart = enabled
  ? (p: PerfPhase): void => { phaseOpen[phaseIndex(p)] = performance.now() }
  : (_p: PerfPhase): void => {}

export const phaseEnd = enabled
  ? (p: PerfPhase): void => {
      const i = phaseIndex(p)
      phaseTotal[i]! += performance.now() - phaseOpen[i]!
    }
  : (_p: PerfPhase): void => {}

const percentile = (buf: Float64Array, n: number, p: number): number => {
  if (n === 0) return 0
  const a = Array.from(buf.subarray(0, n)).sort((x, y) => x - y)
  return a[Math.min(a.length - 1, Math.floor(a.length * p))]!
}

export interface PerfSummary {
  frames: number
  workP50: number
  workP95: number
  workP99: number
  intervalP50: number
  intervalP95: number
  /** Bytes per frame. A high slope with flat work is an allocation problem; the
   *  procedure's audit order turns on exactly this distinction. */
  heapSlope: number
  longTasks: number
  phases: Record<string, number>
  variants: string[]
}

export const perfSummary = (variants: string[] = []): PerfSummary => ({
  frames: count,
  workP50: +percentile(work, count, 0.5).toFixed(4),
  workP95: +percentile(work, count, 0.95).toFixed(4),
  workP99: +percentile(work, count, 0.99).toFixed(4),
  intervalP50: +percentile(interval, count, 0.5).toFixed(3),
  intervalP95: +percentile(interval, count, 0.95).toFixed(3),
  heapSlope: heapSamples > 1 ? Math.round((heapLast - heapFirst) / heapSamples) : 0,
  longTasks,
  phases: Object.fromEntries(
    PHASES.map((p, i) => [p, +(phaseTotal[i]! / Math.max(1, count)).toFixed(4)])
  ),
  variants
})

export const perfReset = (): void => {
  count = 0; head = 0; warm = 0; lastFrameAt = 0
  longTasks = 0; heapSamples = 0
  phaseTotal.fill(0)
}

export const isPerfProbeEnabled = (): boolean => enabled

/**
 * Publish the probe on `window.__perf` so the runner can read it over CDP, and
 * `window.__perfDone` once `frames` have been recorded.
 *
 * Installed only when the probe is on, so nothing is attached to `window` in a
 * player's session.
 */
export const installPerfProbe = (variants: string[] = [], frames = 600): void => {
  if (!enabled) return
  const w = window as unknown as Record<string, unknown>
  w.__perfProbe = { summary: () => perfSummary(variants), reset: perfReset }
  const tick = (): void => {
    const s = perfSummary(variants)
    w.__perf = s
    if (s.frames >= frames) w.__perfDone = true
    else setTimeout(tick, 250)
  }
  setTimeout(tick, 250)
}
