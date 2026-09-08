import { beforeEach, describe, expect, it } from 'vitest'
import { drainFx } from '@/use/useVfx'
import {
  MINIBOSS_POOL, ROLLER_R, minibossKindFor, rollerLaneFor, rollerLaneX
} from '@/game/threats'

/**
 * ─── A spent ball is a spent ball ───────────────────────────────────────────
 *
 * The roller bills ONCE, on the frame it crosses the crowd's own line, and is
 * inert for the rest of its roll. That rule is deliberate — a per-frame toll
 * charges a crowd for how long it stood near a thing rather than for the line
 * it ran — but it has a consequence that shipped unguarded:
 *
 *   dodge the crossing, then steer back into the lane and follow the ball down,
 *   and it costs nothing at all.
 *
 * Which is correct, and which was reported as "the roller does no damage",
 * because the renderer went on painting the full-width hazard strip for a ball
 * that could no longer take anybody. `drawRollers` now drops the strip once
 * `kindTicks` latches; this pins the simulation half of that contract, so a
 * future change to the billing rule has to come past the scenario that made the
 * mismatch visible rather than past a passing test that never steered back.
 */

const importGame = () => import('@/use/useSurvivalGame')
const STAGE = 12

beforeEach(async () => {
  localStorage.clear()
  const { __resetTowerState } = await import('@/use/useTowerState')
  __resetTowerState()
})

/** Which of this stage's elites is the ball. */
const rollerIndex = (stage: number): number => {
  for (let i = 0; i < MINIBOSS_POOL.length + 2; i++) {
    if (minibossKindFor(stage, i) === 'roller') return i
  }
  return -1
}

/**
 * Run the stage, steering by `aim`, and report what the ball cost.
 *
 * Every OTHER elite is parked far up the road: they all bill under the same
 * `elite` cause, so a second landmark's bites would be counted as the ball's.
 */
const roll = async (aim: (crossed: boolean, laneX: number) => number) => {
  const game = await importGame()
  game.startStage(STAGE)
  game.debugAddUnits(340)
  drainFx()

  const laneX = rollerLaneX(rollerLaneFor(STAGE, rollerIndex(STAGE)))
  const before = game.deathBreakdown().elite
  let hits = 0
  let sawBall = false
  let closestX = Infinity

  for (let i = 0; i < 9000; i++) {
    let ball
    for (const f of game.getFoes()) {
      if (!f.elite || f.dead) continue
      if (f.kind !== 'roller') { f.y = game.anchor().y + 500; continue }
      // Immortal, so the measurement is about the ball's behaviour rather than
      // about how fast 340 survivors delete it.
      f.hp = 1e9
      f.maxHp = 1e9
      ball = f
      sawBall = true
    }
    const crossed = ball ? ball.y < game.anchor().y : false
    if (ball && crossed) closestX = Math.min(closestX, Math.abs(ball.x - game.anchor().x))

    if (game.squadCount.value < 340) game.debugAddUnits(340 - game.squadCount.value)
    game.steerTo(aim(crossed, laneX))
    game.step(16)
    hits += drainFx().filter((e) => e.kind === 'rollerHit').length
    if (game.phase.value === 'clear' || game.phase.value === 'dead') break
  }

  expect(sawBall, 'the stage never fielded a roller').toBe(true)
  return { hits, billed: game.deathBreakdown().elite - before, closestX }
}

describe('the roller bills the crossing, and only the crossing', () => {
  it('takes a real share off a crowd that was standing in the lane', async () => {
    const r = await roll((_crossed, laneX) => laneX)
    expect(r.hits, 'the ball never billed at all').toBe(1)
    // Not a token nibble: standing in front of it has to be the expensive answer.
    expect(r.billed).toBeGreaterThan(40)
  })

  it('costs far more dead-centre than clipped at the edge — the core', async () => {
    // What the lethal core buys, stated as a COMPARISON rather than a number:
    // the same ball, the same crowd, the same stage, differing only in whether
    // the crowd was under the stone or beside it.
    //
    // Before the core both answers were the same bounded share, which is what
    // made the stone read as rolling THROUGH the squad — a crowd that took the
    // hit head-on kept most of itself.
    const centre = await roll((_c, laneX) => laneX)
    // Just outside the stone: the crowd's near edge clips the ball, its centre
    // does not. `rollerCoreR()` is half of `ROLLER_R`, so this sits well clear.
    const clipped = await roll((_c, laneX) => laneX + ROLLER_R)

    expect(centre.billed).toBeGreaterThan(clipped.billed * 2)
    // And the graze is still a graze — an edge clip must not read as a wipe.
    expect(clipped.billed).toBeLessThan(centre.billed)
  })

  it('costs nothing to a crowd that dodged it and then drove through it', async () => {
    // The reported scenario, exactly: out of the lane for the crossing, into it
    // afterwards. The ball ends up sitting on top of the crowd and takes nobody.
    const r = await roll((crossed, laneX) => (crossed ? laneX : -laneX))
    expect(r.hits).toBe(0)
    expect(r.billed).toBe(0)
    // The premise: the crowd really did end up underneath it, so this is a
    // statement about the ball being SPENT and not about a miss.
    expect(r.closestX, 'the crowd never actually reached the ball').toBeLessThan(0.5)
  })
})
