import {
  blob, cel, ink, rough, densify, fillShape, tones, terminator, type Pt
} from '@/game/inkArt'
import { INK, SHADOW_DIR } from '@/game/monsterKit'
import { ICON_PATHS } from '@/components/icons/iconPaths'
import type { GameIconName } from '@/components/icons/iconNames'
import { spriteFor } from '@/game/art'

/**
 * ─── HUD art ────────────────────────────────────────────────────────────────
 *
 * The things the DOM side of the game shows that the art pipeline can repaint:
 * the result screen's banner, the shop chest and the two skill icons. They
 * live here rather than in the renderer because nothing on the field blits
 * them — Vue does — but the bench and the playground still need ONE painter
 * per drawable that the runtime provably shows, which is the pipeline's first
 * rule: a reference drawn from a lookalike proves nothing.
 *
 * The banner is drawn ON A CANVAS and handed to CSS as a data URL, so the
 * drawing on the result screen and the reference on the sheet are one
 * function. The icons are the shared SVG glyphs filled through `Path2D`, so
 * the reference is exactly the silhouette the button shows.
 */

/** Draw the procedural version even when a painting is available. */
export interface UiPaintOpts { procedural?: boolean }

// ─── The result banner ──────────────────────────────────────────────────────

/**
 * The banner's reference box, and the one number that binds the painting to
 * the CSS that shows it.
 *
 * 21:9 — a ratio the image tools offer — because the file's shape is only the
 * END PIECES' shape: the banner is nine-sliced (three, really — two ends kept
 * at true size and a middle stretched to the caption), so its height on
 * screen is the caption's line and its width is the caption's width. `cap` is
 * how much of the width each end piece takes, and it is where ALL the detail
 * goes; the middle is a plain band precisely because it gets stretched.
 */
export const BANNER = { w: 1344, h: 576, cap: 0.171 } as const

/**
 * The banner, drawn into the box (0, 0, w, h): a plate of blackened iron with
 * swallow-tailed ends, bound top and bottom in tarnished gold, a boss at each
 * end. The middle stays plain — the title goes there.
 */
export const paintBanner = (
  ctx: CanvasRenderingContext2D, w: number, h: number, o?: UiPaintOpts
): void => {
  const painted = o?.procedural ? null : spriteFor('ui', 'ribbon')
  if (painted) {
    ctx.drawImage(painted, 0, 0, w, h)
    return
  }
  const cap = BANNER.cap * w
  /** How deep the swallow-tail bites into each end. */
  const notch = cap * 0.55
  const top = h * 0.07
  const bot = h * 0.93
  const mid = h / 2
  const iron = tones('#2b2e38', 1.15)
  const gold = tones('#a5823a', 1)

  ctx.save()

  // ── The plate ──
  // Densified so the traced contour keeps its corners — the notch has to be a
  // point, not a dimple — and roughened only slightly: the middle band is
  // stretched sideways in play, and a wobble there stretches with it.
  const plate = rough(densify([
    [0, top], [w, top], [w - notch, mid], [w, bot], [0, bot], [notch, mid]
  ], 8), h * 0.005, 7, 0.7)
  cel(ctx, plate, iron, {
    shade: terminator(plate, Math.PI / 2, 0.35, 0.05, 3),
    lit: terminator(plate, -Math.PI / 2, 0.62, 0.04, 5)
  })

  // ── The gold binding, straight: it crosses the band that gets stretched ──
  ctx.lineCap = 'round'
  for (const y of [top + h * 0.085, bot - h * 0.085]) {
    ctx.strokeStyle = gold.shade
    ctx.lineWidth = h * 0.03
    ctx.beginPath()
    ctx.moveTo(notch + h * 0.06, y + h * 0.008)
    ctx.lineTo(w - notch - h * 0.06, y + h * 0.008)
    ctx.stroke()
    ctx.strokeStyle = gold.base
    ctx.lineWidth = h * 0.02
    ctx.beginPath()
    ctx.moveTo(notch + h * 0.06, y)
    ctx.lineTo(w - notch - h * 0.06, y)
    ctx.stroke()
  }

  // ── The end pieces: a boss at the notch and a rivet at each corner ──
  for (const side of [0, 1] as const) {
    const sx = (x: number): number => (side === 0 ? x : w - x)
    const boss = blob(sx(notch + h * 0.15), mid, h * 0.075, h * 0.075, 21 + side, 0.05)
    cel(ctx, boss, gold, {
      shade: terminator(boss, SHADOW_DIR, 0.1, 0.1, 23 + side),
      lit: terminator(boss, SHADOW_DIR + Math.PI, 0.6, 0.08, 25 + side)
    })
    ink(ctx, boss, { width: h * 0.014, color: INK, seed: 27 + side, breakUp: 0.2 })
    for (const y of [top + h * 0.19, bot - h * 0.19]) {
      const rivet = blob(sx(cap * 0.86), y, h * 0.032, h * 0.032, 31 + side, 0.08)
      cel(ctx, rivet, iron, { lit: terminator(rivet, SHADOW_DIR + Math.PI, 0.5, 0.1, 33 + side) })
      ink(ctx, rivet, { width: h * 0.01, color: INK, seed: 35 + side, breakUp: 0.2 })
    }
  }

  // ── The contour, inked last, with few breaks: a gap in the middle band
  //    would be stretched into a missing edge ──
  ink(ctx, plate, { width: h * 0.026, color: INK, seed: 41, breakUp: 0.06 })

  ctx.restore()
}

let drawnBanner: HTMLCanvasElement | null = null
let drawnBannerUrl: string | null = null

/** The drawing at the reference size, baked once. */
const bannerCanvas = (): HTMLCanvasElement => {
  if (drawnBanner) return drawnBanner
  const c = document.createElement('canvas')
  c.width = BANNER.w
  c.height = BANNER.h
  const ctx = c.getContext('2d')
  if (ctx) paintBanner(ctx, c.width, c.height, { procedural: true })
  drawnBanner = c
  return c
}

/**
 * The drawn banner as a data URL, for a `border-image`.
 *
 * Baked on first use and kept for the page: the result screen shows it once
 * a stage, and the bake is a few hundred path operations.
 */
export const bannerDataUrl = (): string => {
  if (drawnBannerUrl === null) drawnBannerUrl = bannerCanvas().toDataURL('image/png')
  return drawnBannerUrl
}

/**
 * The banner blitted the way CSS shows it: the two end pieces at true size
 * for the height, the middle stretched to whatever is left. The playground's
 * way of proving a painting's caps land where the drawing's do.
 */
export const blitBanner = (
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o?: UiPaintOpts
): void => {
  const src: HTMLImageElement | HTMLCanvasElement =
    (o?.procedural ? null : spriteFor('ui', 'ribbon')) ?? bannerCanvas()
  const sw = src.width
  const sh = src.height
  const capS = Math.round(BANNER.cap * sw)
  const capD = h * (capS / sh)
  ctx.drawImage(src, 0, 0, capS, sh, x, y, capD, h)
  ctx.drawImage(src, capS, 0, sw - capS * 2, sh, x + capD, y, Math.max(0, w - capD * 2), h)
  ctx.drawImage(src, sw - capS, 0, capS, sh, x + w - capD, y, capD, h)
}

// ─── The icons ──────────────────────────────────────────────────────────────

/** The HUD marks the pipeline paints, and the glyph each one stands in for. */
export const UI_ICON_GLYPH = {
  chest: 'chest',
  'skill-grenade': 'bomb',
  'skill-shield': 'shield'
} as const satisfies Record<string, GameIconName>

export type UiIconId = keyof typeof UI_ICON_GLYPH

export const UI_ICON_IDS = Object.keys(UI_ICON_GLYPH) as UiIconId[]

/**
 * One HUD icon at the origin, `size` px square: the painting, or the glyph it
 * stands in for filled in `colour` — the exact silhouette the button shows,
 * through the same paths `GameIcon` renders.
 */
export const paintUiIcon = (
  ctx: CanvasRenderingContext2D, id: UiIconId, size: number, o?: UiPaintOpts, colour = '#ffffff'
): void => {
  const painted = o?.procedural ? null : spriteFor('ui', id)
  if (painted) {
    ctx.drawImage(painted, -size / 2, -size / 2, size, size)
    return
  }
  const path = new Path2D(ICON_PATHS[UI_ICON_GLYPH[id]].join(''))
  ctx.save()
  ctx.translate(-size / 2, -size / 2)
  ctx.scale(size / 24, size / 24)
  ctx.fillStyle = colour
  ctx.fill(path)
  ctx.restore()
}

/** Points, for the tests: the plate's outline is what the fit measures. */
export const bannerOutline = (w: number, h: number): Pt[] => {
  const notch = BANNER.cap * w * 0.55
  return [[0, h * 0.07], [w, h * 0.07], [w - notch, h / 2], [w, h * 0.93], [0, h * 0.93], [notch, h / 2]]
}

// `fillShape` is part of the vocabulary the banner may grow into (a rune band,
// a tear); keep the import honest until it does.
void fillShape
