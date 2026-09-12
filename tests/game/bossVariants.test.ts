/**
 * ─── Every boss kind has a second attack, and none of them costs extra ──────
 *
 * The pool gave the game four boss fights. What it did not give it was four
 * fights worth playing twice: each kind showed the player everything it had
 * inside its first four seconds, and from the second meeting there was nothing
 * left to learn. `BOSS_VARIANT_FROM_STAGE` is where each kind grows a second
 * verb, and this file is the two claims that make that a feature rather than a
 * difficulty patch:
 *
 *   IT IS A REAL QUESTION   a player who reads the new attack pays far less than
 *                           one who answers it with the old attack's answer. All
 *                           four are measured as OUTCOMES over the real `step()`
 *                           loop, because that is the only way to catch the
 *                           failure the claw's own history records — geometry
 *                           that looks like an attack and cannot be dodged.
 *   IT COSTS NOTHING EXTRA  a variant REPLACES the cycle it lands on. The
 *                           crossrake's two passes share one budget, the shock
 *                           is priced at one slam, the ward moves no damage at
 *                           all and the flanks wave spends a wave the summoner
 *                           had already budgeted.
 *
 * Where a constant is read below it states a PREMISE ("the crowd really is wider
 * than the eye is") rather than the expected value of the thing under test — an
 * assertion that reads the same constant the code does passes for any value.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { CROWD_MAX_R, LANE_HALF } from '@/game/survival'
import {
  BOSS_POOL, BOSS_VARIANT_FROM_STAGE, CLAW_SPACING, CROSSRAKE_GAP_S, CROSSRAKE_OFFSET,
  HEAL_FRACTION, SHOCK_EYE_R, SUMMON_WAVES_MAX, THREAT_POOL_FROM_STAGE,
  bossHasVariant, bossKindFor, bossVariantFor, flankXs, shockEyeX, shockOuterR,
  variantOnSlamClock, type BossKind
} from '@/game/threats'
import { drainFx, type FxEvent } from '@/use/useVfx'

const importGame = () => import('@/use/useSurvivalGame')
type Game = Awaited<ReturnType<typeof importGame>>

const STEP_MS = 16

beforeEach(async () => {
  localStorage.clear()
  const { __resetTowerState } = await import('@/use/useTowerState')
  __resetTowerState()
})

/** The shallowest stage that fields `kind` WITH its second verb. */
const variantStageOf = (kind: BossKind): number => {
  for (let s = BOSS_VARIANT_FROM_STAGE; s < BOSS_VARIANT_FROM_STAGE + 40; s++) {
    if (bossKindFor(s) === kind) return s
  }
  throw new Error(`no variant stage fields ${kind}`)
}

const CLAW_STAGE = variantStageOf('claw')
const METEOR_STAGE = variantStageOf('meteor')
const HEALER_STAGE = variantStageOf('healer')
const SUMMONER_STAGE = variantStageOf('summoner')

interface Landing {
  /** The frame it landed on. */
  tick: number
  /** What the crowd lost on that frame — one big attack per frame, so the
   *  frame's whole loss is this attack's. */
  lost: number
  event: FxEvent
}

interface FightOptions {
  stage: number
  squad: number
  damage?: number
  steer?: (game: Game, tick: number, fx: readonly FxEvent[]) => number
  /** Hold the boss's health up, so a fight runs long enough to show a rotation
   *  that only reaches its third beat on the third cycle. */
  immortal?: boolean
  /** Top the crowd back up every frame, so two policies are compared against
   *  the same squad rather than against whatever the last hit left. */
  topUp?: boolean
  maxTicks?: number
}

/**
 * Walk into the arena and fight, recording what each landing cost.
 *
 * `fx` is handed to the steering policy so a "perfect reader" can answer the
 * telegraph the game actually drew rather than a number the test computed for
 * itself — which is the difference between measuring the attack and measuring
 * the test's model of it.
 */
const fight = async (o: FightOptions) => {
  const game = await importGame()
  game.startStage(o.stage)
  game.debugSkipToArena()
  game.debugAddUnits(o.squad)
  if (o.damage) game.debugAddDamage(o.damage)
  for (let i = 0; i < 400 && game.phase.value !== 'boss'; i++) game.step(STEP_MS)
  expect(game.phase.value, `stage ${o.stage} never reached the arena`).toBe('boss')
  drainFx()

  const squadAtBoss = game.squadCount.value
  const fx: FxEvent[] = []
  const landings: Landing[] = []
  let seen: FxEvent[] = []
  let ticks = 0
  const max = o.maxTicks ?? 3000
  while (ticks < max && game.phase.value === 'boss' && !game.getBoss()?.dead) {
    const b = game.getBoss()
    if (o.immortal && b) { b.hp = b.maxHp; b.guarded = 99 }
    if (o.topUp && game.squadCount.value < o.squad) {
      game.debugAddUnits(o.squad - game.squadCount.value)
    }
    game.steerTo(o.steer ? o.steer(game, ticks, seen) : game.anchor().x)
    const before = game.squadCount.value
    game.step(STEP_MS)
    seen = drainFx()
    fx.push(...seen)
    const lost = before - game.squadCount.value
    for (const e of seen) landings.push({ tick: ticks, lost, event: e })
    ticks++
  }
  return {
    game,
    fx,
    landings,
    squadAtBoss,
    lost: squadAtBoss - game.squadCount.value,
    lostShare: squadAtBoss > 0 ? (squadAtBoss - game.squadCount.value) / squadAtBoss : 1,
    boss: game.getBoss()
  }
}

const of = <K extends FxEvent['kind']>(fx: readonly FxEvent[], kind: K) =>
  fx.filter((e) => e.kind === kind) as Array<Extract<FxEvent, { kind: K }>>

// ─── The tier itself ────────────────────────────────────────────────────────

describe('the second verbs open where the rotation finishes, and not before', () => {
  it('waits until the player has met every kind once', () => {
    // The claim `BOSS_VARIANT_FROM_STAGE` makes about itself: by the stage it
    // opens on, every kind in the pool has been fought. Asserted by walking the
    // rotation rather than by re-reading the arithmetic that defines it.
    const met = new Set<BossKind>()
    for (let s = THREAT_POOL_FROM_STAGE; s < BOSS_VARIANT_FROM_STAGE; s++) {
      met.add(bossKindFor(s))
    }
    expect(met.size, 'the tier opens before the player has met every boss')
      .toBe(BOSS_POOL.length)
    for (let s = 1; s < BOSS_VARIANT_FROM_STAGE; s++) {
      expect(bossHasVariant(s), `stage ${s} handed out a second verb early`).toBe(false)
    }
    expect(bossHasVariant(BOSS_VARIANT_FROM_STAGE)).toBe(true)
  })

  it('gives every kind exactly one, and no two kinds the same one', () => {
    const variants = BOSS_POOL.map(bossVariantFor)
    expect(new Set(variants).size, 'two kinds share a second verb').toBe(BOSS_POOL.length)
  })

  it('throws nothing on the swing clock that the swing clock does not own', () => {
    // The split that keeps the healer's and the summoner's carefully-bounded
    // cadences out of `armBossCycle`'s way — see `variantOnSlamClock`.
    expect(variantOnSlamClock(bossVariantFor('meteor'))).toBe(true)
    expect(variantOnSlamClock(bossVariantFor('claw'))).toBe(true)
    expect(variantOnSlamClock(bossVariantFor('healer'))).toBe(false)
    expect(variantOnSlamClock(bossVariantFor('summoner'))).toBe(false)
  })
})

// ─── shock ──────────────────────────────────────────────────────────────────

describe('the shock is a ring of fire with a hole a crowd can stand in', () => {
  it('leaves an eye wider than the crowd, and never closes it', () => {
    // THE premise of the whole attack, and the one thing about it a long fight
    // may not change: the band grows outward, the eye does not move. A shock
    // whose safe middle closed over a fight would become unanswerable exactly
    // when the player was losing, and the mark would look identical.
    expect(SHOCK_EYE_R * 2, `an eye ${(SHOCK_EYE_R * 2).toFixed(2)} across against a crowd ${(CROWD_MAX_R * 2).toFixed(2)}`)
      .toBeGreaterThan(CROWD_MAX_R * 2)
    const early = shockOuterR(0)
    const late = shockOuterR(10_000)
    expect(late, 'the band never fattens, so the fight has no rage curve')
      .toBeGreaterThan(early)
    // …and every unit of that growth went OUTWARD.
    expect(late - SHOCK_EYE_R).toBeGreaterThan(early - SHOCK_EYE_R)
  })

  it('always opens the eye somewhere the crowd can actually reach', () => {
    // An answer the steering cannot get to is not an answer. `steerTo` clamps
    // the crowd's centre to ±(LANE_HALF − 0.4), so the eye has to sit inside
    // that from every position on the road — including both rails, where the
    // clamp on the eye's own placement is the thing doing the work.
    const reach = LANE_HALF - 0.4
    for (let x = -reach; x <= reach; x += 0.25) {
      const eye = shockEyeX(x)
      expect(Math.abs(eye), `an eye at ${eye.toFixed(2)} is outside the steer clamp`)
        .toBeLessThanOrEqual(reach)
      // …and it is always a move worth making, never opened under the crowd's
      // own feet.
      expect(Math.abs(eye - x), `an eye ${Math.abs(eye - x).toFixed(2)} from the crowd is a free cycle`)
        .toBeGreaterThan(CROWD_MAX_R * 0.5)
    }
  })

  it('costs a crowd that runs into it far less than one that runs away', async () => {
    // THE measurement, and it is deliberately a comparison against the WRONG
    // answer rather than against standing still. Every other mark in this game
    // says "not here", so the failure mode worth measuring is a player applying
    // the verb they have been taught for eight stages: run away from the mark.
    const intoTheEye = (game: Game): number => {
      const t = game.incomingThreat()
      const b = game.getBoss()
      if (!b || t?.kind !== 'shock') return game.anchor().x
      return b.slamX
    }
    const awayFromTheMark = (game: Game): number => {
      const t = game.incomingThreat()
      const b = game.getBoss()
      if (!b || t?.kind !== 'shock') return game.anchor().x
      const out = shockOuterR(b.slams + 1) + CROWD_MAX_R
      // Off the side of the mark the crowd is already on — a real attempt at the
      // old answer, not a walk into the far wall of fire.
      return b.slamX + (game.anchor().x >= b.slamX ? out : -out)
    }

    const read = await fight({
      stage: METEOR_STAGE, squad: 260, immortal: true, topUp: true, maxTicks: 1500,
      steer: intoTheEye
    })
    const fled = await fight({
      stage: METEOR_STAGE, squad: 260, immortal: true, topUp: true, maxTicks: 1500,
      steer: awayFromTheMark
    })

    const cost = (r: typeof read): number =>
      r.landings.filter((l) => l.event.kind === 'bossShock')
        .reduce((n, l) => n + l.lost, 0)

    expect(of(read.fx, 'bossShock').length, 'the meteor never threw a shock')
      .toBeGreaterThan(1)
    expect(cost(fled), 'running away from a shock cost nothing, so there is nothing to compare')
      .toBeGreaterThan(10)
    // Not "a bit better". The eye has to be worth most of the attack, or the
    // inversion is decoration.
    expect(cost(read), `reading it cost ${cost(read)} against ${cost(fled)} for fleeing`)
      .toBeLessThan(cost(fled) * 0.4)
  })

  it('announces the exact band it is about to burn', async () => {
    const r = await fight({
      stage: METEOR_STAGE, squad: 200, immortal: true, topUp: true, maxTicks: 1500,
      steer: (g) => g.anchor().x
    })
    const casts = of(r.fx, 'shockCast')
    const shocks = of(r.fx, 'bossShock')
    expect(casts.length, 'the shock was never announced').toBeGreaterThan(1)
    expect(shocks.length).toBeGreaterThan(1)
    // Every strike matches a cast exactly — same eye, same outer edge. A
    // telegraph a hair generous at its EDGE is harmless everywhere else in this
    // game; here it would kill a player standing exactly where it told them to
    // stand, so the two radii have to be the same numbers.
    for (const s of shocks) {
      const matched = casts.some((c) =>
        Math.abs(c.eye - s.eye) < 1e-9 && Math.abs(c.outer - s.outer) < 1e-9)
      expect(matched, `a shock at ${s.x.toFixed(2)} burned a band nothing announced`).toBe(true)
    }
    expect(shocks.every((s) => s.eye === SHOCK_EYE_R)).toBe(true)
  })

  it('spends a cycle rather than adding one, and never collides with the others', async () => {
    const { CHARGED_EVERY } = await import('@/game/survival')
    const r = await fight({
      stage: METEOR_STAGE, squad: 200, immortal: true, topUp: true, maxTicks: 1400,
      steer: (g) => g.anchor().x
    })
    const rings = of(r.fx, 'bossSlam')
    const shocks = of(r.fx, 'bossShock')
    const gazes = of(r.fx, 'gazeWatch')
    expect(shocks.length, 'no shock ever landed').toBeGreaterThan(1)

    // ── One swing, one attack ──
    //
    // A swing is a ring OR a shock OR a gaze, never two of them, and between
    // them they are every swing the boss threw. The ring and shock events carry
    // their swing number, so the disjointness is read directly; the total is
    // read off the boss's own counter, which every one of the three advances.
    const ringAt = new Set(rings.map((e) => e.slam))
    const shockAt = new Set(shocks.map((e) => e.slam))
    for (const n of shockAt) {
      expect(ringAt.has(n), `swing ${n} was both a ring and a shock`).toBe(false)
    }
    expect(rings.length + shocks.length + gazes.length, 'a swing went missing or was thrown twice')
      .toBe(r.boss!.slams)

    // The charged ring survived the bag. It is every `CHARGED_EVERY`-th RING —
    // counted over rings, not swings (`Boss.primaries`), which is the one way a
    // shuffled order cannot land it on a shock or skip it entirely.
    expect(rings.some((e) => e.charged), 'the bag ate the charged ring').toBe(true)
    rings.forEach((e, i) => {
      expect(e.charged, `ring ${i + 1} charged=${e.charged}`).toBe((i + 1) % CHARGED_EVERY === 0)
    })
  })
})

// ─── no fixed rotation ──────────────────────────────────────────────────────

describe('the boss draws its attacks from a bag, not a schedule', () => {
  /**
   * The sequence of verbs one attempt at a meteor throws, read off the events
   * each verb announces itself with. A ring is a `meteorCast`, a shock a
   * `shockCast`, a gaze a `gazeCast` — one cast per swing, in order.
   */
  const sequence = async (): Promise<string[]> => {
    const r = await fight({
      stage: METEOR_STAGE, squad: 200, immortal: true, topUp: true, maxTicks: 1600,
      steer: (g) => g.anchor().x
    })
    const out: string[] = []
    for (const e of r.fx) {
      if (e.kind === 'meteorCast') out.push('ring')
      else if (e.kind === 'shockCast') out.push('shock')
      else if (e.kind === 'gazeCast') out.push('gaze')
    }
    return out
  }

  it('throws every attack equally often, at every point in the fight', async () => {
    // EQUAL is the half of the requirement a random pick per swing would break:
    // a coin can come up heads five times. A bag cannot — at any prefix of the
    // fight, no attack is more than one ahead of any other.
    const seq = await sequence()
    expect(seq.length, 'the fight was too short to show a bag').toBeGreaterThanOrEqual(9)
    const seen: Record<string, number> = { ring: 0, shock: 0, gaze: 0 }
    for (const v of seq) {
      seen[v] = (seen[v] ?? 0) + 1
      const counts = Object.values(seen)
      expect(Math.max(...counts) - Math.min(...counts), `after ${seq.join(', ')}`)
        .toBeLessThanOrEqual(1)
    }
  })

  it('never throws the same attack twice in a row across a bag boundary', async () => {
    // With three or more attacks the bag's boundary rule is what stops a random
    // order from ever reading as a stutter — see `shuffleBag`.
    const seq = await sequence()
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i], `${seq.slice(0, i + 1).join(', ')}`).not.toBe(seq[i - 1])
    }
  })

  it('draws a different order on the next attempt', async () => {
    // FRESH is the other half: a retry is a new fight. Two attempts in a row
    // are two different seeds (`bossPatternSeed`), so over the first nine
    // attacks the orders cannot all agree.
    const a = await sequence()
    const b = await sequence()
    expect(a.slice(0, 9).join(','), 'two attempts threw the same order').not.toBe(b.slice(0, 9).join(','))
    // …and the SET is the same, which is what keeps the stage learnable: the
    // attacks are a function of the stage, only their order is not.
    expect(new Set(a)).toEqual(new Set(b))
  })
})

describe('the lane charge keeps the share it was priced at', () => {
  it('is never more than one draw in CHARGE_EVERY, and costs a rich pool nothing', async () => {
    const { CHARGE_EVERY, bossBag, bossVerbPool } = await import('@/game/threats')
    // The stage 2-7 phase two: a ring and a charge. "Equally often" would be one
    // charge in two, which measured a hopeless crowd's fight at 11.3 s against
    // the 10 s the adaptive bar promises it — so the bag is padded instead.
    const small = bossBag(bossVerbPool('meteor', 3, true))
    expect(small.length).toBe(CHARGE_EVERY)
    expect(small.filter((v) => v === 'charge').length).toBe(1)
    // From stage 8 there are four attacks and the charge is already one in four:
    // nothing is padded, so every attack really is drawn equally often there.
    const rich = bossBag(bossVerbPool('meteor', BOSS_VARIANT_FROM_STAGE, true))
    expect(new Set(rich).size).toBe(rich.length)
    expect(rich.filter((v) => v === 'charge').length / rich.length).toBeLessThanOrEqual(1 / CHARGE_EVERY)
    // …and before the turn there is no charge to pad at all.
    expect(bossBag(bossVerbPool('meteor', 3, false))).toEqual(['primary'])
  })
})

describe('the shock never collides with the charge either', () => {
  it('keeps the charged ring and the lane charge apart in phase two', async () => {
    // The guard the old residue partition existed for, re-asked of the bag: in
    // phase two the lane charge joins the pool, and a swing is still exactly one
    // attack.
    const r = await fight({
      stage: METEOR_STAGE, squad: 200, topUp: true, maxTicks: 2600,
      steer: (g) => g.anchor().x
    })
    const rings = new Set(of(r.fx, 'bossSlam').map((e) => e.slam))
    const shocks = new Set(of(r.fx, 'bossShock').map((e) => e.slam))
    for (const n of shocks) expect(rings.has(n)).toBe(false)
  })
})

// ─── crossrake ──────────────────────────────────────────────────────────────

describe('the crossrake moves the pocket the player just committed to', () => {
  it('puts the second pass down the middle of the first pass pockets', () => {
    // Pure geometry, and it is the whole attack: at half a spacing the second
    // rake's furrows land exactly where the first rake's pockets were. Any other
    // offset leaves an overlap a stationary crowd can answer both passes from.
    expect(CROSSRAKE_OFFSET).toBeCloseTo(CLAW_SPACING / 2, 9)
    const first = [-CLAW_SPACING, 0, CLAW_SPACING]
    const second = first.map((x) => x + CROSSRAKE_OFFSET)
    // A pocket of the first pass is midway between two of its furrows…
    const pocket = CLAW_SPACING / 2
    // …and that is a furrow of the second.
    expect(second).toContain(pocket)
  })

  it('bills its two passes out of ONE budget', async () => {
    // The claim that keeps the attack from being a doubled tax. Measured on a
    // crowd that stands still, so both passes connect: the pair has to cost
    // about what one ordinary rake of the same fight costs, not twice it.
    const r = await fight({
      stage: CLAW_STAGE, squad: 260, immortal: true, topUp: true, maxTicks: 1600,
      steer: (g) => g.anchor().x
    })
    const rakes = r.landings.filter((l) => l.event.kind === 'bossRake')
    expect(rakes.length, 'the claw never raked').toBeGreaterThan(3)

    // Pair the passes up by the two facts that define a crossrake: they are
    // `CROSSRAKE_GAP_S` apart and their lane sets are offset by exactly
    // `CROSSRAKE_OFFSET`. Derived from the constants rather than counted, so a
    // retune moves the pairing with the attack.
    const centre = (e: Extract<FxEvent, { kind: 'bossRake' }>): number =>
      e.lanes.reduce((a, b) => a + b, 0) / e.lanes.length
    const gapTicks = (CROSSRAKE_GAP_S * 1000) / STEP_MS
    const pairs: Array<[Landing, Landing]> = []
    const paired = new Set<Landing>()
    for (let i = 0; i < rakes.length; i++) {
      for (let j = i + 1; j < rakes.length; j++) {
        const a = rakes[i]!
        const b = rakes[j]!
        if (paired.has(a) || paired.has(b)) continue
        if (Math.abs(b.tick - a.tick - gapTicks) > 2) continue
        const shift = centre(b.event as never) - centre(a.event as never)
        if (Math.abs(shift - CROSSRAKE_OFFSET) > 1e-6) continue
        pairs.push([a, b])
        paired.add(a)
        paired.add(b)
      }
    }
    expect(pairs.length, 'no crossrake ever landed, so its budget is untested')
      .toBeGreaterThan(0)

    const singles = rakes.filter((l) => !paired.has(l))
    expect(singles.length, 'the fight threw no ordinary rake to compare against')
      .toBeGreaterThan(0)
    const worstSingle = Math.max(...singles.map((l) => l.lost))
    for (const [a, b] of pairs) {
      const both = a.lost + b.lost
      expect(both, `a crossrake took ${both} against an ordinary rake's ${worstSingle}`)
        .toBeLessThanOrEqual(Math.round(worstSingle * 1.35) + 1)
    }
  })

  it('announces both passes at the wind-up, not one after the other', async () => {
    // What makes `CROSSRAKE_GAP_S` fair: the 0.7 s between the passes is spent
    // EXECUTING a route the player has had the whole wind-up to plan. A second
    // telegraph raised only when the first pass landed would be 0.7 s of reading
    // and deciding as well — the 0.62-second window `SLAM_TELEGRAPH` measured at
    // a zero per cent clear rate.
    const r = await fight({
      stage: CLAW_STAGE, squad: 200, immortal: true, topUp: true, maxTicks: 800,
      steer: (g) => g.anchor().x
    })
    const casts = of(r.fx, 'rakeCast')
    expect(casts.length).toBeGreaterThan(2)
    // A crossrake's pair of casts arrive on the SAME frame, one carrying a ttl
    // exactly `CROSSRAKE_GAP_S` longer than the other. Read off the ttl gap
    // rather than off the frame, so the assertion is about the promise the two
    // casts make and not about how the events happened to be batched.
    const pair = casts.some((a) => casts.some((b) =>
      Math.abs(b.ttl - a.ttl - CROSSRAKE_GAP_S) < 1e-6 &&
      Math.abs((b.lanes[0] ?? 0) - (a.lanes[0] ?? 0) - CROSSRAKE_OFFSET) < 1e-6))
    expect(pair, 'no crossrake announced its second pass up front').toBe(true)
  })
})

// ─── ward ───────────────────────────────────────────────────────────────────

describe('the ward puts an input into the one fight that had none', () => {
  it('denies the heal to a crowd that stands on it', async () => {
    // Steered off the circle the game actually drew, so the test answers the
    // telegraph rather than its own model of where the circle should be.
    let wardAt: number | null = null
    const ontoTheWard = (game: Game, _tick: number, fx: readonly FxEvent[]): number => {
      const cast = of(fx, 'wardCast')[0]
      if (cast) wardAt = cast.x
      return wardAt ?? game.anchor().x
    }

    const stood = await fight({
      stage: HEALER_STAGE, squad: 240, immortal: true, topUp: true, maxTicks: 1600,
      steer: ontoTheWard
    })
    const denied = of(stood.fx, 'wardEnd').filter((e) => e.denied > 0)
    expect(of(stood.fx, 'wardCast').length, 'the healer never planted a ward')
      .toBeGreaterThan(0)
    expect(denied.length, 'standing on the ward denied nothing').toBeGreaterThan(0)
    // Most of it, not a token. The circle holds a full-size crowd whole, so a
    // player who gets there deserves the whole heal.
    expect(Math.max(...denied.map((e) => e.denied))).toBeGreaterThan(0.7)
    // …and the bar really did not move: the heal event carries what it actually
    // restored, so this is the arithmetic and not the animation.
    const heals = of(stood.fx, 'bossHeal')
    expect(heals.length).toBeGreaterThan(0)
    const best = heals.reduce((a, b) => (a.amount <= b.amount ? a : b))
    expect(best.amount).toBeLessThan(stood.boss!.maxHp * HEAL_FRACTION * 0.3)
  })

  it('heals in full against a crowd that ignores it', async () => {
    const r = await fight({
      stage: HEALER_STAGE, squad: 240, immortal: true, topUp: true, maxTicks: 1600,
      steer: (g) => g.anchor().x
    })
    const ends = of(r.fx, 'wardEnd')
    expect(ends.length, 'the healer never resolved a ward').toBeGreaterThan(0)
    // The crowd never went anywhere near it, so nothing was denied…
    expect(Math.max(...ends.map((e) => e.denied))).toBeLessThan(0.35)
  })

  it('leaves the shallower healer exactly as it was', async () => {
    // The tier is a tier. A healer met before `BOSS_VARIANT_FROM_STAGE` is the
    // fight the earlier stages were balanced against, ward and all.
    let shallow = -1
    for (let s = THREAT_POOL_FROM_STAGE; s < BOSS_VARIANT_FROM_STAGE; s++) {
      if (bossKindFor(s) === 'healer') shallow = s
    }
    expect(shallow, 'no healer stage below the variant tier').toBeGreaterThan(0)
    const r = await fight({
      stage: shallow, squad: 200, immortal: true, topUp: true, maxTicks: 1400,
      steer: (g) => g.anchor().x
    })
    expect(of(r.fx, 'bossHeal').length, 'the shallow healer never healed')
      .toBeGreaterThan(0)
    expect(of(r.fx, 'wardCast').length, 'a pre-tier healer planted a ward').toBe(0)
  })
})

// ─── flanks ─────────────────────────────────────────────────────────────────

describe('the flanks wave makes the middle of the road the wrong answer', () => {
  it('comes up at the rails when the bag says so, and only then', async () => {
    const r = await fight({
      stage: SUMMONER_STAGE, squad: 300, immortal: true, topUp: true, maxTicks: 2200,
      steer: (g) => g.anchor().x
    })
    const waves = of(r.fx, 'summonWave')
    expect(waves.length, 'the summoner never spent a wave').toBeGreaterThan(2)
    const flanks = waves.filter((w) => w.flank)
    expect(flanks.length, 'no wave ever came up at the rails').toBeGreaterThan(0)
    expect(waves.some((w) => !w.flank), 'every wave came up at the rails').toBe(true)
    // The opener is a line, always: it is the lesson "bones come up out of the
    // road ahead of you", and the one beat the bag is not allowed to shuffle.
    expect(waves[0]!.flank, 'the opening wave came up at the rails').toBe(false)
    // The BUDGET is untouched, which is the whole reason the variant re-prices
    // nothing: the summoner's printed health bar is derived from the total
    // number of bodies it will ever field (`bossHpMulFor`).
    expect(waves.length).toBeLessThanOrEqual(SUMMON_WAVES_MAX)
    expect(new Set(waves.map((w) => w.wave)).size, 'a wave was logged twice')
      .toBe(waves.length)
  })

  it('puts the bodies as far apart as the road allows', async () => {
    // Measured from the FOES, not from the event: the event says a flanks wave
    // happened and the bodies are what the player actually meets.
    const game = await importGame()
    game.startStage(SUMMONER_STAGE)
    game.debugSkipToArena()
    game.debugAddUnits(300)
    for (let i = 0; i < 400 && game.phase.value !== 'boss'; i++) game.step(STEP_MS)
    drainFx()

    const rails = flankXs()
    let sawFlankWave = false
    let worst = 0
    for (let i = 0; i < 2200 && game.phase.value === 'boss'; i++) {
      const b = game.getBoss()
      if (b) { b.hp = b.maxHp; b.guarded = 99 }
      game.steerTo(game.anchor().x)
      const known = new Set(game.getFoes().map((f) => f.id))
      game.step(STEP_MS)
      const wave = drainFx().find((e) => e.kind === 'summonWave' && e.flank)
      if (!wave) continue
      sawFlankWave = true
      // Every body that came up on this frame has to be at a rail.
      for (const f of game.getFoes()) {
        if (known.has(f.id) || f.elite) continue
        worst = Math.max(worst, Math.min(...rails.map((x) => Math.abs(f.x - x))))
      }
      break
    }
    expect(sawFlankWave, 'no flanks wave ever came up').toBe(true)
    // Stacked in depth and stepped inward as they go back, so "at a rail" is a
    // pack rather than a point — but never as far in as the middle, which is the
    // ground the attack is trying to make expensive.
    expect(worst, `a flank body came up ${worst.toFixed(2)} from either rail`)
      .toBeLessThan(CROWD_MAX_R)
  })
})

// ─── …and nothing anywhere lands unannounced ────────────────────────────────

describe('the second verbs keep the telegraph contract', () => {
  it('never lands anything on a late road that nothing announced', async () => {
    // The rule `attackTells` states for the tutorial roads, re-run on a stage
    // that fields the new attacks. It is the only rule in the game a NEW attack
    // can break simply by being new.
    const CASTS = new Set<FxEvent['kind']>([
      'meteorCast', 'rakeCast', 'chargeCast', 'shockCast', 'sliceCast', 'bombCast'
    ])
    const LANDS = new Set<FxEvent['kind']>([
      'bossSlam', 'bossRake', 'bossCharge', 'bossShock', 'eliteSweep', 'bombBlast'
    ])
    for (const stage of [CLAW_STAGE, METEOR_STAGE]) {
      const r = await fight({
        stage, squad: 220, immortal: true, topUp: true, maxTicks: 1200,
        steer: (g) => g.anchor().x
      })
      const casts: number[] = []
      let landed = 0
      for (const l of r.landings) {
        if (CASTS.has(l.event.kind)) casts.push(l.tick)
        if (!LANDS.has(l.event.kind)) continue
        landed++
        expect(casts.some((c) => c < l.tick), `stage ${stage}: a hit on tick ${l.tick} was silent`)
          .toBe(true)
      }
      expect(landed, `stage ${stage} landed nothing, so the ordering is untested`)
        .toBeGreaterThan(2)
    }
  })
})
