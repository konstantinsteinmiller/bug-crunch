/**
 * ─── The adaptive boss, locked in ───────────────────────────────────────────
 *
 * `tests/sim/scratch.adaptive.test.ts` is where the numbers come from; this is
 * the part that has to keep passing. It guards the four promises the design
 * makes, in the order they matter:
 *
 *   THE LADDER    a better crowd earns a SHORTER fight, monotonically, with no
 *                 cliff anywhere on the curve.
 *   THE CEILING   nobody, however overwhelming, deletes the boss — and nobody,
 *                 however hopeless, is handed a bar they cannot finish.
 *   THE YARDSTICK the perfect-play reference is a real walk of the real road,
 *                 and it moves with the shop rather than ignoring it.
 *   THE EDGE      stage 6 is untouched. The authored curve has to survive.
 *
 * The last one is the load-bearing one for the rest of the campaign: everything
 * here is scoped to the opening five stages by design, and a change that leaked
 * past them would re-price fifteen authored boss fights silently.
 */
import { describe, expect, it } from 'vitest'
import {
  ADAPTIVE_BOSS_STAGES, ADAPTIVE_MAX_SECONDS, ADAPTIVE_MIN_SECONDS, ADAPTIVE_RUNGS,
  ADAPTIVE_TINY_SQUAD, HOPELESS_SLAM_MUL, SLAM_HARD_PERF, SLAM_SOFT_PERF,
  adaptiveBigHitMul, adaptiveBossHp, adaptiveBossSeconds, adaptiveBossStage,
  clampAdaptiveSeconds, expectedDamage, type AdaptiveFight
} from '@/game/adaptive'
import { perfectSquadFor } from '@/game/track'
import { SLAM_CD_BASE, SLAM_CD_DECAY, SLAM_CD_MIN, SLAM_FRACTION_MAX } from '@/game/survival'

/** A plausible fight, so each test can vary the one thing it is about. */
const fight = (over: Partial<AdaptiveFight> = {}): AdaptiveFight => ({
  squad: 100,
  perSurvivorDps: 1 * 1.9,
  slamShare: 0.186,
  slamMinKill: 2,
  guardPhases: 2,
  openingCd: 2.6,
  slamCd: SLAM_CD_BASE,
  slamCdDecay: SLAM_CD_DECAY,
  slamCdMin: SLAM_CD_MIN,
  ...over
})

describe('the ladder: a better crowd buys a shorter fight', () => {
  it('never rewards a bigger crowd with a longer boss', () => {
    // Monotone across the WHOLE range, sampled finely enough to catch a rung
    // entered in the wrong order — the one mistake in this table that would be
    // invisible in play and would invert the entire design.
    const perfect = 400
    let last = Number.POSITIVE_INFINITY
    for (let squad = 1; squad <= perfect; squad++) {
      const s = adaptiveBossSeconds(squad, perfect)
      expect(s, `squad ${squad} earned a longer fight than ${squad - 1}`).toBeLessThanOrEqual(last)
      last = s
    }
  })

  it('has no cliff a player could feel themselves fall off', () => {
    // One extra survivor may never change the fight by more than a blink. The
    // tiny-squad pin is the one legitimate step, so the sweep starts above it.
    const perfect = 400
    for (let squad = ADAPTIVE_TINY_SQUAD + 2; squad < perfect; squad++) {
      const step = adaptiveBossSeconds(squad, perfect) - adaptiveBossSeconds(squad + 1, perfect)
      expect(step, `a cliff at ${squad} survivors`).toBeLessThan(0.1)
    }
  })

  it('pays the brief’s four rungs', () => {
    const perfect = 400
    // Near-perfect crowd — the reward for a clean road.
    expect(adaptiveBossSeconds(Math.round(perfect * 0.9), perfect)).toBeCloseTo(3.0, 5)
    expect(adaptiveBossSeconds(Math.round(perfect * 0.75), perfect)).toBeCloseTo(3.0, 5)
    // Mistakes, a bad run, and a hopeless one.
    expect(adaptiveBossSeconds(Math.round(perfect * 0.45), perfect)).toBeCloseTo(5.0, 5)
    expect(adaptiveBossSeconds(Math.round(perfect * 0.2), perfect)).toBeCloseTo(6.0, 5)
    expect(adaptiveBossSeconds(8, perfect)).toBeCloseTo(6.8, 5)
  })

  it('pins the bottom rung by head count, not by ratio', () => {
    // Twelve survivors is hopeless on a road worth 250 and equally hopeless on
    // one worth 620. The ratio would call those two different fights.
    expect(adaptiveBossSeconds(ADAPTIVE_TINY_SQUAD, 252))
      .toBe(adaptiveBossSeconds(ADAPTIVE_TINY_SQUAD, 616))
  })

  it('does not divide by a yardstick it never got', () => {
    // A stage with no banks at all, or a reference that failed to build: the
    // run must still get a target, and it must be the cautious one.
    expect(adaptiveBossSeconds(200, 0)).toBe(ADAPTIVE_RUNGS[ADAPTIVE_RUNGS.length - 1]!.seconds)
  })
})

describe('the ceiling: no deletion, and no unfinishable bar', () => {
  it('keeps the autobalancer inside the band', () => {
    // `challengeFactor` alone reaches ×12.7 on a long clear streak, and
    // `rewardDeclineFactor` stacks on top. Unclamped that is a ninety-second
    // boss on stage 2.
    expect(clampAdaptiveSeconds(6.8 * 12.7)).toBe(ADAPTIVE_MAX_SECONDS)
    expect(clampAdaptiveSeconds(3.0 * 0.35)).toBe(ADAPTIVE_MIN_SECONDS)
  })

  it('prices an overwhelming run for real seconds of fire rather than a blink', () => {
    // The complaint this whole file answers: a returning player with the shop
    // behind them used to delete the opening bosses in about half a second.
    // Whatever they arrive with, the bar has to be worth the target.
    const strong = fight({ squad: 400, perSurvivorDps: 3 * 3.2 })
    const hp = adaptiveBossHp(strong, 3.0)
    const nominalDps = strong.squad * strong.perSurvivorDps
    expect(hp / nominalDps).toBeGreaterThan(2.0)
  })

  it('scales the bar with the firepower that turned up, both ways', () => {
    const weak = adaptiveBossHp(fight({ squad: 20 }), 5)
    const strong = adaptiveBossHp(fight({ squad: 400 }), 5)
    // Not merely bigger — proportional, so the fight is the same LENGTH for
    // both. That is the whole mechanism.
    expect(strong / weak).toBeGreaterThan(10)
    expect(strong / weak).toBeLessThan(30)
  })

  it('never hands anybody a bar of nothing', () => {
    // A run that arrives with no measurable firepower still has to have
    // something to shoot: a one-point boss is a softlock dressed as a victory.
    expect(adaptiveBossHp(fight({ squad: 0 }), 5)).toBeGreaterThanOrEqual(30)
    expect(adaptiveBossHp(fight({ perSurvivorDps: 0 }), 5)).toBeGreaterThanOrEqual(30)
  })

  it('charges a longer target more health, but less than linearly', () => {
    // Longer means more swings land, so the crowd delivering the damage is
    // smaller — doubling the target must NOT double the bar, or the fight
    // over-runs exactly as it did before the decay was modelled.
    const short = adaptiveBossHp(fight({ squad: 30 }), 3)
    const long = adaptiveBossHp(fight({ squad: 30 }), 6)
    expect(long).toBeGreaterThan(short)
    expect(long).toBeLessThan(short * 2)
  })

  it('spends the guard phases out of the fight rather than out of the bar', () => {
    // A stage with two guard phases gives the crowd the same seconds of FIRE as
    // one with a single phase — the extra immune window costs the player time,
    // not health. Slightly less, because the crowd is being swung at for longer.
    const one = expectedDamage(fight({ guardPhases: 1 }), 5)
    const two = expectedDamage(fight({ guardPhases: 2 }), 5)
    expect(two).toBeLessThan(one)
    expect(two).toBeGreaterThan(one * 0.8)
  })
})

describe('the swing: a crowd that built nothing gets smacked', () => {
  it('leaves the beginner’s discount alone for a run that read the road', () => {
    expect(adaptiveBigHitMul(0.6, 300, 400)).toBe(0.6)
    expect(adaptiveBigHitMul(0.6, Math.round(400 * SLAM_SOFT_PERF), 400)).toBe(0.6)
  })

  it('takes it back, and then some, from a run that did not', () => {
    expect(adaptiveBigHitMul(0.6, Math.round(400 * SLAM_HARD_PERF), 400)).toBe(HOPELESS_SLAM_MUL)
    expect(adaptiveBigHitMul(0.6, ADAPTIVE_TINY_SQUAD, 400)).toBe(HOPELESS_SLAM_MUL)
  })

  it('crosses between the two without a step', () => {
    let last = 0.6
    for (let squad = Math.round(400 * SLAM_SOFT_PERF); squad >= 1; squad--) {
      const mul = adaptiveBigHitMul(0.6, squad, 400)
      expect(mul, `the swing got softer as the crowd got smaller at ${squad}`)
        .toBeGreaterThanOrEqual(last - 1e-9)
      last = mul
    }
  })

  it('cannot push one swing past the ceiling the game already set', () => {
    // `HOPELESS_SLAM_MUL` is applied to the stage's authored share and then
    // clamped by `SLAM_FRACTION_MAX` at the call site. The point of this
    // assertion is that the clamp is still the binding one — reading the run
    // may make a swing land, never redefine how hard a swing may be.
    expect(0.31 * HOPELESS_SLAM_MUL).toBeLessThanOrEqual(SLAM_FRACTION_MAX)
  })
})

describe('the yardstick: a real walk of the real road', () => {
  it('grows down every authored stage’s road', () => {
    for (const stage of [1, 2, 3, 4, 5]) {
      // Bigger than the crowd the stage opens with, or the doors are not doors.
      expect(perfectSquadFor(stage), `stage ${stage} ceiling`).toBeGreaterThan(30)
    }
  })

  it('is deterministic, because the road is', () => {
    // `buildTrack` seeds its RNG from the stage number, so the same player gets
    // the same yardstick on every attempt. A ceiling that rolled would make the
    // same run score differently on a retry.
    for (const stage of [1, 3, 5]) expect(perfectSquadFor(stage)).toBe(perfectSquadFor(stage))
  })

  it('moves with the shop, so purchases are not scored as failure', () => {
    // A player who bought Squad to level ten arrives with a bigger crowd than
    // the road alone would give them. Measured against a fixed ceiling that
    // would read as a better run than they played; the reference has to rise
    // with them.
    const bare = perfectSquadFor(3)
    const bought = perfectSquadFor(3, 12, 1.4)
    expect(bought).toBeGreaterThan(bare)
  })

  it('never promises more than a gate could pay', () => {
    // The walk clamps at `MAX_SQUAD` exactly where `claimBank` does. A ceiling
    // above it would report every late run as a failure.
    expect(perfectSquadFor(5, 4000, 2)).toBeLessThanOrEqual(4000)
  })
})

describe('the edge: the authored campaign is untouched', () => {
  it('covers the opening five stages and stops', () => {
    for (const stage of [1, 2, 3, 4, 5]) expect(adaptiveBossStage(stage)).toBe(true)
    for (const stage of [6, 7, 12, 30, 200]) expect(adaptiveBossStage(stage)).toBe(false)
    expect(ADAPTIVE_BOSS_STAGES).toBe(5)
  })

  it('keeps the rung table ordered from best play to worst', () => {
    for (let i = 1; i < ADAPTIVE_RUNGS.length; i++) {
      expect(ADAPTIVE_RUNGS[i]!.perf).toBeLessThan(ADAPTIVE_RUNGS[i - 1]!.perf)
      expect(ADAPTIVE_RUNGS[i]!.seconds).toBeGreaterThan(ADAPTIVE_RUNGS[i - 1]!.seconds)
    }
    // …and inside the band, or the clamp would silently rewrite the brief.
    for (const rung of ADAPTIVE_RUNGS) {
      expect(rung.seconds).toBeGreaterThanOrEqual(ADAPTIVE_MIN_SECONDS)
      expect(rung.seconds).toBeLessThanOrEqual(ADAPTIVE_MAX_SECONDS)
    }
  })
})
