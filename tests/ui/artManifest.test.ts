import { describe, expect, it } from 'vitest'
import {
  ALL_SHEETS, GRIDS, STILLS, WALKS, promptDocs, sheetRows, type StillSpec
} from '@/game/artSheet'
import {
  ART_BRAND, ART_CATALOGUE, UI_GLYPH_ART_IDS, UI_HUD_MARKS, UI_MARK_FOR_GLYPH, artIdForGlyph
} from '@/game/artCatalogue'
import { ART_FOLDERS, type ArtKind } from '@/game/art'
import { BUG_IDS } from '@/game/bugs'
import { BUG_FRAMES } from '@/game/bugArt'
import { GAME_ICON_NAMES } from '@/components/icons/iconNames'
import { UI_ICON_GLYPH } from '@/game/uiArt'

/**
 * ─── The manifest and the catalogue are one list ────────────────────────────
 *
 * `artSheet.ts` is the BENCH's manifest: it exports the reference sheets and
 * writes the prompts, and it drags the whole renderer in behind it.
 * `artCatalogue.ts` is the same list for the BOOT PATH, which cannot afford
 * that. Two lists of the same thing drift, and the drift is invisible in both
 * directions:
 *
 *   a slot in the catalogue with no sheet   — the renderer probes for a file
 *                                             nothing can ever paint, and the
 *                                             404 is remembered as "keep
 *                                             drawing it" forever;
 *   a sheet with no slot in the catalogue   — the painting is made, sliced and
 *                                             shipped, and the preloader never
 *                                             asks for it, so it pops in
 *                                             mid-level instead of arriving
 *                                             with the splash.
 *
 * Neither one fails anything at run time. This is the thing that fails.
 */

/** Where the renderer probes for a painting of `(kind, id)`. */
const probePath = (kind: ArtKind, id: string): string => `${ART_FOLDERS[kind]}/${id}.webp`

/** Every still keyed by `kind/id`. */
const stillBy = new Map(STILLS.map((s) => [`${s.kind}/${s.id}`, s]))

describe('the catalogue and the manifest', () => {
  it('give every catalogued id a sheet to be painted from', () => {
    const missing: string[] = []
    for (const [kind, ids] of Object.entries(ART_CATALOGUE)) {
      for (const id of ids) if (!stillBy.has(`${kind}/${id}`)) missing.push(`${kind}/${id}`)
    }
    expect(missing).toEqual([])
  })

  it('point each of them at the file the renderer actually probes', () => {
    for (const [kind, ids] of Object.entries(ART_CATALOGUE)) {
      for (const id of ids) {
        const s = stillBy.get(`${kind}/${id}`)!
        expect(`${kind}/${id} → ${s.target}`)
          .toBe(`${kind}/${id} → ${probePath(kind as ArtKind, id)}`)
      }
    }
  })

  it('catalogue every sheet that IS probed at run time', () => {
    // The other direction. A still whose target is the probe path for its own
    // kind and id is, by definition, something `spriteFor` can ask for — so it
    // belongs in the list the preloader reads. The exceptions are the drawables
    // whose ids come from the game's own data (bugs, shoes, bosses), which the
    // catalogue deliberately leaves out because those modules are already on the
    // boot path, and the BRAND bitmaps, which are read straight off disk.
    const catalogued = new Set(
      Object.entries(ART_CATALOGUE).flatMap(([kind, ids]) => ids.map((id) => `${kind}/${id}`))
    )
    const fromGameData = new Set<ArtKind>(['bug', 'shoe', 'boss'])
    const orphans = STILLS
      .filter((s) => !fromGameData.has(s.kind))
      .filter((s) => s.target === probePath(s.kind, s.id))
      .filter((s) => !catalogued.has(`${s.kind}/${s.id}`))
      .map((s) => `${s.kind}/${s.id}`)
    expect(orphans).toEqual([])
  })

  it('keep the brand bitmaps out of the probe path and in the manifest', () => {
    // The splash is not optional: it must be the same picture on a portal build
    // with the art layer OFF, so neither of these may ever be a probe.
    for (const [name, target] of Object.entries(ART_BRAND)) {
      const s = stillBy.get(`ui/${name}`)
      expect(s, `${name} has no sheet`).toBeDefined()
      expect(s!.target).toBe(target)
      expect(s!.target).not.toBe(probePath('ui', name))
      expect(s!.exact, `${name} is read at a fixed size and must not be capped`).toBe(true)
    }
    const ui = ART_CATALOGUE.ui as readonly string[]
    expect(ui).not.toContain('logo')
    expect(ui).not.toContain('mascot')
  })
})

describe('every glyph the game can show is paintable', () => {
  it('has a slot, whether or not it is also a HUD mark', () => {
    const ids = new Set((ART_CATALOGUE.ui as readonly string[]))
    const unpaintable = GAME_ICON_NAMES.filter((n) => !ids.has(artIdForGlyph(n)))
    expect(unpaintable).toEqual([])
  })

  it('shares one painting with the HUD mark it already is', () => {
    // `UI_MARK_FOR_GLYPH` is the inverse of `uiArt.UI_ICON_GLYPH`, restated on
    // the boot path so `artCatalogue` does not have to import the whole ink-art
    // vocabulary. Restated means it can drift; this is what stops it.
    const inverse = Object.fromEntries(
      Object.entries(UI_ICON_GLYPH).map(([mark, glyph]) => [glyph, mark])
    )
    expect(UI_MARK_FOR_GLYPH).toEqual(inverse)
    // …and the mark it points at is a real slot, not a name that used to be one.
    for (const mark of Object.values(UI_MARK_FOR_GLYPH)) {
      expect(UI_HUD_MARKS as readonly string[]).toContain(mark)
    }
  })

  it('gives the rest an `icon-` slot of their own, and only those', () => {
    const expected = GAME_ICON_NAMES
      .filter((n) => !(n in UI_MARK_FOR_GLYPH))
      .map((n) => `icon-${n}`)
    expect([...UI_GLYPH_ART_IDS]).toEqual(expected)
    // Derived, not typed out: a glyph added to the icon set is paintable the day
    // it exists. If that ever stops being true this count goes stale silently.
    expect(UI_GLYPH_ART_IDS.length).toBe(GAME_ICON_NAMES.length - Object.keys(UI_MARK_FOR_GLYPH).length)
  })
})

describe('the sheets themselves', () => {
  it('cover every bug design at the frame count the slicer assumes', () => {
    expect(WALKS.map((w) => w.id).sort()).toEqual([...BUG_IDS].sort())
    for (const w of WALKS) expect(`${w.id}:${w.frames}`).toBe(`${w.id}:${BUG_FRAMES}`)
  })

  it('give every sheet a unique stem and a target', () => {
    const stems = ALL_SHEETS.map((s) => s.file)
    expect(new Set(stems).size).toBe(stems.length)
    for (const s of ALL_SHEETS) expect(s.target, s.file).toBeTruthy()
  })

  it('are all reachable from `sheetRows()`', () => {
    // The flat list `art:prompts` reports status from and the Art Desk searches.
    // A sheet missing from it is a sheet nothing ever says is unpainted.
    expect(sheetRows().map((r) => r.stem).sort())
      .toEqual([...ALL_SHEETS.map((s) => s.file), ...GRIDS.map((g) => g.file)].sort())
  })
})

/**
 * ─── The contact sheets ─────────────────────────────────────────────────────
 *
 * Nine icons painted in one generation, cut into nine files by arithmetic off a
 * lattice. Everything that can go wrong with that is an OFF-BY-ONE IN THE
 * ORDER: the roster in the prompt says what is in cell five, the index says
 * where cell five's pixels are and what file they become, and if those two ever
 * disagree the game ships a pause button under the name `icon-play` — silently,
 * and looking entirely fine in the folder.
 *
 * So the order is pinned here from both ends.
 */
describe('the contact sheets', () => {
  const square = STILLS.filter((s) => s.kind === 'ui' && s.w === s.h && s.id !== 'logo' && s.id !== 'mascot')
  const onAGrid = GRIDS.flatMap((g) => g.members)
  /** `GRID_MIN` in the manifest: the smallest leftover still worth a sheet. */
  const GRID_MIN_FOR_TEST = 2

  it('paint each square ui slot at most once, and all but a stub of them', () => {
    // The ribbon is the one ui slot that stays alone by kind: it is a 2.3:1
    // banner, and a wide cell on a lattice of squares comes back a square.
    expect(onAGrid.map((m) => m.id)).not.toContain('ribbon')
    // No slot on two sheets — that would paint it twice and ship whichever was
    // cut last.
    expect(new Set(onAGrid).size).toBe(onAGrid.length)
    // Everything on a grid is a real square ui slot…
    const ids = new Set(square.map((s) => s.id))
    for (const m of onAGrid) expect(ids.has(m.id), m.id).toBe(true)
    // …and what is left off is only ever a remainder too small to be a sheet,
    // at most one stub per register. Those keep their single-icon sheet, which
    // every square slot has regardless.
    const left = square.filter((s) => !onAGrid.includes(s))
    expect(left.length).toBeLessThan(2 * GRID_MIN_FOR_TEST)
  })

  it('never mix the two registers on one sheet', () => {
    // A flat white mark and a full-colour object on one grid are two
    // contradictory instructions about one picture.
    for (const g of GRIDS) {
      const registers = new Set(g.members.map((m) => !!m.greyscale))
      expect([...registers], g.id).toHaveLength(1)
      expect([...registers][0], g.id).toBe(g.greyscale)
    }
  })

  it('fill their lattice exactly, with no empty cell', () => {
    // The slicer divides the sheet into `cols * rows` equal cells and cuts every
    // one of them. A lattice with a hole in it cuts magenta into a file.
    for (const g of GRIDS) {
      expect(g.members.length, g.id).toBe(g.cols * g.rows)
      expect(g.members.length, g.id).toBeLessThanOrEqual(9)
    }
  })

  it('send every cell to a target of its own', () => {
    const targets = GRIDS.flatMap((g) => g.members.map((m) => m.target))
    expect(new Set(targets).size).toBe(targets.length)
    for (const t of targets) expect(t).toMatch(/^images\/ui\/.+\.webp$/)
  })

  it('list the cells in the prompt in the order the lattice is cut', () => {
    // The half of the contract that lives in prose. `promptForGrid` numbers the
    // roster from the same array the bench lays the reference out from and the
    // index writes the rects from, and this is what says so.
    const doc = promptDocs()['PROMPTS-GRIDS.md']!
    for (const g of GRIDS) {
      const block = doc.slice(doc.indexOf(`# ${g.id} —`))
      const listed = [...block.slice(0, block.indexOf('THEY ARE A SET'))
        .matchAll(/^ {2}CELL (\d+) — row (\d+), column (\d+) — (.+):$/gm)]
      expect(listed.length, g.id).toBe(g.members.length)
      listed.forEach((m, i) => {
        expect(Number(m[1]), `${g.id} cell order`).toBe(i + 1)
        expect(Number(m[2]), `${g.id} row`).toBe(Math.floor(i / g.cols) + 1)
        expect(Number(m[3]), `${g.id} column`).toBe((i % g.cols) + 1)
        expect(m[4], `${g.id} cell ${i + 1}`).toBe(g.members[i]!.name.replace(/^Icon — /, ''))
      })
    }
  })
})

describe('the prompts carry the rules a return is thrown away for', () => {
  const docs = promptDocs()
  const walks = docs['PROMPTS-WALKS.md']!
  const stills = docs['PROMPTS-STILLS.md']!
  const grids = docs['PROMPTS-GRIDS.md']!

  it('are parseable by the Art Desk', () => {
    // `tools/art-desk/jobs.mjs` reads the reference out of the LAST parenthesis
    // of a `##` heading and the target out of the arrow, then the prompt out of
    // the ```text fence under it. A document without that shape is a document
    // the desk finds no jobs in — silently, with the queue showing nothing to
    // paint, which is exactly how it read before.
    const headings = (doc: string): number =>
      [...doc.matchAll(/^##\s+.*\([^()]*?\.png\s*→\s*[^()]*?\)\s*$/gm)].length
    expect(headings(walks)).toBe(WALKS.length)
    expect(headings(stills)).toBe(STILLS.length)
    expect([...walks.matchAll(/^```text$/gm)].length).toBe(WALKS.length)
    expect([...stills.matchAll(/^```text$/gm)].length).toBe(STILLS.length)

    // A contact sheet's heading carries the reference and NO arrow: it writes a
    // file per cell, and the cells live in `sheet-index.json` where the desk
    // reads them. This is the desk's own regex, whose arrow half is optional —
    // a heading that failed it would leave the sheet unqueueable.
    const deskHeading = /^##\s+(.*?)\s*\(([^()]*?\.(?:png|jpe?g|webp))(?:\s*→\s*([^()]*?))?\)\s*$/gm
    const found = [...grids.matchAll(deskHeading)]
    expect(found.length).toBe(GRIDS.length)
    for (const m of found) expect(m[3]).toBeUndefined()
    expect([...grids.matchAll(/^```text$/gm)].length).toBe(GRIDS.length)
  })

  it('forbid text, and say why', () => {
    for (const doc of [walks, stills, grids]) {
      expect(doc).toContain('NO TEXT OF ANY KIND')
      expect(doc).toContain('21 languages')
    }
  })

  it('forbid a baked ground, which is what premultiplied alpha cannot undo', () => {
    for (const doc of [walks, stills, grids]) {
      expect(doc).toContain('NOTHING MAY CARRY ITS OWN GROUND')
      expect(doc).toContain('FLAT MAGENTA #FF00FF')
    }
  })

  it('state the ink colour and the light direction', () => {
    for (const doc of [walks, stills, grids]) {
      expect(doc).toContain('#2b1b2e')
      expect(doc).toContain('UPPER LEFT')
    }
  })

  it('state the frame count as an exact number on every strip', () => {
    for (const w of WALKS) {
      expect(walks).toContain(`EXACTLY ${w.frames} panels`)
    }
  })

  it('state the anchor on every sheet', () => {
    expect([...walks.matchAll(/THE ANCHOR is the CENTRE/g)].length).toBe(WALKS.length)
    const anchored = (s: StillSpec): boolean => !!s.anchorNote || s.anchor === 'centre' || s.anchor === 'feet'
    expect(STILLS.filter((s) => !anchored(s))).toEqual([])
    // The shoe is the only drawable in the game that is NOT anchored on its
    // middle, and the stomp circle agrees with the toe or it agrees with
    // nothing — so its prompt has to say so in words.
    expect(stills).toContain('THE TOE IS THE ANCHOR')
  })
})
