import { describe, expect, it } from 'vitest'
import {
  BOSS_FIGHTS,
  LEVELS_PER_WORLD,
  TOTAL_LEVELS,
  WORLDS,
  WORLD_COUNT,
  allLevels,
  clampLevel,
  indexOf,
  isBossLevel,
  isLevelUnlocked,
  levelCast,
  levelLabel,
  levelPayout,
  levelSpec,
  starsToNextWorld,
  worldOf,
  worldOpenLevel,
  type RosterEntry,
  type WorldId
} from '@/game/stages'
import { bugSpec, rosterForLevel, type BugId } from '@/game/bugs'
import { COMBO_LADDER } from '@/game/combo'
import { STARTER_SHOE, shoeSpec } from '@/game/shoes'
import { isHazardId } from '@/game/hazards'
import { BOSS_IDS } from '@/game/bosses'

const WORLD_IDS: WorldId[] = [1, 2, 3, 4]

describe('the campaign shape', () => {
  it('is four worlds of ten', () => {
    expect(WORLD_COUNT).toBe(4)
    expect(LEVELS_PER_WORLD).toBe(10)
    expect(TOTAL_LEVELS).toBe(40)
    expect(allLevels()).toHaveLength(TOTAL_LEVELS)
  })

  it('clamps anything onto the campaign', () => {
    expect(clampLevel(0)).toBe(1)
    expect(clampLevel(-99)).toBe(1)
    expect(clampLevel(1)).toBe(1)
    expect(clampLevel(TOTAL_LEVELS)).toBe(TOTAL_LEVELS)
    expect(clampLevel(TOTAL_LEVELS + 500)).toBe(TOTAL_LEVELS)
    expect(clampLevel(Number.NaN)).toBe(1)
    expect(clampLevel(7.8)).toBe(7)
  })

  it('addresses every level as world-index', () => {
    expect(worldOf(1)).toBe(1)
    expect(indexOf(1)).toBe(1)
    expect(levelLabel(1)).toBe('1-1')
    expect(levelLabel(10)).toBe('1-10')
    expect(levelLabel(11)).toBe('2-1')
    expect(levelLabel(40)).toBe('4-10')
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      expect((worldOf(n) - 1) * LEVELS_PER_WORLD + indexOf(n)).toBe(n)
    }
  })

  it('ends every world on its own boss, at full strength', () => {
    for (const world of WORLD_IDS) {
      const last = levelSpec(worldOpenLevel(world) + LEVELS_PER_WORLD - 1)
      expect(last.index).toBe(LEVELS_PER_WORLD)
      expect(last.boss).toBe(WORLDS[world].boss)
      expect(last.bossScale).toBe(1)
    }
    expect(BOSS_IDS).toHaveLength(WORLD_COUNT)
  })

  it('puts bosses exactly where BOSS_FIGHTS says, and nowhere else', () => {
    const bosses = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).filter(isBossLevel)
    expect(bosses).toEqual([4, 10, 20, 30, 40])
    expect(bosses).toEqual(Object.keys(BOSS_FIGHTS).map(Number))
    for (const n of bosses) expect(levelSpec(n).boss).toBe(BOSS_FIGHTS[n]!.boss)
  })

  // The owner's call: the Queen moves into the retention funnel at half
  // strength, and stays at 1-10 at full strength as the world's finale.
  it('fights the Goliath Queen twice in world 1: half strength on 1-4, full on 1-10', () => {
    expect(levelSpec(4).boss).toBe('queenAnt')
    expect(levelSpec(4).bossScale).toBe(0.5)
    expect(levelSpec(10).boss).toBe('queenAnt')
    expect(levelSpec(10).bossScale).toBe(1)
  })

  it('has no boss before 1-4, and no other boss below full strength', () => {
    for (let n = 1; n < 4; n++) expect(levelSpec(n).boss).toBeNull()
    for (const s of allLevels()) {
      if (s.id !== 4) expect(s.bossScale).toBe(1)
    }
  })
})

describe('levelSpec', () => {
  it('is total: any number in, a valid level out', () => {
    for (const n of [-5, 0, 1, 17, 40, 400, Number.NaN]) {
      const s = levelSpec(n)
      expect(s.id).toBeGreaterThanOrEqual(1)
      expect(s.id).toBeLessThanOrEqual(TOTAL_LEVELS)
      expect(s.objectives).toHaveLength(3)
    }
  })

  it('memoises, so a frame that asks four times pays once', () => {
    expect(levelSpec(13)).toBe(levelSpec(13))
  })

  it('gives every level a playable, self-consistent brief', () => {
    for (const s of allLevels()) {
      expect(s.time).toBeGreaterThan(0)
      expect(s.maxAlive).toBeGreaterThan(0)
      expect(s.speed).toBeGreaterThan(0)
      expect(s.spawnMs[0]).toBeGreaterThan(0)
      expect(s.spawnMs[1]).toBeGreaterThan(0)
      // The ramp only ever tightens.
      expect(s.spawnMs[1]).toBeLessThanOrEqual(s.spawnMs[0])
      expect(s.roster.length).toBeGreaterThan(0)
      for (const r of s.roster) {
        expect(r.weight).toBeGreaterThan(0)
        expect(bugSpec(r.id).debut).toBeLessThanOrEqual(s.id)
      }
      for (const h of s.hazards) expect(isHazardId(h)).toBe(true)
      // Star one is always the clear — see `stars.ts`.
      expect(s.objectives[0].kind).toBe('clear')
    }
  })

  it('gives a boss level a boss and no bug quota beside the boss bar', () => {
    for (const s of allLevels()) {
      if (isBossLevel(s.id)) {
        expect(s.boss).not.toBeNull()
        expect(s.quota).toBe(0)
      } else {
        expect(s.boss).toBeNull()
        expect(s.quota).toBeGreaterThan(0)
      }
    }
  })

  it('never asks a level for a bug that has not debuted', () => {
    for (const s of allLevels()) {
      for (const id of levelCast(s.id)) {
        expect(bugSpec(id).debut).toBeLessThanOrEqual(s.id)
      }
    }
  })

  it('gets harder across a world', () => {
    for (const world of WORLD_IDS) {
      const first = levelSpec(worldOpenLevel(world))
      const last = levelSpec(worldOpenLevel(world) + LEVELS_PER_WORLD - 2)
      expect(last.quota).toBeGreaterThan(first.quota)
      expect(last.maxAlive).toBeGreaterThanOrEqual(first.maxAlive)
      expect(last.spawnMs[0]).toBeLessThanOrEqual(first.spawnMs[0])
    }
  })

  it('and gets harder across the campaign', () => {
    expect(levelSpec(31).quota).toBeGreaterThan(levelSpec(1).quota)
    expect(levelSpec(31).speed).toBeGreaterThan(levelSpec(1).speed)
  })

  it('opens on a gentle first level: one bug kind, no hazards, a small quota', () => {
    const one = levelSpec(1)
    expect(one.roster.map((r) => r.id)).toEqual(['ant'])
    expect(one.hazards).toHaveLength(0)
    expect(one.quota).toBeLessThanOrEqual(10)
  })
})

/**
 * ─── The opening ────────────────────────────────────────────────────────────
 *
 * These pin the pacing rewrite, and they exist because the failure they guard
 * against is invisible from inside the data: every level had a roster and a
 * hazard list and looked fine, and the first three of them were the same level
 * three times. What was missing was not a number, it was a DIFFERENCE.
 */
describe('the opening teaches one thing at a time', () => {
  /** Everything a level can put in front of the player that has to be learned —
   *  a boss included. */
  const taught = (level: number): string[] => {
    const s = levelSpec(level)
    return [
      ...s.roster.map((r) => `bug:${r.id}`),
      ...s.hazards.map((h) => `hazard:${h}`),
      ...(s.boss ? [`boss:${s.boss}`] : [])
    ]
  }

  it('adds exactly one new creature, floor object or boss on every level to 1-9', () => {
    const seen = new Set<string>()
    const added: number[] = []
    for (let level = 1; level <= 9; level++) {
      const now = taught(level)
      added.push(now.filter((k) => !seen.has(k)).length)
      for (const k of now) seen.add(k)
    }
    // 1-1 IS the ant; 1-2 through 1-9 each bring one more thing and no more —
    // and on 1-4 the one thing is the Queen.
    expect(added).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1])
    // 1-10 is a rematch, not a debut.
    expect(taught(10).filter((k) => !seen.has(k))).toEqual([])
  })

  it('opens in the order the retention funnel asked for', () => {
    const debutOf = (level: number): string[] => {
      const before = new Set(level > 1 ? taught(level - 1) : [])
      return taught(level).filter((k) => !before.has(k))
    }
    expect(debutOf(2)).toEqual(['bug:caterpillar'])
    expect(debutOf(3)).toEqual(['bug:beetle'])
    expect(debutOf(4)).toEqual(['boss:queenAnt'])
    expect(debutOf(5)).toEqual(['bug:sprinter'])
    expect(debutOf(6)).toEqual(['hazard:crumbs'])
    expect(debutOf(7)).toEqual(['bug:pinatafly'])
    expect(debutOf(8)).toEqual(['bug:flea'])
    expect(debutOf(9)).toEqual(['hazard:honey'])
  })

  // The Queen's third phase is armour a tap bounces off. The shell has to have
  // been met — and the charged stomp taught on it — before she asks.
  it('teaches the slam on a level before the first boss that needs it', () => {
    const firstBoss = allLevels().find((l) => l.boss !== null)!
    expect(firstBoss.id).toBe(4)
    expect(bugSpec('beetle').debut).toBeLessThan(firstBoss.id)
    expect(levelSpec(firstBoss.id - 1).roster.map((r) => r.id)).toContain('beetle')
  })

  it('moves the salt shaker to 2-2 rather than doubling it up with honey', () => {
    expect(WORLDS[1].hazards).not.toContain('salt')
    for (let n = 1; n <= 11; n++) expect(levelSpec(n).hazards).not.toContain('salt')
    expect(levelSpec(12).hazards).toContain('salt')
    // …and nothing pinned it away for good: it is still on the floor late in world 2.
    expect(levelSpec(18).hazards).toContain('salt')
  })

  it('never takes anything away once it has been taught', () => {
    // A boss is an encounter, not part of the fauna — 1-5 does not "take the
    // Queen away" — so only creatures and floor objects have to persist.
    const lasting = (level: number): string[] => taught(level).filter((k) => !k.startsWith('boss:'))
    const seen = new Set<string>()
    for (let level = 1; level <= 9; level++) {
      const now = new Set(lasting(level))
      for (const k of seen) expect(now.has(k), `${k} gone on 1-${level}`).toBe(true)
      for (const k of now) seen.add(k)
    }
  })

  // A problem and its answer are two levels apart, never one: an answer handed
  // over on the same level as the problem is a hint, not a lesson.
  it('keeps a problem one level ahead of its answer', () => {
    // The sprinter arrives on a bare floor; the crumb pile that baits it is next.
    expect(levelSpec(5).roster.map((r) => r.id)).toContain('sprinter')
    expect(levelSpec(5).hazards).toHaveLength(0)
    expect(levelSpec(6).hazards).toContain('crumbs')
    // The flea arrives without honey; honey is the level after.
    expect(levelSpec(8).roster.map((r) => r.id)).toContain('flea')
    expect(levelSpec(8).hazards).not.toContain('honey')
    expect(levelSpec(9).hazards).toContain('honey')
  })

  it('never debuts a creature and a floor object on the same level', () => {
    let hazards = new Set(levelSpec(1).hazards.map(String))
    let kinds = new Set(levelSpec(1).roster.map((r) => String(r.id)))
    for (let level = 2; level <= 9; level++) {
      const s = levelSpec(level)
      const newKinds = s.roster.filter((r) => !kinds.has(String(r.id))).length
      const newHazards = s.hazards.filter((h) => !hazards.has(String(h))).length
      expect(newKinds === 0 || newHazards === 0).toBe(true)
      kinds = new Set(s.roster.map((r) => String(r.id)))
      hazards = new Set(s.hazards.map(String))
    }
  })

  it('points a debut level\'s stars at the thing it is teaching', () => {
    const asks = (level: number): string[] =>
      levelSpec(level).objectives.map((o) => (o.kind === 'kind' ? o.id : o.kind))
    expect(asks(2)).toContain('noSpike')
    expect(asks(3)).toContain('beetle')
    expect(asks(5)).toContain('sprinter')
    expect(asks(7)).toContain('pinatafly')
    expect(asks(8)).toContain('flea')
    expect(asks(9)).toContain('flea')
  })

  /** That bug's share of one roll of `roster`. */
  const share = (roster: readonly { id: string; weight: number }[], id: string): number => {
    const total = roster.reduce((n, r) => n + r.weight, 0)
    return total > 0 ? (roster.find((r) => r.id === id)?.weight ?? 0) / total : 0
  }

  /**
   * A "squish N of them" star has to be payable by the board it is printed on.
   *
   * The measure is the expected number of that kind among the kills the quota
   * asks for. It is deliberately CONSERVATIVE — far more bodies arrive over a
   * level than the quota's worth get killed, and a player chasing a star hunts
   * its target rather than killing uniformly — so clearing it by a hair is
   * comfortable in practice and failing it is not survivable at all.
   */
  it('rolls enough of a debutant for its own star to be payable', () => {
    // 1-6's is the sprinter the crumb pile baits, not a debutant — the same
    // arithmetic holds it to its board all the same.
    for (const level of [3, 5, 6, 7, 8, 9]) {
      const s = levelSpec(level)
      const ask = s.objectives.find((o) => o.kind === 'kind')
      expect(ask).toBeDefined()
      if (!ask || ask.kind !== 'kind') continue
      expect(s.quota * share(s.roster, ask.id)).toBeGreaterThanOrEqual(ask.n)
    }
  })

  /**
   * …and a debut level is never a WORSE place to meet the debutant than an
   * ordinary level of the same world.
   *
   * The counterpart rule to the one above, and the one that stops the fix for
   * it being "weight the new thing up until the star passes". The beetle's level
   * pins no roster at all for exactly that reason, and the flea's pins one only
   * to thin the shells OUT, at no less than the world's share of fleas: an
   * armoured body weighted up on a level a weak player cannot slam through does
   * not die, does not free its slot in `maxAlive`, and turns the board into a
   * floor of beetles — the scout measured 2 kills of an 18 quota against 12 at
   * the world's own weight.
   */
  it('never makes a debut level a rarer place to meet its debutant', () => {
    const debuts = [[2, 'caterpillar'], [3, 'beetle'], [5, 'sprinter'], [7, 'pinatafly'], [8, 'flea']] as const
    for (const [level, id] of debuts) {
      expect(share(levelSpec(level).roster, id)).toBeGreaterThanOrEqual(share(WORLDS[1].roster, id))
    }
  })

  // …and the armoured one is never weighted UP. 1-3 used to be held to the
  // world's mix exactly, which stated the rule as "pin nothing" — a proxy, and
  // a strictly stronger claim than the rule it stands for. It cost 1-3 the fix
  // it needed: at the world's own fifth of a roll, a weak player's board jammed
  // with untapped shells for a median of 33 of its 50 seconds. The level now
  // thins the beetle DOWN, which is the same rule, so the test asks the rule.
  it('never weights the beetle up on its own debut level', () => {
    const debutMix = rosterForLevel(WORLDS[1].roster, 3)
    expect(share(levelSpec(3).roster, 'beetle')).toBeLessThanOrEqual(share(debutMix, 'beetle'))
    // …and never thins it below the world's own share either, which is the
    // other half of the trap: a debut nobody meets. (The rule for every debut
    // is one test up; this one pins the armoured case with its own numbers.)
    expect(share(levelSpec(3).roster, 'beetle')).toBeGreaterThanOrEqual(share(WORLDS[1].roster, 'beetle'))
    // The rest of the board stays the ants it was: nothing else new arrives on
    // the level whose one job is the shell.
    expect(levelSpec(3).roster.map((r) => r.id).sort()).toEqual(debutMix.map((r) => r.id).sort())
  })

  // A caterpillar the player is right to leave alone never dies, so 1-2 can only
  // weight one up because its board is small and its clock long. Past 1-2 it is
  // a garnish: never as much of a roll as on its own debut level.
  it('keeps the caterpillar a garnish everywhere but its debut', () => {
    const debut = share(levelSpec(2).roster, 'caterpillar')
    for (let level = 3; level <= 10; level++) {
      expect(share(levelSpec(level).roster, 'caterpillar')).toBeLessThan(debut)
    }
  })

  // The rule the whole funnel rests on, restated where the pacing can break it.
  it('still opens on a level nothing can punish a wrong tap on', () => {
    const one = levelSpec(1)
    expect(one.roster).toHaveLength(1)
    expect(one.hazards).toHaveLength(0)
    for (const r of one.roster) {
      const spec = bugSpec(r.id)
      expect(spec.spiky).toBe(false)
      expect(spec.armor).toBe(0)
      expect(spec.dodges).toBe(false)
      expect(spec.sprints).toBe(false)
      expect(spec.hp).toBe(1)
    }
  })
})

/**
 * ─── The middle of world 1 ──────────────────────────────────────────────────
 *
 * 1-5 to 1-9 were re-cut for the weakest player the game has to carry, and
 * measured with the scout — see the block above 1-5 in `stages.ts`: 1 to 17 %
 * of that player's runs cleared 1-6..1-9 before, 86 to 98 % after. A scout run
 * does not belong in a unit test, so these pin the SHAPE the measurement found,
 * which is exactly what a later retune would quietly undo: shells and spikes as
 * a garnish, a board roomy enough that the garnish cannot jam it, a demand that
 * climbs gently into the Queen, and stars the board can pay for.
 */
describe('the middle of world 1 carries the weakest player', () => {
  const MIDDLE = [5, 6, 7, 8, 9]

  const shareOf = (roster: readonly RosterEntry[], pick: (id: BugId) => boolean): number => {
    const total = roster.reduce((n, r) => n + r.weight, 0)
    return total > 0 ? roster.filter((r) => pick(r.id)).reduce((n, r) => n + r.weight, 0) / total : 0
  }

  /** A body the starter sneaker does not clear with a TAP — the move a weak
   *  player makes. A shell clangs, a caterpillar spikes, and either one keeps
   *  its slot in `maxAlive`. */
  const jams = (id: BugId): boolean => {
    const b = bugSpec(id)
    return b.spiky || b.armor > shoeSpec(STARTER_SHOE).pierce
  }

  it('keeps shells and spikes a garnish: still on the board, never over one roll in twenty', () => {
    for (const level of MIDDLE) {
      const roster = levelSpec(level).roster
      for (const id of ['beetle', 'caterpillar'] as const) {
        const share = shareOf(roster, (b) => b === id)
        expect(share, `${id} on 1-${level}`).toBeGreaterThan(0)
        expect(share, `${id} on 1-${level}`).toBeLessThanOrEqual(0.05)
      }
    }
  })

  // The measured cause of nearly every lost run before the re-cut — and the
  // reason `maxAlive` went UP rather than down: a slot a shell holds is a smaller
  // share of a roomier board.
  it('rolls less than one body a tapper cannot clear in a whole board\'s worth of spawns', () => {
    for (const level of MIDDLE) {
      const s = levelSpec(level)
      expect(s.maxAlive * shareOf(s.roster, jams), `1-${level}`).toBeLessThan(1)
    }
  })

  // Easiest on the crumb pile, then gently harder into the Queen. No dial turns
  // the other way along 1-5..1-9, and the number a weak player's clear actually
  // rides on — squishes asked per second of clock — climbs in small steps and
  // stays short of the old 1-9's (0.62).
  it('ramps 1-5 to 1-9 one way, in small steps', () => {
    const demand = (level: number): number => levelSpec(level).quota / levelSpec(level).time
    for (let level = 6; level <= 9; level++) {
      const a = levelSpec(level - 1)
      const b = levelSpec(level)
      const at = `1-${level - 1} → 1-${level}`
      expect(b.quota, at).toBeGreaterThanOrEqual(a.quota)
      expect(b.time, at).toBeGreaterThanOrEqual(a.time)
      expect(b.maxAlive, at).toBeGreaterThanOrEqual(a.maxAlive)
      expect(b.spawnMs[0], at).toBeLessThanOrEqual(a.spawnMs[0])
      expect(b.speed, at).toBeGreaterThanOrEqual(a.speed)
      expect(demand(level) - demand(level - 1), at).toBeGreaterThanOrEqual(0)
      expect(demand(level) - demand(level - 1), at).toBeLessThanOrEqual(0.06)
    }
    for (const level of MIDDLE) expect(demand(level), `1-${level}`).toBeLessThanOrEqual(0.55)
  })

  // Star two is the level's lesson, as a count the board pays for (held to its
  // roster above). Star three is a SKILL ask — a chain, or getting through the
  // busiest board yet unspiked — where the old 1-6 pair was met by everybody who
  // cleared; and a chain star never needs a longer chain than the quota holds.
  it('asks for the lesson second and for skill third, and never for a chain the quota cannot hold', () => {
    const chainFor = (mult: number): number => COMBO_LADDER.findIndex((m) => m >= mult)
    for (const level of MIDDLE) {
      const s = levelSpec(level)
      expect(s.objectives[1].kind, `1-${level}`).toBe('kind')
      if (level > 5) expect(['combo', 'noSpike'], `1-${level}`).toContain(s.objectives[2].kind)
      for (const o of s.objectives) {
        if (o.kind === 'combo') expect(chainFor(o.n), `1-${level} ×${o.n}`).toBeLessThanOrEqual(s.quota)
      }
    }
  })
})

describe('world gating', () => {
  it('opens world 1 to everybody', () => {
    expect(WORLDS[1].starGate).toBe(0)
    expect(isLevelUnlocked(1, 0)).toBe(true)
  })

  it('gates later worlds on stars, never individual levels', () => {
    for (const world of WORLD_IDS) {
      const gate = WORLDS[world].starGate
      const open = worldOpenLevel(world)
      expect(isLevelUnlocked(open, gate)).toBe(true)
      if (gate > 0) expect(isLevelUnlocked(open, gate - 1)).toBe(false)
      // Every level inside a world shares that world's gate.
      for (let i = 0; i < LEVELS_PER_WORLD; i++) {
        expect(isLevelUnlocked(open + i, gate)).toBe(true)
      }
    }
  })

  it('asks for more stars each world, and never more than are earnable before it', () => {
    let last = -1
    for (const world of WORLD_IDS) {
      const gate = WORLDS[world].starGate
      expect(gate).toBeGreaterThan(last)
      // Three per level, all the levels before this world opens.
      expect(gate).toBeLessThanOrEqual((worldOpenLevel(world) - 1) * 3)
      last = gate
    }
  })

  it('counts down the stars still owed to the next world', () => {
    expect(starsToNextWorld(1, WORLDS[2].starGate)).toBe(0)
    expect(starsToNextWorld(1, WORLDS[2].starGate - 4)).toBe(4)
    // Nothing is locked past the last world.
    expect(starsToNextWorld(TOTAL_LEVELS, 0)).toBe(0)
  })
})

describe('levelPayout', () => {
  it('always pays something for a clear', () => {
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      expect(levelPayout(n, 0)).toBeGreaterThan(0)
    }
  })

  it('pays more for more stars, and more in later worlds', () => {
    expect(levelPayout(1, 3)).toBeGreaterThan(levelPayout(1, 1))
    expect(levelPayout(31, 1)).toBeGreaterThan(levelPayout(1, 1))
  })

  it('pays a boss bonus', () => {
    expect(levelPayout(10, 1)).toBeGreaterThan(levelPayout(9, 1))
    expect(levelPayout(4, 1)).toBeGreaterThan(levelPayout(3, 1))
  })

  it('pays a boss at half strength half the bonus', () => {
    // Same world, so the base and the per-star rate cancel and only the bonus
    // is left in each difference.
    for (const stars of [0, 1, 2, 3]) {
      const full = levelPayout(10, stars) - levelPayout(9, stars)
      const half = levelPayout(4, stars) - levelPayout(3, stars)
      expect(half).toBe(full / 2)
    }
  })

  it('is always a whole coin', () => {
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      for (const stars of [0, 1, 2, 3]) {
        expect(Number.isInteger(levelPayout(n, stars))).toBe(true)
      }
    }
  })
})
