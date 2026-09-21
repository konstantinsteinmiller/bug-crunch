import {
  blob, cel, ink, rough, densify, tones, terminator, trace, INK, SHADOW_DIR, type Pt
} from '@/game/inkArt'
import { ICON_PATHS } from '@/components/icons/iconPaths'
import type { GameIconName } from '@/components/icons/iconNames'
import { onArtChanged, spriteFor } from '@/game/art'
import { stripFrames } from '@/game/spriteStrip'
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

export interface UiPaintOpts {
  /** Draw the procedural version even when a painting is available. */
  procedural?: boolean
  /**
   * Draw at FULL opacity, whatever the drawable's own alpha is.
   *
   * Only the splat reads it, and only the bench sets it. A decal is drawn at
   * `JuiceStyleSpec.decalAlpha` in play — 0.42 for confetti, 0.12 for bubble —
   * and a reference exported at that alpha is a reference asking to be painted
   * as a ghost. The picture goes out solid; the game keeps fading it.
   */
  opaque?: boolean
}

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
  pop: number, rot: number, alpha: number, withBurst = true,
  maxWidth = 0
): void => {
  const c = WORD_TONE[tone]
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.rotate(rot)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 ${size}px Angry, system-ui, sans-serif`
  const w = ctx.measureText(text).width
  // ── Fit it on the screen ──
  //
  // A caller sizes a word off the BODY it came out of, which is right for an ant
  // and wrong for a boss: "ULTRA SPLAT!" at a fifteen-unit queen's scale is
  // eleven characters at a cap height of a sixth of the board, and it ran off
  // both edges — the loudest frame in the game rendered as "ULTRA SPLA".
  //
  // Measured rather than guessed at the call site, because the width depends on
  // the string, the face and whether the face has even loaded yet (the fallback
  // `system-ui` is a different width). `measureText` ignores the transform, so
  // the drawn width is `w * pop` and the shrink that fits it is exact.
  const fit = maxWidth > 0 ? Math.min(1, maxWidth / Math.max(1, w * pop)) : 1
  ctx.scale(pop * fit, pop * fit)

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
 * ─── The painted decal ──────────────────────────────────────────────────────
 *
 * The one drawable in this game whose painting cannot be shipped in a colour.
 *
 * `stampSplat` is handed the BUG'S OWN goo — an ant leaves magenta, a sprinter
 * teal, a stinkbug violet, ten designs and ten colours off ONE file — so a
 * painted splat has to be a GREYSCALE silhouette the game tints, which is the
 * contract `greyscale: true` already names in the manifest and `TINTED_GLYPHS`
 * names on the DOM side.
 *
 * ── Tinting a painting on a canvas ──
 *
 * The DOM's route (`mask-image` + `currentColor`) is not available here: this
 * composites into an offscreen floor layer, not into a styled node. The lever
 * is `globalCompositeOperation`, and the choice between its options is the
 * whole design:
 *
 *   ✗ `destination-in` over a flat fill — the mask trick, translated. It keeps
 *     the painting's ALPHA and throws away every pixel of its shading, which
 *     would hand back exactly the flat silhouette that painting it was meant to
 *     replace. Correct for a 20 px button glyph; pointless for a puddle whose
 *     entire value is its dark centre and its wet rim.
 *   ✗ `getImageData` + a per-channel colourise — exact, and a full-canvas
 *     readback. Per stamp that is a GPU sync on the decal layer three hundred
 *     times a level, against a layer that exists precisely so a stomp costs one
 *     blit.
 *   ✗ `ctx.filter` hue-rotate — a hue rotation of grey is grey, so it cannot
 *     reach an arbitrary goo colour at all, and it is unevenly supported.
 *   ✓ MULTIPLY, then restore the alpha. `grey × tint` keeps every value the
 *     painter put down — the dark core stays dark, the mid body takes the goo
 *     colour, the rim highlight lands at the tint's own brightest. The multiply
 *     floods the transparent margin with solid tint, so the painting is drawn
 *     back over it with `destination-in` to cut the silhouette out again. It is
 *     the same three ops `useVfx.bakePuffSprite` already tints the painted dust
 *     puff with, which is the precedent this follows rather than inventing.
 *
 * Plus one op the puff does not need: a small additive pass of the painting at
 * `SPLAT_GLOSS`, which puts a wet shine back on top of the flat multiply.
 * `destination-in` runs last, so nothing it adds escapes the outline.
 *
 * ── Why this is baked and cached ──
 *
 * Four ops per (variant, colour), once, into a canvas the stamp then blits.
 * A level's roster is a handful of designs, so the live set is small; the cache
 * is dropped wholesale past `SPLAT_TINT_BUDGET` rather than evicted one at a
 * time, because the thing it protects against is a long session drifting
 * through every world's palette, not a hot loop.
 *
 * The bake survives the layer fade for free: `stampSplat` thins the whole decal
 * canvas with `destination-out`, which multiplies alpha, and a blitted bitmap
 * is no different there from a path fill.
 */

/**
 * Painted splat shapes per sheet.
 *
 * FOUR, and the number is the product of two things that were already true.
 * The stamp ALREADY varies continuously — a free rotation, a foot-speed
 * stretch, and a seed that moves every finger and droplet — so what a painting
 * adds is the one axis procedure is worst at: a genuinely different SILHOUETTE.
 * Four of those multiplied by a continuous rotation is past the point where an
 * eye finds the repeat on a floor holding `DECAL_BUDGET` marks; nine would be a
 * bigger sheet, a bigger file and the same floor.
 *
 * And four is what this pipeline returns cleanly. A 2x2 lattice is a SQUARE
 * sheet, which is the shape an image model answers with when left alone, and it
 * is half a walk sheet — a layout the desk has already brought back right.
 */
export const SPLAT_VARIANTS = 4
export const SPLAT_COLS = 2
export const SPLAT_ROWS = 2

/**
 * The seeds the bench draws the four reference panels from. Fixed, so a
 * re-export is byte-identical and a diff means the art changed.
 *
 * The seed is the ONLY thing that varies between them, and deliberately so.
 * The reference's four panels do come back looking alike, and the tempting fix
 * is to spread them with the two knobs that actually change a splat's shape —
 * `stretch` and `angle`. Both are wrong here: they are the FOOT'S motion, and
 * `paintSplat` applies them to the painting too, so a smeared reference would be
 * painted smeared and then smeared a second time at every stamp. The panels stay
 * neutral and the variety is asked for in words instead (`variantBlurbs`).
 */
export const SPLAT_REF_SEEDS: readonly number[] = [3, 17, 46, 71]

/**
 * Which painted sheet each juice style stamps from.
 *
 * `JUICE_STYLE`'s rule is that a style changes the PICTURE and the SOUND, never
 * a number — so the paintings have to split exactly where the pictures already
 * do, and no further:
 *
 *   ooze      a puddle of goo. `splat`.
 *   bubble    soap. It has no picture of its own TODAY — `paintSplat` draws it
 *             through the same puddle and the spec's own `decalAlpha` (0.12)
 *             and `decalScale` (0.78) are what make it "almost no decal at all".
 *             So it takes the same painting, faded by the same number, and the
 *             painted build looks like the drawn one did. Giving it a sheet of
 *             its own would be inventing a difference the styles do not have.
 *   confetti  piñata. This one DOES branch in the drawing — chips, not a
 *             puddle — so it gets a sheet of its own. Serving it the goo
 *             painting would put a puddle under an accessibility style whose
 *             entire point is that nothing bursts wetly.
 */
export const SPLAT_SHEET = {
  ooze: 'splat',
  bubble: 'splat',
  confetti: 'splat-confetti'
} as const satisfies Record<JuiceStyleId, string>

export type SplatSheetId = (typeof SPLAT_SHEET)[JuiceStyleId]

/**
 * How far each mark reaches, as a multiple of `r` — the half-width of the box
 * the painting is blitted into, and of the panel it is painted in.
 *
 * `r` is the BODY radius the drawing is built from, and the two pictures do NOT
 * reach the same distance out of it: a goo splat flings droplets to `r * 2.4`
 * while a confetti scatter lays its chips inside `r` and stops. Blitting both
 * into one box would hand the confetti style a decal twice the size of the one
 * it is drawn at today — a "different picture" the styles never agreed to.
 *
 * Two, not 2.4, for the goo. The outermost droplets are specks, and buying room
 * for them costs the BODY: at 2.4 the puddle is 42 % of its panel, which is a
 * painter being told to leave most of the frame empty and reliably answering
 * with a full frame anyway — at 2.4x the size. At 2 the drawing genuinely
 * nearly fills its panel, so "fill the panel" is both the instruction a model
 * obeys most reliably AND the truth, and a painting that obeys it lands with
 * its body on the drawn body. A speck or two clipped at the corner is the
 * price, and it is paid by the reference, not by the game.
 *
 * The bench draws at `half / SPLAT_REACH[sheet]` for the same reason. That one
 * division is the whole registration between a painted splat and a drawn one.
 */
export const SPLAT_REACH: Record<SplatSheetId, number> = {
  splat: 2,
  'splat-confetti': 1.2
}

/** The tinted bake's edge, px. A decal lands at roughly 60–130 px on a phone
 *  and is soft by design; 192 is already a small upsample at the top of that. */
const SPLAT_BAKE_PX = 192
/**
 * How much of the greyscale painting is added back on top of the tint.
 *
 * SMALL, and the number was chosen by looking rather than by reasoning. It
 * started at 0.3 on the theory that `lighter` adds `grey × k` and therefore
 * lands mostly on the near-white specular. That theory is true of a painting
 * with a dark body and false of this one: the splats came back at a mean
 * luminance of 195, so 0.3 was adding a quarter of full white to EVERY pixel
 * and the floor filled with pale pastel smears instead of goo.
 *
 * The obvious repair — run the additive pass through a curve (the painting
 * multiplied onto itself two or four times, so only the near-white survives) —
 * was simulated against this exact file at four settings and came out WORSE
 * than simply turning the flat pass down: the curve still lifts a body that is
 * already at 0.78, and it costs a second canvas and three more ops per bake to
 * do it. So: flat, and 0.12. The painting's own highlight is what reads as the
 * shine; this only wets it.
 */
const SPLAT_GLOSS = 0.12
/** Tinted bakes kept. Four variants across a level's live goo colours is well
 *  inside this; the cap is for a session that walks every world. */
const SPLAT_TINT_BUDGET = 32

const splatTints = new Map<string, HTMLCanvasElement | null>()

/** Does this canvas implementation actually honour a separable blend mode? An
 *  engine that does not silently leaves `source-over` in place, which would
 *  paint every splat a flat slab of goo colour — so it is asked once, and a no
 *  means the drawing keeps drawing. */
let blendOk: boolean | null = null
const canBlend = (): boolean => {
  if (blendOk !== null) return blendOk
  try {
    const t = document.createElement('canvas').getContext('2d')
    if (!t) return (blendOk = false)
    t.globalCompositeOperation = 'multiply'
    blendOk = t.globalCompositeOperation === 'multiply'
  } catch { blendOk = false }
  return blendOk
}

/** One greyscale panel, tinted to `colour` with its shading intact. */
const bakeSplatTint = (
  panel: HTMLCanvasElement, colour: string
): HTMLCanvasElement | null => {
  if (!canBlend()) return null
  try {
    const c = document.createElement('canvas')
    c.width = SPLAT_BAKE_PX
    c.height = SPLAT_BAKE_PX
    const t = c.getContext('2d')
    if (!t) return null
    const P = SPLAT_BAKE_PX
    t.drawImage(panel, 0, 0, P, P)
    // 1. The colour, through the painting's own values.
    t.globalCompositeOperation = 'multiply'
    t.fillStyle = colour
    t.fillRect(0, 0, P, P)
    // 2. The gloss the multiply flattened.
    t.globalCompositeOperation = 'lighter'
    t.globalAlpha = SPLAT_GLOSS
    t.drawImage(panel, 0, 0, P, P)
    // 3. The silhouette back — steps 1 and 2 both paint outside it.
    t.globalAlpha = 1
    t.globalCompositeOperation = 'destination-in'
    t.drawImage(panel, 0, 0, P, P)
    return c
  } catch { return null }
}

/**
 * The painted splat for this style, seed and goo colour — or null, which means
 * "keep drawing it" exactly as everywhere else in this pipeline.
 *
 * WHICH variant is a hash of the seed rather than `seed % n`: the seed is a
 * counter, so the modulo would deal the four shapes out in a fixed rotation,
 * and a player who stomps a neat row of bugs would be looking at one.
 */
const splatSprite = (
  style: JuiceStyleId, seed: number, colour: string
): HTMLCanvasElement | null => {
  const sheet = SPLAT_SHEET[style]
  const panels = stripFrames('fx', sheet, 1)
  if (!panels || panels.length === 0) return null
  const v = Math.floor(hash(seed, 101) * panels.length) % panels.length
  const key = `${sheet}|${v}|${colour}`
  const hit = splatTints.get(key)
  if (hit !== undefined) return hit
  if (splatTints.size >= SPLAT_TINT_BUDGET) splatTints.clear()
  const baked = bakeSplatTint(panels[v]!, colour)
  splatTints.set(key, baked)
  return baked
}

// A tint is made FROM a painting, so it is only as good as the painting it was
// made from. `stripFrames` drops its own slices when the art layer changes;
// these are the bakes on top of those, and they have to go with them.
onArtChanged((change) => {
  if (!change) splatTints.clear()
  else if (change.kind === 'fx' && change.id.startsWith('splat')) splatTints.clear()
})

/**
 * A splat: the mark a squish leaves on the floor, forever.
 *
 * The GDD asks for a decal "procedurally scaled by foot speed and insect mass",
 * stamped into a persistent floor canvas. This is the stamp.
 *
 * A PAINTING FIRST, when one has decoded — tinted to the goo it came out of,
 * turned and smeared by the same transform the drawing gets. Otherwise the
 * drawing, which is three parts and needs all three to read as a splat rather
 * than as a blot:
 *   1. a central blob with an irregular rim,
 *   2. radiating fingers — the thing that says something BURST,
 *   3. satellite droplets, scattered further out than the fingers reach.
 *
 * `stretch` and `angle` are the foot's motion at the moment of impact: a splat
 * made by a sliding foot is smeared along its travel, which is the cheapest
 * possible way to make a slide feel different from a stomp. BOTH branches apply
 * them, identically, so a slide leaves the same smear whether the mark under it
 * is painted or drawn — which is also why the painting itself must be neutral
 * (see `SPLAT_REF_SEEDS`).
 */
export const paintSplat = (
  ctx: CanvasRenderingContext2D,
  r: number, colour: string, seed: number,
  style: JuiceStyleId = 'ooze', stretch = 1, angle = 0,
  opts?: UiPaintOpts
): void => {
  const spec = JUICE_STYLE[style]
  const alpha = opts?.opaque ? 1 : spec.decalAlpha

  if (!opts?.procedural) {
    const painted = splatSprite(style, seed, colour)
    if (painted) {
      const R = r * SPLAT_REACH[SPLAT_SHEET[style]]
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.rotate(angle)
      ctx.scale(stretch, 1 / Math.max(0.6, Math.sqrt(stretch)))
      ctx.drawImage(painted, -R, -R, R * 2, R * 2)
      ctx.restore()
      return
    }
  }

  ctx.save()
  ctx.rotate(angle)
  ctx.scale(stretch, 1 / Math.max(0.6, Math.sqrt(stretch)))
  ctx.fillStyle = colour
  ctx.globalAlpha = alpha

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

  // 2. Fingers — tapering teardrops radiating out of the body, each with a BULB
  //    on its tip.
  //
  //    The bulb is the one addition that changed how these read, and it is not
  //    decoration: thrown liquid does not taper to a point, it necks and then
  //    beads, because surface tension pulls the leading edge back into a ball
  //    faster than the neck behind it can follow. Every splash photograph and
  //    every hand-painted cartoon splat has them. Without one a finger is a
  //    SPIKE, and eight spikes out of a circle is a sun, not a splat — which is
  //    what the first cut of this looked like on a busy floor.
  const fingers = 6 + Math.floor(hash(seed + 7, 0) * 5)
  for (let i = 0; i < fingers; i++) {
    const a = hash(seed + 11, i) * Math.PI * 2
    const len = r * (0.9 + hash(seed + 13, i) * 1.0)
    const wid = r * (0.1 + hash(seed + 17, i) * 0.16)
    // Beaded on most of them, not all: a mark where every finger ends the same
    // way is as mechanical as a mark where none of them does.
    const bulb = hash(seed + 31, i) > 0.28 ? wid * (0.62 + hash(seed + 37, i) * 0.7) : 0
    ctx.save()
    ctx.rotate(a)
    ctx.beginPath()
    ctx.moveTo(0, -wid)
    // The neck pinches in behind the bead — `wid * 0.34` at 80 % of the length
    // against the bead's own radius at the tip.
    ctx.quadraticCurveTo(len * 0.62, -wid * 0.52, len * 0.86, -Math.max(wid * 0.2, bulb * 0.5))
    ctx.quadraticCurveTo(len, -bulb * 0.9, len + bulb * 0.5, 0)
    ctx.quadraticCurveTo(len, bulb * 0.9, len * 0.86, Math.max(wid * 0.2, bulb * 0.5))
    ctx.quadraticCurveTo(len * 0.62, wid * 0.52, 0, wid)
    ctx.closePath()
    ctx.fill()
    if (bulb > 0) {
      ctx.beginPath()
      ctx.arc(len + bulb * 0.35, 0, bulb, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // 3. TENDRILS — two or three long thin arms that reach much further than a
  //    finger and curve as they go.
  //
  //    What they buy is SILHOUETTE. A splat built only from a lobed body and a
  //    ring of fingers has one outline at every seed: a blob with bumps. The
  //    tendrils are what make one mark on the floor read as a different event
  //    from the one next to it, and they cost three quadratics each into a layer
  //    that is stamped once and never redrawn.
  const tendrils = 2 + Math.floor(hash(seed + 41, 1) * 2)
  for (let i = 0; i < tendrils; i++) {
    const a = hash(seed + 43, i) * Math.PI * 2
    const len = r * (1.5 + hash(seed + 47, i) * 0.85)
    const wid = r * (0.075 + hash(seed + 53, i) * 0.06)
    // Which way it whips. Signed off the hash so a mark is not all one-handed.
    const bend = (hash(seed + 59, i) - 0.5) * len * 0.75
    const tip = wid * (0.9 + hash(seed + 61, i) * 0.9)
    ctx.save()
    ctx.rotate(a)
    ctx.beginPath()
    ctx.moveTo(0, -wid * 1.5)
    ctx.quadraticCurveTo(len * 0.55, bend - wid * 0.5, len, bend)
    ctx.quadraticCurveTo(len * 0.55, bend + wid * 0.5, 0, wid * 1.5)
    ctx.closePath()
    ctx.fill()
    // …and the bead flung off its end, sitting just past the tip.
    ctx.beginPath()
    ctx.arc(len + tip * 0.4, bend, tip, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // 4. Droplets — the loose scatter, out to `SPLAT_REACH`'s own 2.4 r and no
  //    further, because that number is the registration between this drawing and
  //    the painting that replaces it.
  for (let i = 0; i < 12; i++) {
    const a = hash(seed + 19, i) * Math.PI * 2
    const d = r * (1.1 + hash(seed + 23, i) * 1.3)
    const s = r * (0.05 + hash(seed + 29, i) * 0.13)
    ctx.beginPath()
    // Stretched ALONG its own flight line rather than round: a droplet that
    // landed while it was still moving is an oval pointing away from the body,
    // and a floor covered in circles reads as spots rather than as spray.
    ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, s * 1.35, s * 0.78, a, 0, Math.PI * 2)
    ctx.fill()
  }

  // A darker core, so the puddle has depth rather than being one flat colour.
  ctx.globalAlpha = alpha * 0.45
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.42, r * 0.36, hash(seed, 3) * 3, 0, Math.PI * 2)
  ctx.fill()

  // …and the WET SHINE over it: a crescent on the upper-left rim, which is the
  // light direction every other object on this board is lit from.
  //
  // White, and therefore invisible on the reference sheet — where the body is
  // drawn white so the painter sends a greyscale silhouette. That is the right
  // trade: the reference asks for the highlight in words ("a bright wet
  // highlight runs along the upper-left rim") and the DRAWN build, which is what
  // every portal ships, is the build that needs the drawing to carry it.
  ctx.globalAlpha = alpha * 0.34
  ctx.fillStyle = 'rgba(255,255,255,1)'
  ctx.beginPath()
  ctx.ellipse(-r * 0.2, -r * 0.24, r * 0.4, r * 0.2, -0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = alpha * 0.2
  ctx.beginPath()
  ctx.ellipse(r * 0.22, r * 0.1, r * 0.17, r * 0.1, 0.5, 0, Math.PI * 2)
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
 * A rounded rectangle as a point loop.
 *
 * Everything else in this file is a `blob` or a hand-listed polygon so it can
 * go through `cel`, `terminator` and `ink` like any other drawn shape. The
 * banner's plate is the one piece that genuinely wants straight sides, and a
 * bare `ctx.roundRect` would not survive `rough()` or take an ink contour.
 */
const roundedLoop = (
  x0: number, y0: number, x1: number, y1: number, r: number
): Pt[] => {
  const rad = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2)
  const pts: Pt[] = []
  const corner = (cx: number, cy: number, from: number): void => {
    for (let i = 0; i <= 6; i++) {
      const a = from + (i / 6) * (Math.PI / 2)
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad])
    }
  }
  corner(x1 - rad, y0 + rad, -Math.PI / 2)
  corner(x1 - rad, y1 - rad, 0)
  corner(x0 + rad, y1 - rad, Math.PI / 2)
  corner(x0 + rad, y0 + rad, Math.PI)
  return pts
}

/**
 * The banner: a plate of dark iron with two gold rails, capped at each end by
 * a gold block with a round stud in it. The middle stays plain, because the
 * title goes there.
 *
 * This used to be a swallow-tailed ribbon in picnic red, and it was the odd one
 * out in two directions at once. `FReward`'s own layout has always described
 * the banner as a plate of dark iron, and once the PAINTING was made that, the
 * drawn version was a different design for the same element: red with the art
 * layer off, dark iron with it on, and a visible red-to-dark pop in between as
 * the painting decoded.
 *
 * It matters past the fallback. `ArtSheets` draws the ribbon's REFERENCE from
 * this function, so a red drawing here is a red layout handed to the painter,
 * and the next repaint comes back red however the prompt is worded.
 *
 * Everything that can stretch is a HORIZONTAL. The middle of this image is
 * pulled to the width of whatever caption sits in it (`border-image`, sliced at
 * `BANNER.cap`), so the two rails are the only long elements — a line survives
 * any scale — and every piece of detail, caps and studs, sits inside the outer
 * `cap` of each end where the nine-slice never stretches.
 */
export const paintBanner = (
  ctx: CanvasRenderingContext2D, w: number, h: number, o?: UiPaintOpts
): void => {
  const painted = o?.procedural ? null : spriteFor('ui', 'ribbon')
  if (painted) {
    ctx.drawImage(painted, 0, 0, w, h)
    return
  }
  const iron = tones('#1f1b1d', 0.95)
  const gold = tones('#f4c551', 1)
  const top = h * 0.113
  const bot = h * 0.883
  const mid = h / 2

  ctx.save()

  const plate = rough(
    densify(roundedLoop(w * 0.047, top, w * 0.953, bot, h * 0.13), 8),
    h * 0.0012, 7, 0.5
  )
  // The plate's light is a BAND, not a terminator. `terminator` measures its
  // offset against the shape's longest axis, and this shape is nearly three
  // times as wide as it is tall: every offset that reads as "a rim along the
  // top" on a creature lands hundreds of pixels clear of the plate here. A flat
  // slab lit from above wants a hard rim along its top edge anyway, so the band
  // is also the truer drawing — and the body stays one even value, because this
  // is the surface a caption has to be legible on.
  const lit = rough(densify([
    [-w, top - h * 0.05], [w * 2, top - h * 0.05],
    [w * 2, top + (bot - top) * 0.1], [-w, top + (bot - top) * 0.1]
  ] as Pt[], 10), h * 0.006, 5, 0.6)
  cel(ctx, plate, iron, { lit })

  // The bottom edge catches the light too — it is a bevel, not an underside,
  // and drawing it dark would make the plate read as peeling up off the card.
  ctx.save()
  ctx.beginPath()
  trace(ctx, plate)
  ctx.clip()
  ctx.strokeStyle = iron.lit
  ctx.lineWidth = h * 0.05
  ctx.beginPath()
  ctx.moveTo(w * 0.05, bot - h * 0.018)
  ctx.lineTo(w * 0.95, bot - h * 0.018)
  ctx.stroke()
  ctx.restore()

  // The rails. Shadow line first, so the gold sits on its own dark edge under
  // the same upper-left key light the rest of the game is drawn to.
  ctx.lineCap = 'round'
  for (const y of [h * 0.219, h * 0.76]) {
    ctx.strokeStyle = gold.shade
    ctx.lineWidth = h * 0.062
    ctx.beginPath()
    ctx.moveTo(w * 0.133, y + h * 0.009)
    ctx.lineTo(w * 0.867, y + h * 0.009)
    ctx.stroke()
    ctx.strokeStyle = gold.base
    ctx.lineWidth = h * 0.048
    ctx.beginPath()
    ctx.moveTo(w * 0.133, y)
    ctx.lineTo(w * 0.867, y)
    ctx.stroke()
    ctx.strokeStyle = gold.lit
    ctx.lineWidth = h * 0.014
    ctx.beginPath()
    ctx.moveTo(w * 0.14, y - h * 0.015)
    ctx.lineTo(w * 0.86, y - h * 0.015)
    ctx.stroke()
  }

  // The end caps and their studs, both wholly inside the un-stretched band.
  for (const side of [0, 1] as const) {
    const sx = (x: number): number => (side === 0 ? x : w - x)
    const l = Math.min(sx(w * 0.052), sx(w * 0.124))
    const r = Math.max(sx(w * 0.052), sx(w * 0.124))
    const block = rough(
      densify(roundedLoop(l, h * 0.328, r, h * 0.66, h * 0.055), 7),
      h * 0.0012, 11 + side, 0.5
    )
    cel(ctx, block, gold, {
      shade: terminator(block, SHADOW_DIR, 0.52, 0.05, 13 + side),
      lit: terminator(block, SHADOW_DIR + Math.PI, 0.58, 0.05, 15 + side)
    })
    ink(ctx, block, { width: h * 0.02, color: INK, seed: 17 + side, breakUp: 0.04 })

    const stud = blob((l + r) / 2, mid, h * 0.036, h * 0.036, 21 + side, 0.04)
    cel(ctx, stud, tones('#d79a12', 1), {
      lit: terminator(stud, SHADOW_DIR + Math.PI, 0.45, 0.08, 23 + side)
    })
    ink(ctx, stud, { width: h * 0.012, color: INK, seed: 25 + side, breakUp: 0.12 })
  }

  ink(ctx, plate, { width: h * 0.032, color: INK, seed: 41, breakUp: 0.03 })
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

// ─── The treasure chest ─────────────────────────────────────────────────────

/**
 * The HUD's idle chest, centred on the origin, `size` px square.
 *
 * A CANVAS twin of the inline SVG in `TreasureChest.vue`, authored in the same
 * 64-unit box and built from the same path data, so the reference sheet the art
 * pipeline exports is provably the chest the player sees rather than a second
 * drawing of one. The SVG stays the thing on screen: it carries the cooldown
 * clip region and the gold-phase sparkles, which are STATE, not art, and have
 * no business in a reference.
 *
 * It has to exist because `images/ui/chest.webp` is the one UI mark with no
 * glyph behind it. Every other one maps to a shared icon path through
 * `UI_ICON_GLYPH`, which is how `paintUiIcon` draws their references — and the
 * chest is a full-colour drawing with a domed lid, a lip band, cel shading and
 * a clasp, none of which a 24x24 button silhouette carries. Without this the
 * exporter's `ui` branch fell through to `paintUiIcon(ctx, 'chest', …)`, which
 * finds no glyph, returns silently, and writes a BLANK MAGENTA SQUARE as the
 * reference a painter is then asked to work from.
 *
 * The four rules it keeps are the ones every drawable in this game keeps
 * (`inkArt.ts`): one ink colour, one key light from the upper left, fat even
 * ink with generous radii because the chest is ~38 px tall on a phone, and warm
 * honey wood with a butter-gold clasp — no grey, no black, no rivets. It is a
 * present, not a strongbox.
 */
export const paintChest = (ctx: CanvasRenderingContext2D, size: number): void => {
  const k = size / 64
  ctx.save()
  ctx.translate(-size / 2, -size / 2)
  ctx.scale(k, k)

  /** A vertical gradient across one part's own box, as the SVG's
   *  `objectBoundingBox` gradients are. */
  const grad = (y0: number, y1: number, top: string, bottom: string): CanvasGradient => {
    const g = ctx.createLinearGradient(0, y0, 0, y1)
    g.addColorStop(0, top)
    g.addColorStop(1, bottom)
    return g
  }

  const lid = new Path2D('M9 33 C9 18 18 12.5 32 12.5 C46 12.5 55 18 55 33 Z')
  const body = new Path2D()
  body.roundRect(9.5, 34, 45, 20, 4.5)
  const lip = new Path2D()
  lip.roundRect(7, 30, 50, 6.5, 3.2)
  const clasp = new Path2D()
  clasp.roundRect(26.5, 28, 11, 14, 3.2)

  // Contact shadow, offset down-and-right, so the chest sits on the HUD rather
  // than floating over it.
  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.ellipse(33.5, 55.5, 21, 3.6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ── The box: body, lid, lip — each filled then inked, in that order ──
  ctx.lineJoin = 'round'
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.6
  ctx.fillStyle = grad(34, 54, '#ffc76f', '#e8862a')
  ctx.fill(body)
  ctx.stroke(body)
  ctx.fillStyle = grad(12.5, 33, '#ffe6ab', '#f5a842')
  ctx.fill(lid)
  ctx.stroke(lid)
  ctx.fillStyle = grad(30, 36.5, '#ffe6ab', '#f5a842')
  ctx.fill(lip)
  ctx.stroke(lip)

  // ── Cel shading: drawn shapes with hard edges, each clipped to its own part
  // so the body's shadow cannot spill onto the lid. Never a computed gradient —
  // a cel painter puts the dark where it reads.
  ctx.save()
  ctx.clip(body)
  ctx.globalAlpha = 0.42
  ctx.fillStyle = '#c96a16'
  ctx.fill(new Path2D('M44 32 C47.5 40 47 48 43.5 56 L58 56 L58 32 Z'))
  ctx.restore()

  ctx.save()
  ctx.clip(lid)
  ctx.globalAlpha = 0.36
  ctx.fillStyle = '#d98a22'
  ctx.fill(new Path2D('M43 10 C49 16 50.5 25 49.5 35 L59 35 L59 10 Z'))
  // The key light: one soft smear on the top-left shoulder.
  ctx.globalAlpha = 0.55
  ctx.fillStyle = '#fff6df'
  ctx.beginPath()
  ctx.ellipse(22, 21.5, 8, 3.6, (-22 * Math.PI) / 180, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // One plank seam, low on the body where it will not collide with the clasp.
  // Two lines turn to mush at HUD size.
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = '#c96a16'
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(12.5, 48.5)
  ctx.lineTo(51.5, 48.5)
  ctx.stroke()
  ctx.restore()

  // ── The clasp, and the keyhole: a disc and a tapering slot, ink on gold ──
  ctx.fillStyle = grad(28, 42, '#fff0b4', '#efb02c')
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.4
  ctx.fill(clasp)
  ctx.stroke(clasp)
  ctx.fillStyle = INK
  ctx.fill(new Path2D('M32 33.2 a2.1 2.1 0 1 1 0.01 0 M30.9 35.2 h2.2 l0.7 3.4 h-3.6 Z'))

  ctx.restore()
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
