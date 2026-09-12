import { LANE_HALF } from '@/game/survival'
import {
  anchor, frostActive, frostLeft01, getBoss, getDecoy, getFoes, phase
} from '@/use/useSurvivalGame'
import { emit, emitDecal, type FxEvent, type QualityTier } from '@/use/useVfx'
import { playFx, startFlareBurn, stopFlareBurn } from '@/use/useGameAudio'
import { useScreenshake } from '@/use/useScreenshake'
import { haptic } from '@/use/useHaptics'
import { getRamp, putRamp } from '@/use/useGradientRamps'

/**
 * ─── The two late skills, on screen ─────────────────────────────────────────
 *
 * Frost Nova and the Decoy Flare are the loudest things the PLAYER does, and
 * they have to look it: the brief was "very visible, powerful". So each is built
 * from every channel the renderer has — a shape that travels, particles, a
 * full-screen grade, a shake, a haptic and a sound with a room around it — and
 * each has a look nothing else in the game shares:
 *
 *   FROST  ice-white and glacier blue. A ring that leaves the crowd and crosses
 *          the whole screen in half a second, ice growing over every body as it
 *          passes, frost creeping in from the screen's edges for as long as the
 *          world is held, cracks in the ice as the thaw comes, and every block
 *          bursting at once when it does.
 *   FLARE  signal red. A canister lobbed to the far rail, a flame hanging under
 *          a little parachute with a pool of red light pulsing on the road below
 *          it and sonar rings going out from it — the lure made visible — sparks
 *          raining off it, and a burst of fire when it burns down.
 *
 * In its own module rather than in `useSurvivalArt`, because that file is the
 * whole renderer and these are two skills: the renderer hands this a view each
 * frame (`syncSkillView`), routes the six events here (`applySkillFx`) and calls
 * four draws at the layers they belong to. Nothing here decides anything —
 * every clock it draws is read off the simulation (`frostLeft01`, `getDecoy`).
 */

const { triggerShake } = useScreenshake()

// ─── The view, latched by the renderer once a frame ────────────────────────

let toX = (wx: number): number => wx
let toY = (wy: number): number => wy
let scale = 40
let viewW = 0
let viewH = 0
let cheap = false
let rich = true

export const syncSkillView = (
  x: (wx: number) => number,
  y: (wy: number) => number,
  s: number,
  w: number,
  h: number,
  tier: QualityTier
): void => {
  toX = x
  toY = y
  scale = s
  viewW = w
  viewH = h
  cheap = tier === 'low' || tier === 'min'
  rich = tier === 'high'
}

// ─── Colours ────────────────────────────────────────────────────────────────

const ICE_WHITE: [number, number, number] = [232, 248, 255]
const ICE_BLUE: [number, number, number] = [150, 210, 255]
const ICE_DEEP: [number, number, number] = [96, 170, 235]
const FLARE_HOT: [number, number, number] = [255, 236, 222]
const FLARE_RED: [number, number, number] = [255, 64, 84]
const FLARE_EMBER: [number, number, number] = [255, 150, 90]

// ─── Transient state ────────────────────────────────────────────────────────

interface Nova { sx: number; sy: number; age: number }
/** The ring on its way across the screen. Screen-space, because it is a thing
 *  crossing the SCREEN — its job is to reach every corner in half a second. */
const novas: Nova[] = []
const NOVA_MS = 520

interface Ring { x: number; y: number; age: number; life: number; r: number; rgb: string; width: number }
/** World-space rings on the road: the flare's burst shockwave. */
const rings: Ring[] = []

/** The skills' own full-screen flash — kept apart from the renderer's so a nova
 *  landing on the same frame as a boss hit does not erase either. */
let flash = 0
let flashRgb = '205,240,255'

/** How much of the screen's frost is showing, eased toward the simulation. */
let frostVis = 0
/** A white crack-flash at the thaw, fading. */
let thawFlash = 0

/** Is the flare's burn loop sounding? Stopped the frame the flare is gone. */
let burning = false

/** Seconds of the flare's own clock, for its pulse — wall time, like the other
 *  decorations: nothing is waiting for a flicker to finish. */
let flareClock = 0

/** Deterministic per-id noise, so a body's ice has the same facets every frame. */
const hash = (n: number): number => {
  let h = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b) >>> 0
  return (h >>> 8) / 0x1000000
}

// ─── Events ─────────────────────────────────────────────────────────────────

/** Does this event belong to the late skills? The renderer asks before routing. */
export const isSkillFx = (e: FxEvent): boolean =>
  e.kind === 'frostNova' || e.kind === 'frostShatter' || e.kind === 'frostThaw' ||
  e.kind === 'decoyThrow' || e.kind === 'decoyLit' || e.kind === 'decoyBurst'

/** The flare's side of the road, as a stereo pan. */
const panFor = (x: number): number => Math.max(-1, Math.min(1, x / LANE_HALF)) * 0.7

export const applySkillFx = (e: FxEvent): void => {
  switch (e.kind) {
    case 'frostNova': {
      playFx('frostNova')
      triggerShake('big')
      haptic('impact')
      flash = 0.62
      flashRgb = '210,242,255'
      frostVis = 1
      novas.push({ sx: toX(e.x), sy: toY(e.y), age: 0 })
      // The crowd's own burst: shards thrown out along the ring, sparkles racing
      // ahead of it, and a cold mist rolling off the squad.
      const shards = cheap ? 20 : 48
      for (let i = 0; i < shards; i++) {
        const a = (i / shards) * Math.PI * 2 + Math.random() * 0.2
        const sp = 7 + Math.random() * 11
        emit({
          x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7,
          life: 520 + Math.random() * 420, size: 0.12 + Math.random() * 0.14,
          color: Math.random() < 0.5 ? ICE_WHITE : ICE_BLUE, shape: 1,
          gravity: 2, drag: 1.4, rot: a, vrot: (Math.random() - 0.5) * 16
        })
      }
      for (let i = 0; i < (cheap ? 14 : 36); i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 12 + Math.random() * 10
        emit({
          x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7,
          life: 300 + Math.random() * 220, size: 0.1 + Math.random() * 0.06,
          color: ICE_WHITE, additive: true, shape: 2, drag: 2.2
        })
      }
      if (!cheap) {
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2
          emit({
            x: e.x + Math.cos(a) * 1.2, y: e.y + Math.sin(a) * 0.8,
            vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 1.6 + 0.6,
            life: 1100 + Math.random() * 500, size: 0.5 + Math.random() * 0.3,
            color: [190, 226, 255], alpha: 0.45, shape: 3, drag: 1.1
          })
        }
      }
      break
    }

    case 'frostShatter': {
      playFx('frostShatter')
      const n = cheap ? 7 : e.big ? 18 : 12
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 3 + Math.random() * 6
        emit({
          x: e.x, y: e.y + 0.45, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 + 2.4,
          life: 420 + Math.random() * 300, size: 0.09 + Math.random() * 0.1,
          color: Math.random() < 0.6 ? ICE_WHITE : ICE_BLUE, shape: 1,
          gravity: 12, drag: 1.1, rot: a, vrot: (Math.random() - 0.5) * 20
        })
      }
      for (let i = 0; i < (cheap ? 2 : 5); i++) {
        const a = Math.random() * Math.PI * 2
        emit({
          x: e.x, y: e.y + 0.45, vx: Math.cos(a) * 6, vy: Math.sin(a) * 4,
          life: 220, size: 0.08, color: ICE_WHITE, additive: true, shape: 2, drag: 3
        })
      }
      break
    }

    case 'frostThaw': {
      playFx('frostThaw')
      triggerShake('small')
      thawFlash = 1
      frostVis = Math.min(frostVis, 0.9)
      // Every block still standing bursts at once — capped, so a road of forty
      // frozen bodies is a hail of ice rather than a stall.
      let budget = cheap ? 80 : 200
      const burstAt = (x: number, y: number, big: boolean): void => {
        const n = Math.min(budget, big ? 22 : 9)
        budget -= n
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2
          const sp = 2 + Math.random() * (big ? 8 : 5)
          const tone = Math.random()
          emit({
            x, y: y + (big ? 1.2 : 0.5), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 + 2,
            life: 380 + Math.random() * 300, size: 0.08 + Math.random() * (big ? 0.16 : 0.09),
            // Mostly white and pale, with a third of the block's deep core in it.
            color: tone < 0.45 ? ICE_WHITE : tone < 0.8 ? ICE_BLUE : ICE_DEEP, shape: 1,
            gravity: 11, drag: 1.2, rot: a, vrot: (Math.random() - 0.5) * 18
          })
        }
      }
      const b = getBoss()
      if (b && !b.dead) burstAt(b.x, b.y, true)
      for (const f of getFoes()) {
        if (budget <= 0) break
        if (f.dead) continue
        const sy = toY(f.y)
        if (sy < -60 || sy > viewH + 60) continue
        burstAt(f.x, f.y, f.elite)
      }
      break
    }

    case 'decoyThrow':
      playFx('decoyThrow', 0, panFor(e.tx))
      for (let i = 0; i < (cheap ? 4 : 10); i++) {
        const a = Math.atan2(e.ty - e.y, e.tx - e.x) + (Math.random() - 0.5) * 0.9
        emit({
          x: e.x, y: e.y + 0.3, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5,
          life: 200 + Math.random() * 160, size: 0.07, color: FLARE_EMBER,
          additive: true, shape: 2, drag: 2.6
        })
      }
      break

    case 'decoyLit': {
      const pan = panFor(e.x)
      playFx('decoyLit', 0, pan)
      startFlareBurn(e.seconds, pan)
      burning = true
      triggerShake('small')
      haptic('tick')
      flash = Math.max(flash, 0.22)
      flashRgb = '255,120,130'
      flareClock = 0
      const air = e.y + hangPx() / Math.max(1, scale)
      for (let i = 0; i < (cheap ? 12 : 32); i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 3 + Math.random() * 7
        emit({
          x: e.x, y: air, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 360 + Math.random() * 360, size: 0.08 + Math.random() * 0.07,
          color: Math.random() < 0.5 ? FLARE_HOT : FLARE_RED, additive: true, shape: 2,
          drag: 1.8, gravity: 5
        })
      }
      rings.push({ x: e.x, y: e.y, age: 0, life: 520, r: 2.6, rgb: '255,90,110', width: 0.16 })
      break
    }

    case 'decoyBurst': {
      const pan = panFor(e.x)
      playFx('decoyBurst', 0, pan)
      stopFlareBurn()
      burning = false
      triggerShake('big')
      haptic('impact')
      flash = Math.max(flash, 0.46)
      flashRgb = '255,140,110'
      emitDecal(e.x, e.y, e.radius * 0.8, 0.55)
      rings.push({ x: e.x, y: e.y, age: 0, life: 420, r: e.radius * 1.15, rgb: '255,210,160', width: 0.3 })
      rings.push({ x: e.x, y: e.y, age: -60, life: 620, r: e.radius * 1.5, rgb: '255,80,90', width: 0.14 })
      const n = cheap ? 26 : 64
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const ring = i % 3 === 0
        const sp = ring ? e.radius * 5 + Math.random() * 4 : 2 + Math.random() * e.radius * 2.6
        emit({
          x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 + 2,
          life: ring ? 260 + Math.random() * 160 : 560 + Math.random() * 480,
          size: ring ? 0.1 + Math.random() * 0.06 : 0.14 + Math.random() * 0.16,
          color: ring ? FLARE_HOT : Math.random() < 0.5 ? FLARE_EMBER : FLARE_RED,
          additive: true, shape: ring ? 2 : 0, drag: ring ? 2.4 : 1.3, gravity: ring ? 0 : 3
        })
      }
      if (!cheap) {
        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2
          emit({
            x: e.x + Math.cos(a) * 0.8, y: e.y + Math.sin(a) * 0.5,
            vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.2 + 1.8,
            life: 1100 + Math.random() * 500, size: 0.55 + Math.random() * 0.3,
            color: [96, 60, 64], alpha: 0.5, shape: 3, drag: 1.2
          })
        }
      }
      break
    }

    default:
      break
  }
}

// ─── The clocks, per frame ──────────────────────────────────────────────────

export const stepSkillFx = (dtMs: number): void => {
  for (let i = novas.length - 1; i >= 0; i--) {
    novas[i]!.age += dtMs
    if (novas[i]!.age > NOVA_MS) novas.splice(i, 1)
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i]!.age += dtMs
    if (rings[i]!.age > rings[i]!.life) rings.splice(i, 1)
  }
  flash = Math.max(0, flash - dtMs / 380)
  thawFlash = Math.max(0, thawFlash - dtMs / 420)
  const want = frostActive() ? 1 : 0
  frostVis += (want - frostVis) * Math.min(1, dtMs / (want > frostVis ? 90 : 260))
  if (frostVis < 0.004) frostVis = 0

  const d = getDecoy()
  if (d && d.lit) flareClock += dtMs / 1000
  // The burn loop outlives nothing: a flare that is gone — burst, a stage that
  // ended under it, a wipe — takes its sound with it this frame.
  const live = d !== null && d.lit && (phase.value === 'run' || phase.value === 'boss')
  if (burning && !live) {
    stopFlareBurn()
    burning = false
  }

  // A little weather while the world is held: flakes drifting down the screen,
  // so even a road with nothing on it reads as frozen.
  if (frostActive() && !cheap && Math.random() < dtMs / 45) {
    const a = anchor()
    emit({
      x: (Math.random() * 2 - 1) * (LANE_HALF + 1), y: a.y + 2 + Math.random() * 14,
      vx: (Math.random() - 0.5) * 0.6, vy: -0.8 - Math.random() * 0.8,
      life: 1400 + Math.random() * 800, size: 0.06 + Math.random() * 0.06,
      color: ICE_WHITE, additive: true, shape: 0, drag: 0.2
    })
  }
}

// ─── Frozen bodies ──────────────────────────────────────────────────────────

/** How far the nova has travelled toward a point on screen, 0 → 1. The ice on a
 *  body appears as the ring PASSES it, not all at once on the cast frame. */
const novaReach = (sx: number, sy: number): number => {
  if (novas.length === 0) return 1
  const n = novas[novas.length - 1]!
  const k = Math.min(1, n.age / NOVA_MS)
  const r = (1 - (1 - k) ** 3) * Math.hypot(viewW, viewH) * 1.05
  const dist = Math.hypot(sx - n.sx, sy - n.sy)
  return Math.max(0, Math.min(1, (r - dist) / Math.max(24, scale * 1.4) + 0.05))
}

const frostTints = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()

/** The frame, glazed: its own pixels tinted glacier blue on a canvas that holds
 *  only the sprite (`source-atop` on the scene canvas would glaze the road). */
const frostTint = (frame: HTMLCanvasElement): HTMLCanvasElement | null => {
  const hit = frostTints.get(frame)
  if (hit) return hit
  if (typeof document === 'undefined' || frame.width === 0 || frame.height === 0) return null
  const c = document.createElement('canvas')
  c.width = frame.width
  c.height = frame.height
  const g = c.getContext('2d')
  if (!g) return null
  g.drawImage(frame, 0, 0)
  g.globalCompositeOperation = 'source-atop'
  const grad = g.createLinearGradient(0, 0, 0, c.height)
  grad.addColorStop(0, 'rgba(236,250,255,0.78)')
  grad.addColorStop(0.55, 'rgba(150,212,255,0.66)')
  grad.addColorStop(1, 'rgba(92,160,230,0.7)')
  g.fillStyle = grad
  g.fillRect(0, 0, c.width, c.height)
  frostTints.set(frame, c)
  return c
}

/**
 * Ice over one body, in the body's own transform (feet at the origin).
 *
 * Three layers: the sprite glazed blue (so the body itself reads as frozen,
 * not merely as standing behind glass), a faceted block of ice around it with a
 * lit edge and a highlight — the silhouette that says "encased" from across the
 * screen — and, as the thaw comes, cracks running through the block.
 *
 * `left`/`top`/`dw`/`dh` are the sprite's own box as the caller drew it,
 * `mirror` its facing; `bodyW` is how wide the block should be.
 */
export const drawIceOn = (
  ctx: CanvasRenderingContext2D,
  frame: HTMLCanvasElement | null,
  mirror: number,
  left: number,
  top: number,
  dw: number,
  dh: number,
  bodyW: number,
  seed: number,
  sx: number,
  sy: number
): void => {
  const reach = novaReach(sx, sy)
  if (reach <= 0) return
  const left01 = frostLeft01()
  const k = reach * Math.min(1, frostVis * 1.4)
  if (k <= 0.01) return

  ctx.save()
  // The last second of the freeze: the ice strains — a shiver, then cracks.
  const crack = left01 < 0.28 ? 1 - left01 / 0.28 : 0
  if (crack > 0.4) ctx.translate((Math.random() - 0.5) * crack * 2.2, 0)

  if (frame) {
    const tint = frostTint(frame)
    if (tint) {
      ctx.save()
      ctx.globalAlpha = 0.86 * k
      ctx.scale(mirror, 1)
      ctx.drawImage(tint, left, top, dw, dh)
      ctx.restore()
    }
  }

  // ── The block ──
  const w = bodyW
  const topY = top + dh * 0.1
  const botY = dh * 0.05
  const hgt = botY - topY
  const j = (i: number): number => (hash(seed * 31 + i) - 0.5) * w * 0.14
  const pts: Array<[number, number]> = [
    [-w * 0.5 + j(1), botY],
    [-w * 0.58 + j(2), botY - hgt * 0.42],
    [-w * 0.38 + j(3), topY + hgt * 0.06],
    [j(4) * 0.8, topY - hgt * 0.04],
    [w * 0.4 + j(5), topY + hgt * 0.1],
    [w * 0.57 + j(6), botY - hgt * 0.46],
    [w * 0.5 + j(7), botY]
  ]
  ctx.beginPath()
  ctx.moveTo(pts[0]![0], pts[0]![1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1])
  ctx.closePath()
  ctx.globalAlpha = 0.26 * k
  ctx.fillStyle = '#aee0ff'
  ctx.fill()
  ctx.globalAlpha = 0.85 * k
  ctx.strokeStyle = '#eaf8ff'
  ctx.lineWidth = Math.max(1.2, scale * 0.045)
  ctx.lineJoin = 'round'
  ctx.stroke()

  if (!cheap) {
    // Facets: two lines from the crown down into the block, and the lit face.
    ctx.globalAlpha = 0.4 * k
    ctx.lineWidth = Math.max(0.8, scale * 0.025)
    ctx.beginPath()
    ctx.moveTo(pts[3]![0], pts[3]![1])
    ctx.lineTo(pts[3]![0] - w * 0.12, botY - hgt * 0.3)
    ctx.lineTo(pts[1]![0], pts[1]![1])
    ctx.moveTo(pts[3]![0] - w * 0.12, botY - hgt * 0.3)
    ctx.lineTo(pts[5]![0], pts[5]![1])
    ctx.stroke()

    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.55 * k
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(1.2, scale * 0.06)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(pts[2]![0] + w * 0.1, pts[2]![1] + hgt * 0.1)
    ctx.lineTo(pts[2]![0] + w * 0.02, pts[2]![1] + hgt * 0.34)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }

  // ── Cracks, as the thaw comes ──
  if (crack > 0) {
    ctx.globalAlpha = Math.min(1, crack * 1.2) * k
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = Math.max(1, scale * 0.035)
    ctx.beginPath()
    for (let c = 0; c < 3; c++) {
      const ox = (hash(seed * 7 + c) - 0.5) * w * 0.7
      const oy = topY + hgt * (0.2 + hash(seed * 11 + c) * 0.5)
      const len = hgt * 0.45 * crack
      ctx.moveTo(ox, oy)
      ctx.lineTo(ox + (hash(seed + c * 3) - 0.5) * w * 0.3, oy + len * 0.5)
      ctx.lineTo(ox + (hash(seed + c * 5) - 0.5) * w * 0.4, oy + len)
    }
    ctx.stroke()
  }

  // Frost on the ground at its feet.
  ctx.globalAlpha = 0.35 * k
  ctx.fillStyle = '#d8f1ff'
  ctx.beginPath()
  ctx.ellipse(0, botY * 0.4, w * 0.62, w * 0.16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ─── The flare ──────────────────────────────────────────────────────────────

/** How high the flare hangs above its light pool, in pixels. */
const hangPx = (): number => scale * 2.1

/** Where the flare is on screen right now: its air position and its ground
 *  point, and how lit it is (0 in flight, fading at the end). */
const flareState = (): { ax: number; ay: number; gx: number; gy: number; lit: number; wx: number; wy: number; air: number } | null => {
  const d = getDecoy()
  if (!d) return null
  const a = anchor()
  if (!d.lit) {
    const t = d.t
    const wx = d.fromX + (d.x - d.fromX) * t
    const wy = a.y + d.ahead * t
    const lift = Math.sin(t * Math.PI) * scale * 2.4 * (1 - t) + hangPx() * t
    return { ax: toX(wx), ay: toY(wy) - lift, gx: toX(wx), gy: toY(wy), lit: 0, wx, wy, air: lift }
  }
  const sway = Math.sin(flareClock * 1.7) * scale * 0.14
  const bob = Math.sin(flareClock * 2.3) * scale * 0.05
  const wy = a.y + d.ahead
  // The last second: the flame gutters.
  const gutter = d.left < 1 ? 0.55 + 0.45 * Math.random() * d.left : 1
  return {
    ax: toX(d.x) + sway, ay: toY(wy) - hangPx() + bob,
    gx: toX(d.x), gy: toY(wy), lit: gutter, wx: d.x, wy, air: hangPx() - bob
  }
}

/** The pool of red light the flare throws on the road, and the lure's sonar. */
export const drawSkillGround = (ctx: CanvasRenderingContext2D): void => {
  const f = flareState()
  if (!f || f.lit <= 0) return
  const pulse = 0.82 + 0.18 * Math.sin(flareClock * 7.8)
  const R = Math.max(26, scale * 3.7)
  const key = `flarePool|${Math.round(R)}`
  let g = getRamp(key)
  if (!g) {
    g = putRamp(key, ctx.createRadialGradient(0, 0, 0, 0, 0, R))
    g.addColorStop(0, 'rgba(255,120,120,0.55)')
    g.addColorStop(0.35, 'rgba(255,60,80,0.28)')
    g.addColorStop(1, 'rgba(255,40,70,0)')
  }
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = f.lit * pulse
  ctx.translate(f.gx, f.gy)
  ctx.scale(1, 0.46)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Sonar: rings going out from the light every 0.8 s — the lure, drawn.
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = '#ff5a6e'
  for (let i = 0; i < 3; i++) {
    const p = ((flareClock / 0.8) + i / 3) % 1
    const r = scale * (0.5 + p * 3.6)
    ctx.globalAlpha = (1 - p) * 0.5 * f.lit
    ctx.lineWidth = Math.max(1.5, scale * 0.06 * (1 - p) + 1)
    ctx.beginPath()
    ctx.ellipse(f.gx, f.gy, r, r * 0.42, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

/** The flare itself, the nova ring and the burst rings — above the crowd. */
export const drawSkillAir = (ctx: CanvasRenderingContext2D): void => {
  // ── Burst rings on the road ──
  if (rings.length > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const r of rings) {
      if (r.age < 0) continue
      const k = r.age / r.life
      const e = 1 - (1 - k) ** 3
      const rad = r.r * scale * e
      ctx.globalAlpha = (1 - k) * 0.9
      ctx.strokeStyle = `rgb(${r.rgb})`
      ctx.lineWidth = Math.max(2, r.width * scale * (1 - k) + 1)
      ctx.beginPath()
      ctx.ellipse(toX(r.x), toY(r.y), rad, rad * 0.5, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  drawFlare(ctx)
  drawNovas(ctx)
}

const drawFlare = (ctx: CanvasRenderingContext2D): void => {
  const f = flareState()
  if (!f) return
  const r = Math.max(6, scale * 0.27)

  // Sparks and smoke off it, into the shared pool, in WORLD space: the air
  // position is the ground point plus the height the flare hangs at, and the
  // pool's gravity takes the sparks down onto the light pool below it.
  const air = f.wy + f.air / Math.max(1, scale)
  const sparks = f.lit > 0 ? (cheap ? 1 : rich ? 3 : 2) : cheap ? 1 : 2
  for (let i = 0; i < sparks; i++) {
    emit({
      x: f.wx + (Math.random() - 0.5) * 0.18, y: air,
      vx: (Math.random() - 0.5) * 2.2, vy: -0.4 - Math.random() * 1.6,
      life: 380 + Math.random() * 420, size: 0.05 + Math.random() * 0.05,
      color: Math.random() < 0.5 ? FLARE_HOT : FLARE_EMBER, additive: true, shape: 2,
      gravity: 5, drag: 0.9
    })
  }
  if (f.lit > 0 && !cheap && Math.random() < 0.18) {
    emit({
      x: f.wx, y: air + 0.2, vx: (Math.random() - 0.5) * 0.4, vy: 0.9 + Math.random() * 0.6,
      life: 1200 + Math.random() * 600, size: 0.3 + Math.random() * 0.2,
      color: [120, 70, 76], alpha: 0.36, shape: 3, drag: 0.6
    })
  }

  ctx.save()
  if (f.lit > 0) {
    // ── A shaft of light from the flame to the pool ──
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.16 * f.lit
    ctx.fillStyle = '#ff5064'
    ctx.beginPath()
    ctx.moveTo(f.ax - r * 0.6, f.ay)
    ctx.lineTo(f.ax + r * 0.6, f.ay)
    ctx.lineTo(f.gx + scale * 1.1, f.gy)
    ctx.lineTo(f.gx - scale * 1.1, f.gy)
    ctx.closePath()
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    // ── The parachute ──
    const cw = scale * 0.78
    const ch = scale * 0.42
    const cy = f.ay - scale * 0.95
    ctx.globalAlpha = 1
    ctx.strokeStyle = 'rgba(40,20,26,0.8)'
    ctx.lineWidth = Math.max(1, scale * 0.025)
    ctx.beginPath()
    for (const t of [-1, -0.35, 0.35, 1]) {
      ctx.moveTo(f.ax + t * cw * 0.92, cy)
      ctx.lineTo(f.ax, f.ay - r * 0.9)
    }
    ctx.stroke()
    ctx.fillStyle = '#3b2530'
    ctx.beginPath()
    ctx.moveTo(f.ax - cw, cy)
    ctx.quadraticCurveTo(f.ax - cw * 0.9, cy - ch * 1.6, f.ax, cy - ch * 1.7)
    ctx.quadraticCurveTo(f.ax + cw * 0.9, cy - ch * 1.6, f.ax + cw, cy)
    // Scalloped hem.
    for (let i = 3; i >= -3; i--) {
      const x0 = f.ax + (i / 3) * cw
      ctx.quadraticCurveTo(x0 - cw / 6, cy + ch * 0.22, x0 - cw / 3, cy)
    }
    ctx.closePath()
    ctx.fill()
    // Underlit by the flame: a red rim along the hem.
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.55 * f.lit
    ctx.strokeStyle = '#ff6070'
    ctx.lineWidth = Math.max(1.5, scale * 0.05)
    ctx.beginPath()
    ctx.moveTo(f.ax - cw, cy)
    for (let i = 3; i >= -3; i--) {
      const x0 = f.ax + (i / 3) * cw
      ctx.lineTo(x0, cy + ch * 0.05)
    }
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }

  // ── The canister ──
  ctx.globalAlpha = 1
  ctx.save()
  ctx.translate(f.ax, f.ay)
  if (f.lit <= 0) ctx.rotate(getDecoy()!.t * 9)
  ctx.fillStyle = '#b3182c'
  ctx.strokeStyle = '#1a0a0e'
  ctx.lineWidth = Math.max(1.5, scale * 0.04)
  ctx.beginPath()
  ctx.rect(-r * 0.42, -r * 0.1, r * 0.84, r * 1.5)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#e8d9c0'
  ctx.fillRect(-r * 0.42, r * 0.45, r * 0.84, r * 0.22)
  ctx.restore()

  // ── The flame: a halo, a body and a white-hot core ──
  const flick = f.lit > 0 ? (0.86 + Math.random() * 0.28) * f.lit : 0.6
  const pulse = 0.85 + 0.15 * Math.sin(flareClock * 7.8)
  ctx.globalCompositeOperation = 'lighter'
  const halo = scale * 2.2 * pulse
  const hk = `flareHalo|${Math.round(halo)}`
  let hg = getRamp(hk)
  if (!hg) {
    hg = putRamp(hk, ctx.createRadialGradient(0, 0, 0, 0, 0, halo))
    hg.addColorStop(0, 'rgba(255,170,160,0.7)')
    hg.addColorStop(0.25, 'rgba(255,70,90,0.35)')
    hg.addColorStop(1, 'rgba(255,40,70,0)')
  }
  ctx.save()
  ctx.translate(f.ax, f.ay - r * 0.2)
  ctx.globalAlpha = flick
  ctx.fillStyle = hg
  ctx.beginPath()
  ctx.arc(0, 0, halo, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.globalAlpha = Math.min(1, flick)
  ctx.fillStyle = '#ff7c86'
  ctx.beginPath()
  ctx.arc(f.ax, f.ay - r * 0.25, r * 0.75, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff4ea'
  ctx.beginPath()
  ctx.arc(f.ax, f.ay - r * 0.25, r * 0.38, 0, Math.PI * 2)
  ctx.fill()

  // A lens streak across it: the brightest thing on the screen, and it looks it.
  if (f.lit > 0 && !cheap) {
    ctx.globalAlpha = 0.5 * flick
    ctx.strokeStyle = '#ffd0d0'
    ctx.lineWidth = Math.max(1, scale * 0.04)
    ctx.beginPath()
    ctx.moveTo(f.ax - scale * 1.3, f.ay - r * 0.25)
    ctx.lineTo(f.ax + scale * 1.3, f.ay - r * 0.25)
    ctx.stroke()
  }
  ctx.restore()
}

const drawNovas = (ctx: CanvasRenderingContext2D): void => {
  if (novas.length === 0) return
  const maxR = Math.hypot(viewW, viewH) * 1.05
  ctx.save()
  for (const n of novas) {
    const k = Math.min(1, n.age / NOVA_MS)
    const e = 1 - (1 - k) ** 3
    const r = Math.max(1, e * maxR)
    const fade = 1 - k

    // The frost wash behind the ring: the ground the ring has already crossed
    // turning white for a moment, so the ring reads as the edge of something
    // spreading rather than as a hoop.
    const wash = ctx.createRadialGradient(n.sx, n.sy, r * 0.55, n.sx, n.sy, r)
    wash.addColorStop(0, 'rgba(200,236,255,0)')
    wash.addColorStop(1, `rgba(200,236,255,${0.32 * fade})`)
    ctx.fillStyle = wash
    ctx.beginPath()
    ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2)
    ctx.fill()

    ctx.globalCompositeOperation = 'lighter'
    // Outer glow, then the hard bright edge.
    ctx.strokeStyle = `rgba(120,200,255,${0.45 * fade})`
    ctx.lineWidth = Math.max(4, scale * 1.1 * fade + 4)
    ctx.beginPath()
    ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = `rgba(240,252,255,${0.95 * fade})`
    ctx.lineWidth = Math.max(2, scale * 0.28 * fade + 1.5)
    ctx.beginPath()
    ctx.arc(n.sx, n.sy, r, 0, Math.PI * 2)
    ctx.stroke()

    // Ice spikes riding the ring.
    if (!cheap) {
      const spikes = 32
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * fade})`
      ctx.lineWidth = Math.max(1.5, scale * 0.07)
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 + k * 0.6
        const len = scale * (0.35 + hash(i + 7) * 0.55) * fade
        ctx.moveTo(n.sx + Math.cos(a) * (r - len * 0.3), n.sy + Math.sin(a) * (r - len * 0.3))
        ctx.lineTo(n.sx + Math.cos(a) * (r + len), n.sy + Math.sin(a) * (r + len))
      }
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.restore()
}

// ─── The screen ─────────────────────────────────────────────────────────────

/**
 * Frost on the glass: crystals growing in from every edge, baked once per
 * viewport size and blitted at the freeze's strength. Dendrites rather than a
 * gradient, because a blue vignette reads as "hurt" or "night" and ice has a
 * texture nothing else in the game does.
 */
let edgeCanvas: HTMLCanvasElement | null = null
let edgeKey = ''

const bakeFrostEdge = (w: number, h: number): HTMLCanvasElement | null => {
  const key = `${Math.round(w)}x${Math.round(h)}`
  if (edgeCanvas && edgeKey === key) return edgeCanvas
  if (typeof document === 'undefined' || w < 2 || h < 2) return null
  const c = document.createElement('canvas')
  c.width = Math.round(w)
  c.height = Math.round(h)
  const g = c.getContext('2d')
  if (!g) return null

  let s = 0x2f6b1d
  const rnd = (): number => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // The frosted band: an inward glow from every edge.
  const band = Math.min(w, h) * 0.2
  const edge = (x0: number, y0: number, x1: number, y1: number): void => {
    const lg = g.createLinearGradient(x0, y0, x1, y1)
    lg.addColorStop(0, 'rgba(205,238,255,0.62)')
    lg.addColorStop(1, 'rgba(205,238,255,0)')
    g.fillStyle = lg
    g.fillRect(0, 0, w, h)
  }
  edge(0, 0, 0, band)
  edge(0, h, 0, h - band)
  edge(0, 0, band, 0)
  edge(w, 0, w - band, 0)

  // Dendrites: a fern of ice from points along the edges, growing inward.
  g.strokeStyle = 'rgba(240,250,255,0.7)'
  g.lineCap = 'round'
  const branch = (x: number, y: number, a: number, len: number, depth: number): void => {
    if (depth <= 0 || len < 3) return
    const x2 = x + Math.cos(a) * len
    const y2 = y + Math.sin(a) * len
    g.lineWidth = Math.max(0.6, depth * 0.7)
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x2, y2)
    g.stroke()
    const steps = 3
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1)
      const bx = x + Math.cos(a) * len * t
      const by = y + Math.sin(a) * len * t
      const sub = len * (0.45 - t * 0.2)
      branch(bx, by, a - 1.05, sub, depth - 1)
      branch(bx, by, a + 1.05, sub, depth - 1)
    }
    branch(x2, y2, a + (rnd() - 0.5) * 0.5, len * 0.55, depth - 1)
  }
  const seeds = Math.round((w + h) / 24)
  for (let i = 0; i < seeds; i++) {
    const side = Math.floor(rnd() * 4)
    const along = rnd()
    const x = side === 0 ? along * w : side === 1 ? w : side === 2 ? along * w : 0
    const y = side === 0 ? 0 : side === 1 ? along * h : side === 2 ? h : along * h
    const inward = side === 0 ? Math.PI / 2 : side === 1 ? Math.PI : side === 2 ? -Math.PI / 2 : 0
    branch(x, y, inward + (rnd() - 0.5) * 1.1, band * (0.28 + rnd() * 0.5), 3)
  }
  // Loose flakes in the band.
  g.fillStyle = 'rgba(255,255,255,0.75)'
  for (let i = 0; i < seeds * 2; i++) {
    const side = Math.floor(rnd() * 4)
    const along = rnd()
    const depth = rnd() * band * 0.8
    const x = side === 0 || side === 2 ? along * w : side === 1 ? w - depth : depth
    const y = side === 1 || side === 3 ? along * h : side === 0 ? depth : h - depth
    const r = 1.2 + rnd() * 2.6
    g.beginPath()
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      g.moveTo(x, y)
      g.lineTo(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6)
    }
    g.lineWidth = 0.9
    g.strokeStyle = 'rgba(255,255,255,0.6)'
    g.stroke()
  }

  edgeCanvas = c
  edgeKey = key
  return c
}

/** The skills' full-screen passes: the frost on the glass and the flashes. */
export const drawSkillScreen = (ctx: CanvasRenderingContext2D, w: number, h: number): void => {
  if (frostVis > 0.01) {
    const left01 = frostLeft01()
    // Recedes over the last 30 % of the freeze, with a shiver at the very end,
    // so "it is about to let go" is on the screen and not only on the button.
    const hold = left01 > 0.3 ? 1 : 0.35 + (left01 / 0.3) * 0.65
    const shiver = left01 > 0 && left01 < 0.12 ? 0.75 + Math.random() * 0.25 : 1
    const a = frostVis * hold * shiver
    ctx.save()
    // A cold grade over everything — a light hand, the fight still has to read.
    ctx.globalAlpha = 0.14 * a
    ctx.fillStyle = '#9fd4ff'
    ctx.fillRect(0, 0, w, h)
    const edge = bakeFrostEdge(w, h)
    if (edge) {
      ctx.globalAlpha = Math.min(1, a * 1.05)
      ctx.drawImage(edge, 0, 0, w, h)
    }
    ctx.restore()
  }
  if (thawFlash > 0.01) {
    ctx.fillStyle = `rgba(230,248,255,${thawFlash * 0.28})`
    ctx.fillRect(0, 0, w, h)
  }
  if (flash > 0.01) {
    ctx.fillStyle = `rgba(${flashRgb},${flash})`
    ctx.fillRect(0, 0, w, h)
  }
}

/** Drop every transient: a stage opening does not inherit the last one's ring. */
export const resetSkillFx = (): void => {
  novas.length = 0
  rings.length = 0
  flash = 0
  thawFlash = 0
  frostVis = 0
  if (burning) {
    stopFlareBurn()
    burning = false
  }
}
