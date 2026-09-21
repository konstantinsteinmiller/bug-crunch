/**
 * ─── The rendered SFX: loading and playing the sprite files ─────────────────
 *
 * Most of this game's cues are no longer built from oscillators at call time:
 * they are rendered offline from physical and modal models
 * (`tools/audio/build-sfx.mjs`, cue sheet in `tools/audio/sfx/recipes.mjs`) and
 * shipped as a handful of Vorbis SPRITES — several takes of several cues per
 * file, located by the generated manifest (`game/audio/sfxSprites.ts`). This
 * module loads those files and plays takes out of them. `useGameAudio.playFx`
 * asks it first and falls back to the live synth when it answers `false`, so a
 * cue is never silent: not while a sprite is still downloading, not on a
 * browser that cannot decode it.
 *
 * ── The ad-mute guarantee ──
 *
 * Everything here runs on the ONE shared AudioContext from `useAssets` (the one
 * the ad/pause gate suspends), every source is registered with
 * `registerOneShotSource` (so an interstitial hard-stops it, loops included),
 * and nothing here ever creates an AudioContext or an HTMLAudioElement. The
 * caller routes each voice through its own mixer (`out`), which ends at that
 * context's destination.
 *
 * ── Staging ──
 *
 * Tier 1 (the shoe, the chain, the vial, the finisher, the stars, the clock —
 * what level 1-1 can play) loads with the idle SFX preload after first paint.
 * Tier 2 (props, set pieces, bosses) loads on an idle slot once the first level
 * has ended, or a minute after tier 1, whichever comes first; a tier-2 cue
 * asked for before that starts its sprite loading and plays the live synth
 * meanwhile.
 *
 * ── Memory ──
 *
 * The files are 22.05 kHz; `decodeAudioData` hands back the context's rate
 * (44.1/48 kHz). The decoded buffer is halved back down by taking every other
 * sample — exact, not an approximation, because the source holds nothing above
 * 11.025 kHz — which halves the decoded footprint (the crush bank does the same
 * with its 24 kHz renders).
 */
import { getAudioContext, registerOneShotSource } from '@/use/useAssets'
import { prependBaseUrl } from '@/utils/function'
import { SFX_CUES, SFX_SPRITES } from '@/game/audio/sfxSprites'
import {
  pickSlot, shotGain, shotRate, spritesOfTier, stackCount, type SfxCueSpec
} from '@/game/audio/sfxPick'

/** Where a voice's gain node goes — the caller's pan + destination. A static
 *  function rather than a closure, so a held loop allocates nothing per frame. */
export type SfxOut = (node: AudioNode, pan: number) => void
/** The player's SFX slider applied to a base gain. */
export type SfxVol = (base: number) => number

const buffers = new Map<string, AudioBuffer>()
const pending = new Map<string, Promise<AudioBuffer | null>>()
const failed = new Set<string>()
const lastSlot = new Map<string, number>()

export const hasSfxCue = (id: string): boolean => id in SFX_CUES

/** Halve a decoded buffer's rate (see the header). Falls back to the buffer
 *  itself on a browser that refuses the lower rate. */
const halve = (ctx: AudioContext, b: AudioBuffer): AudioBuffer => {
  if (b.sampleRate < 44100 || b.numberOfChannels !== 1) return b
  try {
    const n = Math.floor(b.length / 2)
    const out = ctx.createBuffer(1, n, b.sampleRate / 2)
    const src = b.getChannelData(0)
    const dst = out.getChannelData(0)
    for (let i = 0; i < n; i++) dst[i] = src[2 * i]!
    return out
  } catch {
    return b
  }
}

const loadSprite = (id: string): Promise<AudioBuffer | null> => {
  const have = buffers.get(id)
  if (have) return Promise.resolve(have)
  const inflight = pending.get(id)
  if (inflight) return inflight
  const spec = SFX_SPRITES[id]
  const ctx = getAudioContext()
  if (!spec || !ctx || failed.has(id)) return Promise.resolve(null)
  const p = (async (): Promise<AudioBuffer | null> => {
    try {
      const res = await fetch(prependBaseUrl(`audio/sfx/${spec.file}.ogg`))
      if (!res.ok) throw new Error(String(res.status))
      const decoded = await ctx.decodeAudioData(await res.arrayBuffer())
      const buf = halve(ctx, decoded)
      buffers.set(id, buf)
      return buf
    } catch (e) {
      // A browser that cannot decode Vorbis keeps the live synth for good.
      failed.add(id)
      console.warn(`[sfx] sprite ${id} unavailable, using the live synth`, e)
      return null
    } finally {
      pending.delete(id)
    }
  })()
  pending.set(id, p)
  return p
}

/** Load every sprite of a tier. Idempotent; never rejects. */
export const preloadSfxTier = (tier: number): Promise<void> =>
  Promise.allSettled(spritesOfTier(SFX_SPRITES, tier).map(loadSprite)).then(() => undefined)

let tier2Scheduled = false
/** Queue tier 2 on an idle slot. Idempotent. */
export const scheduleSfxTier2 = (): void => {
  if (tier2Scheduled || typeof window === 'undefined') return
  tier2Scheduled = true
  const w = window as Window & { requestIdleCallback?: Window['requestIdleCallback'] }
  const go = (): void => { void preloadSfxTier(2) }
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(go, { timeout: 4000 })
  else setTimeout(go, 200)
}

/** Tier 1, then — a minute later at the latest — tier 2. For the idle preload. */
export const preloadSfx = (): Promise<void> =>
  preloadSfxTier(1).then(() => {
    if (typeof window !== 'undefined') setTimeout(scheduleSfxTier2, 60_000)
  })

/** The cue's buffer if its sprite is decoded; otherwise start loading it. */
const bufferFor = (cue: SfxCueSpec): AudioBuffer | null => {
  const b = buffers.get(cue.sprite)
  if (b) return b
  void loadSprite(cue.sprite)
  return null
}

const startTake = (
  ctx: AudioContext, buf: AudioBuffer, slot: readonly [number, number],
  rate: number, gain: number, pan: number, out: SfxOut, when: number
): void => {
  const src = ctx.createBufferSource()
  src.buffer = buf
  if (rate !== 1) src.playbackRate.value = rate
  const g = ctx.createGain()
  g.gain.value = gain
  src.connect(g)
  out(g, pan)
  src.start(when, slot[0], slot[1])
  registerOneShotSource(src)
}

/**
 * Play one rendered cue. Returns false when it cannot (not in the manifest, or
 * its sprite is not decoded yet) — the caller then plays the live synth.
 */
export const playSfx = (ctx: AudioContext, id: string, power: number, pan: number, out: SfxOut, vol: SfxVol): boolean => {
  const cue = SFX_CUES[id]
  if (!cue) return false
  const buf = bufferFor(cue)
  if (!buf) return false
  const now = ctx.currentTime
  if (cue.pick === 'stack') {
    // One chime per body, 35 ms apart, each a touch softer.
    const n = stackCount(cue, power)
    for (let i = 0; i < n; i++) startTake(ctx, buf, cue.slots[i]!, 1, vol(cue.gain * (1 - 0.06 * i)), pan, out, now + i * 0.035)
    return true
  }
  if (cue.pick === 'loop') return false
  const slot = pickSlot(cue, power, lastSlot.get(id) ?? -1, Math.random())
  lastSlot.set(id, slot)
  startTake(ctx, buf, cue.slots[slot]!, shotRate(cue, power, Math.random()), vol(shotGain(cue, power, Math.random())), pan, out, now)
  return true
}

// ─── Loops ──────────────────────────────────────────────────────────────────
//
// A loop is HELD: the caller asks for it every frame it should sound
// (`holdSfxLoop`) and lets go (`stopSfxLoop`) — which stops it dead, in 6 ms, so
// the slam lands on silence. A loop nobody has asked for in 180 ms stops by
// itself: a scene that stops stepping (a pause, a cutscene, a level that ended
// mid-charge) can never leave one droning.

interface LoopVoice {
  src: AudioBufferSourceNode
  gain: GainNode
  lastHold: number
  level: number
}

const loops = new Map<string, LoopVoice>()
let watchdog: ReturnType<typeof setInterval> | null = null

const LOOP_DEADMAN_MS = 180

export const stopSfxLoop = (id: string, fadeS = 0.006): void => {
  const v = loops.get(id)
  if (!v) return
  loops.delete(id)
  try {
    const t = v.src.context.currentTime
    v.gain.gain.cancelScheduledValues(t)
    v.gain.gain.setValueAtTime(v.gain.gain.value, t)
    v.gain.gain.linearRampToValueAtTime(0, t + fadeS)
    v.src.stop(t + fadeS + 0.002)
  } catch { /* already stopped */ }
  if (loops.size === 0 && watchdog) { clearInterval(watchdog); watchdog = null }
}

const armWatchdog = (): void => {
  if (watchdog) return
  watchdog = setInterval(() => {
    const now = performance.now()
    for (const [id, v] of loops) if (now - v.lastHold > LOOP_DEADMAN_MS) stopSfxLoop(id, 0.02)
  }, 60)
}

export interface LoopShape {
  /** Playback rate at level 0 and 1. */
  rate: readonly [number, number]
  /** Gain multiplier at level 0 and 1. */
  gain: readonly [number, number]
  /** Fade-in, seconds. */
  attack?: number
}

/**
 * Hold a looping cue for one more frame at `level` (0..1). Starts it if it is
 * not running. Returns false when it cannot (no sprite yet) — the caller simply
 * has no loop until the sprite lands.
 */
export const holdSfxLoop = (
  ctx: AudioContext, id: string, level: number, shape: LoopShape, pan: number, out: SfxOut, vol: SfxVol
): boolean => {
  const cue = SFX_CUES[id]
  if (!cue?.loop) return false
  const lv = Math.max(0, Math.min(1, Number.isFinite(level) ? level : 0))
  const rate = shape.rate[0] + (shape.rate[1] - shape.rate[0]) * lv
  const gain = vol(cue.gain * (shape.gain[0] + (shape.gain[1] - shape.gain[0]) * lv))
  const t = ctx.currentTime
  const running = loops.get(id)
  if (running) {
    running.lastHold = performance.now()
    // Only touch the params when the level has actually moved — a held charge
    // at full would otherwise queue an automation event every frame.
    if (Math.abs(lv - running.level) > 1 / 64) {
      running.level = lv
      running.src.playbackRate.setTargetAtTime(rate, t, 0.03)
      running.gain.gain.setTargetAtTime(gain, t, 0.03)
    }
    return true
  }
  const buf = bufferFor(cue)
  if (!buf) return false
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.loopStart = cue.loop[0]
  src.loopEnd = cue.loop[1]
  src.playbackRate.value = rate
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + (shape.attack ?? 0.02))
  src.connect(g)
  out(g, pan)
  src.start(t, cue.loop[0])
  registerOneShotSource(src)
  const voice: LoopVoice = { src, gain: g, lastHold: performance.now(), level: lv }
  // An interstitial's hard stop (or any other end) frees the slot, so the next
  // hold starts a fresh voice instead of steering a dead one.
  src.addEventListener('ended', () => { if (loops.get(id) === voice) loops.delete(id) }, { once: true })
  loops.set(id, voice)
  armWatchdog()
  return true
}

/**
 * A loop played ONCE for a fixed time — a cutscene's charge or slide, which
 * fires the cue as a one-shot. Rate glides from `rate[0]` to `rate[1]` over the
 * shot; the gain fades in and out.
 */
export const playSfxLoopOnce = (
  ctx: AudioContext, id: string, durS: number, shape: LoopShape, pan: number, out: SfxOut, vol: SfxVol, fadeOutS = 0.12
): boolean => {
  const cue = SFX_CUES[id]
  if (!cue?.loop) return false
  const buf = bufferFor(cue)
  if (!buf) return false
  const t = ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.loopStart = cue.loop[0]
  src.loopEnd = cue.loop[1]
  src.playbackRate.setValueAtTime(shape.rate[0], t)
  src.playbackRate.linearRampToValueAtTime(shape.rate[1], t + durS * 0.85)
  const g = ctx.createGain()
  const peak = vol(cue.gain * shape.gain[1])
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol(cue.gain * shape.gain[0]), t + (shape.attack ?? 0.03))
  g.gain.linearRampToValueAtTime(peak, t + durS - fadeOutS)
  g.gain.linearRampToValueAtTime(0, t + durS)
  src.connect(g)
  out(g, pan)
  src.start(t, cue.loop[0])
  src.stop(t + durS + 0.01)
  registerOneShotSource(src)
  return true
}

/** Test/bench seam. */
export const __sfxSpriteState = (): { loaded: string[]; failed: string[]; loops: string[] } => ({
  loaded: [...buffers.keys()], failed: [...failed], loops: [...loops.keys()]
})
