// Background SFX preload — fires AFTER first paint so it never competes
// with the critical path.
//
// Without this, every SFX pays its first-play decode cost the moment the
// game fires it (the first coin of a session stutters, the level-clear
// fanfare silences for a beat). The decode is cheap individually
// (1-5 ms per .ogg) but happens in a flurry of small bursts during the
// opening seconds of gameplay — exactly when the player is forming a
// first impression. Decoding everything once, on an idle callback,
// pushes that work off the rendering thread before it gets noticed.
//
// `loadAudioBuffer` is idempotent — repeat calls hit the cache or join
// the pending decode promise, so it's safe to call this preload more
// than once (e.g. on every GameScene mount). The visibility-hidden /
// ad-show suspend system in `useAssets.ts` doesn't affect decode — it
// only gates playback — so this works correctly even if the tab is
// backgrounded during preload.

import { prependBaseUrl } from '@/utils/function'
import { loadAudioBuffer } from '@/use/useAssets'
import { preloadSfx } from '@/use/useSfxSprites'

// Every SFX the gameplay scene can fire. Kept as a flat list so a single
// allSettled covers them all. Order doesn't matter — they decode in
// parallel and fight for the AudioContext's decoder pool. Adding a new
// SFX = add the basename here (no `.ogg`, no path prefix).
const GAMEPLAY_SFX: ReadonlyArray<string> = [
  // Bug Crunch synthesises its whole combat layer (see `useGameAudio`), so this
  // list is only the handful of cues where a RECORDED sound is unmistakably
  // better than a built one: the coin, the three celebration stings, the
  // time-up sting, the unlock, and the modal chime.
  'coin-pickup',
  'celebration-1',
  'celebration-2',
  'celebration-3',
  'happy',
  'level-up',
  'lose',
  'win',
  'reward-continue',
  'modal-open'
]

let preloadStarted = false
let preloadDone: Promise<void> | null = null

/** Kick off background decode of every gameplay SFX. Idempotent; calling
 *  twice returns the SAME promise (resolves once every decode has settled), so
 *  callers can sequence work AFTER the sounds finish (e.g. warm the remaining
 *  ball skins only once audio is decoded). Off the critical path — the asset
 *  preloader runs it only after the hot-path art + first paint are done. */
export const preloadGameplaySounds = (): Promise<void> => {
  if (preloadDone) return preloadDone
  preloadStarted = true
  preloadDone = Promise.allSettled([
    ...GAMEPLAY_SFX.map((name) => loadAudioBuffer(prependBaseUrl(`audio/sfx/${name}.ogg`))),
    // The rendered cues' tier-1 sprites (the shoe, the chain, the vial, the
    // finisher, the stars, the clock — what level 1-1 can play); tier 2 follows
    // once the first level has ended. See `useSfxSprites`.
    preloadSfx()
  ]).then(() => undefined)
  return preloadDone
}

/** Schedule `preloadGameplaySounds()` on the first available idle slot.
 *  Falls back to `setTimeout(0)` on browsers that don't expose
 *  `requestIdleCallback` (mostly Safari). Either path runs after the
 *  current animation frame so the first paint isn't delayed. */
export const schedulePreloadOnIdle = (): void => {
  if (preloadStarted) return
  if (typeof window === 'undefined') return
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined
  if (typeof ric === 'function') {
    ric(() => preloadGameplaySounds(), { timeout: 2000 })
  } else {
    setTimeout(() => preloadGameplaySounds(), 0)
  }
}
