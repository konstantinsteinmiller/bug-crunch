import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Painted animation strips: the frame count is read off the image's own shape.
 *
 * Getting the panel aspect wrong does not fail loudly, it miscounts the panels
 * and shreds the animation — so the counting is pinned here, along with the
 * two refusals (a shape that divides into no sane number of panels, a probe
 * that has not settled and must NOT be cached as a miss) and the geometry
 * contract the renderer blits by: the feet line and the body height as
 * fractions of the frame, whatever size it arrives at.
 */

/** An `Image` that "decodes" to the given size on the next tick. */
const stubImages = (sizes: Record<string, [number, number]>): void => {
  class FakeImage extends EventTarget {
    decoding = 'auto'
    naturalWidth = 0
    naturalHeight = 0
    private _src = ''
    get src(): string { return this._src }
    set src(v: string) {
      this._src = v
      const hit = Object.entries(sizes).find(([key]) => v.includes(key))
      setTimeout(() => {
        if (hit) {
          this.naturalWidth = hit[1][0]
          this.naturalHeight = hit[1][1]
          this.dispatchEvent(new Event('load'))
        } else {
          this.dispatchEvent(new Event('error'))
        }
      }, 0)
    }
  }
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image)
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 5))

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
  vi.stubEnv('VITE_ENABLE_ART_OVERRIDES', 'true')
  window.history.replaceState({}, '', '/')
  localStorage.removeItem('artOverrides')
})

describe('stripFrames', () => {
  it('counts the panels off the strip\'s shape', async () => {
    stubImages({
      'monsters/grumpling.webp': [8 * 64, 64],
      'heroes/teal.webp': [4 * 96, 96],
      'props/coin.webp': [128, 128]
    })
    const { stripFrames } = await import('@/game/spriteStrip')

    // Not settled yet: null, and NOT a cached miss.
    expect(stripFrames('monster', 'grumpling', 1)).toBeNull()
    await tick()
    expect(stripFrames('monster', 'grumpling', 1)).toHaveLength(8)

    stripFrames('hero', 'teal', 1)
    await tick()
    expect(stripFrames('hero', 'teal', 1)).toHaveLength(4)

    // A still is a one-frame strip.
    stripFrames('prop', 'coin', 1)
    await tick()
    expect(stripFrames('prop', 'coin', 1)).toHaveLength(1)
  })

  it('refuses a shape that is not a strip rather than shredding it', async () => {
    stubImages({ 'monsters/blorp.webp': [64 * 40, 64] })
    const { stripFrames } = await import('@/game/spriteStrip')
    stripFrames('monster', 'blorp', 1)
    await tick()
    expect(stripFrames('monster', 'blorp', 1)).toBeNull()
  })

  it('indexes a cycle position into the right frame and wraps', async () => {
    stubImages({ 'monsters/grumpling.webp': [8 * 64, 64] })
    const { stripFrames, stripFrame } = await import('@/game/spriteStrip')
    stripFrames('monster', 'grumpling', 1)
    await tick()
    const frames = stripFrames('monster', 'grumpling', 1)!
    expect(stripFrame('monster', 'grumpling', 1, 0)).toBe(frames[0])
    expect(stripFrame('monster', 'grumpling', 1, 0.5)).toBe(frames[4])
    expect(stripFrame('monster', 'grumpling', 1, 1.125)).toBe(frames[1])
    expect(stripFrame('monster', 'grumpling', 1, -0.125)).toBe(frames[7])
  })

  it('drops its slices when the art layer changes', async () => {
    stubImages({ 'monsters/grumpling.webp': [8 * 64, 64] })
    const art = await import('@/game/art')
    const { stripFrames, stripCacheSize } = await import('@/game/spriteStrip')
    stripFrames('monster', 'grumpling', 1)
    await tick()
    expect(stripFrames('monster', 'grumpling', 1)).toHaveLength(8)
    expect(stripCacheSize()).toBe(1)
    art.setArtOverrides(false, false)
    expect(stripCacheSize()).toBe(0)
    expect(stripFrames('monster', 'grumpling', 1)).toBeNull()
  })
})

describe('the frame geometry the renderer blits by', () => {
  it('states the bake\'s feet line and height as fractions that reproduce the pixels', async () => {
    const m = await import('@/game/monsterSprites')
    const h = await import('@/game/heroSprites')
    expect(m.SPRITE_FOOT_R * m.MONSTER_FRAME_H).toBeCloseTo(m.SPRITE_FOOT, 9)
    expect(m.SPRITE_HEIGHT_R * m.MONSTER_FRAME_H).toBeCloseTo(m.SPRITE_HEIGHT, 9)
    expect(m.MONSTER_FRAME_ASPECT).toBeCloseTo(m.MONSTER_PX / m.MONSTER_FRAME_H, 9)
    // The frame grew UP, not down: the feet keep their distance from the
    // bottom edge, so a taller strip stands where the square one stood.
    expect(m.MONSTER_FRAME_H - m.SPRITE_FOOT).toBeCloseTo(m.MONSTER_PX * 0.48 - m.MONSTER_PX / 2.25, 9)
    expect(h.HERO_FOOT_R * h.HERO_PX).toBeCloseTo(h.HERO_FOOT, 9)
    expect(h.HERO_HEIGHT_R * h.HERO_PX).toBeCloseTo(h.HERO_HEIGHT, 9)
    // The feet sit inside the frame, below its middle, with the crown above.
    expect(m.SPRITE_FOOT_R).toBeGreaterThan(0.5)
    expect(m.SPRITE_FOOT_R).toBeLessThan(1)
    expect(m.SPRITE_FOOT_R - m.SPRITE_HEIGHT_R).toBeGreaterThan(0)
  })

  it('plays a painted strip in place of the bake, from the same clock', async () => {
    // Eight panels of the monster frame box, scaled: 156 x 176 becomes 312 x 352.
    stubImages({ 'monsters/grumpling.webp': [8 * 312, 352] })
    const m = await import('@/game/monsterSprites')
    // Nothing baked, nothing painted: null, so the field draws its fallback.
    expect(m.monsterFrame('grumpling', 0)).toBeNull()
    m.primeMonsterSprites(['grumpling'])
    await tick()
    const painted = m.monsterFrame('grumpling', 0.5)
    expect(painted).not.toBeNull()
    expect(painted!.width).toBe(312)
    expect(painted!.height).toBe(352)
  })
})
