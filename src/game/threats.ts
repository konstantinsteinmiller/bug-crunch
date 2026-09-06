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
