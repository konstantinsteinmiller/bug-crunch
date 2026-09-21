import { describe, expect, it } from 'vitest'
import {
  ALL_SHEETS, GRIDS, STILLS, UI_CUT_FROM, WALKS, cutSources, promptDocs, sheetRows, type StillSpec
} from '@/game/artSheet'
import {
  ART_BRAND, ART_CATALOGUE, TINTED_GLYPHS, UI_GLYPH_ART_IDS, UI_HUD_MARKS, UI_MARK_FOR_GLYPH,
  artIdForGlyph
} from '@/game/artCatalogue'
import { ART_FOLDERS, type ArtKind } from '@/game/art'
import { BUGS, BUG_IDS, type BugId } from '@/game/bugs'
import { BUG_FRAMES } from '@/game/bugArt'
import { GAME_ICON_NAMES } from '@/components/icons/iconNames'
import { SPLAT_REACH, SPLAT_SHEET, UI_ICON_GLYPH } from '@/game/uiArt'
import { JUICE_STYLES } from '@/game/juiceStyle'
import { BOSSES, BOSS_IDS, EGG_STAGES } from '@/game/bosses'
import { EGG_ART_ID, EGG_PROP_IDS, EGG_SHELL_ART_ID, floorArtIdFor } from '@/game/artCatalogue'
import { FLOOR_IDS, type FloorId } from '@/game/floors'
import {
  BUG_PART_ART, BUG_PART_ART_IDS, CENTIPEDE_SEGMENT_ART, bugPartWants
} from '@/game/artCatalogue'
import { allArtWants } from '@/game/artPreload'
import { ALL_CUTSCENES, SCENE_ART_BOX, cutsceneArtWants } from '@/game/cutscene'

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

/** Narrow a sheet id to a floor id, so the unpainted-floor exemption below
 *  can ask `floorArtIdFor` rather than keep a list of its own. */
const isFloorId = (id: string): id is FloorId => (FLOOR_IDS as readonly string[]).includes(id)

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
      // ── The one exemption: a level floor that has not been painted yet ──
      //
      // Thirty-six of the forty floors have a sheet whose target IS the probe
      // path, and they arrive one painting at a time. The premise above — that
      // such a sheet is "by definition something `spriteFor` can ask for" —
      // stops holding for them, because `floorArtIdFor` is a gate in front of
      // the probe: it returns null for a floor with no painting, and the
      // renderer never asks. Cataloguing them anyway would make the preloader
      // fetch thirty-six files that do not exist, which is a 404 storm on a
      // portal that grades them.
      //
      // The exemption is asked of the GATE rather than of a hand-kept list, so
      // it cannot go stale: the moment a floor is added to
      // `LEVEL_FLOOR_ART_IDS`, `floorArtIdFor` stops returning null, the
      // exemption lapses, and this test requires it in the catalogue again.
      // `tests/game/floorArt.test.ts` holds the other end — that the list and
      // `public/images/bg/` agree in both directions.
      .filter((s) => !(s.kind === 'bg' && isFloorId(s.id) && floorArtIdFor(s.id) === null))
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

/**
 * ─── One file, two paintings ────────────────────────────────────────────────
 *
 * Every slot on a contact sheet keeps its single-icon still as well, so its file
 * has two paintings aimed at it. Which one it was cut from used to be whichever
 * the slicer happened to cut last — a full run and the Art Desk disagreed, and
 * the nine `grid-ui-objects-2` icons that ship would have been silently swapped
 * for their stills' different designs by the next full re-slice.
 *
 * `UI_CUT_FROM` settles it per slot, and the slicer cuts only from the painting
 * it names (`cut-from.json`). What fails here is a file with two sources and no
 * answer: a glyph added to the icon set lands on a grid AND gets a still the day
 * it exists, and until somebody writes down which painting ships, this is red —
 * and the slicer refuses to cut it from either.
 */
describe('a file two sheets paint', () => {
  const sources = cutSources()

  it('is cut from exactly one of them, settled in UI_CUT_FROM', () => {
    const open = Object.entries(sources)
      .filter(([, s]) => !s.from)
      .map(([target, s]) => `${target} (${s.sheets.join(' + ')})`)
    expect(open, 'painted twice with no settled source — add the slot to UI_CUT_FROM').toEqual([])
  })

  it('names a sheet that actually paints it', () => {
    for (const [target, s] of Object.entries(sources)) expect(s.sheets, target).toContain(s.from)
  })

  it('is the whole set of files more than one sheet paints, counted independently', () => {
    const painters = new Map<string, number>()
    for (const r of sheetRows()) {
      for (const t of new Set(r.targets ?? [r.target])) painters.set(t, (painters.get(t) ?? 0) + 1)
    }
    const twice = [...painters].filter(([, n]) => n > 1).map(([t]) => t).sort()
    expect(twice.length).toBeGreaterThan(0)
    expect(Object.keys(sources).sort()).toEqual(twice)
  })

  it('settles every slot on a contact sheet, and names nothing that is not one', () => {
    // A stale key — a slot that left the grids — would read as a decision that
    // is still being honoured when nothing reads it any more.
    const onAGrid = GRIDS.flatMap((g) => g.members.map((m) => m.id)).sort()
    expect(Object.keys(UI_CUT_FROM).sort()).toEqual(onAGrid)
    for (const [id, from] of Object.entries(UI_CUT_FROM)) expect(['grid', 'still'], id).toContain(from)
  })

  it('is exactly what the slicer and the Art Desk read', () => {
    // Both read `art-sheets/cut-from.json`, which the two prompt routes write
    // from this — so a table the file disagrees with is a decision nobody reads.
    const doc = JSON.parse(promptDocs()['cut-from.json']!) as { targets: unknown }
    expect(doc.targets).toEqual(sources)
  })
})

/**
 * ─── Variation sheets ───────────────────────────────────────────────────────
 *
 * A VARIATION sheet is a multi-panel still whose panels are different takes of
 * one subject rather than one loop of it — the splat decals. It is cut by the
 * same arithmetic as a walk cycle and read back by the same `stripFrames`, so
 * the only thing that can silently go wrong is the ROSTER: `variantBlurbs`
 * describes panel N, the lattice cuts panel N, and the game picks panel N at
 * random. A roster one entry short does not fail anything — it just leaves the
 * last panel unspecified, and what comes back is a duplicate of one of the
 * others, which is the exact failure this whole sheet exists to avoid.
 */
describe('a variation sheet', () => {
  const variants = STILLS.filter((s) => s.variants)

  it('exists, and every one of them is a real multi-panel lattice', () => {
    expect(variants.length).toBeGreaterThan(0)
    for (const s of variants) {
      const n = s.frames ?? 1
      expect(n, s.id).toBeGreaterThan(1)
      expect((s.cols ?? 1) * (s.rows ?? 1), `${s.id} lattice`).toBe(n)
    }
  })

  it('describes every panel it asks for, and no panel it does not', () => {
    for (const s of variants) {
      if (!s.variantBlurbs) continue
      expect(s.variantBlurbs.length, `${s.id} roster`).toBe(s.frames ?? 1)
    }
  })

  it('numbers that roster in the prompt in the order the lattice is cut', () => {
    // The same contract the contact sheets have, for the same reason: the game
    // files panel N under position N, so a description one cell out ships the
    // wrong picture under the right name.
    const doc = promptDocs()['PROMPTS-STILLS.md']!
    for (const s of variants) {
      if (!s.variantBlurbs?.length) continue
      const block = doc.slice(doc.indexOf(`## ${s.id} — `))
      const listed = [...block.slice(0, block.indexOf('WHERE THE PANELS SIT —'))
        .matchAll(/^ {2}PANEL (\d+) — row (\d+), column (\d+):/gm)]
      expect(listed.length, s.id).toBe(s.variantBlurbs.length)
      listed.forEach((m, i) => {
        expect(Number(m[1]), `${s.id} panel order`).toBe(i + 1)
        expect(Number(m[2]), `${s.id} row`).toBe(Math.floor(i / (s.cols ?? 1)) + 1)
        expect(Number(m[3]), `${s.id} column`).toBe((i % (s.cols ?? 1)) + 1)
      })
    }
  })

  it('is told it is a variation sheet and never an animation', () => {
    // The one sentence that decides what comes back. Told it is a loop, a
    // painter hands over four near-identical panels with a wobble.
    const doc = promptDocs()['PROMPTS-STILLS.md']!
    for (const s of variants) {
      const block = doc.slice(doc.indexOf(`## ${s.id} — `), doc.indexOf('```', doc.indexOf(`## ${s.id} — `) + 200))
      expect(block, s.id).toContain('A VARIATION SHEET')
      expect(block, s.id).not.toContain('ONE loop of its own movement')
    }
  })
})

/**
 * ─── Stage sheets: the boss eggs ────────────────────────────────────────────
 *
 * A STAGE sheet is the third kind of multi-panel still: one object at successive
 * moments of one change — an egg's crack stages — which the game picks between
 * by how far the egg's clock has run (`propArt.eggStage`). Cut and read back like
 * a variation sheet, so the same silent failures apply, plus one of its own: a
 * sheet with a panel count that is not `EGG_STAGES` is a sheet whose last crack
 * is never shown, or whose first is shown twice.
 */
describe('a stage sheet', () => {
  const stages = STILLS.filter((s) => s.stages)
  const doc = promptDocs()['PROMPTS-STILLS.md']!
  const blockOf = (id: string): string => {
    const at = doc.indexOf(`## ${id} — `)
    return doc.slice(at, doc.indexOf('```', doc.indexOf('```text', at) + 7))
  }

  it('exists for every egg look a boss can lay or haul, with its empty shell beside it', () => {
    const looks = new Set(BOSS_IDS.map((id) => BOSSES[id].eggLook))
    for (const look of looks) {
      const sheet = stillBy.get(`prop/${EGG_ART_ID[look]}`)
      expect(sheet?.stages, `${look} has no stage sheet`).toBe(true)
      const shell = stillBy.get(`prop/${EGG_SHELL_ART_ID[look]}`)
      expect(shell, `${look} has no shell`).toBeDefined()
      expect(shell!.frames ?? 1, `${look} shell is one still`).toBe(1)
    }
    expect(stages.map((s) => s.id).sort()).toEqual(['egg', 'egg-capsule'])
  })

  it('has exactly one panel per crack stage, on a lattice with no hole in it', () => {
    for (const s of stages) {
      expect(s.frames, s.id).toBe(EGG_STAGES)
      expect((s.cols ?? 1) * (s.rows ?? 1), `${s.id} lattice`).toBe(EGG_STAGES)
      expect(s.variantBlurbs?.length, `${s.id} roster`).toBe(EGG_STAGES)
      // Sized in words, for the splat's reason: panel 0 is the smallest egg on
      // the sheet, and a fit measured off it would shrink the last stage.
      expect(s.fit, s.id).toBe(false)
    }
  })

  it('is told its panels are a sequence — never a loop, never four different objects', () => {
    for (const s of stages) {
      const block = blockOf(s.id)
      expect(block, s.id).toContain('A STAGE SHEET')
      expect(block, s.id).not.toContain('A VARIATION SHEET')
      expect(block, s.id).not.toContain('ONE loop of its own movement')
      const listed = [...block.matchAll(/^ {2}PANEL (\d+) — row (\d+), column (\d+):/gm)]
      expect(listed.length, s.id).toBe(EGG_STAGES)
      listed.forEach((m, i) => {
        expect(Number(m[1]), `${s.id} panel order`).toBe(i + 1)
        expect(Number(m[2]), `${s.id} row`).toBe(Math.floor(i / (s.cols ?? 1)) + 1)
        expect(Number(m[3]), `${s.id} column`).toBe((i % (s.cols ?? 1)) + 1)
      })
    }
  })

  it('catalogues every brood drawable, so a boss level preloads what it lays', () => {
    for (const id of EGG_PROP_IDS) {
      expect(ART_CATALOGUE.prop as readonly string[], id).toContain(id)
      expect(stillBy.has(`prop/${id}`), id).toBe(true)
    }
  })
})

/**
 * ─── The bug parts ──────────────────────────────────────────────────────────
 *
 * A painting a creature is composed from that is not a design of its own — the
 * centipede's tail segment. The designs are pinned by `BUG_IDS` from the game's
 * data; a part is not in that list, so nothing else here would notice a segmented
 * design with no tail painting (a painted head towing inked blobs), a part with
 * no sheet (a probe for a file nothing can paint), or a part the preloader never
 * asks for (a tail that pops in behind a head that arrived with the splash).
 */
describe('the bug parts', () => {
  it('give every segmented design a tail painting, and nothing else one', () => {
    const segmented = BUGS.filter((b) => b.segments > 0).map((b) => b.id).sort()
    expect(Object.keys(BUG_PART_ART).sort()).toEqual(segmented)
    expect([...BUG_PART_ART_IDS]).toContain(CENTIPEDE_SEGMENT_ART)
  })

  it('have a strip to be painted from, at the path the renderer probes', () => {
    for (const id of BUG_PART_ART_IDS) {
      const s = stillBy.get(`bug/${id}`)
      expect(s, `bug/${id} has no sheet`).toBeDefined()
      expect(s!.target).toBe(probePath('bug', id))
      // One stride of the legs, at the walk strips' own frame count and square
      // panel — `paintSegment` reads it back through `stripFrame` at aspect 1.
      expect(s!.frames, id).toBe(BUG_FRAMES)
      expect(s!.w, id).toBe(s!.h)
      expect(s!.variants ?? s!.stages, `${id} is a loop`).toBeUndefined()
    }
  })

  it('are wanted wherever their design is', () => {
    const keys = (ws: readonly (readonly [string, string])[]): string[] => ws.map(([k, id]) => `${k}/${id}`)
    for (const [design, parts] of Object.entries(BUG_PART_ART)) {
      expect(keys(bugPartWants(design as BugId))).toEqual(parts!.map((p) => `bug/${p}`))
      for (const p of parts!) expect(keys(allArtWants()), p).toContain(`bug/${p}`)
    }
  })

  it('tell the painter it is one segment, not a centipede', () => {
    const doc = promptDocs()['PROMPTS-STILLS.md']!
    const at = doc.indexOf(`## ${CENTIPEDE_SEGMENT_ART} — `)
    expect(at).toBeGreaterThan(-1)
    const block = doc.slice(at, doc.indexOf('```', doc.indexOf('```text', at) + 7))
    expect(block).toContain('ONE BODY SEGMENT')
    expect(block).toContain('no head')
    expect(block).toContain('A SPRITE SHEET')
  })
})

/**
 * ─── The splat decals ───────────────────────────────────────────────────────
 *
 * The decal is the one drawable whose painting is tinted PER STAMP to the goo
 * of whatever it came out of, so its sheets are greyscale by contract and the
 * renderer picks which sheet by juice style. Two lists have to agree about that
 * — `SPLAT_SHEET` in the renderer and the manifest's own slots — and nothing at
 * run time notices when they stop: `stripFrames` returns null for a sheet that
 * was never painted, and the drawing simply keeps drawing, forever, silently.
 */
describe('the splat decals', () => {
  it('give every juice style a sheet that is actually in the manifest', () => {
    for (const style of JUICE_STYLES) {
      const id = SPLAT_SHEET[style]
      expect(stillBy.has(`fx/${id}`), `${style} -> fx/${id}`).toBe(true)
      expect((ART_CATALOGUE.fx as readonly string[]), `${style} -> fx/${id}`).toContain(id)
    }
  })

  it('paint them colourless, because the game supplies the colour', () => {
    // `greyscale: false` here would ask for a splat in one fixed colour, and the
    // multiply tint in `uiArt.bakeSplatTint` would then fight it on every stamp.
    for (const id of new Set(Object.values(SPLAT_SHEET))) {
      expect(stillBy.get(`fx/${id}`)!.greyscale, id).toBe(true)
    }
  })

  it('give every sheet a reach, so a painting lands at the size the drawing had', () => {
    // `SPLAT_REACH` is the half-width of the box the painting is blitted into,
    // as a multiple of the body radius. A sheet with no entry would blit at
    // `undefined` and vanish.
    for (const id of new Set(Object.values(SPLAT_SHEET))) {
      expect(typeof SPLAT_REACH[id], id).toBe('number')
      expect(SPLAT_REACH[id], id).toBeGreaterThan(0)
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

/**
 * ─── A mark is painted flat because the GAME colours it ─────────────────────
 *
 * `TINTED_GLYPHS` is read by two modules that never meet. `GameIcon` masks
 * those paintings and fills them with `currentColor`, so `color:` reaches the
 * painted rung exactly as it reaches the vector. `artSheet` sets `greyscale` on
 * those same slots, so the prompt asks for one bold shape with no outline and
 * no shading rather than an illustration.
 *
 * Drift either way is the same bug wearing the other shoe:
 *
 *   masked but painted in colour  — the painting's colours are thrown away and
 *                                   only its alpha survives, so a careful gold
 *                                   trophy renders as a flat slate blob;
 *   blitted but painted flat      — nothing tints it, so it renders silver-grey
 *                                   wherever the stylesheet meant it to be gold.
 *                                   This is exactly what shipped: every EARNED
 *                                   star on the result screen was grey beside an
 *                                   unearned socket that was warm gold, and the
 *                                   screen read inverted.
 *
 * ── WHAT `greyscale: true` BUYS, EXACTLY ──
 *
 * It asks for no COLOUR of its own. It has never asked for no INK: the house
 * look block puts a warm near-black contour on every shape in the game, and on
 * these marks that contour is the whole of the structure — it is what separates
 * a trophy's bowl from its handles and a boot's cuff from its shaft. Measured on
 * `trophy.webp`, the interior of the silhouette sits at luminance 254 in the
 * median and the quarter of it that is darker is that line.
 *
 * The renderer reads the same file two ways, and which one is right is decided
 * by SIZE rather than by the slot:
 *
 *   mark  (16–24 px, the default) — masked, filled flat with `currentColor`. The
 *                                   ink goes, and at that size it must: keeping
 *                                   it eats a third of the glyph and a bold
 *                                   white boot on candy plastic turns to noise.
 *   hero  (~70–130 px, opt-in)    — `currentColor` under the painting, multiplied
 *                                   through it, still cut by the mask. A flat
 *                                   near-white body multiplies to pure tint, so
 *                                   the card's colour survives and so does the
 *                                   ink. See `GameIcon`'s `.is-tinted.is-hero`.
 *
 * So a repaint of these marks that dropped the contour — "flat and solid" read
 * as "no line either" — would cost nothing at 16 px and silently return the gift
 * card to the flat cream sticker it was. That is what the last assertion here
 * guards.
 */
describe('the marks the renderer tints and the marks the painter flattens are one set', () => {
  const uiStillBy = new Map(STILLS.filter((s) => s.kind === 'ui').map((s) => [s.id, s]))

  /**
   * The one glyph the two lists are allowed to disagree about.
   *
   * `star-empty` is masked by the renderer but stays an OBJECT in the manifest.
   * A hollow outline is the one shape whose colours cannot matter once it is
   * masked, and reclassifying it would re-pack both contact-sheet lattices — four
   * painted sheets flagged for a repaint and `objects-3` orphaned — to reword a
   * prompt for a mark that is already correctly painted. Listed here so the
   * exception has to be renewed deliberately rather than by a passing test.
   */
  const EXCEPTIONS = new Set<string>(['star-empty'])

  it('agree, glyph by glyph', () => {
    for (const name of GAME_ICON_NAMES) {
      const still = uiStillBy.get(artIdForGlyph(name))
      // Not every glyph has a slot of its own; only assert on the ones that do.
      if (!still) continue
      if (EXCEPTIONS.has(name)) continue
      const tinted = TINTED_GLYPHS.has(name)
      expect(
        still.greyscale === true,
        `${name} -> ${still.id}: the renderer ${tinted ? 'MASKS' : 'BLITS'} it, so the prompt `
        + `must ask for ${tinted ? 'a flat silhouette (greyscale: true)' : 'an object in colour'}`
      ).toBe(tinted)
    }
  })

  it('name every exception, so none is acquired by accident', () => {
    const drifted = GAME_ICON_NAMES.filter((name) => {
      const still = uiStillBy.get(artIdForGlyph(name))
      return still ? still.greyscale === true !== TINTED_GLYPHS.has(name) : false
    })
    expect(new Set(drifted)).toEqual(EXCEPTIONS)
  })

  it('cover the six glyphs that are also a HUD mark', () => {
    // These never reach `GLYPH_STILLS` — their painting is the HUD mark's own —
    // so only this list keeps them tinted. A star that falls out of it is the
    // grey-star bug again.
    for (const glyph of Object.keys(UI_MARK_FOR_GLYPH) as (keyof typeof UI_MARK_FOR_GLYPH)[]) {
      expect(TINTED_GLYPHS.has(glyph), `${glyph} is a HUD mark; the game colours it`).toBe(true)
    }
  })

  it('keep the empty star socket tintable, so the row can ghost it', () => {
    // `star-empty` is the same mark as `star` in another state and has to dim to
    // a near-transparent white on the result screen. An untinted painting cannot.
    expect(TINTED_GLYPHS.has('star-empty')).toBe(true)
  })

  it('still ask a flat mark for the house ink, which is what the hero rung reads back', () => {
    // The contour is not in the per-slot brief — it is in the look block every
    // panel gets — so this is the one place the two halves can be checked
    // against each other. A greyscale prompt that stops asking for a line is a
    // gift card that goes back to being a sticker, with nothing on screen at
    // HUD size to say so.
    const stills = promptDocs()['PROMPTS-STILLS.md']!
    const trophy = stills.slice(stills.indexOf('## trophy'))
    const block = trophy.slice(0, trophy.indexOf('```', trophy.indexOf('```text') + 7))
    expect(block).toContain('Flat and solid, no shading')
    expect(block).toContain('warm near-black ink contour')
  })
})

/**
 * ─── The cutscenes' set dressing ────────────────────────────────────────────
 *
 * The `scene` kind is the one whose painting is blitted into a box that is not
 * the panel's own square: the plate is a circle, the sandwich is wide, the door
 * is a tile, the cabinet is a whole object at board scale. `SCENE_ART_BOX` is
 * the contract between the bench that draws the reference into a panel and the
 * renderer that blits the painting back into the world, and three lists have to
 * agree about it — the catalogue, the boxes and the manifest's panels — plus a
 * fourth that decides whether a painting is ever FETCHED before its scene plays.
 */
describe('the cutscene set dressing', () => {
  const sceneStills = STILLS.filter((s) => s.kind === 'scene')

  it('gives every catalogued piece a box, and boxes nothing that is not catalogued', () => {
    expect(Object.keys(SCENE_ART_BOX).sort()).toEqual([...ART_CATALOGUE.scene].sort())
  })

  it('authors every panel in its box\'s own proportions', () => {
    // A panel of the wrong shape is a painting stretched on the way back in —
    // the slicer fits the return to the panel, and the renderer fits the panel
    // to the box.
    for (const s of sceneStills) {
      const b = SCENE_ART_BOX[s.id]!
      expect(s.w / s.h, s.id).toBeCloseTo(b.hw / b.hh, 2)
    }
  })

  it('asks for every one of them from some scene, so none is painted and never fetched', () => {
    // The preloader reaches a `scene` painting ONLY through a scene's wants
    // (`cutsceneArtWants`) — no level lays one out. A piece no scene asks for is
    // a piece the splash never waits for and the renderer finds mid-shot.
    const wanted = new Set(ALL_CUTSCENES.flatMap((s) => cutsceneArtWants(s))
      .filter(([k]) => k === 'scene').map(([, id]) => id))
    expect([...ART_CATALOGUE.scene].filter((id) => !wanted.has(id))).toEqual([])
    // …and nothing a scene asks for is missing from the catalogue.
    expect([...wanted].filter((id) => !(ART_CATALOGUE.scene as readonly string[]).includes(id))).toEqual([])
  })

  it('paints the door as an opaque tile that repeats along its width', () => {
    const door = sceneStills.find((s) => s.id === 'door')!
    expect(door.tile).toBe('x')
    expect(door.bg).toBe('opaque')
  })

  it('tells the painter what the game draws over each piece', () => {
    // Every one of these has a live layer — a shadow at the very least — and a
    // blurb that does not say so gets a painted shadow under a drawn one.
    for (const s of sceneStills) expect(s.live, s.id).toBeTruthy()
  })
})
