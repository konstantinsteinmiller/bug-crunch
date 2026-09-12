import { afterEach, describe, expect, it, vi } from 'vitest'
import { onArtChanged, setArtOverrides, spriteFor, type ArtChange } from '@/game/art'
import { stripCacheSize, stripFrames } from '@/game/spriteStrip'

/**
 * ─── Only rebuild what one painting changed ─────────────────────────────────
 *
 * Every painting that decoded used to throw away every sliced strip, the
 * backdrop, both silhouette caches and the shared sprite cache — measured at
 * 670 canvases baked during boot with the art layer on, against 119 with it
 * off, because ~70 paintings arrive one after another through the opening
 * stage. The art layer now says WHICH painting arrived and each listener drops
 * only what was built from it.
 *
 * These pin the message. The dropping itself is proven by the churn census in
 * `PERF-LEDGER.md`: jsdom has no 2D context, so no bake can be populated here.
 */

/** An `Image` that loads when the test says so — jsdom never fetches one. */
class FakeImage {
  static made: FakeImage[] = []
  naturalWidth = 0
  naturalHeight = 0
  src = ''
  decoding = ''
  private handlers: Record<string, () => void> = {}
  constructor () { FakeImage.made.push(this) }
  addEventListener (type: string, fn: () => void): void { this.handlers[type] = fn }
  fire (type: 'load' | 'error', width = 256, height = width): void {
    this.naturalWidth = width
    this.naturalHeight = height
    this.handlers[type]?.()
  }
}

describe('the art layer names the painting that arrived', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('names it on a decode, and says "everything" when the flag flips', () => {
    vi.stubGlobal('Image', FakeImage)
    FakeImage.made.length = 0
    const heard: ArtChange[] = []
    const off = onArtChanged((c) => heard.push(c))

    // A flag flip cannot name anything: it turns every painting on at once.
    setArtOverrides(true, false)
    expect(heard.every((c) => c === null)).toBe(true)

    heard.length = 0
    spriteFor('monster', 'grumpling')
    FakeImage.made.at(-1)!.fire('load')
    expect(heard).toEqual([{ kind: 'monster', id: 'grumpling' }])

    // A miss changes nothing on screen, so it tells nobody.
    spriteFor('monster', 'bonecap')
    FakeImage.made.at(-1)!.fire('error')
    expect(heard).toHaveLength(1)

    off()
    setArtOverrides(false, false)
  })

  it('leaves other strips alone when one painting arrives', () => {
    vi.stubGlobal('Image', FakeImage)
    FakeImage.made.length = 0
    setArtOverrides(true, false)

    // Two strips cached as settled REFUSALS — a 256x1 image divides into 256
    // panels, which is not a strip, and that is the one cache state a unit test
    // can reach with no 2D context to slice into.
    for (const id of ['grumpling', 'bonecap']) {
      stripFrames('monster', id, 1)
      FakeImage.made.at(-1)!.fire('load', 256, 1)
      stripFrames('monster', id, 1)
    }
    const both = stripCacheSize()
    expect(both).toBe(2)

    // A third painting decodes. Under the old listener this cleared the cache;
    // scoped, it takes only its own key — which was never in it.
    spriteFor('monster', 'snaggletusk')
    FakeImage.made.at(-1)!.fire('load')
    expect(stripCacheSize()).toBe(both)

    // A flag flip still means everything.
    setArtOverrides(false, false)
    expect(stripCacheSize()).toBe(0)
  })
})
