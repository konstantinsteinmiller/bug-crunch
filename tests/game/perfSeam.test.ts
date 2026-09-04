// ─── The A/B performance seam ───────────────────────────────────────────────
//
// `perfVariants` + `usePerfProbe` exist to measure the game, and they ship in
// the player's bundle to do it. So the properties that matter are not really
// about statistics — they are about the seam never costing or breaking anything
// when nobody is running an experiment:
//
//   • With no flag set, every experiment resolves to its SHIPPING path. A stray
//     query string must never put a player on a baseline arm.
//   • With the probe off, every entry point is a no-op and nothing is attached
//     to `window`.
//   • A flag that fails to parse must read as "not selected", not throw. The
//     seam must never be the thing that breaks a boot.
//
// And one that IS about the measurement: a typo'd flag has to be visible.
// Silently resolving to false yields a clean, confident, completely worthless
// A-versus-A result, which is why the runner reads `activeVariants()` back and
// asserts the arm it asked for is the arm that ran.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setSearch = (search: string): void => {
  window.history.replaceState({}, '', `/${search}`)
}

beforeEach(() => {
  vi.resetModules()
  setSearch('')
  localStorage.removeItem('perf')
  localStorage.removeItem('perfprobe')
  delete (window as unknown as Record<string, unknown>).__perf
  delete (window as unknown as Record<string, unknown>).__perfDone
  delete (window as unknown as Record<string, unknown>).__perfProbe
})

afterEach(() => {
  setSearch('')
})

describe('perfVariants', () => {
  it('resolves to the shipping path when nothing is set', async () => {
    const m = await import('@/use/perfVariants')
    expect(m.perfFlag('smoke-legacy')).toBe(false)
    expect(m.activeVariants()).toEqual([])
  })

  it('reads a flag from the URL', async () => {
    setSearch('?perf=smoke-legacy')
    const m = await import('@/use/perfVariants')
    expect(m.perfFlag('smoke-legacy')).toBe(true)
    expect(m.activeVariants()).toEqual(['smoke-legacy'])
  })

  it('reads a flag from localStorage when the URL has none', async () => {
    localStorage.setItem('perf', 'muzzle-legacy')
    const m = await import('@/use/perfVariants')
    expect(m.perfFlag('muzzle-legacy')).toBe(true)
  })

  it('lets the URL win over localStorage, so one run cannot inherit another', async () => {
    localStorage.setItem('perf', 'stale-flag')
    setSearch('?perf=fresh-flag')
    const m = await import('@/use/perfVariants')
    expect(m.perfFlag('fresh-flag')).toBe(true)
    expect(m.perfFlag('stale-flag')).toBe(false)
  })

  it('parses a comma-separated list and trims it', async () => {
    setSearch('?perf=a, b ,,c')
    const m = await import('@/use/perfVariants')
    expect(m.activeVariants().sort()).toEqual(['a', 'b', 'c'])
  })

  // The runner's guard depends on this: it asks the page which flags it
  // actually parsed, so a typo surfaces as an error instead of as a confident
  // A-versus-A result.
  it('reports exactly what it parsed, so a typo is visible to the runner', async () => {
    setSearch('?perf=smoek-legacy')
    const m = await import('@/use/perfVariants')
    expect(m.perfFlag('smoke-legacy')).toBe(false)
    expect(m.activeVariants()).toEqual(['smoek-legacy'])
  })
})

describe('usePerfProbe', () => {
  it('is off by default and every entry point is a no-op', async () => {
    const m = await import('@/use/usePerfProbe')
    expect(m.isPerfProbeEnabled()).toBe(false)

    // Would record 500 frames if it were live.
    for (let i = 0; i < 500; i++) {
      m.frameStart(i * 16)
      m.phaseStart('draw')
      m.phaseEnd('draw')
      m.frameEnd()
    }
    expect(m.perfSummary().frames).toBe(0)
  })

  it('attaches nothing to window when off', async () => {
    const m = await import('@/use/usePerfProbe')
    m.installPerfProbe([], 10)
    expect((window as unknown as Record<string, unknown>).__perfProbe).toBeUndefined()
    expect((window as unknown as Record<string, unknown>).__perf).toBeUndefined()
  })

  it('records once enabled, after discarding the warmup frames', async () => {
    setSearch('?perfprobe=1')
    const m = await import('@/use/usePerfProbe')
    expect(m.isPerfProbeEnabled()).toBe(true)

    // 120 warmup frames are dropped by design — JIT warmup and first-frame
    // asset work are not what any experiment is about.
    for (let i = 0; i < 120; i++) { m.frameStart(i * 16); m.frameEnd() }
    expect(m.perfSummary().frames).toBe(0)

    for (let i = 120; i < 170; i++) { m.frameStart(i * 16); m.frameEnd() }
    expect(m.perfSummary().frames).toBe(50)
  })

  it('reports the RAF interval separately from work', async () => {
    setSearch('?perfprobe=1')
    const m = await import('@/use/usePerfProbe')
    // A 50 ms spacing must not be mistaken for 50 ms of our own work — a change
    // that trades CPU for GPU improves `work` while the game gets worse, and
    // the interval is the only thing that shows it.
    for (let i = 0; i < 200; i++) { m.frameStart(i * 50); m.frameEnd() }
    const s = m.perfSummary()
    expect(s.intervalP50).toBeCloseTo(50, 1)
    expect(s.workP50).toBeLessThan(50)
  })

  it('carries the active variants into the summary the runner reads', async () => {
    setSearch('?perfprobe=1')
    const m = await import('@/use/usePerfProbe')
    expect(m.perfSummary(['smoke-legacy']).variants).toEqual(['smoke-legacy'])
  })

  it('resets cleanly between runs', async () => {
    setSearch('?perfprobe=1')
    const m = await import('@/use/usePerfProbe')
    for (let i = 0; i < 200; i++) { m.frameStart(i * 16); m.frameEnd() }
    expect(m.perfSummary().frames).toBeGreaterThan(0)
    m.perfReset()
    expect(m.perfSummary().frames).toBe(0)
  })

  it('survives a localStorage that throws, rather than breaking the boot', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode')
    })
    try {
      const variants = await import('@/use/perfVariants')
      const probe = await import('@/use/usePerfProbe')
      expect(variants.activeVariants()).toEqual([])
      expect(probe.isPerfProbeEnabled()).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })
})
