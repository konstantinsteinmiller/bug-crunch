import { computed, ref } from 'vue'
import { getState, setState } from '@/use/useBugCrunchState'
import { CUTSCENES_SEEN_KEY } from '@/keys'
import { qualityTier, type QualityTier } from '@/use/useVfx'
import { INTRO, cutsceneFrame, cutsceneLength, type CutsceneFrame, type CutsceneSpec } from '@/game/cutscene'

/**
 * ─── Running a cutscene ─────────────────────────────────────────────────────
 *
 * The clock, the skip, and the record of what has already been watched. The
 * pictures are `game/cutscene.ts` (what it looks like at time t) and
 * `game/cutsceneArt.ts` (how to draw that); this is only the part that moves.
 *
 * ── "Once, ever" is literal ──
 *
 * The seen-flag is written the moment a scene STARTS, not when it finishes, and
 * that is the whole rule. A player who loses stage 1-1 and retries does not sit
 * through the intro again — nor does one who reloads mid-scene, closes the tab,
 * or is interrupted by a portal interstitial. The scene is a thing that happened
 * to them, not a reward for clearing the level behind it.
 *
 * Writing it on start also removes the one case that would be genuinely bad: a
 * crash or a refresh DURING the scene putting the player back at the beginning
 * of a nine-second cutscene they were already trying to get past.
 *
 * The record lives in the save blob (`CUTSCENES_SEEN_KEY`), so it rides the
 * cloud push and a player who watched the intro on a phone does not watch it
 * again on a desktop.
 *
 * ── It is not gameplay ──
 *
 * Nothing here touches the platform's gameplay bracket. `gameplayStart` is
 * gated on the player's first real interaction, deliberately, because Poki's
 * conversion-to-play is measured on it — see `utils/pokiPlugin.ts`. A cutscene
 * runs before that interaction and must stay out of the way of it, which is also
 * why the first tap anywhere skips.
 *
 * ── The crowds are thinned, not the story ──
 *
 * `cutsceneFrame` takes a crowd multiplier and this is where it comes from: the
 * same `qualityTier()` the board renderer caps its DPR and its decals with. A
 * phone that cannot draw sixteen creatures on an attic floor gets six, and every
 * named actor — the greeter, the foreman, the last ant — is exempt, because a
 * story beat is not an effect and must not be thinned away.
 */

/** How much of a generated crowd each tier draws. */
const CROWD: Record<QualityTier, number> = {
  high: 1, medium: 0.8, low: 0.55, min: 0.38
}

/** The scene on screen right now, or null. */
const active = ref<CutsceneSpec | null>(null)
/** Milliseconds into it. */
const elapsed = ref(0)
/** Reduced motion: every beat becomes a cut. Set once when the scene starts. */
const calm = ref(false)
/** Bumped every frame so a template reading `frame()` re-renders. */
const tick = ref(0)

const seen = (): Record<string, boolean> =>
  getState<Record<string, boolean>>(CUTSCENES_SEEN_KEY, {}) ?? {}

/** Has this scene already been watched — on any device this save has reached? */
export const cutsceneSeen = (id: string): boolean => seen()[id] === true

/** Mark a scene watched. Idempotent, and called on START. */
const markSeen = (id: string): void => {
  if (cutsceneSeen(id)) return
  setState(CUTSCENES_SEEN_KEY, { ...seen(), [id]: true })
}

export const cutsceneActive = computed(() => active.value !== null)

/** The scene on screen, for the caller that has to know which world to draw and
 *  which beat table to read a cue off. */
export const cutsceneSpec = computed(() => active.value)

/** The current scene's id, for the analytics event and for tests. */
export const cutsceneId = computed(() => active.value?.id ?? null)

/**
 * Start a scene, unless it has been seen. Returns whether it actually started,
 * so the caller can decide what to do with the frame it was going to spend.
 */
export const startCutscene = (spec: CutsceneSpec = INTRO): boolean => {
  if (cutsceneSeen(spec.id)) return false
  // BEFORE the first frame renders. See the header.
  markSeen(spec.id)
  active.value = spec
  elapsed.value = 0
  calm.value = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  tick.value++
  return true
}

/** Called once per frame while a scene is up. Returns true when it has ended. */
export const stepCutscene = (dtMs: number): boolean => {
  const s = active.value
  if (!s) return false
  elapsed.value += dtMs
  tick.value++
  if (elapsed.value >= cutsceneLength(s)) {
    active.value = null
    return true
  }
  return false
}

/**
 * End the scene now.
 *
 * It does NOT cut to black: `endState` hands back the scene's final frame, so
 * the player who skips and the player who watches both arrive at level 1-1 on
 * the same picture — a shoe already poised over the board. A skip that fades out
 * is a skip that costs the player the hand-off.
 */
export const skipCutscene = (): void => {
  const s = active.value
  if (!s) return
  elapsed.value = cutsceneLength(s)
  active.value = null
  tick.value++
}

/** What the screen should look like right now. */
export const cutsceneFrameNow = (): CutsceneFrame | null => {
  void tick.value
  const s = active.value
  if (!s) return null
  return cutsceneFrame(s, elapsed.value, calm.value, CROWD[qualityTier()])
}

/** The last frame of a scene — what a skip lands on. */
export const cutsceneEndFrame = (spec: CutsceneSpec = INTRO): CutsceneFrame =>
  cutsceneFrame(spec, cutsceneLength(spec), calm.value, CROWD[qualityTier()])

/** Which beat is on screen, so the scene can fire its cue exactly once. */
export const cutsceneBeat = (): number => {
  void tick.value
  const s = active.value
  if (!s) return -1
  return cutsceneFrame(s, elapsed.value, calm.value, CROWD[qualityTier()]).beat
}

/** Test seam: forget that anything was watched. */
export const __resetCutscenes = (): void => {
  active.value = null
  elapsed.value = 0
  setState(CUTSCENES_SEEN_KEY, {})
}
