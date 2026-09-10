import { describe, expect, it } from 'vitest'
import {
  REVEAL_DARK, REVEAL_LIGHT, REVEAL_LIGHT_RAYS, REVEAL_RAYS, rayGradient
} from '@/components/atoms/revealRays'

/**
 * The reveal's burst is one conic gradient. What a screenshot cannot pin is
 * that the wedges tile the circle exactly and alternate — a gradient that
 * comes up a degree short paints one ray a different width from the rest, and
 * the eye finds that ray every time.
 */
describe('the reveal burst', () => {
  it('is sixteen rays, eight light and eight dark', () => {
    expect(REVEAL_RAYS).toBe(16)
    expect(REVEAL_LIGHT_RAYS).toBe(8)
  })

  it('tiles the full circle in equal, alternating wedges', () => {
    const css = rayGradient(REVEAL_RAYS, 'L', 'D')
    expect(css.startsWith('conic-gradient(')).toBe(true)
    const stops = [...css.matchAll(/([LD]) ([\d.]+)deg ([\d.]+)deg/g)]
    expect(stops).toHaveLength(REVEAL_RAYS)
    let cursor = 0
    stops.forEach((m, i) => {
      expect(m[1]).toBe(i % 2 === 0 ? 'L' : 'D')
      expect(Number(m[2])).toBeCloseTo(cursor, 2)
      cursor = Number(m[3])
      expect(cursor - Number(m[2])).toBeCloseTo(360 / REVEAL_RAYS, 2)
    })
    expect(cursor).toBeCloseTo(360, 2)
  })

  it('uses translucent colours so the road stays visible through the beams', () => {
    for (const c of [REVEAL_LIGHT, REVEAL_DARK]) {
      const alpha = Number(c.match(/,\s*([\d.]+)\)$/)![1])
      expect(alpha).toBeGreaterThan(0)
      expect(alpha).toBeLessThan(0.6)
    }
  })
})
