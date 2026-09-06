/**
 * A scratch probe, not a regression: it asserts nothing and only reports.
 *
 *   SIM_BOSS=1 npx vitest run tests/sim/scratch.boss.test.ts --reporter=verbose
 *
 * `--reporter=verbose` is load-bearing — Vitest 4's default reporter swallows
 * `console.log` from a passing test.
 *
 * ── Why an arena probe and not the full-run tables ──
 *
 * The full-run study cannot answer this question at all: no scripted policy
 * reaches the stage-6-and-deeper arena from a wiped save (`bossReachRate` is 0 %
 * for `average` and `optimal` alike, the meteor included), so every cell of a
 * full-run table for these stages comes back empty. So the crowd is placed at
 * the arena mouth with its DPS pinned — and pinned relative to the boss's own
 * UNDISCOUNTED bar, so that every kind is handed the same "five seconds of one
 * base boss". That is what makes a time-to-kill comparable across kinds that
 * live on different stages with different health curves; without it the table
 * measures `bossHpScale` and nothing else.
 *
 * Two players are scripted: one that answers every telegraph correctly (`read`)
 * and one that never moves (`still`). The GAP between them per kind is the thing
 * being measured — the absolute numbers only mean anything against the `meteor`
 * control in the same table.
 */
import { describe, expect, it } from 'vitest'
import { CLAW_SPACING, bossHpMulFor, bossKindFor, type BossKind } from '@/game/threats'
import { newGraph, seedRandom, STEP_MS } from './harness'

const RUN = process.env.SIM_BOSS === '1'

type Game = Awaited<ReturnType<typeof newGraph>>['game']

/** Furthest the crowd's centre is steered — a little inside the rail. */
const SAFE = 3.9

/**
 * A player who reads the telegraph and answers it properly: out of a slam ring,
 * into the nearest claw pocket, off a bolt's line.
 */
const readTheTell = (game: Game): number => {
  const b = game.getBoss()
  const here = game.anchor().x
  if (!b || b.dead || !b.aimed) return here
  /** Nearest spot at least `need` from `mark` that is still on the road. */
  const away = (mark: number, need: number): number => {
    const opts = [mark - need, mark + need].filter((x) => Math.abs(x) <= SAFE)
    if (opts.length > 0) return opts.sort((p, q) => Math.abs(p - here) - Math.abs(q - here))[0]!
    return mark > 0 ? -SAFE : SAFE
  }
  if (b.kind === 'claw') return away(b.slamX, CLAW_SPACING / 2)
  if (b.kind === 'healer') return b.charging ? here : away(b.slamX, 3.2)
  return away(b.slamX, 4.3)
}

/** A boss fight in isolation, with DPS pinned as a multiple of the boss's bar. */
const arena = async (o: {
  stage: number
  seed: number
  squad: number
  /** Seconds the boss's printed bar alone should take to remove. */
  barSeconds: number
  dodge: 'still' | 'read'
  maxSeconds?: number
}) => {
  const { game, state } = await newGraph()
  state.__resetTowerState()
  const restore = seedRandom(o.seed)
  const maxSteps = Math.ceil(((o.maxSeconds ?? 45) * 1000) / STEP_MS)
  try {
    game.startStage(o.stage)
    game.debugSkipToArena()
    game.debugAddUnits(Math.max(0, o.squad - game.squadCount.value))
    for (let i = 0; i < 400 && game.phase.value !== 'boss'; i++) game.step(STEP_MS)
    const b = game.getBoss()
    const maxHp = b?.maxHp ?? 1
    // squad x damage x fireRate = maxHp / barSeconds, solved for damage.
    // Normalised to the UN-DISCOUNTED bar, so every kind on every stage is given
    // the same "five seconds of one base boss" and the measured time-to-kill is
    // exactly what the kind ADDS on top of its own printed health.
    const want = maxHp / bossHpMulFor(bossKindFor(o.stage)) / o.barSeconds
    const have = game.squadCount.value * game.damage.value * game.runFireRate.value
    game.debugAddDamage(game.damage.value * (want / Math.max(1, have) - 1))

    const squadAtBoss = game.squadCount.value
    const dps = game.squadCount.value * game.damage.value * game.runFireRate.value
    let steps = 0
    let heals = 0
    let attacks = 0
    let lastHp = b?.hp ?? 0
    while (steps < maxSteps && game.phase.value === 'boss' && !game.getBoss()?.dead) {
      const bb = game.getBoss()
      if (bb) {
        if (bb.hp > lastHp + 1e-6) heals++
        lastHp = bb.hp
        attacks = bb.attacks
      }
      game.steerTo(o.dodge === 'read' ? readTheTell(game) : 0)
      game.step(STEP_MS)
      steps++
    }
    const bb = game.getBoss()
    if (bb) attacks = bb.attacks
    return {
      kind: bossKindFor(o.stage) as BossKind,
      maxHp,
      squadAtBoss,
      dps,
      killed: bb?.dead === true,
      seconds: bb?.dead ? (steps * STEP_MS) / 1000 : null,
      lostPct: squadAtBoss > 0 ? 1 - game.squadCount.value / squadAtBoss : 1,
      heals,
      attacks,
      slamDeaths: game.deathBreakdown().slam,
      foeDeaths: game.deathBreakdown().foe,
      foesLeft: game.getFoes().length
    }
  } finally {
    restore()
  }
}

const med = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)]!
}

describe.runIf(RUN)('boss kind arena probe', () => {
  it('measures each kind at a tuned and an under-built DPS', async () => {
    const SEEDS = [1000, 8919, 16838]
    // Stage 5 = meteor (the control), 4 = claw, 7 = healer, 6 = summoner.
    const stages = [5, 4, 7, 6]
    const rows: string[] = []
    for (const build of [
      { name: 'tuned', squad: 120, barSeconds: 5 },
      { name: 'under', squad: 90, barSeconds: 11 }
    ]) {
      for (const dodge of ['read', 'still'] as const) {
        for (const stage of stages) {
          const rs = []
          for (const seed of SEEDS) rs.push(await arena({ stage, seed, dodge, ...build }))
          const killed = rs.filter((r) => r.killed)
          rows.push(
            `${build.name.padEnd(5)} ${dodge.padEnd(5)} s${String(stage).padStart(2)} ` +
            `${rs[0]!.kind.padEnd(9)} hp=${String(rs[0]!.maxHp).padStart(6)} ` +
            `dps=${String(Math.round(rs[0]!.dps)).padStart(5)} ` +
            `kill=${killed.length}/${rs.length} ` +
            `ttk=${killed.length ? med(killed.map((r) => r.seconds!)).toFixed(2) : '  -  '}s ` +
            `lost=${(med(rs.map((r) => r.lostPct)) * 100).toFixed(0)}% ` +
            `heal=${med(rs.map((r) => r.heals))} atk=${med(rs.map((r) => r.attacks))} ` +
            `slamD=${med(rs.map((r) => r.slamDeaths))} foeD=${med(rs.map((r) => r.foeDeaths))} ` +
            `foes=${med(rs.map((r) => r.foesLeft))}`
          )
        }
      }
    }
    console.log('\n' + rows.join('\n') + '\n')
    expect(rows.length).toBeGreaterThan(0)
  }, 600_000)
})
