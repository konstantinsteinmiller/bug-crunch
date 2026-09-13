/**
 * ─── The four floors ────────────────────────────────────────────────────────
 *
 * One seamless tile per world, baked ONCE into an offscreen canvas and then
 * used as a `createPattern` fill for the whole board. That is the difference
 * between a background that costs one `fillRect` a frame and one that costs a
 * few hundred path operations.
 *
 * ── Seamlessness is the whole job ──
 *
 * Every mark that runs off one edge of the tile must arrive at the opposite
 * edge in the same place, or the board shows a grid of seams — the single most
 * common way a tiled backdrop announces itself. Marks near an edge are drawn
 * TWICE (or four times at a corner) with a wrap offset, which is what `stamp`
 * does, so nothing here has to think about it case by case.
 *
 * ── Why the floor is not just colour ──
 *
 * The floor is where the splat decals land, and a decal on a flat colour reads
 * as a sticker. Every tile carries a low-contrast texture — weave, grass blades,
 * wood grain, scanlines — that the decals sit INTO. It is also what makes the
 * four worlds read as four places rather than four hues.
 */

import { spriteFor } from '@/game/art'
import type { WorldId } from '@/game/stages'
import { WORLDS } from '@/game/stages'

/** Tile edge in px. 256 is big enough that the repeat is not obvious at phone
 *  scale and small enough to bake in well under a frame. */
export const FLOOR_TILE_PX = 256

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
  const N = FLOOR_TILE_PX
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

type TileDraw = (ctx: CanvasRenderingContext2D, w: WorldId) => void

/** World 1 — the picnic blanket. Red gingham with a fabric weave. */
const drawPicnic: TileDraw = (ctx) => {
  const N = FLOOR_TILE_PX
  const f = WORLDS[1].floor
  const cell = N / 4
  ctx.fillStyle = f.alt
  ctx.fillRect(0, 0, N, N)
  // Gingham is two half-opacity stripe sets crossing: the overlap is the dark
  // square, which is exactly how the real weave works and why it looks right.
  ctx.globalAlpha = 0.55
  ctx.fillStyle = f.base
  for (let i = 0; i < 4; i += 2) {
    ctx.fillRect(i * cell, 0, cell, N)
    ctx.fillRect(0, i * cell, N, cell)
  }
  ctx.globalAlpha = 1
  // Weave: fine threads, one direction per stripe, at very low contrast.
  ctx.strokeStyle = 'rgba(255,255,255,0.055)'
  ctx.lineWidth = 1
  for (let i = 0; i < N; i += 4) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, N); ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.045)'
  for (let i = 0; i < N; i += 4) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(N, i); ctx.stroke()
  }
  // A few stray crumbs for life. Not the `crumbs` hazard — these do nothing.
  for (let i = 0; i < 14; i++) {
    const x = hash(1, i) * N
    const y = hash(2, i) * N
    const r = 1.4 + hash(3, i) * 2.2
    stamp(ctx, x, y, 6, (g) => {
      g.fillStyle = 'rgba(224,184,119,0.75)'
      g.beginPath(); g.ellipse(0, 0, r, r * 0.7, hash(4, i) * 3, 0, Math.PI * 2); g.fill()
    })
  }
}

/** World 2 — the overgrown backyard. Grass blades and clover. */
const drawBackyard: TileDraw = (ctx) => {
  const N = FLOOR_TILE_PX
  const f = WORLDS[2].floor
  const g0 = ctx.createLinearGradient(0, 0, N, N)
  g0.addColorStop(0, f.base)
  g0.addColorStop(1, f.alt)
  ctx.fillStyle = g0
  ctx.fillRect(0, 0, N, N)
  // Blades. Two passes — a dark one behind, a light one in front — so the mat
  // has depth without a single gradient per blade.
  for (const [n, colour, len, wid] of [
    [120, 'rgba(0,0,0,0.16)', 16, 2.4],
    [120, f.line, 14, 1.8]
  ] as Array<[number, string, number, number]>) {
    ctx.strokeStyle = colour
    ctx.lineWidth = wid
    ctx.lineCap = 'round'
    for (let i = 0; i < n; i++) {
      const x = hash(colour.length, i) * N
      const y = hash(colour.length + 7, i) * N
      const lean = (hash(colour.length + 13, i) - 0.5) * 10
      stamp(ctx, x, y, len + 4, (c) => {
        c.beginPath()
        c.moveTo(0, 0)
        c.quadraticCurveTo(lean * 0.5, -len * 0.6, lean, -len)
        c.stroke()
      })
    }
  }
  // Clover: three lobes, occasionally.
  for (let i = 0; i < 6; i++) {
    const x = hash(31, i) * N
    const y = hash(37, i) * N
    stamp(ctx, x, y, 12, (c) => {
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

/** World 3 — the dusty attic. Wide floorboards, nail heads, dust. */
const drawAttic: TileDraw = (ctx) => {
  const N = FLOOR_TILE_PX
  const f = WORLDS[3].floor
  const boardH = N / 2
  for (let b = 0; b < 2; b++) {
    ctx.fillStyle = b % 2 === 0 ? f.base : f.alt
    ctx.fillRect(0, b * boardH, N, boardH)
    // Grain: long, shallow, nearly-parallel arcs.
    ctx.strokeStyle = 'rgba(0,0,0,0.13)'
    ctx.lineWidth = 1.2
    for (let i = 0; i < 9; i++) {
      const y = b * boardH + 10 + i * (boardH - 20) / 8 + (hash(b * 10 + 1, i) - 0.5) * 5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(N * 0.3, y + (hash(b, i) - 0.5) * 7, N * 0.7, y - (hash(b + 3, i) - 0.5) * 7, N, y)
      ctx.stroke()
    }
    // The board seam, with a highlight above it.
    ctx.fillStyle = f.shade
    ctx.fillRect(0, b * boardH, N, 3)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.fillRect(0, b * boardH + 3, N, 2)
    // Nail heads at the ends.
    for (const nx of [16, N - 16]) {
      ctx.beginPath()
      ctx.arc(nx, b * boardH + 12, 2.6, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(nx - 0.6, b * boardH + 11.4, 1.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.fill()
    }
  }
  // Dust motes, very faint. They are what makes the attic feel unswept.
  for (let i = 0; i < 40; i++) {
    const x = hash(51, i) * N
    const y = hash(53, i) * N
    stamp(ctx, x, y, 5, (c) => {
      c.fillStyle = `rgba(230,220,200,${0.05 + hash(57, i) * 0.09})`
      c.beginPath(); c.arc(0, 0, 1 + hash(59, i) * 3, 0, Math.PI * 2); c.fill()
    })
  }
}

/** World 4 — the neon arcade. Dark lino with a glowing grid and scanlines. */
const drawArcade: TileDraw = (ctx) => {
  const N = FLOOR_TILE_PX
  const f = WORLDS[4].floor
  const g0 = ctx.createLinearGradient(0, 0, 0, N)
  g0.addColorStop(0, f.base)
  g0.addColorStop(1, f.alt)
  ctx.fillStyle = g0
  ctx.fillRect(0, 0, N, N)
  // The grid. Drawn twice — once wide and faint for the bloom, once narrow and
  // bright for the line — which is a glow for the price of two strokes.
  const cell = N / 4
  for (const [w, a] of [[7, 0.12], [1.6, 0.7]] as Array<[number, number]>) {
    ctx.strokeStyle = f.line
    ctx.globalAlpha = a
    ctx.lineWidth = w
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, N); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(N, i * cell); ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
  // Scanlines. Dark, every 4 px, at very low alpha — a CRT without a shader.
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  for (let y = 0; y < N; y += 4) ctx.fillRect(0, y, N, 1.4)
  // A couple of magenta cell-lights, offset from the grid so the floor is not
  // purely rectilinear.
  for (let i = 0; i < 3; i++) {
    const x = (0.5 + Math.floor(hash(71, i) * 4)) * cell
    const y = (0.5 + Math.floor(hash(73, i) * 4)) * cell
    stamp(ctx, x, y, 40, (c) => {
      const gg = c.createRadialGradient(0, 0, 1, 0, 0, 34)
      gg.addColorStop(0, 'rgba(255,64,160,0.28)')
      gg.addColorStop(1, 'rgba(255,64,160,0)')
      c.fillStyle = gg
      c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2); c.fill()
    })
  }
}

const TILE_DRAW: Record<WorldId, TileDraw> = {
  1: drawPicnic, 2: drawBackyard, 3: drawAttic, 4: drawArcade
}

/** Paint ONE tile into `ctx`, which must be `FLOOR_TILE_PX` square. The art
 *  bench calls this directly to export the reference. */
export const paintFloorTile = (ctx: CanvasRenderingContext2D, world: WorldId): void => {
  TILE_DRAW[world](ctx, world)
}

// ─── The pattern cache ──────────────────────────────────────────────────────

const tiles = new Map<WorldId, HTMLCanvasElement>()
const patterns = new Map<string, CanvasPattern | null>()

/** The baked tile for a world, drawing it the first time it is asked for. */
export const floorTile = (world: WorldId): HTMLCanvasElement => {
  const hit = tiles.get(world)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = FLOOR_TILE_PX
  c.height = FLOOR_TILE_PX
  const g = c.getContext('2d')
  if (g) {
    // PAINTED FIRST: a decoded tile from the pipeline replaces the drawing, and
    // it is stretched to the same box so nothing downstream changes.
    const painted = spriteFor('bg', `floor-${world}`)
    if (painted && painted.naturalWidth > 0) {
      g.drawImage(painted, 0, 0, FLOOR_TILE_PX, FLOOR_TILE_PX)
    } else {
      paintFloorTile(g, world)
    }
  }
  tiles.set(world, c)
  return c
}

/**
 * A repeating pattern for a world's floor, cached per context.
 *
 * `CanvasPattern` is bound to the context that created it, and the game has two
 * (the board and the decal layer) — so the cache is keyed on both.
 */
export const floorPattern = (
  ctx: CanvasRenderingContext2D, world: WorldId, ctxKey: string
): CanvasPattern | null => {
  const key = `${ctxKey}:${world}`
  const hit = patterns.get(key)
  if (hit !== undefined) return hit
  const p = ctx.createPattern(floorTile(world), 'repeat')
  patterns.set(key, p)
  return p
}

/** Drop every bake — called when the art layer changes or a world's painted
 *  tile arrives. */
export const resetFloors = (): void => {
  tiles.clear()
  patterns.clear()
}

/** Drop just one world's. */
export const resetFloor = (world: WorldId): void => {
  tiles.delete(world)
  for (const k of [...patterns.keys()]) {
    if (k.endsWith(`:${world}`)) patterns.delete(k)
  }
}

/**
 * The ambient wash a world lays over the whole board, after everything else.
 *
 * The attic's is a cool dark veil and the arcade's a violet bloom; the picnic
 * and the backyard barely have one. It is drawn LAST so it unifies the palette —
 * bugs, splats and foot included — which is what makes a world read as a place
 * with its own light rather than as a different background image.
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
 * A soft vignette, in the world's own shade.
 *
 * Two jobs, and the second is the real one: it darkens the board's rim, which
 * is where bugs enter — so a body walking in from off-screen fades UP into the
 * light instead of popping into existence at the edge.
 */
export const paintVignette = (
  ctx: CanvasRenderingContext2D, w: number, h: number, world: WorldId, strength = 1
): void => {
  const r = Math.hypot(w, h) * 0.5
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.42, w / 2, h / 2, r)
  const shade = WORLDS[world].floor.shade
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, shade)
  ctx.save()
  ctx.globalAlpha = 0.42 * strength
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}
