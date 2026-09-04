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

import { beforeEach, describe, expect, it } from 'vitest'

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
    expect(quality.value).toBe('low')
  })

  it('drops a middling device to medium, not to low', async () => {
    const { quality, sampleFrame } = await load()
    feed(sampleFrame, 22, 24)   // ~45 fps
    expect(quality.value).toBe('medium')
  })

  it('leaves a healthy device alone', async () => {
    const { quality, sampleFrame } = await load()
    feed(sampleFrame, 16, 120)  // ~60 fps
    expect(quality.value).toBe('high')
  })

  it('never upgrades DURING calibration', async () => {
    const { quality, sampleFrame } = await load()
    feed(sampleFrame, 70, 24)
    expect(quality.value).toBe('low')
    // The device recovers, but calibration is a downgrade-only measurement:
    // flapping the resolution back up mid-window is what it exists to prevent.
    feed(sampleFrame, 10, 48)
    expect(quality.value).toBe('low')
  })

  it("ignores spikes that are not the renderer's fault", async () => {
    const { quality, sampleFrame } = await load()
    // A tab switch / GC pause / breakpoint. Excluded outright.
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
    feed(sampleFrame, 50, 24)                 // ~20 fps -> low
    expect(quality.value).toBe('low')

    feed(sampleFrame, 50, 200)                // past 10 000 ms of frame time
    expect(isQualityCalibrated()).toBe(true)
    expect(qualityCeilingTier()).toBe('low')
  })

  it('will not climb back above the ceiling once measured', async () => {
    const { quality, sampleFrame, isQualityCalibrated } = await load()
    feed(sampleFrame, 50, 224)                // calibrate to low, window closed
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

    // It may still degrade later — the ceiling only blocks going UP. It steps
    // down ONE tier here rather than straight to `low`, because the
    // steady-state controller holds 2.5 s of wall clock between changes and
    // these frames are synthetic: microseconds of real time pass.
    feed(sampleFrame, 70, 120)
    expect(quality.value).not.toBe('high')
  })
})
