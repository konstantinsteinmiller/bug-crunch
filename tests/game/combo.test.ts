import { describe, expect, it } from 'vitest'
import {
  COMBO_LADDER,
  COMBO_WINDOW_MS,
  FEVER,
  FEVER_MS,
  JUICE_DECAY_PER_S,
  MAX_COMBO_MULTIPLIER,
  MUSIC_RATE_RANGE,
  chainBreak,
  chainHit,
  chainStep,
  chainUrgency,
  comboMultiplier,
  comboMusicRate,
  comboShake,
  decayJuice,
  feverActive,
  feverReady,
  isComboStepUp,
  juiceComboBoost,
  juiceGain,
  newChain,
  splatWord,
  squishScore,
  startFever,
  stepFever,
  type FeverState
} from '@/game/combo'

// ─── The ladder ─────────────────────────────────────────────────────────────

describe('comboMultiplier', () => {
  it('opens at x1 so a chain never starts on a freebie', () => {
    expect(comboMultiplier(0)).toBe(1)
    expect(comboMultiplier(1)).toBe(1)
  })

  it('matches the authored ladder rung for rung', () => {
    COMBO_LADDER.forEach((mult, n) => {
      expect(comboMultiplier(n)).toBe(mult)
    })
  })

  it('saturates at the GDD top rung of x50', () => {
    expect(comboMultiplier(COMBO_LADDER.length)).toBe(MAX_COMBO_MULTIPLIER)
    expect(comboMultiplier(5_000)).toBe(MAX_COMBO_MULTIPLIER)
    expect(COMBO_LADDER[COMBO_LADDER.length - 1]).toBe(MAX_COMBO_MULTIPLIER)
  })

  it('never goes backwards as the chain grows', () => {
    for (let n = 1; n < COMBO_LADDER.length + 4; n++) {
      expect(comboMultiplier(n)).toBeGreaterThanOrEqual(comboMultiplier(n - 1))
    }
  })

  it('is total: junk in, x1 out', () => {
    expect(comboMultiplier(Number.NaN)).toBe(1)
    expect(comboMultiplier(-7)).toBe(1)
    // Infinity is junk, not "an enormous chain": a non-finite count can only
    // come from a corrupt caller, and paying it the top rung would turn one bad
    // number into a score nobody can beat.
    expect(comboMultiplier(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe('isComboStepUp', () => {
  it('is true exactly on the squish that changes the rung', () => {
    for (let n = 2; n < COMBO_LADDER.length; n++) {
      const stepped = comboMultiplier(n) > comboMultiplier(n - 1)
      expect(isComboStepUp(n)).toBe(stepped)
    }
  })

  it('is never true on the first squish', () => {
    expect(isComboStepUp(1)).toBe(false)
  })
})

describe('splatWord', () => {
  it('maps the four tiers to the four words on the reference sheet', () => {
    expect(splatWord(1)).toBe('squish')
    expect(splatWord(2)).toBe('squish')
    expect(splatWord(3)).toBe('crunch')
    expect(splatWord(5)).toBe('crunch')
    expect(splatWord(8)).toBe('splat')
    expect(splatWord(12)).toBe('splat')
    expect(splatWord(20)).toBe('ultra')
    expect(splatWord(50)).toBe('ultra')
  })

  it('only ever moves up as the multiplier rises', () => {
    const order = ['squish', 'crunch', 'splat', 'ultra']
    let last = 0
    for (const mult of COMBO_LADDER) {
      const rank = order.indexOf(splatWord(mult))
      expect(rank).toBeGreaterThanOrEqual(last)
      last = rank
    }
  })
})

describe('squishScore', () => {
  it('multiplies and rounds to an integer', () => {
    expect(squishScore(10, 1)).toBe(10)
    expect(squishScore(10, 5)).toBe(50)
    expect(squishScore(45, 12)).toBe(540)
    expect(Number.isInteger(squishScore(33, 7))).toBe(true)
  })

  it('never pays less than the base and never pays negative', () => {
    expect(squishScore(25, 0)).toBe(25)
    expect(squishScore(25, -4)).toBe(25)
    expect(squishScore(-25, 5)).toBe(0)
  })
})

// ─── Screen feel ────────────────────────────────────────────────────────────

describe('comboShake', () => {
  it('stays well under a full-strength kick even at the top rung', () => {
    expect(comboShake(MAX_COMBO_MULTIPLIER)).toBeLessThanOrEqual(0.62)
    expect(comboShake(1)).toBeGreaterThan(0)
  })

  it('rises with the multiplier', () => {
    expect(comboShake(8)).toBeGreaterThan(comboShake(2))
    expect(comboShake(50)).toBeGreaterThan(comboShake(8))
  })
})

describe('comboMusicRate', () => {
  it('starts at normal speed and saturates one tone and a half up', () => {
    expect(comboMusicRate(1)).toBeCloseTo(1, 6)
    expect(comboMusicRate(MAX_COMBO_MULTIPLIER)).toBeCloseTo(1 + MUSIC_RATE_RANGE, 6)
    expect(comboMusicRate(9_999)).toBeCloseTo(1 + MUSIC_RATE_RANGE, 6)
  })
})

// ─── The chain, as a state machine ──────────────────────────────────────────

describe('chain state machine', () => {
  it('starts empty', () => {
    const c = newChain()
    expect(c.count).toBe(0)
    expect(c.best).toBe(0)
    expect(chainUrgency(c)).toBe(0)
  })

  it('counts squishes, refreshes the window and tracks the best', () => {
    let c = newChain()
    for (let i = 1; i <= 5; i++) {
      const hit = chainHit(c)
      c = hit.next
      expect(c.count).toBe(i)
      expect(c.windowMs).toBe(COMBO_WINDOW_MS)
      expect(hit.multiplier).toBe(comboMultiplier(i))
    }
    expect(c.best).toBe(5)
  })

  it('a break resets the count but keeps the best', () => {
    let c = newChain()
    for (let i = 0; i < 7; i++) c = chainHit(c).next
    const broken = chainBreak(c)
    expect(broken.count).toBe(0)
    expect(broken.windowMs).toBe(0)
    expect(broken.best).toBe(7)
  })

  it('lapses exactly when the window runs out, and not before', () => {
    let c = chainHit(newChain()).next
    c = chainStep(c, COMBO_WINDOW_MS - 1)
    expect(c.count).toBe(1)
    c = chainStep(c, 1)
    expect(c.count).toBe(0)
    expect(c.best).toBe(1)
  })

  it('does nothing to an empty chain, however long the frame', () => {
    const c = newChain()
    expect(chainStep(c, 10_000)).toBe(c)
  })

  it('urgency drains from 1 to 0 across the window', () => {
    let c = chainHit(newChain()).next
    expect(chainUrgency(c)).toBeCloseTo(1, 6)
    c = chainStep(c, COMBO_WINDOW_MS / 2)
    expect(chainUrgency(c)).toBeCloseTo(0.5, 6)
    c = chainStep(c, COMBO_WINDOW_MS / 2)
    expect(chainUrgency(c)).toBe(0)
  })
})

// ─── The vial ───────────────────────────────────────────────────────────────

describe('the Juice vial', () => {
  it('a chain fills it faster than picking bugs off singly', () => {
    expect(juiceComboBoost(1)).toBe(1)
    expect(juiceComboBoost(5)).toBeGreaterThan(1)
    expect(juiceGain(0.06, 5)).toBeGreaterThan(juiceGain(0.06, 1))
  })

  it('caps the chain bonus so a top chain cannot fill it in three squishes', () => {
    expect(juiceComboBoost(MAX_COMBO_MULTIPLIER)).toBeLessThanOrEqual(2.5)
    expect(juiceComboBoost(1_000)).toBeLessThanOrEqual(2.5)
  })

  it('never pays out for a negative bug value', () => {
    expect(juiceGain(-1, 10)).toBe(0)
  })

  it('bleeds a partly-full vial at the authored rate', () => {
    expect(decayJuice(0.5, 1000)).toBeCloseTo(0.5 - JUICE_DECAY_PER_S, 6)
    expect(decayJuice(0.001, 10_000)).toBe(0)
  })

  // The regression this case exists for: the gain is clamped to exactly 1 and
  // the next simulation step used to take it straight back below the line, so
  // `feverReady` was true for a single frame and the FEVER button — which reads
  // a ref one frame later — never lit up at all.
  it('does NOT bleed once it is full, or Fever can never be triggered', () => {
    expect(decayJuice(1, 16.67)).toBe(1)
    expect(decayJuice(1, 60_000)).toBe(1)
    let s: FeverState = { juice: 1, remainMs: 0 }
    for (let i = 0; i < 600; i++) s = stepFever(s, 16.67)
    expect(s.juice).toBe(1)
    expect(feverReady(s)).toBe(true)
  })
})

// ─── Splat Fever ────────────────────────────────────────────────────────────

describe('Splat Fever', () => {
  it('is only ready on a full vial with no frenzy already running', () => {
    expect(feverReady({ juice: 0.99, remainMs: 0 })).toBe(false)
    expect(feverReady({ juice: 1, remainMs: 0 })).toBe(true)
    expect(feverReady({ juice: 1, remainMs: 500 })).toBe(false)
  })

  it('spends the whole vial and runs for the authored ten seconds', () => {
    const next = startFever({ juice: 1, remainMs: 0 })
    expect(next.juice).toBe(0)
    expect(next.remainMs).toBe(FEVER_MS)
    expect(feverActive(next)).toBe(true)
  })

  it('is a no-op when the vial is not full', () => {
    const s: FeverState = { juice: 0.8, remainMs: 0 }
    expect(startFever(s)).toBe(s)
  })

  it('counts the frenzy down and ends exactly at zero', () => {
    let s = startFever({ juice: 1, remainMs: 0 })
    s = stepFever(s, FEVER_MS - 1)
    expect(feverActive(s)).toBe(true)
    s = stepFever(s, 5_000)
    expect(s.remainMs).toBe(0)
    expect(feverActive(s)).toBe(false)
  })

  it('grows the stomp, the score and the shockwave', () => {
    expect(FEVER.radiusScale).toBeGreaterThan(1)
    expect(FEVER.scoreScale).toBeGreaterThan(1)
    expect(FEVER.shockScale).toBeGreaterThan(FEVER.radiusScale)
    expect(FEVER.agilityScale).toBeGreaterThan(1)
  })
})
