/**
 * ─── Every lesson this game teaches, as data ────────────────────────────────
 *
 * The audience starts at six. A six-year-old on a phone, in a language they are
 * still learning to read, will not read an instruction — and a ten-year-old
 * will not either: they tap past it and are then confused, which is worse than
 * never having shown it. So every mechanic in Bug Crunch is taught the same way,
 * and it is the only way that works at that age:
 *
 *   **SHOW THE GESTURE, ON THE THING, AND LET THEM LEAVE BY DOING IT.**
 *
 * No words. No OK button. Nothing to dismiss. A lesson retires the moment the
 * player performs the action it is about, and never returns.
 *
 * ── Why a list instead of three hard-coded beats ──
 *
 * The first build taught three things — move, tap, hold — on level 1, wired
 * inline into the scene, and nothing else, ever. A reviewer played it and
 * reported that the stomp, the charged stomp, the chain, Fever and the GAME'S
 * OWN GOAL were never explained anywhere, and that "the player needs to be
 * guided through the game to not feel left behind". They were right: a game
 * with nine bug behaviours, a combo ladder, a resource meter, a shop and a
 * chest cannot teach three of them and hope.
 *
 * So the lessons are a LIST, each with the moment it becomes relevant and the
 * action that retires it, and the scene arms them as the game reaches them. A
 * new mechanic added later is a new row here plus one `arm()` call — which is
 * the point: the cost of teaching a feature has to be low enough that it always
 * happens.
 *
 * ── The rules every row keeps ──
 *
 *   1. WORDLESS. Nothing here is translated because there is nothing in it to
 *      translate; it is correct in all 21 locales for free.
 *   2. NOT A PAGE. `pointer-events: none` all the way down — the finger that is
 *      learning is playing, not being intercepted by the thing explaining.
 *   3. ONE AT A TIME. Two instructions on one screen is no instruction.
 *   4. IT ENDS. Every lesson has a bail-out, so a player who does not do the
 *      thing is never stuck being told to.
 */

/** Which lessons exist. Order of declaration is teaching order. */
export type LessonId =
  // ── The board ──
  | 'move'
  | 'stomp'
  | 'goal'
  | 'chain'
  | 'slam'
  | 'spike'
  | 'dodge'
  | 'fever'
  | 'boss'
  // ── The meta ──
  | 'stars'
  | 'chest'
  | 'locker'
  | 'buy'

/**
 * What the overlay animates.
 *
 *   drag   a hand sliding along a dotted track, a ghost shoe one beat behind
 *   tap    a hand dropping onto a point, a burst popping
 *   hold   a hand pressing and STAYING down while a ring fills, then a big wave
 *   avoid  a hand reaching towards a point and recoiling from it — the only
 *          lesson in the game whose answer is "do not"
 *   point  a hand pulsing at a control, with a ring around it
 *   flow   an arrow travelling from one point to another: this causes that
 *   watch  no hand at all, just a ring breathing around something to look at
 */
export type Gesture = 'drag' | 'tap' | 'hold' | 'avoid' | 'point' | 'flow' | 'watch'

/**
 * How much of the board is dimmed behind the lesson.
 *
 *   hole  dark everywhere except a circle over the lesson — for the opening
 *         beats, where the player has nothing else to be doing
 *   soft  a light wash, so a lesson that arrives MID-LEVEL does not black out
 *         the bug about to walk into the foot
 *   none  nothing — for lessons that land on top of a modal, which is already
 *         its own scrim, and which must not be dimmed twice
 */
export type Scrim = 'hole' | 'soft' | 'none'

export interface Lesson {
  id: LessonId
  gesture: Gesture
  scrim: Scrim
  /**
   * Milliseconds the lesson stays up if the player never does the thing.
   *
   * Counted in PRESENT time — time with the player's input in it — never wall
   * time. An interstitial, a consent dialog or a tab opened in the background
   * all leave the game running with nobody looking at it, and a bail-out on
   * wall time dismisses the whole lesson before the player ever arrives.
   */
  bailoutMs: number
  /**
   * For a lesson with no action to perform (`watch`, `flow`): how long it must
   * be SEEN before it counts as taught. Absent on a lesson the player retires
   * by doing something.
   */
  holdMs?: number
  /**
   * Lower wins when two lessons are armed at once. Roughly the order a player
   * meets them, so a mechanic never gets explained before the control that
   * operates it.
   */
  order: number
  /**
   * The lesson runs while the game is PAUSED.
   *
   * Every modal in this game takes an app pause — that is what stops the clock
   * while a child reads the shop — and the board lessons must stop with it, or
   * a lesson armed at the last second of a level ticks its bail-out away behind
   * the result screen. But the meta lessons are ABOUT those screens: the shop,
   * the buy button, the star row. Those three would never get a single frame if
   * the pause silenced them.
   */
  whilePaused?: boolean
}

const lesson = (l: Lesson): Lesson => l

export const LESSONS: readonly Lesson[] = [
  // ── 1. The control. Everything else is unreachable without it. ──
  lesson({ id: 'move', gesture: 'drag', scrim: 'hole', bailoutMs: 14_000, order: 10 }),

  // ── 2. The verb. ──
  lesson({ id: 'stomp', gesture: 'tap', scrim: 'hole', bailoutMs: 14_000, order: 20 }),

  // ── 3. WHY. ──
  //
  // The lesson the first build was missing entirely: an arrow from a bug that
  // has just been squished to the bar at the top of the screen, which fills.
  // Nobody had ever been told what the game wanted from them. A `flow` rather
  // than a gesture, because there is nothing to do here — there is something to
  // UNDERSTAND, and three seconds of a moving arrow is how you say
  // "that → this" without a word.
  lesson({ id: 'goal', gesture: 'flow', scrim: 'soft', bailoutMs: 6_000, holdMs: 2_600, order: 30 }),

  // ── 4. The skill. ──
  //
  // Armed on the second squish of a level rather than the first, so the player
  // has already felt one land. The chain is the whole of this game's skill
  // expression and it is invisible in the fiction: nothing on the floor tells
  // you a multiplier exists.
  lesson({ id: 'chain', gesture: 'tap', scrim: 'soft', bailoutMs: 11_000, order: 40 }),

  // ── 5. The second verb, taught at the first thing that needs it. ──
  lesson({ id: 'slam', gesture: 'hold', scrim: 'hole', bailoutMs: 15_000, order: 50 }),

  // ── 6. The one lesson whose answer is "don't". ──
  lesson({ id: 'spike', gesture: 'avoid', scrim: 'soft', bailoutMs: 8_000, holdMs: 3_200, order: 60 }),

  // ── 7. A body that does not wait to be stomped. ──
  lesson({ id: 'dodge', gesture: 'watch', scrim: 'soft', bailoutMs: 7_000, holdMs: 2_800, order: 70 }),

  // ── 8. The reward. ──
  lesson({ id: 'fever', gesture: 'point', scrim: 'soft', bailoutMs: 9_000, order: 80 }),

  // ── 9. The thing at the end of a world. ──
  lesson({ id: 'boss', gesture: 'watch', scrim: 'soft', bailoutMs: 7_000, holdMs: 2_800, order: 90 }),

  // ── 10. What the three stars are for. ──
  //
  // On the result screen, which is a modal: no scrim of our own.
  lesson({ whilePaused: true, id: 'stars', gesture: 'watch', scrim: 'none', bailoutMs: 6_000, holdMs: 2_600, order: 100 }),

  // ── 11. The chest pays you for coming back. ──
  lesson({ whilePaused: true, id: 'chest', gesture: 'point', scrim: 'soft', bailoutMs: 9_000, order: 110 }),

  // ── 12-13. The shop, in two halves, because it is two decisions. ──
  //
  // A child who has never opened the Locker does not know a Locker exists, and
  // one looking at an open Locker does not know that the card has to be pressed
  // before it will sell them anything. Both were reported as "skin buying does
  // not work". Armed only when the player can ACTUALLY afford something — an
  // arrow pointing at a shop you cannot buy from teaches disappointment.
  lesson({ whilePaused: true, id: 'locker', gesture: 'point', scrim: 'soft', bailoutMs: 9_000, order: 120 }),
  lesson({ whilePaused: true, id: 'buy', gesture: 'tap', scrim: 'none', bailoutMs: 12_000, order: 130 })
] as const

const BY_ID: Record<LessonId, Lesson> = Object.fromEntries(
  LESSONS.map((l) => [l.id, l])
) as Record<LessonId, Lesson>

export const lessonSpec = (id: LessonId): Lesson => BY_ID[id]!

export const LESSON_IDS: readonly LessonId[] = LESSONS.map((l) => l.id)

export const isLessonId = (v: unknown): v is LessonId =>
  typeof v === 'string' && v in BY_ID

/**
 * The save field holding which lessons the player has been taught.
 *
 * Deliberately NOT the same record as `HINTS_SEEN_KEY`, which the text primer
 * pills use. The two sets share several ids by design (`move`, `slam`, `spike`,
 * `fever`, `boss` are both a pill and a lesson), and sharing one record would
 * have each silently retire the other — the player would get the pill OR the
 * animation, at random, and never both.
 */
export const TAUGHT_KEY = 'bc_taught'

/** Which of two armed lessons is shown. Lower `order` wins. */
export const outranks = (a: LessonId, b: LessonId): boolean =>
  lessonSpec(a).order < lessonSpec(b).order
