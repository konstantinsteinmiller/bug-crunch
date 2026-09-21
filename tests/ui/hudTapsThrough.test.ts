import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createI18n } from 'vue-i18n'
import en from '@/i18n/locales/en'
import { emptyTally, type ObjectiveTriple } from '@/game/stars'

/**
 * ─── The HUD may not eat a stomp, and may not pretend to be a button ────────
 *
 * Four rules, all of them found the same way: a child played the game and the
 * interface took something from them.
 *
 *   · a body that walks behind the coin column or the vial is still stompable —
 *     a readout that swallows the tap aimed past it is the one kind of miss a
 *     player is right to call unfair;
 *   · the flame beside the vial is a lamp, not a control. It stopped being
 *     pressable when Fever started firing itself, and two testers tapped it
 *     anyway, because it still had a button's round plate;
 *   · an objective that asks for a SPECIES shows that species. "Squish 2 Piñata
 *     Flies" wore the same glyph as "Clear the level", and a tester cleared the
 *     level having never knowingly seen one.
 */

// jsdom has no image pipeline; `GameIcon` probes the art layer on mount.
vi.mock('@/game/art', () => ({
  spriteFor: () => null,
  onArtChanged: () => () => {}
}))

const ObjectiveList = (await import('@/components/game/ObjectiveList.vue')).default

const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } })

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '../..', rel), 'utf8').replace(/\r\n/g, '\n')

/** A component's `<style>` block with its `//` comments stripped, so a rule the
 *  prose merely WARNS about is not mistaken for a rule the file applies. */
const styleOf = (rel: string): string => {
  const src = read(rel)
  const body = src.slice(src.indexOf('<style'), src.lastIndexOf('</style>'))
  return body.split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n')
}

/** One indented SASS block, by selector — never a window that walks past it. */
const blockOf = (css: string, selector: string): string => {
  const at = css.indexOf(`\n${selector}\n`)
  if (at < 0) return ''
  const rest = css.slice(at + selector.length + 2).split('\n')
  const end = rest.findIndex((l) => l.trim() !== '' && !/^[ \t]/.test(l))
  return rest.slice(0, end < 0 ? rest.length : end).join('\n')
}

const mountList = (objectives: ObjectiveTriple) =>
  mount(ObjectiveList, {
    props: { objectives, tally: emptyTally(), quota: 20, met: [false, false, false] as const },
    global: { plugins: [i18n] }
  })

describe('an objective that names a species', () => {
  const withSpecies: ObjectiveTriple = [
    { kind: 'clear' },
    { kind: 'kind', id: 'pinatafly', n: 2 },
    { kind: 'combo', n: 12 }
  ]

  it('draws the creature, not the generic bug glyph', () => {
    const wrapper = mountList(withSpecies)
    expect(wrapper.findAll('canvas.objectives__face')).toHaveLength(1)
  })

  it('still names it in words, for whoever can read them', () => {
    const wrapper = mountList(withSpecies)
    expect(wrapper.text()).toContain('Piñata')
  })

  it('leaves every other row on its shared glyph', () => {
    const wrapper = mountList([{ kind: 'clear' }, { kind: 'combo', n: 4 }, { kind: 'noSpike' }])
    expect(wrapper.findAll('canvas.objectives__face')).toHaveLength(0)
    expect(wrapper.findAll('.objectives__icon').length).toBeGreaterThan(0)
  })
})

describe('the readouts over the board', () => {
  it('the vial lets a tap through to the bug behind it', () => {
    const block = blockOf(styleOf('src/components/game/JuiceVial.vue'), '.vial')
    expect(block).toContain('pointer-events: none')
  })

  it('the coin column lets a tap through to the bug behind it', () => {
    const block = blockOf(styleOf('src/views/GameScene.vue'), '.scene__wallet')
    expect(block).toContain('pointer-events: none')
  })

  it('the chest inside that column is still pressable', () => {
    const block = blockOf(styleOf('src/components/organisms/TreasureChest.vue'), '.chest')
    expect(block).toContain('pointer-events: auto')
  })
})

describe('the flame beside the vial', () => {
  const src = read('src/components/game/JuiceVial.vue')

  it('is not a button, and has none', () => {
    expect(src).not.toContain('<button')
    expect(src).not.toContain('button.vial')
  })

  it('wears no button plate — no border, no radius, no fill', () => {
    const block = blockOf(styleOf('src/components/game/JuiceVial.vue'), '.vial__flame')
    expect(block).not.toContain('border:')
    expect(block).not.toContain('border-radius')
    expect(block).not.toContain('background-image')
  })
})
