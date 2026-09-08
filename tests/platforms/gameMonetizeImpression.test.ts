// GameMonetize: the ad-OPEN edge the game reports back to `useAds`.
//
// `useAds` releases its wait 6 s in unless the provider reports that a real ad
// opened, so `showRewardedAdGM` / `showMidgameAdGM` have to surface that edge.
// The SDK's own signal is `SDK_GAME_PAUSE` — it asks the game to pause only once
// the ad layer is actually up — which is the same event the wrapper already uses
// to cancel its no-fill timer.
//
// Pinned here: the callback fires on that event, exactly once per ad, and NOT
// on a no-fill (where nothing was ever on screen and the short cap is correct).
//
// Mocks mirror `gameMonetizeFill.test.ts`: the plugin's heavy static deps are
// stubbed and `window.sdk` is driven directly.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/use/useUser', () => ({ isGameMonetize: true }))
vi.mock('@/use/useMatch', () => {
  const { ref } = require('vue')
  return { isDebug: ref(false) }
})
vi.mock('@/use/useGamePause', () => {
  const { ref } = require('vue')
  return { isAdShowing: ref(false), pauseGame: vi.fn(), resumeGame: vi.fn() }
})
vi.mock('@/utils/save/GameMonetizeStrategy', () => ({
  GameMonetizeStrategy: class {}
}))

const flush = async () => { await Promise.resolve(); await Promise.resolve() }

/** Deliver an SDK event through the single `onEvent` callback the plugin
 *  installs on `window.SDK_OPTIONS` — exactly how the live SDK fans them out. */
const emit = (name: string): void => {
  const onEvent = (window as any).SDK_OPTIONS?.onEvent
  if (typeof onEvent === 'function') onEvent({ name })
}

const initPlugin = async () => {
  vi.resetModules()
  const plugin = await import('@/utils/gameMonetizePlugin')
  ;(window as any).sdk = { showAd: vi.fn(() => undefined) }
  const ready = plugin.gameMonetizePlugin()
  emit('SDK_READY')
  await ready
  await flush()
  return plugin
}

describe('gameMonetize — reports the ad-open edge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('VITE_GAME_ID', 'test-game')
    delete (window as any).sdk
    delete (window as any).SDK_OPTIONS
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllEnvs()
    delete (window as any).sdk
    delete (window as any).SDK_OPTIONS
  })

  it('rewarded: fires onImpression on SDK_GAME_PAUSE, once, and grants on completion', async () => {
    const plugin = await initPlugin()
    const onImpression = vi.fn()

    const p = plugin.showRewardedAdGM(onImpression)
    expect(onImpression).not.toHaveBeenCalled()

    emit('SDK_GAME_PAUSE')
    expect(onImpression).toHaveBeenCalledTimes(1)
    // A second pause inside the same cycle (SDK chatter) must not double-report.
    emit('SDK_GAME_PAUSE')
    expect(onImpression).toHaveBeenCalledTimes(1)

    // The ad plays well past the 6 s cap `useAds` would otherwise have applied.
    await vi.advanceTimersByTimeAsync(20_000)
    emit('ALL_ADS_COMPLETED')
    emit('SDK_GAME_START')
    await expect(p).resolves.toBe(true)
  })

  it('rewarded: a no-fill never reports an impression', async () => {
    const plugin = await initPlugin()
    const onImpression = vi.fn()

    const p = plugin.showRewardedAdGM(onImpression)
    // Nothing opens: the wrapper's own no-fill timer resolves it.
    await vi.advanceTimersByTimeAsync(4_000)
    await expect(p).resolves.toBe(false)
    expect(onImpression).not.toHaveBeenCalled()
  })

  it('interstitial: fires onImpression on SDK_GAME_PAUSE and resolves on resume', async () => {
    const plugin = await initPlugin()
    const onImpression = vi.fn()

    const p = plugin.showMidgameAdGM(onImpression)
    emit('SDK_GAME_PAUSE')
    expect(onImpression).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(15_000)
    emit('SDK_GAME_START')
    await expect(p).resolves.toBeUndefined()
  })

  it('interstitial: a no-fill never reports an impression', async () => {
    const plugin = await initPlugin()
    const onImpression = vi.fn()

    const p = plugin.showMidgameAdGM(onImpression)
    await vi.advanceTimersByTimeAsync(4_000)
    await expect(p).resolves.toBeUndefined()
    expect(onImpression).not.toHaveBeenCalled()
  })

  it('both wrappers still work when no callback is passed', async () => {
    const plugin = await initPlugin()
    const r = plugin.showRewardedAdGM()
    emit('SDK_GAME_PAUSE')
    emit('SDK_GAME_START')
    await expect(r).resolves.toBe(false)
  })
})
