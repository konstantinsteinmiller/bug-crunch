import { describe, expect, it } from 'vitest'
import {
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
  type WorldId
} from '@/game/stages'
import { bugSpec } from '@/game/bugs'
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

  it('puts a boss at the end of every world, and nowhere else', () => {
    const bosses = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).filter(isBossLevel)
    expect(bosses).toEqual([10, 20, 30, 40])
    expect(BOSS_IDS).toHaveLength(WORLD_COUNT)
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
  /** Everything a level can put in front of the player that has to be learned. */
  const taught = (level: number): string[] => {
    const s = levelSpec(level)
    return [
      ...s.roster.map((r) => `bug:${r.id}`),
      ...s.hazards.map((h) => `hazard:${h}`)
    ]
  }

  it('adds exactly one new creature or floor object on every level to 1-6', () => {
    const seen = new Set<string>()
    const added: number[] = []
    for (let level = 1; level <= 6; level++) {
      const now = taught(level)
      added.push(now.filter((k) => !seen.has(k)).length)
      for (const k of now) seen.add(k)
    }
    // 1-1 IS the ant; 1-2 through 1-6 each bring one more thing and no more.
    expect(added).toEqual([1, 1, 1, 1, 1, 1])
  })

  it('never takes anything away once it has been taught', () => {
    const seen = new Set<string>()
    for (let level = 1; level <= 9; level++) {
      const now = new Set(taught(level))
      for (const k of seen) expect(now.has(k)).toBe(true)
      for (const k of now) seen.add(k)
    }
  })

  // A problem and its answer are two levels apart, never one: an answer handed
  // over on the same level as the problem is a hint, not a lesson.
  it('keeps a problem one level ahead of its answer', () => {
    // The sprinter arrives on a bare floor; the crumb pile that baits it is next.
    expect(levelSpec(2).roster.map((r) => r.id)).toContain('sprinter')
    expect(levelSpec(2).hazards).toHaveLength(0)
    expect(levelSpec(3).hazards).toContain('crumbs')
    // The flea arrives without honey; honey is the level after.
    expect(levelSpec(6).roster.map((r) => r.id)).toContain('flea')
    expect(levelSpec(6).hazards).not.toContain('honey')
    expect(levelSpec(7).hazards).toContain('honey')
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
    expect(asks(2)).toContain('sprinter')
    expect(asks(4)).toContain('beetle')
    expect(asks(5)).toContain('pinatafly')
    expect(asks(6)).toContain('flea')
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
    for (const level of [2, 4, 5, 6]) {
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
   * it being "weight the new thing up until the star passes". 1-4 and 1-6 pin
   * no roster at all for exactly that reason: an armoured debutant weighted up
   * on a level a weak player cannot slam through does not die, does not free
   * its slot in `maxAlive`, and turns the board into a floor of beetles — the
   * scout measured 2 kills of an 18 quota against 12 at the world's own weight.
   */
  it('never makes a debut level a rarer place to meet its debutant', () => {
    for (const [level, id] of [[2, 'sprinter'], [4, 'beetle'], [5, 'pinatafly'], [6, 'flea']] as const) {
      expect(share(levelSpec(level).roster, id)).toBeGreaterThanOrEqual(share(WORLDS[1].roster, id))
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
  })

  it('is always a whole coin', () => {
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      for (const stars of [0, 1, 2, 3]) {
        expect(Number.isInteger(levelPayout(n, stars))).toBe(true)
      }
    }
  })
})
