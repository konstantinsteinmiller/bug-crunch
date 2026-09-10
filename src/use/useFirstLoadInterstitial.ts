// First-load interstitial orchestrator. Portal QA on GameDistribution +
// GameMonetize + GamePix requires an interstitial right after the game
// finishes loading ("show ads the first time after the game loads"). The
// fire is gated on TWO signals so it lands cleanly:
//
//   • Splash gone — flipped from `FLogoProgress` when the logo unmounts.
//     Without this, a fast SDK init would race the splash and the ad
//     would cover the loading screen.
//   • SDK reports a fillable interstitial — `isInterstitialReady` from
//     `useAds`. Avoids pausing the game just to hit a no-fill, and gives
//     a slow SDK init room to finish.
//
// Fires once per session. Other platform builds never call `arm()` so the
// module is inert (and the watcher is never installed).
//
// ─── Why a WATCHER, and not an await in the game's boot ─────────────────────
//
// GM and GD used to run this ad from `useFirstStartInterstitial`, awaited at the
// top of `GameScene.boot()` — an intentional Play gesture rather than a
// post-splash auto-fire. That module sampled `isInterstitialReady` exactly once,
// which is a race it loses on a real portal: `boot()` runs from `onMounted` on
// the lazily imported route chunk (local, modulepreloaded), while the ad SDK is
// only injected by `initAds()` after `app.mount()` returns and reports ready
// only once a cross-origin script and its ad stack have loaded. The chunk wins,
// readiness is false at the one moment it is read, and the (correct) "don't burn
// the one-shot when not ready, retry on the next start" guard has no next start,
// because `boot()` runs once per session. No ad, no error, nothing logged, and
// GameMonetize rejected the build for it on 2026-09-09.
//
// Both local proofs missed it by removing the network the race is against: unit
// tests hand the module a ready ref, and `scripts/portal-qa.mjs` answered
// SDK_READY in 30 ms (it now delays that handshake on purpose).
//
// ─── Who is NOT here ────────────────────────────────────────────────────────
//
// POKI, deliberately. It has no `showPreroll()`: the core reports a
// `commercialBreak()` as a PREROLL until the first `gameplayStart()` and a
// midroll after, so an ad fired before the bracket opens IS Poki's preroll —
// tidy accounting, and it used to be wired that way. What it bought was a video
// ad between a stranger and the first thing they came to do. Measured against
// the same build on CrazyGames, which goes straight into gameplay, Poki lost
// roughly half its players by the end of a 25-second tutorial while CG averaged
// seven-minute sessions. It is unpaced (first ad of the session, so it bypasses
// `canShowInterstitial`) and it sits exactly where Poki grades
// conversion-to-play. GM and GD keep the placement because their moderation
// REQUIRES it — there, shipping depends on it. Poki requires no preroll at all,
// and one shown to somebody who then leaves is worth approximately nothing.
//
// CRAZYGAMES, for the same reason and with no moderation rule pulling the other
// way.
import { watch } from 'vue'
import { isInterstitialReady, showMidgameAd } from '@/use/useAds'
import { markInterstitialShown } from '@/use/useAdGate'
import { resumeMusicAfterAd } from '@/use/useSound'

let armed = false
let splashGone = false
let fired = false

const tryFire = (): void => {
  if (!armed || !splashGone || fired) return
  if (!isInterstitialReady.value) return
  fired = true
  // Start the shared interstitial clock. This placement does not ASK
  // `canShowInterstitial()` — it is the portal-required first-load ad and runs
  // unconditionally — but it is still an interstitial, so the next one owes the
  // full 121 s gap. Without this the result-screen placement would start its
  // own clock from scratch minutes later and could request a second ad well
  // inside the window every portal rate-limits on.
  markInterstitialShown()
  // Restart the music once the ad is done — win, no-fill or error alike.
  //
  // This placement is the one interstitial that interrupts a run ALREADY IN
  // PROGRESS: it fires from the splash, stage 1 is running behind it, and
  // `showMidgameAd` hard-stops the music AND clears the play intent so nothing
  // can sound under the ad. The usual thing that brings music back is the next
  // `startBattleMusic()` on the result screen — but stages 1-2 hand over
  // continuously, so on GamePix that was minutes away and the opening of every
  // session played in silence.
  showMidgameAd()
    .catch((e) => console.warn('[first-load-ad] failed', e))
    .finally(() => resumeMusicAfterAd())
}

/** Install the SDK-readiness watcher. Idempotent — safe to call from
 *  multiple component setups. Only call on builds that actually need
 *  a first-load interstitial. */
export const armFirstLoadInterstitial = (): void => {
  if (armed) return
  armed = true
  watch(isInterstitialReady, () => tryFire(), { immediate: true })
}

/** Mark the splash as gone. Triggers the fire if the SDK is already
 *  ready; otherwise the watcher set up in `arm()` catches the next
 *  flip. */
export const notifySplashGone = (): void => {
  if (splashGone) return
  splashGone = true
  tryFire()
}
