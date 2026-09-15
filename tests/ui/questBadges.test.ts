import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createI18n } from 'vue-i18n'
import en from '@/i18n/locales/en'
import { LANGUAGES } from '@/utils/enums'
import { emptyTally, type Objective, type ObjectiveTriple, type RunTally } from '@/game/stars'
import { ICON_PATHS } from '@/components/icons/iconPaths'

/**
 * ─── The two quest badges, during play ──────────────────────────────────────
 *
 * The badges say three things without words: how far along, whether the star is
 * currently yours, and whether it is gone for good. Each of those has a way of
 * being quietly wrong that a screenshot does not catch.
 *
 * The one that matters most: `meets()` and `progress01()` both gate every
 * non-`clear` objective on `tally.cleared`, which is FALSE for the whole run.
 * Graded naively, every badge would read as failed from the first frame and the
 * feature would look finished while showing nothing true.
 */

// jsdom has no image pipeline; `GameIcon` probes the art layer on mount, so the
// probe is stubbed exactly as `paintedGlyphs.test.ts` stubs it. Both arms are
// exercised below — the painted one is the layout trap.
const spriteFor = vi.fn<(kind: string, id: string) => HTMLImageElement | null>(() => null)
vi.mock('@/game/art', () => ({
  spriteFor: (kind: string, id: string) => spriteFor(kind, id),
  onArtChanged: () => () => {}
}))

const QuestBadges = (await import('@/components/game/QuestBadges.vue')).default

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '../..', rel), 'utf8').replace(/\r\n/g, '\n')

/** A component's `<style>` block with its `//` comments stripped, so a rule the
 *  prose merely WARNS about is not mistaken for a rule the file applies. */
const styleOf = (rel: string): string => {
  const src = read(rel)
  const body = src.slice(src.indexOf('<style'), src.lastIndexOf('</style>'))
  return body.split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n')
}

/**
 * One indented SASS block, by selector.
 *
 * One block at a time on purpose: a `[\\s\\S]` window walks straight out of the
 * rule it is reading and finds a declaration several selectors further down the
 * file, which is how a style test passes while asserting nothing.
 */
const blockOf = (css: string, selector: string): string => {
  const at = css.indexOf(`\n${selector}\n`)
  if (at < 0) return ''
  const rest = css.slice(at + selector.length + 2).split('\n')
  const end = rest.findIndex((l) => l.trim() !== '' && !/^[ \t]/.test(l))
  return rest.slice(0, end < 0 ? rest.length : end).join('\n')
}

const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } })

const tally = (o: Partial<RunTally> = {}): RunTally => ({ ...emptyTally(), ...o })

const triple = (a: Objective, b: Objective): ObjectiveTriple =>
  [{ kind: 'clear' }, a, b] as ObjectiveTriple

interface MountOpts {
  objectives: ObjectiveTriple
  tally: RunTally
  quota?: number
  score?: number
  timeLeft?: number
  spotlight?: boolean
}

const render = (opts: MountOpts) => mount(QuestBadges, {
  props: { quota: 10, ...opts },
  global: { plugins: [i18n] }
})

const badges = (w: ReturnType<typeof render>) => w.findAll('.quests__badge')

/** How full the star is, 0..100. Published on the badge as `data-fill` so a
 *  test reads the same number the clip is built from. */
const fillOf = (w: ReturnType<typeof render>, i: number): number =>
  Number(badges(w)[i].attributes('data-fill'))

/** The gold star's clip, as the browser gets it. */
const clipOf = (w: ReturnType<typeof render>, i: number): string =>
  (badges(w)[i].find('.quests__fill').attributes('style') ?? '').replace(/\s/g, '')

beforeEach(() => {
  spriteFor.mockReset()
  spriteFor.mockReturnValue(null)
})

describe('which objectives get a badge', () => {
  it('shows the two that are worth watching and drops the clear', () => {
    // The rail across the top of the HUD has been counting the clear out the
    // whole time; a third badge repeating it turns two marks into a checklist,
    // which is the thing `ObjectiveList`'s header argues against.
    const w = render({
      objectives: triple({ kind: 'combo', n: 3 }, { kind: 'noMiss', n: 12 }),
      tally: tally()
    })
    expect(badges(w)).toHaveLength(2)
    for (const b of badges(w)) {
      expect(b.attributes('aria-label')).not.toContain(en.objectives.clear)
    }
  })

  it('uses the same glyph per objective kind as the objective strip', () => {
    // One idea, one mark, everywhere in the game — the level banner, the badge
    // and the result screen. Asserted against `ObjectiveList`'s own table so the
    // two cannot drift apart silently.
    const tableOf = (src: string): string => {
      const start = src.indexOf('ICON: Record<')
      expect(start, 'no ICON map found').toBeGreaterThan(-1)
      return src.slice(start, src.indexOf('}', start)).replace(/\s+/g, '')
    }
    expect(tableOf(read('src/components/game/QuestBadges.vue')))
      .toBe(tableOf(read('src/components/game/ObjectiveList.vue')))
  })
})

describe('the star fills with the live tally', () => {
  it('rises as the counter climbs', () => {
    const objectives = triple({ kind: 'combo', n: 8 }, { kind: 'score', n: 1000 })
    const empty = fillOf(render({ objectives, tally: tally() }), 0)
    const part = fillOf(render({ objectives, tally: tally({ bestCombo: 4 }) }), 0)
    const full = fillOf(render({ objectives, tally: tally({ bestCombo: 8 }) }), 0)
    expect(empty).toBe(0)
    expect(part).toBeGreaterThan(empty)
    expect(full).toBeGreaterThan(part)
    expect(full).toBe(100)
  })

  it('clips the gold star from the TOP, so it fills from the bottom up', () => {
    // `inset()` percentages resolve against the layer's own border box and the
    // layer fills the badge, so one number is correct at every viewport. A
    // half-met objective must hide the TOP half: clipped the other way round,
    // the star drains away as the player succeeds.
    const objectives = triple({ kind: 'combo', n: 8 }, { kind: 'combo', n: 4 })
    const half = render({ objectives, tally: tally({ bestCombo: 4 }) })
    expect(clipOf(half, 0)).toContain('inset(50.00%000)')
    expect(clipOf(half, 1)).toContain('inset(0.00%000)')
    expect(clipOf(render({ objectives, tally: tally() }), 0)).toContain('inset(100.00%000)')
  })

  it('reads the LIVE score, which the tally does not carry until the level ends', () => {
    // `finish()` is the only writer of `tally.score`. A badge reading the tally
    // mid-run would sit at zero all level and then jump on the result screen.
    const objectives = triple({ kind: 'combo', n: 8 }, { kind: 'score', n: 1000 })
    const stale = fillOf(render({ objectives, tally: tally() }), 1)
    const live = fillOf(render({ objectives, tally: tally(), score: 500 }), 1)
    expect(live).toBeGreaterThan(stale)
    expect(live).toBeLessThan(100)
  })

  it('empties the star on an objective that is gone', () => {
    const w = render({
      objectives: triple({ kind: 'noMiss', n: 12 }, { kind: 'combo', n: 3 }),
      tally: tally({ misses: 13, bestCombo: 1 })
    })
    expect(fillOf(w, 0)).toBe(0)
  })
})

describe('the badge says GOAL before it says which goal', () => {
  it('is drawn as the game own star, not a disc', () => {
    // The whole point of the rewrite: two glyphs in two roundels read as two
    // anonymous HUD widgets, and a first-time player has no reason to look at
    // them twice. A star is this game's universal mark for "a thing you can
    // earn" — the level card, the rail, the result screen and the world map all
    // already use it, so the badge wears it too.
    const w = render({
      objectives: triple({ kind: 'combo', n: 3 }, { kind: 'noSpike' }),
      tally: tally()
    })
    const star = ICON_PATHS.star.join('')
    expect(badges(w)).toHaveLength(2)
    for (const b of badges(w)) {
      expect(b.find('.quests__plate path').attributes('d')).toBe(star)
      expect(b.find('.quests__fill path').attributes('d')).toBe(star)
    }
  })

  it('never paints a disc behind the star', () => {
    // A `background-color` on a `border-radius: 999px` box is the roundel this
    // component was rewritten to stop being, and it would hide the silhouette
    // that does all the teaching.
    const block = blockOf(styleOf('src/components/game/QuestBadges.vue'), '.quests__badge')
    expect(block, 'no .quests__badge rule found — this test was asserting nothing').not.toBe('')
    expect(block, 'the badge must not be a disc').not.toMatch(/background/)
    expect(block).not.toMatch(/border-radius/)
  })

  it('keeps the glyph inside the star well, so two silhouettes never merge', () => {
    // Measured, not guessed. `ICON_PATHS.star`'s concave vertices sit 4.73 units
    // from the centre of the 17.9-unit box the badge crops it to, so the well is
    // 52.8 % of the badge. A glyph wider than that crosses the arms — and half
    // the glyph table is itself radial (`splat` is a starburst, `target` a set
    // of rings), which at 22 px turns the badge into one illegible blob. That is
    // a real screenshot of a real intermediate version, not a hypothetical.
    const block = blockOf(styleOf('src/components/game/QuestBadges.vue'), '.quests__glyph')
    const pct = Number(/width:\s*([\d.]+)%/.exec(block)?.[1])
    expect(pct).toBeGreaterThan(0)
    expect(pct).toBeLessThan((2 * 4.73 / 17.9) * 100)
  })
})

describe('the far end of the lesson that explains these', () => {
  it('marks every badge while the arrow is travelling, and never otherwise', () => {
    const objectives = triple({ kind: 'combo', n: 3 }, { kind: 'noSpike' })
    const quiet = render({ objectives, tally: tally() })
    for (const b of badges(quiet)) expect(b.classes()).not.toContain('is-spotlit')
    const lit = render({ objectives, tally: tally(), spotlight: true })
    for (const b of badges(lit)) expect(b.classes()).toContain('is-spotlit')
  })

  it('brightens without moving for a player who asked for less motion', () => {
    // Reduced motion is a request for less movement, not for less teaching: the
    // pulse goes and the glow stays, so the pair is still the loudest thing in
    // the corner when the arrow lands on it.
    const css = styleOf('src/components/game/QuestBadges.vue')
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion'))
    expect(reduced).toMatch(/\.is-spotlit/)
    expect(reduced, 'the glow has to survive the pulse being switched off')
      .toMatch(/\.is-spotlit[\s\S]{0,240}drop-shadow/)
  })
})

describe('met, mid-run, on a level nobody has cleared yet', () => {
  it('lights an objective whose own condition already holds', () => {
    // The trap: `meets()` returns false for ALL of these while `cleared` is
    // false, which it is for the entire run.
    const w = render({
      objectives: triple({ kind: 'combo', n: 3 }, { kind: 'fever', n: 2 }),
      tally: tally({ cleared: false, bestCombo: 5, fevers: 0 })
    })
    expect(badges(w)[0].classes()).toContain('is-met')
    expect(badges(w)[1].classes()).not.toContain('is-met')
  })

  it('treats an unspent budget as held rather than as not-yet-started', () => {
    // `progress01` shows the avoid-objectives FULL until they are broken, and
    // the badge follows: "you still have this star", not "0% of a threat meter".
    const w = render({
      objectives: triple({ kind: 'noSpike' }, { kind: 'noMiss', n: 12 }),
      tally: tally({ spikes: 0, misses: 3 })
    })
    expect(badges(w)[0].classes()).toContain('is-met')
    expect(badges(w)[1].classes()).toContain('is-met')
  })
})

describe('lost, and said so while it still means something', () => {
  it.each([
    ['a spent miss budget', { kind: 'noMiss', n: 12 } as Objective, tally({ misses: 13 })],
    ['a spike taken', { kind: 'noSpike' } as Objective, tally({ spikes: 1 })],
    ['a clock below the mark', { kind: 'time', n: 20 } as Objective, tally({ timeLeft: 11 })]
  ])('marks %s as gone', (_name, objective, t) => {
    const w = render({ objectives: triple(objective, { kind: 'combo', n: 3 }), tally: t })
    const first = badges(w)[0]
    expect(first.classes()).toContain('is-lost')
    expect(first.classes()).not.toContain('is-met')
    // A strike as well as a colour: which of two dim discs is the sad one is
    // not a question a colour-blind player should have to answer from hue.
    expect(first.find('.quests__cross').exists()).toBe(true)
  })

  it.each([
    ['a counter still climbing', { kind: 'combo', n: 8 } as Objective, tally({ bestCombo: 2 })],
    ['accuracy, which clean stomps pull back up', { kind: 'accuracy', n: 80 } as Objective, tally({ hits: 2, misses: 8 })]
  ])('never writes off %s', (_name, objective, t) => {
    const w = render({ objectives: triple(objective, { kind: 'combo', n: 3 }), tally: t })
    expect(badges(w)[0].classes()).not.toContain('is-lost')
  })

  it('does not read a clock objective as lost on frame one', () => {
    // `tally.timeLeft` is 0 for the whole run — it is only written when the
    // level ends. Compared naively against the target, every `time` badge in
    // the game would be struck through before the player had moved.
    const w = render({
      objectives: triple({ kind: 'time', n: 20 }, { kind: 'combo', n: 3 }),
      tally: tally({ timeLeft: 0 })
    })
    expect(badges(w)[0].classes()).not.toContain('is-lost')
  })

  it('follows the live clock down past the mark', () => {
    const objectives = triple({ kind: 'time', n: 20 }, { kind: 'combo', n: 3 })
    const early = render({ objectives, tally: tally(), timeLeft: 40 })
    const late = render({ objectives, tally: tally(), timeLeft: 9 })
    expect(badges(early)[0].classes()).toContain('is-met')
    expect(badges(late)[0].classes()).toContain('is-lost')
  })
})

describe('an icon-only mark still has to say what it is', () => {
  it('names every badge with the objective wording plus its state', () => {
    const w = render({
      objectives: triple({ kind: 'combo', n: 8 }, { kind: 'noMiss', n: 12 }),
      tally: tally({ bestCombo: 2, misses: 1 })
    })
    const labels = badges(w).map((b) => b.attributes('aria-label') ?? '')
    expect(labels[0]).toBe('Reach a ×8 chain — 25% there')
    expect(labels[1]).toBe('Miss no more than 12 stomps — on track')
    // Never a raw key: a missing message renders as the path and reads aloud
    // as "objectives dot combo".
    for (const l of labels) expect(l).not.toMatch(/objectives\.|quests\./)
  })

  it('resolves a bug kind to the bug\'s own translated name', () => {
    const w = render({
      objectives: triple({ kind: 'kind', id: 'beetle', n: 3 }, { kind: 'combo', n: 3 }),
      tally: tally({ byKind: { beetle: 1 } })
    })
    const label = badges(w)[0].attributes('aria-label') ?? ''
    expect(label).toContain(en.bugs.beetle)
    expect(label).not.toContain('bugs.beetle')
  })

  it('says a lost star is lost', () => {
    const w = render({
      objectives: triple({ kind: 'noSpike' }, { kind: 'combo', n: 3 }),
      tally: tally({ spikes: 2 })
    })
    expect(badges(w)[0].attributes('aria-label')).toBe('Take no spike damage — missed')
  })

  it('is an image with a name, not an unnamed list item', () => {
    const w = render({
      objectives: triple({ kind: 'combo', n: 3 }, { kind: 'noSpike' }),
      tally: tally()
    })
    for (const b of badges(w)) {
      expect(b.attributes('role')).toBe('img')
      expect(b.attributes('aria-label')).toBeTruthy()
    }
  })
})

describe('the painted art layer cannot blow the badge open', () => {
  it('renders the glyph inside a sized wrapper whichever element it is', () => {
    // `GameIcon` has THREE rungs, and the box has to hold all of them. The
    // vector is an `<svg>`; a painting of an OBJECT is an `<img>`; a painting of
    // a MARK — a glyph whose colour is state, see `TINTED_GLYPHS` — is a `<span>`
    // masked to the painting and filled with `currentColor`. A `:deep(svg)` size
    // rule misses the last two, which then land at their intrinsic 128 px; that
    // is the live bug this component was warned about.
    //
    // `combo` is drawn with `splat` (an object) and `noSpike` with `shield` (a
    // mark), so this pair exercises both painted rungs at once.
    const objectives = triple({ kind: 'combo', n: 3 }, { kind: 'noSpike' })
    const drawn = render({ objectives, tally: tally() })
    expect(drawn.findAll('.quests__glyph svg.game-icon')).toHaveLength(2)

    const img = document.createElement('img')
    Object.defineProperty(img, 'src', { value: 'images/ui/icon-splat.webp', writable: false })
    spriteFor.mockReturnValue(img)
    const painted = render({ objectives, tally: tally() })
    expect(painted.findAll('.quests__glyph .game-icon')).toHaveLength(2)
    expect(painted.findAll('.quests__glyph svg.game-icon')).toHaveLength(0)
    // The object keeps its colours; the mark is masked so the badge can dim it.
    expect(painted.findAll('.quests__glyph img.game-icon')).toHaveLength(1)
    expect(painted.findAll('.quests__glyph span.game-icon.is-tinted')).toHaveLength(1)
  })

  it('sizes the wrapper element and never the glyph element', () => {
    const css = styleOf('src/components/game/QuestBadges.vue')
    expect(css, 'a :deep(svg) size rule would miss the painted <img>')
      .not.toMatch(/:deep\(/)
    expect(css).toMatch(/\.quests__glyph[\s\S]{0,200}width:/)
    expect(css).toMatch(/\.quests__glyph[\s\S]{0,200}height:/)
  })
})

describe('it is information, not a control', () => {
  it('declares pointer-events: none so nothing steals a press from the chest', () => {
    expect(styleOf('src/components/game/QuestBadges.vue'))
      .toMatch(/\.quests\n(?:\s+[^\n]*\n)*?\s+pointer-events: none/)
  })

  it('renders the slot as a SIBLING of the chest, inside its column', async () => {
    // The wiring itself: `GameScene` puts the badges in the chest's `under`
    // slot so they are mounted, hidden and moved as one thing with it.
    const TreasureChest = (await import('@/components/organisms/TreasureChest.vue')).default
    const w = mount(TreasureChest, {
      global: { plugins: [i18n] },
      slots: { under: '<b class="passenger">x</b>' }
    })
    const col = w.find('.chest-col')
    expect(col.exists()).toBe(true)
    const passenger = w.find('.passenger')
    expect(passenger.exists()).toBe(true)
    expect(passenger.element.parentElement).toBe(col.element)
    expect(w.find('.chest').element.contains(passenger.element)).toBe(false)
  })

  it('hangs the badges OUTSIDE the chest button', () => {
    // Inside the `<button>` they would join its hit area and its accessible
    // name, and the chest is the one control in this corner of the HUD.
    const src = read('src/components/organisms/TreasureChest.vue')
    const slot = src.indexOf('slot(name="under")')
    const button = src.indexOf('button.chest(')
    expect(slot).toBeGreaterThan(button)
    const indentOf = (i: number): number => {
      const line = src.slice(src.lastIndexOf('\n', i) + 1, src.indexOf('\n', i))
      return line.length - line.trimStart().length
    }
    expect(indentOf(slot), 'the slot is nested inside the button').toBe(indentOf(button))
  })

  it('leaves the chest its own box, which the tutorial pointer aims at', () => {
    // `GameScene` aims the `chest` lesson with `elCentre('.chest', …)`. The
    // column wrapper must not take the width over and move that centre.
    // One indented block at a time: `\s` would walk out of the rule it is
    // reading and find a `width:` several selectors further down the file.
    const block = (css: string, selector: string): string => {
      const at = css.indexOf(`\n${selector}\n`)
      if (at < 0) return ''
      const rest = css.slice(at + selector.length + 2).split('\n')
      const end = rest.findIndex((l) => l.trim() !== '' && !/^[ \t]/.test(l))
      return rest.slice(0, end < 0 ? rest.length : end).join('\n')
    }
    const css = styleOf('src/components/organisms/TreasureChest.vue')
    expect(block(css, '.chest')).toMatch(/^ {2}width: clamp\(/m)
    expect(block(css, '.chest-col'), 'the wrapper must not state a width of its own')
      .not.toMatch(/^ {2}width:/m)
  })
})

describe('the badge copy ships in every language', () => {
  const KEYS = ['onTrack', 'progress', 'missed'] as const

  it.each(LANGUAGES)('%s names the pair', async (code) => {
    // The group name is the screen-reader half of the star each badge is drawn
    // on: a sighted player is told these are goals by the shape, and this is the
    // same sentence for somebody who cannot see it.
    const mod = await import(`../../src/i18n/locales/${code}.ts`)
    const title = (mod.default.quests as Record<string, string> | undefined)?.title
    expect(typeof title, `${code}.quests.title`).toBe('string')
    expect(title!.trim().length, `${code}.quests.title is empty`).toBeGreaterThan(0)
    if (code !== 'en') {
      expect(title, `${code}.quests.title was never translated`).not.toBe(en.quests.title)
    }
  })

  it('hangs that name on the list itself, not on a badge', async () => {
    const w = render({
      objectives: triple({ kind: 'combo', n: 3 }, { kind: 'noSpike' }),
      tally: tally()
    })
    expect(w.find('.quests').attributes('aria-label')).toBe(en.quests.title)
  })

  it.each(LANGUAGES)('%s carries every quests key', async (code) => {
    const mod = await import(`../../src/i18n/locales/${code}.ts`)
    const quests = mod.default.quests as Record<string, string> | undefined
    expect(quests, `${code} has no quests block`).toBeTruthy()
    for (const k of KEYS) {
      expect(typeof quests?.[k], `${code}.quests.${k}`).toBe('string')
      expect(quests?.[k], `${code}.quests.${k} dropped {objective}`).toContain('{objective}')
    }
    expect(quests?.progress, `${code}.quests.progress dropped {n}`).toContain('{n}')
  })

  it('renders a complete sentence in a language that is not English', async () => {
    const de = (await import('@/i18n/locales/de')).default
    const t = createI18n({ legacy: false, locale: 'de', messages: { de } }).global.t
    expect(t('quests.progress', { objective: t('objectives.combo', { n: 8 }), n: 25 }))
      .toBe('×8-Kette erreichen — 25% geschafft')
  })
})
