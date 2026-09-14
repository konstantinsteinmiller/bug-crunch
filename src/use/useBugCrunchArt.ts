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
import { paintCoin, paintHaze, paintHazard, paintPod, paintSaltBurst } from '@/game/propArt'
import {
  floorAmbient, floorPattern, paintVignette, resetFloor, resetFloors, VIGNETTE_STRENGTH
} from '@/game/floorArt'
import { paintAlert, paintComicWord, paintShockRing, paintSplat, WORD_TONE } from '@/game/uiArt'
import { JUICE_STYLE, burstColour, type JuiceStyleId } from '@/game/juiceStyle'
import { bugSpec, type BugId } from '@/game/bugs'
import { hazardSpec } from '@/game/hazards'
import { worldOf, type WorldId } from '@/game/stages'
import { onArtChanged } from '@/game/art'
import {
  getBoard, getBoss, getBugCount, getBugs, getFoot, getHazards, getHazes,
  getJuiceStyle, getLevel, getPods, getShoe, isFever, isTouchInput,
  segmentAt, stompRadius, type Bug, type GameEvent
} from '@/use/useBugCrunchGame'
import { CHARGE_TELL_MS, CHARGE_WINDUP_MS, POD_HATCH_MS, POD_SIZE, BEAM_HALF, BEAM_TELL_MS } from '@/game/bosses'
import { HIDE_READOUTS } from '@/game/previewFeed'

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

export const punchZoom = (amount: number): void => {
  zoom = Math.max(zoom, amount)
}

export const screenFlash = (amount: number, rgb = '255,255,255'): void => {
  flash = Math.max(flash, amount)
  flashColour = rgb
}

const stepCamera = (dt: number): void => {
  shakeT += dt
  shakeAmp = Math.max(0, shakeAmp - dt / 420)
  zoom = Math.max(0, zoom - dt / 300)
  flash = Math.max(0, flash - dt / 240)
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

interface Word { x: number; y: number; text: string; tone: keyof typeof WORD_TONE; t: number; life: number; rot: number; size: number; vy: number }
const words: Word[] = []
const MAX_WORDS = 10

export const pushWord = (
  x: number, y: number, text: string, tone: keyof typeof WORD_TONE, size: number
): void => {
  if (words.length >= MAX_WORDS) words.shift()
  words.push({
    x, y, text, tone, t: 0, life: 720,
    rot: (Math.random() - 0.5) * 0.36, size, vy: -14
  })
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
        burst(e.x, e.y, e.bug, e.heavy, style)
        if (s.decalAlpha > 0.02) {
          stampSplat(
            e.x, e.y, spec.size * s.decalScale * (e.heavy ? 1.35 : 1),
            `rgb(${spec.goo[0]},${spec.goo[1]},${spec.goo[2]})`,
            splatSeed++, style, e.stretch, e.angle
          )
        }
        pushRing(e.x, e.y, spec.size * 2.4, 320, `rgba(${spec.goo[0]},${spec.goo[1]},${spec.goo[2]},0.9)`, 0.7)
        if (e.mult >= 3) {
          pushWord(e.x, e.y, wordText(e.word), e.word, spec.size * 1.5 * pxPerU)
        }
        shake(0.1 + Math.min(0.4, e.mult / 60))
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
        pushRing(e.x, e.y, r * 1.1, e.heavy ? 420 : 260,
          e.heavy ? 'rgba(255,232,150,0.95)' : 'rgba(255,255,255,0.8)', e.heavy ? 1.6 : 1)
        const tier = qualityTier()
        const n = tier === 'min' ? 0 : e.heavy ? 16 : 7
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2
          emitParticle({
            x: e.x + Math.cos(a) * r * 0.7, y: e.y + Math.sin(a) * r * 0.7,
            vx: Math.cos(a) * 22, vy: Math.sin(a) * 22,
            life: 420, size: r * 0.16,
            color: [230, 226, 216], alpha: 0.5, drag: 4.5, shape: 3
          })
        }
        shake(e.heavy ? 0.45 : 0.12)
        if (e.heavy) punchZoom(0.012)
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
        pushRing(e.x, e.y, Math.max(viewW, viewH) / pxPerU, 1100, 'rgba(255,205,0,0.95)', 3)
        screenFlash(0.8, '255,230,150')
        punchZoom(0.05)
        shake(1)
        break
      case 'podPop':
        pushRing(e.x, e.y, POD_SIZE * 3, 380, 'rgba(255,240,200,0.9)', 1)
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2
          emitParticle({
            x: e.x, y: e.y, vx: Math.cos(a) * 24, vy: Math.sin(a) * 24,
            life: 520, size: 0.6, color: [240, 220, 174], drag: 3.4, shape: 1,
            rot: Math.random() * 6.28, vrot: (Math.random() - 0.5) * 10
          })
        }
        shake(0.2)
        break
      case 'podHatch':
        screenFlash(0.12, '255,120,120')
        break
      case 'sweep':
        shake(0.18)
        break
      default:
        break
    }
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

export const drawScene = (
  ctx: CanvasRenderingContext2D, cssW: number, cssH: number, dtMs: number
): void => {
  const level = getLevel()
  const world = worldOf(level.id) as WorldId
  const board = getBoard()
  const foot = getFoot()
  const boss = getBoss()
  const fever = isFever()
  const style = getJuiceStyle()
  const clean = HIDE_READOUTS

  stepCamera(dtMs)
  stepParticles(dtMs)
  stepTexts(dtMs)
  bakeSlice(2)

  ctx.save()
  ctx.clearRect(0, 0, cssW, cssH)

  // ── Camera transform ──
  if (shakeAmp > 0.001 || zoom > 0.001) {
    const amp = shakeAmp * shakeAmp * Math.min(cssW, cssH) * 0.026
    const sx = Math.sin(shakeT / 23) * amp
    const sy = Math.cos(shakeT / 17) * amp
    ctx.translate(cssW / 2, cssH / 2)
    ctx.scale(1 + zoom, 1 + zoom)
    ctx.translate(-cssW / 2 + sx, -cssH / 2 + sy)
  }

  // ── 1. The floor ──
  const pat = floorPattern(ctx, world, 'board')
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
    paintHazard(ctx, h.id, (h.id === 'conveyor' || h.id === 'sweeper' ? h.r : spec.size) * pxPerU, {
      t: h.phase,
      armed: h.id === 'magnet' && h.charge > 0,
      spent: h.id === 'salt' && h.charge < 0,
      angle: h.angle
    }, h.seed)
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

  // ── The boss egg pods ──
  for (const pod of getPods()) {
    if (!pod.alive) continue
    ctx.save()
    ctx.translate(toX(pod.x), toY(pod.y))
    paintPod(ctx, POD_SIZE * pxPerU, 1 - pod.t / POD_HATCH_MS, boss ? boss.spec.accent : '#ffd07a')
    ctx.restore()
  }

  // ── 5. The bodies ──
  const bugs = getBugs()
  const n = getBugCount()
  order.length = 0
  for (let i = 0; i < n; i++) order.push(i)
  order.sort((a, b) => bugs[a]!.y - bugs[b]!.y)
  for (const i of order) drawBug(ctx, bugs[i]!, style)

  // ── The boss body ──
  if (boss) {
    ctx.save()
    ctx.translate(toX(boss.x), toY(boss.y))
    if (!boss.alive) {
      const k = Math.min(1, boss.dying / 1200)
      ctx.globalAlpha = 1 - k
      ctx.rotate(k * 0.8)
      ctx.scale(1 + k * 0.3, 1 - k * 0.4)
    } else {
      ctx.rotate(boss.aim + Math.PI / 2)
      if (boss.sub === 'windup') {
        const p = Math.min(1, boss.subT / CHARGE_WINDUP_MS)
        ctx.scale(1 - p * 0.1, 1 + p * 0.14)
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

  // ── 7. Effects ──
  drawRings(ctx, dtMs)
  drawArcs(ctx, dtMs)
  drawParticles(ctx, toX, toY, pxPerU)
  drawCoins(ctx, dtMs)
  if (!clean) drawWords(ctx, dtMs)

  // ── 8. The world's own light ──
  const ambient = floorAmbient(world)
  if (ambient) {
    ctx.fillStyle = ambient
    ctx.fillRect(0, 0, cssW, cssH)
  }
  paintVignette(ctx, cssW, cssH, world, VIGNETTE_STRENGTH[world])

  if (fever) drawFeverLights(ctx, cssW, cssH)

  if (flash > 0.001) {
    ctx.fillStyle = `rgba(${flashColour},${flash * 0.55})`
    ctx.fillRect(0, 0, cssW, cssH)
  }

  ctx.restore()
}

const HAZE_R_PX = (): number => 22 * pxPerU

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

  ctx.rotate(b.heading + Math.PI / 2)
  if (b.stun > 0) ctx.rotate(Math.sin(b.stun / 30) * 0.12)

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

  if (b.dmg > 0) paintDamage(ctx, spec.size * pxPerU, b.dmg / spec.hp)
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
    ctx.save()
    ctx.translate(toX(w.x), toY(w.y))
    paintComicWord(ctx, w.text, w.tone, w.size, pop, w.rot, alpha)
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
    const k = boss.sub === 'windup' ? Math.min(1, boss.subT / CHARGE_WINDUP_MS) : boss.subT / CHARGE_TELL_MS * 0.4
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

// ─── Lifecycle ──────────────────────────────────────────────────────────────

/** Wipe everything the renderer holds — called at the start of every level. */
export const resetArt = (): void => {
  clearParticles()
  clearTexts()
  rings.length = 0
  words.length = 0
  arcs.length = 0
  coins.length = 0
  shakeAmp = 0
  zoom = 0
  flash = 0
  resetDecals()
}

/** A float text at a world point — the scene's way of saying a number. */
export const floatText = (
  x: number, y: number, text: string, colour: string, size = 3.4
): void => {
  emitText({ x, y, text, color: colour, size, life: 900, vy: -10 } as never)
}

// A painting arriving mid-level invalidates only what was baked FROM it: a
// floor tile drops that world's pattern, anything else is handled by the caches
// that own it (`bugArt`, `spriteStrip`). A flag flip or a refresh passes null
// and drops everything.
onArtChanged((change) => {
  if (!change) { resetFloors(); return }
  if (change.kind === 'bg' && change.id.startsWith('floor-')) {
    const w = Number(change.id.slice('floor-'.length))
    if (w >= 1 && w <= 4) resetFloor(w as WorldId)
  }
})

/** Test seam: the renderer's own counters. */
export const __artStats = () => ({
  rings: rings.length, words: words.length, coins: coins.length,
  arcs: arcs.length, decals: decalCount, pxPerU, dpr,
  touch: isTouchInput()
})
