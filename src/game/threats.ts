// The claw's geometry is DERIVED from the crowd's own disc (see `CLAW_SPACING`),
// so this file reads the one number that defines it rather than repeating it.
// `survival.ts` imports back from here, but only `import type` — erased before
// runtime — so there is no module cycle.
import { CROWD_MAX_R } from '@/game/survival'

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
