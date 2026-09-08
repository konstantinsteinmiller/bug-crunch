import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ICON_PATHS } from '@/components/icons/iconPaths'
import { GAME_ICON_NAMES } from '@/components/icons/iconNames'
import { ICON_LABEL_KEYS } from '@/components/icons/iconLabels'
import { ART_CATALOGUE } from '@/game/artCatalogue'
import { UI_ICON_GLYPH, drawnUiMark } from '@/game/uiArt'
import en from '@/i18n/locales/en'

/**
 * ─── One control, one drawing ───────────────────────────────────────────────
 *
 * The upgrade shop and the idle treasure chest both used to wear `ui/chest`,
 * for the good reason that there was only one of them: the chest WAS the shop
 * button. Now they are on screen at the same time — the chest fills with real
 * time on the wallet column and pays coins, the forge opens the upgrade modal
 * from the bottom bar — and a player who taps the wrong one learns that the
 * drawing does not mean anything.
 *
 * jsdom has no canvas, so what the forge LOOKS like cannot be asserted here;
 * what can is that the two marks stayed apart, that both shop buttons kept the
 * same one, and that every rung of the fallback ladder under them exists.
 */

const read = (rel: string): string =>
  readFileSync(resolve(__dirname, '../..', rel), 'utf8')

describe('the shop wears the forge and the chest wears the chest', () => {
  it('paints them as two separate ids', () => {
    expect(ART_CATALOGUE.ui).toContain('chest')
    expect(ART_CATALOGUE.ui).toContain('forge')
  })

  it('gives both shop buttons — HUD and result screen — the same mark', () => {
    const scene = read('src/views/GameScene.vue')
    const marks = [...scene.matchAll(/\bart="([a-z-]+)"/g)].map((m) => m[1])
    expect(marks.length).toBe(2)
    expect(new Set(marks)).toEqual(new Set(['forge']))
    // …and neither of them is still the chest.
    expect(scene).not.toContain('art="chest"')
  })

  it('leaves the chest art to the chest, which asks for it directly', () => {
    const chest = read('src/components/organisms/TreasureChest.vue')
    expect(chest).toContain("useArtImage('ui', 'chest')")
  })
})

describe('the fallback ladder under the forge', () => {
  it('has a drawing keyed the way the painting is', () => {
    // jsdom cannot encode a canvas, so the drawing degrades to `null` rather
    // than throwing — which is exactly the path the glyph exists for.
    expect(() => drawnUiMark('forge')).not.toThrow()
    expect(drawnUiMark('nothing-here')).toBeNull()
  })

  it('has a glyph under the drawing, in the closed set and with real geometry', () => {
    expect(UI_ICON_GLYPH.forge).toBe('anvil')
    expect(GAME_ICON_NAMES).toContain('anvil')
    const d = ICON_PATHS.anvil.join('')
    expect(d.length).toBeGreaterThan(100)
    // Every sub-path closed, so the fill cannot bleed into its neighbour.
    for (const sub of ICON_PATHS.anvil) expect(sub.trimEnd().endsWith('Z')).toBe(true)
  })

  it('names both marks for a screen reader, and names them differently', () => {
    expect(ICON_LABEL_KEYS.anvil).toBe('upgrades.title')
    expect(ICON_LABEL_KEYS.chest).toBe('chest.label')
    expect(en.upgrades.title).toBeTruthy()
    expect(en.chest.label).toBeTruthy()
    expect(en.chest.label).not.toBe(en.upgrades.title)
  })

  it('announces the chest by STATE, since the number under it is announced as nothing', () => {
    for (const key of ['ready', 'filling', 'spent'] as const) {
      expect(en.chest[key], key).toBeTruthy()
    }
    expect(en.chest.ready).toContain('{n}')
  })
})
