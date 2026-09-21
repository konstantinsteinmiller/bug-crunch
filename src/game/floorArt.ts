/**
 * ─── The forty floors ───────────────────────────────────────────────────────
 *
 * One seamless tile per LEVEL, baked ONCE into an offscreen canvas and then
 * used as a `createPattern` fill for the whole board. That is the difference
 * between a background that costs one `fillRect` a frame and one that costs a
 * few hundred path operations.
 *
 * This file is the drawing half. The DATA half — which floor a level is on,
 * and what colours that floor is made of — is `floors.ts`, and every painter
 * below is handed its palette rather than reaching for a colour of its own.
 * That is not tidiness: it is what makes `tests/game/floorPalette.test.ts` a
 * test of the PICTURE instead of a test of a list. A painter that mixed its own
 * brown would be a painter the legibility rules cannot see.
 *
 * Two things a painter may still mix, and only two:
 *
 *   · NEUTRAL highlight and shadow — white or black at low alpha. They carry no
 *     hue the rules do not already know about, and they are what a lip, a
 *     bevel and a drop shadow are made of on every surface in the game.
 *   · a SECOND MATERIAL, stated inline — the moss in a flagstone's joint, the
 *     clover in the lawn. Always a small, low-alpha tuft: it is something
 *     growing ON the floor rather than the floor, and the field underneath it
 *     is still the field the test judges.
 *
 * ── Why one floor per level ──
 *
 * Ten picnic levels on one red blanket is the same picture ten times, and a
 * world is six or seven minutes long. The blanket stopped being a place and
 * became a background. So the ten floors of a world are ten surfaces of that
 * one place — the blanket, the table it is laid on, the paper cloth, the lawn,
 * the patio, the path, the basket lid, the floured board, the decking, the
 * napkin — and the world still reads as one afternoon.
 *
 * ── Seamlessness is the whole job ──
 *
 * Every mark that runs off one edge of the tile must arrive at the opposite
 * edge in the same place, or the board shows a grid of seams — the single most
 * common way a tiled backdrop announces itself. There are exactly three ways
 * anything here stays seamless, and every painter uses one of them:
 *
 *   1. it DIVIDES the tile (a check, a plank, a ruled grid) on a number that
 *      goes into 256 a whole number of times;
 *   2. it CROSSES the tile end to end (a scanline, a full-width ripple whose
 *      wavelength divides 256, a 45° stripe at a spacing that divides 256);
 *   3. it is STAMPED — drawn again at every wrapped copy of itself that could
 *      still touch the tile, which is what `stamp` does so no painter has to
 *      think about it case by case.
 *
 * ── Why the floor is not just colour ──
 *
 * The floor is where the splat decals land, and a decal on a flat colour reads
 * as a sticker. Every tile carries a low-contrast texture — weave, grass
 * blades, wood grain, scanlines — that the decals sit INTO.
 *
 * ── What is per-world and what is per-level ──
 *
 * The SURFACE is the level's. The LIGHT is the world's: `floorAmbient` and
 * `VIGNETTE_STRENGTH` are still keyed on the world, because a wash laid over
 * bugs, splats and foot alike is what makes four worlds read as four places,
 * and a wash that changed every level would make a world read as forty. It is
 * also the cheap half of the identity — ten attic floors under one cold violet
 * veil are unmistakably the attic, whatever they are made of.
 */

import { spriteFor } from '@/game/art'
import { floorArtIdFor } from '@/game/artCatalogue'
import {
  FLOORS, FLOOR_PALETTE, floorForLevel, isLeadFloor, worldOfFloor,
  type FloorId, type FloorPalette
} from '@/game/floors'
import type { WorldId } from '@/game/stages'
import { WORLDS } from '@/game/stages'

export { floorForLevel }
export type { FloorId }

/** Tile edge in px. 256 is big enough that the repeat is not obvious at phone
 *  scale and small enough to bake in well under a frame — and it divides by 2,
 *  4, 8, 16, 32 and 64, which is what every ruled painter below needs. */
export const FLOOR_TILE_PX = 256

/** Shorthand. Every painter works in this square and nothing else. */
const N = FLOOR_TILE_PX

/**
 * Either a floor by name, or a WORLD — which names that world's LEAD floor,
 * the tile it shipped with and the one the art pipeline has a painting of.
 *
 * The world form is not a shim for the renderer (that passes a level's floor):
 * it is for the callers that genuinely are about a world rather than a level —
 * the cutscenes, the art bench's reference sheets, the Peek card, the reward
 * reveal. "Show me the attic" has one right answer and this is it.
 */
export type FloorRef = FloorId | WorldId

const floorOf = (ref: FloorRef): FloorId =>
  typeof ref === 'number' ? FLOORS[ref][0]! : ref

const hash = (a: number, b: number): number => {
  let h = (a * 374761393 + b * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177 | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Run `fn` at (x, y) and at every wrapped copy of it that could still touch the
 * tile, so a mark drawn near an edge continues on the far side.
 */
const stamp = (
  ctx: CanvasRenderingContext2D, x: number, y: number, reach: number,
  fn: (ctx: CanvasRenderingContext2D) => void
): void => {
  const dxs = x < reach ? [0, N] : x > N - reach ? [0, -N] : [0]
  const dys = y < reach ? [0, N] : y > N - reach ? [0, -N] : [0]
  for (const dx of dxs) {
    for (const dy of dys) {
      ctx.save()
      ctx.translate(x + dx, y + dy)
      fn(ctx)
      ctx.restore()
    }
  }
}

// ─── The kit ────────────────────────────────────────────────────────────────
//
// Ten primitives that between them make all forty floors. Each one is seamless
// by construction — by the rules above — so a painter is a palette, two or
// three of these, and the one detail that makes the surface itself.
//
// They are deliberately small and dumb. A "draw me a patio" helper would have
// been one more thing to read before you could change a floor; a "slabs" helper
// that takes the joint colour is a thing you can see the whole of.

/** Flood the tile. Every painter starts with this or with `wash`. */
const flood = (ctx: CanvasRenderingContext2D, colour: string): void => {
  ctx.fillStyle = colour
  ctx.fillRect(0, 0, N, N)
}

/** Flood with a gradient. Seamless because it is the FIELD, not a mark — the
 *  eye reads a soft ramp across a tile as light, not as an edge. */
const wash = (
  ctx: CanvasRenderingContext2D, a: string, b: string, diagonal = false
): void => {
  const g = ctx.createLinearGradient(0, 0, diagonal ? N : 0, N)
  g.addColorStop(0, a)
  g.addColorStop(1, b)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, N, N)
}

/** A checkerboard, `cells` per edge. `cells` must divide 256. */
const checker = (
  ctx: CanvasRenderingContext2D, cells: number, colour: string, alpha = 1
): void => {
  const s = N / cells
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = colour
  for (let y = 0; y < cells; y++) {
    for (let x = (y % 2); x < cells; x += 2) ctx.fillRect(x * s, y * s, s, s)
  }
  ctx.restore()
}

/**
 * Two crossing half-opacity stripe sets — a gingham.
 *
 * The overlap is the dark square, which is exactly how the real weave works and
 * why it looks right: three tones out of one colour, and no third value to pick.
 */
const gingham = (
  ctx: CanvasRenderingContext2D, cells: number, stripe: string, alpha = 0.55
): void => {
  const s = N / cells
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = stripe
  for (let i = 0; i < cells; i += 2) {
    ctx.fillRect(i * s, 0, s, N)
    ctx.fillRect(0, i * s, N, s)
  }
  ctx.restore()
}

/** A fine thread grid: light one way, dark the other, at whisper alpha. The
 *  cloth texture every fabric floor sits on. */
const weave = (
  ctx: CanvasRenderingContext2D, step: number, light: number, dark: number
): void => {
  ctx.save()
  ctx.lineWidth = 1
  ctx.strokeStyle = `rgba(255,255,255,${light})`
  for (let i = 0; i < N; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, N); ctx.stroke()
  }
  ctx.strokeStyle = `rgba(0,0,0,${dark})`
  for (let i = 0; i < N; i += step) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(N, i); ctx.stroke()
  }
  ctx.restore()
}

/**
 * `n` scattered specks — grit, crumbs, dust, stars, pebbles.
 *
 * `pick` is handed the index so a painter can vary colour and alpha per speck
 * without n separate loops, and every speck is stamped, so a tile is never
 * ringed by a band of bare field.
 */
const speckle = (
  ctx: CanvasRenderingContext2D, n: number, seed: number,
  rMin: number, rMax: number, pick: (i: number) => string
): void => {
  for (let i = 0; i < n; i++) {
    const x = hash(seed, i) * N
    const y = hash(seed + 1, i) * N
    const r = rMin + hash(seed + 2, i) * (rMax - rMin)
    const squash = 0.6 + hash(seed + 3, i) * 0.6
    const rot = hash(seed + 4, i) * Math.PI
    stamp(ctx, x, y, r + 2, (g) => {
      g.fillStyle = pick(i)
      g.beginPath(); g.ellipse(0, 0, r, r * squash, rot, 0, Math.PI * 2); g.fill()
    })
  }
}

/**
 * `n` short strokes leaning off their own root — blades, fibres, straw, pile.
 *
 * `spread` is how far off `angle` a stroke may lean, in radians; `angle` 0 is
 * straight up. A grass blade is this with a small spread and a wool pile is
 * this with a full one.
 */
const fibres = (
  ctx: CanvasRenderingContext2D, n: number, seed: number, colour: string,
  len: number, width: number, angle = 0, spread = 0.35
): void => {
  ctx.save()
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const x = hash(seed, i) * N
    const y = hash(seed + 1, i) * N
    const a = angle + (hash(seed + 2, i) - 0.5) * 2 * spread
    const l = len * (0.65 + hash(seed + 3, i) * 0.7)
    const bend = (hash(seed + 4, i) - 0.5) * l * 0.5
    stamp(ctx, x, y, l + width + 2, (g) => {
      g.rotate(a)
      g.beginPath()
      g.moveTo(0, 0)
      g.quadraticCurveTo(bend * 0.5, -l * 0.6, bend, -l)
      g.stroke()
    })
  }
  ctx.restore()
}

/**
 * `count` boards across the tile, a seam and a highlight at each join.
 *
 * `count` must divide 256. `vertical` lays them the other way — a plank floor
 * and a decking are the same helper turned ninety degrees, and that is most of
 * why there are nine wooden floors in this file and not nine wooden painters.
 */
const boards = (
  ctx: CanvasRenderingContext2D, count: number, vertical: boolean,
  pick: (i: number) => string, seam: string, gloss = 0.07
): void => {
  const w = N / count
  ctx.save()
  if (vertical) { ctx.translate(N, 0); ctx.rotate(Math.PI / 2) }
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = pick(i)
    ctx.fillRect(0, i * w, N, w)
    ctx.fillStyle = seam
    ctx.fillRect(0, i * w, N, 3)
    ctx.fillStyle = `rgba(255,255,255,${gloss})`
    ctx.fillRect(0, i * w + 3, N, 2)
  }
  ctx.restore()
}

/** Long shallow nearly-parallel arcs inside a band — wood grain. Each one runs
 *  the full width and returns to its own height, so it wraps. */
const grain = (
  ctx: CanvasRenderingContext2D, y0: number, y1: number, n: number,
  colour: string, width: number, seed: number
): void => {
  ctx.save()
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  for (let i = 0; i < n; i++) {
    const y = y0 + ((i + 0.5) / n) * (y1 - y0) + (hash(seed, i) - 0.5) * 4
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(
      N * 0.3, y + (hash(seed + 1, i) - 0.5) * 7,
      N * 0.7, y - (hash(seed + 2, i) - 0.5) * 7,
      N, y
    )
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * A grid of joints — slabs, panes, lino, a neon floor.
 *
 * `cells` must divide 256. Drawn twice when `glow` is on: once wide and faint,
 * once narrow and bright, which is a bloom for the price of two strokes.
 */
const ruled = (
  ctx: CanvasRenderingContext2D, cells: number, colour: string,
  width: number, alpha: number, glow = false
): void => {
  const s = N / cells
  ctx.save()
  ctx.strokeStyle = colour
  const passes: Array<[number, number]> = glow
    ? [[width * 4.5, alpha * 0.18], [width, alpha]]
    : [[width, alpha]]
  for (const [w, a] of passes) {
    ctx.globalAlpha = a
    ctx.lineWidth = w
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, N); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(N, i * s); ctx.stroke()
    }
  }
  ctx.restore()
}

/** A full-width ripple. Its wavelength divides the tile, so both ends meet. */
const ripple = (
  ctx: CanvasRenderingContext2D, y: number, amp: number, waves: number,
  phase: number, colour: string, width: number
): void => {
  ctx.save()
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  ctx.beginPath()
  for (let x = 0; x <= N; x += 4) {
    const yy = y + Math.sin((x / N) * waves * Math.PI * 2 + phase) * amp
    if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy)
  }
  ctx.stroke()
  ctx.restore()
}

/**
 * Stripes at exactly 45°, spaced so they meet themselves at the edge.
 *
 * The slope has to be exactly 1 and the spacing has to divide 256, or the
 * stripe that leaves the right edge arrives at the left one a few pixels out
 * and the board grows a corduroy of seams. `offset` slides the whole set, which
 * is how a fold gets a lit side and a shaded one out of two calls.
 */
const diagonals = (
  ctx: CanvasRenderingContext2D, spacing: number, colour: string,
  width: number, alpha: number, offset = 0
): void => {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = colour
  ctx.lineWidth = width
  for (let k = -N + offset; k < N * 2; k += spacing) {
    ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k + N, N); ctx.stroke()
  }
  ctx.restore()
}

/** Dark horizontal rules every `step` px — a CRT without a shader, and the
 *  matting under half the arcade. */
const scanlines = (
  ctx: CanvasRenderingContext2D, step: number, alpha: number, thickness = 1.4
): void => {
  ctx.save()
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  for (let y = 0; y < N; y += step) ctx.fillRect(0, y, N, thickness)
  ctx.restore()
}

/**
 * The same colour at zero alpha — the far stop of every soft bloom.
 *
 * The spec says a gradient interpolates in premultiplied alpha, which would
 * make a stop of `rgba(0,0,0,0)` safe; naming the colour makes it safe in a
 * browser that does not, where a pale bloom fading to transparent BLACK picks
 * up a grey halo. It costs one regex at bake time and nothing at all per frame.
 */
const fade = (colour: string): string => {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour)
  if (hex) {
    return `rgba(${parseInt(hex[1]!, 16)},${parseInt(hex[2]!, 16)},${parseInt(hex[3]!, 16)},0)`
  }
  const rgb = /^rgba?\(\s*([^,]+),\s*([^,]+),\s*([^,)]+)/i.exec(colour)
  if (rgb) return `rgba(${rgb[1]!.trim()},${rgb[2]!.trim()},${rgb[3]!.trim()},0)`
  return 'rgba(0,0,0,0)'
}

/** A soft radial bloom — a worn patch, a drift of flour, a dent, a nebula. */
const bloom = (
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  colour: string, alpha: number
): void => {
  stamp(ctx, x, y, r + 2, (g) => {
    const gg = g.createRadialGradient(0, 0, 1, 0, 0, r)
    gg.addColorStop(0, colour)
    gg.addColorStop(1, fade(colour))
    g.save()
    g.globalAlpha = alpha
    g.fillStyle = gg
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill()
    g.restore()
  })
}

type TileDraw = (ctx: CanvasRenderingContext2D, p: FloorPalette) => void

// ═══ World 1 — the picnic ═══════════════════════════════════════════════════

/** 1-1 — the red gingham blanket the game opens on. */
const picnicGingham: TileDraw = (ctx, p) => {
  flood(ctx, p.alt)
  gingham(ctx, 4, p.base)
  weave(ctx, 4, 0.055, 0.045)
  // A few stray crumbs for life. Not the `crumbs` hazard — these do nothing.
  speckle(ctx, 14, 1, 1.4, 3.6, () => 'rgba(224,184,119,0.75)')
}

/** 1-2 — the picnic table with the blanket off it: sun-bleached pine, laid the
 *  short way, four boards and a knot in one of them. */
const picnicPlanks: TileDraw = (ctx, p) => {
  boards(ctx, 4, true, (i) => (i % 2 === 0 ? p.base : p.alt), p.shade, 0.10)
  ctx.save()
  ctx.translate(N, 0); ctx.rotate(Math.PI / 2)
  for (let i = 0; i < 4; i++) grain(ctx, i * 64 + 8, i * 64 + 58, 7, 'rgba(0,0,0,0.10)', 1.1, i * 9)
  ctx.restore()
  // Two knots. A knot is three rings of the board's own shade, squashed along
  // the grain — the one mark that says "sawn" rather than "painted".
  for (let i = 0; i < 2; i++) {
    const x = 34 + Math.floor(hash(11, i) * 4) * 64
    const y = 40 + hash(12, i) * 170
    stamp(ctx, x, y, 16, (g) => {
      for (let k = 3; k >= 1; k--) {
        g.strokeStyle = `rgba(0,0,0,${0.05 + k * 0.03})`
        g.lineWidth = 1.6
        g.beginPath(); g.ellipse(0, 0, k * 3.4, k * 5.2, 0, 0, Math.PI * 2); g.stroke()
      }
      g.fillStyle = p.shade
      g.beginPath(); g.ellipse(0, 0, 2.6, 4, 0, 0, Math.PI * 2); g.fill()
    })
  }
}

/** 1-3 — the paper tablecloth from the shop. Creases from the fold, a printed
 *  dot, and the brightest field in world 1: the easiest floor in the game to
 *  find a bug on, one level before the first boss asks you to. */
const picnicPaper: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // The creases sit on the quarter lines, which is where a folded cloth creases
  // and also, conveniently, where they wrap.
  ctx.save()
  for (const x of [64, 192]) {
    ctx.fillStyle = p.alt; ctx.fillRect(x - 1, 0, 2, N)
    ctx.fillStyle = p.line; ctx.fillRect(x + 1, 0, 1.5, N)
  }
  for (const y of [32, 160]) {
    ctx.fillStyle = p.alt; ctx.fillRect(0, y - 1, N, 2)
    ctx.fillStyle = p.line; ctx.fillRect(0, y + 1, N, 1.5)
  }
  ctx.restore()
  // The print: a dot on a 32 px lattice, every other row nudged half a cell.
  ctx.save()
  ctx.globalAlpha = 0.55
  ctx.fillStyle = p.alt
  for (let ry = 0; ry < 8; ry++) {
    for (let rx = 0; rx < 8; rx++) {
      const x = rx * 32 + (ry % 2 === 0 ? 8 : 24)
      const y = ry * 32 + 16
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
  speckle(ctx, 20, 21, 0.6, 1.4, () => 'rgba(0,0,0,0.05)')
}

/** 1-4 — the lawn the blanket was on, trodden flat and sun-dried. Yellow-green
 *  on purpose: the caterpillar is the one bug in world 1 that is GREEN, and a
 *  green bug on a green floor is the whole of what this file exists to stop. */
const picnicGrass: TileDraw = (ctx, p) => {
  wash(ctx, p.base, p.alt, true)
  // Three worn patches where feet have been, under the blades.
  for (let i = 0; i < 3; i++) {
    bloom(ctx, hash(31, i) * N, hash(32, i) * N, 46, p.shade, 0.16)
  }
  fibres(ctx, 110, 33, 'rgba(0,0,0,0.13)', 11, 2.2)
  fibres(ctx, 110, 37, p.line, 10, 1.6)
  speckle(ctx, 18, 39, 1, 2.4, () => 'rgba(255,248,205,0.5)')
}

/** 1-5 — patio slabs, pale sandstone, with a sandy joint between them. */
const picnicPatio: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // Four slabs. Each gets its own tone and its own mottle so the repeat does
  // not read as four copies of one stone.
  for (let sy = 0; sy < 2; sy++) {
    for (let sx = 0; sx < 2; sx++) {
      const i = sy * 2 + sx
      ctx.save()
      ctx.globalAlpha = 0.35 + hash(41, i) * 0.4
      ctx.fillStyle = i % 3 === 0 ? p.alt : p.base
      ctx.fillRect(sx * 128, sy * 128, 128, 128)
      ctx.restore()
      for (let k = 0; k < 5; k++) {
        bloom(ctx, sx * 128 + 20 + hash(42 + i, k) * 88, sy * 128 + 20 + hash(43 + i, k) * 88,
          18, p.alt, 0.22)
      }
    }
  }
  // The joints, and a bright top edge on each slab so the stone has a lip.
  ruled(ctx, 2, p.shade, 5, 0.85)
  ruled(ctx, 2, p.line, 1.4, 0.7)
  speckle(ctx, 90, 47, 0.5, 1.5, (i) => (i % 2 === 0 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.22)'))
}

/** 1-6 — the sandy path down to the table: a rake's drift, grit and pebbles. */
const picnicSand: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // The rake. Wavelengths of 2 and 3 over the tile, so both meet themselves.
  // The amplitude is capped at 5 and the rows are 18 apart: a ripple that
  // swings further than half its lane would be clipped at the tile's top and
  // bottom, which is a seam wearing a sand ripple's clothes.
  for (let i = 0; i < 14; i++) {
    const y = (i + 0.5) * (N / 14)
    const amp = 3 + hash(51, i) * 2
    ripple(ctx, y, amp, i % 2 === 0 ? 2 : 3, hash(52, i) * 6, p.alt, 5)
    ripple(ctx, y - 3, amp, i % 2 === 0 ? 2 : 3, hash(52, i) * 6, p.line, 1.6)
  }
  speckle(ctx, 200, 53, 0.4, 1.2, (i) => (i % 3 === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.08)'))
  // Pebbles, with a shadow under each — the only thing on this floor with any
  // height, which is what stops it reading as paper.
  for (let i = 0; i < 9; i++) {
    const x = hash(54, i) * N
    const y = hash(55, i) * N
    const r = 3 + hash(56, i) * 3
    stamp(ctx, x, y, r + 4, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.13)'
      g.beginPath(); g.ellipse(1, 1.6, r, r * 0.8, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = p.shade
      g.beginPath(); g.ellipse(0, 0, r, r * 0.78, hash(57, i) * 3, 0, Math.PI * 2); g.fill()
      g.fillStyle = 'rgba(255,255,255,0.26)'
      g.beginPath(); g.ellipse(-r * 0.3, -r * 0.3, r * 0.4, r * 0.28, 0, 0, Math.PI * 2); g.fill()
    })
  }
}

/** 1-7 — the picnic basket's lid, seen from above: over-under cane. */
const picnicWicker: TileDraw = (ctx, p) => {
  flood(ctx, p.alt)
  const s = N / 8
  // Over-under: on every cell, the strand that is ON TOP alternates, which is
  // the whole illusion. Both strands are drawn every cell; the order changes.
  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 8; cx++) {
      const over = (cx + cy) % 2 === 0
      const x = cx * s
      const y = cy * s
      const strand = (horizontal: boolean): void => {
        ctx.save()
        ctx.translate(x + s / 2, y + s / 2)
        if (!horizontal) ctx.rotate(Math.PI / 2)
        ctx.fillStyle = horizontal ? p.base : p.alt
        ctx.fillRect(-s / 2 - 1, -s * 0.36, s + 2, s * 0.72)
        ctx.fillStyle = 'rgba(255,255,255,0.16)'
        ctx.fillRect(-s / 2 - 1, -s * 0.34, s + 2, s * 0.16)
        ctx.fillStyle = 'rgba(0,0,0,0.16)'
        ctx.fillRect(-s / 2 - 1, s * 0.22, s + 2, s * 0.14)
        ctx.restore()
      }
      strand(!over)
      strand(over)
    }
  }
  // Split cane: a hairline down the middle of every strand.
  ruled(ctx, 8, p.line, 1, 0.3)
  speckle(ctx, 40, 61, 0.5, 1.3, () => 'rgba(0,0,0,0.08)')
}

/** 1-8 — the board the sandwiches were cut on, still floured. */
const picnicFlour: TileDraw = (ctx, p) => {
  flood(ctx, p.alt)
  grain(ctx, 0, N, 16, 'rgba(0,0,0,0.07)', 1.2, 71)
  // The flour: big soft drifts, then the fine stuff that settled everywhere.
  for (let i = 0; i < 6; i++) {
    bloom(ctx, hash(72, i) * N, hash(73, i) * N, 46 + hash(74, i) * 30, p.base, 0.55)
  }
  speckle(ctx, 240, 75, 0.5, 2, (i) => `rgba(255,255,255,${0.12 + hash(76, i) * 0.3})`)
  // Two knife scores through the flour, down to the wood. Drawn as one-wave
  // ripples rather than as slanted lines: a slanted line does not arrive back
  // at its own height, and a score that jumps 6 px at the seam is a seam.
  ctx.save()
  ctx.globalAlpha = 0.45
  for (const y of [78, 186]) {
    ripple(ctx, y, 3, 1, 1.2, p.shade, 1.6)
    ripple(ctx, y + 2, 3, 1, 1.2, p.line, 1)
  }
  ctx.restore()
}

/** 1-9 — garden decking: grooved slats with a dark gap between them. */
const picnicDecking: TileDraw = (ctx, p) => {
  boards(ctx, 4, false, (i) => (i % 2 === 0 ? p.base : p.alt), p.shade, 0.09)
  // The grooves. Machine-cut, evenly spaced, which is what makes decking read
  // as decking rather than as planks — and they run end to end, so they wrap.
  ctx.save()
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 4; i++) {
    for (let k = 1; k < 8; k++) {
      const y = i * 64 + 6 + k * 7
      ctx.fillStyle = p.shade; ctx.fillRect(0, y, N, 1.2)
      ctx.fillStyle = p.line; ctx.fillRect(0, y + 1.2, N, 1)
    }
  }
  ctx.restore()
  // Two screws a slat, on the quarter lines.
  for (let i = 0; i < 4; i++) {
    for (const x of [48, 176]) {
      stamp(ctx, x, i * 64 + 32, 6, (g) => {
        g.fillStyle = 'rgba(0,0,0,0.35)'
        g.beginPath(); g.arc(0, 0, 2.6, 0, Math.PI * 2); g.fill()
        g.strokeStyle = 'rgba(255,255,255,0.22)'
        g.lineWidth = 1
        g.beginPath(); g.moveTo(-1.8, 0); g.lineTo(1.8, 0); g.stroke()
      })
    }
  }
}

/** 1-10 — the chequered napkin. The blanket's check again, finer and blue, so
 *  the world's last floor rhymes with its first and the Queen is fought on a
 *  picture the player has been looking at since 1-1. */
const picnicNapkin: TileDraw = (ctx, p) => {
  flood(ctx, p.alt)
  gingham(ctx, 8, p.base)
  weave(ctx, 4, 0.06, 0.05)
  // Hemstitch: a dotted rule on the eighth lines, the way a napkin is finished.
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = p.line
  for (const t of [0, 128]) {
    for (let k = 0; k < N; k += 8) {
      ctx.fillRect(k, t, 4, 1.4)
      ctx.fillRect(t, k, 1.4, 4)
    }
  }
  ctx.restore()
}

// ═══ World 2 — the backyard ═════════════════════════════════════════════════

/** 2-1 — the overgrown lawn the world shipped with. */
const yardLawn: TileDraw = (ctx, p) => {
  wash(ctx, p.base, p.alt, true)
  // Blades. Two passes — a dark one behind, a light one in front — so the mat
  // has depth without a single gradient per blade.
  fibres(ctx, 120, 3, 'rgba(0,0,0,0.16)', 16, 2.4)
  fibres(ctx, 120, 11, p.line, 14, 1.8)
  // Clover: three lobes, occasionally.
  for (let i = 0; i < 6; i++) {
    stamp(ctx, hash(31, i) * N, hash(37, i) * N, 12, (c) => {
      c.fillStyle = 'rgba(140,220,110,0.5)'
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + hash(41, i) * 3
        c.beginPath()
        c.ellipse(Math.cos(a) * 4, Math.sin(a) * 4, 4.2, 3.4, a, 0, Math.PI * 2)
        c.fill()
      }
    })
  }
}

/** 2-2 — flagstones with moss creeping the joints. */
const yardFlagstone: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  for (let sy = 0; sy < 2; sy++) {
    for (let sx = 0; sx < 2; sx++) {
      const i = sy * 2 + sx
      ctx.save()
      ctx.globalAlpha = 0.3 + hash(81, i) * 0.35
      ctx.fillStyle = p.alt
      ctx.fillRect(sx * 128, sy * 128, 128, 128)
      ctx.restore()
      // Cleavage: the flat split every quarried stone has across its face.
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.strokeStyle = p.shade
      ctx.lineWidth = 1.4
      for (let k = 0; k < 3; k++) {
        const y = sy * 128 + 24 + k * 34 + hash(82 + i, k) * 12
        ctx.beginPath()
        ctx.moveTo(sx * 128 + 8, y)
        ctx.quadraticCurveTo(sx * 128 + 64, y + (hash(83 + i, k) - 0.5) * 14, sx * 128 + 120, y)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
  ruled(ctx, 2, p.shade, 7, 0.75)
  // The moss. It lives in the joints, which is exactly where it lives.
  ctx.save()
  ctx.globalAlpha = 0.5
  fibres(ctx, 24, 84, '#6f9a52', 5, 2.2, 0, 1.2)
  ctx.restore()
  for (const t of [0, 128]) {
    for (let k = 0; k < 6; k++) {
      bloom(ctx, t + (hash(85, k) - 0.5) * 10, hash(86, k) * N, 11, '#6f9a52', 0.3)
      bloom(ctx, hash(87, k) * N, t + (hash(88, k) - 0.5) * 10, 11, '#6f9a52', 0.3)
    }
  }
  ruled(ctx, 2, p.line, 1.2, 0.5)
}

/** 2-3 — a clover carpet: trefoils packed over short turf. */
const yardClover: TileDraw = (ctx, p) => {
  wash(ctx, p.base, p.alt)
  fibres(ctx, 90, 91, 'rgba(0,0,0,0.12)', 8, 2)
  // Forty trefoils, each a little rosette of three lobes with a pale heart.
  for (let i = 0; i < 40; i++) {
    const x = hash(92, i) * N
    const y = hash(93, i) * N
    const r = 4 + hash(94, i) * 2.6
    const rot = hash(95, i) * 6.3
    const bright = i % 5 === 0
    stamp(ctx, x, y, r * 2.4, (g) => {
      g.fillStyle = bright ? p.line : p.alt
      for (let k = 0; k < 3; k++) {
        const a = rot + (k / 3) * Math.PI * 2
        g.beginPath()
        g.ellipse(Math.cos(a) * r, Math.sin(a) * r, r * 0.95, r * 0.75, a, 0, Math.PI * 2)
        g.fill()
      }
      g.fillStyle = 'rgba(255,255,255,0.18)'
      g.beginPath(); g.arc(0, 0, r * 0.4, 0, Math.PI * 2); g.fill()
    })
  }
}

/** 2-4 — the pea-gravel path round the side of the house. */
const yardGravel: TileDraw = (ctx, p) => {
  flood(ctx, p.shade)
  // Three sizes, back to front, so the bed looks deep rather than sprinkled.
  for (const [n, rMin, rMax, seed] of [
    [120, 4, 7, 101], [150, 2.6, 5, 111], [160, 1.4, 3, 121]
  ] as Array<[number, number, number, number]>) {
    for (let i = 0; i < n; i++) {
      const x = hash(seed, i) * N
      const y = hash(seed + 1, i) * N
      const r = rMin + hash(seed + 2, i) * (rMax - rMin)
      const tone = hash(seed + 3, i)
      stamp(ctx, x, y, r + 3, (g) => {
        g.fillStyle = 'rgba(0,0,0,0.22)'
        g.beginPath(); g.ellipse(0.8, 1.2, r, r * 0.85, 0, 0, Math.PI * 2); g.fill()
        g.fillStyle = tone < 0.34 ? p.alt : tone < 0.72 ? p.base : p.line
        g.beginPath()
        g.ellipse(0, 0, r, r * (0.72 + hash(seed + 4, i) * 0.3), hash(seed + 5, i) * 3, 0, Math.PI * 2)
        g.fill()
      })
    }
  }
}

/** 2-5 — straw mulch over the vegetable bed: long dry stems, crossed every
 *  which way, and nothing underneath but shadow. */
const yardStraw: TileDraw = (ctx, p) => {
  // The bed under the mulch is more mulch, not a void: floods with `alt` so the
  // gaps between stems read as straw dust rather than as holes.
  flood(ctx, p.alt)
  for (const [n, colour, w, seed] of [
    [70, 'rgba(0,0,0,0.20)', 5, 131],
    [80, p.alt, 3.4, 141],
    [80, p.base, 2.6, 151],
    [50, p.line, 1.8, 161]
  ] as Array<[number, string, number, number]>) {
    ctx.save()
    ctx.strokeStyle = colour
    ctx.lineWidth = w
    ctx.lineCap = 'round'
    for (let i = 0; i < n; i++) {
      const x = hash(seed, i) * N
      const y = hash(seed + 1, i) * N
      const a = hash(seed + 2, i) * Math.PI
      const l = 26 + hash(seed + 3, i) * 40
      stamp(ctx, x, y, l + 6, (g) => {
        g.rotate(a)
        g.beginPath(); g.moveTo(-l / 2, 0); g.lineTo(l / 2, (hash(seed + 4, i) - 0.5) * 5); g.stroke()
      })
    }
    ctx.restore()
  }
}

/** 2-6 — sun-bleached brick pavers, laid in a running bond. */
const yardBrick: TileDraw = (ctx, p) => {
  flood(ctx, p.shade)
  // Eight courses of 32, four bricks of 64 to a course, every other course
  // shoved half a brick. Both numbers divide 256, so the bond wraps.
  for (let row = 0; row < 8; row++) {
    const off = row % 2 === 0 ? 0 : 32
    for (let b = -1; b < 4; b++) {
      const x = off + b * 64
      const i = row * 7 + b
      const tone = hash(171, i)
      stamp(ctx, x + 32, row * 32 + 16, 40, (g) => {
        g.fillStyle = tone < 0.45 ? p.base : tone < 0.8 ? p.alt : p.line
        g.fillRect(-30, -14, 60, 28)
        g.fillStyle = 'rgba(255,255,255,0.14)'
        g.fillRect(-30, -14, 60, 2.5)
        g.fillStyle = 'rgba(0,0,0,0.10)'
        g.fillRect(-30, 11, 60, 3)
      })
    }
  }
  speckle(ctx, 120, 181, 0.5, 1.6, (i) => (i % 2 === 0 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.18)'))
}

/** 2-7 — artificial turf. Machine-even tufts in ruled rows, which is exactly
 *  what makes it read as fake six levels after the real lawn. */
const yardTurf: TileDraw = (ctx, p) => {
  flood(ctx, p.shade)
  // The rubber backing, showing through between the rows.
  ruled(ctx, 32, p.alt, 2, 0.35)
  const rows = 32
  for (let r = 0; r < rows; r++) {
    const y = (r + 1) * (N / rows)
    for (let c = 0; c < 32; c++) {
      // Nudged 2 px in so the outermost blade's lean never crosses the edge:
      // this is the one painter with no jitter to stamp, and it does not need
      // one — machine-even is the point.
      const x = c * 8 + (r % 2 === 0 ? 2 : 6)
      ctx.save()
      ctx.strokeStyle = r % 3 === 0 ? p.line : (c % 2 === 0 ? p.base : p.alt)
      ctx.lineWidth = 2.6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 1.6, y - 9)
      ctx.moveTo(x, y)
      ctx.lineTo(x + 1.6, y - 9)
      ctx.stroke()
      ctx.restore()
    }
  }
}

/** 2-8 — a drift of fallen leaves, gone pale and dry. */
const yardLeaves: TileDraw = (ctx, p) => {
  // Eighty, on a bed of `alt`: a DRIFT of leaves is leaves all the way down,
  // and forty on a dark ground left a third of the tile reading as bare earth.
  flood(ctx, p.alt)
  for (let i = 0; i < 80; i++) {
    const x = hash(191, i) * N
    const y = hash(192, i) * N
    const r = 13 + hash(193, i) * 9
    const rot = hash(194, i) * 6.3
    const tone = hash(195, i)
    stamp(ctx, x, y, r + 6, (g) => {
      g.rotate(rot)
      g.fillStyle = 'rgba(0,0,0,0.16)'
      g.beginPath(); g.ellipse(1.5, 2, r, r * 0.52, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = tone < 0.38 ? p.alt : tone < 0.76 ? p.base : p.line
      g.beginPath(); g.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2); g.fill()
      // The midrib and two veins. Three strokes is all a leaf needs at this size.
      g.strokeStyle = 'rgba(0,0,0,0.16)'
      g.lineWidth = 1
      g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke()
      g.beginPath(); g.moveTo(-r * 0.2, 0); g.lineTo(r * 0.4, -r * 0.34); g.stroke()
      g.beginPath(); g.moveTo(-r * 0.2, 0); g.lineTo(r * 0.4, r * 0.34); g.stroke()
    })
  }
}

/** 2-9 — the shallow edge of the pond: lily pads and ripple rings. */
const yardPond: TileDraw = (ctx, p) => {
  wash(ctx, p.base, p.alt, true)
  // Rings, each a full-width ripple, so the water is moving without a frame
  // of animation anywhere in it.
  for (let i = 0; i < 9; i++) {
    const y = (i + 0.5) * (N / 9)
    ripple(ctx, y, 3.4, 2, hash(201, i) * 6.3, 'rgba(255,255,255,0.18)', 2.4)
    ripple(ctx, y + 4, 3.4, 2, hash(201, i) * 6.3, p.shade, 1.2)
  }
  // Six pads, each with the wedge cut out of it that makes a lily pad a lily
  // pad, and a bright rim where the water meets it.
  for (let i = 0; i < 6; i++) {
    const x = hash(202, i) * N
    const y = hash(203, i) * N
    const r = 17 + hash(204, i) * 9
    const rot = hash(205, i) * 6.3
    stamp(ctx, x, y, r + 8, (g) => {
      g.rotate(rot)
      g.fillStyle = 'rgba(0,0,0,0.14)'
      g.beginPath(); g.arc(2, 3, r, 0, Math.PI * 2); g.fill()
      g.fillStyle = i % 3 === 0 ? p.line : p.alt
      g.beginPath()
      g.arc(0, 0, r, 0.42, Math.PI * 2 - 0.42)
      g.lineTo(0, 0)
      g.closePath()
      g.fill()
      g.strokeStyle = 'rgba(255,255,255,0.3)'
      g.lineWidth = 1.4
      g.stroke()
    })
  }
}

/** 2-10 — the greenhouse roof from inside: whitewashed panes, lead cames and
 *  condensation. The world's brightest floor, for the fight that ends it. */
const yardGreenhouse: TileDraw = (ctx, p) => {
  wash(ctx, p.line, p.base)
  // Whitewash: broad, streaky, brushed one way.
  ctx.save()
  ctx.globalAlpha = 0.35
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 2 === 0 ? p.line : p.alt
    // Held clear of the bottom edge: a full-width band is seamless sideways,
    // but one that runs off the bottom is simply cut in half.
    const y = hash(211, i) * (N - 8)
    ctx.fillRect(0, y, N, 2 + hash(212, i) * 5)
  }
  ctx.restore()
  // The cames: a lead grid, with a highlight on the lit side of each.
  ruled(ctx, 2, p.shade, 6, 0.8)
  ctx.save()
  ctx.globalAlpha = 0.8
  ctx.fillStyle = p.line
  for (const t of [0, 128]) {
    ctx.fillRect(t + 3, 0, 2, N)
    ctx.fillRect(0, t + 3, N, 2)
  }
  ctx.restore()
  // Condensation. Small, many, and each with a highlight — the one detail that
  // says "glass" rather than "tile".
  for (let i = 0; i < 80; i++) {
    const x = hash(213, i) * N
    const y = hash(214, i) * N
    const r = 1.2 + hash(215, i) * 2.6
    stamp(ctx, x, y, r + 3, (g) => {
      g.fillStyle = 'rgba(255,255,255,0.35)'
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill()
      g.fillStyle = 'rgba(0,0,0,0.08)'
      g.beginPath(); g.arc(0, r * 0.4, r * 0.8, 0, Math.PI * 2); g.fill()
    })
  }
}

// ═══ World 3 — the attic ════════════════════════════════════════════════════
//
// The attic's dark is its AMBIENT wash (`rgba(24,18,48,0.30)`), not its floors.
// A wash falls on the bugs too and keeps the contrast between them and the
// ground; a dark floor alone would eat them. So these ten are dusty and
// desaturated rather than brown and dim — which is also the only way ten attic
// surfaces could clear the bug-brown distance with an ant walking on them.

/** 3-1 — the wide floorboards the world shipped with. */
const atticBoards: TileDraw = (ctx, p) => {
  boards(ctx, 2, false, (i) => (i % 2 === 0 ? p.base : p.alt), p.shade)
  for (let b = 0; b < 2; b++) {
    grain(ctx, b * 128 + 10, b * 128 + 118, 9, 'rgba(0,0,0,0.13)', 1.2, b * 10 + 1)
    for (const nx of [16, N - 16]) {
      stamp(ctx, nx, b * 128 + 12, 6, (g) => {
        g.beginPath(); g.arc(0, 0, 2.6, 0, Math.PI * 2)
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fill()
        g.beginPath(); g.arc(-0.6, -0.6, 1.4, 0, Math.PI * 2)
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.fill()
      })
    }
  }
  // Dust motes, very faint. They are what makes the attic feel unswept.
  speckle(ctx, 40, 51, 1, 4, (i) => `rgba(230,220,200,${0.05 + hash(57, i) * 0.09})`)
}

/** 3-2 — a dust sheet thrown over whatever is under it. */
const atticDustsheet: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  weave(ctx, 4, 0.05, 0.04)
  // The folds. A broad soft band at 45° with a narrow lit crest beside it —
  // a lit side and a shaded one out of two calls, which is the whole of how
  // cloth reads without a gradient per fold.
  diagonals(ctx, 64, p.shade, 16, 0.3)
  diagonals(ctx, 64, p.line, 4, 0.45, 10)
  diagonals(ctx, 64, p.alt, 2, 0.3, 20)
  // The bloom under the skylight, and the dust it lights up.
  bloom(ctx, 90, 70, 96, p.line, 0.28)
  speckle(ctx, 70, 221, 0.6, 2, () => 'rgba(255,255,255,0.14)')
}

/** 3-3 — the chimney's slate hearth, split into cold grey slabs. */
const atticSlate: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // Eight slabs, two across and four down, each its own tone: slate is a rock
  // that comes off the pile in sheets and no two sheets are the same grey.
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      const i = r * 2 + c
      ctx.save()
      ctx.globalAlpha = 0.25 + hash(231, i) * 0.45
      ctx.fillStyle = hash(232, i) < 0.5 ? p.alt : p.line
      ctx.fillRect(c * 128, r * 64, 128, 64)
      ctx.restore()
      // Cleavage streaks, along the split.
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.strokeStyle = p.shade
      ctx.lineWidth = 1.2
      for (let k = 0; k < 4; k++) {
        const y = r * 64 + 10 + k * 14
        ctx.beginPath()
        ctx.moveTo(c * 128 + 6, y)
        ctx.lineTo(c * 128 + 122, y + (hash(233 + i, k) - 0.5) * 6)
        ctx.stroke()
      }
      ctx.restore()
    }
  }
  // Joints: a deep gap, a lit top lip. Drawn by hand rather than with `ruled`
  // because the courses are 64 tall and the columns 128 wide.
  ctx.save()
  ctx.fillStyle = p.shade
  for (let r = 0; r <= 4; r++) ctx.fillRect(0, r * 64 - 2, N, 4)
  for (let c = 0; c <= 2; c++) ctx.fillRect(c * 128 - 2, 0, 4, N)
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  for (let r = 0; r <= 4; r++) ctx.fillRect(0, r * 64 + 2, N, 1.5)
  ctx.restore()
}

/** 3-4 — stacked yellowed newspaper, columns of type gone unreadable. */
const atticNewsprint: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // Four pages. Each gets a shadow down its right edge, which is what makes a
  // stack of paper read as a stack rather than as a printed sheet.
  for (let q = 0; q < 4; q++) {
    const px = (q % 2) * 128
    const py = Math.floor(q / 2) * 128
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.fillStyle = q % 3 === 0 ? p.alt : p.line
    ctx.fillRect(px, py, 128, 128)
    ctx.restore()
    // The headline, then three columns of body type on a 4 px rhythm. Ragged
    // right, because justified type reads as a pattern and ragged reads as text.
    ctx.save()
    ctx.fillStyle = p.shade
    ctx.globalAlpha = 0.55
    ctx.fillRect(px + 8, py + 10, 100 + hash(241, q) * 12, 5)
    ctx.globalAlpha = 0.32
    for (let col = 0; col < 3; col++) {
      const cx = px + 8 + col * 38
      for (let line = 0; line < 24; line++) {
        const ly = py + 26 + line * 4
        if (ly > py + 122) break
        ctx.fillRect(cx, ly, 22 + hash(242 + q, col * 30 + line) * 12, 1.6)
      }
    }
    ctx.restore()
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(px + 126, py, 2, 128)
    ctx.fillRect(px, py + 126, 128, 2)
  }
  // Foxing: the brown speckle old paper gets. Kept pale — see `floors.ts`.
  speckle(ctx, 50, 243, 0.8, 2.6, () => 'rgba(150,120,70,0.10)')
}

/** 3-5 — loft insulation batts, pink and fibrous, laid between the joists. */
const atticInsulation: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // The joists the batts are laid between, and the shadow they cast into.
  ctx.save()
  ctx.globalAlpha = 0.45
  ctx.fillStyle = p.shade
  // 256 as well as 0: a band centred on the edge is only half on this tile, and
  // the other half has to be drawn or the joist comes out narrow at every seam.
  for (const x of [0, 128, 256]) ctx.fillRect(x - 5, 0, 10, N)
  ctx.restore()
  // The wool itself: short curling fibres, every which way, four passes.
  fibres(ctx, 150, 251, 'rgba(255,255,255,0.22)', 9, 1.2, 0, 3.2)
  fibres(ctx, 150, 261, p.line, 8, 1.1, 0, 3.2)
  fibres(ctx, 120, 271, p.alt, 10, 1.4, 0, 3.2)
  fibres(ctx, 70, 281, p.shade, 7, 1, 0, 3.2)
  for (let i = 0; i < 5; i++) bloom(ctx, hash(291, i) * N, hash(292, i) * N, 34, p.line, 0.25)
}

/** 3-6 — flattened cardboard boxes: flutes, a fold, and old tape. */
const atticCardboard: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // The flutes. A corrugation is a lit ridge and a shaded valley on a fixed
  // pitch, which is two fillRects a pitch and nothing else. Pitch 8, because a
  // pitch that does not divide 256 puts a half-flute at every tile edge.
  ctx.save()
  ctx.globalAlpha = 0.5
  for (let x = 0; x < N; x += 8) {
    ctx.fillStyle = p.line; ctx.fillRect(x, 0, 2.5, N)
    ctx.fillStyle = p.alt; ctx.fillRect(x + 4, 0, 2.5, N)
  }
  ctx.restore()
  // The score line the box folds on, and the crush along it.
  ctx.save()
  ctx.fillStyle = p.shade
  ctx.globalAlpha = 0.55
  ctx.fillRect(0, 126, N, 3)
  ctx.globalAlpha = 0.25
  ctx.fillRect(0, 120, N, 5)
  ctx.restore()
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.fillRect(0, 129, N, 2)
  // A strip of tape, gone matte and yellow, across the top third.
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.fillStyle = p.line
  ctx.fillRect(0, 40, N, 18)
  ctx.globalAlpha = 0.5
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fillRect(0, 40, N, 1.5)
  ctx.fillRect(0, 56.5, N, 1.5)
  ctx.restore()
  speckle(ctx, 60, 301, 0.6, 1.8, () => 'rgba(0,0,0,0.07)')
}

/** 3-7 — a roll of faded rose wallpaper, unrolled across the boards. */
const atticWallpaper: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // The repeat: a four-petal rosette on a 64 px lattice, every other row half a
  // cell over — a damask in nine lines, and a lattice that divides 256.
  for (let ry = 0; ry < 4; ry++) {
    for (let rx = 0; rx < 4; rx++) {
      const x = rx * 64 + (ry % 2 === 0 ? 16 : 48)
      const y = ry * 64 + 32
      stamp(ctx, x, y, 26, (g) => {
        g.fillStyle = p.alt
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4
          g.beginPath()
          g.ellipse(Math.cos(a) * 9, Math.sin(a) * 9, 8, 5, a, 0, Math.PI * 2)
          g.fill()
        }
        g.fillStyle = p.line
        g.beginPath(); g.arc(0, 0, 4.5, 0, Math.PI * 2); g.fill()
        g.strokeStyle = p.alt
        g.lineWidth = 1.2
        g.beginPath(); g.arc(0, 0, 17, 0, Math.PI * 2); g.stroke()
      })
    }
  }
  // The seams between drops of paper, and the sun-fade down one side of each.
  ctx.save()
  for (const x of [0, 128]) {
    ctx.fillStyle = p.shade
    ctx.globalAlpha = 0.4
    ctx.fillRect(x, 0, 1.6, N)
    const g0 = ctx.createLinearGradient(x, 0, x + 30, 0)
    g0.addColorStop(0, 'rgba(255,255,255,0.18)')
    g0.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.globalAlpha = 1
    ctx.fillStyle = g0
    ctx.fillRect(x, 0, 30, N)
  }
  ctx.restore()
}

/** 3-8 — a sheet of dull galvanised tin, rivets and a dent in it. */
const atticTin: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // Brushed: fine horizontal streaks, half light and half dark, full width.
  ctx.save()
  ctx.globalAlpha = 0.35
  for (let i = 0; i < 150; i++) {
    const y = hash(311, i) * (N - 3)
    ctx.fillStyle = hash(312, i) < 0.5 ? p.line : p.alt
    ctx.fillRect(0, y, N, 0.8 + hash(313, i) * 1.4)
  }
  ctx.restore()
  // The spangle galvanising leaves — big soft crystal facets.
  for (let i = 0; i < 12; i++) {
    bloom(ctx, hash(314, i) * N, hash(315, i) * N, 26 + hash(316, i) * 18,
      hash(317, i) < 0.5 ? p.line : p.shade, 0.16)
  }
  // Rivets on a 64 lattice: a ring, a dome, a highlight.
  for (let ry = 0; ry < 4; ry++) {
    for (let rx = 0; rx < 4; rx++) {
      stamp(ctx, rx * 64 + 32, ry * 64 + 32, 8, (g) => {
        g.fillStyle = 'rgba(0,0,0,0.3)'
        g.beginPath(); g.arc(0.8, 1, 4.2, 0, Math.PI * 2); g.fill()
        g.fillStyle = p.alt
        g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill()
        g.fillStyle = 'rgba(255,255,255,0.3)'
        g.beginPath(); g.arc(-1.2, -1.2, 1.7, 0, Math.PI * 2); g.fill()
      })
    }
  }
}

/** 3-9 — a moth-eaten wool rug. Worn pile, a woven border, and holes the
 *  world's own moths made — kept big and soft, because a small dark blob on a
 *  floor is the one shape this game must never draw by accident. */
const atticRug: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // The pile: thousands of short strokes would be honest and slow, so it is
  // four hundred at four widths, which reads the same at tile scale.
  fibres(ctx, 130, 321, p.alt, 6, 2.4, 0, 3.2)
  fibres(ctx, 130, 331, p.line, 5, 2, 0, 3.2)
  fibres(ctx, 90, 341, p.shade, 5, 2, 0, 3.2)
  fibres(ctx, 50, 351, 'rgba(255,255,255,0.18)', 4, 1.6, 0, 3.2)
  // The woven border: two dark rules with a row of ticks between them. On the
  // 64/192 lines rather than 0/128 — the rhythm is the same 128 either way, and
  // a band that straddles the tile edge would have to be drawn twice.
  ctx.save()
  for (const t of [64, 192]) {
    ctx.globalAlpha = 0.5
    ctx.fillStyle = p.shade
    ctx.fillRect(0, t - 9, N, 3); ctx.fillRect(0, t + 6, N, 3)
    ctx.fillRect(t - 9, 0, 3, N); ctx.fillRect(t + 6, 0, 3, N)
    ctx.globalAlpha = 0.45
    ctx.fillStyle = p.line
    for (let k = 0; k < N; k += 12) {
      ctx.fillRect(k, t - 3, 6, 6)
      ctx.fillRect(t - 3, k, 6, 6)
    }
  }
  ctx.restore()
  // Three moth holes: 30 px across, an order of magnitude bigger than a bug,
  // and soft enough at the rim that the eye reads wear rather than object.
  for (let i = 0; i < 3; i++) {
    bloom(ctx, hash(361, i) * N, hash(362, i) * N, 30, p.shade, 0.4)
  }
}

/** 3-10 — bare plaster over lath, chalky and hairline-cracked. The brightest
 *  floor up here, under the world's heaviest wash, for the Matriarch. */
const atticPlaster: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // The mottle: chalk never dries one colour.
  for (let i = 0; i < 22; i++) {
    bloom(ctx, hash(371, i) * N, hash(372, i) * N, 30 + hash(373, i) * 34,
      hash(374, i) < 0.5 ? p.line : p.alt, 0.3)
  }
  // A patch where the plaster has come off and the lath shows: ruled slats
  // across a band, with the shadow of each gap.
  ctx.save()
  ctx.globalAlpha = 0.5
  for (let y = 150; y < 210; y += 10) {
    ctx.fillStyle = p.shade; ctx.fillRect(0, y, N, 3)
    ctx.fillStyle = p.alt; ctx.fillRect(0, y + 3, N, 7)
  }
  ctx.restore()
  // Hairline cracks. Each is a short polyline with two branches, stamped, and
  // at an alpha low enough that it never becomes a line the eye follows.
  ctx.save()
  ctx.strokeStyle = p.shade
  ctx.globalAlpha = 0.45
  ctx.lineWidth = 1
  for (let i = 0; i < 10; i++) {
    const x = hash(381, i) * N
    const y = hash(382, i) * N
    stamp(ctx, x, y, 44, (g) => {
      let cx = 0
      let cy = 0
      g.beginPath()
      g.moveTo(0, 0)
      for (let k = 0; k < 5; k++) {
        cx += (hash(383 + i, k) - 0.5) * 22
        cy += (hash(384 + i, k) - 0.5) * 22
        g.lineTo(cx, cy)
      }
      g.stroke()
    })
  }
  ctx.restore()
  speckle(ctx, 60, 391, 0.5, 1.4, () => 'rgba(0,0,0,0.06)')
}

// ═══ World 4 — the arcade ═══════════════════════════════════════════════════
//
// All ten are DARK floors: the ground is the unlit thing and everything that
// walks on it glows. That inverts the whole world's legibility — the bug's ink
// outline vanishes and its body and accent carry it — which is stated as data
// (`key: 'dark'`) so the test can hold it rather than trusting the painter.
//
// Bright marks here are STRUCTURE: rules, traces, slots, chevrons that cross
// the tile. A bright compact blob on a black floor is a bug, and there are none
// below that a bug's 13 px could be confused with.

/** 4-1 — the neon floor grid the world shipped with. */
const arcadeGrid: TileDraw = (ctx, p) => {
  wash(ctx, p.base, p.alt)
  ruled(ctx, 4, p.line, 1.6, 0.7, true)
  scanlines(ctx, 4, 0.16)
  // Two magenta cell-lights, offset from the grid so the floor is not purely
  // rectilinear.
  for (let i = 0; i < 3; i++) {
    const x = (0.5 + Math.floor(hash(71, i) * 4)) * (N / 4)
    const y = (0.5 + Math.floor(hash(73, i) * 4)) * (N / 4)
    bloom(ctx, x, y, 34, 'rgba(255,64,160,0.28)', 1)
  }
}

/** 4-2 — black-light bowling carpet. Confetti kept deliberately dim: it is the
 *  one arcade floor whose marks are compact, so it lives under the ordinary
 *  mark ceiling rather than claiming the structure exemption. */
const arcadeCarpet: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  for (let i = 0; i < 14; i++) {
    bloom(ctx, hash(401, i) * N, hash(402, i) * N, 40, p.alt, 0.5)
  }
  // Boomerangs and chips, the way that carpet actually is.
  for (let i = 0; i < 70; i++) {
    const x = hash(403, i) * N
    const y = hash(404, i) * N
    const rot = hash(405, i) * 6.3
    const l = 5 + hash(406, i) * 7
    stamp(ctx, x, y, l + 4, (g) => {
      g.rotate(rot)
      g.strokeStyle = p.line
      g.lineWidth = 2.4
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(-l, 2)
      g.quadraticCurveTo(0, -3, l, 2)
      g.stroke()
    })
  }
  speckle(ctx, 90, 407, 0.6, 1.6, () => 'rgba(255,255,255,0.10)')
  scanlines(ctx, 8, 0.10)
}

/** 4-3 — the inside of the machine: a circuit board, traces pad to pad. */
const arcadeCircuit: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // The ground plane: a hatched pour, at 45° so it does not fight the traces.
  diagonals(ctx, 8, p.alt, 3, 0.5)
  // The traces. Each runs the full width or the full height on a 16 px lane and
  // steps out onto the next lane and back — which is what a routed board looks
  // like, and, because it ARRIVES on the lane it left, what makes it wrap. A
  // trace that ended one lane over would be a 16 px jump at every seam.
  ctx.save()
  ctx.strokeStyle = p.line
  ctx.lineWidth = 2.2
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 0.75
  for (let i = 0; i < 16; i++) {
    const lane = i * 16 + 8
    const turn = 16 + Math.floor(hash(411, i) * 4) * 32
    const to = lane + (hash(412, i) < 0.5 ? 16 : -16)
    ctx.beginPath()
    if (i % 2 === 0) {
      ctx.moveTo(0, lane); ctx.lineTo(turn, lane); ctx.lineTo(turn + 10, to)
      ctx.lineTo(turn + 60, to); ctx.lineTo(turn + 70, lane); ctx.lineTo(N, lane)
    } else {
      ctx.moveTo(lane, 0); ctx.lineTo(lane, turn); ctx.lineTo(to, turn + 10)
      ctx.lineTo(to, turn + 60); ctx.lineTo(lane, turn + 70); ctx.lineTo(lane, N)
    }
    ctx.stroke()
  }
  ctx.restore()
  // Vias: 3 px pads, a quarter of a bug across, on the lane crossings.
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(413, i) * 16) * 16 + 8
    const y = Math.floor(hash(414, i) * 16) * 16 + 8
    stamp(ctx, x, y, 6, (g) => {
      g.fillStyle = p.line
      g.globalAlpha = 0.8
      g.beginPath(); g.arc(0, 0, 3, 0, Math.PI * 2); g.fill()
      g.globalAlpha = 1
      g.fillStyle = p.shade
      g.beginPath(); g.arc(0, 0, 1.2, 0, Math.PI * 2); g.fill()
    })
  }
}

/** 4-4 — dark chequered lino, two near-blacks, buffed to a shine. */
const arcadeTile: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  checker(ctx, 4, p.alt)
  // A bevel: a lit top-left edge and a dark bottom-right one on every cell.
  ctx.save()
  const s = N / 4
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = p.line
    ctx.globalAlpha = 0.5
    ctx.fillRect(i * s, 0, 1.4, N)
    ctx.fillRect(0, i * s, N, 1.4)
    ctx.fillStyle = p.shade
    ctx.globalAlpha = 0.9
    ctx.fillRect(i * s - 2, 0, 2, N)
    ctx.fillRect(0, i * s - 2, N, 2)
  }
  ctx.restore()
  // The buff: a broad diagonal sheen, and the swirl a polisher leaves.
  diagonals(ctx, 128, p.line, 40, 0.06)
  for (let i = 0; i < 10; i++) {
    stamp(ctx, hash(421, i) * N, hash(422, i) * N, 30, (g) => {
      g.strokeStyle = p.line
      g.globalAlpha = 0.10
      g.lineWidth = 2
      g.beginPath(); g.arc(0, 0, 14 + hash(423, i) * 12, 0, Math.PI * 1.5); g.stroke()
    })
  }
}

/** 4-5 — a cabinet's attract-mode starfield, thrown onto the floor. */
const arcadeStar: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // The voids between the arms, so the field the stars sit on is not flat.
  for (let i = 0; i < 8; i++) {
    bloom(ctx, hash(431, i) * N, hash(432, i) * N, 56 + hash(433, i) * 40, p.alt, 0.7)
  }
  // Three depths of star. The brightest are 1.6 px — an eighth of a bug — and
  // that is the only reason a bright mark is allowed on this floor at all.
  speckle(ctx, 160, 434, 0.4, 0.9, () => 'rgba(255,255,255,0.22)')
  speckle(ctx, 70, 444, 0.7, 1.3, () => p.line)
  speckle(ctx, 22, 454, 1, 1.6, () => 'rgba(255,255,255,0.7)')
  // …and four with a cross-flare, which is what says "star" rather than "dust".
  for (let i = 0; i < 4; i++) {
    stamp(ctx, hash(464, i) * N, hash(465, i) * N, 10, (g) => {
      g.strokeStyle = 'rgba(255,255,255,0.35)'
      g.lineWidth = 1
      g.beginPath(); g.moveTo(-7, 0); g.lineTo(7, 0); g.moveTo(0, -7); g.lineTo(0, 7); g.stroke()
    })
  }
}

/** 4-6 — a steel floor vent: perforated plate, slots down its length. */
const arcadeVent: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // The slots. Full width, on a 16 px pitch, with the dark of the duct behind
  // and a machined lip catching the light on the near edge of each.
  for (let y = 0; y < N; y += 16) {
    ctx.fillStyle = p.shade
    ctx.fillRect(0, y + 4, N, 8)
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.fillStyle = p.line
    ctx.fillRect(0, y + 12, N, 1.6)
    ctx.globalAlpha = 0.22
    ctx.fillRect(0, y + 2, N, 1.4)
    ctx.restore()
  }
  // Brushed steel across the ribs between the slots.
  ctx.save()
  ctx.globalAlpha = 0.18
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = hash(471, i) < 0.5 ? p.line : p.shade
    ctx.fillRect(0, hash(472, i) * (N - 1), N, 0.8)
  }
  ctx.restore()
  // Countersunk screws at the plate's corners — the 128 lattice, so they wrap.
  for (const x of [0, 128]) {
    for (const y of [0, 128]) {
      stamp(ctx, x + 64, y + 64, 8, (g) => {
        g.fillStyle = p.shade
        g.beginPath(); g.arc(0, 0, 4.4, 0, Math.PI * 2); g.fill()
        g.strokeStyle = p.line
        g.globalAlpha = 0.5
        g.lineWidth = 1.4
        g.beginPath(); g.moveTo(-3, -3); g.lineTo(3, 3); g.moveTo(3, -3); g.lineTo(-3, 3); g.stroke()
      })
    }
  }
}

/** 4-7 — the dance pad. Four lit panels a tile, each with a chevron the size
 *  of the panel: 90 px of arrow against a 13 px bug. */
const arcadeDance: TileDraw = (ctx, p) => {
  flood(ctx, p.shade)
  const s = N / 2
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const i = r * 2 + c
      const cx = c * s + s / 2
      const cy = r * s + s / 2
      ctx.save()
      ctx.fillStyle = p.base
      ctx.fillRect(c * s + 5, r * s + 5, s - 10, s - 10)
      ctx.fillStyle = p.alt
      ctx.fillRect(c * s + 12, r * s + 12, s - 24, s - 24)
      ctx.restore()
      // The arrow, pointing a different way on every panel.
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((i % 4) * Math.PI / 2)
      ctx.strokeStyle = p.line
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 7
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-34, 14); ctx.lineTo(0, -22); ctx.lineTo(34, 14)
      ctx.stroke()
      ctx.globalAlpha = 0.9
      ctx.lineWidth = 2.4
      ctx.stroke()
      ctx.restore()
    }
  }
  // The gap between panels, and the light leaking up out of it.
  ruled(ctx, 2, p.shade, 10, 1)
  ruled(ctx, 2, p.line, 2, 0.3, true)
}

/** 4-8 — a low-res pixel mosaic with a row scanning through it. */
const arcadePixel: TileDraw = (ctx, p) => {
  flood(ctx, p.alt)
  // 16 px cells — bigger than a bug, so a lit cell is architecture rather than
  // an object — each one of three dark tones.
  for (let ry = 0; ry < 16; ry++) {
    for (let rx = 0; rx < 16; rx++) {
      const t = hash(481, ry * 16 + rx)
      ctx.fillStyle = t < 0.5 ? p.alt : t < 0.85 ? p.base : p.shade
      ctx.fillRect(rx * 16, ry * 16, 16, 16)
    }
  }
  // Two rows lit end to end: the scan.
  ctx.save()
  for (const row of [3, 11]) {
    ctx.globalAlpha = 0.16
    ctx.fillStyle = p.line
    ctx.fillRect(0, row * 16 - 6, N, 28)
    ctx.globalAlpha = 0.5
    ctx.fillRect(0, row * 16, N, 16)
    ctx.globalAlpha = 0.9
    ctx.fillRect(0, row * 16, N, 2)
  }
  ctx.restore()
  // The cell gaps, so it reads as a display and not as a checkerboard.
  ruled(ctx, 16, p.shade, 1.4, 0.55)
}

/** 4-9 — the vinyl down the side of a cabinet, pinstriped with its own decal.
 *  The busiest board in the game that is not a boss gets the calmest floor. */
const arcadeVinyl: TileDraw = (ctx, p) => {
  wash(ctx, p.base, p.alt, true)
  // The decal: bands of pinstripe at 45°, wide-and-faint under narrow-and-bright
  // so each stripe glows without a shadow blur anywhere near the bake.
  diagonals(ctx, 32, p.line, 9, 0.10)
  diagonals(ctx, 32, p.line, 2, 0.5)
  diagonals(ctx, 32, p.shade, 1.2, 0.6, 5)
  // Vinyl's own grain, and the scuffs a cabinet picks up in twenty years.
  scanlines(ctx, 4, 0.10, 1)
  for (let i = 0; i < 14; i++) {
    stamp(ctx, hash(491, i) * N, hash(492, i) * N, 22, (g) => {
      g.strokeStyle = 'rgba(255,255,255,0.09)'
      g.lineWidth = 1.2
      g.beginPath()
      g.moveTo(-10, 0)
      g.quadraticCurveTo(0, (hash(493, i) - 0.5) * 10, 12, 0)
      g.stroke()
    })
  }
}

/** 4-10 — spilled tokens on black rubber matting. The last floor in the game,
 *  and the only warm thing in the arcade: the coins are what the player has
 *  been paid for forty levels. */
const arcadeToken: TileDraw = (ctx, p) => {
  flood(ctx, p.base)
  // The matting's studs, on a 16 lattice — the ground the tokens lie on.
  for (let ry = 0; ry < 16; ry++) {
    for (let rx = 0; rx < 16; rx++) {
      const x = rx * 16 + 8
      const y = ry * 16 + 8
      stamp(ctx, x, y, 8, (g) => {
        g.fillStyle = p.shade
        g.beginPath(); g.arc(0.8, 1, 5, 0, Math.PI * 2); g.fill()
        g.fillStyle = p.alt
        g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill()
      })
    }
  }
  scanlines(ctx, 8, 0.12, 2)
  // The tokens. Dim on purpose — a bright disc the size of a beetle is a beetle,
  // so these are a murmur under the mark ceiling and the rim does the reading.
  for (let i = 0; i < 16; i++) {
    const x = hash(501, i) * N
    const y = hash(502, i) * N
    const r = 6 + hash(503, i) * 2.4
    stamp(ctx, x, y, r + 5, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.45)'
      g.beginPath(); g.ellipse(1.4, 2, r, r * 0.9, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = p.line
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(255,255,255,0.16)'
      g.lineWidth = 1.2
      g.beginPath(); g.arc(0, 0, r - 2, 0, Math.PI * 2); g.stroke()
    })
  }
}

/**
 * Every painter, by floor. Exhaustive over `FloorId` by the type, so adding a
 * floor to `floors.ts` without drawing it is a compile error rather than a
 * board that falls back to bare colour on 3-7.
 */
const TILE_DRAW: Record<FloorId, TileDraw> = {
  'picnic-gingham': picnicGingham,
  'picnic-planks': picnicPlanks,
  'picnic-paper': picnicPaper,
  'picnic-grass': picnicGrass,
  'picnic-patio': picnicPatio,
  'picnic-sand': picnicSand,
  'picnic-wicker': picnicWicker,
  'picnic-flour': picnicFlour,
  'picnic-decking': picnicDecking,
  'picnic-napkin': picnicNapkin,
  'yard-lawn': yardLawn,
  'yard-flagstone': yardFlagstone,
  'yard-clover': yardClover,
  'yard-gravel': yardGravel,
  'yard-straw': yardStraw,
  'yard-brick': yardBrick,
  'yard-turf': yardTurf,
  'yard-leaves': yardLeaves,
  'yard-pond': yardPond,
  'yard-greenhouse': yardGreenhouse,
  'attic-boards': atticBoards,
  'attic-dustsheet': atticDustsheet,
  'attic-slate': atticSlate,
  'attic-newsprint': atticNewsprint,
  'attic-insulation': atticInsulation,
  'attic-cardboard': atticCardboard,
  'attic-wallpaper': atticWallpaper,
  'attic-tin': atticTin,
  'attic-rug': atticRug,
  'attic-plaster': atticPlaster,
  'arcade-grid': arcadeGrid,
  'arcade-carpet': arcadeCarpet,
  'arcade-circuit': arcadeCircuit,
  'arcade-tile': arcadeTile,
  'arcade-star': arcadeStar,
  'arcade-vent': arcadeVent,
  'arcade-dance': arcadeDance,
  'arcade-pixel': arcadePixel,
  'arcade-vinyl': arcadeVinyl,
  'arcade-token': arcadeToken
}

/** Paint ONE tile into `ctx`, which must be `FLOOR_TILE_PX` square. The art
 *  bench calls this directly to export the reference. */
export const paintFloorTile = (ctx: CanvasRenderingContext2D, ref: FloorRef): void => {
  const id = floorOf(ref)
  TILE_DRAW[id](ctx, FLOOR_PALETTE[id])
}

// ─── The pattern cache ──────────────────────────────────────────────────────
//
// Keyed on the FLOOR, never on the world — forty floors through a four-slot
// cache would have handed 1-7 the blanket it was baked with on 1-1.
//
// Still lazy, and that is load-bearing: a session bakes the floor of the level
// it is on and nothing else. Baking forty at boot would be forty 256×256
// canvases and a few thousand path operations in front of the splash, to draw
// thirty-nine surfaces the player may never reach.

const tiles = new Map<FloorId, HTMLCanvasElement>()
const patterns = new Map<string, CanvasPattern | null>()

/** The baked tile for a floor, drawing it the first time it is asked for. */
export const floorTile = (ref: FloorRef): HTMLCanvasElement => {
  const id = floorOf(ref)
  const hit = tiles.get(id)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = FLOOR_TILE_PX
  c.height = FLOOR_TILE_PX
  const g = c.getContext('2d')
  if (g) {
    // PAINTED FIRST: a decoded tile from the pipeline replaces the drawing, and
    // it is stretched to the same box so nothing downstream changes.
    //
    // ── Every floor probes for its OWN painting ──
    //
    // A world's lead floor keeps the id it has always shipped under
    // (`bg/floor-<w>.webp`), because that file is a painting of THAT tile — of
    // the gingham blanket, of the attic's boards — and hanging it on the
    // world's other nine levels is the bug this file was once rewritten to fix.
    // It is still exactly that painting, at exactly that path.
    //
    // The other thirty-six now have paintings OF THEMSELVES, at
    // `bg/<floor-id>.webp`. `floorArtIdFor` is the one rule for which of them
    // have actually landed — a floor with no painting yet returns null and is
    // never probed, so this stays 404-free while the batch arrives one tile at
    // a time. The preloader asks the same function the same question.
    const artId = floorArtIdFor(id)
    const painted = artId ? spriteFor('bg', artId) : null
    if (painted && painted.naturalWidth > 0) {
      g.drawImage(painted, 0, 0, FLOOR_TILE_PX, FLOOR_TILE_PX)
    } else {
      paintFloorTile(g, id)
    }
  }
  tiles.set(id, c)
  return c
}

/**
 * A repeating pattern for a floor, cached per context.
 *
 * `CanvasPattern` is bound to the context that created it, and the game has two
 * (the board and the decal layer) — so the cache is keyed on both.
 */
export const floorPattern = (
  ctx: CanvasRenderingContext2D, ref: FloorRef, ctxKey: string
): CanvasPattern | null => {
  const id = floorOf(ref)
  const key = `${ctxKey}:${id}`
  const hit = patterns.get(key)
  if (hit !== undefined) return hit
  const p = ctx.createPattern(floorTile(id), 'repeat')
  patterns.set(key, p)
  return p
}

/** Drop every bake — called when the art layer changes wholesale (a flag flip
 *  or a refresh), which is the only time all forty can be stale at once. */
export const resetFloors = (): void => {
  tiles.clear()
  patterns.clear()
}

/** Drop just one floor's. Handed a WORLD, it drops that world's lead floor —
 *  which is the only floor a painted `floor-<w>` can have staled. */
export const resetFloor = (ref: FloorRef): void => {
  const id = floorOf(ref)
  tiles.delete(id)
  for (const k of [...patterns.keys()]) {
    if (k.endsWith(`:${id}`)) patterns.delete(k)
  }
}

/**
 * The ambient wash a world lays over the whole board, after everything else.
 *
 * Per WORLD and not per level, on purpose. The attic's is a cool dark veil and
 * the arcade's a violet bloom; the picnic and the backyard barely have one. It
 * is drawn LAST so it unifies the palette — bugs, splats and foot included —
 * which is what makes ten different attic surfaces still read as one attic, and
 * is the half of a world's identity that survives the floor changing underneath
 * it every level.
 */
export const floorAmbient = (world: WorldId): string => WORLDS[world].floor.ambient

/**
 * How hard the vignette bites, per world.
 *
 * A LOT lighter on the picnic blanket and the backyard than on the attic and
 * the arcade, and that is a legibility decision rather than a mood one: the
 * first two worlds are bright places, and a heavy vignette over a red gingham
 * floor turned the cream squares grey and swallowed the ants standing on them.
 * The dark worlds keep the full weight, because there the rim genuinely is dark.
 */
export const VIGNETTE_STRENGTH: Record<WorldId, number> = { 1: 0.4, 2: 0.45, 3: 1, 4: 0.9 }

/**
 * A soft vignette, in the FLOOR's own shade.
 *
 * Two jobs, and the second is the real one: it darkens the board's rim, which
 * is where bugs enter — so a body walking in from off-screen fades UP into the
 * light instead of popping into existence at the edge.
 *
 * The shade comes off the level's floor rather than the world's, because a rim
 * painted in the blanket's red over a floured board is a red ring round a white
 * floor. Every floor's `shade` is held to the same mark ceiling as its texture
 * (see `floors.ts`), which is what keeps the rim from becoming a place a bug
 * can hide.
 */
export const paintVignette = (
  ctx: CanvasRenderingContext2D, w: number, h: number, ref: FloorRef, strength = 1
): void => {
  const r = Math.hypot(w, h) * 0.5
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.42, w / 2, h / 2, r)
  const shade = FLOOR_PALETTE[floorOf(ref)].shade
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, shade)
  ctx.save()
  ctx.globalAlpha = 0.42 * strength
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}
