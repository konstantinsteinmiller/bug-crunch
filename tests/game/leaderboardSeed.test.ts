import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { allLevels, TOTAL_LEVELS } from '@/game/stages'
// @ts-expect-error — plain-JS build script, no declaration file.
import { MAX_STAGE, QUOTA, scoreTargetFor, stageCounts } from '../../scripts/leaderboard-seed.mjs'

/**
 * ─── The seeded board is a stated curve, not a pile of numbers ──────────────
 *
 * Poki and Yandex cannot post a score, so their baked board is the whole board
 * for the life of the build and nobody playing it will ever join it. It is
 * generated from a retention curve rather than copied from a live board,
 * because a live board is a record of everyone who ever opened the game once —
 * a survivorship sample, not a population.
 *
 * The curve is a design decision with numbers in it, so the numbers are pinned
 * here. Regenerate with `pnpm leaderboard:seed` after changing `SURVIVAL`, and
 * expect this file to be what tells you the shape moved.
 *
 * ── Two histograms, and only one of them ships ──
 *
 * The curve is stated over STAGES, because that is how retention is described.
 * The board publishes a histogram over POINTS, because that is what the game
 * posts. `stageCounts()` is the first; `seed.dist` is the second. Mixing them
 * up is the bug this suite exists to prevent — see the "ranks by points" case.
 */

interface SeedRow { rank: number; name: string; score: number; squad: number }
interface Seed {
  source: string
  total: number
  entries: SeedRow[]
  dist: [number, number][]
}

const seed = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/leaderboard-seed.json'), 'utf-8')
) as Seed

const stages = stageCounts() as [number, number][]
const stagePop = stages.reduce((a, [, n]) => a + n, 0)

const band = (lo: number, hi: number): number =>
  stages.filter(([s]) => s >= lo && s <= hi).reduce((a, [, n]) => a + n, 0)
const share = (n: number): number => n / stagePop
const atStage = (stage: number): number => stages.find(([s]) => s === stage)?.[1] ?? 0

/** The Worker's own rank arithmetic — `COUNT(*) WHERE score > ?` + 1. */
const rankFor = (score: number): number =>
  seed.dist.filter(([s]) => s > score).reduce((a, [, n]) => a + n, 0) + 1

describe('the seeded board matches the retention curve it claims', () => {
  it('says out loud that it is modelled', () => {
    // The one guard against this file being mistaken for telemetry later.
    expect(seed.source).toBe('seeded:retention-curve')
  })

  it('puts the mass where the design says players stop', () => {
    // Each band to within a point: tight enough to catch a reshaped curve,
    // loose enough to survive rounding the population across forty stages.
    expect(share(band(1, 2))).toBeCloseTo(0.07, 2)   // "some few on stage 1 and 2"
    expect(share(band(3, 4))).toBeCloseTo(0.31, 2)   // "most players quit on 3 and 4"
    expect(share(band(5, 10))).toBeCloseTo(0.37, 2)  // "most play till 5-10"
    expect(share(band(11, 20))).toBeCloseTo(0.17, 2)
    expect(share(band(21, 40))).toBeCloseTo(0.08, 2) // "only ~8 % go past stage 20"
  })

  it('gives 3-4 the biggest two-stage drop-off of any pair', () => {
    // The band shares can all be right while the peak sits somewhere else, so
    // the SHAPE is asserted separately from the totals.
    const pairs: [number, number][] = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]]
    expect(Math.max(...pairs.map(([lo, hi]) => band(lo, hi)))).toBe(band(3, 4))
  })

  it('rises into the peak, so the opening is not the hardest part', () => {
    expect(atStage(1)).toBeLessThan(atStage(3))
    expect(atStage(2)).toBeLessThan(atStage(3))
  })

  it('falls away monotonically from the peak to the last level', () => {
    // The stage histogram is the QUIT histogram — how many players stopped ON
    // each stage — so it rises into the 3/4 peak by design and only the tail
    // after it has to fall. A bump out in the twenties is the tell that the
    // interpolation broke between two anchors.
    //
    // Stage 40 is excluded and asserted on its own below: it is the last level,
    // so everybody still playing necessarily stops there.
    for (let stage = 5; stage < MAX_STAGE; stage++) {
      expect(atStage(stage), `stage ${stage} kept more players than ${stage - 1}`)
        .toBeLessThanOrEqual(atStage(stage - 1))
    }
  })

  it('has no step in the drop-off rate at the wall on 20', () => {
    // The band brief implies a wall at 20 — 17 % stop in 11-20, only 8 % are
    // left after it — and in the board this was ported from that made the rate
    // JUMP there, leaving stage 21 holding 15 % MORE players than stage 20. A
    // step in the rate is a visible step in the histogram. Here the tail has
    // nineteen stages to spend 8 % in, which needs no jump at all.
    expect(atStage(21)).toBeLessThanOrEqual(atStage(20))
  })

  it('parks the last of the players on the last level, and nowhere past it', () => {
    // A campaign of forty levels has nowhere to put stage 41, so the curve must
    // not model one. A board whose best players sit on "stage 52" ranks nobody.
    expect(MAX_STAGE).toBe(TOTAL_LEVELS)
    expect(Math.max(...stages.map(([s]) => s))).toBe(TOTAL_LEVELS)
    for (const e of seed.entries) {
      expect(e.squad).toBeGreaterThanOrEqual(1)
      expect(e.squad).toBeLessThanOrEqual(TOTAL_LEVELS)
    }
    // The pile-up on 40 is the real shape, not a bug: it is every player who
    // finished the game. It stays invisible because the board ranks by points.
    expect(atStage(MAX_STAGE)).toBeGreaterThan(atStage(MAX_STAGE - 1))
  })
})

describe('the board ranks by POINTS, the way the game posts them', () => {
  it('does not hand a first-level clear the top of the board', () => {
    // THE REGRESSION THIS FILE EXISTS FOR. The seed used to put a STAGE number
    // in `score`, so its histogram topped out at 40 while every real player
    // posts hundreds or thousands. `rankFromDist` then found nobody above them
    // and answered "#1 of 154 331" to everyone who had ever cleared a level —
    // on precisely the two portals whose whole board this file is.
    const firstClear = scoreTargetFor(1) as number
    expect(rankFor(firstClear)).toBeGreaterThan(seed.total * 0.9)
  })

  it('gives a better score a better rank, all the way up', () => {
    const probes = [1, 5, 10, 15, 20, 25, 30, 35, 40]
      .map((level) => scoreTargetFor(level) as number)
    const ranks = probes.map(rankFor)
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]!, `${probes[i]} ranked worse than ${probes[i - 1]}`)
        .toBeLessThan(ranks[i - 1]!)
    }
    // And the best of them is a real placing rather than the top of the board.
    //
    // `> 1`, not `> 100`: where the level-40 three-star target lands depends on
    // the POPULATION, and that is a knob. On 154 331 players it was #1 207; on
    // 2 531 it is #21 — both correct, and an assertion pinned to either one
    // fails the next time `TOTAL` moves without anything being wrong.
    expect(ranks[ranks.length - 1]!).toBeGreaterThan(1)
  })

  it('publishes rows its own histogram agrees with', () => {
    // `entries` and `dist` have to describe ONE population: a board that ranked
    // its own listed players wrongly is the one bug nobody would forgive.
    expect(seed.entries).toHaveLength(100)
    for (const e of seed.entries) {
      expect(rankFor(e.score), `${e.name} is listed #${e.rank} but ranks #${rankFor(e.score)}`)
        .toBeLessThanOrEqual(e.rank)
    }
    expect(seed.total).toBe(seed.dist.reduce((a, [, n]) => a + n, 0))
    expect(seed.total).toBe(stagePop)
  })

  it('publishes the histogram score-DESC, which every rank walk assumes', () => {
    for (let i = 1; i < seed.dist.length; i++) {
      expect(seed.dist[i]![0]).toBeLessThan(seed.dist[i - 1]![0])
    }
  })

  it('does not pile the top of the board onto one clamped score', () => {
    // A hard `Math.min` on the skill factor is an atom of probability sitting on
    // one value: the first cut of this board had ELEVEN players tied at the
    // ceiling, which is the top eleven published rows showing one identical
    // score. `soften` replaced it with an asymptote.
    expect(seed.dist[0]![1]).toBeLessThanOrEqual(2)
    expect(new Set(seed.entries.slice(0, 20).map((e) => e.score)).size)
      .toBeGreaterThanOrEqual(15)
  })

  it('keeps the best score believable against the hardest level', () => {
    const hardest = scoreTargetFor(TOTAL_LEVELS) as number
    expect(seed.entries[0]!.score).toBeGreaterThan(hardest)
    // A great run, not a broken one.
    expect(seed.entries[0]!.score).toBeLessThan(hardest * 2.5)
  })

  it('carries names the game could actually have produced', () => {
    // `cleanName` caps at 16 and strips anything unprintable, so a seeded name
    // that needed cleaning would render differently from a real one.
    for (const e of seed.entries) {
      expect(e.name.length).toBeGreaterThan(2)
      expect(e.name.length).toBeLessThanOrEqual(16)
      expect(e.name).toMatch(/^[A-Za-z0-9][A-Za-z0-9.]*[A-Za-z0-9]$/)
    }
    expect(new Set(seed.entries.map((e) => e.name)).size, 'the board lists the same name twice')
      .toBe(seed.entries.length)
  })
})

describe('the score model still matches the campaign it was fitted to', () => {
  /**
   * The drift guard.
   *
   * `scripts/leaderboard-seed.mjs` is plain Node and cannot import the game's
   * TypeScript through its `@/` alias, so it carries a COPY of the level quotas.
   * This file can import both, which is the only place the two can be held
   * against each other. If the campaign is retuned and this fails, update
   * `QUOTA` in the script and re-run `pnpm leaderboard:seed`.
   */
  it('mirrors every level quota from the real campaign', () => {
    const real = allLevels().map((l) => (l.boss ? 0 : l.quota))
    expect(QUOTA).toEqual(real)
  })

  it('reproduces the score objectives the campaign actually sets', () => {
    // Only levels whose optional objective IS a score carry one, so these three
    // are the whole overlap — and they pin both the quota table and the
    // `quota * 26 * (1 + w * 0.55)` expression copied out of `optionals()`.
    const objectives = new Map<number, number>()
    for (const level of allLevels()) {
      const scored = (level.objectives as ReadonlyArray<{ kind: string; n?: number }>)
        .find((o) => o.kind === 'score')
      if (scored?.n !== undefined) objectives.set(level.id, scored.n)
    }
    expect(objectives.size).toBeGreaterThan(0)
    for (const [id, n] of objectives) {
      expect(scoreTargetFor(id), `level ${id}`).toBe(n)
    }
  })
})
