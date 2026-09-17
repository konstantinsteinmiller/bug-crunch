<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  WALKS, STILLS, GRIDS, framesOf, colsOf, rowsOf, promptDocs,
  type WalkSpec, type StillSpec, type GridSpec
} from '@/game/artSheet'
import { paintBug, paintBoss, paintSegment, BUG_R_FRAC, SEGMENT_ART_BOX } from '@/game/bugArt'
import { paintShoe } from '@/game/footArt'
import { paintFloorTile, FLOOR_TILE_PX } from '@/game/floorArt'
import {
  isEggPropId, paintCoin, paintEggProp, paintHaze, paintHazard, paintPod, paintSaltBurst
} from '@/game/propArt'
import { paintSceneRef } from '@/game/cutsceneArt'
import {
  paintBanner, paintChest, paintShockRing, paintSplat, paintUiIcon,
  SPLAT_REACH, SPLAT_REF_SEEDS, UI_ICON_IDS, type SplatSheetId, type UiIconId
} from '@/game/uiArt'
import { paintSmokeRef } from '@/use/useVfx'
import { shoeSpec, type ShoeId } from '@/game/shoes'
import { bugSpec, type BugId } from '@/game/bugs'
import type { BossId } from '@/game/bosses'
import { hazardSpec, type HazardId } from '@/game/hazards'
import type { WorldId } from '@/game/stages'
import { SHOE_BOX } from '@/game/artBoxes'
import { artOverridesEnabled, setArtOverrides } from '@/game/art'
import { ICON_PATHS } from '@/components/icons/iconPaths'
import { isGameIconName } from '@/components/icons/iconNames'

/**
 * `/art-sheets` — the reference bench.
 *
 * Bug Crunch has no art folder. Every bug, shoe, prop and effect is a few hundred
 * canvas operations, which is exactly what you want in a bundle and exactly what
 * you cannot hand to somebody who paints. This screen bakes the whole cast onto
 * the sheets described in `artSheet.ts` and writes them into `art-sheets/`
 * through a dev-only endpoint, so the art can go out to be repainted and come
 * back as drop-in bitmaps.
 *
 * THREE RULES, and they are all about the return trip.
 *
 *   1. Every reference is drawn by the GAME'S OWN PAINTER into the exact box the
 *      game blits the painting back into. A reference drawn from a private copy
 *      of the geometry agrees with itself and proves nothing.
 *   2. Nothing is written inside a panel. Captions live on the key sheets — text
 *      inside a frame is text an image model will dutifully repaint.
 *   3. Every reference is rendered on a TRANSPARENT canvas first and MEASURED
 *      there, then laid on the magenta sheet. The sheet itself has no alpha to
 *      measure, and the effects paint additively — additive light over magenta is
 *      a pink smear, over nothing it is the effect.
 *
 * Everything animated is frozen at a fixed phase rather than at the wall clock,
 * so re-exporting produces a byte-identical sheet and a diff means the art
 * actually changed.
 */

const status = ref('idle')
const busy = ref(false)
const previews = ref<{ id: string; title: string; url: string; dims: string }[]>([])

// ─── Fit measurement ────────────────────────────────────────────────────────
//
// Where the reference actually SITS inside its panel, as fractions of one.
// Measured, not declared, because it is the thing a painter is most likely to
// change without noticing. The slicer reads this back and normalises what it
// gets to match.

/**
 * Alpha floor for the fit measurement. Deliberately high: the effects have soft
 * glows and the creatures cast a soft ground shadow, and a soft edge is light,
 * not extent. At 140 a 32 %-opacity shadow is not part of the object.
 */
const FIT_ALPHA = 140

interface Fit { h: number; w: number; bottom: number; cx: number }

/**
 * Alpha bbox of one rectangle of a canvas, in that rectangle's own pixels.
 *
 * Solid pixels are grouped into connected pieces and a sliver (three pixels or
 * thinner) or a speck is left out — the SAME rule the slicer applies to a
 * return, so the two measure the same thing. The slicer needs it because a
 * neighbour's shadow bleeds across the cut line as a thin solid line; the bench
 * applies it so a design's own antenna beads do not put the reference's box
 * somewhere the return's can never land.
 */
const boxOf = (
  cv: HTMLCanvasElement, ox: number, oy: number, W: number, H: number
): { x0: number; y0: number; x1: number; y1: number } | null => {
  const d = cv.getContext('2d')!.getImageData(ox, oy, W, H).data
  const N = W * H
  const solid = new Uint8Array(N)
  for (let k = 0; k < N; k++) if (d[k * 4 + 3]! > FIT_ALPHA) solid[k] = 1
  const seen = new Uint8Array(N)
  const stack: number[] = []
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let k0 = 0; k0 < N; k0++) {
    if (!solid[k0] || seen[k0]) continue
    let n = 0
    let cx0 = W, cy0 = H, cx1 = -1, cy1 = -1
    seen[k0] = 1
    stack.push(k0)
    while (stack.length) {
      const k = stack.pop()!
      n++
      const x = k % W
      const y = (k / W) | 0
      if (x < cx0) cx0 = x
      if (x > cx1) cx1 = x
      if (y < cy0) cy0 = y
      if (y > cy1) cy1 = y
      if (x > 0 && solid[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; stack.push(k - 1) }
      if (x < W - 1 && solid[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; stack.push(k + 1) }
      if (y > 0 && solid[k - W] && !seen[k - W]) { seen[k - W] = 1; stack.push(k - W) }
      if (y < H - 1 && solid[k + W] && !seen[k + W]) { seen[k + W] = 1; stack.push(k + W) }
    }
    if (Math.min(cx1 - cx0 + 1, cy1 - cy0 + 1) <= 3 || n < 16) continue
    if (cx0 < x0) x0 = cx0
    if (cx1 > x1) x1 = cx1
    if (cy0 < y0) y0 = cy0
    if (cy1 > y1) y1 = cy1
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 }
}

/** The union of every panel's box, folded back into one panel. */
const fitOf = (
  cv: HTMLCanvasElement, cols: number, rows: number, pw: number, ph: number
): Fit | null => {
  let x0 = pw, y0 = ph, x1 = -1, y1 = -1
  for (let i = 0; i < cols * rows; i++) {
    const b = boxOf(cv, (i % cols) * pw, Math.floor(i / cols) * ph, pw, ph)
    if (!b) continue
    if (b.x0 < x0) x0 = b.x0
    if (b.y0 < y0) y0 = b.y0
    if (b.x1 > x1) x1 = b.x1
    if (b.y1 > y1) y1 = b.y1
  }
  if (x1 < 0) return null
  return {
    h: (y1 - y0 + 1) / ph,
    w: (x1 - x0 + 1) / pw,
    bottom: (y1 + 1) / ph,
    cx: ((x0 + x1) / 2) / pw
  }
}

const fits = new Map<string, Fit>()

// ─── Walks ──────────────────────────────────────────────────────────────────

/** Every panel of a walk on a transparent canvas, through the bake's own
 *  painter — so the reference is provably the frame box the game draws. */
const renderWalkAlpha = (walk: WalkSpec): HTMLCanvasElement => {
  const cv = document.createElement('canvas')
  cv.width = walk.w
  cv.height = walk.h
  const ctx = cv.getContext('2d')!
  for (let i = 0; i < walk.frames; i++) {
    ctx.save()
    ctx.translate((i % walk.cols) * walk.panelW, Math.floor(i / walk.cols) * walk.panelH)
    // Clipped to its own panel, exactly as the bake's frame clips it: an antenna
    // that overruns the frame is cut off in play, and left unclipped here it
    // lands in the NEXT panel, where it is measured as that panel's creature and
    // drags the whole strip's fit off by a quarter.
    ctx.beginPath()
    ctx.rect(0, 0, walk.panelW, walk.panelH)
    ctx.clip()
    ctx.translate(walk.panelW / 2, walk.panelH / 2)
    paintBug(ctx, walk.id as BugId, (walk.panelH / 2) * BUG_R_FRAC, i / walk.frames)
    ctx.restore()
  }
  return cv
}

// ─── Stills ─────────────────────────────────────────────────────────────────

/**
 * One still on a transparent canvas, through the game's own painter, into the
 * exact box the runtime blits the painting back into.
 *
 * Every size here is DERIVED from the panel and the painter's own blit contract
 * — a hazard is blitted into (−r, −r, 2r, 2r), so the reference draws it with r
 * at half the panel. Nothing is eyeballed.
 */
const renderStillAlpha = (s: StillSpec, cycle = 0): HTMLCanvasElement => {
  const cv = document.createElement('canvas')
  cv.width = s.w
  cv.height = s.h
  const ctx = cv.getContext('2d')!
  const cx = s.w / 2
  const cy = s.h / 2
  const half = Math.min(s.w, s.h) / 2
  ctx.save()

  switch (s.kind) {
    case 'shoe': {
      // The shoe's own box: portrait, toe at `toeFromTop`, drawn through the
      // renderer's painter at the half-length the box implies.
      const spec = shoeSpec(s.id as ShoeId)
      ctx.translate(cx, s.h * SHOE_BOX.toeFromTop)
      paintShoe(ctx, s.id as ShoeId, spec, s.w / SHOE_BOX.w)
      break
    }
    case 'boss':
      ctx.translate(cx, cy)
      paintBoss(ctx, s.id as BossId, half * 0.62, cycle, 0)
      break
    case 'bug':
      // A bug PART (the designs themselves are walks, not stills): the
      // centipede's tail segment, at the radius that makes the half-panel its
      // painted box — `bugArt.SEGMENT_ART_BOX` on both sides of the round trip.
      // `cycle` is `i / frames`, the stride position the runtime plays it at.
      ctx.translate(cx, cy)
      paintSegment(ctx, half / SEGMENT_ART_BOX, 0, cycle, { procedural: true })
      break
    case 'bg': {
      // A floor tile is drawn at its own tile resolution and scaled up, so the
      // reference is exactly what `floorArt` will later be replaced by.
      const tile = document.createElement('canvas')
      tile.width = FLOOR_TILE_PX
      tile.height = FLOOR_TILE_PX
      const w = Number(s.id.slice('floor-'.length)) as WorldId
      paintFloorTile(tile.getContext('2d')!, w)
      ctx.drawImage(tile, 0, 0, s.w, s.h)
      break
    }
    case 'scene':
      // Cutscene set dressing, through the scene renderer's own drawing, into the
      // panel exactly as `SCENE_ART_BOX` maps it at run time — the panel IS the
      // box, so there is no margin to add and nothing to centre by eye.
      paintSceneRef(ctx, s.id, s.w, s.h)
      break
    case 'prop':
      ctx.translate(cx, cy)
      if (s.id === 'coin') paintCoin(ctx, half * 0.82, 0)
      else if (s.id === 'pod') paintPod(ctx, half * 0.82, 0, '#ffd07a')
      // The brood: a crack-stage sheet is one stage per panel (`cycle` is
      // `i / frames`, so this is the panel index back), a shell is one still.
      // The half-panel IS the painting's box — see `propArt.EGG_ART_BOX`.
      else if (isEggPropId(s.id)) paintEggProp(ctx, s.id, half, Math.round(cycle * framesOf(s)))
      else if (s.id === 'conveyor' || s.id === 'sweeper') {
        // The bar-shaped props fill their panel edge to edge along x.
        paintHazard(ctx, s.id as HazardId, half, { t: 0, angle: 0 }, 3)
      } else {
        paintHazard(ctx, s.id as HazardId, half * 0.86, { t: 0, angle: 0 }, 3)
      }
      break
    case 'fx':
      ctx.translate(cx, cy)
      switch (s.id) {
        case 'ring-stomp': paintShockRing(ctx, half * 0.92, 0.55, 'rgba(255,255,255,0.95)', 0.7); break
        case 'ring-slam': paintShockRing(ctx, half * 0.92, 0.55, 'rgba(255,255,255,0.95)', 1.8); break
        case 'ring-fever': paintShockRing(ctx, half * 0.92, 0.5, 'rgba(255,205,0,0.95)', 2.6); break
        case 'burst': {
          // The comic burst, with nothing written in it — the game writes the
          // word over the middle, and a word painted into the reference is a
          // word the image model will faithfully repaint.
          ctx.save()
          ctx.beginPath()
          for (let i = 0; i < 22; i++) {
            const a = (i / 22) * Math.PI * 2 - Math.PI / 2
            const rr = (i % 2 === 0 ? half * 0.94 : half * 0.64)
            const x = Math.cos(a) * rr
            const y = Math.sin(a) * rr * 0.88
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.closePath()
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          ctx.lineWidth = half * 0.06
          ctx.strokeStyle = '#2b1b2e'
          ctx.stroke()
          ctx.restore()
          break
        }
        case 'haze': paintHaze(ctx, half * 0.9, 0, 1); break
        case 'salt-cloud': paintSaltBurst(ctx, half * 0.92, 0.6); break
        case 'spark':
          // The ricochet spark, drawn as the game's own particle bucket shapes
          // it: a bright core with two crossing streaks.
          ctx.fillStyle = '#fff6c8'
          for (const a of [0, Math.PI / 2, 0.8, 2.4]) {
            ctx.save()
            ctx.rotate(a)
            ctx.beginPath()
            ctx.ellipse(0, 0, half * 0.9, half * 0.08, 0, 0, Math.PI * 2)
            ctx.fill()
            ctx.restore()
          }
          break
        case 'scorch':
          // `procedural` on every splat below, and here: `paintSplat` now
          // prefers the painting, and a reference drawn FROM the painting is a
          // reference that agrees with itself and proves nothing. Rule 1 of this
          // bench.
          paintSplat(ctx, half * 0.62, '#3a2a1e', 7, 'ooze', 1, 0, { procedural: true })
          break
        case 'splat':
        case 'splat-confetti': {
          // One of the four variants, chosen by which panel of the strip this
          // is. `cycle` is `i / frames`, so this is the panel index back.
          const v = Math.round(cycle * framesOf(s)) % SPLAT_REF_SEEDS.length
          // WHITE, because the sheet is greyscale by contract — the game tints
          // every stamp to the goo it came out of — and at FULL opacity, because
          // the alpha it is stamped at is the game's to apply and a reference
          // faded to 0.42 is a reference asking to be painted as a ghost.
          //
          // `half / SPLAT_REACH[id]` is the whole registration: the drawing
          // reaches `r * SPLAT_REACH` and the runtime blits the painting into a
          // box of exactly that half-width, so a drawn splat and a painted one
          // are the same size on the floor. Per sheet, because goo throws
          // droplets twice as far as confetti lays chips.
          paintSplat(
            ctx, half / SPLAT_REACH[s.id as SplatSheetId], '#ffffff', SPLAT_REF_SEEDS[v]!,
            s.id === 'splat-confetti' ? 'confetti' : 'ooze', 1, 0,
            { procedural: true, opaque: true }
          )
          break
        }
        case 'smoke':
          paintSmokeRef(ctx, half * 0.94)
          break
      }
      break
    case 'ui':
      if (s.id === 'ribbon') {
        paintBanner(ctx, s.w, s.h, { procedural: true })
      } else if (s.id === 'logo') {
        // The wordmark, in the game's own display face — the reference exists to
        // pin the SIZE and the composition, not the lettering, which is what the
        // prompt describes.
        ctx.translate(cx, cy)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `900 ${s.h * 0.26}px Angry, system-ui, sans-serif`
        ctx.lineJoin = 'round'
        ctx.lineWidth = s.h * 0.06
        ctx.strokeStyle = '#2b1b2e'
        ctx.strokeText('BUG CRUNCH', 0, 0)
        ctx.fillStyle = '#ffd93c'
        ctx.fillText('BUG CRUNCH', 0, 0)
      } else if (s.id === 'chest') {
        // The idle chest, through its own painter rather than the glyph route
        // below — it is the one UI mark with no entry in `UI_ICON_GLYPH`, so
        // `paintUiIcon` finds nothing to fill and returns silently, and the
        // reference goes out as a blank magenta square. See `paintChest`.
        ctx.translate(cx, cy)
        paintChest(ctx, half * 1.7)
      } else if (s.id === 'mascot') {
        // The splash's greeter is the game's own ant, through the game's own
        // painter — the reference has to be the creature the player meets on
        // level 1-1, or the loading screen introduces somebody else.
        ctx.translate(cx, cy)
        paintBug(ctx, 'ant', half * 0.68, 0)
      } else if (s.id.startsWith('icon-')) {
        // A button glyph, filled from the SAME `Path2D` list `GameIcon` renders
        // as SVG — so the reference is provably the silhouette on the button,
        // down to which sub-paths punch holes. Filled white on the transparent
        // canvas, exactly as `paintUiIcon` does for the six HUD marks; the
        // magenta ground is laid under it afterwards.
        const name = s.id.slice('icon-'.length)
        const subPaths = isGameIconName(name) ? ICON_PATHS[name] : null
        if (subPaths?.length) {
          const box = half * 1.5
          ctx.translate(cx - box / 2, cy - box / 2)
          ctx.scale(box / 24, box / 24)
          // One `Path2D` filled once, never one fill per sub-path: the glyphs are
          // authored under the nonzero winding rule, so a counter-wound sub-path
          // is a HOLE (the lock's keyhole, the counter of `info`) and filling
          // them separately paints every one of those holes solid.
          const path = new Path2D()
          for (const d of subPaths) path.addPath(new Path2D(d))
          ctx.fillStyle = '#ffffff'
          ctx.fill(path, 'nonzero')
        }
      } else {
        ctx.translate(cx, cy)
        paintUiIcon(ctx, s.id as UiIconId, half * 1.5, { procedural: true })
      }
      break
    default:
      break
  }

  ctx.restore()
  return cv
}

// ─── Composition ────────────────────────────────────────────────────────────

const onGround = (alpha: HTMLCanvasElement, bg: StillSpec['bg']): HTMLCanvasElement => {
  const cv = document.createElement('canvas')
  cv.width = alpha.width
  cv.height = alpha.height
  const ctx = cv.getContext('2d')!
  if (bg !== 'opaque') {
    ctx.fillStyle = '#ff00ff'
    ctx.fillRect(0, 0, cv.width, cv.height)
  }
  ctx.drawImage(alpha, 0, 0)
  return cv
}

const renderWalk = (walk: WalkSpec): HTMLCanvasElement => {
  const alpha = renderWalkAlpha(walk)
  const fit = fitOf(alpha, walk.cols, walk.rows, walk.panelW, walk.panelH)
  if (fit) fits.set(`${walk.kind}/${walk.id}`, fit)
  return onGround(alpha, 'magenta')
}

/**
 * One still, or one LOOP of an animated one, on the lattice.
 *
 * The grid is laid out exactly as a walk's is — panels are an integer multiple
 * of the panel box from the origin, no gutters, no centring fudge — because that
 * is what lets the slicer cut the return with integer arithmetic.
 *
 * The FIT is measured on panel 0 only. It describes where the subject sits in
 * ONE panel, which is the same box for all of them.
 */
const renderStill = (s: StillSpec): HTMLCanvasElement => {
  const frames = framesOf(s)
  const cols = colsOf(s)
  const rows = rowsOf(s)

  const alpha0 = renderStillAlpha(s, 0)
  const fit = fitOf(alpha0, 1, 1, s.w, s.h)
  if (fit) fits.set(`${s.kind}/${s.id}`, fit)
  if (frames <= 1) return onGround(alpha0, s.bg)

  const grid = document.createElement('canvas')
  grid.width = s.w * cols
  grid.height = s.h * rows
  const g = grid.getContext('2d')!
  for (let i = 0; i < frames; i++) {
    const panel = i === 0 ? alpha0 : renderStillAlpha(s, i / frames)
    g.drawImage(panel, (i % cols) * s.w, Math.floor(i / cols) * s.h)
  }
  return onGround(grid, s.bg)
}

/**
 * One contact sheet: N different stills, each in a cell of its own.
 *
 * The lattice is laid out exactly as a walk's is — cells are an integer multiple
 * of the cell box from the origin, no gutters — because that is what lets the
 * slicer cut the return with integer arithmetic.
 *
 * No fit is measured and none is wanted. A fit is a single box describing where
 * THE subject sits in a panel, and there is no "the subject" here: a cell holding
 * a flat `minus` bar and a cell holding a chest fill their cells to completely
 * different fractions, and one number folded into the prompt for both would be
 * wrong for at least one of them. Every member already carries `fit: false`.
 */
const renderGrid = (g: GridSpec): HTMLCanvasElement => {
  const grid = document.createElement('canvas')
  grid.width = g.cell * g.cols
  grid.height = g.cell * g.rows
  const ctx = grid.getContext('2d')!
  g.members.forEach((m, i) => {
    const panel = renderStillAlpha(m, 0)
    // Members are square by construction, but they are not all authored at the
    // same square: a HUD mark is drawn at 512 and a button glyph at 256. Scaled
    // to the common cell rather than blitted, so the two registers arrive the
    // same size on the sheet — which is the whole point of putting them on one.
    ctx.drawImage(panel, (i % g.cols) * g.cell, Math.floor(i / g.cols) * g.cell, g.cell, g.cell)
  })
  return onGround(grid, 'magenta')
}

/**
 * The human half: every walk's first frame and every still, at thumbnail size,
 * captioned. Divide nothing by anything — the index carries the real rects.
 */
const renderKey = (
  items: { title: string; sub: string; cv: HTMLCanvasElement }[], cell: number, cols: number
): HTMLCanvasElement => {
  const rows = Math.ceil(items.length / cols)
  const cv = document.createElement('canvas')
  cv.width = cols * cell
  cv.height = Math.max(1, rows) * (cell + 44)
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#11151c'
  ctx.fillRect(0, 0, cv.width, cv.height)
  items.forEach((it, i) => {
    const x = (i % cols) * cell
    const y = Math.floor(i / cols) * (cell + 44)
    const k = Math.min((cell - 8) / it.cv.width, (cell - 8) / it.cv.height)
    const w = it.cv.width * k
    const h = it.cv.height * k
    ctx.drawImage(it.cv, x + (cell - w) / 2, y + (cell - h) / 2, w, h)
    ctx.strokeStyle = 'rgba(120,224,255,0.6)'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2)
    ctx.fillStyle = '#eef4fb'
    ctx.font = '700 15px ui-sans-serif, system-ui, sans-serif'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(it.title, x + 6, y + cell + 18, cell - 12)
    ctx.fillStyle = '#7fe0ff'
    ctx.font = '500 12px ui-monospace, monospace'
    ctx.fillText(it.sub, x + 6, y + cell + 36, cell - 12)
  })
  return cv
}

// ─── The index ──────────────────────────────────────────────────────────────

/**
 * Every sheet as the slicer reads it: a grid of panels, a target, and the
 * measured fit. A still is a one-panel walk with a TIGHT box — the space the
 * game lends it — while a creature's box is not, because a bug rotates about its
 * own centre and shrinking its box because a painted antenna swings wider would
 * put the body off centre.
 */
const buildIndex = () => ({
  generated: new Date().toISOString(),
  note:
    'Every entry is a grid of panels cut into one strip, and a still is a one-panel '
    + 'grid. `fit` is where the reference sits in a panel (fractions, measured on solid '
    + 'pixels); the slicer normalises a return onto it. `target` is the path under '
    + 'public/ a repainted slice belongs at. Generated by /art-sheets — do not hand-edit.',
  walks: [
    ...WALKS.map((w) => ({
      id: w.id,
      file: `${w.file}.png`,
      width: w.w,
      height: w.h,
      cols: w.cols,
      rows: w.rows,
      frames: w.frames,
      kind: w.kind,
      panel: { w: w.panelW, h: w.panelH },
      ...(fits.has(`${w.kind}/${w.id}`) ? { fit: fits.get(`${w.kind}/${w.id}`) } : {}),
      faces: w.faces,
      // A bug is turned about its own centre by the renderer, so it registers on
      // its CENTRE. Nothing in this game stands on a ground line.
      anchor: 'centre',
      tight: false,
      maxEdge: w.maxEdge,
      target: w.target
    })),
    ...STILLS.map((s) => ({
      id: s.id,
      // An animated still's SHEET is its grid; its PANEL is still one box, and
      // the panel is what every fit and every cap below is about.
      file: `${s.file}.png`,
      width: s.w * colsOf(s),
      height: s.h * rowsOf(s),
      cols: colsOf(s),
      rows: rowsOf(s),
      frames: framesOf(s),
      kind: s.kind,
      panel: { w: s.w, h: s.h },
      // A glow-only effect carries no fit: measured on solid pixels its box is a
      // fraction of what the eye sees, and a painting fitted onto it would
      // shrink to match. See `StillSpec.fit`.
      ...(s.fit !== false && fits.has(`${s.kind}/${s.id}`) ? { fit: fits.get(`${s.kind}/${s.id}`) } : {}),
      anchor: s.anchor,
      tight: true,
      bg: s.bg,
      ...(s.tile ? { tile: s.tile } : {}),
      ...(s.fill ? { fill: true } : {}),
      // A size the world reads the file at (the PWA logo), which the slicer's
      // default cap must not lower.
      ...(s.exact ? { exact: true } : {}),
      maxEdge: s.maxEdge,
      target: s.target,
      ...(s.extra ? { extra: s.extra } : {})
    })),
    // A contact sheet is the one entry with no `target` of its own: it writes a
    // FILE PER CELL, so the targets are on the cells and the slicer takes them
    // from there rather than synthesising one per panel off the sheet's.
    // `frames` still counts the cells — that is what the cut divides by — but
    // no cell carries a `frame`, which is what keeps them out of the strip
    // composer and sends each one straight to a file of its own.
    ...GRIDS.map((g) => ({
      id: g.id,
      file: `${g.file}.png`,
      width: g.cell * g.cols,
      height: g.cell * g.rows,
      cols: g.cols,
      rows: g.rows,
      frames: g.members.length,
      kind: g.kind,
      panel: { w: g.cell, h: g.cell },
      anchor: 'centre' as const,
      tight: true,
      bg: 'magenta' as const,
      maxEdge: g.maxEdge,
      cells: g.members.map((m, i) => ({
        id: m.id,
        label: m.name,
        variant: `cell ${i + 1}/${g.members.length}`,
        x: (i % g.cols) * g.cell,
        y: Math.floor(i / g.cols) * g.cell,
        w: g.cell,
        h: g.cell,
        target: m.target
      }))
    }))
  ]
})

/** Stills whose reference `scripts/make-brand.mjs --references` owns. See the
 *  skip in the export loop for why they are not drawn here. */
const BRAND_REFERENCES = new Set(['logo', 'mark'])

// ─── Export ─────────────────────────────────────────────────────────────────

const save = async (name: string, payload: { dataUrl?: string; text?: string }): Promise<void> => {
  const res = await fetch('/__art/save-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...payload })
  })
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`)
}

const tick = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))

const preview = async (): Promise<void> => {
  await document.fonts?.ready
  const out: typeof previews.value = []
  for (const w of WALKS.slice(0, 3)) {
    const cv = renderWalk(w)
    out.push({
      id: w.id, title: `${w.name} — walk`, url: cv.toDataURL('image/png'),
      dims: `${cv.width}x${cv.height} · ${w.cols}x${w.rows} panels`
    })
  }
  const stills = STILLS.map((s) => ({ title: s.name, sub: s.target, cv: renderStill(s) }))
  const key = renderKey(stills, 160, 8)
  out.push({
    id: 'stills', title: 'Every still', url: key.toDataURL('image/png'),
    dims: `${STILLS.length} stills`
  })
  for (const g of GRIDS) {
    const cv = renderGrid(g)
    out.push({
      id: g.file, title: `${g.name} — contact sheet`, url: cv.toDataURL('image/png'),
      dims: `${cv.width}x${cv.height} · ${g.cols}x${g.rows} · ${g.members.length} icons`
    })
  }
  previews.value = out
}

const exportSheets = async (): Promise<void> => {
  busy.value = true
  let written = 0
  const put = async (name: string, payload: { dataUrl?: string; text?: string }): Promise<void> => {
    await save(name, payload)
    written++
  }
  try {
    await document.fonts?.ready
    fits.clear()

    const walkKeys: { title: string; sub: string; cv: HTMLCanvasElement }[] = []
    for (const walk of WALKS) {
      status.value = `rendering ${walk.file}`
      await tick()
      const cv = renderWalk(walk)
      await put(`${walk.file}.png`, { dataUrl: cv.toDataURL('image/png') })
      const first = document.createElement('canvas')
      first.width = walk.panelW
      first.height = walk.panelH
      first.getContext('2d')!.drawImage(cv, 0, 0, walk.panelW, walk.panelH, 0, 0, walk.panelW, walk.panelH)
      walkKeys.push({ title: walk.name, sub: walk.target, cv: first })
    }
    await put('key-walks.png', { dataUrl: renderKey(walkKeys, 192, 8).toDataURL('image/png') })

    const stillKeys: { title: string; sub: string; cv: HTMLCanvasElement }[] = []
    for (const s of STILLS) {
      // The brand's two references are written by `scripts/make-brand.mjs`
      // (`--references`), not here, and must survive an export rather than be
      // overwritten by it.
      //
      // Every other reference is drawn by whatever draws the thing at run time.
      // The brand's run-time drawing IS that script: the splash and the manifest
      // read the bitmaps it rasterises, so a second rendering here would be a
      // drawing of a drawing. This branch was exactly that, and it was wrong —
      // it set BUG CRUNCH as ONE line at `s.h * 0.26`, about 1050 px of advances
      // on a 1024 panel before a 61 px stroke, so the reference a painter worked
      // from ran off both edges and was not the lockup the game shows anyway.
      if (BRAND_REFERENCES.has(s.id)) {
        status.value = `skipping ${s.file} (owned by make-brand)`
        continue
      }
      status.value = `rendering ${s.file}`
      await tick()
      const cv = renderStill(s)
      await put(`${s.file}.png`, { dataUrl: cv.toDataURL('image/png') })
      stillKeys.push({ title: s.name, sub: s.target, cv })
    }
    await put('key-stills.png', { dataUrl: renderKey(stillKeys, 192, 8).toDataURL('image/png') })

    // After the stills, and deliberately: a grid is built out of the same
    // `renderStillAlpha` its members are, so if a member's painter is broken the
    // single sheet shows it first and the grid is not the thing being debugged.
    for (const g of GRIDS) {
      status.value = `rendering ${g.file}`
      await tick()
      await put(`${g.file}.png`, { dataUrl: renderGrid(g).toDataURL('image/png') })
    }

    // The text is the manifest's (`promptDocs`), so this route and
    // `pnpm art:prompts` write byte-identical documents.
    //
    // The measured fits go WITH it. `art:prompts` reads them back out of
    // `sheet-index.json` and folds a SIZE IN FRAME sentence into every block;
    // handing this route none would make the two routes disagree on exactly the
    // sheets that have just been re-measured — and the one thing this export is
    // for is that they cannot.
    const docs = promptDocs(Object.fromEntries(fits))
    for (const [name, text] of Object.entries(docs)) await put(name, { text })

    await put('sheet-index.json', { text: JSON.stringify(buildIndex(), null, 2) + '\n' })
    status.value = `wrote ${written} files to art-sheets/`
  } catch (e) {
    status.value = `FAILED — ${(e as Error).message}`
  } finally {
    busy.value = false
  }
}

/**
 * The bench draws with the painted layer OFF, always.
 *
 * Every painter in the game asks `spriteFor()` first and blits the painting
 * when one exists — that is the whole point of the override layer. It is also
 * exactly wrong here: a reference exported with the layer on is a photograph of
 * the PAINTING, so the next round of the pipeline paints from a painting, and
 * the placeholder drawing the layout is supposed to come from is gone.
 *
 * It bit us silently. `VITE_ENABLE_ART_OVERRIDES` ships on, so an export run
 * off a normal dev server quietly replaced thirteen boss and prop references
 * with their own finished art, and the only visible symptom was `art:status`
 * reporting them stale.
 *
 * A few painters take `{ procedural: true }` and those calls stay — they are
 * the contract at the call site, and the splat needs its `opaque` sibling
 * anyway — but a per-painter flag cannot be the defence, because a painter that
 * GAINS an override path later (as `paintBoss` just did) would break the bench
 * again with no change here at all. The switch belongs to the view.
 */
const artWas = artOverridesEnabled()
setArtOverrides(false, false)
onBeforeUnmount(() => { if (artWas) setArtOverrides(true, false) })

onMounted(preview)

/** Every UI mark the bench can draw, for the "what is in the set" line. */
const uiIds: UiIconId[] = UI_ICON_IDS
</script>

<template lang="pug">
  .art-sheets
    header
      h1 Art sheets
      p.lede
        | Every drawable in the game, through its own painter, onto a reference the
        |  painting is registered against. Export writes into #[code art-sheets/].
      p.lede
        | #[strong {{ WALKS.length }}] walk sheets · #[strong {{ STILLS.length }}] stills ·
        |  #[strong {{ uiIds.length }}] HUD marks · #[strong {{ GRIDS.length }}] contact sheets
      .bar
        button(:disabled="busy" @click="exportSheets") {{ busy ? 'Exporting…' : 'Export all sheets' }}
        button.ghost(:disabled="busy" @click="preview") Re-render preview
        span.status {{ status }}

    section.sheet(v-for="p in previews" :key="p.id")
      h2 {{ p.title }}
      p.dims {{ p.dims }}
      .frame
        img(:src="p.url" :alt="p.title")
</template>

<style scoped lang="sass">
.art-sheets
  min-height: 100vh
  height: 100vh
  overflow-y: auto
  padding: 24px
  background: #0d1117
  color: #e6edf3
  font: 14px/1.5 ui-sans-serif, system-ui, sans-serif

h1
  margin: 0 0 6px
  font-size: 22px

.lede
  max-width: 70ch
  margin: 0 0 6px
  color: #9aa7b4

code
  padding: 1px 5px
  border-radius: 4px
  background: #1b222c
  font-family: ui-monospace, monospace

.bar
  display: flex
  align-items: center
  gap: 10px
  margin: 14px 0 28px

button
  padding: 9px 16px
  border: 1px solid #2f7d9e
  border-radius: 7px
  background: #14364a
  color: #cfeeff
  font: inherit
  font-weight: 600
  cursor: pointer

  &:disabled
    opacity: 0.5
    cursor: default

  &.ghost
    border-color: #2a323d
    background: transparent
    color: #9aa7b4

.status
  color: #7fe0ff
  font-family: ui-monospace, monospace
  font-size: 13px

.sheet
  margin-bottom: 30px

h2
  margin: 0 0 2px
  font-size: 16px

.dims
  margin: 0 0 8px
  color: #7d8894
  font-family: ui-monospace, monospace
  font-size: 12px

.frame
  display: inline-block
  padding: 8px
  border: 1px solid #242c36
  border-radius: 8px
  background-color: #1a2029

img
  display: block
  max-width: 100%
  height: auto
</style>
