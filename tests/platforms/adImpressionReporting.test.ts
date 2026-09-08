// The ad-open (impression) contract, and the wiring every provider owes it.
//
// `useAds` arms a 6 s "the ad never opened" cap around every request so an SDK
// that accepts a request and then answers nothing (Edge's Tracking Prevention
// blocking ad hosts mid-flight is the shipped example) can't strand the game
// behind a promise that will never settle. The ONLY thing that tells it a real
// ad is on screen is the `onImpression` callback it hands to the provider.
//
// A provider that drops that callback therefore has every genuine ad guillotined
// at six seconds:
//   • rewarded  → the wait is released with `granted` still false, so a player
//                 who watched a full 30 s video is paid nothing, and the audio
//                 + game loop resume underneath the still-open ad;
//   • midgame   → `presentResult()` reveals the win/lose screen six seconds into
//                 an interstitial that is still playing — the exact
//                 "ad on top of the result screen" portal rejection.
//
// That is what shipped on GameMonetize, GamePix, GameDistribution and Playgama
// between the cap landing and this test: the parameter existed and nobody passed
// it. Hence two layers of assertions here — the CONTRACT (what the cap does with
// and without an impression) and the WIRING (every provider forwards it).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (v: T) => void
}
const defer = <T>(): Deferred<T> => {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}

const mockProvider = {
  name: 'mock-test',
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

const loadAds = async () => {
  vi.resetModules()
  mockProvider.isAdsBlocked.value = false
  mockProvider.showRewardedAd.mockReset()
  mockProvider.showMidgameAd.mockReset()
  return await import('@/use/useAds')
}

// `useAds` yields AUDIO_DRAIN_MS (200 ms) between killing the audio and calling
// the provider, so the provider isn't even invoked until that timer runs.
const AUDIO_DRAIN_MS = 200

describe('useAds — the stuck-ad cap respects a reported impression', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('rewarded: an ad that reported its impression runs long past the 6 s cap and still grants', async () => {
    const ads = await loadAds()
    const d = defer<boolean>()
    mockProvider.showRewardedAd.mockImplementation((onImpression?: () => void) => {
      onImpression?.()
      return d.promise
    })

    let granted: boolean | null = null
    const p = ads.showRewardedAd().then((v) => { granted = v })

    await vi.advanceTimersByTimeAsync(AUDIO_DRAIN_MS)
    // Well past the "never opened" cap — an impression was reported, so the
    // wait must still be running and the ad gate still held.
    await vi.advanceTimersByTimeAsync(20_000)
    expect(granted).toBeNull()
    const { isAdShowing } = await import('@/use/useGamePause')
    expect(isAdShowing.value).toBe(true)

    d.resolve(true)
    await p
    expect(granted).toBe(true)
    expect(isAdShowing.value).toBe(false)
  })

  it('rewarded: WITHOUT an impression the same ad is cut at 6 s and pays nothing', async () => {
    // The control case. It is what every un-wired provider was doing, and it is
    // also the behaviour the cap exists for when an SDK truly answers nothing.
    const ads = await loadAds()
    const d = defer<boolean>()
    mockProvider.showRewardedAd.mockImplementation(() => d.promise)

    let granted: boolean | null = null
    const p = ads.showRewardedAd().then((v) => { granted = v })

    await vi.advanceTimersByTimeAsync(AUDIO_DRAIN_MS)
    await vi.advanceTimersByTimeAsync(6_000)
    await p
    expect(granted).toBe(false)
  })

  it('midgame: an impression keeps the caller waiting, so the result screen stays behind the ad', async () => {
    const ads = await loadAds()
    const d = defer<void>()
    mockProvider.showMidgameAd.mockImplementation((onImpression?: () => void) => {
      onImpression?.()
      return d.promise
    })

    let done = false
    const p = ads.showMidgameAd().then(() => { done = true })

    await vi.advanceTimersByTimeAsync(AUDIO_DRAIN_MS)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(done).toBe(false)

    d.resolve()
    await p
    expect(done).toBe(true)
  })
})

// ─── The wiring ─────────────────────────────────────────────────────────────
//
// One case per provider that talks to a real SDK. Each asserts the callback
// `useAds` passes actually reaches the plugin call — identity, not just "a
// function", so a provider that invents its own callback and drops ours fails.

describe('every ad provider forwards onImpression to its plugin', () => {
  afterEach(() => { vi.resetModules() })

  it('GameMonetize', async () => {
    vi.resetModules()
    const showRewardedAdGM = vi.fn(async () => true)
    const showMidgameAdGM = vi.fn(async () => {})
    vi.doMock('@/utils/gameMonetizePlugin', () => ({
      gameMonetizePlugin: vi.fn(async () => {}),
      isGmSdkActive: ref(true),
      isGmAdsBlocked: ref(false),
      isGmRewardedFilled: ref(true),
      isGmAdCoolingDown: ref(false),
      showRewardedAdGM,
      showMidgameAdGM
    }))
    const { createGameMonetizeProvider } = await import('@/use/ads/GameMonetizeProvider')
    const provider = createGameMonetizeProvider()
    const onImpression = vi.fn()

    await provider.showRewardedAd(onImpression)
    await provider.showMidgameAd(onImpression)

    expect(showRewardedAdGM).toHaveBeenCalledWith(onImpression)
    expect(showMidgameAdGM).toHaveBeenCalledWith(onImpression)
  })

  it('GamePix', async () => {
    vi.resetModules()
    const showRewardedAdGP = vi.fn(async () => true)
    const showMidgameAdGP = vi.fn(async () => true)
    vi.doMock('@/utils/gamepixPlugin', () => ({
      gamepixPlugin: vi.fn(async () => {}),
      isGamepixSdkActive: ref(true),
      isGamepixAdsBlocked: ref(false),
      showRewardedAdGP,
      showMidgameAdGP
    }))
    const { createGamepixProvider } = await import('@/use/ads/GamepixProvider')
    const provider = createGamepixProvider()
    const onImpression = vi.fn()

    await provider.showRewardedAd(onImpression)
    await provider.showMidgameAd(onImpression)

    expect(showRewardedAdGP).toHaveBeenCalledWith(onImpression)
    expect(showMidgameAdGP).toHaveBeenCalledWith(onImpression)
  })

  it('GameDistribution', async () => {
    vi.resetModules()
    const showRewardedAdGD = vi.fn(async () => true)
    const showMidgameAdGD = vi.fn(async () => {})
    vi.doMock('@/utils/gameDistributionPlugin', () => ({
      gameDistributionPlugin: vi.fn(async () => {}),
      isGdSdkActive: ref(true),
      isGdAdsBlocked: ref(false),
      isGdRewardedFilled: ref(true),
      isGdAdCoolingDown: ref(false),
      showRewardedAdGD,
      showMidgameAdGD
    }))
    const { createGameDistributionProvider } = await import('@/use/ads/GameDistributionProvider')
    const provider = createGameDistributionProvider()
    const onImpression = vi.fn()

    await provider.showRewardedAd(onImpression)
    await provider.showMidgameAd(onImpression)

    expect(showRewardedAdGD).toHaveBeenCalledWith(onImpression)
    expect(showMidgameAdGD).toHaveBeenCalledWith(onImpression)
  })

  it('Playgama', async () => {
    vi.resetModules()
    const showRewardedPG = vi.fn(async () => true)
    const showInterstitialPG = vi.fn(async () => {})
    vi.doMock('@/utils/playgamaPlugin', () => ({
      playgamaPlugin: vi.fn(async () => {}),
      isPlaygamaSdkActive: ref(true),
      isPlaygamaAdsBlocked: ref(false),
      showRewardedPG,
      showInterstitialPG
    }))
    const { createPlaygamaProvider } = await import('@/use/ads/PlaygamaProvider')
    const provider = createPlaygamaProvider()
    const onImpression = vi.fn()

    await provider.showRewardedAd(onImpression)
    await provider.showMidgameAd(onImpression)

    expect(showRewardedPG).toHaveBeenCalledWith(onImpression)
    expect(showInterstitialPG).toHaveBeenCalledWith(onImpression)
  })

  it('CrazyGames', async () => {
    vi.resetModules()
    const showRewardedAd = vi.fn(async () => true)
    const showMidgameAd = vi.fn(async () => {})
    vi.doMock('@/use/useCrazyGames', () => ({
      isSdkActive: ref(true),
      isCrazyAdsBlocked: ref(false),
      showRewardedAd,
      showMidgameAd
    }))
    vi.doMock('@/use/useMatch', () => ({ isCrazyGamesFullRelease: true }))
    const { createCrazyGamesProvider } = await import('@/use/ads/CrazyGamesProvider')
    const provider = createCrazyGamesProvider()
    const onImpression = vi.fn()

    await provider.showRewardedAd(onImpression)
    await provider.showMidgameAd(onImpression)

    expect(showRewardedAd).toHaveBeenCalledWith(onImpression)
    expect(showMidgameAd).toHaveBeenCalledWith(onImpression)
  })
})
