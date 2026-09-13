import { describe, expect, it } from 'vitest'
import {
  BOSSES,
  BOSS_IDS,
  CHARGE_COUNTER_HITS,
  CHARGE_RUN_MS,
  CHARGE_SPENT_MS,
  CHARGE_TELL_MS,
  CHARGE_WINDUP_MS,
  POD_HATCH_MS,
  POD_PER_BEAT,
  POD_QUOTA,
  POD_SIZE,
  bossHp01,
  bossPhaseTicks,
  bossSpec,
  bossTotalHits,
  isBossId
} from '@/game/bosses'
import { bugSpec } from '@/game/bugs'
import { WORLD_COUNT, allLevels, isBossLevel } from '@/game/stages'
import { SLAM_PIERCE_BONUS, shoeSpec } from '@/game/shoes'

describe('the boss roster', () => {
  it('is one boss per world', () => {
    expect(BOSS_IDS).toHaveLength(WORLD_COUNT)
    expect(new Set(BOSS_IDS).size).toBe(BOSS_IDS.length)
  })

  it('is wired to the four boss levels and nowhere else', () => {
    const used = allLevels().filter((l) => l.boss !== null)
    expect(used.map((l) => l.id)).toEqual([10, 20, 30, 40])
    for (const l of used) expect(isBossId(l.boss)).toBe(true)
    for (const l of allLevels()) {
      if (!isBossLevel(l.id)) expect(l.boss).toBeNull()
    }
  })

  it('guards its own type predicate', () => {
    expect(isBossId('queenAnt')).toBe(true)
    expect(isBossId('queenBee')).toBe(false)
    expect(isBossId(0)).toBe(false)
  })

  it('draws every boss from a bug the player already reads', () => {
    for (const id of BOSS_IDS) {
      const s = bossSpec(id)
      expect(() => bugSpec(s.base)).not.toThrow()
      expect(s.size).toBeGreaterThan(bugSpec(s.base).size * 2)
      expect(s.score).toBeGreaterThan(0)
    }
  })

  it('gives every boss three phases with a usable script', () => {
    for (const id of BOSS_IDS) {
      const s = bossSpec(id)
      expect(s.phases).toHaveLength(3)
      for (const p of s.phases) {
        expect(p.hits).toBeGreaterThan(0)
        expect(p.speed).toBeGreaterThan(0)
        expect(p.beatMs).toBeGreaterThan(0)
        expect(p.armor).toBeGreaterThanOrEqual(0)
        expect(typeof p.tell).toBe('string')
        if (p.addCount > 0) expect(p.adds.length).toBeGreaterThan(0)
        for (const add of p.adds) expect(() => bugSpec(add)).not.toThrow()
      }
    }
  })

  // No boss may be a paywall: the starter sneaker has to be able to open every
  // phase of every boss with a heavy slam, or a player who has not bought a shoe
  // is stuck on a wall the shop is the only answer to.
  it('can always be opened by the starter shoe with a slam', () => {
    const slam = shoeSpec('sneaker').pierce + SLAM_PIERCE_BONUS
    for (const id of BOSS_IDS) {
      for (const p of bossSpec(id).phases) {
        expect(slam).toBeGreaterThanOrEqual(p.armor)
      }
    }
  })

  it('gets harder world by world', () => {
    const totals = BOSS_IDS.map((id) => bossTotalHits(bossSpec(id)))
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i]).toBeGreaterThanOrEqual(totals[i - 1]!)
    }
  })
})

describe('bossHp01', () => {
  it('reads 1 before the first hit and 0 on the last', () => {
    for (const id of BOSS_IDS) {
      const s = bossSpec(id)
      expect(bossHp01(s, 0, 0)).toBeCloseTo(1, 6)
      expect(bossHp01(s, 2, s.phases[2].hits)).toBeCloseTo(0, 6)
    }
  })

  it('only ever falls', () => {
    for (const id of BOSS_IDS) {
      const s = bossSpec(id)
      let last = 1.0001
      for (let phase = 0; phase < 3; phase++) {
        for (let hit = 0; hit <= s.phases[phase]!.hits; hit++) {
          const hp = bossHp01(s, phase, hit)
          expect(hp).toBeLessThanOrEqual(last + 1e-9)
          expect(hp).toBeGreaterThanOrEqual(0)
          last = hp
        }
      }
    }
  })

  it('marks the phase boundaries on the bar', () => {
    for (const id of BOSS_IDS) {
      const ticks = bossPhaseTicks(bossSpec(id))
      expect(ticks.length).toBeGreaterThan(0)
      for (const t of ticks) {
        expect(t).toBeGreaterThan(0)
        expect(t).toBeLessThan(1)
      }
    }
  })
})

describe('the shared boss timings', () => {
  it('tells before it charges, and leaves a counter window open afterwards', () => {
    expect(CHARGE_TELL_MS).toBeGreaterThan(0)
    expect(CHARGE_WINDUP_MS).toBeGreaterThan(CHARGE_TELL_MS / 2)
    expect(CHARGE_RUN_MS).toBeGreaterThan(0)
    expect(CHARGE_SPENT_MS).toBeGreaterThan(0)
    expect(CHARGE_COUNTER_HITS).toBeGreaterThan(0)
  })

  it('gives the player time to clear a pod before it hatches', () => {
    expect(POD_HATCH_MS).toBeGreaterThanOrEqual(3_000)
    expect(POD_PER_BEAT).toBeGreaterThan(0)
    expect(POD_QUOTA).toBeGreaterThan(POD_PER_BEAT)
    expect(POD_SIZE).toBeGreaterThan(0)
  })

  it('exposes every boss through the record and the id list alike', () => {
    for (const id of BOSS_IDS) expect(BOSSES[id]).toBe(bossSpec(id))
  })
})
