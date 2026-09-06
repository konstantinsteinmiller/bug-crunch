// ─── Device quality calibration ─────────────────────────────────────────────
//
// The first ten seconds of rendered time are a measurement of the device, not
// just another window for the steady-state controller.
//
// Why it exists: the rolling FPS average needs 60 frames before it says
// anything — three seconds on a device running at 20 fps, which is exactly the
// device that cannot afford them — and it starts at `high`, so the weakest
// hardware pays the highest price while the player is still deciding whether the
// game is worth their time. Players reported "heavy lag on mobile"; a 6x-CPU
// profile measured 20 fps with 114 long tasks in a 20 s window.
//
// The `min` rung and the resolution RATCHET below came from the follow-up
// report: runs still sitting at ~10 fps. Two holes closed — the ladder had no
// rung under 40 fps, so a device at 12 fps and one at 38 fps were given the same
// treatment; and the canvas resolution committed once and never moved again, so
// a device that met its trouble AFTER the calibration window had the single
// biggest lever bolted shut for the rest of the session.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const load = async () => {
  const mod = await import('@/use/useVfx')
  mod.__resetQualityCalibration()
  return mod
}

/** Feed `n` frames of `ms` each. */
const feed = (sample: (ms: number) => void, ms: number, n: number): void => {
  for (let i = 0; i < n; i++) sample(ms)
}

describe('quality calibration', () => {
  beforeEach(async () => { (await load()) })

  it('starts optimistic', async () => {
    const { quality, isQualityCalibrated } = await load()
    expect(quality.value).toBe('high')
    expect(isQualityCalibrated()).toBe(false)
  })

  it('drops a struggling device within one batch, not 60 frames', async () => {
    const { quality, sampleFrame } = await load()
    // ~14 fps. The steady-state controller would still be silent here.
    feed(sampleFrame, 70, 24)
    expect(quality.value).toBe('min')
  })

  it('drops a middling device to medium, not to low', async () => {
    const { quality, sampleFrame } = await load()
    feed(sampleFrame, 22, 24)   // ~45 fps
    expect(quality.value).toBe('medium')
  })

  it('puts a 30 fps device on `low` and a 12 fps device on `min`', async () => {
    const a = await load()
    feed(a.sampleFrame, 33, 24)     // ~30 fps — bad, not desperate
    expect(a.quality.value).toBe('low')

    const b = await load()
    feed(b.sampleFrame, 83, 24)     // ~12 fps — the reported case
    expect(b.quality.value).toBe('min')
  })

  it('leaves a healthy device alone', async () => {
    const { quality, sampleFrame } = await load()
    feed(sampleFrame, 16, 120)  // ~60 fps
    expect(quality.value).toBe('high')
  })

  it('never upgrades DURING calibration', async () => {
    const { quality, sampleFrame } = await load()
    feed(sampleFrame, 70, 24)
    expect(quality.value).toBe('min')
    // The device recovers, but calibration is a downgrade-only measurement:
    // flapping the resolution back up mid-window is what it exists to prevent.
    feed(sampleFrame, 10, 48)
    expect(quality.value).toBe('min')
  })

  it("ignores spikes that are not the renderer's fault", async () => {
    const { quality, sampleFrame } = await load()
    // A tab switch / GC pause / breakpoint. Excluded outright — from the
    // steady-state window as well as from calibration. That second half
    // matters now the window also closes on elapsed TIME: one 4 s stall is a
    // full window on its own, and it reads as 0.25 fps.
    feed(sampleFrame, 4000, 5)
    expect(quality.value).toBe('high')
  })

  it('survives the sprite-bake spikes a healthy device legitimately produces', async () => {
    const { quality, sampleFrame } = await load()
    // The stage top-up bakes monster strips in the first moments of a stage:
    // a handful of expensive frames among many good ones. A mean would call this
    // a slow device and cap it for the session; the median must not.
    for (let i = 0; i < 24; i++) sampleFrame(i % 8 === 0 ? 90 : 12)
    expect(quality.value).toBe('high')
  })

  it('closes the window after ~10s of rendered time and latches a ceiling', async () => {
    const { quality, sampleFrame, isQualityCalibrated, qualityCeilingTier } = await load()
    feed(sampleFrame, 33, 24)                 // ~30 fps -> low
    expect(quality.value).toBe('low')

    feed(sampleFrame, 33, 320)                // past 10 000 ms of frame time
    expect(isQualityCalibrated()).toBe(true)
    expect(qualityCeilingTier()).toBe('low')
  })

  it('will not climb back above the ceiling once measured', async () => {
    const { quality, sampleFrame, isQualityCalibrated } = await load()
    feed(sampleFrame, 33, 344)                // calibrate to low, window closed
    expect(isQualityCalibrated()).toBe(true)
    expect(quality.value).toBe('low')

    // A quiet stretch at a perfect 60 fps. The steady-state controller wants
    // `high`; the measurement says this device could not hold it. Raising it
    // would pop the resolution up, stutter, and drop it again.
    feed(sampleFrame, 16, 600)
    expect(quality.value).toBe('low')
  })

  it('a calibrated-high device still uses the full steady-state range', async () => {
    const { quality, sampleFrame, qualityCeilingTier } = await load()
    feed(sampleFrame, 16, 700)                // healthy through the whole window
    expect(qualityCeilingTier()).toBe('high')

    // It may still degrade later — the ceiling only blocks going UP.
    feed(sampleFrame, 70, 120)
    expect(quality.value).not.toBe('high')
  })
})

describe('post-calibration degradation', () => {
  it('reaches a verdict on ONE SECOND of rendered time, not 60 frames', async () => {
    const { quality, sampleFrame } = await load()
    // Calibrate healthy so the ceiling is `high` and the window is closed. 720
    // is a whole number of 60-frame windows, so the next window starts empty
    // and the count below is the whole story.
    feed(sampleFrame, 16, 720)
    expect(quality.value).toBe('high')

    // The device now runs at 10 fps. TEN frames is one second of play, and the
    // verdict lands on it. Under a pure 60-frame window the same device waits
    // six seconds — the device in the most trouble waiting the longest for
    // help, which is exactly backwards.
    feed(sampleFrame, 100, 10)
    expect(quality.value).toBe('min')
  })

  it('steps all the way down to `min` when the device is at 10 fps', async () => {
    const { quality, sampleFrame } = await load()
    feed(sampleFrame, 16, 720)
    // Each window is a downgrade, and downgrades do not wait for the hold.
    feed(sampleFrame, 100, 60)
    expect(quality.value).toBe('min')
  })

  it('lets a downgrade through the hold that blocks an upgrade', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const { quality, sampleFrame } = await load()
      feed(sampleFrame, 16, 720)

      feed(sampleFrame, 30, 40)               // ~33 fps -> low, hold starts
      expect(quality.value).toBe('low')

      // No wall-clock time has passed, so the 2.5 s hold is fully in force.
      // An upgrade is refused...
      feed(sampleFrame, 16, 60)
      expect(quality.value).toBe('low')
      // ...and a downgrade is not, because a player at 10 fps must not wait
      // two and a half seconds for permission to be helped.
      feed(sampleFrame, 100, 30)
      expect(quality.value).toBe('min')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('render-scale ratchet', () => {
  it('commits the cheaper canvas the first time calibration says the device cannot hold high', async () => {
    const { renderScaleTier, sampleFrame } = await load()
    expect(renderScaleTier.value).toBe('high')
    feed(sampleFrame, 70, 24)
    expect(renderScaleTier.value).toBe('min')
  })

  it('steps down AFTER calibration once the lower tier has held for four seconds', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const { quality, renderScaleTier, sampleFrame } = await load()

      // A device that calibrates clean: the canvas commits at full resolution.
      feed(sampleFrame, 16, 700)
      expect(renderScaleTier.value).toBe('high')

      // Then it meets a boss wave and collapses to 10 fps. The tier follows
      // immediately; the RESOLUTION must not, because re-sizing re-bakes every
      // cached surface and that is itself a stall.
      feed(sampleFrame, 100, 60)
      expect(quality.value).toBe('min')
      expect(renderScaleTier.value).toBe('high')

      // Four seconds of it, though, is not a spike.
      vi.setSystemTime(new Date('2026-01-01T00:00:05Z'))
      feed(sampleFrame, 100, 12)
      expect(renderScaleTier.value).toBe('min')
    } finally {
      vi.useRealTimers()
    }
  })

  it('never raises the resolution again, however well the device recovers', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      const { renderScaleTier, sampleFrame } = await load()
      feed(sampleFrame, 70, 24)
      expect(renderScaleTier.value).toBe('min')

      vi.setSystemTime(new Date('2026-01-01T00:01:00Z'))
      feed(sampleFrame, 16, 600)
      expect(renderScaleTier.value).toBe('min')
    } finally {
      vi.useRealTimers()
    }
  })
})
