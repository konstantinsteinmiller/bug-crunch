// First-PLAY interstitial for GameDistribution.
//
// GameDistribution moderation requires an ad "the first time after the game
// loads or on the first Play button click." We fire it on the first
// CLICK-TO-START of the session rather than auto-firing after the splash: an
// intentional Play gesture is not an incidental-click impression (that's why the
// post-splash auto-fire was removed for this network — see the comment in
// `FLogoProgress.vue`). GamePix and GameMonetize use the post-splash first-load
// interstitial instead (`useFirstLoadInterstitial`).
//
// ⚠ GAMEMONETIZE MOVED OFF THIS PLACEMENT, and the reason is a live trap for GD
// too: this module SAMPLES readiness once, and that one sample is a race it
// loses on a real portal.
//
// The game has no Play button — it boots straight into stage 1 — so the "first
// click-to-start" is `GameScene.boot()` running from `onMounted` on the lazily
// imported route chunk. That chunk is local and modulepreloaded. The ad SDK, by
// contrast, is injected by `initAds()` only after `app.mount()` returns
// (`main.ts`) and reports ready only once a cross-origin script and its ad stack
// have loaded. The chunk wins, `isInterstitialReady` is false, and the not-ready
// branch below deliberately declines to consume the one-shot so it can retry —
// but no retry exists, because `boot()` is called exactly once per session.
//
// So the GameMonetize ad simply never played, with nothing logged, and
// GameMonetize QA rejected the build on 2026-09-09 ("Ads should be shown the
// first time after the game loads"). Both local proofs missed it by removing the
// network the race is actually against: the unit suite hands this module a ready
// ref, and the portal-QA stub used to answer SDK_READY in 30 ms.
//
// GM now rides `useFirstLoadInterstitial`, which WATCHES readiness instead of
// sampling it. GD is left here untouched — arming a post-splash ad on a network
// that asked for it to be removed is a product call, not a bug fix — but the
// same race applies to it today.
//
// Audio contract (the caller relies on this): `showMidgameAd` hard-stops the
// music, kills every in-flight one-shot SFX, and holds the universal audio +
// pause gate (`isAdShowing` → `useGamePauseAudio` suspends Web Audio) for the
// whole ad lifetime, resolving ONLY on the ad's close OR a no-fill. So the
// caller must `await` this BEFORE it starts the run — the run's battle music
// then begins fresh after the ad finishes (or immediately on a no-fill), and
// never plays underneath the ad.
//
// POKI IS DELIBERATELY NOT HERE, and it used to be. The reasoning it was added
// under was sound and the outcome was not, so it is worth writing down.
//
// Poki has no `showPreroll()`: the position of a `commercialBreak()` is
// IMPLICIT, decided by the core as `__gameStarted ? midroll : preroll`, and
// `__gameStarted` flips on the first `gameplayStart()`. `GameScene.boot()`
// awaits this call BEFORE `startStage()`, so firing it here made it the
// session's preroll, priced and paced as one, and left the between-runs ad in
// `presentResult()` correctly reported as a midroll. Tidy accounting.
//
// What it actually bought was a video ad between a stranger and the first thing
// they came to do. Measured against the same build on CrazyGames — which is
// excluded from this list and therefore goes straight into gameplay — Poki lost
// roughly half its players by the end of a 25-second tutorial while CG averaged
// seven-minute sessions. This is not the only difference between those two
// audiences, but it is the only one in our control, it is unpaced (it bypasses
// `canShowInterstitial`'s 121 s gate entirely, because it is the first ad of the
// session), and it sits at exactly the moment Poki grades: conversion-to-play is
// measured on the first `gameplayStart()`, which this ad stands in front of.
//
// GameDistribution keeps it because its moderation REQUIRES an ad on first play
// — there, shipping at all depends on it. Poki requires no such thing. The cost
// of leaving it out is that Poki never serves a preroll and its dashboard shows
// midrolls only; the cost of leaving it in was the funnel gate.
// A preroll shown to somebody who then leaves is worth approximately nothing.
//
// Fires at most once per session (module-level flag survives a GameScene
// remount). Resolves immediately (no ad) on non-GD builds and when no
// interstitial is currently fillable — leaving the flag unset in the
// not-fillable case so a slightly-too-early first tap retries on the next
// start instead of permanently missing the placement.
import { isGameDistribution } from '@/use/useUser'
import { isInterstitialReady, showMidgameAd } from '@/use/useAds'
import { markInterstitialShown } from '@/use/useAdGate'

let firstStartAdShown = false

/**
 * Show the first-play interstitial if this is the first eligible click-to-start
 * of the session on a GameDistribution build and an interstitial is fillable.
 * Resolves when the ad closes (or no-fills); resolves immediately when not
 * applicable. `await` this before starting the run so the ad plays before any
 * music.
 */
export const playFirstStartInterstitial = async (): Promise<void> => {
  if (firstStartAdShown) return
  if (!isGameDistribution) return
  // Not ready yet (SDK still initialising on a fast first tap) → don't burn the
  // one-shot; retry on the next start.
  if (!isInterstitialReady.value) return
  firstStartAdShown = true
  // Seed the shared 121 s clock — same reasoning as the first-LOAD placement:
  // this ad bypasses `canShowInterstitial()` by design, but the next request
  // still owes the full gap from here rather than from the first result screen.
  markInterstitialShown()
  await showMidgameAd()
}

/** Test-only: reset the once-per-session guard. */
export const __resetFirstStartInterstitial = (): void => {
  firstStartAdShown = false
}
