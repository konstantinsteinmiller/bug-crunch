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
