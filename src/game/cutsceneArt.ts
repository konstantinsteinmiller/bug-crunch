/**
 * ─── Drawing a cutscene ─────────────────────────────────────────────────────
 *
 * The same painted art the board uses, under a camera that can go anywhere.
 *
 * ── Why this is not `drawScene` ──
 *
 * `useBugCrunchArt.drawScene` reads the LIVE SIMULATION — `getBoard`, `getFoot`,
 * `getBugs` — and draws it at a fixed scale with the board filling the viewport.
 * A cutscene has no simulation behind it and its whole point is that the camera
 * moves, so it gets its own pass. What it shares is everything that matters: the
 * floor tile, the painted walk strips through `bugFrame`, the painted shoe, the
 * painted bosses, the painted props, and the ink vocabulary the set dressing is
 * drawn in.
 *
 * ── The set dressing is DRAWN, not painted ──
 *
 * The plate, the glass, the book, the blanket's hem, the attic's boxes and the
 * arcade cabinet do not go through the art pipeline. They are background, they
 * are on screen for a second or two each, they are never seen close, and a round
 * trip through the image model plus a slice is a poor trade against an afternoon
 * of canvas. `cutscenes.md` makes the same call and says why.
 *
 * They still follow the house rules (`inkArt`): one ink colour `#2b1b2e` and
 * never pure black, one key light from the upper left, fat even contours,
 * generous radii.
 *
 * ── What IS painted, and was not being used ──
 *
 * `images/bosses/*.webp` has been preloaded on every world's level since the
 * pipeline landed and was never once drawn — `paintBoss` draws the procedural
 * body and never asks for the painting. Cutscene 04 and the boss stingers are
 * where those four files finally earn their bytes: `bossStill` below is the
 * painted-first read the board never had.
 */

import { INK } from '@/game/inkArt'
import { bakeSlice, bugFrame, bugFrameEdge, paintBoss } from '@/game/bugArt'
import { floorTile } from '@/game/floorArt'
import { paintHazard, paintPod } from '@/game/propArt'
import { paintShoe, paintStompRing, shoeSprite, SHOE_BOX } from '@/game/footArt'
import { shoeSpec, type ShoeId } from '@/game/shoes'
import { spriteFor } from '@/game/art'
import { ART_BRAND } from '@/game/artCatalogue'
import { prependBaseUrl } from '@/utils/function'
import type { CutsceneFrame, CutsceneSet } from '@/game/cutscene'
import type { WorldId } from '@/game/stages'

/**
 * World units across one floor tile.
 *
 * The board draws its tile at a fixed 256 CSS px whatever the screen is; a
 * cutscene cannot, because the camera zooms and a gingham that does not zoom
 * with it reads as the blanket sliding under the picnic. 30 units puts the
 * check at about the size the board shows it at zoom 1.
 */
const TILE_U = 30

/** Where the world-1 picnic is laid out, in world units. Shared by the painters
 *  and by `cutscene.ts`'s cameras, which are aimed at these. */
const PLATE = { x: 50, y: 42, r: 13 }

/**
 * …and where world 2 parks it: east of the board, and BIG.
 *
 * 02 has to leave the picnic behind for real — see the note on `TRAIL`. Two
 * numbers here are load-bearing:
 *
 *   `x - hw` is past 100, so the blanket is entirely off the board at the
 *   hand-off framing and 2-1 opens on bare grass.
 *
 *   `hh` is 58, not the 30 that looked right in a square viewport. The renderer
 *   scales on the SHORT edge, so a 420x860 phone in portrait sees 205 world
 *   units of height at zoom 1 — a blanket sized for a square window has grass
 *   above and below it on a phone, and the opening beat is supposed to be
 *   nothing but blanket.
 */
const YARD = { x: 146, y: 40, hw: 40, hh: 58 }

// ─── Small ink helpers ──────────────────────────────────────────────────────

const roundRect = (
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
): void => {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** One soft drop shadow, down and right — the house's single key light. */
const shadow = (ctx: CanvasRenderingContext2D, draw: () => void, d = 0.9): void => {
  ctx.save()
  ctx.globalAlpha = 0.18
  ctx.fillStyle = INK
  ctx.translate(d, d)
  draw()
  ctx.fill()
  ctx.restore()
}

/** Deterministic 0..1 — the set dressing must not shimmer between frames. */
const hash1 = (n: number): number => {
  const x = Math.sin(n * 91.7 + 47.3) * 25413.531
  return x - Math.floor(x)
}

// ─── The picnic props ───────────────────────────────────────────────────────

/** The paperback, face-down and going soft in the sun. */
const paintBook = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.34)
  const w = 17
  const h = 23
  shadow(ctx, () => roundRect(ctx, -w / 2, -h / 2, w, h, 1.2))
  roundRect(ctx, -w / 2, -h / 2, w, h, 1.2)
  ctx.fillStyle = '#4a7fb5'
  ctx.fill()
  ctx.lineWidth = 1.1
  ctx.strokeStyle = INK
  ctx.stroke()
  // The pages, as one wedge down the spine side.
  roundRect(ctx, w / 2 - 3.4, -h / 2 + 1, 3, h - 2, 0.8)
  ctx.fillStyle = '#f3e7cf'
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/** The lemonade glass, seen from above: a ring, a disc of lemonade, a slice. */
const paintGlass = (ctx: CanvasRenderingContext2D, x: number, y: number): void => {
  ctx.save()
  ctx.translate(x, y)
  shadow(ctx, () => { ctx.beginPath(); ctx.arc(0, 0, 7.4, 0, Math.PI * 2) }, 1.1)
  ctx.beginPath()
  ctx.arc(0, 0, 7.4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(214,236,246,0.85)'
  ctx.fill()
  ctx.lineWidth = 1.2
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, 5.6, 0, Math.PI * 2)
  ctx.fillStyle = '#ffd95e'
  ctx.fill()
  ctx.strokeStyle = 'rgba(43,27,46,0.55)'
  ctx.lineWidth = 0.7
  ctx.stroke()
  // A lemon slice floating at four o'clock.
  ctx.beginPath()
  ctx.arc(2.4, 1.8, 2.3, 0, Math.PI * 2)
  ctx.fillStyle = '#fff3b0'
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.5
  ctx.stroke()
  ctx.restore()
}

/**
 * The plate and what is on it.
 *
 * `left` is how much sandwich is still there — it is carried off across beats 5
 * and 6 of the intro, so the wide shot has something to lose rather than just
 * more ants. 02 opens on the same plate with `left` at zero, which is the whole
 * of its first beat; 05 hands it back whole, which is the whole of its last.
 */
const paintPlate = (
  ctx: CanvasRenderingContext2D, x: number, y: number, left: number
): void => {
  ctx.save()
  ctx.translate(x, y)
  shadow(ctx, () => { ctx.beginPath(); ctx.arc(0, 0, PLATE.r, 0, Math.PI * 2) }, 1.2)
  ctx.beginPath()
  ctx.arc(0, 0, PLATE.r, 0, Math.PI * 2)
  ctx.fillStyle = '#fbf6ee'
  ctx.fill()
  ctx.lineWidth = 1.3
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, PLATE.r - 2.4, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(43,27,46,0.28)'
  ctx.lineWidth = 0.7
  ctx.stroke()

  if (left > 0.02) {
    // Two HALVES of a round sandwich, tilted apart, each showing its filling
    // along the cut.
    //
    // The first cut of this was two upright triangles side by side with one
    // green squiggle across them, and from the wide shot it read as a letter M
    // rather than as food — the two apexes met in the middle and made a
    // serif. Tilting them apart and rounding the crust is what turns it back
    // into lunch.
    ctx.save()
    ctx.translate(-1.6 * (1 - left), 0)
    const k = 0.5 + left * 0.5
    ctx.scale(k, k)
    for (const side of [-1, 1]) {
      ctx.save()
      ctx.translate(side * 4.6, side * 0.6)
      ctx.rotate(side * 0.55)
      // The crust: a fat wedge with every corner rounded.
      ctx.beginPath()
      ctx.moveTo(-5.4, 3.6)
      ctx.quadraticCurveTo(-6.2, -1.2, -2.2, -4.6)
      ctx.quadraticCurveTo(1.8, -7.2, 5.2, -3.4)
      ctx.quadraticCurveTo(6.4, 0.4, 4.2, 3.8)
      ctx.quadraticCurveTo(0, 5.2, -5.4, 3.6)
      ctx.closePath()
      ctx.fillStyle = '#f0c987'
      ctx.fill()
      ctx.lineWidth = 1.1
      ctx.strokeStyle = INK
      ctx.stroke()
      // The soft inside, sitting a little up-left of the crust — the one key
      // light, as every other drawable in this game has it.
      ctx.beginPath()
      ctx.ellipse(-0.4, -0.8, 3.6, 3, -0.2, 0, Math.PI * 2)
      ctx.fillStyle = '#fbe6bd'
      ctx.fill()
      // The filling, as a frill along the bottom cut rather than a line across
      // the middle: it is what says there is something BETWEEN two slices.
      //
      // Four scallops rather than two, and thinner. The first cut used one fat
      // 1.7-wide stroke per half and the two halves' strokes met in the middle
      // — at the size 05 frames the plate at, that is not lettuce, it is a
      // green worm lying on the bread.
      ctx.beginPath()
      ctx.moveTo(-5.1, 3.3)
      ctx.quadraticCurveTo(-3.8, 5.1, -2.4, 3.6)
      ctx.quadraticCurveTo(-1, 5.3, 0.3, 3.7)
      ctx.quadraticCurveTo(1.7, 5.2, 3, 3.7)
      ctx.quadraticCurveTo(4, 4.6, 4.6, 3.9)
      ctx.lineWidth = 1.05
      ctx.strokeStyle = '#7fbf5a'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
      ctx.lineWidth = 0.4
      ctx.strokeStyle = 'rgba(58,104,40,0.55)'
      ctx.stroke()
      ctx.restore()
    }
    ctx.restore()
  }
  ctx.restore()
}

/** The crumb the whole war is about. `a` fades it in and out — 01 tips it off
 *  the plate and 05 takes it away, and both are a dial rather than a branch. */
const paintCrumb = (
  ctx: CanvasRenderingContext2D, x: number, y: number, a = 1
): void => {
  if (a <= 0.01) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, a)
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.ellipse(0, 0, 1.15, 0.85, 0.4, 0, Math.PI * 2)
  ctx.fillStyle = '#e8c98a'
  ctx.fill()
  ctx.lineWidth = 0.45
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.restore()
}

/** Loose crumbs, left behind. `n` of them scattered around a point. */
const scatterCrumbs = (
  ctx: CanvasRenderingContext2D, x: number, y: number, n: number, seed: number
): void => {
  for (let i = 0; i < n; i++) {
    paintCrumb(ctx,
      x + (hash1(seed + i * 3.7) - 0.5) * 16,
      y + (hash1(seed + i * 6.1) - 0.5) * 12,
      0.9)
  }
}

// ─── The floor ──────────────────────────────────────────────────────────────

/**
 * One `CanvasPattern` per world, kept beside the TILE it was built from.
 *
 * The tile is what goes stale: `floorArt.resetFloors()` runs when a painted
 * floor decodes or the art flag flips, and it hands out a brand new canvas
 * afterwards. A pattern cached on the world id alone would keep drawing the
 * procedural gingham for the rest of the session — so the cache is checked
 * against the tile's identity rather than against a reset call it has to be
 * told about. Nothing has to remember to invalidate this.
 */
const patterns = new Map<WorldId, { tile: HTMLCanvasElement; p: CanvasPattern | null }>()

/** Drop them all anyway, for a caller that would rather not rely on the above. */
export const resetCutsceneArt = (): void => { patterns.clear() }

/**
 * Fill the WHOLE canvas with a world's floor tile, in SCREEN space.
 *
 * Filled in screen space with a pattern scaled by hand, rather than in world
 * space: a pattern under a world transform is resampled every frame as the
 * camera moves, and on a zooming shot that is the most expensive thing on
 * screen. This way the tile is one matrix and the fill is one rect.
 *
 * The caller must already be in screen space, and may have a clip in force —
 * which is exactly how the blanket gets a second floor inside the first.
 */
const fillFloor = (
  ctx: CanvasRenderingContext2D,
  world: WorldId, cssW: number, cssH: number,
  camX: number, camY: number, s: number
): void => {
  const tile = floorTile(world)
  let hit = patterns.get(world)
  if (!hit || hit.tile !== tile) {
    hit = { tile, p: ctx.createPattern(tile, 'repeat') }
    patterns.set(world, hit)
  }
  const p = hit.p
  if (!p) {
    ctx.fillStyle = '#c9524e'
    ctx.fillRect(0, 0, cssW, cssH)
    return
  }
  const k = (TILE_U * s) / tile.width
  const ox = cssW / 2 - camX * s
  const oy = cssH / 2 - camY * s
  p.setTransform(new DOMMatrix([k, 0, 0, k, ox, oy]))
  ctx.fillStyle = p
  ctx.fillRect(0, 0, cssW, cssH)
}

// ─── The sets ───────────────────────────────────────────────────────────────

/** What a set painter is handed: the frame, and the two transforms it may need.
 *  `world()` and `screen()` put the context into world or device space; every
 *  painter is called in world space and must leave it there. */
interface SetCtx {
  ctx: CanvasRenderingContext2D
  f: CutsceneFrame
  cssW: number
  cssH: number
  /** CSS px per world unit at this frame's zoom. */
  s: number
  world: () => void
  screen: () => void
}

/** World 1, laid out. 01 lives here and 05 comes home to it. */
const setPicnic = ({ ctx, f }: SetCtx): void => {
  paintBook(ctx, 20, 70)
  paintGlass(ctx, 76, 66)
  paintPlate(ctx, PLATE.x, PLATE.y, f.sandwich)
  // Full opacity well before the dial reaches 1, so the crumb reads as a crumb
  // that fell rather than as a crumb that faded up.
  paintCrumb(ctx, f.crumbAt.x, f.crumbAt.y, f.crumb * 2.2)
}

/**
 * World 2 with the blanket still in it — the shot 02 is built on.
 *
 * The blanket is the world-1 floor tile CLIPPED to a patch. The clip is set in
 * world space and then the transform is dropped back to screen space to do the
 * fill, because a `CanvasPattern` under a zooming world transform is resampled
 * every frame; the clip survives the transform change, the cost does not.
 */
const setYard = (sc: SetCtx): void => {
  const { ctx, f, cssW, cssH, s } = sc
  const { x: cx, y: cy, hw, hh } = YARD

  // The blanket's own shadow on the grass, so it sits ON something.
  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.fillStyle = INK
  roundRect(ctx, cx - hw + 1.4, cy - hh + 1.6, hw * 2, hh * 2, 5)
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundRect(ctx, cx - hw, cy - hh, hw * 2, hh * 2, 5)
  ctx.clip()
  sc.screen()
  fillFloor(ctx, 1, cssW, cssH, f.camera.x, f.camera.y, s)
  sc.world()
  ctx.restore()

  // The hem: a fat contour and a paler inner line, which is what a folded edge
  // looks like from directly above and is the only cue that says "this is a
  // thing lying on the grass" rather than "the floor changed".
  roundRect(ctx, cx - hw, cy - hh, hw * 2, hh * 2, 5)
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.1
  ctx.stroke()
  roundRect(ctx, cx - hw + 1.4, cy - hh + 1.4, hw * 2 - 2.8, hh * 2 - 2.8, 4)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 0.6
  ctx.stroke()

  paintBook(ctx, cx - 27, cy + 26)
  paintGlass(ctx, cx + 27, cy + 26)
  paintPlate(ctx, cx, cy - 6, f.sandwich)
  scatterCrumbs(ctx, cx + 4, cy - 2, 4, 3)
  paintCrumb(ctx, f.crumbAt.x, f.crumbAt.y, f.crumb * 2.2)

  // …and the yard itself, so the grass the camera crosses onto is not bare.
  paintYardProps(ctx)
}

/** Open grass with its own litter. 05 crosses it; the beetle king stands on it. */
const setBackyard = ({ ctx }: SetCtx): void => { paintYardProps(ctx) }

const YARD_PROPS: readonly [string, number, number, number][] = [
  ['honey', 22, 78, 7],
  ['crumbs', 62, 92, 6],
  ['honey', 86, 34, 5.5],
  ['crumbs', 14, 30, 5]
]

const paintYardProps = (ctx: CanvasRenderingContext2D): void => {
  for (const [id, x, y, r] of YARD_PROPS) {
    ctx.save()
    ctx.translate(x, y)
    paintHazard(ctx, id as 'honey', r, { t: 0 })
    ctx.restore()
  }
}

/** One cardboard box, taped shut, seen from above. */
const paintBox = (
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number
): void => {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(a)
  shadow(ctx, () => roundRect(ctx, -w / 2, -h / 2, w, h, 1.6), 1.4)
  roundRect(ctx, -w / 2, -h / 2, w, h, 1.6)
  ctx.fillStyle = '#b98b55'
  ctx.fill()
  ctx.lineWidth = 1.2
  ctx.strokeStyle = INK
  ctx.stroke()
  // The seam down the middle and the tape across it.
  ctx.beginPath()
  ctx.moveTo(0, -h / 2 + 1)
  ctx.lineTo(0, h / 2 - 1)
  ctx.strokeStyle = 'rgba(43,27,46,0.4)'
  ctx.lineWidth = 0.7
  ctx.stroke()
  roundRect(ctx, -w / 2 + 1, -2.2, w - 2, 4.4, 0.6)
  ctx.fillStyle = 'rgba(232,214,178,0.85)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(43,27,46,0.35)'
  ctx.lineWidth = 0.5
  ctx.stroke()
  ctx.restore()
}

const ATTIC_BOXES: readonly [number, number, number, number, number][] = [
  [16, 20, 26, 22, -0.18],
  [80, 26, 22, 20, 0.22],
  [22, 82, 24, 20, 0.1],
  [82, 84, 20, 18, -0.28]
]

const ATTIC_WEBS: readonly [number, number, number][] = [
  [8, 8, 13], [92, 12, 11], [6, 94, 12], [94, 90, 10]
]

/** World 3. Boxes, cobwebs, and a floor of bare board. */
const setAttic = ({ ctx }: SetCtx): void => {
  for (const [x, y, w, h, a] of ATTIC_BOXES) paintBox(ctx, x, y, w, h, a)
  for (const [x, y, r] of ATTIC_WEBS) {
    ctx.save()
    ctx.translate(x, y)
    ctx.globalAlpha = 0.85
    paintHazard(ctx, 'cobweb', r, { t: 0 })
    ctx.restore()
  }
}

/**
 * Where the door's bottom edge sits, in world units. Everything above it is
 * door; the five units below it are the strip of daylight the trail is walking
 * into.
 */
const DOOR_EDGE = 60

/**
 * The attic under a door — 03's first two beats.
 *
 * Its own set rather than a branch inside `setAttic`, because 05 comes back
 * THROUGH the attic and must not find a door standing in the middle of it. The
 * `set` on the beat is exactly the mechanism for that.
 *
 * Only the floor half is here. The door itself is in `overDoor`, which runs
 * AFTER the cast: a column that walks over the top of the door it is supposed to
 * be going under is not going under anything, and the occlusion is the shot.
 */
const setDoor = (sc: SetCtx): void => { setAttic(sc) }

/**
 * The door, painted OVER the cast so the trail disappears beneath it.
 *
 * Everything here sits in the ten world units immediately above `DOOR_EDGE`,
 * and that is not decoration — the beat frames about thirteen units of door, so
 * a panel authored thirty units up is a panel nobody will ever see. The first
 * cut had exactly that and the shot read as "the screen gets darker at the top".
 *
 * The one cue that does all the work is the STRIP OF DAYLIGHT: a hard bright
 * line along the edge with a short falloff under it. A dark band alone is a
 * shadow; a dark band with light leaking out from under it is a door.
 */
const overDoor = ({ ctx }: SetCtx): void => {
  // Light first, so the door's own contour lands on top of it.
  //
  // It has to be brighter than it looks like it needs to be: the beat runs under
  // a `dark` wash, and the first cut's 0.95 cream measured at RGB 156 on screen
  // once the ink was laid over it — a warmer floorboard, not a strip of
  // daylight. The hot core is what survives the grade.
  const g = ctx.createLinearGradient(0, DOOR_EDGE, 0, DOOR_EDGE + 15)
  g.addColorStop(0, 'rgba(255,250,228,1)')
  g.addColorStop(0.14, 'rgba(255,240,198,0.92)')
  g.addColorStop(0.45, 'rgba(255,228,168,0.42)')
  g.addColorStop(1, 'rgba(255,222,160,0)')
  ctx.fillStyle = g
  ctx.fillRect(-200, DOOR_EDGE, 500, 15)
  // …and a hot line right on the sill, which is the single cue that says DOOR.
  ctx.fillStyle = '#fffdf2'
  ctx.fillRect(-200, DOOR_EDGE + 0.2, 500, 1.1)

  // The door: everything above the edge, and much darker than the boards so the
  // two never read as the same surface.
  ctx.beginPath()
  ctx.rect(-200, -200, 500, 200 + DOOR_EDGE)
  ctx.fillStyle = '#3a2a1e'
  ctx.fill()

  // Two sunk panels and the rail between them, in the strip that is actually on
  // screen.
  for (const px of [8, 54]) {
    roundRect(ctx, px, DOOR_EDGE - 30, 38, 24, 1.8)
    ctx.fillStyle = '#4e3a28'
    ctx.fill()
    ctx.strokeStyle = 'rgba(16,10,6,0.65)'
    ctx.lineWidth = 1.1
    ctx.stroke()
    roundRect(ctx, px + 3, DOOR_EDGE - 27, 32, 18, 1.2)
    ctx.strokeStyle = 'rgba(255,224,178,0.14)'
    ctx.lineWidth = 0.9
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(-200, DOOR_EDGE - 4)
  ctx.lineTo(300, DOOR_EDGE - 4)
  ctx.strokeStyle = 'rgba(16,10,6,0.5)'
  ctx.lineWidth = 1.1
  ctx.stroke()

  // …and the edge itself, fat, because that line IS the door.
  ctx.beginPath()
  ctx.moveTo(-200, DOOR_EDGE)
  ctx.lineTo(300, DOOR_EDGE)
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.6
  ctx.stroke()
}

/**
 * World 4 seen from IN FRONT of the glass: a cabinet in attract mode.
 *
 * A whole object, drawn at board scale, so the opening beat can show it as a
 * CABINET — the first cut framed the camera inside the screen and read as a
 * dark field with two neon lines across it, which is not a cabinet, it is a
 * gradient. The bezel has to be in shot for the marquee above it to mean
 * anything.
 */
const setCabinet = ({ ctx, f }: SetCtx): void => {
  // The body.
  roundRect(ctx, 6, 4, 88, 92, 6)
  ctx.fillStyle = '#141833'
  ctx.fill()
  ctx.lineWidth = 2.2
  ctx.strokeStyle = '#3de0ff'
  ctx.stroke()
  ctx.lineWidth = 0.9
  ctx.strokeStyle = 'rgba(255,79,122,0.75)'
  roundRect(ctx, 8.6, 6.6, 82.8, 86.8, 5)
  ctx.stroke()

  // The marquee the roach walks across.
  roundRect(ctx, 12, 10, 76, 18, 2.4)
  ctx.fillStyle = '#231041'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,79,122,0.95)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  // Two neon rules standing in for a wordless logo: the scene is wordless, so
  // the marquee cannot carry a title.
  for (const [ry, col] of [[14.5, '#3de0ff'], [23.5, '#ff4f7a']] as const) {
    ctx.beginPath()
    ctx.moveTo(16, ry)
    ctx.lineTo(84, ry)
    ctx.strokeStyle = col
    ctx.lineWidth = 0.9
    ctx.globalAlpha = 0.6
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // The screen.
  roundRect(ctx, 12, 34, 76, 56, 2.4)
  ctx.fillStyle = '#080b18'
  ctx.fill()
  ctx.strokeStyle = 'rgba(61,224,255,0.8)'
  ctx.lineWidth = 1.1
  ctx.stroke()

  ctx.save()
  roundRect(ctx, 12, 34, 76, 56, 2.4)
  ctx.clip()
  // A vanishing-point lattice: the cheapest thing that reads as "a game is
  // running in there".
  ctx.strokeStyle = `rgba(61,224,255,${0.18 + f.glow * 0.16})`
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 10; i++) {
    ctx.beginPath()
    ctx.moveTo(12 + i * 7.6, 90)
    ctx.lineTo(50 + (i - 5) * 1.2, 40)
    ctx.stroke()
  }
  for (let i = 0; i <= 6; i++) {
    const y = 40 + Math.pow(i / 6, 1.8) * 50
    ctx.beginPath()
    ctx.moveTo(12, y)
    ctx.lineTo(88, y)
    ctx.stroke()
  }
  // Two big chevrons pointing the way in, and a row of blocks: a game, in the
  // way an attract screen is a game.
  ctx.strokeStyle = `rgba(255,79,122,${0.55 + f.glow * 0.35})`
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  for (const cy of [56, 72]) {
    ctx.beginPath()
    ctx.moveTo(40, cy - 6)
    ctx.lineTo(52, cy)
    ctx.lineTo(40, cy + 6)
    ctx.stroke()
  }
  ctx.fillStyle = `rgba(61,224,255,${0.3 + f.glow * 0.3})`
  for (let i = 0; i < 5; i++) ctx.fillRect(16 + i * 6, 82, 4, 4)
  ctx.restore()
}

/**
 * The glass, and going through it.
 *
 * Over the cast, because the roach is BEHIND the glass as far as the scanlines
 * are concerned — an attract-mode sprite with no scanlines over it is a sticker
 * on the screen rather than a thing inside it.
 */
const overCabinet = (sc: SetCtx): void => {
  const { ctx, f, cssW, cssH } = sc
  sc.screen()
  ctx.save()
  // Scanlines in SCREEN space so they stay one pixel apart however far the
  // camera pushes in — a scanline that zooms is a stripe.
  ctx.globalAlpha = 0.2
  ctx.fillStyle = '#000'
  for (let y = 0; y < cssH; y += 3) ctx.fillRect(0, y, cssW, 1)
  // A soft specular across the glass, which is what makes it glass.
  const g = ctx.createLinearGradient(0, 0, cssW * 0.7, cssH)
  g.addColorStop(0, 'rgba(255,255,255,0.09)')
  g.addColorStop(0.45, 'rgba(255,255,255,0)')
  ctx.globalAlpha = 1
  ctx.fillStyle = g
  ctx.fillRect(0, 0, cssW, cssH)
  ctx.restore()

  // The push-through. Cubed, so the glass holds until the very end of the beat
  // and then the screen is the only thing in the world.
  if (f.beat === 2) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, Math.pow(f.beat01, 3) * 1.15)
    ctx.fillStyle = '#9ff4ff'
    ctx.fillRect(0, 0, cssW, cssH)
    ctx.restore()
  }
  sc.world()
}

const ARCADE_PROPS: readonly [string, number, number, number][] = [
  ['magnet', 16, 70, 6],
  ['magnet', 84, 74, 6],
  ['conveyor', 30, 36, 9],
  ['conveyor', 50, 36, 9],
  ['conveyor', 70, 36, 9]
]

/** World 4 from inside: the factory floor the attract screen was advertising. */
const setArcade = ({ ctx, f }: SetCtx): void => {
  // A neon lane down the middle, under everything: the conveyor's run.
  ctx.save()
  ctx.globalAlpha = 0.35 + f.glow * 0.4
  ctx.fillStyle = 'rgba(61,224,255,0.16)'
  ctx.fillRect(-20, 29, 160, 15)
  ctx.strokeStyle = 'rgba(61,224,255,0.55)'
  ctx.lineWidth = 0.7
  ctx.strokeRect(-20, 29, 160, 15)
  ctx.restore()

  for (const [id, x, y, r] of ARCADE_PROPS) {
    ctx.save()
    ctx.translate(x, y)
    paintHazard(ctx, id as 'magnet', r, { t: 0, angle: id === 'conveyor' ? 0 : undefined })
    ctx.restore()
  }
  // A rack of pods along the bottom — the line's output, which is the joke.
  for (let i = 0; i < 5; i++) {
    ctx.save()
    ctx.translate(20 + i * 15, 92)
    paintPod(ctx, 5, 0.25 + i * 0.12, '#ff4f7a')
    ctx.restore()
  }
}

const SETS: Record<CutsceneSet, (sc: SetCtx) => void> = {
  none: () => {},
  picnic: setPicnic,
  yard: setYard,
  backyard: setBackyard,
  attic: setAttic,
  door: setDoor,
  cabinet: setCabinet,
  arcade: setArcade
}

/**
 * The half of a set that goes OVER the cast.
 *
 * Two sets need it and both for the same reason — something in the scene is in
 * FRONT of the creatures. The door 03 opens on has to hide the column walking
 * under it, and the glass 04 opens on has to lay its scanlines over the roach
 * behind it. Without the over-pass the trail walks over the door and the roach
 * sits on the screen like a sticker, and in both cases the shot is the occlusion.
 */
const OVER: Partial<Record<CutsceneSet, (sc: SetCtx) => void>> = {
  door: overDoor,
  cabinet: overCabinet
}

// ─── The cast ───────────────────────────────────────────────────────────────

/**
 * A boss's painted still, if it has decoded.
 *
 * Painted-FIRST, and the first place in the game that reads these files at all.
 * The panel is square with the head to the top, the same authoring convention
 * the walk strips use, so it drops into the same rotated box.
 */
const drawBoss = (
  ctx: CanvasRenderingContext2D, id: Parameters<typeof paintBoss>[1], size: number
): void => {
  const painted = spriteFor('boss', id)
  if (painted && painted.naturalWidth > 0) {
    const e = size * 2.4
    ctx.drawImage(painted, -e / 2, -e / 2, e, e)
    return
  }
  paintBoss(ctx, id, size, 0.12, 1)
}

/**
 * The greeter bitmap, loaded once, lazily, by path.
 *
 * NOT through `spriteFor`: the mascot is a brand asset (`ART_BRAND.mascot`),
 * which the art layer never probes — `art:status` lists it under "painted, never
 * probed" for exactly this reason. The splash reaches it the same way, with a
 * plain `<img src>`.
 *
 * Never blocks: until it decodes, `greeterSprite()` is null and the drawn
 * rear-up plays instead, which is the same fallback contract every painted
 * drawable in this game keeps.
 */
let greeter: HTMLImageElement | null = null
let greeterAsked = false

const greeterSprite = (): HTMLImageElement | null => {
  if (!greeterAsked && typeof window !== 'undefined') {
    greeterAsked = true
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = prependBaseUrl(ART_BRAND.mascot)
      img.addEventListener('load', () => { if (img.naturalWidth > 0) greeter = img }, { once: true })
    } catch { /* the drawn rear-up is the floor */ }
  }
  return greeter
}

// ─── The pass ───────────────────────────────────────────────────────────────

/**
 * Draw one frame of a cutscene.
 *
 * `cssW`/`cssH` are the CSS size of the canvas; the caller has already applied
 * the device-pixel transform, exactly as `drawScene` expects it.
 */
export const drawCutscene = (
  ctx: CanvasRenderingContext2D,
  cssW: number, cssH: number,
  f: CutsceneFrame,
  shoe: ShoeId
): void => {
  // The bug bakes are sliced from `drawScene`, which does not run while a scene
  // owns the frame — so a scene that opened before the cast finished baking used
  // to draw an empty floor until it ended. Two slices a frame is the same budget
  // the board spends.
  bakeSlice(2)

  const s = (Math.min(cssW, cssH) / 100) * f.camera.zoom
  const base = ctx.getTransform()

  const screen = (): void => { ctx.setTransform(base) }
  const world = (): void => {
    ctx.setTransform(base)
    ctx.translate(cssW / 2, cssH / 2)
    ctx.scale(s, s)
    ctx.translate(-f.camera.x, -f.camera.y)
  }

  ctx.save()
  ctx.clearRect(0, 0, cssW, cssH)

  // ── The floor ──
  fillFloor(ctx, f.world, cssW, cssH, f.camera.x, f.camera.y, s)

  // ── The set ──
  world()
  const sc: SetCtx = { ctx, f, cssW, cssH, s, world, screen }
  ctx.save()
  SETS[f.set](sc)
  ctx.restore()

  // ── The cast ──
  // Back to front by y, the same rule the board draws bodies with, so a body
  // nearer the camera overlaps one further away.
  for (const a of [...f.actors].sort((p, q) => p.y - q.y)) {
    // ── Turned to the camera ──
    //
    // This wants the GREETER — the painting the loading screen waves with —
    // because "the ant that waved at you is the one that robs you" is the whole
    // reason the intro opens on it.
    //
    // It used to ask `spriteFor('ui', 'mascot')`, which could never work: the
    // mascot is a BRAND asset, not a probed drawable. It lives at
    // `images/logo/mascot.webp` (`ART_BRAND.mascot`) and `spriteFor('ui', …)`
    // looks in `images/ui/`, so the call returned null on every frame and the
    // hook silently degraded to a plain ant standing still. It is loaded here
    // the same way the splash loads it — directly, by path.
    //
    // The DRAWN rear-up stays as the floor under it, and earns its place: it is
    // what plays for the half-second before the bitmap decodes, and what plays
    // for every other creature that turns to camera (05's last ant is not the
    // greeter). It is the one thing a top-down view can do for eye contact —
    // the creature stops, grows, its shadow separates, and it turns its head
    // down the screen.
    const look = a.waving
    if (look) {
      ctx.save()
      ctx.globalAlpha = 0.24
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.ellipse(a.x + a.size * 0.22, a.y + a.size * 0.4,
        a.size * 0.98, a.size * 0.74, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    ctx.save()
    ctx.translate(a.x, a.y)
    // Head DOWN the screen, and lifted off its own shadow.
    ctx.rotate(look ? Math.PI : a.heading)
    if (look) ctx.translate(0, -a.size * 0.3)

    const mascot = look && a.greeter ? greeterSprite() : null
    if (mascot && mascot.naturalWidth > 0) {
      const e = a.size * 3.2
      ctx.drawImage(mascot, -e / 2, -e / 2, e, e)
    } else if (a.boss) {
      drawBoss(ctx, a.boss, a.size)
    } else {
      // Frozen at the top of its cycle while it looks: a creature that keeps
      // stepping while it stares at you is marching on the spot.
      const frame = bugFrame(a.bug, look ? 0 : a.cycle)
      const edge = a.size * 2 / 0.62 * (look ? 1.3 : 1)
      if (frame) {
        const src = bugFrameEdge(a.bug)
        const k = edge / Math.max(1, src)
        ctx.drawImage(frame, -src * k / 2, -src * k / 2, src * k, src * k)
      }
    }
    ctx.restore()

    // Carried crumbs are drawn OUTSIDE the body's rotation, just ahead of the
    // head, so they read as held rather than as part of the sprite.
    if (a.carry) {
      const h = look ? Math.PI : a.heading
      const reach = look ? 1.5 : 1.2
      paintCrumb(ctx, a.x + Math.sin(h) * a.size * reach,
        a.y - Math.cos(h) * a.size * reach)
    }
  }

  // ── The shoe ──
  // The shadow leads it: a shadow that grows and sharpens is the only way a
  // top-down camera can say "something is coming DOWN", and 01's beat 6 is built
  // entirely around it.
  if (f.shoe > 0.001) {
    const fall = f.shoe
    const spread = 1 + (1 - fall) * 0.9
    ctx.save()
    ctx.globalAlpha = 0.3 + 0.22 * fall
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.ellipse(50, 52, 13 * spread, 17 * spread, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.translate(50, 50)
    // Dropping in: big and high, settling to the size the board draws it.
    const half = 15 * (1 + (1 - fall) * 0.55)
    const painted = shoeSprite(shoe)
    if (painted && painted.naturalWidth > 0) {
      const pw = half * SHOE_BOX.w
      const ph = pw * (painted.naturalHeight / painted.naturalWidth)
      ctx.drawImage(painted, -pw / 2, -ph * SHOE_BOX.toeFromTop, pw, ph)
    } else {
      paintShoe(ctx, shoe, shoeSpec(shoe), half)
    }
    ctx.restore()
  }

  // ── The set's front half ──
  world()
  ctx.save()
  OVER[f.set]?.(sc)
  ctx.restore()

  // ── The grade ──
  screen()
  paintDark(ctx, cssW, cssH, f, shoe, s)
  paintGlow(ctx, cssW, cssH, f)
  ctx.restore()
}

/**
 * Darkness, and the torch cut out of it.
 *
 * 03 climbs a staircase it has no art for by turning this up and then down
 * again, and 05 wipes between four worlds with it. The beam is centred on the
 * screen because the camera is what the torch is strapped to.
 */
const paintDark = (
  ctx: CanvasRenderingContext2D, cssW: number, cssH: number,
  f: CutsceneFrame, shoe: ShoeId, s: number
): void => {
  if (f.dark <= 0.003) return
  const cx = cssW / 2
  const cy = cssH / 2
  const edge = Math.min(cssW, cssH)

  if (f.torch <= 0.003) {
    ctx.save()
    ctx.globalAlpha = f.dark
    ctx.fillStyle = INK
    ctx.fillRect(0, 0, cssW, cssH)
    ctx.restore()
    return
  }

  // The beam narrows as the torch dial climbs: at 1 it is the stomp ring, which
  // is where 03 hands the level over.
  const r = (0.6 - 0.47 * f.torch) * edge
  ctx.save()
  // Everything outside the beam, flat.
  ctx.globalAlpha = f.dark
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.rect(0, 0, cssW, cssH)
  ctx.arc(cx, cy, r, 0, Math.PI * 2, true)
  ctx.fill()
  // …and a falloff inside it, so the beam has an edge rather than a cut-out.
  const g = ctx.createRadialGradient(cx, cy, r * 0.42, cx, cy, r)
  g.addColorStop(0, 'rgba(43,27,46,0)')
  g.addColorStop(1, `rgba(43,27,46,${f.dark})`)
  ctx.globalAlpha = 1
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  // A warm cast inside the beam — a torch is a lamp, not a hole.
  ctx.globalCompositeOperation = 'lighter'
  const warm = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  warm.addColorStop(0, `rgba(255,232,178,${0.1 * f.torch})`)
  warm.addColorStop(1, 'rgba(255,232,178,0)')
  ctx.fillStyle = warm
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // The last thing 03 does is admit what the beam has been all along.
  if (f.torch > 0.72) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, (f.torch - 0.72) / 0.22)
    paintStompRing(ctx, cx, cy, shoeSpec(shoe).radius * s, false, 0, false)
    ctx.restore()
  }
}

/** The arcade's own light: a neon bloom from the edges of the frame. */
const paintGlow = (
  ctx: CanvasRenderingContext2D, cssW: number, cssH: number, f: CutsceneFrame
): void => {
  if (f.glow <= 0.003) return
  const cx = cssW / 2
  const cy = cssH / 2
  const r = Math.hypot(cssW, cssH) / 2
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const g = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r)
  g.addColorStop(0, 'rgba(61,224,255,0)')
  g.addColorStop(0.62, `rgba(61,224,255,${0.1 * f.glow})`)
  g.addColorStop(1, `rgba(150,70,255,${0.22 * f.glow})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, cssW, cssH)
  ctx.restore()
}
