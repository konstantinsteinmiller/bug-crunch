/**
 * ─── The adaptive-difficulty probe ──────────────────────────────────────────
 *
 * A scratch probe, not a regression: it asserts almost nothing and reports. It
 * is the measurement `game/adaptive.ts` is tuned against, and the reproduction
 * for every number quoted in that file's comments.
 *
 *   SIM_ADAPT=1 npx vitest run tests/sim/scratch.adaptive.test.ts --reporter=verbose
 *   # PowerShell: $env:SIM_ADAPT=1; npx vitest run … --reporter=verbose
 *
 * `--reporter=verbose` is load-bearing — Vitest 4's default reporter swallows
 * `console.log` from a passing test.
 *
 * Two tables, answering different questions:
 *
 *   ROAD  — plays whole stages with the scripted policies and reports what each
 *           one arrives at the boss with, what bar it was handed, and how long
 *           the fight took. This is the table that says whether the ladder the
 *           design asks for exists in a run somebody could actually have.
 *   ARENA — places a crowd of a chosen SIZE at the arena mouth with a plausible
 *           per-survivor build and measures the fight alone. The road cannot
 *           deliver a six-survivor crowd to a stage-5 boss on demand, so the
 *           bottom of the ladder is only reachable this way.
 *
 * Both quote TWO clocks, because the brief is written in one of them:
 *
 *   fire — seconds the boss actually spent takeable. This is "seconds of
 *          straight fire", which is the quantity `adaptiveBossSeconds` names.
 *   wall — seconds from the boss spawning to it dying, guard phases included.
 *          This is what a player would count with a stopwatch.
 */
import { describe, expect, it } from 'vitest'
import { perfectSquadFor } from '@/game/track'
import { median, newGraph, runSamples, seedRandom, STEP_MS } from './harness'
import { average, careless, good, optimal } from './policies'

const RUN = process.env.SIM_ADAPT === '1'
const SEEDS = 3
const STAGES = [1, 2, 3, 4, 5]

const med = (xs: readonly number[]): number => (xs.length === 0 ? 0 : median(xs))
const f1 = (n: number): string => n.toFixed(1)
const pad = (n: number, w: number): string => String(Math.round(n)).padStart(w)

type Game = Awaited<ReturnType<typeof newGraph>>['game']

/** Furthest the crowd's centre is steered — a little inside the rail. */
const SAFE = 3.9

/** A player who answers the telegraph: off the ring, off the bolt's line. */
const dodging = (game: Game): number => {
  const b = game.getBoss()
  const here = game.anchor().x
  if (!b || b.dead || !b.aimed) return here
  const opts = [b.slamX - 4.3, b.slamX + 4.3].filter((x) => Math.abs(x) <= SAFE)
  if (opts.length > 0) return opts.sort((p, q) => Math.abs(p - here) - Math.abs(q - here))[0]!
  return b.slamX > 0 ? -SAFE : SAFE
}

/**
 * One boss fight with the crowd placed by hand.
 *
 * `squad`, `dmg` and `rate` are set separately and the DPS falls out of them,
 * rather than a DPS number being forced and the squad being whatever satisfies
 * it. That is the whole point of the thing under test: the two are read apart,
 * so the probe has to be able to vary them apart.
 */
const arena = async (o: {
  stage: number
  seed: number
  squad: number
  dmg: number
  rate: number
  dodge: boolean
  maxSeconds?: number
}) => {
  const { game, state } = await newGraph()
  state.__resetTowerState()
  const restore = seedRandom(o.seed)
  const maxSteps = Math.ceil(((o.maxSeconds ?? 40) * 1000) / STEP_MS)
  try {
    game.startStage(o.stage)
    game.debugSkipToArena()
    game.debugAddUnits(Math.max(0, o.squad - game.squadCount.value))
    game.debugAddDamage(o.dmg - game.damage.value)
    game.debugAddFireRate(o.rate - game.runFireRate.value)
    for (let i = 0; i < 400 && game.phase.value !== 'boss'; i++) game.step(STEP_MS)

    const b = game.getBoss()
    const squadAtBoss = game.squadCount.value
    const dps = squadAtBoss * game.damage.value * game.runFireRate.value
    let steps = 0
    let fireSteps = 0
    while (steps < maxSteps && game.phase.value === 'boss' && !game.getBoss()?.dead) {
      const bb = game.getBoss()
      // "Takeable" is the honest reading of straight fire: on its feet, and not
      // behind a guard phase.
      if (bb && !bb.dead && bb.guard <= 0) fireSteps++
      game.steerTo(o.dodge ? dodging(game) : 0)
      game.step(STEP_MS)
      steps++
    }
    const bb = game.getBoss()
    return {
      maxHp: b?.maxHp ?? 0,
      squadAtBoss,
      dps,
      killed: bb?.dead === true,
      wall: bb?.dead === true ? (steps * STEP_MS) / 1000 : null,
      fire: bb?.dead === true ? (fireSteps * STEP_MS) / 1000 : null,
      squadLeft: game.squadCount.value,
      slams: bb?.attacks ?? 0
    }
  } finally {
    restore()
  }
}

describe.runIf(RUN)('adaptive difficulty', () => {
  it('reports what the road delivers', async () => {
    const rows: string[] = []
    for (const stage of STAGES) {
      const ceiling = perfectSquadFor(stage)
      for (const [name, p] of [
        ['optimal', optimal], ['good', good], ['average', average], ['careless', careless]
      ] as const) {
        const rs = await runSamples(stage, p, SEEDS)
        const at = rs.filter((r) => r.bossReached)
        const won = at.filter((r) => r.bossSeconds != null)
        const squad = med(at.map((r) => r.squadAtBoss))
        rows.push(
          `s${stage} ${name.padEnd(8)} ceil=${pad(ceiling, 4)} ` +
          `reach=${at.length}/${rs.length} ` +
          `squad=${pad(squad, 4)} ` +
          `perf=${f1(ceiling > 0 ? squad / ceiling : 0).padStart(4)} ` +
          `peak=${pad(med(at.map((r) => r.peakSquad)), 4)} ` +
          `lost=${pad(med(at.map((r) => r.lost)), 4)} ` +
          `dps=${pad(med(at.map((r) => r.dpsAtBoss)), 5)} ` +
          `hp=${pad(med(at.map((r) => r.bossHp)), 6)} ` +
          `wall=${won.length > 0 ? f1(med(won.map((r) => r.bossSeconds!))).padStart(4) : '   -'}s ` +
          `kill=${won.length}/${at.length} ` +
          `bossLost=${pad(med(at.map((r) => r.squadLostToBoss)), 4)} ` +
          `slams=${pad(med(at.map((r) => r.slamsThrown)), 3)} ` +
          `clear=${Math.round((rs.filter((r) => r.cleared).length / rs.length) * 100)}%`
        )
      }
    }
    console.log('\n── the road ──\n' + rows.join('\n') + '\n')
    expect(rows.length).toBe(STAGES.length * 4)
  }, 900_000)

  it('reports the fight alone, across the whole ladder of crowds', async () => {
    // Builds a run of that quality plausibly arrives with: a player who worked
    // the crates has damage and rate on top of the crowd, and the one who
    // arrives with six survivors took nothing at all.
    const builds = [
      { squad: 400, dmg: 3, rate: 3.2, label: 'huge ' },
      { squad: 180, dmg: 2, rate: 2.6, label: 'big  ' },
      { squad: 90, dmg: 2, rate: 2.2, label: 'mid  ' },
      { squad: 40, dmg: 1, rate: 1.9, label: 'small' },
      { squad: 12, dmg: 1, rate: 1.9, label: 'tiny ' },
      { squad: 6, dmg: 1, rate: 1.9, label: 'dregs' }
    ]
    const rows: string[] = []
    for (const stage of STAGES) {
      for (const b of builds) {
        for (const dodge of [true, false]) {
          const rs = []
          for (const seed of [11, 22, 33]) rs.push(await arena({ stage, seed, dodge, ...b }))
          const won = rs.filter((r) => r.killed)
          rows.push(
            `s${stage} ${b.label} ${dodge ? 'dodge' : 'still'} ` +
            `squad=${pad(med(rs.map((r) => r.squadAtBoss)), 4)} ` +
            `dps=${pad(med(rs.map((r) => r.dps)), 5)} ` +
            `hp=${pad(med(rs.map((r) => r.maxHp)), 6)} ` +
            `kill=${won.length}/${rs.length} ` +
            `fire=${won.length > 0 ? f1(med(won.map((r) => r.fire!))).padStart(4) : '   -'}s ` +
            `wall=${won.length > 0 ? f1(med(won.map((r) => r.wall!))).padStart(4) : '   -'}s ` +
            `left=${pad(med(rs.map((r) => r.squadLeft)), 4)} ` +
            `slams=${med(rs.map((r) => r.slams))}`
          )
        }
      }
    }
    console.log('\n── the fight alone ──\n' + rows.join('\n') + '\n')
    expect(rows.length).toBeGreaterThan(0)
  }, 900_000)
})
