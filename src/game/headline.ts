/**
 * ─── Peek: the next level's secret ──────────────────────────────────────────
 *
 * The result screen used to end on a line of text — "Up next 1-3" — which is a
 * full stop. This is the comma: ONE thing the next level has that this one did
 * not, shown as a wriggling ink silhouette under a napkin. A list gets read; a
 * silhouette gets wondered about, and the only way to find out what it is, is to
 * press forward. The curiosity gap is opened at the exact moment the last one
 * closed.
 *
 * Pure. `nextHeadline(level)` diffs the next level against this one, and every
 * set piece the game has registers a row here — so a feature added later is
 * announced the day it lands, not whenever somebody remembers the result screen.
 *
 * ── The priority ──
 *
 *   a party that plays straight after this screen
 *   > the next WORLD   on a world's last level, a postcard of the next floor
 *   > a new CREATURE   ("what IS that?" is the strongest question there is)
 *   > an EVENT         a twist, a shoebox
 *   > a new FLOOR OBJECT
 *   > a new rush FORMATION
 *   > the BOSS         a crowned silhouette, and the crown pips counting down
 *
 * A debut level never falls through to the boss: `tests/game/headline.test.ts`
 * walks all forty.
 */

import type { BugId } from '@/game/bugs'
import type { BossId } from '@/game/bosses'
import type { HazardId } from '@/game/hazards'
import type { ShoeId } from '@/game/shoes'
import type { TwistId } from '@/game/twists'
import type { MoveId } from '@/game/moves'
import { moveForLevel } from '@/game/moves'
import {
  BOSS_FIGHTS, LEVELS_PER_WORLD, TOTAL_LEVELS, clampLevel, indexOf, levelSpec, partyAfter,
  worldOf, type RushShape, type WorldId
} from '@/game/stages'

export type Headline =
  | { kind: 'party'; world: WorldId }
  | { kind: 'bug'; bug: BugId }
  | { kind: 'twist'; twist: TwistId }
  | { kind: 'trial'; shoe: ShoeId }
  | { kind: 'rush'; shape: RushShape; bug: BugId; lead?: BugId }
  | { kind: 'hazard'; hazard: HazardId }
  | { kind: 'world'; world: WorldId }
  | { kind: 'boss'; boss: BossId; trophy: MoveId | null }

export interface Peek {
  /** The level the peek is about — what the forward button starts. */
  level: number
  headline: Headline
  /** Levels until the next boss fight, counting the peeked one: 1 means the
   *  peeked level IS the boss. 0 when there is none left. Drives the crown pips. */
  toBoss: number
}

/** The first boss fight at or after `level`, or null. */
export const nextBossLevel = (level: number): number | null => {
  const from = clampLevel(level)
  for (let n = from; n <= TOTAL_LEVELS; n++) if (BOSS_FIGHTS[n]) return n
  return null
}

/** A rush formation `level` has that no earlier level in its world had. */
const newFormation = (level: number): Headline | null => {
  const spec = levelSpec(level)
  const seen = new Set<string>()
  const worldStart = (worldOf(level) - 1) * LEVELS_PER_WORLD + 1
  for (let n = worldStart; n < level; n++) {
    for (const r of levelSpec(n).rushes) seen.add(`${r.shape}:${r.lead ?? r.bug}`)
  }
  for (const r of spec.rushes) {
    if (r.practice) continue
    const key = `${r.shape}:${r.lead ?? r.bug}`
    if (!seen.has(key)) return { kind: 'rush', shape: r.shape, bug: r.bug, ...(r.lead ? { lead: r.lead } : {}) }
  }
  return null
}

/**
 * What is NEW on `next`, measured against `prev` — or null when nothing is.
 * The body of `nextHeadline`, split out so the priority reads top to bottom.
 */
const whatsNew = (prev: number, next: number): Headline | null => {
  const a = levelSpec(prev)
  const b = levelSpec(next)
  // A boss level is about its boss and nothing else; the boss branch below
  // handles it, with the trophy it is guarding.
  if (b.boss) return null
  const before = new Set(a.roster.map((r) => r.id))
  // A creature that DEBUTS here (not merely one the last level rolled rarely).
  for (const r of b.roster) {
    if (!before.has(r.id)) return { kind: 'bug', bug: r.id }
  }
  if (b.twist) return { kind: 'twist', twist: b.twist }
  if (b.trial) return { kind: 'trial', shoe: Array.isArray(b.trial) ? b.trial[0] : (b.trial as ShoeId) }
  const formation = newFormation(next)
  const newHazard = b.hazards.find((h) => !a.hazards.includes(h))
  if (newHazard) return { kind: 'hazard', hazard: newHazard }
  if (formation) return formation
  return null
}

/**
 * The peek for the result screen of `level`.
 *
 * `afterParty` is set on the party's own card: the party has already happened,
 * so what is peeked is the level after it.
 */
export const nextHeadline = (level: number, afterParty = false): Peek | null => {
  const id = clampLevel(level)
  if (id >= TOTAL_LEVELS) return null
  const next = id + 1
  const boss = nextBossLevel(next)
  const toBoss = boss === null ? 0 : boss - next + 1

  if (!afterParty && partyAfter(id)) {
    return { level: next, headline: { kind: 'party', world: worldOf(id) }, toBoss }
  }

  // Across a world boundary the next thing is a whole new PLACE, and that beats
  // anything on its first board — a postcard of the floor they are going to.
  if (indexOf(next) === 1 && next > 1) {
    return { level: next, headline: { kind: 'world', world: worldOf(next) }, toBoss }
  }

  const fresh = whatsNew(id, next)
  if (fresh) return { level: next, headline: fresh, toBoss }

  if (boss !== null) {
    const fight = BOSS_FIGHTS[boss]!
    return { level: next, headline: { kind: 'boss', boss: fight.boss, trophy: moveForLevel(boss) }, toBoss }
  }
  return null
}
