import { describe, expect, it } from 'vitest'
import {
  BOSSES,
  BOSS_IDS,
  BROOD_ANTS,
  EGG_CAP,
  EGG_STAGES,
  HATCHLING_CAP,
  LAY_HOLD_MS,
  CHARGE_COUNTER_HITS,
  CHARGE_RUN_MS,
  CHARGE_SPENT_MS,
  CHARGE_TELL_MS,
  CHARGE_WINDUP_MS,
  POD_HATCH_MS,
  POD_PER_BEAT,
  POD_QUOTA,
  POD_SIZE,
  MIN_BOSS_SCALE,
  bossHp01,
  bossPhaseTicks,
  bossSpec,
  bossTotalHits,
  isBossId,
  scaleBoss
} from '@/game/bosses'
import { bugSpec } from '@/game/bugs'
import { BOSS_FIGHTS, WORLD_COUNT, allLevels, isBossLevel, levelSpec } from '@/game/stages'
import { SLAM_PIERCE_BONUS, shoeSpec } from '@/game/shoes'

describe('the boss roster', () => {
  it('is one boss per world', () => {
    expect(BOSS_IDS).toHaveLength(WORLD_COUNT)
    expect(new Set(BOSS_IDS).size).toBe(BOSS_IDS.length)
  })

  it('is wired to exactly the levels BOSS_FIGHTS names, at the strength it names', () => {
    const used = allLevels().filter((l) => l.boss !== null)
    expect(used.map((l) => l.id)).toEqual(Object.keys(BOSS_FIGHTS).map(Number))
    for (const l of used) {
      expect(isBossId(l.boss)).toBe(true)
      expect(l.boss).toBe(BOSS_FIGHTS[l.id]!.boss)
      expect(l.bossScale).toBe(BOSS_FIGHTS[l.id]!.scale)
    }
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

  it('fills the shared dials into every full-strength entry', () => {
    for (const id of BOSS_IDS) {
      const s = BOSSES[id]
      expect(s.strength).toBe(1)
      expect(s.podQuota).toBe(POD_QUOTA)
      expect(s.podHatchMs).toBe(POD_HATCH_MS)
      expect(s.windupMs).toBe(CHARGE_WINDUP_MS)
      expect(s.spentMs).toBe(CHARGE_SPENT_MS)
      expect(s.layHoldMs).toBe(LAY_HOLD_MS)
      expect(s.broodAnts).toBe(BROOD_ANTS)
      expect(s.eggCap).toBe(EGG_CAP)
      expect(s.hatchlingCap).toBe(HATCHLING_CAP)
    }
  })
})

/**
 * ─── The brood ──────────────────────────────────────────────────────────────
 *
 * Every boss fight has eggs, and every egg hatches ants (see "The brood" in
 * `bosses.ts`). The sim's own cases are in `sim.test.ts`; these pin the DATA
 * the fights are built from, so a rebalance cannot quietly leave a boss with no
 * eggs, a cap that cannot hold a clutch, or a centipede laying ant eggs.
 */
describe('the brood', () => {
  it('is in every boss fight', () => {
    for (const id of BOSS_IDS) {
      const brood = BOSSES[id].phases.filter((p) => p.eggMs > 0 || p.script === 'pods')
      expect(brood.length, `${id} has no eggs`).toBeGreaterThan(0)
    }
  })

  it('arrives the way the boss would bring it', () => {
    // The Queen is an ant queen and Roach Prime is a factory: they LAY. A beetle
    // and a centipede laying ant eggs is nonsense — the colony HAULS theirs in.
    expect([BOSSES.queenAnt.delivery, BOSSES.queenAnt.eggLook]).toEqual(['lay', 'egg'])
    expect([BOSSES.roachPrime.delivery, BOSSES.roachPrime.eggLook]).toEqual(['lay', 'capsule'])
    expect([BOSSES.beetleKing.delivery, BOSSES.beetleKing.eggLook]).toEqual(['haul', 'egg'])
    expect([BOSSES.matriarch.delivery, BOSSES.matriarch.eggLook]).toEqual(['haul', 'egg'])
  })

  it('lays a pods phase on its beat, and hatches every egg into ants rather than its adds', () => {
    for (const id of BOSS_IDS) {
      for (const p of BOSSES[id].phases) {
        if (p.script !== 'pods') continue
        // The beat is the clutch; a second clock on top would double it.
        expect(p.eggMs, id).toBe(0)
        // Nothing reads a pods phase's adds any more — an egg is an ant egg.
        expect(p.adds, id).toEqual([])
      }
    }
  })

  it('has room for a whole clutch and a whole hatch under its caps', () => {
    for (const id of BOSS_IDS) {
      for (const scale of [1, 0.5, 0.25]) {
        const s = bossSpec(id, scale)
        expect(s.eggCap, `${id}@${scale}`).toBeGreaterThanOrEqual(POD_PER_BEAT)
        expect(s.hatchlingCap, `${id}@${scale}`).toBeGreaterThanOrEqual(s.broodAnts)
        expect(s.broodAnts, `${id}@${scale}`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('cracks in as many stages as the painted sheets have panels', () => {
    expect(EGG_STAGES).toBe(4)
  })
})

/**
 * ─── Strength ───────────────────────────────────────────────────────────────
 *
 * "Half as strong" is defined in ONE place, `scaleBoss`, and these pin what it
 * means — so the half-strength Queen on 1-4 is a smaller version of the fight on
 * 1-10 rather than a different one, and nobody re-derives "half" at a call site.
 */
describe('a boss at less than full strength', () => {
  const half = (id: (typeof BOSS_IDS)[number]) => bossSpec(id, 0.5)

  it('is the table entry itself at full strength', () => {
    for (const id of BOSS_IDS) {
      expect(bossSpec(id, 1)).toBe(BOSSES[id])
      expect(scaleBoss(BOSSES[id], 1)).toBe(BOSSES[id])
    }
  })

  it('halves the hits of every phase, rounding UP and never to zero', () => {
    for (const id of BOSS_IDS) {
      const full = BOSSES[id].phases
      const halved = half(id).phases
      for (let i = 0; i < 3; i++) {
        expect(halved[i]!.hits).toBe(Math.max(1, Math.ceil(full[i]!.hits / 2)))
      }
    }
    // The Queen, spelled out: 5/6/4 → 3/3/2, fifteen hits to eight.
    expect(half('queenAnt').phases.map((p) => p.hits)).toEqual([3, 3, 2])
    expect(bossTotalHits(half('queenAnt'))).toBe(8)
  })

  it('halves the pods to clear, and the adds per beat without silencing a summon', () => {
    for (const id of BOSS_IDS) {
      expect(half(id).podQuota).toBe(Math.ceil(POD_QUOTA / 2))
      BOSSES[id].phases.forEach((p, i) => {
        const h = half(id).phases[i]!
        if (p.addCount === 0) expect(h.addCount).toBe(0)
        else {
          expect(h.addCount).toBeGreaterThanOrEqual(1)
          expect(h.addCount).toBeLessThanOrEqual(p.addCount)
        }
      })
    }
    expect(half('queenAnt').phases[0].addCount).toBe(1)
  })

  it('softens the clocks — slower, further apart, longer windows — and halves the score', () => {
    for (const id of BOSS_IDS) {
      const full = BOSSES[id]
      const h = half(id)
      expect(h.podHatchMs).toBeGreaterThan(full.podHatchMs)
      expect(h.windupMs).toBeGreaterThan(full.windupMs)
      expect(h.spentMs).toBeGreaterThan(full.spentMs)
      expect(h.layHoldMs).toBeGreaterThan(full.layHoldMs)
      full.phases.forEach((p, i) => {
        if (p.eggMs > 0) expect(h.phases[i]!.eggMs, `${id} phase ${i + 1}`).toBeGreaterThan(p.eggMs)
        else expect(h.phases[i]!.eggMs).toBe(0)
      })
      expect(h.score).toBe(Math.round(full.score / 2))
      full.phases.forEach((p, i) => {
        expect(h.phases[i]!.speed).toBeLessThan(p.speed)
        expect(h.phases[i]!.beatMs).toBeGreaterThan(p.beatMs)
      })
    }
  })

  // The lessons are the part that must NOT shrink. The third phase is still a
  // charge, still armoured, still a slam the starter sneaker can land and a tap
  // it cannot — the question the beetle asked one level earlier.
  // The brood is a count: a half-strength boss's eggs hatch fewer ants, fewer
  // at once — 1-4's floor is a smaller 1-10's, never a busier one.
  it('makes a gentler brood: fewer ants an egg, fewer eggs and hatchlings at once', () => {
    for (const id of BOSS_IDS) {
      const full = BOSSES[id]
      const h = half(id)
      expect(h.broodAnts).toBeLessThan(full.broodAnts)
      expect(h.eggCap).toBeLessThan(full.eggCap)
      expect(h.hatchlingCap).toBeLessThan(full.hatchlingCap)
      expect(h.eggLook).toBe(full.eggLook)
      expect(h.delivery).toBe(full.delivery)
    }
    expect([half('queenAnt').broodAnts, half('queenAnt').eggCap, half('queenAnt').hatchlingCap]).toEqual([2, 2, 5])
  })

  it('keeps every phase, script, tell and armour class exactly as it was', () => {
    for (const id of BOSS_IDS) {
      const full = BOSSES[id].phases
      const h = half(id).phases
      expect(h).toHaveLength(3)
      for (let i = 0; i < 3; i++) {
        expect(h[i]!.script).toBe(full[i]!.script)
        expect(h[i]!.tell).toBe(full[i]!.tell)
        expect(h[i]!.armor).toBe(full[i]!.armor)
        expect(h[i]!.vulnerable).toBe(full[i]!.vulnerable)
        expect(h[i]!.adds).toEqual(full[i]!.adds)
      }
    }
    const sneaker = shoeSpec('sneaker')
    const charge = half('queenAnt').phases[2]
    expect(charge.script).toBe('charge')
    expect(sneaker.pierce).toBeLessThan(charge.armor)
    expect(sneaker.pierce + SLAM_PIERCE_BONUS).toBeGreaterThanOrEqual(charge.armor)
  })

  it('draws the bar ticks off the scaled hits', () => {
    const ticks = bossPhaseTicks(half('queenAnt'))
    expect(ticks[0]).toBeCloseTo(5 / 8, 6)
    expect(ticks[1]).toBeCloseTo(2 / 8, 6)
  })

  it('is pure: the table is untouched, and the same strength is the same object', () => {
    const before = JSON.stringify(BOSSES)
    scaleBoss(BOSSES.queenAnt, 0.5)
    bossSpec('matriarch', 0.5)
    expect(JSON.stringify(BOSSES)).toBe(before)
    expect(bossSpec('queenAnt', 0.5)).toBe(bossSpec('queenAnt', 0.5))
  })

  it('never goes below a quarter, and treats nonsense as full strength', () => {
    expect(scaleBoss(BOSSES.queenAnt, 0).strength).toBe(MIN_BOSS_SCALE)
    expect(scaleBoss(BOSSES.queenAnt, -3).strength).toBe(MIN_BOSS_SCALE)
    expect(scaleBoss(BOSSES.queenAnt, Number.NaN)).toBe(BOSSES.queenAnt)
    expect(scaleBoss(BOSSES.queenAnt, 7)).toBe(BOSSES.queenAnt)
  })

  it('is the fight 1-4 actually hands the sim', () => {
    const four = levelSpec(4)
    expect(four.boss).toBe('queenAnt')
    expect(four.bossScale).toBe(0.5)
    expect(bossSpec(four.boss!, four.bossScale)).toBe(half('queenAnt'))
    const ten = levelSpec(10)
    expect(bossSpec(ten.boss!, ten.bossScale)).toBe(BOSSES.queenAnt)
  })
})
