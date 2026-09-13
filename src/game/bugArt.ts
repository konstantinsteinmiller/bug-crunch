/**
 * ─── Drawing the bugs ───────────────────────────────────────────────────────
 *
 * Splatix ships with ZERO gameplay bitmaps of its own making. Every bug is
 * drawn here with Canvas 2D in a hand-inked, cozy-cute register — thick warm
 * outlines, soft fills, glossy eyes with a highlight, a blush — and baked into
 * frame strips at runtime. That keeps the download tiny, keeps the art crisp at
 * any DPR, and means the game is playable the instant the JS parses.
 *
 * When painted art arrives it drops in with NO renderer change: `spriteFor` /
 * `stripFrame` probe `public/images/bugs/<id>.webp` and, if the image decodes,
 * the renderer blits its panels instead of these bakes. A missing file simply
 * means "keep drawing it".
 *
 * ── The frame box IS the contract ──
 *
 * Every bug is drawn into a SQUARE frame, nose pointing UP (−y), centred, with
 * its body radius `size` mapping to `BUG_R_FRAC` of the frame's half-edge. The
 * renderer rotates the whole frame by the body's heading. The art bench
 * (`artSheet.ts`) exports panels of exactly this box, so a painted return drops
 * back in with the nose on the same line and nothing downstream has to be told
 * where it is. Break that and every painted bug is the wrong size, everywhere,
 * invisibly.
 *
 * ── Why the bake ──
 *
 * A dense late board is ~28 live bodies plus a boss. Drawing nine outlined,
 * shaded, eight-legged creatures per frame from paths costs more than the rest
 * of the renderer put together; blitting 28 cached canvases costs almost
 * nothing. The bake is sliced across idle frames so it never stalls the first
 * paint, and the drawing path is the fallback for anything not baked yet.
 */

import { spriteFor } from '@/game/art'
import { stripFrame } from '@/game/spriteStrip'
import { BUGS, bugSpec, type BugId, type BugSpec } from '@/game/bugs'
import { BOSSES, type BossId } from '@/game/bosses'

// ─── The frame box ──────────────────────────────────────────────────────────

/** Panels in one walk cycle. Eight reads as a gait; sixteen is twice the file. */
export const BUG_FRAMES = 8

/** A bug's frame is square, so the renderer can spin it about its centre. */
export const BUG_FRAME_ASPECT = 1

/**
 * The body radius as a fraction of the frame's HALF-edge.
 *
 * Under 1 on purpose: legs, antennae and a caterpillar's spikes all live
 * outside the body circle the physics uses, and they have to fit inside the
 * frame or a painted return will have them clipped off at the panel edge.
 */
export const BUG_R_FRAC = 0.62

// ─── Deterministic wobble ───────────────────────────────────────────────────
//
// Organic shapes need irregularity, and irregularity must not flicker: a blob
// re-rolled every bake would breathe between frames. One integer hash, seeded
// off the bug id and the vertex index, gives every creature its own silhouette
// and gives that silhouette forever.

const hash = (a: number, b: number): number => {
  let h = (a * 374761393 + b * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177 | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const seedOf = (id: string): number => {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = (h ^ id.charCodeAt(i)) * 16777619
  return h >>> 0
}

// ─── Ink ────────────────────────────────────────────────────────────────────

/** The outline colour. Warm near-black, never pure black — pure black reads as
 *  vector clip-art, and this game is meant to look drawn. */
const INK = '#2b1b2e'

const inked = (ctx: CanvasRenderingContext2D, w: number): void => {
  ctx.strokeStyle = INK
  ctx.lineWidth = w
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
}

/**
 * A closed organic blob: an ellipse whose radius wobbles by a fixed per-vertex
 * amount. `n` vertices, smoothed with quadratic midpoints so the outline has no
 * corners at all.
 */
const blob = (
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  seed: number, wobble = 0.08, n = 14, rot = 0
): void => {
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    const k = 1 + (hash(seed, i) - 0.5) * 2 * wobble
    xs.push(cx + Math.cos(a) * rx * k)
    ys.push(cy + Math.sin(a) * ry * k)
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

/** Fill + outline in one call, which is what every body part wants. */
const paint = (
  ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, line: number
): void => {
  ctx.fillStyle = fill
  ctx.fill()
  if (line > 0) { inked(ctx, line); ctx.stroke() }
}

/**
 * A glossy cartoon eye, looking slightly in the direction of travel.
 *
 * The eye is the single most load-bearing thing on any of these drawings: it is
 * what makes a brown oval read as a creature at 30 px, and it is the whole of
 * the GDD's "googly-eyed insects". Three stacked pieces — white, iris, and TWO
 * highlights (a big one at 10 o'clock and a small one at 4) — because one
 * highlight reads as plastic and two read as wet.
 */
const eye = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  lookX: number, lookY: number,
  irisColour = '#2b1b2e', angry = false
): void => {
  ctx.beginPath()
  ctx.ellipse(x, y, r, r * 1.06, 0, 0, Math.PI * 2)
  paint(ctx, '#ffffff', r * 0.22)

  const ix = x + lookX * r * 0.28
  const iy = y + lookY * r * 0.28
  ctx.beginPath()
  ctx.ellipse(ix, iy, r * 0.52, r * 0.56, 0, 0, Math.PI * 2)
  ctx.fillStyle = irisColour
  ctx.fill()

  ctx.beginPath()
  ctx.arc(ix - r * 0.22, iy - r * 0.26, r * 0.22, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(ix + r * 0.2, iy + r * 0.22, r * 0.1, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fill()

  if (angry) {
    // A brow, not a frown: it tilts the whole face without touching the eye,
    // which keeps the creature cute and makes it look cross rather than evil.
    ctx.beginPath()
    ctx.moveTo(x - r * 1.05, y - r * 1.15)
    ctx.lineTo(x + r * 0.55, y - r * 0.62)
    inked(ctx, r * 0.34)
    ctx.stroke()
  }
}

/** Two round blush patches. Cheap, and they do most of the "cozy" work. */
const blush = (
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tint = 'rgba(255,120,150,0.42)'
): void => {
  ctx.fillStyle = tint
  ctx.beginPath(); ctx.ellipse(-x, y, r, r * 0.66, 0, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.66, 0, 0, Math.PI * 2); ctx.fill()
}

/**
 * One bent insect leg, drawn from the body outward.
 *
 * `phase` is where this leg is in the gait: −1 fully back, +1 fully forward.
 * A real tripod gait alternates legs 1/3/5 against 2/4/6, which is what the
 * caller does with the sign of `phase` — and it is the difference between a
 * creature walking and a creature sliding with its legs twitching.
 */
const leg = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, len: number, angle: number, phase: number, w: number
): void => {
  const a = angle + phase * 0.34
  const kneeX = x + Math.cos(a) * len * 0.58
  const kneeY = y + Math.sin(a) * len * 0.58
  const footA = a + (x < 0 ? -0.7 : 0.7) * (0.6 + phase * 0.25)
  const footX = kneeX + Math.cos(footA) * len * 0.52
  const footY = kneeY + Math.sin(footA) * len * 0.52
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(kneeX, kneeY, footX, footY)
  inked(ctx, w)
  ctx.stroke()
}

/** A curling antenna with a bead on the end. */
const antenna = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, len: number, angle: number, wiggle: number, w: number, bead: string
): void => {
  const midX = x + Math.cos(angle) * len * 0.55
  const midY = y + Math.sin(angle) * len * 0.55
  const tipA = angle + wiggle
  const tipX = midX + Math.cos(tipA) * len * 0.55
  const tipY = midY + Math.sin(tipA) * len * 0.55
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.quadraticCurveTo(midX, midY, tipX, tipY)
  inked(ctx, w)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(tipX, tipY, w * 1.15, 0, Math.PI * 2)
  paint(ctx, bead, w * 0.55)
}

/** A soft top-light on a body: the highlight that makes a flat fill read as
 *  a rounded thing seen from above. */
const sheen = (
  ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number
): void => {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy - ry * 0.3, rx * 0.62, ry * 0.42, -0.25, 0, Math.PI * 2)
  const g = ctx.createLinearGradient(cx, cy - ry, cx, cy)
  g.addColorStop(0, 'rgba(255,255,255,0.38)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fill()
  ctx.restore()
}

// ─── The nine drawings ──────────────────────────────────────────────────────
//
// Each takes a context already translated to the frame's centre, scaled so that
// ONE UNIT IS THE BODY RADIUS, with the creature facing −y. `t` is 0..1 through
// the walk cycle. Nothing below knows about pixels.

type Draw = (ctx: CanvasRenderingContext2D, s: BugSpec, t: number) => void

/** Gait helper: the tripod phase for leg `i` at cycle `t`. */
const gait = (t: number, i: number): number =>
  Math.sin(t * Math.PI * 2 + (i % 2 === 0 ? 0 : Math.PI))

const drawAnt: Draw = (ctx, s, t) => {
  const seed = seedOf(s.id)
  const bob = Math.sin(t * Math.PI * 4) * 0.03
  const lw = 0.12

  // Six legs first, so the body overlaps their roots.
  for (let i = 0; i < 3; i++) {
    const y = -0.25 + i * 0.42
    const p = gait(t, i)
    leg(ctx, -0.42, y, 0.85, Math.PI * 0.86, p, lw)
    leg(ctx, 0.42, y, 0.85, Math.PI * 0.14, -p, lw)
  }

  // Abdomen (back), thorax (middle), head (front) — the three-lobe ant
  // silhouette, which is what makes it readable at 20 px.
  blob(ctx, 0, 0.72 + bob, 0.56, 0.7, seed + 1, 0.07)
  paint(ctx, s.body, lw * 1.4)
  sheen(ctx, 0, 0.72 + bob, 0.56, 0.7)

  blob(ctx, 0, 0.08 + bob, 0.38, 0.4, seed + 2, 0.06)
  paint(ctx, s.shade, lw * 1.3)

  blob(ctx, 0, -0.62 + bob, 0.52, 0.5, seed + 3, 0.05)
  paint(ctx, s.body, lw * 1.4)
  sheen(ctx, 0, -0.62 + bob, 0.52, 0.5)

  const wig = Math.sin(t * Math.PI * 2) * 0.28
  antenna(ctx, -0.22, -0.92 + bob, 0.62, -Math.PI * 0.68 + wig, -0.5, lw * 0.85, s.accent)
  antenna(ctx, 0.22, -0.92 + bob, 0.62, -Math.PI * 0.32 - wig, 0.5, lw * 0.85, s.accent)

  ctx.save()
  ctx.translate(0, -0.62 + bob)
  eye(ctx, -0.2, -0.06, 0.2, 0, -0.4)
  eye(ctx, 0.2, -0.06, 0.2, 0, -0.4)
  blush(ctx, 0.34, 0.2, 0.13)
  ctx.restore()
}

const drawBeetle: Draw = (ctx, s, t) => {
  const seed = seedOf(s.id)
  const bob = Math.sin(t * Math.PI * 4) * 0.02
  const lw = 0.13

  for (let i = 0; i < 3; i++) {
    const y = -0.3 + i * 0.4
    const p = gait(t, i) * 0.7
    leg(ctx, -0.62, y, 0.72, Math.PI * 0.9, p, lw)
    leg(ctx, 0.62, y, 0.72, Math.PI * 0.1, -p, lw)
  }

  // The dome. A beetle from above is one big oval shell with a seam, and the
  // seam is the thing that will later be drawn CRACKED.
  blob(ctx, 0, 0.06 + bob, 0.92, 1.0, seed + 1, 0.05, 16)
  const g = ctx.createRadialGradient(-0.3, -0.35 + bob, 0.1, 0, 0.06 + bob, 1.1)
  g.addColorStop(0, s.accent)
  g.addColorStop(0.34, s.body)
  g.addColorStop(1, s.shade)
  paint(ctx, g, lw * 1.5)

  ctx.beginPath()
  ctx.moveTo(0, -0.86 + bob)
  ctx.lineTo(0, 1.0 + bob)
  inked(ctx, lw * 0.9)
  ctx.stroke()

  // Two pale spots — a ladybird cue, which is the friendliest thing a beetle
  // silhouette can wear and keeps the cast inside the cozy register.
  ctx.fillStyle = 'rgba(255,255,255,0.24)'
  ctx.beginPath(); ctx.ellipse(-0.42, 0.3 + bob, 0.2, 0.26, 0.2, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(0.42, 0.3 + bob, 0.2, 0.26, -0.2, 0, Math.PI * 2); ctx.fill()

  // Head, tucked under the shell's front edge.
  blob(ctx, 0, -0.92 + bob, 0.46, 0.34, seed + 4, 0.05)
  paint(ctx, s.shade, lw * 1.3)

  // The horn. Rhinoceros beetle, and it points forward so the player can read
  // which way it is going without looking at the legs.
  ctx.beginPath()
  ctx.moveTo(-0.1, -1.08 + bob)
  ctx.quadraticCurveTo(0, -1.6 + bob, 0.12, -1.2 + bob)
  ctx.closePath()
  paint(ctx, s.accent, lw)

  ctx.save()
  ctx.translate(0, -0.92 + bob)
  eye(ctx, -0.21, -0.02, 0.15, 0, -0.3, INK, true)
  eye(ctx, 0.21, -0.02, 0.15, 0, -0.3, INK, true)
  ctx.restore()
}

const drawFlea: Draw = (ctx, s, t) => {
  const seed = seedOf(s.id)
  // A hop, not a walk: the cycle is mostly crouch with one short launch, so the
  // creature reads as coiled even while it is standing still.
  const hop = Math.max(0, Math.sin(t * Math.PI * 2))
  const lift = hop * hop * 0.38
  const squash = 1 - lift * 0.35
  const lw = 0.13

  ctx.save()
  ctx.translate(0, -lift)

  // Back legs — the springs. Drawn long and folded.
  for (const sgn of [-1, 1] as const) {
    ctx.beginPath()
    ctx.moveTo(sgn * 0.35, 0.35)
    ctx.quadraticCurveTo(sgn * (1.1 + lift * 0.5), 0.5 - lift * 0.4, sgn * 0.72, 1.05 - lift * 0.2)
    inked(ctx, lw * 1.15)
    ctx.stroke()
  }
  for (let i = 0; i < 2; i++) {
    const p = gait(t, i) * 0.5
    leg(ctx, -0.38, -0.1 + i * 0.34, 0.6, Math.PI * 0.88, p, lw * 0.85)
    leg(ctx, 0.38, -0.1 + i * 0.34, 0.6, Math.PI * 0.12, -p, lw * 0.85)
  }

  blob(ctx, 0, 0.16, 0.62, 0.86 * squash, seed + 1, 0.07)
  const g = ctx.createLinearGradient(0, -0.7, 0, 1)
  g.addColorStop(0, s.accent)
  g.addColorStop(0.5, s.body)
  g.addColorStop(1, s.shade)
  paint(ctx, g, lw * 1.4)
  sheen(ctx, 0, 0.16, 0.62, 0.86 * squash)

  blob(ctx, 0, -0.68, 0.42, 0.4, seed + 2, 0.05)
  paint(ctx, s.body, lw * 1.3)

  const wig = Math.sin(t * Math.PI * 2 + 1) * 0.34
  antenna(ctx, -0.16, -0.94, 0.46, -Math.PI * 0.62 + wig, -0.4, lw * 0.75, s.accent)
  antenna(ctx, 0.16, -0.94, 0.46, -Math.PI * 0.38 - wig, 0.4, lw * 0.75, s.accent)

  ctx.save()
  ctx.translate(0, -0.68)
  eye(ctx, -0.17, 0, 0.18, 0, -0.3)
  eye(ctx, 0.17, 0, 0.18, 0, -0.3)
  blush(ctx, 0.32, 0.2, 0.11, 'rgba(160,200,255,0.5)')
  ctx.restore()
  ctx.restore()
}

const drawCaterpillar: Draw = (ctx, s, t) => {
  const seed = seedOf(s.id)
  const lw = 0.12
  // Five body beads with a travelling ripple — the whole animation of a
  // caterpillar is the hump moving down its back.
  for (let i = 4; i >= 0; i--) {
    const y = 0.92 - i * 0.46
    const ripple = Math.sin(t * Math.PI * 2 - i * 0.9) * 0.07
    const r = 0.52 + (i === 0 ? 0.06 : 0) + ripple
    // Spikes, in pairs, on every other bead. They are the WARNING: sharp
    // triangles in a cast made entirely of round shapes.
    if (i % 2 === 1) {
      for (const sgn of [-1, 1] as const) {
        for (const a of [-0.5, 0, 0.5]) {
          ctx.beginPath()
          ctx.moveTo(sgn * r * 0.6, y + a * 0.22)
          ctx.lineTo(sgn * (r + 0.46), y + a * 0.3)
          ctx.lineTo(sgn * r * 0.55, y + a * 0.22 + 0.16)
          ctx.closePath()
          paint(ctx, '#3b2a12', lw * 0.7)
        }
      }
    }
    blob(ctx, 0, y, r, r * 0.94, seed + i, 0.06, 12)
    paint(ctx, i === 0 ? s.accent : (i % 2 ? s.shade : s.body), lw * 1.3)
    sheen(ctx, 0, y, r, r * 0.94)
  }
  antenna(ctx, -0.16, -1.1, 0.4, -Math.PI * 0.66, -0.4, lw * 0.75, '#3b2a12')
  antenna(ctx, 0.16, -1.1, 0.4, -Math.PI * 0.34, 0.4, lw * 0.75, '#3b2a12')
  ctx.save()
  ctx.translate(0, -0.92)
  eye(ctx, -0.21, 0, 0.2, 0, -0.3, INK, true)
  eye(ctx, 0.21, 0, 0.2, 0, -0.3, INK, true)
  blush(ctx, 0.38, 0.24, 0.12)
  ctx.restore()
}

const drawStinkbug: Draw = (ctx, s, t) => {
  const seed = seedOf(s.id)
  const bob = Math.sin(t * Math.PI * 4) * 0.03
  const lw = 0.13
  for (let i = 0; i < 3; i++) {
    const y = -0.3 + i * 0.4
    const p = gait(t, i) * 0.8
    leg(ctx, -0.6, y, 0.66, Math.PI * 0.9, p, lw * 0.9)
    leg(ctx, 0.6, y, 0.66, Math.PI * 0.1, -p, lw * 0.9)
  }
  // The shield-bug pentagon. Blunt corners, so it still belongs to a rounded
  // cast, but the flat back edge is unmistakable next to the beetle's dome.
  ctx.beginPath()
  ctx.moveTo(0, -1.02 + bob)
  ctx.quadraticCurveTo(0.86, -0.7 + bob, 0.9, 0.1 + bob)
  ctx.quadraticCurveTo(0.72, 0.92 + bob, 0, 1.04 + bob)
  ctx.quadraticCurveTo(-0.72, 0.92 + bob, -0.9, 0.1 + bob)
  ctx.quadraticCurveTo(-0.86, -0.7 + bob, 0, -1.02 + bob)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, -1 + bob, 0, 1 + bob)
  g.addColorStop(0, s.body)
  g.addColorStop(1, s.shade)
  paint(ctx, g, lw * 1.5)
  sheen(ctx, 0, 0.06 + bob, 0.8, 0.9)

  // Two vent nubs at the back — where the haze comes out. The player should be
  // able to point at the part that is about to be a problem.
  for (const sgn of [-1, 1] as const) {
    ctx.beginPath()
    ctx.arc(sgn * 0.42, 0.86 + bob, 0.16, 0, Math.PI * 2)
    paint(ctx, s.accent, lw * 0.8)
  }

  const wig = Math.sin(t * Math.PI * 2) * 0.22
  antenna(ctx, -0.28, -0.92 + bob, 0.5, -Math.PI * 0.7 + wig, -0.4, lw * 0.75, s.accent)
  antenna(ctx, 0.28, -0.92 + bob, 0.5, -Math.PI * 0.3 - wig, 0.4, lw * 0.75, s.accent)

  ctx.save()
  ctx.translate(0, -0.56 + bob)
  eye(ctx, -0.3, 0, 0.2, 0, -0.3)
  eye(ctx, 0.3, 0, 0.2, 0, -0.3)
  blush(ctx, 0.5, 0.26, 0.13, 'rgba(190,140,255,0.45)')
  ctx.restore()
}

const drawPinatafly: Draw = (ctx, s, t) => {
  const seed = seedOf(s.id)
  const lw = 0.12
  // Wings beat at 4x the body cycle: a blur at speed, a shape when slow.
  const beat = Math.sin(t * Math.PI * 8)
  const wingY = 0.5 + beat * 0.22
  for (const sgn of [-1, 1] as const) {
    ctx.save()
    ctx.translate(sgn * 0.34, -0.12)
    ctx.rotate(sgn * (0.5 + beat * 0.45))
    ctx.beginPath()
    ctx.ellipse(sgn * 0.62, 0, 0.76, 0.4 * wingY, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fill()
    inked(ctx, lw * 0.7)
    ctx.stroke()
    ctx.restore()
  }

  blob(ctx, 0, 0.42, 0.58, 0.76, seed + 1, 0.06)
  const g = ctx.createLinearGradient(0, -0.3, 0, 1.1)
  g.addColorStop(0, s.accent)
  g.addColorStop(0.45, s.body)
  g.addColorStop(1, s.shade)
  paint(ctx, g, lw * 1.4)

  // Piñata stripes — the reason this one is worth chasing, said in the drawing.
  ctx.save()
  ctx.clip()
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = ['rgba(255,90,140,0.6)', 'rgba(90,220,255,0.55)',
      'rgba(140,255,150,0.55)', 'rgba(210,140,255,0.55)'][i]!
    ctx.fillRect(-0.8, -0.3 + i * 0.4, 1.6, 0.22)
  }
  ctx.restore()
  blob(ctx, 0, 0.42, 0.58, 0.76, seed + 1, 0.06)
  inked(ctx, lw * 1.4); ctx.stroke()

  blob(ctx, 0, -0.56, 0.5, 0.46, seed + 2, 0.05)
  paint(ctx, s.body, lw * 1.3)

  ctx.save()
  ctx.translate(0, -0.56)
  // Compound eyes: big, red, and wrapping the whole head — the one bug in the
  // cast whose eyes are the majority of its face.
  for (const sgn of [-1, 1] as const) {
    ctx.beginPath()
    ctx.ellipse(sgn * 0.27, -0.04, 0.28, 0.32, sgn * 0.2, 0, Math.PI * 2)
    paint(ctx, '#ff5d6c', lw * 1.1)
    ctx.beginPath()
    ctx.arc(sgn * 0.27 - 0.09, -0.14, 0.1, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fill()
  }
  ctx.restore()
}

const drawCentipede: Draw = (ctx, s, t) => {
  // Only the HEAD segment is baked here — the sim owns the tail and draws each
  // segment with `drawSegment` at its own trailing position, which is what lets
  // a stomp cut the body in two.
  const seed = seedOf(s.id)
  const lw = 0.13
  for (let i = 0; i < 2; i++) {
    const p = gait(t, i)
    leg(ctx, -0.5, -0.1 + i * 0.4, 0.6, Math.PI * 0.9, p, lw * 0.8)
    leg(ctx, 0.5, -0.1 + i * 0.4, 0.6, Math.PI * 0.1, -p, lw * 0.8)
  }
  blob(ctx, 0, 0, 0.74, 0.8, seed + 1, 0.05)
  const g = ctx.createRadialGradient(-0.2, -0.3, 0.05, 0, 0, 0.9)
  g.addColorStop(0, s.accent)
  g.addColorStop(0.4, s.body)
  g.addColorStop(1, s.shade)
  paint(ctx, g, lw * 1.5)

  // Mandibles. The head is the instant-kill target, so it is the piece that has
  // to look different from every other piece of the same creature.
  for (const sgn of [-1, 1] as const) {
    ctx.beginPath()
    ctx.moveTo(sgn * 0.3, -0.68)
    ctx.quadraticCurveTo(sgn * 0.78, -1.12, sgn * 0.24, -1.16)
    inked(ctx, lw * 1.2)
    ctx.stroke()
  }
  antenna(ctx, -0.2, -0.76, 0.52, -Math.PI * 0.7, -0.5, lw * 0.75, s.accent)
  antenna(ctx, 0.2, -0.76, 0.52, -Math.PI * 0.3, 0.5, lw * 0.75, s.accent)
  eye(ctx, -0.24, -0.24, 0.19, 0, -0.35, INK, true)
  eye(ctx, 0.24, -0.24, 0.19, 0, -0.35, INK, true)
}

const drawMoth: Draw = (ctx, s, t) => {
  const seed = seedOf(s.id)
  const lw = 0.12
  const beat = Math.sin(t * Math.PI * 4)
  // Wings: two big scalloped pairs with eyespots. Drawn behind the body.
  for (const sgn of [-1, 1] as const) {
    ctx.save()
    ctx.scale(1, 1)
    ctx.translate(sgn * 0.2, -0.1)
    ctx.rotate(sgn * (0.2 + beat * 0.22))
    ctx.beginPath()
    ctx.moveTo(0, -0.3)
    ctx.quadraticCurveTo(sgn * 1.5, -1.1, sgn * 1.5, -0.05)
    ctx.quadraticCurveTo(sgn * 1.45, 0.85, sgn * 0.5, 0.75)
    ctx.quadraticCurveTo(sgn * 0.12, 0.5, 0, -0.3)
    ctx.closePath()
    const g = ctx.createLinearGradient(0, -0.8, 0, 0.8)
    g.addColorStop(0, s.accent)
    g.addColorStop(1, s.body)
    paint(ctx, g, lw * 1.2)
    // The eyespot. A moth's whole personality.
    ctx.beginPath(); ctx.arc(sgn * 0.92, -0.12, 0.3, 0, Math.PI * 2)
    paint(ctx, s.shade, lw * 0.9)
    ctx.beginPath(); ctx.arc(sgn * 0.92, -0.12, 0.14, 0, Math.PI * 2)
    ctx.fillStyle = '#fff6d8'; ctx.fill()
    ctx.restore()
  }
  blob(ctx, 0, 0.18, 0.34, 0.74, seed + 1, 0.07)
  paint(ctx, s.shade, lw * 1.3)
  // A furry thorax: short strokes around the collar.
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.9 + (i / 8) * Math.PI * 1.8
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 0.3, -0.36 + Math.sin(a) * 0.24)
    ctx.lineTo(Math.cos(a) * 0.46, -0.36 + Math.sin(a) * 0.38)
    inked(ctx, lw * 0.6)
    ctx.stroke()
  }
  blob(ctx, 0, -0.6, 0.36, 0.32, seed + 2, 0.05)
  paint(ctx, s.body, lw * 1.2)
  const wig = beat * 0.3
  antenna(ctx, -0.16, -0.82, 0.5, -Math.PI * 0.72 + wig, -0.55, lw * 0.7, s.accent)
  antenna(ctx, 0.16, -0.82, 0.5, -Math.PI * 0.28 - wig, 0.55, lw * 0.7, s.accent)
  ctx.save()
  ctx.translate(0, -0.6)
  eye(ctx, -0.15, 0, 0.15, 0, -0.3)
  eye(ctx, 0.15, 0, 0.15, 0, -0.3)
  ctx.restore()
}

const drawRobobug: Draw = (ctx, s, t) => {
  const seed = seedOf(s.id)
  const lw = 0.13
  const blink = (Math.sin(t * Math.PI * 6) + 1) * 0.5
  for (let i = 0; i < 3; i++) {
    const y = -0.3 + i * 0.4
    const p = gait(t, i)
    leg(ctx, -0.6, y, 0.7, Math.PI * 0.9, p, lw)
    leg(ctx, 0.6, y, 0.7, Math.PI * 0.1, -p, lw)
  }
  // A hard-edged chassis: the only bug in the cast drawn with straight lines,
  // which is the whole of "this one is not alive".
  ctx.beginPath()
  ctx.moveTo(-0.52, -0.98)
  ctx.lineTo(0.52, -0.98)
  ctx.lineTo(0.9, -0.2)
  ctx.lineTo(0.68, 0.96)
  ctx.lineTo(-0.68, 0.96)
  ctx.lineTo(-0.9, -0.2)
  ctx.closePath()
  const g = ctx.createLinearGradient(0, -1, 0, 1)
  g.addColorStop(0, s.body)
  g.addColorStop(1, s.shade)
  paint(ctx, g, lw * 1.5)

  // The armour plate — pierce 2, and the plate is where the player can SEE it.
  ctx.beginPath()
  ctx.moveTo(-0.46, -0.6); ctx.lineTo(0.46, -0.6)
  ctx.lineTo(0.36, 0.34); ctx.lineTo(-0.36, 0.34)
  ctx.closePath()
  paint(ctx, '#8e9bb4', lw * 1.1)
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(-0.34, -0.36 + i * 0.26)
    ctx.lineTo(0.34, -0.36 + i * 0.26)
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'
    ctx.lineWidth = lw * 0.5
    ctx.stroke()
  }

  // One cyclops sensor with a pulsing glow — cheaper than eyes and reads as
  // "machine" from any distance.
  ctx.beginPath()
  ctx.arc(0, -0.72, 0.26, 0, Math.PI * 2)
  paint(ctx, '#1b2330', lw)
  ctx.beginPath()
  ctx.arc(0, -0.72, 0.15 + blink * 0.04, 0, Math.PI * 2)
  ctx.fillStyle = s.accent
  ctx.shadowColor = s.accent
  ctx.shadowBlur = 8 * (0.5 + blink * 0.5)
  ctx.fill()
  ctx.shadowBlur = 0

  antenna(ctx, -0.3, -0.96, 0.4, -Math.PI * 0.74, 0.2, lw * 0.7, s.accent)
  antenna(ctx, 0.3, -0.96, 0.4, -Math.PI * 0.26, -0.2, lw * 0.7, s.accent)
  void seed
}

const DRAWERS: Record<BugId, Draw> = {
  ant: drawAnt,
  beetle: drawBeetle,
  flea: drawFlea,
  caterpillar: drawCaterpillar,
  stinkbug: drawStinkbug,
  pinatafly: drawPinatafly,
  centipede: drawCentipede,
  moth: drawMoth,
  robobug: drawRobobug
}

/**
 * Draw one bug into `ctx`, centred on (0, 0), facing −y, at `r` px body radius.
 *
 * The direct path: used by the art bench, the boss (which is a bug at 5x) and
 * as the fallback whenever a bake has not happened yet.
 */
export const paintBug = (
  ctx: CanvasRenderingContext2D, id: BugId, r: number, cycle01: number
): void => {
  const s = bugSpec(id)
  ctx.save()
  ctx.scale(r, r)
  DRAWERS[id](ctx, s, ((cycle01 % 1) + 1) % 1)
  ctx.restore()
}

/**
 * One trailing centipede segment, drawn on its own.
 *
 * Its own function rather than a frame of the walk because the tail is not
 * animated on the head's clock — each segment follows the one in front of it
 * through the head's own path history, so its ANGLE is its animation.
 */
export const paintSegment = (
  ctx: CanvasRenderingContext2D, r: number, i: number, cycle01: number
): void => {
  const s = bugSpec('centipede')
  const seed = seedOf('centipede') + i
  ctx.save()
  ctx.scale(r, r)
  const lw = 0.13
  const p = Math.sin(cycle01 * Math.PI * 2 - i * 0.7)
  leg(ctx, -0.46, 0, 0.56, Math.PI * 0.9, p, lw * 0.8)
  leg(ctx, 0.46, 0, 0.56, Math.PI * 0.1, -p, lw * 0.8)
  blob(ctx, 0, 0, 0.66, 0.62, seed, 0.06, 12)
  const g = ctx.createRadialGradient(-0.18, -0.2, 0.04, 0, 0, 0.72)
  g.addColorStop(0, s.accent)
  g.addColorStop(0.45, s.body)
  g.addColorStop(1, s.shade)
  paint(ctx, g, lw * 1.4)
  ctx.restore()
}

/**
 * The cracks a damaged body wears, drawn OVER the bake.
 *
 * Not baked into variant frames because it is three strokes and baking it would
 * double the beetle's and the robo-bug's cache for a mark that is only on
 * screen for a second. `d01` is damage as a fraction of hp.
 */
export const paintDamage = (
  ctx: CanvasRenderingContext2D, r: number, d01: number
): void => {
  if (d01 <= 0) return
  ctx.save()
  ctx.scale(r, r)
  ctx.strokeStyle = 'rgba(30,16,32,0.8)'
  ctx.lineWidth = 0.09
  ctx.lineCap = 'round'
  const n = Math.min(3, 1 + Math.floor(d01 * 3))
  for (let i = 0; i < n; i++) {
    const a = -0.9 + i * 1.3
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * 0.15, Math.sin(a) * 0.15)
    ctx.lineTo(Math.cos(a) * 0.55 - 0.1, Math.sin(a) * 0.55)
    ctx.lineTo(Math.cos(a) * 0.86, Math.sin(a) * 0.8 + 0.08)
    ctx.stroke()
  }
  ctx.restore()
}

// ─── The bake ───────────────────────────────────────────────────────────────

interface Bake { frames: HTMLCanvasElement[]; px: number }

const bakes = new Map<BugId, Bake>()
/** Ids still waiting for frames, and how many of each are done. */
const queue: Array<{ id: BugId; next: number }> = []
let bakePx = 0

/** Quantise the required pixel size so a window resize of a few px does not
 *  invalidate 72 canvases. */
const bucket = (px: number): number => {
  const steps = [64, 96, 128, 160, 200, 256]
  for (const s of steps) if (px <= s) return s
  return 256
}

/**
 * Ask for the cast of the current level to be baked at the current scale.
 *
 * Idempotent, cheap to call every frame, and it does NOT do the work: it fills
 * the queue and `bakeSlice` drains it. That split is what keeps a level change
 * — which can introduce three new designs at once — off the frame that changed
 * the level.
 */
export const primeBugs = (ids: readonly BugId[], pxPerU: number): void => {
  // The biggest body in the cast decides the bake size for all of them, so one
  // frame box serves the whole set and the renderer never has to ask which.
  let maxSize = 0
  for (const id of ids) maxSize = Math.max(maxSize, bugSpec(id).size)
  if (maxSize <= 0) return
  const want = bucket(Math.ceil(maxSize * pxPerU * 2 / BUG_R_FRAC))
  if (want !== bakePx) {
    bakes.clear()
    queue.length = 0
    bakePx = want
  }
  for (const id of ids) {
    if (bakes.has(id) || queue.some((q) => q.id === id)) continue
    queue.push({ id, next: 0 })
    bakes.set(id, { frames: [], px: bakePx })
  }
}

/** Do up to `budget` frames of baking. Returns true when the queue is empty. */
export const bakeSlice = (budget = 6): boolean => {
  let done = 0
  while (queue.length > 0 && done < budget) {
    const job = queue[0]!
    const bake = bakes.get(job.id)
    if (!bake) { queue.shift(); continue }
    const c = document.createElement('canvas')
    c.width = bakePx
    c.height = bakePx
    const g = c.getContext('2d')
    if (g) {
      g.translate(bakePx / 2, bakePx / 2)
      paintBug(g, job.id, (bakePx / 2) * BUG_R_FRAC, job.next / BUG_FRAMES)
    }
    bake.frames.push(c)
    job.next++
    done++
    if (job.next >= BUG_FRAMES) queue.shift()
  }
  return queue.length === 0
}

/** 0..1 — how much of the queued bake is finished. Feeds the loading bar. */
export const bakeProgress01 = (): number => {
  if (bakes.size === 0) return 1
  let have = 0
  for (const b of bakes.values()) have += b.frames.length
  return Math.min(1, have / (bakes.size * BUG_FRAMES))
}

export const bugsReady = (ids: readonly BugId[]): boolean =>
  ids.every((id) => (bakes.get(id)?.frames.length ?? 0) >= BUG_FRAMES)

/**
 * The frame to blit for a bug at cycle position `cycle01`.
 *
 * PAINTED FIRST: a decoded strip panel wins over the bake, which is the whole
 * drop-in contract. Then the bake. Then null, which tells the renderer to fall
 * back to the direct drawing path for this frame.
 */
export const bugFrame = (
  id: BugId, cycle01: number
): HTMLCanvasElement | null => {
  const painted = stripFrame('bug', id, BUG_FRAME_ASPECT, cycle01)
  if (painted) return painted
  const bake = bakes.get(id)
  if (!bake || bake.frames.length === 0) return null
  const c01 = ((cycle01 % 1) + 1) % 1
  return bake.frames[Math.floor(c01 * bake.frames.length) % bake.frames.length] ?? null
}

/** The pixel edge of a baked/painted frame, so the renderer can scale it. */
export const bugFrameEdge = (id: BugId): number => {
  const painted = spriteFor('bug', id)
  if (painted && painted.naturalHeight > 0) return painted.naturalHeight
  return bakes.get(id)?.px ?? bakePx
}

/** Test seam: drop every bake. */
export const __resetBugBakes = (): void => {
  bakes.clear(); queue.length = 0; bakePx = 0
}

// ─── The bosses ─────────────────────────────────────────────────────────────

/**
 * A boss is its base creature at scale, re-dressed and crowned.
 *
 * Deliberately NOT a new drawing. A player who has spent nine levels learning
 * to read an ant at 20 px can read a Goliath Queen Ant instantly, and the
 * recognition IS the drama — "that is the thing I have been stomping, and it is
 * enormous". A fresh silhouette would throw that away.
 *
 * Never baked: there is one on screen at a time and it is drawn at a size no
 * cache would help with.
 */
export const paintBoss = (
  ctx: CanvasRenderingContext2D, id: BossId, r: number, cycle01: number, phase: number
): void => {
  const spec = BOSSES[id]
  const base = bugSpec(spec.base)
  // Swap the palette onto the base creature by drawing it through a clone of
  // its spec — the drawer reads colours off the spec it is handed.
  const dressed: BugSpec = { ...base, body: spec.body, shade: spec.shade, accent: spec.accent }
  ctx.save()
  ctx.scale(r, r)

  // A soft ground glow so a body this big does not look pasted onto the floor.
  const glow = ctx.createRadialGradient(0, 0, r * 0.02, 0, 0, 1.5)
  glow.addColorStop(0, 'rgba(0,0,0,0.28)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill()

  DRAWERS[spec.base](ctx, dressed, ((cycle01 % 1) + 1) % 1)

  // The crown. Five points, sat on the head, gaining a gem per phase so the
  // fight's progress is legible on the boss itself and not only on a bar.
  ctx.save()
  ctx.translate(0, -1.25)
  ctx.beginPath()
  ctx.moveTo(-0.5, 0.12)
  for (let i = 0; i <= 4; i++) {
    const x = -0.5 + (i / 4) * 1.0
    ctx.lineTo(x, i % 2 === 0 ? -0.34 : -0.02)
  }
  ctx.lineTo(0.5, 0.12)
  ctx.closePath()
  ctx.fillStyle = spec.crown
  ctx.fill()
  inked(ctx, 0.09)
  ctx.stroke()
  for (let i = 0; i <= phase && i < 3; i++) {
    ctx.beginPath()
    ctx.arc(-0.26 + i * 0.26, -0.04, 0.075, 0, Math.PI * 2)
    ctx.fillStyle = '#ff4f7a'
    ctx.fill()
  }
  ctx.restore()
  ctx.restore()
}

/** Every design the art bench must produce a walk strip for. */
export const BUG_DESIGNS: readonly BugId[] = BUGS.map((b) => b.id)
