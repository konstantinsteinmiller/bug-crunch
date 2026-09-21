import { computed, ref, watch } from 'vue'
import { getState, setState } from '@/use/useBugCrunchState'
import { saveDataVersion } from '@/use/useSaveStatus'
import {
  LESSON_IDS, SLAM_GRACE_MS, TAUGHT_KEY, isLessonId, lessonSpec, outranks,
  type Lesson, type LessonId
} from '@/game/tutorial'

/**
 * ─── The tutorial director ──────────────────────────────────────────────────
 *
 * Owns WHICH lesson is on screen and WHETHER it has ever been taught. It does
 * not own where the lesson points — that is the scene's job, because only the
 * scene knows where the foot is, where the bugs are and where the HUD put its
 * buttons this frame.
 *
 * The whole surface is three verbs:
 *
 *   arm(id)       the game has reached the moment this lesson is about
 *   complete(id)  the player did the thing
 *   step(dtMs)    a frame went by, with the player present
 *
 * ── Why a queue rather than a flag ──
 *
 * Several lessons can become relevant in the same second — a boss level opens
 * with a boss AND the first armoured body AND a full vial carried over from the
 * last level. Two instructions on one screen is no instruction, so they line up
 * and the lowest `order` goes first. The queue is deliberately small: a player
 * who is owed five lessons is a player who has been left behind, and the honest
 * fix is to arm them earlier, not to show them faster.
 *
 * ── Why "present" time ──
 *
 * Every timer here is fed by the scene's own frame loop and only while the
 * player has actually given input. An interstitial, a consent dialog or a tab
 * left open in the background all keep wall time running with nobody looking,
 * and a bail-out on wall time retires the whole lesson before the player
 * arrives.
 */

const readTaught = (): Record<string, boolean> => {
  const raw = getState<Record<string, unknown>>(TAUGHT_KEY, {})
  const out: Record<string, boolean> = {}
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (isLessonId(k) && v === true) out[k] = true
    }
  }
  return out
}

/** Which lessons the player has already been through, ever. */
export const taught = ref<Record<string, boolean>>(readTaught())

/** A cloud save arriving after boot must not re-teach a veteran. */
watch(saveDataVersion, () => { taught.value = readTaught() })

export const isTaught = (id: LessonId): boolean => taught.value[id] === true

/** The lesson on screen, or null. */
export const activeLesson = ref<LessonId | null>(null)
/** 0..1 — how much of the current lesson's requirement is done. Drives the
 *  ring, which is the only feedback that the gesture is working. */
export const lessonProgress = ref(0)

/** Lessons armed and waiting their turn. At most a couple, by design. */
const queue = ref<LessonId[]>([])

/** How long the active lesson has been on screen, in present time. */
let shownMs = 0
/** How much qualifying action has been done in the active lesson. */
let doneMs = 0

export const activeSpec = computed<Lesson | null>(() =>
  activeLesson.value === null ? null : lessonSpec(activeLesson.value))

const markTaught = (id: LessonId): void => {
  if (taught.value[id]) return
  const next = { ...taught.value, [id]: true }
  taught.value = next
  setState(TAUGHT_KEY, next)
}

const promote = (): void => {
  if (activeLesson.value !== null || queue.value.length === 0) return
  // Lowest `order` first: a mechanic must never be explained before the control
  // that operates it.
  const next = [...queue.value].sort((a, b) => (outranks(a, b) ? -1 : 1))[0]!
  queue.value = queue.value.filter((id) => id !== next)
  activeLesson.value = next
  lessonProgress.value = 0
  shownMs = 0
  doneMs = 0
}

/**
 * The game has reached the moment this lesson is about.
 *
 * Idempotent and cheap: call it every frame the condition holds if that is the
 * simplest thing at the call site. A lesson already taught, already showing or
 * already queued is ignored.
 */
export const arm = (id: LessonId): void => {
  if (isTaught(id)) return
  if (activeLesson.value === id || queue.value.includes(id)) return
  queue.value = [...queue.value, id]
  promote()
}

/**
 * The player did the thing.
 *
 * Marks it taught whether or not it was the lesson on screen — a player who
 * works out the chain on their own before the game gets round to mentioning it
 * has earned the right never to be told.
 */
export const complete = (id: LessonId): void => {
  markTaught(id)
  queue.value = queue.value.filter((q) => q !== id)
  if (activeLesson.value === id) {
    activeLesson.value = null
    lessonProgress.value = 0
    promote()
  }
}

/** Take the lesson off the screen WITHOUT teaching it — it will be armed again
 *  the next time its moment comes round. For a modal closing under it. */
export const shelve = (id: LessonId): void => {
  queue.value = queue.value.filter((q) => q !== id)
  if (activeLesson.value !== id) return
  activeLesson.value = null
  lessonProgress.value = 0
  promote()
}

/** Drop everything on screen and waiting. For a scene teardown. */
export const clearLessons = (): void => {
  queue.value = []
  activeLesson.value = null
  lessonProgress.value = 0
}

/**
 * How long a held gesture has to be held before it counts as learned.
 *
 * Only `move` is retired this way — every other lesson has an event to listen
 * for. Long enough that a twitch does not count, short enough that a child who
 * is dragging the shoe about is not still being told to.
 */
export const HOLD_TO_LEARN_MS = 900

/**
 * One frame of PRESENT time.
 *
 * `doing` is whether the player is, right now, performing the thing the active
 * lesson asks for — dragging, for `move`. For a lesson with a `holdMs` there is
 * nothing to do, so simply being seen counts.
 */
export const step = (dtMs: number, doing = false): void => {
  const spec = activeSpec.value
  if (!spec) return
  shownMs += dtMs
  if (spec.holdMs !== undefined) {
    doneMs += dtMs
    lessonProgress.value = Math.min(1, doneMs / spec.holdMs)
    if (doneMs >= spec.holdMs) { complete(spec.id); return }
  } else if (doing) {
    // `doing` is only ever true for a lesson with no event to fire — `move`,
    // where there is no "moved" signal, only a foot that is or is not
    // travelling. Holding the gesture for `HOLD_TO_LEARN_MS` IS the completion,
    // and forgetting that line is what left the first build's opening lesson on
    // screen with a full ring and no way past it.
    doneMs += dtMs
    lessonProgress.value = Math.min(1, doneMs / HOLD_TO_LEARN_MS)
    if (doneMs >= HOLD_TO_LEARN_MS) { complete(spec.id); return }
  }
  // The bail-out. A player who does not do the thing is never stuck being told
  // to — and it counts as TAUGHT, because showing somebody a lesson they
  // ignored twice is how a game becomes nagging. The exception is a lesson with
  // `retries`, whose moment can pass without the player having had a go at it.
  if (shownMs >= spec.bailoutMs) missed(spec.id)
}

/** Bail-outs spent per lesson this session, against its `retries`. */
const spentRetries: Partial<Record<LessonId, number>> = {}

/**
 * The lesson's moment passed without the player doing the thing — its bail-out
 * ran, or its set piece ended (a conga walked off, a level closed on a tap).
 *
 * A lesson with `retries` left is put back UNTAUGHT, to be armed again by its
 * next moment; everything else retires as taught, exactly as a bail-out always
 * has.
 */
export const missed = (id: LessonId): void => {
  const allowed = lessonSpec(id).retries ?? 0
  const spent = spentRetries[id] ?? 0
  if (spent < allowed) {
    spentRetries[id] = spent + 1
    shelve(id)
    return
  }
  complete(id)
}

// ─── The slam's own trigger ─────────────────────────────────────────────────
//
// Every other lesson is armed by a condition the scene can read in one frame —
// a bug exists, a meter filled, a panel opened. The slam is armed by something
// that happened TO the player, and it is the only lesson whose arming rule has
// enough in it to be worth stating once and testing. See the long note beside
// `SLAM_GRACE_MS` in `game/tutorial.ts` for why the sight of a shell is the
// wrong moment and the bounce off one is the right moment.

/** Has a blow of the player's ever rung off armour this session? */
let sawRicochet = false
/** Present time spent with an unpierceable body on the board. */
let armouredMs = 0

/**
 * A blow bounced.
 *
 * Cheap and idempotent: the scene calls it from the `clang` event, which also
 * fires for shells no slam can open — the answerability check lives in
 * `armSlam` below, where the board is in scope, rather than here.
 */
export const noteRicochet = (): void => { sawRicochet = true }

/**
 * One frame of the slam lesson's arming rule.
 *
 * `answerable` is whether a body the equipped shoe cannot tap through, but CAN
 * slam through, is alive right now — `slamTeaches` in `game/tutorial.ts`. It is
 * both the gate and the clock: the grace window only runs while the shell the
 * lesson would point at is actually there to point at.
 */
export const armSlam = (dtMs: number, answerable: boolean): void => {
  if (!answerable) return
  armouredMs += dtMs
  if (sawRicochet || armouredMs >= SLAM_GRACE_MS) arm('slam')
}

/** Test seam — put a player back to knowing nothing. */
export const __resetTutorial = (): void => {
  taught.value = {}
  clearLessons()
  shownMs = 0
  doneMs = 0
  sawRicochet = false
  armouredMs = 0
  for (const k of Object.keys(spentRetries)) delete spentRetries[k as LessonId]
}

/** How far through the whole curriculum this player is, 0..1. For a future
 *  "you have learned everything" moment, and for telemetry that is not wired. */
export const curriculumProgress = computed(() =>
  LESSON_IDS.filter((id) => isTaught(id)).length / LESSON_IDS.length)

const useTutorial = () => ({
  taught, activeLesson, activeSpec, lessonProgress,
  arm, complete, shelve, missed, clearLessons, step, isTaught, curriculumProgress,
  noteRicochet, armSlam
})

export default useTutorial
