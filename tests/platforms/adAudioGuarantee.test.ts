// The ad-audio guarantee end to end through `useAds`: the real ad layer, pause
// gate, orchestrator and audio guard, with only the provider stubbed.
//
// The case that failed in a real browser (the v0.3.1 Poki build, the REAL Poki
// core in Inspector mode, the house-ad video held back so it opened late):
//
//   t=0     commercialBreak() called; audio killed, gate held
//   t=6.2s  "never opened" cap → gate AND audio released while Poki's ad
//           overlay was still up and loading → AudioContext running, music
//           restarted by the placement's post-ad restart → audible under the ad
//   t=7.7s  onStart → the kill flipped `isAdShowing` true AFTER the `finally`
//           that clears it had run → never cleared again: the game sat paused
//           and silent for the rest of the session.
//
// Each test below fails against that code and passes against `runAd`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

interface Deferred<T> { promise: Promise<T>; resolve: (v: T) => void }
const defer = <T>(): Deferred<T> => {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

class FakeAudioContext extends EventTarget {
  state: 'suspended' | 'running' | 'closed' = 'running'
  resume (): Promise<void> { return Promise.resolve().then(() => this.set('running')) }
  suspend (): Promise<void> { return Promise.resolve().then(() => this.set('suspended')) }
  set (s: 'suspended' | 'running'): void {
    if (this.state === s) return
    this.state = s
    this.dispatchEvent(new Event('statechange'))
  }
}

const mockProvider = {
  name: 'mock-late',
  isReady: ref(true),
  isRewardedReady: ref(true),
  isInterstitialReady: ref(true),
  isAdsBlocked: ref(false),
  init: vi.fn(async () => {}),
  showRewardedAd: vi.fn(async (_onImpression?: () => void) => true),
  showMidgameAd: vi.fn(async (_onImpression?: () => void) => {})
}

vi.mock('@/platforms/resolveAdProvider', () => ({
  resolveAdProvider: () => mockProvider
}))

const DRAIN = 200

const load = async (opts: { soundMock?: Record<string, unknown> } = {}) => {
  vi.resetModules()
  if (opts.soundMock) vi.doMock('@/use/useSound', () => opts.soundMock)
  else vi.doUnmock('@/use/useSound')
  mockProvider.showRewardedAd.mockReset()
  mockProvider.showMidgameAd.mockReset()
  const ads = await import('@/use/useAds')
  const gate = await import('@/use/useGamePause')
  const guard = await import('@/use/audioGuard')
  return { ads, gate, guard }
}

let impression: (() => void) | undefined
let guardRef: typeof import('@/use/audioGuard') | null = null

beforeEach(() => {
  impression = undefined
  ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext
  vi.useFakeTimers()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  guardRef?.uninstallAudioGuard()
  guardRef = null
  delete (window as unknown as { AudioContext?: unknown }).AudioContext
  window.localStorage.clear()
})

const newContext = (): FakeAudioContext =>
  new (window as unknown as { AudioContext: new () => FakeAudioContext }).AudioContext()

describe('an ad that opens AFTER the "never opened" cap', () => {
  it('interstitial: game back at the cap, audio held; the late ad re-takes the gate and lets go when the SDK finishes', async () => {
    const { ads, gate, guard } = await load()
    guardRef = guard
    const ctx = newContext() // the game's shared context, or anyone else's
    const d = defer<void>()
    mockProvider.showMidgameAd.mockImplementation((onImpression?: () => void) => {
      impression = onImpression
      return d.promise
    })

    let done = false
    void ads.showMidgameAd().then(() => { done = true })
    await vi.advanceTimersByTimeAsync(DRAIN + 6100)

    // The caller is handed back (result screen may show)…
    expect(done).toBe(true)
    expect(gate.isAdShowing.value).toBe(false)
    // …but the SDK is still running its break: nothing may sound yet.
    expect(guard.isAudioSuspended()).toBe(true)
    expect(ctx.state).toBe('suspended')

    // The ad finally opens.
    await vi.advanceTimersByTimeAsync(1500)
    impression!()
    expect(gate.isAdShowing.value).toBe(true)
    expect(guard.isAudioSuspended()).toBe(true)

    // …and ends. The gate must come back down — the old code left it up forever.
    d.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(gate.isAdShowing.value).toBe(false)
    expect(gate.isGamePaused.value).toBe(false)
    expect(guard.isAudioSuspended()).toBe(false)
    expect(ctx.state).toBe('running')
  })

  it('rewarded: a late-opening video silences the game too (it used to only note that it opened)', async () => {
    const { ads, gate, guard } = await load()
    guardRef = guard
    const d = defer<boolean>()
    mockProvider.showRewardedAd.mockImplementation((onImpression?: () => void) => {
      impression = onImpression
      return d.promise
    })

    let granted: boolean | null = null
    void ads.showRewardedAd().then((v) => { granted = v })
    await vi.advanceTimersByTimeAsync(DRAIN + 6100)
    expect(granted).toBe(false) // no answer in time is not a reward

    impression!()
    expect(gate.isAdShowing.value).toBe(true)
    expect(guard.isAudioSuspended()).toBe(true)

    d.resolve(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(gate.isAdShowing.value).toBe(false)
    expect(guard.isAudioSuspended()).toBe(false)
  })

  it('an SDK that never answers gets the game back at the cap and the audio back after the grace window', async () => {
    const { ads, gate, guard } = await load()
    guardRef = guard
    mockProvider.showMidgameAd.mockReturnValue(new Promise<void>(() => {}))

    void ads.showMidgameAd()
    await vi.advanceTimersByTimeAsync(DRAIN + 6100)
    expect(gate.isAdShowing.value).toBe(false)
    expect(guard.isAudioSuspended()).toBe(true)

    await vi.advanceTimersByTimeAsync(14_000) // past AD_AUDIO_GRACE_MS (20 s from the request)
    expect(guard.isAudioSuspended()).toBe(false)
  })

  it('a late open that cut live music brings it back after the late ad — once, and not before', async () => {
    const resumeMusicAfterAd = vi.fn()
    let wanted = false
    const forceStopMusic = vi.fn(() => { const was = wanted; wanted = false; return was })
    const { ads, guard } = await load({
      soundMock: {
        forceStopMusic,
        resumeMusicAfterAd,
        default: () => ({ playSound: vi.fn(), playLoop: vi.fn() }),
        useMusic: () => ({})
      }
    })
    guardRef = guard
    const d = defer<void>()
    mockProvider.showMidgameAd.mockImplementation((onImpression?: () => void) => {
      impression = onImpression
      return d.promise
    })

    void ads.showMidgameAd()
    await vi.advanceTimersByTimeAsync(DRAIN + 6100)
    wanted = true // the placement's own post-ad restart ran at the cap
    impression!()
    expect(resumeMusicAfterAd).not.toHaveBeenCalled()

    d.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(resumeMusicAfterAd).toHaveBeenCalledTimes(1)
  })
})

describe('sources created DURING an ad stay silent for the whole ad', () => {
  it('a context another module creates mid-ad is suspended until the ad is over', async () => {
    const { ads, guard } = await load()
    guardRef = guard
    const d = defer<void>()
    mockProvider.showMidgameAd.mockImplementation((onImpression?: () => void) => {
      onImpression?.()
      return d.promise
    })

    void ads.showMidgameAd()
    await vi.advanceTimersByTimeAsync(DRAIN + 1000)
    const lateCtx = newContext() // e.g. a music renderer spinning up its own
    await vi.advanceTimersByTimeAsync(0)
    expect(lateCtx.state).toBe('suspended')

    d.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(lateCtx.state).toBe('running')
  })

  it('every hold is released exactly once — back-to-back ads leave nothing held', async () => {
    const { ads, gate, guard } = await load()
    guardRef = guard
    mockProvider.showMidgameAd.mockImplementation(async (onImpression?: () => void) => { onImpression?.() })
    mockProvider.showRewardedAd.mockImplementation(async (onImpression?: () => void) => { onImpression?.(); return true })

    const a = ads.showMidgameAd()
    await vi.advanceTimersByTimeAsync(DRAIN)
    await a
    const b = ads.showRewardedAd()
    await vi.advanceTimersByTimeAsync(DRAIN)
    await b
    expect(gate.isAdShowing.value).toBe(false)
    expect(guard.isAudioSuspended()).toBe(false)
    expect(guard.__audioGuardSnapshot().depth).toBe(0)
  })
})
