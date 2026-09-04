// ─── The first pickup in the game ───────────────────────────────────────────
//
// A crate is an obstacle that becomes a reward if you shoot it, and players who
// only ever meet the first half of that sentence learn "boxes are obstacles" —
// then spend the rest of the run steering around the best pickups in the game.
//
// Stage 1 therefore opens with a WALL of boxes rather than a box. It is not a
// question, it is an answer: wherever the player happens to be standing they are
// already shooting one, the squad auto-fires, and the reward lands whether or
// not they understood it was on offer.
//
// Three properties carry that, and every one of them is easy to undo by accident
// later — a retuned crate curve, a wider road, a tidier spacing loop.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildTrack, CRATE_DETOUR_X, SECOND_PICKUP_HP, SECOND_PICKUP_X,
  TUTORIAL_CRATE_WALL, TUTORIAL_WALL_RATE_EACH, TUTORIAL_WALL_RATE_TOTAL
} from '@/game/track'
import { BASE_FIRE_RATE, CRATE_R, CRATE_RATE_GAIN, LANE_HALF } from '@/game/survival'

const STEP_MS = 16

// Hermetic per test. The retry relief hands a bigger squad to a player who has
// been dying, and the shop raises the base fire rate — either one changes how
// fast the wall comes down, so a lane that passes alone can fail after a
// neighbour has run. The claim here is about a FIRST-time player.
beforeEach(async () => {
  localStorage.clear()
  const { __resetTowerState } = await import('@/use/useTowerState')
  __resetTowerState()
})

const firstCrateRow = (stage: number) => {
  const e = buildTrack(stage).events.find((ev) => ev.kind === 'crates')
  if (!e || e.kind !== 'crates') throw new Error(`stage ${stage} has no crates`)
  return e
}

describe('the opening wall', () => {
  it('closes the road from rail to rail', () => {
    const xs = [...TUTORIAL_CRATE_WALL].sort((a, b) => a - b)
    expect(xs.length).toBeGreaterThan(4)

    // Its outer edges reach both rails, so there is no lip to squeeze past.
    expect(xs[0]! - CRATE_R).toBeLessThanOrEqual(-LANE_HALF + 0.01)
    expect(xs[xs.length - 1]! + CRATE_R).toBeGreaterThanOrEqual(LANE_HALF - 0.01)

    // Symmetric: a remainder left at one rail is exactly where a nervous player
    // drives, so the wall may not be stepped from one side.
    expect(xs[0]!).toBeCloseTo(-xs[xs.length - 1]!, 6)

    for (let i = 1; i < xs.length; i++) {
      const gap = xs[i]! - xs[i - 1]!
      // Never overlapping — a box behind a box is a health bar nobody can see…
      expect(gap, `boxes ${i - 1}/${i} overlap`).toBeGreaterThanOrEqual(CRATE_R * 2)
      // …and never a hole anything could steer through.
      expect(gap - CRATE_R * 2, `hole between boxes ${i - 1}/${i}`).toBeLessThan(0.2)
    }
  })

  it('is what stage 1 actually opens with, and cannot bill anybody', () => {
    const row = firstCrateRow(1)
    expect(row.crates.length).toBe(TUTORIAL_CRATE_WALL.length)
    // 1 HP is the whole safety argument: a rolled stage-1 rate crate is 9 HP,
    // which a starting squad of three cannot clear before it arrives — so the
    // box meant to teach "shoot it" would instead demonstrate "it costs you
    // people", which is the misconception this beat exists to correct.
    for (const c of row.crates) {
      expect(c.hp, 'a tutorial box priced to survive first contact').toBe(1)
    }
  })

  it('is priced as one pickup, not as seven', () => {
    // The wall is seven boxes because it has to be unmissable, not because it is
    // worth seven boxes. Priced per box at the normal rate it handed a
    // first-time player most of the fire-rate curve before they met an enemy —
    // the beat is a lesson, and a lesson should not also be the run's biggest
    // windfall.
    expect(TUTORIAL_WALL_RATE_EACH)
      .toBeCloseTo(TUTORIAL_WALL_RATE_TOTAL / TUTORIAL_CRATE_WALL.length, 10)

    // Clear every box and fire rate goes 1.9 -> 2.5.
    expect(BASE_FIRE_RATE + TUTORIAL_WALL_RATE_TOTAL).toBeCloseTo(2.5, 6)

    // The guard that matters if someone later widens the wall: however many
    // boxes it is cut into, the whole row stays worth about one ordinary crate.
    // Without this, making the wall more unmissable silently makes it richer.
    expect(TUTORIAL_WALL_RATE_TOTAL).toBeLessThanOrEqual(CRATE_RATE_GAIN * 1.2)
  })

  // The property that matters, stated the way a player would: wherever you are,
  // you get paid.
  for (const lane of [-4.4, -3, -1.5, 0, 1.5, 3, 4.4]) {
    it(`pays out and costs nothing from lane ${lane}`, async () => {
      const game = await import('@/use/useSurvivalGame')
      game.startStage(1)
      const rate0 = game.runFireRate.value
      const squad0 = game.squadCount.value

      // Stops just past the wall, not at the end of the opening. What is being
      // asserted is that the FIRST pickup is unmissable and free — the supply
      // crate further up the road is an ordinary box on a shoulder and is
      // allowed to be an obstacle, which is the rest of the game's whole
      // vocabulary.
      const wallY = firstCrateRow(1).y
      for (let i = 0; i < 3000; i++) {
        game.steerTo(lane)
        game.step(STEP_MS)
        if (game.anchor().y > wallY + 3) break
      }

      // THE claim: wherever you were standing, you got paid.
      expect(game.runFireRate.value, 'the opening wall was missable').toBeGreaterThan(rate0)
      // …and no line through it pays more than the row is priced at, however
      // many boxes that particular drive happened to clear.
      expect(game.runFireRate.value, 'a lane through the wall out-earned the whole wall')
        .toBeLessThanOrEqual(rate0 + TUTORIAL_WALL_RATE_TOTAL + 1e-6)

      // And it did not read as a punishment on the way through.
      //
      // Not zero, and the difference is measured rather than assumed: over 330
      // hermetic trials across eleven lanes the payout landed 330 times, the
      // squad never once finished smaller than it started, and 4 runs (1.2 %)
      // grazed at most 2 bodies. That residue is structural — only a few shooter
      // streams fire, so a flank can reach a box a fraction of a second before a
      // bullet does — and at 1 HP it is a bump while ploughing through crates,
      // not a toll. Asserting 0 here would be asserting a coin flip.
      expect(game.deathBreakdown().crate ?? 0, 'the opening wall read as a toll')
        .toBeLessThanOrEqual(2)
      // The one that must never bend: the wall may cost a graze, never a net loss.
      expect(game.squadCount.value, 'the first pickup left the player worse off')
        .toBeGreaterThanOrEqual(squad0)
    })
  }
})

// ─── …and the one straight after it ─────────────────────────────────────────
//
// The wall teaches that boxes are worth having. The very next box is where the
// player acts on that, and it used to be placed by the supply floor rather than
// authored: a full-priced 7 HP crate out on the far shoulder, a couple of
// seconds behind the wall. Players went for it — the lesson worked — and could
// not break it. The beat after "boxes make you stronger" was "…but not strong
// enough", which is a worse thing to teach than nothing.
describe('the second pickup', () => {
  const secondRow = () => {
    const rows = buildTrack(1).events.filter((e) => e.kind === 'crates')
    const row = rows[1]
    if (!row || row.kind !== 'crates') throw new Error('stage 1 has no second crate row')
    return row
  }

  it('is authored, not left to the supply floor', () => {
    const row = secondRow()
    expect(row.crates).toHaveLength(1)
    expect(Math.abs(row.crates[0]!.x)).toBeCloseTo(SECOND_PICKUP_X, 6)
    expect(row.crates[0]!.hp).toBe(SECOND_PICKUP_HP)

    // A step off the line, not a lunge at the rail. Every LATER crate uses
    // `CRATE_DETOUR_X`; the one that teaches the detour asks for less than the
    // ones that test it.
    expect(Math.abs(row.crates[0]!.x)).toBeLessThan(CRATE_DETOUR_X)
    // And priced well under the stage-1 curve, which would roll this at 7.
    expect(row.crates[0]!.hp).toBeLessThan(7)
  })

  it('is won by a player who commits at a human moment', async () => {
    const game = await import('@/use/useSurvivalGame')
    const { __resetTowerState } = await import('@/use/useTowerState')

    // `lead` is how much road is left when the player finally turns for it.
    // Six units is a bit over a second — a player who sees the box and reacts.
    //
    // Four is the measured edge and is deliberately NOT asserted: the sim rolls
    // for bullet spread and formation jitter, so at four it is taken almost
    // always rather than always, and pinning it here would buy a flaky suite in
    // exchange for a claim about a reaction time nobody has. Below four it is a
    // swerve, and a swerve into a crate is allowed to cost something. This test
    // is about the player who PLAYED it.
    for (const lead of [12, 8, 6]) {
      for (const lane of [0, 3.5, -3.5]) {
        localStorage.clear()
        __resetTowerState()
        game.startStage(1)
        const dmg0 = game.damage.value
        let committed = false
        for (let i = 0; i < 3000; i++) {
          const a = game.anchor()
          const box = game.getCrates().find((c) => c.kind === 'damage' && !c.dead)
          if (box && box.y - a.y <= lead) { game.steerTo(box.x); committed = true }
          else if (!committed) game.steerTo(lane)
          game.step(STEP_MS)
          if (a.y > 40) break
        }
        expect(game.damage.value, `lead ${lead} from lane ${lane}: the box could not be broken`)
          .toBeGreaterThan(dmg0)
        // Measured: the authored box costs at most a graze at these leads. The
        // 7 HP version on the far shoulder cost five bodies even at lead 12.
        expect(game.deathBreakdown().crate ?? 0, `lead ${lead} from lane ${lane}: it read as a toll`)
          .toBeLessThanOrEqual(2)
      }
    }
  })
})
