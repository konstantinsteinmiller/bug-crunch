// ─── Gameplay-bracket fan-out ───────────────────────────────────────────────
//
// One place that answers "is the player actually playing right now?" for every
// portal that wants to know. `GameScene.vue` reports the boolean; this module
// decides which SDK events that becomes, because WHICH events to send is a
// platform contract and not a view concern.
//
// Previously `GameScene.vue` imported `syncGameplayLifecycle` straight from
// `useCrazyGames`, which made CrazyGames the implicit owner of a signal two
// portals now need. The indirection is one hop and keeps the scene unaware of
// how many platforms are listening.
//
// ⚠️ POKI: the caller drives this from `watch(isLiveGameplay, …)`, and
// `isLiveGameplay` is a computed over five reactive inputs — so a modal closing
// in the same tick an ad opens emits a stop→start pair microseconds apart. On
// CrazyGames that is merely noisy. On Poki it is monetization-fatal: the core
// SDK counts a `gameplayStart()` landing within 50 ms of the preceding
// `gameplayStop()` as a "bad event", and at 10 of them `gameplayStart`,
// `gameplayStop` AND `commercialBreak` all become no-ops for the rest of the
// session, reported only through a debug log line. `pokiGameplayStart/Stop`
// collapse duplicate consecutive events and defer (never drop) a start that
// lands inside the guard window, which is what makes this call site safe.
//
// The import is STATIC on purpose: this file is not in the obfuscator's exclude
// list, so a dynamic `'@/…'` literal would be at the mercy of the `stringArray`
// rewrite. The PokiSDK URL is kept out of every other platform's bundle by the
// `resolve.alias` stub swap in `vite.config.ts`, not by the env-literal gate
// below — see `pokiPlugin.stub.ts` for why the gate alone is not enough.

import { syncGameplayLifecycle as syncCrazyGameplay } from '@/use/useCrazyGames'
import { pokiGameplayStart, pokiGameplayStop } from '@/utils/pokiPlugin'
import { setMonsterBakeAllowed } from '@/game/monsterSprites'

// ─── What counts as live gameplay ───────────────────────────────────────────
//
// The RULE lives here, next to the platforms it is a contract with; the scene
// owns only the reactive wiring that feeds it. Pure and total, so the contract
// can be asserted without mounting a canvas.
//
// The phase union is restated rather than imported from `useSurvivalGame` on
// purpose: that module is the whole simulation, and a platform-contract module
// must not drag it into anything that imports it.
export interface GameplayLiveInputs {
  /** The run's own state machine. Only `run` / `boss` are being PLAYED. */
  phase: 'run' | 'boss' | 'clear' | 'wipe'
  /** The result screen is up — the run is over and a decision is pending. */
  showResult: boolean
  /** Any blocking modal (shop, options, leaderboard). */
  anyModalOpen: boolean
  /** A rewarded / interstitial ad is on screen. */
  adShowing: boolean
  /** `document.visibilityState === 'hidden'` — the player switched away. */
  visibilityHidden: boolean
  /** The portal's SDK asked us to pause (its own overlay, chrome, ad frame). */
  platformPaused: boolean
  /** The onboarding lightbox holds the road frozen before the first input. */
  tutorialActive: boolean
}

/**
 * Is the player actually playing right now?
 *
 * Every input is a reason gameplay is NOT live, and each one is a real
 * requirement rather than a nicety:
 *
 *   • `visibilityHidden` / `platformPaused` were both missing here until the
 *     GamePix release pass. They already halt the simulation (they OR into
 *     `isGamePaused`), but halting the sim and TELLING the portal are two
 *     different things — without them a tab switch left an open gameplay
 *     bracket: CrazyGames kept counting the session, and Poki held the screen
 *     wake lock `gameplayStart()` takes on a page nobody was looking at.
 *   • `tutorialActive` — reporting a start for a run the player has not begun
 *     is the kind of thing portal moderation rejects.
 */
export const isGameplayLive = (i: GameplayLiveInputs): boolean =>
  (i.phase === 'run' || i.phase === 'boss')
  && !i.showResult
  && !i.anyModalOpen
  && !i.adShowing
  && !i.visibilityHidden
  && !i.platformPaused
  && !i.tutorialActive

/**
 * Report whether gameplay is live. Idempotent on every platform: each portal
 * arm collapses a repeat of the state it is already in, so callers may fire it
 * as often as their reactive source changes.
 */
export const syncGameplayLifecycle = (live: boolean): void => {
  // Sprite baking rides the same edge. A monster frame costs up to ~12 ms and
  // cannot be sliced smaller, so it must never run while the player is playing;
  // every break this signal reports — the result screen, a modal, an ad, the
  // loading screen — is a moment nothing is animating and the baker is free.
  setMonsterBakeAllowed(!live)

  syncCrazyGameplay(live)

  if (import.meta.env.VITE_APP_POKI === 'true') {
    if (live) pokiGameplayStart()
    else pokiGameplayStop()
  }
}
