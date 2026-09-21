import { describe, expect, it } from 'vitest'
import { nextBossLevel, nextHeadline } from '@/game/headline'
import { BOSS_FIGHTS, PARTY_AFTER, TOTAL_LEVELS, indexOf, levelSpec } from '@/game/stages'
import { MOVES, moveForLevel, movesForBest } from '@/game/moves'
import { rewardsForResult } from '@/game/campaignRewards'
import { emptyTally } from '@/game/stars'

/**
 * ─── Peek, and the trophies it promises ─────────────────────────────────────
 *
 * The result screen's comma: every clear shows what the NEXT level has that
 * this one did not. A peek that is empty — or that shows the boss on a level
 * whose real news is a new creature — is the full stop it exists to replace.
 */
describe('Peek — the next level\'s secret', () => {
  it('has something to show after every level but the last', () => {
    for (let n = 1; n < TOTAL_LEVELS; n++) {
      expect(nextHeadline(n), `after ${n}`).not.toBeNull()
    }
    expect(nextHeadline(TOTAL_LEVELS)).toBeNull()
  })

  it('never lets a creature debut fall through to anything less', () => {
    for (let n = 1; n < TOTAL_LEVELS; n++) {
      const next = levelSpec(n + 1)
      if (next.boss || PARTY_AFTER.includes(n) || indexOf(n + 1) === 1) continue
      const before = new Set(levelSpec(n).roster.map((r) => r.id))
      const debut = next.roster.find((r) => !before.has(r.id))
      if (!debut) continue
      const peek = nextHeadline(n)!
      expect(peek.headline, `after ${n}`).toEqual({ kind: 'bug', bug: debut.id })
    }
  })

  it('announces a party straight after the level it follows — then the level after it', () => {
    for (const n of PARTY_AFTER) {
      expect(nextHeadline(n)!.headline.kind, `after ${n}`).toBe('party')
      expect(nextHeadline(n, true)!.headline.kind, `after ${n}'s party`).not.toBe('party')
    }
  })

  it('shows a world\'s last level a postcard of the next world', () => {
    for (const n of [10, 20, 30]) {
      expect(nextHeadline(n)!.headline).toEqual({ kind: 'world', world: n / 10 + 1 })
    }
  })

  it('puts the boss\'s trophy in her silhouette, and counts the levels down to her', () => {
    const peek = nextHeadline(3, true)!
    expect(peek.headline).toEqual({ kind: 'boss', boss: 'queenAnt', trophy: 'spin' })
    expect(peek.toBoss).toBe(1)
    expect(nextBossLevel(5)).toBe(10)
    expect(nextHeadline(8)!.toBoss).toBe(2)
  })

  it('shows 1-2\'s Steel Boot box, 1-7\'s spill and the rest of world 1\'s news in order', () => {
    expect(nextHeadline(1)!.headline).toEqual({ kind: 'bug', bug: 'caterpillar' })
    expect(nextHeadline(4)!.headline).toEqual({ kind: 'bug', bug: 'sprinter' })
    expect(nextHeadline(6, true)!.headline).toEqual({ kind: 'bug', bug: 'pinatafly' })
  })
})

describe('Boss Trophies', () => {
  it('drop one move per boss, on the level the boss is fought, in order', () => {
    for (const m of MOVES) expect(BOSS_FIGHTS[m.level]?.boss, m.id).toBe(m.boss)
    expect(moveForLevel(4)).toBe('spin')
    expect(moveForLevel(10)).toBe('skid')
    expect(moveForLevel(5)).toBeNull()
  })

  it('are owned by a save that is past them, whether or not it was ever written down', () => {
    expect(movesForBest(3)).toEqual([])
    expect(movesForBest(4)).toEqual(['spin'])
    expect(movesForBest(25)).toEqual(['spin', 'skid', 'quake'])
  })

  it('arrive as a gift card after the record and before the world', () => {
    const tally = { ...emptyTally(), cleared: true, score: 500 }
    const out = rewardsForResult({
      tally, unlockedWorld: 2, starsBefore: 5, starsAfter: 12, isRecord: true,
      previousBest: 100, seenBugs: [], newMove: 'skid'
    })
    const kinds = out.map((r) => r.kind)
    expect(kinds.indexOf('move')).toBeGreaterThan(kinds.indexOf('record'))
    expect(kinds.indexOf('move')).toBeLessThan(kinds.indexOf('world'))
  })

  it('are never handed out for a boss that was not beaten', () => {
    const out = rewardsForResult({
      tally: emptyTally(), unlockedWorld: null, starsBefore: 0, starsAfter: 0,
      isRecord: false, previousBest: 0, seenBugs: [], newMove: 'spin'
    })
    expect(out.some((r) => r.kind === 'move')).toBe(false)
  })
})
