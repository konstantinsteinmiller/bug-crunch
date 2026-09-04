// ─── Cached gradient ramps ──────────────────────────────────────────────────
//
// `createLinearGradient` / `createRadialGradient` allocate an object, parse a
// CSS colour per stop and rasterise a ramp. The renderer was doing that once
// per ENTITY per FRAME at several sites — worst of all in the particle bucket,
// where up to 900 smoke puffs each rebuilt the same two-stop ramp sixty times a
// second, plus two template literals apiece to describe it.
//
// Caching the ramp is only half of it, and it is the smaller half — a cached
// ramp still has to be RASTERISED on every paint. So the hot path bakes the ramp
// to a sprite once per colour and blits it, and where it cannot (no offscreen
// context: jsdom under test, or a lost context in a real browser) it falls back
// to a cached ramp placed with a translate.
//
// Measured, interleaved A/B against a headed Chrome at the realistic peak of 150
// puffs: work-per-frame p95 1.20 ms -> 0.70 ms unthrottled (5/5 reps, ranges
// disjoint), p50 5.85 ms -> 3.55 ms at 4x CPU (6/6 reps). Full record and the
// approaches it beat are in `PERF-LEDGER.md`.
//
// Two things are asserted below.
//
// The first is that the cache actually collapses N paints into one baked sprite
// — and that a failed bake is cached too, rather than retried per particle.
//
// The second is that the blit lands where the filled arc did. That is the part a
// call-count assertion would happily pass while the art moved, so the geometry
// is checked directly: the recorded transform is replayed to resolve each paint
// back to canvas space, in both the sprite and fallback paths.

import { beforeEach, describe, expect, it } from 'vitest'
import { clearRamps, getRamp, putRamp, rampCount, rgbString, spriteCount } from '@/use/useGradientRamps'
import { clearParticles, drawParticles, emit, quality } from '@/use/useVfx'

/** A gradient stand-in — jsdom has no canvas, and the contract under test is
 *  "how many were made and where were they painted", not what they look like. */
class FakeGradient {
  constructor(public readonly coords: number[]) {}
  stops: [number, string][] = []
  addColorStop(offset: number, color: string): void {
    this.stops.push([offset, color])
  }
}

interface Painted {
  /** Where the arc's centre landed in CANVAS space, after the transform. */
  cx: number
  cy: number
  /** The arc's radius after the transform, on each axis. Equal means the ramp
   *  and the path both stayed circular. */
  rx: number
  ry: number
  fill: unknown
  alpha: number
}

/** Records the calls that matter and keeps a 2x3 matrix so a painted arc can be
 *  resolved back to canvas space — the same arithmetic the real canvas does. */
class RecordingCtx {
  gradients: FakeGradient[] = []
  painted: Painted[] = []
  fills: unknown[] = []
  strokes: unknown[] = []

  globalAlpha = 1
  globalCompositeOperation = 'source-over'
  fillStyle: unknown = null
  strokeStyle: unknown = null
  lineWidth = 1
  lineCap = 'butt'

  // [a, b, c, d, e, f] — scale/skew in a..d, translation in e/f.
  private m: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0]
  private stack: [number, number, number, number, number, number][] = []
  private pending: { x: number; y: number; r: number } | null = null

  createRadialGradient(...coords: number[]): FakeGradient {
    const g = new FakeGradient(coords)
    this.gradients.push(g)
    return g
  }
  createLinearGradient(...coords: number[]): FakeGradient {
    const g = new FakeGradient(coords)
    this.gradients.push(g)
    return g
  }

  save(): void {
    this.stack.push([...this.m] as typeof this.m)
  }
  restore(): void {
    const prev = this.stack.pop()
    if (prev) this.m = prev
  }
  translate(x: number, y: number): void {
    this.m[4] += this.m[0] * x + this.m[2] * y
    this.m[5] += this.m[1] * x + this.m[3] * y
  }
  scale(x: number, y: number): void {
    this.m[0] *= x
    this.m[1] *= x
    this.m[2] *= y
    this.m[3] *= y
  }
  rotate(): void {}

  beginPath(): void {
    this.pending = null
  }
  arc(x: number, y: number, r: number): void {
    this.pending = { x, y, r }
  }
  ellipse(x: number, y: number, rx: number): void {
    this.pending = { x, y, r: rx }
  }
  moveTo(): void {}
  lineTo(): void {}
  fillRect(): void {}

  blits: { img: unknown; x: number; y: number; w: number; h: number }[] = []
  drawImage(img: unknown, x: number, y: number, w: number, h: number): void {
    this.blits.push({ img, x, y, w, h })
  }

  /** The matrix's scale factors — 1,1 unless a `scale()` was applied. The
   *  benchmark showed sizing a ramp by the transform is SLOWER than the
   *  gradient creation it replaces, so the hot paths must not use one. */
  scaleFactors(): [number, number] {
    return [Math.hypot(this.m[0], this.m[1]), Math.hypot(this.m[2], this.m[3])]
  }
  maxScaleSeen = 1
  private noteScale(): void {
    const [sx, sy] = this.scaleFactors()
    this.maxScaleSeen = Math.max(this.maxScaleSeen, sx, sy)
  }

  fill(): void {
    this.fills.push(this.fillStyle)
    this.noteScale()
    if (!this.pending) return
    const { x, y, r } = this.pending
    this.painted.push({
      cx: this.m[0] * x + this.m[2] * y + this.m[4],
      cy: this.m[1] * x + this.m[3] * y + this.m[5],
      rx: Math.hypot(this.m[0], this.m[1]) * r,
      ry: Math.hypot(this.m[2], this.m[3]) * r,
      fill: this.fillStyle,
      alpha: this.globalAlpha
    })
  }
  stroke(): void {
    this.strokes.push(this.strokeStyle)
  }
}

const asCtx = (c: RecordingCtx): CanvasRenderingContext2D =>
  c as unknown as CanvasRenderingContext2D

const identity = (v: number): number => v

beforeEach(() => {
  clearRamps()
  clearParticles()
  quality.value = 'high'
})

describe('ramp cache', () => {
  it('hands back the same object for a repeated key and rebuilds after a clear', () => {
    const ctx = new RecordingCtx()
    const first = putRamp('k', ctx.createRadialGradient(0, 0, 0, 0, 0, 1))

    expect(getRamp('k')).toBe(first)
    expect(rampCount()).toBe(1)

    clearRamps()
    expect(getRamp('k')).toBeUndefined()
    expect(rampCount()).toBe(0)
  })

  it('keeps string and integer key spaces separate', () => {
    const ctx = new RecordingCtx()
    putRamp('7', ctx.createRadialGradient(0, 0, 0, 0, 0, 1))
    putRamp(7, ctx.createRadialGradient(0, 0, 0, 0, 0, 2))

    expect(rampCount()).toBe(2)
    expect(getRamp('7')).not.toBe(getRamp(7))
  })

  it('caps itself rather than growing without bound on a key that never repeats', () => {
    const ctx = new RecordingCtx()
    for (let i = 0; i < 400; i++) putRamp(`k${i}`, ctx.createRadialGradient(0, 0, 0, 0, 0, 1))
    expect(rampCount()).toBeLessThanOrEqual(256)
  })
})

describe('rgb colour strings', () => {
  it('returns one shared string per colour instead of allocating per particle', () => {
    const a = rgbString(168, 156, 134)
    const b = rgbString(168, 156, 134)

    expect(a).toBe('rgb(168,156,134)')
    // Identity, not equality — the point is that no new string was built.
    expect(a).toBe(b)
    expect(rgbString(1, 2, 3)).toBe('rgb(1,2,3)')
  })

  it('does not confuse colours that share a packed byte pattern', () => {
    expect(rgbString(1, 0, 0)).toBe('rgb(1,0,0)')
    expect(rgbString(0, 1, 0)).toBe('rgb(0,1,0)')
    expect(rgbString(0, 0, 1)).toBe('rgb(0,0,1)')
  })
})

// A stand-in for the offscreen canvas the sprite bake wants. jsdom has no 2D
// context at all, so without this the bake correctly reports failure and the
// gradient fallback runs — which is what the "fallback" block below exercises.
const withStubbedCanvas = (run: () => void): void => {
  const real = document.createElement.bind(document)
  const bakeCtx = {
    fillStyle: null as unknown,
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {}
  }
  document.createElement = ((tag: string) => {
    if (tag !== 'canvas') return real(tag)
    return { width: 0, height: 0, getContext: () => bakeCtx, __stub: true }
  }) as typeof document.createElement
  try {
    run()
  } finally {
    document.createElement = real
  }
}

describe('smoke particles', () => {
  const smoke = (x: number, y: number, size: number, color: [number, number, number]): void => {
    emit({ x, y, life: 500, size, color, shape: 3, alpha: 1 })
  }

  describe('with an offscreen canvas — the shipped path', () => {
    it('bakes ONE sprite per colour and blits it for every puff', () => {
      for (let i = 0; i < 60; i++) smoke(i, i, 0.5 + i * 0.01, [168, 156, 134])
      for (let i = 0; i < 20; i++) smoke(i, i, 1, [78, 78, 86])

      const ctx = new RecordingCtx()
      withStubbedCanvas(() => drawParticles(asCtx(ctx), identity, identity, 10))

      expect(ctx.blits.length).toBe(80)
      // Two colours in, two distinct sprites out — and no ramp built at all.
      expect(new Set(ctx.blits.map(b => b.img)).size).toBe(2)
      expect(ctx.gradients.length).toBe(0)
      expect(spriteCount()).toBe(2)
    })

    it('blits a box that reproduces the arc the gradient version filled', () => {
      const scale = 10
      // `size` is `max(0.6, psize * scale * (0.55 + t * 0.45))`, and `t` is 1 on
      // the frame a particle is emitted.
      const size = 0.8 * scale
      smoke(3, 7, 0.8, [168, 156, 134])

      const ctx = new RecordingCtx()
      withStubbedCanvas(() =>
        drawParticles(asCtx(ctx), (wx: number) => wx * scale, (wy: number) => wy * scale, scale)
      )

      expect(ctx.blits.length).toBe(1)
      const b = ctx.blits[0]!
      // A 2*size box centred on the particle — same centre, same radius.
      expect(b.x).toBeCloseTo(30 - size, 6)
      expect(b.y).toBeCloseTo(70 - size, 6)
      expect(b.w).toBeCloseTo(size * 2, 6)
      expect(b.h).toBeCloseTo(size * 2, 6)
    })

    it('reuses the sprite across frames', () => {
      for (let i = 0; i < 10; i++) smoke(i, i, 1, [168, 156, 134])

      const first = new RecordingCtx()
      const second = new RecordingCtx()
      withStubbedCanvas(() => {
        drawParticles(asCtx(first), identity, identity, 10)
        drawParticles(asCtx(second), identity, identity, 10)
      })

      expect(spriteCount()).toBe(1)
      expect(first.blits.length).toBe(10)
      expect(second.blits.length).toBe(10)
    })
  })

  describe('without an offscreen canvas — the fallback', () => {
    it('falls back to a cached ramp rather than drawing nothing', () => {
      for (let i = 0; i < 30; i++) smoke(i, i, 1, [168, 156, 134])

      const ctx = new RecordingCtx()
      drawParticles(asCtx(ctx), identity, identity, 10)

      expect(ctx.blits.length).toBe(0)
      expect(ctx.painted.length).toBe(30)
      // Same colour, same radius — one ramp, reused thirty times.
      expect(ctx.gradients.length).toBe(1)
    })

    it('does not retry the failed bake once per particle', () => {
      for (let i = 0; i < 30; i++) smoke(i, i, 1, [168, 156, 134])
      const ctx = new RecordingCtx()
      drawParticles(asCtx(ctx), identity, identity, 10)
      // The failure is cached too — one entry, not thirty attempts.
      expect(spriteCount()).toBe(1)
    })

    it('paints at the centre and radius the uncached version drew', () => {
      const scale = 10
      const size = Math.round(0.8 * scale)
      smoke(3, 7, 0.8, [168, 156, 134])

      const ctx = new RecordingCtx()
      drawParticles(asCtx(ctx), (wx: number) => wx * scale, (wy: number) => wy * scale, scale)

      const p = ctx.painted[0]!
      expect(p.cx).toBeCloseTo(30, 6)
      expect(p.cy).toBeCloseTo(70, 6)
      expect(p.rx).toBeCloseTo(size, 6)
      expect(p.ry).toBeCloseTo(size, 6)
    })
  })

  // The shipped path sizes a puff through `drawImage`'s destination rectangle.
  // Sizing a cached UNIT ramp with a `scale()` transform instead is the obvious
  // alternative and it is not what was measured, so it must not drift back in
  // under the cover of "same thing, tidier" — it would put an unmeasured
  // transform in the pool's hottest loop.
  it('never sizes a ramp with a scale() transform', () => {
    for (let i = 0; i < 20; i++) smoke(i, i, 1 + i * 0.1, [168, 156, 134])

    const fallback = new RecordingCtx()
    drawParticles(asCtx(fallback), identity, identity, 10)
    expect(fallback.maxScaleSeen).toBe(1)

    const sprite = new RecordingCtx()
    withStubbedCanvas(() => drawParticles(asCtx(sprite), identity, identity, 10))
    expect(sprite.maxScaleSeen).toBe(1)
  })

  it('leaves the transform balanced, so later layers are not shifted', () => {
    for (let i = 0; i < 5; i++) smoke(i, i, 1, [168, 156, 134])

    const ctx = new RecordingCtx()
    drawParticles(asCtx(ctx), identity, identity, 10)

    // A missing restore would leave a translate on the matrix and drag every
    // layer drawn after the particles across the screen.
    const probe = new RecordingCtx()
    Object.assign(probe, ctx)
    probe.beginPath()
    probe.arc(0, 0, 1)
    probe.fill()
    const p = probe.painted[probe.painted.length - 1]!
    expect(p.cx).toBeCloseTo(0, 6)
    expect(p.cy).toBeCloseTo(0, 6)
    expect(p.rx).toBeCloseTo(1, 6)
  })
})
