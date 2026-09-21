/**
 * ─── Props, hazards and the effects that are not particles ──────────────────
 *
 * Everything on the floor that is neither a bug nor the foot. All drawn from
 * code in the same inked, cozy register as the cast, all with a drop-in bitmap
 * override, and all authored at ONE UNIT = the prop's `size` in field units.
 *
 * The hazards in particular have a job beyond decoration: a player has to be
 * able to tell, at a glance and at 320 px wide, whether a patch of floor helps
 * them or hurts them. So the set is colour-coded the way the rest of the game
 * is — warm gold and green are good to stand near, cold blue-white is slippery,
 * red is a machine that is about to move.
 */

import { spriteFor } from '@/game/art'
import { hazardSpec, type HazardId } from '@/game/hazards'
import { stripFrames } from '@/game/spriteStrip'
import { EGG_STAGES, type EggLook } from '@/game/bosses'
import { EGG_ART_ID, EGG_PROP_IDS, EGG_SHELL_ART_ID, type EggPropId } from '@/game/artCatalogue'

const INK = '#2b1b2e'

const inked = (ctx: CanvasRenderingContext2D, w: number): void => {
  ctx.strokeStyle = INK
  ctx.lineWidth = w
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
}

const paint = (
  ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, line: number
): void => {
  ctx.fillStyle = fill
  ctx.fill()
  if (line > 0) { inked(ctx, line); ctx.stroke() }
}

const hash = (a: number, b: number): number => {
  let h = (a * 374761393 + b * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177 | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** A closed wobbly loop — the shape every puddle, spill and web patch is. */
const puddle = (
  ctx: CanvasRenderingContext2D, seed: number, wobble = 0.18, n = 13
): void => {
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + (hash(seed, i) - 0.5) * 2 * wobble
    xs.push(Math.cos(a) * k)
    ys.push(Math.sin(a) * k * 0.9)
  }
  ctx.beginPath()
  let px = (xs[n - 1]! + xs[0]!) / 2
  let py = (ys[n - 1]! + ys[0]!) / 2
  ctx.moveTo(px, py)
  for (let i = 0; i < n; i++) {
    const nx = (xs[i]! + xs[(i + 1) % n]!) / 2
    const ny = (ys[i]! + ys[(i + 1) % n]!) / 2
    ctx.quadraticCurveTo(xs[i]!, ys[i]!, nx, ny)
    px = nx; py = ny
  }
  ctx.closePath()
}

/**
 * `t` is a 0..1 animation phase the sim supplies — a honey shimmer, a magnet
 * pulse, a conveyor's belt scroll. Props that do not animate ignore it.
 * `state` carries whatever a prop needs to know about itself (armed, spent).
 */
export interface PropState {
  t: number
  armed?: boolean
  spent?: boolean
  /** Direction for the directional props (conveyor, sweeper), radians. */
  angle?: number
  /** The shoebox: 0 whole … 1 about to burst. Drives the lid lifting. */
  crack?: number
  /** The slick lane: its half-LENGTH over its half-width, so the drawing
   *  stretches along the lane rather than into a disc. */
  stretch?: number
}

type HazardDraw = (ctx: CanvasRenderingContext2D, s: PropState, seed: number) => void

const drawHoney: HazardDraw = (ctx, s, seed) => {
  const spec = hazardSpec('honey')
  puddle(ctx, seed, 0.2)
  const g = ctx.createRadialGradient(-0.25, -0.3, 0.05, 0, 0, 1.05)
  g.addColorStop(0, spec.accent)
  g.addColorStop(0.45, spec.body)
  g.addColorStop(1, spec.shade)
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(140,84,0,0.55)'
  ctx.lineWidth = 0.06
  ctx.stroke()
  // Two drifting highlights: a puddle without a moving specular reads as paint.
  ctx.save()
  ctx.clip()
  for (let i = 0; i < 2; i++) {
    const a = s.t * Math.PI * 2 + i * 2.4
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.ellipse(Math.cos(a) * 0.3 - 0.1, Math.sin(a) * 0.22 - 0.24, 0.34, 0.12, a * 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  // Bubbles trapped in it.
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.arc((hash(seed + 9, i) - 0.5) * 1.3, (hash(seed + 11, i) - 0.5) * 1.1, 0.06 + hash(seed + 13, i) * 0.07, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 0.028
    ctx.stroke()
  }
}

const drawMagnet: HazardDraw = (ctx, s) => {
  const spec = hazardSpec('magnet')
  const pulse = s.armed ? 0.5 + 0.5 * Math.sin(s.t * Math.PI * 6) : 0
  // The classic horseshoe, seen from above: two arms and a bridge.
  ctx.beginPath()
  ctx.arc(0, 0.12, 0.8, Math.PI, Math.PI * 2)
  ctx.lineTo(0.8, 0.78)
  ctx.lineTo(0.42, 0.78)
  ctx.lineTo(0.42, 0.12)
  ctx.arc(0, 0.12, 0.42, 0, Math.PI, true)
  ctx.lineTo(-0.42, 0.78)
  ctx.lineTo(-0.8, 0.78)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, -0.8, 0, 0.8)
  g.addColorStop(0, '#ff7a92')
  g.addColorStop(1, spec.shade)
  paint(ctx, g, 0.09)
  // Steel tips.
  for (const sgn of [-1, 1] as const) {
    ctx.beginPath()
    ctx.roundRect(sgn * 0.8 - (sgn > 0 ? 0.38 : 0), 0.5, 0.38, 0.34, 0.06)
    paint(ctx, spec.accent, 0.07)
  }
  if (pulse > 0) {
    ctx.strokeStyle = `rgba(255,240,140,${0.25 + pulse * 0.55})`
    ctx.lineWidth = 0.08
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(0, 0.12, 1.1 + i * 0.34 + pulse * 0.2, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
    }
  }
}

const drawSalt: HazardDraw = (ctx, s) => {
  const spec = hazardSpec('salt')
  if (s.spent) {
    // Tipped over. A spent prop must never look like a live one.
    ctx.save()
    ctx.rotate(1.1)
    ctx.globalAlpha = 0.7
  }
  ctx.beginPath()
  ctx.moveTo(-0.5, 0.9)
  ctx.quadraticCurveTo(-0.62, -0.2, -0.34, -0.72)
  ctx.lineTo(0.34, -0.72)
  ctx.quadraticCurveTo(0.62, -0.2, 0.5, 0.9)
  ctx.closePath()
  const g = ctx.createLinearGradient(-0.5, 0, 0.5, 0)
  g.addColorStop(0, spec.shade)
  g.addColorStop(0.35, spec.body)
  g.addColorStop(1, spec.shade)
  paint(ctx, g, 0.09)
  // The cap, with holes.
  ctx.beginPath()
  ctx.roundRect(-0.4, -0.96, 0.8, 0.3, 0.1)
  paint(ctx, '#b9c4d6', 0.08)
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.arc(i * 0.19, -0.82, 0.055, 0, Math.PI * 2)
    ctx.fillStyle = INK
    ctx.fill()
  }
  if (s.spent) ctx.restore()
}

const drawSweeper: HazardDraw = (ctx, s) => {
  const spec = hazardSpec('sweeper')
  // A bar, drawn along +x, with hazard chevrons that scroll — the scroll is
  // what says "this is running" even in a still frame.
  ctx.beginPath()
  ctx.roundRect(-1, -0.34, 2, 0.68, 0.2)
  const g = ctx.createLinearGradient(0, -0.34, 0, 0.34)
  g.addColorStop(0, '#b9c2d4')
  g.addColorStop(0.5, spec.body)
  g.addColorStop(1, spec.shade)
  paint(ctx, g, 0.08)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(-1, -0.34, 2, 0.68, 0.2)
  ctx.clip()
  const off = (s.t % 1) * 0.5
  for (let i = -5; i < 6; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 0.5 + off, -0.4)
    ctx.lineTo(i * 0.5 + 0.22 + off, -0.4)
    ctx.lineTo(i * 0.5 + 0.02 + off, 0.4)
    ctx.lineTo(i * 0.5 - 0.2 + off, 0.4)
    ctx.closePath()
    ctx.fillStyle = spec.accent
    ctx.fill()
  }
  ctx.restore()
  // Blades at the leading edge.
  ctx.strokeStyle = '#f4f7ff'
  ctx.lineWidth = 0.06
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 0.22, -0.34)
    ctx.lineTo(i * 0.22 + 0.08, -0.52)
    ctx.stroke()
  }
}

const drawCobweb: HazardDraw = (ctx, _s, seed) => {
  const spec = hazardSpec('cobweb')
  const spokes = 9
  const rings = 4
  ctx.strokeStyle = spec.body
  ctx.lineWidth = 0.035
  ctx.globalAlpha = 0.85
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + hash(seed, i) * 0.2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a), Math.sin(a))
    ctx.stroke()
  }
  for (let r = 1; r <= rings; r++) {
    const rr = r / rings
    ctx.beginPath()
    for (let i = 0; i <= spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + hash(seed, i % spokes) * 0.2
      const sag = rr * (0.86 + hash(seed + 3, r * spokes + i) * 0.16)
      const x = Math.cos(a) * sag
      const y = Math.sin(a) * sag
      if (i === 0) ctx.moveTo(x, y)
      else {
        const pa = ((i - 1) / spokes) * Math.PI * 2 + hash(seed, (i - 1) % spokes) * 0.2
        const ma = (a + pa) / 2
        ctx.quadraticCurveTo(Math.cos(ma) * sag * 0.84, Math.sin(ma) * sag * 0.84, x, y)
      }
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  // A dewdrop or two, so it catches the attic's cold light.
  for (let i = 0; i < 4; i++) {
    const a = hash(seed + 7, i) * Math.PI * 2
    const rr = 0.35 + hash(seed + 11, i) * 0.6
    ctx.beginPath()
    ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 0.045, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fill()
  }
}

const drawConveyor: HazardDraw = (ctx, s) => {
  const spec = hazardSpec('conveyor')
  ctx.beginPath()
  ctx.roundRect(-1, -0.5, 2, 1, 0.1)
  paint(ctx, spec.shade, 0.07)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(-1, -0.5, 2, 1, 0.1)
  ctx.clip()
  const off = (s.t % 1) * 0.34
  for (let i = -8; i < 9; i++) {
    ctx.fillStyle = i % 2 === 0 ? spec.body : 'rgba(87,228,255,0.16)'
    ctx.fillRect(i * 0.34 + off, -0.5, 0.34, 1)
  }
  // Two glowing rails along the belt's edges — arcade, and it says direction.
  ctx.fillStyle = spec.accent
  ctx.globalAlpha = 0.85
  ctx.fillRect(-1, -0.5, 2, 0.07)
  ctx.fillRect(-1, 0.43, 2, 0.07)
  ctx.globalAlpha = 1
  // Chevrons pointing the way the belt runs.
  for (let i = -4; i < 5; i++) {
    ctx.beginPath()
    ctx.moveTo(i * 0.5 + off - 0.12, -0.22)
    ctx.lineTo(i * 0.5 + off + 0.14, 0)
    ctx.lineTo(i * 0.5 + off - 0.12, 0.22)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 0.07
    ctx.stroke()
  }
  ctx.restore()
}

const drawCrumbs: HazardDraw = (ctx, _s, seed) => {
  const spec = hazardSpec('crumbs')
  for (let i = 0; i < 11; i++) {
    const a = hash(seed, i) * Math.PI * 2
    const rr = Math.sqrt(hash(seed + 5, i)) * 0.86
    const size = 0.14 + hash(seed + 7, i) * 0.2
    ctx.save()
    ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr)
    ctx.rotate(hash(seed + 9, i) * Math.PI)
    ctx.beginPath()
    ctx.roundRect(-size, -size * 0.7, size * 2, size * 1.4, size * 0.4)
    const g = ctx.createLinearGradient(0, -size, 0, size)
    g.addColorStop(0, spec.accent)
    g.addColorStop(1, spec.shade)
    paint(ctx, g, 0.035)
    ctx.restore()
  }
}

/**
 * The shoebox — a Shoebox Trial, seen from straight above.
 *
 * A present, not a crate: candy pink with a yellow ribbon crossing it and a bow
 * on top, because the one thing it has to say at 30 px is "open me". It WOBBLES
 * on its own clock (a box with something inside that wants out) and the lid
 * lifts and skews as it takes blows — three stages a child can count down
 * without a number: shut, ajar, bursting.
 */
const drawShoebox: HazardDraw = (ctx, s) => {
  const spec = hazardSpec('shoebox')
  const crack = Math.max(0, Math.min(1, s.crack ?? 0))
  const wob = Math.sin(s.t * Math.PI * 2 * 3) * (0.05 + crack * 0.08)
  ctx.save()
  ctx.rotate(wob)
  // The box body — only its rim shows under the lid, and more of it as the lid
  // lifts.
  ctx.beginPath()
  ctx.roundRect(-0.92, -0.72, 1.84, 1.44, 0.16)
  paint(ctx, spec.shade, 0.09)
  // The lid, a touch larger than the box, lifting and turning as it cracks.
  ctx.save()
  ctx.translate(crack * 0.12, -crack * 0.22)
  ctx.rotate(-crack * 0.18)
  ctx.beginPath()
  ctx.roundRect(-1, -0.8, 2, 1.6, 0.2)
  paint(ctx, spec.body, 0.1)
  // Upper-left light, the one key light every drawable in the game shares.
  ctx.beginPath()
  ctx.roundRect(-0.86, -0.68, 1.1, 0.34, 0.14)
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.fill()
  // The ribbon, both ways across.
  ctx.fillStyle = spec.accent
  ctx.fillRect(-0.16, -0.8, 0.32, 1.6)
  ctx.fillRect(-1, -0.14, 2, 0.28)
  inked(ctx, 0.05)
  ctx.strokeRect(-0.16, -0.8, 0.32, 1.6)
  ctx.strokeRect(-1, -0.14, 2, 0.28)
  // The bow: two loops and a knot.
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * 0.3, -0.08, 0.3, 0.2, side * 0.5, 0, Math.PI * 2)
    paint(ctx, spec.accent, 0.07)
  }
  ctx.beginPath()
  ctx.arc(0, 0, 0.14, 0, Math.PI * 2)
  paint(ctx, '#ffd23a', 0.06)
  ctx.restore()
  // A sparkle leaking out of the gap once it is ajar.
  if (crack > 0.3) {
    ctx.fillStyle = `rgba(255,248,190,${0.5 + crack * 0.5})`
    for (let i = 0; i < 3; i++) {
      const a = s.t * 6 + i * 2.1
      ctx.beginPath()
      ctx.arc(0.7 + Math.cos(a) * 0.12, -0.7 + Math.sin(a) * 0.1, 0.07 + crack * 0.05, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/**
 * The slick lane — spilt lemonade, laid as a strip across the board.
 *
 * Drawn at one unit = the lane's half-WIDTH, stretched along x by `stretch`, so
 * the same drawing is a stubby puddle or a river depending on the board it was
 * laid on. Glossy and a little translucent: the floor has to show through, or
 * the bugs wading in it read as floating over a yellow road.
 */
const drawSlick: HazardDraw = (ctx, s, seed) => {
  const spec = hazardSpec('slick')
  const len = Math.max(1, s.stretch ?? 4)
  ctx.save()
  ctx.globalAlpha = 0.78
  ctx.beginPath()
  // A lane with lobed edges — a spill, not a road.
  const n = Math.max(6, Math.round(len * 2))
  ctx.moveTo(-len, 0)
  for (let i = 0; i <= n; i++) {
    const x = -len + (i / n) * len * 2
    ctx.lineTo(x, -0.82 - hash(seed, i) * 0.24)
  }
  for (let i = n; i >= 0; i--) {
    const x = -len + (i / n) * len * 2
    ctx.lineTo(x, 0.82 + hash(seed + 3, i) * 0.24)
  }
  ctx.closePath()
  const g = ctx.createLinearGradient(0, -1, 0, 1)
  g.addColorStop(0, spec.accent)
  g.addColorStop(0.5, spec.body)
  g.addColorStop(1, spec.shade)
  paint(ctx, g, 0.06)
  ctx.globalAlpha = 1
  // Glints, scattered and shimmering, so it reads WET. The first cut ran them in
  // a dashed line down the middle and the spill read as a road with its lane
  // markings painted on.
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  const n2 = Math.ceil(len * 1.6)
  for (let i = 0; i < n2; i++) {
    const x = -len + hash(seed + 5, i) * len * 2
    const y = (hash(seed + 9, i) - 0.5) * 1.2
    const tw = 0.5 + 0.5 * Math.sin((s.t + hash(seed + 13, i)) * Math.PI * 2)
    ctx.beginPath()
    ctx.ellipse(x, y, 0.22 + tw * 0.12, 0.08, -0.3, 0, Math.PI * 2)
    ctx.globalAlpha = 0.35 + tw * 0.55
    ctx.fill()
  }
  ctx.restore()
}

const HAZARD_DRAW: Record<HazardId, HazardDraw> = {
  honey: drawHoney,
  magnet: drawMagnet,
  salt: drawSalt,
  sweeper: drawSweeper,
  cobweb: drawCobweb,
  conveyor: drawConveyor,
  crumbs: drawCrumbs,
  shoebox: drawShoebox,
  slick: drawSlick
}

/**
 * Draw a hazard at (0,0), `r` px for one unit of its own size.
 *
 * Painted first: a decoded `images/props/<id>.webp` is blitted into the same
 * 2r × 2r box, so a painting drops in with no renderer change.
 */
export const paintHazard = (
  ctx: CanvasRenderingContext2D, id: HazardId, r: number, state: PropState, seed = 0
): void => {
  // The slick lane is never painted: it is a strip whose length is the board's,
  // and a square still stretched down a lane reads as a smear.
  const painted = id === 'slick' ? null : spriteFor('prop', id)
  if (painted && painted.naturalWidth > 0) {
    ctx.save()
    if (state.angle) ctx.rotate(state.angle)
    // A painted shoebox still wobbles and swells as it takes blows — the
    // countdown is the motion, and a painting cannot animate its own lid.
    if (id === 'shoebox') {
      const crack = state.crack ?? 0
      ctx.rotate(Math.sin(state.t * Math.PI * 2 * 3) * (0.05 + crack * 0.08))
      ctx.scale(1 + crack * 0.12, 1 + crack * 0.12)
    }
    ctx.drawImage(painted, -r, -r, r * 2, r * 2)
    ctx.restore()
    return
  }
  ctx.save()
  if (state.angle) ctx.rotate(state.angle)
  ctx.scale(r, r)
  HAZARD_DRAW[id](ctx, state, seed || id.length * 31)
  ctx.restore()
}

// ─── Boss furniture ─────────────────────────────────────────────────────────

/**
 * ─── The brood: boss eggs ───────────────────────────────────────────────────
 *
 * Every boss fight has eggs (see "The brood" in `bosses.ts`), and an egg has
 * one job the drawing must carry with no progress bar and no words: say HOW
 * LONG IS LEFT. So it reads in four stages — whole, a hairline crack, cracked
 * with a chip out of it, splitting open with antennae in the gap — and on top of
 * the stages it ROCKS, lazily at half-time and frantically on the last crack. A
 * six-year-old who has seen one hatch knows what the rattle means the second
 * time.
 *
 * Two looks: the ant egg every boss but one brings, and Roach Prime's capsule —
 * the pod its cutscene's production line is already pressing out.
 *
 * ── Painted, in this order ──
 *
 *   1. `prop/egg` / `prop/egg-capsule` — a STAGE sheet, one panel per crack
 *      stage, read back through `stripFrames`. The drop-in the new art pass
 *      paints.
 *   2. `prop/pod` — the one still painted before the stages existed. It is a
 *      whole egg, so the drawn cracks go OVER it; it used to be blitted bare,
 *      and with the art layer on no egg ever cracked at all.
 *   3. The drawing below.
 */

/** A painted egg panel's box, as a multiple of the egg's radius. Room for the
 *  last stage's lifted cap and the swell; the bench draws its reference at
 *  `1 / EGG_ART_BOX` of a half-panel, so the two cannot disagree. */
export const EGG_ART_BOX = 1.3
/** The hatched shell decal's box, as a multiple of the egg's radius — the two
 *  halves lie apart, wider than the egg was. */
export const EGG_SHELL_BOX = 1.6

/** Is this prop id one of the brood's drawables? The ids themselves live in
 *  `artCatalogue` (`EGG_PROP_IDS`), where the preloader can read them. */
export const isEggPropId = (id: string): id is EggPropId =>
  (EGG_PROP_IDS as readonly string[]).includes(id)

/** Which crack stage an egg `hatch01` of the way through its clock shows. */
export const eggStage = (hatch01: number): number =>
  Math.max(0, Math.min(EGG_STAGES - 1, Math.floor(hatch01 * EGG_STAGES)))

/** The rock starts here — the second half of the clock. */
const WOBBLE_FROM = 0.5

/**
 * How far an egg is rocked, radians.
 *
 * A CHIRP on the egg's own clock, `sin(2π·N·h²)`, rather than a sine of wall
 * time: the rate rises smoothly with `h` (about 2 Hz at half-time, 4 on the last
 * crack of a full-strength egg) and never jumps, where a wall-clock sine whose
 * rate changes every frame stutters. `clock` only drives the rattle of an egg
 * that is WAITING on its last crack for room to hatch (`h` pinned at 1), and
 * `seed` keeps two eggs laid together from rocking in step.
 */
export const eggWobble = (hatch01: number, clockMs: number, seed = 0): number => {
  const k = (hatch01 - WOBBLE_FROM) / (1 - WOBBLE_FROM)
  if (k <= 0) return 0
  const kk = Math.min(1, k)
  const amp = 0.035 + 0.17 * kk * kk
  const phase = hatch01 >= 1
    ? clockMs * 0.026
    : Math.PI * 2 * 10 * hatch01 * hatch01
  return Math.sin(phase + seed * Math.PI * 2) * amp
}

export interface PodPaint {
  look?: EggLook
  /** Wall clock, ms. Given, the egg rocks; omitted (a still, the bench, a
   *  cutscene prop), it holds still. */
  clock?: number
  /** 0..1, per egg — see `eggWobble`. */
  seed?: number
  /** Draw this crack stage instead of the one `hatch01` implies (the bench). */
  stage?: number
  /** Never the painting: the bench's reference is the drawing, always. */
  procedural?: boolean
}

/**
 * A boss egg at (0, 0), radius `r` px, `hatch01` of the way to hatching.
 *
 * The first four parameters are the signature the first egg shipped with, and
 * a cutscene draws a production line of these with exactly those four; the fifth
 * is optional and only adds.
 */
export const paintPod = (
  ctx: CanvasRenderingContext2D, r: number, hatch01: number, tint: string, o: PodPaint = {}
): void => {
  const look = o.look ?? 'egg'
  const h = Math.max(0, Math.min(1, hatch01))
  const stage = o.stage ?? eggStage(h)
  const rock = o.clock === undefined ? 0 : eggWobble(h, o.clock, o.seed ?? 0)
  ctx.save()
  if (rock !== 0) {
    // Rocking on its base: a turn, and a little squash in time with it, so the
    // last crack reads as something pushing from inside.
    const push = Math.abs(rock) * 0.3
    ctx.rotate(rock)
    ctx.scale(1 + push, 1 - push)
  }
  if (!o.procedural) {
    const frames = stripFrames('prop', EGG_ART_ID[look], 1)
    if (frames && frames.length > 0) {
      const f = frames[Math.min(stage, frames.length - 1)]!
      const b = r * EGG_ART_BOX
      ctx.drawImage(f, -b, -b, b * 2, b * 2)
      ctx.restore()
      return
    }
    const still = look === 'egg' ? spriteFor('prop', 'pod') : null
    if (still && still.naturalWidth > 0) {
      ctx.drawImage(still, -r, -r, r * 2, r * 2)
      ctx.scale(r, r)
      eggCracks(ctx, stage)
      ctx.restore()
      return
    }
  }
  ctx.scale(r, r)
  if (look === 'capsule') drawCapsule(ctx, stage, h, tint)
  else drawEgg(ctx, stage, h, tint)
  ctx.restore()
}

/** The egg's outline — one path, used for the fill, the clip and the ink. */
const eggPath = (ctx: CanvasRenderingContext2D): void => {
  ctx.beginPath()
  ctx.ellipse(0, 0.06, 0.74, 0.92, 0, 0, Math.PI * 2)
}

/** A zigzag seam across the egg at `y`, left to right, `teeth` points. */
const SEAM_X = [-0.9, -0.62, -0.36, -0.1, 0.14, 0.4, 0.64, 0.9] as const
const seamY = (i: number, y: number): number => y + (i % 2 === 0 ? -0.07 : 0.07)

const seamPath = (ctx: CanvasRenderingContext2D, y: number, below: boolean): void => {
  ctx.beginPath()
  ctx.moveTo(SEAM_X[0], seamY(0, y))
  for (let i = 1; i < SEAM_X.length; i++) ctx.lineTo(SEAM_X[i]!, seamY(i, y))
  const far = below ? 1.3 : -1.3
  ctx.lineTo(1, far)
  ctx.lineTo(-1, far)
  ctx.closePath()
}

const seamStroke = (ctx: CanvasRenderingContext2D, y: number, w: number): void => {
  ctx.beginPath()
  ctx.moveTo(SEAM_X[0], seamY(0, y))
  for (let i = 1; i < SEAM_X.length; i++) ctx.lineTo(SEAM_X[i]!, seamY(i, y))
  inked(ctx, w)
  ctx.stroke()
}

/** Two little antennae poking out of a split — the whole reason to watch. */
const antennae = (ctx: CanvasRenderingContext2D, y: number): void => {
  for (const sgn of [-1, 1] as const) {
    ctx.beginPath()
    ctx.moveTo(sgn * 0.1, y + 0.04)
    ctx.quadraticCurveTo(sgn * 0.16, y - 0.26, sgn * 0.34, y - 0.3)
    inked(ctx, 0.06)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(sgn * 0.36, y - 0.31, 0.06, 0, Math.PI * 2)
    paint(ctx, '#ffd9a8', 0.04)
  }
}

/**
 * A tint's own fully transparent end.
 *
 * A gradient from a colour to `rgba(0,0,0,0)` is interpolated unpremultiplied,
 * so every midtone passes through grey on its way out: the capsule's cyan glow
 * came out as a grey smudge across its seam. Fading to the SAME colour at zero
 * alpha keeps the light the colour it is. Cached, because the renderer asks for
 * the same boss accent for every egg, every frame.
 */
const clearCache = new Map<string, string>()
const clearOf = (hex: string): string => {
  let out = clearCache.get(hex)
  if (out === undefined) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
    out = m
      ? `rgba(${parseInt(m[1]!, 16)},${parseInt(m[2]!, 16)},${parseInt(m[3]!, 16)},0)`
      : 'rgba(255,255,255,0)'
    clearCache.set(hex, out)
  }
  return out
}

/** The glow in a split: what is inside, lit. */
const splitGlow = (ctx: CanvasRenderingContext2D, y: number, tint: string, reach: number): void => {
  const g = ctx.createRadialGradient(0, y, 0.02, 0, y, reach)
  g.addColorStop(0, tint)
  g.addColorStop(1, clearOf(tint))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, y, reach, reach * 0.55, 0, 0, Math.PI * 2)
  ctx.fill()
}

/** The drawn cracks for stages 1-2, over any whole egg — the drawing's own, or
 *  the old painted pod's. Stage 3 is a split, not a crack, and is its own shape. */
const eggCracks = (ctx: CanvasRenderingContext2D, stage: number): void => {
  if (stage <= 0) return
  ctx.strokeStyle = 'rgba(70,40,20,0.9)'
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  // The hairline, from the top down towards the middle.
  ctx.lineWidth = stage >= 2 ? 0.07 : 0.045
  ctx.beginPath()
  ctx.moveTo(0.2, -0.84)
  ctx.lineTo(0.08, -0.62)
  ctx.lineTo(0.22, -0.46)
  ctx.lineTo(0.05, -0.26)
  if (stage >= 2) {
    ctx.lineTo(0.16, -0.08)
    // A branch, and a second crack coming in from the left.
    ctx.moveTo(0.22, -0.46)
    ctx.lineTo(0.44, -0.4)
    ctx.moveTo(-0.62, -0.3)
    ctx.lineTo(-0.4, -0.22)
    ctx.lineTo(-0.44, -0.04)
    ctx.lineTo(-0.24, 0.06)
  }
  ctx.stroke()
  if (stage >= 2) {
    // A chip out of the shell, dark inside.
    ctx.beginPath()
    ctx.moveTo(0.08, -0.62)
    ctx.lineTo(-0.1, -0.7)
    ctx.lineTo(-0.02, -0.5)
    ctx.closePath()
    ctx.fillStyle = '#3b2616'
    ctx.fill()
  }
}

const drawEgg = (ctx: CanvasRenderingContext2D, stage: number, h: number, tint: string): void => {
  const swell = 1 + h * 0.12
  ctx.scale(swell, swell)
  const shellFill = (): CanvasGradient => {
    const g = ctx.createRadialGradient(-0.25, -0.34, 0.05, 0, 0, 1)
    g.addColorStop(0, '#fffaf0')
    g.addColorStop(0.55, '#f2e1b6')
    g.addColorStop(1, '#c4a46a')
    return g
  }
  const speckles = (): void => {
    ctx.fillStyle = 'rgba(160,112,60,0.35)'
    for (const [x, y, rr] of EGG_SPECKLES) {
      ctx.beginPath()
      ctx.arc(x, y, rr, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const glow = (): void => {
    ctx.save()
    eggPath(ctx)
    ctx.clip()
    const gg = ctx.createRadialGradient(0, 0.12, 0.02, 0, 0.12, 0.9)
    gg.addColorStop(0, tint)
    gg.addColorStop(1, clearOf(tint))
    ctx.globalAlpha = 0.16 + stage * 0.12
    ctx.fillStyle = gg
    ctx.fill()
    ctx.restore()
  }
  const sheen = (): void => {
    ctx.beginPath()
    ctx.ellipse(-0.26, -0.44, 0.16, 0.26, -0.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fill()
  }

  if (stage < 3) {
    eggPath(ctx)
    paint(ctx, shellFill(), 0.09)
    speckles()
    glow()
    sheen()
    eggCracks(ctx, stage)
    return
  }

  // ── Splitting: the cap lifts along a zigzag seam and the inside shows. ──
  //
  // The lift has to read at thirty device pixels, which is most of an ink line:
  // at a sixth of the egg the gap was all outline and no light.
  const seam = -0.06
  const lift = 0.26
  // What is inside, filling both halves' outline and the gap between them.
  ctx.save()
  eggPath(ctx)
  ctx.fillStyle = '#3b2616'
  ctx.fill()
  ctx.translate(0, -lift)
  eggPath(ctx)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, seam - lift * 0.5, 0.74, lift * 0.9, 0, 0, Math.PI * 2)
  ctx.clip()
  splitGlow(ctx, seam - lift * 0.5, tint, 0.8)
  ctx.restore()
  // The bottom cup. Its broken rim is inked INSIDE its own outline — stroked
  // across the whole seam, the zigzag stuck out past the egg like whiskers.
  ctx.save()
  seamPath(ctx, seam, true)
  ctx.clip()
  eggPath(ctx)
  paint(ctx, shellFill(), 0.09)
  speckles()
  ctx.restore()
  ctx.save()
  eggPath(ctx)
  ctx.clip()
  seamStroke(ctx, seam, 0.08)
  ctx.restore()
  // The cap, lifted and tipped.
  ctx.save()
  ctx.translate(0.03, -lift)
  ctx.rotate(-0.16)
  ctx.save()
  seamPath(ctx, seam, false)
  ctx.clip()
  eggPath(ctx)
  paint(ctx, shellFill(), 0.09)
  sheen()
  ctx.restore()
  ctx.save()
  eggPath(ctx)
  ctx.clip()
  seamStroke(ctx, seam, 0.08)
  ctx.restore()
  ctx.restore()
  // …and poking out of the gap, on top of both, the reason to have watched.
  antennae(ctx, seam - lift * 0.35)
}

/** Where the speckles sit on an egg — fixed, so an egg never shimmers. */
const EGG_SPECKLES: ReadonlyArray<readonly [number, number, number]> = [
  [0.3, -0.2, 0.05], [-0.36, 0.3, 0.06], [0.12, 0.52, 0.045], [0.46, 0.22, 0.04], [-0.18, -0.02, 0.035]
]

/** The capsule's pill. */
const capsulePath = (ctx: CanvasRenderingContext2D): void => {
  ctx.beginPath()
  ctx.roundRect(-0.6, -0.9, 1.2, 1.8, 0.6)
}

const drawCapsule = (ctx: CanvasRenderingContext2D, stage: number, h: number, tint: string): void => {
  const swell = 1 + h * 0.06
  ctx.scale(swell, swell)
  const steel = (): CanvasGradient => {
    const g = ctx.createLinearGradient(-0.6, 0, 0.6, 0)
    g.addColorStop(0, '#e6ecf6')
    g.addColorStop(0.45, '#9aa6bc')
    g.addColorStop(1, '#465068')
    return g
  }
  const rivets = (y: number): void => {
    ctx.fillStyle = '#2c3446'
    for (const x of [-0.36, 0.36]) {
      ctx.beginPath()
      ctx.arc(x, y, 0.055, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const band = (): void => {
    // The seam band: dark, with a light running round it that brightens stage
    // by stage — the capsule's version of a crack.
    ctx.save()
    capsulePath(ctx)
    ctx.clip()
    ctx.fillStyle = '#232a3a'
    ctx.fillRect(-0.7, -0.13, 1.4, 0.26)
    ctx.globalAlpha = 0.35 + stage * 0.2
    ctx.fillStyle = tint
    ctx.fillRect(-0.7, -0.04, 1.4, 0.08)
    ctx.restore()
  }
  const porthole = (): void => {
    ctx.beginPath()
    ctx.arc(0, -0.48, 0.2, 0, Math.PI * 2)
    paint(ctx, '#1a2130', 0.06)
    ctx.save()
    ctx.globalAlpha = 0.3 + stage * 0.18
    ctx.beginPath()
    ctx.arc(0, -0.48, 0.14, 0, Math.PI * 2)
    ctx.fillStyle = tint
    ctx.fill()
    ctx.restore()
    ctx.beginPath()
    ctx.arc(-0.06, -0.54, 0.05, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fill()
  }

  if (stage < 3) {
    capsulePath(ctx)
    paint(ctx, steel(), 0.09)
    band()
    rivets(-0.26)
    rivets(0.3)
    porthole()
    if (stage >= 1) {
      // A panel line, then the panels starting to give.
      ctx.beginPath()
      ctx.moveTo(-0.6, 0.5)
      ctx.lineTo(0.6, 0.5)
      inked(ctx, 0.04)
      ctx.stroke()
    }
    if (stage >= 2) {
      // Two bolts popped out of their holes, and a spark at the seam.
      ctx.fillStyle = '#c9d2e2'
      for (const [x, y] of [[0.48, -0.2], [-0.5, 0.24]] as const) {
        ctx.beginPath()
        ctx.roundRect(x - 0.06, y - 0.06, 0.12, 0.12, 0.03)
        ctx.fill()
      }
      ctx.strokeStyle = '#fff6c8'
      ctx.lineWidth = 0.04
      ctx.beginPath()
      ctx.moveTo(0.62, -0.02)
      ctx.lineTo(0.8, -0.12)
      ctx.moveTo(0.64, 0.04)
      ctx.lineTo(0.84, 0.06)
      ctx.stroke()
    }
    return
  }

  // ── Splitting: the top half lifts off the band and the light pours out. ──
  const lift = 0.3
  const inside = (): void => {
    capsulePath(ctx)
    ctx.fillStyle = '#1a2130'
    ctx.fill()
  }
  /** A half's broken edge: the band's light, still lit, along the break. */
  const rim = (y: number): void => {
    ctx.save()
    capsulePath(ctx)
    ctx.clip()
    ctx.fillStyle = tint
    ctx.fillRect(-0.7, y - 0.035, 1.4, 0.07)
    ctx.restore()
  }
  ctx.save()
  inside()
  ctx.translate(0, -lift)
  inside()
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, -lift * 0.5, 0.6, lift * 0.9, 0, 0, Math.PI * 2)
  ctx.clip()
  splitGlow(ctx, -lift * 0.5, tint, 0.9)
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.rect(-1, 0, 2, 1.2)
  ctx.clip()
  capsulePath(ctx)
  paint(ctx, steel(), 0.09)
  rivets(0.3)
  ctx.restore()
  rim(0.02)
  ctx.save()
  ctx.translate(0, -lift)
  ctx.rotate(0.12)
  ctx.save()
  ctx.beginPath()
  ctx.rect(-1, -1.2, 2, 1.2)
  ctx.clip()
  capsulePath(ctx)
  paint(ctx, steel(), 0.09)
  rivets(-0.26)
  porthole()
  ctx.restore()
  rim(-0.02)
  ctx.restore()
  antennae(ctx, -lift * 0.35)
}

/**
 * The empty shell a hatch leaves on the floor: two halves lying apart.
 *
 * Stamped ONCE into the decal layer, where it stays for the rest of the fight —
 * the floor keeps a record of every egg the player let hatch, which is its own
 * quiet lesson. `seed` turns the pair, so a floor of them is not a pattern.
 */
export const paintEggShell = (
  ctx: CanvasRenderingContext2D, r: number, look: EggLook, seed: number,
  o: { procedural?: boolean } = {}
): void => {
  ctx.save()
  ctx.rotate(seed * Math.PI * 2)
  if (!o.procedural) {
    const painted = spriteFor('prop', EGG_SHELL_ART_ID[look])
    if (painted && painted.naturalWidth > 0) {
      const b = r * EGG_SHELL_BOX
      ctx.drawImage(painted, -b, -b, b * 2, b * 2)
      ctx.restore()
      return
    }
  }
  ctx.scale(r, r)
  const metal = look === 'capsule'
  const outer = metal ? '#9aa6bc' : '#f2e1b6'
  const inner = metal ? '#232a3a' : '#d8bf8a'
  // The cup: the bottom half of the shell, rim up, with its inside showing.
  const half = (x: number, y: number, a: number, s: number): void => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(a)
    ctx.scale(s, s)
    ctx.beginPath()
    ctx.moveTo(SEAM_X[0] * 0.8, seamY(0, 0))
    for (let i = 1; i < SEAM_X.length; i++) ctx.lineTo(SEAM_X[i]! * 0.8, seamY(i, 0))
    ctx.ellipse(0, 0, 0.72, 0.62, 0, 0, Math.PI, false)
    ctx.closePath()
    paint(ctx, outer, 0.09)
    ctx.beginPath()
    ctx.ellipse(0, 0.02, 0.56, 0.2, 0, 0, Math.PI * 2)
    ctx.fillStyle = inner
    ctx.fill()
    if (metal) {
      ctx.fillStyle = 'rgba(110,240,255,0.55)'
      ctx.fillRect(-0.5, -0.03, 1, 0.06)
    }
    ctx.restore()
  }
  half(-0.34, 0.26, -0.35, 1)
  half(0.46, -0.36, Math.PI + 0.7, 0.8)
  // A few chips of shell thrown clear.
  ctx.fillStyle = outer
  for (const [x, y, s] of [[0.62, 0.42, 0.09], [-0.7, -0.4, 0.07], [0.1, 0.8, 0.06]] as const) {
    ctx.beginPath()
    ctx.moveTo(x - s, y)
    ctx.lineTo(x, y - s)
    ctx.lineTo(x + s, y + s * 0.4)
    ctx.closePath()
    paint(ctx, outer, 0.03)
  }
  ctx.restore()
}

/**
 * One of the brood's drawables in a square cell of half-size `half`, at `panel`
 * (the crack stage, for a stage sheet), centred on (0, 0).
 *
 * The cell IS the painting's box — the egg is drawn at `half / EGG_ART_BOX` and
 * the shell at `half / EGG_SHELL_BOX` — so the bench's reference and the
 * runtime's blit share one piece of arithmetic. `painted` draws the painting
 * through the game's own path and returns false when there is none (the
 * playground's A/B); otherwise it is always the drawing, which is what the bench
 * exports.
 */
export const paintEggProp = (
  ctx: CanvasRenderingContext2D, id: EggPropId, half: number, panel = 0, painted = false
): boolean => {
  const look: EggLook = id.startsWith('egg-capsule') ? 'capsule' : 'egg'
  const tint = look === 'capsule' ? '#6ef0ff' : '#ffd07a'
  if (id === 'egg-shell' || id === 'egg-capsule-shell') {
    if (painted) {
      const img = spriteFor('prop', id)
      if (!img || !img.naturalWidth) return false
    }
    paintEggShell(ctx, half / EGG_SHELL_BOX, look, 0, { procedural: !painted })
    return true
  }
  const stage = Math.max(0, Math.min(EGG_STAGES - 1, panel))
  if (painted && !stripFrames('prop', id, 1)) return false
  paintPod(ctx, half / EGG_ART_BOX, (stage + 0.5) / EGG_STAGES, tint, { look, stage, procedural: !painted })
  return true
}

/** The coin the piñata fly drops. Spins on `t`, which is a plain 0..1. */
export const paintCoin = (
  ctx: CanvasRenderingContext2D, r: number, t: number
): void => {
  const painted = spriteFor('prop', 'coin')
  const squash = Math.abs(Math.cos(t * Math.PI * 2)) * 0.86 + 0.14
  ctx.save()
  ctx.scale(squash, 1)
  if (painted && painted.naturalWidth > 0) {
    ctx.drawImage(painted, -r, -r, r * 2, r * 2)
    ctx.restore()
    return
  }
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r)
  g.addColorStop(0, '#fff2b0')
  g.addColorStop(0.55, '#ffcd00')
  g.addColorStop(1, '#c98a00')
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = '#8a5c00'
  ctx.lineWidth = Math.max(1, r * 0.12)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = Math.max(1, r * 0.09)
  ctx.stroke()
  ctx.restore()
}

/**
 * The purple haze a stink bug leaves behind.
 *
 * Drawn as three offset, slowly-rotating blobs rather than one circle: a single
 * soft disc reads as a UI overlay, and three overlapping ones read as a cloud.
 */
export const paintHaze = (
  ctx: CanvasRenderingContext2D, r: number, t: number, alpha: number
): void => {
  ctx.save()
  ctx.globalAlpha = alpha
  for (let i = 0; i < 3; i++) {
    const a = t * Math.PI * 2 * (0.3 + i * 0.12) + i * 2.1
    const cx = Math.cos(a) * r * 0.22
    const cy = Math.sin(a) * r * 0.18
    const g = ctx.createRadialGradient(cx, cy, r * 0.06, cx, cy, r * 0.9)
    g.addColorStop(0, 'rgba(186,120,255,0.55)')
    g.addColorStop(0.6, 'rgba(140,70,220,0.3)')
    g.addColorStop(1, 'rgba(140,70,220,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * The salt cloud: a ring of grains expanding outward.
 *
 * `p01` is how far through its life it is. It expands and fades, and it is
 * drawn with discrete grains rather than a gradient, because the thing the
 * player has to read is that it is SALT and not another haze.
 */
export const paintSaltBurst = (
  ctx: CanvasRenderingContext2D, r: number, p01: number
): void => {
  const rr = r * (0.2 + p01 * 0.8)
  ctx.save()
  ctx.globalAlpha = Math.max(0, 1 - p01) * 0.9
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + p01 * 1.4
    const d = rr * (0.72 + hash(i, 3) * 0.34)
    const s = Math.max(1, r * 0.026 * (1 + hash(i, 7)))
    ctx.beginPath()
    ctx.rect(Math.cos(a) * d - s, Math.sin(a) * d - s, s * 2, s * 2)
    ctx.fill()
  }
  ctx.restore()
}
