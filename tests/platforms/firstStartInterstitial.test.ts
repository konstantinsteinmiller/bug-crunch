// First-PLAY interstitial gating (`useFirstStartInterstitial`).
//
// Pins the GameMonetize / GameDistribution moderation placement: an interstitial
// on the FIRST eligible click-to-start of the session, once only, and only when
// an ad is currently fillable. Other builds never fire it; a not-ready first tap
// doesn't burn the one-shot (so it retries on the next start).
//
// Poki rides the same placement for a different reason: it has no
// `showPreroll()`, and the core reports a `commercialBreak()` as a PREROLL until
// the first `gameplayStart()` and a midroll after it. `GameScene.boot()` awaits
// this before `startStage()`, so this call IS Poki's preroll.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const showMidgameAd = vi.fn(() => Promise.resolve())
// The shared 121 s interstitial clock. This placement deliberately bypasses
// `canShowInterstitial()` — it is the moderation-required first-play ad — but it
// must still SEED the clock, or the result-screen placement starts counting from
// scratch later and can request a second ad inside the window every portal
// rate-limits on.
const markInterstitialShown = vi.fn()

// Load the module fresh (resets its session flag) with the given build flags and
// a readiness ref we can flip to simulate the SDK coming up between taps.
const load = async (flags: { gm?: boolean; gd?: boolean; poki?: boolean }, ready = true) => {
  vi.resetModules()
  const { ref } = await import('vue')
  const readyRef = ref(ready)
  vi.doMock('@/use/useUser', () => ({
    isGameMonetize: !!flags.gm,
    isGameDistribution: !!flags.gd,
    isPoki: !!flags.poki
  }))
  vi.doMock('@/use/useAds', () => ({ isInterstitialReady: readyRef, showMidgameAd }))
  vi.doMock('@/use/useAdGate', () => ({ markInterstitialShown }))
  const mod = await import('@/use/useFirstStartInterstitial')
  return { mod, readyRef }
}

describe('useFirstStartInterstitial', () => {
  beforeEach(() => {
    showMidgameAd.mockClear()
    markInterstitialShown.mockClear()
  })
  afterEach(() => {
    vi.doUnmock('@/use/useUser')
    vi.doUnmock('@/use/useAds')
    vi.doUnmock('@/use/useAdGate')
  })

  it('shows exactly once on GameMonetize when ready', async () => {
    const { mod } = await load({ gm: true })
    await mod.playFirstStartInterstitial()
    await mod.playFirstStartInterstitial()
    expect(showMidgameAd).toHaveBeenCalledTimes(1)
  })

  it('shows on GameDistribution too', async () => {
    const { mod } = await load({ gd: true })
    await mod.playFirstStartInterstitial()
    expect(showMidgameAd).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire on Poki — nothing stands between a stranger and the game', async () => {
    // It used to, so that Poki's implicitly-positioned commercialBreak would be
    // counted as a preroll rather than a midroll. That is an accounting win paid
    // for with a video ad in front of the first thing a new player came to do,
    // at exactly the moment Poki grades conversion-to-play (the first
    // gameplayStart). GM/GD keep it because their moderation requires it; Poki
    // requires no preroll at all.
    const { mod } = await load({ poki: true })
    await mod.playFirstStartInterstitial()
    expect(showMidgameAd).not.toHaveBeenCalled()
  })

  it('never fires on a non-GM/GD build', async () => {
    const { mod } = await load({})
    await mod.playFirstStartInterstitial()
    expect(showMidgameAd).not.toHaveBeenCalled()
  })

  it('does not consume the one-shot when not ready — retries on the next start', async () => {
    const { mod, readyRef } = await load({ gm: true }, false)
    await mod.playFirstStartInterstitial() // not ready → no ad, flag NOT consumed
    expect(showMidgameAd).not.toHaveBeenCalled()
    readyRef.value = true
    await mod.playFirstStartInterstitial() // now ready → fires
    expect(showMidgameAd).toHaveBeenCalledTimes(1)
  })

  it('seeds the shared 121 s clock so the next interstitial owes a full gap', async () => {
    const { mod } = await load({ gm: true })
    await mod.playFirstStartInterstitial()
    expect(markInterstitialShown).toHaveBeenCalledTimes(1)
  })

  it('does not touch the clock when it did not show an ad', async () => {
    // A build with no first-play placement, and a not-yet-fillable one, must
    // both leave the clock alone — marking an ad that never played would push
    // the next REAL interstitial 121 s further out for nothing.
    const { mod } = await load({})
    await mod.playFirstStartInterstitial()
    expect(markInterstitialShown).not.toHaveBeenCalled()

    const notReady = await load({ gm: true }, false)
    await notReady.mod.playFirstStartInterstitial()
    expect(markInterstitialShown).not.toHaveBeenCalled()
  })
})
