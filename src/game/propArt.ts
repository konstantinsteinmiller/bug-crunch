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

const HAZARD_DRAW: Record<HazardId, HazardDraw> = {
  honey: drawHoney,
  magnet: drawMagnet,
  salt: drawSalt,
  sweeper: drawSweeper,
  cobweb: drawCobweb,
  conveyor: drawConveyor,
  crumbs: drawCrumbs
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
  const painted = spriteFor('prop', id)
  if (painted && painted.naturalWidth > 0) {
    ctx.save()
    if (state.angle) ctx.rotate(state.angle)
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
 * A boss egg pod: the target of a `pods` phase.
 *
 * `hatch01` is how close it is to opening, and the drawing has to carry that
 * without a progress bar — so the pod swells, its cracks widen, and the light
 * inside it brightens. A player who is losing the phase can see it in the pods.
 */
export const paintPod = (
  ctx: CanvasRenderingContext2D, r: number, hatch01: number, tint: string
): void => {
  const painted = spriteFor('prop', 'pod')
  if (painted && painted.naturalWidth > 0) {
    ctx.drawImage(painted, -r, -r, r * 2, r * 2)
    return
  }
  const swell = 1 + hatch01 * 0.16 + Math.sin(hatch01 * Math.PI * 12) * hatch01 * 0.03
  ctx.save()
  ctx.scale(r * swell, r * swell)
  ctx.beginPath()
  ctx.ellipse(0, 0.06, 0.78, 0.94, 0, 0, Math.PI * 2)
  const g = ctx.createRadialGradient(-0.25, -0.3, 0.05, 0, 0, 1)
  g.addColorStop(0, '#fff8e6')
  g.addColorStop(0.5, '#f0dcae')
  g.addColorStop(1, '#b99a63')
  paint(ctx, g, 0.1)
  // The glow inside, brightening as it hatches.
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, 0.06, 0.78, 0.94, 0, 0, Math.PI * 2)
  ctx.clip()
  const gg = ctx.createRadialGradient(0, 0.1, 0.02, 0, 0.1, 0.9)
  gg.addColorStop(0, tint)
  gg.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalAlpha = 0.25 + hatch01 * 0.6
  ctx.fillStyle = gg
  ctx.fill()
  ctx.restore()
  // Cracks. They appear in stages so the pod tells you how long you have.
  const cracks = Math.floor(hatch01 * 4)
  ctx.strokeStyle = 'rgba(60,36,12,0.75)'
  ctx.lineWidth = 0.05 + hatch01 * 0.05
  for (let i = 0; i < cracks; i++) {
    const a = -1.2 + i * 1.1
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 0.1, Math.sin(a) * 0.1)
    ctx.lineTo(Math.cos(a) * 0.45 + 0.08, Math.sin(a) * 0.45)
    ctx.lineTo(Math.cos(a) * 0.76, Math.sin(a) * 0.8 + 0.06)
    ctx.stroke()
  }
  ctx.restore()
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
