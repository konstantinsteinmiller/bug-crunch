import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * ─── The seeded board is a stated curve, not a pile of numbers ──────────────
 *
 * Poki and Yandex cannot post a score, so their baked board is the whole board
 * for the life of the build and nobody playing it will ever join it. It is
 * generated from a retention curve rather than copied from the live board,
 * because the live board is a record of everyone who ever opened the game once
 * — 56 % of whom never passed stage 2 — and ranking a Poki player against that
 * says more about the sample than about them.
 *
 * The curve is a design decision with numbers in it, so the numbers are pinned
 * here. Regenerate with `pnpm leaderboard:seed` after changing `SURVIVAL`, and
 * expect this file to be what tells you the shape moved.
 */

const seed = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/leaderboard-seed.json'), 'utf-8')
) as {
  source: string
  total: number
  entries: { rank: number; name: string; score: number; flair: number }[]
  dist: [number, number][]
}

const band = (lo: number, hi: number): number =>
  seed.dist.filter(([s]) => s >= lo && s <= hi).reduce((a, [, n]) => a + n, 0)
const share = (n: number): number => n / seed.total
const above = (x: number): number =>
  seed.dist.filter(([s]) => s > x).reduce((a, [, n]) => a + n, 0)

describe('the seeded board matches the retention curve it claims', () => {
  it('says out loud that it is modelled', () => {
    // The one guard against this file being mistaken for telemetry later.
    expect(seed.source).toBe('seeded:retention-curve')
  })

  it('puts the mass where the design says players stop', () => {
    // Each band to within a point, which is tight enough to catch a reshaped
    // curve and loose enough to survive the rounding that spreads 154 331
    // players across sixty stages.
    expect(share(band(1, 2))).toBeCloseTo(0.07, 2)   // "some few on stage 1 and 2"
    expect(share(band(3, 4))).toBeCloseTo(0.31, 2)   // "most players quit on 3 and 4"
    expect(share(band(5, 10))).toBeCloseTo(0.37, 2)  // "most play till 5-10"
    expect(share(band(11, 20))).toBeCloseTo(0.17, 2)
    expect(share(above(20))).toBeCloseTo(0.08, 2)    // "only ~8% go past stage 20"
  })

  it('gives 3-4 the biggest two-stage drop-off of any pair', () => {
    // The band shares above can all be right while the peak sits somewhere
    // else, so the SHAPE is asserted separately from the totals.
    const pairs: [number, number][] = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]]
    const sizes = pairs.map(([lo, hi]) => band(lo, hi))
    expect(Math.max(...sizes)).toBe(band(3, 4))
  })

  it('falls away monotonically once past the quit peak', () => {
    // `dist` is the QUIT histogram — how many players stopped ON each stage —
    // not the survival curve, so it rises into the stage-3/4 peak by design and
    // only the tail after it has to be monotonic. A bump out in the twenties is
    // the tell that the interpolation broke between two anchors.
    //
    // Not STRICTLY monotonic, and the tolerance is measured rather than picked.
    // The bands the spec asks for imply a wall at stage 20 — 17 % of everyone
    // stops in 11-20 and only 8 % remain after it — so the drop-off rate has to
    // steepen there, and a step in the rate is a step in the histogram. Spread
    // over four tail anchors the largest remaining rise is 2.4 %; with a single
    // anchor it was 15 % and stage 21 visibly held more players than stage 20.
    // 5 % keeps that regression out without failing on rounding.
    const byStage = [...seed.dist].sort((a, b) => a[0] - b[0])
    const peak = byStage.findIndex(([s]) => s === 4)
    expect(peak).toBeGreaterThan(0)
    for (let i = peak + 1; i < byStage.length; i++) {
      expect(byStage[i]![1], `stage ${byStage[i]![0]} kept more players than ${byStage[i - 1]![0]}`)
        .toBeLessThanOrEqual(byStage[i - 1]![1] * 1.05)
    }
  })

  it('rises into the peak, so the opening is not the hardest part', () => {
    // The other half of the shape: stages 1 and 2 must each be SMALLER than the
    // peak, or "some few on stage 1 and 2" is not what the board says.
    const at = (stage: number): number => seed.dist.find(([s]) => s === stage)?.[1] ?? 0
    expect(at(1)).toBeLessThan(at(3))
    expect(at(2)).toBeLessThan(at(3))
  })

  it('lands the published hundred at stage 40+', () => {
    expect(seed.entries).toHaveLength(100)
    expect(seed.entries[99]!.score).toBeGreaterThanOrEqual(40)
    // …and the very best are deeper still, without being absurd.
    expect(seed.entries[0]!.score).toBeGreaterThan(seed.entries[99]!.score)
    expect(seed.entries[0]!.score).toBeLessThan(100)
  })

  it('publishes rows its own histogram agrees with', () => {
    // `entries` and `dist` have to describe ONE population: a board that ranked
    // its own listed players wrongly is the one bug nobody would forgive.
    const rank = (score: number): number => above(score) + 1
    for (const e of seed.entries) {
      expect(rank(e.score), `${e.name} is listed #${e.rank} but ranks #${rank(e.score)}`)
        .toBeLessThanOrEqual(e.rank)
    }
    expect(seed.total).toBe(seed.dist.reduce((a, [, n]) => a + n, 0))
  })

  it('carries names the game could actually have produced', () => {
    // `cleanName` caps at 16 and strips anything unprintable, so a seeded name
    // that needed cleaning would render differently from a real one.
    for (const e of seed.entries) {
      expect(e.name.length).toBeGreaterThan(2)
      expect(e.name.length).toBeLessThanOrEqual(16)
      expect(e.name).toMatch(/^[A-Za-z0-9][A-Za-z0-9.]*[A-Za-z0-9]$/)
      expect(e.flair).toBeGreaterThan(0)
      expect(e.flair).toBeLessThanOrEqual(4000)
    }
    expect(new Set(seed.entries.map((e) => e.name)).size, 'the board lists the same name twice')
      .toBe(seed.entries.length)
  })
})
