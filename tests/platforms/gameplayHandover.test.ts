import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ─── A new stage is a new play ──────────────────────────────────────────────
 *
 * The road stopped resetting between stages: a cleared boss hands straight over
 * to the next stage and `phase` passes 'boss' → 'clear' → 'run' inside one tick.
 * Nothing watching the live flag sees that — it reads true on both sides — so
 * the portals were told neither that the play ended nor that the next one began,
 * and twenty stages arrived as one endless play. Plays and playtime are counted
 * off those brackets.
 *
 * `restartGameplayBracket` is what a seamless handover says instead. What is
 * pinned here is that it sends the pair when a play is open, and says NOTHING
 * when a screen already closed it — a redundant pair is what costs Poki a bad
 * event, and ten of those disable its monetization for the session.
 */

interface Arm {
  calls: string[]
  sync: (live: boolean) => void
  restart: () => void
  reset: () => void
  idle: () => Promise<void>
}

const load = async (playgama = false): Promise<Arm> => {
  vi.resetModules()
  if (playgama) vi.stubEnv('VITE_APP_PLAYGAMA', 'true')
  const calls: string[] = []
  vi.doMock('@/utils/playgamaPlugin', () => ({
    playgamaGameplayStart: () => calls.push('pg:start'),
    playgamaGameplayStop: () => calls.push('pg:stop')
  }))
  vi.doMock('@/use/useCrazyGames', () => ({
    syncGameplayLifecycle: (live: boolean) => calls.push(live ? 'cg:start' : 'cg:stop')
  }))
  vi.doMock('@/utils/pokiPlugin', () => ({
    pokiGameplayStart: () => calls.push('poki:start'),
    pokiGameplayStop: () => calls.push('poki:stop')
  }))
  vi.doMock('@/game/monsterSprites', () => ({ setMonsterBakeAllowed: () => {} }))
  const mod = await import('@/use/useGameplayLifecycle')
  mod.__resetGameplayBracket()
  await mod.__gameplayFanoutIdle()
  calls.length = 0
  return {
    calls,
    sync: mod.syncGameplayLifecycle,
    restart: mod.restartGameplayBracket,
    reset: mod.__resetGameplayBracket,
    idle: mod.__gameplayFanoutIdle
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('a seamless stage handover', () => {
  it('ends the play that was running and begins the next one', async () => {
    const m = await load()
    m.sync(true)
    m.calls.length = 0

    m.restart()
    // The order is the contract: the stage the player cleared is closed before
    // the one they are now in is opened.
    expect(m.calls).toEqual(['cg:stop', 'cg:start'])
  })

  it('counts one play per stage across a career of handovers', async () => {
    const m = await load()
    m.sync(true)
    m.calls.length = 0

    for (let stage = 0; stage < 5; stage++) m.restart()
    expect(m.calls.filter((c) => c === 'cg:start')).toHaveLength(5)
    expect(m.calls.filter((c) => c === 'cg:stop')).toHaveLength(5)
  })

  it('says nothing when a screen already closed the play', async () => {
    const m = await load()
    // A result screen, a gift reveal, an ad or a hidden tab — the live flag
    // really did change, and it will open the next play by itself.
    m.sync(true)
    m.sync(false)
    m.calls.length = 0

    m.restart()
    expect(m.calls, 'a redundant pair is a Poki bad event').toEqual([])
  })

  it('says nothing before the first play has begun', async () => {
    const m = await load()
    m.restart()
    expect(m.calls).toEqual([])
  })
})

// ─── Playgama ───────────────────────────────────────────────────────────────
//
// Its certification asks for `gameplay_started` / `gameplay_stopped`, and for a
// long time nothing called either — the two functions sat in `playgamaPlugin`
// with no caller, so the portal saw sessions with no plays in them. It is
// loaded dynamically (no alias stub; a static import would carry its SDK into
// every other portal's bundle), which makes ORDER the thing worth pinning.
describe('the Playgama arm', () => {
  it('brackets play, and only on a Playgama build', async () => {
    const off = await load(false)
    off.sync(true)
    await off.idle()
    expect(off.calls.filter((c) => c.startsWith('pg:'))).toEqual([])

    const on = await load(true)
    on.sync(true)
    on.sync(false)
    await on.idle()
    expect(on.calls.filter((c) => c.startsWith('pg:'))).toEqual(['pg:start', 'pg:stop'])
  })

  it('keeps a handover pair in order — the stop can never arrive after its start', async () => {
    const m = await load(true)
    m.sync(true)
    await m.idle()
    m.calls.length = 0

    m.restart()
    await m.idle()
    // Asynchronous arm, synchronous decision: a start that overtook its stop
    // would leave the bridge believing the first play never ended.
    expect(m.calls.filter((c) => c.startsWith('pg:'))).toEqual(['pg:stop', 'pg:start'])
    // And every arm agrees about what happened.
    expect(m.calls.filter((c) => c.startsWith('cg:'))).toEqual(['cg:stop', 'cg:start'])
  })
})
