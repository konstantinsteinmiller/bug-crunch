import { getAudioContext, isAudioSuspended } from '@/use/useAssets'
import { isMobileAudioMuted } from '@/use/useMobileAudioMute'
import useUser from '@/use/useUser'
import useSounds from '@/use/useSound'
import type { JuiceStyleId } from '@/game/juiceStyle'

/**
 * ─── Splatix audio ──────────────────────────────────────────────────────────
 *
 * Two sources, one entry point (`playFx`):
 *
 *   SAMPLES   — where a recorded sound is unmistakably better: the coin, the
 *               level-clear fanfare, the time-up sting. These route through the
 *               shared `useSound` fast path (decoded AudioBuffers).
 *   SYNTHESIS — everything a stomp makes. A good run squishes four bugs a
 *               second; sample playback of one squelch at that rate sounds like
 *               a machine jam, and shipping forty variants would bloat the
 *               download. Every squish is synthesised per event with randomised
 *               pitch and envelope, so no two are identical and the whole
 *               combat mix costs zero bytes.
 *
 * ── The three-layer squish (GDD §8.2) ──
 *
 * Every kill fires three voices in one call, and they are three different
 * SOUNDS rather than one sound at three volumes:
 *
 *   1. IMPACT  a short low thud — the shoe arriving. Its weight is the shoe's:
 *              a steel boot is a 60 Hz slam, a bunny slipper is a soft pat.
 *   2. JUICE   a wet downward glide through a band-pass, pitched by the bug's
 *              MASS: a tiny ant pops high and fast, a beetle bursts low and
 *              slow. This is the layer players actually hear as "the squish".
 *   3. DEBRIS  a short crackle of shell or a rustle of wing, only for the
 *              bodies that have one.
 *
 * The Juice Style setting swaps layer 2 wholesale — `paper` for confetti,
 * `pop` for bubbles — because a player who picked Bubble Pop to avoid the
 * squelch should not still hear the squelch.
 *
 * ── The chain is a melody ──
 *
 * Each rung of the Splat Chain plays the next note of a pentatonic ladder, so a
 * long chain is an ascending phrase and a broken one drops back to the root.
 * It is the single strongest piece of feedback in the game, and it costs one
 * oscillator.
 *
 * Everything runs on the SHARED AudioContext from `useAssets`, which the ad /
 * pause gate suspends — so "no game audio during an ad" covers synthesised
 * sound for free: a suspended context produces silence.
 */

export type FxSound =
  // The foot
  | 'stompLight' | 'stompHeavy' | 'charge' | 'pivot' | 'slide' | 'land'
  // The bodies
  | 'squish' | 'hurt' | 'clang' | 'spike'
  // The chain and the vial
  | 'chainStep' | 'chainBreak' | 'feverReady' | 'feverStart' | 'feverEnd'
  // Props
  | 'salt' | 'magnet' | 'sweep' | 'podPop' | 'podHatch' | 'coin' | 'arc'
  // The boss
  | 'bossHit' | 'bossCounter' | 'bossPhase' | 'bossCharge' | 'bossBeam' | 'bossDie'
  // Flow
  | 'levelClear' | 'levelFail' | 'star' | 'countUp' | 'unlock' | 'tick'

// ─── Throttling ─────────────────────────────────────────────────────────────
//
// A busy second produces dozens of events. Without a per-cue budget the mix
// turns to mud and the main thread spends real time building oscillator graphs.
// Each cue gets a minimum gap AND a per-window voice cap.

interface Throttle { minGapMs: number; maxPerWindow: number; windowMs: number }

const THROTTLES: Partial<Record<FxSound, Throttle>> = {
  // The busiest cue in the game by a wide margin, and the one the whole mix is
  // built around. Generous, because a Fever that clears twelve bodies has to
  // SOUND like it cleared twelve bodies — but capped, because forty squelches
  // in a second is a single noise.
  squish: { minGapMs: 34, maxPerWindow: 8, windowMs: 300 },
  hurt: { minGapMs: 55, maxPerWindow: 5, windowMs: 300 },
  // The ricochet is the most annoying sound in the game if it repeats: it is a
  // NEGATIVE cue and a player hammering a beetle hears it four times a second.
  // Tighter than anything else here on purpose.
  clang: { minGapMs: 110, maxPerWindow: 3, windowMs: 500 },
  stompLight: { minGapMs: 70, maxPerWindow: 6, windowMs: 400 },
  coin: { minGapMs: 45, maxPerWindow: 8, windowMs: 400 },
  arc: { minGapMs: 40, maxPerWindow: 6, windowMs: 300 },
  bossHit: { minGapMs: 80, maxPerWindow: 4, windowMs: 400 },
  // Rare rather than dense, and in the table for the opposite reason to the
  // rest: this row protects the player from a CALLER that has lost track of
  // which rungs it has already announced, which would turn a half-second chime
  // into the sound of the rest of the level.
  chainStep: { minGapMs: 70, maxPerWindow: 6, windowMs: 500 },
  sweep: { minGapMs: 60, maxPerWindow: 5, windowMs: 400 },
  podPop: { minGapMs: 70, maxPerWindow: 4, windowMs: 400 }
}

const lastAt: Partial<Record<FxSound, number>> = {}
const windowHits: Partial<Record<FxSound, number[]>> = {}

const passesThrottle = (id: FxSound): boolean => {
  const t = THROTTLES[id]
  if (!t) return true
  const now = performance.now()
  if (now - (lastAt[id] ?? -Infinity) < t.minGapMs) return false
  const hits = (windowHits[id] ??= [])
  while (hits.length > 0 && now - hits[0]! > t.windowMs) hits.shift()
  if (hits.length >= t.maxPerWindow) return false
  hits.push(now)
  lastAt[id] = now
  return true
}

// ─── Volume ─────────────────────────────────────────────────────────────────

const { userSoundVolume } = useUser()

/** Master gain for a synthesised voice, folding in the player's SFX slider. */
const vol = (base: number): number =>
  Math.max(0, Math.min(1, base * (userSoundVolume.value ?? 0.7)))

const canPlay = (): boolean => !isAudioSuspended() && !isMobileAudioMuted.value

// ─── Synthesis primitives ───────────────────────────────────────────────────

/** Shared, lazily-built white-noise buffer. Rebuilding noise per shot would be
 *  half a second of `Math.random()` per second at combat density. */
let noiseBuffer: AudioBuffer | null = null
const getNoise = (ctx: AudioContext): AudioBuffer => {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const len = Math.floor(ctx.sampleRate * 1.2)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buf
  return buf
}

/**
 * ─── A room, for the few cues that need one ─────────────────────────────────
 *
 * Every voice in this mixer goes straight to the destination, dry, and for the
 * combat bed that is right: forty shots a second through a reverb is a wash.
 * The two late skills are the exception. A frost nova is the whole world
 * stopping, and a dry crackle reads as a sound effect where a crackle with a
 * cold cavern behind it reads as a place; the flare is a light in the distance
 * and needs distance. So they alone SEND to this bus — a synthesised stereo
 * impulse, darkened by a low-pass so the space is stone rather than tile.
 *
 * Built lazily on the first cue that asks for it, and never for a session that
 * never reaches stage 5: ~1.7 MB of impulse for a player who will never hear it
 * would be the definition of waste.
 */
let reverb: { ctx: AudioContext; input: GainNode } | null = null

const buildImpulse = (ctx: AudioContext, seconds: number, decay: number): AudioBuffer => {
  const rate = ctx.sampleRate
  const len = Math.max(1, Math.floor(rate * seconds))
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      const t = i / len
      // Exponential-ish decay, independently noisy per channel: the difference
      // between the ears is what makes it a space rather than an echo.
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay)
    }
    // A handful of early reflections, the walls answering first.
    for (const [ms, g] of [[11, 0.55], [23, 0.4], [37, 0.3], [52, 0.22]] as const) {
      const at = Math.floor((ms + ch * 3) * rate / 1000)
      if (at < len) d[at] = (d[at] ?? 0) + (ch === 0 ? g : -g)
    }
  }
  return buf
}

const getReverb = (ctx: AudioContext): AudioNode | null => {
  if (reverb && reverb.ctx === ctx) return reverb.input
  try {
    const conv = ctx.createConvolver()
    conv.buffer = buildImpulse(ctx, 2.2, 3.1)
    const input = ctx.createGain()
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 5200
    const wet = ctx.createGain()
    wet.gain.value = 0.55
    input.connect(conv).connect(tone).connect(wet).connect(ctx.destination)
    reverb = { ctx, input }
    return input
  } catch {
    return null
  }
}

/** Where a voice's last gain stage goes: straight out (the combat bed), or out
 *  through a pan and a send — the late skills, which have a side and a room. */
interface Route {
  /** -1 left … 1 right. */
  pan?: number
  /** 0…1 of the voice sent to the room as well. */
  send?: number
  /** A bus of the caller's own, instead of the destination — the flare's burn
   *  loop, so the whole loop can be faded as one. */
  dest?: AudioNode
}

const route = (ctx: AudioContext, out: AudioNode, o: Route): void => {
  let tail: AudioNode = out
  if (o.pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, o.pan))
    out.connect(p)
    tail = p
  }
  tail.connect(o.dest ?? ctx.destination)
  if (o.send && o.send > 0 && !o.dest) {
    const room = getReverb(ctx)
    if (room) {
      const s = ctx.createGain()
      s.gain.value = o.send
      tail.connect(s).connect(room)
    }
  }
}

interface NoiseOpts extends Route {
  duration: number
  gain: number
  /** Filter sweep, Hz. */
  filterFrom: number
  filterTo: number
  type?: BiquadFilterType
  q?: number
  delay?: number
}

/** A filtered noise burst — the backbone of impacts, bursts and debris. */
const noiseBurst = (ctx: AudioContext, o: NoiseOpts): void => {
  const src = ctx.createBufferSource()
  src.buffer = getNoise(ctx)
  src.playbackRate.value = 0.85 + Math.random() * 0.3

  const filter = ctx.createBiquadFilter()
  filter.type = o.type ?? 'lowpass'
  filter.Q.value = o.q ?? 1
  const now = ctx.currentTime + (o.delay ?? 0)
  filter.frequency.setValueAtTime(o.filterFrom, now)
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.filterTo), now + o.duration)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(o.gain, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + o.duration)

  src.connect(filter).connect(gain)
  route(ctx, gain, o)
  src.start(now)
  src.stop(now + o.duration + 0.02)
}

interface ToneOpts extends Route {
  freq: number
  toFreq?: number
  duration: number
  gain: number
  type?: OscillatorType
  delay?: number
  /** Optional lowpass to take the edge off a raw saw/square. */
  filter?: number
  /** Seconds to the peak. 4 ms by default — a pad wants a swell, not a click. */
  attack?: number
}

/** A single pitched voice with an exponential envelope. */
const tone = (ctx: AudioContext, o: ToneOpts): void => {
  const now = ctx.currentTime + (o.delay ?? 0)
  const osc = ctx.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, now)
  if (o.toFreq && o.toFreq !== o.freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.toFreq), now + o.duration)
  }

  const gain = ctx.createGain()
  // 4 ms attack avoids the click a hard start would produce.
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), now + (o.attack ?? 0.004))
  gain.gain.exponentialRampToValueAtTime(0.0001, now + o.duration)

  let node: AudioNode = osc
  if (o.filter) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.filter
    osc.connect(f)
    node = f
  }
  node.connect(gain)
  route(ctx, gain, o)
  osc.start(now)
  osc.stop(now + o.duration + 0.02)
}

/**
 * A struck bell: the note, plus two INHARMONIC partials above it (×2.76 and
 * ×5.4, the ratios of a real bar or bell) that decay faster than the note does.
 * The inharmonics are what make it glass or ice rather than a keyboard — a pure
 * sine at 2.6 kHz is a test tone, the same sine with its overtones out of tune
 * is a crystal ringing.
 */
const bell = (ctx: AudioContext, o: ToneOpts): void => {
  tone(ctx, { ...o, type: 'sine' })
  tone(ctx, { ...o, freq: o.freq * 2.76, toFreq: undefined, gain: o.gain * 0.36, duration: o.duration * 0.45, type: 'sine' })
  tone(ctx, { ...o, freq: o.freq * 5.4, toFreq: undefined, gain: o.gain * 0.16, duration: o.duration * 0.22, type: 'sine' })
}

/**
 * Tiny, dry, high clicks scattered over a window: ice forming, a flame
 * spitting, a firework's tail. Each is a few milliseconds of noise through a
 * band chosen per click, so a run of them is a texture rather than a rhythm.
 */
interface CrackleOpts extends Route {
  count: number
  /** Window, seconds from now. */
  from: number
  to: number
  gain: number
  lo: number
  hi: number
}
const crackle = (ctx: AudioContext, o: CrackleOpts): void => {
  for (let i = 0; i < o.count; i++) {
    const f = o.lo + Math.random() * (o.hi - o.lo)
    noiseBurst(ctx, {
      duration: 0.012 + Math.random() * 0.024,
      gain: o.gain * (0.45 + Math.random() * 0.55),
      filterFrom: f, filterTo: f * 0.7,
      type: 'bandpass', q: 1.6 + Math.random() * 2,
      delay: o.from + Math.random() * (o.to - o.from),
      pan: o.pan, send: o.send, dest: o.dest
    })
  }
}

// ─── Cue definitions ────────────────────────────────────────────────────────

const { playSound } = useSounds()

/** Cues that map cleanly onto a shipped sample: `[file, volumeRatio]`. */
const SAMPLE_CUES: Partial<Record<FxSound, [string, number]>> = {
  coin: ['coin-pickup', 0.05],
  levelClear: ['celebration-1', 0.09],
  bossDie: ['celebration-3', 0.1],
  levelFail: ['lose', 0.1],
  star: ['happy', 0.07],
  unlock: ['level-up', 0.07]
}

/**
 * Pentatonic ladder for the Splat Chain.
 *
 * A chromatic run up forty semitones is unbearable; a pentatonic one is a
 * melody no matter where the player stops squishing.
 *
 * It WRAPS: the ladder climbs three octaves and starts again from the bottom, so
 * a fifty-long chain is a repeating rising phrase instead of a dog whistle. An
 * unbounded octave term puts the top of the ladder past 20 kHz, where the
 * browser clamps it, logs a warning per note, and the loudest feedback in the
 * game becomes silence at exactly the moment it matters most.
 */
const PENTATONIC = [0, 2, 4, 7, 9]
/** Octaves the ladder climbs before it restarts at the bottom. */
export const OCTAVE_WRAP = 3
/** Steps in one full phrase — five pentatonic notes per octave. */
export const LADDER_STEPS = PENTATONIC.length * OCTAVE_WRAP

export const chainFreq = (step: number): number => {
  const n = Math.max(0, Math.floor(step)) % LADDER_STEPS
  const semis = PENTATONIC[n % 5]! + Math.floor(n / 5) * 12
  return 392 * Math.pow(2, semis / 12)
}

// ─── The squish, in three layers ────────────────────────────────────────────

/** Everything one squish needs to know about itself. */
export interface SquishVoice {
  /** The body's mass, 0 (an ant) .. 1 (a boss-sized beetle). Drives the pitch
   *  of the juice layer, which is the layer the player hears as "the squish". */
  mass: number
  /** The shoe's weight, 0 (slipper) .. 1 (steel boot). Drives the impact. */
  weight: number
  /** The Juice Style, which swaps the middle layer wholesale. */
  style: JuiceStyleId
  /** Has a shell or wings to crack. */
  debris: boolean
  /** A heavy slam rather than a tap. */
  heavy: boolean
  /** -1 left .. 1 right. */
  pan: number
}

let squishCfg: SquishVoice = {
  mass: 0.2, weight: 0.3, style: 'ooze', debris: false, heavy: false, pan: 0
}

/** Set the parameters the NEXT `playFx('squish')` will use. Two calls rather
 *  than one wide signature, because `playFx` is the one entry point every cue
 *  goes through and widening it for one cue would bend the whole module. */
export const setSquishVoice = (v: Partial<SquishVoice>): void => {
  squishCfg = { ...squishCfg, ...v }
}

const squish = (ctx: AudioContext, v: SquishVoice): void => {
  const pan = v.pan
  const heavy = v.heavy ? 1.35 : 1

  // ── Layer 1 · IMPACT ──
  // A pitched thud plus a click. The pitch falls with the shoe's weight, which
  // is the whole difference between a slipper and a boot.
  const thud = 120 - v.weight * 62
  tone(ctx, {
    freq: thud, toFreq: thud * 0.45, duration: 0.09 + v.weight * 0.08,
    gain: vol(0.16 * heavy), type: 'sine', pan
  })
  noiseBurst(ctx, {
    duration: 0.035, gain: vol(0.06 * heavy),
    filterFrom: 2600 - v.weight * 900, filterTo: 400, pan
  })

  // ── Layer 2 · JUICE ──
  // The style decides what a burst body sounds like.
  if (v.style === 'pop' as never) { /* unreachable — kept for the exhaustive read */ }
  const base = 780 - v.mass * 430
  if (v.style === 'ooze') {
    // A wet downward glide through a resonant band-pass. The glide is the
    // squelch: a static filter is a beep, and a filter falling three hundred
    // hertz in eighty milliseconds is a thing bursting.
    noiseBurst(ctx, {
      duration: 0.11 + v.mass * 0.1, gain: vol(0.2),
      filterFrom: base * 2.2, filterTo: base * 0.55,
      type: 'bandpass', q: 4.5 + Math.random() * 2, delay: 0.012, pan
    })
    tone(ctx, {
      freq: base * 1.1, toFreq: base * 0.42, duration: 0.1 + v.mass * 0.08,
      gain: vol(0.07), type: 'triangle', filter: 2400, delay: 0.012, pan
    })
  } else if (v.style === 'confetti') {
    // Paper. A dry high rustle and a tiny party pop — no wetness anywhere.
    noiseBurst(ctx, {
      duration: 0.09, gain: vol(0.16),
      filterFrom: 5200, filterTo: 2200, type: 'highpass', q: 0.8, delay: 0.01, pan
    })
    tone(ctx, {
      freq: base * 2.1, toFreq: base * 3.2, duration: 0.05,
      gain: vol(0.09), type: 'square', filter: 3200, delay: 0.01, pan
    })
    crackle(ctx, { count: 5, from: 0.02, to: 0.14, gain: vol(0.05), lo: 2600, hi: 7200, pan })
  } else {
    // Soap. One clean rising blip and nothing else — the gentlest sound in the
    // game, and the reason the setting exists.
    tone(ctx, {
      freq: base * 0.8, toFreq: base * 2.4, duration: 0.085,
      gain: vol(0.12), type: 'sine', delay: 0.008, pan, attack: 0.01
    })
    noiseBurst(ctx, {
      duration: 0.05, gain: vol(0.04),
      filterFrom: 4200, filterTo: 8000, type: 'highpass', delay: 0.01, pan
    })
  }

  // ── Layer 3 · DEBRIS ──
  if (v.debris && v.style !== 'bubble') {
    crackle(ctx, {
      count: 3 + Math.floor(Math.random() * 3), from: 0.03, to: 0.18,
      gain: vol(0.055), lo: 1400, hi: 4600, pan
    })
  }
}

/**
 * Synthesise one cue.
 *
 * `power` is a 0..1 intensity the caller derives from context (how far a chain
 * has climbed, how hard a slam was charged). It never changes WHICH sound plays
 * — only how big it is — so the mix stays legible.
 */
const synth = (ctx: AudioContext, id: FxSound, power: number, pan = 0): void => {
  const r = Math.random()
  const p = Math.max(0, Math.min(1, power))

  switch (id) {
    // ── The foot ──
    case 'stompLight':
      // The shoe arriving on bare floor. Deliberately SOFTER than a squish: a
      // miss that sounds as good as a hit teaches nothing.
      tone(ctx, { freq: 150 + r * 20, toFreq: 70, duration: 0.07, gain: vol(0.09), type: 'sine', pan })
      noiseBurst(ctx, { duration: 0.05, gain: vol(0.05), filterFrom: 1800, filterTo: 300, pan })
      break
    case 'stompHeavy':
      // The slam. A deep body, a wide noise sweep under it, and a short ring —
      // three voices for the one action the game wants the player to learn.
      tone(ctx, { freq: 78, toFreq: 34, duration: 0.26, gain: vol(0.26 + p * 0.1), type: 'sine', pan })
      tone(ctx, { freq: 132, toFreq: 52, duration: 0.16, gain: vol(0.12), type: 'triangle', filter: 900, pan })
      noiseBurst(ctx, { duration: 0.2, gain: vol(0.14), filterFrom: 3400, filterTo: 180, pan })
      crackle(ctx, { count: 5, from: 0.02, to: 0.16, gain: vol(0.05), lo: 900, hi: 3200, pan })
      break
    case 'charge': {
      // The wind-up: a rising tone the player can time the release against.
      // Short, because the charge is 260-380 ms and a longer voice would still
      // be sounding after the slam has landed.
      const f = 220 + p * 340
      tone(ctx, { freq: f * 0.8, toFreq: f, duration: 0.18, gain: vol(0.05), type: 'triangle', filter: 2600, pan, attack: 0.04 })
      break
    }
    case 'pivot':
      noiseBurst(ctx, { duration: 0.3, gain: vol(0.1), filterFrom: 900, filterTo: 4200, type: 'bandpass', q: 1.4, pan })
      tone(ctx, { freq: 320, toFreq: 620, duration: 0.26, gain: vol(0.06), type: 'sine', pan })
      break
    case 'slide':
      noiseBurst(ctx, { duration: 0.34, gain: vol(0.08), filterFrom: 2600, filterTo: 900, type: 'bandpass', q: 2.2, pan })
      break
    case 'land':
      tone(ctx, { freq: 110, toFreq: 62, duration: 0.06, gain: vol(0.07), type: 'sine', pan })
      break

    // ── The bodies ──
    case 'squish':
      squish(ctx, squishCfg)
      break
    case 'hurt':
      // A body that survived: the impact WITHOUT the burst, plus a dry knock.
      tone(ctx, { freq: 190, toFreq: 120, duration: 0.07, gain: vol(0.1), type: 'triangle', filter: 1800, pan })
      crackle(ctx, { count: 3, from: 0, to: 0.08, gain: vol(0.05), lo: 1800, hi: 4200, pan })
      break
    case 'clang':
      // Metal on shell. Two inharmonic partials with a fast decay, plus a
      // bright tick — it has to be unmistakably NOT a squish, because it is the
      // sound of the player using the wrong tool.
      tone(ctx, { freq: 1480 + r * 220, toFreq: 1300, duration: 0.14, gain: vol(0.1), type: 'square', filter: 5200, pan })
      tone(ctx, { freq: 2460, duration: 0.09, gain: vol(0.05), type: 'sine', pan })
      noiseBurst(ctx, { duration: 0.05, gain: vol(0.06), filterFrom: 7000, filterTo: 3000, type: 'highpass', pan })
      break
    case 'spike':
      // The punisher. A short descending buzz — the only genuinely unpleasant
      // sound in the game, and it lasts a fifth of a second.
      tone(ctx, { freq: 340, toFreq: 90, duration: 0.22, gain: vol(0.18), type: 'sawtooth', filter: 1400, pan })
      noiseBurst(ctx, { duration: 0.18, gain: vol(0.09), filterFrom: 2400, filterTo: 300, type: 'bandpass', q: 3, pan })
      break

    // ── The chain and the vial ──
    case 'chainStep': {
      // `power` carries the rung. The note is the whole cue.
      const f = chainFreq(Math.round(p * (LADDER_STEPS - 1)))
      bell(ctx, { freq: f, duration: 0.34, gain: vol(0.07), pan })
      break
    }
    case 'chainBreak':
      // A falling third. Short and quiet: the player already knows, and a loud
      // failure cue on a game for six-year-olds is a reason to stop playing.
      tone(ctx, { freq: 330, toFreq: 220, duration: 0.2, gain: vol(0.05), type: 'sine', pan })
      break
    case 'feverReady':
      // The vial has filled. A rising arpeggio, unmistakable, over the mix.
      for (let i = 0; i < 3; i++) {
        bell(ctx, { freq: 523 * Math.pow(2, i * 4 / 12), duration: 0.5, gain: vol(0.07), delay: i * 0.07 })
      }
      break
    case 'feverStart':
      // The gilded boot. A big downward sweep and a bright chord on top of it.
      noiseBurst(ctx, { duration: 0.7, gain: vol(0.16), filterFrom: 9000, filterTo: 220, type: 'lowpass' })
      tone(ctx, { freq: 60, toFreq: 34, duration: 0.8, gain: vol(0.2), type: 'sine' })
      for (const semis of [0, 4, 7, 12]) {
        bell(ctx, { freq: 392 * Math.pow(2, semis / 12), duration: 1.1, gain: vol(0.06), delay: 0.05 })
      }
      break
    case 'feverEnd':
      // A sighing fall back to the ordinary world.
      tone(ctx, { freq: 520, toFreq: 180, duration: 0.55, gain: vol(0.07), type: 'triangle', filter: 2600 })
      break

    // ── Props ──
    case 'salt':
      noiseBurst(ctx, { duration: 0.42, gain: vol(0.12), filterFrom: 8200, filterTo: 3400, type: 'highpass', pan })
      crackle(ctx, { count: 14, from: 0, to: 0.34, gain: vol(0.04), lo: 4200, hi: 11000, pan })
      break
    case 'magnet':
      tone(ctx, { freq: 90, toFreq: 260, duration: 0.36, gain: vol(0.09), type: 'sawtooth', filter: 1200, pan })
      tone(ctx, { freq: 1200, toFreq: 900, duration: 0.3, gain: vol(0.03), type: 'sine', pan })
      break
    case 'sweep':
      noiseBurst(ctx, { duration: 0.24, gain: vol(0.12), filterFrom: 1600, filterTo: 260, type: 'bandpass', q: 1.2, pan })
      tone(ctx, { freq: 150, toFreq: 90, duration: 0.2, gain: vol(0.1), type: 'square', filter: 700, pan })
      break
    case 'podPop':
      noiseBurst(ctx, { duration: 0.16, gain: vol(0.11), filterFrom: 3600, filterTo: 900, pan })
      tone(ctx, { freq: 420, toFreq: 180, duration: 0.14, gain: vol(0.08), type: 'triangle', pan })
      crackle(ctx, { count: 4, from: 0.01, to: 0.14, gain: vol(0.05), lo: 1800, hi: 5200, pan })
      break
    case 'podHatch':
      // A warning, not a punishment: the player LOST a pod, and the cue has to
      // be legible over whatever else is happening.
      tone(ctx, { freq: 220, toFreq: 330, duration: 0.24, gain: vol(0.09), type: 'sawtooth', filter: 1600, pan })
      break
    case 'arc':
      noiseBurst(ctx, { duration: 0.1, gain: vol(0.07), filterFrom: 6200, filterTo: 2600, type: 'bandpass', q: 5, pan })
      tone(ctx, { freq: 2600 + r * 900, toFreq: 1400, duration: 0.08, gain: vol(0.04), type: 'square', filter: 6000, pan })
      break

    // ── The boss ──
    case 'bossHit':
      tone(ctx, { freq: 96, toFreq: 54, duration: 0.2, gain: vol(0.18), type: 'sine', pan })
      noiseBurst(ctx, { duration: 0.16, gain: vol(0.1), filterFrom: 2600, filterTo: 300, pan })
      break
    case 'bossCounter':
      // The perfect counter. The single most satisfying moment in the game, so
      // it gets the biggest voice that is not the boss dying.
      tone(ctx, { freq: 130, toFreq: 46, duration: 0.42, gain: vol(0.26), type: 'sine' })
      noiseBurst(ctx, { duration: 0.34, gain: vol(0.16), filterFrom: 7000, filterTo: 200 })
      for (const semis of [0, 7, 12]) {
        bell(ctx, { freq: 523 * Math.pow(2, semis / 12), duration: 0.7, gain: vol(0.07), delay: 0.03 })
      }
      break
    case 'bossPhase':
      tone(ctx, { freq: 220, toFreq: 110, duration: 0.6, gain: vol(0.14), type: 'sawtooth', filter: 900 })
      noiseBurst(ctx, { duration: 0.5, gain: vol(0.1), filterFrom: 5200, filterTo: 260 })
      break
    case 'bossCharge':
      // The wind-up tell. It rises, so the player can hear when to slam even
      // with their eyes on the other side of the board.
      tone(ctx, { freq: 110, toFreq: 300, duration: 0.85, gain: vol(0.1), type: 'sawtooth', filter: 1100, attack: 0.12 })
      break
    case 'bossBeam':
      tone(ctx, { freq: 1800, duration: 1.4, gain: vol(0.05), type: 'sine', attack: 0.3 })
      noiseBurst(ctx, { duration: 1.4, gain: vol(0.07), filterFrom: 3000, filterTo: 6000, type: 'bandpass', q: 6 })
      break

    // ── Flow ──
    case 'countUp':
      tone(ctx, { freq: 660 + p * 900, duration: 0.05, gain: vol(0.04), type: 'sine', pan })
      break
    case 'tick':
      // The last ten seconds. Dry, quiet, and it does not rise — a clock that
      // panics makes a child panic.
      tone(ctx, { freq: 1400, duration: 0.03, gain: vol(0.05), type: 'square', filter: 4000 })
      break
    default:
      break
  }
}

/**
 * Play one cue. The single entry point: samples, synthesis, throttling and the
 * mute gates all live behind it.
 */
export const playFx = (id: FxSound, power = 0, pan = 0): void => {
  if (!canPlay()) return
  if (!passesThrottle(id)) return

  const sample = SAMPLE_CUES[id]
  if (sample) {
    playSound(sample[0], sample[1], 0.94 + Math.random() * 0.12)
    // The boss death gets BOTH: the fanfare sample and a synthesised blast
    // under it, because a celebration jingle alone does not feel like a
    // ten-metre beetle hitting the floor.
    if (id === 'bossDie') {
      const ctx = getAudioContext()
      if (ctx && ctx.state === 'running') {
        try { synth(ctx, 'stompHeavy', 1) } catch { /* node budget — the visual carries it */ }
      }
    }
    return
  }

  const ctx = getAudioContext()
  if (!ctx) return
  // A context that has never been unlocked by a gesture stays suspended; the
  // shared `armResumeOnGesture` in useAssets resumes it on the first tap, so we
  // skip until then rather than queueing a backlog of silent voices.
  if (ctx.state !== 'running') return

  try {
    synth(ctx, id, power, pan)
  } catch {
    // A browser refusing to allocate more nodes is not worth interrupting a
    // frame for — the visual feedback carries the moment on its own.
  }
}

/** Warm the synthesis path (build the noise buffer) so the first burst of a
 *  session doesn't pay for a 1.2 s buffer fill mid-frame. */
export const warmAudio = (): void => {
  const ctx = getAudioContext()
  if (ctx) getNoise(ctx)
}

/** Test seam: what the throttle has let through. */
export const __audioThrottleState = (): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const k of Object.keys(windowHits)) out[k] = (windowHits as never as Record<string, number[]>)[k]!.length
  return out
}
