/**
 * ─── The two late skills ────────────────────────────────────────────────────
 *
 * Frost Nova (stage 7, one free use after the stage-4 boss) and the Decoy Flare
 * (stage 10). Each makes a promise the player has to be able to bank on in the
 * middle of a fight, and each promise is pinned here against the real `step()`
 * loop rather than against the numbers in `game/skills.ts`:
 *
 *   FROST   everything hostile stops where it stands — bodies, fuses, the boss's
 *           body and every one of its clocks — for `FROST_S`, nothing it does
 *           in that time costs a survivor, frozen things are brittle, and the
 *           world picks up exactly where it left off.
 *   DECOY   the flare lands on the far rail and lights; ordinary bodies go to
 *           it, the boss's aimed swings come down on it, its eye watches it —
 *           and it ends in a burst that pays for what it gathered.
 *   BOTH    a press on an empty road costs nothing, and neither outlives the
 *           road it was used on.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  DECOY_BURST_MULT, DECOY_FLIGHT_S, DECOY_S, DECOY_SWARM_R, FROST_BRITTLE, FROST_S,
  decoyRakeCentre, decoySpotX
} from '@/game/skills'
import { CLAW_SPACING, bossKindFor, clawLaneXs } from '@/game/threats'
import { CROWD_MAX_R, type Foe } from '@/game/survival'
import { drainFx, type FxEvent } from '@/use/useVfx'

const importGame = () => import('@/use/useSurvivalGame')
type Game = Awaited<ReturnType<typeof importGame>>

const STEP_MS = 16
const ticksFor = (seconds: number): number => Math.ceil((seconds * 1000) / STEP_MS)

beforeEach(async () => {
  localStorage.clear()
  const { __resetTowerState } = await import('@/use/useTowerState')
  __resetTowerState()
})

const of = <K extends FxEvent['kind']>(fx: readonly FxEvent[], kind: K) =>
  fx.filter((e) => e.kind === kind) as Array<Extract<FxEvent, { kind: K }>>

/** Everything on the road that could hurt or distract the crowd, gone — so a
 *  spec measures the skill and nothing else. */
const strip = (game: Game, keep: readonly Foe[] = []): void => {
  const foes = game.getFoes()
  for (let i = foes.length - 1; i >= 0; i--) if (!keep.includes(foes[i]!)) foes.splice(i, 1)
  game.getCrates().length = 0
  game.getCages().length = 0
  game.getBarricades().length = 0
  game.getRocks().length = 0
  game.getGuards().length = 0
  game.getGates().length = 0
  game.getDividers().length = 0
  game.getBarrels().length = 0
}

/** A stage running with a real body to copy, and nothing else on it. */
const road = async (): Promise<{ game: Game; template: Foe }> => {
  const game = await importGame()
  game.startStage(9)
  game.steerOnly.value = false
  game.debugAddUnits(60)
  for (let i = 0; i < 4000 && game.getFoes().length < 1; i++) game.step(STEP_MS)
  const template = game.getFoes()[0]
  expect(template, 'stage 9 should put something on the road').toBeTruthy()
  strip(game)
  drainFx()
  return { game, template: { ...template! } }
}

let nextId = 70_000
/** An ordinary body (or, with `elite`, a scythe) at `dx, dy` from the crowd. */
const place = (game: Game, template: Foe, dx: number, dy: number, o: Partial<Foe> = {}): Foe => {
  const a = game.anchor()
  const f: Foe = {
    ...template,
    id: nextId++, x: a.x + dx, y: a.y + dy, dead: false, elite: false, kind: 'scythe',
    hp: 1e6, maxHp: 1e6, speed: 1.6, hold: 0, flying: false, fuse: 0, reload: 0,
    kindTicks: 0, biteCd: 0, hitCd: 0, flash: 0, sweepTold: false,
    ...o
  }
  game.getFoes().push(f)
  return f
}

/** Walk into the arena on `stage`, with the boss held open (no guard gates,
 *  full health) so a fight lasts as long as a spec needs it to. */
const arena = async (stage: number, squad: number): Promise<Game> => {
  const game = await importGame()
  game.startStage(stage)
  game.debugSkipToArena()
  game.debugAddUnits(squad)
  for (let i = 0; i < 400 && game.phase.value !== 'boss'; i++) game.step(STEP_MS)
  expect(game.phase.value, `stage ${stage} never reached the arena`).toBe('boss')
  drainFx()
  return game
}
const holdBoss = (game: Game): void => {
  const b = game.getBoss()
  if (b) { b.hp = b.maxHp; b.guarded = 99 }
}

// ─── Frost Nova ─────────────────────────────────────────────────────────────

describe('Frost Nova', () => {
  it('costs nothing on an empty road', async () => {
    const { game } = await road()
    expect(game.castFrostNova()).toBe(false)
    expect(game.frostActive()).toBe(false)
    expect(of(drainFx(), 'frostNova')).toHaveLength(0)
  })

  it('stops every body where it stands, pose and all', async () => {
    const { game, template } = await road()
    const f = place(game, template, 2.4, 10)
    expect(game.castFrostNova()).toBe(true)
    expect(of(drainFx(), 'frostNova')).toHaveLength(1)
    const { x, y, phase } = f
    for (let i = 0; i < ticksFor(1); i++) {
      strip(game, [f])
      game.step(STEP_MS)
    }
    expect(f.x, 'a frozen body slid').toBe(x)
    expect(f.y, 'a frozen body walked').toBe(y)
    expect(f.phase, 'a frozen body kept its walk cycle going').toBe(phase)
  })

  it('lets the crowd walk through an ordinary body, which shatters, and costs nobody', async () => {
    const { game, template } = await road()
    const f = place(game, template, 0, 0.2)
    const id = f.id
    const brute = place(game, template, 1.2, 0.6, { elite: true, scale: 1.5 })
    const before = game.squadCount.value
    const kills = game.kills.value
    expect(game.castFrostNova()).toBe(true)
    const fx: FxEvent[] = []
    let gone = false
    for (let i = 0; i < ticksFor(0.8); i++) {
      // Only the two placed bodies — and only while the first is still itself:
      // a dead body goes back to the pool and may be handed out again.
      strip(game, gone ? [brute] : [f, brute])
      game.step(STEP_MS)
      fx.push(...drainFx())
      if (f.dead || f.id !== id) gone = true
    }
    expect(gone, 'the frozen body the crowd walked into is still standing').toBe(true)
    expect(of(fx, 'frostShatter').length).toBeGreaterThan(0)
    expect(game.kills.value, 'a shatter is a kill').toBeGreaterThan(kills)
    // The elite is a statue: solid, still there to be shot, and harmless.
    expect(brute.dead).toBe(false)
    expect(game.squadCount.value, 'a frozen body took survivors').toBe(before)
  })

  it('makes frozen things brittle', async () => {
    const { game, template } = await road()
    const f = place(game, template, 3, 12, { hp: 1000, maxHp: 1000 })
    game.__damageFoeForTest(f, 100)
    expect(f.hp).toBe(900)
    expect(game.castFrostNova()).toBe(true)
    game.__damageFoeForTest(f, 100)
    expect(f.hp).toBeCloseTo(900 - 100 * FROST_BRITTLE, 6)
  })

  it('holds the boss mid-swing — body, clock and badge — and releases it on the beat', async () => {
    const game = await arena(5, 160)
    // Wait for a wind-up that is actually on its way.
    let b = game.getBoss()!
    for (let i = 0; i < 2000; i++) {
      holdBoss(game)
      game.step(STEP_MS)
      b = game.getBoss()!
      if (b.aimed && b.slamCd > 0.3 && game.attackIncoming()) break
    }
    expect(b.aimed, 'the boss never wound up').toBe(true)
    const cd = b.slamCd
    const bx = b.x
    const by = b.y
    const squad = game.squadCount.value

    expect(game.castFrostNova()).toBe(true)
    drainFx()
    for (let i = 0; i < ticksFor(FROST_S) - 4; i++) {
      holdBoss(game)
      game.step(STEP_MS)
      expect(game.attackIncoming(), 'the badge stayed up over a frozen boss').toBe(false)
    }
    expect(b.slamCd, 'the boss kept winding up while frozen').toBe(cd)
    expect(b.x).toBe(bx)
    expect(b.y).toBe(by)
    expect(game.squadCount.value, 'something landed during the freeze').toBe(squad)

    // …and the thaw hands the same swing back, with the same seconds on it.
    const fx: FxEvent[] = []
    for (let i = 0; i < 12; i++) {
      holdBoss(game)
      game.step(STEP_MS)
      fx.push(...drainFx())
    }
    expect(of(fx, 'frostThaw')).toHaveLength(1)
    expect(game.frostActive()).toBe(false)
    expect(b.slamCd, 'the swing did not resume after the thaw').toBeLessThan(cd)
    expect(game.attackIncoming(), 'the thaw lost the warning for the swing it resumed').toBe(true)
  })
})

// ─── Decoy Flare ────────────────────────────────────────────────────────────

describe('Decoy Flare', () => {
  it('costs nothing on an empty road, and only one burns at a time', async () => {
    const { game, template } = await road()
    expect(game.throwDecoy()).toBe(false)
    place(game, template, 1, 8)
    expect(game.throwDecoy()).toBe(true)
    expect(game.throwDecoy(), 'a second flare went up over the first').toBe(false)
  })

  it('flies to the far rail and catches when it lands', async () => {
    const { game, template } = await road()
    const f = place(game, template, 1, 12)
    game.steerTo(1.5)
    for (let i = 0; i < 60; i++) { strip(game, [f]); game.step(STEP_MS) }
    expect(game.throwDecoy()).toBe(true)
    const d = game.getDecoy()!
    expect(d.x, 'the flare should go to the rail opposite the crowd').toBe(decoySpotX(d.fromX))
    expect(Math.sign(d.x)).toBe(-Math.sign(d.fromX))
    expect(d.lit).toBe(false)
    expect(game.decoyLive()).toBe(false)
    const fx: FxEvent[] = []
    for (let i = 0; i < ticksFor(DECOY_FLIGHT_S) + 2; i++) {
      strip(game, [f])
      game.step(STEP_MS)
      fx.push(...drainFx())
    }
    expect(game.decoyLive(), 'the flare never caught').toBe(true)
    expect(of(fx, 'decoyLit')).toHaveLength(1)
  })

  it('draws the bodies on the road to it, away from the crowd', async () => {
    const { game, template } = await road()
    game.steerTo(2)
    for (let i = 0; i < 60; i++) { strip(game); game.step(STEP_MS) }
    const f = place(game, template, 0, 6)
    const squad = game.squadCount.value
    expect(game.throwDecoy()).toBe(true)
    for (let i = 0; i < ticksFor(DECOY_FLIGHT_S + 1.6); i++) {
      strip(game, [f])
      game.steerTo(2)
      game.step(STEP_MS)
    }
    const d = game.getDecoy()!
    const a = game.anchor()
    const toFlare = Math.hypot(f.x - d.x, f.y - (a.y + d.ahead))
    expect(toFlare, 'the body never reached the light').toBeLessThan(DECOY_SWARM_R + 1)
    // Gathered on the far rail, not walking into the crowd.
    expect(Math.abs(f.x - a.x)).toBeGreaterThan(CROWD_MAX_R + 1)
    expect(game.squadCount.value).toBe(squad)
  })

  it('ends in a burst that pays for what it gathered', async () => {
    const { game, template } = await road()
    game.steerTo(2)
    for (let i = 0; i < 60; i++) { strip(game); game.step(STEP_MS) }
    const f = place(game, template, -3, 5)
    expect(game.throwDecoy()).toBe(true)
    const fx: FxEvent[] = []
    let hpBefore = f.hp
    let power = 0
    for (let i = 0; i < ticksFor(DECOY_FLIGHT_S + DECOY_S) + 6 && game.getDecoy(); i++) {
      strip(game, [f])
      game.steerTo(2)
      hpBefore = f.hp
      power = game.squadDps.value * DECOY_BURST_MULT
      game.step(STEP_MS)
      fx.push(...drainFx())
    }
    expect(game.getDecoy(), 'the flare never burned out').toBeNull()
    expect(of(fx, 'decoyBurst')).toHaveLength(1)
    expect(hpBefore - f.hp, 'the burst did not land on the body it gathered').toBeGreaterThanOrEqual(power * 0.99)
  })

  it('brings the boss\'s swings down on the flare instead of the crowd', async () => {
    // Stage 5 is a meteor below the second-verb tier, so every cycle is a ring
    // aimed at the ground — the attack the lure has to move.
    expect(bossKindFor(5)).toBe('meteor')
    /**
     * Each ring is attributed to whether the flare was burning when it was
     * AIMED — a swing locked while a fresh flare is still in the air is a swing
     * at the crowd, correctly, and a new flare is thrown the moment the last one
     * burns out, so a long fight has a few of those. `cost` is what the rings
     * of each kind took on the frames they landed.
     */
    const fight = async (lure: boolean): Promise<{ at: number[]; cost: number; slams: number }> => {
      const game = await arena(5, 160)
      const at: number[] = []
      let cost = 0
      let slams = 0
      let aimedLured = false
      let wasAimed = false
      // Parked BEFORE the first flare goes up: a flare is thrown to the rail
      // opposite the crowd as it stands at the throw, and a crowd still sitting
      // on the centre line would send it to the side it is about to walk to.
      for (let i = 0; i < 90; i++) {
        holdBoss(game)
        game.steerTo(2.6)
        game.step(STEP_MS)
      }
      drainFx()
      for (let i = 0; i < 1100 && game.phase.value === 'boss'; i++) {
        holdBoss(game)
        if (game.squadCount.value < 160) game.debugAddUnits(160 - game.squadCount.value)
        if (lure && !game.getDecoy()) game.throwDecoy()
        // Parked on the right; the flare goes to the left rail.
        game.steerTo(2.6)
        const litBefore = game.decoyLive()
        const before = game.squadCount.value
        game.step(STEP_MS)
        const lost = Math.max(0, before - game.squadCount.value)
        const b = game.getBoss()!
        if (b.aimed && !wasAimed) aimedLured = litBefore && game.decoyLive()
        wasAimed = b.aimed
        for (const s of of(drainFx(), 'bossSlam')) {
          if (lure && !aimedLured) continue
          slams++
          at.push(s.x)
          cost += lost
        }
      }
      return { at, cost, slams }
    }
    const control = await fight(false)
    const lured = await fight(true)
    expect(control.cost, 'the control fight never hit a parked crowd').toBeGreaterThan(20)
    expect(lured.slams, 'no ring was ever aimed at a burning flare').toBeGreaterThan(2)
    // Every ring aimed at the flare came down on the left, and none took anyone.
    for (const x of lured.at) expect(x, 'a lured ring came down near the crowd').toBeLessThan(0)
    expect(lured.cost, 'a ring aimed at the flare still found the crowd').toBe(0)
  })

  it('holds the eye on the flare, so moving under a gaze is free', async () => {
    // Stage 9 is a meteor in the gaze tier. The crowd never stops swaying — the
    // one thing a gaze punishes — and a flare is kept burning the whole fight.
    expect(bossKindFor(9)).toBe('meteor')
    const game = await arena(9, 220)
    // Frames of an open eye with a flare burning through them, and strikes that
    // landed on such a frame. A strike the frame after a flare burns out is the
    // gaze working as intended — the lure was gone and the crowd moved.
    let watchedLure = 0
    let struckUnderLure = 0
    for (let i = 0; i < 2200 && game.phase.value === 'boss'; i++) {
      holdBoss(game)
      if (game.squadCount.value < 220) game.debugAddUnits(220 - game.squadCount.value)
      if (!game.getDecoy()) game.throwDecoy()
      game.steerTo(Math.sin(i / 25) * 2.4)
      const litBefore = game.decoyLive()
      game.step(STEP_MS)
      const lit = litBefore && game.decoyLive()
      if (lit && game.bossGazeWatching()) watchedLure++
      if (lit && of(drainFx(), 'gazeStrike').length > 0) struckUnderLure++
      else drainFx()
    }
    expect(watchedLure, 'no gaze ever opened over a burning flare').toBeGreaterThan(20)
    expect(struckUnderLure, 'the eye saw the crowd move with a flare burning').toBe(0)
  })
})

// ─── The rake, aimed at a flare ─────────────────────────────────────────────

describe('a rake aimed at a flare', () => {
  it('puts the flare under a furrow and keeps every furrow off the crowd', () => {
    for (const crowd of [-3.5, -1.2, 0, 0.8, 2.6, 3.5]) {
      const flare = decoySpotX(crowd)
      const centre = decoyRakeCentre(flare, crowd, CLAW_SPACING, clawLaneXs)
      const lanes = clawLaneXs(centre)
      expect(lanes.some((l) => Math.abs(l - flare) < 1e-9), 'no furrow on the flare').toBe(true)
      const gap = Math.min(...lanes.map((l) => Math.abs(l - crowd)))
      // As far as any of the three alignments allows — and always clear of the
      // crowd's centre.
      for (const k of [-1, 0, 1]) {
        const alt = clawLaneXs(flare - k * CLAW_SPACING)
        expect(gap).toBeGreaterThanOrEqual(Math.min(...alt.map((l) => Math.abs(l - crowd))) - 1e-9)
      }
      expect(gap, `crowd at ${crowd}`).toBeGreaterThan(CROWD_MAX_R)
    }
  })
})

// ─── Both ───────────────────────────────────────────────────────────────────

describe('the late skills belong to the road they were used on', () => {
  it('drops the freeze and the flare when a stage starts', async () => {
    const { game, template } = await road()
    place(game, template, 1, 8)
    expect(game.castFrostNova()).toBe(true)
    expect(game.throwDecoy()).toBe(true)
    game.startStage(9)
    expect(game.frostActive()).toBe(false)
    expect(game.getDecoy()).toBeNull()
  })
})

describe('who owns them', () => {
  const clearedThrough = async (n: number): Promise<void> => {
    const { setState } = await import('@/use/useTowerState')
    const { BEST_STAGE_KEY } = await import('@/keys')
    setState(BEST_STAGE_KEY, n)
  }

  it('hands Frost Nova over on stage 7 and the flare on stage 10', async () => {
    const { skillOwned } = await import('@/use/useSkills')
    await clearedThrough(5)
    expect(skillOwned('frost')).toBe(false)
    await clearedThrough(6)
    expect(skillOwned('frost')).toBe(true)
    expect(skillOwned('decoy')).toBe(false)
    await clearedThrough(9)
    expect(skillOwned('decoy')).toBe(true)
  })

  it('offers one free Frost Nova from the stage-4 boss until it is spent or owned', async () => {
    const { skillTrial, spendTrial } = await import('@/use/useSkills')
    await clearedThrough(3)
    expect(skillTrial('frost')).toBe(false)
    await clearedThrough(4)
    expect(skillTrial('frost')).toBe(true)
    expect(skillTrial('decoy'), 'only the frost has a trial').toBe(false)
    spendTrial('frost')
    expect(skillTrial('frost')).toBe(false)
    // A save that never spent it stops being offered it once the skill is theirs.
    const { __resetTowerState } = await import('@/use/useTowerState')
    __resetTowerState()
    await clearedThrough(6)
    expect(skillTrial('frost')).toBe(false)
  })
})

// ─── What they cost in time ─────────────────────────────────────────────────
//
// These two are escape hatches, not a rotation: strong enough to decide a fight
// on their own, so each is priced at about one fight rather than on the
// grenade's thirty-second rhythm. Pinned because the whole balance of the late
// game is "which fight do I spend it on", and a shared clock quietly answers
// that question for the player.
describe('the late skills run their own, much longer clocks', () => {
  it('waits a fight, not a rhythm — 90 s for the nova, 75 s for the flare', async () => {
    const { DECOY_COOLDOWN_MS, FROST_COOLDOWN_MS } = await import('@/game/skills')
    const { SKILL_COOLDOWN_MS } = await import('@/use/useUpgrades')
    const { skillCooldownMs } = await import('@/use/useSkills')

    expect(FROST_COOLDOWN_MS).toBe(90_000)
    expect(DECOY_COOLDOWN_MS).toBe(75_000)
    // The nova is the strictly stronger answer — it works on anything, from
    // anywhere — so it waits the longest of the four.
    expect(FROST_COOLDOWN_MS).toBeGreaterThan(DECOY_COOLDOWN_MS)
    expect(DECOY_COOLDOWN_MS).toBeGreaterThan(SKILL_COOLDOWN_MS * 2)

    expect(skillCooldownMs('frost')).toBe(FROST_COOLDOWN_MS)
    expect(skillCooldownMs('decoy')).toBe(DECOY_COOLDOWN_MS)
    // The run's rhythm is untouched.
    expect(skillCooldownMs('grenade')).toBe(SKILL_COOLDOWN_MS)
    expect(skillCooldownMs('shield')).toBe(SKILL_COOLDOWN_MS)
  })

  it('charges each button on its OWN clock, and never strands one', async () => {
    const { FROST_COOLDOWN_MS } = await import('@/game/skills')
    const { SKILL_COOLDOWN_MS } = await import('@/use/useUpgrades')
    const { setState } = await import('@/use/useTowerState')
    const { SKILL_READY_KEY } = await import('@/keys')
    const { skillCharge, skillReadyIn, startCooldown } = await import('@/use/useSkills')

    startCooldown('frost')
    startCooldown('grenade')
    // Half of the grenade's clock has passed: it is halfway back, and the nova,
    // on a clock three times as long, has barely moved.
    setState(SKILL_READY_KEY, {
      grenade: Date.now() + SKILL_COOLDOWN_MS / 2,
      frost: Date.now() + FROST_COOLDOWN_MS - SKILL_COOLDOWN_MS / 2
    })
    expect(skillCharge('grenade')).toBeCloseTo(0.5, 1)
    expect(skillCharge('frost')).toBeLessThan(0.2)

    // A device clock thrown a year forward still cannot park a skill for longer
    // than its own cooldown.
    setState(SKILL_READY_KEY, { frost: Date.now() + 365 * 24 * 3600 * 1000 })
    expect(skillReadyIn('frost')).toBeLessThanOrEqual(FROST_COOLDOWN_MS)
  })

  it('freezes for a quarter less than it used to, and still outlasts a wind-up', async () => {
    const { FROST_S } = await import('@/game/skills')
    // It was 3.5 s. The nova has to outlast the attack the player pressed it to
    // escape — a boss wind-up is 0.7-1.7 s — without being long enough to read
    // the whole road, reposition and come back.
    expect(FROST_S).toBeCloseTo(2.6, 2)
    expect(FROST_S).toBeGreaterThan(1.7)
    expect(FROST_S).toBeLessThan(3.5 * 0.8)
  })
})
