// The GamePix / GameMonetize first-LOAD interstitial.
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

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

// The orchestrator above is only half the placement: it does nothing at all
// unless `FLogoProgress.vue` arms it, and the arm is a build-flag branch that
// cannot be imported into a unit test (it is DCE'd per platform by design). So
// pin it by SOURCE — which is also the only level at which the original bug was
// visible.
//
// GameMonetize QA, 2026-09-09: "Ads should be shown the first time after the
// game loads." GM's ad had been on `useFirstStartInterstitial`, awaited in
// `GameScene.boot()`, which samples `isInterstitialReady` once — racing an ad SDK
// that `initAds()` only injects after `app.mount()` returns. The local route
// chunk wins that race on a real portal, the module declines to burn its
// one-shot when not ready, and `boot()` never runs again: no ad, nothing logged,
// and a green unit suite. Dropping GM out of this arm list puts that back.
describe('first-load interstitial arm list (FLogoProgress.vue)', () => {
  const src = readFileSync(
    resolve(__dirname, '../../src/components/atoms/FLogoProgress.vue'),
    'utf8'
  )
  // Anchor on the LAST `if (` before the call, not a lazy regex from the top of
  // the file — that one spans the whole preceding block, comments included, so
  // a flag named only in a comment would satisfy the assertions below. The
  // import line carries no `()`, so this finds the call site.
  const armIdx = src.indexOf('armFirstLoadInterstitial()')
  const beforeArm = armIdx === -1 ? '' : src.slice(0, armIdx)
  const gate = beforeArm.slice(beforeArm.lastIndexOf('if ('))

  it('arms the orchestrator behind a build-flag gate', () => {
    expect(armIdx).toBeGreaterThan(-1)
    expect(gate).toMatch(/^if \(/)
    // No comment may leak into the captured gate, or every check below goes
    // vacuous the moment someone mentions a flag in prose.
    expect(gate).not.toContain('//')
  })

  it.each([
    ['VITE_APP_GAMEPIX', 'GamePix portal QA requires a post-load ad'],
    ['VITE_APP_GAME_MONETIZE', 'GameMonetize QA rejected the build without one']
  ])('includes %s (%s)', (flag) => {
    expect(gate).toContain(flag)
  })

  it('reads every flag as a static literal so other builds DCE the branch', () => {
    // `import.meta.env.X === 'true'` is what Vite can constant-fold. A
    // destructured or computed read keeps the helper module in every bundle.
    for (const flag of gate.match(/VITE_APP_[A-Z_]+/g) ?? []) {
      expect(gate).toContain(`import.meta.env.${flag} === 'true'`)
    }
  })
})
