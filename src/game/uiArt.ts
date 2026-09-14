import {
  blob, cel, ink, rough, densify, tones, terminator, INK, SHADOW_DIR, type Pt
} from '@/game/inkArt'
import { ICON_PATHS } from '@/components/icons/iconPaths'
import type { GameIconName } from '@/components/icons/iconNames'
import { spriteFor } from '@/game/art'
import { JUICE_STYLE, type JuiceStyleId } from '@/game/juiceStyle'
import type { SplatWord } from '@/game/combo'

/**
 * ─── The comic layer ────────────────────────────────────────────────────────
 *
 * Bug Crunch is a game about hitting things, and the single loudest piece of
 * feedback it has is the WORD that pops out of an impact: SQUISH!, CRUNCH!,
 * SPLAT!, ULTRA SPLAT! The reference sheets are built around them. They are
 * drawn here, on the canvas, in the game's own display face, because a DOM
 * element cannot be spawned forty times a second and cannot be rotated,
 * skewed and spring-scaled for free.
 *
 * Also here: the splat decal the floor keeps, the shockwave rings, the star,
 * and the result banner the DOM shows through a `border-image`.
 */

/** Draw the procedural version even when a painting is available. */
export interface UiPaintOpts { procedural?: boolean }

// ─── Comic word pops ────────────────────────────────────────────────────────

/**
 * The palette each chain tier's word is shouted in.
 *
 * Deliberately a LADDER of temperature, not four arbitrary colours: white-pink
 * for the first rung, gold in the middle, hot orange-red at the top. A player
 * who is not reading the word can still read the heat.
 */
export const WORD_TONE: Record<SplatWord, { fill: string; fill2: string; edge: string; burst: string }> = {
  squish: { fill: '#ffffff', fill2: '#ffd7e6', edge: '#d9297a', burst: 'rgba(255,110,170,0.55)' },
  crunch: { fill: '#fff6c8', fill2: '#ffd93c', edge: '#b26a00', burst: 'rgba(255,190,60,0.55)' },
  splat: { fill: '#ffe27a', fill2: '#ff9f2e', edge: '#9c3200', burst: 'rgba(255,140,40,0.6)' },
  ultra: { fill: '#ffffff', fill2: '#ff5d5d', edge: '#7a0014', burst: 'rgba(255,70,90,0.68)' }
}

/**
 * A jagged comic burst — the spiky star behind a shouted word.
 *
 * `n` points, alternating between `r` and `r * inner`, each perturbed by a
 * fixed per-vertex amount so no two bursts are the same shape and none of them
 * is a perfect star.
 */
const burstPath = (
  ctx: CanvasRenderingContext2D, r: number, n: number, inner: number, seed: number
): void => {
  ctx.beginPath()
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    const h = (Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1
    const jitter = 1 + (Math.abs(h) - 0.5) * 0.26
    const rr = (i % 2 === 0 ? r : r * inner) * jitter
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr * 0.88
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/**
 * One comic word, centred on the origin.
 *
 * `size` is the cap height in px. `pop` is the spring scale the sim drives
 * (overshoots past 1 and settles), `rot` a small fixed tilt so a burst of them
 * does not read as a list, and `alpha` the fade-out.
 *
 * The text is drawn FOUR times — a thick dark edge, a shadow offset, the fill
 * gradient and a white top-light — which is what gives it the sticker-cut look
 * the reference sheets have. All four are one `fillText` each; it is far
 * cheaper than it sounds and it is the game's loudest single piece of art.
 */
export const paintComicWord = (
  ctx: CanvasRenderingContext2D,
  text: string, tone: SplatWord, size: number,
  pop: number, rot: number, alpha: number, withBurst = true
): void => {
  const c = WORD_TONE[tone]
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.rotate(rot)
  ctx.scale(pop, pop)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${size}px Angry, system-ui, sans-serif`
  const w = ctx.measureText(text).width

  if (withBurst) {
    burstPath(ctx, Math.max(w * 0.62, size * 1.15), 11, 0.68, text.length + size)
    ctx.fillStyle = c.burst
    ctx.fill()
  }

  // The cut edge: a wide stroke under everything, so the letters read as one
  // object rather than as outlined glyphs.
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.34
  ctx.strokeStyle = INK
  ctx.strokeText(text, 0, 0)
  ctx.lineWidth = size * 0.2
  ctx.strokeStyle = c.edge
  ctx.strokeText(text, 0, 0)

  const g = ctx.createLinearGradient(0, -size * 0.6, 0, size * 0.6)
  g.addColorStop(0, c.fill)
  g.addColorStop(1, c.fill2)
  ctx.fillStyle = g
  ctx.fillText(text, 0, 0)

  // A clipped white band across the top third — the glossy sticker highlight.
  ctx.save()
  ctx.beginPath()
  ctx.rect(-w, -size * 0.72, w * 2, size * 0.42)
  ctx.clip()
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  ctx.fillText(text, 0, 0)
  ctx.restore()

  ctx.restore()
}

// ─── The splat decal ────────────────────────────────────────────────────────

const hash = (a: number, b: number): number => {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * A splat: the mark a squish leaves on the floor, forever.
 *
 * The GDD asks for a decal "procedurally scaled by foot speed and insect mass",
 * stamped into a persistent floor canvas. This is the stamp.
 *
 * Three parts, and all three are needed for it to read as a splat rather than
 * as a blot:
 *   1. a central blob with an irregular rim,
 *   2. radiating fingers — the thing that says something BURST,
 *   3. satellite droplets, scattered further out than the fingers reach.
 *
 * `stretch` and `angle` are the foot's motion at the moment of impact: a splat
 * made by a sliding foot is smeared along its travel, which is the cheapest
 * possible way to make a slide feel different from a stomp.
 */
export const paintSplat = (
  ctx: CanvasRenderingContext2D,
  r: number, colour: string, seed: number,
  style: JuiceStyleId = 'ooze', stretch = 1, angle = 0
): void => {
  const spec = JUICE_STYLE[style]
  ctx.save()
  ctx.rotate(angle)
  ctx.scale(stretch, 1 / Math.max(0.6, Math.sqrt(stretch)))
  ctx.fillStyle = colour
  ctx.globalAlpha = spec.decalAlpha

  if (style === 'confetti') {
    // Chips, not a puddle. Confetti leaves litter.
    for (let i = 0; i < 16; i++) {
      const a = hash(seed, i) * Math.PI * 2
      const d = Math.sqrt(hash(seed + 1, i)) * r
      const s = r * (0.08 + hash(seed + 2, i) * 0.1)
      ctx.save()
      ctx.translate(Math.cos(a) * d, Math.sin(a) * d)
      ctx.rotate(hash(seed + 3, i) * Math.PI)
      ctx.fillRect(-s, -s * 0.55, s * 2, s * 1.1)
      ctx.restore()
    }
    ctx.restore()
    return
  }

  // 1. The body — a 15-vertex wobbling loop.
  const n = 15
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 0.62 + hash(seed, i) * 0.5
    xs.push(Math.cos(a) * r * k)
    ys.push(Math.sin(a) * r * k)
  }
  ctx.beginPath()
  ctx.moveTo((xs[n - 1]! + xs[0]!) / 2, (ys[n - 1]! + ys[0]!) / 2)
  for (let i = 0; i < n; i++) {
    ctx.quadraticCurveTo(
      xs[i]!, ys[i]!,
      (xs[i]! + xs[(i + 1) % n]!) / 2, (ys[i]! + ys[(i + 1) % n]!) / 2
    )
  }
  ctx.closePath()
  ctx.fill()

  // 2. Fingers — tapering teardrops radiating out of the body.
  const fingers = 5 + Math.floor(hash(seed + 7, 0) * 4)
  for (let i = 0; i < fingers; i++) {
    const a = hash(seed + 11, i) * Math.PI * 2
    const len = r * (0.9 + hash(seed + 13, i) * 1.0)
    const wid = r * (0.1 + hash(seed + 17, i) * 0.16)
    ctx.save()
    ctx.rotate(a)
    ctx.beginPath()
    ctx.moveTo(0, -wid)
    ctx.quadraticCurveTo(len * 0.7, -wid * 0.55, len, 0)
    ctx.quadraticCurveTo(len * 0.7, wid * 0.55, 0, wid)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // 3. Droplets.
  for (let i = 0; i < 9; i++) {
    const a = hash(seed + 19, i) * Math.PI * 2
    const d = r * (1.1 + hash(seed + 23, i) * 1.3)
    const s = r * (0.05 + hash(seed + 29, i) * 0.13)
    ctx.beginPath()
    ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, s, s * 0.82, a, 0, Math.PI * 2)
    ctx.fill()
  }

  // A darker core, so the puddle has depth rather than being one flat colour.
  ctx.globalAlpha = spec.decalAlpha * 0.45
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.42, r * 0.36, hash(seed, 3) * 3, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// ─── Rings ──────────────────────────────────────────────────────────────────

/**
 * A shockwave: a ring that expands, thins and fades.
 *
 * `p01` is 0 at the impact and 1 when it is gone. The ring is drawn with an
 * inner glow pass and an outer hard pass — two strokes, and it is what makes a
 * slam read as a physical event rather than a growing circle.
 */
export const paintShockRing = (
  ctx: CanvasRenderingContext2D, r: number, p01: number, colour: string, thick = 1
): void => {
  const e = 1 - Math.pow(1 - p01, 2.2)
  const rr = r * (0.18 + e * 0.94)
  const a = Math.max(0, 1 - p01) ** 1.4
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = colour
  ctx.globalAlpha = a * 0.35
  ctx.lineWidth = Math.max(2, r * 0.16 * thick * (1 - e * 0.6))
  ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = a * 0.9
  ctx.lineWidth = Math.max(1.2, r * 0.055 * thick * (1 - e * 0.6))
  ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()
}

/** The alert badge a dodger wears the instant it has noticed the shadow. */
export const paintAlert = (
  ctx: CanvasRenderingContext2D, size: number, pop: number
): void => {
  ctx.save()
  ctx.scale(pop, pop)
  burstPath(ctx, size, 9, 0.7, 4)
  ctx.fillStyle = '#ff3b5c'
  ctx.fill()
  ctx.lineWidth = size * 0.14
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.roundRect(-size * 0.11, -size * 0.52, size * 0.22, size * 0.6, size * 0.1)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, size * 0.38, size * 0.13, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** A five-point star, filled or hollow. The objective pip and the fever mark. */
export const paintStar = (
  ctx: CanvasRenderingContext2D, r: number, filled: boolean
): void => {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
    const rr = i % 2 === 0 ? r : r * 0.44
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  if (filled) {
    const g = ctx.createLinearGradient(0, -r, 0, r)
    g.addColorStop(0, '#fff3b0')
    g.addColorStop(1, '#ffb703')
    ctx.fillStyle = g
    ctx.fill()
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fill()
  }
  ctx.lineWidth = r * 0.16
  ctx.lineJoin = 'round'
  ctx.strokeStyle = INK
  ctx.stroke()
}

// ─── The result banner ──────────────────────────────────────────────────────

/**
 * The banner's reference box, and the one number that binds the painting to
 * the CSS that shows it.
 *
 * 21:9 — a ratio the image tools offer — because the file's shape is only the
 * END PIECES' shape: the banner is nine-sliced (three, really — two ends kept
 * at true size and a middle stretched to the caption), so its height on screen
 * is the caption's line and its width is the caption's width. `cap` is how much
 * of the width each end piece takes, and it is where ALL the detail goes; the
 * middle is a plain band precisely because it gets stretched.
 */
export const BANNER = { w: 1344, h: 576, cap: 0.171 } as const

/**
 * The banner: a fat sticker-cut ribbon in picnic red and cream, swallow-tailed
 * at both ends, with a gold bind top and bottom and a button at each notch.
 * The middle stays plain — the title goes there.
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
  const notch = cap * 0.55
  const top = h * 0.07
  const bot = h * 0.93
  const mid = h / 2
  const cloth = tones('#e8534f', 1.2)
  const gold = tones('#ffcd00', 1)

  ctx.save()

  const plate: Pt[] = rough(densify([
    [0, top], [w, top], [w - notch, mid], [w, bot], [0, bot], [notch, mid]
  ] as Pt[], 8), h * 0.005, 7, 0.7)
  cel(ctx, plate, cloth, {
    shade: terminator(plate, Math.PI / 2, 0.35, 0.05, 3),
    lit: terminator(plate, -Math.PI / 2, 0.62, 0.04, 5)
  })

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

  for (const side of [0, 1] as const) {
    const sx = (x: number): number => (side === 0 ? x : w - x)
    const button = blob(sx(notch + h * 0.15), mid, h * 0.075, h * 0.075, 21 + side, 0.05)
    cel(ctx, button, gold, {
      shade: terminator(button, SHADOW_DIR, 0.1, 0.1, 23 + side),
      lit: terminator(button, SHADOW_DIR + Math.PI, 0.6, 0.08, 25 + side)
    })
    ink(ctx, button, { width: h * 0.014, color: INK, seed: 27 + side, breakUp: 0.2 })
    for (const y of [top + h * 0.19, bot - h * 0.19]) {
      const stitch = blob(sx(cap * 0.86), y, h * 0.032, h * 0.032, 31 + side, 0.08)
      cel(ctx, stitch, tones('#fdf4ea', 1), {
        lit: terminator(stitch, SHADOW_DIR + Math.PI, 0.5, 0.1, 33 + side)
      })
      ink(ctx, stitch, { width: h * 0.01, color: INK, seed: 35 + side, breakUp: 0.2 })
    }
  }

  ink(ctx, plate, { width: h * 0.026, color: INK, seed: 41, breakUp: 0.06 })
  ctx.restore()
}

let drawnBanner: HTMLCanvasElement | null = null
let drawnBannerUrl: string | null = null

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

/** The drawn banner as a data URL, for a `border-image`. Baked once per page. */
export const bannerDataUrl = (): string => {
  if (drawnBannerUrl === null) drawnBannerUrl = bannerCanvas().toDataURL('image/png')
  return drawnBannerUrl
}

/** The banner blitted the way CSS shows it — the playground's way of proving a
 *  painting's caps land where the drawing's do. */
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

// ─── UI marks the art pipeline can repaint ──────────────────────────────────

/**
 * The HUD drawables that are SVG glyphs filled through `Path2D`, so their
 * reference sheet shows exactly the silhouette the button shows.
 *
 * Each entry maps a pipeline id (`images/ui/<id>.webp`) to the glyph it is
 * drawn from. A painting replaces the glyph; the glyph is the floor under it.
 */
export const UI_ICON_GLYPH = {
  'locker': 'boot',
  'fever': 'flame',
  'star': 'star',
  'timer': 'clock',
  'target': 'target',
  'trophy': 'trophy'
} as const satisfies Record<string, GameIconName>

export type UiIconId = keyof typeof UI_ICON_GLYPH

export const UI_ICON_IDS = Object.keys(UI_ICON_GLYPH) as UiIconId[]

/**
 * One UI mark, centred on the origin, `size` px square.
 *
 * The glyph set is authored in a 24×24 box, so the path is scaled by
 * `size / 24` and offset to the centre. A painting at `images/ui/<id>.webp`
 * replaces it wholesale.
 */
export const paintUiIcon = (
  ctx: CanvasRenderingContext2D, id: UiIconId, size: number, o?: UiPaintOpts
): void => {
  const painted = o?.procedural ? null : spriteFor('ui', id)
  if (painted) {
    ctx.drawImage(painted, -size / 2, -size / 2, size, size)
    return
  }
  const subPaths = ICON_PATHS[UI_ICON_GLYPH[id]]
  if (!subPaths || subPaths.length === 0) return
  ctx.save()
  ctx.translate(-size / 2, -size / 2)
  ctx.scale(size / 24, size / 24)
  // The glyphs are authored as a LIST of sub-paths filled with the nonzero
  // winding rule, so a counter-wound sub-path punches a hole through the ones
  // before it (the shield's band, the skull's eyes). Appending them all into one
  // `Path2D` and filling once is what preserves that; filling them one at a time
  // would paint the holes solid.
  const path = new Path2D()
  for (const d of subPaths) path.addPath(new Path2D(d))
  ctx.fillStyle = '#ffffff'
  ctx.fill(path, 'nonzero')
  ctx.restore()
}

/** A UI mark as a data URL, for an `<img>` in the DOM. Cached per id. */
const iconUrls = new Map<UiIconId, string>()

export const uiIconDataUrl = (id: UiIconId, size = 128): string | null => {
  const hit = iconUrls.get(id)
  if (hit) return hit
  try {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.translate(size / 2, size / 2)
    paintUiIcon(ctx, id, size * 0.86, { procedural: true })
    const url = c.toDataURL('image/png')
    iconUrls.set(id, url)
    return url
  } catch {
    return null
  }
}

/** The drawn stand-in for a UI mark an `ArtIcon` asked for, or null when this
 *  module has no drawing of it. */
export const drawnUiMark = (id: string): string | null =>
  id === 'ribbon' ? bannerDataUrl()
    : (UI_ICON_IDS as string[]).includes(id) ? uiIconDataUrl(id as UiIconId) : null
