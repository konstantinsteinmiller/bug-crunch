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
