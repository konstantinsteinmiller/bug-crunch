// The GamePix first-LOAD interstitial.
//
// It is the only interstitial in the game that interrupts a run ALREADY IN
// PROGRESS: it fires when the splash clears, with stage 1 already running
// behind it. That makes it the one placement `forceStopMusic`'s contract does
// not cover — "the next round's `startBattleMusic()` brings it back" is true
// for the between-rounds ad, and false here, because stages 1-2 hand over
// continuously and the next result screen is minutes away.
//
// Found in a real browser against the built GamePix bundle: the ad no-filled
// and the opening of every session then played in silence. Nothing threw.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const showMidgameAd = vi.fn(() => Promise.resolve())
const markInterstitialShown = vi.fn()
const resumeMusicAfterAd = vi.fn()

const load = async (ready = true) => {
  vi.resetModules()
  const { ref } = await import('vue')
  const readyRef = ref(ready)
  vi.doMock('@/use/useAds', () => ({ isInterstitialReady: readyRef, showMidgameAd }))
  vi.doMock('@/use/useAdGate', () => ({ markInterstitialShown }))
  vi.doMock('@/use/useSound', () => ({ resumeMusicAfterAd }))
  const mod = await import('@/use/useFirstLoadInterstitial')
  return { mod, readyRef }
}

/** Let the `.catch().finally()` chain on the ad promise settle. */
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }

beforeEach(() => {
  showMidgameAd.mockClear().mockResolvedValue(undefined)
  markInterstitialShown.mockClear()
  resumeMusicAfterAd.mockClear()
})

afterEach(() => {
  vi.doUnmock('@/use/useAds')
  vi.doUnmock('@/use/useAdGate')
  vi.doUnmock('@/use/useSound')
})

describe('useFirstLoadInterstitial', () => {
  it('fires once, after BOTH the splash is gone and an ad is fillable', async () => {
    const { mod } = await load()
    mod.armFirstLoadInterstitial()
    expect(showMidgameAd).not.toHaveBeenCalled() // splash still up

    mod.notifySplashGone()
    expect(showMidgameAd).toHaveBeenCalledTimes(1)

    mod.notifySplashGone() // idempotent
    expect(showMidgameAd).toHaveBeenCalledTimes(1)
  })

  it('waits for the SDK rather than burning the one shot on a no-fill', async () => {
    const { mod, readyRef } = await load(false)
    mod.armFirstLoadInterstitial()
    mod.notifySplashGone()
    expect(showMidgameAd).not.toHaveBeenCalled()

    readyRef.value = true       // SDK finishes initialising
    await settle()
    expect(showMidgameAd).toHaveBeenCalledTimes(1)
  })

  it('seeds the shared 121 s clock', async () => {
    const { mod } = await load()
    mod.armFirstLoadInterstitial()
    mod.notifySplashGone()
    expect(markInterstitialShown).toHaveBeenCalledTimes(1)
  })

  it('brings the music back when the ad finishes', async () => {
    const { mod } = await load()
    mod.armFirstLoadInterstitial()
    mod.notifySplashGone()
    await settle()
    expect(resumeMusicAfterAd).toHaveBeenCalledTimes(1)
  })

  it('brings the music back on a REJECTED ad too', async () => {
    // The silence must not depend on the ad path being the happy one. A
    // provider that throws leaves `shouldPlay` false exactly the same way.
    showMidgameAd.mockRejectedValueOnce(new Error('sdk exploded'))
    const { mod } = await load()
    mod.armFirstLoadInterstitial()
    mod.notifySplashGone()
    await settle()
    expect(resumeMusicAfterAd).toHaveBeenCalledTimes(1)
  })

  it('does not restart music when no ad was ever shown', async () => {
    const { mod } = await load(false)
    mod.armFirstLoadInterstitial()
    mod.notifySplashGone() // never fillable → no ad
    await settle()
    expect(showMidgameAd).not.toHaveBeenCalled()
    expect(resumeMusicAfterAd).not.toHaveBeenCalled()
  })
})
