/**
 * ─── Drawing the foot ───────────────────────────────────────────────────────
 *
 * The player IS this. Six shoes, seen from directly above, with an ankle and a
 * lower leg receding out of frame BEHIND the heel — the GDD's "only the bottom
 * of the shoe and the lower leg/ankle is visible".
 *
 * ── The two things the drawing has to say every frame ──
 *
 *   HOW HIGH IT IS.  There is no depth in a top-down view, so height is carried
 *                    entirely by the SHADOW: it is tight and dark under a shoe
 *                    at rest, wide and pale under one raised to slam. A player
 *                    reads the shadow, not the shoe — which is why the shadow
 *                    is drawn by a separate function that the renderer paints
 *                    UNDER every bug while the shoe goes over them.
 *   WHERE IT WILL LAND.  The stomp is a circle, so the ring on the floor is the
 *                    circle, exactly. Not an approximation of it and not a
 *                    stylised version of it: if the ring and the hitbox ever
 *                    disagree the game feels like it is cheating, and this is a
 *                    game for children.
 *
 * ── Height, formally ──
 *
 * `z` is 0..1. 0 is the sole flat on the floor; `shoe.hover` (~0.3) is resting;
 * 1 is a fully charged slam. The shoe is scaled by `1 + z * LIFT_SCALE` — a
 * thing closer to the camera is bigger — and the shadow grows the other way.
 */

import type { ShoeSpec, ShoeId } from '@/game/shoes'
import { spriteFor } from '@/game/art'

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

/** How much bigger the shoe gets at full lift. Perspective, cheaply. */
export const LIFT_SCALE = 0.42
/** How much wider the shadow gets at full lift. */
export const SHADOW_SPREAD = 0.85

/**
 * How big the shoe is drawn, as a fraction of its stomp radius.
 *
 * Under 1, and that is the whole readability of the game. The first build drew
 * the shoe at the full radius and it covered its own hit ring completely: the
 * player could see a shoe and could not see WHERE IT WOULD LAND, which is the
 * one thing the screen has to tell them. The shoe now sits inside its own ring
 * with a clear band of floor between them.
 */
export const SHOE_FRAC = 0.58

/**
 * The soft shadow under the foot — drawn UNDER every body, because that is what
 * a shadow is.
 *
 * `r` is the stomp radius in px — the real one, from the shoe's spec times the
 * fever scale. `z` is the foot's height: the shadow spreads and pales as the
 * foot rises, which is the only depth cue a top-down game has.
 */
export const paintFootShadow = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, z: number, tint = '0,0,0'
): void => {
  const rr = r * (1 + z * SHADOW_SPREAD)
  const alpha = (1 - z * 0.62) * 0.42
  ctx.save()
  const g = ctx.createRadialGradient(x, y, rr * 0.15, x, y, rr)
  g.addColorStop(0, `rgba(${tint},${alpha})`)
  g.addColorStop(0.7, `rgba(${tint},${alpha * 0.62})`)
  g.addColorStop(1, `rgba(${tint},0)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(x, y, rr, rr * 0.86, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * The stomp ring: the single most important mark on the screen.
 *
 * Drawn OVER the shoe and over every body, which is the opposite of what a
 * shadow does and is deliberate — it is not part of the world, it is the
 * game telling the player exactly what this press will hit. A ring the shoe can
 * cover is a ring that is missing at the exact moment it matters.
 *
 * `highVis` doubles its weight and makes it solid for the accessibility toggle
 * (GDD §10.2).
 */
export const paintStompRing = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, highVis: boolean, charge01: number, fever: boolean
): void => {
  ctx.save()
  // Always the TRUE radius. A ring that does not agree with the hitbox makes the
  // game feel like it is cheating, and this is a game for children.
  ctx.beginPath()
  ctx.ellipse(x, y, r, r * 0.86, 0, 0, Math.PI * 2)
  // A dark under-stroke first: a white ring alone disappears on the picnic
  // blanket's cream squares and on the arcade floor's glow.
  ctx.strokeStyle = 'rgba(20,10,26,0.55)'
  ctx.lineWidth = (highVis ? Math.max(3, r * 0.11) : Math.max(2, r * 0.06)) + 2
  ctx.stroke()
  ctx.strokeStyle = fever ? 'rgba(255,217,60,0.95)'
    : highVis ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)'
  ctx.lineWidth = highVis ? Math.max(3, r * 0.11) : Math.max(2, r * 0.06)
  ctx.setLineDash(highVis ? [] : [r * 0.3, r * 0.2])
  ctx.stroke()
  ctx.setLineDash([])

  // The charge ring — an arc that closes as a heavy slam winds up. Drawn OUTSIDE
  // the hit ring so it can never be mistaken for it, and it is the one piece of
  // UI that lives on the playfield rather than in the HUD: the player's eye is
  // on the foot and nowhere else while they are charging.
  if (charge01 > 0) {
    ctx.beginPath()
    ctx.ellipse(x, y, r * 1.26, r * 1.08, 0, -Math.PI / 2, -Math.PI / 2 + charge01 * Math.PI * 2)
    ctx.strokeStyle = charge01 >= 1 ? '#ffd93c' : 'rgba(255,217,60,0.85)'
    ctx.lineWidth = Math.max(3, r * 0.12)
    ctx.stroke()
    if (charge01 >= 1) {
      ctx.shadowColor = '#ffd93c'
      ctx.shadowBlur = r * 0.5
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  }
  ctx.restore()
}

// ─── The six shoes ──────────────────────────────────────────────────────────
//
// Each draws into a context translated to the ankle-ish centre and scaled so
// ONE UNIT IS THE SHOE'S HALF-LENGTH, toe pointing −y.

type ShoeDraw = (ctx: CanvasRenderingContext2D, s: ShoeSpec) => void

/**
 * `#rrggbb` → `rgba(r,g,b,a)`. Needed because the leg fades, and a fade needs a
 * colour with an alpha channel rather than a hex.
 */
const rgba = (hex: string, a: number): string => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/**
 * The leg. Shared by every shoe: a tapering shin running back out of the heel,
 * with a sock cuff where it meets the shoe.
 *
 * ── Why it DISSOLVES rather than ending ──
 *
 * A leg drawn to a hard edge is a plank: the eye reads the flat top as the end
 * of an object, and a tan rectangle standing on a picnic blanket is a cracker,
 * not a shin. Fading it out — fill AND outline, on the same gradient — reads as
 * the leg receding out of the shot, which is what a top-down camera actually
 * sees. It costs one gradient per frame and it is the difference between a limb
 * and a prop.
 */
const legAndCuff = (
  ctx: CanvasRenderingContext2D, cuff: string, skin: string, width = 0.5
): void => {
  const fadeAt = (colour: string): CanvasGradient => {
    const g = ctx.createLinearGradient(0, 2.95, 0, 0.75)
    g.addColorStop(0, rgba(colour, 0))
    g.addColorStop(0.45, rgba(colour, 0.6))
    g.addColorStop(1, rgba(colour, 1))
    return g
  }
  // Out of the HEEL, going away from the camera. The first pass ran it out of
  // the TOE, where the shoe body did not cover it, so two tapering ink lines
  // stuck out past the front of the shoe and the whole foot read as a small
  // insect with antennae — on a board covered in actual insects.
  ctx.beginPath()
  ctx.moveTo(-width * 0.84, 2.95)
  ctx.quadraticCurveTo(-width * 1.08, 1.2, -width * 0.98, 0.3)
  ctx.lineTo(width * 0.98, 0.3)
  ctx.quadraticCurveTo(width * 1.08, 1.2, width * 0.84, 2.95)
  ctx.closePath()
  ctx.fillStyle = fadeAt(skin)
  ctx.fill()
  ctx.strokeStyle = fadeAt(INK)
  ctx.lineWidth = 0.1
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()

  // The sock cuff, where the leg meets the shoe. Opaque, because it is the
  // JOIN: a join that fades reads as a gap between two objects.
  ctx.beginPath()
  ctx.moveTo(-width * 1.06, 0.6)
  ctx.quadraticCurveTo(0, 0.44, width * 1.06, 0.6)
  ctx.lineTo(width * 0.99, 1.24)
  ctx.quadraticCurveTo(0, 1.42, -width * 0.99, 1.24)
  ctx.closePath()
  paint(ctx, cuff, 0.1)
}

/** The generic shoe body: a rounded capsule, wider at the toe. Every shoe
 *  starts from this and then dresses it. */
const shoeBody = (
  ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, w = 0.72
): void => {
  ctx.beginPath()
  ctx.moveTo(0, -1.0)
  ctx.quadraticCurveTo(w * 1.28, -0.88, w * 1.14, -0.12)
  ctx.quadraticCurveTo(w * 1.0, 0.72, 0, 0.86)
  ctx.quadraticCurveTo(-w * 1.0, 0.72, -w * 1.14, -0.12)
  ctx.quadraticCurveTo(-w * 1.28, -0.88, 0, -1.0)
  ctx.closePath()
  paint(ctx, fill, 0.11)
}

const topLight = (ctx: CanvasRenderingContext2D): void => {
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(-0.22, -0.4, 0.42, 0.56, -0.3, 0, Math.PI * 2)
  const g = ctx.createRadialGradient(-0.22, -0.4, 0.02, -0.22, -0.4, 0.6)
  g.addColorStop(0, 'rgba(255,255,255,0.42)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fill()
  ctx.restore()
}

/**
 * The tongue: a long rounded panel down the middle of the shoe, from the toe to
 * the collar. It is what turns a white capsule into a trainer seen from above —
 * without it the laces are four lines floating on a pebble.
 */
const tongue = (ctx: CanvasRenderingContext2D, fill: string, top = -0.62, bot = 0.46): void => {
  ctx.beginPath()
  ctx.moveTo(0, top)
  ctx.quadraticCurveTo(0.3, top + 0.06, 0.28, (top + bot) / 2)
  ctx.quadraticCurveTo(0.26, bot, 0, bot)
  ctx.quadraticCurveTo(-0.26, bot, -0.28, (top + bot) / 2)
  ctx.quadraticCurveTo(-0.3, top + 0.06, 0, top)
  ctx.closePath()
  paint(ctx, fill, 0.08)
}

/** The heel collar: the padded ring the ankle comes out of. */
const collar = (ctx: CanvasRenderingContext2D, fill: string, y = 0.44): void => {
  ctx.beginPath()
  ctx.ellipse(0, y, 0.46, 0.3, 0, 0, Math.PI * 2)
  paint(ctx, fill, 0.09)
}

const drawSneaker: ShoeDraw = (ctx, s) => {
  legAndCuff(ctx, s.accent, '#f0c49a')
  const g = ctx.createLinearGradient(0, -1, 0, 0.9)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.55, s.body)
  g.addColorStop(1, s.shade)
  shoeBody(ctx, g)
  // The toe cap: a band across the front, which is where a canvas trainer's
  // rubber actually is and the mark that says which way the shoe points.
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(0, -0.62, 0.62, 0.34, 0, 0, Math.PI * 2)
  paint(ctx, '#ffffff', 0.09)
  ctx.restore()
  // One swoosh, low on ONE side only. Two would read as a pattern rather than a
  // brand mark, and crossing the laces (which the first pass did) read as a
  // cancel sign.
  ctx.beginPath()
  ctx.moveTo(-0.7, 0.42)
  ctx.quadraticCurveTo(-0.55, 0.12, -0.2, -0.04)
  ctx.strokeStyle = s.accent
  ctx.lineWidth = 0.14
  ctx.lineCap = 'round'
  ctx.stroke()
  tongue(ctx, '#eef1f8')
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(-0.24, -0.4 + i * 0.22)
    ctx.lineTo(0.24, -0.4 + i * 0.22)
    inked(ctx, 0.075)
    ctx.stroke()
  }
  collar(ctx, s.accent, 0.56)
  topLight(ctx)
}

const drawSteelBoot: ShoeDraw = (ctx, s) => {
  legAndCuff(ctx, s.shade, '#f0c49a', 0.58)
  const g = ctx.createLinearGradient(0, -1, 0, 0.9)
  g.addColorStop(0, '#e8b467')
  g.addColorStop(0.5, s.body)
  g.addColorStop(1, s.shade)
  shoeBody(ctx, g, 0.82)
  // The steel toe cap — the whole identity of this shoe, and the reason a
  // caterpillar is not a problem.
  ctx.beginPath()
  ctx.moveTo(0, -1.02)
  ctx.quadraticCurveTo(0.92, -0.9, 0.86, -0.42)
  ctx.quadraticCurveTo(0, -0.26, -0.86, -0.42)
  ctx.quadraticCurveTo(-0.92, -0.9, 0, -1.02)
  ctx.closePath()
  const steel = ctx.createLinearGradient(0, -1, 0, -0.3)
  steel.addColorStop(0, '#f4f7ff')
  steel.addColorStop(1, '#8e9bb4')
  paint(ctx, steel, 0.11)
  // Laces as rungs across a tongue.
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(-0.4, -0.14 + i * 0.2)
    ctx.lineTo(0.4, -0.14 + i * 0.2)
    inked(ctx, 0.09)
    ctx.stroke()
  }
  topLight(ctx)
}

const drawBunnySlipper: ShoeDraw = (ctx, s) => {
  // A pink cuff, not a white one: the tail pompom at the heel is white and sits
  // right on top of it, and white on white is one shape.
  legAndCuff(ctx, '#ffc2dd', '#f0c49a', 0.46)
  const g = ctx.createLinearGradient(0, -1, 0, 0.9)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.5, s.body)
  g.addColorStop(1, s.shade)
  shoeBody(ctx, g, 0.78)
  // Ears, laid back along the shoe so the silhouette from above is unmistakable.
  for (const sgn of [-1, 1] as const) {
    ctx.beginPath()
    ctx.ellipse(sgn * 0.42, -0.74, 0.19, 0.46, sgn * 0.32, 0, Math.PI * 2)
    paint(ctx, s.body, 0.1)
    ctx.beginPath()
    ctx.ellipse(sgn * 0.42, -0.74, 0.1, 0.3, sgn * 0.32, 0, Math.PI * 2)
    ctx.fillStyle = '#ff9dc4'
    ctx.fill()
  }
  // A face. It is a slipper; it is allowed.
  ctx.beginPath(); ctx.arc(-0.2, -0.18, 0.1, 0, Math.PI * 2)
  ctx.fillStyle = INK; ctx.fill()
  ctx.beginPath(); ctx.arc(0.2, -0.18, 0.1, 0, Math.PI * 2)
  ctx.fillStyle = INK; ctx.fill()
  ctx.beginPath(); ctx.ellipse(0, 0.02, 0.11, 0.08, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#ff5d8f'; ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-0.22, 0.24); ctx.quadraticCurveTo(0, 0.12, 0.22, 0.24)
  inked(ctx, 0.07); ctx.stroke()
  // The tail — a pompom at the heel.
  ctx.beginPath(); ctx.arc(0, 0.78, 0.2, 0, Math.PI * 2)
  paint(ctx, '#ffffff', 0.09)
  topLight(ctx)
}

const drawRollerSkate: ShoeDraw = (ctx, s) => {
  legAndCuff(ctx, s.accent, '#f0c49a', 0.5)
  const g = ctx.createLinearGradient(0, -1, 0, 0.9)
  g.addColorStop(0, '#ff9ac6')
  g.addColorStop(0.5, s.body)
  g.addColorStop(1, s.shade)
  shoeBody(ctx, g, 0.7)
  // A chassis plate with four wheels poking out either side — from above, the
  // wheels ARE the skate.
  ctx.beginPath()
  ctx.roundRect(-0.34, -0.72, 0.68, 1.44, 0.14)
  paint(ctx, s.sole, 0.09)
  for (const sgn of [-1, 1] as const) {
    for (const y of [-0.5, 0.42]) {
      ctx.beginPath()
      ctx.ellipse(sgn * 0.58, y, 0.2, 0.28, 0, 0, Math.PI * 2)
      paint(ctx, s.accent, 0.09)
      ctx.beginPath()
      ctx.arc(sgn * 0.58, y, 0.07, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'; ctx.fill()
    }
  }
  // A star on the toe, because this shoe is the showy one.
  ctx.save()
  ctx.translate(0, -0.8)
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
    const rr = i % 2 === 0 ? 0.2 : 0.09
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
  paint(ctx, '#ffe45e', 0.07)
  ctx.restore()
  topLight(ctx)
}

const drawCleatBoot: ShoeDraw = (ctx, s) => {
  legAndCuff(ctx, s.shade, '#f0c49a', 0.5)
  const g = ctx.createLinearGradient(0, -1, 0, 0.9)
  g.addColorStop(0, '#63f0d4')
  g.addColorStop(0.5, s.body)
  g.addColorStop(1, s.shade)
  shoeBody(ctx, g, 0.68)
  // The studs. Six of them, arranged the way a football boot's are, and they
  // are the drawing's whole promise: this thing makes holes.
  const studs: Array<[number, number]> = [
    [0, -0.82], [-0.34, -0.5], [0.34, -0.5],
    [-0.36, 0.2], [0.36, 0.2], [0, 0.62]
  ]
  for (const [sx, sy] of studs) {
    ctx.beginPath()
    ctx.arc(sx, sy, 0.15, 0, Math.PI * 2)
    paint(ctx, '#e9f7ff', 0.08)
    ctx.beginPath()
    ctx.arc(sx, sy, 0.06, 0, Math.PI * 2)
    ctx.fillStyle = s.shade; ctx.fill()
  }
  topLight(ctx)
}

const drawElectricSock: ShoeDraw = (ctx, s) => {
  legAndCuff(ctx, '#c8f3ff', '#f0c49a', 0.52)
  const g = ctx.createLinearGradient(0, -1, 0, 0.9)
  g.addColorStop(0, '#9fb4ff')
  g.addColorStop(0.5, s.body)
  g.addColorStop(1, s.shade)
  shoeBody(ctx, g, 0.7)
  // Hooped stripes, then a bolt across them. A sock is a soft shape; the bolt
  // is what says it hits back.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(0, -1.0)
  ctx.quadraticCurveTo(0.9, -0.88, 0.8, -0.12)
  ctx.quadraticCurveTo(0.7, 0.72, 0, 0.86)
  ctx.quadraticCurveTo(-0.7, 0.72, -0.8, -0.12)
  ctx.quadraticCurveTo(-0.9, -0.88, 0, -1.0)
  ctx.closePath()
  ctx.clip()
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillRect(-1, -0.6 + i * 0.42, 2, 0.16)
  }
  ctx.restore()
  ctx.beginPath()
  ctx.moveTo(0.16, -0.62); ctx.lineTo(-0.2, -0.04)
  ctx.lineTo(0.04, -0.02); ctx.lineTo(-0.16, 0.6)
  ctx.lineTo(0.26, -0.06); ctx.lineTo(0.0, -0.08)
  ctx.closePath()
  paint(ctx, '#ffe45e', 0.08)
  topLight(ctx)
}

const SHOE_DRAW: Record<ShoeId, ShoeDraw> = {
  sneaker: drawSneaker,
  steelBoot: drawSteelBoot,
  bunnySlipper: drawBunnySlipper,
  rollerSkate: drawRollerSkate,
  cleatBoot: drawCleatBoot,
  electricSock: drawElectricSock
}

/**
 * The shoe, drawn at (0,0) with `half` px as its half-length, toe at −y.
 *
 * `squash` is the impact deform: 1 is at rest, and the sim drives it towards
 * ~0.68 for a few frames on landing. It squashes along the travel axis and
 * bulges across it, which is the oldest trick in animation and still the single
 * cheapest thing that makes an impact feel like one.
 */
export const paintShoe = (
  ctx: CanvasRenderingContext2D,
  id: ShoeId, spec: ShoeSpec, half: number, squash = 1, fever = false
): void => {
  ctx.save()
  ctx.scale(half * (2 - squash), half * squash)
  if (fever) {
    // The Gilded Boot of Destruction. Not a different drawing — the same shoe,
    // gold, glowing, and half again as big. Keeping the silhouette is what makes
    // the transformation read as "your shoe got huge" rather than "something
    // else appeared".
    ctx.shadowColor = 'rgba(255,205,0,0.85)'
    ctx.shadowBlur = 22
    const gold: ShoeSpec = {
      ...spec, body: '#ffd24a', shade: '#b97f0c', accent: '#fff3c0', sole: '#8a5c00'
    }
    SHOE_DRAW[id](ctx, gold)
    ctx.shadowBlur = 0
  } else {
    SHOE_DRAW[id](ctx, spec)
  }
  ctx.restore()
}

/**
 * The painted shoe, when the pipeline has produced one.
 *
 * A still rather than a strip: the shoe has no gait — the sim moves it, squashes
 * it and rotates it — so one painting per shoe is the whole file.
 */
export const shoeSprite = (id: ShoeId): HTMLImageElement | null => spriteFor('shoe', id)

/** The frame box a painted shoe is authored in.
 *  The leg needs room behind the heel that the shoe body does not, so the box is
 *  portrait. Mirrors `artBoxes.SHOE_BOX`, which the Node-side manifest reads. */
export const SHOE_BOX = { w: 2.2, h: 4.4, toeFromTop: 0.26 } as const
