import { describe, expect, it } from 'vitest'
import {
  BRAND_DELIVERABLES, COVER_ASPECTS, COVER_FLOOR, COVER_FORMATS, PLATE_FOCUS, PLATE_LAYERS,
  coverDeliverables, coverFile, plateStem, promotionPromptDoc, promotionRows, promptForCover
} from '@/game/promotionSheet'
import { promptDocs } from '@/game/artSheet'

/**
 * ─── The promotion deliverables are a contract with a submission form ───────
 *
 * Nothing in this file is drawn by the game, so nothing in it fails at run
 * time. It fails on a portal's upload page, days later, when the one size that
 * form insists on is the one size the folder does not have — and the fix is
 * another round trip through an image model. These are the checks that catch
 * that here instead.
 */

/** The sizes the deliverable list was specified as. Written out rather than
 *  derived, so a manifest edit that drops one fails here instead of quietly
 *  shipping eight sizes where nine were asked for. */
const REQUIRED = [
  '1920x1080', '1080x1920', '800x1200', '800x800',
  '628x628', '600x600', '512x512', '512x384', '512x340'
]

describe('cover deliverables', () => {
  it('produces exactly the sizes that were asked for, once each', () => {
    const got = coverDeliverables().map(({ size }) => `${size.w}x${size.h}`)
    expect([...got].sort()).toEqual([...REQUIRED].sort())
  })

  it('cuts every size in both formats', () => {
    expect([...COVER_FORMATS]).toEqual(['jpg', 'webp'])
    const files = coverDeliverables().flatMap(({ size }) => COVER_FORMATS.map((f) => coverFile(size, f)))
    expect(files).toHaveLength(REQUIRED.length * 2)
    expect(new Set(files).size).toBe(files.length)
    expect(files).toContain('cover-1920x1080.jpg')
    expect(files).toContain('cover-512x340.webp')
  })

  /**
   * The load-bearing one.
   *
   * A deliverable resized out of a master with a different aspect is either
   * letterboxed or centre-cropped, and a centre crop of a landscape cover is a
   * portrait cover with the shoe missing. The renderer normalises a sprite onto
   * its reference; nothing normalises a cover, so the plate has to be the shape
   * the deliverable is.
   */
  it('gives every deliverable a plate of its own aspect', () => {
    for (const aspect of COVER_ASPECTS) {
      const plate = aspect.plate.w / aspect.plate.h
      for (const size of aspect.sizes) {
        const want = size.w / size.h
        expect(Math.abs(plate / want - 1), `${aspect.id} plate vs ${size.w}x${size.h}`).toBeLessThan(0.005)
      }
    }
  })

  it('never asks a plate to be upscaled into a deliverable', () => {
    for (const aspect of COVER_ASPECTS) {
      for (const size of aspect.sizes) {
        expect(aspect.plate.w, `${aspect.id} plate width`).toBeGreaterThanOrEqual(size.w)
        expect(aspect.plate.h, `${aspect.id} plate height`).toBeGreaterThanOrEqual(size.h)
      }
    }
  })

  it('gives every aspect a layout and a focal point', () => {
    for (const aspect of COVER_ASPECTS) {
      expect(PLATE_LAYERS[aspect.shape], aspect.id).toBeDefined()
      expect(PLATE_FOCUS[aspect.shape], aspect.id).toBeDefined()
      const long = aspect.plate.w / aspect.plate.h
      // The shape name has to agree with the numbers, or a landscape
      // composition is built onto a portrait plate and every subject is
      // cropped away at the sides.
      if (aspect.shape === 'landscape') expect(long, aspect.id).toBeGreaterThan(1.05)
      if (aspect.shape === 'portrait') expect(long, aspect.id).toBeLessThan(0.95)
      if (aspect.shape === 'square') expect(Math.abs(long - 1), aspect.id).toBeLessThan(0.01)
    }
  })

  it('keeps every aspect id usable as a filename', () => {
    for (const aspect of COVER_ASPECTS) {
      expect(plateStem(aspect)).toMatch(/^cover-[a-z0-9]+x[a-z0-9]+$/)
    }
    expect(new Set(COVER_ASPECTS.map((a) => a.id)).size).toBe(COVER_ASPECTS.length)
  })
})

describe('the plates', () => {
  it('builds every layout out of sprites the game ships', () => {
    for (const [shape, layers] of Object.entries(PLATE_LAYERS)) {
      expect(layers.length, shape).toBeGreaterThan(4)
      for (const l of layers) {
        expect(l.src, shape).toMatch(/^images\/[a-z]+\/[A-Za-z0-9-]+\.webp$/)
        expect(l.cx).toBeGreaterThan(-0.1)
        expect(l.cx).toBeLessThan(1.1)
        expect(l.cy).toBeGreaterThan(-0.1)
        expect(l.cy).toBeLessThan(1.1)
        expect(l.size).toBeGreaterThan(0)
        expect(l.size).toBeLessThan(1.2)
        if (l.frames) expect(l.frame ?? 0).toBeLessThan(l.frames)
      }
    }
    expect(COVER_FLOOR).toMatch(/^images\/bg\/floor-\d\.webp$/)
  })

  /**
   * Every layout has to carry BOTH halves of the picture. A plate with the
   * scattering bugs and no shoe is a wallpaper, and the painter paints a
   * wallpaper: the thing the prompt calls the focal point is not in the
   * reference at all.
   */
  it('puts the shoe and the hero bug in every layout', () => {
    for (const [shape, layers] of Object.entries(PLATE_LAYERS)) {
      expect(layers.some((l) => l.src.startsWith('images/shoes/')), `${shape} shoe`).toBe(true)
      expect(layers.some((l) => l.src === 'images/bugs/beetle.webp'), `${shape} hero`).toBe(true)
    }
  })

  it('draws the shoe last, over everything it is about to land on', () => {
    for (const [shape, layers] of Object.entries(PLATE_LAYERS)) {
      expect(layers.at(-1)?.src, shape).toMatch(/^images\/shoes\//)
    }
  })
})

describe('the cover prompt', () => {
  const prompts = COVER_ASPECTS.map((a) => ({ a, text: promptForCover(a) }))

  it('forbids text, interface and the logo in every one', () => {
    for (const { a, text } of prompts) {
      expect(text, a.id).toContain('NO TEXT ANYWHERE')
      expect(text, a.id).toContain('NO LOGO')
      expect(text, a.id).toContain('NO USER INTERFACE')
      expect(text, a.id).toContain('No border, no frame')
    }
  })

  it('states its own pixel size and aspect, twice', () => {
    for (const { a, text } of prompts) {
      const shape = `${a.plate.w} x ${a.plate.h} pixels`
      expect(text.split(shape).length - 1, `${a.id} states its size twice`).toBe(2)
      expect(text, a.id).toContain(a.label)
    }
  })

  /**
   * The one rule a cover drops (`artSheet.houseStyle(false, false)`).
   *
   * Every sprite is forbidden its own shadow because the renderer draws the
   * shadow underneath it. A cover has no renderer under it — it is the floor,
   * the light and the shadow — and a cover painted under the sprite rule comes
   * back as a cast of cut-outs floating on a texture, which is what the plate
   * already looks like and the whole reason it is being painted.
   */
  it('lets a cover keep its own ground', () => {
    for (const { a, text } of prompts) {
      expect(text, a.id).not.toContain('NOTHING MAY CARRY ITS OWN GROUND')
      expect(text, a.id).toContain('A warm near-black ink contour')
    }
  })

  it('tells the painter what to take from the plate and what to change', () => {
    for (const { a, text } of prompts) {
      expect(text, a.id).toContain('READ THE ATTACHED PLATE')
      expect(text, a.id).toContain('WHAT MAKES IT CLICKABLE')
    }
  })
})

describe('the prompt document', () => {
  const doc = promotionPromptDoc()

  it('carries one block per aspect, naming its plate', () => {
    for (const a of COVER_ASPECTS) {
      expect(doc).toContain(`## ${a.id} — ${a.label}  (${plateStem(a)}.png)`)
      expect(doc).toContain(promptForCover(a))
    }
  })

  /**
   * THE SEPARATION THAT MAKES THIS A SIDE STEP.
   *
   * `tools/art-desk/jobs.mjs` scans `art-sheets/PROMPTS-*.md`, turns every
   * block it finds into a job, and hands each return to `tools/slice-sheets.mjs`
   * — which knows nothing about covers and would refuse all six, leaving six
   * paintings in the folder it reads. The promotion document lives one folder
   * down (`art-sheets/promotion/`) and is written by `pnpm art:promotion`
   * alone; if it ever appears in `promptDocs()` it is also in the desk's scan.
   */
  it('is not one of the sheet prompt documents', () => {
    const docs = promptDocs()
    expect(Object.keys(docs)).not.toContain('PROMPTS-PROMOTION.md')
    for (const text of Object.values(docs)) {
      expect(text).not.toContain('WHAT MAKES IT CLICKABLE')
    }
  })
})

describe('the brand files', () => {
  it('delivers the four the store page needs', () => {
    expect(BRAND_DELIVERABLES.map((d) => d.file)).toEqual([
      'logo_512x512.png', 'logo_256x256.webp', 'logo_192x192.png', 'favicon.ico'
    ])
  })

  it('sizes each one as its name says', () => {
    for (const d of BRAND_DELIVERABLES) {
      const named = /_(\d+)x(\d+)\./.exec(d.file)
      if (named) expect(Number(named[1]), d.file).toBe(d.size)
      expect(d.file.endsWith(`.${d.format}`), d.file).toBe(true)
      expect(d.from.length, d.file).toBeGreaterThan(0)
      for (const from of d.from) expect(from, d.file).toMatch(/^images\/.+\.(png|webp)$/)
    }
  })

  /**
   * The favicon is the MARK, not the wordmark — `scripts/make-brand.mjs` sets
   * out why at length: two lines of type average into a smudge on a tab strip,
   * and one gold sole on one pink splat still reads at 16 px. It is also the
   * only deliverable with a one-byte size field behind it (`icoOf`), which is
   * what caps it at 255.
   */
  it('takes the favicon from the mark, at a size an .ico can name', () => {
    const favicon = BRAND_DELIVERABLES.find((d) => d.format === 'ico')!
    expect(favicon.from[0]).toContain('mark')
    expect(favicon.size).toBe(128)
    expect(favicon.size).toBeLessThan(256)
  })
})

describe('the status report', () => {
  it('lists every file each aspect is responsible for', () => {
    const rows = promotionRows()
    expect(rows).toHaveLength(COVER_ASPECTS.length)
    const all = rows.flatMap((r) => r.targets)
    expect(all).toHaveLength(REQUIRED.length * COVER_FORMATS.length)
    expect(new Set(all).size).toBe(all.length)
  })
})
