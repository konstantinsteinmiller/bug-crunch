import { describe, expect, it } from 'vitest'
import { roundedOutlineFromTop } from '@/components/atoms/outlinePath'

/**
 * The countdown traces the button it will press. What a screenshot cannot pin
 * is that the trace starts where a clock starts, runs clockwise, closes, and
 * keeps its corners concentric with the button's own when it is inset.
 */
describe('the rounded outline', () => {
  it('starts at the top centre and runs clockwise through four corners', () => {
    const d = roundedOutlineFromTop({ x: 0, y: 0, w: 60, h: 40, r: 10 })
    expect(d.startsWith('M 30 0')).toBe(true)
    // Right edge first (clockwise from the top), then down, left, up.
    expect(d).toContain('H 50 A 10 10 0 0 1 60 10')
    expect(d).toContain('V 30 A 10 10 0 0 1 50 40')
    expect(d).toContain('H 10 A 10 10 0 0 1 0 30')
    expect(d).toContain('V 10 A 10 10 0 0 1 10 0')
    expect(d.endsWith('Z')).toBe(true)
    expect((d.match(/ A /g) ?? []).length).toBe(4)
  })

  it('shrinks the radius with the inset, so the corners stay concentric', () => {
    const d = roundedOutlineFromTop({ x: 0, y: 0, w: 60, h: 40, r: 10 }, 2)
    expect(d.startsWith('M 30 2')).toBe(true)
    expect(d).toContain('A 8 8 0 0 1 58 10')
  })

  it('never asks for a radius bigger than half the box', () => {
    const d = roundedOutlineFromTop({ x: 0, y: 0, w: 20, h: 40, r: 30 })
    expect(d).toContain('A 10 10')
    expect(d).not.toContain('A 30 30')
  })

  it('traces a box that is offset inside a bigger canvas', () => {
    const d = roundedOutlineFromTop({ x: 5, y: 7, w: 20, h: 20, r: 4 })
    expect(d.startsWith('M 15 7')).toBe(true)
    expect(d).toContain('H 21 A 4 4 0 0 1 25 11')
  })

  it('returns nothing for a box the inset has swallowed', () => {
    expect(roundedOutlineFromTop({ x: 0, y: 0, w: 4, h: 4, r: 2 }, 3)).toBe('')
  })
})
