import {
  clearParticles, drawParticles, emit as emitParticle, getTexts, qualityTier,
  stepParticles, stepTexts, emitText, clearTexts, type QualityTier
} from '@/use/useVfx'
import {
  bugFrame, bugFrameEdge, paintBoss, paintBug, paintDamage, paintSegment,
  primeBugs, bakeSlice, BUG_R_FRAC
} from '@/game/bugArt'
import {
  paintFootShadow, paintShoe, paintStompRing, shoeSprite, LIFT_SCALE, SHOE_BOX, SHOE_FRAC
} from '@/game/footArt'
import {
  paintCoin, paintEggShell, paintHaze, paintHazard, paintPod, paintSaltBurst
} from '@/game/propArt'
import {
  floorAmbient, floorForLevel, floorPattern, paintVignette, resetFloor, resetFloors,
  VIGNETTE_STRENGTH
} from '@/game/floorArt'
import { paintAlert, paintComicWord, paintShockRing, paintSplat, WORD_TONE } from '@/game/uiArt'
import { JUICE_STYLE, burstColour, type JuiceStyleId } from '@/game/juiceStyle'
import { bugSpec, type BugId } from '@/game/bugs'
import { hazardSpec } from '@/game/hazards'
import { worldOf, type WorldId } from '@/game/stages'
import { onArtChanged } from '@/game/art'
import {
  finale, getBoard, getBoss, getBugCount, getBugs, getFoot, getHazards, getHazes,
  getJuiceStyle, getLevel, getPartyAt, getPods, getQuake, getRush, getShoe, getTwist,
  isFever, isTouchInput, segmentAt, stompRadius, trialLeft, type Bug, type GameEvent
} from '@/use/useBugCrunchGame'
import { paintPicnicProp } from '@/game/cutsceneArt'
import { TORCH_R, type TwistId } from '@/game/twists'
import {
  CHARGE_TELL_MS, EGG_LAY_MS, POD_SIZE, BEAM_HALF, BEAM_TELL_MS, type EggLook
} from '@/game/bosses'
import { HIDE_READOUTS } from '@/game/previewFeed'
import { JUICE_LEGACY } from '@/use/perfVariants'

/**
 * ─── The renderer ───────────────────────────────────────────────────────────
 *
 * One `drawScene(ctx, w, h)` per frame, in this order and for these reasons:
 *
 *   1. the FLOOR, from a baked tile pattern — one `fillRect`;
 *   2. the DECALS, from a persistent offscreen canvas the splats are stamped
 *      into and never removed from (the GDD's "baked onto a dynamic floor
 *      render-texture"), so a board covered in a hundred splats costs one blit;
 *   3. the hazards, which sit ON the floor and UNDER everything alive;
 *   4. the foot's SHADOW — under the bodies, because that is what a shadow is,
 *      and the single most important mark on the screen;
 *   5. the bodies, back to front by their y;
 *   6. the SHOE, over everything it is about to crush;
 *   7. particles, rings, comic words;
 *   8. the world's ambient wash and vignette, over all of it, so the four
 *      worlds read as four places rather than four background images.
 *
 * ── Camera ──
 *
 * There is no scrolling camera: the board IS the viewport. What the camera does
 * have is SHAKE and a small impact ZOOM, both of which are applied as a
 * transform around the screen's centre and both of which decay on their own
 * clock. That is the whole of the GDD's "micro screen shakes on normal stomps,
 * heavy directional zoom-and-shake on boss kills and 20+ combos".
 */

// ─── Canvas + scale ─────────────────────────────────────────────────────────

let pxPerU = 4
let viewW = 0
let viewH = 0
let dpr = 1

/** The DPR cap per quality tier. A phone at dpr 3 renders nine times the pixels
 *  of one at dpr 1 for a board whose art is flat shapes — the cap is the single
 *  cheapest frame-time win this renderer has. */
const DPR_CAP: Record<QualityTier, number> = { high: 2, medium: 1.75, low: 1.4, min: 1 }

export const setScale = (cssW: number, cssH: number, deviceDpr: number): number => {
  viewW = cssW
  viewH = cssH
  dpr = Math.min(deviceDpr, DPR_CAP[qualityTier()])
  pxPerU = Math.min(cssW, cssH) / 100
  resetDecals()
  primeBugs(getLevel().roster.map((r) => r.id), pxPerU)
  return dpr
}

export const getPxPerU = (): number => pxPerU

/** Screen px for a world x / y. The board is the viewport, so this is a scale. */
export const toX = (u: number): number => u * pxPerU
export const toY = (u: number): number => u * pxPerU
/** …and back, for turning a pointer event into an aim point. */
export const fromX = (px: number): number => px / pxPerU
export const fromY = (px: number): number => px / pxPerU

// ─── The decal layer ────────────────────────────────────────────────────────
//
// Every splat is stamped ONCE into this canvas and then never touched again, so
// the cost of a board covered in three hundred splats is one blit per frame
// rather than three hundred path fills. It is the single most important
// performance decision in the renderer, and it is also what makes the floor
// carry a history of the level.

let decals: HTMLCanvasElement | null = null
let decalCtx: CanvasRenderingContext2D | null = null
let decalCount = 0

/** Decals kept before the whole layer is faded back. A cap rather than a purge:
 *  fading the layer 40 % when it gets busy keeps the history legible AND keeps
 *  the newest splats reading as the loudest. */
const DECAL_BUDGET = 220
const DECAL_FADE = 0.42

/** The decal layer's resolution, relative to the board. Splats are soft, large
 *  and out of focus by design, so three quarters is free. */
const DECAL_SCALE: Record<QualityTier, number> = { high: 0.75, medium: 0.66, low: 0.5, min: 0.4 }

const ensureDecals = (): void => {
  if (decals && decals.width > 0) return
  const k = DECAL_SCALE[qualityTier()]
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(viewW * dpr * k))
  c.height = Math.max(1, Math.round(viewH * dpr * k))
  decals = c
  decalCtx = c.getContext('2d')
  decalCount = 0
}

export const resetDecals = (): void => {
  decals = null
  decalCtx = null
  decalCount = 0
}

/** Stamp one splat into the floor layer. */
export const stampSplat = (
  x: number, y: number, r: number, colour: string, seed: number,
  style: JuiceStyleId, stretch: number, angle: number
): void => {
  ensureDecals()
  const g = decalCtx
  const c = decals
  if (!g || !c) return
  const k = (c.width / Math.max(1, viewW)) // px in the layer per CSS px
  g.save()
  g.translate(x * pxPerU * k, y * pxPerU * k)
  paintSplat(g, r * pxPerU * k, colour, seed, style, stretch, angle)
  g.restore()
  decalCount++
  if (decalCount > DECAL_BUDGET) {
    // Fade the whole layer back rather than clearing it. `destination-out` with
    // a partial alpha is one composited rect and leaves the older marks as a
    // ghost, which is exactly what a trampled floor should look like.
    g.save()
    g.globalCompositeOperation = 'destination-out'
    g.fillStyle = `rgba(0,0,0,${DECAL_FADE})`
    g.fillRect(0, 0, c.width, c.height)
    g.restore()
    decalCount = Math.floor(DECAL_BUDGET * 0.5)
  }
}

/**
 * Stamp a hatched egg's empty shell into the floor layer — the same persistent
 * canvas the splats live in, so the floor remembers every egg that got away for
 * the cost of one stamp.
 */
export const stampShell = (x: number, y: number, r: number, look: EggLook, seed: number): void => {
  ensureDecals()
  const g = decalCtx
  const c = decals
  if (!g || !c) return
  const k = (c.width / Math.max(1, viewW))
  g.save()
  g.translate(x * pxPerU * k, y * pxPerU * k)
  paintEggShell(g, r * pxPerU * k, look, seed)
  g.restore()
  decalCount++
}

// ─── Camera ─────────────────────────────────────────────────────────────────

let shakeAmp = 0
let shakeT = 0
let zoom = 0
let flash = 0
let flashColour = '255,255,255'

/** Kick the camera. `amp` is 0..1; the screen's own short edge scales it. */
export const shake = (amp: number): void => {
  shakeAmp = Math.min(1, Math.max(shakeAmp, amp))
}

// ─── The kick ───────────────────────────────────────────────────────────────
//
// A shake is a WOBBLE: two sines with no direction, which reads as the camera
// being rattled. An impact is not a rattle — it happens once, along a line, and
// it is over. The slam had only the wobble, and that is most of why a charged
// stomp landed soft: at the moment of contact the screen started vibrating
// instead of taking a hit.
//
// So this is a single decaying OFFSET along a direction, layered over the
// wobble. It decays in ~140 ms against the wobble's ~400: the jolt is gone
// while the rattle is still settling, which is the order those things happen in
// when something heavy hits a floor.
let kickX = 0
let kickY = 0
let kickAmp = 0

/** One directional jolt. `dx`/`dy` need not be normalised; `amp` is 0..1 and
 *  scales against the screen's short edge exactly as `shake` does. */
export const kick = (dx: number, dy: number, amp: number): void => {
  const len = Math.hypot(dx, dy) || 1
  // The strongest kick in flight wins, rather than summing: two impacts in one
  // frame are one event to the eye, and adding them throws the camera.
  if (amp <= kickAmp) return
  kickX = dx / len
  kickY = dy / len
  kickAmp = Math.min(1, amp)
}

export const punchZoom = (amount: number): void => {
  zoom = Math.max(zoom, amount)
}

// ─── The focus push ─────────────────────────────────────────────────────────
//
// `punchZoom` scales around the CENTRE of the screen, which is right for an
// impact — it is a flinch, it is over in 300 ms, and nobody reads it as the
// camera going anywhere. It is wrong for the one shot in this game that is
// about a specific point on the floor: the squash that won the level. Centred,
// a 1.5× push on a body in the corner pushes that body further into the corner.
//
// So this is a HELD, ANCHORED zoom: it scales around a world point, it ramps
// rather than decaying, and it stays where it is put until something lets it
// go. See `game/winBeat.ts` for the beat that drives it.
//
// It cannot reveal anything outside the canvas, which is worth stating because
// it is the thing an anchored zoom usually gets wrong. The visible span after
// scaling by `s` around a screen x of `fx` is `[fx − fx/s, fx + (W−fx)/s]`, and
// for any `s ≥ 1` both ends stay inside `[0, W]` for free. No clamping, no
// letterbox, no special case for a body against the edge.

/** Where the push is anchored, in WORLD units — converted at draw time, so a
 *  resize mid-beat moves the anchor with the board instead of off it. */
let focusX = 0
let focusY = 0
/** How far in it goes at the top of the ramp; 0 disables it entirely. */
let focusAmount = 0
/** 0..1 along the ramp, and where it is headed. */
let focusK = 0
let focusTo = 0
/** ms for a full 0→1 traverse — set per leg, so in and out can differ. */
let focusRampMs = 1

/**
 * Push in on a world point.
 *
 * `amount` is the same unit `punchZoom` takes: the scale becomes `1 + amount`.
 * The push HOLDS at the top — there is no decay — until `releaseFocus` or
 * `resetArt` takes it back.
 */
export const focusOn = (x: number, y: number, amount: number, ms: number): void => {
  // Reduced motion drops the camera move and nothing else. The card that comes
  // up with it, and the two seconds the game holds on it, are information; the
  // push is the part that moves the screen, so the push is the part that goes.
  if (calm || amount <= 0) { focusAmount = 0; focusTo = 0; return }
  focusX = x
  focusY = y
  focusAmount = amount
  focusTo = 1
  focusRampMs = Math.max(1, ms)
}

/** Let it go, over `ms`. */
export const releaseFocus = (ms: number): void => {
  focusTo = 0
  focusRampMs = Math.max(1, ms)
}

/** The scale the focus push is currently asking for — 1 when it is not in play. */
const focusScale = (): number => {
  if (focusAmount <= 0 || focusK <= 0) return 1
  // Smoothstep: a linear ramp starts and stops with a visible jerk at this
  // duration, and the jerk at the TOP is the one that matters — it lands on the
  // frame the card comes up.
  return 1 + focusAmount * (focusK * focusK * (3 - 2 * focusK))
}

// ─── Slow motion ────────────────────────────────────────────────────────────
//
// A Big Finish is the loudest frame of a level, and it is loud by being SLOW:
// for half a second every effect — the particles, the rings, the words, the
// coins — runs at 0.3×. The sim has already stopped by then (the level is won),
// so only the pictures are slowed, never a rule.

let slowMs = 0
const SLOW_FACTOR = 0.3

export const slowMo = (ms: number): void => { slowMs = Math.max(slowMs, ms) }

/** Reduced motion: the finisher and the blackout lose their flashes and zooms. */
let calm = false
export const setCalm = (v: boolean): void => { calm = v }

export const screenFlash = (amount: number, rgb = '255,255,255'): void => {
  flash = Math.max(flash, amount)
  flashColour = rgb
}

const stepCamera = (dt: number): void => {
  shakeT += dt
  shakeAmp = Math.max(0, shakeAmp - dt / 420)
  // Three times the wobble's rate: the jolt is spent while the rattle is still
  // settling. See `kick`.
  kickAmp = Math.max(0, kickAmp - dt / 140)
  zoom = Math.max(0, zoom - dt / 300)
  flash = Math.max(0, flash - dt / 240)
  // The focus push RAMPS, where everything above it decays: it is held by the
  // beat that started it rather than by its own clock. On real dt like the rest
  // of the camera — a push that ran at a third speed inside the Big Finish's
  // slow motion would still be travelling when the result screen opened.
  if (focusK !== focusTo) {
    const step = dt / focusRampMs
    focusK = focusTo > focusK ? Math.min(focusTo, focusK + step) : Math.max(focusTo, focusK - step)
    // Fully released: drop the amount too, so `focusScale` short-circuits and a
    // level that never wins never touches the transform.
    if (focusK === 0 && focusTo === 0) focusAmount = 0
  }
}

// ─── Rings ──────────────────────────────────────────────────────────────────

interface Ring { x: number; y: number; r: number; t: number; life: number; colour: string; thick: number }
const rings: Ring[] = []
const MAX_RINGS = 24

export const pushRing = (x: number, y: number, r: number, life: number, colour: string, thick = 1): void => {
  if (rings.length >= MAX_RINGS) rings.shift()
  rings.push({ x, y, r, t: 0, life, colour, thick })
}

// ─── Comic words ────────────────────────────────────────────────────────────
//
// ── Where a word goes, and why it is not where the bug was ──
//
// It used to be stamped on the kill, which is the obvious place and — on the
// device most of this game's players hold — the one place it cannot be read. On
// touch the shoe rides `TOUCH_LIFT_U` above the fingertip, so a word drawn at
// the body sits roughly 43 px above the finger on a 390 px phone: under the
// knuckle, under the thumb, or in the pale halo a finger leaves on a screen.
// The game's loudest single piece of feedback was being printed under the
// player's own hand.
//
// So a word is LIFTED clear of the kill, further on touch than on a mouse, and
// then clamped back inside the board so the lift can never carry it off the top
// of the screen. It is the same fix the `stomp` event's `hit` flag got — see
// `phone-tap-misses-are-the-dropout` — applied to the other half of the
// feedback a phone player was missing.
//
// ── …and why they are not translated ──
//
// SQUISH / CRUNCH / SPLAT are onomatopoeia drawn in the game's display face
// (`Angry`, a Latin-only TTF) and they are the game's identity rather than
// copy — the reference sheets are built around these four words. A locale that
// swapped them would get tofu boxes in every non-Latin script and a different
// game in the rest. They stay here, beside the drawing that paints them, and
// deliberately out of `src/i18n`.

interface Word { x: number; y: number; text: string; tone: keyof typeof WORD_TONE; t: number; life: number; rot: number; size: number; vy: number }
const words: Word[] = []
const MAX_WORDS = 10

/**
 * How far above the kill a word is thrown, in body radii and then in units.
 *
 * The touch lift is the bigger of the two by a long way, and it is not a taste
 * call: `TOUCH_LIFT_U` (11 u) is exactly how far the shoe already sits above the
 * finger, so clearing the hand means clearing that distance AGAIN on top of the
 * body's own half-height.
 */
const WORD_LIFT_U = 4
const WORD_LIFT_TOUCH_U = 13

/**
 * The shortest gap between two comic words, ms.
 *
 * A word on every kill is the point — a player who squishes six ants in a row
 * should be shouted at six times — but a SLAM kills five bodies in one frame,
 * and five words spawned on the same tick land on top of each other and read as
 * one illegible smear. So a burst of kills earns one word for the burst, at the
 * best of their tiers, and the next kill after the gap earns its own.
 */
const WORD_GAP_MS = 110
let lastWordAt = -1e9

export const pushWord = (
  x: number, y: number, text: string, tone: keyof typeof WORD_TONE, size: number
): void => {
  if (words.length >= MAX_WORDS) words.shift()
  words.push({
    x, y, text, tone, t: 0, life: 720,
    rot: (Math.random() - 0.5) * 0.36, size, vy: -14
  })
  lastWordAt = performance.now()
}

/**
 * One comic word for a KILL: lifted clear of the player's hand, clamped inside
 * the board, and refused if another word was shouted a moment ago.
 *
 * `bodyR` is the body's own radius in units, so a boss's word clears a boss and
 * an ant's clears an ant.
 */
const pushKillWord = (
  x: number, y: number, tone: keyof typeof WORD_TONE, size: number, bodyR: number
): void => {
  if (performance.now() - lastWordAt < WORD_GAP_MS) return
  const b = getBoard()
  const lift = bodyR + (isTouchInput() ? WORD_LIFT_TOUCH_U : WORD_LIFT_U)
  // Half the drawn cap height, in units: enough to keep the whole word on the
  // board vertically rather than just its baseline. The HORIZONTAL hold is the
  // coarse one here and the exact one in `drawWords`, which is the only place
  // that can measure how wide the string actually came out.
  const halfH = size / pxPerU * 0.8
  const wy = Math.max(b.y0 + halfH, y - lift)
  const wx = Math.min(Math.max(b.x0 + halfH, x), b.x1 - halfH)
  pushWord(wx, wy, wordText(tone), tone, size)
}

// ─── The squash ─────────────────────────────────────────────────────────────
//
// A body died and DISAPPEARED. That is the single biggest reason a squish in
// this game read as "the bug was deleted" rather than "I crushed it": the frame
// the shoe lands, the creature is gone, and everything the player sees after
// that is debris flying away from an empty patch of floor. There was no moment
// of contact anywhere on screen.
//
// So the renderer keeps a GHOST of it for a sixth of a second and flattens it:
// squeezed along the line the blow came in on, spread out across that line, and
// faded. It is the bug's own baked walk frame, so it is one `drawImage` — no new
// art, no sim change, and the sim still deletes the body on the frame it dies,
// which is what keeps every hitbox and every count honest.
//
// The numbers: 170 ms, because two frames is a flicker and a quarter-second
// leaves a corpse under the next stomp; and it is drawn UNDER the shoe, because
// the shoe is the thing doing it.

interface Squash {
  x: number; y: number; id: BugId; size: number
  /** The blow's line — what it is squashed ALONG. */
  angle: number
  /** The body's own heading — what it is DRAWN along. */
  face: number
  /** Which walk frame it was caught on, so the ghost is the pose it died in. */
  cycle: number
  t: number
  heavy: boolean
}
const squashes: Squash[] = []
const MAX_SQUASHES = 12
const SQUASH_MS = 170

const pushSquash = (
  x: number, y: number, id: BugId, angle: number, face: number, heavy: boolean
): void => {
  if (JUICE_LEGACY) return
  if (qualityTier() === 'min') return
  if (squashes.length >= MAX_SQUASHES) squashes.shift()
  squashes.push({
    x, y, id, size: bugSpec(id).size, angle, face,
    cycle: (performance.now() / 420) % 1, t: 0, heavy
  })
}

/** Age them and retire the ones that are done. On the effect clock, with the
 *  particles — so a slam's hit-stop holds the flattened body as well as the goo
 *  that came out of it. */
const stepSquashes = (dt: number): void => {
  for (let i = squashes.length - 1; i >= 0; i--) {
    const s = squashes[i]!
    s.t += dt
    if (s.t >= SQUASH_MS) squashes.splice(i, 1)
  }
}

const drawSquashes = (ctx: CanvasRenderingContext2D): void => {
  for (let i = 0; i < squashes.length; i++) {
    const s = squashes[i]!
    const p = s.t / SQUASH_MS
    // Flat almost immediately, then it is only the fade doing work: a squash
    // that eases out over the whole 170 ms reads as a body deflating, and a body
    // deflating is a slow event. A boot is not a slow event.
    const q = Math.min(1, p * 3.1)
    const along = 1 - (s.heavy ? 0.68 : 0.52) * q
    const across = 1 + (s.heavy ? 0.85 : 0.6) * q
    ctx.save()
    ctx.globalAlpha = Math.pow(1 - p, 1.5)
    ctx.translate(toX(s.x), toY(s.y))
    // Squashed in the BLOW's frame and drawn in the BODY's: rotate into the
    // blow, scale, rotate back out, then take the body's own facing. Three
    // rotations and one scale, which is one matrix by the time the canvas has it.
    ctx.rotate(s.angle)
    ctx.scale(along, across)
    ctx.rotate(-s.angle + s.face + Math.PI / 2)
    const edge = s.size * 2 * pxPerU / BUG_R_FRAC
    const frame = bugFrame(s.id, s.cycle)
    if (frame) {
      const src = bugFrameEdge(s.id)
      const k = edge / Math.max(1, src)
      ctx.drawImage(frame, -src * k / 2, -src * k / 2, src * k, src * k)
    } else {
      paintBug(ctx, s.id, s.size * pxPerU, s.cycle)
    }
    ctx.restore()
  }
}

// ─── Arcs (the Electric Sock) ───────────────────────────────────────────────

interface Arc { x0: number; y0: number; x1: number; y1: number; t: number }
const arcs: Arc[] = []

export const pushArc = (x0: number, y0: number, x1: number, y1: number): void => {
  if (arcs.length > 12) arcs.shift()
  arcs.push({ x0, y0, x1, y1, t: 0 })
}

// ─── Coins ──────────────────────────────────────────────────────────────────

interface Coin { x: number; y: number; vx: number; vy: number; t: number; spin: number }
const coins: Coin[] = []

export const pushCoins = (x: number, y: number, n: number): void => {
  for (let i = 0; i < n && coins.length < 40; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random()
    coins.push({
      x, y,
      vx: Math.cos(a) * (8 + Math.random() * 12),
      vy: Math.sin(a) * (8 + Math.random() * 12),
      t: 0, spin: Math.random()
    })
  }
}

// ─── The splat burst ────────────────────────────────────────────────────────

/**
 * The particle burst one squish throws.
 *
 * The GDD's "googly eye and shell physics" lives here: alongside the goo, TWO
 * white eye particles are thrown with their own drag, because a burst that is
 * only coloured dots reads as a puff and a burst with two eyes in it reads as a
 * creature coming apart. They are the single cheapest piece of character in the
 * whole effect.
 */
export const burst = (
  x: number, y: number, id: BugId, heavy: boolean, style: JuiceStyleId
): void => {
  const spec = bugSpec(id)
  const s = JUICE_STYLE[style]
  const tier = qualityTier()
  const scale = tier === 'high' ? 1 : tier === 'medium' ? 0.75 : tier === 'low' ? 0.5 : 0.32
  const n = Math.round(s.burst * scale * (heavy ? 1.5 : 1))
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6
    const sp = (10 + Math.random() * 26) * (heavy ? 1.4 : 1)
    const c = burstColour(s, spec.goo, i)
    emitParticle({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: s.life * (0.6 + Math.random() * 0.6),
      size: spec.size * (0.18 + Math.random() * 0.3),
      color: [c[0], c[1], c[2]],
      alpha: 0.95,
      drag: 3.6,
      additive: s.additive,
      shape: s.shape,
      rot: Math.random() * 6.28,
      vrot: (Math.random() - 0.5) * 8
    })
  }
  // The LIQUID. See `gooSpray`: the round dots above are the volume of the
  // burst, these are the half of it that reads as a fluid.
  gooSpray(x, y, spec.goo, s.drops * (heavy ? 1.6 : 1), spec.size * (heavy ? 1.25 : 1), style)

  // The eyes. Only in the ooze style — confetti and bubbles are the styles for
  // a player who would rather not think about what just happened.
  if (style === 'ooze' && tier !== 'min') {
    for (const sgn of [-1, 1]) {
      emitParticle({
        x, y,
        vx: sgn * (12 + Math.random() * 16),
        vy: -(8 + Math.random() * 18),
        life: 900,
        size: spec.size * 0.28,
        color: [255, 255, 255],
        alpha: 1,
        drag: 2.2,
        shape: 0
      })
    }
  }
}

/**
 * How many droplets a tier may afford, as a multiple of the style's own count.
 *
 * Separate from the burst's ladder and deliberately steeper at the bottom: a
 * droplet costs a rotate and a `drawImage` where a burst dot costs an `arc`, so
 * the shape that is worth the most per particle is also the one a struggling
 * device should own the fewest of. Never zero, though — two wet spears out of a
 * body is still unmistakably a body bursting, and a `min`-tier player who got
 * dots only would be playing a different game.
 */
const DROP_SCALE: Record<QualityTier, number> = { high: 1, medium: 0.7, low: 0.45, min: 0.22 }

/**
 * ─── The liquid ─────────────────────────────────────────────────────────────
 *
 * `n` goo droplets flung out of (x, y) — the shape-4 teardrops that fly head
 * first, stretch with their own speed and carry a highlight.
 *
 * This is the piece the burst was missing. A squish threw a cloud of round
 * coloured dots, and a cloud of round coloured dots is what dust is: nothing in
 * it said WET. The droplets say it, and they say it for three particles' worth
 * of cost rather than forty, because the eye reads the shape long before it
 * counts them.
 *
 * `power` is the body's radius in units, and it scales both the launch speed and
 * the droplet size — an ant spits, a boss throws. `spread` and `aim` narrow the
 * spray into an arc for the sprays that have a direction (a boss going down
 * throws its goo along the blow that killed it).
 */
const gooSpray = (
  x: number, y: number, goo: readonly [number, number, number],
  n: number, power: number, style: JuiceStyleId,
  spread = Math.PI * 2, aim = 0
): void => {
  if (JUICE_LEGACY) return
  const count = Math.round(n * DROP_SCALE[qualityTier()])
  if (count <= 0) return
  const s = JUICE_STYLE[style]
  for (let i = 0; i < count; i++) {
    // Evenly stepped and then jittered, for the reason the stomp's dust is:
    // `count` random angles clump, and a clump reads as one fat blob leaving in
    // one direction rather than as a body coming apart.
    const a = aim + ((i + 0.5) / count - 0.5) * spread + (Math.random() - 0.5) * (spread / count)
    const sp = (14 + Math.random() * 30) * (0.55 + power / 7)
    emitParticle({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: s.life * (0.85 + Math.random() * 0.85),
      size: power * (0.16 + Math.random() * 0.2),
      color: [goo[0], goo[1], goo[2]],
      alpha: 0.98,
      // Low drag and real gravity, unlike the dots: a droplet should keep going,
      // arc over and land, because that arc is the whole difference between
      // thrown liquid and a puff that stops where it was born.
      drag: 1.5,
      gravity: s.gravity * 1.4,
      additive: s.additive,
      shape: 4,
      rot: Math.random() * 6.28
    })
  }
}

// ─── Staged beats ───────────────────────────────────────────────────────────
//
// A queue of "do this in N ms of EFFECT time", drained by `drawScene`.
//
// One customer, and it needs all of it: a boss going down is not an event, it is
// a four-beat sequence — the hit, the rupture, the shout, the rain — and every
// beat of it has to land on the same clock the particles are running on. The
// clock matters because a boss death runs in slow motion: a `setTimeout` would
// fire its second beat while the first was still a third of the way through
// playing, and the whole sequence would arrive as one frame with everything in
// it, which is exactly what it looks like today.
//
// Bounded, cleared with the rest of the transient visuals by `resetArt`, and
// never given a closure that outlives a level.

interface Beat { at: number; run: () => void }
const beats: Beat[] = []
const MAX_BEATS = 16

/** Run `fn` after `ms` of effect time. Dropped silently past the cap — a
 *  sequence that has queued sixteen beats has already gone wrong. */
const after = (ms: number, fn: () => void): void => {
  if (beats.length >= MAX_BEATS) return
  beats.push({ at: ms, run: fn })
}

const stepBeats = (dt: number): void => {
  for (let i = beats.length - 1; i >= 0; i--) {
    const b = beats[i]!
    b.at -= dt
    if (b.at > 0) continue
    beats.splice(i, 1)
    b.run()
  }
}

// ─── Event handling ─────────────────────────────────────────────────────────

let splatSeed = 1

/**
 * Turn one step's events into pictures.
 *
 * Kept here rather than in the scene so the renderer owns every visual decision
 * and `GameScene.vue` stays a HUD and an input surface.
 */
export const applyEvents = (list: readonly GameEvent[]): void => {
  const style = getJuiceStyle()
  for (const e of list) {
    switch (e.k) {
      case 'squish': {
        const spec = bugSpec(e.bug)
        const s = JUICE_STYLE[style]
        // The body first, so the burst is thrown out of something rather than
        // out of bare floor. See `pushSquash`.
        pushSquash(e.x, e.y, e.bug, e.angle, e.face, e.heavy)
        burst(e.x, e.y, e.bug, e.heavy, style)
        if (s.decalAlpha > 0.02) {
          stampSplat(
            e.x, e.y, spec.size * s.decalScale * (e.heavy ? 1.35 : 1),
            `rgb(${spec.goo[0]},${spec.goo[1]},${spec.goo[2]})`,
            splatSeed++, style, e.stretch, e.angle
          )
        }
        pushRing(e.x, e.y, spec.size * 2.4, 320, `rgba(${spec.goo[0]},${spec.goo[1]},${spec.goo[2]},0.9)`, 0.7)
        // ── A WORD ON EVERY KILL ──
        //
        // It used to want ×3, which is the tier where the word stops being
        // SQUISH! — so the first rung of the ladder had no picture at all, and a
        // player who never chained never saw one. That is most of a session for
        // a six-year-old, and it is the whole of the first thirty seconds for
        // everyone: the loudest feedback this game has was withheld from exactly
        // the players who most needed telling they had done it right.
        //
        // Now every kill shouts, and `pushKillWord` is what makes that legible
        // rather than a mess — one word per `WORD_GAP_MS`, lifted clear of the
        // hand and clamped to the board.
        pushKillWord(e.x, e.y, e.word, spec.size * (e.heavy ? 1.75 : 1.5) * pxPerU, spec.size)
        shake(0.1 + Math.min(0.4, e.mult / 60))
        // ── HIT-STOP ──
        //
        // Two frames of the pictures running at a third speed, on a slam only.
        // It is the cheapest weight a cartoon impact can be given: the burst
        // hangs in the air for a beat instead of blowing straight through, and
        // the eye reads the pause as the blow having MASS. Only the effects
        // stop — `slowMo` never touches the sim — so nothing a player is aiming
        // at moves differently, which is what keeps this juice and not input lag.
        if (e.heavy && !calm) slowMo(70)
        break
      }
      case 'hurt': {
        const spec = bugSpec(e.bug)
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2
          emitParticle({
            x: e.x, y: e.y,
            vx: Math.cos(a) * 18, vy: Math.sin(a) * 18,
            life: 380, size: spec.size * 0.2,
            color: [spec.shade.length > 0 ? 220 : 220, 220, 220],
            drag: 4, shape: 1, alpha: 0.9
          })
        }
        shake(0.08)
        break
      }
      case 'clang':
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 2
          emitParticle({
            x: e.x, y: e.y,
            vx: Math.cos(a) * 30, vy: Math.sin(a) * 30,
            life: 300, size: 0.5, color: [255, 236, 150],
            additive: true, drag: 5, shape: 2
          })
        }
        shake(0.16)
        break
      case 'spike':
        pushWord(e.x, e.y, 'OUCH!', 'ultra', 14 * pxPerU)
        screenFlash(0.3, '255,80,90')
        shake(0.5)
        break
      case 'stomp': {
        const r = e.r
        // ── A MISS LOOKS LIKE A MISS ──
        //
        // It did not, and that cost the game its phone players: five blind
        // testers hit long miss streaks and every one of them concluded the
        // GAME was broken, because bare floor threw the same white ring and the
        // same cloud of dust as a kill. The event has carried `hit` all along;
        // nothing read it. So a blow that found nothing lands short and dull —
        // floor-coloured, thin, half the dust, no shake — and a child can tell
        // "I missed" from "it ignored me" without a word of text.
        const dud = !e.hit
        // ── The charged stomp is the game's best verb, so it gets the loudest
        // ── landing. Everything below is doubled up for `heavy` and left alone
        // ── for a tap: the CONTRAST is the reward for holding the press, and a
        // ── light stomp that lands as hard as a slam teaches nothing.
        pushRing(e.x, e.y, r * (dud ? 0.72 : 1.1), dud ? 200 : e.heavy ? 420 : 260,
          dud ? 'rgba(196,186,168,0.5)' : e.heavy ? 'rgba(255,232,150,0.95)' : 'rgba(255,255,255,0.8)',
          dud ? 0.8 : e.heavy ? 1.6 : 1)
        // A second, faster ring on a slam only — one ring is an event, two
        // chasing each other outward is a shockwave.
        if (e.heavy && !dud) pushRing(e.x, e.y, r * 1.9, 260, 'rgba(255,255,255,0.7)', 0.9)

        const tier = qualityTier()
        const n = tier === 'min' ? 0 : dud ? 3 : e.heavy ? 22 : 7
        for (let i = 0; i < n; i++) {
          // Jittered off the ring rather than evenly spaced: identical spokes
          // at one radius read as a NECKLACE of puffs, which is what the first
          // cut of this looked like on the board — the eye finds the ring
          // before it reads the dust. Angle, radius, speed and size are all
          // jittered, so it comes out as a cloud with a hole in the middle.
          const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.7
          const rad = r * (e.heavy ? 0.45 + Math.random() * 0.55 : 0.7)
          const speed = e.heavy ? 34 + Math.random() * 22 : 22
          emitParticle({
            x: e.x + Math.cos(a) * rad, y: e.y + Math.sin(a) * rad,
            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
            // High drag with a high launch speed is what makes dust read as
            // DISPLACED AIR: it shoots out, stalls, and hangs. Same particle at
            // a low speed just drifts.
            life: dud ? 260 : e.heavy ? 520 : 420,
            size: r * (dud ? 0.1 : e.heavy ? 0.15 + Math.random() * 0.12 : 0.16),
            color: [230, 226, 216], alpha: dud ? 0.3 : e.heavy ? 0.6 : 0.5,
            drag: dud ? 9 : e.heavy ? 6.5 : 4.5, shape: 3
          })
        }
        // A few fat, slow puffs sitting ON the impact — the cloud the ring runs
        // out of, rather than more of the same spokes.
        if (e.heavy && tier !== 'min') {
          for (let i = 0; i < 4; i++) {
            const a = Math.random() * Math.PI * 2
            emitParticle({
              x: e.x + Math.cos(a) * r * 0.3, y: e.y + Math.sin(a) * r * 0.3,
              vx: Math.cos(a) * 9, vy: Math.sin(a) * 9,
              life: 720, size: r * 0.42,
              color: [226, 220, 208], alpha: 0.4, drag: 7, shape: 3
            })
          }
        }

        shake(dud ? 0.04 : e.heavy ? 0.5 : 0.12)
        if (e.heavy && !dud) {
          // Straight DOWN: the floor takes the blow. An outward kick along the
          // foot's travel was tried and reads as the camera being shoved, which
          // is a different event from something landing on the ground.
          kick(0, 1, 0.45 + 0.25 * Math.min(1, r / 12))
          punchZoom(0.022)
        }
        break
      }
      case 'pivot':
        pushRing(e.x, e.y, e.r, 460, 'rgba(190,230,255,0.85)', 1.2)
        shake(0.24)
        break
      case 'fever':
        pushRing(e.x, e.y, Math.max(viewW, viewH) / pxPerU, 900, 'rgba(255,205,0,0.95)', 2.4)
        screenFlash(0.75, '255,205,60')
        punchZoom(0.03)
        shake(0.7)
        break
      case 'coin':
        pushCoins(e.x, e.y, e.n)
        break
      case 'chain-arc':
        pushArc(e.x0, e.y0, e.x1, e.y1)
        break
      case 'salt':
        pushRing(e.x, e.y, 26, 600, 'rgba(255,255,255,0.9)', 1.1)
        break
      case 'magnet':
        pushRing(e.x, e.y, 18, 520, 'rgba(255,240,140,0.8)', 1)
        break
      case 'bossHit':
        pushRing(e.x, e.y, 16, 380, e.counter ? 'rgba(255,120,60,0.95)' : 'rgba(255,255,255,0.8)', e.counter ? 2 : 1)
        shake(e.counter ? 0.6 : 0.28)
        if (e.counter) { punchZoom(0.02); screenFlash(0.25, '255,180,80') }
        break
      case 'bossPhase':
        screenFlash(0.4, '255,90,140')
        shake(0.5)
        break
      case 'bossDown':
        bossDeath(e.x, e.y, style)
        break
      case 'podPop': {
        // A popped egg is paid like a kill, and it LOOKS like one: shell chips,
        // a splat of what was inside stamped into the floor, and the chain's
        // word once the chain has earned one. An egg's goo is yolk; a capsule's
        // is its boss's coolant.
        const bs = getBoss()
        const capsule = bs?.spec.eggLook === 'capsule'
        const goo = capsule && bs ? bs.spec.goo : EGG_YOLK
        const s = JUICE_STYLE[style]
        pushRing(e.x, e.y, POD_SIZE * 3, 380, 'rgba(255,240,200,0.9)', 1)
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2
          emitParticle({
            x: e.x, y: e.y, vx: Math.cos(a) * 24, vy: Math.sin(a) * 24,
            life: 520, size: 0.6, color: capsule ? [200, 210, 226] : [240, 220, 174], drag: 3.4, shape: 1,
            rot: Math.random() * 6.28, vrot: (Math.random() - 0.5) * 10
          })
        }
        // What was inside it, thrown: yolk out of an egg, coolant out of a
        // capsule. An egg is paid like a kill, so it bleeds like one.
        gooSpray(e.x, e.y, goo, s.drops, POD_SIZE * 1.1, style)
        if (s.decalAlpha > 0.02) {
          stampSplat(e.x, e.y, POD_SIZE * 0.95 * s.decalScale, `rgb(${goo[0]},${goo[1]},${goo[2]})`,
            splatSeed++, style, 1, 0)
        }
        pushKillWord(e.x, e.y, e.word, POD_SIZE * 1.3 * pxPerU, POD_SIZE)
        shake(0.16 + Math.min(0.3, e.mult / 60))
        break
      }
      case 'podHatch': {
        // The consequence, made LEGIBLE rather than punishing: the old cue was a
        // red flash, which told a six-year-old they had done something wrong
        // when all that happened is that some ants arrived. Now it is a pop —
        // a ring, chips of shell, the empty halves left on the floor — and the
        // ants' own scurry out of it (`hatchEgg`) is the rest of the picture.
        const bs = getBoss()
        const look: EggLook = bs?.spec.eggLook ?? 'egg'
        pushRing(e.x, e.y, POD_SIZE * 2.6, 360, look === 'capsule' ? 'rgba(110,240,255,0.85)' : 'rgba(255,236,190,0.9)', 0.9)
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5
          emitParticle({
            x: e.x, y: e.y, vx: Math.cos(a) * 20, vy: Math.sin(a) * 20,
            life: 420, size: 0.55, color: look === 'capsule' ? [200, 210, 226] : [244, 228, 190],
            drag: 4, shape: 1, rot: Math.random() * 6.28, vrot: (Math.random() - 0.5) * 8
          })
        }
        stampShell(e.x, e.y, POD_SIZE, look, (e.x * 0.137 + e.y * 0.071) % 1)
        shake(0.1)
        break
      }
      case 'podLand':
        // A laid egg touching down: a puff, so the eye follows it to where it
        // can be stomped.
        pushRing(e.x, e.y, POD_SIZE * 1.7, 260, 'rgba(255,255,255,0.6)', 0.6)
        break
      case 'sweep':
        shake(0.18)
        break

      // ── The set pieces ──
      case 'multi':
        // One stomp, several bodies: a gold ring the size of the haul.
        pushRing(e.x, e.y, 8 + e.n * 2.4, 420, 'rgba(255,217,60,0.95)', 1.4)
        shake(0.18 + Math.min(0.3, e.n * 0.05))
        break
      case 'rushGo':
        pushRing(e.x, e.y, 10, 380, 'rgba(255,240,200,0.85)', 1)
        break
      case 'finisher': {
        // The loudest frame of the level. A slam finisher is the jackpot: a
        // gold shockwave across the board, a burst of confetti, the camera
        // punching in, and the whole of it in slow motion.
        const big = e.heavy && e.n > 0
        pushRing(e.x, e.y, big ? Math.max(viewW, viewH) / pxPerU : 22, big ? 900 : 520, 'rgba(255,205,0,0.95)', big ? 2.6 : 1.6)
        if (big) pushRing(e.x, e.y, Math.max(viewW, viewH) / pxPerU * 0.6, 700, 'rgba(255,255,255,0.8)', 1.2)
        confetti(e.x, e.y, big ? 46 : 22)
        if (!calm) {
          screenFlash(big ? 0.55 : 0.3, '255,215,90')
          punchZoom(big ? 0.1 : 0.04)
        }
        shake(big ? 0.8 : 0.35)
        slowMo(big ? 520 : 360)
        break
      }
      case 'flip':
        // Over it goes: a puff of dust as the shell hits the floor.
        pushRing(e.x, e.y, 7, 300, 'rgba(255,255,255,0.75)', 0.8)
        dust(e.x, e.y, 6)
        break
      case 'kick':
        pushRing(e.x, e.y, 9, 260, 'rgba(255,255,255,0.9)', 1.2)
        shake(0.2)
        break
      case 'pins':
        // A strike.
        pushRing(e.x, e.y, 18 + e.n * 2, 520, 'rgba(255,217,60,0.95)', 1.8)
        confetti(e.x, e.y, 14)
        shake(0.45)
        break
      case 'boxDrop':
        // A present landing: a thump and a ring on the floor where it lands.
        pushRing(e.x, e.y, 9, 360, 'rgba(255,107,143,0.9)', 1.2)
        dust(e.x, e.y, 8)
        shake(0.12)
        break
      case 'boxHit':
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2
          emitParticle({
            x: e.x, y: e.y, vx: Math.cos(a) * 20, vy: Math.sin(a) * 20,
            life: 380, size: 0.7, color: [255, 107, 143], drag: 4, shape: 1,
            rot: Math.random() * 6.28, vrot: (Math.random() - 0.5) * 9
          })
        }
        shake(0.12)
        break
      case 'boxPoof':
        dust(e.x, e.y, 10)
        pushRing(e.x, e.y, 8, 300, 'rgba(255,255,255,0.6)', 0.7)
        break
      case 'trial':
        // The lid flies off: sparkle, and the shoe arrives in a gold ring.
        confetti(e.x, e.y, 26)
        pushRing(e.x, e.y, 16, 520, 'rgba(255,228,94,0.95)', 1.6)
        if (!calm) screenFlash(0.25, '255,240,180')
        shake(0.3)
        break
      case 'trialEnd': {
        const f = getFoot()
        dust(f.x, f.y, 8)
        pushRing(f.x, f.y, 10, 320, 'rgba(255,255,255,0.7)', 0.8)
        break
      }
      case 'quake':
        shake(0.6)
        kick(0, 1, 0.6)
        break
      case 'echo':
        pushRing(e.x, e.y, e.r * 1.1, 360, 'rgba(190,160,255,0.9)', 1.4)
        pushRing(e.x, e.y, e.r * 1.8, 260, 'rgba(255,255,255,0.6)', 0.8)
        dust(e.x, e.y, 10)
        shake(0.35)
        break
      case 'twistTell':
        shake(0.14)
        break
      case 'twistStart':
        if (e.id === 'spill') {
          for (const h of getHazards()) {
            if (h.id !== 'slick') continue
            // A splash along the lane as it floods.
            for (let i = 0; i < 18; i++) {
              const t = (Math.random() - 0.5) * 2 * h.r
              emitParticle({
                x: h.x + Math.cos(h.angle) * t, y: h.y + Math.sin(h.angle) * t,
                vx: (Math.random() - 0.5) * 16, vy: -8 - Math.random() * 14,
                life: 520, size: 0.9, color: [255, 224, 102], drag: 3, shape: 0, alpha: 0.9
              })
            }
          }
        }
        if (e.id === 'glitch') { if (!calm) screenFlash(0.2, '110,240,255'); shake(0.25) }
        break
      case 'twistEnd':
        // The lights coming back is a flash — except under reduced motion.
        if (e.id === 'blackout' && !calm) screenFlash(0.45, '255,250,220')
        break
      default:
        break
    }
  }
}

/**
 * ─── The boss goes down ─────────────────────────────────────────────────────
 *
 * The loudest three seconds in the game, and until now it was ONE ring, a flash
 * and a shake — the same treatment a Fever stomp gets, for the thing a player
 * spent two minutes learning to hit. A ten-metre queen ant burst with less goo
 * on screen than an ordinary ant, because the `bossDown` event never reached the
 * burst at all.
 *
 * So it is a SEQUENCE, staged on effect time (`after`, so every beat lands on
 * the same slowed clock the particles are running on) and built out of the
 * pieces the rest of the game already uses, at boss scale:
 *
 *   0 ms    THE HIT — white-out, a jolt straight down, the camera punching in,
 *           and time dropping to a third. The body itself squashes, rolls and
 *           fades over 1.2 s (`stepBoss`, drawn in section 5).
 *   ~90 ms  THE RUPTURE — the shell lets go. A wide arc of goo along the blow's
 *           own line, the first shockwave, and the central splat stamped into
 *           the floor at boss size.
 *   ~230 ms THE SHOUT — the comic word, lifted over the body, and the second
 *           ring chasing the first outward. Confetti, because this is a win.
 *   ~430 ms THE RAIN — a lazy fall of fat droplets and four satellite splats
 *           thrown wide, so the floor keeps the shape of what happened after
 *           every moving thing has stopped.
 *
 * Every count runs through `gooSpray`/`confetti`, which are already tier-scaled,
 * so a `min`-tier phone gets the same four beats with a fifth of the particles
 * rather than a different ending.
 */
const bossDeath = (x: number, y: number, style: JuiceStyleId): void => {
  if (JUICE_LEGACY) {
    // The baseline: one ring, a flash, a zoom and a shake — kept exactly as it
    // was, because tidying the arm you are measuring against contaminates the
    // comparison.
    pushRing(x, y, Math.max(viewW, viewH) / pxPerU, 1100, 'rgba(255,205,0,0.95)', 3)
    screenFlash(0.8, '255,230,150')
    punchZoom(0.05)
    shake(1)
    return
  }
  const bs = getBoss()
  const goo = bs?.spec.goo ?? [255, 205, 0] as const
  // A boss with no spec to read is not a state this reaches in play — it is the
  // recorder and the playground. Its size still has to be SOMETHING, and the
  // smallest boss is the honest default.
  const size = bs?.size ?? 13
  const aim = bs?.aim ?? 0
  const s = JUICE_STYLE[style]
  const wide = Math.max(viewW, viewH) / pxPerU
  const tier = qualityTier()

  // ── 0 ms · the hit ──
  if (!calm) {
    screenFlash(0.85, '255,245,215')
    punchZoom(0.06)
    slowMo(640)
  }
  shake(1)
  kick(0, 1, 0.9)
  pushRing(x, y, size * 2.2, 260, 'rgba(255,255,255,0.95)', 2.4)
  // The first goo is thrown STRAIGHT UP out of the body, fast and tight: the
  // moment the shell gives, before anything has had time to spread.
  gooSpray(x, y, goo, s.drops * 2.2, size * 0.9, style)

  // ── ~90 ms · the rupture ──
  after(90, () => {
    pushRing(x, y, wide, 1100, 'rgba(255,205,0,0.95)', 3)
    // Along the blow, both ways: the two fans that a thing bursting under a
    // boot actually throws, rather than one even ring that reads as a firework.
    gooSpray(x, y, goo, s.drops * 2.4, size * 1.5, style, 1.5, aim)
    gooSpray(x, y, goo, s.drops * 2.4, size * 1.5, style, 1.5, aim + Math.PI)
    if (s.decalAlpha > 0.02) {
      stampSplat(x, y, size * s.decalScale * 1.25, `rgb(${goo[0]},${goo[1]},${goo[2]})`,
        splatSeed++, style, 1.35, aim)
    }
    shake(0.7)
  })

  // ── ~230 ms · the shout ──
  after(230, () => {
    pushRing(x, y, wide * 0.62, 760, 'rgba(255,255,255,0.8)', 1.6)
    // Straight to `pushWord`: this one is never throttled and never clamped
    // against a body radius the way a kill's is — it is the only word on screen
    // and it belongs over the boss, so it is placed by hand.
    const b = getBoard()
    pushWord(
      Math.min(Math.max(b.x0 + 18, x), b.x1 - 18),
      Math.max(b.y0 + 10, y - size * 1.15),
      wordText('ultra'), 'ultra', size * 1.5 * pxPerU
    )
    confetti(x, y, 40)
    gooSpray(x, y, goo, s.drops * 1.6, size * 1.1, style)
  })

  // ── ~430 ms · the rain ──
  after(430, () => {
    gooSpray(x, y, goo, s.drops * 1.4, size * 0.7, style)
    if (s.decalAlpha <= 0.02) return
    // Four marks thrown wide of the body. Stamped rather than drawn per frame,
    // so the floor keeps them for the rest of the level for the price of four
    // blits — and they are what makes the spot the boss died read as a SCENE
    // once the particles are gone.
    const marks = tier === 'min' ? 2 : 4
    for (let i = 0; i < marks; i++) {
      const a = aim + (i / marks) * Math.PI * 2 + Math.random() * 0.8
      const d = size * (0.9 + Math.random() * 1.1)
      stampSplat(
        x + Math.cos(a) * d, y + Math.sin(a) * d,
        size * s.decalScale * (0.34 + Math.random() * 0.3),
        `rgb(${goo[0]},${goo[1]},${goo[2]})`, splatSeed++, style,
        1 + Math.random() * 0.7, a
      )
    }
  })
}

/** A handful of dust puffs thrown out of a point — a landing, a flip, a poof. */
const dust = (x: number, y: number, n: number): void => {
  if (qualityTier() === 'min') return
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5
    emitParticle({
      x, y, vx: Math.cos(a) * 16, vy: Math.sin(a) * 16,
      life: 460, size: 1.4, color: [230, 226, 216], alpha: 0.5, drag: 5, shape: 3
    })
  }
}

/** Party confetti — paper, not goo, whatever the juice style: a celebration. */
const CONFETTI: readonly (readonly [number, number, number])[] = [
  [255, 90, 150], [90, 200, 255], [255, 217, 60], [120, 230, 120], [190, 120, 255]
]
const confetti = (x: number, y: number, n: number): void => {
  const tier = qualityTier()
  const k = tier === 'high' ? 1 : tier === 'medium' ? 0.75 : tier === 'low' ? 0.5 : 0.3
  const count = Math.round(n * k)
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = 14 + Math.random() * 30
    const c = CONFETTI[i % CONFETTI.length]!
    emitParticle({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6,
      life: 900 + Math.random() * 500, size: 0.8 + Math.random() * 0.6,
      color: [c[0], c[1], c[2]], alpha: 1, drag: 2.4, shape: 1,
      rot: Math.random() * 6.28, vrot: (Math.random() - 0.5) * 12
    })
  }
}

const WORDS: Record<string, string> = {
  squish: 'SQUISH!', crunch: 'CRUNCH!', splat: 'SPLAT!', ultra: 'ULTRA SPLAT!'
}
const wordText = (w: keyof typeof WORD_TONE): string => WORDS[w] ?? 'SPLAT!'

// ─── The frame ──────────────────────────────────────────────────────────────

const segOut = { x: 0, y: 0, a: 0 }

/** Bodies sorted back-to-front, as an index list so the sort allocates nothing
 *  beyond this one array for the life of the page. */
const order: number[] = []

/**
 * Advance every clock a frame owns and return the EFFECT dt the drawing should
 * use — which is `dtMs` normally and a third of it while a big finish or a boss
 * death is playing out in slow motion.
 *
 * Split out of `drawScene` so it can be driven without a canvas: a jsdom test
 * has no 2D context to draw into, and the staged beats a boss death queues are
 * only observable by running this. The camera is deliberately NOT slowed — a
 * shake that ran at a third speed would still be rattling when the level ended.
 */
export const stepFx = (dtMs: number): number => {
  stepCamera(dtMs)
  const fxDt = slowMs > 0 ? dtMs * SLOW_FACTOR : dtMs
  slowMs = Math.max(0, slowMs - dtMs)
  stepParticles(fxDt)
  stepTexts(fxDt)
  // On EFFECT time, so a staged sequence stays in step with the particles it is
  // staging — a boss death that ran on wall time would fire every beat of
  // itself inside the first third of its own slow motion.
  stepBeats(fxDt)
  stepSquashes(fxDt)
  return fxDt
}

export const drawScene = (
  ctx: CanvasRenderingContext2D, cssW: number, cssH: number, dtMs: number
): void => {
  const level = getLevel()
  const world = worldOf(level.id) as WorldId
  // The SURFACE is the level's and the LIGHT is the world's — see the header of
  // `floorArt.ts`. A party borrows the id of the level it follows, so it is
  // thrown on that level's floor, which is where it belongs.
  const floor = floorForLevel(level.id)
  const board = getBoard()
  const foot = getFoot()
  const boss = getBoss()
  const fever = isFever()
  const style = getJuiceStyle()
  const clean = HIDE_READOUTS

  const fxDt = stepFx(dtMs)
  bakeSlice(2)

  ctx.save()
  ctx.clearRect(0, 0, cssW, cssH)

  // ── Camera transform ──
  //
  // The focus push goes on FIRST, so the shake and the kick ride on top of the
  // pushed-in view rather than being scaled by it. Anchored at the world point
  // the win happened on; see `focusOn`.
  const fz = focusScale()
  if (fz > 1.0001) {
    const fx = toX(focusX)
    const fy = toY(focusY)
    ctx.translate(fx, fy)
    ctx.scale(fz, fz)
    ctx.translate(-fx, -fy)
  }
  if (shakeAmp > 0.001 || zoom > 0.001 || kickAmp > 0.001) {
    const edge = Math.min(cssW, cssH)
    // The wobble. Squared on purpose — it keeps a light stomp's rattle under
    // the threshold of "the screen is moving" while leaving room at the top for
    // a boss death.
    const amp = shakeAmp * shakeAmp * edge * 0.026
    // The jolt. NOT squared, and that is the point: a kick is meant to be felt
    // at small amplitudes, which is exactly what squaring takes away. Eased so
    // it leaves fast and returns slowly, the way a struck thing settles.
    // 0.015 of the short edge at full amplitude — about 10 px on a 900 px
    // screen. Measured against the alternatives on a real board: 0.022 came
    // out at 14 px, which is a cinematic jolt and too much for an action the
    // player performs every couple of seconds, and the old wobble-only slam
    // peaked at 4.7 px, which is under the threshold of being felt at all.
    const k = kickAmp * kickAmp * (3 - 2 * kickAmp) * edge * 0.015
    const sx = Math.sin(shakeT / 23) * amp + kickX * k
    const sy = Math.cos(shakeT / 17) * amp + kickY * k
    ctx.translate(cssW / 2, cssH / 2)
    ctx.scale(1 + zoom, 1 + zoom)
    ctx.translate(-cssW / 2 + sx, -cssH / 2 + sy)
  }

  // ── 1. The floor ──
  const pat = floorPattern(ctx, floor, 'board')
  if (pat) {
    ctx.fillStyle = pat
    ctx.fillRect(0, 0, cssW, cssH)
  } else {
    ctx.fillStyle = '#2a2f3f'
    ctx.fillRect(0, 0, cssW, cssH)
  }

  // ── 2. The splat history ──
  if (decals) ctx.drawImage(decals, 0, 0, cssW, cssH)

  // ── 3. Hazards ──
  for (const h of getHazards()) {
    const spec = hazardSpec(h.id)
    ctx.save()
    ctx.translate(toX(h.x), toY(h.y))
    if (h.id === 'salt' && h.charge < 0 && h.travel < 1) {
      paintSaltBurst(ctx, 26 * pxPerU, h.travel)
    }
    // The spill's glass lies tipped at the end of the lane it made.
    if (h.id === 'slick') drawSpillGlass(ctx, h)
    paintHazard(ctx, h.id, (h.id === 'conveyor' || h.id === 'sweeper' ? h.r : spec.size) * pxPerU, {
      t: h.phase,
      armed: h.id === 'magnet' && h.charge > 0,
      spent: h.id === 'salt' && h.charge < 0,
      angle: h.angle,
      crack: h.id === 'shoebox' ? 1 - Math.max(0, h.charge) / (spec.hp ?? 3) : undefined,
      stretch: h.stretch
    }, h.seed)
    ctx.restore()
  }

  // ── The sugar trail of a Rush Line, on the floor, under everything alive ──
  const rush = getRush()
  if (rush) drawRushTrail(ctx, rush)

  // ── A Bug Party pours out of the stolen sandwich ──
  const partyAt = getPartyAt()
  if (partyAt) {
    ctx.save()
    ctx.translate(toX(partyAt.x), toY(partyAt.y))
    ctx.scale(pxPerU, pxPerU)
    const wob = Math.sin(performance.now() / 110) * 0.06
    ctx.rotate(wob)
    paintPicnicProp(ctx, 'sandwich', 0, 0, 1.5)
    ctx.restore()
  }

  // ── The stink haze, over the floor and under the bodies ──
  for (const z of getHazes()) {
    if (!z.alive) continue
    ctx.save()
    ctx.translate(toX(z.x), toY(z.y))
    paintHaze(ctx, HAZE_R_PX(), 1 - z.t / 3000, Math.min(1, z.t / 600) * 0.85)
    ctx.restore()
  }

  // ── The boss's telegraphs, on the floor, under everything ──
  if (boss && boss.alive) drawBossTells(ctx, boss)

  // ── 4. The foot's shadow ──
  const shoe = getShoe()
  const heavy = foot.state === 'charge' || foot.charge > 0
  const r = stompRadius(heavy) * pxPerU
  paintFootShadow(ctx, toX(foot.x), toY(foot.y), r, foot.z, fever ? '120,80,0' : '0,0,0')

  // ── The brood: boss eggs, on the floor and in the air ──
  //
  // Each egg's clock is its OWN (`pod.hatchMs`, the scaled boss's), so a
  // half-strength Queen's egg shows the same crack at the same fraction of its
  // longer clock. A laid egg in its hop is drawn along the arc over a shadow
  // that stays on the floor, which is what says "not yet — there".
  const eggLook: EggLook = boss ? boss.spec.eggLook : 'egg'
  const eggTint = boss ? boss.spec.accent : '#ffd07a'
  const eggClock = performance.now()
  for (const pod of getPods()) {
    if (!pod.alive) continue
    let ex = pod.x
    let ey = pod.y
    let lift = 0
    if (pod.fly > 0) {
      const k = 1 - pod.fly / pod.flyMs
      ex = pod.fromX + (pod.x - pod.fromX) * k
      ey = pod.fromY + (pod.y - pod.fromY) * k
      lift = Math.sin(k * Math.PI) * EGG_HOP_U
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.beginPath()
      ctx.ellipse(toX(ex), toY(ey), POD_SIZE * 0.8 * pxPerU, POD_SIZE * 0.55 * pxPerU, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.save()
    ctx.translate(toX(ex), toY(ey - lift))
    paintPod(ctx, POD_SIZE * pxPerU, 1 - pod.t / pod.hatchMs, eggTint, {
      look: eggLook, clock: eggClock, seed: pod.seed
    })
    ctx.restore()
  }

  // ── 5. The bodies ──
  const bugs = getBugs()
  const n = getBugCount()
  order.length = 0
  for (let i = 0; i < n; i++) order.push(i)
  order.sort((a, b) => bugs[a]!.y - bugs[b]!.y)
  for (const i of order) drawBug(ctx, bugs[i]!, style)

  // …and the ones that have just stopped being bodies: flattened, fading, drawn
  // over the living so a squash in a crowd is not hidden behind an ant, and
  // under the shoe, which is the thing that flattened them.
  drawSquashes(ctx)

  // ── The boss body ──
  if (boss) {
    ctx.save()
    ctx.translate(toX(boss.x), toY(boss.y))
    if (!boss.alive) {
      const k = Math.min(1, boss.dying / 1200)
      // TWO curves, and the split is the point. The CRUSH happens inside 140 ms
      // — the body is flat before the player has finished blinking, because that
      // is what a boot does — and the roll-and-fade takes the remaining second.
      // One curve over the whole 1.2 s, which is what this was, read as a boss
      // slowly sagging: the loudest moment in the game animated like a leak.
      const hit = Math.min(1, boss.dying / 140)
      ctx.globalAlpha = 1 - k
      ctx.rotate(k * 0.8)
      ctx.scale(1 + hit * 0.34 + k * 0.22, 1 - hit * 0.42 - k * 0.26)
    } else {
      ctx.rotate(boss.aim + Math.PI / 2)
      if (boss.sub === 'windup') {
        const p = Math.min(1, boss.subT / boss.spec.windupMs)
        ctx.scale(1 - p * 0.1, 1 + p * 0.14)
      }
      // Laying: a squat as the egg leaves her, and — for the Queen holding still
      // after a spent charge — a slow heave for as long as the hold lasts, so
      // the open window LOOKS open.
      if (boss.laying > 0) {
        const q = Math.sin((boss.laying / EGG_LAY_MS) * Math.PI)
        ctx.scale(1 + q * 0.08, 1 - q * 0.1)
      } else if (boss.sub === 'spent' && boss.subT < 0) {
        const q = Math.sin(boss.subT / 110)
        ctx.scale(1 + q * 0.03, 1 - q * 0.04)
      }
    }
    paintBoss(ctx, boss.spec.id, boss.size * pxPerU, (performance.now() / 700) % 1, boss.phase)
    ctx.restore()
  }

  // ── 6. The shoe, then the ring OVER it ──
  drawShoe(ctx, foot, shoe.id, fever)
  paintStompRing(
    ctx, toX(foot.x), toY(foot.y), r, highVis,
    foot.state === 'charge' ? foot.charge : 0, fever
  )
  // A Shoebox Trial's clock: a thin ring round the shoe that drains.
  const left = trialLeft()
  if (left > 0) drawTrialRing(ctx, toX(foot.x), toY(foot.y), r * 1.28, left)
  // The Quake Slam's ring, rolling out along the floor.
  const q = getQuake()
  if (q) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = 'rgba(255,170,60,0.9)'
    ctx.lineWidth = Math.max(3, pxPerU * 1.6)
    ctx.beginPath()
    ctx.arc(toX(q.x), toY(q.y), q.r * pxPerU, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // ── 7. Effects ──
  drawRings(ctx, fxDt)
  drawArcs(ctx, fxDt)
  drawParticles(ctx, toX, toY, pxPerU)
  drawCoins(ctx, fxDt)
  if (!clean) drawWords(ctx, fxDt)

  // ── 8. The world's own light ──
  const ambient = floorAmbient(world)
  if (ambient) {
    ctx.fillStyle = ambient
    ctx.fillRect(0, 0, cssW, cssH)
  }
  paintVignette(ctx, cssW, cssH, floor, VIGNETTE_STRENGTH[world])

  // ── An Uh-oh! Twist's grade and its pictogram ──
  const twist = getTwist()
  if (twist) drawTwist(ctx, cssW, cssH, twist, foot)

  if (fever) drawFeverLights(ctx, cssW, cssH)

  if (flash > 0.001) {
    ctx.fillStyle = `rgba(${flashColour},${flash * 0.55})`
    ctx.fillRect(0, 0, cssW, cssH)
  }

  ctx.restore()
}

const HAZE_R_PX = (): number => 22 * pxPerU

/** How high a laid egg's hop peaks, u. */
const EGG_HOP_U = 5
/** An egg's goo when it is an egg: yolk. */
const EGG_YOLK = [255, 212, 88] as const

// ─── Bodies ─────────────────────────────────────────────────────────────────

let highVis = false
export const setHighVis = (v: boolean): void => { highVis = v }

const drawBug = (ctx: CanvasRenderingContext2D, b: Bug, style: JuiceStyleId): void => {
  const spec = b.spec
  const x = toX(b.x)
  const y = toY(b.y)

  // The tail first, so the head sits on top of it.
  if (spec.segments > 0 && b.segs > 0) {
    for (let k = b.segs; k >= 1; k--) {
      segmentAt(b, k, segOut)
      ctx.save()
      ctx.translate(toX(segOut.x), toY(segOut.y))
      ctx.rotate(segOut.a + Math.PI / 2)
      paintSegment(ctx, spec.size * pxPerU, k, b.cycle)
      ctx.restore()
    }
  }

  ctx.save()
  ctx.translate(x, y)

  // ── Big Finish: one to go, and every body on the board is gilded ──
  // A gold halo UNDER the body, pulsing faster as the clock runs down — it has
  // to read at 24 px on a busy floor, so it is a disc, not a hairline.
  if (finale.value) {
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 110)
    ctx.beginPath()
    ctx.arc(0, 0, spec.size * pxPerU * (1.25 + 0.12 * pulse), 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,205,40,${0.35 + 0.25 * pulse})`
    ctx.fill()
    ctx.lineWidth = Math.max(1.5, pxPerU * 0.45)
    ctx.strokeStyle = `rgba(255,236,150,${0.8 + 0.2 * pulse})`
    ctx.stroke()
  }

  // ── Beetle Bowling: a rolling puck leaves a streak and spins ──
  if (b.puck) {
    const sp = Math.hypot(b.vx, b.vy)
    const back = Math.atan2(-b.vy, -b.vx)
    const len = Math.min(18, sp * 0.16) * pxPerU
    const g = ctx.createLinearGradient(0, 0, Math.cos(back) * len, Math.sin(back) * len)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.strokeStyle = g
    ctx.lineWidth = spec.size * pxPerU * 1.4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(back) * len, Math.sin(back) * len)
    ctx.stroke()
  }

  // An airborne body is drawn LIFTED, with its own shadow on the floor below —
  // that shadow is the only cue the player has for whether it is stompable yet.
  if (spec.airborne) {
    const lift = (1 - b.dip) * spec.size * 2.2
    const sr = spec.size * (0.9 + (1 - b.dip) * 0.5) * pxPerU
    ctx.save()
    ctx.globalAlpha = 0.28 * (0.4 + b.dip * 0.6)
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.ellipse(0, 0, sr, sr * 0.7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.translate(0, -lift * pxPerU)
  }

  if (b.puck) ctx.rotate(performance.now() / 55)
  else ctx.rotate(b.heading + Math.PI / 2)
  if (b.stun > 0 && !b.puck) ctx.rotate(Math.sin(b.stun / 30) * 0.12)
  // On its back: upside down, and its belly showing.
  const onBack = b.flipped > 0 || b.puck
  if (onBack) ctx.scale(-1, 1)

  const edge = spec.size * 2 * pxPerU / BUG_R_FRAC
  const frame = bugFrame(b.id, b.cycle)
  if (frame) {
    const src = bugFrameEdge(b.id)
    const k = edge / Math.max(1, src)
    ctx.drawImage(frame, -src * k / 2, -src * k / 2, src * k, src * k)
  } else {
    // The slow path: draw it from paths. Correct, and the only cost is time.
    paintBug(ctx, b.id, spec.size * pxPerU, b.cycle)
  }

  if (onBack) {
    // The belly: a pale oval over the shell, so "on its back" reads at 24 px
    // without a second painting — soft side up is the whole message.
    ctx.beginPath()
    ctx.ellipse(0, spec.size * pxPerU * 0.08, spec.size * pxPerU * 0.62, spec.size * pxPerU * 0.78, 0, 0, Math.PI * 2)
    ctx.fillStyle = spec.accent
    ctx.globalAlpha = 0.88
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.lineWidth = Math.max(1, pxPerU * 0.3)
    ctx.strokeStyle = '#2b1b2e'
    ctx.stroke()
    // Belly plates.
    ctx.beginPath()
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(-spec.size * pxPerU * 0.45, i * spec.size * pxPerU * 0.3)
      ctx.lineTo(spec.size * pxPerU * 0.45, i * spec.size * pxPerU * 0.3)
    }
    ctx.lineWidth = Math.max(1, pxPerU * 0.18)
    ctx.stroke()
  }

  if (b.dmg > 0 && !onBack) paintDamage(ctx, spec.size * pxPerU, b.dmg / spec.hp)
  // A conga ant carries a crumb of the sandwich over its head — the intro's raid,
  // still going. Counter-turned so the crumb's light stays upper-left.
  if (b.crumb) {
    ctx.save()
    ctx.translate(0, -spec.size * pxPerU * 0.95)
    ctx.rotate(-(b.heading + Math.PI / 2))
    ctx.scale(pxPerU * 1.35, pxPerU * 1.35)
    paintPicnicProp(ctx, 'crumb', 0, 0)
    ctx.restore()
  }
  // A carrier holds its egg up in front of its head. Counter-turned so the
  // egg's light stays upper-left however the ant is walking.
  if (b.carry) {
    ctx.save()
    ctx.translate(0, -spec.size * pxPerU * 1.05)
    ctx.rotate(-(b.heading + Math.PI / 2))
    const bs = getBoss()
    paintPod(ctx, POD_SIZE * 0.72 * pxPerU, 0, bs ? bs.spec.accent : '#ffd07a', { look: bs?.spec.eggLook ?? 'egg' })
    ctx.restore()
  }
  if (b.held > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = Math.max(1, pxPerU * 0.2)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * -spec.size * pxPerU * 1.3, Math.sin(a) * -spec.size * pxPerU * 1.3)
      ctx.lineTo(Math.cos(a) * spec.size * pxPerU * 1.3, Math.sin(a) * spec.size * pxPerU * 1.3)
      ctx.stroke()
    }
  }
  ctx.restore()

  // The dodger's ALERT, unrotated so it always reads upright.
  if (b.sense > 60 && b.sense < 1e6) {
    const pop = Math.min(1.3, b.sense / 120)
    ctx.save()
    ctx.translate(x, y - spec.size * 2.4 * pxPerU)
    paintAlert(ctx, spec.size * 0.9 * pxPerU, pop)
    ctx.restore()
  }
  void style
}

// ─── The shoe ───────────────────────────────────────────────────────────────

const drawShoe = (
  ctx: CanvasRenderingContext2D, foot: ReturnType<typeof getFoot>, id: string, fever: boolean
): void => {
  const shoe = getShoe()
  // Deliberately SMALLER than the stomp radius — see `SHOE_FRAC`. The shoe has
  // to sit inside its own ring with floor showing between them, or the player
  // cannot see where the press will land.
  const half = stompRadius() * pxPerU * SHOE_FRAC * (1 + foot.z * LIFT_SCALE) * (fever ? 1.3 : 1)
  ctx.save()
  ctx.translate(toX(foot.x), toY(foot.y))
  // Turn the shoe into its travel, but only once it is actually travelling —
  // a shoe that spins to face a one-pixel jitter reads as broken.
  if (foot.speed > 6) ctx.rotate(foot.heading + Math.PI / 2)

  const painted = shoeSprite(shoe.id)
  if (painted && painted.naturalWidth > 0) {
    const w = half * 2 * (SHOE_BOX.w / 2)
    const h = w * (SHOE_BOX.h / SHOE_BOX.w)
    ctx.save()
    ctx.scale(2 - foot.squash, foot.squash)
    if (fever) { ctx.shadowColor = 'rgba(255,205,0,0.9)'; ctx.shadowBlur = half * 0.5 }
    ctx.drawImage(painted, -w / 2, -h * SHOE_BOX.toeFromTop, w, h)
    ctx.restore()
  } else {
    paintShoe(ctx, shoe.id, shoe, half, foot.squash, fever)
  }
  ctx.restore()
  void id
}

// ─── Effect layers ──────────────────────────────────────────────────────────

const drawRings = (ctx: CanvasRenderingContext2D, dt: number): void => {
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i]!
    ring.t += dt
    const p = ring.t / ring.life
    if (p >= 1) { rings.splice(i, 1); continue }
    ctx.save()
    ctx.translate(toX(ring.x), toY(ring.y))
    paintShockRing(ctx, ring.r * pxPerU, p, ring.colour, ring.thick)
    ctx.restore()
  }
}

const drawArcs = (ctx: CanvasRenderingContext2D, dt: number): void => {
  for (let i = arcs.length - 1; i >= 0; i--) {
    const a = arcs[i]!
    a.t += dt
    if (a.t > 220) { arcs.splice(i, 1); continue }
    const k = 1 - a.t / 220
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = `rgba(150,220,255,${k})`
    ctx.lineWidth = Math.max(1.5, pxPerU * 0.35 * k)
    ctx.beginPath()
    // A jagged path rather than a line: lightning that is straight is a laser.
    const steps = 5
    ctx.moveTo(toX(a.x0), toY(a.y0))
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      const jx = (Math.random() - 0.5) * pxPerU * 3 * (t < 1 ? 1 : 0)
      const jy = (Math.random() - 0.5) * pxPerU * 3 * (t < 1 ? 1 : 0)
      ctx.lineTo(toX(a.x0 + (a.x1 - a.x0) * t) + jx, toY(a.y0 + (a.y1 - a.y0) * t) + jy)
    }
    ctx.stroke()
    ctx.restore()
  }
}

const drawCoins = (ctx: CanvasRenderingContext2D, dt: number): void => {
  const s = dt / 1000
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i]!
    c.t += dt
    if (c.t > 900) { coins.splice(i, 1); continue }
    c.x += c.vx * s
    c.y += c.vy * s
    c.vx *= 0.94
    c.vy *= 0.94
    c.spin += s * 1.6
    ctx.save()
    ctx.translate(toX(c.x), toY(c.y))
    ctx.globalAlpha = Math.max(0, 1 - (c.t - 500) / 400)
    paintCoin(ctx, 2.2 * pxPerU, c.spin)
    ctx.restore()
  }
}

const drawWords = (ctx: CanvasRenderingContext2D, dt: number): void => {
  const s = dt / 1000
  // The widest a word may be drawn: the board itself, less a margin. Read once
  // per frame rather than per word.
  const board = getBoard()
  const maxWordPx = Math.max(1, (board.x1 - board.x0) * pxPerU * 0.94)
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i]!
    w.t += dt
    if (w.t > w.life) { words.splice(i, 1); continue }
    const p = w.t / w.life
    w.y += w.vy * s
    w.vy *= 0.93
    // Spring in, hold, fade out.
    const pop = p < 0.18
      ? easeBack(p / 0.18)
      : 1 - Math.max(0, (p - 0.7) / 0.3) * 0.2
    const alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3
    // Held on the board by its WIDTH, which only the canvas knows: `pushWord`
    // has no context to measure with, so it clamps the point the word is hung
    // from and this clamps the box the word actually occupies. A wide word near
    // an edge slides in rather than running off — and one as wide as the board
    // ends up centred, which is where "ULTRA SPLAT!" belongs anyway.
    ctx.font = `900 ${w.size}px Angry, system-ui, sans-serif`
    const drawn = Math.min(maxWordPx, ctx.measureText(w.text).width * pop)
    const half = drawn / 2
    const px = Math.min(
      Math.max(toX(w.x), toX(board.x0) + half),
      Math.max(toX(board.x0) + half, toX(board.x1) - half)
    )
    ctx.save()
    ctx.translate(px, toY(w.y))
    paintComicWord(ctx, w.text, w.tone, w.size, pop, w.rot, alpha, true, maxWordPx)
    ctx.restore()
  }
  // The generic float-text pool, for anything the scene wants to say that is not
  // one of the four comic words (a coin count, a bonus).
  for (const t of getTexts()) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife)
    ctx.fillStyle = t.color
    ctx.font = `900 ${t.size * pxPerU}px Angry, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.strokeStyle = '#2b1b2e'
    ctx.lineWidth = t.size * pxPerU * 0.22
    ctx.lineJoin = 'round'
    ctx.strokeText(t.text, toX(t.x), toY(t.y))
    ctx.fillText(t.text, toX(t.x), toY(t.y))
    ctx.restore()
  }
}

const easeBack = (t: number): number => {
  const c = 2.2
  const u = t - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}

// ─── Boss telegraphs ────────────────────────────────────────────────────────

const drawBossTells = (ctx: CanvasRenderingContext2D, boss: NonNullable<ReturnType<typeof getBoss>>): void => {
  const p = boss.spec.phases[boss.phase]!
  if (p.script === 'charge' && (boss.sub === 'tell' || boss.sub === 'windup')) {
    // The lane the boss is about to run down. It brightens as the wind-up
    // completes, so the player can time the counter-slam off the floor rather
    // than off the body — which is what makes the counter learnable.
    const k = boss.sub === 'windup' ? Math.min(1, boss.subT / boss.spec.windupMs) : boss.subT / CHARGE_TELL_MS * 0.4
    const len = Math.max(viewW, viewH) / pxPerU
    ctx.save()
    ctx.translate(toX(boss.x), toY(boss.y))
    ctx.rotate(boss.aim)
    ctx.globalAlpha = 0.18 + k * 0.42
    const g = ctx.createLinearGradient(0, 0, len * pxPerU, 0)
    g.addColorStop(0, 'rgba(255,80,90,0.9)')
    g.addColorStop(1, 'rgba(255,80,90,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, -boss.size * pxPerU * 0.8, len * pxPerU, boss.size * pxPerU * 1.6)
    ctx.restore()
  }
  if (p.script === 'beam') {
    const telling = boss.subT < BEAM_TELL_MS
    const len = Math.max(viewW, viewH) / pxPerU * 1.5
    ctx.save()
    ctx.translate(toX(boss.x), toY(boss.y))
    ctx.rotate(boss.aim)
    ctx.globalAlpha = telling ? 0.35 : 0.9
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createLinearGradient(0, -BEAM_HALF * pxPerU, 0, BEAM_HALF * pxPerU)
    g.addColorStop(0, 'rgba(110,240,255,0)')
    g.addColorStop(0.5, telling ? 'rgba(110,240,255,0.5)' : 'rgba(255,255,255,0.95)')
    g.addColorStop(1, 'rgba(110,240,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, -BEAM_HALF * pxPerU, len * pxPerU, BEAM_HALF * 2 * pxPerU)
    ctx.restore()
  }
  if (p.script === 'spin') {
    ctx.save()
    ctx.translate(toX(boss.x), toY(boss.y))
    ctx.strokeStyle = 'rgba(255,180,60,0.4)'
    ctx.lineWidth = pxPerU * 0.8
    ctx.setLineDash([pxPerU * 2, pxPerU * 2])
    ctx.lineDashOffset = -boss.aim * pxPerU * 4
    ctx.beginPath()
    ctx.arc(0, 0, boss.size * 1.9 * pxPerU, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

// ─── Fever ──────────────────────────────────────────────────────────────────

/** The disco. Four coloured cones sweeping from the top, over everything.
 *  Cheap — four filled triangles — and it is the whole of "the lights change". */
const drawFeverLights = (ctx: CanvasRenderingContext2D, w: number, h: number): void => {
  const t = performance.now() / 900
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const cols = ['255,64,160', '64,200,255', '160,255,110', '255,205,60']
  for (let i = 0; i < 4; i++) {
    const a = t * (0.6 + i * 0.11) + i * 1.6
    const x = w / 2 + Math.cos(a) * w * 0.5
    ctx.globalAlpha = 0.10
    const g = ctx.createLinearGradient(w / 2, 0, x, h)
    g.addColorStop(0, `rgba(${cols[i]},0.7)`)
    g.addColorStop(1, `rgba(${cols[i]},0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(w / 2 - w * 0.05, -10)
    ctx.lineTo(w / 2 + w * 0.05, -10)
    ctx.lineTo(x + w * 0.18, h + 10)
    ctx.lineTo(x - w * 0.18, h + 10)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

// ─── Rush Lines ─────────────────────────────────────────────────────────────

/**
 * The sugar trail: dotted crumbs along the lane, drawing themselves out from the
 * entry end over the tell (`view.tell`), with a chevron at the mouth saying
 * which way the conga comes. A ring formation's tell is a dotted circle that
 * breathes round the shoe instead. No painting needed — it is crumbs, and the
 * crumb colours are the floor's own pile's.
 */
const drawRushTrail = (
  ctx: CanvasRenderingContext2D,
  v: { x0: number; y0: number; x1: number; y1: number; shape: string; tell: number; life: number }
): void => {
  const alpha = Math.min(1, v.life * 1.4)
  if (alpha <= 0.01) return
  const crumb = hazardSpec('crumbs')
  ctx.save()
  ctx.globalAlpha = alpha
  if (v.shape === 'ring') {
    const r = Math.hypot(v.x1 - v.x0, v.y1 - v.y0) * pxPerU
    const breathe = 1 + Math.sin(performance.now() / 160) * 0.05
    ctx.translate(toX(v.x0), toY(v.y0))
    ctx.strokeStyle = crumb.accent
    ctx.lineWidth = Math.max(2, pxPerU * 0.7)
    ctx.setLineDash([pxPerU * 1.4, pxPerU * 2.2])
    ctx.lineDashOffset = -performance.now() / 40
    ctx.beginPath()
    ctx.arc(0, 0, r * breathe, 0, Math.PI * 2 * v.tell)
    ctx.stroke()
    ctx.restore()
    return
  }
  const len = Math.hypot(v.x1 - v.x0, v.y1 - v.y0)
  const ux = (v.x1 - v.x0) / Math.max(1e-3, len)
  const uy = (v.y1 - v.y0) / Math.max(1e-3, len)
  const shown = len * v.tell
  const step = 3.2
  for (let d = 0; d < shown; d += step) {
    // A little wobble off the line, stable per dot, so it reads as crumbs
    // dropped by somebody carrying a sandwich rather than as a ruler.
    const j = Math.sin(d * 1.7) * 0.7
    const x = v.x0 + ux * d - uy * j
    const y = v.y0 + uy * d + ux * j
    // Inked, like every crumb in the game: on a red-and-cream gingham a bare
    // tan dot disappears into whichever square it lands on.
    ctx.beginPath()
    ctx.ellipse(toX(x), toY(y), pxPerU * 0.95, pxPerU * 0.7, d, 0, Math.PI * 2)
    ctx.fillStyle = (Math.floor(d / step) % 3 === 0) ? crumb.accent : crumb.body
    ctx.fill()
    ctx.lineWidth = Math.max(1, pxPerU * 0.22)
    ctx.strokeStyle = '#2b1b2e'
    ctx.stroke()
  }
  // The chevron at the mouth, pulsing while the tell runs.
  if (v.tell < 1 || v.life > 0.85) {
    const mx = toX(v.x0 + ux * 5)
    const my = toY(v.y0 + uy * 5)
    const a = Math.atan2(uy, ux)
    const pulse = 1 + Math.sin(performance.now() / 90) * 0.15
    ctx.translate(mx, my)
    ctx.rotate(a)
    ctx.scale(pulse, pulse)
    ctx.beginPath()
    ctx.moveTo(-pxPerU * 2, -pxPerU * 2.6)
    ctx.lineTo(pxPerU * 1.6, 0)
    ctx.lineTo(-pxPerU * 2, pxPerU * 2.6)
    ctx.strokeStyle = '#fff8e0'
    ctx.lineWidth = Math.max(2, pxPerU * 0.8)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
  ctx.restore()
}

// ─── Shoebox Trials ─────────────────────────────────────────────────────────

/** The trial's clock: a thin gold ring round the shoe, draining clockwise. */
const drawTrialRing = (
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number, left: number
): void => {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-Math.PI / 2)
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(20,12,30,0.45)'
  ctx.lineWidth = Math.max(3, pxPerU * 1.1)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.stroke()
  // Red for the last two seconds: the sneaker is coming back.
  ctx.strokeStyle = left < 0.17 ? 'rgba(255,110,110,0.95)' : 'rgba(255,217,60,0.95)'
  ctx.lineWidth = Math.max(2, pxPerU * 0.7)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2 * left)
  ctx.stroke()
  ctx.restore()
}

// ─── Uh-oh! Twists ──────────────────────────────────────────────────────────

/** The spill's glass, lying on its side at the mouth of the lane it made. */
const drawSpillGlass = (
  ctx: CanvasRenderingContext2D, h: { r: number; angle: number }
): void => {
  ctx.save()
  // `ctx` is at the lane's centre; the glass is at its start end.
  ctx.rotate(h.angle)
  ctx.translate(-(h.r - 7) * pxPerU, 0)
  ctx.scale(pxPerU, pxPerU)
  ctx.scale(1, 0.72)
  paintPicnicProp(ctx, 'glass', 0, 0)
  ctx.restore()
}

/** The torch mask, baked once per size: a soft disc of "see-through". */
let torchMask: HTMLCanvasElement | null = null
let torchPx = 0
/** The darkness itself, at half resolution — it is a blur by nature. */
let darkLayer: HTMLCanvasElement | null = null

const ensureTorch = (rPx: number): HTMLCanvasElement | null => {
  if (typeof document === 'undefined') return null
  const size = Math.max(8, Math.round(rPx * 2))
  if (torchMask && torchPx === size) return torchMask
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return null
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(0.7, 'rgba(0,0,0,0.85)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  torchMask = c
  torchPx = size
  return c
}

/**
 * The twist's grade over the board, and its tell.
 *
 * The TELL is the same shape for every twist, which is the point of it: a round
 * pictogram pulsing top-centre, and the board visibly slowed under it (the sim
 * does that). A child learns "the round sign means something is about to
 * happen" once and reads every twist after it.
 */
const drawTwist = (
  ctx: CanvasRenderingContext2D, w: number, h: number,
  t: { id: TwistId; phase: 'tell' | 'active' | 'after'; k: number; stripeY: number; drift: number },
  foot: { x: number; y: number }
): void => {
  if (t.phase === 'active' && t.id === 'blackout') drawBlackout(ctx, w, h, foot, t.k)
  if (t.phase === 'active' && t.id === 'sprinkler') drawSprinkler(ctx, w, t.stripeY, t.k)
  if (t.phase === 'active' && t.id === 'draft') drawDraft(ctx, w, h, t.drift)
  if (t.phase === 'active' && t.id === 'glitch' && !calm) {
    // A few horizontal tear lines across the screen — the arcade's own glitch.
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 4; i++) {
      const y = ((performance.now() / 7 + i * 173) % h)
      ctx.fillStyle = i % 2 ? 'rgba(110,240,255,0.10)' : 'rgba(255,80,200,0.10)'
      ctx.fillRect(0, y, w, 3 + (i % 3) * 3)
    }
    ctx.restore()
  }
  // The pictogram: big and pulsing during the tell, small in the corner of the
  // eye while the twist runs.
  const board = getBoard()
  const cx = w / 2
  const cy = toY(board.y0) + Math.min(w, h) * (t.phase === 'tell' ? 0.12 : 0.07)
  const pulse = t.phase === 'tell' ? 1 + Math.sin(t.k * Math.PI * 6) * 0.12 : 1
  const r = Math.min(w, h) * (t.phase === 'tell' ? 0.075 : 0.042) * pulse
  if (t.phase === 'after') return
  ctx.save()
  ctx.translate(cx, cy)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,248,230,0.95)'
  ctx.fill()
  ctx.lineWidth = Math.max(2, r * 0.12)
  ctx.strokeStyle = '#2b1b2e'
  ctx.stroke()
  ctx.scale(r, r)
  paintTwistGlyph(ctx, t.id)
  ctx.restore()
}

/** The glyph inside the pictogram, drawn in a unit circle. */
export const paintTwistGlyph = (ctx: CanvasRenderingContext2D, id: TwistId): void => {
  const INK_C = '#2b1b2e'
  ctx.lineWidth = 0.1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = INK_C
  switch (id) {
    case 'spill': {
      // A glass on its side, and a puddle running out of it.
      ctx.save()
      ctx.rotate(-0.4)
      ctx.beginPath()
      ctx.roundRect(-0.55, -0.3, 0.7, 0.6, 0.08)
      ctx.fillStyle = 'rgba(214,236,246,0.95)'
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      ctx.beginPath()
      ctx.ellipse(0.25, 0.35, 0.45, 0.18, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#ffd95e'
      ctx.fill()
      ctx.stroke()
      break
    }
    case 'sprinkler': {
      ctx.beginPath()
      ctx.arc(0, 0.35, 0.16, 0, Math.PI * 2)
      ctx.fillStyle = '#6fb857'
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = '#3aa7ff'
      for (const a of [-0.9, -0.3, 0.3, 0.9]) {
        ctx.beginPath()
        ctx.moveTo(0, 0.25)
        ctx.quadraticCurveTo(Math.sin(a) * 0.6, -0.5, Math.sin(a) * 0.75, 0.2)
        ctx.stroke()
      }
      break
    }
    case 'blackout': {
      // A light bulb with its light out.
      ctx.beginPath()
      ctx.arc(0, -0.12, 0.38, 0, Math.PI * 2)
      ctx.fillStyle = '#56506a'
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.rect(-0.18, 0.24, 0.36, 0.22)
      ctx.fillStyle = '#9aa7bd'
      ctx.fill()
      ctx.stroke()
      break
    }
    case 'draft': {
      ctx.strokeStyle = '#5d6a84'
      for (let i = 0; i < 3; i++) {
        const y = -0.35 + i * 0.35
        ctx.beginPath()
        ctx.moveTo(-0.6, y)
        ctx.lineTo(0.3, y)
        ctx.arc(0.3, y - 0.14, 0.14, Math.PI / 2, -Math.PI / 2, true)
        ctx.stroke()
      }
      break
    }
    case 'surge': {
      ctx.fillStyle = '#57e4ff'
      for (const d of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(d * 0.1, -0.25 + (d > 0 ? 0.5 : 0))
        ctx.lineTo(d * 0.6, (d > 0 ? 0.25 : -0.25))
        ctx.lineTo(d * 0.1, 0.25 - (d > 0 ? 0 : 0.5))
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
      break
    }
    case 'glitch': {
      const cols = ['#ff50c8', '#6ef0ff', '#ffe45e']
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = cols[i % 3]!
        ctx.fillRect(-0.55 + (i % 3) * 0.38, -0.45 + Math.floor(i / 3) * 0.5, 0.32, 0.36)
      }
      break
    }
  }
}

/** The blackout: dark everywhere but a torch round the shoe, and eyes glinting
 *  where the bodies are. With reduced motion it is a plain 50 % dim. */
const drawBlackout = (
  ctx: CanvasRenderingContext2D, w: number, h: number, foot: { x: number; y: number }, k: number
): void => {
  // Fade in over the first tenth, out over the last.
  const fade = Math.min(1, k * 10, (1 - k) * 10)
  if (calm) {
    ctx.fillStyle = `rgba(8,6,20,${0.5 * fade})`
    ctx.fillRect(0, 0, w, h)
    return
  }
  const scale = 0.5
  const lw = Math.max(1, Math.round(w * scale))
  const lh = Math.max(1, Math.round(h * scale))
  if (!darkLayer) darkLayer = document.createElement('canvas')
  if (darkLayer.width !== lw || darkLayer.height !== lh) { darkLayer.width = lw; darkLayer.height = lh }
  const g = darkLayer.getContext('2d')
  if (!g) return
  g.globalCompositeOperation = 'source-over'
  g.clearRect(0, 0, lw, lh)
  g.fillStyle = `rgba(6,4,18,${0.9 * fade})`
  g.fillRect(0, 0, lw, lh)
  const rPx = TORCH_R * pxPerU * scale
  const mask = ensureTorch(rPx)
  if (mask) {
    g.globalCompositeOperation = 'destination-out'
    g.drawImage(mask, toX(foot.x) * scale - rPx, toY(foot.y) * scale - rPx, rPx * 2, rPx * 2)
    g.globalCompositeOperation = 'source-over'
  }
  ctx.drawImage(darkLayer, 0, 0, w, h)
  // Eyes in the dark: two warm dots per body outside the torch — cute, never
  // scary (the audience starts at six).
  const bugs = getBugs()
  const n = getBugCount()
  ctx.save()
  ctx.fillStyle = `rgba(255,236,150,${0.9 * fade})`
  for (let i = 0; i < n; i++) {
    const b = bugs[i]!
    const dx = b.x - foot.x
    const dy = b.y - foot.y
    if (dx * dx + dy * dy < TORCH_R * TORCH_R * 0.6) continue
    const blink = (Math.sin(performance.now() / 700 + i * 1.7) > 0.93) ? 0.2 : 1
    const ex = Math.cos(b.heading + Math.PI / 2) * b.spec.size * 0.35
    const ey = Math.sin(b.heading + Math.PI / 2) * b.spec.size * 0.35
    const hx = b.x + Math.cos(b.heading) * b.spec.size * 0.6
    const hy = b.y + Math.sin(b.heading) * b.spec.size * 0.6
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(toX(hx + ex * s), toY(hy + ey * s), pxPerU * 0.5, pxPerU * 0.5 * blink, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/** The sprinkler: a wet stripe across the board and arcs of water sweeping it. */
const drawSprinkler = (ctx: CanvasRenderingContext2D, w: number, stripeY: number, k: number): void => {
  const y = toY(stripeY)
  ctx.save()
  ctx.fillStyle = 'rgba(90,170,255,0.22)'
  ctx.fillRect(0, y - pxPerU * 5, w, pxPerU * 10)
  ctx.strokeStyle = 'rgba(170,220,255,0.75)'
  ctx.lineWidth = Math.max(1.5, pxPerU * 0.4)
  ctx.lineCap = 'round'
  const sweep = Math.sin(k * Math.PI * 6)
  const hx = toX(getBoard().x0) - pxPerU * 2
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + sweep * 0.5 + i * 0.12
    const len = w * (0.55 + i * 0.1)
    ctx.beginPath()
    ctx.moveTo(hx, y)
    ctx.quadraticCurveTo(hx + Math.cos(a) * len * 0.5, y - pxPerU * 28, hx + Math.cos(a) * len, y + Math.sin(a) * pxPerU * 4)
    ctx.stroke()
  }
  ctx.restore()
}

/** The draught: pale streaks blowing across the board the way it pushes. */
const drawDraft = (ctx: CanvasRenderingContext2D, w: number, h: number, drift: number): void => {
  const dir = drift >= 0 ? 1 : -1
  const t = performance.now() / 1000
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = Math.max(1.5, pxPerU * 0.35)
  ctx.lineCap = 'round'
  for (let i = 0; i < 9; i++) {
    const y = ((i * 97) % 100) / 100 * h
    const x = ((t * 0.6 * dir + i * 0.37) % 1 + 1) % 1 * w
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + dir * pxPerU * 14, y + Math.sin(t * 3 + i) * pxPerU * 1.5)
    ctx.stroke()
  }
  ctx.restore()
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

/** Wipe everything the renderer holds — called at the start of every level. */
export const resetArt = (): void => {
  clearParticles()
  clearTexts()
  rings.length = 0
  words.length = 0
  // …and the throttle with them, or a level that restarts inside the gap opens
  // by swallowing its first shout.
  lastWordAt = -1e9
  arcs.length = 0
  coins.length = 0
  squashes.length = 0
  // A boss death queues beats up to ~430 ms out. Dropped rather than run, so a
  // replay started before the last one finished cannot stamp the old boss's goo
  // onto the new level's floor.
  beats.length = 0
  shakeAmp = 0
  kickAmp = 0
  zoom = 0
  flash = 0
  slowMs = 0
  // Snapped, not released: a retry tapped during the hold must open on a square
  // board, and a 260 ms ramp would spend it sliding out of the last level's win.
  focusAmount = 0
  focusK = 0
  focusTo = 0
  resetDecals()
}

/** A float text at a world point — the scene's way of saying a number. */
export const floatText = (
  x: number, y: number, text: string, colour: string, size = 3.4
): void => {
  emitText({ x, y, text, color: colour, size, life: 900, vy: -10 } as never)
}

// A painting arriving mid-level invalidates only what was baked FROM it: a
// floor tile drops ONE floor's pattern, anything else is handled by the caches
// that own it (`bugArt`, `spriteStrip`). A flag flip or a refresh passes null
// and drops everything.
//
// `floor-<w>` is a painting of a world's LEAD floor — the gingham blanket, the
// attic's boards — and `resetFloor` handed a world drops exactly that one. The
// other thirty-six floors are procedural and can never be staled by a download,
// which is why a painting landing on 1-1 no longer throws away 1-7's board.
onArtChanged((change) => {
  if (!change) { resetFloors(); return }
  if (change.kind === 'bg' && change.id.startsWith('floor-')) {
    const w = Number(change.id.slice('floor-'.length))
    if (w >= 1 && w <= 4) resetFloor(w as WorldId)
  }
})

/** Test seam: the live comic words, for the cases that pin WHERE one lands —
 *  which is the whole of the fix for a word printed under a player's thumb. */
export const __words = (): readonly Word[] => words

/** Test seam: the renderer's own counters. */
export const __artStats = () => ({
  rings: rings.length, words: words.length, coins: coins.length,
  arcs: arcs.length, squashes: squashes.length, beats: beats.length,
  decals: decalCount, pxPerU, dpr,
  touch: isTouchInput()
})
