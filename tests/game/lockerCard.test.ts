// ─── The Locker card, as a player meets it ──────────────────────────────────
//
// Two things are pinned here, and both of them shipped broken.
//
// 1. PRESSING BUY DOES SOMETHING. The card's CTA binds `@click.stop="emit(…)"`,
//    which on a component compiles to `withModifiers(handler, ['stop'])` — a
//    wrapper that calls `.stopPropagation()` on the emit's first argument. When
//    `FButton` emitted its click with no payload that argument was `undefined`,
//    so the wrapper threw before the handler ran and the whole shop was inert.
//    `tests/ui/fButtonClickModifiers.test.ts` pins the mechanism in the button;
//    this file pins it through the REAL card template, which is the thing that
//    actually has to work.
//
// 2. THE CLOSED CARD SAYS WHAT THE SHOE COSTS. Everything that made the grid a
//    shop — the price, the star gate, the Buy button — used to live behind a
//    tap, and nothing on the closed card hinted that a tap existed. A test that
//    only opened the card would never have noticed.
//
// jsdom has no canvas, so `getContext('2d')` yields nothing and the card's own
// `draw()` early-returns. That is fine: none of this is about the drawing.

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

import ShoeCard from '@/components/game/ShoeCard.vue'
import { shoeSpec } from '@/game/shoes'
import en from '@/i18n/locales/en'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  // The real English bundle, so a key renamed out from under the card shows up
  // here as a raw path rather than as a quietly passing test.
  messages: { en: en as unknown as Record<string, unknown> }
})

/**
 * Resolve a key through the SAME instance the card uses.
 *
 * Deliberately not a hard-coded English string. Several of the Locker's keys are
 * added to the locale files by a separate pass, and vue-i18n renders a missing
 * key as its own path — so comparing against `t()` asserts "the card asks for
 * the key it should ask for" both before and after that pass lands, instead of
 * going red for a reason that has nothing to do with the card.
 */
const tr = (key: string, n?: number): string =>
  n === undefined ? i18n.global.t(key) : i18n.global.t(key, { n })

/** The steel boot: 350 coins, 9 stars. The exact shoe the bug was found on. */
const SPEC = shoeSpec('steelBoot')

type CardProps = Partial<{
  owned: boolean
  starLocked: boolean
  affordable: boolean
  starsShort: number
  coinsShort: number
  equipped: boolean
  open: boolean
  adReady: boolean
  adBusy: boolean
}>

const mountCard = (props: CardProps = {}) =>
  mount(ShoeCard, {
    props: {
      spec: SPEC,
      owned: false,
      starLocked: false,
      affordable: true,
      starsShort: 0,
      coinsShort: 0,
      equipped: false,
      open: false,
      ...props
    },
    global: { plugins: [i18n] }
  })

type Card = ReturnType<typeof mountCard>

/** The expanded CTA — the only button carrying the shoe's own caption. */
const cta = (w: Card) => w.findAll('button').find((b) => b.text().includes('350'))
/** The film-strip button, found by class so the test does not depend on a
 *  locale string that a later pass supplies. */
const filmButton = (w: Card) => {
  const el = w.find('button.shoe-card__ad')
  return el.exists() ? el : undefined
}

describe('pressing Buy actually buys', () => {
  it('emits `act` from the expanded CTA', async () => {
    const wrapper = mountCard({ open: true, affordable: true })
    const btn = cta(wrapper)
    expect(btn, 'no Buy button rendered on an affordable, expanded card').toBeTruthy()

    await btn!.trigger('click')

    expect(wrapper.emitted('act'), 'the Buy press never reached the handler').toHaveLength(1)
  })

  it('does not also toggle the card open/closed', async () => {
    // What the `.stop` is for. A press that both buys and collapses the card
    // takes the shoe away from under the player's finger.
    const wrapper = mountCard({ open: true, affordable: true })
    await cta(wrapper)!.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('still expands when the card itself is tapped', async () => {
    const wrapper = mountCard()
    await wrapper.find('.shoe-card').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
  })
})

describe('the closed card is legible on its own', () => {
  it('prints the price with the coin, without being opened', () => {
    const wrapper = mountCard({ open: false, affordable: false, coinsShort: 120 })
    const tags = wrapper.find('.shoe-card__tags')

    expect(tags.exists(), 'the closed card has no tag row at all').toBe(true)
    expect(tags.text()).toContain('350')
    // `IconCoin` is an <img>, not a glyph — the same painted coin as the wallet
    // line, so the tag and the purse visibly hold one currency.
    expect(tags.find('img').exists(), 'the price has no coin beside it').toBe(true)
  })

  it('prints the star gate as well when the shoe is star-locked', () => {
    const wrapper = mountCard({ open: false, starLocked: true, affordable: false, starsShort: 4 })
    const text = wrapper.find('.shoe-card__tags').text()

    // Both facts, not the nearer one: 350 coins AND 9 stars.
    expect(text).toContain('350')
    expect(text).toContain(String(SPEC.starGate))
  })

  it('marks an affordable card as the one to press', () => {
    const yes = mountCard({ affordable: true })
    const no = mountCard({ affordable: false, coinsShort: 120 })

    expect(yes.find('.shoe-card').classes()).toContain('is-affordable')
    expect(no.find('.shoe-card').classes()).not.toContain('is-affordable')
    expect(yes.find('.shoe-card__tag').classes(), 'the price chip does not invite the press')
      .toContain('is-ready')
  })

  it('says what the player owns, and what they are wearing', () => {
    expect(mountCard({ owned: true }).find('.shoe-card__tags').text())
      .toContain(tr('locker.wear'))
    expect(mountCard({ owned: true, equipped: true }).find('.shoe-card__tags').text())
      .toContain(tr('locker.worn'))
  })

  it('never renders an empty tag row', () => {
    // A row that collapses to zero height is the same failure as no row at all,
    // and it is the one a `v-if` chain regresses into first.
    const cases: CardProps[] = [
      {}, { owned: true }, { owned: true, equipped: true },
      { starLocked: true, affordable: false }, { affordable: false }
    ]
    for (const props of cases) {
      const wrapper = mountCard(props)
      expect(wrapper.findAll('.shoe-card__tag').length, JSON.stringify(props))
        .toBeGreaterThan(0)
    }
  })
})

describe('MovieIcon unlock', () => {
  it('is not rendered when no rewarded ad can be filled', () => {
    const wrapper = mountCard({ adReady: false, affordable: false, coinsShort: 120 })
    expect(filmButton(wrapper), 'an offer was shown that cannot be filled').toBeUndefined()
  })

  it('is offered on a shoe the player cannot afford', async () => {
    const wrapper = mountCard({ adReady: true, affordable: false, coinsShort: 120 })
    const btn = filmButton(wrapper)
    expect(btn, 'no film button on an unaffordable shoe with a video ready').toBeTruthy()

    await btn!.trigger('click')
    expect(wrapper.emitted('ad-unlock')).toHaveLength(1)
    // The same `.stop` contract as Buy: watching a video must not fold the card.
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('is NOT offered on a star-locked shoe — ads buy coins, not progress', () => {
    const wrapper = mountCard({ adReady: true, starLocked: true, affordable: false, starsShort: 4 })
    expect(filmButton(wrapper)).toBeUndefined()
  })

  it('is NOT offered on a shoe the player can already afford, or already owns', () => {
    expect(filmButton(mountCard({ adReady: true, affordable: true }))).toBeUndefined()
    expect(filmButton(mountCard({ adReady: true, owned: true }))).toBeUndefined()
  })

  it("goes dead while another shoe's video is in flight", async () => {
    const wrapper = mountCard({ adReady: true, affordable: false, coinsShort: 120, adBusy: true })
    const btn = filmButton(wrapper)!
    expect(btn.attributes('disabled')).toBeDefined()

    await btn.trigger('click')
    expect(wrapper.emitted('ad-unlock')).toBeUndefined()
  })

  it('carries an accessible name — a glyph has none of its own', () => {
    const wrapper = mountCard({ adReady: true, affordable: false, coinsShort: 120 })
    expect(filmButton(wrapper)!.attributes('aria-label')).toBe(tr('locker.adUnlock'))
  })

  it('wears the film strip, not the camcorder', () => {
    // `video` marks the result screen's ×3 claim; `movie` marks the offer to
    // WATCH one. Two glyphs on two sides of the same transaction, and swapping
    // them teaches a child the wrong thing about both screens.
    const wrapper = mountCard({ adReady: true, affordable: false, coinsShort: 120 })
    const d = filmButton(wrapper)!.find('svg path').attributes('d')!
    // One slab plus six sprocket holes: the film strip and nothing else. The
    // camcorder is two sub-paths.
    expect(d.match(/M/g)!.length).toBe(7)
  })
})

describe('accessibility of the tag row', () => {
  it('names the numbers for a screen reader instead of reading "350"', () => {
    const wrapper = mountCard({ affordable: false, coinsShort: 120 })
    const sr = wrapper.find('.shoe-card__tag .sr-only')
    expect(sr.exists(), 'the price chip has no screen-reader wording').toBe(true)
    expect(sr.text()).toBe(tr('locker.price', 350))
    // …and the bare number is hidden, so it is not announced a second time.
    expect(wrapper.find('.shoe-card__tag-text').attributes('aria-hidden')).toBe('true')
  })

  it('names the star gate too', () => {
    const wrapper = mountCard({ starLocked: true, affordable: false, starsShort: 4 })
    const texts = wrapper.findAll('.shoe-card__tag .sr-only').map((n) => n.text())
    expect(texts).toContain(tr('locker.starGate', SPEC.starGate))
  })
})

// A guard rather than a behaviour: the card is drawn on a 320px phone, and a
// fixed-px chip would drift out of scale with the canvas above it (which is
// already sized from `vmin`). Asserted against the source because jsdom has no
// layout engine to measure.
describe('the tag row stays fluid', () => {
  it('sizes nothing in fixed pixels', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(
      resolve(__dirname, '../..', 'src/components/game/ShoeCard.vue'), 'utf8'
    )
    const style = src.slice(src.indexOf('<style'))
    const block = style.slice(style.indexOf('.shoe-card__tags'), style.indexOf('.shoe-card__body'))

    expect(block).toContain('clamp(')
    // 2px borders and the text shadow are the material the whole game is cut
    // from and are shared by every chip in it; a px SIZE is the thing that
    // breaks the phone. `min-`/`max-` prefixed properties are excluded by the
    // leading `[^-]`, which is why it is there.
    expect(block, 'a fixed px width/height crept into the tag row')
      .not.toMatch(/(?:^|[^-])\b(?:width|height|font-size|padding|gap):[^\n]*\d+px/)
  })
})

// If `mount` silently rendered nothing, every `toBeUndefined()` above would
// pass for the wrong reason.
describe('the harness is not vacuous', () => {
  it('renders a card with a name and a canvas', () => {
    const wrapper = mountCard()
    expect(wrapper.find('.shoe-card__name').text()).toBe(tr('shoes.steelBoot.name'))
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('was not silently swallowing a render warning', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mountCard({ open: true, adReady: true, affordable: false, coinsShort: 120 })
    const vueWarns = spy.mock.calls.filter((c) => String(c[0]).includes('[Vue warn]'))
    spy.mockRestore()
    expect(vueWarns).toEqual([])
  })
})
