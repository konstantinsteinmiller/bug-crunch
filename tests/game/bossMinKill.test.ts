// The climbing floor under a boss swing.
//
// Every big attack is priced as a SHARE of the crowd, with a floor under it so
// a swing against a thinned-out squad still reads as a hit. The floor was flat
// at three bodies, which is a real hit on stage 2 and a rounding error on stage
// 45 — and the case it failed is the one that matters least to difficulty and
// most to patience: a crowd that reached the arena too thin to get through the
// bar. That run has already lost, and a flat floor made losing take a minute.
//
// So it climbs: +`BOSS_MIN_KILL_STEP` every `BOSS_MIN_KILL_PER_STAGES` stages.
//
// What makes it safe is that it is a FLOOR and the share owns every case where
// it is bigger. This file exists to keep that true, because the failure mode of
// getting it wrong is invisible in a screenshot and lands on healthy runs: at
// stage 60 the floor is 27, and if it ever started binding against ordinary
// crowds it would be quietly deleting a quarter of a 100-strong squad per swing.
import { describe, expect, it } from 'vitest'
import {
  BOSS_MIN_KILL, BOSS_MIN_KILL_MAX, BOSS_MIN_KILL_PER_STAGES, BOSS_MIN_KILL_STEP,
  SLAM_FRACTION_MAX, SLAM_MAX_FRACTION, bossMinKill, endlessPressure
} from '@/game/survival'

/** What one connecting swing takes, before any discount. */
const bite = (stage: number, squad: number, floor: number): number => {
  const share = Math.min(SLAM_FRACTION_MAX, SLAM_MAX_FRACTION * endlessPressure(stage))
  return Math.max(floor, Math.ceil(squad * share))
}

const STAGES = [2, 6, 10, 20, 30, 45, 60, 100]

describe('the boss swing floor', () => {
  it('climbs by the step it says it climbs by', () => {
    expect(bossMinKill(0)).toBe(BOSS_MIN_KILL)
    for (const stage of STAGES) {
      const bands = Math.floor(stage / BOSS_MIN_KILL_PER_STAGES)
      expect(bossMinKill(stage), `stage ${stage}`)
        .toBe(Math.min(BOSS_MIN_KILL_MAX, BOSS_MIN_KILL + BOSS_MIN_KILL_STEP * bands))
    }
    // …and never goes backwards, which a `Math.floor` on a negative stage would
    // do if one ever reached here.
    for (let stage = 0; stage <= 120; stage++) {
      expect(bossMinKill(stage)).toBeGreaterThanOrEqual(bossMinKill(Math.max(0, stage - 1)))
    }
    expect(bossMinKill(-5), 'a negative stage fell through the floor').toBe(BOSS_MIN_KILL)
  })

  it('leaves the onboarding stages exactly where they were', () => {
    // Stages 1-4 are the tutorial ladder and must not move at all. Stage 5 is
    // the first band and gains its two.
    for (const stage of [0, 1, 2, 3, 4]) expect(bossMinKill(stage), `stage ${stage}`).toBe(3)
    expect(bossMinKill(5)).toBe(5)
  })

  it('changes NOTHING for a crowd big enough for a percentage to mean something', () => {
    // The whole safety argument. A healthy squad's swing is priced by the share,
    // and the share must still own it at every depth — measured, 80 survivors is
    // already past the crossover on every stage in the campaign.
    for (const stage of [...STAGES, 200, 500]) {
      for (const squad of [80, 200, 600, 1500, 4000]) {
        expect(bite(stage, squad, bossMinKill(stage)), `stage ${stage}, squad ${squad}`)
          .toBe(bite(stage, squad, BOSS_MIN_KILL))
      }
    }
  })

  it('resolves a hopeless arena instead of dragging it out', () => {
    // The case it is written for. "Swings to wipe" is the honest metric: the
    // run is lost either way, and the only question is how long the player is
    // asked to stand there while it happens.
    for (const stage of [30, 45, 60]) {
      for (const squad of [10, 20, 40]) {
        const before = squad / bite(stage, squad, BOSS_MIN_KILL)
        const after = squad / bite(stage, squad, bossMinKill(stage))
        expect(after, `stage ${stage}, squad ${squad}: ${before.toFixed(1)} -> ${after.toFixed(1)}`)
          .toBeLessThan(before)
      }
    }
    // Concretely, at the depth this was reported from: a twenty-strong squad at
    // stage 45 went from three connecting swings to one.
    expect(20 / bite(45, 20, BOSS_MIN_KILL)).toBeGreaterThan(2.5)
    expect(20 / bite(45, 20, bossMinKill(45))).toBeLessThanOrEqual(1)
  })

  it('stays a floor, not a share', () => {
    // A floor that grew past what a swing may take as a PERCENTAGE would have
    // stopped being a floor and become a second, harsher difficulty curve
    // hiding under one. Checked against the crowd size where the two meet: it
    // must always be small, at EVERY depth the endless road can reach.
    for (let stage = 2; stage <= 500; stage += 2) {
      const share = Math.min(SLAM_FRACTION_MAX, SLAM_MAX_FRACTION * endlessPressure(stage))
      const crossover = bossMinKill(stage) / share
      expect(crossover, `stage ${stage}: the floor binds up to ${Math.round(crossover)} survivors`)
        .toBeLessThan(80)
    }
  })
})
