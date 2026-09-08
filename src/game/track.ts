import {
  BARRICADE_W,
  ROCK_H,
  ROCK_W,
  BOSS_BASE_HP,
  CRATE_R,
  CROWD_MAX_R,
  GATE3_DIVIDER_X,
  GATE3_LEAF_HALF,
  GATE3_LEAF_X,
  GATE_LEAF_HALF,
  GATE_LEAF_X,
  GATE_MAX_VALUE, GATE_MUL_MAX, GATE_SCALE_STEP, GATE_SUB_MAX,
  MAX_SQUAD,
  START_SQUAD,
  earlyCrateHpMul, earlyMinibossHpMul, earlyObstacleKeep, earlyPackCap, earlyPackMul,
  gateMulOpen,
  gatePumpStep,
  LANE_HALF,
  stageLength,
  stageSpeed,
  UNIT_R,
  type CrateKind,
  type GateOp
} from '@/game/survival'
import { bossHpScale, foeDef, foeHpScale, foeRoster } from '@/game/foes'
import {
  LEVER_R, LEVER_STAGGER, LEVER_STONE_HP_MUL, LEVER_STONE_LEAD, LEVER_STONE_W,
  LEVER_X, WEAPON_BOX_AHEAD, WEAPON_BOX_R, WEAPON_BOX_X, WEAPON_EVERY,
  WEAPON_GUARD_HALF_W, WEAPON_GUARD_HP_MUL, WEAPON_GUARD_LEAD, WEAPON_STAGE,
  leverHp, stageHasWeapon, weaponBoxHp, weaponForStage, type WeaponId
} from '@/game/weapons'

/**
 * ─── The track generator ────────────────────────────────────────────────────
 *
 * A stage is a fixed, seeded score — not a random stream. Same stage number,
 * same layout, every device, every session. That matters more than it sounds:
 *
 *   • a player who wipes on stage 6 can LEARN stage 6 rather than re-roll it;
 *   • the resumable run snapshot only has to store a stage number and a
 *     distance, because the layout is reproducible from those two;
 *   • balance is testable — `tests` can walk a stage and assert its shape.
 *
 * The rhythm is deliberate and repeats every ~25 units:
 *
 *      hazard → (supplies / coins) → GATE BANK → hazard …
 *
 * The bank is always the beat you are running toward, and there is always
 * something in the way of standing still on it.
 *
 * What a bank is
 * ──────────────
 * A bank is TWO leaves with a SOLID PILLAR between them, so running the centre
 * line is fatal. The player must commit to a side — which means the two leaves
 * may never be worth the same thing, or the commitment is a coin flip dressed
 * up as a decision. Every two-leaf bank this file emits asks one of exactly two
 * questions:
 *
 *   • `add | add`, `add | mul` → "how long do I stand here, and on which side?"
 *     (only `add` leaves climb under sustained fire, so the pumpable leaf is
 *     worth more the longer you are willing to be shot at);
 *   • `mul | div`, `mul | mul` → "pick one, right now" — a pure routing call
 *     with nothing to pump and no way to improve the offer by waiting.
 *
 * Stages alternate between the two so a run never settles into one verb.
 *
 * …and from `TRIPLE_STAGE`, the spike
 * ──────────────────────────────────
 * THREE leaves and two pillars (`GATE3_*` in `survival.ts`): a narrow centre
 * door flanked by two narrow side doors. A two-leaf bank is a side to commit to;
 * a three-leaf bank is an ORDERING — the player has to rank three offers against
 * the crowd they happen to be carrying, in the second and a half before they
 * arrive, and the crowd has to funnel to fit whichever door they picked.
 *
 * They are deliberately rare (see `maxTriples`). The centre door is the one a
 * player who does nothing rolls into — it is the only door in the game with no
 * pillar in front of it — so it carries the MODEST offer most of the time and
 * the trap often enough that drifting into it is never free.
 *
 * Everything with a number in it lives in the ── Difficulty knobs ── block
 * below, so a simulation pass can retune the whole game from one screenful.
 */

// ─── The event vocabulary ───────────────────────────────────────────────────

export interface GateLeaf {
  /** Centre of the leaf, world x: ±`GATE_LEAF_X` on a two-leaf bank,
   *  −`GATE3_LEAF_X` / 0 / +`GATE3_LEAF_X` on a three-leaf one. */
  x: number
  /** Half-width — `GATE_LEAF_HALF` (barely wider than the crowd at full size,
   *  and that margin is the whole aiming skill) or the narrower
   *  `GATE3_LEAF_HALF`, which the crowd has to funnel down to fit. */
  halfW: number
  op: GateOp
  value: number
}

export type TrackEvent =
  /** `dividers` are the world-x centres of the solid pillars between leaves.
   *  A two-leaf bank has exactly one, at 0; a three-leaf bank has two, at
   *  ±`GATE3_DIVIDER_X`. The sim gives each of them `DIVIDER_HALF_W`. */
  | { kind: 'gates'; y: number; leaves: GateLeaf[]; dividers: number[] }
  /** `hp` is PER CRATE, not per row: a row is a spread of tiers now, and the
   *  number is printed on the box. See `crateTierFor`. */
  | {
      kind: 'crates'; y: number
      /** `gain` overrides the per-kind payout; see `Crate.gain`. */
      crates: Array<{ x: number; kind: CrateKind; hp: number; gain?: number }>
    }
  | { kind: 'barricade'; y: number; blocks: Array<{ x: number; w: number; hp: number }> }
  /** Boulders. No `hp` — they cannot be shot, only steered around.
   *  `passage` marks a rib walling one gate off from another; see `passage()`.
   *  `field` ties the ranks of one `boulderField` together: their 3.2-unit
   *  offset is the beat, so `clearGateBands` has to move them as one body. */
  | {
      kind: 'rocks'; y: number; blocks: Array<{ x: number; w: number }>
      passage?: boolean; field?: number
    }
  | { kind: 'foes'; y: number; typeId: string; count: number; spread: number }
  /** One elite body. `hpScale` multiplies the ARCHETYPE'S BASE HP (`foeDef().hp`)
   *  — it already carries the stage scaling, see `minibossHp()`. */
  | { kind: 'miniboss'; y: number; typeId: string; hpScale: number }
  | { kind: 'coins'; y: number; xs: number[]; ys: number[] }
  /**
   * The weapon puzzle, as ONE event.
   *
   * Levers, armour and prize are authored, streamed and reasoned about as a
   * single beat because they are only meaningful together: a lever with no box
   * to open is scenery, and a box with no levers is a wall. Splitting them into
   * three events would also split the guarantee that keeps the beat fair — that
   * the armour is exactly `WEAPON_BOX_AHEAD` past the levers, which is the
   * reaction window the whole thing is priced against (`weaponReactionS`).
   *
   * `y` is the FIRST lever; everything else is an offset from it, resolved by
   * the generator so the sim and the tests read the same absolute numbers.
   */
  | {
      kind: 'weapon'; y: number; weapon: WeaponId
      /** Two posts, opposite shoulders, staggered by `LEVER_STAGGER`. */
      levers: Array<{ x: number; y: number; hp: number }>
      /** One destructible boulder per lever, `LEVER_STONE_LEAD` in front of it
       *  and in the same column — the cover that stops a lever being solved by
       *  a stray round. Indexed to match `levers`. See `Stone`. */
      stones: Array<{ x: number; y: number; w: number; hp: number }>
      box: { x: number; y: number; hp: number }
      /** Armour over the box, all of it on one line `WEAPON_GUARD_LEAD` in
       *  front of the prize. Deleted wholesale the instant both levers are
       *  pulled — see `unlockPuzzle` in `useSurvivalGame`. */
      guardY: number
      guards: Array<{ x: number; w: number; hp: number }>
    }

export interface Track {
  stage: number
  /** Distance at which the crowd stops running and the boss fight opens. */
  arenaY: number
  /** Where the boss stands. */
  bossY: number
  /** Total distance used for the HUD's progress bar. */
  length: number
  events: TrackEvent[]
}

// ─── Difficulty knobs ───────────────────────────────────────────────────────
//
// Every one of these is a pure function of the stage number, exported so a
// simulation harness can sweep them without touching the layouts they feed.

/**
 * The narrowest lane the crowd may ever be asked to thread.
 *
 * A crowd at full size is `CROWD_MAX_R` across the radius and each survivor is
 * `UNIT_R` wide on top of that, so a gap of exactly twice the crowd radius
 * leaves ZERO clearance: a perfectly-aimed run still shaves survivors off both
 * edges, and the player has no way to see why. The margin on top is what makes
 * "aim at the gap" an instruction the game can actually honour. Barricade rows
 * are repaired (blocks dropped) until they satisfy it; see `ensureRunnable`.
 *
 * The margin doubled, 0.5 → 1.0, when walls and boulders stopped grinding and
 * started killing. Half a unit of clearance is ±0.25 of steering slack, which
 * was ample while touching a wall cost a trickle and is not ample when it costs
 * every survivor in the column: measured, the benchmark player could not hold
 * that line and died on stage 4 with 42 barricade deaths at 16 % of the road.
 * It stops at 1.0 because `ensureRunnable` buys clearance by DELETING blocks —
 * at a 2.6 margin every barricade row in the game is one block wide and every
 * boulder field is one boulder, and the obstacles stop existing. 1.0 keeps
 * ~1.6–2.2 blocks a row against 2.19 before.
 */
export const MIN_RUN_GAP = 2 * (CROWD_MAX_R + UNIT_R) + 1.0

/**
 * How far off the straight line a supply crate sits.
 *
 * Crates are the only way fire rate climbs during a run, and a reward you can
 * collect by doing nothing is not a reward — it is a tax on the layout. So they
 * live out at the lane's shoulders and cost the player a deliberate swerve
 * (and, usually, whatever the swerve walks them into).
 */
export const CRATE_DETOUR_X = 2.45

/**
 * The x offsets of stage 1's opening crate wall.
 *
 * Spaced by one crate diameter so the row is continuous: a gap wider than the
 * crowd is a gap the player will find, and a player who threads it learns
 * nothing. Derived from `CRATE_R` rather than typed out, so the wall stays
 * closed if the box ever changes size.
 */
/**
 * What the whole opening wall is worth, end to end.
 *
 * The wall is seven boxes because it has to be unmissable, not because it is
 * worth seven boxes. At the normal `CRATE_RATE_GAIN` a player who ploughed
 * through the middle of it left the tutorial at nearly twice the fire rate the
 * rest of stage 1 is priced against — the beat is a lesson, and a lesson should
 * not also be the biggest windfall in the run.
 *
 * So the row is priced as a unit: clear every box and fire rate goes 1.9 -> 2.5,
 * which is worth roughly one ordinary crate. Clear three, as most players will,
 * and it is a nudge. The point was never the number.
 */
export const TUTORIAL_WALL_RATE_TOTAL = 0.6

/**
 * Where the second pickup sits, and what it costs.
 *
 * Well inside `CRATE_DETOUR_X` (2.45), which is the offset every LATER crate
 * uses: this one is teaching the player that a box off the line is worth
 * steering for, and a lesson is not the place to find out how far a detour can
 * be pushed. Priced far under the stage-1 curve (a rolled damage crate here is
 * 7) for the same reason — the player has to WIN this one.
 */
export const SECOND_PICKUP_X = 1.7
export const SECOND_PICKUP_HP = 4

export const TUTORIAL_CRATE_WALL: readonly number[] = (() => {
  // Rail to rail: the outermost box sits one radius inside each rail, so its
  // edge lands exactly ON the rail and there is no lip to squeeze past.
  const edge = LANE_HALF - CRATE_R
  // Spread evenly rather than stepped from one side — a stepped loop leaves its
  // remainder as a gap at whichever rail it finishes on, and a gap at the rail
  // is precisely where a nervous player drives.
  //
  // `floor`, so neighbours end up a whisker further apart than one box rather
  // than a whisker closer: boxes that overlap are boxes drawn on top of each
  // other, and one of them is then a health bar the player cannot see. The
  // leftover gap is a few centimetres of a nine-unit road — closed as far as
  // anything that can steer is concerned.
  const n = Math.floor((edge * 2) / (CRATE_R * 2)) + 1
  const xs: number[] = []
  for (let i = 0; i < n; i++) {
    xs.push(Math.round((-edge + (edge * 2 * i) / (n - 1)) * 100) / 100)
  }
  return xs
})()

/** Floor on the supplies a stage must offer, enforced after the body is laid
 *  out. Fire rate starts at 1.9 shots/s — three rate crates is the difference
 *  between a stage that feels sluggish and one that opens up. */
export const MIN_RATE_CRATES = 3
export const MIN_DAMAGE_CRATES = 2

/**
 * …and a long stage has to offer more of both.
 *
 * The floors above were measured on stages 1–5, which are 129–165 units long.
 * Stage 30 is 340 — more than twice the road, more than twice the banks, more
 * than twice the enemy HP — and a flat floor of three rate crates makes a late
 * stage measurably POORER per unit of road than an early one. That is the wrong
 * direction for the one stat a run has to earn: fire rate opens at 1.9 and
 * `CRATE_RATE_GAIN` is 0.55, so six rate crates is a run finishing at ~5.2 of a
 * 6.5 ceiling — which is what a stage-27 crowd needs to make its DPS keep up
 * with `foeHpScale`.
 *
 * They ramp in whole crates rather than smoothly, because a crate is an atom:
 * the step from three to four is a real, visible extra detour on the road.
 */
export const minRateCrates = (stage: number): number =>
  MIN_RATE_CRATES + Math.floor(Math.max(0, stage - 6) / 7)
export const minDamageCrates = (stage: number): number =>
  MIN_DAMAGE_CRATES + Math.floor(Math.max(0, stage - 9) / 10)

/**
 * A miniboss is worth about an eighth of the stage's end boss: long enough to
 * be a fight with a shape, short enough that it never becomes the climax.
 *
 * It was 0.26, and that number was sized for an enemy that WALKED PAST. The
 * elite used to stroll through the crowd and out the back of the lane at
 * 22–99 % health — measured, across stages 2–10, a competent player killed not
 * one of them — so its health was a decoration on a fight nobody had. Now that
 * it plants and blocks the road (`ELITE_HOLD_AHEAD`) the number is load-bearing,
 * and at 0.26 it made the elite the hardest thing on the stage: 11-second
 * fights against a half-built crowd, measured at 104–157 % of the END BOSS's
 * time-to-kill, and a career that walled at stage 6 for an average player.
 *
 * The right target is the ratio, not the raw number. A miniboss is met by a
 * crowd roughly half the size the boss meets, with fewer crates broken — so a
 * fraction that reads as "an eighth" on paper lands at "about half the boss
 * fight" in seconds, which is what a mid-road landmark should cost.
 *
 * Cut 0.115 → 0.08 when the elite started SWEEPING. The sweep charges a
 * percentage of the squad, so — unlike every other threat in the game — it
 * cannot be answered by building a bigger crowd; the only currency it accepts
 * is time-to-kill. That makes this constant, not the sweep's own numbers, the
 * dial that decides what an elite costs, and at 0.115 a low-DPS run stood in
 * front of stage 2's and stage 3's elites for the entire leash and lost the
 * stage every time.
 */
export const MINIBOSS_BOSS_FRACTION = 0.08

/**
 * …and the minibosses on a stage are not the same fight.
 *
 * The first one is met by a HALF-BUILT crowd around the midpoint, so it gets a
 * discount; the second is met at ~80 % by a run that has been through every
 * gate on the stage, so it gets a premium. Both still land either side of "a
 * quarter of the boss", which is the number the pacing was designed around.
 *
 * From `MINIBOSS_STAGE_THIRD` a LIGHT one opens the stage at ~28 %. A stage-25
 * road is fifty seconds long; two elites break that into three fights, and the
 * first of them does not arrive until twenty-five seconds in. The early one is
 * priced at 0.85 rather than 1.3 because the crowd that meets it has been
 * through two banks, not six — it is a landmark and a warm-up, not a wall.
 */
export const MINIBOSS_FIRST = 1.15
export const MINIBOSS_SECOND = 1.3
export const MINIBOSS_EARLY = 0.8
export const MINIBOSS_STAGE_THIRD = 20

/**
 * Stage 1's single elite: 40 % of what a normal first miniboss carries.
 *
 * It is the only enemy on the stage that cannot be walked past, and it stands
 * in for the boss that stage 1 no longer has. The job is to teach "a big one
 * needs a bigger crowd" in a fight the player cannot lose — so it is priced to
 * fall over, not to be a wall. `0.4 x MINIBOSS_FIRST` keeps it expressed as a
 * fraction of the real thing rather than a magic number, so a balance pass on
 * the elites moves the tutorial with them.
 */
export const MINIBOSS_TUTORIAL = MINIBOSS_FIRST * 0.4

/**
 * Stage 1's boss used to be priced here, as `tutorialBossHp` — three times the
 * tutorial elite, an absolute number chosen so a first-time player could not
 * lose their first climax.
 *
 * It is gone because the guarantee it bought is now bought better: stages 1-5
 * price their boss against the crowd that actually reaches the arena
 * (`game/adaptive.ts`), so a first-timer with a small squad gets the gentle
 * fight the constant was protecting, and the returning player who used to
 * delete the same boss in half a second gets a real one. A fixed number could
 * only ever be right for one of the two.
 *
 * The stage-1 ELITE keeps its own price (`MINIBOSS_TUTORIAL`) — it is a beat on
 * the road rather than the climax, and nothing adaptive reads it.
 */

/**
 * The longest a player may go without being asked to choose something.
 *
 * A gate is the only beat in the game that is a DECISION — crates, packs and
 * walls are all execution. Measured across the campaign, bank-to-bank stretches
 * ran to 8.8 s on stage 3 and 7 s on several others: long enough that the road
 * stops being a conversation and becomes scenery you hold a thumb against.
 *
 * Expressed in SECONDS, not units, because the road speeds up with depth — the
 * same 30-unit gap is six seconds on stage 2 and four on stage 20, and it is the
 * time that is boring, not the distance.
 */
export const MAX_GATE_GAP_S = 5.5

/** Which of the (up to three) elites on a stage this is. */
export type MinibossRank = 'tutorial' | 'early' | 'first' | 'second'

const MINIBOSS_PREMIUM: Record<MinibossRank, number> = {
  tutorial: MINIBOSS_TUTORIAL,
  early: MINIBOSS_EARLY,
  first: MINIBOSS_FIRST,
  second: MINIBOSS_SECOND
}

/**
 * Absolute HP a miniboss is meant to have on a given stage.
 *
 * `second` predates the third elite and is kept because the balance study calls
 * `minibossHp(s, false)` to print its miniboss-versus-boss table; `rank` wins
 * when both are given, and is what the generator itself passes.
 */
export const minibossHp = (stage: number, second: boolean, rank?: MinibossRank): number =>
  Math.round(
    BOSS_BASE_HP *
      bossHpScale(stage) *
      MINIBOSS_BOSS_FRACTION *
      MINIBOSS_PREMIUM[rank ?? (second ? 'second' : 'first')] *
      // Cut again for a beginner, on top of the tutorial rank's own discount.
      // Applied HERE and not in `bossHpScale`, which minibosses share with the
      // end boss — the two take different cuts, and folding them together would
      // make one of the two numbers a lie.
      earlyMinibossHpMul(stage)
  )

/**
 * The multiplier the event carries.
 *
 * The archetypes are sized for packs (a hound is 13 hp), so promoting one to a
 * landmark takes a big number — and the sim ALSO puts every foe through
 * `foeHpScale(stage)` on the way in, so that curve is divided back out here.
 * A miniboss is sized against the BOSS it is warming up for, not against what
 * its own archetype happens to be worth this deep into the game; without the
 * division a stage-25 miniboss would arrive nine times too tanky.
 *
 * Net effect: `def.hp × foeHpScale(stage) × hpScale` lands exactly on
 * `minibossHp(stage, second)`, whatever archetype the roster hands over.
 */
export const minibossHpScale = (
  stage: number,
  typeId: string,
  second: boolean,
  rank?: MinibossRank
): number => {
  const raw = minibossHp(stage, second, rank) / Math.max(1, foeDef(typeId).hp * foeHpScale(stage))
  return Math.round(raw * 10) / 10
}

/**
 * Base `+N` printed on a fresh `add` leaf, before any pumping.
 *
 * One per stage up to 14, then a little over half that. The knee is the whole
 * point: the crowd's growth is the product of the add value AND the number of
 * banks, and the number of banks grows with the stage too (a stage-30 road is
 * 340 units and fits thirteen banks against stage 6's five). Left linear, the
 * additive path alone hands a stage-30 run four hundred survivors before a
 * single multiplier is counted, and every `×N` after that is a promise the
 * `MAX_SQUAD` ceiling quietly breaks.
 *
 * ─── The flat term, and why it has moved twice ─────────────────────────────
 *
 * It was 2. It went to 4 when the guns stopped outranging the camera: a bank
 * used to be shootable from ~26 units out, which at stage speed is a ~4.8 s
 * pump (nine ticks), and in range the same approach is ~2.0 s (four). That took
 * `average` from a 60–100 % clear rate to 0 % on stages 2, 3 and 5, so the
 * value the pump could no longer add moved into the print.
 *
 * It is now **3**, and the shortfall against the requested −3 is measured
 * rather than chosen. Doors pay less so the exponential they drive starts
 * smaller, which is the ask; how much less is bounded by the career:
 *
 *   −1 (this)  campaign clean — a competent player reaches stage 12 inside the
 *              retry budget, `optimal` still clears the authored stages.
 *   −2         campaign completes, but one stage in twelve costs a competent
 *              player a FOURTH attempt.
 *   −3         a competent player walls at stage 6 and never recovers: at
 *              stage 1 a door prints `+1` against a starting squad of 3, so the
 *              crowd never gets started and every later multiplier has nothing
 *              to multiply.
 *
 * The flat cut is also the wrong shape for the goal it was aimed at. "Harder to
 * amass tons of units" is about the top of the curve, and −3 costs stage 1
 * seventy-five per cent of a door while costing stage 14 twenty-three. The rule
 * that actually attacks the compounding is `canMul`'s new spacing clause: two
 * `×2` banks in a row was a free quadruple for anybody who could aim twice, and
 * that is now impossible.
 */
export const gateAddBase = (stage: number): number => {
  const authored = 3 + Math.floor(Math.min(stage, 14) * 0.9 + Math.max(0, stage - 14) * 0.55)
  if (stage <= 30) return Math.min(GATE_MAX_VALUE, authored)
  // ── The endless knee ──
  //
  // Past the authored campaign the slope drops again, to a logarithm. Doors
  // keep getting bigger forever — they have to, or a stage-100 bank is a
  // stage-30 bank — but the SUM of a stage's adds has to stay under `MAX_SQUAD`
  // for as long as possible, and a linear +0.55 a stage does not: measured, it
  // pins the cap on additive payouts alone by stage 86 and every door past that
  // point lies about its payout.
  //
  // 24 at stage 30 → 33 at 60 → 41 at 100 → 55 at 300. Still climbing at three
  // hundred, and still honest.
  const base = 3 + Math.floor(14 * 0.9 + 16 * 0.55)
  return Math.min(GATE_MAX_VALUE, base + Math.floor(Math.log2(1 + (stage - 30) / 7) * 7.4))
}

/**
 * Bodies in a standard pack.
 *
 * Two regimes, because two different things are being respected.
 *
 * Up to stage 28 the pack grows linearly: twenty on screen is a crowd and the
 * old cap of 16 landed on stage 19 and then never moved again.
 *
 * Past it the cap is a SCREEN limit rather than a campaign one — forty bodies
 * in one beat is a smear whatever stage it is on — so the pack keeps growing
 * logarithmically toward a hard 34. Stage 60 gets 25, stage 100 gets 27, stage
 * 300 gets 31: still climbing at stage 300, still readable, and the endless
 * game's density comes mostly from `beatGap` sending them more often.
 */
export const packSize = (stage: number): number => {
  const linear = 3 + Math.floor(stage * 0.7)
  if (linear <= 22) return linear
  return Math.min(34, 22 + Math.floor(Math.log2(1 + (stage - 28) / 9) * 3.2))
}

/**
 * HP of one barricade block.
 *
 * A barricade is a routing problem first; shooting it is the expensive answer.
 * That is why the curve is nearly flat and stays that way through the stages
 * the study measured — but a crowd's DPS is `squad × damage × fireRate`, and
 * all three of those climb during a late run, so a purely linear wall stops
 * being a question at all around stage 15: the crowd simply erases it without
 * changing line. The quadratic tail (zero below stage 10, +360 by stage 30)
 * keeps a late row alive for the half-second it takes to be a decision.
 */
export const barricadeHp = (stage: number): number =>
  Math.round(16 + stage * 11 + 0.9 * Math.max(0, stage - 10) ** 2)

/**
 * HP of one crate.
 *
 * Rate crates cost a little more because they are worth more, but both are
 * CHEAP on purpose: the price of a crate is the detour, not the ammunition.
 *
 * The first curve — `(8 + stage·3.2)`, giving a rate crate 15/19/23/27/31 HP —
 * quietly broke the game's main progression lever. Breaking a crate first seen
 * twelve units out demands 20/26/33/40/48 DPS, and the benchmark run has
 * 22/30/13/15/42 DPS at the quarter of the road where the crates live. So runs
 * collected 0–2 of 2, fire rate finished between 1.90 and 3.00 against a 6.5
 * ceiling, and on stage 3 it did not move for ANY player. Fire rate is supposed
 * to be the stat that separates a good run from a lazy one; it cannot be that
 * if nobody can afford it.
 */
export const crateHp = (stage: number, kind: CrateKind): number =>
  Math.round(
    (6 + Math.min(stage, 12) * 1.2 + Math.max(0, stage - 12) * 0.5) * (kind === 'rate' ? 1.25 : 1)
  )

/** One box's share of `TUTORIAL_WALL_RATE_TOTAL`. */
export const TUTORIAL_WALL_RATE_EACH = TUTORIAL_WALL_RATE_TOTAL / TUTORIAL_CRATE_WALL.length

/**
 * ─── …and not every crate is the same crate ─────────────────────────────────
 *
 * Every box on the road used to carry the identical number, which made the
 * detour a pure routing question: if you could break one you could break all of
 * them, so the only thing a crate ever asked was "can you be bothered to steer".
 *
 * Three tiers, printed on the box, turn that into a question about the RUN.
 * A light crate is a freebie for anybody. A standard one is the curve above. A
 * heavy one is deliberately out of reach of an unupgraded squad at that point
 * on the road — it is there to be walked past on stage 3 and cracked open on
 * stage 3 two upgrades later, which is the only way a stat-crate can reward
 * progression rather than just handing out progression.
 *
 * The multipliers are the whole design: 0.6 / 1 / 2.1. The heavy tier is a
 * little over twice the standard one because "twice" is the point at which a
 * benchmark run stops breaking it incidentally on the way past and has to
 * either commit the seconds or come back stronger.
 */
/**
 * ─── …and where on the road it sits ─────────────────────────────────────────
 *
 * A crate's HP was a function of the STAGE alone, which priced every box on a
 * stage against the squad the player had at the start of it. That squad is not
 * the one that meets the box: the crowd is built on the road, so by three
 * quarters of the way through a well-played stage it is several times what it
 * was at the first bank — and the last crate of the stage was being erased in
 * passing by a run that had to work for the first one.
 *
 * The multiplier follows the crowd instead of the stage: a crate at the very
 * start is priced as it always was, and one at the far end costs `1 + DEPTH`
 * times as much. 1.9 at the arena end, measured against the crowd growth a
 * competent run actually produces, so the LAST box on the road is about as much
 * work as the first one — which is what makes a late detour a decision rather
 * than a formality.
 */
export const CRATE_DEPTH_SCALE = 1.9

/**
 * `fraction` is the crate's position along the road, 0 … 1.
 *
 * The effect FADES IN with the stage, because the premise fades in with it: a
 * stage-2 crowd barely grows across a stage, so pricing its last crate against
 * a squad it does not have just makes an early box unbreakable. Full strength
 * from stage 24, nothing before stage 4.
 */
export const crateDepthFactor = (fraction: number, stage: number): number => {
  const ramp = Math.max(0, Math.min(1, (stage - 4) / 20))
  return 1 + Math.max(0, Math.min(1, fraction)) * CRATE_DEPTH_SCALE * ramp
}

export type CrateTier = 'light' | 'standard' | 'heavy'

export const CRATE_TIER_SCALE: Record<CrateTier, number> = {
  light: 0.6,
  standard: 1,
  heavy: 2.1
}

/**
 * Roll a tier for one crate.
 *
 * Heavies stay rare and arrive late: before stage 3 there is no shop history to
 * make "come back for it" mean anything, so an unbreakable box would just be a
 * box that does not work. Lights exist so that a row of three crates is visibly
 * a row of DIFFERENT crates — the variety has to be legible at a glance or the
 * number on the box is decoration.
 */
export const crateTierFor = (stage: number, roll: number): CrateTier => {
  const heavy = stage < 3 ? 0 : Math.min(0.3, 0.1 + (stage - 3) * 0.012)
  if (roll < heavy) return 'heavy'
  if (roll < heavy + 0.28) return 'light'
  return 'standard'
}

/** Final integer HP for one crate: the stage curve, by tier. Always ≥ 1, and
 *  always an integer, because it is printed on the box. */
export const crateTierHp = (stage: number, kind: CrateKind, tier: CrateTier): number =>
  Math.max(1, Math.round(crateHp(stage, kind) * CRATE_TIER_SCALE[tier]))

/**
 * Odds a procedurally-rolled bank carries a `÷N` trap leaf.
 *
 * The old curve hit its 0.55 ceiling at stage 11 and then said the same thing
 * for twenty stages. It is now a genuine ramp across the whole game: gentler
 * than before where the player has only just met a trap (0.28 at stage 6
 * against the old 0.39, on top of the "every stage past the tutorial contains
 * at least one" guarantee in `rollBank`), harder than before where they have
 * been reading them for half an hour (0.58 by stage 29).
 */
export const trapChance = (stage: number): number =>
  // 0.58 was the ceiling of a thirty-stage game and it was reached ON stage 30,
  // so every endless stage would have inherited exactly the same odds. It now
  // creeps on toward 0.72 — 0.63 at stage 60, 0.67 at 100 — which keeps the
  // bank a question without turning the road into a toll booth.
  Math.min(0.72, 0.2 + stage * 0.013 + Math.max(0, stage - 30) * 0.0012)

/**
 * Odds a trap-free bank carries a `-N` bill instead.
 *
 * Deliberately common — this is the leaf that fixes "every bank is answered by
 * pumping the bigger number". A `+N` beside a `-N` cannot be solved by holding
 * fire on the best offer, because the crowd shoots forward and *whatever the
 * player is aimed at grows*: point at the bill and you buy a bigger bill.
 *
 * Ramps from a third of trap-free banks at stage 3 to just over half late on,
 * where the player has the crowd to absorb a mistake and needs a reason to
 * still be reading the doors.
 */
export const subChance = (stage: number): number =>
  stage < 3 ? 0 : Math.min(0.7, 0.3 + (stage - 3) * 0.012 + Math.max(0, stage - 24) * 0.001)

/**
 * …and how often a stage's one dilemma actually gets rolled.
 *
 * `legalise` rations it to one per stage; this decides whether that one is
 * spent at all. High on purpose: a bank with no right answer is the single
 * hardest read in the game, and a stage that only sometimes contains one is a
 * stage where the player cannot learn to expect it.
 */
export const dilemmaChance = (stage: number): number =>
  stage < 4 ? 0 : Math.min(0.85, 0.35 + (stage - 4) * 0.02 + Math.max(0, stage - 17) * 0.0015)

/**
 * …and how often that trap is the big one.
 *
 * `÷5` is the leaf that ends runs, so it arrives rare and grows: one trap in
 * eight at stage 6, one in two by stage 30. It used to be a flat 35 % from the
 * moment it unlocked, which made stage 6 — the first procedural stage, the
 * first with two minibosses — the stage where the game's harshest leaf was
 * already at full strength.
 */
export const bigDivChance = (stage: number): number =>
  stage < 6 ? 0 : Math.min(0.68, 0.12 + (stage - 6) * 0.015 + Math.max(0, stage - 32) * 0.0015)

/**
 * Distance between two beats of the procedural body.
 *
 * Later stages are longer AND denser, which is most of why they feel harder.
 * The floor is a hard one: below ~7 units the previous beat is still on screen
 * when the next arrives and the player is reacting to two things at once, which
 * reads as unfair rather than fast.
 */
export const beatGap = (stage: number, roll: number): number => {
  // The floor was a flat 7 from stage 30, which made every stage past it beat
  // for beat identical — the single biggest reason a stage-100 road felt like a
  // stage-30 road. It now keeps closing, logarithmically, toward a hard 5.2:
  // 6.4 at stage 60, 6.0 at 100, 5.5 at 300. Below ~5 the crowd cannot finish
  // reacting to one beat before the next arrives, which is not difficulty.
  const base = stage <= 30
    ? Math.max(7, 12 - stage * 0.167)
    : Math.max(5.2, 7 - Math.log2(1 + (stage - 30) / 12) * 0.55)
  return base + roll * (3 - Math.min(1.6, stage * 0.045))
}

/**
 * Which arrangements a stage may roll, and how often.
 *
 * Zero until the idea has been taught by a hand-shaped stage — and then a
 * MOVING mix rather than a fixed one. Flat weights meant that once the last
 * arrangement unlocked on stage 8, stages 8 and 30 rolled from exactly the same
 * bag, and the only thing separating them was enemy HP.
 *
 * The two simple beats (a pack in the lane, a wall with a hole in it) decay
 * toward a floor; the compound ones — the pincer that closes on the centre, the
 * swarm wall that gives you something to shoot AND something to dodge in the
 * same breath, the chicane that asks for two moves planned ahead — climb. So a
 * stage-8 body beat is a plain pack about half the time and a stage-30 one is a
 * plain pack about a fifth of the time. Same vocabulary, different sentence.
 *
 * Weights are per FAMILY (see `BODY_HAZARDS` / `STRUCTURE_HAZARDS`); only the
 * ratios inside a family matter.
 */
export const hazardWeights = (stage: number): Record<Hazard, number> => ({
  // Pack and wall are FLOORS that used to be reached at stages 34 and 32 while
  // every other weight in the family grew without bound — so by stage 100 the
  // plain pack was 8 % of body beats and the plain wall 5 % of structure beats,
  // and half of every structure beat was an unshootable boulder field. The
  // floors now drift up with the stage, slowly, so the simple beats stay part
  // of the vocabulary instead of being crowded out of it.
  pack: Math.max(1.4 + Math.max(0, stage - 34) * 0.035, 3.4 - stage * 0.06),
  wall: Math.max(1.2 + Math.max(0, stage - 32) * 0.03, 2.8 - stage * 0.05),
  chicane: stage >= 4 ? 1.6 + stage * 0.04 : 0,
  gauntlet: stage >= 5 ? 1.2 + stage * 0.03 : 0,
  pincer: stage >= 6 ? 1.0 + stage * 0.06 : 0,
  swarmWall: stage >= 8 ? 0.8 + stage * 0.09 : 0,
  // Boulders grow faster than anything else in the family, because they are the
  // only hazard whose difficulty does not decay as the crowd's damage climbs —
  // every other structure eventually becomes something a big run erases without
  // changing line. By stage 12 they are the heaviest structure on the roll.
  //
  // The gate says 3, but the hand-shaped stages 1–5 do not roll hazards at all,
  // so in practice the player meets their first boulder on stage 6 — the same
  // stage the pincer arrives, and one stage after walls have finished teaching
  // "solid things kill". Measured coverage: 21 of the 30 stages.
  boulders: stage >= 3 ? 1.1 + stage * 0.11 : 0
})

// ─── Three-leaf banks, and the multiplier budget ────────────────────────────

/**
 * The stage a bank may first offer three doors.
 *
 * Nine, and the reason is the teaching ladder either side of it. Stage 6 is the
 * first procedurally-built road AND the first with two minibosses AND the stage
 * `÷5` unlocks; 7 brings brutes and bait beats; 8 brings `×3` and the swarm
 * wall. Every one of those stages already has a new idea in it, and a
 * three-leaf bank is not a variation on the two-leaf rule — it is the first
 * time the answer is an ORDERING rather than a side, and the first time the
 * crowd has to squeeze to fit a door.
 *
 * Nine is the first stage with nothing else new in it. By then the player has
 * committed to a leaf perhaps fifty times and has been punished by a pillar for
 * hedging; that is the fluency a third door is worth spiking.
 */
export const TRIPLE_STAGE = 9

/** …and the stage the LAST bank before the boss becomes one. The run-in belongs
 *  to the biggest decision on the road, and by 14 the player has met three-leaf
 *  banks on five stages. */
export const CLOSING_TRIPLE_STAGE = 14

/** Odds a rolled bank is a triple, before the per-stage cap below. Low, and
 *  climbing slowly: the spike stops being a spike the moment it is the shape a
 *  player expects. */
export const tripleChance = (stage: number): number =>
  stage < TRIPLE_STAGE ? 0 : Math.min(0.5, 0.12 + (stage - TRIPLE_STAGE) * 0.008 + Math.max(0, stage - 32) * 0.001)

/**
 * Hard cap on three-leaf banks per stage.
 *
 * A stage runs 5 banks at stage 6 and about 13 at stage 30, so three is still a
 * clear minority — which is the point. Two-leaf banks are the game's grammar;
 * the triple is the sentence that makes the player sit up.
 */
export const maxTriples = (stage: number): number => {
  if (stage < TRIPLE_STAGE) return 0
  if (stage < CLOSING_TRIPLE_STAGE) return 1
  if (stage < 22) return 2
  // The ladder used to stop dead at 3 on stage 22. Past it a three-leaf bank
  // has to keep pace with the road for the same reason multipliers do: a
  // stage-100 road fits twenty banks, and three widest-question banks in twenty
  // is a rarer spike than three in ten was.
  return 3 + Math.floor(Math.max(0, stage - 34) / 18)
}

/**
 * How many multiplier leaves one stage may print.
 *
 * This is the knob that stops the late game from eating itself. Adds grow the
 * crowd linearly, but multipliers compound: the study watched two `×3` banks
 * turn a 40-crowd into 330 in six seconds and hand stage 5 a 1.6-second climax.
 * At stage 30 the old generator offered a multiplier on roughly half of thirteen
 * banks — six or seven of them, several `×3` — which is 2⁶ on top of an additive
 * path that was already at four hundred. The crowd pinned itself to `MAX_SQUAD`,
 * and a gate whose payout is silently clipped is a gate that lied.
 *
 * Three per stage, one of which is reserved for the closing bank (see
 * `rollBank`), so the road itself offers at most two. That is rare enough that
 * a `×N` streaming into view is an event rather than a beat.
 *
 * Stages 1–5 are exempt: their multipliers are hand-placed and measured, and
 * this budget exists to discipline the GENERATOR, not the level design.
 */
/** From here `mulLeaves` stops being unlimited — see rule 4b in `legalise`. */
export const MUL_BUDGET_SCARCE_STAGE = 6

export const mulLeaves = (stage: number): number => {
  // Was a flat 3 from stage 6 onward — forever. A stage-100 road carries twenty
  // banks, so 85 % of them were add-vs-add and the `×N` had stopped being part
  // of the vocabulary. The budget now grows with the number of banks the stage
  // actually has, one more multiplier per ~14 stages, so the RATIO of
  // multiplier banks stays roughly what it is at stage 10 instead of decaying
  // toward zero.
  if (stage < MUL_BUDGET_SCARCE_STAGE) return 99
  return 3 + Math.floor(Math.max(0, stage - 20) / 14)
}

/**
 * …and how many of them may be a `×3`. Exactly one, from the stage it unlocks.
 *
 * `×3` is the single most violent thing a leaf can do — the difference between
 * `×2` and `×3` on a crowd of two hundred is another two hundred survivors — so
 * a stage gets one, it goes to the widest bank on the road (see `canMulThree`),
 * and everything else that wants a multiplier gets a `×2`.
 */
export const mulThrees = (stage: number): number => {
  // Same reasoning as `mulLeaves`, one step behind it: the biggest multiplier
  // on a stage should stay rare, but "exactly one, forever" made it rarer every
  // stage in a campaign with no end.
  if (stage < 8) return 0
  return 1 + Math.floor(Math.max(0, stage - 30) / 22)
}

/**
 * How far into a stage a multiplier may first appear, as a fraction of the road.
 *
 * A `×2` is worth `crowd` survivors, so it is worth almost nothing to the crowd
 * a stage STARTS with — three survivors, plus whatever the meta shop bought.
 * Offering one in the first third is offering a leaf whose only correct answer
 * is "not that one", which is a wasted bank. Past a third of the road the crowd
 * is big enough that the multiplier is genuinely the greedy line, and the
 * question ("is my crowd already bigger than the number on the other door?")
 * becomes the one the mechanic was designed to ask.
 */
export const MUL_EARLIEST = 0.35

/**
 * …and how far in a TRAP may first appear, for the mirror-image reason.
 *
 * A `÷2` on the opening bank halves a crowd of three, and a `÷5` on it ends the
 * run before the player has been given anything to lose. Worse, it is not a
 * decision: with nothing built yet the other leaf is obviously correct, so the
 * bank is a reflex test wearing a choice's clothes. The generator used to open
 * stages 18, 22 and 30 with exactly that — a `÷5` at y = 14, the harshest leaf
 * in the game as the first thing on the road.
 *
 * A tenth of the road is one bank and one hazard: enough that the crowd walking
 * into the first trap is a crowd the player has already done something with.
 */
export const TRAP_EARLIEST = 0.1

/**
 * …and how far in a `-N` BILL may first appear, which is later, because a
 * subtraction can do something a division cannot: reach zero.
 *
 * `÷5` on a crowd of four leaves one survivor. `-8` on a crowd of four leaves
 * none — the run is simply over, at 8 % of the road, with nothing on screen
 * having gone wrong. Measured exactly that way: the career study walled an
 * `average` player at stage 7 on every purchasing strategy, dying at 8 %
 * progress with a peak squad of 7 and every death charged to the door.
 *
 * The bill is printed off `gateAddBase` — roughly one bank's worth of payout —
 * so the rule is simply that the player must have crossed some banks before one
 * arrives: at a third of the road the crowd has been through two or three, and
 * a bill priced at three quarters of one of them is a real cost rather than an
 * execution. This is the SAME shape of fix as `TRAP_EARLIEST`, one notch
 * further in, for a leaf that is one notch more final.
 */
export const SUB_EARLIEST = 0.33

// ─── Plumbing ───────────────────────────────────────────────────────────────

/** Small, fast, deterministic PRNG. Same seed → same stage, forever. */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(rng: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length) % arr.length]!

/** Two decimals. Keeps the serialised track (and its snapshots) tidy. */
const r2 = (v: number): number => Math.round(v * 100) / 100

/** Keep anything the player is meant to reach inside the lane. */
const clampX = (x: number): number =>
  Math.max(-LANE_HALF + 0.6, Math.min(LANE_HALF - 0.6, r2(x)))

/**
 * The stage under construction.
 *
 * A tiny mutable builder rather than a pile of arguments, because the
 * hand-shaped stages below read as prose that way — `wall(b); crate(b); bank(b)`
 * is the actual level design, and anything noisier hides it.
 */
interface Beat {
  stage: number
  rng: () => number
  arenaY: number
  events: TrackEvent[]
  /** Next id for a boulder field; see `boulderField` and `clearGateBands`. */
  fieldId: number
  /** Write cursor: where the next beat lands. */
  y: number
  /** Did the PREVIOUS bank carry a `÷5`? Big traps never come back to back. */
  bigDivLast: boolean
  /** Has ANY bank on this stage been a trap? A stage that rolls none is a stage
   *  where the pillar never mattered — see `rollBank`. */
  trapPlaced: boolean
  /** Consecutive trap banks so far. Two in a row is pressure; three in a row is
   *  a stage that has stopped offering the player anything. */
  trapStreak: number
  /** Dilemmas — every door hostile — the stage may still print, and whether the
   *  bank just emitted was one. Rationed hard: see `legalise` rule 6. */
  dilemmaLeft: number
  dilemmaLast: boolean
  /** Did the bank just emitted carry a multiplier? Two in a row is a free
   *  exponent for anyone who can aim twice — see `canMul`. */
  mulLast: boolean
  /** Banks still to print before the next passage, and the y the last event
   *  was written at — a rib may never reach back over it. See `passage()`. */
  passageIn: number
  lastY: number
  /** Should the next bank be a pure routing call (no pumpable leaf)? Toggled
   *  on every bank so a stage alternates its two question types. */
  routingNext: boolean
  /** Multiplier leaves left in the stage's budget, and how many of them may
   *  still be a `×3`. */
  mulLeft: number
  mulThreeLeft: number
  /** Three-leaf banks the stage may still print, and how many it has. */
  triplesLeft: number
  triplesPlaced: number
  /** Triples held back for the closing bank, so the body cannot spend the lot
   *  and leave the run-in to the boss a plain two-leaf choice. */
  tripleReserve: number
  /** Where the coins may point: the world x of the best and the worst leaf of
   *  the bank most recently emitted. A trail is a CLAIM about the bank it runs
   *  into, and after stage 5 the player knows it can be a false one. */
  trailGoodX: number
  trailBadX: number
  /** The last arrangement rolled from each family. A family never repeats its
   *  own last pick, so a stage cannot spend all six of its walls on chicanes. */
  lastBody: Hazard | ''
  lastStructure: Hazard | ''
  /** Last archetype spawned, never spawned twice running — a stage that rolls
   *  creeps five times has thrown away four fifths of its cast. */
  lastFoe: string
}

// ─── Gate banks ─────────────────────────────────────────────────────────────

interface LeafSpec {
  op: GateOp
  value: number
}

const add = (value: number): LeafSpec => ({ op: 'add', value })
const sub = (value: number): LeafSpec => ({ op: 'sub', value })
const mul = (value: number): LeafSpec => ({ op: 'mul', value })
const div = (value: number): LeafSpec => ({ op: 'div', value })

/** Both doors take something. See `legalise` rule 6. */
const isDilemma = (specs: readonly LeafSpec[]): boolean =>
  specs.length > 1 && specs.every((s) => s.op === 'div' || s.op === 'sub')

/**
 * Clamp a leaf to what the stage has EARNED.
 *
 * Introduction order is the tutorial, and it is enforced here rather than
 * trusted to the callers: a hand-shaped stage or a bad roll can ask for
 * anything, and the answer is always "not yet" rather than a crash.
 *
 *   stage 1     — `add` only. Nothing on the first stage may take anything away.
 *   stage 2+    — `×2` and `÷2`: the first stage with a wrong answer on it.
 *   stage 3+    — `-N`: one stage later than the trap, because it is the harder
 *                 idea of the two. `÷2` punishes the door you walked through;
 *                 `-N` punishes the door you were AIMING at on the way in, and
 *                 a player needs one stage of "gates can be bad" before the
 *                 subtler version of it is fair.
 *   stage 4+    — `÷3`: the middle trap. `÷2` is a bank you can afford to read
 *                 wrong and `÷5` ends runs, which left nothing in between —
 *                 and "nothing in between" is where a hard choice lives, so
 *                 this is the value most likely to be paired against a `-N`.
 *   stage 5+    — `×3`: only once a crowd is big enough for a multiplier to be
 *                 the greedy option rather than the obvious one.
 *   stage 6+    — `÷5`: a leaf that ends runs. Never twice in a row (see below).
 */
const sanitiseLeaf = (stage: number, spec: LeafSpec): LeafSpec => {
  if (spec.op === 'mul') {
    // Multipliers are legal from stage 1, and ONLY because stage 1 is authored
    // by hand. Nothing procedural rolls a leaf there, so the multipliers that
    // exist are the ones `stageOne` writes — doors where both leaves are good,
    // shown to the player before the game starts asking them questions about it.
    // The lesson that a multiplier can be a trap still belongs to stage 3; a x2
    // beside a fat + teaches nothing false.
    //
    // The value here is the HEADLINE. The door opens at four fifths of it and
    // pumps back up under fire — see `gateMulOpen`.
    const headline = stage < 8 ? 2 : Math.min(3, Math.max(2, Math.round(spec.value)))
    return mul(gateMulOpen(headline))
  }
  if (spec.op === 'div') {
    if (stage < 2) return add(gateAddBase(stage))
    // Snap to the harshest legal value at or below what was asked for, so a
    // caller can always write `div(5)` and get the strongest trap the stage has
    // earned rather than a crash or a silent `÷2`.
    const want = Math.round(spec.value)
    if (want >= 5 && stage >= 6) return div(5)
    if (want >= 3 && stage >= 4) return div(3)
    return div(2)
  }
  if (spec.op === 'sub') {
    if (stage < 3) return add(gateAddBase(stage))
    return sub(Math.max(1, Math.min(GATE_SUB_MAX, Math.round(spec.value))))
  }
  return add(Math.max(1, Math.min(GATE_MAX_VALUE, Math.round(spec.value))))
}

/**
 * What a `-N` leaf is worth before anyone shoots it.
 *
 * Priced off `gateAddBase` rather than off the crowd, because it is the mirror
 * of the `+N` beside it and has to stay legible as one: at stage 5 a bank
 * offering `+11` against `-8` is a question the player can answer by reading
 * two numbers. Slightly under the add base — the sub grows on the approach
 * whether the player likes it or not, so its printed value is a floor rather
 * than a price.
 */
const gateSubBase = (stage: number): number =>
  Math.max(2, Math.round(gateAddBase(stage) * 0.75))

const isBigTrap = (spec: LeafSpec): boolean => spec.op === 'div' && spec.value >= 5

const sameLeaf = (p: LeafSpec, q: LeafSpec): boolean => p.op === q.op && p.value === q.value

/**
 * What one leaf is worth, roughly — used ONLY to rank the offers inside a bank.
 *
 * Deliberately crude, because the honest answer is unknowable here: what a `×2`
 * is worth depends on the crowd the player happens to have built, which the
 * generator cannot see. What it CAN see is the generation — at stage `s` an
 * ordinary `add` leaf is worth about `gateAddBase(s)` — so a multiplier is
 * priced as "about one and a half banks' worth of add per step", and a `÷N` as
 * loudly, unmistakably negative.
 *
 * Two things read this: which leaf the coins point at, and which leaf a
 * degenerate bank gets upgraded into. Neither needs to be right; both need to
 * be consistent.
 */
const offerScore = (stage: number, spec: LeafSpec): number =>
  spec.op === 'div'
    ? -100 * spec.value
    : spec.op === 'sub'
      // Negative, and deliberately ABOVE any `div`: a subtraction is a bill,
      // a division is a percentage of everything the player has built. When a
      // bank offers both, the ranking has to say which one the coin trail
      // should point away from, and it is always the trap.
      ? -3 * spec.value
      : spec.op === 'mul'
        ? gateAddBase(stage) * 1.4 * (spec.value - 1)
        : spec.value

/**
 * Which trap this bank gets.
 *
 * Three rungs rather than two. `÷2` is the one a run absorbs, `÷5` is the one
 * that ends it, and `÷3` — unlocked at stage 4 — is the rung that was missing:
 * harsh enough to be a real decision, survivable enough to be worth offering
 * against something good. `sanitiseLeaf` clamps whatever comes out of here to
 * what the stage has actually earned, so this only has to express intent.
 */
const rollDiv = (b: Beat): LeafSpec => {
  if (b.rng() < bigDivChance(b.stage)) return div(5)
  return div(b.stage >= 4 && b.rng() < 0.45 ? 3 : 2)
}

/**
 * Make a list of offers legal, whatever the caller asked for.
 *
 * Every rule that makes a bank a DECISION is enforced here rather than at the
 * call sites, so neither a hand-authored stage nor an unlucky roll can print
 * one that is not. All of them generalise to any leaf count:
 *
 *   1. at most one `div` in a bank. A trap is only a trap when something beside
 *      it is visibly better; two of them is a toll booth with extra steps.
 *   2. `÷5` never lands in two consecutive banks — that is not difficulty, it
 *      is a dead run.
 *   3. the stage's multiplier budget (`mulLeaves` / `mulThrees`) is spent here,
 *      so it cannot be dodged by a caller that builds its leaves in an unusual
 *      order. A leaf the budget cannot pay for degrades rather than vanishing —
 *      `×3` to `×2` when the stage's one `×3` is gone, `×N` to `+N` when the
 *      leaves are.
 *   4. no two leaves are identical in BOTH op and value. Identical leaves turn
 *      the pillars into a pure punishment for existing: you commit to a door,
 *      gain nothing for having chosen well, and die if you dither.
 *   5. a trap is always paired with something clearly good — at least one leaf
 *      worth a full `gateAddBase` — or the bank is a tax rather than an offer.
 *      EXCEPT when the bank is a deliberate dilemma; see 6.
 *   6. a DILEMMA — every door hostile, `÷N` against `-N` — is legal, rationed,
 *      and never accidental. It is the one bank with no right answer, only a
 *      cheaper wrong one, and which is cheaper depends on the crowd the player
 *      brought. One per stage, from stage 4, never two banks running, and never
 *      as the last bank before the boss (a run should die to the climax, not to
 *      a toll booth three seconds before it).
 */
const legalise = (b: Beat, specs: readonly LeafSpec[]): LeafSpec[] => {
  const base = gateAddBase(b.stage)
  const out = specs.map((s) => sanitiseLeaf(b.stage, s))

  // (6) Is this the deliberate both-doors-bad bank? Decided FIRST, because the
  //     rules below are written to protect a bank that is supposed to have a
  //     good answer, and this one is not.
  const dilemma = isDilemma(out) && b.dilemmaLeft > 0 && !b.dilemmaLast
  if (dilemma) {
    b.dilemmaLeft--
    b.dilemmaLast = true
    // Still no two identical doors, and still at most one trap — a dilemma is a
    // hard question, not a coin flip between two of the same thing.
    if (out[0]!.op === out[1]!.op) out[1] = out[0]!.op === 'div' ? sub(gateSubBase(b.stage)) : div(2)
    // …and it still owes rule 2. This branch returns early, so the big-trap
    // cooldown has to be paid HERE or a dilemma becomes a back door for two
    // consecutive `÷5`s — which is precisely what it did: stage 20 doubled
    // down at y = 188.
    if (b.bigDivLast) for (let i = 0; i < out.length; i++) if (isBigTrap(out[i]!)) out[i] = div(3)
    return out.slice(0, 2)
  }
  b.dilemmaLast = false
  // A hostile pair that was NOT authorised degrades into the ordinary shape:
  // the trap survives, the subtraction becomes the offer beside it.
  if (isDilemma(out)) {
    for (let i = 0; i < out.length; i++) {
      if (out[i]!.op === 'sub') { out[i] = add(base + i); break }
    }
  }

  // (1) One trap at most, and one subtraction at most, whatever the caller
  //     asked for. Two of either is a toll booth with extra steps.
  let divs = 0
  let subs = 0
  for (let i = 0; i < out.length; i++) {
    if (out[i]!.op === 'div') {
      divs++
      if (divs > 1) out[i] = add(base + i)
      continue
    }
    if (out[i]!.op !== 'sub') continue
    subs++
    if (subs > 1) out[i] = add(base + i)
  }

  // (2) Cool the big trap down for one bank.
  if (b.bigDivLast) for (let i = 0; i < out.length; i++) if (isBigTrap(out[i]!)) out[i] = div(2)

  // (3) Spend the stage's multiplication. A leaf the budget cannot pay for
  //     degrades rather than vanishing, so a bank never loses a door.
  for (let i = 0; i < out.length; i++) {
    const leaf = out[i]!
    if (leaf.op !== 'mul') continue
    if (b.mulLeft < 1) {
      out[i] = add(base + 2 + i)
      continue
    }
    b.mulLeft--
    // Compared against the OPEN value, not the headline: a `x3` door is on the
    // road as a `x2.4` (see `gateMulOpen`), so testing `< 3` here would have
    // matched every multiplier in the game and quietly stopped spending the
    // three-budget at all.
    if (leaf.value < gateMulOpen(3)) continue
    if (b.mulThreeLeft >= 1) b.mulThreeLeft--
    else out[i] = mul(gateMulOpen(2))
  }

  // (4) Break every tie, so no two doors of a bank are worth the same thing.
  //     The replacement is an `add` (never a fresh `mul` — that would spend
  //     budget rule 3 has already accounted for) and it is re-checked, because
  //     the value it grows into can collide with a leaf further along.
  for (let i = 1; i < out.length; i++) {
    for (let guard = 0; guard < 6 && out.slice(0, i).some((p) => sameLeaf(p, out[i]!)); guard++) {
      const leaf = out[i]!
      out[i] =
        leaf.op === 'add'
          ? add(Math.min(GATE_MAX_VALUE, leaf.value + Math.max(2, Math.round(leaf.value * 0.6))))
          : add(base + 3 + i + guard)
    }
  }

  // (4b) NO BANK MAY OFFER THE SAME OP TWICE.
  //
  //      Rule 4 broke ties in VALUE; this breaks them in KIND, and it is the
  //      difference between a bank the player executes and a bank the player
  //      decides. `+7 | +8` has one right answer that can be read off the doors
  //      without knowing anything about the run — and 19 of the 44 banks in the
  //      first eight stages were exactly that shape, including the opening bank
  //      of nearly every stage. A player learns within three stages that the
  //      game is not asking them anything, which is the shape of boredom.
  //
  //      Against a different op the answer moves with the crowd. `+9` beside
  //      `x2` flips at nine survivors; `-N` beside `/2` flips at twice the bill.
  //      The player has to look at their own squad to answer, and the answer is
  //      different on a good run than on a bad one.
  //
  //      The partner ALTERNATES rather than always being a multiplier: `x2` on
  //      every bank would inflate the economy and become its own kind of
  //      wallpaper. A trap is preferred when the pacing rules above have left
  //      room for one (they cap traps per bank and cool big ones down), and the
  //      multiplier is taken otherwise, subject to the same `mulLeft` budget
  //      rule 3 spends. If neither is affordable the bank stays as it was —
  //      running out of budget must never cost a door.
  //      SCOPED TO THE STAGES WHERE THE PLAYER IS DECIDING WHETHER TO STAY.
  //      Below stage 6 the multiplier budget is unlimited (`mulLeaves`), so the
  //      repair is free and the economy absorbs it. From stage 6 the budget is
  //      three, and every way of paying for it was measurably worse: charging
  //      `mulLeft` starved the authored `xN` near the arena and nothing killed
  //      the stage-12 boss; not charging it inflated the crowd into the
  //      autobalancer, which raised enemy health to match and stalled a good
  //      player at stage 11; and using a trap instead turned two paying doors
  //      into a toll and made the road poorer everywhere it fired.
  //
  //      All three are re-tunings of a late-game curve that was balanced against
  //      free `add|add` banks, and that is a bigger job than this rule. The
  //      diagnosis was about stages 1-3 — the opening bank of nearly every early
  //      stage was a non-decision — and that is what this fixes. Stages 6+ keep
  //      their dominated banks until the economy is re-tuned to carry the change.
  if (b.stage < MUL_BUDGET_SCARCE_STAGE
    && out.length > 1 && out.every((s) => s.op === out[0]!.op)) {
    const i = out.length - 1
    const wasAdd = out[0]!.op === 'add'
    // The partner is ALWAYS a multiplier, and it does not pay `mulLeft` for it.
    //
    // Not a trap, for two reasons found by measurement. An `add|add` bank was
    // two doors that both paid, so turning one into a toll makes the road poorer
    // everywhere this rule fires — and the trap pacing is a stage-wide budget
    // this rule cannot see, so it produced three traps in a row on stages 2 and
    // 5 by landing next to ones the author had placed deliberately. Traps stay
    // where they are written down.
    //
    // And it does not charge `mulLeft`, because that budget paces the
    // multipliers the generator places ON PURPOSE — the ones a stage is designed
    // around. Charging it here starved the authored `xN` near stage 12's arena
    // into a plain `+N`, and the career sim reported nothing killing that boss.
    if (wasAdd) {
      out[i] = mul(gateMulOpen(2))
    } else if (!wasAdd) {
      // Two hostile doors that are not an authorised dilemma: one of them turns
      // into the offer beside it, which rule 5 below then makes worth crossing
      // for.
      out[i] = add(base + 2)
    }
  }

  // (5) A hostile door needs something worth crossing the lane for beside it.
  //     (A bank that reached here is not a dilemma — those returned above.)
  if (out.some((s) => s.op === 'div' || s.op === 'sub')) {
    let bestI = 0
    for (let i = 1; i < out.length; i++) {
      if (offerScore(b.stage, out[i]!) > offerScore(b.stage, out[bestI]!)) bestI = i
    }
    if (offerScore(b.stage, out[bestI]!) < base) {
      let grown = Math.min(GATE_MAX_VALUE, base + 2)
      while (out.some((s, i) => i !== bestI && sameLeaf(s, add(grown)))) grown++
      out[bestI] = add(grown)
    }
  }

  return out
}

/**
 * One gate bank: two or three leaves, and a solid pillar between each pair.
 *
 * The geometry is the only thing the leaf count changes. A two-leaf bank tiles
 * the lane as `leaf | pillar | leaf`; a three-leaf bank as
 * `leaf | pillar | leaf | pillar | leaf`, with narrower doors the crowd has to
 * funnel down to fit. Everything else — legality, trap bookkeeping, which
 * question the NEXT bank asks — is shared, because they are the same beat asked
 * at two different widths.
 */
/**
 * ─── Passages: the bank you cannot change your mind about ───────────────────
 *
 * A rib of unbreakable stone running back down the road from a bank's pillar,
 * splitting the approach into two corridors — one per door.
 *
 * Every bank is already a commitment, but only at the last moment: the crowd
 * can sit on the centre line reading both offers and slide to whichever door it
 * likes with half a second to spare, which makes a bank a REACTION rather than
 * a decision. A passage moves the commitment upstream. Both doors are in plain
 * sight the whole way in — that is the point, and it is why the rib is short
 * enough to fit on screen with the bank — but the moment the crowd enters a
 * corridor the other offer is behind a wall it cannot shoot through.
 *
 * ─── The three numbers ──────────────────────────────────────────────────────
 *
 * LENGTH is a decision window, so it is expressed in seconds and converted at
 * the stage's own speed: `PASSAGE_SECONDS` = 1.2, which at stage 6's 5.6 u/s is
 * about seven units of road. Long enough that the choice is made before the
 * bank rather than at it, short enough that the corridor mouth and the doors
 * are on screen together — a wall that arrives before the offer it splits is
 * not a decision, it is a guess.
 *
 * WIDTH is the pillar's own contact width and not a unit more. The pillar
 * already reaches `DIVIDER_HALF_W + UNIT_R` = 0.55 into the lane, so a rib of
 * the same width adds no new constraint to a crowd that was going to take a
 * door cleanly: the safe aiming band is the same [2.20, 2.55] it always was.
 * Wider stone would quietly turn every passage bank into a precision test.
 *
 * WHAT IT COSTS is a cut, not a kill. A crowd that enters the mouth straddling
 * the rib is divided on it — the corridor holding more survivors keeps them all,
 * the other loses all of its — and the rib is inert afterwards. It is one
 * decision for the whole rib rather than a dozen separate lethal boulders, and
 * `stepRocks` carries the measurement of why: billed stone by stone, a rib took
 * a 203-strong crowd to zero in a quarter of a second.
 *
 * CADENCE is every third or fourth bank, rolled per passage so the player
 * cannot count bars. Never the first bank of a stage — the opening bank is
 * where a run's crowd is smallest and the shape is still being read — and never
 * a three-leaf bank, whose two pillars would leave a centre corridor 1.2 units
 * wide against a crowd 3.3 across.
 */
export const PASSAGE_SECONDS = 1.2
export const PASSAGE_EVERY_MIN = 3
export const PASSAGE_EVERY_MAX = 4

/**
 * First stage that may print one.
 *
 * Six, which is where boulders arrive anyway (`hazardWeights`), so the player
 * has already been taught the one thing a passage assumes: that grey stone is
 * not a wall you can shoot. Teaching "commit early" and "this cannot be broken"
 * in the same beat is how a player concludes the game cheated.
 */
export const PASSAGE_STAGE = 6

/** Half-width of the rib, matched to `DIVIDER_HALF_W` — see the note above. */
export const PASSAGE_RIB_HALF_W = 0.25

/**
 * Lay the rib for the bank at `y`.
 *
 * `back` is how much clear road there is behind the bank; the rib is clipped to
 * it so a passage can never reach back over the beat before it and turn some
 * other row into a trap the player met at the wrong angle.
 */
const passage = (b: Beat, y: number, back: number): void => {
  const len = Math.min(back, stageSpeed(b.stage) * PASSAGE_SECONDS)
  // Under three units it reads as debris beside the pillar rather than as a
  // wall, and it stops being a decision at all.
  if (len < 3) return

  // Stone every 0.9 against a body 1.15 deep, so the rib overlaps itself into
  // one unbroken line rather than a dotted one a player might read as passable.
  const step = 0.9
  // Stops half a unit short of the doorway: the rib walls the APPROACH, and a
  // stone flush against the gate plate would eat the crowd on the way through
  // the door it just committed to.
  for (let d = 0.6; d <= len; d += step) {
    b.events.push({
      kind: 'rocks',
      y: r2(y - d),
      blocks: [{ x: 0, w: PASSAGE_RIB_HALF_W * 2 }],
      passage: true
    })
  }
}

const bank = (b: Beat, y: number, ...specs: LeafSpec[]): void => {
  // Belt and braces on `SUB_EARLIEST`: a bill early enough to zero the crowd is
  // not a hard bank, it is a run ending with no picture of why. Enforced HERE
  // rather than at the callers because `legalise` cannot see `y`, and this is
  // the one funnel every bank in the game goes through — including the
  // hand-authored stages, which is exactly where a future edit would forget.
  const placed = y > b.arenaY * SUB_EARLIEST
    ? specs
    : specs.map((s) => (s.op === 'sub' ? add(gateAddBase(b.stage)) : s))
  const offers = legalise(b, placed.slice(0, 3))
  const triple = offers.length >= 3

  // One pillar per gap between doors. The PAINTED widths tile the lane exactly
  // (`GATE_LEAF_X − GATE_LEAF_HALF === DIVIDER_HALF_W`), but every contact test
  // adds `UNIT_R` on top, so a pillar actually reaches 0.3 into each leaf beside
  // it: on a two-leaf bank the usable strip is [0.55, 4.35] and the safe aiming
  // band is [2.20, 2.70], half a unit wide around the painted centre at 2.30.
  // On a three-leaf bank the pillars at ±1.58 reach to ±[1.03, 2.13], leaving
  // [2.13, 3.99] for an outer door — 1.86 wide, which is exactly twice
  // `funnelRadius(GATE3_LEAF_HALF)`. Reason about the CONTACT widths here, not
  // the drawn ones: doing it the other way round is what made `MIN_RUN_GAP` too
  // small the first time.
  const xs: readonly number[] = triple
    ? [-GATE3_LEAF_X, 0, GATE3_LEAF_X]
    : [-GATE_LEAF_X, GATE_LEAF_X]
  const halfW = triple ? GATE3_LEAF_HALF : GATE_LEAF_HALF

  b.bigDivLast = offers.some(isBigTrap)
  b.mulLast = offers.some((s) => s.op === 'mul')
  const trapped = offers.some((s) => s.op === 'div')
  b.routingNext = offers.some((s) => s.op === 'add')
  b.trapPlaced = b.trapPlaced || trapped
  b.trapStreak = trapped ? b.trapStreak + 1 : 0
  if (triple) {
    b.triplesLeft--
    b.triplesPlaced++
  }

  // Where a coin trail into this bank may point. "Worst" is the trap when there
  // is one and the meanest offer otherwise, so a lying trail on a trap-free
  // bank costs the player a bad deal rather than a run.
  let bestI = 0
  let worstI = 0
  for (let i = 1; i < offers.length; i++) {
    if (offerScore(b.stage, offers[i]!) > offerScore(b.stage, offers[bestI]!)) bestI = i
    if (offerScore(b.stage, offers[i]!) < offerScore(b.stage, offers[worstI]!)) worstI = i
  }
  b.trailGoodX = xs[bestI] ?? 0
  b.trailBadX = xs[worstI] ?? 0

  b.events.push({
    kind: 'gates',
    y: r2(y),
    leaves: offers.map((s, i) => ({ x: xs[i] ?? 0, halfW, op: s.op, value: s.value })),
    dividers: triple ? [-GATE3_DIVIDER_X, GATE3_DIVIDER_X] : [0]
  })

  // ── Does this one get walled? ──
  //
  // Counted over every bank but only ever SPENT on a two-leaf one, so a stage
  // full of triples does not quietly stop printing passages — the counter keeps
  // running and the next two-leaf bank pays it.
  b.passageIn--
  if (!triple && b.stage >= PASSAGE_STAGE && b.passageIn <= 0 && y > b.arenaY * 0.18) {
    passage(b, y, y - b.lastY)
    b.passageIn = PASSAGE_EVERY_MIN
      + Math.floor(b.rng() * (PASSAGE_EVERY_MAX - PASSAGE_EVERY_MIN + 1))
  }
  b.lastY = y
}

/**
 * The first gate of the game: ONE doorway, the full width of the lane.
 *
 * Not a bank, and deliberately not a choice. The opening gate has exactly one
 * job — teach that running through a gate turns into people — and every extra
 * idea layered onto it costs a first-time player something:
 *
 *   • two leaves with a pillar between them punishes a rule nobody has been
 *     shown yet, eats the crowd's bullets so the gate never even pumps, and
 *     leaves a three-strong squad walking into stage 1's first pack unchanged;
 *   • two leaves with NO pillar is worse: the centre line collects BOTH, so the
 *     game's opening move teaches the exact habit that the second bank kills
 *     you for. (Measured — the balance harness caught a stage where a careless
 *     centre-runner out-built a player who committed to a side.)
 *
 * One wide door has neither problem. The choice arrives at the second bank,
 * with a pillar, once there are survivors to lose and a reason to care.
 */
const soloGate = (b: Beat, y: number, value: number): void => {
  b.events.push({
    kind: 'gates',
    y: r2(y),
    leaves: [{ x: 0, halfW: LANE_HALF, op: 'add', value }],
    dividers: []
  })
}

/**
 * May this bank offer a multiplier?
 *
 * Two gates, and both are design rather than balance: the stage has to be able
 * to AFFORD it (`mulLeaves`, minus the one leaf held back for the closing bank
 * — which is why the threshold is 2 rather than 1), and the crowd has to be big
 * enough for the question to have two answers (`MUL_EARLIEST`).
 */
/**
 * May this bank carry a multiplier?
 *
 * `!b.mulLast` is the load-bearing clause and it was missing. Two multiplier
 * banks in a row is the single most degenerate shape the generator can print:
 * `×2` then `×2` is a quadruple for a player who simply aimed twice, no read
 * required, and it hands perfect play an exponent the difficulty curve was
 * never priced against. Spacing them means a multiplier always lands on a crowd
 * the player had to keep alive through something else first, which is the only
 * thing that makes "worth the most to a big crowd" a decision rather than a
 * reward for existing.
 */
const canMul = (b: Beat, y: number): boolean =>
  b.mulLeft >= 2 && !b.mulLast && y > b.arenaY * MUL_EARLIEST

/**
 * May this bank carry a trap?
 *
 * The streak cap (never a third in a row), the "not yet" zone at the top of the
 * road (`TRAP_EARLIEST`) and the odds themselves, in one place — so the two
 * callers that build traps, `rollBank` and `rollTriple`, cannot drift apart.
 */
const canTrap = (b: Beat, y: number): boolean =>
  b.trapStreak < 2 && y > b.arenaY * TRAP_EARLIEST

/** …and whether the stage's one `×3` is still available to a bank of this kind.
 *  The biggest multiplier on a stage belongs to its WIDEST bank: while a triple
 *  is still owed, a two-leaf bank may only ask for a `×2`. */
const canMulThree = (b: Beat, wide: boolean): boolean =>
  b.mulThreeLeft >= 1 && (wide || b.triplesLeft <= b.tripleReserve)

/**
 * A three-leaf bank: three doors, three genuinely different answers.
 *
 * The shape is always the same three ROLES, because that is what makes ranking
 * them a skill rather than a reading test:
 *
 *   • the BIG one — a `×N` when the stage can afford one, a fat pumpable `+N`
 *     otherwise. Worth the most, costs the most to reach, and on a `×N` it is
 *     only worth the most if the run has actually built something;
 *   • the MODEST one — an ordinary `+N`. Never wrong, never exciting;
 *   • the WORST one — a trap, or (when the trap streak is spent) small change.
 *
 * A bank must always be able to say two different KINDS of thing, so a triple
 * that can afford neither a multiplier nor a trap is not built at all — three
 * `add` leaves is a reading test, not a decision, and the caller falls back to
 * an ordinary two-leaf bank.
 *
 * Which role stands in the CENTRE is the beat's real content. The centre door
 * is the only one in the game with no pillar in front of it, so a player who
 * does nothing rolls into it: it gets the modest offer most of the time (doing
 * nothing is a survivable answer, never a good one), the worst offer often
 * enough that drifting is never free, and the best offer just often enough that
 * "never take the middle" is not a rule anyone can learn.
 */
const rollTriple = (b: Beat, y: number): boolean => {
  const base = gateAddBase(b.stage)
  const big = canMul(b, y)
  const mayTrap = canTrap(b, y)
  if (!big && !mayTrap) return false

  // Trap-carrying more often than not: three doors is where a `÷N` reads
  // cleanest, because the two offers beside it are visibly, differently better.
  const trap = mayTrap && (!big || b.rng() < 0.6)

  const best = big
    ? mul(canMulThree(b, true) && b.rng() < 0.5 ? 3 : 2)
    : add(base + 8 + Math.floor(b.rng() * 4))
  // When the big door is a multiplier the modest one is an ordinary bank's
  // offer — "take the sure thing" against "take the greedy thing". When it is
  // an `add`, the two have to be far enough apart to be different QUESTIONS:
  // a fat leaf worth standing in the open to pump, against a thin one that is
  // simply on the way. Six units of `+N` apart is a shrug; half is a decision.
  const modest = big
    ? add(base + Math.floor(b.rng() * 3))
    : add(Math.max(2, Math.round(base * 0.55)))
  const worst = trap
    ? rollDiv(b)
    : add(Math.max(1, Math.round(base * 0.4)))

  const roll = b.rng()
  const centre = roll < 0.55 ? modest : roll < 0.85 ? worst : best
  const rest = [best, modest, worst].filter((s) => s !== centre)
  const flip = b.rng() < 0.5
  bank(b, y, flip ? rest[0]! : rest[1]!, centre, flip ? rest[1]! : rest[0]!)
  return true
}

/**
 * Roll a bank for a procedural stage.
 *
 * Alternates between the two question types (`b.routingNext`) so a stage never
 * turns into ten identical "pump the bigger number" beats, folds the trap odds
 * in from `trapChance`, and spikes into a three-leaf bank on the rare beats the
 * stage has budget for.
 */
const rollBank = (b: Beat, y: number): void => {
  const base = gateAddBase(b.stage)

  // A stage that has met three-leaf banks must actually SHOW the player one —
  // a spike that a bad roll can skip is a mechanic half the players never see.
  // From `CLOSING_TRIPLE_STAGE` the last bank on the road is one anyway, so the
  // guarantee only has to cover the five stages before that.
  const tripleDue =
    b.stage < CLOSING_TRIPLE_STAGE && b.triplesPlaced === 0 && y > b.arenaY * 0.5
  if (
    b.triplesLeft > b.tripleReserve &&
    (tripleDue || b.rng() < tripleChance(b.stage)) &&
    rollTriple(b, y)
  ) {
    return
  }

  // A stage past the tutorial must contain at least one trap, or the pillar
  // between the leaves never had a reason to be there. Once the second half of
  // the stage arrives with none rolled, the next bank is one.
  const overdue = b.stage >= 6 && !b.trapPlaced && y > b.arenaY * 0.55
  const trap = canTrap(b, y) && (overdue || b.rng() < trapChance(b.stage))
  const side = b.rng() < 0.5

  // ── The dilemma: `÷N` against `-N`, no good answer ──
  //
  // Rationed by `legalise` (one a stage, never back to back), and kept out of
  // the run-in to the boss here, because losing a third of the crowd four
  // seconds before the climax is a stage that decided itself. The two doors are
  // deliberately different KINDS of cost: the trap takes a fraction, the
  // subtraction takes a count, so the right answer flips depending on how big
  // the crowd already is — which is the only way a bank with two bad doors can
  // be a decision instead of a tax.
  // `canTrap` gates it as well as the dilemma budget: half of this bank IS a
  // trap, so it has to obey the trap spacing rules or a stage can print three
  // ÷N banks in a row through the back door.
  if (
    b.dilemmaLeft > 0 && !b.dilemmaLast && b.stage >= 4 && canTrap(b, y) &&
    y > b.arenaY * 0.3 && y < b.arenaY * 0.8 &&
    b.rng() < dilemmaChance(b.stage)
  ) {
    const bill = sub(gateSubBase(b.stage) + Math.floor(b.rng() * 3))
    // `÷3` is the dilemma's favourite trap and the reason it was unlocked: it
    // is the value where a fraction and a count are genuinely close together,
    // so the answer flips on the crowd the player actually has instead of being
    // "obviously the ÷2" or "obviously not the ÷5". The harsher one shows up
    // late, when a crowd is big enough that even a third of it is a real loss.
    const cut = div(b.rng() < bigDivChance(b.stage) ? 5 : 3)
    bank(b, y, side ? cut : bill, side ? bill : cut)
    return
  }

  // ── The bill: `-N` beside something worth having ──
  //
  // The ordinary way to meet a subtraction. It is a routing question with a
  // twist the trap does not have — the crowd fires forward, so the leaf the
  // player is *pointing at* grows while they approach, and pointing at the good
  // one is only correct if they are going to take it.
  if (!trap && b.stage >= 3 && y > b.arenaY * SUB_EARLIEST && b.rng() < subChance(b.stage)) {
    const bill = sub(gateSubBase(b.stage) + Math.floor(b.rng() * 3))
    const good = canMul(b, y) && b.rng() < 0.35
      ? mul(canMulThree(b, false) && b.rng() < 0.3 ? 3 : 2)
      : add(base + 2 + Math.floor(b.rng() * 3))
    bank(b, y, side ? good : bill, side ? bill : good)
    return
  }

  if (b.routingNext && b.stage >= 2 && canMul(b, y)) {
    // Pure routing: nothing here rewards standing still, so the only input is
    // WHICH SIDE, taken at running speed. It needs a multiplier to exist at all
    // — an `add` leaf is pumpable by definition — so once the stage's budget is
    // spent, every remaining bank is a pumpable one.
    const good = mul(canMulThree(b, false) && b.rng() < 0.4 ? 3 : 2)
    const bad = trap ? rollDiv(b) : add(base + 1 + Math.floor(b.rng() * 3))
    bank(b, y, side ? good : bad, side ? bad : good)
    return
  }

  // A pumpable bank: one leaf climbs while you hold fire on it, the other is a
  // fixed offer. The question is how many seconds of standing in the open the
  // difference is worth.
  const pumpable = add(base + Math.floor(b.rng() * 3))
  const other = trap
    ? rollDiv(b)
    : canMul(b, y) && b.rng() < 0.45
      ? mul(canMulThree(b, false) && b.rng() < 0.35 ? 3 : 2)
      : add(base + 3 + Math.floor(b.rng() * 3))
  bank(b, y, side ? pumpable : other, side ? other : pumpable)
}

// ─── Barricades ─────────────────────────────────────────────────────────────

interface Block {
  x: number
  w: number
  hp: number
}

/** Widest contiguous span of lane no block covers. */
const widestGap = (blocks: readonly Block[]): number => {
  const sorted = [...blocks].sort((p, q) => p.x - q.x)
  let cursor = -LANE_HALF
  let best = 0
  for (const bl of sorted) {
    const left = bl.x - bl.w / 2
    if (left - cursor > best) best = left - cursor
    cursor = Math.max(cursor, bl.x + bl.w / 2)
  }
  return Math.max(best, LANE_HALF - cursor)
}

/**
 * The one promise every barricade makes: there is a way through.
 *
 * A wall that must be shot down turns the run into a queue, and a wall with a
 * needle-thin hole taxes a big crowd for being big. So rows are REPAIRED rather
 * than trusted: blocks are dropped — the one whose removal opens the most lane
 * first, ties by index so the repair is deterministic — until a crowd at full
 * size fits through. Dropping every block yields the whole lane, so this always
 * terminates.
 */
const ensureRunnable = (blocks: readonly Block[]): Block[] => {
  const out = [...blocks]
  while (out.length > 0 && widestGap(out) < MIN_RUN_GAP) {
    let bestIdx = 0
    let bestGap = -1
    for (let i = 0; i < out.length; i++) {
      const gap = widestGap(out.filter((_, j) => j !== i))
      if (gap > bestGap) {
        bestGap = gap
        bestIdx = i
      }
    }
    out.splice(bestIdx, 1)
  }
  return out
}

/** Six block-wide slots tile the lane exactly (6 × 1.5 = 9 = 2 × LANE_HALF). */
const SLOT_X: readonly number[] = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75]

const wall = (b: Beat, y: number, blocks: readonly Block[]): void => {
  const kept = ensureRunnable(blocks)
  if (kept.length === 0) return
  b.events.push({ kind: 'barricade', y: r2(y), blocks: kept.map((bl) => ({ ...bl, x: r2(bl.x) })) })
}

/**
 * A scatter of boulders, in two ranks, with a lane through them.
 *
 * The same runnability guarantee the walls get (`ensureRunnable` → at least
 * `MIN_RUN_GAP` of clear road), because a field with no line through it is not
 * a routing problem — it is a dice roll, and one the player cannot even shoot
 * their way out of. What makes it hard is that the gap in the second rank is
 * OFFSET from the gap in the first: the crowd has to commit to a line, then
 * change it, inside about a second.
 */
const boulderField = (b: Beat, y: number, count: number): void => {
  const rank = (gapStart: number, n: number): Array<{ x: number; w: number }> => {
    const out: Array<{ x: number; w: number }> = []
    for (let i = 0; i < SLOT_X.length && out.length < n; i++) {
      // THREE free slots, exactly as a barricade row leaves — 4.5 units of
      // clear road against `MIN_RUN_GAP` = 4.4. Two slots looks passable on
      // paper (3.0 units) and is not: measured, `ensureRunnable` stripped every
      // rank down to nothing and stage 8 generated zero boulders.
      if (i >= gapStart && i <= gapStart + 2) continue
      out.push({ x: SLOT_X[i]!, w: ROCK_W })
    }
    return out
  }
  const firstGap = Math.floor(b.rng() * 4)
  // Offset, and clamped to the grid: the second rank must ask a DIFFERENT
  // question, or the field is one wall drawn twice.
  const secondGap = Math.max(0, Math.min(3, firstGap + (b.rng() < 0.5 ? -2 : 2)))

  // One id for both ranks. `clearGateBands` moves a field as a body, because
  // the 3.2 units between the ranks are what make it two questions instead of
  // one double-thick wall.
  const field = b.fieldId++

  for (const [i, gap] of [firstGap, secondGap].entries()) {
    const kept = ensureRunnable(rank(gap, count).map((r) => ({ ...r, hp: 1 })))
    if (kept.length === 0) continue
    b.events.push({
      kind: 'rocks',
      y: r2(y + i * 3.2),
      blocks: kept.map((r) => ({ x: r2(r.x), w: r.w })),
      field
    })
  }
}

/**
 * A wall with a hole in it.
 *
 * The hole is always three slots wide (4.5 units, comfortably past
 * `MIN_RUN_GAP`) and its position is the whole content of the beat: a hole on
 * the far side of the lane from where the last gate left you is a real cost,
 * and a hole where you already are is a breather. Both are useful; the
 * generator alternates them by luck rather than by rule.
 */
/**
 * How many ranks deep a wall is.
 *
 * One rank is a question a run answers with DPS: two or three upgrades in, the
 * crowd erases a single row without changing line, and the "shoot it or dodge
 * it" decision quietly stops being a decision.
 *
 * A wall two or three ranks deep cannot be shot through at any sane cost — the
 * same column has to be broken two or three times over while the crowd closes —
 * so the only answer left is the gap. That is the point: depth converts a
 * damage check back into a routing one, and routing is the skill that does not
 * inflate with the shop.
 *
 * Rare early, common late: a stage-6 player still needs walls they can shoot to
 * learn that walls can be shot.
 */
const wallDepth = (b: Beat): number => {
  // Stage 12, not 6, and measured rather than guessed: at stage 6 a player has
  // barely opened the shop, and a wall they cannot shoot through is just a wall
  // — the whole premise of this hazard is that ONE rank stops mattering "once
  // you have two or three upgrades", so it must not arrive before they do. A
  // career that never takes the ×3 walled at stage 5 with the earlier gate.
  if (b.stage < 12) return 1
  const roll = b.rng()
  const deep = Math.min(0.5, 0.1 + (b.stage - 12) * 0.011)
  const triple = Math.min(0.26, 0.02 + Math.max(0, b.stage - 20) * 0.007)
  if (roll < triple) return 3
  if (roll < deep) return 2
  return 1
}

const barricadeRow = (b: Beat, y: number, count: number): void => {
  const holeStart = Math.floor(b.rng() * 4) // 0..3 → three free slots from here
  const depth = wallDepth(b)

  for (let rank = 0; rank < depth; rank++) {
    // The gap stays PUT across ranks, give or take one slot.
    //
    // Offsetting it would make a deep wall a slalom, and there is already one
    // of those (`boulderField`). A deep wall asks a different question: find the
    // lane, commit to it early, and hold it — the jitter is what stops the lane
    // being a straight tunnel the player can aim at from ten units back.
    const jitter = rank === 0 ? 0 : (b.rng() < 0.5 ? -1 : 1) * (b.rng() < 0.45 ? 1 : 0)
    const start = Math.max(0, Math.min(3, holeStart + jitter))
    const blocks: Block[] = []
    const order: number[] = []
    for (let i = 0; i < SLOT_X.length; i++) if (i < start || i > start + 2) order.push(i)
    for (const idx of order.slice(0, Math.max(1, count))) {
      blocks.push({
        x: SLOT_X[idx]!,
        w: BARRICADE_W,
        // Back ranks are cheaper per block. The DEPTH is the cost; making each
        // rank full price as well would turn a wall into a stage-ender rather
        // than a detour.
        hp: Math.max(6, Math.round(
          barricadeHp(b.stage) * (0.8 + b.rng() * 0.45) * (rank === 0 ? 1 : 0.72)
        ))
      })
    }
    wall(b, y + rank * 1.7, blocks)
  }
}

// ─── Arrangements ───────────────────────────────────────────────────────────
//
// Named beats, each one asking the player a different question. They are the
// vocabulary the hand-shaped stages are written in and the procedural body
// rolls between.

export type Hazard = 'pack' | 'wall' | 'chicane' | 'gauntlet' | 'pincer' | 'swarmWall' | 'boulders'

/**
 * Hazards come in two families and a stage strictly alternates between them:
 * something to SHOOT, then something to DODGE, then something to shoot.
 *
 * Left to pure weights, a stage happily rolls four walls in a row and turns
 * into an obstacle course with no enemies in it — which is a different game,
 * and a worse one. The alternation is what keeps both verbs in play, and it is
 * the same rhythm the hand-shaped stages are written in.
 */
const BODY_HAZARDS: readonly Hazard[] = ['pack', 'pincer', 'swarmWall']
const STRUCTURE_HAZARDS: readonly Hazard[] = ['wall', 'chicane', 'gauntlet', 'boulders']

const weightedHazard = (
  rng: () => number,
  w: Record<Hazard, number>,
  from: readonly Hazard[],
  avoid: Hazard | ''
): Hazard => {
  let total = 0
  for (const k of from) total += k === avoid ? 0 : w[k]
  // Everything in the family is either weightless (not unlocked yet) or the
  // thing we just did — fall back to the family's baseline rather than nothing.
  if (total <= 0) return from[0]!
  let roll = rng() * total
  for (const k of from) {
    if (k === avoid) continue
    roll -= w[k]
    if (roll <= 0 && w[k] > 0) return k
  }
  return from[0]!
}

/** An archetype that is not the one the last beat used, when the roster allows. */
const pickFoe = (b: Beat, roster: readonly string[]): string => {
  const first = pick(b.rng, roster)
  const chosen = first === b.lastFoe && roster.length > 1 ? pick(b.rng, roster.filter((id) => id !== b.lastFoe)) : first
  b.lastFoe = chosen
  return chosen
}

/** Bodies in the lane. `spread` is the half-width they are dealt across. */
const pack = (b: Beat, y: number, typeId: string, count: number, spread: number): void => {
  // Every mob beat in the game funnels through here — `horde` and `pincer` both
  // call it — so the opening stages' thinning is applied once, at the only place
  // it cannot be forgotten by a beat written later.
  const thinned = Math.min(
    earlyPackCap(b.stage),
    Math.round(count * earlyPackMul(b.stage))
  )
  b.events.push({
    kind: 'foes',
    y: r2(y),
    typeId,
    count: Math.max(1, Math.round(thinned)),
    spread: r2(Math.min(LANE_HALF - 0.5, spread))
  })
}

/**
 * PINCER — foes on both shoulders, nothing in the middle.
 *
 * Asks: *can you hold the centre?* The safe line is the one place the crowd is
 * pinched from two sides at once, and the answer is usually "shoot one side
 * down and drift into the hole it leaves". Two bodies per event (`count: 2`
 * deals exactly one to each end of `spread`) is what keeps the middle empty.
 */
const pincer = (b: Beat, y: number, typeId: string, waves: number): void => {
  for (let i = 0; i < waves; i++) {
    // Each wave lands closer to the centre than the last, so the safe channel
    // narrows while the player is still shooting the first one down.
    pack(b, y + i * 3.4, typeId, 2, 3.9 - i * 0.7)
    pack(b, y + i * 3.4 + 1.2, typeId, 2, 3.5 - i * 0.7)
  }
}

/**
 * CHICANE — two half-walls, staggered.
 *
 * Asks: *can you plan two moves ahead?* The first row seals one half of the
 * lane and the second seals the other, so the only line through is an S. A
 * player who takes the first gap late is already on the wrong side of the
 * second, which is exactly the mistake the beat exists to charge for.
 */
const chicane = (b: Beat, y: number, flip: boolean): void => {
  const hp = () => Math.max(6, Math.round(barricadeHp(b.stage) * (0.75 + b.rng() * 0.4)))
  const leftHalf = [0, 1, 2].map((i) => ({ x: SLOT_X[i]!, w: BARRICADE_W, hp: hp() }))
  const rightHalf = [3, 4, 5].map((i) => ({ x: SLOT_X[i]!, w: BARRICADE_W, hp: hp() }))
  wall(b, y, flip ? rightHalf : leftHalf)
  wall(b, y + 6.5, flip ? leftHalf.map((bl) => ({ ...bl, hp: hp() })) : rightHalf.map((bl) => ({ ...bl, hp: hp() })))
}

/**
 * GAUNTLET — two rails and a coin trail down the middle.
 *
 * Asks: *how much do you trust the centre?* The rails leave a 4.2-unit channel
 * — enough for the crowd, not enough to wander — and the coins pay you to run
 * it straight. It is the one beat that TEACHES the centre line, which is why
 * the stages that use it put a gate bank (whose pillar is dead centre) right
 * after: the habit it builds is the habit the next beat punishes.
 */
const gauntlet = (b: Beat, y: number, rows: number): void => {
  const railHp = Math.max(6, Math.round(barricadeHp(b.stage) * 1.15))
  for (let i = 0; i < rows; i++) {
    wall(b, y + i * 4.6, [
      { x: -2.75, w: 1.3, hp: railHp },
      { x: 2.75, w: 1.3, hp: railHp }
    ])
  }
  coinTrail(b, y + 0.8, -0.4, 0.4, rows * 4, 1.15)
}

/**
 * How often a coin trail into a bank points at the leaf that is actually best.
 *
 * The trails used to lean at a leaf chosen by a coin flip, which made them
 * worthless as information: the measured coin-follower cleared 0–10 % of the
 * stages it played, and a trail that is right half the time is not a lie the
 * player can learn to read — it is noise. A trail is a CLAIM, and a claim is
 * only worth checking if it is usually true.
 *
 * So it is usually true, and less so the deeper the run goes: four trails in
 * five tell the truth on stage 6, about two in three by stage 30. That decay is
 * the late game asking the player to look at the gate rather than at the shiny
 * things, which is the same lesson stage 5's greedy trail teaches once.
 */
export const trailTruth = (stage: number): number => Math.max(0.6, 0.85 - stage * 0.008)

/** Coins. Pure dopamine — and, from stage 5, a liar (see `stageFive`). */
const coinTrail = (b: Beat, y: number, fromX: number, toX: number, n: number, step = 1.2): void => {
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1)
    xs.push(clampX(fromX + (toX - fromX) * t + Math.sin(i * 0.8) * 0.35))
    ys.push(r2(y + i * step))
  }
  b.events.push({ kind: 'coins', y: r2(y), xs, ys })
}

/**
 * A trail laid ACROSS the gap into the bank the generator has just placed.
 *
 * It has to be emitted AFTER the bank, because the whole point is that it knows
 * which door the bank considers best (`b.trailGoodX`) — the events are sorted by
 * distance at the end of `buildTrack`, so authoring order costs nothing. It is
 * also why the trail can never eat a beat of its own: it lives entirely in the
 * empty road between the last hazard (`fromY`) and the gate, and it is dropped
 * rather than squeezed if that road is too short to read.
 */
const trailInto = (b: Beat, bankY: number, fromY: number): void => {
  const to = b.rng() < trailTruth(b.stage) ? b.trailGoodX : b.trailBadX
  const step = 1.15
  const n = Math.min(8, Math.floor((bankY - 1.6 - fromY) / step))
  if (n < 4) return
  // Starts a third of the way out and curves in, so the LAST coin sits on the
  // lip of the door it is arguing for.
  coinTrail(b, bankY - 1.6 - (n - 1) * step, to * 0.35, to, n, step)
}

const crates = (
  b: Beat, y: number, kind: CrateKind, xs: readonly number[],
  fixedHp?: number, gain?: number
): void => {
  b.events.push({
    kind: 'crates',
    y: r2(y),
    crates: xs.map((x) => ({
      x: clampX(x),
      kind,
      ...(gain !== undefined ? { gain } : {}),
      // `fixedHp` opts a row out of the tier roll. Used only where the box has
      // a JOB other than being a question — the stage 1 teaching row has to
      // break for a squad of three, and a rolled 9 does not.
      hp: fixedHp !== undefined ? Math.max(1, Math.round(fixedHp)) : Math.max(1, Math.round(
        crateTierHp(b.stage, kind, crateTierFor(b.stage, b.rng()))
        * crateDepthFactor(y / Math.max(1, b.arenaY), b.stage)
        // A pickup that kills you is the worst object in the game: it is the one
        // thing the road actively invites you to drive into. See
        // `earlyCrateHpMul`.
        * earlyCrateHpMul(b.stage)
      ))
    }))
  })
}

/**
 * SPLIT PAIR — one crate on each shoulder, same y.
 *
 * Asks: *which stat is your run short of?* Taking one costs the other, because
 * the lane is nine units wide and the crowd runs at five a second.
 */
const splitPair = (b: Beat, y: number, leftKind: CrateKind, rightKind: CrateKind): void => {
  crates(b, y, leftKind, [-CRATE_DETOUR_X - 0.3])
  crates(b, y, rightKind, [CRATE_DETOUR_X + 0.3])
}

/**
 * BAIT — a rate crate parked directly behind a trap leaf.
 *
 * Asks: *what is fire rate worth to you?* The crate is the best pickup in the
 * game and the only door to it halves the crowd. For a run that is behind, the
 * trade is correct; for a run that is ahead, it is a disaster — so the same
 * arrangement gives two different players two different right answers, which is
 * as close to dynamic difficulty as a deterministic track gets.
 */
const bait = (b: Beat, y: number, trapOnRight: boolean): void => {
  // The good leaf is jittered so a stage that rolls three baits does not print
  // the same bank three times — the arrangement should be recognisable, the
  // offer should not be memorised.
  const good = add(gateAddBase(b.stage) + 1 + Math.floor(b.rng() * 4))
  bank(b, y, trapOnRight ? good : div(2), trapOnRight ? div(2) : good)
  const side = trapOnRight ? GATE_LEAF_X : -GATE_LEAF_X
  crates(b, y + 6, 'rate', [side])
  // A short trail INTO the trap, because a bait nobody notices is just a crate.
  coinTrail(b, y + 2.2, side * 0.55, side, 3, 1.3)
}

/** One elite body, announced in the HUD, worth real coins. */
const miniboss = (b: Beat, y: number, rank: MinibossRank): void => {
  const roster = foeRoster(b.stage)
  const second = rank === 'second'
  // Brute if the stage has one (a wall of HP to shoot down), hound otherwise (a
  // sprint at your line). Early stages get whatever the heaviest body is — and
  // the light early elite is always a hound where one exists, because a 28 %
  // landmark should make the player MOVE rather than stand and grind.
  const typeId = rank !== 'early' && rank !== 'tutorial' && roster.includes('brute') && (second || b.stage >= 8)
    ? 'brute'
    : roster.includes('hound')
      ? 'hound'
      : roster.includes('brute')
        ? 'brute'
        : (roster[roster.length - 1] ?? 'creep')
  b.events.push({
    kind: 'miniboss',
    y: r2(y),
    typeId,
    hpScale: minibossHpScale(b.stage, typeId, second, rank)
  })
}

// ─── The hand-shaped stages ─────────────────────────────────────────────────
//
// Stages 1–5 are authored, not rolled. The first three minutes of a runner
// decide whether anyone plays the fourth, and "seeded random" is not a good
// enough teacher: each of these stages introduces exactly one idea, gives the
// player a beat to use it, and only then charges them for it.
//
// They are written against the knobs above (`gateAddBase(stage)`, not literal
// gate values) so a balance pass moves the hand-shaped stages too.

/**
 * STAGE 1 — the road.
 *
 * Teaching, and nothing else. One identical-leaf bank (the ONLY one in the
 * game) so the first commitment cannot be wrong while still killing anyone who
 * straddles the pillar; a crate dead ahead so "shoot the box" is discovered
 * rather than explained; three creeps; one honest wall.
 *
 * Deliberate deviation from the brief: TWO rate crates, not one. Fire rate
 * starts at 1.9 shots/s and every later stage guarantees three — stage 1
 * teaching a scarcity that does not exist would be a lie the player pays for on
 * stage 2.
 */
const stageOne = (b: Beat): void => {
  // A clear opening. Nothing at all for fifteen units: a crowd runner has to let
  // the player notice the crowd follows their thumb before it asks for anything.
  soloGate(b, 15, 2)

  // ── The first pickup in the game, and the one lesson it has to land ──
  //
  // A crate is an obstacle that becomes a reward if you shoot it. Players who
  // only ever meet the first half of that sentence learn "boxes are obstacles"
  // and spend the rest of the run steering around the best pickups in the game.
  //
  // A single box at x=0 taught that lesson badly, in two different ways at once:
  // steer around it and nothing happens at all, or clip its corner and the only
  // thing a box ever did to you was cost you people. Neither outcome contains
  // the reward, and both are one thumb-width away from the version that does.
  //
  // So the first one is not a box, it is a WALL of boxes — the full width of the
  // road, with no way past it. Wherever the player happens to be standing they
  // are already shooting one, and the squad auto-fires, so the reward arrives
  // whether or not they understood that it was on offer. That is the point: this
  // beat is not asking a question, it is delivering an answer.
  //
  // Pinned to 1 HP, deliberately. A rolled stage-1 rate crate is 9 HP, which a
  // starting squad of three cannot clear before it arrives — so the box that was
  // meant to teach "shoot it" would instead demonstrate "it costs you people".
  // At 1 HP the wall shatters on contact with the first volley, which is the
  // reading the whole beat exists to produce.
  coinTrail(b, 19, 0, 0, 5, 1.4)
  crates(b, 27, 'rate', TUTORIAL_CRATE_WALL, 1, TUTORIAL_WALL_RATE_EACH)

  // ── The second pickup: the lesson being cashed in ──
  //
  // Authored, rather than left to the supply floor. Stage 1 only writes one
  // damage crate itself (at 70), so `ensureSupplies` used to drop the second one
  // blind at 30 % of the road — which put a full-priced 7 HP box out on the far
  // shoulder a couple of seconds behind the wall. The player had just learned
  // that boxes are worth having, went for it, and could not break it: the beat
  // after "boxes make you stronger" was "…but not strong enough".
  //
  // So it is placed as the answer to the wall rather than as supply. A gentle
  // step off the line instead of a lunge at the rail, far enough back to line up
  // and shoot, and priced at 4 so a squad that has just cleared the wall takes
  // it comfortably. The detour is the lesson; the box is not the test.
  crates(b, 35, 'damage', [-SECOND_PICKUP_X], SECOND_PICKUP_HP)

  pack(b, 39, 'creep', 3, 2.4)

  // Coins that mean something: they run straight into the wall's gap.
  coinTrail(b, 57, -1.4, -1.9, 7, 1.25)
  wall(b, 62, [
    { x: 1.05, w: BARRICADE_W, hp: barricadeHp(1) },
    { x: 2.85, w: BARRICADE_W, hp: barricadeHp(1) }
  ])

  // A second gate at the halfway mark. The stage used to run from the opening
  // solo gate at 15 all the way to 84 with no bank in between — thirteen
  // seconds in which the player is never asked to choose anything, on the one
  // stage whose whole job is teaching them that choosing is the game.
  // `+9` against `x2`, and which one is right depends on how the player has
  // played the last thirty seconds. A `+N` beside a bigger `+N` is not a
  // question — it is arithmetic with one right answer, and it was the shape of
  // the opening bank on every early stage. Against a multiplier the answer moves
  // with the crowd: below nine survivors the flat number wins, above it the
  // double does, and the player who cleared the wall is in a different position
  // from the player who drove round it.
  bank(b, 47, add(gateAddBase(1) + 6), mul(2))

  // First real ask: the crate is off the line, and the line is safe.
  crates(b, 70, 'damage', [CRATE_DETOUR_X])

  // First bank with two different offers. Nothing threatens it — the lesson is
  // "the leaves are not the same", not "you were too slow".
  //
  // It sits at 78 rather than 84 because the road is 101 units now, not 125:
  // the stage was re-cut to ~30 s and its closing beats used to be authored at
  // 96, 102 and 108 — past `arenaY` entirely, so the player never met them and
  // the last thing on the stage was a bank followed by twenty units of nothing.
  // ── The swell ──
  //
  // The one moment stage 1 exists to sell, and it was missing.
  //
  // Everything before this teaches: a gate that cannot be wrong, a wall that
  // cannot be missed, a box that cannot be lost, a boss that cannot be lost to.
  // All of it is careful, and careful is not exciting — a stranger who has
  // watched their crowd creep from three to fifteen has been taught the game
  // without ever being SHOWN it. The genre's whole fantasy is the crowd
  // exploding, and stage 1 never did it once.
  //
  // So the last door before the elite is a multiplier, and BOTH leaves are good:
  // x2 against a fat add. There is deliberately no wrong answer — stage 3 owns
  // the lesson that a multiplier can be a trap, and this is not a lesson, it is
  // the trailer. The crowd roughly doubles, smashes the elite with it, and
  // carries it into the arena, which is the shot the whole stage builds to.
  //
  // It REPLACES the bank that used to sit here rather than being added after it:
  // a fourth gate this late pushed the elite off the end of the road (the
  // generator nudges elites clear of gates, and there was nowhere left to nudge
  // to — it landed at 107 on a 101-unit stage, past the arena, never fought).
  bank(b, 78, mul(2), add(gateAddBase(1) + 4))

  // …and immediately the opposite shoulder, so the reward for the right leaf is
  // a swerve back across the lane.
  crates(b, 88, 'rate', [-CRATE_DETOUR_X - 0.5])

}

/**
 * STAGE 2 — the first lie.
 *
 * Introduces `÷2` (the first thing in the game that takes something away), the
 * first miniboss, and the first pack with teeth. The trap is always opposite a
 * fat `add` and always signposted by coins running to the good side, because
 * the player has to learn what a trap LOOKS like before they can be asked to
 * spot one. No multipliers yet — stage 3 owns that lesson.
 */
const stageTwo = (b: Beat): void => {
  const base = gateAddBase(2)
  // Opening bank, and the crowd is still tiny — so here the flat number is the
  // right answer and the multiplier is the trap-that-isn't. Stage 2's second
  // bank asks the same question with a big crowd and flips it (see y = 36).
  bank(b, 14, add(base + 2), mul(2))

  splitPair(b, 26, 'rate', 'damage')

  // A SECOND bank before the first husks, and the reason is measured. Stage 2
  // used to open bank → crates → four husks at y=38, and a career sim of the
  // average player died there four attempts running: always at 30 % of the road,
  // always with a peak squad of 9, always to foes plus crates. One bank takes a
  // starting squad of ~4 to ~10, and four husks carry twice a creep's health —
  // the crowd simply was not big enough yet to be allowed to meet them.
  //
  // It only cleared on the fifth attempt, when failure relief handed over a
  // bigger crowd. A stage that is beaten by the pity mechanic rather than by
  // play is a stage that reads as unfair, and it sat between two stages the same
  // player clears first try.
  // …and the same shape again, now that the crowd is worth doubling. Same two
  // ops, opposite answer: that is the lesson, and it is one a pair of `+N`s
  // cannot teach.
  bank(b, 36, add(base + 1), mul(2))

  // …and the pack itself is three husks, not four, and later. This is still the
  // stage that introduces them; it is no longer the stage that introduces them
  // to a crowd that cannot answer.
  pack(b, 48, 'husk', 3, 2.1)

  // The teaching trap: coins draw the safe line, the trap sits opposite.
  coinTrail(b, 58, -1.6, -GATE_LEAF_X, 6, 1.2)
  bank(b, 68, add(base + 3), div(2))

  barricadeRow(b, 78, 2)
  // (miniboss lands at ~55 % — see `placeMinibosses`)

  crates(b, 86, 'rate', [CRATE_DETOUR_X + 0.4])
  pincer(b, 94, 'creep', 1)

  // Two honest offers, but the bigger one is behind the pack you just walked
  // into: the value on the leaf is not the whole price of the leaf.
  // A paying pair to close on. Stage 2's extra traps are supplied by rule 4b in
  // `legalise` now, and authoring another one here put three in a row across
  // 52 / 68 / 104 — at which point the road stops being a series of decisions
  // and becomes a toll booth.
  bank(b, 104, add(base + 4), mul(2))
}

/**
 * STAGE 3 — arithmetic.
 *
 * The headline bank is `×2 | +8`: the multiplier wins only if the crowd is
 * already bigger than the add, so the SAME gate is a different decision for a
 * player who has been working the gates and one who has been dodging. That is
 * the first moment the game asks about the run rather than about the road.
 *
 * Also the first bait, the first chicane, the first gauntlet, and hounds.
 */
const stageThree = (b: Beat): void => {
  const base = gateAddBase(3)
  bank(b, 14, add(base + 2), mul(2))
  crates(b, 24, 'rate', [-CRATE_DETOUR_X - 0.4])
  pack(b, 34, 'hound', 4, 2.2)

  bait(b, 44, true)
  chicane(b, 58, false)
  // (miniboss lands at ~50 %)

  // ×2 versus a pumpable +8. Standing on the add makes it bigger; standing
  // anywhere makes the hounds closer. The coins mark the add — an HONEST trail,
  // twenty units after the bait's lying one, because "the coins are a claim"
  // only becomes a lesson if the claim is sometimes true.
  coinTrail(b, 74, 1.1, GATE_LEAF_X, 7, 1.2)
  bank(b, 84, mul(2), add(base + 4))

  splitPair(b, 96, 'damage', 'damage')
  pack(b, 106, 'husk', packSize(3), 2.8)
  gauntlet(b, 116, 2)
}

/**
 * STAGE 4 — the lazy line.
 *
 * Every beat here punishes running straight. Chicanes force a side, the
 * gauntlet trains the centre and the bank immediately after it puts a pillar
 * there, and the traps sit on whichever side the previous beat pushed the
 * player toward. First pure-routing bank (`×2 | ÷2`): nothing to pump, no way
 * to improve the offer, pick a side at full speed.
 */
const stageFour = (b: Beat): void => {
  const base = gateAddBase(4)
  bank(b, 14, add(base + 2), mul(2))

  // `true` = exits RIGHT. It used to be `false`, which walls the right half
  // last and spits the crowd out on the LEFT — with the rate crate below
  // parked 7.5 units away on the forbidden side. Measured consequence: every
  // policy collected 0 of 2 rate crates on stage 4, and stage 4 was the only
  // authored stage where a competent run finished with BOTH stats untouched.
  chicane(b, 24, true)
  // The chicane spits you out on the right; the crate is further right still.
  crates(b, 38, 'rate', [CRATE_DETOUR_X + 0.6])

  // …and the husks are waiting on the way back to the middle. The crate was
  // never free; it was just the part of the price the player could see.
  pack(b, 44, 'husk', packSize(4), 2.6)
  pincer(b, 50, 'hound', 1)

  // Pure routing. The coins before it lean toward the trap, because the lazy
  // line and the greedy line are about to become the same line.
  coinTrail(b, 56, 0.6, 1.9, 5, 1.2)
  bank(b, 64, mul(2), div(2))

  gauntlet(b, 72, 2)
  // …and the pillar of this bank sits exactly where the gauntlet just taught
  // the player to run.
  bank(b, 86, add(base + 3), mul(2))
  // (miniboss lands at ~50 %)

  splitPair(b, 94, 'damage', 'damage')

  // A wall that seals the natural approach to the fat leaf: commit early or
  // take the small one.
  wall(b, 102, [
    { x: SLOT_X[3]!, w: BARRICADE_W, hp: barricadeHp(4) },
    { x: SLOT_X[4]!, w: BARRICADE_W, hp: barricadeHp(4) }
  ])
  // ── Both doors cost ──
  //
  // The bank with no good answer, and the most interesting shape in the game:
  // `-N` against `/2`. A subtraction takes a COUNT off the top and a division
  // takes a FRACTION, so the cheaper one flips at a crowd of exactly twice the
  // bill — small crowds should halve, big crowds should pay the toll.
  //
  // It is also the one bank where the player wants to shoot NEITHER door, and
  // cannot: the crowd fires forward, both of these pump in the direction that
  // hurts, and committing early to the door you intend to take makes it worse
  // while you walk into it. The skilful line is to approach off-centre and cut
  // across late, which is a real piece of play and the exact opposite of
  // arriving at `+7 | +8`.
  bank(b, 110, sub(gateSubBase(4)), div(2))

  chicane(b, 118, true)
  // One last pack between the chicane and the crate, so the swerve for the
  // crate is made under fire rather than in an empty lane.
  pack(b, 128, 'creep', packSize(4) + 2, 3.2)
  crates(b, 134, 'rate', [-CRATE_DETOUR_X - 0.6])
}

/**
 * STAGE 5 — everything at once, and the coins start lying.
 *
 * Graduation: flyers, `×3`, bait, gauntlet, chicane, pincer — and one long,
 * fat, beautiful coin trail that curves from the safe shoulder straight into a
 * `÷2` leaf. Up to here the coins have always marked the good line, which is
 * exactly why this one works: the player is not reading the trail, they are
 * trusting it. From this stage on, every trail is a claim that has to be
 * checked against the gate it points at.
 */
const stageFive = (b: Beat): void => {
  const base = gateAddBase(5)
  bank(b, 14, add(base + 3), mul(2))
  pack(b, 24, 'flyer', 5, 3.2)

  bait(b, 34, false)
  gauntlet(b, 48, 2)

  // ── The greedy trail ────────────────────────────────────────────────────
  // Twelve coins, drifting from the safe shoulder to the trap leaf, laid so the
  // last one sits on the lip of the `÷2`. Nothing about it is different from
  // the trails on stages 1–4 except where it ends.
  coinTrail(b, 58, -2.0, GATE_LEAF_X, 12, 1.05)
  bank(b, 72, mul(3), div(2))
  // (miniboss lands at ~50 %)

  chicane(b, 92, false)
  splitPair(b, 106, 'rate', 'damage')
  pincer(b, 114, 'hound', 2)

  // A real maths bank before the run-in: ×3 is right for a run that survived
  // the trail, +N is right for one that did not. And the coins tell the TRUTH
  // this time — the stage that teaches the player to doubt a trail has to hand
  // them one worth trusting before the boss, or the lesson it just taught is
  // simply "ignore coins", which throws away the whole signalling channel.
  coinTrail(b, 120.5, -1.1, -GATE_LEAF_X, 6, 1.2)
  bank(b, 128, add(base + 6), mul(3))
  barricadeRow(b, 138, 3)
}

// ─── The procedural body (stage 6 and up) ───────────────────────────────────

/**
 * From stage 6 the player knows every idea in the game, so the stage stops
 * teaching and starts combining. The loop is the same rhythm the hand-shaped
 * stages use — hazard, supplies or coins, bank — with the arrangement drawn
 * from `hazardWeights` and every number coming from a knob.
 */
/**
 * HORDE — one big body of enemies instead of a trickle of small ones.
 *
 * The roll's `pack` is a handful at a time, and a stage made of those reads as
 * the same beat repeated at different volumes: the crowd's fire deletes the
 * front rank and the rest arrive already dead. A horde is wide enough that the
 * flanks survive the approach, so the player has to decide where to point a
 * crowd that cannot cover all of it — a different question from "can you
 * out-damage this".
 *
 * Two ranks on purpose: the second lands while the first is still being shot,
 * so the mass is felt as pressure rather than seen as a wall of sprites.
 */
const horde = (b: Beat, y: number, typeId: string, count: number): void => {
  const front = Math.ceil(count * 0.6)
  pack(b, y, typeId, front, 4.1)
  pack(b, y + 2.6, typeId, count - front, 3.2)
}

/**
 * ─── The authored middle: stages 6–15 ───────────────────────────────────────
 *
 * Stages 1–5 teach the verbs. From 6 the player knows how to play and the job
 * changes from teaching to keeping them curious — which a weighted roll cannot
 * do, because a roll produces TEXTURE rather than identity. Ten stages of "some
 * walls, some bodies, a bank" is the stretch a player quits during.
 *
 * Each of these has three things the generator never guarantees together:
 *
 *   LAYOUT   one obstacle idea the stage is actually about, not a shuffle
 *   MASS     at least one big body of enemies, not a trickle
 *   DECISION at least one bank that is a real question rather than a payout
 *
 * ── Why every position is a FRACTION ──
 *
 * These were first written with absolute distances borrowed from stages 1–5,
 * whose roads are short. Stage 9's road is 197 units and stage 14's is 242, so
 * beats authored out to y≈110 left 40–60 % of the stage empty and the gap-filler
 * papering over it. Fractions of `arenaY` place a beat at the same point in the
 * STAGE regardless of how long the stage is, which is what "a third of the way
 * in" actually means — and they keep working when the length curve is retuned.
 *
 * The body must finish clear of the closing bank at `arenaY − 12`, so nothing
 * here is authored past 0.86.
 */

/**
 * STAGE 6 — the pinch.
 *
 * LAYOUT: passages. The first stage where the road itself closes, and the rib
 * commits you to a side before you can see what is behind it.
 * MASS: a creep horde on the far side of the rib — whichever side you committed
 * to is the side you fight it from.
 * DECISION: `×2 | +N`. The multiplier wins only for a crowd that has been
 * worked, so the same door is a different answer depending on the run.
 */
const stageSix = (b: Beat): void => {
  const A = b.arenaY
  const base = gateAddBase(6)
  bank(b, 14, add(base), add(base + 2))

  crates(b, A * 0.16, 'rate', [-CRATE_DETOUR_X])
  // A rib walls the approach to this door, so the side is chosen a long way out
  // — `passage` takes the CLEAR ROAD BEHIND the bank, not a direction.
  bank(b, A * 0.26, add(base + 1), add(base + 2))
  passage(b, A * 0.26, 14)
  horde(b, A * 0.36, 'creep', packSize(6) + 3)

  coinTrail(b, A * 0.46, 1.2, GATE_LEAF_X, 6, 1.2)
  bank(b, A * 0.52, mul(2), add(base + 4))

  pincer(b, A * 0.62, 'hound', 2)
  crates(b, A * 0.72, 'damage', [CRATE_DETOUR_X + 0.4])
  bank(b, A * 0.8, add(base + 2), add(base + 4))
  passage(b, A * 0.8, 16)
}

/**
 * STAGE 7 — the rails.
 *
 * LAYOUT: gauntlets, twice, the second longer than the first. It teaches the
 * centre line and then charges for it.
 * MASS: a husk horde in the open right after the rails, so the habit the
 * gauntlet built is exactly the wrong shape for it.
 * DECISION: `+N | ÷2`, read by a coin trail that is usually honest.
 */
const stageSeven = (b: Beat): void => {
  const A = b.arenaY
  const base = gateAddBase(7)
  bank(b, 14, add(base), add(base + 2))

  gauntlet(b, A * 0.15, 2)
  horde(b, A * 0.3, 'husk', packSize(7))

  gauntlet(b, A * 0.42, 3)
  coinTrail(b, A * 0.56, -1.4, -GATE_LEAF_X, 6, 1.2)
  bank(b, A * 0.6, add(base + 4), div(2))

  crates(b, A * 0.7, 'rate', [CRATE_DETOUR_X])
  horde(b, A * 0.8, 'creep', packSize(7) + 2)
}

/**
 * STAGE 8 — the squeeze.
 *
 * LAYOUT: chicanes back to back — an S, then its mirror. None of it is
 * shootable in time; it is all line.
 * MASS: the biggest single body so far, in the gap between the two chicanes
 * where there is no room to swing wide around it.
 * DECISION: a dilemma. Both doors take something, so the question is which loss
 * the run can afford.
 */
const stageEight = (b: Beat): void => {
  const A = b.arenaY
  const base = gateAddBase(8)
  bank(b, 14, add(base + 1), add(base + 3))

  chicane(b, A * 0.15, false)
  horde(b, A * 0.3, 'creep', packSize(8) + 2)
  chicane(b, A * 0.42, true)

  bank(b, A * 0.56, sub(3), div(2))
  crates(b, A * 0.66, 'damage', [-CRATE_DETOUR_X])
  pack(b, A * 0.74, 'hound', 4, 2.4)
  barricadeRow(b, A * 0.83, 2)
}

/**
 * STAGE 9 — three doors.
 *
 * LAYOUT: boulders. Unshootable, so the stage is about where you are rather
 * than what you kill.
 * MASS: flyers, the one body type the boulders do not protect you from.
 * DECISION: the first three-leaf bank (`TRIPLE_STAGE`), and it is the headline —
 * two honest doors with a multiplier between them.
 */
const stageNine = (b: Beat): void => {
  const A = b.arenaY
  const base = gateAddBase(9)
  bank(b, 14, add(base), add(base + 2))

  boulderField(b, A * 0.16, 3)
  horde(b, A * 0.28, 'flyer', packSize(9) - 2)

  boulderField(b, A * 0.4, 4)
  bank(b, A * 0.54, add(base + 2), mul(2), add(base + 5))

  pincer(b, A * 0.64, 'husk', 2)
  crates(b, A * 0.74, 'rate', [CRATE_DETOUR_X + 0.5])
}

/**
 * STAGE 10 — heavies.
 *
 * LAYOUT: plain walls, and few of them. The stage gives the road back so the
 * bodies are the whole problem.
 * MASS: brutes — a wall of health rather than a crowd of bodies. The first time
 * the question is "do I have enough damage" instead of "can I steer".
 * DECISION: `×3 | +N`, the biggest multiplier in the game against a fat add.
 */
const stageTen = (b: Beat): void => {
  const A = b.arenaY
  const base = gateAddBase(10)
  bank(b, 14, add(base + 1), add(base + 3))

  crates(b, A * 0.14, 'damage', [0])
  pack(b, A * 0.24, 'brute', 3, 3.0)

  barricadeRow(b, A * 0.36, 2)
  coinTrail(b, A * 0.44, -1.2, -GATE_LEAF_X, 7, 1.2)
  bank(b, A * 0.5, mul(3), add(base + 6))

  horde(b, A * 0.62, 'husk', packSize(10))
  crates(b, A * 0.72, 'rate', [-CRATE_DETOUR_X - 0.4])
  pack(b, A * 0.82, 'brute', 2, 2.6)
}

/**
 * STAGE 11 — crossfire.
 *
 * LAYOUT: a gauntlet with pincers landing inside it. The rails take away the
 * room to dodge at the moment the bodies arrive from both sides.
 * MASS: hound pincers, the fastest thing in the roster, where there is nowhere
 * to go.
 * DECISION: a bait — a trap dressed as the obvious lane, with the coins lying.
 */
const stageEleven = (b: Beat): void => {
  const A = b.arenaY
  const base = gateAddBase(11)
  bank(b, 14, add(base), add(base + 3))

  gauntlet(b, A * 0.15, 3)
  pincer(b, A * 0.2, 'hound', 2)

  bait(b, A * 0.36, true)
  horde(b, A * 0.5, 'creep', packSize(11) + 4)

  bank(b, A * 0.62, add(base + 4), div(2), add(base + 1))
  crates(b, A * 0.72, 'damage', [CRATE_DETOUR_X])
  pincer(b, A * 0.8, 'flyer', 2)
}

/**
 * STAGE 12 — the maze.
 *
 * LAYOUT: passages and boulders together, so the road forks twice and neither
 * fork can be shot open. The most navigational stage in the campaign.
 * MASS: a husk horde at the exit — the reward for reading the maze is arriving
 * with a crowd big enough to answer it.
 * DECISION: a triple whose middle leaf is the trap, so the safe-looking centre
 * line is the expensive one.
 */
const stageTwelve = (b: Beat): void => {
  const A = b.arenaY
  const base = gateAddBase(12)
  bank(b, 14, add(base + 1), add(base + 2))

  // ONE rib, not two. The maze is the fork plus the boulder field; a second
  // walled approach on top of them stopped even a well-built run reaching the
  // boss, and a navigational idea repeated twice in forty units is a toll
  // rather than a puzzle.
  bank(b, A * 0.16, add(base + 1), add(base + 3))
  passage(b, A * 0.16, 15)
  boulderField(b, A * 0.28, 4)
  bank(b, A * 0.4, add(base + 2), add(base + 4))

  horde(b, A * 0.5, 'husk', packSize(12) + 2)
  bank(b, A * 0.62, add(base + 3), div(2), add(base + 4))

  pack(b, A * 0.72, 'flyer', 4, 3.4)
}

/**
 * STAGE 13 — the herd.
 *
 * LAYOUT: almost none, and that is the point. After the maze the road opens and
 * the only thing on it is bodies.
 * MASS: the largest hordes in the authored campaign, in three waves.
 * DECISION: `×2 | ×3` — no adds at all, so the question is purely how big the
 * crowd already is.
 */
const stageThirteen = (b: Beat): void => {
  const A = b.arenaY
  const base = gateAddBase(13)
  bank(b, 14, add(base + 2), add(base + 4))

  horde(b, A * 0.16, 'creep', packSize(13) + 4)
  crates(b, A * 0.28, 'rate', [CRATE_DETOUR_X])
  pack(b, A * 0.36, 'hound', 5, 3.2)

  // The bank sits between the two big bodies on purpose: the crowd that meets
  // the second horde is the one this door just built. Measured at four hordes
  // and it was the wall of the campaign — an average career failed it five
  // times running while clearing both its neighbours first try.
  bank(b, A * 0.5, mul(2), mul(3))
  horde(b, A * 0.64, 'husk', packSize(13))
  crates(b, A * 0.78, 'damage', [-CRATE_DETOUR_X])
}

/**
 * STAGE 14 — hunters.
 *
 * LAYOUT: chicane into passage into chicane. Every beat forces a side and the
 * sides alternate, so the stage is one long weave.
 * MASS: hounds in the weave — the archetype whose speed punishes exactly the
 * hesitation the layout creates.
 * DECISION: a dilemma between a subtraction and a division, right after the
 * closing weave, when the crowd is at its most fragile.
 */
const stageFourteen = (b: Beat): void => {
  const A = b.arenaY
  const base = gateAddBase(14)
  bank(b, 14, add(base + 1), add(base + 4))

  chicane(b, A * 0.14, true)
  pincer(b, A * 0.24, 'hound', 3)
  bank(b, A * 0.38, add(base + 2), add(base + 3))
  passage(b, A * 0.38, 15)

  horde(b, A * 0.48, 'flyer', packSize(14) - 3)
  bank(b, A * 0.58, add(base + 3), mul(2))

  chicane(b, A * 0.68, false)
  horde(b, A * 0.78, 'husk', packSize(14))
  bank(b, A * 0.86, sub(4), div(2))
}

/**
 * STAGE 15 — the wall.
 *
 * The end of the authored run and a summary of it: every layout idea the
 * campaign has taught, in one stage, at full size.
 *
 * LAYOUT: gauntlet, boulders, chicane, one after another with no rest between.
 * MASS: brutes AND a husk horde, so the stage asks for damage and steering in
 * the same breath.
 * DECISION: a full triple with a multiplier and a trap on the same bank.
 */
const stageFifteen = (b: Beat): void => {
  const A = b.arenaY
  const base = gateAddBase(15)
  bank(b, 14, add(base + 2), add(base + 4))

  gauntlet(b, A * 0.14, 3)
  pack(b, A * 0.26, 'brute', 3, 3.2)

  boulderField(b, A * 0.38, 4)
  horde(b, A * 0.5, 'husk', packSize(15))

  chicane(b, A * 0.62, true)
  bank(b, A * 0.72, mul(2), div(2), add(base + 6))
  pack(b, A * 0.84, 'hound', 5, 3.2)
}

// ─── Stages 16–50: motifs ───────────────────────────────────────────────────
//
// Ten authored stages is ten stages of identity and then a cliff. Past 15 the
// roll takes over, and a weighted roll produces TEXTURE rather than identity:
// every stage has some walls, some bodies and a bank, so every stage is the
// same stage at a different volume. That is precisely the stretch a player who
// has already invested twenty minutes quits during.
//
// Writing thirty-five more stages by hand is the wrong answer too — it is a lot
// of prose for content most players never reach, and it stops dead at 50.
//
// So: a MOTIF. Each stage past 15 is handed one idea it is actually about. The
// motif does two things — it injects a signature section the roll would never
// produce, and it leans the hazard weights toward its own family — while the
// generator keeps ownership of pacing, economy and the closing bank. The result
// is a stage with a shape, built by a system that does not run out.
//
// Two rules make the rotation feel authored rather than shuffled:
//
//   • Neighbours never share a motif, and the cycle is a prime-length stride
//     through the list, so the repeat period is the whole list rather than a
//     short loop the player can feel.
//   • The signature ESCALATES with depth on its own curve, so meeting `heavies`
//     again at stage 40 is meeting a bigger version, not the same one.

export type Motif =
  | 'pinch' | 'rails' | 'swarm' | 'maze' | 'heavies' | 'crossfire' | 'herd' | 'doors'

/** The rotation. Ordered so adjacent entries are as unlike each other as
 *  possible — a navigational stage never follows a navigational stage. */
const MOTIFS: readonly Motif[] = [
  'herd', 'maze', 'heavies', 'rails', 'crossfire', 'pinch', 'doors', 'swarm'
]

/**
 * The idea stage `n` is about.
 *
 * A stride of 3 through a list of 8 visits every entry before repeating any
 * (3 and 8 are coprime), so the player meets all eight motifs across stages
 * 16–23 and then meets them again in a different order. Below 16 there is no
 * motif: those stages are authored outright.
 */
export const stageMotif = (stage: number): Motif | null => {
  if (stage < 16) return null
  const i = ((stage - 16) * 3) % MOTIFS.length
  return MOTIFS[i] ?? null
}

/**
 * How hard this stage leans on its motif, 0..1.
 *
 * Climbs across the first pass through the list and then holds: by the time a
 * motif comes round a third time the stage is long enough that the signature is
 * a section rather than the whole road, and leaning harder would crowd out the
 * roll's own variety.
 */
const motifWeight = (stage: number): number =>
  Math.min(1, 0.55 + (stage - 16) * 0.02)

/**
 * Bias the hazard roll toward the motif's family.
 *
 * Multipliers, not replacements: the roll still produces everything, it just
 * produces more of what this stage is about. A stage that ONLY emitted its
 * motif would be as monotonous as no motif at all, one stage at a time.
 */
export const motifWeights = (
  stage: number,
  base: Record<Hazard, number>
): Record<Hazard, number> => {
  const m = stageMotif(stage)
  if (!m) return base
  const w = { ...base }
  const lean = 1 + motifWeight(stage) * 1.6
  const damp = 0.6

  switch (m) {
    case 'pinch':     w.boulders *= lean; w.chicane *= lean; w.pack *= damp; break
    case 'rails':     w.gauntlet *= lean * 1.3; w.wall *= lean; w.boulders *= damp; break
    case 'swarm':     w.swarmWall *= lean * 1.4; w.pack *= lean; w.gauntlet *= damp; break
    case 'maze':      w.boulders *= lean * 1.5; w.chicane *= lean; w.pack *= damp; break
    case 'heavies':   w.pack *= lean; w.wall *= damp; w.chicane *= damp; break
    case 'crossfire': w.pincer *= lean * 1.5; w.gauntlet *= lean; w.wall *= damp; break
    case 'herd':      w.pack *= lean * 1.6; w.boulders *= damp; w.chicane *= damp; break
    case 'doors':     w.wall *= lean; w.pincer *= lean; w.boulders *= damp; break
  }
  return w
}

/**
 * The signature: one section the roll would never lay down by itself.
 *
 * Written at a fixed fraction of the road rather than a fixed distance, so it
 * lands in the same place in the STAGE regardless of how long the stage is —
 * about a third in, where the crowd is built enough to have a real answer and
 * there is still road left to recover on.
 *
 * Returns the y it consumed up to, so the body can resume clear of it.
 */
export const motifSignature = (b: Beat): number => {
  const m = stageMotif(b.stage)
  if (!m) return 0

  const at = Math.max(30, b.arenaY * 0.34)
  const base = gateAddBase(b.stage)
  const size = packSize(b.stage)
  // Escalation: the same motif met again at depth is a bigger version of itself.
  const step = Math.floor((b.stage - 16) / MOTIFS.length)

  switch (m) {
    case 'pinch': {
      // The road closes twice, from opposite sides, with bodies behind the second.
      bank(b, at, add(base + 1), add(base + 3))
      passage(b, at, 15)
      bank(b, at + 22, add(base + 2), add(base + 4))
      passage(b, at + 22, 15)
      horde(b, at + 38, 'creep', size + step * 3)
      return at + 44
    }
    case 'rails': {
      // A long gauntlet, then the open road it taught you to distrust.
      gauntlet(b, at, 3 + step)
      horde(b, at + 26 + step * 5, 'husk', size)
      return at + 34 + step * 5
    }
    case 'swarm': {
      // Bodies and structure in the same breath, three times over.
      for (let i = 0; i < 2 + step; i++) {
        pack(b, at + i * 13, pickFoe(b, foeRoster(b.stage)), Math.round(size * 0.8), 3.6)
        barricadeRow(b, at + i * 13 + 6, 2)
      }
      return at + (2 + step) * 13
    }
    case 'maze': {
      // Two boulder fields with a rib between them: three ways through, one of
      // which is a dead line.
      boulderField(b, at, 4)
      bank(b, at + 16, add(base + 2), add(base + 3))
      passage(b, at + 16, 14)
      boulderField(b, at + 32, 4 + Math.min(2, step))
      return at + 44
    }
    case 'heavies': {
      // A wall of health rather than a crowd of bodies.
      pack(b, at, 'brute', 3 + step, 3.2)
      crates(b, at + 14, 'damage', [0])
      pack(b, at + 26, 'brute', 2 + step, 2.6)
      return at + 32
    }
    case 'crossfire': {
      // Pincers inside a gauntlet — bodies from both shoulders with no room to
      // dodge away from either.
      gauntlet(b, at, 3)
      pincer(b, at + 6, 'hound', 2 + Math.min(2, step))
      return at + 26
    }
    case 'herd': {
      // The biggest mass on the road, in three waves, with nothing to hide
      // behind. Purely a question about how big the crowd is.
      horde(b, at, 'creep', size + 6 + step * 4)
      horde(b, at + 18, 'husk', size + step * 3)
      horde(b, at + 34, 'hound', Math.round(size * 0.7))
      return at + 42
    }
    case 'doors': {
      // Three banks in quick succession, each a real question, with bodies
      // between them so the crowd being spent is felt at every door.
      bank(b, at, mul(2), add(base + 4))
      pack(b, at + 12, pickFoe(b, foeRoster(b.stage)), Math.round(size * 0.6), 2.8)
      bank(b, at + 24, add(base + 2), div(2), add(base + 5))
      pack(b, at + 36, 'hound', 4, 3.0)
      bank(b, at + 46, sub(3), mul(2))
      return at + 52
    }
  }
  return 0
}

const proceduralBody = (b: Beat): void => {
  const roster = foeRoster(b.stage)
  // Past 15 the stage is ABOUT something (see `stageMotif`): the weights lean
  // toward its family so the texture matches the signature it is going to be
  // handed, rather than the signature arriving as an unrelated interruption.
  const weights = motifWeights(b.stage, hazardWeights(b.stage))
  b.y = 14

  // Open on a bank, always. The first thing a stage says should be "choose".
  rollBank(b, b.y)
  b.y += 4

  // The signature section, written before the body fills in around it. It sits
  // about a third of the way down the road; the loop below simply skips past
  // whatever it consumed, so the motif never lands on top of a rolled beat.
  const signatureEnd = motifSignature(b)

  // The closing bank is written at `arenaY − 12` by `buildTrack`, so the body
  // has to stop well clear of it: two banks a few units apart are one unreadable
  // smear of numbers, and the run-in to the boss belongs to the last decision.
  const lastBankY = b.arenaY - 26
  let bodiesNext = true

  while (b.y < lastBankY) {
    b.y += beatGap(b.stage, b.rng())
    // Step over the motif's section in one move rather than trying to thread
    // beats through it — a rolled wall inside a boulder maze is not variety, it
    // is the two ideas cancelling each other out.
    if (signatureEnd > 0 && b.y > signatureEnd - 14 && b.y < signatureEnd) {
      b.y = signatureEnd + beatGap(b.stage, b.rng())
    }
    if (b.y >= lastBankY - 6) break

    // Bodies first: a stage should be shooting something inside its first few
    // seconds, whatever the weights feel like doing afterwards.
    const family = bodiesNext ? BODY_HAZARDS : STRUCTURE_HAZARDS
    const hazard: Hazard = weightedHazard(
      b.rng,
      weights,
      family,
      bodiesNext ? b.lastBody : b.lastStructure
    )
    if (bodiesNext) b.lastBody = hazard
    else b.lastStructure = hazard
    bodiesNext = !bodiesNext

    switch (hazard) {
      case 'wall':
        barricadeRow(b, b.y, 2 + Math.floor(b.rng() * 2))
        break

      case 'chicane':
        chicane(b, b.y, b.rng() < 0.5)
        b.y += 8
        break

      case 'gauntlet':
        gauntlet(b, b.y, 2)
        b.y += 9
        break

      case 'boulders':
        boulderField(b, b.y, 3 + (b.rng() < 0.45 ? 1 : 0))
        // Two ranks 3.2 apart, plus room to be back on a line before whatever
        // comes next — a slalom that runs straight into a gate bank is a bank
        // nobody got to read.
        b.y += 9
        break

      case 'pincer':
        pincer(b, b.y, pickFoe(b, roster), 1 + (b.rng() < 0.4 ? 1 : 0))
        b.y += 5
        break

      case 'swarmWall':
        // Something to shoot AND something to dodge, in the same breath.
        pack(b, b.y, pickFoe(b, roster), Math.round(packSize(b.stage) * 0.7), 2.4)
        barricadeRow(b, b.y + 7, 2)
        b.y += 7
        break

      default:
        pack(b, b.y, pickFoe(b, roster), packSize(b.stage), 1.7 + b.rng() * 2.3)
        break
    }

    // Supplies, sometimes. The floor is guaranteed later by `ensureSupplies`;
    // this is the surplus a lucky stage gets.
    if (b.rng() < 0.5) {
      b.y += 6 + b.rng() * 3
      const kind: CrateKind = b.rng() < 0.45 ? 'rate' : 'damage'
      const side = b.rng() < 0.5 ? -1 : 1
      if (b.rng() < 0.3) splitPair(b, b.y, 'damage', 'rate')
      else crates(b, b.y, kind, [side * (CRATE_DETOUR_X + b.rng() * 1.2)])
    }

    // Bait beats replace an ordinary bank now and then — the trap and the prize
    // arrive together, which is the meanest legal shape.
    const from = b.y
    b.y += 9 + b.rng() * 4
    if (b.y > lastBankY) break
    // …but a bait IS a trap, so it obeys the same streak cap and the same "not
    // in the first tenth of the road" rule as a rolled one, and it brings its
    // own (always lying) trail.
    if (b.stage >= 7 && canTrap(b, b.y) && b.rng() < 0.22) {
      bait(b, b.y, b.rng() < 0.5)
      b.y += 8
    } else {
      rollBank(b, b.y)
      // Coins: still dopamine, now also a claim about the bank they run into —
      // usually true, occasionally not (`trailTruth`). Laid across the gap TO
      // the bank rather than eating a beat of their own.
      if (b.rng() < 0.55) trailInto(b, b.y, from)
    }
  }
}

// ─── Guarantees ─────────────────────────────────────────────────────────────

/** Push `y` clear of anything the player has to react to precisely. */
/**
 * Minimum clear distance between two crates, in world units.
 *
 * A crate is `CRATE_R * 2` across, so anything under about two units is two
 * boxes drawn on top of each other: the player sees one prop, shoots it, and a
 * second identical prop is still standing behind it with its own health bar.
 * Reported from stage 5, where a topped-up damage crate landed 0.33 units from
 * an authored one.
 */
const CRATE_CLEAR = 2.4

/**
 * Walk `y` forward until a crate placed at `x` would not sit on an existing one.
 *
 * `nudgeClear` below deliberately only avoids gates, barricades and elites —
 * the beats whose approach must stay readable — and a crate is allowed to share
 * a stretch of road with them. But nothing was keeping crates clear of EACH
 * OTHER, and the supply top-up is placed blind at fixed fractions of the road,
 * so it could drop a box exactly where an authored one already was.
 *
 * Checked in two dimensions on purpose: two crates at the same `y` on opposite
 * shoulders are a row, which is a shape the game uses all the time. It is only
 * a clash when they are close on BOTH axes.
 */
const nudgeClearOfCrates = (b: Beat, y: number, x: number): number => {
  let out = y
  for (let guard = 0; guard < 40; guard++) {
    const clash = b.events.some((e) => {
      if (e.kind !== 'crates') return false
      // A row that spans the road is not a crate, it is a WALL, and the player
      // has to break it before they can read anything behind it. The clearance
      // therefore scales with how much of the road the row occupies.
      //
      // This is the stage 1 teaching wall's problem specifically: the supply
      // top-up's first slot lands at 30 % of the road, the wall sits at 27 of
      // 101, and 3.3 units of gap passed the flat check. So the beat that exists
      // to prove a box is a reward was followed, immediately, by a full-priced
      // box that kills — "I shot them and got paid, then the next one killed
      // me", which teaches the exact lesson the wall was built to undo.
      const wide = e.crates.length >= 4
      const clear = wide ? CRATE_CLEAR * 3 : CRATE_CLEAR
      if (Math.abs(e.y - out) >= clear) return false
      // A wall blocks every lane, so a following box clashes with it wherever
      // that box sits — the x test only makes sense for a row you can go around.
      return wide || e.crates.some((c) => Math.hypot(c.x - x, e.y - out) < clear)
    })
    if (!clash) return r2(out)
    out += 2
  }
  return r2(out)
}

// ─── The road a bank owns ───────────────────────────────────────────────────
//
// Reported from stage 12: two boulders sat just past the left leaf of a bank,
// the second one hidden behind the leaf's own curtain and number, and the run
// lost 90 % of its squad on a thing it never had the chance to see.
//
// Both halves of that are real, and they are separate faults.
//
// ── It cannot be SEEN ──
//
// The renderer draws boulders and crates before gates (see `drawScene`'s layer
// order), so a bank paints over anything sharing its stretch of road. That is
// the right order — a lethal pillar must never be occluded by scenery — but it
// means the generator is the only place that can keep the two apart.
//
// ── It cannot be AVOIDED ──
//
// Worse, and true even when the boulder is perfectly visible. The crowd goes
// through a leaf funnelled to that leaf's width and committed to its x; there
// is no steering left in the moment a door is taken. An unbreakable rock in the
// exit path is not a routing question, it is a toll — and this game already has
// a hazard for "you chose wrong", which is the pillar, and it is one the player
// can read a long way out.
//
// So a bank owns a band of road, and nothing that has to be steered around may
// stand in it. The band is deliberately NOT symmetric.

/**
 * The bank's own drawn footprint, world units either side of its `y`.
 *
 * A leaf's curtain is `1.5` units tall centred on the bank, and a divider
 * pillar is `DIVIDER_H` with steel caps past that. 0.9 clears both with a
 * margin; the obstacle's own half-depth is added separately, so the two bodies
 * are measured edge to edge rather than centre to centre.
 */
export const GATE_ART_HALF = 0.9

/**
 * Clear road on the APPROACH, in seconds of travel.
 *
 * The player is reading the bank here — three numbers, their colours, which
 * pillar is lit — and that is the most expensive read in the game. Something
 * they also have to steer around, in the same instant, in the same place, is
 * two demands on one second.
 */
export const GATE_CLEAR_APPROACH_S = 0.45

/**
 * Clear road on the EXIT, in seconds of travel. Longer than the approach, and
 * that asymmetry is the whole point.
 *
 * On the way in the crowd is wide, spread and steerable. On the way out it is
 * funnelled to a leaf's width, pinned to that leaf's x, and has to re-spread
 * before it can go anywhere — and the player's eyes are still on the number
 * they just took. 0.75 s is a reaction plus a full-lane move at `STEER_SPRING`,
 * with the crowd's own radius on top.
 */
export const GATE_CLEAR_EXIT_S = 0.75

/**
 * A crate's band, world units, symmetric — and MUCH smaller than a boulder's.
 *
 * The two hazards are not the same complaint. A boulder cannot be shot, so
 * meeting one in a leaf's exit path is a toll with no play in it, and the band
 * has to be wide enough to give the crowd somewhere to go. A crate can always
 * be shot, and shooting it pays; the report about crates was that one drawn
 * half-behind a gate "just looks like a bug", which is a READABILITY problem
 * and stops the moment the two props do not overlap on screen.
 *
 * Sizing it like a boulder's was measured and reverted. It moved a third of
 * every crate on the road, which put boxes on top of each other and — because
 * the authored stages place their early damage crates deliberately close to the
 * first banks — cost the benchmark player stage 4 outright: it died at 25 % of
 * the road with foes as the top cause, having never picked up the damage it was
 * supposed to arrive with. A fidelity rule that quietly re-balances the game is
 * a bug of its own.
 *
 * 0.6 on top of the art's own half-extent leaves a visible gap of road between
 * the box and the leaf at every zoom.
 */
export const CRATE_BAND_PAD = 0.6

/** Half-depth of an obstacle's body, world units. */
const obstacleHalfDepth = (e: TrackEvent): number =>
  e.kind === 'rocks' ? ROCK_H / 2 : CRATE_R

/**
 * The band a bank at `y` owns, for one kind of obstacle.
 *
 * Exported so `trackShape.test.ts` asserts the invariant against the SAME
 * numbers the sweep enforces it with. A test carrying its own copy of these
 * would keep passing after someone retuned them, which is the one thing a
 * regression test for this must not do.
 */
export const gateBandFor = (
  stage: number, y: number, kind: 'rocks' | 'crates'
): [number, number] => {
  const sp = stageSpeed(stage)
  return kind === 'rocks'
    ? [y - (GATE_ART_HALF + sp * GATE_CLEAR_APPROACH_S),
       y + (GATE_ART_HALF + sp * GATE_CLEAR_EXIT_S)]
    : [y - (GATE_ART_HALF + CRATE_BAND_PAD), y + (GATE_ART_HALF + CRATE_BAND_PAD)]
}

/**
 * Placed this far OUTSIDE the band rather than flush against it.
 *
 * Every `y` on a road is snapped to two decimals by `r2`, so an obstacle parked
 * exactly on a band edge rounds back inside it half the time. Measured across
 * stages 1-200 before this existed: 473 obstacles still technically in a band,
 * every one of them by 0.005 units or less. Nobody could ever see 5 mm of world
 * space against a 1.35-unit boulder — but an invariant that is true 93 % of the
 * time is not an invariant, and `trackShape.test.ts` cannot assert it. Larger
 * than `r2`'s half-step, small enough to be nothing.
 */
const BAND_MARGIN = 0.02

/**
 * Every bank's band, merged into disjoint intervals sorted by `y`.
 *
 * Merged because banks can land within a couple of units of each other (twelve
 * such pairs across stages 1–60, the tightest 1.26 apart), and two overlapping
 * bands are one stretch of forbidden road — not two, with a sliver of "legal"
 * ground between them that is in fact inside both.
 */
const gateBands = (b: Beat, kind: 'rocks' | 'crates'): Array<[number, number]> => {
  const raw: Array<[number, number]> = []
  for (const e of b.events) {
    if (e.kind === 'gates') raw.push(gateBandFor(b.stage, e.y, kind))
  }
  raw.sort((p, q) => p[0] - q[0])
  const out: Array<[number, number]> = []
  for (const iv of raw) {
    const last = out[out.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else out.push([iv[0], iv[1]])
  }
  return out
}

/**
 * One hazard, as the player meets it: the events that have to move together.
 *
 * A boulder field is two ranks 3.2 apart with their gaps deliberately offset,
 * and the offset IS the beat — commit to a line, then change it. Moving one
 * rank out of a band and leaving the other would collapse those 3.2 units to
 * whatever the band edge happened to leave, turning two questions into one
 * double-thick wall. So a field carries an id and moves as a body.
 */
interface Obstacle {
  events: TrackEvent[]
  /** Leading and trailing edge of the whole group, body included. */
  lo: number
  hi: number
}

const obstacleGroups = (b: Beat, kind: 'rocks' | 'crates'): Obstacle[] => {
  const byField = new Map<number, TrackEvent[]>()
  const singles: TrackEvent[] = []
  for (const e of b.events) {
    if (e.kind !== kind) continue
    // A passage rib is rocks laid deliberately INTO a bank — it is the wall that
    // makes a door a corridor, it is authored to touch the gate, and the player
    // reads it as one shape with the bank. It is the one thing the band does not
    // apply to.
    if (e.kind === 'rocks' && e.passage) continue
    if (e.kind === 'rocks' && e.field !== undefined) {
      const list = byField.get(e.field)
      if (list) list.push(e)
      else byField.set(e.field, [e])
    } else {
      singles.push(e)
    }
  }
  const wrap = (events: TrackEvent[]): Obstacle => {
    let lo = Infinity
    let hi = -Infinity
    for (const e of events) {
      const half = obstacleHalfDepth(e)
      lo = Math.min(lo, e.y - half)
      hi = Math.max(hi, e.y + half)
    }
    return { events, lo, hi }
  }
  return [...byField.values(), ...singles.map((e) => [e])].map(wrap)
}

/**
 * Move one obstacle clear of every band, or leave it where it is.
 *
 * Direction is chosen ONCE, toward the nearer edge of the band the obstacle is
 * in, and then held. Re-choosing after each step is what turns two adjacent
 * bands into a trap: pushed forward out of one, the nearer edge of the next is
 * the one it just came from, and the obstacle oscillates until the guard runs
 * out and it is left exactly where it started. If the chosen side runs off the
 * road, the other one is tried before giving up.
 */
const shiftClearOfBands = (
  ob: Obstacle, bands: Array<[number, number]>, minY: number, maxY: number
): number | null => {
  const bandAt = (lo: number, hi: number): [number, number] | null => {
    for (const iv of bands) if (lo < iv[1] && hi > iv[0]) return iv
    return null
  }
  const first = bandAt(ob.lo, ob.hi)
  if (!first) return 0

  let back = ob.hi - first[0] <= first[1] - ob.lo
  for (let attempt = 0; attempt < 2; attempt++) {
    let lo = ob.lo
    let hi = ob.hi
    let ok = true
    for (let guard = 0; guard < 40; guard++) {
      const band = bandAt(lo, hi)
      if (!band) break
      const shift = back ? band[0] - hi - BAND_MARGIN : band[1] - lo + BAND_MARGIN
      lo += shift
      hi += shift
      if (lo < minY || hi > maxY) { ok = false; break }
    }
    if (ok && !bandAt(lo, hi)) return lo - ob.lo
    // The nearer side ran out of road. Try the other one before giving up.
    back = !back
  }
  return null
}

/**
 * Every crate on the road, as the spacing rule sees them.
 *
 * Two boxes on the SAME row are allowed to sit shoulder to shoulder — stage 1's
 * teaching wall is exactly that, and every box in it is separately visible and
 * separately shootable. Two boxes on DIFFERENT rows owe each other real road,
 * because there they are competing offers rather than one prop. See
 * `roadEconomy.test.ts`.
 */
const CRATE_ROW_CLEAR = 1.6

const crateRowClashes = (b: Beat, row: TrackEvent, at: number): boolean => {
  if (row.kind !== 'crates') return false
  for (const e of b.events) {
    if (e.kind !== 'crates' || e === row) continue
    if (Math.abs(e.y - at) < 0.01) continue          // a row, not a stack
    if (Math.abs(e.y - at) >= CRATE_ROW_CLEAR) continue
    for (const c of row.crates) {
      for (const o of e.crates) {
        if (Math.hypot(o.x - c.x, e.y - at) < CRATE_ROW_CLEAR) return true
      }
    }
  }
  return false
}

/**
 * Would a bank standing at `y` own something the road already has?
 *
 * The same test `clearGateBands` applies, asked the other way round. A FILLER
 * bank is not authored content — it exists to break up a long quiet stretch —
 * so when it and a hand-placed crate want the same road, the filler is the one
 * that should move.
 *
 * Stage 4 is why this exists. The filler for the 50-unit gap after the opening
 * bank landed dead centre at y=39, one unit from the rate crate the stage
 * deliberately parks past the chicane at y=38. `clearGateBands` then did its job
 * and moved the CRATE — correctly, by its own rule, and wrongly for the stage:
 * that crate is the whole reason the chicane spits the crowd out on the right,
 * and shifting it cost the benchmark run stage 4 outright. Moving the filler
 * instead leaves the authored beat exactly where its author put it.
 */
const FILLER_PACK_LEAD = 6

const bankWouldCrowd = (b: Beat, y: number): boolean => {
  const [rockLo, rockHi] = gateBandFor(b.stage, y, 'rocks')
  const [crateLo, crateHi] = gateBandFor(b.stage, y, 'crates')
  return b.events.some((e) => {
    if (e.kind === 'rocks') {
      if (e.passage) return false
      const half = ROCK_H / 2
      return e.y + half > rockLo && e.y - half < rockHi
    }
    if (e.kind === 'crates') return e.y + CRATE_R > crateLo && e.y - CRATE_R < crateHi
    // A pack waiting just past the door is the same complaint as a boulder
    // waiting just past it — the crowd comes out funnelled and committed, and
    // whatever is there is already on top of it. `MINIBOSS_LEAD` says the same
    // thing about elites at four times the distance; this is the ordinary-wave
    // version, and it only binds FILLER banks, which are pacing rather than
    // authored intent.
    if (e.kind === 'foes') {
      const lead = e.y - y
      return lead >= 0 && lead < FILLER_PACK_LEAD
    }
    return false
  })
}

/**
 * Push every boulder and crate out of every bank's band.
 *
 * Runs as a POST-PASS over the finished road rather than at each placement,
 * and that is load-bearing: banks are authored, filled in by `fillGateGaps` and
 * moved by `nudgeClear` at different points in the build, so a check made when
 * a boulder is placed cannot see the bank that arrives after it. Sweeping the
 * finished list is the only way to state the rule as an invariant — which is
 * exactly how `trackShape.test.ts` asserts it, for every stage.
 */
const clearGateBands = (b: Beat): void => {
  // Nothing may be shoved off either end of the road: before the first beat the
  // player has not started, and past the arena is the boss fight.
  const minY = 6
  const maxY = b.arenaY - 4

  for (const kind of ['rocks', 'crates'] as const) {
    const bands = gateBands(b, kind)
    if (bands.length === 0) continue
    for (const ob of obstacleGroups(b, kind)) {
      const raw = shiftClearOfBands(ob, bands, minY, maxY)
      if (raw === null || raw === 0) continue
      // Round the SHIFT, not each `y`. Rounding the ranks independently let a
      // field's 3.2-unit offset drift to 3.19, and that offset is the beat. The
      // shift is at most 0.005 off after rounding, which `BAND_MARGIN` covers.
      const shift = r2(raw)
      for (const e of ob.events) e.y = r2(e.y + shift)

      // Landing clear of the gate is not enough if it landed on another box.
      // Step along the same direction the band pushed it until the road is its
      // own, re-clearing the band each time — a crate row that has to move is
      // rare, and one that then has to move again is rarer still.
      if (ob.events[0]?.kind !== 'crates') continue
      const row = ob.events[0]
      const step = shift < 0 ? -CRATE_ROW_CLEAR : CRATE_ROW_CLEAR
      for (let guard = 0; guard < 12 && crateRowClashes(b, row, row.y); guard++) {
        const half = obstacleHalfDepth(row)
        const probe: Obstacle = {
          events: [row], lo: row.y + step - half, hi: row.y + step + half
        }
        const extra = shiftClearOfBands(probe, bands, minY, maxY)
        if (extra === null) break
        const at = r2(row.y + step + extra)
        if (at < minY || at > maxY) break
        row.y = at
      }
    }
  }
}

const nudgeClear = (b: Beat, y: number, minDist = 4.5): number => {
  let out = y
  for (let guard = 0; guard < 40; guard++) {
    const clash = b.events.some(
      (e) =>
        Math.abs(e.y - out) < minDist &&
        (e.kind === 'gates' || e.kind === 'barricade' || e.kind === 'miniboss')
    )
    if (!clash) return r2(out)
    out += 2
  }
  return r2(out)
}

/**
 * How much road a miniboss needs BEHIND it, measured back to the nearest gate
 * bank or wall.
 *
 * Clearance is not symmetric, and treating it as if it were is what made the
 * elites feel like furniture. An obstacle *ahead* of a miniboss costs nothing —
 * the player has already had the whole approach to shoot. An obstacle *behind*
 * it eats the approach itself: the player spends those seconds committing to a
 * door, and comes out of it with an elite already in their lap, closing at the
 * sum of both speeds.
 *
 * Twelve units is ~2.6 s of approach at stage speed against a brute walking the
 * other way — enough to open the fight rather than arrive inside it. Rounds now
 * pass through gates (see `resolveBullet`), so the player can start shooting
 * before the door as well; this is the half of the fix that belongs to the
 * generator rather than to the rules.
 */
const MINIBOSS_LEAD = 12

/** `nudgeClear`, with the asymmetry the elites actually need. */
const nudgeClearElite = (b: Beat, y: number): number => {
  let out = nudgeClear(b, y)
  for (let guard = 0; guard < 40; guard++) {
    const crowded = b.events.some((e) => {
      if (e.kind !== 'gates' && e.kind !== 'barricade') return false
      const gap = out - e.y
      return gap >= 0 && gap < MINIBOSS_LEAD
    })
    if (!crowded) return r2(out)
    out = nudgeClear(b, out + 2)
  }
  return r2(out)
}

/**
 * Minibosses, placed centrally rather than by hand.
 *
 * From stage 2 there is one at roughly the halfway mark, from stage 6 a second
 * at ~80 %, and from `MINIBOSS_STAGE_THIRD` a light one at ~28 %. They exist to
 * break a long stage into digestible fights: wins on the road before the boss,
 * and a wipe that costs a fraction of a stage instead of all of it.
 *
 * The third one arrives when the road does. A stage-6 run is 170 units and two
 * elites already carve it into thirds; a stage-25 run is 315 units and fifty
 * seconds, and leaving its first landmark until twenty-five seconds in is how a
 * late stage starts to feel like a corridor rather than a fight.
 */
const placeMinibosses = (b: Beat): void => {
  // STAGE 1 — exactly one elite, weakened, and the last thing on the road.
  //
  // It replaces the boss the stage used to end with. Placed at 88 % rather than
  // at the arena so the player meets it with the crowd the stage built, and so
  // there is still a beat of road after it: the stage ends on a win, not on the
  // fight itself.
  if (b.stage === 1) {
    miniboss(b, nudgeClearElite(b, b.arenaY * 0.88), 'tutorial')
    return
  }
  if (b.stage < 2) return

  // ── How many landmarks a road gets ──
  //
  // Three was the ceiling and it was reached on stage 20, so a stage-100 road —
  // 620 units, ~83 seconds — still got exactly three, spaced almost half a
  // minute apart. An elite is the thing that breaks a stage into fights; at
  // that spacing the stage stops having a shape at all.
  //
  // Past stage 40 a fourth arrives, and one more every 30 stages after that,
  // capped at six because beyond that the leash windows overlap and the road
  // becomes one continuous block. They are spread evenly across the middle of
  // the road, which is the same thing the fixed fractions below were doing by
  // hand for the first three.
  const extra = b.stage < 40 ? 0 : Math.min(3, 1 + Math.floor((b.stage - 40) / 30))

  if (b.stage >= MINIBOSS_STAGE_THIRD) {
    miniboss(b, nudgeClearElite(b, b.arenaY * (0.26 + b.rng() * 0.05)), 'early')
  }
  miniboss(b, nudgeClearElite(b, b.arenaY * (0.45 + b.rng() * 0.15)), 'first')
  if (b.stage >= 6) {
    miniboss(b, nudgeClearElite(b, b.arenaY * (0.78 + b.rng() * 0.05)), 'second')
  }
  for (let i = 0; i < extra; i++) {
    // Slotted between the authored three, alternating light and heavy so a long
    // road is not four copies of the same fight.
    const at = 0.34 + (i + 1) * (0.42 / (extra + 1)) + b.rng() * 0.03
    miniboss(b, nudgeClearElite(b, b.arenaY * at), i % 2 === 0 ? 'early' : 'first')
  }
}

/**
 * The supply floor.
 *
 * Fire rate starts at 1.9 shots/s and the ONLY way it climbs during a run is a
 * rate crate, so a stage that rolled none would be a stage the player cannot
 * fix. Anything the layout already offers counts; the rest is topped up at
 * fixed fractions of the stage, always out on a shoulder, always nudged clear
 * of a gate or a wall so the detour is a choice rather than an ambush.
 *
 * The floors themselves grow with the road — see `minRateCrates`.
 */
const ensureSupplies = (b: Beat): void => {
  const countOf = (kind: CrateKind): number =>
    b.events.reduce(
      (n, e) => (e.kind === 'crates' ? n + e.crates.filter((c) => c.kind === kind).length : n),
      0
    )

  // Deliberately not in order: a top-up should read as part of the road, and
  // four crates marching up the lane at even intervals reads as an apology.
  // Beyond the eighth the list wraps with a nudge, and `nudgeClear` walks any
  // collision forward — so the floor is always met however empty the roll was.
  const fractions = [0.3, 0.66, 0.48, 0.82, 0.2, 0.57, 0.74, 0.38]
  let slot = 0
  // The budget scales with the floors it has to satisfy, and the placement
  // fraction wraps rather than piling onto 0.88.
  //
  // Both were sized for a thirty-stage game: a flat 24 slots SHARED between the
  // two crate kinds, and `Math.min(0.88, f)` which sent every late slot to the
  // same mark. Measured on the endless road, the damage floor first went unmet
  // at stage 140 and the rate floor at 255 — the stage silently shipped without
  // the supplies its own difficulty was priced against, which is the worst
  // possible failure because the player has no way to see it.
  const budget = minRateCrates(b.stage) + minDamageCrates(b.stage) + 8
  const topUp = (kind: CrateKind, want: number): void => {
    while (countOf(kind) < want && slot < budget) {
      const lap = Math.floor(slot / fractions.length)
      // Wrap the extra laps into the gaps between the base fractions instead of
      // walking them all off the end of the road.
      const f = (fractions[slot % fractions.length] ?? 0.5) + (lap % 5) * 0.028 - (lap >= 5 ? 0.11 : 0)
      const side = slot % 2 === 0 ? -1 : 1
      const x = side * (CRATE_DETOUR_X + 0.5)
      // Two passes, and both are needed: the first keeps the box off the beats
      // whose approach has to stay readable, the second keeps it off other
      // boxes. Running the crate check second means its result is the one that
      // ships, and it can only move the crate FORWARD into road the first pass
      // already cleared.
      const y = nudgeClearOfCrates(b, nudgeClear(b, b.arenaY * Math.max(0.12, Math.min(0.9, f))), x)
      crates(b, y, kind, [x])
      slot++
    }
  }
  topUp('rate', minRateCrates(b.stage))
  topUp('damage', minDamageCrates(b.stage))
}

/**
 * Break up any stretch that goes too long without a gate.
 *
 * Runs LAST, after the body, the elites and the closing bank, so it sees the
 * road the player will actually run rather than the one the generator intended.
 * Every inserted bank is a modest, honest `+N | +N+1` — the point is to give the
 * thumb something to commit to, not to hand out crowd. A trap or a multiplier
 * here would be a decision the stage never earned the right to ask.
 */
const fillGateGaps = (b: Beat): void => {
  // STAGE 1 opts out. Its pacing is authored by hand for a ~30 s teaching road,
  // and the filler is a blunt instrument next to that: adding two more banks
  // there handed a player who never touches the screen enough crowd to walk the
  // whole stage, which turns "the tutorial is gentle" into "the game plays
  // itself". Its own long stretch — thirteen seconds with no gate — is fixed
  // where it belongs, in `stageOne`.
  if (b.stage <= 1) return

  const maxGap = MAX_GATE_GAP_S * stageSpeed(b.stage)
  const base = gateAddBase(b.stage)

  // One pass. A filled gap is at most `maxGap` wide by construction, so there is
  // nothing to re-split, and a loop here could only ever fight `nudgeClear`.
  const banks = b.events
    .filter((e) => e.kind === 'gates')
    .map((e) => e.y)
    .sort((p, q) => p - q)

  const stops = [...banks, b.arenaY]
  let prev = banks.length > 0 ? banks[0]! : 0
  for (const y of stops) {
    const gap = y - prev
    if (gap > maxGap) {
      // Outward from the midpoint, nearest first, for a spot that is clear of
      // the banks either side AND of anything already standing there. Searching
      // both ways rather than only forward keeps the filler near the middle of
      // the stretch it exists to break up.
      const mid = prev + gap / 2
      let at = nudgeClear(b, mid)
      for (let step = 0; step <= 12; step++) {
        const back = nudgeClear(b, mid - step)
        if (back - prev > 6 && y - back > 6 && !bankWouldCrowd(b, back)) { at = back; break }
        const fwd = nudgeClear(b, mid + step)
        if (fwd - prev > 6 && y - fwd > 6 && !bankWouldCrowd(b, fwd)) { at = fwd; break }
      }
      // Only if the nudge did not push it on top of one of the two banks it is
      // meant to sit between…
      const fits = at - prev > 6 && y - at > 6
      // …and never in an elite's run-up. A miniboss plants and has to be fought
      // on open road; a bank dropped into the `MINIBOSS_LEAD` units before one
      // turns that fight into a scramble through a doorway. Skipping the filler
      // costs one decision, and there are worse stretches than a quiet approach
      // to a landmark.
      const crowdsElite = b.events.some(
        (e) => e.kind === 'miniboss' && e.y - at >= 0 && e.y - at < MINIBOSS_LEAD
      )
      if (fits && !crowdsElite) {
        // A filler bank must not also print a passage rib. `bank` lays one every
        // few doors, and pacing fillers are not authored decisions — letting
        // them spend the counter put extra corridors on roads that never asked
        // for them, and a crowd crossing an unplanned rib bleeds for it.
        const passageIn = b.passageIn
        bank(b, at, add(base), add(base + 1))
        b.passageIn = passageIn
      }
    }
    prev = y
  }
}

// ─── Build ──────────────────────────────────────────────────────────────────

// ─── The weapon puzzle ──────────────────────────────────────────────────────

/**
 * Road a lever needs either side of a bank or an elite.
 *
 * The lever sweep and a gate bank are the same instruction — "steer somewhere
 * specific, now" — pointed at two different places, and a player asked for both
 * in the same second does neither. Slightly over one second of road at stage
 * speed.
 */
const WEAPON_LEVER_CLEAR = 6

/** …and the box needs more, because the detour onto the shoulder happens with
 *  the crowd already committed to whatever the bank made it commit to. */
const WEAPON_BOX_CLEAR = 7.5

/**
 * How much road behind the arena the beat must finish in, for the three slots
 * that stay out of the run-in. The closing bank lands at `arenaY - 12` and owns
 * it; a prize contending with that bank is a prize most players will not turn
 * for.
 *
 * The CLOSE slot is the deliberate exception and uses `WEAPON_CLOSING_CLEAR`
 * instead — see `WEAPON_SLOTS`. It still clears the bank; what it gives up is
 * the comfort margin behind it, which is the whole point of that slot.
 */
const WEAPON_ARENA_CLEAR = 17

/** The x window a round aimed at `x` travels down. Roughly half a crowd's
 *  radius, so a block that only clips the edge of the column does not count as
 *  cover. */
const WEAPON_COLUMN_HALF = 0.85

const inColumn = (blockX: number, blockW: number, x: number): boolean =>
  Math.abs(blockX - x) < blockW / 2 + WEAPON_COLUMN_HALF

/**
 * Which side of the road each half of the beat uses.
 *
 * Mirrored on alternate stages so "the lever is on the left" never becomes the
 * answer — the beat is about looking, and a fixed layout is a beat that can be
 * solved without looking. The box lands on the SECOND lever's side, so the
 * sweep ends where the prize is: left, right, and the shoulder you are already
 * on.
 */
const puzzleSide = (stage: number): 1 | -1 => (Math.floor(stage / 2) % 2 === 0 ? -1 : 1)

/** Everything the beat occupies, resolved from the first lever's `y`. */
interface PuzzleAt {
  leverY: readonly [number, number]
  boxY: number
  guardY: number
}

const puzzleAt = (y: number): PuzzleAt => ({
  leverY: [y, y + LEVER_STAGGER],
  boxY: y + WEAPON_BOX_AHEAD,
  guardY: y + WEAPON_BOX_AHEAD - WEAPON_GUARD_LEAD
})

/** The three x positions a round has to reach: both levers, then the box. */
const puzzleColumns = (stage: number): [number, number, number] => {
  const side = puzzleSide(stage)
  return [side * LEVER_X, -side * LEVER_X, -side * WEAPON_BOX_X]
}

/**
 * How much road behind a target its firing column is cleared for.
 *
 * NOT `BULLET_RANGE` (10.8), which is how far a round can travel and a wildly
 * pessimistic answer to "where does cover actually matter". The crowd is only
 * out at |x| = 3.4 for the last second or so of a lever's approach — it has a
 * road to run before then — so a boulder eight units back in the same column is
 * not cover, it is scenery the player was never behind.
 *
 * It matters because this is the one pass in the generator that DELETES
 * obstacles: at the full gun range it thinned three twelve-unit stretches of
 * every stage from 4 on, which is a difficulty cut bought for nothing. Seven
 * units is ~1.3 s of road, which is the whole window in which the column is
 * genuinely being shot down.
 */
const WEAPON_LANE_CLEAR = 7

/**
 * The stretch of road each of the three columns is shot from.
 *
 * A column only matters BEHIND the thing it leads to: a boulder five units past
 * a lever never blocked anything.
 */
const puzzleSpans = (stage: number, y: number): Array<[number, number, number]> => {
  const at = puzzleAt(y)
  const cols = puzzleColumns(stage)
  return [
    [cols[0], at.leverY[0] - WEAPON_LANE_CLEAR, at.leverY[0] + LEVER_R],
    [cols[1], at.leverY[1] - WEAPON_LANE_CLEAR, at.leverY[1] + LEVER_R],
    [cols[2], at.guardY - WEAPON_LANE_CLEAR, at.boxY + WEAPON_BOX_R]
  ]
}

/**
 * Can the beat live here?
 *
 * Two different questions, asked of different things:
 *
 *   • a BANK or an ELITE anywhere near a lever or the box is a competing
 *     instruction, and no amount of clearing fixes it — the position is wrong;
 *   • a wall or a boulder is only a problem where it stands IN one of the three
 *     columns the player has to shoot down, and `clearPuzzleColumns` deletes
 *     those. The exception is a passage rib, which is authored to be an
 *     unbroken wall and may not have a hole opened in it — a rib in a column
 *     rules the position out instead.
 *
 * `leverGap` and `boxGap` are passed in rather than read from the constants
 * because the search relaxes them; `arenaClear` because it is the slot's, not
 * the file's. See `placeWeaponPuzzle`.
 */
const puzzleFits = (
  b: Beat, y: number, leverGap: number, boxGap: number, arenaClear: number
): boolean => {
  const at = puzzleAt(y)
  if (y < 12) return false
  if (at.boxY + WEAPON_BOX_R > b.arenaY - arenaClear) return false

  const spans = puzzleSpans(b.stage, y)
  for (const e of b.events) {
    if (e.kind === 'gates' || e.kind === 'miniboss') {
      for (const ly of at.leverY) if (Math.abs(e.y - ly) < leverGap) return false
      if (Math.abs(e.y - at.boxY) < boxGap) return false
      if (Math.abs(e.y - at.guardY) < boxGap) return false
      continue
    }
    if (e.kind === 'rocks' && e.passage) {
      for (const bl of e.blocks) {
        for (const [x, lo, hi] of spans) {
          if (e.y >= lo && e.y <= hi && inColumn(bl.x, bl.w, x)) return false
        }
      }
    }
  }
  return true
}

/**
 * Open the three firing lanes.
 *
 * Deletes wall and boulder BLOCKS — never whole rows — that stand in a column
 * the player is required to shoot down. Dropping blocks can only ever widen a
 * row's gap, so every runnability guarantee `ensureRunnable` made about these
 * rows still holds; a row emptied completely is dropped with it.
 *
 * This is the one pass in the generator that makes a stage EASIER, and it is
 * worth being explicit about why that is acceptable: a boulder cannot be shot,
 * so a boulder parked on a lever is not a harder puzzle, it is a puzzle with no
 * solution — and one the player would spend the whole approach failing to
 * solve. Two or three blocks out of a stage's forty is a fair price for a beat
 * that always works.
 */
const clearPuzzleColumns = (b: Beat, y: number): void => {
  const spans = puzzleSpans(b.stage, y)
  for (let i = b.events.length - 1; i >= 0; i--) {
    const e = b.events[i]!
    if (e.kind !== 'rocks' && e.kind !== 'barricade') continue
    if (e.kind === 'rocks' && e.passage) continue
    const kept = e.blocks.filter(
      (bl) => !spans.some(([x, lo, hi]) => e.y >= lo && e.y <= hi && inColumn(bl.x, bl.w, x))
    )
    if (kept.length === e.blocks.length) continue
    if (kept.length === 0) b.events.splice(i, 1)
    // Mutated in place rather than rebuilt: the two event kinds differ in the
    // fields AROUND `blocks` (a rib's `passage`, a rank's `field`) and those
    // must survive a thinning untouched — a rank that lost its field id stops
    // moving with its partner.
    else (e as { blocks: typeof kept }).blocks = kept
  }
}

/**
 * ─── Where on the road the beat goes ────────────────────────────────────────
 *
 * It used to be one number — just under halfway, every stage, forever — and
 * that is the version a player described as boring in exactly those terms: once
 * you know the puzzle is at the midpoint you stop looking for it, you steer to
 * the rail when the progress bar says so, and the beat whose entire content is
 * "did you notice" has been reduced to a timer.
 *
 * So it rotates through four slots instead, and the rotation is a pure function
 * of the stage number like everything else on this road: a player who wipes on
 * stage 12 meets the same puzzle in the same place on the retry, and a player
 * who has run stage 12 before can PLAN for it. Varied is not the same as random.
 *
 * The four are chosen to ask different questions rather than to spread numbers
 * evenly:
 *
 *   MID   — the original. The weapon is worth carrying for most of what is left,
 *           and the crowd solving it has been through two or three banks.
 *   EARLY — a small crowd, a cheap sweep, and a weapon for almost the whole
 *           road. The prize is biggest here and the squad that has to win it is
 *           weakest, which is the trade.
 *   LATE  — most of the stage is already spent, so it is a decision about the
 *           run-in rather than about the run: turn for it, or bank what you have.
 *   CLOSE — the last thing on the road. A launcher handed over here is a
 *           launcher for the boss and nothing else, which is not a downgrade —
 *           it is a different purchase, and it lands on the fight where five
 *           rockets into one health bar is the best the weapon ever gets.
 *
 * `clear` is how much road behind the arena that slot's box must finish in. The
 * first three keep the whole of the closing bank's run-in to themselves; CLOSE
 * deliberately does not, and `WEAPON_CLOSING_CLEAR` is the argument for why
 * that is safe.
 */
interface WeaponSlot {
  /** Target position, as a fraction of `arenaY`. */
  at: number
  /** Road the box must leave between itself and the arena. */
  clear: number
}

/**
 * How much road the CLOSE slot leaves in front of its box.
 *
 * The closing bank is written at `arenaY − 12` and owns the run-in, so this has
 * to clear it — a prize the player meets in the same breath as the last gate
 * bank is a prize they will not turn for, and `puzzleFits` would reject the
 * position anyway.
 *
 * It may not go much below this either, and the floor is a hard mechanical one
 * rather than a taste one: the crowd STOPS at `arenaY`. A box parked two units
 * short of the arena is passed at the exact moment the run-in ends and can then
 * never be shot again — rounds only travel up the road — so the prize would
 * simply be undrawable on the stages that drew that slot. Eight units is about
 * a second and a half of road with the box already broken, which is the margin
 * that keeps the slot a real one.
 */
export const WEAPON_CLOSING_CLEAR = 8

const WEAPON_SLOTS = {
  mid: { at: 0.45, clear: WEAPON_ARENA_CLEAR },
  early: { at: 0.2, clear: WEAPON_ARENA_CLEAR },
  late: { at: 0.68, clear: WEAPON_ARENA_CLEAR },
  close: { at: 0.95, clear: WEAPON_CLOSING_CLEAR }
} as const satisfies Record<string, WeaponSlot>

export type WeaponSlotId = keyof typeof WEAPON_SLOTS

/**
 * The order the four slots are dealt in, one entry per PUZZLE stage.
 *
 * Eight long rather than four, and that length is the whole design of it.
 *
 * `weaponForStage` alternates gatling/rocket over the same index, so a
 * four-long rotation locks the two together forever: the close slot would be a
 * rocket stage every single time it came up, the mid slot a gatling stage every
 * time, and a player who learned "the launcher lives at the end of the road"
 * would be right for the rest of the campaign. Two dials with the same period
 * are one dial.
 *
 * At eight, each slot is dealt twice — once on a gatling stage and once on a
 * rocket stage — so position tells you nothing about which weapon is in the
 * box, and neither one tells you about the other. No slot is dealt twice in a
 * row either, including across the wrap, so consecutive puzzle stages never
 * feel like a repeat.
 */
const WEAPON_SLOT_ORDER: readonly WeaponSlotId[] = [
  'mid', 'early', 'late', 'close', 'early', 'mid', 'close', 'late'
]

/**
 * Which slot this stage's puzzle aims for.
 *
 * The FIRST puzzle in the campaign — `WEAPON_STAGE`, and the only one below 8 —
 * takes the head of the order, which is MID on purpose. A player meeting the
 * beat for the first time has to be able to read it: the midpoint is where the
 * road is calmest, where the two halves of the puzzle are most likely to be on
 * screen together, and where a miss is cheapest to learn from. Variety is for
 * the player who already knows what a lever is, which is why the rotation
 * proper starts at stage 8.
 *
 * A pure function of the stage number, like everything else on this road: the
 * point is that stage 20's prize is somewhere DIFFERENT from stage 18's, not
 * that it is somewhere unknowable. A player who wipes meets the same road on
 * the retry and can plan the sweep for it.
 */
export const weaponSlotIdFor = (stage: number): WeaponSlotId => {
  const n = Math.floor((stage - WEAPON_STAGE) / WEAPON_EVERY)
  return WEAPON_SLOT_ORDER[n <= 0 ? 0 : n % WEAPON_SLOT_ORDER.length]!
}

const weaponSlotFor = (stage: number): WeaponSlot => WEAPON_SLOTS[weaponSlotIdFor(stage)]

/**
 * Every clearance the search is willing to settle for, hardest first.
 *
 * A first pass that walked upward from a third of the road and took the first
 * gap it found put the beat at 76 % of stage 4 and missed seven stages out of
 * the first two hundred outright — because "the first legal spot" on a busy
 * road is wherever the banks happen to thin out, which is usually the run-in.
 *
 * So the search scans the WHOLE legal window and scores by distance from the
 * slot's target (`WEAPON_SLOTS`), and if the strict clearance admits nothing it
 * lowers its standards rather than dropping the beat. The relaxed tiers are
 * still more road than a bank's own band asks for; what they give up is the
 * comfort margin
 * between the lever sweep and the next decision, which is a worse puzzle than
 * the ideal one and a far better one than no puzzle at all.
 */
const WEAPON_CLEARANCES: ReadonlyArray<readonly [number, number]> = [
  [WEAPON_LEVER_CLEAR, WEAPON_BOX_CLEAR],
  [4.5, 5.5],
  [3, 3.5]
]

/**
 * Lay the stage's weapon puzzle.
 *
 * Runs LAST, after every bank exists and every obstacle is in its final place,
 * because it is the only beat placed around the finished road rather than into
 * a road still being written. It adds no gates and moves nothing, so nothing
 * that ran before it can be invalidated by it.
 *
 * `weaponPuzzle.test.ts` asserts that every stage `stageHasWeapon` claims gets
 * one — and that no other stage does — and that it lands in the middle half of
 * the road: the promises that make "a weapon every other stage" true rather
 * than approximately true.
 */
const placeWeaponPuzzle = (b: Beat): void => {
  if (!stageHasWeapon(b.stage)) return

  const slot = weaponSlotFor(b.stage)
  const want = b.arenaY * slot.at
  // Close enough to stop looking. It was a QUARTER of the road, which was
  // harmless while there was one target and fatal with four: a "close" slot
  // that settles a quarter of the road early is a mid slot, and the rotation
  // the player is supposed to notice quietly collapses back into the single
  // position it replaced. An eighth is still a couple of banks of slack.
  const goodEnough = b.arenaY * 0.12
  let found = -1
  let bestCost = Number.POSITIVE_INFINITY
  for (const [leverGap, boxGap] of WEAPON_CLEARANCES) {
    // Half a unit is a tenth of a second of road: finer than the player could
    // perceive, coarse enough that the whole sweep is a few hundred tests.
    for (let y = 12; y < b.arenaY; y += 0.5) {
      if (!puzzleFits(b, y, leverGap, boxGap, slot.clear)) continue
      const cost = Math.abs(y - want)
      if (cost >= bestCost) continue
      bestCost = cost
      found = r2(y)
    }
    // Keep relaxing while the best spot found so far is still out in the
    // run-in. The looser tier is a WORSE puzzle — less road between the sweep
    // and the next decision — but a mid-road puzzle with a tight approach beats
    // a comfortable one handed over at 82 % of the stage, which is where the
    // strict tier alone put stage 50. The tiers compete rather than short-
    // circuit, so a relaxed candidate only wins if it is genuinely closer.
    if (found >= 0 && bestCost <= goodEnough) break
  }
  if (found < 0) return

  clearPuzzleColumns(b, found)

  const at = puzzleAt(found)
  const side = puzzleSide(b.stage)
  const boxX = -side * WEAPON_BOX_X
  const hp = leverHp(b.stage)
  const guardHp = Math.round(barricadeHp(b.stage) * WEAPON_GUARD_HP_MUL)
  // 70 % of the stage's ordinary wall — cover priced UNDER the walls the road
  // is already charging for. See `LEVER_STONE_HP_MUL`.
  const stoneHp = Math.max(1, Math.round(barricadeHp(b.stage) * LEVER_STONE_HP_MUL))
  const leverXs = [r2(side * LEVER_X), r2(-side * LEVER_X)] as const

  b.events.push({
    kind: 'weapon',
    y: r2(found),
    weapon: weaponForStage(b.stage),
    levers: [
      { x: leverXs[0], y: r2(at.leverY[0]), hp },
      { x: leverXs[1], y: r2(at.leverY[1]), hp }
    ],
    // One per lever, in the same column and `LEVER_STONE_LEAD` short of it —
    // inside the stretch `clearPuzzleColumns` has already emptied of other
    // scenery, so the stone is the ONLY thing in front of its post.
    stones: [
      { x: leverXs[0], y: r2(at.leverY[0] - LEVER_STONE_LEAD), w: LEVER_STONE_W, hp: stoneHp },
      { x: leverXs[1], y: r2(at.leverY[1] - LEVER_STONE_LEAD), w: LEVER_STONE_W, hp: stoneHp }
    ],
    box: { x: r2(boxX), y: r2(at.boxY), hp: weaponBoxHp(b.stage) },
    guardY: r2(at.guardY),
    // Two plates rather than one slab, so the armour reads as something BUILT
    // over the box rather than as a barricade that happens to be there — and so
    // it comes apart in two pieces when it goes.
    guards: [
      { x: r2(boxX - WEAPON_GUARD_HALF_W / 2), w: WEAPON_GUARD_HALF_W, hp: guardHp },
      { x: r2(boxX + WEAPON_GUARD_HALF_W / 2), w: WEAPON_GUARD_HALF_W, hp: guardHp }
    ]
  })
}

export const buildTrack = (stage: number): Track => {
  const length = stageLength(stage)
  const arenaY = length - 4
  const bossY = length + 8

  // The last bank of the road is a triple from `CLOSING_TRIPLE_STAGE`, and the
  // budget for it is reserved before the body gets to spend anything.
  const closingTriple = stage >= CLOSING_TRIPLE_STAGE
  const b: Beat = {
    stage,
    rng: mulberry32(Math.imul(stage, 0x9e3779b1) ^ 0x85ebca6b),
    arenaY,
    events: [],
    fieldId: 0,
    y: 14,
    bigDivLast: false,
    trapPlaced: false,
    trapStreak: 0,
    // One per stage from 4, and none at all before then: a player meeting `-N`
    // for the first time on stage 3 should meet it beside something worth
    // having, not beside a trap.
    dilemmaLeft: stage >= 4 ? 1 : 0,
    dilemmaLast: false,
    mulLast: false,
    passageIn: PASSAGE_EVERY_MIN,
    lastY: 0,
    routingNext: false,
    mulLeft: mulLeaves(stage),
    mulThreeLeft: mulThrees(stage),
    triplesLeft: maxTriples(stage),
    triplesPlaced: 0,
    tripleReserve: closingTriple ? 1 : 0,
    trailGoodX: 0,
    trailBadX: 0,
    lastBody: '',
    lastStructure: '',
    lastFoe: ''
  }

  if (stage === 1) stageOne(b)
  else if (stage === 2) stageTwo(b)
  else if (stage === 3) stageThree(b)
  else if (stage === 4) stageFour(b)
  else if (stage === 5) stageFive(b)
  else if (stage === 6) stageSix(b)
  else if (stage === 7) stageSeven(b)
  else if (stage === 8) stageEight(b)
  else if (stage === 9) stageNine(b)
  else if (stage === 10) stageTen(b)
  else if (stage === 11) stageEleven(b)
  else if (stage === 12) stageTwelve(b)
  else if (stage === 13) stageThirteen(b)
  else if (stage === 14) stageFourteen(b)
  else if (stage === 15) stageFifteen(b)
  else proceduralBody(b)

  placeMinibosses(b)

  // The last bank before the boss. Always present, always big, and — from the
  // stage the player has met multipliers — always a real decision, so they walk
  // into the arena having just committed to something out loud.
  //
  // From `CLOSING_TRIPLE_STAGE` it is three doors wide and carries no trap: the
  // run-in should ask the biggest question on the road, and the punishment for
  // getting it wrong is the boss waiting twelve units later, not a `÷5`.
  const base = gateAddBase(stage)
  const closing = arenaY - 12
  // …and a stage that has MET three-leaf banks always shows the player one. If
  // the road's own rolls never spent its allowance, the run-in delivers it: a
  // mechanic a bad seed can skip entirely is a mechanic half the players never
  // find out about.
  if (closingTriple || (stage >= TRIPLE_STAGE && b.triplesPlaced === 0)) {
    // The two big offers take the outside doors and swap sides from stage to
    // stage; the middle one is always the modest `+N`. It is the only fixed
    // rule about a centre door anywhere in the game, and it is deliberate: the
    // last thing a player reads before the arena should be "the safe answer is
    // straight ahead, and it is not the best one".
    const big = mul(b.rng() < 0.5 ? 3 : 2)
    const fat = add(base + 8)
    const flip = b.rng() < 0.5
    bank(b, closing, flip ? fat : big, add(base + 3), flip ? big : fat)
  } else if (stage >= 5) bank(b, closing, add(base + 6), mul(b.rng() < 0.5 ? 3 : 2))
  else if (stage >= 2) bank(b, closing, add(base + 2), add(base + 5))
  else bank(b, closing, add(base + 1), add(base + 2))

  ensureSupplies(b)
  fillGateGaps(b)

  // LAST, because it is the only pass that needs every bank to already exist:
  // `fillGateGaps` adds them, and an obstacle cleared before that could be
  // buried by a filler bank dropped on top of it.
  clearGateBands(b)

  // …and after THAT, because the puzzle is placed around the FINISHED road: it
  // needs every bank and every obstacle at its final `y` to know where the three
  // firing lanes it requires can actually be opened.
  placeWeaponPuzzle(b)

  // Sorted by distance: the sim streams events in one forward pass and never
  // looks back. `Array.prototype.sort` is stable, so equal-y events keep the
  // order they were authored in and the track stays byte-identical per stage.
  b.events.sort((p, q) => p.y - q.y)
  // ── The opening stages carry no scenery that can kill ──
  //
  // Filtered from the FINISHED event list rather than gated inside each beat,
  // and that is deliberate. `chicane`, `gauntlet`, `boulderField`, `wall`,
  // `barricadeRow` and the passage ribs all build rocks or barricades, and a new
  // beat written next month will too — gating each one is a rule that decays.
  // There are exactly two event kinds that can kill a crowd it cannot shoot
  // through, and this removes them by NAME.
  //
  // Safe to do after the fact: everything the generator placed around them —
  // gates nudged clear of a wall, crates kept off a rib — stays valid when they
  // are gone, because all those rules only ever pushed things APART.
  const keep = earlyObstacleKeep(stage)
  const events = keep >= 1
    ? b.events
    : (() => {
      let seen = 0
      return b.events.filter((e) => {
        if (e.kind !== 'rocks' && e.kind !== 'barricade') return true
        if (keep <= 0) return false
        // Deterministic thinning: every other one, so a stage is still the same
        // stage on every replay and a player can learn it.
        seen++
        return seen % 2 === 1
      })
    })()

  return { stage, arenaY, bossY, length, events }
}

/**
 * ─── What a perfect run could possibly arrive with ──────────────────────────
 *
 * The ceiling on the crowd, from the doors alone: walk the road, take the best
 * leaf of every bank, pump whichever leaf is being taken for the whole approach,
 * and lose nobody on the way. It is deliberately OPTIMISTIC — nothing here pays
 * for a foe's bite or a pillar's graze — because it is a yardstick rather than a
 * prediction. `adaptiveBossSeconds` divides the crowd the player ACTUALLY
 * brought by this, and the ratio is what "how well did that go" means.
 *
 * A track is deterministic in its stage number (`buildTrack` seeds its RNG from
 * it), so this is a pure function of the stage plus what the shop was worth when
 * the stage opened — which is why the shop's two crowd tracks are arguments
 * rather than reads. A player who bought Squad to level ten should not be told
 * they played badly for arriving with the crowd their purchase guaranteed.
 *
 * ─── The pump model ─────────────────────────────────────────────────────────
 *
 * `GATE_PUMP_TICKS_IDEAL` is the one assumption in here, and it is measured
 * rather than chosen: `gateAddBase`'s comment records the in-range approach as
 * "~2.0 s (four ticks)" at the stages this covers, after the guns stopped
 * outranging the camera. Four is therefore what a player who commits the moment
 * a bank enters range actually banks — the `optimal` policy's whole edge over
 * `good`, which commits late and pumps nothing.
 *
 * It is applied to the WINNING leaf only. That is the mechanic: the crowd has
 * one stream of fire, so the door being invested in is the door being walked
 * through, and a bank's other leaves stay where they were printed.
 */
export const GATE_PUMP_TICKS_IDEAL = 4

/** What a leaf is worth after a full approach spent firing at it. */
const pumpedValue = (leaf: GateLeaf, stage: number): number => {
  // A hostile door is never pumped, because a perfect player never points the
  // crowd at one — and pumping `-N` or `÷N` makes it WORSE, so assuming it
  // happened would understate the ceiling rather than overstate it.
  if (leaf.op === 'sub' || leaf.op === 'div') return leaf.value
  if (leaf.op === 'mul') {
    return Math.min(GATE_MUL_MAX, Math.round(
      (leaf.value + GATE_SCALE_STEP * GATE_PUMP_TICKS_IDEAL) * 10
    ) / 10)
  }
  return Math.min(GATE_MAX_VALUE, leaf.value + gatePumpStep(stage) * GATE_PUMP_TICKS_IDEAL)
}

/** The crowd after taking `leaf`, given the crowd that reached it. */
const squadAfter = (squad: number, leaf: GateLeaf, stage: number, payoutBonus: number): number => {
  const value = pumpedValue(leaf, stage)
  switch (leaf.op) {
    // Mirrors `claimBank`: an `add` leaf pays its face value scaled by the
    // Squad track's payout bonus, a `mul` leaf pays a share of whoever came
    // through, and the two hostile ops bill the crowd that walked in.
    case 'add': return squad + Math.round(value * payoutBonus)
    case 'mul': return squad + Math.round(squad * (value - 1))
    case 'sub': return Math.max(0, squad - Math.max(1, Math.round(value)))
    case 'div': return Math.max(0, Math.floor(squad / Math.max(2, value)))
  }
}

/**
 * The biggest crowd this stage's doors can possibly hand a player.
 *
 * @param startSquad what the run opens with — `startSquad.value` from the shop,
 *                   NOT the bare `START_SQUAD`, so an upgraded save is measured
 *                   against the ceiling its own purchases raised.
 * @param payoutBonus `gatePayoutBonus.value`, for the same reason.
 */
export const perfectSquadFor = (
  stage: number,
  startSquad: number = START_SQUAD,
  payoutBonus = 1
): number => {
  let squad = Math.max(1, Math.round(startSquad))
  for (const e of buildTrack(stage).events) {
    if (e.kind !== 'gates' || e.leaves.length === 0) continue
    let best = 0
    for (const leaf of e.leaves) best = Math.max(best, squadAfter(squad, leaf, stage, payoutBonus))
    // The same ceiling the doors themselves are clipped by, applied in the same
    // place — a reference that promised more than a gate can spawn would report
    // every late run as a failure.
    squad = Math.min(MAX_SQUAD, best)
  }
  return squad
}
