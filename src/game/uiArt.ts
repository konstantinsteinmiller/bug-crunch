import {
  blob, cel, ink, rough, densify, fillShape, tones, terminator, trace, type Pt
} from '@/game/inkArt'
import { INK, SHADOW_DIR } from '@/game/monsterKit'
import { ICON_PATHS } from '@/components/icons/iconPaths'
import type { GameIconName } from '@/components/icons/iconNames'
import { spriteFor } from '@/game/art'

/**
 * ─── HUD art ────────────────────────────────────────────────────────────────
 *
 * The things the DOM side of the game shows that the art pipeline can repaint:
 * the result screen's banner, the idle chest, the shop's forge and the two
 * skill icons. They live here rather than in the renderer because nothing on
 * the field blits them — Vue does — but the bench and the playground still
 * need ONE painter per drawable that the runtime provably shows, which is the
 * pipeline's first rule: a reference drawn from a lookalike proves nothing.
 *
 * Two of them are drawn ON A CANVAS and handed to the DOM as a data URL — the
 * banner, for a `border-image`, and the forge, for an `<img>` — so the drawing
 * the player sees and the reference on the sheet are one function. The rest
 * are the shared SVG glyphs filled through `Path2D`, so their reference is
 * exactly the silhouette the button shows.
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

// ─── The upgrade shop's mark ────────────────────────────────────────────────

/**
 * The shop button's forge: a blackened anvil with a chevron of hot gold rising
 * off its face.
 *
 * It is DRAWN rather than filled from a glyph, which makes it the odd one out
 * among the icons below, and the reason is the button it sits on. The shop
 * chip is the one control on the HUD the game actively wants pressed — it
 * carries an unspent-coins badge and a one-shot spotlight — and it used to
 * wear the painted chest. That chest now belongs to the idle reward in the
 * wallet column, because two buttons that do different things may not be the
 * same drawing. What the shop needed back was not the glyph underneath it: a
 * flat white silhouette beside a painted chest is not a mark, it is the
 * absence of one.
 *
 * Centred on the origin, `size` px square — the same contract every icon here
 * keeps, so `paintUiIcon` can dispatch to it and the reference sheet, the
 * playground and the button all show one drawing. A painting at
 * `images/ui/forge.webp` replaces it wholesale; `artSheet.ts` carries the
 * prompt that would produce one.
 */
export const paintForge = (ctx: CanvasRenderingContext2D, size: number): void => {
  const S = size
  /** Authored in fractions of the box, centred on the origin. */
  const P = (pts: readonly (readonly [number, number])[]): Pt[] =>
    pts.map(([x, y]) => [x * S, y * S] as Pt)

  const iron = tones('#525a6b', 1.3)

  // ── The anvil ──
  //
  // Every point is DOUBLED, which is not decoration: `trace` makes each
  // authored point the control point of a quadratic, so a lone vertex rounds
  // off — and the first draft of this mark, authored with single points at the
  // waist, smoothed its own pinch away and read as a mushroom on a plinth. An
  // anvil is a hard object; doubling makes `trace` pass through each vertex
  // with a corner and leaves the hand-drawn wobble to `rough`.
  //
  // The three masses, in the proportions that make the silhouette legible at
  // 24 px: a face nearly the full width and a fifth of the height, a waist a
  // QUARTER of that width, and a foot almost as wide as the face. The horn is
  // a wedge off the left at face height, not a spur underneath it.
  const anvil = rough(densify(P([
    [-0.49, 0.055], [-0.49, 0.055],
    [-0.33, -0.02], [-0.33, -0.02],
    [-0.30, -0.055], [-0.30, -0.055],
    [0.35, -0.055], [0.35, -0.055],
    [0.42, -0.005], [0.42, -0.005],
    [0.42, 0.115], [0.42, 0.115],
    [0.35, 0.165], [0.35, 0.165],
    [0.145, 0.165], [0.145, 0.165],
    [0.10, 0.225], [0.10, 0.225],
    [0.10, 0.30], [0.10, 0.30],
    [0.30, 0.345], [0.30, 0.345],
    [0.335, 0.385], [0.335, 0.385],
    [0.335, 0.46], [0.335, 0.46],
    [-0.335, 0.46], [-0.335, 0.46],
    [-0.335, 0.385], [-0.335, 0.385],
    [-0.30, 0.345], [-0.30, 0.345],
    [-0.10, 0.30], [-0.10, 0.30],
    [-0.10, 0.225], [-0.10, 0.225],
    [-0.145, 0.165], [-0.145, 0.165],
    [-0.30, 0.165], [-0.30, 0.165],
    [-0.335, 0.13], [-0.335, 0.13]
  ]), 3), S * 0.004, 71, 0.9)

  cel(ctx, anvil, iron, {
    shade: terminator(anvil, SHADOW_DIR, 0.18, 0.09, 311),
    deep: terminator(anvil, SHADOW_DIR, 0.55, 0.07, 312),
    lit: terminator(anvil, SHADOW_DIR + Math.PI, 0.70, 0.06, 313)
  })

  // The face, still hot from whatever was last struck on it — a hand's width
  // of heat on the TOP SURFACE only. The first draft ran this gradient down
  // the whole face and turned the iron brown; what says "forge" is the
  // contrast between a hot edge and cold metal, not a warm wash over both.
  ctx.save()
  ctx.beginPath()
  trace(ctx, anvil)
  ctx.clip()
  const ember = ctx.createLinearGradient(0, -0.06 * S, 0, 0.035 * S)
  ember.addColorStop(0, 'rgba(255, 186, 86, 0.55)')
  ember.addColorStop(1, 'rgba(255, 120, 24, 0)')
  ctx.fillStyle = ember
  ctx.fillRect(-0.5 * S, -0.06 * S, S, 0.095 * S)
  ctx.restore()

  ink(ctx, anvil, { width: S * 0.05, color: INK, seed: 314, breakUp: 0.2 })

  // ── The chevron ──
  //
  // The half of the mark that says "upgrade", so its point has to be a point:
  // tripled at the apex, at the inner notch and at each tip.
  const chevron = rough(densify(P([
    [0, -0.47], [0, -0.47], [0, -0.47],
    [0.33, -0.21], [0.33, -0.21],
    [0.33, -0.095], [0.33, -0.095],
    [0, -0.335], [0, -0.335], [0, -0.335],
    [-0.33, -0.095], [-0.33, -0.095],
    [-0.33, -0.21], [-0.33, -0.21]
  ]), 3), S * 0.003, 91, 1.1)

  // Molten, so it is lit from ABOVE along its own length rather than cel-shaded
  // from the scene's light: a terminator across a shape this thin cuts a hard
  // diagonal through one arm and reads as a crease, not as a form.
  ctx.save()
  ctx.shadowColor = 'rgba(255, 168, 40, 0.95)'
  ctx.shadowBlur = S * 0.12
  fillShape(ctx, chevron, '#ffc340')
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  trace(ctx, chevron)
  ctx.clip()
  const molten = ctx.createLinearGradient(0, -0.47 * S, 0, -0.09 * S)
  molten.addColorStop(0, '#fff0b8')
  molten.addColorStop(0.45, '#ffc63e')
  molten.addColorStop(1, '#e8830f')
  ctx.fillStyle = molten
  ctx.fillRect(-0.5 * S, -0.5 * S, S, S)
  ctx.restore()
  ink(ctx, chevron, { width: S * 0.032, color: INK, seed: 323, breakUp: 0.3 })

  // ── Sparks ──
  // Struck off the chevron's tips and thrown outward, clear of both shapes, so
  // they read as sparks rather than as dirt on the glyph.
  for (const [sx, sy, sr, seed] of [
    [-0.42, -0.26, 0.030, 41], [-0.33, -0.40, 0.019, 42], [0.41, -0.31, 0.024, 43]
  ] as const) {
    const spark = blob(sx * S, sy * S, sr * S, sr * S, seed, 0.22)
    ctx.save()
    ctx.shadowColor = 'rgba(255, 200, 90, 0.9)'
    ctx.shadowBlur = S * 0.06
    fillShape(ctx, spark, '#ffe6a8')
    ctx.restore()
  }
}

let drawnForge: HTMLCanvasElement | null = null
let drawnForgeUrl: string | null = null

/**
 * The drawn forge as a data URL, for an `<img>` — see `ArtIcon`.
 *
 * Baked once at 256 so it stays crisp on a 3× phone (the chip tops out around
 * 55 px), and kept for the page: the bake is a few hundred path operations and
 * the mark is on screen for the whole run. Returns `null` where a canvas
 * cannot be encoded at all (jsdom, a locked-down context), which is exactly
 * when the glyph underneath has to take over.
 */
export const forgeDataUrl = (): string | null => {
  if (drawnForgeUrl !== null) return drawnForgeUrl
  try {
    if (!drawnForge) {
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 256
      const ctx = c.getContext('2d')
      if (!ctx) return null
      ctx.translate(128, 128)
      paintForge(ctx, 256)
      drawnForge = c
    }
    const url = drawnForge.toDataURL('image/png')
    // jsdom returns a 1×1 stub rather than throwing; anything this short is
    // not an image and must fall through to the glyph.
    if (url.length < 128) return null
    drawnForgeUrl = url
    return url
  } catch {
    return null
  }
}

/**
 * The DOM-side marks this module can DRAW when the pipeline has not painted
 * them — keyed the way `spriteFor` keys the paintings, so `ArtIcon` can ask
 * one question and get the best answer available.
 */
const UI_DRAWN_MARKS: Record<string, () => string | null> = {
  forge: forgeDataUrl
}

/** A drawn stand-in for `images/ui/<id>.webp`, or `null` if there is none. */
export const drawnUiMark = (id: string): string | null =>
  UI_DRAWN_MARKS[id]?.() ?? null

// ─── The icons ──────────────────────────────────────────────────────────────

/** The HUD marks the pipeline paints, and the glyph each one stands in for. */
export const UI_ICON_GLYPH = {
  // The idle reward on the wallet column — NOT the shop, which is `forge`.
  chest: 'chest',
  forge: 'anvil',
  'skill-grenade': 'bomb',
  'skill-shield': 'shield',
  // The two cards of the stage-3 weapon choice — the weapon itself, big, on a
  // lit plate. Their glyphs are the HUD's own weapon marks.
  'weapon-card-rocket': 'rocket',
  'weapon-card-gatling': 'gatling'
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
  // The forge has a drawing of its own — every other mark here IS its glyph.
  if (id === 'forge') {
    paintForge(ctx, size)
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
