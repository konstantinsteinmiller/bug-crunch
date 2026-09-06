import {
  blob, cel, ink, stroke, fillShape, tones, terminator, type Pt, type CelTones
} from '@/game/inkArt'
import {
  INK, LINE, SHADE, SHADOW_DIR, footStep, bodyBob, weightShift, hipDrop, limb, gait
} from '@/game/monsterKit'
import { stripFrame } from '@/game/spriteStrip'
import { spriteFor } from '@/game/art'

/**
 * ─── The survivor ───────────────────────────────────────────────────────────
 *
 * One character, drawn from BEHIND, because that is the only angle a vertical
 * runner ever shows: the crowd runs away up the screen. A back view also solves
 * the hardest problem in a crowd game — at 30 px a face is noise, but a
 * silhouette of pack + shoulders + bobbing head reads instantly, and reads the
 * same whether there are three of them or a hundred and ninety.
 *
 * The design agrees with the monster cast on purpose (same ink colour, same key
 * light, same line weights, same cel ramp from `inkArt`), so the two sides of
 * the fight look like they were drawn by one hand.
 *
 * ─── Why it is baked ────────────────────────────────────────────────────────
 *
 * A survivor costs ~60 path operations. At 190 of them on screen that is 11 000
 * path ops per frame, which no phone will do at 60 fps. So each outfit is
 * rendered ONCE into a 14-frame strip covering exactly one stride, and the
 * battlefield blits. Baking happens in idle slices; until a strip exists the
 * renderer falls back to a cheap capsule, so the first frame is never empty and
 * the frame budget is never blown.
 */

/** Frames per stride. Fourteen is the fewest that still reads as running. */
const FRAMES = 14

/**
 * The run's gait: a short stance and a long swing, with both feet off the
 * ground between one push-off and the next plant, and the swing boot folding
 * high toward the seat. See the legs in `drawSurvivor`.
 */
const RUN_STANCE = 0.4
/** How high the swing boot rises, as a fraction of the drawing's unit. */
const RUN_LIFT = 0.42

/** Baked frame size, px. A survivor is ~1.1 world units tall and the zoom tops
 *  out near 70 px/unit on a tablet, so 96 px is always downsampling. */
const PX = 96
const S = PX / 2.25

/** Where the feet sit inside a frame, in px from the top. */
export const HERO_FOOT = PX * 0.52 + S
/** Total character height inside a frame, px. */
export const HERO_HEIGHT = 2.05 * S
/** Frame size, so the renderer can compute its blit rect. */
export const HERO_PX = PX

/**
 * The feet line and the body height as FRACTIONS of the frame.
 *
 * A painted strip is this frame box at a different resolution, so the renderer
 * measures its blit off the frame it was handed rather than off `PX` — the same
 * contract `monsterSprites` keeps. For a baked frame these are algebraically
 * what the pixel constants above give.
 */
export const HERO_FOOT_R = HERO_FOOT / PX
export const HERO_HEIGHT_R = HERO_HEIGHT / PX

/** The frame box's width:height. A painted panel is this box, scaled up. */
export const HERO_FRAME_ASPECT = 1

/** One stride, ms, at the reference speed. The renderer plays the strip faster
 *  or slower with the crowd. */
export const HERO_CYCLE_MS = 520

// ─── Outfits ────────────────────────────────────────────────────────────────
//
// Three, not one. A hundred identical bodies reads as a texture; three tints
// shuffled by unit index reads as a crowd of people. More than three and the
// squad stops reading as one team.

interface Outfit {
  id: string
  jacket: string
  trousers: string
  pack: string
  cloth: string
  skin: string
}

export const OUTFITS: Outfit[] = [
  { id: 'teal', jacket: '#2f7f86', trousers: '#33414f', pack: '#7a5a34', cloth: '#e2c98d', skin: '#c78d61' },
  { id: 'amber', jacket: '#b8722c', trousers: '#3c3a48', pack: '#6b5030', cloth: '#d8d2bd', skin: '#a9714a' },
  { id: 'violet', jacket: '#6a5296', trousers: '#2f3644', pack: '#7b5b38', cloth: '#cfd8e0', skin: '#e0a97e' }
]

/** Outfit for a unit, stable for its whole life so nobody changes clothes. */
export const outfitIndex = (unitIndex: number): number =>
  Math.abs(unitIndex) % OUTFITS.length

// ─── The drawing ────────────────────────────────────────────────────────────

/**
 * Paint one survivor, feet at y = +1, crown at ≈ −1.05, facing away.
 *
 * Everything that moves is a TRANSLATION or a joint angle — never a reshaped
 * contour — so the silhouette is identical on every frame and the sprite does
 * not boil when the strip loops.
 */
const drawSurvivor = (ctx: CanvasRenderingContext2D, s: number, t: number, o: Outfit): void => {
  const jacket = tones(o.jacket, 1.05)
  const trousers = tones(o.trousers, 1)
  const pack = tones(o.pack, 1.1)
  const cloth = tones(o.cloth, 0.9)
  const skin = tones(o.skin, 0.95)
  const steel = tones('#4a5058', 1.2)

  const phase = gait(t, HERO_CYCLE_MS)
  // Legs are half a cycle apart; that is the entire difference between running
  // and hopping.
  const lp = phase
  const rp = gait(t, HERO_CYCLE_MS, 0.5)

  const bob = bodyBob(phase, 0.055) * s
  const sway = weightShift(phase, 0.035) * s
  const lean = -0.05 * s // a runner is always falling forwards

  ctx.save()

  // ── Contact shadow ──
  // Drawn before the body and NOT bobbing with it, so the character reads as
  // lifting off the ground rather than dragging a decal around.
  ctx.save()
  ctx.globalAlpha = 0.3
  fillShape(ctx, blob(sway * 0.4, 1.0 * s, 0.38 * s, 0.1 * s, 21, 0.16), '#1a1018')
  ctx.restore()

  ctx.translate(sway, bob)

  // ── Legs ──
  //
  // A RUN seen from BEHIND, which is a different drawing from a side-view walk
  // turned round. The stride runs INTO the screen, so nothing swings sideways:
  // a foot that is forward is farther away and sits a touch higher, a foot
  // that is behind is nearer and sits a touch lower, and the whole of the
  // visible motion is the swing leg FOLDING UP — the boot rising toward the
  // seat with its sole turned to the viewer while the other leg stands
  // straight. The first version reused the side-view maths and put the stride
  // on screen-x, which splayed the legs into a V and back again. At 30 px that
  // passed for running; painted at full size it was a skater, and the painter
  // copied it faithfully.
  //
  // Hips are set narrow: a back view with wide hips reads as a duck.
  for (const [hipX, ph, seed] of [[-0.15, lp, 3], [0.15, rp, 9]] as const) {
    const [fx, fy] = footStep(ph, 0.62 * s, RUN_LIFT * s, RUN_STANCE)
    /** 0 on the ground, 1 at the top of the swing. */
    const lift01 = -fy / (RUN_LIFT * s)
    const drop = hipDrop(ph, 0.03) * s
    const hip: Pt = [hipX * s, 0.28 * s + drop]
    // `fx` is travel along the road — depth — not across it. A folded leg
    // drifts a little outward, which is what a knee does when it lifts.
    const foot: Pt = [hipX * s * (1 + lift01 * 0.3), 1.0 * s - fx * 0.1 + fy]
    const span = Math.hypot(foot[0] - hip[0], foot[1] - hip[1])
    // Bones only fractionally longer than half the span — see `limb`'s note.
    // Slack bones throw the knee sideways and the character walks like a
    // mantis. A lifted leg has a short span and simply foreshortens, which is
    // right: from behind, a folded leg IS shorter.
    const bone = Math.sqrt(0.1 * 0.1 * s * s + (span / 2) ** 2)
    limb(ctx, hip, foot, bone, bone, -Math.sign(hipX), trousers, seed, {
      width: 0.135 * s, taper: 0.72, outline: 0.035 * s, joint: 0.52
    })
    // Boot: on the ground a wedge, so the leg ends ON the ground instead of in
    // a point. Lifted, the sole turns to the viewer and the boot grows taller
    // and rounder — the one shape that says "this foot is in the air" at any
    // size, and the thing that makes the eight panels of the reference eight
    // different poses.
    const bw = 0.12 * s * (1 + lift01 * 0.3)
    const bh = 0.075 * s * (1 + lift01 * 1.2)
    const boot = blob(foot[0], foot[1] - 0.02 * s, bw, bh, seed + 40, 0.12)
    cel(ctx, boot, steel, { shade: terminator(boot, SHADOW_DIR, SHADE, 0.14, seed) })
    if (lift01 > 0.4) {
      const sole = blob(foot[0], foot[1] - 0.01 * s, bw * 0.7, bh * 0.6, seed + 42, 0.1)
      fillShape(ctx, sole, steel.deep)
    }
    ink(ctx, boot, { width: LINE.fine * s, color: INK, seed: seed + 1, breakUp: 0.25 })
  }

  ctx.translate(0, lean)

  // ── Torso ──
  // Slight taper to the waist and wider at the shoulders: the classic back-view
  // read of "person carrying something".
  const torso = blob(0, -0.1 * s, 0.32 * s, 0.42 * s, 5, 0.05)
  cel(ctx, torso, jacket, {
    shade: terminator(torso, SHADOW_DIR, SHADE, 0.12, 5),
    lit: terminator(torso, SHADOW_DIR + Math.PI, 0.6, 0.1, 7)
  })
  ink(ctx, torso, { width: LINE.mid * s, color: INK, seed: 6, breakUp: 0.28 })

  // ── Backpack ──
  // The single most important shape in the design: it is what makes a 24 px
  // silhouette read as "survivor" rather than "person".
  const packShape = blob(0, -0.14 * s, 0.27 * s, 0.3 * s, 11, 0.07)
  cel(ctx, packShape, pack, {
    shade: terminator(packShape, SHADOW_DIR, SHADE, 0.13, 11),
    lit: terminator(packShape, SHADOW_DIR + Math.PI, 0.58, 0.1, 12)
  })
  ink(ctx, packShape, { width: LINE.mid * s, color: INK, seed: 13, breakUp: 0.3 })
  // Straps over the shoulders and a lashed bedroll across the top.
  stroke(ctx, [[-0.2 * s, -0.42 * s], [-0.14 * s, 0.02 * s]], 0.05 * s, 0.045 * s, cloth.shade, 15)
  stroke(ctx, [[0.2 * s, -0.42 * s], [0.14 * s, 0.02 * s]], 0.05 * s, 0.045 * s, cloth.shade, 16)
  const roll = blob(0, -0.38 * s, 0.26 * s, 0.075 * s, 17, 0.08)
  cel(ctx, roll, cloth, { shade: terminator(roll, SHADOW_DIR, SHADE, 0.12, 17) })
  ink(ctx, roll, { width: LINE.fine * s, color: INK, seed: 18, breakUp: 0.3 })

  // ── Arms ──
  // Held forward around a weapon, so they barely swing — only the shoulders
  // rock with the stride. A back-view runner with swinging arms looks like it
  // is jogging to the shops.
  const armSwing = Math.sin(phase * Math.PI * 2) * 0.02 * s
  for (const [side, seed] of [[-1, 21], [1, 27]] as const) {
    const shoulder: Pt = [side * 0.28 * s, -0.26 * s + armSwing * side]
    const hand: Pt = [side * 0.2 * s, -0.5 * s - 0.02 * s * side]
    const span = Math.hypot(hand[0] - shoulder[0], hand[1] - shoulder[1])
    const bone = Math.sqrt(0.07 * 0.07 * s * s + (span / 2) ** 2)
    limb(ctx, shoulder, hand, bone, bone, side, jacket, seed, {
      width: 0.11 * s, taper: 0.7, outline: 0.03 * s, joint: 0.45
    })
    const glove = blob(hand[0], hand[1], 0.075 * s, 0.07 * s, seed + 3, 0.14)
    cel(ctx, glove, skin, { shade: terminator(glove, SHADOW_DIR, SHADE, 0.14, seed + 3) })
    ink(ctx, glove, { width: LINE.hair * s, color: INK, seed: seed + 4, breakUp: 0.2 })
  }

  // ── Weapon ──
  // A stubby carbine, angled slightly up and away. From behind you see the
  // stock, the top rail and a hint of barrel — enough that the muzzle flash the
  // renderer adds later lands somewhere that makes sense.
  const gun: Pt[] = [
    [-0.055 * s, -0.4 * s], [0.055 * s, -0.42 * s],
    [0.05 * s, -0.86 * s], [-0.045 * s, -0.84 * s]
  ]
  cel(ctx, gun, steel, { shade: terminator(gun, SHADOW_DIR, 0.05, 0.06, 31) })
  ink(ctx, gun, { width: LINE.fine * s, color: INK, seed: 32, breakUp: 0.2 })
  stroke(ctx, [[0, -0.62 * s], [0, -0.9 * s]], 0.035 * s, 0.028 * s, '#2a2f36', 33)

  // ── Head ──
  const headY = -0.62 * s
  const head = blob(0, headY, 0.185 * s, 0.2 * s, 41, 0.05)
  cel(ctx, head, skin, {
    shade: terminator(head, SHADOW_DIR, SHADE, 0.12, 41),
    lit: terminator(head, SHADOW_DIR + Math.PI, 0.6, 0.1, 42)
  })
  ink(ctx, head, { width: LINE.mid * s, color: INK, seed: 43, breakUp: 0.26 })

  // Hood / bandana over the crown, with the tie-tails trailing in the run. The
  // tails are the only part of the character that reads at 16 px, so they are
  // exaggerated on purpose.
  const hood = blob(0, headY - 0.05 * s, 0.2 * s, 0.16 * s, 45, 0.06)
  cel(ctx, hood, cloth, {
    shade: terminator(hood, SHADOW_DIR, SHADE, 0.12, 45),
    lit: terminator(hood, SHADOW_DIR + Math.PI, 0.58, 0.1, 46)
  })
  ink(ctx, hood, { width: LINE.mid * s, color: INK, seed: 47, breakUp: 0.3 })
  const flap = Math.sin(phase * Math.PI * 2) * 0.06 * s
  stroke(ctx, [
    [0.1 * s, headY - 0.02 * s],
    [0.22 * s, headY + 0.06 * s + flap],
    [0.3 * s, headY + 0.16 * s + flap * 1.6]
  ], 0.05 * s, 0.015 * s, cloth.shade, 48)

  ctx.restore()
}

// ─── Baking ─────────────────────────────────────────────────────────────────

interface IdleTime { timeRemaining: () => number }

const CACHE = new Map<string, HTMLCanvasElement[]>()
let queue: Outfit[] = []
let building: { o: Outfit; frames: HTMLCanvasElement[] } | null = null
let scheduled = false

const bakeFrame = (o: Outfit, i: number): HTMLCanvasElement => {
  const c = document.createElement('canvas')
  c.width = PX
  c.height = PX
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.translate(PX / 2, PX * 0.52)
    drawSurvivor(ctx, S, (i / FRAMES) * HERO_CYCLE_MS, o)
  }
  return c
}

/**
 * Draw one frame of an outfit into a `w x h` panel at the context's origin.
 *
 * The art bench's way in: the reference sheet a painter works over goes through
 * the SAME transform `bakeFrame` uses, scaled to the panel, so a strip painted
 * over it drops straight back in with the feet on the same line.
 *
 * Not used at run time.
 */
export const paintSurvivorFrame = (
  ctx: CanvasRenderingContext2D,
  outfit: number, i: number, frames: number, w: number, h: number
): void => {
  const o = OUTFITS[Math.abs(outfit) % OUTFITS.length]
  if (!o) return
  ctx.save()
  ctx.translate(w / 2, h * 0.52)
  // The MIDDLE of each panel's slice of the cycle, not its start. A painted
  // strip shows panel `i` for the whole of [i/n, (i+1)/n), so its centre is
  // the honest sample — and, with the run's swing peaking between two of the
  // start-of-slice samples, sampling at the start put the boot's top in two
  // consecutive panels and the painter returned the same pose twice.
  drawSurvivor(ctx, S * (h / PX), ((i + 0.5) / frames) * HERO_CYCLE_MS, o)
  ctx.restore()
}

/** Wall-clock budget for one bake slice, in ms. */
const SLICE_MS = 6
/**
 * Frames baked per slice even when the budget is already spent.
 *
 * This constant is the whole fix for a real bug. The loop used to run
 * `while ((deadline?.timeRemaining() ?? 0) > 8)`, which looks like a sensible
 * idle-time budget and is a trap: when `requestIdleCallback` fires because its
 * TIMEOUT expired — which is what happens on a busy main thread, i.e. a
 * mid-range phone running this game — the spec says `timeRemaining()` returns
 * ZERO. So the loop baked exactly one frame per callback and re-armed. At
 * 3 outfits x 14 frames that is 42 timeouts: the crowd rendered as fallback
 * capsules for the better part of a minute, and only on devices that never get
 * idle slices. Desktop Chrome has idle time between frames, bakes the whole set
 * in one or two callbacks, and shows nothing wrong.
 *
 * So the slice is measured on the wall clock, and a minimum number of frames is
 * baked unconditionally — a timed-out callback must still make real progress.
 */
const MIN_PER_SLICE = 4

const nowMs = (): number =>
  (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? performance.now()
    : Date.now()

const pump = (deadline?: IdleTime): void => {
  scheduled = false
  const started = nowMs()
  let baked = 0

  for (;;) {
    if (!building) {
      const next = queue.shift()
      if (!next) return
      building = { o: next, frames: [] }
    }
    building.frames.push(bakeFrame(building.o, building.frames.length))
    baked++
    if (building.frames.length >= FRAMES) {
      CACHE.set(building.o.id, building.frames)
      building = null
    }

    if (queue.length === 0 && !building) break
    // Always bake the minimum, then keep going only while there is genuine idle
    // time OR the wall-clock slice still has room.
    if (baked < MIN_PER_SLICE) continue
    if ((deadline?.timeRemaining() ?? 0) > 8) continue
    if (nowMs() - started < SLICE_MS) continue
    break
  }
  schedule()
}

const schedule = (): void => {
  if (scheduled || (queue.length === 0 && !building)) return
  scheduled = true
  const ric = (globalThis as { requestIdleCallback?: (cb: (d: IdleTime) => void, o?: { timeout: number }) => void })
    .requestIdleCallback
  // A SHORT timeout on purpose: on a main thread with no idle slices this is
  // the only cadence the bake gets, so it sets the worst-case finish time.
  if (typeof ric === 'function') ric(pump, { timeout: 300 })
  else setTimeout(() => pump(), 0)
}

/** Ask for the outfits to be baked. Cheap, idempotent, safe every frame. */
export const primeSurvivors = (opts: { fetch?: boolean } = {}): void => {
  for (const o of OUTFITS) {
    // The painted run cycle rides the same signal — see `primeMonsterSprites`.
    if (opts.fetch !== false) spriteFor('hero', o.id)
    if (CACHE.has(o.id) || queue.includes(o) || building?.o === o) continue
    queue.push(o)
  }
  schedule()
}

/**
 * Bake synchronously for up to `budgetMs`, then hand control back.
 *
 * For the LOADING SCREEN only. While the splash is up nothing else is animating,
 * so a fat slice is invisible — and it removes the bake's dependency on
 * `requestIdleCallback` cadence entirely, which is what makes the wait bounded by
 * CPU rather than by however rarely the browser hands out idle slots. Without it
 * a device that never goes idle bakes at the callback timeout's rate, and the
 * loader would sit on its cap instead of finishing.
 *
 * Do NOT call this once gameplay is running: that is what the sliced, idle-driven
 * `pump` is for.
 */
export const bakeSurvivorSlice = (budgetMs = 8): void => {
  const started = nowMs()
  while (queue.length > 0 || building) {
    if (!building) {
      const next = queue.shift()
      if (!next) return
      building = { o: next, frames: [] }
    }
    building.frames.push(bakeFrame(building.o, building.frames.length))
    if (building.frames.length >= FRAMES) {
      CACHE.set(building.o.id, building.frames)
      building = null
    }
    if (nowMs() - started >= budgetMs) return
  }
}

/** True once every outfit's strip is baked — i.e. `survivorFrame` can no longer
 *  return null for a live unit and the crowd will never draw as capsules. The
 *  splash waits on this: the survivors are the only art on screen at t=0. */
export const survivorsReady = (): boolean => OUTFITS.every((o) => CACHE.has(o.id))

/** 0..1 across every outfit's strip, for the loading bar. */
export const survivorBakeProgress01 = (): number => {
  const total = OUTFITS.length * FRAMES
  if (total === 0) return 1
  let done = 0
  for (const o of OUTFITS) done += CACHE.get(o.id)?.length ?? 0
  if (building) done += building.frames.length
  return Math.min(1, done / total)
}

/** The frame for an outfit at a normalised stride position, or `null` while it
 *  is still baking. */
export const survivorFrame = (outfit: number, cycle01: number): HTMLCanvasElement | null => {
  const o = OUTFITS[Math.abs(outfit) % OUTFITS.length]
  if (!o) return null
  const c01 = ((cycle01 % 1) + 1) % 1
  // Paint wins when it is there; both strips cover exactly one stride, so one
  // normalised position indexes either and the swap is seamless mid-step.
  const paint = stripFrame('hero', o.id, HERO_FRAME_ASPECT, c01)
  if (paint) return paint
  const frames = CACHE.get(o.id)
  if (!frames) return null
  const i = Math.floor(c01 * FRAMES) % FRAMES
  return frames[i] ?? null
}

/** Body colour for an outfit — used by the fallback capsule and by particle
 *  debris, so a survivor who dies throws the right colour of dust. */
export const outfitTone = (outfit: number): CelTones => {
  const o = OUTFITS[Math.abs(outfit) % OUTFITS.length] ?? OUTFITS[0]!
  return tones(o.jacket, 1.05)
}
