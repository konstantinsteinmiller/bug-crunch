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
// ⚠️ PLAYGAMA is loaded the way every other call site loads it — a DYNAMIC
// import behind the env flag (`main.ts`, `FLogoProgress.vue`). It has no alias
// stub, so a static import here would pull its SDK loader into every other
// portal's bundle. That makes its two calls asynchronous, so they are chained
// on one promise: a handover's stop→start must reach the bridge in that order,
// and by the time anyone is playing the module is already in the registry from
// boot, so the chain resolves on the next microtask.
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
/**
 * What the portals were last TOLD — not what the game is doing.
 *
 * `restartGameplayBracket` needs to know whether a play is still open from the
 * portals' point of view, and the scene's own flag cannot answer that: during a
 * handover it reads false for the single tick `phase` spends on 'clear', which
 * no watcher ever observes.
 */
let reported = false

export const syncGameplayLifecycle = (live: boolean): void => {
  reported = live
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

  syncPlaygamaGameplay(live)
}

/**
 * Playgama's half of the fan-out, in order.
 *
 * Its certification asks for `gameplay_started` / `gameplay_stopped` around
 * play, and until now nothing in the game called either: the two functions sat
 * in `playgamaPlugin` unused, so that portal saw a session with no plays in it.
 *
 * Every call is appended to one promise chain rather than fired as it resolves,
 * because a stop and the start after it would otherwise race — and a start that
 * overtook its stop would leave the bridge believing the first play never
 * ended. The plugin's own pair is idempotent, so a repeat of the state it is
 * already in costs nothing.
 */
let playgamaChain: Promise<void> = Promise.resolve()

const syncPlaygamaGameplay = (live: boolean): void => {
  if (import.meta.env.VITE_APP_PLAYGAMA !== 'true') return
  playgamaChain = playgamaChain
    .then(async () => {
      const m = await import('@/utils/playgamaPlugin')
      if (live) m.playgamaGameplayStart()
      else m.playgamaGameplayStop()
    })
    // A portal SDK that throws must never break the bracket for the others, and
    // must never poison the chain for the next stage either.
    .catch((e) => { console.warn('[playgama] gameplay signal failed', e) })
}

/** Test seam: settle the asynchronous arms. */
export const __gameplayFanoutIdle = (): Promise<void> => playgamaChain

/**
 * A new stage began while the player never stopped playing.
 *
 * The road does not reset between stages any more (see "The road goes on" in
 * `useSurvivalGame`): a cleared boss hands straight over to the next stage, and
 * `phase` passes 'boss' → 'clear' → 'run' inside ONE tick. Nothing watching the
 * live flag can see that, because it reads true on both sides — so the portals
 * heard neither the end of the play the player finished nor the start of the one
 * they are now in, and a career of twenty stages arrived as a single endless
 * play. CrazyGames counts plays and playtime off those brackets, Poki grades its
 * funnel on them, and a game that never sends a second start looks like a game
 * nobody finished a level of.
 *
 * So a handover says it by hand: close the bracket, open the next. Every arm
 * takes an immediate pair safely — CrazyGames' start/stop are idempotent off a
 * flag, and `pokiGameplayStart` DEFERS (never drops) a start landing inside the
 * SDK's 50 ms guard window rather than spending a bad event on it.
 *
 * Only for a handover with no screen in between. Where a result screen, a gift
 * reveal or an ad separates the two stages the live flag really does change, and
 * `syncGameplayLifecycle` already sends both halves.
 */
export const restartGameplayBracket = (): void => {
  // Already closed — a result screen, a reveal, an ad or a hidden tab ended the
  // play, and the flag that closed it will open the next one.
  if (!reported) return
  syncGameplayLifecycle(false)
  syncGameplayLifecycle(true)
}

/** Test seam: forget what the portals were told. */
export const __resetGameplayBracket = (): void => { reported = false }
