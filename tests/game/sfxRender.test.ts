// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
// The offline SFX pipeline (tools/audio) — plain .mjs, imported as-is.
// @ts-expect-error untyped build tool
import { integratedLufs, momentaryMaxLufs, truePeak, db, phoneLoudnessDb } from '../../tools/audio/sfx/loudness.mjs'
// @ts-expect-error untyped build tool
import { limitHard, masterLoop } from '../../tools/audio/sfx/master.mjs'
// @ts-expect-error untyped build tool
import { CUES, SPRITES, chainFreqOf, LADDER_STEPS } from '../../tools/audio/sfx/recipes.mjs'
// @ts-expect-error untyped build tool
import { CEILING_DB, RENDER_SR, renderCue, renderTake } from '../../tools/audio/sfx/render.mjs'
import { SFX_CUES, SFX_SPRITES } from '@/game/audio/sfxSprites'
import { powerSpectrum } from '@/game/audio/audioFeatures'

/**
 * The rendered-SFX pipeline, measured rather than listened to.
 *
 * Pins the meters against signals whose loudness is known by definition, the
 * limiter's ceiling, the loops' seams, the chain set's pitches, the takes'
 * clean edges — and that the shipped manifest is the one the cue sheet
 * describes, so a recipe edit without a rebuild fails here instead of playing
 * the wrong slice of a sprite in the game.
 */

const sine = (f: number, amp: number, seconds: number, sr: number, phase = 0): Float32Array =>
  Float32Array.from({ length: Math.round(seconds * sr) }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / sr + phase))

describe('loudness meters', () => {
  it('reads a full-scale 997 Hz sine as −3.01 LUFS (BS.1770), at 48 and 44.1 kHz', () => {
    for (const sr of [48000, 44100]) {
      expect(integratedLufs(sine(997, 1, 3, sr), sr)).toBeCloseTo(-3.01, 1)
      expect(integratedLufs(sine(997, 0.1, 3, sr), sr)).toBeCloseTo(-23.01, 1)
    }
  })

  it('momentary max follows the loudest 400 ms, not the average', () => {
    const sr = 48000
    const x = new Float32Array(sr * 3)
    x.set(sine(997, 1, 0.5, sr), sr)
    expect(momentaryMaxLufs(x, sr)).toBeCloseTo(-3.01, 0)
    expect(integratedLufs(x, sr)).toBeLessThan(-3.5)
  })

  it('finds the true peak between samples', () => {
    // A sine at fs/4 sampled 45° off its crest: every sample is ±0.707, the
    // waveform itself reaches 1.0.
    const x = sine(11025, 1, 0.1, 44100, Math.PI / 4)
    let sampled = 0
    for (const v of x) sampled = Math.max(sampled, Math.abs(v))
    expect(db(sampled)).toBeCloseTo(-3.01, 1)
    expect(db(truePeak(x))).toBeGreaterThan(-0.3)
  })

  it('weights a phone the way the crush bank does: a 60 Hz sine barely registers', () => {
    const sr = 44100
    expect(phoneLoudnessDb(sine(60, 0.5, 0.3, sr), sr)).toBeLessThan(phoneLoudnessDb(sine(1000, 0.5, 0.3, sr), sr) - 12)
  })
})

describe('the true-peak limiter', () => {
  it('holds a +6 dB overshoot to the ceiling without touching a quiet signal', () => {
    const sr = 44100
    const ceiling = Math.pow(10, -3 / 20)
    const hot = sine(440, 1.4, 0.3, sr)
    expect(db(truePeak(limitHard(hot, sr, ceiling)))).toBeLessThanOrEqual(-3 + 0.05)
    const quiet = sine(440, 0.3, 0.3, sr)
    expect(limitHard(quiet, sr, ceiling)).toEqual(quiet)
  })
})

describe('the cue sheet', () => {
  const ids = Object.keys(CUES) as string[]

  it('renders the same take from the same seed', () => {
    for (const id of ['stompLight', 'pins', 'spike']) {
      const a = renderTake(id, CUES[id], 0)
      const b = renderTake(id, CUES[id], 0)
      expect(a).toEqual(b)
    }
  })

  it('every take is finite, click-free at both ends and has no DC', () => {
    for (const id of ids) {
      const c = CUES[id]
      if (c.loop) continue
      const x = renderTake(id, c, 0) as Float32Array
      let peak = 0
      let sum = 0
      for (const v of x) { expect(Number.isFinite(v)).toBe(true); peak = Math.max(peak, Math.abs(v)); sum += v }
      expect(peak, id).toBeGreaterThan(0)
      expect(Math.abs(x[0]!) / peak, `${id} starts on a click`).toBeLessThan(0.01)
      expect(Math.abs(x[x.length - 1]!) / peak, `${id} ends on a click`).toBeLessThan(0.01)
      expect(Math.abs(sum / x.length) / peak, `${id} DC`).toBeLessThan(0.01)
    }
  }, 60_000)

  it('keeps every cue short enough for the moment it rides', () => {
    // Event windows from the sim: the boss charge tell is 620 ms
    // (CHARGE_TELL_MS), the rush tell 1100 ms (RUSH_TELL_MS), the beam 900 +
    // 1600 ms (BEAM_TELL_MS + BEAM_SWEEP_MS), the heartbeat's fastest beat
    // 520 ms, the charge a 260–380 ms wind-up, stars land 340 ms apart.
    const len = (id: string, i = 0): number => (renderTake(id, CUES[id], i) as Float32Array).length / RENDER_SR
    expect(len('bossCharge')).toBeLessThan(0.72)
    expect(len('rushTell')).toBeLessThan(1.35)
    expect(len('bossBeam')).toBeLessThan(2.65)
    expect(len('heartbeat')).toBeLessThan(0.52)
    expect(len('stompLight')).toBeLessThan(0.13)
    expect(len('tick')).toBeLessThan(0.15)
  }, 60_000)

  it('the bossCharge tell peaks at its snort, inside the 620 ms window', () => {
    const x = renderTake('bossCharge', CUES.bossCharge, 0) as Float32Array
    // Energy in the last 100 ms before 0.66 s vs the first 100 ms: the warning
    // builds, it does not front-load.
    const e = (a: number, b: number): number => {
      let s = 0
      for (let i = Math.round(a * RENDER_SR); i < Math.min(x.length, Math.round(b * RENDER_SR)); i++) s += x[i]! ** 2
      return s
    }
    expect(x.length / RENDER_SR).toBeGreaterThan(0.6)
    expect(e(0.45, 0.62)).toBeGreaterThan(e(0.02, 0.12))
  })
})

describe('the chain set', () => {
  it('is fifteen notes, each rendered AT its rung\'s pitch (no resampling), rising', () => {
    const cue = renderCue('chainStep', CUES.chainStep)
    expect(cue.takes).toHaveLength(LADDER_STEPS)
    let prev = 0
    cue.takes.forEach((x: Float32Array, i: number) => {
      const want = chainFreqOf(i)
      const size = 16384
      const spec = powerSpectrum(x.subarray(0, Math.min(x.length, size * 2)), size)
      const bin = RENDER_SR / size
      let best = 0
      let at = 0
      for (let k = Math.floor((want * 0.8) / bin); k < Math.ceil((want * 1.25) / bin); k++) if (spec[k]! > best) { best = spec[k]!; at = k }
      const got = at * bin
      expect(Math.abs(got / want - 1), `rung ${i}: ${got.toFixed(1)} Hz for ${want.toFixed(1)}`).toBeLessThan(0.012)
      expect(got).toBeGreaterThan(prev)
      prev = got
    })
    // Never a dog whistle: the top rung is E7, 2637 Hz.
    expect(chainFreqOf(14)).toBeCloseTo(2637, -1)
    expect(chainFreqOf(15)).toBeCloseTo(chainFreqOf(0), 6)
  }, 60_000)

  it('matches the runtime ladder formula', () => {
    // `chainFreq` in useGameAudio: 392 Hz · 2^((pentatonic + 12·octave)/12).
    const P = [0, 2, 4, 7, 9]
    for (let n = 0; n < 30; n++) {
      const m = n % 15
      expect(chainFreqOf(n)).toBeCloseTo(392 * Math.pow(2, (P[m % 5]! + Math.floor(m / 5) * 12) / 12), 6)
    }
  })
})

describe('loops', () => {
  it('charge and slide are seamless: the step across the seam is an ordinary step', () => {
    for (const id of ['charge', 'slide']) {
      const x = renderTake(id, CUES[id], 0) as Float32Array
      const steps: number[] = []
      for (let i = 1; i < x.length; i++) steps.push(Math.abs(x[i]! - x[i - 1]!))
      steps.sort((a, b) => a - b)
      const p99 = steps[Math.floor(steps.length * 0.99)]!
      expect(Math.abs(x[0]! - x[x.length - 1]!), id).toBeLessThanOrEqual(p99)
    }
  })

  it('the circular master keeps a periodic signal periodic', () => {
    const sr = 44100
    // 440 Hz is exactly 220 cycles in 0.5 s: a periodic input.
    const y = masterLoop(sine(440, 0.5, 0.5, sr), sr, { hp: 90 }) as Float32Array
    expect(y.length).toBe(22050)
    // The step across the seam is no bigger than a 440 Hz sine's own step.
    const maxStep = 0.5 * 2 * Math.PI * 440 / sr
    expect(Math.abs(y[0]! - y[y.length - 1]!)).toBeLessThan(maxStep * 1.05)
  })
})

describe('the shipped manifest', () => {
  const root = resolve(__dirname, '..', '..')

  it('is the cue sheet it was built from (a recipe edit needs `pnpm audio:sfx -- --ship`)', () => {
    expect(Object.keys(SFX_CUES).sort()).toEqual(Object.keys(CUES).sort())
    for (const [id, c] of Object.entries(SFX_CUES)) {
      expect(c.slots, id).toHaveLength(CUES[id].slots)
      expect(c.sprite, id).toBe(CUES[id].sprite)
      expect(c.pick, id).toBe(CUES[id].pick)
    }
    expect(Object.keys(SFX_SPRITES).sort()).toEqual(Object.keys(SPRITES).sort())
  })

  it('every slot sits inside its sprite, every loop inside its slot', () => {
    for (const [id, c] of Object.entries(SFX_CUES)) {
      const sp = SFX_SPRITES[c.sprite]!
      for (const [o, d] of c.slots) {
        expect(o, id).toBeGreaterThanOrEqual(0)
        expect(d, id).toBeGreaterThan(0)
        expect(o + d, id).toBeLessThanOrEqual(sp.seconds + 1e-3)
      }
      if (c.loop) {
        const [o, d] = c.slots[0]!
        expect(c.loop[0]).toBeGreaterThan(o)
        expect(c.loop[1]).toBeLessThan(o + d)
        expect(c.loop[1] - c.loop[0]).toBeGreaterThan(0.2)
      }
      expect(c.gain, id).toBeGreaterThan(0)
      expect(c.gain, id).toBeLessThan(1)
    }
  })

  it('every sprite file ships, at the size the manifest records', () => {
    for (const s of Object.values(SFX_SPRITES)) {
      const f = resolve(root, 'public', 'audio', 'sfx', `${s.file}.ogg`)
      expect(existsSync(f), f).toBe(true)
      expect(statSync(f).size).toBe(s.bytes)
      // A real Ogg stream, not something else with the extension.
      expect(readFileSync(f).subarray(0, 4).toString('latin1')).toBe('OggS')
    }
  })

  it('tier 1 carries everything level 1-1 can play, and stays small', () => {
    const tier1 = ['stompLight', 'stompHeavy', 'land', 'charge', 'chainStep', 'chainBreak', 'grow', 'feverReady', 'feverStart', 'feverEnd', 'finisher', 'heartbeat', 'star', 'tick']
    for (const id of tier1) expect(SFX_SPRITES[SFX_CUES[id]!.sprite]!.tier, id).toBe(1)
    const bytes = (t: number): number => Object.values(SFX_SPRITES).filter((s) => s.tier === t).reduce((a, s) => a + s.bytes, 0)
    expect(bytes(1)).toBeLessThan(110 * 1024)
    expect(bytes(1) + bytes(2)).toBeLessThan(260 * 1024)
  })

  it('files sit at the format\'s ceiling (about −3 dBFS)', () => {
    expect(CEILING_DB).toBe(-3)
  })
})

describe('the ad-mute guarantee', () => {
  it('the sprite player never makes its own context or media element, and registers every source', () => {
    const src = readFileSync(resolve(__dirname, '..', '..', 'src', 'use', 'useSfxSprites.ts'), 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/new\s+(Offline)?AudioContext|webkitAudioContext|new\s+Audio\s*\(|createElement\(\s*['"]audio/)
    expect(code).toMatch(/getAudioContext\(\)/)
    const sources = code.match(/createBufferSource\(\)/g)?.length ?? 0
    const registered = code.match(/registerOneShotSource\(/g)?.length ?? 0
    expect(sources).toBeGreaterThan(0)
    expect(registered).toBe(sources)
  })
})
