import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

/**
 * ─── A painted glyph reaches the button without the button knowing ──────────
 *
 * The icon set is ~57 glyphs and they are drawn by `GameIcon` on every surface
 * the game has. Before this, only a call site that passed an explicit `art`
 * prop to `FButton` / `FHudButton` could ever show a painting, which meant a
 * painted icon set would have landed on about six buttons and left the rest
 * vector — and a half-painted UI reads worse than an unpainted one.
 *
 * So `GameIcon` itself probes. These are the two halves of that contract: the
 * probe is made under the id the manifest paints, and the `<img>` only replaces
 * the `<svg>` when a painting actually decoded.
 *
 * `spriteFor` is mocked rather than driven through a real decode because jsdom
 * has no image pipeline; what is being proven here is the WIRING, and the decode
 * itself is `art.ts`'s own contract.
 */

const spriteFor = vi.fn<(kind: string, id: string) => HTMLImageElement | null>(() => null)
let fire: ((change: unknown) => void) | null = null

vi.mock('@/game/art', () => ({
  spriteFor: (kind: string, id: string) => spriteFor(kind, id),
  onArtChanged: (fn: (change: unknown) => void) => { fire = fn; return () => { fire = null } }
}))

const GameIcon = (await import('@/components/icons/GameIcon.vue')).default
const { artIdForGlyph } = await import('@/game/artCatalogue')

const fakePainting = (src: string): HTMLImageElement => {
  const img = document.createElement('img')
  Object.defineProperty(img, 'src', { value: src, writable: false })
  return img
}

describe('GameIcon', () => {
  beforeEach(() => {
    spriteFor.mockReset()
    spriteFor.mockReturnValue(null)
  })

  it('draws the vector glyph when nothing is painted', () => {
    const w = mount(GameIcon, { props: { name: 'play' } })
    expect(w.find('svg.game-icon').exists()).toBe(true)
    expect(w.find('img.game-icon').exists()).toBe(false)
    expect(w.find('path').attributes('d')).toBeTruthy()
  })

  it('asks for the painting under the id the manifest paints', () => {
    mount(GameIcon, { props: { name: 'gift' } })
    expect(spriteFor).toHaveBeenCalledWith('ui', 'icon-gift')
  })

  it('asks for the HUD MARK when the glyph already is one', () => {
    // `boot` is the Locker's mark. One painting serves the canvas HUD and every
    // `<GameIcon name="boot">` in the DOM; painting it twice would be painting
    // it twice.
    mount(GameIcon, { props: { name: 'boot' } })
    expect(spriteFor).toHaveBeenCalledWith('ui', 'locker')
    expect(artIdForGlyph('boot')).toBe('locker')
  })

  it('shows the painting instead of the glyph once it has decoded', () => {
    spriteFor.mockImplementation((_k, id) =>
      id === 'icon-coin' ? fakePainting('/images/ui/icon-coin.webp') : null)
    const w = mount(GameIcon, { props: { name: 'coin' } })
    const img = w.find('img.game-icon')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/images/ui/icon-coin.webp')
    expect(w.find('svg.game-icon').exists()).toBe(false)
    // Decoration on a button: it must never be announced, and it must never
    // swallow the press aimed at the button under it (the `pointer-events` half
    // is in the stylesheet).
    expect(img.attributes('aria-hidden')).toBe('true')
    expect(img.attributes('alt')).toBe('')
  })

  it('swaps in a painting that decodes AFTER it mounted', async () => {
    const w = mount(GameIcon, { props: { name: 'heart' } })
    expect(w.find('svg.game-icon').exists()).toBe(true)
    spriteFor.mockImplementation((_k, id) =>
      id === 'icon-heart' ? fakePainting('/images/ui/icon-heart.webp') : null)
    // Probing is async: the file lands a second or two after the page opens, and
    // a component that read once at setup would show the vector for the life of
    // the page. `onArtChanged` is what re-reads.
    fire?.({ kind: 'ui', id: 'icon-heart' })
    await w.vm.$nextTick()
    expect(w.find('img.game-icon').attributes('src')).toBe('/images/ui/icon-heart.webp')
  })

  it('ignores an arrival that is not its own', async () => {
    const w = mount(GameIcon, { props: { name: 'heart' } })
    spriteFor.mockImplementation(() => fakePainting('/images/ui/anything.webp'))
    fire?.({ kind: 'bug', id: 'ant' })
    await w.vm.$nextTick()
    // Still the vector: every glyph on screen re-reading on every painting that
    // decodes anywhere is most of the cast, once per HUD icon.
    expect(w.find('svg.game-icon').exists()).toBe(true)
  })
})

/**
 * ─── A mark's colour belongs to the game, not to the painting ───────────────
 *
 * The vector rung is `fill="currentColor"` and obeys `color:` for free; an
 * `<img>` obeys nothing. For a glyph whose colour is STATE that is not a
 * cosmetic difference, it is an inversion — with the art layer on, every star
 * the player had just EARNED rendered silver-grey (the untinted greyscale
 * painting) beside an unearned socket rendering warm gold, so the result screen
 * said the star they had not won was the special one.
 *
 * So a mark in `TINTED_GLYPHS` reaches the page as a MASK filled with
 * `currentColor`. These pin both halves: the renderer masks exactly that set,
 * and the manifest asks for a silhouette for exactly that set — a mark painted
 * in colour and then masked to its own alpha, or painted flat white and then
 * shown untinted, is the same bug wearing the other shoe.
 */
describe('painted marks are tinted by the stylesheet', () => {
  beforeEach(() => {
    spriteFor.mockReset()
    spriteFor.mockReturnValue(null)
  })

  it('masks a MARK so `color` reaches it, instead of blitting it', () => {
    spriteFor.mockImplementation((_k, id) =>
      id === 'star' ? fakePainting('/images/ui/star.webp') : null)
    const w = mount(GameIcon, { props: { name: 'star' } })
    const span = w.find('span.game-icon.is-tinted')
    expect(span.exists()).toBe(true)
    expect(span.attributes('style')).toContain('/images/ui/star.webp')
    // Never as a picture: an `<img>` here is the grey-star bug.
    expect(w.find('img.game-icon').exists()).toBe(false)
    expect(span.attributes('aria-hidden')).toBe('true')
  })

  it('blits an OBJECT as painted — its colours are its own', () => {
    spriteFor.mockImplementation((_k, id) =>
      id === 'icon-gem' ? fakePainting('/images/ui/icon-gem.webp') : null)
    const w = mount(GameIcon, { props: { name: 'gem' } })
    expect(w.find('img.game-icon').exists()).toBe(true)
    expect(w.find('span.game-icon.is-tinted').exists()).toBe(false)
  })

  it('falls back to the vector when a mark has no painting', () => {
    const w = mount(GameIcon, { props: { name: 'star' } })
    expect(w.find('svg.game-icon').exists()).toBe(true)
    expect(w.find('span.game-icon.is-tinted').exists()).toBe(false)
  })

  // The other half — that the MANIFEST asks for a silhouette for exactly this
  // set — is pinned in `artManifest.test.ts`, which is the file that already
  // imports the bench manifest without mocking the renderer out from under it.
})
