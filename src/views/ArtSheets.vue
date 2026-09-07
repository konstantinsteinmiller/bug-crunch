<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  WALKS, STILLS, promptForWalk, promptForStill, GATE_POST, GATE_REF_POST_W,
  framesOf, colsOf, rowsOf,
  type WalkSpec, type StillSpec
} from '@/game/artSheet'
import { paintMonsterFrame } from '@/game/monsterSprites'
import { paintSurvivorFrame, OUTFITS } from '@/game/heroSprites'
import { paintSmokeRef } from '@/use/useVfx'
import {
  paintCoin, paintCrateBody, paintBarrelBody, paintBoulder, paintBarricadeBody,
  paintWeaponBoxBody, paintGuardPlate, paintLeverPost, paintLeverArm, LEVER_ART,
  paintGateFrame, GATE_FRAME, paintPillarBody, hazardPatternFor,
  paintRollerBall, ROLLER_ART_PAD, ROLLER_SPIN_PER_LOOP,
  paintGunnerBolt, paintBossBolt, paintMeteorRock, METEOR_BOX,
  ROUND_BOX, paintBombCharge, paintGrenadeBody, paintTracerRef, FX_PAD,
  ROCKET_BOX, paintRocketBody,
  muzzleRamp, paintMuzzleFlash, paintScorch, paintRing, paintShieldDome,
  paintGuardHex, paintCrest, paintCrown, paintRidge, RIDGE_BAND
} from '@/use/useSurvivalArt'
import { paintBanner, paintUiIcon, type UiIconId } from '@/game/uiArt'
import { BARREL_R, DIVIDER_HALF_W, DIVIDER_H } from '@/game/survival'
import { BOLT_R, ROLLER_R } from '@/game/threats'
import { WEAPON_BOX_R } from '@/game/weapons'

/**
 * `/art-sheets` — the reference bench.
 *
 * Survivalist has no art folder. Every monster, prop and effect is a few
 * hundred canvas operations, which is exactly what you want in a bundle and
 * exactly what you cannot hand to somebody who paints. This screen bakes the
 * whole cast onto the sheets described in `artSheet.ts` and writes them into
 * `art-sheets/` through a dev-only endpoint, so the art can go out to be
 * repainted and come back as drop-in bitmaps.
 *
 * THREE RULES, and they are all about the return trip.
 *
 *   1. Every reference is drawn by the GAME'S OWN PAINTER into the exact box
 *      the game blits the painting back into. A reference drawn from a private
 *      copy of the geometry agrees with itself and proves nothing.
 *   2. Nothing is written inside a panel. Captions live on the key sheets —
 *      text inside a frame is text an image model will dutifully repaint.
 *   3. Every reference is rendered on a TRANSPARENT canvas first and measured
 *      there, then laid on the magenta sheet. The sheet itself has no alpha to
 *      measure, and the effects paint additively — additive light over magenta
 *      is a pink smear, over nothing it is the effect.
 *
 * Everything animated is frozen at a fixed phase rather than at the wall clock,
 * so re-exporting produces a byte-identical sheet and a diff means the art
 * actually changed.
 */

const status = ref('idle')
const busy = ref(false)
const previews = ref<{ id: string; title: string; url: string; dims: string }[]>([])

/** Procedural only, always: the bench must never bake a painting into the
 *  reference it is about to be replaced by. */
const REF = { procedural: true } as const

// ─── Fit measurement ────────────────────────────────────────────────────────
//
// Where the reference actually SITS inside its panel, as fractions of one.
// Measured, not declared, because it is the thing a painter is most likely to
// change without noticing. The slicer reads this back and normalises what it
// gets to match.

/**
 * Alpha floor for the fit measurement. Deliberately high: the procedural
 * effects have soft glows and the creatures cast a soft ground shadow, and a
 * soft edge is light, not extent. At 140 a 32%-opacity shadow is not part of
 * the object on either side.
 */
const FIT_ALPHA = 140

interface Fit { h: number; w: number; bottom: number; cx: number }

/**
 * Alpha bbox of one rectangle of a canvas, in that rectangle's own pixels.
 *
 * Solid pixels are grouped into connected pieces and a sliver (three pixels
 * or thinner) or a speck is left out — the SAME rule the slicer applies to a
 * return, so the two measure the same thing. The slicer needs it because a
 * neighbour's shadow bleeds across the cut line as a thin solid line; the
 * bench applies it so a design's own sparkle dots do not put the reference's
 * box somewhere the return's can never land.
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

/** Every panel of a walk on a transparent canvas, through the bake's own painter. */
const renderWalkAlpha = (walk: WalkSpec): HTMLCanvasElement => {
  const cv = document.createElement('canvas')
  cv.width = walk.w
  cv.height = walk.h
  const ctx = cv.getContext('2d')!
  const outfit = walk.kind === 'hero' ? OUTFITS.findIndex((o) => o.id === walk.id) : -1
  for (let i = 0; i < walk.frames; i++) {
    ctx.save()
    ctx.translate((i % walk.cols) * walk.panelW, Math.floor(i / walk.cols) * walk.panelH)
    // Clipped to its own panel, exactly as the bake's frame clips it: a sword
    // tip or a canopy that overruns the frame is cut off in play, and left
    // unclipped here it lands in the NEXT panel — where it is measured as
    // that panel's creature and drags the whole strip's fit off by a quarter.
    ctx.beginPath()
    ctx.rect(0, 0, walk.panelW, walk.panelH)
    ctx.clip()
    // Straight through the renderer's own frame painter, so the reference is
    // provably the frame box the game draws rather than a lookalike.
    if (walk.kind === 'hero') paintSurvivorFrame(ctx, outfit, i, walk.frames, walk.panelW, walk.panelH)
    else paintMonsterFrame(ctx, walk.id, i, walk.frames, walk.panelW, walk.panelH)
    ctx.restore()
  }
  return cv
}

// ─── Stills ─────────────────────────────────────────────────────────────────

/**
 * One still on a transparent canvas, through the game's own painter, into
 * the exact box the runtime blits the painting back into.
 *
 * Every size here is DERIVED from the panel and the painter's own blit
 * contract — a crate is blitted into (-r, -r, 2r, 2r), so the reference draws
 * it with r at half the panel; a round is blitted into `ROUND_BOX`, so the
 * reference puts its head where `ROUND_BOX.head` says. Nothing is eyeballed.
 */
const renderStillAlpha = (s: StillSpec, cycle = 0): HTMLCanvasElement => {
  const cv = document.createElement('canvas')
  cv.width = s.w
  cv.height = s.h
  const ctx = cv.getContext('2d')!
  const S = s.w
  const cx = s.w / 2
  const cy = s.h / 2
  // The bench's own paint options, plus WHERE IN ITS LOOP this panel is. Only
  // the animated subjects read it; for everything else `cycle` is 0 and the
  // reference is exactly the one still it always was.
  const ref = { ...REF, cycle }
  ctx.save()

  switch (`${s.kind}/${s.id}`) {
    case 'prop/crate-damage':
    case 'prop/crate-rate':
      ctx.translate(cx, cy)
      paintCrateBody(ctx, s.id === 'crate-rate' ? 'rate' : 'damage', S / 2, REF)
      break
    case 'prop/barricade':
      // A slice of a WIDER block, so the block's rounded corners fall outside
      // the tile: a tile is square-cornered or it seams when repeated.
      ctx.translate(cx, cy)
      paintBarricadeBody(ctx, S * 1.6, S, REF)
      break
    case 'prop/boulder-1':
    case 'prop/boulder-2':
    case 'prop/boulder-3': {
      // `paintBoulder` picks the painting by `seed % 3`; the seed here is the
      // one that lands on this variant, and it is also what shapes the lump.
      const seed = Number(s.id.slice(-1)) - 1
      ctx.translate(cx, cy)
      paintBoulder(ctx, S / 1.08, S / 1.08, seed, REF)
      break
    }
    case 'prop/barrel':
      ctx.translate(cx, cy)
      paintBarrelBody(ctx, S / 2, (S / 2) / BARREL_R, false, 0, 0, REF)
      break
    case 'prop/pillar': {
      // The painting's box is 2.5 half-widths by 1.26 heights, the pillar's
      // origin 0.6 heights below the box's top.
      const halfPx = s.w / 2.5
      const h = s.h / 1.26
      const scale = halfPx / DIVIDER_HALF_W
      void DIVIDER_H
      ctx.translate(cx, s.h * (0.6 / 1.26))
      paintPillarBody(ctx, halfPx, h, scale, hazardPatternFor(ctx, scale), REF)
      break
    }
    case 'prop/coin':
      ctx.translate(cx, cy)
      paintCoin(ctx, S / 2, 1, 0, REF)
      break
    case 'prop/guard-plate':
      // The plate fills its box exactly, as it does in play.
      ctx.translate(cx, cy)
      paintGuardPlate(ctx, s.w, s.h, REF)
      break
    case 'prop/lever-post': {
      // The housing's box is `LEVER_ART.post` wide, its TOP edge on the post's
      // origin — so the origin is the panel's top, not its middle.
      const r = s.w / LEVER_ART.post.w
      ctx.translate(cx, 0)
      paintLeverPost(ctx, r, r, REF)
      break
    }
    case 'prop/lever-arm': {
      // The arm's box is `LEVER_ART.arm`, drawn from its PIVOT — which sits
      // `pivot` radii above the panel's bottom edge.
      const r = s.w / LEVER_ART.arm.w
      ctx.translate(cx, s.h - LEVER_ART.arm.pivot * r)
      paintLeverArm(ctx, r, REF)
      break
    }
    case 'prop/weapon-box':
    case 'prop/weapon-box-open':
      // The case AND its face plate: the glyph, the brace and the halo are
      // the only things left live over a painting. `pulse` at 0 so the
      // reference is the open box's steady colour, not a frame of its throb.
      ctx.translate(cx, cy)
      paintWeaponBoxBody(ctx, S / 2, S / 2 / WEAPON_BOX_R, s.id.endsWith('-open'), 0, REF)
      break

    case 'gate/frame-add':
    case 'gate/frame-sub':
    case 'gate/frame-mul':
    case 'gate/frame-div': {
      const op = s.id.slice('frame-'.length) as 'add' | 'sub' | 'mul' | 'div'
      const ppu = GATE_FRAME.ppu
      ctx.translate(cx, cy)
      // Posts at the band's full width, so the painter copies a heavy post
      // rather than inventing one. See `GATE_REF_POST_W`.
      paintGateFrame(ctx, op, GATE_FRAME.refHalfW * ppu, 1.5 * ppu, ppu,
        { ...REF, postW: GATE_REF_POST_W })
      break
    }

    case 'round/tracer':
      // The streak fills the `len`-square box from its top edge.
      ctx.translate(cx, 0)
      paintTracerRef(ctx, 0, S / 0.55)
      break
    case 'round/bolt-gunner': {
      const r = S / ROUND_BOX.side
      ctx.translate(ROUND_BOX.head * r, cy)
      paintGunnerBolt(ctx, r, 1, 0, r / BOLT_R, false, ref)
      break
    }
    case 'round/bolt-boss': {
      const r = S / ROUND_BOX.side
      ctx.translate(ROUND_BOX.head * r, cy)
      paintBossBolt(ctx, r, 1, 0, 1, false, ref)
      break
    }
    case 'round/roller': {
      // The sphere at 1/1.3 of the panel: the margin is where the spikes go.
      //
      // The reference has to SHOW the roll, or the painter has nothing to
      // follow — the first return came back as one ball copied eight times
      // with sparks added, because that is exactly what the sheet in front of
      // it looked like. `spin` therefore walks one ring spacing (a quarter
      // turn) across the loop, which is what the game plays it back at.
      const r = S / 2 / ROLLER_ART_PAD
      ctx.translate(cx, cy)
      paintRollerBall(ctx, r, cycle * ROLLER_SPIN_PER_LOOP, r / ROLLER_R, false, ref)
      break
    }
    case 'round/meteor': {
      const R = S / METEOR_BOX.side
      ctx.translate(cx, METEOR_BOX.centre * R)
      paintMeteorRock(ctx, R, false, R / 0.55, false, ref)
      break
    }
    case 'round/bomb': {
      const bodyR = S / 4.4
      ctx.translate(cx, cy)
      paintBombCharge(ctx, bodyR, bodyR * 2.1, ref)
      break
    }
    case 'round/grenade': {
      const r = S / 2.6
      ctx.translate(cx, cy)
      paintGrenadeBody(ctx, r, r / 0.26, REF)
      break
    }
    case 'round/rocket': {
      // The panel IS `ROCKET_BOX`: the shell's centre `top` radii below the
      // top edge, nose up, the plume running down.
      const rr = S / ROCKET_BOX.w
      ctx.translate(cx, ROCKET_BOX.top * rr)
      paintRocketBody(ctx, rr, REF)
      break
    }

    case 'fx/muzzle': {
      const flashR = S / 2
      ctx.translate(cx, cy)
      paintMuzzleFlash(ctx, 0, flashR, muzzleRamp(ctx, 0, flashR), REF)
      break
    }
    case 'fx/smoke':
      ctx.translate(cx, cy)
      paintSmokeRef(ctx, S / 2)
      break
    case 'fx/scorch':
      // The panel is the scorch's own 2 : 1.1 box, so the file maps 1:1.
      ctx.translate(cx, cy)
      paintScorch(ctx, S / 2, REF)
      break
    case 'fx/ring-shock':
    case 'fx/ring-heat':
    case 'fx/ring-heal': {
      const kind = s.id.slice('ring-'.length) as 'shock' | 'heat' | 'heal'
      const lw = S * 0.06
      const colour = kind === 'shock' ? 'rgba(215,240,255,0.9)' : kind === 'heat' ? '#ff7a2a' : '#5cf08a'
      // The ring's edge at 1/1.12 of the panel: the margin is for its glow.
      ctx.translate(cx, cy)
      paintRing(ctx, kind, S / 2 / FX_PAD - lw / 2, S / 2 / FX_PAD - lw / 2, lw, colour, REF)
      break
    }
    case 'fx/shield': {
      const rr = S / 2 / FX_PAD
      paintShieldDome(ctx, cx, cy, rr, rr, 1, 0, false, S / 4, REF)
      break
    }
    case 'fx/guard': {
      const rr = S / 2 / FX_PAD
      ctx.translate(cx, cy)
      paintGuardHex(ctx, 0, rr, rr, 0.5, S / 4, REF)
      break
    }
    case 'fx/crest-shield': {
      const m = S * 0.06
      paintCrest(ctx, 'shield', cx, cy, S / 2 - m, S / 2 - m, {
        fill: '#6fd6ff', rim: '#06263a', rimW: S * 0.05,
        rib: 'rgba(6,38,58,0.9)', ribW: S * 0.025
      }, REF)
      break
    }
    case 'fx/crest-guard': {
      const m = S * 0.06
      paintCrest(ctx, 'guard', cx, cy, S / 2 - m, S / 2 - m, {
        fill: '#ffc46a', rim: '#2a0f05', rimW: S * 0.06,
        rib: 'rgba(42,15,5,0.9)', ribW: S * 0.03
      }, REF)
      break
    }

    case 'bg/ridge-far':
    case 'bg/ridge-near':
      // Black silhouette, ridge line at `RIDGE_BAND.line`: the game tints it.
      paintRidge(ctx, s.id as 'ridge-far' | 'ridge-near', s.w, s.h,
        s.h * RIDGE_BAND.line, s.h * 0.16, '#000000', s.id === 'ridge-far' ? 1.7 : 4.2, REF)
      break

    case 'ui/crown': {
      const cw = S * 0.92
      paintCrown(ctx, cx, S * 0.96, cw, cw / 1.15, S * 0.04, REF)
      break
    }
    case 'ui/ribbon':
      // The whole box: CSS slices it at `BANNER.cap` from each end.
      paintBanner(ctx, s.w, s.h, REF)
      break
    case 'ui/chest':
    case 'ui/skill-grenade':
    case 'ui/skill-shield':
      // The button's own glyph, through the same paths `GameIcon` renders.
      ctx.translate(cx, cy)
      paintUiIcon(ctx, s.id as UiIconId, S, REF)
      break
    case 'ui/logo': {
      // There is no procedural logo — the one on disk is the previous
      // project's — so the reference is a layout: the word, its size and its
      // place. The prompt describes the treatment.
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      let px = S * 0.2
      ctx.font = `900 ${px}px Angry, sans-serif`
      const want = S * 0.9
      const got = ctx.measureText('SURVIVALIST').width
      if (got > want) { px *= want / got; ctx.font = `900 ${px}px Angry, sans-serif` }
      ctx.fillText('SURVIVALIST', cx, cy)
      break
    }
  }

  ctx.restore()
  return cv
}

// ─── Composition ────────────────────────────────────────────────────────────

/** The reference laid on its ground: magenta, or nothing for an opaque tile. */
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
 * of the panel box from the origin, no gutters, no centring fudge — because
 * that is what lets the slicer cut the return with integer arithmetic. Panel k
 * is the painter called at `cycle = k / frames`, so the eight panels are eight
 * real moments of the same fire rather than one picture stamped eight times.
 *
 * The FIT is measured on panel 0 only. It describes where the subject sits in
 * ONE panel, which is the same box for all of them; measuring the union of
 * eight frames of a whipping flame would hand the slicer a box the size of the
 * biggest lick and shrink every panel to fit it.
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
 * The human half: every walk's first frame and every still, at thumbnail size,
 * captioned. Divide nothing by anything — the index carries the real rects.
 */
const renderKey = (
  items: { title: string; sub: string; cv: HTMLCanvasElement }[], cell: number, cols: number
): HTMLCanvasElement => {
  const rows = Math.ceil(items.length / cols)
  const cv = document.createElement('canvas')
  cv.width = cols * cell
  cv.height = rows * (cell + 44)
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
 * game lends it — while a creature's box is not, because it stands on open
 * ground and shrinking it because a painted arm swings wider would lift its
 * feet off the line.
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
      anchor: 'feet',
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
      // A glow-only effect carries no fit: measured on solid pixels its box
      // is a fraction of what the eye sees, and a painting fitted onto it
      // would shrink to match. See `StillSpec.fit`.
      ...(s.fit !== false && fits.has(`${s.kind}/${s.id}`) ? { fit: fits.get(`${s.kind}/${s.id}`) } : {}),
      anchor: s.anchor,
      tight: true,
      bg: s.bg,
      // A gate frame's post band, so the slicer can re-compose a return's
      // posts onto it — whatever width they came back at.
      ...(s.kind === 'gate' ? { post: GATE_POST } : {}),
      ...(s.tile ? { tile: s.tile } : {}),
      ...(s.fill ? { fill: true } : {}),
      // A size the world reads the file at (the PWA logo), which the slicer's
      // default cap must not lower.
      ...(s.exact ? { exact: true } : {}),
      maxEdge: s.maxEdge,
      target: s.target,
      ...(s.extra ? { extra: s.extra } : {})
    }))
  ]
})

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
    out.push({ id: w.id, title: `${w.name} — walk`, url: cv.toDataURL('image/png'),
      dims: `${cv.width}x${cv.height} · ${w.cols}x${w.rows} panels` })
  }
  const stills = STILLS.map((s) => ({ title: s.name, sub: s.target, cv: renderStill(s) }))
  const key = renderKey(stills, 160, 8)
  out.push({ id: 'stills', title: 'Every still', url: key.toDataURL('image/png'),
    dims: `${STILLS.length} stills` })
  previews.value = out
}

const exportAll = async (): Promise<void> => {
  busy.value = true
  try {
    await document.fonts?.ready
    fits.clear()
    const walkKeys: { title: string; sub: string; cv: HTMLCanvasElement }[] = []
    for (const walk of WALKS) {
      status.value = `rendering ${walk.file}`
      await tick()
      const cv = renderWalk(walk)
      await save(`${walk.file}.png`, { dataUrl: cv.toDataURL('image/png') })
      const first = document.createElement('canvas')
      first.width = walk.panelW
      first.height = walk.panelH
      first.getContext('2d')!.drawImage(cv, 0, 0, walk.panelW, walk.panelH, 0, 0, walk.panelW, walk.panelH)
      walkKeys.push({ title: walk.name, sub: walk.target, cv: first })
    }
    await save('key-walks.png', { dataUrl: renderKey(walkKeys, 192, 8).toDataURL('image/png') })

    const stillKeys: { title: string; sub: string; cv: HTMLCanvasElement }[] = []
    for (const s of STILLS) {
      status.value = `rendering ${s.file}`
      await tick()
      const cv = renderStill(s)
      await save(`${s.file}.png`, { dataUrl: cv.toDataURL('image/png') })
      stillKeys.push({ title: s.name, sub: s.target, cv })
    }
    await save('key-stills.png', { dataUrl: renderKey(stillKeys, 192, 8).toDataURL('image/png') })

    await save('PROMPTS-WALKS.md', {
      text: [
        '# Walk-cycle prompts — one design per generation',
        '',
        'Generated from the manifest — do not hand-edit, re-export instead.',
        '',
        'Attach `art-sheets/walk-<id>.png` and paste the matching block beside it.',
        'Each is a grid of panels showing ONE subject through ONE cycle, and the',
        'whole job is that it comes back as one subject and not eight.',
        '',
        'Drop results in `art-sheets/painted/`, keeping the `walk-<id>` in the name,',
        'then run `pnpm slice-sheets`. The slicer cuts the grid by proportion, so an',
        'off-size return is fine as long as the panels are where the grid says.',
        '',
        WALKS.map((w) => promptForWalk(w)).join('\n\n---\n\n'),
        ''
      ].join('\n')
    })
    await save('PROMPTS-STILLS.md', {
      text: [
        '# Still prompts — one object per generation',
        '',
        'Generated from the manifest — do not hand-edit, re-export instead.',
        '',
        'Attach `art-sheets/still-<kind>-<id>.png` and paste the matching block',
        'beside it. There is no grid to preserve here, which is the whole point.',
        '',
        'Drop results in `art-sheets/painted/`, keeping the `still-<kind>-<id>` in',
        'the name, then run `pnpm slice-sheets`. Every return is measured against',
        'its reference and normalised onto it.',
        '',
        STILLS.map((s) => promptForStill(s)).join('\n\n---\n\n'),
        ''
      ].join('\n')
    })

    await save('sheet-index.json', { text: JSON.stringify(buildIndex(), null, 2) + '\n' })
    status.value = `wrote ${WALKS.length + STILLS.length + 5} files to art-sheets/`
  } catch (e) {
    status.value = `FAILED — ${(e as Error).message}`
  } finally {
    busy.value = false
  }
}

onMounted(preview)
</script>

<template lang="pug">
  .art-sheets
    header
      h1 Art sheets
      p.lede
        | Every drawable in the game, through its own painter, onto a reference
        |  the painting is registered against. Export writes into #[code art-sheets/].
      .bar
        button(:disabled="busy" @click="exportAll") {{ busy ? 'Exporting…' : 'Export all sheets' }}
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
  margin: 0 0 14px
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
  margin-bottom: 28px

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
