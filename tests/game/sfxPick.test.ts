import { describe, it, expect } from 'vitest'
import { pickSlot, shotGain, shotRate, spritesOfTier, stackCount, type SfxCueSpec } from '@/game/audio/sfxPick'
import { SFX_CUES, SFX_SPRITES } from '@/game/audio/sfxSprites'
import { COMBO_LADDER } from '@/game/combo'

/**
 * How the runtime picks a take out of a rendered cue — the variant rotation,
 * the per-rung and per-star indexing, the jitter rules — and how the chain's
 * multiplier rungs map onto the fifteen-note ladder.
 */

const cue = (over: Partial<SfxCueSpec>): SfxCueSpec => ({
  sprite: 'x', gain: 0.2, pick: 'rotate', slots: [[0, 0.1], [0.2, 0.1], [0.4, 0.1], [0.6, 0.1]], ...over
})

describe('picking a take', () => {
  it('rotate never plays the same take twice in a row', () => {
    const c = cue({})
    let last = -1
    for (let k = 0; k < 400; k++) {
      const s = pickSlot(c, 0, last, (k * 0.618) % 1)
      expect(s).not.toBe(last)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThan(4)
      last = s
    }
  })

  it('alternate goes tick, tock, tick', () => {
    const c = cue({ pick: 'alternate', slots: [[0, 0.1], [0.2, 0.1]] })
    expect([pickSlot(c, 0, -1, 0.9), pickSlot(c, 0, 0, 0.9), pickSlot(c, 0, 1, 0.9)]).toEqual([0, 1, 0])
  })

  it('index follows power: fifteen rungs, three stars, tap-or-slam', () => {
    const rungs = cue({ pick: 'index', slots: Array.from({ length: 15 }, (_, i) => [i, 0.5] as const) })
    for (let i = 0; i < 15; i++) expect(pickSlot(rungs, i / 14, -1, 0.5)).toBe(i)
    const stars = cue({ pick: 'index', slots: [[0, 1], [1, 1], [2, 1]] })
    expect([0, 1, 2].map((i) => pickSlot(stars, i / 2, -1, 0))).toEqual([0, 1, 2])
    const fin = cue({ pick: 'index', slots: [[0, 1], [1, 1]] })
    // The scene passes 0.3 for a tap finish and 1 for a slam.
    expect(pickSlot(fin, 0.3, -1, 0)).toBe(0)
    expect(pickSlot(fin, 1, -1, 0)).toBe(1)
  })

  it('the shoebox knocks rise a step per blow at the powers the scene sends', () => {
    // The scene sends 1 − left/3: 1/3 after the first blow, 2/3 after the second.
    const box = SFX_CUES.boxHit!
    expect([1 / 3, 2 / 3, 1].map((p) => pickSlot(box, p, -1, 0))).toEqual([0, 1, 2])
  })

  it('notes never jitter; rotating takes do, a little', () => {
    const note = cue({ pick: 'index', rate: 0.05 })
    expect(shotRate(note, 0.5, 0)).toBe(1)
    expect(shotRate(note, 0.5, 1)).toBe(1)
    const take = cue({ rate: 0.03 })
    expect(shotRate(take, 0, 0)).toBeCloseTo(0.97, 6)
    expect(shotRate(take, 0, 1)).toBeCloseTo(1.03, 6)
    expect(shotGain(note, 0, 0)).toBe(note.gain)
    expect(shotGain(take, 0, 0)).toBeCloseTo(take.gain * 0.9, 6)
  })

  it('power curves reach the rate and gain ends (a full slam, a grown shoe)', () => {
    const c = cue({ gainPower: [0.8, 1], ratePower: [1.03, 0.97] })
    expect(shotGain({ ...c, pick: 'index' }, 0, 0)).toBeCloseTo(c.gain * 0.8, 6)
    expect(shotGain({ ...c, pick: 'index' }, 1, 0)).toBeCloseTo(c.gain, 6)
    expect(shotRate({ ...c, pick: 'index' }, 1, 0)).toBeCloseTo(0.97, 6)
  })

  it('a stack plays one chime per body: 2 at power 0, 6 at power 1', () => {
    const multi = SFX_CUES.multi!
    expect(stackCount(multi, 0)).toBe(2)
    expect(stackCount(multi, 1)).toBe(6)
    expect(stackCount(multi, Number.NaN)).toBe(2)
  })

  it('splits the sprites into tiers', () => {
    const t1 = spritesOfTier(SFX_SPRITES, 1)
    const t2 = spritesOfTier(SFX_SPRITES, 2)
    expect(t1.length).toBeGreaterThan(0)
    expect(t2.length).toBeGreaterThan(0)
    expect([...t1, ...t2].sort()).toEqual(Object.keys(SFX_SPRITES).sort())
  })
})

describe('the chain ladder, by rung', () => {
  it('each multiplier rung plays the next note up, and only the top rung reaches the top note', async () => {
    const { chainStepPower, chainFreq, LADDER_STEPS } = await import('@/use/useGameAudio')
    const rungs = [...new Set(COMBO_LADDER)].filter((m) => m > 1)
    const steps = rungs.map((m) => Math.round(chainStepPower(m) * (LADDER_STEPS - 1)))
    // Strictly rising, one note per rung, first rung A4 (as before), top rung E7.
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]!)
    expect(steps[0]).toBe(1)
    expect(steps[steps.length - 1]).toBe(LADDER_STEPS - 1)
    expect(chainFreq(steps[0]!)).toBeCloseTo(440, 1)
    // A multiplier past the ladder's end stays on the top rung, never wraps up.
    expect(chainStepPower(99)).toBe(1)
    // The same indexing the rendered set uses.
    const chain = SFX_CUES.chainStep!
    expect(chain.slots).toHaveLength(LADDER_STEPS)
    rungs.forEach((m, i) => expect(pickSlot(chain, chainStepPower(m), -1, 0.5)).toBe(steps[i]))
  })
})
