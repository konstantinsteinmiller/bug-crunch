/**
 * ─── Round numbers ──────────────────────────────────────────────────────────
 *
 * The rule `RunHud.vue` punches its squad chip with, pulled out of the
 * component so it can be measured without mounting anything — the decision it
 * makes is a state machine, and a state machine that only exists inside a
 * template is a state machine nobody can prove.
 *
 * The point of the feature is vocabulary. A player who has crossed 200 has a
 * word for what they did and a target for the next run ("I got to 400"); a
 * player watching a number climb continuously has neither, and the game's
 * headline stat goes by unremarked.
 *
 * ─── The ladder DOUBLES, and it does not stop ──────────────────────────────
 *
 * The four numbers the roadmap asks for — 25, 50, 100, 200 — are already a
 * doubling ladder, so continuing them (400, 800, 1600, 3200 …) is not a new
 * rule but the same one applied past where it was written down. It has to be
 * continued, because a milestone that stops at 200 goes quiet exactly when the
 * run gets good: the shop's squad upgrade alone starts a late run near 200, and
 * a cleared endless stage routinely ends in four figures.
 *
 * A FIXED step past 200 (every 100, every 250) was the obvious alternative and
 * it is wrong, for a reason that is about this game's arithmetic rather than
 * taste. The squad grows MULTIPLICATIVELY — the doors are `+N`, `×N` and `/N`,
 * and `GATE_MUL_MAX` is 3, so one door can triple the crowd inside a single
 * frame. On a fixed step, that one door crosses eight thresholds at once and
 * the chip fires eight times for a thing the player did once, while a stage-2
 * player creeping from 30 to 60 gets nothing at all. On a doubling ladder every
 * rung costs the same RELATIVE achievement — twice as many as the last one —
 * which is the only spacing that behaves the same at 25 and at 2500. A run that
 * reaches four figures collects six or seven of them, spread across the whole
 * run instead of bunched at the end.
 *
 * ─── One number of state, and it is the HIGHEST, not a set ─────────────────
 *
 * `highest` is the biggest rung already announced this run. Everything the
 * feature has to guarantee falls out of comparing against it rather than out of
 * ticking off a set:
 *
 *   • a squad oscillating around 100 (a `-N` leaf, a wipe of half the crowd,
 *     a `+12` door) re-reaches 100 and stays silent, because 100 is not
 *     greater than 100;
 *   • a crowd wiped to three and RALLIED back to 300 announces 200 once —
 *     not 25, 50, 100 and 200 again, which is what a "fire every threshold
 *     you cross" reading would do, and which would turn the game's most
 *     generous moment into a slot machine;
 *   • a `×3` from 300 to 900 announces 800 alone. The player gets the biggest
 *     true thing that happened, not a burst of the smaller ones under it.
 *
 * Reset lives with the run: `startStage` is the only place a squad legitimately
 * goes back to nothing (it sets `squadCount` to 0 outright), so the HUD arms a
 * fresh state on the same edge — see `RunHud.vue`.
 */

/** The first rung. Low enough that a stage-1 player who plays a bank well gets
 *  one inside the first minute, which is the only one that teaches what the
 *  chime means. */
export const FIRST_MILESTONE = 25

/**
 * Ceiling on the ladder walk.
 *
 * Not a game-design number — a loop bound. `squad` arrives from the simulation
 * and reaches this HUD as a prop, so a `NaN`, an `Infinity` or a corrupted
 * hydrate must not be able to spin the `while` below forever inside a Vue
 * watcher. A billion is several orders of magnitude past anything the crowd
 * cap allows, so no real run can ever notice it.
 */
const MILESTONE_CEILING = 1e9

/**
 * The highest rung of the ladder at or below `squad`, or 0 when the squad has
 * not reached the first one.
 *
 * Walked rather than derived with `Math.log2`, and deliberately: the ladder's
 * rungs are exact powers of two times 25, and a `floor(log2())` sits one ULP
 * away from returning the rung BELOW an exact rung on a bad day. The walk is
 * at most ~25 iterations and runs once per squad change, not per frame.
 */
export const milestoneAtOrBelow = (squad: number): number => {
  if (!Number.isFinite(squad) || squad < FIRST_MILESTONE) return 0
  let rung = FIRST_MILESTONE
  let best = 0
  while (rung <= squad && rung <= MILESTONE_CEILING) {
    best = rung
    rung *= 2
  }
  return best
}

/** Which rung a milestone is — 0 for 25, 1 for 50, 2 for 100 … Handed to the
 *  mixer so the fanfare starts higher up the ladder the bigger the number, and
 *  a four-figure squad does not get the same chime a 25 did. */
export const milestoneRung = (milestone: number): number => {
  if (!Number.isFinite(milestone) || milestone < FIRST_MILESTONE) return 0
  let rung = 0
  let value = FIRST_MILESTONE
  while (value * 2 <= milestone && value <= MILESTONE_CEILING) {
    value *= 2
    rung += 1
  }
  return rung
}

/**
 * The whole decision, as one pure step.
 *
 * @param highest the biggest milestone already announced this run (0 at the
 *                start of one)
 * @param squad   the squad size right now
 * @returns the milestone to announce, or 0 for "say nothing" — which is the
 *          answer for a squad that is shrinking, a squad below the first rung,
 *          and every re-crossing of ground already announced.
 */
export const crossedMilestone = (highest: number, squad: number): number => {
  const reached = milestoneAtOrBelow(squad)
  return reached > highest ? reached : 0
}
