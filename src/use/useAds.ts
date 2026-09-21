// Single entry point for ad placements. Picks a provider at module load
// time based on build flags and re-exports a stable surface
// (`isAdsReady`, `showRewardedAd`, `showMidgameAd`, `initAds`) that the
// four in-game ad placements bind to without caring which backend is
// live.
//
// Provider selection:
//   • `isCrazyWeb` build        → CrazyGames SDK (gate also requires
//                                  `isCrazyGamesFullRelease` inside the
//                                  provider)
//   • `isGameDistribution` build → GameDistribution.com SDK
//   • `showMediatorAds && isNative` → Unity LevelPlay (Tauri plugin)
//   • everything else           → Noop (ads UI hidden, calls inert)
//
// The CrazyGames SDK is still initialised directly from `main.ts` — it
// has to run before the SaveManager hydrates. LevelPlay and GameDistribution
// init happen after mount via `initAds()` — LevelPlay because the native
// side needs the Android Activity / iOS ViewController to be alive,
// GameDistribution because the SDK script is dynamically injected and we
// don't want to pay that latency on the boot critical path.
import { computed, ref } from 'vue'
import { isCrazyWeb, isWaveDash, isItch, isGlitch, isGameDistribution, isPlaygama, isGamepix, isGameMonetize, isYandex, isPoki, isNative, showMediatorAds } from '@/use/useUser'
import type { AdProvider } from './ads/types'
import { resolveAdProvider } from '@/platforms/resolveAdProvider'
import { isRewardedThrottled, recordRewardedGranted } from '@/use/useRewardedThrottle'
import { isAdShowing, isGamePaused, acquireAppPause } from '@/use/useGamePause'
import { installGamePauseAudio } from '@/use/useGamePauseAudio'
import { __audioDebugSnapshot, killOneShotSfx } from '@/use/useAssets'
import { holdSilence } from '@/use/audioGuard'
import { isDebug } from '@/use/useMatch'
import { forceStopMusic, resumeMusicAfterAd } from '@/use/useSound'

const provider: AdProvider = resolveAdProvider({
  flags: { isCrazyWeb, isWaveDash, isItch, isGlitch, isGameDistribution, isPlaygama, isGamepix, isGameMonetize, isYandex, isPoki },
  showMediatorAds,
  isNative
})

// Wire the universal pause gate → audio-suspend orchestrator at module
// load. `useAds` is imported by `main.ts` on every build, so this guarantees
// the audio mute is armed before any ad can show — even if `main.ts`'s
// explicit install is ever reordered. Idempotent: the orchestrator installs
// a single subscriber no matter how many callers invoke it.
installGamePauseAudio()

const TAG = '[ads]'

/** Debug-gated info log for the ad lifecycle (START/END). Fires on every ad,
 *  so gate it behind `isDebug` (set via the `cmarc` cheat or
 *  `localStorage.setItem('debug','true')`). The ERROR `console.warn`s on the
 *  cut-off path stay unconditional. */
const dlog = (...args: unknown[]): void => {
  if (isDebug.value) console.info(...args)
}

export const adProviderName = provider.name
// `isAdsReady` is the coarse "SDK initialised" gate. Most placements
// should NOT bind directly to it — they want a per-format readiness
// flag that flips false when no ad is currently loaded, so the UI
// disappears instead of offering a button that does nothing on tap.
export const isAdsReady = computed(() => provider.isReady.value)
// Throttle ride-along: when the player has already watched
// `MAX_REWARDED` rewarded videos in the trailing 10-min window, we
// flip `isRewardedReady` false so every reward placement
// (RouletteWheel respin, AdRewardButton, 2x speed boost) hides — the
// same UX as a no-fill SDK state. Anti-abuse for kids audience: caps
// the watch-only reward farming pattern.
export const isRewardedReady = computed(() =>
  provider.isRewardedReady.value && !isRewardedThrottled.value
)
export const isInterstitialReady = computed(() => provider.isInterstitialReady.value)
/** True once the active ad provider has detected a browser-extension
 *  ad-blocker (uBlock, AdGuard, Brave Shields, etc.). Drives the
 *  shared `AdsBlockedModal`. Always false on native builds. */
export const isAdsBlocked = computed(() => provider.isAdsBlocked.value)

/**
 * Toggled true by `showRewardedAd()` when the rewarded show resolved
 * `false` AND the active provider has detected an ad-blocker. The
 * `AdsBlockedModal` v-if's on this flag and exposes a dismiss action
 * via `dismissAdsBlockedModal()`.
 *
 * Only the REWARDED path triggers the modal — interstitial / midgame
 * ads aren't user-initiated, so a missed one shouldn't surface a
 * blocking explainer mid-game. The blocker flag itself still flips
 * true via that path so the modal will fire on the player's next
 * watch-ad tap.
 */
export const isAdsBlockedModalShown = ref(false)

// While the modal is up the game must STAY paused — the rewarded show
// already dropped its own `isAdShowing` gate by the time we surface this, so
// without an explicit hold the game would resume the instant the modal
// appeared (QA: "it resumes behind the modal; it should only resume on
// close"). We take a refcounted app-pause and release it on dismiss, so the
// `isGamePaused` gate carries the freeze across the `isAdShowing` drop with
// no transient resume in between.
let adsBlockedPauseRelease: (() => void) | null = null

/** Surface the shared AdsBlockedModal AND freeze the game until it's
 *  dismissed. Idempotent — a second call while already shown is a no-op (no
 *  double-acquire of the pause). */
const showAdsBlockedModal = (): void => {
  if (adsBlockedPauseRelease) return
  isAdsBlockedModalShown.value = true
  adsBlockedPauseRelease = acquireAppPause()
}

export const dismissAdsBlockedModal = (): void => {
  isAdsBlockedModalShown.value = false
  adsBlockedPauseRelease?.()
  adsBlockedPauseRelease = null
}

export const initAds = (): Promise<void> => provider.init()

/**
 * Small wait after the audio kill so the audio thread has time to drain
 * the in-flight buffer before the SDK opens the ad overlay. `pause()` on
 * HTMLAudio and `suspend()` on the Web Audio context both apply
 * synchronously on the main thread, but the actual audio output can lag
 * by a buffer or two on some browsers / devices. GamePix QA explicitly
 * called this out: "wait for the music to be stopped before showing the
 * interstitial ad." 200ms is below human-perceptible delay yet covers the
 * largest audio buffer Chrome/Edge will hold.
 */
const AUDIO_DRAIN_MS = 200

// ─── The stuck-ad cap ───────────────────────────────────────────────────────
//
// Every provider here resolves its promise from SDK CALLBACKS — CrazyGames from
// `adFinished` / `adError`, Poki from `commercialBreak`, and so on. A callback
// that never fires is therefore a promise that never settles, and `await`ing it
// strands the caller forever.
//
// That is not hypothetical. It shipped: on Edge 132, whose Tracking Prevention
// is ON by default and blocks ad hosts mid-flight, the SDK accepted the request
// and then reported nothing. `GameScene.presentResult()` awaits the interstitial
// BEFORE revealing the win/lose overlay (deliberately — the ad must not land on
// top of the result screen), so the end screen simply never appeared, on death
// and on a boss kill alike. The game was not frozen; it was waiting on an ad
// that would never answer.
//
// Two caps, because "no answer" and "a real 30 s video" have to be told apart:
//
//   • AD_OPEN_MS  — the ad never reported OPENING. Treat as a no-fill and move
//     on. Providers signal the open edge through the `onImpression` callback.
//   • AD_MAX_MS   — it opened, but never reported finishing. A generous ceiling
//     that no legitimate interstitial reaches.
//
// Hitting either cap releases the WAIT and the gameplay gate — never the ad
// itself. The provider's promise is left to settle whenever it likes, and that
// is where the second half of the job starts; see `runAd`.
const AD_OPEN_MS = 6000
const AD_MAX_MS = 60000

/**
 * How long the AUDIO stays held for a break that has neither opened nor
 * answered — measured from the request, and deliberately longer than
 * `AD_OPEN_MS`.
 *
 * "Never opened within 6 s" is not "never going to open". Measured against the
 * real Poki core in Inspector mode, with the house-ad video slow to arrive: the
 * ad overlay was already up and loading, `onStart` came 7.7 s after the call —
 * and the old code, having handed everything back at 6 s, resumed the
 * AudioContext and restarted the music UNDER that overlay. SDK-internal
 * timeouts (Poki's own 5 s VAST fetch, IMA's load timeouts) bound how late a
 * real ad can still open; 20 s covers them. An SDK that truly never answers
 * (the Edge case above) costs the player that much silence on the result
 * screen — not a frozen game, and not audio under an ad.
 */
const AD_AUDIO_GRACE_MS = 20000

/**
 * Resolve when `call` settles, or when the caps above expire — whichever comes
 * first.
 *
 * A provider REJECTION is re-thrown rather than swallowed, so the caller's
 * existing catch still logs the cut-off path: an SDK that reports an error is
 * behaving correctly and that stays visible in the console. Only the CAPS
 * resolve quietly — they exist for the SDK that reports nothing at all.
 */
const awaitAdBounded = (call: Promise<unknown>, hasOpened: () => boolean): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    let settled = false
    let openTimer: ReturnType<typeof setTimeout> | undefined
    let maxTimer: ReturnType<typeof setTimeout> | undefined

    const clear = (): void => {
      clearTimeout(openTimer)
      clearTimeout(maxTimer)
    }

    const finish = (reason: string): void => {
      if (settled) return
      settled = true
      clear()
      if (reason !== 'settled') {
        console.warn(`${TAG} ad wait released by cap (${reason}) — the SDK never answered`)
      }
      resolve()
    }

    const fail = (e: unknown): void => {
      if (settled) return
      settled = true
      clear()
      reject(e)
    }

    call.then(() => finish('settled'), fail)
    openTimer = setTimeout(() => { if (!hasOpened()) finish('never opened') }, AD_OPEN_MS)
    maxTimer = setTimeout(() => finish('never finished'), AD_MAX_MS)
  })

// ─── The ad gate ────────────────────────────────────────────────────────────
//
// `isAdShowing` is one flag, but more than one hold can want it at once: the
// request in flight, and a break that OPENED after its own request had already
// been let go by a cap. A counter, so neither can drop the other's.
let adGateHolds = 0
const holdAdGate = (): (() => void) => {
  adGateHolds += 1
  isAdShowing.value = true
  let released = false
  return () => {
    if (released) return
    released = true
    adGateHolds = Math.max(0, adGateHolds - 1)
    if (adGateHolds === 0) isAdShowing.value = false
  }
}

/**
 * Run ONE provider call as an ad, under the full audio guarantee. Every
 * placement on every provider goes through here.
 *
 *  1. Before the SDK is even asked: the music is hard-stopped (its play intent
 *     cleared, so nothing can restart it under the ad), in-flight one-shots are
 *     killed, and TWO holds are taken — the gameplay gate (`isAdShowing` →
 *     `isGamePaused` → render loop, gameplay bracket, and one audio slot via
 *     `useGamePauseAudio`) and a silence slot of the ad's own. While either is
 *     held every AudioContext on the page is suspended and every <audio>
 *     element paused (`audioGuard`), including ones created mid-ad.
 *
 *  2. The WAIT ends when the provider settles or a cap expires, and the gate is
 *     released with it so the game is never stranded. The silence slot is NOT:
 *     it is held until the provider settles, or `AD_AUDIO_GRACE_MS` passes
 *     with no ad on screen, or `AD_MAX_MS` passes regardless. A break the caps
 *     gave up on is still a break the SDK is running.
 *
 *  3. An ad that opens AFTER the wait was released takes both holds again and
 *     keeps them until the provider settles (or `AD_MAX_MS` from the open).
 *     This used to call the audio kill and flip `isAdShowing` true from the
 *     impression callback AFTER the `finally` that clears it had already run:
 *     nothing ever cleared it again, and the game sat paused and silent for
 *     the rest of the session. If that late open cut music that was meant to
 *     be playing, the music is restarted when the late ad is done — the only
 *     restart that can still happen, because the caller's own post-ad restart
 *     already ran at the cap.
 *
 * Every hold is released exactly once, whichever path gets there first.
 */
const runAd = async <T>(
  kind: 'rewarded' | 'interstitial',
  start: (onImpression: () => void) => Promise<T>
): Promise<void> => {
  forceStopMusic()
  killOneShotSfx()
  const releaseGate = holdAdGate()
  const releaseAudio = holdSilence()

  let opened = false
  let settled = false
  let waitOver = false
  const timers: Array<ReturnType<typeof setTimeout>> = []
  const clearTimers = (): void => { for (const t of timers.splice(0)) clearTimeout(t) }

  let lateRelease: (() => void) | null = null
  let musicCutLate = false
  const endLate = (): void => {
    if (!lateRelease) return
    const release = lateRelease
    lateRelease = null
    release()
    if (musicCutLate) {
      musicCutLate = false
      resumeMusicAfterAd()
    }
  }

  const onImpression = (): void => {
    const lateOpen = waitOver && !settled && !lateRelease && !opened
    opened = true
    // An ad is on screen: whatever started sounding since the request goes too.
    const musicWasWanted = forceStopMusic() === true
    killOneShotSfx()
    if (!lateOpen) return
    musicCutLate = musicWasWanted
    const gate = holdAdGate()
    const audio = holdSilence()
    const ceiling = setTimeout(endLate, AD_MAX_MS)
    lateRelease = () => { clearTimeout(ceiling); gate(); audio() }
    console.warn(`${TAG} ${kind} opened AFTER its wait was released — holding the gate until the SDK finishes`)
  }

  let call: Promise<T> | null = null
  try {
    await new Promise<void>((resolve) => setTimeout(resolve, AUDIO_DRAIN_MS))
    dlog(`${TAG} ▶ ${kind} START (provider=${provider.name})`)
    call = start(onImpression)
    const onSettled = (): void => {
      settled = true
      clearTimers()
      releaseAudio()
      endLate()
    }
    call.then(onSettled, onSettled)
    timers.push(setTimeout(() => { if (!opened) releaseAudio() }, AD_AUDIO_GRACE_MS))
    timers.push(setTimeout(releaseAudio, AD_MAX_MS))
    await awaitAdBounded(call, () => opened)
  } finally {
    waitOver = true
    releaseGate()
    // The SDK was never reached (or threw before handing back a promise): there
    // is no break in flight to keep silent for.
    if (!call) releaseAudio()
  }
}

export const showRewardedAd = async (): Promise<boolean> => {
  // Throttle gate: refuse the SDK call once the player has burned
  // their 10-min budget. Returning `false` here matches the
  // contract callers already handle (no grant). The reward UI is
  // already hidden via `isRewardedReady`, so this branch only fires
  // if a placement somehow bypassed that check.
  if (isRewardedThrottled.value) return false
  // The gate + audio holds are taken synchronously inside `runAd`, before its
  // first await — so the renderer pause AND the audio suspend both fire in THIS
  // call stack, before the SDK call yields. GamePix's rewarded ad opens its
  // overlay synchronously and never fires the platform pause callback for
  // rewarded placements, so this is the only signal that mutes audio + physics
  // underneath the ad. The same 200 ms drain the midgame path takes runs before
  // the provider is asked: a player who claims the ×3 on a stage-clear jingle
  // would otherwise hear the tail cut into the ad.
  let granted = false
  try {
    await runAd('rewarded', (onImpression) => {
      const call = provider.showRewardedAd(onImpression)
      call.then((ok) => { granted = ok }, () => { granted = false })
      return call
    })
    if (granted) {
      recordRewardedGranted()
    } else if (provider.isAdsBlocked.value && !provider.ownsAdBlockUi) {
      // Skip the shared modal when the SDK shows its own ad-blocker notice
      // (CrazyGames) — stacking two popups was flagged by CG QA.
      showAdsBlockedModal()
    }
    dlog(`${TAG} ⏹ rewarded END (provider=${provider.name}, granted=${granted})`)
    return granted
  } catch (e) {
    // Defensive: provider contract is not to reject, but if a backend
    // throws (SDK error, network) we still drop the pause gate so audio +
    // gameplay resume — the "cut off due to error" case QA called out.
    console.warn(`${TAG} ✖ rewarded ERROR (provider=${provider.name}) — resuming`, e)
    return false
  }
}

export const showMidgameAd = async (): Promise<void> => {
  // Audio is killed UP FRONT on every provider — including the ones that set
  // `managesMidgameAudio` (Poki, Yandex), as it already was in practice — and
  // again on the impression edge. See `runAd` for the whole guarantee. GamePix-
  // style SDKs resolve `interstitialAd()` before the ad visually closes, so up
  // front is the only safe moment; and a hard-stopped track is never queued for
  // auto-resume, so it cannot restart UNDER the ad. The next round's
  // `startBattleMusic()` brings it back (or `resumeMusicAfterAd()`, for the
  // placements that interrupt a live run).
  try {
    await runAd('interstitial', (onImpression) => provider.showMidgameAd(onImpression))
    dlog(`${TAG} ⏹ interstitial END (provider=${provider.name})`)
  } catch (e) {
    // Same "cut off due to error" safety net as the rewarded path: never
    // leave the game muted/paused if the interstitial backend throws.
    console.warn(`${TAG} ✖ interstitial ERROR (provider=${provider.name}) — resuming`, e)
  }
}

// ⚠️ TEMP TEST HARNESS (remove before commit) ──────────────────────────────
// Deterministic verification of the universal pause+mute gate WITHOUT a live
// ad SDK. From the browser console / Chrome DevTools MCP, with a battle
// running and music playing:
//     window.__audioDebug()             // snapshot before  → audioCtxState:'running'
//     await window.__testInterstitial() // holds the gate for 5s
//     window.__audioDebug()             // snapshot during  → suspended + paused
// During the hold: `isGamePaused` is true (render loop early-returns in
// GameScene) and the AudioContext is suspended + every tracked HTMLAudio is
// paused (no music, no SFX). This mirrors EXACTLY what `showMidgameAd` does
// around a real interstitial — only the provider/SDK call is replaced by a
// timer, so it isolates the gate from SDK promise-timing quirks.
// Gated on `import.meta.env.DEV`, so it is dead-code-eliminated from every
// production/platform build.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>
  w.__testInterstitial = async (ms = 5000): Promise<void> => {
    console.info(`${TAG} [TEST] ▶ fake interstitial START — holding gate ${ms}ms`)
    isAdShowing.value = true
    try {
      await new Promise((resolve) => setTimeout(resolve, ms))
    } finally {
      isAdShowing.value = false
      console.info(`${TAG} [TEST] ⏹ fake interstitial END — gate released`)
    }
  }
  w.__audioDebug = () => {
    const snap = {
      isGamePaused: isGamePaused.value,
      isAdShowing: isAdShowing.value,
      ...__audioDebugSnapshot()
    }
    console.info(`${TAG} [TEST] audio snapshot`, snap)
    return snap
  }
}

const useAds = () => ({
  adProviderName,
  isAdsReady,
  isRewardedReady,
  isInterstitialReady,
  initAds,
  showRewardedAd,
  showMidgameAd
})

export default useAds
