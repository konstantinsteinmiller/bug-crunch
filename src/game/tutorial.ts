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
 * with nine bug behaviours, a combo ladder, a resource meter and a shop cannot
 * teach three of them and hope. (The chest is the one deliberate exception:
 * it is an opt-in bonus and is left for the curious to find — see where its
 * lesson used to be, below.)
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
  | 'pods'
  // ── The set pieces (RETENTION-FEATURES.md) ──
  | 'rush'
  | 'grow'
  | 'finish'
  | 'bigFinish'
  | 'shoebox'
  | 'perkSteelBoot'
  | 'perkBunnySlipper'
  | 'perkRollerSkate'
  | 'perkCleatBoot'
  | 'perkElectricSock'
  | 'kick'
  | 'spin'
  | 'skid'
  | 'quake'
  | 'echo'
  | 'twistSpill'
  | 'twistSprinkler'
  | 'twistBlackout'
  | 'twistDraft'
  | 'twistSurge'
  | 'twistGlitch'
  | 'party'
  // ── The meta ──
  | 'stars'
  | 'secondWind'
  | 'peek'
  | 'quests'
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
 *   double two quick drops on one spot and a swirl round it — the Heel Spin
 *   skid   a hand that presses DOWN and drags along a track with the press
 *          ring still under it — the slide, which is a tap that never lifts
 *   flick  a fast swipe through a point, and a ghost of it rolling on down the
 *          line — the kick that sends a flipped beetle bowling
 */
export type Gesture =
  | 'drag' | 'tap' | 'hold' | 'avoid' | 'point' | 'flow' | 'watch'
  | 'double' | 'skid' | 'flick'

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
  /**
   * How many times the lesson may run out WITHOUT counting as taught.
   *
   * Every other row treats a bail-out as taught, because showing somebody a
   * lesson they ignored twice is nagging. Three rows are different: they are
   * armed by a set piece that passes (a conga walks off, a beetle rights
   * itself, a level ends on a tap), and a player who missed the moment has not
   * ignored the lesson, they never got a go at it. Those come back with the next
   * set piece, up to this many times, and then retire like everything else.
   */
  retries?: number
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
  //
  // `soft`, not `hole`. This is the first lesson in the list that arrives with
  // the level already underway — 1-3, a floor of ants and two beetles, a clock
  // running — and `hole` is documented three screens up as the OPENING scrim,
  // "for the beats where the player has nothing else to be doing". It shipped
  // as `hole` and it black-screened two thirds of a live board for up to
  // fifteen seconds while an armoured beetle walked into the foot.
  //
  // The bail-out is the longest on the board for a reason: it is the only
  // lesson whose gesture takes most of a second to perform (see the beat table
  // in `TutorialOverlay.vue`), and a player who has just been surprised by a
  // blow that did not work needs a cycle or two of watching before they copy.
  lesson({ id: 'slam', gesture: 'hold', scrim: 'soft', bailoutMs: 15_000, order: 50 }),

  // ── 6. The one lesson whose answer is "don't". ──
  //
  // Met on 1-2 — the game's second level, and the first board that can HURT.
  // That makes it the one board lesson allowed to take the screen from a lesson
  // it outranks that is already up (see `armBodyLessons` in `GameScene.vue`):
  // every other beat can wait its turn in the queue, but a caterpillar that
  // walks under the foot while the fever button is being pointed at teaches
  // "spikes" the hard way, which is the exact thing this row exists to prevent.
  lesson({ id: 'spike', gesture: 'avoid', scrim: 'soft', bailoutMs: 8_000, holdMs: 3_200, order: 60 }),

  // ── 7. A body that does not wait to be stomped. ──
  lesson({ id: 'dodge', gesture: 'watch', scrim: 'soft', bailoutMs: 7_000, holdMs: 2_800, order: 70 }),

  // ── 8. The reward. ──
  //
  // It used to POINT at a button: the vial filled, a flame lit under it, and
  // the lesson asked for a press. Four of five blind testers never worked out
  // what that flame was, so Fever now spends itself the moment the glass is
  // full and there is nothing left to press. What is worth teaching is the
  // other half — that the goo of every squish is what fills the glass — so this
  // is a `flow` now, like `goal`: an arrow from a body on the floor to the vial,
  // thrown while the vial is nearly full and the payoff is seconds away.
  lesson({ id: 'fever', gesture: 'flow', scrim: 'soft', bailoutMs: 6_000, holdMs: 2_400, order: 80 }),

  // ── 9. The thing at the end of a world — and, first, on 1-4. ──
  lesson({ id: 'boss', gesture: 'watch', scrim: 'soft', bailoutMs: 7_000, holdMs: 2_800, order: 90 }),

  // ── 10. The eggs. ──
  //
  // The boss's second phase makes HER invulnerable and the eggs she drops the
  // job, and until the first boss moved to 1-4 the only thing that said so was
  // a line of text under the boss bar — which a six-year-old, four levels into
  // the game, does not read. A `tap` on the nearest egg: the same hand the stomp
  // lesson used on the first ant, pointed at a new kind of target. Retired by
  // the first egg squished (`podsPopped`, which a carrier ant's egg counts in too).
  //
  // Every boss fight has eggs now, so it is armed by the first egg ON THE FLOOR
  // in any of them (`armBodyLessons` in `GameScene.vue`) — on 1-4 for a new
  // player, the Queen's egg phase. An egg that hatches does not hurt: it cracks
  // in four stages, rocks, pops and lets out a scurry of ants. That consequence
  // is the second half of the lesson, and the bail-out is set so it can be SEEN:
  // nine seconds of present time outlasts the slowest egg's clock (1-4's, 6.9 s,
  // plus its hop), so a player who watches the hand instead of copying it
  // watches an egg they did not pop crack open under it. A test holds the two
  // together. In a `pods` phase a player who never learns this is still stuck —
  // the boss stays armoured — which is why the lesson outranks every meta beat.
  lesson({ id: 'pods', gesture: 'tap', scrim: 'soft', bailoutMs: 9_000, order: 95 }),

  // ═══ The set pieces ═══════════════════════════════════════════════════════
  //
  // Every one of `RETENTION-FEATURES.md`'s features is a new thing to DO or to
  // SEE, and the rule this list exists for applies to all of them: a mechanic
  // nobody is shown is a mechanic a six-year-old never finds. Each is armed by
  // the moment it becomes real on the board — the snare roll, the gilded last
  // body, the box landing, the beetle going over — and retires on the doing.

  // ── The conga. ── The hand hovers over the middle of the trail and drops as
  // the line overlaps it. Retired by the first stomp that takes two or more; a
  // rush that walks past untaken leaves it untaught, and the next rush arms it
  // again (`retries`).
  lesson({ id: 'rush', gesture: 'tap', scrim: 'soft', bailoutMs: 9_000, order: 45, retries: 2 }),

  // ── The chain is the shoe. ── An arrow from the chain badge to the shoe as
  // it puffs up: THIS makes THAT bigger. Seen, not done.
  lesson({ id: 'grow', gesture: 'flow', scrim: 'soft', bailoutMs: 5_000, holdMs: 1_800, order: 47 }),

  // ── One to go. ── A ring on the gilded last body. 1-1's Big Finish is a
  // celebration, not a skill, so this is watched rather than performed.
  lesson({ id: 'finish', gesture: 'watch', scrim: 'soft', bailoutMs: 4_000, holdMs: 1_200, order: 48 }),

  // ── …or let it fill and SLAM it. ── From 1-5: the hand presses on the shoe
  // and the ring fills. Retired by the first slam finisher; a tap finish puts it
  // back for the next level (up to three times — see `GameScene`).
  lesson({ id: 'bigFinish', gesture: 'hold', scrim: 'soft', bailoutMs: 8_000, order: 52, retries: 2 }),

  // ── A present on the floor. ── The hand taps the box.
  lesson({ id: 'shoebox', gesture: 'tap', scrim: 'soft', bailoutMs: 9_000, order: 54 }),

  // ── What the shoe in the box is FOR. ── Once per shoe, on its first trial.
  // The steel boot's is the loudest in the game: the hand drops onto the
  // caterpillar the spike lesson said to leave alone. The rest point at the
  // thing the shoe answers; the skate's is its drag.
  lesson({ id: 'perkSteelBoot', gesture: 'tap', scrim: 'soft', bailoutMs: 6_000, order: 56 }),
  lesson({ id: 'perkBunnySlipper', gesture: 'watch', scrim: 'soft', bailoutMs: 5_000, holdMs: 2_200, order: 57 }),
  lesson({ id: 'perkRollerSkate', gesture: 'skid', scrim: 'soft', bailoutMs: 8_000, order: 58 }),
  lesson({ id: 'perkCleatBoot', gesture: 'watch', scrim: 'soft', bailoutMs: 5_000, holdMs: 2_200, order: 59 }),
  lesson({ id: 'perkElectricSock', gesture: 'watch', scrim: 'soft', bailoutMs: 5_000, holdMs: 2_200, order: 61 }),

  // ── Beetle Bowling. ── A flipped beetle, a dotted line through it towards
  // the nearest group, and a hand flicking along it. Retired by the first kick.
  lesson({ id: 'kick', gesture: 'flick', scrim: 'soft', bailoutMs: 9_000, order: 72, retries: 2 }),

  // ── The Boss Trophies, each on the practice formation that answers it. ──
  lesson({ id: 'spin', gesture: 'double', scrim: 'soft', bailoutMs: 9_000, order: 74 }),
  lesson({ id: 'skid', gesture: 'skid', scrim: 'soft', bailoutMs: 9_000, order: 76 }),
  lesson({ id: 'quake', gesture: 'hold', scrim: 'soft', bailoutMs: 9_000, order: 78 }),
  lesson({ id: 'echo', gesture: 'hold', scrim: 'soft', bailoutMs: 9_000, order: 79 }),

  // ── The Uh-oh! Twists. ── A ring on what just changed, the first time each
  // one plays. The tell (the slowed board, the pictogram) runs EVERY time and
  // says "something is coming"; these say, once, "it is this".
  lesson({ id: 'twistSpill', gesture: 'watch', scrim: 'soft', bailoutMs: 5_000, holdMs: 2_200, order: 81 }),
  lesson({ id: 'twistSprinkler', gesture: 'watch', scrim: 'soft', bailoutMs: 5_000, holdMs: 2_200, order: 82 }),
  lesson({ id: 'twistBlackout', gesture: 'watch', scrim: 'none', bailoutMs: 5_000, holdMs: 2_200, order: 83 }),
  lesson({ id: 'twistDraft', gesture: 'watch', scrim: 'soft', bailoutMs: 5_000, holdMs: 2_200, order: 84 }),
  lesson({ id: 'twistSurge', gesture: 'watch', scrim: 'soft', bailoutMs: 5_000, holdMs: 2_200, order: 85 }),
  lesson({ id: 'twistGlitch', gesture: 'watch', scrim: 'soft', bailoutMs: 5_000, holdMs: 2_200, order: 86 }),

  // ── The party. ── The hand taps the river of ants. Retired by the first kill.
  lesson({ id: 'party', gesture: 'tap', scrim: 'soft', bailoutMs: 6_000, order: 87 }),

  // ── 11. What the three stars are for. ──
  //
  // On the result screen, which is a modal: no scrim of our own.
  lesson({ whilePaused: true, id: 'stars', gesture: 'watch', scrim: 'none', bailoutMs: 6_000, holdMs: 2_600, order: 100 }),

  // ── So Close! ── On a near-miss fail screen: the hand points at the vial on
  // the retry button — the full vial the next try opens with. Retired on retry.
  lesson({ whilePaused: true, id: 'secondWind', gesture: 'point', scrim: 'none', bailoutMs: 6_000, order: 102 }),

  // ── Peek. ── A hand pulsing on the napkin: tap it and the thing under it
  // hops. Short, because the screen already has a forward button to find.
  lesson({ whilePaused: true, id: 'peek', gesture: 'point', scrim: 'none', bailoutMs: 4_000, order: 103 }),

  // ── 12. Where those words WENT. ──
  //
  // The level card spends a second and a half telling the player, in their own
  // language, what the other two stars want. Then it dissolves, and two glyph
  // discs appear under the chest — which a first-time player has no way to
  // connect to anything: a reviewer looking at the HUD read them as "two
  // anonymous roundels", and a six-year-old has less to go on than a reviewer.
  //
  // The information is not missing. The REFERENT is. So this is not a caption
  // (a caption is the checklist `ObjectiveList` refuses to put on a live board,
  // and it is the one thing that cannot survive 320 px in twenty-one
  // languages) — it is a `flow`, the gesture this game already owns for
  // "THIS causes THAT", run once between the words and the marks while both
  // are on screen. The card is held up for exactly as long as the arrow needs
  // it, because an arrow whose tail is over empty space says nothing.
  //
  // It sits with the META lessons rather than the board ones on purpose. Every
  // board lesson outranks it, so a caterpillar walking into the foot always
  // wins the screen; this is the least urgent thing the game ever explains,
  // and it is armed at the calmest moment a level has.
  lesson({ id: 'quests', gesture: 'flow', scrim: 'soft', bailoutMs: 5_200, holdMs: 2_200, order: 105 }),

  // ── The chest is deliberately NOT taught. ──
  //
  // It had a lesson here — a ring round the chest and a pulsing pointer at it,
  // run through pauses like the rest of the meta — and it was too loud for what
  // the chest is: a bonus for a player who is curious enough to go looking and
  // wants more coins, not a step every player has to be walked through. Worse,
  // as a `whilePaused` lesson it stayed up through the pause the reward reveals
  // hold, so the ring and the pointer showed through "A new bug!" at the top of
  // the screen. The chest's own ready state is its whole invitation.

  // ── 14-15. The shop, in two halves, because it is two decisions. ──
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

/**
 * ─── When the big stomp is worth explaining ─────────────────────────────────
 *
 * The slam lesson shipped armed by the SIGHT of an armoured body: the frame a
 * beetle became alive on its debut level (1-4 then, 1-3 now), the lesson went
 * up. Measured in a browser, that
 * is the wrong frame twice over.
 *
 * FIRST, it is too early to mean anything. A child who has never tried to
 * squash a beetle has no question that a hand pressing and holding is the
 * answer to. The level's own design note says what the moment is —
 * "1-3  the beetle  a tap is not enough: the slam" — and "a tap is not enough"
 * is something that happens TO the player, on the frame their tap bounces. The
 * simulation already announces it: `clang`.
 *
 * SECOND, and this is what actually broke it: the lesson is one-shot and its
 * bail-out counts as taught. Armed at the beetle's spawn, the fifteen seconds
 * are spent while the player is across the board squishing ants, and it retires
 * itself — permanently, into the save — before they ever touch the shell. A
 * headless run of the beetle level that tapped only unarmoured bodies had
 * `bc_taught.slam`
 * written `true` at t≈14 s, after which the game had no way left to mention the
 * charged stomp, ever, on any level. The whole mechanic was being taught to an
 * empty room.
 *
 * So the trigger is the ricochet, with a grace window behind it for the player
 * who simply walks around beetles until the board jams.
 *
 * The Queen's third phase counts as a shell too (`armBodyLessons` in
 * `GameScene.vue`): 1-4 asks for the slam one level after 1-3 taught it, and a
 * player whose lesson bailed out unlearned there still gets it on the tap that
 * bounces off HER.
 */

/**
 * How long an unpierceable body may share the board with a player who has not
 * tried to hit it, before the game explains the shell anyway.
 *
 * Present time, like every other clock in this system, and deliberately LONG.
 * The number has to be read against the bail-out it hands over to: at fifteen
 * seconds of `slam`, a grace of six would put the lesson up at t ≈ 6 s of 1-3
 * and retire it at t ≈ 21 s — which is the measured failure with an extra seven
 * seconds bolted on, not a fix. Eighteen leaves the ricochet almost always
 * getting there first, which is the entire point: the lesson should land on the
 * player's question, not ahead of it.
 *
 * What it still catches is the player it is for — one who walks around beetles.
 * 1-3 runs 50 seconds, so eighteen seconds of a shell standing on the floor
 * untouched means the board is already jamming (an armoured body a weak player
 * will not slam does not die; it sits in `maxAlive` and the spawner stops
 * refilling), and that player needs telling more than anyone.
 */
export const SLAM_GRACE_MS = 18_000

/**
 * Is a charged slam the answer to this shell, in this shoe?
 *
 * Two halves, and shipping only the first half is a bug the browser run found:
 * the old condition was `light < armor` alone, which is true for the bunny
 * slipper (pierce 0) against a robobug (armour 3) — and a slam there carries
 * pierce 2, still bounces, and the game would have spent its one teaching slot
 * demonstrating a gesture that does not work. A lesson has to be ANSWERABLE.
 *
 * `light`/`heavy` are `blowPierce(shoe, false)` and `blowPierce(shoe, true)`;
 * they are passed in rather than read here so this file stays pure curriculum
 * and does not have to know what a shoe is.
 */
export const slamTeaches = (light: number, heavy: number, armor: number): boolean =>
  light < armor && heavy >= armor
