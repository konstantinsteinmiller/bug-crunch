// The road's width, which the roller's geometry is derived from rather than
// duplicating. `survival.ts` imports only TYPES from this file, so that import
// is erased at build time and this one is not a cycle.
import { LANE_HALF } from '@/game/survival'

/**
 * ─── The threat pools ───────────────────────────────────────────────────────
 *
 * Which KIND of miniboss and which KIND of boss a stage fields.
 *
 * The fight was the same fight every stage: an elite that plants and sweeps a
 * scythe in front of itself, then a boss that drops meteors. Both read well the
 * first time and neither has anything left to show by stage six — the road keeps
 * changing and the two things the road is building up to do not, which is the
 * shape of a game people stop playing rather than lose.
 *
 * So each becomes a pool, and the pool opens at `THREAT_POOL_FROM_STAGE`.
 *
 * ── Why nothing new before stage 4 ──
 *
 * The opening three stages are a tutorial (see the relief curves in
 * `survival.ts`) and their whole job is to teach ONE elite and ONE boss well
 * enough that the player knows what a wind-up looks like. Variety before that is
 * not richness, it is noise: a player who has not yet learned that the ring on
 * the ground is dodgeable cannot learn it from three different rings. The pool
 * is the reward for having learned the grammar, not the grammar itself.
 *
 * ── Why the choice is derived, not rolled ──
 *
 * A stage is a pure function of its number everywhere else in this game, and it
 * has to stay one: a player who wipes on stage 7 must be able to LEARN stage 7
 * rather than re-roll it. Cycling by stage also guarantees the player meets each
 * kind before meeting any of them twice.
 */

/** Miniboss behaviours. `scythe` is the original: plant, wind up, sweep. */
export type MinibossKind = 'scythe' | 'roller' | 'bomber' | 'gunner'

/** Boss behaviours. `meteor` is the original: aim, drop a rock, slam. */
export type BossKind = 'meteor' | 'claw' | 'healer' | 'summoner'

/** Below this stage the game fields only the two the tutorial taught. */
export const THREAT_POOL_FROM_STAGE = 4

/**
 * The pools, in the order a player meets them.
 *
 * `scythe` and `meteor` stay in their pools rather than being retired: the
 * original fight is still a good fight, and a variant only reads as a variant
 * against something familiar.
 */
export const MINIBOSS_POOL: readonly MinibossKind[] = ['roller', 'bomber', 'gunner', 'scythe']
export const BOSS_POOL: readonly BossKind[] = ['claw', 'healer', 'summoner', 'meteor']

/**
 * Which miniboss kind stage `stage` fields for its `index`-th elite.
 *
 * `index` matters because a stage can carry up to three (see `placeMinibosses`),
 * and meeting the same one twice on one road wastes half of what the pool is
 * for.
 */
export const minibossKindFor = (stage: number, index = 0): MinibossKind => {
  if (stage < THREAT_POOL_FROM_STAGE) return 'scythe'
  const n = MINIBOSS_POOL.length
  // Offset by the stage so consecutive stages do not open with the same one,
  // and by the index so one road never repeats itself.
  return MINIBOSS_POOL[(stage - THREAT_POOL_FROM_STAGE + index) % n] ?? 'scythe'
}

/** Which boss kind stage `stage` ends with. */
export const bossKindFor = (stage: number): BossKind => {
  if (stage < THREAT_POOL_FROM_STAGE) return 'meteor'
  const n = BOSS_POOL.length
  // Strided so the boss and the stage's first miniboss are rarely the same
  // "flavour" of fight on the same road — a projectile boss after a projectile
  // elite is one idea twice.
  return BOSS_POOL[((stage - THREAT_POOL_FROM_STAGE) * 3) % n] ?? 'meteor'
}

// ─── The three new elites ───────────────────────────────────────────────────
//
// Every number below lives here rather than in `survival.ts` for one reason:
// these fights are a POOL, and a pool is a thing that grows. Keeping the whole
// of a kind's tuning beside the kind it belongs to means the next one added
// costs one block in one file instead of a scattering across the rules.
//
// They share the shape of everything else in this game that hits a crowd:
//
//   • the toll is a SHARE of the current squad, never a flat count, because a
//     flat number is terrifying at thirty survivors and invisible at a thousand
//     (see `biteShareFor`);
//   • GEOMETRY decides whether the hit lands and who it reaches, the SHARE
//     decides what it costs once it has — which is exactly how the boss's slam
//     already works, radius for the connection and fraction for the price;
//   • the wind-up is announced once, at its START, carrying the exact seconds
//     to impact, so a telegraph can never arrive after the damage does.

// ─── roller ─────────────────────────────────────────────────────────────────
//
// A giant metal ball rolling down ONE straight line at the crowd. It is the
// game's only pure steering question: there is nothing to aim, nothing to read
// and no DPS trade to make — it comes down the left half of the road or the
// right half, and the answer is to not be in that half.
//
// ── Why it may never be in the middle ──
//
// The ball is half the road across, so a lane straddling the centre would leave
// two 2.25-unit strips either side, and the crowd is 3.3 across at full size
// (`CROWD_MAX_R` × 2). A centred ball is therefore an undodgeable ball, and an
// undodgeable ball is a tax with a rolling animation. On a side it leaves a
// clear 4.5 — the whole crowd with room to spare — which is what makes "get out
// of the way" a real instruction rather than an aspiration.
//
// ── Why it may never track ──
//
// Everything else on this road homes on the crowd, which is right for a monster
// and wrong for a rock: a ball that steered would turn the one hazard whose
// entire message is "this line, right here" into another thing that follows you,
// and the player would learn that moving does not work. `stepFoes` REWRITES its
// `x` from its lane every tick rather than merely declining to home, so the
// guarantee is a property of the code and not of a line somebody forgot.

/**
 * Radius of the ball, world units.
 *
 * Half the road is `LANE_HALF` = 4.5 across, so the ball is 4.5 in diameter and
 * 2.25 in radius: it covers exactly one half of the road, with no gap and no
 * overlap. Derived rather than typed out, so a change to the road's width cannot
 * leave the ball the wrong size for the lane it is supposed to own.
 */
export const ROLLER_R = LANE_HALF / 2

/**
 * The centre line of the ball's lane, for side `lane` (−1 left, +1 right).
 *
 * `lane` is never 0 — see `Foe.lane`. Zero would put the ball across the middle,
 * which is the one place it may not be.
 */
export const rollerLaneX = (lane: number): number => (lane < 0 ? -1 : 1) * (LANE_HALF / 2)

/**
 * Which side stage `stage`'s `index`-th roller comes down.
 *
 * Derived from the stage, NOT rolled. A stage is a pure function of its number
 * everywhere else in this game so that a player who wipes on stage 7 can learn
 * stage 7 rather than re-roll it, and a coin flip on which half of the road is
 * lethal is the worst possible place to break that promise: it is the one hazard
 * whose entire content is which side it is on.
 */
export const rollerLaneFor = (stage: number, index = 0): number =>
  (stage + index) % 2 === 0 ? -1 : 1

/**
 * How fast the ball rolls down the road, world units per second.
 *
 * It closes on the crowd at this PLUS the stage's run speed — about 8.5 u/s on
 * stage 4 — and the road visible ahead of the crowd is `CROWD_SCREEN_Y` ×
 * `VIEW_HEIGHT` ≈ 13.7 units. So it is on screen for a little over a second and
 * a half before it arrives, against a crowd whose anchor crosses the whole lane
 * in about a third of a second. That is the margin the dodge is priced at: two
 * reaction times, not five.
 *
 * Deliberately slower than a hound. A ball that outran the eye would read as
 * unfair however wide the free lane beside it was.
 */
export const ROLLER_SPEED = 3.4

/**
 * Share of the current squad one roll takes off whoever it rolls over.
 *
 * ── Why this is a share and not "everyone it touches" ──
 *
 * The obvious thing was tried first: the ball is solid, solid means whoever
 * touches it dies, and the rest of the swarm flows past (the rule every other
 * solid thing in the lane follows). Measured, that is not a hazard, it is a
 * delete key — the footprint is 4.5 across and the crowd is 3.3, so ANY contact
 * covers the entire squad. Stage 4 lost 100 % of the crowd on every seed and
 * three career invariants in `tests/sim/balance.test.ts` went with it.
 *
 * So the ball is priced like every other big attack here: geometry decides
 * whether it caught you, the share decides what that costs. The DODGE stays
 * total — clear of the lane is clear, full stop — which is the part the design
 * actually asked for. What is bounded is the failure.
 *
 * 0.3, against the boss's 0.31 slam and the scythe's 0.2 sweep. It sits at slam
 * weight because it is a slam-shaped threat: one connection, wholly avoidable,
 * announced from further off than anything else in the game. And it bills ONCE
 * per ball, so a roller costs less over a whole fight than a scythe that lands
 * both of its sweeps.
 */
export const ROLLER_FRACTION = 0.3

/**
 * How far ahead the ball raises the corner warning.
 *
 * Slightly beyond the visible road, so the badge is already up as the ball comes
 * over the top edge of the screen. The badge's job is to move the player's eye
 * to the road, and it can only do that BEFORE there is something to see there.
 */
export const ROLLER_WARN_AHEAD = 14

// ─── bomber ─────────────────────────────────────────────────────────────────
//
// It sprints at the squad, plants, burns a fuse, and takes half of everyone
// standing near it. The whole fight is one idea: it comes to WHERE YOU ARE, so
// where you are is the thing you get to choose. Lure it to one rail, then cross
// to the other.
//
// ── Why the lure is load-bearing ──
//
// `steerTo` clamps the crowd's anchor to ±(LANE_HALF − 0.4) = 4.1, so from the
// centre line the biggest move available is 4.1 and from one rail it is 8.2.
// The distance that actually matters is not that number, though — it is how far
// the NEAREST surviving body ends up from the blast, and the crowd has depth as
// well as width. Measured on stage 5, at the moment the fuse runs out:
//
//   waited on the centre line, then ran for a rail   nearest body 3.06 away
//   lured it to one rail first, then crossed          nearest body 6.96 away
//
// `BOMBER_BLAST_R` sits between them, which is the fight: the lure is a clean
// escape and the late scramble is not. Both numbers are asserted directly in
// `tests/game/minibossPool.test.ts` — as outcomes, so the claim is re-measured
// rather than re-asserted — so a tuning pass cannot quietly turn the bomber into
// either a free hit or an unavoidable one.

/**
 * How fast it closes, world units per second.
 *
 * Faster than the crowd runs, because a bomber that could be outrun forwards
 * would be answered by doing nothing at all. Closing speed is this plus the
 * stage's run speed, so the approach is about two seconds from the top of the
 * screen: long enough to shoot at, short enough to read as a sprint.
 */
export const BOMBER_SPEED = 6.2

/**
 * How fast it may slide sideways while chasing, world units per second.
 *
 * Deliberately far slower than the crowd's own anchor, which settles a
 * full-lane move in about a third of a second (`STEER_SPRING` = 13). That gap IS
 * the lure: the bomber commits to where the crowd was, and the crowd can always
 * be somewhere else by the time it arms. A bomber that tracked as fast as the
 * player steers would be a coin flip on reaction time instead of a plan.
 */
export const BOMBER_TRACK = 4

/**
 * How far in front of the crowd it stops, world units.
 *
 * It stops SHORT rather than arriving on top of the squad, and that is geometry
 * rather than flavour. A bomber planted inside the crowd would be dodged by the
 * crowd's own forward motion — the road carries the squad ~5.4 units during the
 * fuse, which is more than the blast is wide — so the attack would resolve
 * itself and the player would learn that bombers do nothing. Planted 3.2 ahead
 * and holding the road (see `stepFoes`), the crowd walks INTO the blast unless
 * it steers, which is the sentence the fight is trying to say.
 */
export const BOMBER_PLANT_GAP = 3.2

/**
 * Seconds between planting and going off.
 *
 * A second is a long telegraph by this game's standards — the scythe gets 0.3,
 * the boss 1.0 — and it is priced for the move it asks for: crossing the road is
 * the biggest input the game has, and the fuse has to cover the crowd's settle
 * time as well as the player's reaction.
 */
export const BOMBER_FUSE = 1

/**
 * Blast radius, world units.
 *
 * Sits between the two measured escapes in the note above: comfortably past the
 * 3.06 a late scramble off the centre line buys, comfortably short of the 6.96 a
 * lure buys. See that note — this number is the fight.
 *
 * It was 2.6 first, from the arithmetic alone (`BOMBER_BLAST_R + CROWD_MAX_R`
 * against the 4.1 the steer clamp allows), and the arithmetic was wrong because
 * it only counted WIDTH. The bomber plants ahead of the crowd, so at the moment
 * it goes off the nearest body is a diagonal away, not a sideways one — 3.06
 * rather than 2.45 — and 2.6 measured as a totally clean dodge from the centre
 * line, which is exactly the free hit this fight must not be.
 *
 * Bigger than anything else that lands on the ground here except a charged boss
 * swing (5.1), and that is proportionate: it is the only attack in the game that
 * comes to where you are standing.
 */
export const BOMBER_BLAST_R = 3.6

/**
 * Share of the current squad one detonation takes.
 *
 * ── "Fixed", and what that does and does not mean ──
 *
 * Fixed in SHAPE: a flat share of whatever the squad currently is, and
 * deliberately NOT scaled by `endlessPressure` the way the sweep and the slam
 * are. There is nowhere for that dial to push it — 0.5 is already
 * `SLAM_FRACTION_MAX`, the documented ceiling past which "a percentage attack is
 * a coin flip on whether the run continues rather than a hit that can be played
 * around". The bomber opens at the ceiling and stays there for the whole endless
 * road.
 *
 * It is NOT fixed against the two concessions every other percentage attack in
 * this game passes through — `earlyBigHitMul` and `slamReliefFor`. That is a
 * deliberate call, and the argument is the one that put the sweep through them:
 * those two are not difficulty knobs, they are the onboarding cut and the
 * anti-wall relief, and a player who has lost the same stage four times is being
 * helped by every other channel that takes survivors away. Exempting one attack
 * would make the bomber the single thing on the road a stuck player gets no help
 * against — and it would be the newest, least-understood thing there.
 *
 * The counter-argument is real and worth recording: the dodge is total, so
 * softening it can teach a stuck player that standing still is survivable. It is
 * outweighed because the relief bottoms out at ×0.42, and a blast that still
 * takes a fifth of the crowd is nobody's idea of free.
 */
export const BOMBER_FRACTION = 0.5

// ─── gunner ─────────────────────────────────────────────────────────────────
//
// It holds at range and fires a slow, fat bolt down the road. The bolt kills the
// survivors it passes THROUGH — it is a line, not a circle — so the crowd's own
// width is what it costs, and stepping the crowd out of the line costs nothing
// at all.
//
// It is the third of three deliberately different questions. The scythe crosses
// the whole road and asks "how hard do you hit"; the roller owns half the road
// and asks "which side are you on"; the gunner draws one line through the middle
// of wherever you happen to be standing and asks "are you still there".

/**
 * How far in front of the crowd it plants, world units.
 *
 * Further out than any other elite (`ELITE_HOLD_AHEAD` is 2.4), and the fight
 * cannot do without it: the bolt's flight IS the dodge window, so the flight has
 * to be long enough to be one. At 5 units and `BOLT_SPEED` the round is in the
 * air for about three quarters of a second on top of its wind-up.
 *
 * It sits just inside `ELITE_DRAG_LEAD` = 6, so the road winds down to roughly
 * two thirds speed during the fight rather than to the crawl a scythe imposes —
 * a stand-off should feel like being held at arm's length, not like being pinned.
 */
export const GUNNER_STANDOFF = 5

/**
 * Seconds between locking the shot and firing it.
 *
 * The aim is locked at the START of this window, exactly as the boss locks its
 * slam, so the line the player is shown is the line the bolt will take. Half a
 * second is short of the boss's full second because the bolt then spends another
 * three quarters travelling, and the warning the player answers is both.
 */
export const GUNNER_TELEGRAPH = 0.55

/**
 * Seconds between shots.
 *
 * Against `ELITE_HOLD_MAX` = 3 this is two bolts a fight, the same budget the
 * scythe's 1.5 s cadence gets. Two announced attacks is enough for the player to
 * get the second one right after reading the first.
 */
export const GUNNER_RELOAD = 1.5

/** Bolt speed, world units per second. Slow on purpose — it is a thing to be
 *  stepped out of, not a hitscan. */
export const BOLT_SPEED = 7

/**
 * Bolt radius, world units.
 *
 * Fat, as the brief asks: a 1.1-unit-wide round against a 3.3-unit-wide crowd is
 * visibly a third of the squad's frontage, which is what makes it readable at a
 * glance on a phone. Clearing it entirely takes `BOLT_R + CROWD_MAX_R` = 2.2 of
 * lateral travel, which the crowd covers inside the wind-up alone.
 */
export const BOLT_R = 0.55

/**
 * Share of the current squad one bolt may take.
 *
 * The bolt only ever kills survivors it actually passes through, so this is a
 * CEILING on a geometric toll rather than a bill of its own. It exists because
 * the geometry alone is too sharp: a 1.1-wide swath through a 3.3-wide disc
 * covers 62 % of the bodies in it, which is a run-ender for one missed step and
 * worse than anything else in the game, the boss included.
 *
 * 0.22 × two bolts a fight ≈ the scythe's two sweeps at 0.2. A partial dodge
 * still pays partially, because the swath decides who is even eligible — this
 * only caps the top.
 */
export const GUNNER_FRACTION = 0.22

/** How long a bolt lives before it gives up, seconds. A backstop only: a bolt
 *  normally ends by leaving the road behind the crowd or by spending itself. */
export const BOLT_LIFE = 4

/** How far behind the crowd a bolt is still worth simulating. */
export const BOLT_TRAIL = 12
