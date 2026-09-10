import {
  HERO_FOOT_R, HERO_HEIGHT_R, outfitIndex, outfitTone, primeSurvivors, survivorFrame
} from '@/game/heroSprites'
import { blitBanner } from '@/game/uiArt'
import { paintLaneTile, paintRidge } from '@/use/useSurvivalArt'

/**
 * ─── The share card ─────────────────────────────────────────────────────────
 *
 * One 1080×1080 picture of a run that beat every run before it: the road, the
 * squad that got there, the stage number, and the mark. It is drawn by the
 * SAME functions the game draws with — `survivorFrame` hands back the exact
 * baked run-cycle frames the battlefield blits, `paintRidge` the exact ridge
 * bands (painted ones when the art layer is on, the seeded jagged fallback
 * when it is not), `paintLaneTile` the exact gravel, `blitBanner` the exact
 * plate the result screen wears. There is no second cast and no second road.
 *
 * ─── Why the card does NOT use the stage's sky ──────────────────────────────
 *
 * The renderer tints its sky per stage so a long session visibly travels
 * somewhere; the card deliberately does not. A promo card is seen at thumbnail
 * size in a feed, next to other thumbnails, and its whole job is to be
 * recognisable as ONE game — a card that is teal on stage 3 and orange on
 * stage 4 is two different games to the eye that is scrolling past. So the
 * card commits to one dusk palette forever, which is also what makes it usable
 * as store-listing art. (The stage palette is not exported from the renderer
 * either, and this is not a good enough reason to export it.)
 *
 * ─── Composed for a thumbnail, not for a wall ───────────────────────────────
 *
 * At 120 px across, four things survive and nothing else does: the silhouette
 * of a crowd, one enormous number, one gold line, and the mark. Everything on
 * this card is one of those four. That is why the stage number is 250 px tall
 * on a 1080 px card, why the crowd gets a warm backlight behind it (a dark
 * silhouette on a dark road is a smudge once it is downscaled), and why the
 * captions are pills rather than prose.
 *
 * ─── Deterministic ──────────────────────────────────────────────────────────
 *
 * No `Math.random`, no `Date.now`. The same run renders the same card every
 * time it is asked for, so a player who shares twice shares the same picture
 * and a store listing regenerated next month is the listing that was approved.
 */

/** The card's edge, px. Square because every share target crops to square or
 *  near it, and 1080 because that is the largest size all of them keep. */
export const SHARE_CARD_PX = 1080

/**
 * The card's fixed dusk palette.
 *
 * The road and rail tones match the renderer's `LANE_TONE` because it is the
 * same road; the sky and ridge tones are the card's own (see the header). Held
 * as one block so the card can be re-graded in one place.
 */
const CARD = {
  skyTop: '#120f26',
  skyMid: '#33224a',
  skyLow: '#6d3c52',
  haze: '#e09154',
  ridgeFar: '#1a1130',
  ridgeNear: '#241734',
  road: '#32333d',
  rail: '#585c69',
  railLit: '#8d93a3',
  railDark: '#1d1e24',
  rung: 'rgba(255,255,255,0.10)',
  gold: '#ffd93c',
  cool: '#8fd6ff',
  dim: '#b9cbe8',
  ink: '#08070e'
} as const

/** The horizon, as a fraction of the card. The lane below it is 45 % of the
 *  picture — enough road for a crowd to stand on and still leave the top half
 *  for the number, which is the element that has to survive the downscale. */
const HORIZON = 0.545
/** The lane's width, as a fraction of the card. */
const LANE_W = 0.62
/** Where the crowd's feet stand. The renderer keeps the crowd at 72 % down a
 *  tall viewport; on a square card that reads as floating, so it sits lower. */
const CROWD_Y = 0.775

/**
 * How many survivors the card is willing to draw.
 *
 * A peak squad of 200 cannot be drawn as 200 readable bodies in 560 px, and
 * trying produces a grey texture rather than a crowd. Forty-eight is where the
 * silhouette stops gaining information: past it the extra bodies are entirely
 * behind the ones in front. The NUMBER is what says two hundred; the drawing
 * only has to say "a lot of them".
 */
const CROWD_MAX = 48

export interface ShareCardSpec {
  /** The stage the run reached — the card's headline, drawn as a numeral. */
  stage: number
  /** The run's biggest squad. */
  peakSquad: number
  /** The game's mark, on the plate at the foot of the card (`gameName`). */
  title: string
  /** Why this card exists at all (`result.newRecord`). */
  recordLabel: string
  /** The word over the numeral (`leaderboard.stage`). */
  stageWord: string
  /** The word in the squad pill (`leaderboard.squad`). */
  squadWord: string
  /** The player's placing, e.g. `#1130` — empty when the board had nothing to
   *  say, in which case the whole rank line is dropped rather than faked. */
  rankValue: string
  /** The population that placing is out of, e.g. `of 2345`. Empty until the
   *  board's total has landed; the placing still prints without it. */
  rankOf: string
}

// ─── Small geometry the renderer keeps to itself ────────────────────────────

const roundRect = (
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
): void => {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/**
 * The game's display face, at `px`.
 *
 * Same stack the renderer's own labels use, so the card is set in the game's
 * voice. `sans-serif` behind it is load-bearing rather than politeness: the
 * face carries no CJK or Arabic, and the card's captions are translated — the
 * browser falls back per glyph, so a Japanese "ステージ" sets in the system face
 * beside a numeral that is still the game's.
 */
const face = (ctx: CanvasRenderingContext2D, px: number): void => {
  ctx.font = `900 ${px}px Angry, sans-serif`
}

/**
 * Text with a heavy ink outline under it.
 *
 * Every string on this card sits over a picture, and a picture is exactly the
 * background a drop shadow cannot save type from. The outline is `lineJoin:
 * round` with a low miter limit because the face has sharp corners that spike
 * into hairs at this stroke width otherwise.
 */
const stroked = (
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number,
  fill: string, weight = 0.14
): void => {
  if (!text) return
  face(ctx, px)
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = px * weight
  ctx.strokeStyle = CARD.ink
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

/**
 * A caption pill: a word and a number on one dark plate.
 *
 * The same construction as the result screen's stat chips, and for the same
 * reason — the word and the value are two separate runs laid out beside each
 * other, never one concatenated string, so no locale has to accept English
 * word order to get a readable card.
 */
const pill = (
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  label: string, value: string, px: number, valueColour: string, tint: string
): void => {
  face(ctx, px * 0.62)
  const lw = label ? ctx.measureText(label).width : 0
  face(ctx, px)
  const vw = ctx.measureText(value).width
  const gap = label ? px * 0.36 : 0
  const padX = px * 0.62
  const h = px * 1.62
  const w = lw + gap + vw + padX * 2

  ctx.save()
  ctx.fillStyle = 'rgba(10,16,30,0.78)'
  ctx.strokeStyle = tint
  ctx.lineWidth = px * 0.07
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2)
  ctx.fill()
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const left = cx - w / 2 + padX
  if (label) {
    face(ctx, px * 0.62)
    ctx.fillStyle = CARD.dim
    ctx.fillText(label.toUpperCase(), left, cy + px * 0.03)
  }
  stroked(ctx, value, left + lw + gap, cy + px * 0.03, px, valueColour, 0.1)
  ctx.restore()
}

// ─── Layers ─────────────────────────────────────────────────────────────────

const paintSky = (ctx: CanvasRenderingContext2D, px: number): void => {
  const horizon = px * HORIZON
  const g = ctx.createLinearGradient(0, 0, 0, horizon + px * 0.09)
  g.addColorStop(0, CARD.skyTop)
  g.addColorStop(0.58, CARD.skyMid)
  g.addColorStop(1, CARD.skyLow)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, px, horizon + px * 0.09)

  // The low sun. One element, and it is what turns a gradient into a place —
  // the renderer's backdrop opens with the same trick.
  const sun = ctx.createRadialGradient(px * 0.5, horizon, 0, px * 0.5, horizon, px * 0.6)
  sun.addColorStop(0, `${CARD.haze}cc`)
  sun.addColorStop(0.42, `${CARD.haze}33`)
  sun.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, px, horizon + px * 0.09)

  // The two parallax bands, through the renderer's own painter: the painted
  // silhouettes where the art layer is on, the seeded jagged fallback where it
  // is not. Both fill down to the bottom of the card, which the lane then
  // covers — exactly the order the game draws them in.
  paintRidge(ctx, 'ridge-far', px, px, horizon - px * 0.03, px * 0.055, CARD.ridgeFar, 1.7)
  paintRidge(ctx, 'ridge-near', px, px, horizon, px * 0.035, CARD.ridgeNear, 4.2)
}

/**
 * The road, from the horizon to the bottom edge.
 *
 * Flat, not perspective, because the game's camera is flat: the lane is a
 * vertical band with rails down both sides and rungs across it, and a card that
 * put the road in one-point perspective would be a picture of a different game.
 */
const paintLane = (ctx: CanvasRenderingContext2D, px: number): void => {
  const horizon = px * HORIZON
  const laneW = px * LANE_W
  const left = (px - laneW) / 2
  const right = left + laneW

  // Off-lane ground, darkened so the playable strip is the only lit thing —
  // the same read the renderer builds with its `laneOff` ramp.
  const off = ctx.createLinearGradient(0, horizon, 0, px)
  off.addColorStop(0, 'rgba(8,8,14,0.35)')
  off.addColorStop(1, 'rgba(6,6,10,0.82)')
  ctx.fillStyle = off
  ctx.fillRect(0, horizon, left, px - horizon)
  ctx.fillRect(right, horizon, px - right, px - horizon)

  ctx.save()
  ctx.beginPath()
  ctx.rect(left, horizon, laneW, px - horizon)
  ctx.clip()

  ctx.fillStyle = CARD.road
  ctx.fillRect(left, horizon, laneW, px - horizon)

  // The gravel, baked by the renderer's own tile painter and repeated. A tile
  // this size (≈ the game's at a tablet zoom) keeps the stones at the scale a
  // player recognises instead of turning them into noise.
  const tilePx = Math.round(px * 0.2)
  const tile = document.createElement('canvas')
  tile.width = tilePx
  tile.height = tilePx
  const tctx = tile.getContext('2d')
  if (tctx) {
    paintLaneTile(tctx, tilePx)
    const pattern = ctx.createPattern(tile, 'repeat')
    if (pattern) {
      ctx.fillStyle = pattern
      ctx.fillRect(left, horizon, laneW, px - horizon)
    }
  }

  // The far end fades into the haze, so the road goes somewhere.
  const fade = ctx.createLinearGradient(0, horizon, 0, horizon + px * 0.26)
  fade.addColorStop(0, 'rgba(0,0,0,0.5)')
  fade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = fade
  ctx.fillRect(left, horizon, laneW, px * 0.26)

  // Rungs. In the game they are the entire sensation of speed; on a still card
  // they are what stops the road reading as a grey rectangle.
  ctx.strokeStyle = CARD.rung
  ctx.lineWidth = px * 0.004
  ctx.beginPath()
  for (let y = horizon + px * 0.06; y < px; y += px * 0.075) {
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
  }
  ctx.stroke()

  // Centre dashes.
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = px * 0.007
  ctx.setLineDash([px * 0.035, px * 0.035])
  ctx.beginPath()
  ctx.moveTo(px * 0.5, horizon)
  ctx.lineTo(px * 0.5, px)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // The rails: the player's only absolute reference for where the edges are,
  // and at thumbnail size the two lines that frame the crowd.
  const railW = px * 0.018
  for (const x of [left, right]) {
    const r = ctx.createLinearGradient(x - railW / 2, 0, x + railW / 2, 0)
    r.addColorStop(0, CARD.railDark)
    r.addColorStop(0.5, CARD.railLit)
    r.addColorStop(1, CARD.rail)
    ctx.fillStyle = r
    ctx.fillRect(x - railW / 2, horizon, railW, px - horizon)
  }
  ctx.fillStyle = 'rgba(20,22,30,0.85)'
  for (let y = horizon + px * 0.09; y < px; y += px * 0.15) {
    for (const x of [left, right]) {
      ctx.fillRect(x - px * 0.016, y - px * 0.028, px * 0.032, px * 0.056)
    }
  }
}

/** Golden angle — the packing that spreads N points over a disc with no rows,
 *  no rings and no gaps, which is what a crowd standing on a road looks like. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/**
 * The squad, on the road.
 *
 * Bodies are the baked run-cycle frames — the same strips the battlefield
 * blits, at the same foot line and height contract (`HERO_FOOT_R`,
 * `HERO_HEIGHT_R`), so a survivor on the card is pixel-for-pixel a survivor in
 * the game. The stride phase varies per body, because a crowd caught mid-stride
 * in lockstep reads as a sprite sheet rather than as people.
 *
 * Drawn far-to-near so the near bodies overlap the far ones. That overlap IS
 * the crowd: a grid of non-touching figures reads as a formation of toys.
 */
const paintCrowd = (ctx: CanvasRenderingContext2D, px: number, peakSquad: number): void => {
  const n = Math.max(3, Math.min(CROWD_MAX, Math.round(peakSquad) || 3))
  const fill = n / CROWD_MAX
  const cx = px * 0.5
  const cy = px * CROWD_Y
  // The disc widens and the bodies shrink as the squad grows, so a squad of
  // 200 is visibly a bigger mass than a squad of 12 rather than the same
  // twelve bodies at a different size.
  const rx = px * LANE_W * (0.30 + 0.15 * fill)
  const ry = px * (0.055 + 0.055 * fill)
  const charH = px * (0.128 - 0.042 * fill)

  // A warm backlight under the mass. Without it the dark silhouettes sit on a
  // dark road and the whole middle of the card turns to mud at thumbnail size —
  // which is the size that matters.
  const glow = ctx.createRadialGradient(cx, cy - ry * 0.4, 0, cx, cy - ry * 0.4, rx * 1.5)
  glow.addColorStop(0, 'rgba(224,145,84,0.34)')
  glow.addColorStop(1, 'rgba(224,145,84,0)')
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = glow
  ctx.fillRect(cx - rx * 1.6, cy - ry - rx * 1.1, rx * 3.2, rx * 2.2)
  ctx.restore()

  const bodies: { x: number; y: number; i: number }[] = []
  for (let i = 0; i < n; i++) {
    // Phyllotaxis, jittered by the same deterministic hash that picks the
    // stride phase — an untouched spiral has a visible swirl to it.
    const a = i * GOLDEN
    const r = Math.sqrt((i + 0.5) / n)
    const j = ((Math.imul(i + 1, 2654435761) >>> 0) / 4294967296)
    bodies.push({
      x: cx + Math.cos(a) * r * rx * (0.9 + j * 0.2),
      y: cy + Math.sin(a) * r * ry,
      i
    })
  }
  bodies.sort((a, b) => a.y - b.y)

  for (const b of bodies) {
    // Nearer is bigger. A flat crowd on a flat road has no depth at all, and
    // 30 % is as far as it can go before the front row looks like a different
    // species from the back one.
    const depth = ry === 0 ? 0.5 : (b.y - (cy - ry)) / (2 * ry)
    const k = 0.85 + 0.3 * Math.max(0, Math.min(1, depth))
    const h = charH * k
    const phase = ((Math.imul(b.i + 7, 40503) >>> 0) % 1000) / 1000

    ctx.save()
    ctx.translate(b.x, b.y)

    // The contact shadow. The renderer draws one under every unit, and without
    // it a body on a card floats a few pixels above the road.
    ctx.fillStyle = 'rgba(6,6,10,0.45)'
    ctx.beginPath()
    ctx.ellipse(0, 0, h * 0.2, h * 0.07, 0, 0, Math.PI * 2)
    ctx.fill()

    const frame = survivorFrame(outfitIndex(b.i), phase)
    if (frame) {
      const boxH = h / HERO_HEIGHT_R
      const dw = boxH * (frame.width / frame.height)
      ctx.drawImage(frame, -dw / 2, -boxH * HERO_FOOT_R, dw, boxH)
    } else {
      // The strips are baked before the loading screen ever leaves, so this is
      // unreachable in a real session — but it is the renderer's own fallback,
      // in the unit's own outfit colour, and a card is not worth throwing over.
      const tone = outfitTone(b.i)
      ctx.fillStyle = tone.base
      roundRect(ctx, -h * 0.19, -h * 0.98, h * 0.38, h * 0.98, h * 0.16)
      ctx.fill()
      ctx.strokeStyle = 'rgba(20,16,22,0.8)'
      ctx.lineWidth = h * 0.05
      ctx.stroke()
    }
    ctx.restore()
  }
}

/** The scrims that buy the type its contrast back, top and bottom. */
const paintScrims = (ctx: CanvasRenderingContext2D, px: number): void => {
  const top = ctx.createLinearGradient(0, 0, 0, px * 0.52)
  top.addColorStop(0, 'rgba(8,7,14,0.86)')
  top.addColorStop(0.55, 'rgba(8,7,14,0.42)')
  top.addColorStop(1, 'rgba(8,7,14,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, px, px * 0.52)

  const bottom = ctx.createLinearGradient(0, px * 0.7, 0, px)
  bottom.addColorStop(0, 'rgba(8,7,14,0)')
  bottom.addColorStop(1, 'rgba(8,7,14,0.88)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, px * 0.7, px, px * 0.3)

  // A vignette, so nothing on the card competes with the middle of it.
  const v = ctx.createRadialGradient(px * 0.5, px * 0.5, px * 0.34, px * 0.5, px * 0.5, px * 0.78)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, px, px)
}

const paintType = (ctx: CanvasRenderingContext2D, px: number, spec: ShareCardSpec): void => {
  const cx = px * 0.5
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  stroked(ctx, spec.recordLabel.toUpperCase(), cx, px * 0.108, px * 0.048, CARD.gold)
  stroked(ctx, spec.stageWord.toUpperCase(), cx, px * 0.19, px * 0.05, CARD.dim)
  // The one element the whole card is built around. Everything else on it can
  // be lost to a downscale; this cannot.
  stroked(ctx, String(spec.stage), cx, px * 0.405, px * 0.235, '#ffffff', 0.1)

  ctx.textAlign = 'center'
  pill(ctx, cx, px * 0.475, spec.squadWord, String(spec.peakSquad), px * 0.045,
    CARD.cool, 'rgba(143,214,255,0.45)')

  // The placing, only when the board actually had one. An invented rank on a
  // picture that leaves the game is worse than no rank at all.
  if (spec.rankValue) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    face(ctx, px * 0.05)
    const rankW = ctx.measureText(spec.rankValue).width
    face(ctx, px * 0.032)
    const ofW = spec.rankOf ? ctx.measureText(spec.rankOf).width : 0
    const gap = spec.rankOf ? px * 0.016 : 0
    const startX = cx - (rankW + gap + ofW) / 2
    ctx.textAlign = 'left'
    stroked(ctx, spec.rankValue, startX, px * 0.845, px * 0.05, CARD.gold, 0.12)
    if (spec.rankOf) {
      stroked(ctx, spec.rankOf, startX + rankW + gap, px * 0.845, px * 0.032, CARD.dim, 0.12)
    }
  }

  // The mark, on the result screen's own plate — nine-sliced exactly the way
  // CSS shows it there, so the thing a player recognises from the game is the
  // thing on the card.
  const plateW = px * 0.66
  const plateH = px * 0.115
  const plateY = px * 0.875
  blitBanner(ctx, cx - plateW / 2, plateY, plateW, plateH)
  ctx.textAlign = 'center'
  stroked(ctx, spec.title.toUpperCase(), cx, plateY + plateH * 0.66, px * 0.062, '#ffffff', 0.1)
}

// ─── The card ───────────────────────────────────────────────────────────────

/**
 * Draw the card onto a fresh offscreen canvas.
 *
 * Returns `null` where there is no 2D context to draw on — jsdom, a browser
 * that refused the allocation, a tab that has lost its GPU process. Every
 * caller treats that as "no card", never as an error worth telling the player
 * about.
 */
export const drawShareCard = (spec: ShareCardSpec): HTMLCanvasElement | null => {
  if (typeof document === 'undefined') return null
  const px = SHARE_CARD_PX
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Idempotent and cheap. The strips are baked long before a result screen
  // exists, but asking costs a map lookup and it is the one call that makes
  // this module work when it is imported from somewhere that never ran a game.
  primeSurvivors()

  paintSky(ctx, px)
  paintLane(ctx, px)
  paintCrowd(ctx, px, spec.peakSquad)
  paintScrims(ctx, px)
  paintType(ctx, px, spec)
  return canvas
}

/**
 * The card as a file's worth of bytes.
 *
 * JPEG, not PNG, and the reason is the picture rather than a preference: the
 * card is a full-bleed sky gradient over a gravel texture — high-frequency
 * noise across every pixel — which is the worst case PNG has. The same card
 * encodes to a few hundred kB as JPEG and to several megabytes as PNG, and
 * several megabytes is a share sheet that hangs on a phone. Nothing on the card
 * needs an alpha channel, and 0.9 leaves no ringing visible around the type at
 * this size.
 *
 * `toBlob` is callback-based and can hand back `null`; a `null` here is a card
 * that did not happen, which the caller turns into a hidden button rather than
 * an error.
 */
export const renderShareCard = async (spec: ShareCardSpec): Promise<Blob | null> => {
  // The display face has to be RESOLVED, not merely requested: `font-display:
  // swap` means an unloaded face silently sets the whole card in the fallback,
  // and unlike the DOM the canvas never repaints itself when the real one
  // lands. By result-screen time it is long since loaded, so this resolves in
  // the same tick — it is here for the card rendered on a cold, throttled first
  // session, which is exactly the one nobody tests.
  try {
    await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready
  } catch { /* no font manager — the fallback stack is still a face */ }

  const canvas = drawShareCard(spec)
  if (!canvas) return null
  if (typeof canvas.toBlob !== 'function') return null
  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9)
    } catch {
      resolve(null)
    }
  })
}
