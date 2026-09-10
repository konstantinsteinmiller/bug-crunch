import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ─── Haptics ────────────────────────────────────────────────────────────────
 *
 * Everything worth pinning here is a REFUSAL. A vibration that fires is
 * obvious on the device and invisible in CI; a vibration that fires while an
 * interstitial is up is a portal rejection, and it is invisible in both until
 * somebody's phone buzzes under an ad.
 *
 * `hapticsAvailable` is resolved once at module load — that is deliberate (it
 * runs two long user-agent regexes and is read from the render loop) — so every
 * block here installs the environment it wants BEFORE importing the module, and
 * `vi.resetModules()` between them is what makes a second environment possible.
 */

const installMobile = (): ReturnType<typeof vi.fn> => {
  const vibrate = vi.fn(() => true)
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
  vi.doMock('@/utils/function', async (orig) => ({
    ...(await orig() as object),
    mobileCheck: () => true
  }))
  return vibrate
}

const loadHaptics = () => import('@/use/useHaptics')

/**
 * …with the player's toggle explicitly ON.
 *
 * Not a belt-and-braces re-assert of the default: the save layer under these
 * specs writes through `SaveManager`, so the `off` a gate spec persists can land
 * in localStorage AFTER a later spec's `clear()` — which disarms the module and
 * turns an assertion about throttling into an assertion about nothing. It only
 * reproduces on a loaded machine, which is exactly when nobody is looking. The
 * availability block below deliberately does NOT use this: proving the default
 * is its whole job.
 */
const loadArmed = async () => {
  const mod = await loadHaptics()
  mod.setHapticsEnabled(true)
  return mod
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

afterEach(() => {
  vi.doUnmock('@/utils/function')
  vi.restoreAllMocks()
  delete (navigator as any).vibrate
})

describe('there has to be a motor', () => {
  it('is unavailable on a desktop that ships the API anyway (Chrome)', async () => {
    Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), configurable: true, writable: true })
    vi.doMock('@/utils/function', async (orig) => ({
      ...(await orig() as object),
      mobileCheck: () => false
    }))
    const { hapticsAvailable } = await loadHaptics()
    expect(hapticsAvailable).toBe(false)
  })

  it('is unavailable on a phone whose browser has no `vibrate` at all (iOS Safari)', async () => {
    delete (navigator as any).vibrate
    vi.doMock('@/utils/function', async (orig) => ({
      ...(await orig() as object),
      mobileCheck: () => true
    }))
    const { hapticsAvailable } = await loadHaptics()
    expect(hapticsAvailable).toBe(false)
  })

  it('no-ops silently rather than throwing where it is unavailable', async () => {
    delete (navigator as any).vibrate
    const { haptic } = await loadHaptics()
    expect(() => { haptic('tick'); haptic('reward'); haptic('impact') }).not.toThrow()
  })

  it('is available, and ON by default, on a phone that has one', async () => {
    installMobile()
    const { hapticsAvailable, hapticsEnabled } = await loadHaptics()
    expect(hapticsAvailable).toBe(true)
    expect(hapticsEnabled.value).toBe(true)
  })
})

describe('the three cues are three durations of the same thing', () => {
  it('sends the roadmap patterns', async () => {
    const vibrate = installMobile()
    const { haptic, __resetHapticThrottle } = await loadArmed()

    haptic('tick')
    expect(vibrate).toHaveBeenLastCalledWith(8)
    __resetHapticThrottle()
    haptic('reward')
    expect(vibrate).toHaveBeenLastCalledWith(25)
    __resetHapticThrottle()
    haptic('impact')
    expect(vibrate).toHaveBeenLastCalledWith([40, 30, 60])
  })
})

describe('it is silent everywhere the mixer is silent', () => {
  it('refuses while the player has turned it off — and cancels a pattern mid-flight', async () => {
    const vibrate = installMobile()
    const { haptic, setHapticsEnabled } = await loadArmed()

    setHapticsEnabled(false)
    // `vibrate(0)` is the cancel, not a cue: a boss slam already running has
    // 90 ms left in it when the toggle is thrown.
    expect(vibrate).toHaveBeenCalledWith(0)
    vibrate.mockClear()
    haptic('tick')
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('refuses while the game is paused — which is every ad, every tab-hide', async () => {
    const vibrate = installMobile()
    const { haptic } = await loadArmed()
    const { isAdShowing } = await import('@/use/useGamePause')

    isAdShowing.value = true
    haptic('tick')
    expect(vibrate).not.toHaveBeenCalled()
    isAdShowing.value = false
  })

  it('refuses while engine audio is suspended', async () => {
    const vibrate = installMobile()
    const { haptic } = await loadArmed()
    const { suspendAllAudio, resumeAllAudio } = await import('@/use/useAssets')

    suspendAllAudio()
    haptic('tick')
    expect(vibrate).not.toHaveBeenCalled()
    resumeAllAudio()
  })

  it('refuses while the PORTAL has muted the game', async () => {
    const vibrate = installMobile()
    const { haptic } = await loadArmed()
    const { isPlatformAudioMuted } = await import('@/use/useGamePauseAudio')

    isPlatformAudioMuted.value = true
    haptic('tick')
    expect(vibrate).not.toHaveBeenCalled()
    isPlatformAudioMuted.value = false
  })

  it('refuses while the on-screen mobile mute is on', async () => {
    const vibrate = installMobile()
    const { haptic } = await loadArmed()
    const { isMobileAudioMuted } = await import('@/use/useMobileAudioMute')

    isMobileAudioMuted.value = true
    haptic('tick')
    expect(vibrate).not.toHaveBeenCalled()
    isMobileAudioMuted.value = false
  })

  it('fires again once every gate has cleared', async () => {
    const vibrate = installMobile()
    const { haptic } = await loadArmed()
    haptic('tick')
    expect(vibrate).toHaveBeenCalledWith(8)
  })
})

describe('the budget is what stops a phone buzzing continuously', () => {
  it('collapses a burst of ticks in one frame to a single pulse', async () => {
    const vibrate = installMobile()
    const { haptic } = await loadArmed()

    // A three-leaf bank on a late stage, all three doors ticking in the same
    // frame. The clock is frozen rather than merely fast, because "one frame"
    // is the premise: a loaded CI box that took 200 ms over twelve calls would
    // otherwise pass this spec by legitimately letting a second pulse through.
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    for (let i = 0; i < 12; i++) haptic('tick')
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('caps a stage-45 pump at about six pulses a second, not twenty-five', async () => {
    const vibrate = installMobile()
    const { haptic } = await loadArmed()

    // `GATE_TICK_MIN_MS` is 120 ms and three leaves run their own clocks, so a
    // late bank can emit a tick every ~40 ms. Drive exactly that for one second.
    let t = 0
    vi.spyOn(performance, 'now').mockImplementation(() => t)
    for (let i = 0; i < 25; i++) { t = i * 40; haptic('tick') }

    // 4 per 700 ms window — a hand can still count that; twenty-five is a buzz.
    expect(vibrate.mock.calls.length).toBeLessThanOrEqual(7)
    expect(vibrate.mock.calls.length).toBeGreaterThanOrEqual(4)
  })

  it('lets a stage-1 pump through untouched — the gap must never bite there', async () => {
    const vibrate = installMobile()
    const { haptic } = await loadArmed()

    // `GATE_TICK_MS` is 500 ms. Six ticks is a full approach on an early door.
    let t = 0
    vi.spyOn(performance, 'now').mockImplementation(() => t)
    for (let i = 0; i < 6; i++) { t = i * 500; haptic('tick') }
    expect(vibrate).toHaveBeenCalledTimes(6)
  })

  it('lets two boss slams through and refuses the third', async () => {
    const vibrate = installMobile()
    const { haptic } = await loadArmed()

    let t = 0
    vi.spyOn(performance, 'now').mockImplementation(() => t)
    for (const at of [0, 400, 800]) { t = at; haptic('impact') }
    expect(vibrate).toHaveBeenCalledTimes(2)
  })
})
