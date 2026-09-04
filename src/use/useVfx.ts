import { ref } from 'vue'
import type { GateOp } from '@/game/survival'
import { bakeRadialSprite, getRamp, getSprite, putRamp, rgbString } from '@/use/useGradientRamps'

/**
 * ─── VFX: event bus + pooled particle system ────────────────────────────────
 *
 * The simulation never touches pixels. It pushes semantic events ("a gate
 * ticked up here", "a crate burst") into a ring buffer; the renderer drains it
 * once per frame and turns each event into particles, floating text, screen
 * shake and sound.
 *
 * That split is what lets the whole feel of the game be re-tuned without ever
 * opening the simulation — and it is why the sim stays unit-testable in jsdom,
 * where there is no canvas at all.
 *
 * PERFORMANCE: particles live in flat typed arrays with a swap-remove free
 * list, so a 400-particle gate burst allocates nothing. Draw order is bucketed
 * by blend mode, so the canvas switches `globalCompositeOperation` exactly
 * twice per frame instead of once per particle.
 */

// ─── Events ─────────────────────────────────────────────────────────────────

export type FxEvent =
  /** A survivor fired. Cheap and very frequent — throttled downstream. */
  | { kind: 'shoot'; x: number; y: number }
  /** A round landed on something. `on` picks the impact's colour and weight. */
  | { kind: 'hit'; x: number; y: number; on: 'gate' | 'crate' | 'barricade' | 'rock' | 'foe' | 'boss' }
  /** Sustained fire pushed a `+N` gate up by one — THE feedback moment — or a
   *  `-N` gate DOWN by one, which is the same clock costing the player instead
   *  of paying them. `hostile` is which of the two just happened; the mixer and
   *  the renderer both need it, because they must not celebrate. */
  | { kind: 'gateTick'; x: number; y: number; value: number; hostile?: boolean }
  /** The crowd ran through a gate. `gain` is the change in squad size: positive
   *  for `add` / `mul`, NEGATIVE for the `div` and `sub` doors. */
  | { kind: 'gatePass'; x: number; y: number; op: GateOp; value: number; gain: number }
  /**
   * A leaf of the bank the player did NOT take, blowing itself apart.
   *
   * One bank, one door: the instant the crowd commits, every other offer is
   * destroyed. This is the headline VFX of the whole game — it is the moment
   * the player's decision becomes irreversible, and it has to look like it.
   */
  | {
      kind: 'gateDismiss'
      x: number
      y: number
      halfW: number
      op: GateOp
      value: number
      /** How far this leaf is from the one that was taken, in world units —
       *  the shockwave arrives later the further away it is. */
      distance: number
    }
  /** A supply crate burst. `crate` picks which stat went up and `value` is the
   *  new total, so the floating text can read "DMG 4" or "RATE 2.4". */
  | { kind: 'crateBreak'; x: number; y: number; crate: 'damage' | 'rate'; value: number }
  | { kind: 'barricadeBreak'; x: number; y: number }
  | { kind: 'foeDie'; x: number; y: number; big: boolean }
  /** A miniboss walked on / died. Worth its own announcement either way. */
  | { kind: 'eliteSpawn'; x: number; y: number }
  /**
   * A miniboss's arc across the road. `x` / `y` are the elite's own feet, which
   * is where the arc is swung from; `reach` is how far down the road it
   * travelled, and it is the same number the kill was measured against.
   *
   * `dir` is which way it swung (±1), so the dust and the bodies leave along
   * the arc rather than away from a point. `heavy` is the archetype's weight,
   * not its damage: a brute plants and turns, a hound throws itself. Same
   * numbers, opposite rhythm — the renderer and the mixer both read it to keep
   * the two readable apart.
   */
  | { kind: 'eliteSweep'; x: number; y: number; reach: number; dir: number; heavy: boolean }
  | { kind: 'eliteDie'; x: number; y: number }
  /** The player pulled the pin — the throw itself. */
  | { kind: 'grenadeThrow'; x: number; y: number }
  /** The player's grenade went off. */
  | { kind: 'grenade'; x: number; y: number }
  /** The shield came up over the crowd. */
  | { kind: 'shieldUp'; x: number; y: number }
  /** …and ate a hit that would have taken a survivor. */
  | { kind: 'shieldSave'; x: number; y: number }
  /** A TNT barrel took its last round and lit its fuse. */
  | { kind: 'barrelLit'; x: number; y: number }
  /** …and went. The big one: the arena's answer to a shielded boss. */
  | { kind: 'barrelBlast'; x: number; y: number }
  /** A survivor was eaten / crushed. */
  | { kind: 'unitLost'; x: number; y: number; outfit: number }
  /** Survivors died on a gate divider — the "you tried to take both" tell. */
  | { kind: 'divider'; x: number; y: number }
  | { kind: 'coin'; x: number; y: number; value: number }
  | { kind: 'bossHit'; x: number; y: number }
  /** A round hit a boss that is mid-phase and untouchable. Sparks, no damage. */
  | { kind: 'bossGuard'; x: number; y: number }
  /**
   * The boss crossed a guard gate: it plants, shields, and swings.
   * `stage` is 1 or 2 — the second one is louder, because it is the last.
   */
  | { kind: 'bossRage'; x: number; y: number; stage: number }
  /** `radius` grows with every slam the boss has already thrown. */
  | { kind: 'bossSlam'; x: number; y: number; radius: number; charged: boolean }
  | { kind: 'bossDie'; x: number; y: number }
  | { kind: 'stageClear'; x: number; y: number }
  | { kind: 'wipe'; x: number; y: number }

// Events are produced during a tick and consumed the same frame; a generous cap
// means a catastrophic wipe can't drop the events that matter while still
// bounding memory.
const FX_CAPACITY = 512
const fxQueue: FxEvent[] = []

export const pushFx = (event: FxEvent): void => {
  if (fxQueue.length >= FX_CAPACITY) fxQueue.shift()
  fxQueue.push(event)
}

const EMPTY_FX: FxEvent[] = []

/** Drain every queued event. The renderer calls this once per frame. */
export const drainFx = (): FxEvent[] => {
  if (fxQueue.length === 0) return EMPTY_FX
  const out = fxQueue.slice()
  fxQueue.length = 0
  return out
}

// ─── Quality tiers ──────────────────────────────────────────────────────────

export type QualityTier = 'high' | 'medium' | 'low'

/** Live quality tier, driven by a rolling FPS average. The renderer reads it to
 *  skip expensive passes; the HUD surfaces it in debug mode. */
export const quality = ref<QualityTier>('high')

const TIER_CAPACITY: Record<QualityTier, number> = { high: 900, medium: 520, low: 240 }

let fpsAccum = 0
let fpsFrames = 0
let tierHoldUntil = 0

// ─── Device calibration ─────────────────────────────────────────────────────
//
// The rolling average below is a good STEADY-STATE control and a poor first
// impression. It needs 60 frames to say anything at all — three seconds on a
// device running at 20 fps, which is exactly the device that cannot afford
// those three seconds — and it starts optimistically at `high`, so the worst
// hardware pays the highest price precisely while the player is deciding
// whether the game is worth their time.
//
// So the first `CALIBRATION_MS` of rendered time is treated as a measurement:
// judge the device early, judge it often, and only ever downgrade.
//
// The statistic is the MEDIAN frame time, not mean FPS, for two reasons. A mean
// over frames-per-second is dominated by the good frames — a device alternating
// 8 ms and 60 ms frames averages out looking fine while feeling awful. And the
// median shrugs off the transient spikes this game legitimately produces early
// on (the sprite top-up baking the stage's designs), which a mean would read as
// a slow device and permanently punish.
const CALIBRATION_MS = 10_000
/** Frames per verdict. ~24 is a quarter-second on a healthy device and about a
 *  second on a struggling one — fast enough to act, wide enough to be a median. */
const CAL_BATCH = 24
/** A dt this large is a tab switch, a breakpoint or a GC pause, not a frame the
 *  renderer is responsible for. Excluded so it cannot skew the verdict. */
const OUTLIER_MS = 250

// Median frame-time boundaries, matching the FPS thresholds the steady-state
// controller uses: 18 ms ≈ 55 fps, 25 ms ≈ 40 fps.
const HIGH_MAX_MS = 18
const MEDIUM_MAX_MS = 25

const TIER_ORDER: readonly QualityTier[] = ['low', 'medium', 'high']
const rank = (t: QualityTier): number => TIER_ORDER.indexOf(t)

let calibrating = true
let calElapsed = 0
let calBatch: number[] = []
/**
 * The best tier this device earned during calibration, and a hard ceiling for
 * the rest of the session.
 *
 * A device that stuttered through its first ten seconds of play is not one to
 * re-experiment on mid-run: letting the rolling average climb back to `high`
 * would pop the resolution and effects up, stutter, and drop them again. The
 * steady-state controller may still go LOWER at any time — it just may not undo
 * what the measurement established.
 */
let qualityCeiling: QualityTier = 'high'

/**
 * The tier the canvas RESOLUTION is sized for — written AT MOST ONCE a session.
 *
 * Deliberately separate from `quality`, and this separation is load-bearing.
 * Changing the canvas resolution means re-sizing the backing store and
 * re-baking every piece of art cached at the old scale, which measured ~700 ms
 * on a 6x-throttled phone. Driving that off the live tier looked obvious and
 * cost 27 fps: the tier legitimately moves several times a session, and each
 * move bought a full rebake — 51 long tasks totalling 7.5 s in a 20 s window,
 * against 4 totalling 219 ms without it.
 *
 * So the resolution commits once, on the first verdict that the device cannot
 * hold `high`, and never moves again. Everything else the tier controls
 * (particle capacity, drawn-unit count, optional passes) stays free to adapt
 * continuously, because none of it invalidates a cache.
 */
export const renderScaleTier = ref<QualityTier>('high')
let renderScaleLocked = false
const lockRenderScale = (tier: QualityTier): void => {
  if (renderScaleLocked) return
  renderScaleLocked = true
  renderScaleTier.value = tier
}

/** True once the calibration window has closed. Debug/telemetry only. */
export const isQualityCalibrated = (): boolean => !calibrating
/** The ceiling calibration settled on. Debug/telemetry only. */
export const qualityCeilingTier = (): QualityTier => qualityCeiling

const medianOf = (xs: number[]): number => {
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}

const tierForMedian = (medianMs: number): QualityTier =>
  medianMs <= HIGH_MAX_MS ? 'high' : medianMs <= MEDIUM_MAX_MS ? 'medium' : 'low'

/** Test seam: forget the measurement and start over at `high`. */
export const __resetQualityCalibration = (): void => {
  renderScaleLocked = false
  renderScaleTier.value = 'high'
  calibrating = true
  calElapsed = 0
  calBatch = []
  qualityCeiling = 'high'
  quality.value = 'high'
  fpsAccum = 0
  fpsFrames = 0
  tierHoldUntil = 0
}

/**
 * Feed the frame time.
 *
 * During calibration: a verdict every `CAL_BATCH` frames, downgrade-only, with
 * no hysteresis — a struggling device should stop paying for effects it cannot
 * afford within a second, not once a rolling average has finished being polite.
 *
 * After it: the original rolling average, every 60 frames, with a 2.5 s hold so
 * a device sitting on a threshold cannot oscillate — clamped to the ceiling the
 * measurement established.
 */
export const sampleFrame = (dtMs: number): void => {
  if (dtMs <= 0) return

  if (calibrating) {
    if (dtMs <= OUTLIER_MS) {
      calElapsed += dtMs
      calBatch.push(dtMs)

      if (calBatch.length >= CAL_BATCH) {
        const want = tierForMedian(medianOf(calBatch))
        calBatch = []
        if (rank(want) < rank(quality.value)) {
          quality.value = want
          tierHoldUntil = Date.now() + 2500
          // First proof the device cannot hold `high`: commit the cheaper
          // canvas now, while the player is still in their opening seconds.
          lockRenderScale(want)
        }
      }
    }

    if (calElapsed >= CALIBRATION_MS) {
      calibrating = false
      calBatch = []
      qualityCeiling = quality.value
      // A device that never tripped a downgrade locks in at `high` here, so the
      // resolution is settled for the session either way.
      lockRenderScale(quality.value)
    }
  }

  fpsAccum += 1000 / dtMs
  fpsFrames++
  if (fpsFrames < 60) return

  const avg = fpsAccum / fpsFrames
  fpsAccum = 0
  fpsFrames = 0

  const now = Date.now()
  if (now < tierHoldUntil) return

  const next: QualityTier = avg >= 55 ? 'high' : avg >= 40 ? 'medium' : 'low'
  // Never above what the device proved it can do.
  const capped: QualityTier = rank(next) > rank(qualityCeiling) ? qualityCeiling : next
  if (capped !== quality.value) {
    quality.value = capped
    tierHoldUntil = now + 2500
  }
}

// ─── Particle pool ──────────────────────────────────────────────────────────

const MAX_PARTICLES = 900

// Structure-of-arrays: one contiguous buffer per attribute keeps the hot loop
// cache-friendly and free of per-particle object churn.
const px = new Float32Array(MAX_PARTICLES)
const py = new Float32Array(MAX_PARTICLES)
const pvx = new Float32Array(MAX_PARTICLES)
const pvy = new Float32Array(MAX_PARTICLES)
const plife = new Float32Array(MAX_PARTICLES)
const pmax = new Float32Array(MAX_PARTICLES)
const psize = new Float32Array(MAX_PARTICLES)
const pgrav = new Float32Array(MAX_PARTICLES)
const pdrag = new Float32Array(MAX_PARTICLES)
const prot = new Float32Array(MAX_PARTICLES)
const pvrot = new Float32Array(MAX_PARTICLES)
/** 0 = normal blend, 1 = additive. */
const padd = new Uint8Array(MAX_PARTICLES)
/** 0 = soft round, 1 = shard/quad, 2 = spark streak, 3 = smoke puff. */
const pshape = new Uint8Array(MAX_PARTICLES)
const pr = new Uint8Array(MAX_PARTICLES)
const pg = new Uint8Array(MAX_PARTICLES)
const pb = new Uint8Array(MAX_PARTICLES)
const palpha = new Float32Array(MAX_PARTICLES)

let liveCount = 0

export interface EmitOptions {
  x: number
  y: number
  vx?: number
  vy?: number
  life: number
  size: number
  color: [number, number, number]
  alpha?: number
  gravity?: number
  drag?: number
  additive?: boolean
  shape?: 0 | 1 | 2 | 3
  rot?: number
  vrot?: number
}

/**
 * Spawn one particle. Over-capacity spawns recycle the OLDEST slot rather than
 * being dropped, so a big burst always reads as a big burst — it just cuts the
 * tail of whatever came before it.
 */
export const emit = (o: EmitOptions): void => {
  const cap = TIER_CAPACITY[quality.value]
  let i: number
  if (liveCount < cap) {
    i = liveCount++
  } else {
    i = oldestIndex()
  }
  px[i] = o.x
  py[i] = o.y
  pvx[i] = o.vx ?? 0
  pvy[i] = o.vy ?? 0
  plife[i] = o.life
  pmax[i] = o.life
  psize[i] = o.size
  pgrav[i] = o.gravity ?? 0
  pdrag[i] = o.drag ?? 0
  prot[i] = o.rot ?? 0
  pvrot[i] = o.vrot ?? 0
  padd[i] = o.additive ? 1 : 0
  pshape[i] = o.shape ?? 0
  pr[i] = o.color[0]
  pg[i] = o.color[1]
  pb[i] = o.color[2]
  palpha[i] = o.alpha ?? 1
}

const oldestIndex = (): number => {
  let best = 0
  let bestLife = Infinity
  for (let i = 0; i < liveCount; i++) {
    if (plife[i]! < bestLife) { bestLife = plife[i]!; best = i }
  }
  return best
}

/** Integrate every live particle, compacting dead ones out with a swap-remove
 *  (O(1) per removal, no array churn). */
export const stepParticles = (dtMs: number): void => {
  const dt = dtMs / 1000
  for (let i = liveCount - 1; i >= 0; i--) {
    plife[i]! -= dtMs
    if (plife[i]! <= 0) {
      const last = liveCount - 1
      if (i !== last) {
        px[i] = px[last]!; py[i] = py[last]!
        pvx[i] = pvx[last]!; pvy[i] = pvy[last]!
        plife[i] = plife[last]!; pmax[i] = pmax[last]!
        psize[i] = psize[last]!; pgrav[i] = pgrav[last]!
        pdrag[i] = pdrag[last]!; prot[i] = prot[last]!
        pvrot[i] = pvrot[last]!; padd[i] = padd[last]!
        pshape[i] = pshape[last]!
        pr[i] = pr[last]!; pg[i] = pg[last]!; pb[i] = pb[last]!
        palpha[i] = palpha[last]!
      }
      liveCount--
      continue
    }
    pvy[i]! -= pgrav[i]! * dt
    if (pdrag[i]! > 0) {
      const d = Math.max(0, 1 - pdrag[i]! * dt)
      pvx[i]! *= d
      pvy[i]! *= d
    }
    px[i]! += pvx[i]! * dt
    py[i]! += pvy[i]! * dt
    prot[i]! += pvrot[i]! * dt
  }
}

export const particleCount = (): number => liveCount

export const clearParticles = (): void => { liveCount = 0 }

/**
 * Draw every particle. `toX` / `toY` project world→screen and `scale` is
 * px-per-unit, so particles live in world space and follow the camera for free.
 *
 * Two passes: normal-blend first, then a single switch to `lighter` for the
 * additive bucket. Sorting by blend mode rather than depth costs nothing
 * visually (particles are short-lived and overlapping) and saves ~N context
 * state changes per frame.
 */
export const drawParticles = (
  ctx: CanvasRenderingContext2D,
  toX: (wx: number) => number,
  toY: (wy: number) => number,
  scale: number
): void => {
  if (liveCount === 0) return
  drawBucket(ctx, toX, toY, scale, 0)
  ctx.globalCompositeOperation = 'lighter'
  drawBucket(ctx, toX, toY, scale, 1)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

/** Tag bit for this module's slice of the shared ramp cache's integer key
 *  space. Packed RGB occupies the low 24 bits; the tag keeps a smoke ramp from
 *  ever colliding with an integer key some other layer chooses to use. */
const SMOKE_RAMP = 0x1000000

/** The puff's two stops. Allocated only on a cache MISS — once per colour for
 *  the life of the cache, not once per particle. */
const SMOKE_STOPS = (r: number, g: number, b: number): [number, string][] => [
  [0, `rgba(${r},${g},${b},0.55)`],
  [1, `rgba(${r},${g},${b},0)`]
]

const drawBucket = (
  ctx: CanvasRenderingContext2D,
  toX: (wx: number) => number,
  toY: (wy: number) => number,
  scale: number,
  additive: 0 | 1
): void => {
  for (let i = 0; i < liveCount; i++) {
    if (padd[i] !== additive) continue
    const t = plife[i]! / pmax[i]!
    // Ease-out fade so particles thin gracefully instead of blinking out.
    const a = palpha[i]! * (t < 0.25 ? t / 0.25 : 1) * Math.min(1, t * 1.6)
    if (a <= 0.01) continue

    const sx = toX(px[i]!)
    const sy = toY(py[i]!)
    const size = Math.max(0.6, psize[i]! * scale * (0.55 + t * 0.45))

    ctx.globalAlpha = a
    // The colour is looked up per BRANCH rather than hoisted above the switch:
    // the smoke case does not want a solid colour at all, and building one for
    // it was an allocation per puff per frame for a string never read.
    const rgbKey = SMOKE_RAMP | (pr[i]! << 16) | (pg[i]! << 8) | pb[i]!

    switch (pshape[i]) {
      case 1: { // shard — a rotated quad, for crate and barricade debris
        ctx.save()
        ctx.translate(sx, sy)
        ctx.rotate(prot[i]!)
        ctx.fillStyle = rgbString(pr[i]!, pg[i]!, pb[i]!)
        ctx.fillRect(-size / 2, -size / 2, size, size * 0.78)
        ctx.restore()
        break
      }
      case 2: { // spark — a velocity-aligned streak
        const vlen = Math.hypot(pvx[i]!, pvy[i]!) || 1
        const nx = (pvx[i]! / vlen) * size * 1.9
        const ny = (-pvy[i]! / vlen) * size * 1.9
        ctx.strokeStyle = rgbString(pr[i]!, pg[i]!, pb[i]!)
        ctx.lineWidth = Math.max(0.8, size * 0.4)
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(sx - nx, sy - ny)
        ctx.stroke()
        break
      }
      case 3: { // smoke — a soft, expanding, low-alpha puff
        // The pool's hottest paint. Every puff used to build a two-stop radial
        // ramp at its own screen position, which meant the rasteriser rebuilt
        // the ramp for all 900 of them, every frame.
        //
        // The ramp is baked to a sprite ONCE per colour instead and blitted.
        // `size` grows with the puff's age, so it is carried by the destination
        // rectangle rather than by a `scale()` transform. Measured at the
        // realistic peak of 150 puffs: work-per-frame p95 1.20 ms -> 0.70 ms
        // unthrottled, p50 5.85 ms -> 3.55 ms at 4x CPU. See `PERF-LEDGER.md`.
        let spr = getSprite(rgbKey)
        if (spr === undefined) spr = bakeRadialSprite(rgbKey, SMOKE_STOPS(pr[i]!, pg[i]!, pb[i]!))
        if (spr) {
          // Same centre and same radius as the filled arc drew: the ramp's last
          // stop reaches the sprite's edge, so a `2 * size` box centred on the
          // particle reproduces the falloff exactly.
          ctx.drawImage(spr, sx - size, sy - size, size * 2, size * 2)
          break
        }
        // No offscreen context to bake into — jsdom under test, or a lost
        // context. Falls back to a cached ramp built at the puff's own radius
        // and placed with a translate. The radius is bucketed to whole pixels
        // here (unlike the decals, which key on the exact value) because a
        // puff's size is genuinely continuous, so exact keys would never hit;
        // this path is off the real-browser hot path either way.
        const qr = Math.max(1, Math.round(size))
        const key = `smoke|${rgbKey}|${qr}`
        let g = getRamp(key)
        if (!g) {
          g = putRamp(key, ctx.createRadialGradient(0, 0, 0, 0, 0, qr))
          g.addColorStop(0, `rgba(${pr[i]},${pg[i]},${pb[i]},0.55)`)
          g.addColorStop(1, `rgba(${pr[i]},${pg[i]},${pb[i]},0)`)
        }
        ctx.save()
        ctx.translate(sx, sy)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(0, 0, qr, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        break
      }
      default: { // soft round dot
        ctx.fillStyle = rgbString(pr[i]!, pg[i]!, pb[i]!)
        ctx.beginPath()
        ctx.arc(sx, sy, size * 0.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

// ─── Floating combat text ───────────────────────────────────────────────────
//
// "+7", "DMG +1", "×2". Kept out of the particle pool because they carry a
// string payload and are drawn with a font, which does not fit the typed-array
// model — and because they are the one visual the player actually reads.

export interface FloatText {
  x: number
  y: number
  vy: number
  life: number
  maxLife: number
  text: string
  color: string
  size: number
  /** Bigger, with a heavier outline — for the moments that matter. */
  crit: boolean
}

const MAX_TEXTS = 60
const texts: FloatText[] = []

export const emitText = (t: Omit<FloatText, 'maxLife'> & { maxLife?: number }): void => {
  if (texts.length >= MAX_TEXTS) texts.shift()
  texts.push({ ...t, maxLife: t.maxLife ?? t.life })
}

export const stepTexts = (dtMs: number): void => {
  const dt = dtMs / 1000
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i]!
    t.life -= dtMs
    if (t.life <= 0) { texts.splice(i, 1); continue }
    t.y += t.vy * dt
    t.vy *= Math.max(0, 1 - 1.6 * dt)
  }
}

export const getTexts = (): FloatText[] => texts
export const clearTexts = (): void => { texts.length = 0 }

// ─── Ground decals ──────────────────────────────────────────────────────────
//
// Scorch marks and craters that outlive the burst that made them. Capped, and
// drawn under everything, so the lane accumulates a history of the fight
// without costing anything.

export interface Decal { x: number; y: number; r: number; life: number; maxLife: number; dark: number }
const MAX_DECALS = 24
const decals: Decal[] = []

export const emitDecal = (x: number, y: number, r: number, dark = 0.5): void => {
  if (decals.length >= MAX_DECALS) decals.shift()
  decals.push({ x, y, r, life: 7000, maxLife: 7000, dark })
}

export const stepDecals = (dtMs: number): void => {
  for (let i = decals.length - 1; i >= 0; i--) {
    decals[i]!.life -= dtMs
    if (decals[i]!.life <= 0) decals.splice(i, 1)
  }
}

export const getDecals = (): Decal[] => decals
export const clearDecals = (): void => { decals.length = 0 }

/** Reset every transient visual. Called when a stage starts so the last run's
 *  debris doesn't bleed into the new one. */
export const resetVfx = (): void => {
  clearParticles()
  clearTexts()
  clearDecals()
  fxQueue.length = 0
}
