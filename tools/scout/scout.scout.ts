/**
 * ─── The headless scout ─────────────────────────────────────────────────────
 *
 * `tools/preview-video`'s scripted players (`scenarios/_drive.mjs` — `ace`,
 * `good`, `average`), ported to run against the simulation in Node instead of
 * inside a page. Same decision loop, same numbers, no browser: a level is a few
 * hundred milliseconds of wall time, so hundreds of seeded runs a level are
 * cheap — which is what every "of 240" in `stages.ts` was measured with.
 *
 *   pnpm scout                                  # world 1, 40 seeds, all policies
 *   SCOUT_LEVELS=1-10,15 SCOUT_SEEDS=120 pnpm scout
 *   SCOUT_POLICIES=average SCOUT_MOVES=spin pnpm scout
 *   SCOUT_DEBUG=1 SCOUT_LEVELS=1 pnpm scout     # print the board of every lost run
 *
 * Prints, per level and policy: wins, the clear-time median, the time left,
 * stars, kills per stomp and multi-kill stomps, and how many runs met each set
 * piece (a rush, a finisher, a trial, a twist).
 *
 * It is a MEASURING TAPE, not a test: it asserts nothing, and it runs under its
 * own vitest config so the ordinary suite never pays for it.
 */
import { it, vi } from 'vitest'
import * as G from '@/use/useBugCrunchGame'
import { levelSpec, TOTAL_LEVELS } from '@/game/stages'
import { starsEarned } from '@/game/stars'
import type { MoveId } from '@/game/moves'

/** Node's process, reached without a Node type dependency in the app's tsconfig. */
const proc = (globalThis as {
  process?: { env: Record<string, string | undefined>; stdout: { write: (s: string) => void } }
}).process
const env = proc?.env ?? {}
const say = (s: string): void => { proc?.stdout.write(s) }

const STEP = 1000 / 60
/** A portrait phone's play rect, in u: 360 × 640 with the HUD's bars carved off. */
const BOARD = { w: 100, h: 178, x0: 7, y0: 16, x1: 98, y1: 166 }

interface Player {
  reach: number; react: number; commit: number; sloppy: number
  slam: number; slip: number; fever: boolean; jitter: number
}

const PLAYERS: Record<string, Player> = {
  ace: { reach: 999, react: 60, commit: 0.5, sloppy: 0, slam: 1, slip: 0, fever: true, jitter: 0.5 },
  good: { reach: 120, react: 140, commit: 0.8, sloppy: 2.5, slam: 0.7, slip: 0.05, fever: true, jitter: 1.2 },
  average: { reach: 55, react: 380, commit: 1.35, sloppy: 15, slam: 0.12, slip: 0.32, fever: false, jitter: 3.4 }
}

interface Result {
  won: boolean
  seconds: number
  timeLeft: number
  stars: number
  stomps: number
  kills: number
  multi: number
  rush: boolean
  finisher: 'slam' | 'tap' | null
  trial: boolean
  twist: boolean
}

/** One whole level, played by `policy`, seeded by `seed`. */
const playLevel = (level: number, policy: string, seed: number, moves: MoveId[]): Result => {
  const player = PLAYERS[policy]!
  let rs = (seed * 7919 + 17) >>> 0 || 1
  const rnd = (): number => { rs = (rs * 1_664_525 + 1_013_904_223) >>> 0; return rs / 4_294_967_296 }

  G.setBoard(BOARD)
  G.setTouch(true)
  // Let go of anything the last run was holding: a press still down when a
  // level ends leaked into the next one in builds before `startLevel` reset it.
  G.release()
  G.startLevel({
    level, shoe: 'sneaker', juiceStyle: 'ooze', singleTap: false,
    difficulty: 1, relief: 1, seed: seed * 104_729 + level, moves
  })
  G.resetVial()
  G.drainEvents()

  let t = 0
  let waiting = 0
  let holding = -1
  let heavyWanted = false
  let rest = 0
  let locked: { bug?: G.Bug | null; pod?: G.Pod; boss?: boolean; heavy: boolean; ox: number; oy: number } | null = null
  const out: Result = {
    won: false, seconds: 0, timeLeft: 0, stars: 0, stomps: 0, kills: 0, multi: 0,
    rush: false, finisher: null, trial: false, twist: false
  }

  const live = (): G.Bug[] => {
    const bugs = G.getBugs()
    const res: G.Bug[] = []
    for (let i = 0; i < G.getBugCount(); i++) if (bugs[i]!.alive && !bugs[i]!.puck) res.push(bugs[i]!)
    return res
  }

  const choose = (): typeof locked => {
    const f = G.getFoot()
    const shoe = G.getShoe()
    const boss = G.getBoss()
    let best: { score: number; bug?: G.Bug; pod?: G.Pod; boss?: boolean; heavy: boolean } | null = null
    for (const b of live()) {
      if (b.spec.airborne && b.dip < 0.5) continue
      const d = Math.hypot(b.x - f.x, b.y - f.y)
      if (d > player.reach) continue
      const spiky = b.spec.spiky && !shoe.spikeProof
      if (spiky && rnd() > player.slip) continue
      const armoured = shoe.pierce < b.spec.armor && b.flipped <= 0
      let value = b.spec.score + b.spec.juice * 400
      if (spiky) value = -value
      if (armoured) value *= 0.55
      if (b.carry) value += 150
      const score = value / (6 + d)
      if (best === null || score > best.score) best = { score, bug: b, heavy: armoured || (b.spec.hp > 1 && b.flipped <= 0) }
    }
    for (const pod of G.getPods()) {
      if (!pod.alive || pod.fly > 0) continue
      const d = Math.hypot(pod.x - f.x, pod.y - f.y)
      if (d > player.reach) continue
      const score = 150 / (6 + d)
      if (best === null || score > best.score) best = { score, pod, heavy: false }
    }
    if (boss && boss.alive) {
      const p = boss.spec.phases[boss.phase]
      const d = Math.hypot(boss.x - f.x, boss.y - f.y)
      if (p && p.vulnerable && d <= player.reach + boss.size) {
        const score = 150 / (6 + Math.max(0, d - boss.size))
        if (best === null || score > best.score) best = { score, boss: true, heavy: shoe.pierce < p.armor }
      }
    }
    if (best === null && boss && boss.alive) return { boss: true, heavy: true, ox: 0, oy: 0 }
    return best ? { ...best, ox: 0, oy: 0 } : null
  }

  const targetAt = (): { x: number; y: number } | null => {
    if (!locked) return null
    if (locked.boss) {
      const b = G.getBoss()
      return b && b.alive ? { x: b.x + locked.ox, y: b.y + locked.oy } : null
    }
    if (locked.pod) return locked.pod.alive ? { x: locked.pod.x + locked.ox, y: locked.pod.y + locked.oy } : null
    if (!locked.bug || !locked.bug.alive || locked.bug.puck) return null
    return { x: locked.bug.x + locked.ox, y: locked.bug.y + locked.oy }
  }

  const restMs = (): number => Math.max(G.getShoe().cooldown, 280) + player.react

  const tick = (dt: number): void => {
    t += dt / 1000
    if (G.phase.value !== 'play') { holding = -1; locked = null; return }
    if (rest > 0) rest -= dt
    if (player.fever && G.feverCharged.value) G.tryFever()
    if (holding >= 0) {
      holding += dt
      const f = G.getFoot()
      const shoe = G.getShoe()
      const full = f.state === 'charge' && f.charge >= 0.98
      const giveUp = holding >= 70 + 70 + shoe.cooldown + shoe.chargeMs + 400
      if (!heavyWanted || full || giveUp) {
        G.release()
        holding = -1
        rest = restMs()
        locked = null
      }
      return
    }
    let at = targetAt()
    if (at === null) {
      locked = choose()
      if (locked) {
        locked.ox = (rnd() - 0.5) * player.sloppy
        locked.oy = (rnd() - 0.5) * player.sloppy
      }
      at = targetAt()
      waiting = player.react
    }
    if (at === null) return
    G.aim(at.x + (rnd() - 0.5) * player.jitter, at.y + (rnd() - 0.5) * player.jitter)
    if (rest > 0) return
    const f = G.getFoot()
    if (f.state !== 'hover' && f.state !== 'recover') return
    if (Math.hypot(f.x - at.x, f.y - at.y) > G.stompRadius() * player.commit) return
    if (waiting > 0) { waiting -= dt; return }
    heavyWanted = !!locked && locked.heavy && rnd() < player.slam
    G.press(f.x, f.y, t * 1000)
    out.stomps++
    holding = 0
  }

  const limit = (levelSpec(level).time + 5) * 60 * 2
  for (let n = 0; n < limit && G.phase.value === 'play'; n++) {
    tick(STEP)
    vi.advanceTimersByTime(STEP)
    G.step(STEP)
    for (const e of G.drainEvents()) {
      if (e.k === 'multi') out.multi++
      else if (e.k === 'rushGo') out.rush = true
      else if (e.k === 'finisher') out.finisher = e.heavy ? 'slam' : 'tap'
      else if (e.k === 'trial') out.trial = true
      else if (e.k === 'twistStart') out.twist = true
    }
  }
  const tally = G.tally.value
  if (env.SCOUT_DEBUG && G.phase.value !== 'won') {
    const f = G.getFoot()
    const bodies = live().map((b) => `${b.id}@${b.x.toFixed(0)},${b.y.toFixed(0)}${b.rush > 0 ? 'R' : ''}${b.flipped > 0 ? 'F' : ''}`)
    say(
      `LOST L${level} ${policy} s${seed}: squished ${G.squished.value}/${levelSpec(level).quota} stomps ${out.stomps} ` +
      `misses ${tally.misses} foot ${f.state}@${f.x.toFixed(0)},${f.y.toFixed(0)} t=${t.toFixed(1)} bodies[${bodies.length}] ${bodies.join(' ')}\n`)
  }
  out.won = G.phase.value === 'won'
  out.seconds = Math.round(t * 10) / 10
  out.timeLeft = tally.timeLeft
  out.kills = tally.squishes
  out.stars = starsEarned(levelSpec(level).objectives, tally)
  return out
}

const median = (xs: number[]): number => {
  if (xs.length === 0) return NaN
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

const parseLevels = (raw: string | undefined): number[] => {
  if (!raw) return Array.from({ length: 10 }, (_, i) => i + 1)
  const out: number[] = []
  for (const part of raw.split(',')) {
    const [a, b] = part.split('-').map(Number)
    if (b === undefined) out.push(a!)
    else for (let n = a!; n <= b; n++) out.push(n)
  }
  return out.filter((n) => n >= 1 && n <= TOTAL_LEVELS)
}

it('scouts', () => {
  vi.useFakeTimers({ toFake: ['performance'] })
  const levels = parseLevels(env.SCOUT_LEVELS)
  const seeds = Number(env.SCOUT_SEEDS ?? 40)
  const policies = (env.SCOUT_POLICIES ?? 'average,good').split(',')
  // Trophies the bot owns: by default whatever a player on that level would.
  const forcedMoves = env.SCOUT_MOVES ? env.SCOUT_MOVES.split(',') as MoveId[] : null
  const rows: string[] = []
  rows.push('level  policy   wins        clear  left  stars   k/stomp  multi  rush  fin(s/t)  trial  twist')
  for (const level of levels) {
    const moves = forcedMoves ?? (level > 4 ? ['spin'] : []).concat(level > 10 ? ['skid'] : [], level > 20 ? ['quake'] : [], level > 30 ? ['echo'] : []) as MoveId[]
    for (const policy of policies) {
      const res: Result[] = []
      for (let s = 1; s <= seeds; s++) {
        vi.advanceTimersByTime(60_000)
        try {
          res.push(playLevel(level, policy, s, moves))
        } catch (err) {
          // Name the run that broke: a crash inside the sim is the most useful
          // thing a scout can find, and it is useless without its seed.
          say(`CRASH L${level} ${policy} s${s}: ${(err as Error).stack}\n`)
          throw err
        }
      }
      const won = res.filter((r) => r.won)
      const kps = res.reduce((a, r) => a + r.kills, 0) / Math.max(1, res.reduce((a, r) => a + r.stomps, 0))
      const stars = [0, 1, 2, 3].map((k) => res.filter((r) => r.stars === k).length).join('/')
      const spec = levelSpec(level)
      rows.push([
        `${spec.world}-${spec.index}`.padEnd(6),
        policy.padEnd(8),
        `${won.length}/${res.length}`.padEnd(11),
        `${median(won.map((r) => r.seconds)).toFixed(0)}s`.padStart(5),
        `${median(won.map((r) => r.timeLeft)).toFixed(0)}s`.padStart(5),
        stars.padStart(10),
        kps.toFixed(2).padStart(8),
        (res.reduce((a, r) => a + r.multi, 0) / res.length).toFixed(1).padStart(6),
        String(res.filter((r) => r.rush).length).padStart(5),
        `${res.filter((r) => r.finisher === 'slam').length}/${res.filter((r) => r.finisher === 'tap').length}`.padStart(9),
        String(res.filter((r) => r.trial).length).padStart(6),
        String(res.filter((r) => r.twist).length).padStart(6)
      ].join('  '))
    }
  }
  say(`\n${rows.join('\n')}\n\n`)
}, 600_000)
