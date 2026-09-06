import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The painted gate frame is NINE-SLICED, and the cuts are fractions of the
 * file that arrived — never `GATE_FRAME`'s own reference pixels.
 *
 * This is the one contract in the art pipeline that a re-slice can break
 * silently. The slicer writes every frame at most 256 px tall by default
 * (`art-todo.md`), so the gate lands at 597x256, not the reference's
 * 1344x576. Read at reference pixels, the right-hand cut starts at x=1084 of a
 * 597 px bitmap — off the end of the image, so the right post simply does not
 * draw — the left cap eats two fifths of the painting instead of a fifth, and
 * `sh = 576` on a 256 px file squashes the whole frame into the top 44% of its
 * box. Every gate in the game, wrong, from one re-slice at the default size.
 *
 * So the blit is pinned to arbitrary bitmap sizes rather than to the one size
 * it happened to be developed against.
 */

/** An `Image` that decodes to `size` on the next tick, whatever the src. */
const stubImage = (w: number, h: number): void => {
  class FakeImage extends EventTarget {
    decoding = 'auto'
    naturalWidth = 0
    naturalHeight = 0
    width = 0
    height = 0
    private _src = ''
    get src(): string { return this._src }
    set src(v: string) {
      this._src = v
      setTimeout(() => {
        this.naturalWidth = this.width = w
        this.naturalHeight = this.height = h
        this.dispatchEvent(new Event('load'))
      }, 0)
    }
  }
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
}

interface Blit {
  sx: number; sy: number; sw: number; sh: number
  dx: number; dy: number; dw: number; dh: number
}

/** A context that records nothing but the nine-argument `drawImage` calls. */
const recorder = (): { ctx: CanvasRenderingContext2D; blits: Blit[] } => {
  const blits: Blit[] = []
  const ctx = {
    drawImage: (
      _img: unknown, sx: number, sy: number, sw: number, sh: number,
      dx: number, dy: number, dw: number, dh: number
    ) => { blits.push({ sx, sy, sw, sh, dx, dy, dw, dh }) }
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, blits }
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 5))

const loadPainted = async (w: number, h: number) => {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.stubEnv('VITE_ENABLE_ART_OVERRIDES', 'true')
  stubImage(w, h)
  const artMod = await import('@/use/useSurvivalArt')
  const { spriteFor } = await import('@/game/art')
  // Kick the probe and let it "decode", so the painted path is the live one.
  spriteFor('gate', 'frame-add')
  await tick()
  return artMod
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('the gate frame is sliced by fraction, at any file size', () => {
  // The size the slicer actually writes at the default cap, the reference
  // size the geometry is stated in, and a small one for good measure.
  for (const [w, h] of [[597, 256], [1344, 576], [300, 129]] as const) {
    it(`keeps all three cuts inside a ${w}x${h} file`, async () => {
      const { paintGateFrame, GATE_FRAME } = await loadPainted(w, h)
      const { ctx, blits } = recorder()
      const scale = 110
      paintGateFrame(ctx, 'add', GATE_FRAME.refHalfW * scale, 1.5 * scale, scale)

      // Left cap, right cap, stretched middle — in that order.
      expect(blits).toHaveLength(3)
      for (const b of blits) {
        expect(b.sx).toBeGreaterThanOrEqual(0)
        expect(b.sy).toBe(0)
        expect(b.sx + b.sw).toBeLessThanOrEqual(w)
        // The full height of the file, or the frame lands in part of its box.
        expect(b.sh).toBe(h)
        expect(b.sw).toBeGreaterThan(0)
      }
      // The three source rects tile the file edge to edge with no gap and no
      // overlap: cap | middle | cap.
      const [left, right, mid] = blits as [Blit, Blit, Blit]
      expect(left.sx).toBe(0)
      expect(left.sx + left.sw).toBe(mid.sx)
      expect(mid.sx + mid.sw).toBe(right.sx)
      expect(right.sx + right.sw).toBe(w)
      // Both caps carry the same slice of the painting, at the same width on
      // screen — a gate is symmetrical and a lopsided one reads as broken.
      expect(right.sw).toBe(left.sw)
      expect(right.dw).toBeCloseTo(left.dw, 6)
      // …and the cap is the fraction `GATE_FRAME` states, not its pixel count.
      expect(left.sw).toBe(Math.round((GATE_FRAME.cap / GATE_FRAME.w) * w))
    })
  }

  it('draws the same destination box whatever size the file arrives at', async () => {
    const boxes: string[] = []
    for (const [w, h] of [[597, 256], [1344, 576], [300, 129]] as const) {
      const { paintGateFrame, GATE_FRAME } = await loadPainted(w, h)
      const { ctx, blits } = recorder()
      const scale = 110
      paintGateFrame(ctx, 'add', GATE_FRAME.refHalfW * scale, 1.5 * scale, scale)
      boxes.push(blits.map((b) =>
        [b.dx, b.dy, b.dw, b.dh].map((n) => n.toFixed(3)).join(',')).join(' | '))
    }
    // The painting's resolution is a payload decision; where it lands is not.
    expect(new Set(boxes).size).toBe(1)
  })
})
