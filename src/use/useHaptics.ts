// ─── Haptics: the fourth output channel ────────────────────────────────────
//
// A phone has three ways to tell the player something happened — pixels, the
// speaker, and the motor — and this game shipped using two of them. The motor
// is the only one that still works with the sound off, which on a portal is
// most sessions: a player on a bus has the volume down and is therefore
// playing the pump, the game's keystone mechanic, entirely by eye.
//
// Three cues, and no more. `tick` is the gate pump — the clock the whole game
// is built around; `reward` is a door paying out; `impact` is a hit big enough
// to deserve a shape. Everything else the mixer plays would be a phone buzzing
// continuously, which is not juice — it is a fault.
//
// They are named for what the HAND feels rather than for the event that fires
// them, because two different events legitimately share one: the `/N` trap door
// takes `impact`, not `reward`, since the renderer already grades it as a hit
// (`triggerShake('big')`, a hurt pulse, an implosion) rather than as a pickup.
// A cue called `gatePass` firing on the door that costs you survivors would be
// a name that has to be argued with at every call site.
//
// ─── The gates are the AUDIO gates, deliberately ───────────────────────────
//
// A vibration is exactly as intrusive as a sound: it is felt through a pocket,
// it survives an ad overlay, and a phone buzzing under an interstitial is a
// support ticket. So this module refuses in every state `playFx` refuses in,
// read from the same four sources rather than from a private flag:
//
//   • `isAudioSuspended()`   — the ref-counted stack in `useAssets`, which is
//     what the pause orchestrator, the mobile hard-mute and the portal
//     `soundOff` all drive. One read covers all three of them.
//   • `isGamePaused`         — read DIRECTLY as well, and not as belt-and-
//     braces: the audio suspend is a side effect that a build could in
//     principle install late (`installPauseAudioOrchestrator` is called from
//     the app shell), while the pause gate is true the instant an ad is
//     asked for. A motor is physical; it does not get to depend on an
//     installation order.
//   • `isPlatformAudioMuted` — the portal's own mute button. It means "this
//     game is to make no noise in my page", and a buzzing phone is noise.
//   • `isMobileAudioMuted`   — the on-screen mute. A player who silenced the
//     game to play their own music did not ask to be tapped on the wrist.
//
// The one gate that is NOT shared is the SFX volume slider: a player can want
// a quiet game and still want to feel the pump, which is why the toggle below
// exists as its own setting rather than as a rider on the volume.

import { ref, watch } from 'vue'
import { mobileCheck } from '@/utils/function'
import { isAudioSuspended } from '@/use/useAssets'
import { isMobileAudioMuted } from '@/use/useMobileAudioMute'
import { isGamePaused } from '@/use/useGamePause'
import { isPlatformAudioMuted } from '@/use/useGamePauseAudio'
import { getState, setState } from '@/use/useSplatixState'
import { saveDataVersion } from '@/use/useSaveStatus'
import { HAPTICS_KEY } from '@/keys'

export type HapticCue = 'tick' | 'reward' | 'impact'

/**
 * Pattern per cue, in milliseconds — the roadmap's own numbers, and they are
 * short for a measured reason: a phone's eccentric-rotating-mass motor takes
 * roughly 20–30 ms to spin up and about as long to coast down, so anything
 * under ~10 ms is felt as a tap rather than as a buzz, and anything over ~60 ms
 * is felt as a rumble. The three cues are therefore three DURATIONS of the same
 * thing, which is how the hand tells them apart without being taught:
 *
 *   tick    8 ms          a tick. Below the spin-up time on purpose — the motor
 *                         never fully arrives, which is what makes a pump feel
 *                         like a ratchet rather than like a drill.
 *   reward  25 ms         a landing. The one the thumb is waiting for.
 *   impact  40/30/60 ms   the only pattern with a SHAPE. A slam has a wind-up
 *                         and an arrival, and a pattern is the only way the
 *                         motor can say so.
 */
const PATTERNS: Record<HapticCue, number | number[]> = {
  tick: 8,
  reward: 25,
  impact: [40, 30, 60]
}

/**
 * Per-cue budget, mirroring `THROTTLES` in `useGameAudio.ts` — same shape, same
 * two-part rule (a minimum gap AND a cap per rolling window), because it is the
 * same problem: an event stream that is fine at stage 1 and a solid tone at
 * stage 45.
 *
 * The numbers are TIGHTER than the mixer's, and the arithmetic is why. The gate
 * clock is `GATE_TICK_MS` (500 ms) decayed 5 % per 15-stage band down to a
 * `GATE_TICK_MIN_MS` floor of 120 ms, and a three-leaf bank runs three of those
 * clocks at once — so a late-stage bank can emit ~25 `gateTick` events a
 * second. The mixer can absorb that (it throttles `gateSubTick` and lets
 * `gateTick` through, and overlapping voices still sound like a pump). A motor
 * cannot: 25 pulses a second with a 20 ms spin-down is one continuous buzz with
 * no ticks in it at all, and the cue stops carrying information.
 *
 * `tick` is therefore capped at 4 per 700 ms — about six a second — which
 * keeps every tick of a stage-1 pump (500 ms apart, so the gap never bites) and
 * decimates a stage-45 three-leaf bank down to something a hand can still count.
 */
interface Budget { minGapMs: number; maxPerWindow: number; windowMs: number }

const BUDGETS: Record<HapticCue, Budget> = {
  tick: { minGapMs: 110, maxPerWindow: 4, windowMs: 700 },
  // One bank, one pass — but a dilemma bank's leaves resolve in the same frame
  // and the boss stages chain banks back to back. Two landings inside a second
  // is a real thing the player did; a third is the road, not them.
  reward: { minGapMs: 220, maxPerWindow: 2, windowMs: 1000 },
  // The longest pattern in the file (130 ms of motor) and the rarest event.
  // A raging boss can double-slam; a triple would be one long rumble.
  impact: { minGapMs: 380, maxPerWindow: 2, windowMs: 1600 }
}

const lastAt: Partial<Record<HapticCue, number>> = {}
const windowHits: Partial<Record<HapticCue, number[]>> = {}

const passesBudget = (id: HapticCue): boolean => {
  const b = BUDGETS[id]
  const now = performance.now()
  if (now - (lastAt[id] ?? -Infinity) < b.minGapMs) return false
  const hits = (windowHits[id] ??= [])
  while (hits.length > 0 && now - hits[0]! > b.windowMs) hits.shift()
  if (hits.length >= b.maxPerWindow) return false
  hits.push(now)
  lastAt[id] = now
  return true
}

/**
 * Is there a motor to drive at all?
 *
 * Two conditions, and both are needed. `navigator.vibrate` is simply absent on
 * iOS Safari (every iPhone, every iPad) and on desktop Safari and Firefox — so
 * the API check alone leaves the toggle visible to half the install base as a
 * control that does nothing. And desktop Chrome DOES ship `navigator.vibrate`,
 * where it resolves to a silent no-op — so the API check alone also puts a
 * vibration setting in front of every desktop player.
 *
 * Resolved ONCE at module load rather than per call: `mobileCheck()` runs two
 * long regexes over the user agent, and this is read from the render loop.
 */
export const hapticsAvailable: boolean =
  typeof navigator !== 'undefined' &&
  typeof navigator.vibrate === 'function' &&
  mobileCheck()

/** Absent means ON — see `HAPTICS_KEY`. Only ever true where the motor exists,
 *  so a save synced from a phone can never arm anything on a desktop. */
const readPersisted = (): boolean =>
  hapticsAvailable && getState<boolean>(HAPTICS_KEY, true) !== false

/** The player's choice. Read by the options modal; never read in the hot path
 *  as a `.value` chain longer than this one. */
export const hapticsEnabled = ref<boolean>(readPersisted())

// Re-read on a hydrate bump, exactly as `useUser` and `useMobileAudioMute` do.
// On cloud-only builds (CrazyGames) the blob is in-memory and may not be
// populated when this module evaluates, so a value that lands after boot has to
// be honoured or the player's choice silently reverts on every refresh.
watch(saveDataVersion, () => {
  if (!hapticsAvailable) return
  const persisted = readPersisted()
  if (persisted !== hapticsEnabled.value) hapticsEnabled.value = persisted
})

/** Toggle and persist. Called from the options modal, which only renders the
 *  control when `hapticsAvailable` — a toggle for a motor that does not exist
 *  is a setting that lies. */
export const setHapticsEnabled = (next: boolean): void => {
  if (!hapticsAvailable) return
  hapticsEnabled.value = next
  setState(HAPTICS_KEY, next)
  // Stop mid-pattern the moment it is switched off. `vibrate(0)` cancels a
  // running pattern; without it a player who turns haptics off during a boss
  // slam still gets the remaining 90 ms of it, which reads as the toggle not
  // working.
  if (!next) {
    try { navigator.vibrate(0) } catch { /* see `haptic()` */ }
  }
}

/**
 * Fire one haptic cue. Safe to call from the render loop at any density —
 * availability, the player's toggle, the four mute/pause gates and the per-cue
 * budget are all handled here.
 *
 * Never throws and never logs. It is called from `applyFx`, which runs inside
 * the frame: a browser that decides mid-session to reject a vibration (some
 * Android builds refuse without a recent user gesture, and every browser
 * refuses on a hidden document) would otherwise be a console line per tick and
 * a per-frame string allocation, on the exact devices the feature exists for.
 */
export const haptic = (id: HapticCue): void => {
  if (!hapticsAvailable) return
  if (!hapticsEnabled.value) return
  if (isGamePaused.value) return
  if (isAudioSuspended()) return
  if (isPlatformAudioMuted.value) return
  if (isMobileAudioMuted.value) return
  if (!passesBudget(id)) return
  try {
    navigator.vibrate(PATTERNS[id])
  } catch { /* a refusal is not worth a frame — the visual carries the moment */ }
}

/** Test-only: drop the throttle history so a spec can assert a budget from a
 *  known-clean state instead of inheriting the previous test's timestamps. */
export const __resetHapticThrottle = (): void => {
  for (const k of Object.keys(lastAt) as HapticCue[]) delete lastAt[k]
  for (const k of Object.keys(windowHits) as HapticCue[]) delete windowHits[k]
}
