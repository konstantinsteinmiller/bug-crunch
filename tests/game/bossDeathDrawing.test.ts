import { describe, expect, it } from 'vitest'
import {
  deathArm, deathBeats, deathFlankFoot, fallOntoBack, fallOntoFlank,
  FLANK_REST, LYING_REST, UPRIGHT_FALL
} from '@/game/monsterKit'
import { deathFallSide, monsterDeathFrame } from '@/game/monsterSprites'
import { bossDesigns } from '@/game/foes'

// ─── A boss's death, DRAWN ─────────────────────────────────────────────────
//
// The death replaced a walk frame rolled over by ninety degrees, which players
// read as exactly that — a standing creature turned on its side. What these pin
// is what makes the drawn one a fall instead: limbs that keep their length
// while they flail, a last pose with the arms spread, and a body that lies ON
// the ground inside its own panel rather than hanging off the feet line.

/** Just enough of a 2D context to follow the transform a fall applies. */
const affine = () => {
  // [a c e; b d f] — the canvas convention.
  let m = [1, 0, 0, 1, 0, 0]
  const mul = (n: number[]) => {
    const [a, b, c, d, e, f] = m
    m = [
      a! * n[0]! + c! * n[1]!, b! * n[0]! + d! * n[1]!,
      a! * n[2]! + c! * n[3]!, b! * n[2]! + d! * n[3]!,
      a! * n[4]! + c! * n[5]! + e!, b! * n[4]! + d! * n[5]! + f!
    ]
  }
  const ctx = {
    translate: (x: number, y: number) => mul([1, 0, 0, 1, x, y]),
    rotate: (r: number) => mul([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]),
    scale: (x: number, y: number) => mul([x, 0, 0, y, 0, 0])
  }
  const apply = (x: number, y: number): [number, number] =>
    [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!]
  return { ctx: ctx as unknown as CanvasRenderingContext2D, apply }
}

describe('the drawn boss death', () => {
  it('runs from the blow to a body lying still', () => {
    const start = deathBeats(0)
    const end = deathBeats(1)
    expect(start.recoil).toBe(1)
    expect(start.fall).toBe(0)
    expect(end.fall).toBe(1)
    expect(end.lifeless).toBe(1)
    expect(end.settle).toBe(1)
    expect(end.bounce).toBeCloseTo(0, 6)
    for (let k = 0; k <= 1.0001; k += 0.05) {
      for (const v of Object.values(deathBeats(k))) {
        expect(v).toBeGreaterThanOrEqual(-1e-9)
        expect(v).toBeLessThanOrEqual(1 + 1e-9)
      }
    }
  })

  it('flails and drops the arms without ever stretching a bone', () => {
    const reach = 0.4
    for (let k = 0; k <= 1.0001; k += 0.05) {
      for (const side of [-1, 1] as const) {
        const A = deathArm(deathBeats(k), side, reach)
        const upper = Math.hypot(A.elbow[0], A.elbow[1])
        const fore = Math.hypot(A.hand[0] - A.elbow[0], A.hand[1] - A.elbow[1])
        // Two equal bones, each half the arm: parts MOVE, shapes never change.
        expect(upper).toBeCloseTo(reach / 2, 6)
        expect(fore).toBeCloseTo(reach / 2, 6)
      }
    }
  })

  it('ends with the arms spread — one flung down the body, one up past the shoulder', () => {
    const D = deathBeats(1)
    const under = deathArm(D, UPRIGHT_FALL, 1)
    const over = deathArm(D, -UPRIGHT_FALL as -1 | 1, 1)
    // Out to either side of the body, not hanging by it.
    expect(Math.abs(under.hand[0])).toBeGreaterThan(0.6)
    expect(Math.abs(over.hand[0])).toBeGreaterThan(0.6)
    expect(Math.sign(under.hand[0])).toBe(-Math.sign(over.hand[0]))
    // Not a matched pair: a body that lands symmetrical reads as laid out.
    expect(Math.sign(under.hand[1])).toBe(1)
    expect(Math.sign(over.hand[1])).toBe(-1)
  })

  it('lays an upright body down above its feet line, on a diagonal, inside its panel', () => {
    const S = 1
    const { ctx, apply } = affine()
    fallOntoBack(ctx, S, deathBeats(1), UPRIGHT_FALL, 0.15)
    const crown = apply(0, -1.05)
    const feet = apply(0, 1)
    const middle = apply(0, 0.15)
    // Its middle comes to rest LYING_REST above where the feet stood…
    expect(middle[1]).toBeCloseTo(1 - LYING_REST, 6)
    // …and all of it lies above that line: nothing hangs off the panel bottom.
    expect(crown[1]).toBeLessThan(1)
    expect(feet[1]).toBeLessThan(1)
    // Head to the fall side, feet to the other: across the ground, not upright.
    expect(Math.sign(crown[0])).toBe(UPRIGHT_FALL)
    expect(Math.sign(feet[0])).toBe(-UPRIGHT_FALL)
    // Seen as the ground is, flatter than it is long — and inside the death
    // panel, which is 7/6 of the walk's frame: ±1.3 units at the walk's scale.
    expect(Math.abs(crown[1] - feet[1])).toBeLessThan(Math.abs(crown[0] - feet[0]))
    expect(Math.max(Math.abs(crown[0]), Math.abs(feet[0]))).toBeLessThan(1.3)
  })

  it('stands the body where it stood while the blow lands', () => {
    const { ctx, apply } = affine()
    fallOntoBack(ctx, 1, deathBeats(0), UPRIGHT_FALL, 0.15)
    const feet = apply(0, 1)
    expect(feet[0]).toBeCloseTo(0, 6)
    expect(feet[1]).toBeCloseTo(1, 6)
  })

  it('keels a side-on beast over where it stood, flattened, legs thrown out stiff', () => {
    const { ctx, apply } = affine()
    const D = deathBeats(1)
    fallOntoFlank(ctx, 1, D, -1, 0.4)
    const middle = apply(0, 0.4)
    const back = apply(0, 0)
    // Where it stood, give or take the slump of the head end going down.
    expect(Math.abs(middle[0])).toBeLessThan(0.1)
    expect(Math.abs(middle[1] - (1 - FLANK_REST))).toBeLessThan(0.05)
    // Flattened toward its middle: the back comes down to meet it.
    expect(middle[1] - back[1]).toBeLessThan(0.3)
    // A front leg at full length, out past the hip toward the head.
    const hip: [number, number] = [-0.2, 0.66]
    const foot = deathFlankFoot(D, hip, [-0.2, 1], 0.38, true, -1)
    expect(Math.hypot(foot[0] - hip[0], foot[1] - hip[1])).toBeCloseTo(0.38 * 0.98, 6)
    expect(foot[0]).toBeLessThan(hip[0] - 0.25)
  })

  it('has a death for every boss body, and none for a body that does not exist', () => {
    for (const design of bossDesigns()) {
      expect(monsterDeathFrame(design, 0)?.painted).toBe(false)
      expect(monsterDeathFrame(design, 7)).not.toBeNull()
      expect([-1, 1]).toContain(deathFallSide(design))
    }
    expect(monsterDeathFrame('no-such-design', 0)).toBeNull()
  })
})
