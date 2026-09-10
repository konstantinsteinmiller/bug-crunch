// ─── The rally ──────────────────────────────────────────────────────────────
//
// A wipe that is not one: when the last survivor falls, the sim asks the
// scene's policy how many to hand back, and a positive answer keeps the run
// alive. These pin the sim's half of the contract — the policy is the scene's
// business and is deliberately not imported here.

import { beforeEach, describe, expect, it } from 'vitest'

const STEP_MS = 1000 / 60

type Game = typeof import('@/use/useSurvivalGame')

const importGame = async (): Promise<Game> => {
  const state = await import('@/use/useTowerState')
  state.__resetTowerState()
  return import('@/use/useSurvivalGame')
}

/** Kill the crowd outright, through the real loss funnel. */
const wipeCrowd = (game: Game): void => {
  for (const u of game.getUnits()) game.__killUnitForTest(u)
}

beforeEach(() => { localStorage.clear() })

describe('the sim asks before it wipes', () => {
  it('lets a wipe stand when no policy is installed', async () => {
    const game = await importGame()
    game.setRallyPolicy(null)
    game.startStage(2)
    game.step(STEP_MS)
    wipeCrowd(game)
    for (let i = 0; i < 90 && game.phase.value !== 'wipe'; i++) game.step(STEP_MS)
    expect(game.phase.value).toBe('wipe')
    expect(game.rallies.value).toBe(0)
  })

  it('hands back exactly what the policy answers, and the run carries on', async () => {
    const game = await importGame()
    const asks: Array<{ stage: number; peakSquad: number }> = []
    game.setRallyPolicy((ask) => {
      asks.push({ stage: ask.stage, peakSquad: ask.peakSquad })
      return 7
    })
    game.startStage(2)
    game.debugAddUnits(20)
    game.step(STEP_MS)
    const peak = game.peakSquad.value
    wipeCrowd(game)
    for (let i = 0; i < 90 && game.rallies.value === 0; i++) game.step(STEP_MS)

    expect(game.rallies.value).toBe(1)
    expect(game.phase.value).toBe('run')
    expect(game.squadCount.value).toBe(7)
    expect(asks).toHaveLength(1)
    expect(asks[0]!.stage).toBe(2)
    expect(asks[0]!.peakSquad).toBe(peak)
    // The rallied crowd is immune to being run over for a moment: it lands
    // exactly where the last one died.
    for (const u of game.getUnits()) expect(u.inv).toBeGreaterThanOrEqual(game.RALLY_GRACE_MS)
    game.setRallyPolicy(null)
  })

  it('treats zero, negatives and nonsense as "let it stand"', async () => {
    for (const answer of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const game = await importGame()
      game.setRallyPolicy(() => answer)
      game.startStage(2)
      game.step(STEP_MS)
      wipeCrowd(game)
      for (let i = 0; i < 90 && game.phase.value !== 'wipe'; i++) game.step(STEP_MS)
      expect(game.phase.value, `answer ${answer}`).toBe('wipe')
      game.setRallyPolicy(null)
    }
  })

  it('asks again on a second wipe — the ONCE is the policy\'s job, not the sim\'s', async () => {
    const game = await importGame()
    let calls = 0
    game.setRallyPolicy(() => (++calls === 1 ? 5 : 0))
    game.startStage(2)
    game.step(STEP_MS)
    wipeCrowd(game)
    for (let i = 0; i < 90 && game.rallies.value === 0; i++) game.step(STEP_MS)
    expect(game.rallies.value).toBe(1)
    wipeCrowd(game)
    for (let i = 0; i < 90 && game.phase.value !== 'wipe'; i++) game.step(STEP_MS)
    expect(calls).toBe(2)
    expect(game.phase.value).toBe('wipe')
    game.setRallyPolicy(null)
  })
})
