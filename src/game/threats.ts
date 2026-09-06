// The road's width, which the roller's geometry is derived from rather than
// duplicating. `survival.ts` imports only TYPES from this file, so that import
// is erased at build time and this one is not a cycle.
// The claw's geometry is DERIVED from the crowd's own disc (see `CLAW_SPACING`),
// so this file reads the one number that defines it rather than repeating it.
// `survival.ts` imports back from here, but only `import type` — erased before
// runtime — so there is no module cycle.
import { CROWD_MAX_R, LANE_HALF } from '@/game/survival'

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
// ─── What each boss kind costs, before it is played ─────────────────────────

/**
 * Health multiplier for a boss kind, on top of `bossHpScale`.
 *
 * A kind is not just a different animation: two of the four carry EFFECTIVE
 * health that never appears on the bar. The healer puts `HEAL_FRACTION` back
 * three times, so its bar is worth x1.6 of itself; the summoner spends
 * `SUMMON_WAVES_MAX * SUMMON_PER_WAVE * SUMMON_HP_SHARE` of its own bar on
 * bodies that have to be shot at (or run from) before the bar can be. Pricing
 * that off the printed number instead of correcting for it would make the same
 * stage number mean four different fight lengths, and the one the player learns
 * the stage on would be whichever they met first.
 *
 * So the printed bar is cut by exactly what the kind gives back:
 *
 *   healer    1 / (1 + HEAL_FRACTION x HEAL_EXPECTED)
 *   summoner  1 / (1 + SUMMON_WAVES_MAX x SUMMON_PER_WAVE x SUMMON_HP_SHARE)
 *
 * The summoner's is exact — every body it fields is health it definitely spends.
 * The healer's is not, and that is what `HEAL_EXPECTED` is for: it is priced on
 * the heals a fight ACTUALLY sees rather than on the cap, because pricing on the
 * cap charges every player for three heals and only a losing one ever meets the
 * third.
 *
 * The claw is 1 on purpose: its rake is priced at exactly a slam's share and
 * lands on the same cadence, so it adds no health, only a different question.
 */
export const bossHpMulFor = (kind: BossKind): number => {
  switch (kind) {
    case 'healer': return 1 / (1 + HEAL_FRACTION * HEAL_EXPECTED)
    case 'summoner': return 1 / (1 + SUMMON_WAVES_MAX * SUMMON_PER_WAVE * SUMMON_HP_SHARE)
    default: return 1
  }
}

/**
 * ─── What a guard phase turns into, per kind ────────────────────────────────
 *
 * A guard gate is a FLOOR on how long the climax lasts: the boss plants, goes
 * immune, and pays the phase off (see `bossGuardGates`). It is a BARGAIN — the
 * player forfeits damage, the boss owes them a beat — and every kind keeps it,
 * but what the beat IS differs, and that is the whole per-kind decision.
 *
 *   meteor / claw — a swing, unchanged. Overwhelming DPS may not skip the fight,
 *                   and the swing it is made to throw is dodgeable, so the phase
 *                   costs a good player nothing but time.
 *   healer        — a cast, and the gate is load-bearing rather than inherited.
 *                   Measured on the shared cadence the healer's fight is about
 *                   two casts long, so an every-third heal never fires once and
 *                   the whole archetype is dead code; the gates are what buy the
 *                   third cast. That the heal then pushes the bar back ABOVE a
 *                   gate already spent is not a bug: it is the only moment in
 *                   the game where a health bar goes up, and it is the point of
 *                   the creature. `guarded` has already been incremented, so the
 *                   same gate can never re-arm.
 *   summoner      — a WAVE. This is the one that had to be thought about rather
 *                   than inherited. The first pass gave the summoner no gates on
 *                   the grounds that a boss with no attack has nothing to pay a
 *                   phase off with, and measured, that made it a non-fight: at a
 *                   tuned build it died in 0.73 s having spent ZERO waves, so
 *                   the player never met a single skeleton and the archetype
 *                   existed only in the source — the same failure as the
 *                   healer's unreachable heal, from the opposite direction.
 *                   Paying the phase with a wave fixes it without touching the
 *                   rate: the summoner's identity now shows up at least twice
 *                   however fast it dies, and `SUMMON_WAVES_MAX` still bounds
 *                   the total.
 */
export const bossGuardPayoff = (kind: BossKind): 'swing' | 'wave' =>
  kind === 'summoner' ? 'wave' : 'swing'

// ─── The claw ───────────────────────────────────────────────────────────────
//
// Three parallel gouges down the road with clear pockets between them. Not a
// ring: a ring asks "are you near this point", and the answer is a scramble away
// from it. A rake asks "which pocket are you in", and the answer is a COMMIT to
// one side — the same decision a gate bank asks, arriving in the one fight where
// the player has stopped steering for payouts.
//
// ── Why the spacing is derived and not drawn ──
//
// The first pass spaced the furrows at ~2.6, which is what a claw looks like.
// Measured, the pockets caught 37 % of a perfectly-dodging crowd against 38 % of
// a stationary one — the "dodge" was worth one percentage point, because a crowd
// 3.3 units across cannot fit in a 1.9-unit pocket no matter where it stands. An
// attack that cannot be answered is not a hard attack, it is a tax with a fancy
// telegraph.
//
// So the geometry runs the other way round: the pocket is sized from the CROWD'S
// DISC and the furrows are placed wherever that puts them. It looks less like a
// claw and it is a dodge.

/** How many gouges. Three is the fewest that reads as a rake and still leaves
 *  the player a choice of which pocket to take. */
export const CLAW_FURROWS = 3

/** Half-width of one gouge at the first rake — the lethal strip, and the strip
 *  the telegraph is drawn from. */
export const CLAW_FURROW_HALF_W = 0.34

/**
 * ...and it widens with every rake thrown, exactly as `SLAM_RADIUS_GROWTH`
 * widens the meteor's ring. This is the claw's half of the rage curve: a long
 * fight squeezes the pockets rather than merely arriving faster.
 */
export const CLAW_FURROW_GROWTH = 0.014
/**
 * The squeeze has a hard stop, and the stop is the invariant of the whole
 * attack: `CLAW_SPACING` is derived from THIS number, so the pocket between two
 * fully-grown furrows still holds the crowd's disc with `CLAW_DODGE_MARGIN` to
 * spare. Raise it without raising the spacing and the last third of a long claw
 * fight becomes undodgeable — silently, and only for the players who were
 * already losing.
 */
export const CLAW_FURROW_HALF_W_MAX = 0.44

/** Clear road left either side of a full-size crowd sitting in a pocket. Small
 *  on purpose: the dodge should be a commit, not a stroll. */
export const CLAW_DODGE_MARGIN = 0.15

/** Half the depth of the rake, along the road.
 *
 *  Sized to swallow the crowd's whole depth (`CROWD_MAX_R * CROWD_SQUASH` is
 *  1.19, and the rail redistribution moves a slot up to 1.3 further back) so
 *  that the claw is a purely LATERAL question. A rake the crowd could partly
 *  stand behind would turn one clean decision — which pocket — into two muddy
 *  ones. */
export const CLAW_HALF_DEPTH = 2.2

/** How hard the rake leads the crowd's drift — the same lead an ordinary slam
 *  uses, because it is the same question asked about a different shape. */
export const CLAW_LEAD = 0.35

/**
 * Distance between two gouge centres.
 *
 * DERIVED. `2 * (crowd radius + widest furrow + margin)` is the smallest spacing
 * at which a crowd parked in a pocket clears both neighbours for the whole
 * fight. Every other number here can be tuned by feel; this one is an
 * inequality, and `tests/game/bossKinds.test.ts` asserts it directly so it
 * cannot drift back to whatever looks most like a claw.
 */
export const CLAW_SPACING = 2 * (CROWD_MAX_R + CLAW_FURROW_HALF_W_MAX + CLAW_DODGE_MARGIN)

/** Half-width of the gouge about to be thrown — the ONE definition, read by the
 *  simulation that kills with it and by the telegraph that draws it. Mirrors
 *  `slamRadiusFor`. */
export const clawFurrowHalfW = (rakes: number): number =>
  Math.min(CLAW_FURROW_HALF_W_MAX, CLAW_FURROW_HALF_W + Math.max(0, rakes) * CLAW_FURROW_GROWTH)

/**
 * Where the gouges land for a rake aimed at `centre`.
 *
 * Deliberately NOT clamped into the lane. A rake aimed at a crowd hugging a rail
 * throws one of its furrows off the road, which costs that crowd one of its two
 * pockets — being cornered should cost options, and clamping the pattern back
 * on-road would hand the rail-hugger the same choice as everybody else.
 */
export const clawLaneXs = (centre: number): number[] => {
  const out: number[] = []
  const first = -((CLAW_FURROWS - 1) / 2) * CLAW_SPACING
  for (let i = 0; i < CLAW_FURROWS; i++) out.push(centre + first + i * CLAW_SPACING)
  return out
}

/** Is `x` inside any gouge of a rake? The kill test and nothing else — the
 *  telegraph draws the same strips from the same numbers. */
export const inClawFurrow = (x: number, lanes: readonly number[], halfW: number): boolean => {
  for (const lx of lanes) if (Math.abs(x - lx) <= halfW) return true
  return false
}

// ─── The healer ─────────────────────────────────────────────────────────────
//
// Two casts and a heal, on a loop. It is the only creature in the game that can
// undo damage the player has already done, which makes it the one fight that is
// a genuine DPS CHECK rather than a dodging test — and that is exactly why every
// number below is bounded.

/**
 * Seconds between casts, flat.
 *
 * It has its own cadence and that is the point. On the shared slam clock
 * (`SLAM_CD_BASE` 2.4 s, raging down) the fight is about two casts long, so an
 * every-third heal never fires once — the archetype existed only in the source.
 * At 1.7 s the third cast lands at 5.1 s, and the guard gates (see
 * `bossGuardPayoff`) put a floor under the fight that guarantees the player
 * reaches it. Measured in the arena probe, the heal fires in every fight that
 * lasts as long as a boss fight is supposed to.
 *
 * ── Why not faster ──
 *
 * 1.15 s was tried first, and it is shorter than `BOLT_FLIGHT_S`: every bolt was
 * still in the air when the next one was aimed, so there was never a frame with
 * nothing incoming and the "dodge" degenerated into being caught by bolt N while
 * leaving bolt N+1. Measured against a probe that answers every telegraph
 * correctly, the healer took **92 %** of the crowd and was killed on two seeds
 * of three, against a meteor's 0 % on all three. A projectile the player is
 * supposed to step around has to leave them a frame in which to step.
 *
 * FLAT, where the meteor's cadence rages down: the healer's escalation is the
 * heal itself — a long fight literally undoes the player's work — and tightening
 * the clock as well would be two escalations pulling the same way, which is how
 * a fight stops being winnable rather than becomes harder.
 */
export const HEALER_CAST_CD = 1.7

/** Wind-up, shorter than `SLAM_TELEGRAPH` because the cadence is. A one-second
 *  tell on a 1.15 s loop means the boss is permanently winding up, which reads
 *  as no tell at all. */
export const HEALER_TELEGRAPH = 0.7

/** Every third cast is the heal. */
export const HEAL_EVERY = 3

/** ...and it puts back this much of the boss's MAXIMUM health. */
export const HEAL_FRACTION = 0.2

/**
 * ...at most this many times, ever.
 *
 * The bound is the whole difference between an archetype and an unwinnable
 * fight, and it is the SAME trap the summoner's wave cap fixes wearing a
 * different costume: a heal on a loop is a regeneration RATE, and any player
 * whose DPS falls under that rate never kills the boss at all — not slowly, at
 * all. At 20 % every 3.45 s the rate is 5.8 % of the bar a second, which a
 * genuinely under-built run is below.
 *
 * Three casts turns the rate into a TOTAL: 60 % of the bar, once, and then the
 * fight is a normal fight. A cast past the cap falls through to a bolt rather
 * than being skipped — the boss never stands there doing nothing.
 */
export const HEAL_MAX_CASTS = 3

/**
 * How many heals a fight is PRICED for, against the three it may at most see.
 *
 * Measured in the arena probe: a competent build that answers the telegraphs
 * meets one heal, a build that is losing meets all three, and the guard gates
 * put the median at about two. Charging the printed bar for three would hand the
 * discount to exactly the player who never triggers them — a good one — and
 * charge the full surcharge to the player who is already losing.
 *
 * Deliberately a separate number from `HEAL_MAX_CASTS` rather than the same one
 * reused: one is a safety bound and the other is a price, and collapsing them
 * would mean a tuning pass on either silently moved the other.
 */
export const HEAL_EXPECTED = 2

/**
 * How long a bolt spends in the air, seconds — a TIME, not a speed.
 *
 * Slow is the whole attack: the crowd does not advance during the boss phase
 * (`stepAnchor` gives it no forward speed), so a bolt in flight is a second of
 * "be somewhere else" with a body to watch instead of a mark on the floor.
 *
 * ── Why a fixed time and not a fixed speed ──
 *
 * Measured in the arena probe: the boss spawns at `arenaY + 12` and walks down
 * to `BOSS_HOLD_AHEAD` at 0.85 units a second, which takes 9.6 s — longer than
 * any fight. So a real boss spends the whole fight somewhere between 12 and 6
 * units out, and at a fixed 3.2 u/s that made the dodge window anything from 1.2
 * to 3.8 seconds, decided by how far the boss happened to have walked. Under it
 * the healer's early bossBolts simply never arrived: at the tuned build, three seeds
 * out of three took **zero** bolt damage on a crowd that never moved.
 *
 * A fixed flight time is the same rule `SLAM_TELEGRAPH` is built on — the player
 * gets the same window every time, so the window is learnable — and it makes the
 * bolt visibly hurry when it is thrown from further away, which is the correct
 * read on a thing that has further to come.
 */
export const BOLT_FLIGHT_S = 1.2

/**
 * How hard the bolt leads the crowd's drift.
 *
 * Its own number rather than the slam's 0.35 or the rake's `CLAW_LEAD`, even
 * though it currently sits at the same value: a bolt is the only attack whose
 * aim is resolved at LAUNCH and then travels, so the lead is doing a different
 * job here — it decides where a straight line is pointed, not where a circle
 * lands — and the day one of the three is retuned the other two must not move
 * with it.
 */
export const BOLT_LEAD = 0.35

/** How close a survivor has to be for the bolt to go off. Smaller than the
 *  blast: the thing that trips it is a body, the thing that kills is the burst. */
export const BOLT_HIT_R = 0.5

/** ...and the burst it makes. Well under `SLAM_RADIUS`, because a bolt is the
 *  healer's ORDINARY cast and arrives about twice as often as a slam. */
export const BOLT_BLAST_R = 1.35

/**
 * What a bolt takes, as a fraction of what a slam would.
 *
 * Parity arithmetic first: a meteor lands one slam per `SLAM_CD_BASE` = 2.4 s, a
 * healer a bolt on two casts in every three of a 1.7 s loop — one every 2.55 s —
 * so equal cost per second would price a bolt at 1.06 slams.
 *
 * It is deliberately well UNDER that. The healer already charges a slow player
 * 60 % of a health bar for being slow; charging them the crowd at the same rate
 * as a meteor is the same mistake billed twice, and the compounding is what
 * turns a hard fight into an unwinnable one — the fight gets longer, so more
 * bossBolts land, so the crowd shrinks, so the fight gets longer. At 0.6 the healer
 * costs about 57 % of a meteor per second across a fight roughly 1.6x as long,
 * which lands the TOTAL within about a tenth of the control.
 */
export const BOLT_SHARE_MUL = 0.6

/** Backstop only — a bolt that hits nothing leaves the arena long before this. */
export const BOSS_BOLT_LIFE = 6

/**
 * A healer's projectile, in flight.
 *
 * It lives here rather than beside `Boss` in `survival.ts` because it belongs to
 * exactly one boss kind: an entity that only one branch of `stepBoss` can create
 * or read has no business in the file that describes the game's shared rules.
 */
export interface BossBolt {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  /** Seconds left before it gives up and fades. */
  life: number
  /** Blast radius, carried on the projectile so the burst and the sprite can
   *  never disagree about how big the thing that just went off was. */
  radius: number
}

// ─── The summoner ───────────────────────────────────────────────────────────
//
// It never attacks. It stands in the road making more road.
//
// ── Why the TOTAL is capped, and why tuning the rate does not work ──
//
// Spawn pressure is a RATE subtracted from the player's damage: bodies soak
// rounds and eat survivors, so above a threshold rate the boss's bar never moves
// net-downward and the fight is not hard, it is impossible. Measured at half the
// benchmark DPS an uncapped summoner was killed on no seed at all and cost 100 %
// of the squad every time — and no amount of tuning the rate fixes that, because
// the failure is that a rate has no total. It is the same shape as the healer's
// regeneration, and it takes the same fix.
//
// So the summoner has a wave budget it spends once. After `SUMMON_WAVES_MAX` the
// road stops filling and the fight becomes an ordinary fight against whatever is
// left standing, which a losing player can still win.

/** Seconds between waves. */
export const SUMMON_CD = 1.4

/** How long a summoner stands planted and immune before a guard phase's wave
 *  claws its way up. The phase turn's own tell — long enough to read as the
 *  fight changing, short enough that it is never a wait. */
export const SUMMON_TELEGRAPH = 0.9

/** Bodies per wave. */
export const SUMMON_PER_WAVE = 4

/** ...and how many waves it may EVER field. The bound, not a pacing number. */
export const SUMMON_WAVES_MAX = 6

/**
 * One summon's health, as a share of the BOSS's own bar.
 *
 * Priced off the boss and not off the stage's husk, and that is a correction
 * rather than a preference: foe health is LINEAR in the stage (`foeHpScale`) and
 * boss health is exponential over stages 5-12 (`bossHpScale`), so a wall priced
 * as husks is a real wall at stage 6 and wet paper by stage 20 — the summoner
 * would quietly stop being a summoner exactly where the player got good.
 *
 * 2.5 % x 24 bodies is 60 % of the boss's bar, which `bossHpMulFor` takes
 * back off the printed number so the whole fight is the same size as everyone
 * else's.
 */
export const SUMMON_HP_SHARE = 0.025

/**
 * How hard a summon bites, against the husk it is wearing.
 *
 * Cut, because eighteen of them arrive at a crowd that cannot walk away from
 * them: the boss phase gives the crowd no forward speed, so a summoned pack
 * stands on the squad for the rest of the fight rather than being driven past.
 * At the husk's full bite the wave cap bounds the fight's LENGTH and nothing
 * bounds its COST.
 */
export const SUMMON_BITE_MUL = 0.7

/** Which body they wear. A skeleton knight — the roster's marrowknight, so the
 *  summoner is calling up something the player has already learned to read. */
export const SUMMON_TYPE = 'husk'
export const SUMMON_DESIGN = 'marrowknight'

/** How wide across the road a wave arrives. Wider than the crowd, so a wave is
 *  never a single column the player can simply not be under. */
export const SUMMON_SPREAD = 3.2

/**
 * How far up the road, AHEAD OF THE CROWD, a wave claws its way up.
 *
 * Not "in front of the boss", which is where it started and where it did
 * nothing. Measured: the boss spawns at `arenaY + 12` and walks in at 0.85 units
 * a second, so for the whole of a normal fight it is eight to twelve units out —
 * and a husk closes that at 1.7 u/s, which is six seconds. Every wave summoned
 * at the boss's feet arrived after the fight had ended: three seeds at a tuned
 * build lost **0 %** of the squad to a summoner, which is not a boss, it is a
 * cutscene.
 *
 * Sizing it off the CROWD instead makes the wave a threat with a clock the
 * player can count: 4.8 units at husk speed, against a crowd whose front rank
 * sits 1.2 units ahead of its own centre, is about 2.1 s from the ground opening
 * to the first bite — long enough to shoot or steer, short enough that ignoring
 * it is a decision. It is also the honest read on what a
 * summoner does — the bones come up out of the road in front of you, not out of
 * a pocket ten units away.
 */
export const SUMMON_AHEAD = 4.8
