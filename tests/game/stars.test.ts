import { describe, expect, it } from 'vitest'
import {
  emptyTally,
  evaluate,
  meets,
  objectiveLabel,
  progress01,
  starsEarned,
  type Objective,
  type ObjectiveTriple,
  type RunTally
} from '@/game/stars'
import { allLevels } from '@/game/stages'

const tally = (over: Partial<RunTally> = {}): RunTally => ({ ...emptyTally(), ...over })

/** Every objective kind, each with a tally that satisfies it on a cleared run. */
const CASES: Array<{ o: Objective; met: RunTally; missed: RunTally }> = [
  {
    o: { kind: 'clear' },
    met: tally({ cleared: true }),
    missed: tally({ cleared: false })
  },
  {
    o: { kind: 'combo', n: 8 },
    met: tally({ cleared: true, bestCombo: 8 }),
    missed: tally({ cleared: true, bestCombo: 7 })
  },
  {
    o: { kind: 'noSpike' },
    met: tally({ cleared: true, spikes: 0 }),
    missed: tally({ cleared: true, spikes: 1 })
  },
  {
    o: { kind: 'time', n: 20 },
    met: tally({ cleared: true, timeLeft: 20 }),
    missed: tally({ cleared: true, timeLeft: 19 })
  },
  {
    o: { kind: 'accuracy', n: 55 },
    met: tally({ cleared: true, hits: 55, misses: 45 }),
    missed: tally({ cleared: true, hits: 54, misses: 46 })
  },
  {
    o: { kind: 'fever', n: 2 },
    met: tally({ cleared: true, fevers: 2 }),
    missed: tally({ cleared: true, fevers: 1 })
  },
  {
    o: { kind: 'kind', id: 'beetle', n: 4 },
    met: tally({ cleared: true, byKind: { beetle: 4 } }),
    missed: tally({ cleared: true, byKind: { beetle: 3, ant: 40 } })
  },
  {
    o: { kind: 'feverKills', n: 12 },
    met: tally({ cleared: true, bestFeverKills: 12 }),
    missed: tally({ cleared: true, bestFeverKills: 11 })
  },
  {
    o: { kind: 'noMiss', n: 3 },
    met: tally({ cleared: true, misses: 3 }),
    missed: tally({ cleared: true, misses: 4 })
  },
  {
    o: { kind: 'score', n: 1_000 },
    met: tally({ cleared: true, score: 1_000 }),
    missed: tally({ cleared: true, score: 999 })
  }
]

describe('meets', () => {
  it.each(CASES.map((c) => [c.o.kind, c] as const))('%s: the boundary is exact', (_kind, c) => {
    expect(meets(c.o, c.met)).toBe(true)
    expect(meets(c.o, c.missed)).toBe(false)
  })

  // The rule that keeps the star row from lying: a run that ran out of time has
  // not three-starred anything, however good the chain was on the way down.
  it.each(CASES.filter((c) => c.o.kind !== 'clear').map((c) => [c.o.kind, c] as const))(
    '%s is never met on a run that was not cleared',
    (_kind, c) => {
      expect(meets(c.o, { ...c.met, cleared: false })).toBe(false)
    }
  )

  it('does not read a corrupt no-stomp tally as 100% accuracy', () => {
    expect(meets({ kind: 'accuracy', n: 1 }, tally({ cleared: true, hits: 0, misses: 0 })))
      .toBe(false)
  })
})

describe('evaluate / starsEarned', () => {
  const triple: ObjectiveTriple = [
    { kind: 'clear' },
    { kind: 'noSpike' },
    { kind: 'combo', n: 6 }
  ]

  it('reports the three booleans in objective order', () => {
    expect(evaluate(triple, tally({ cleared: true, spikes: 1, bestCombo: 6 })))
      .toEqual([true, false, true])
  })

  it('counts them', () => {
    expect(starsEarned(triple, tally())).toBe(0)
    expect(starsEarned(triple, tally({ cleared: true, spikes: 2, bestCombo: 0 }))).toBe(1)
    expect(starsEarned(triple, tally({ cleared: true, bestCombo: 9 }))).toBe(3)
  })

  it('a clear is always worth at least one star, on every level in the campaign', () => {
    for (const level of allLevels()) {
      const stars = starsEarned(level.objectives, tally({ cleared: true, spikes: 9, misses: 999 }))
      expect(stars).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('progress01', () => {
  it('is always inside 0..1', () => {
    const t = tally({ cleared: true, squishes: 999, bestCombo: 999, timeLeft: 999, hits: 999, score: 9e9 })
    for (const c of CASES) {
      const v = progress01(c.o, t, 10)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('tracks the quota for the clear objective', () => {
    expect(progress01({ kind: 'clear' }, tally({ squishes: 5 }), 10)).toBeCloseTo(0.5, 6)
    expect(progress01({ kind: 'clear' }, tally({ squishes: 12 }), 10)).toBe(1)
  })

  // A bar that starts empty and fills as you avoid something reads as a threat
  // meter, not as an objective — so the avoidance objectives start full.
  it('shows the avoidance objectives FULL until they are broken', () => {
    expect(progress01({ kind: 'noSpike' }, tally(), 10)).toBe(1)
    expect(progress01({ kind: 'noSpike' }, tally({ spikes: 1 }), 10)).toBe(0)
    expect(progress01({ kind: 'noMiss', n: 2 }, tally(), 10)).toBe(1)
    expect(progress01({ kind: 'noMiss', n: 2 }, tally({ misses: 3 }), 10)).toBe(0)
  })

  it('does not divide by zero on a run with no stomps yet', () => {
    expect(progress01({ kind: 'accuracy', n: 55 }, tally(), 10)).toBe(1)
  })
})

describe('objectiveLabel', () => {
  it('returns an i18n key and args rather than a built string', () => {
    for (const c of CASES) {
      const { key, args } = objectiveLabel(c.o)
      expect(key.startsWith('objectives.')).toBe(true)
      expect(typeof args).toBe('object')
    }
  })

  it('passes the bug through as a key, not as English', () => {
    expect(objectiveLabel({ kind: 'kind', id: 'moth', n: 3 }).args)
      .toEqual({ n: 3, bug: 'bugs.moth' })
  })
})
