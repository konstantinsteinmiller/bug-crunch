/**
 * ─── Stars ──────────────────────────────────────────────────────────────────
 *
 * Three objectives per level; each one met is a star. The first is always
 * "finish the level", so a player who can beat a level always gets something —
 * the other two are the reasons to come back to a level they have already beaten.
 *
 * Pure: `evaluate` takes a finished run's tally and returns three booleans.
 * Nothing here knows about the save, the HUD or the sim.
 *
 * ── Why the first star is always `clear` ──
 *
 * The star is the currency that unlocks worlds and prices shoes. If a level
 * could be finished for zero stars, a player who is struggling would be
 * progressing through the campaign while going BACKWARDS against the shop that
 * exists to help them — the classic difficulty spiral. One guaranteed star per
 * clear means the game can always sell them the tool for the next wall.
 */

import type { BugId } from '@/game/bugs'

export type Objective =
  /** Finish the quota before the clock runs out. Always star 1. */
  | { kind: 'clear' }
  /** Reach an `n`× Splat Chain at any point. */
  | { kind: 'combo'; n: number }
  /** Take no spike damage all level. */
  | { kind: 'noSpike' }
  /** Finish with at least `n` seconds still on the clock. */
  | { kind: 'time'; n: number }
  /** At least `n`% of stomps landed on something (a ricochet counts as a hit —
   *  see `combo.ts` for why). */
  | { kind: 'accuracy'; n: number }
  /** Trigger Splat Fever `n` times. */
  | { kind: 'fever'; n: number }
  /** Squish at least `n` of one kind. */
  | { kind: 'kind'; id: BugId; n: number }
  /** Squish at least `n` bugs in one Fever. */
  | { kind: 'feverKills'; n: number }
  /** Miss no more than `n` stomps. */
  | { kind: 'noMiss'; n: number }
  /** Score at least `n` points. */
  | { kind: 'score'; n: number }

export type ObjectiveTriple = readonly [Objective, Objective, Objective]

/** Everything a finished level knows about itself. The sim fills this in. */
export interface RunTally {
  /** The quota was met before the clock expired. */
  cleared: boolean
  /** Bugs squished, all kinds. */
  squishes: number
  /** Per-kind squish counts. */
  byKind: Partial<Record<BugId, number>>
  /** Longest chain held. */
  bestCombo: number
  /** Seconds left when the level ended. 0 on a loss. */
  timeLeft: number
  /** Stomps that hit nothing at all. */
  misses: number
  /** Stomps that landed on something (kills, hurts and ricochets). */
  hits: number
  /** Times the player was spiked. */
  spikes: number
  /** Fevers triggered. */
  fevers: number
  /** Most bugs squished inside one Fever. */
  bestFeverKills: number
  /** Final score. */
  score: number
  /**
   * Blows that rang off armour the shoe could not open.
   *
   * Not a mistake — a ricochet keeps the chain (see `combo.ts`) — but a lot of
   * them is the clearest thing a failed run can say about what to try next: a
   * player who clanged a shell thirty times needed the slam. `missHint` reads it.
   */
  ricochets: number
  /** Stomps that squished two or more bodies at once. The density the Rush
   *  Lines and Growth Spurt exist to create, counted so a test can see it. */
  multiKills: number
}

export const emptyTally = (): RunTally => ({
  cleared: false, squishes: 0, byKind: {}, bestCombo: 0, timeLeft: 0,
  misses: 0, hits: 0, spikes: 0, fevers: 0, bestFeverKills: 0, score: 0,
  ricochets: 0, multiKills: 0
})

// ─── So Close! — what a failed run says about the next one ─────────────────

/**
 * The one TOOL a failed run most needed, or null.
 *
 * Read off the tally rather than guessed: a run that clanged armour again and
 * again was a run that needed the slam, and a run that kept landing on spikes
 * was a run that needed to leave the caterpillars alone. Both thresholds are
 * "this happened a lot", not "this happened": a single clang is how a player
 * finds a shell, and a single spike is how they learn the caterpillar.
 */
export type MissHint = 'slam' | 'avoid'

export const MISS_HINT_RICOCHETS = 8
export const MISS_HINT_SPIKES = 3

export const missHint = (t: RunTally): MissHint | null => {
  if (t.ricochets >= MISS_HINT_RICOCHETS) return 'slam'
  if (t.spikes >= MISS_HINT_SPIKES) return 'avoid'
  return null
}

/**
 * How close a failed run came, 0..1.
 *
 * `bossHp` is the boss bar's remaining fraction on a boss level — the only
 * progress a boss level has — and is ignored everywhere else.
 */
export const nearMiss01 = (t: RunTally, quota: number, bossHp?: number): number => {
  if (bossHp !== undefined) return Math.max(0, Math.min(1, 1 - bossHp))
  return quota > 0 ? Math.max(0, Math.min(1, t.squishes / quota)) : 0
}

/**
 * The bar a failed run must clear for a Second Wind: most of the way there.
 *
 * Below it the level was a wall rather than a near thing, and the existing
 * relief (slower bugs, a longer clock — `reliefFor`) is the right help. Above
 * it the player was one push away, and a full vial on the retry is that push.
 */
export const SECOND_WIND_AT = 0.6

/**
 * Did this run meet this objective?
 *
 * Every non-`clear` objective ALSO requires the clear. A player who reached a
 * ×20 chain and then ran out of time has not three-starred anything; the star
 * row on the result screen would be lying about a level they did not finish.
 */
export const meets = (o: Objective, t: RunTally): boolean => {
  if (o.kind === 'clear') return t.cleared
  if (!t.cleared) return false
  switch (o.kind) {
    case 'combo': return t.bestCombo >= o.n
    case 'noSpike': return t.spikes === 0
    case 'time': return t.timeLeft >= o.n
    case 'accuracy': {
      const total = t.hits + t.misses
      // A run with no stomps at all cannot have been cleared, so this is only
      // reachable from a corrupt tally — treat it as not met rather than as a
      // division by zero that reads as 100 %.
      return total > 0 && (t.hits / total) * 100 >= o.n
    }
    case 'fever': return t.fevers >= o.n
    case 'kind': return (t.byKind[o.id] ?? 0) >= o.n
    case 'feverKills': return t.bestFeverKills >= o.n
    case 'noMiss': return t.misses <= o.n
    case 'score': return t.score >= o.n
  }
}

/** The three booleans, in objective order. */
export const evaluate = (objectives: ObjectiveTriple, t: RunTally): [boolean, boolean, boolean] =>
  [meets(objectives[0], t), meets(objectives[1], t), meets(objectives[2], t)]

/** How many stars the run earned, 0..3. */
export const starsEarned = (objectives: ObjectiveTriple, t: RunTally): number =>
  evaluate(objectives, t).reduce<number>((n, ok) => n + (ok ? 1 : 0), 0)

/**
 * Live progress against one objective, 0..1 — what the in-run objective strip
 * fills its bars from.
 *
 * Deliberately generous about the mid-run reading: `noSpike` and `noMiss` show
 * FULL until they are broken, because a bar that starts empty and fills as you
 * avoid something reads as a threat meter rather than as an objective.
 */
export const progress01 = (o: Objective, t: RunTally, quota: number): number => {
  const clamp = (v: number): number => Math.max(0, Math.min(1, v))
  switch (o.kind) {
    case 'clear': return quota > 0 ? clamp(t.squishes / quota) : (t.cleared ? 1 : 0)
    case 'combo': return clamp(t.bestCombo / o.n)
    case 'noSpike': return t.spikes === 0 ? 1 : 0
    case 'time': return t.cleared ? (t.timeLeft >= o.n ? 1 : clamp(t.timeLeft / o.n)) : 1
    case 'accuracy': {
      const total = t.hits + t.misses
      return total === 0 ? 1 : clamp((t.hits / total) * 100 / o.n)
    }
    case 'fever': return clamp(t.fevers / o.n)
    case 'kind': return clamp((t.byKind[o.id] ?? 0) / o.n)
    case 'feverKills': return clamp(t.bestFeverKills / o.n)
    case 'noMiss': return t.misses <= o.n ? 1 : 0
    case 'score': return clamp(t.score / o.n)
  }
}

/**
 * The i18n key for an objective's caption, and the interpolation values.
 *
 * Returned as data rather than a formatted string so the component does the
 * `t()` call — which is what keeps every player-facing word inside the locale
 * files instead of being assembled here.
 */
export const objectiveLabel = (o: Objective): { key: string; args: Record<string, unknown> } => {
  switch (o.kind) {
    case 'clear': return { key: 'objectives.clear', args: {} }
    case 'combo': return { key: 'objectives.combo', args: { n: o.n } }
    case 'noSpike': return { key: 'objectives.noSpike', args: {} }
    case 'time': return { key: 'objectives.time', args: { n: o.n } }
    case 'accuracy': return { key: 'objectives.accuracy', args: { n: o.n } }
    case 'fever': return { key: 'objectives.fever', args: { n: o.n } }
    case 'kind': return { key: `objectives.kind`, args: { n: o.n, bug: `bugs.${o.id}` } }
    case 'feverKills': return { key: 'objectives.feverKills', args: { n: o.n } }
    case 'noMiss': return { key: 'objectives.noMiss', args: { n: o.n } }
    case 'score': return { key: 'objectives.score', args: { n: o.n } }
  }
}
