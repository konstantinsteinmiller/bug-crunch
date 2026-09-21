/**
 * Every LIVE cue of `useGameAudio.ts` (the `synth()` switch, before the SFX
 * build), rendered offline — the loudness reference the new cues are matched
 * against, and the "before" half of every A/B in the audition folder.
 *
 * A straight port on top of `makeLegacy` (the same Web-Audio-spec primitives
 * `legacySynth.mjs` uses for the crush bank's reference). Gains are the cue's
 * own `vol()` arguments WITHOUT the player's 0.7 slider, so they compare
 * directly with a new cue at its manifest gain. `power` is the cue's 0..1.
 */
import { makeLegacy } from '../legacySynth.mjs'

const LONG = new Set(['bossBeam', 'feverStart', 'finisher', 'rushTell', 'party', 'bossCharge', 'quake'])

export const LEGACY_CUES = [
  'stompLight', 'stompHeavy', 'charge', 'pivot', 'slide', 'land', 'spike',
  'chainStep', 'chainBreak', 'feverReady', 'feverStart', 'feverEnd',
  'salt', 'magnet', 'sweep', 'podHatch', 'arc',
  'bossCounter', 'bossPhase', 'bossCharge', 'bossBeam',
  'countUp', 'tick',
  'rushTell', 'rushGo', 'multi', 'grow', 'deflate', 'heartbeat', 'finisher',
  'flip', 'kick', 'pins', 'boxDrop', 'boxHit', 'boxOpen', 'trialEnd',
  'quake', 'echo', 'twistTell', 'party'
]

const chainFreq = (step) => {
  const P = [0, 2, 4, 7, 9]
  const n = Math.max(0, Math.floor(step)) % 15
  return 392 * Math.pow(2, (P[n % 5] + Math.floor(n / 5) * 12) / 12)
}

export const legacyCue = (id, sr, power = 0, seed = 11) => {
  const L = makeLegacy(sr, LONG.has(id) ? 2.6 : 1.4, seed)
  const { tone, noiseBurst, crackle } = L
  const r = L.rnd()
  const p = Math.max(0, Math.min(1, power))
  const bell = (o) => {
    tone({ ...o, type: 'sine' })
    tone({ ...o, freq: o.freq * 2.76, toFreq: undefined, gain: o.gain * 0.36, duration: o.duration * 0.45, type: 'sine' })
    tone({ ...o, freq: o.freq * 5.4, toFreq: undefined, gain: o.gain * 0.16, duration: o.duration * 0.22, type: 'sine' })
  }
  switch (id) {
    case 'stompLight':
      tone({ freq: 150 + r * 20, toFreq: 70, duration: 0.07, gain: 0.09, type: 'sine' })
      noiseBurst({ duration: 0.05, gain: 0.05, filterFrom: 1800, filterTo: 300 })
      break
    case 'stompHeavy':
      noiseBurst({ duration: 0.025, gain: 0.2, filterFrom: 7000, filterTo: 2200 })
      tone({ freq: 62, toFreq: 26, duration: 0.34, gain: 0.3 + p * 0.16, type: 'sine' })
      tone({ freq: 150, toFreq: 58, duration: 0.14, gain: 0.16, type: 'triangle', filter: 1100 })
      noiseBurst({ duration: 0.3, gain: 0.17, filterFrom: 3800, filterTo: 130 })
      crackle({ count: 7, from: 0.03, to: 0.24, gain: 0.06, lo: 800, hi: 3600 })
      break
    case 'charge': {
      const f = 220 + p * 340
      tone({ freq: f * 0.8, toFreq: f, duration: 0.18, gain: 0.05, type: 'triangle', filter: 2600, attack: 0.04 })
      break
    }
    case 'pivot':
      noiseBurst({ duration: 0.3, gain: 0.1, filterFrom: 900, filterTo: 4200, type: 'bandpass', q: 1.4 })
      tone({ freq: 320, toFreq: 620, duration: 0.26, gain: 0.06, type: 'sine' })
      break
    case 'slide':
      noiseBurst({ duration: 0.34, gain: 0.08, filterFrom: 2600, filterTo: 900, type: 'bandpass', q: 2.2 })
      break
    case 'land':
      tone({ freq: 110, toFreq: 62, duration: 0.06, gain: 0.07, type: 'sine' })
      break
    case 'spike':
      tone({ freq: 340, toFreq: 90, duration: 0.22, gain: 0.18, type: 'sawtooth', filter: 1400 })
      noiseBurst({ duration: 0.18, gain: 0.09, filterFrom: 2400, filterTo: 300, type: 'bandpass', q: 3 })
      break
    case 'chainStep':
      bell({ freq: chainFreq(Math.round(p * 14)), duration: 0.34, gain: 0.07 })
      break
    case 'chainBreak':
      tone({ freq: 330, toFreq: 220, duration: 0.2, gain: 0.05, type: 'sine' })
      break
    case 'feverReady':
      for (let i = 0; i < 3; i++) bell({ freq: 523 * Math.pow(2, i * 4 / 12), duration: 0.5, gain: 0.07, delay: i * 0.07 })
      break
    case 'feverStart':
      noiseBurst({ duration: 0.7, gain: 0.16, filterFrom: 9000, filterTo: 220, type: 'lowpass' })
      tone({ freq: 60, toFreq: 34, duration: 0.8, gain: 0.2, type: 'sine' })
      for (const s of [0, 4, 7, 12]) bell({ freq: 392 * Math.pow(2, s / 12), duration: 1.1, gain: 0.06, delay: 0.05 })
      break
    case 'feverEnd':
      tone({ freq: 520, toFreq: 180, duration: 0.55, gain: 0.07, type: 'triangle', filter: 2600 })
      break
    case 'salt':
      noiseBurst({ duration: 0.42, gain: 0.12, filterFrom: 8200, filterTo: 3400, type: 'highpass' })
      crackle({ count: 14, from: 0, to: 0.34, gain: 0.04, lo: 4200, hi: 11000 })
      break
    case 'magnet':
      tone({ freq: 90, toFreq: 260, duration: 0.36, gain: 0.09, type: 'sawtooth', filter: 1200 })
      tone({ freq: 1200, toFreq: 900, duration: 0.3, gain: 0.03, type: 'sine' })
      break
    case 'sweep':
      noiseBurst({ duration: 0.24, gain: 0.12, filterFrom: 1600, filterTo: 260, type: 'bandpass', q: 1.2 })
      tone({ freq: 150, toFreq: 90, duration: 0.2, gain: 0.1, type: 'square', filter: 700 })
      break
    case 'podHatch':
      tone({ freq: 220, toFreq: 330, duration: 0.24, gain: 0.09, type: 'sawtooth', filter: 1600 })
      break
    case 'arc':
      noiseBurst({ duration: 0.1, gain: 0.07, filterFrom: 6200, filterTo: 2600, type: 'bandpass', q: 5 })
      tone({ freq: 2600 + r * 900, toFreq: 1400, duration: 0.08, gain: 0.04, type: 'square', filter: 6000 })
      break
    case 'bossCounter':
      // The chord only — the boss's crush under it comes from the bank.
      for (const s of [0, 7, 12]) bell({ freq: 523 * Math.pow(2, s / 12), duration: 0.7, gain: 0.07, delay: 0.03 })
      break
    case 'bossPhase':
      tone({ freq: 220, toFreq: 110, duration: 0.6, gain: 0.14, type: 'sawtooth', filter: 900 })
      noiseBurst({ duration: 0.5, gain: 0.1, filterFrom: 5200, filterTo: 260 })
      break
    case 'bossCharge':
      tone({ freq: 110, toFreq: 300, duration: 0.85, gain: 0.1, type: 'sawtooth', filter: 1100, attack: 0.12 })
      break
    case 'bossBeam':
      tone({ freq: 1800, duration: 1.4, gain: 0.05, type: 'sine', attack: 0.3 })
      noiseBurst({ duration: 1.4, gain: 0.07, filterFrom: 3000, filterTo: 6000, type: 'bandpass', q: 6 })
      break
    case 'countUp':
      tone({ freq: 660 + p * 900, duration: 0.05, gain: 0.04, type: 'sine' })
      break
    case 'tick':
      tone({ freq: 1400, duration: 0.03, gain: 0.05, type: 'square', filter: 4000 })
      break
    case 'rushTell':
      for (let i = 0; i < 14; i++) {
        const t = 1 - Math.pow(1 - i / 14, 1.6)
        noiseBurst({ duration: 0.035, gain: 0.035 + t * 0.05, delay: t * 1.0, filterFrom: 2600 + t * 3000, filterTo: 1800, type: 'bandpass', q: 1.6 })
      }
      break
    case 'rushGo':
      tone({ freq: 1180, toFreq: 1560, duration: 0.16, gain: 0.05, type: 'sine', attack: 0.01 })
      tone({ freq: 1560, duration: 0.12, gain: 0.04, type: 'sine', delay: 0.16 })
      break
    case 'multi': {
      const n = 2 + Math.round(p * 4)
      for (let i = 0; i < n; i++) bell({ freq: 660 * Math.pow(2, (i * 4) / 12), duration: 0.32, gain: 0.05, delay: i * 0.035 })
      break
    }
    case 'grow':
      tone({ freq: 170 + p * 120, toFreq: 340 + p * 240, duration: 0.14, gain: 0.06, type: 'triangle', filter: 1800 })
      break
    case 'deflate':
      noiseBurst({ duration: 0.32, gain: 0.06, filterFrom: 1800, filterTo: 380, type: 'bandpass', q: 3 })
      tone({ freq: 300, toFreq: 120, duration: 0.3, gain: 0.05, type: 'sawtooth', filter: 900 })
      break
    case 'heartbeat':
      tone({ freq: 70, toFreq: 48, duration: 0.12, gain: 0.12, type: 'sine' })
      tone({ freq: 62, toFreq: 44, duration: 0.1, gain: 0.09, type: 'sine', delay: 0.16 })
      break
    case 'finisher':
      tone({ freq: 90, toFreq: 40, duration: 0.5, gain: 0.2 + p * 0.08, type: 'sine' })
      noiseBurst({ duration: 0.5, gain: 0.12, filterFrom: 8000, filterTo: 400 })
      for (let i = 0; i < 5; i++) bell({ freq: 523 * Math.pow(2, [0, 4, 7, 12, 16][i] / 12), duration: 0.8, gain: 0.06, delay: 0.04 + i * 0.07 })
      break
    case 'flip':
      tone({ freq: 260, toFreq: 180, duration: 0.08, gain: 0.08, type: 'triangle', filter: 2000 })
      crackle({ count: 6, from: 0.05, to: 0.3, gain: 0.035, lo: 2200, hi: 5200 })
      break
    case 'kick':
      tone({ freq: 200, toFreq: 90, duration: 0.1, gain: 0.12, type: 'triangle', filter: 1600 })
      noiseBurst({ duration: 0.06, gain: 0.08, filterFrom: 3200, filterTo: 900 })
      break
    case 'pins':
      for (let i = 0; i < 6; i++) tone({ freq: 700 + L.rnd() * 500, duration: 0.07, gain: 0.05, type: 'square', filter: 3000, delay: i * 0.03 })
      crackle({ count: 10, from: 0, to: 0.3, gain: 0.05, lo: 1200, hi: 4200 })
      break
    case 'boxDrop':
      tone({ freq: 140, toFreq: 80, duration: 0.12, gain: 0.1, type: 'sine' })
      noiseBurst({ duration: 0.08, gain: 0.06, filterFrom: 1600, filterTo: 400 })
      break
    case 'boxHit':
      tone({ freq: 300 + p * 200, duration: 0.07, gain: 0.09, type: 'triangle', filter: 1400 })
      noiseBurst({ duration: 0.05, gain: 0.05, filterFrom: 1800, filterTo: 700 })
      break
    case 'boxOpen':
      noiseBurst({ duration: 0.2, gain: 0.07, filterFrom: 6000, filterTo: 9000, type: 'highpass' })
      for (let i = 0; i < 4; i++) bell({ freq: 880 * Math.pow(2, i * 5 / 12), duration: 0.45, gain: 0.05, delay: i * 0.05 })
      break
    case 'trialEnd':
      tone({ freq: 620, toFreq: 300, duration: 0.25, gain: 0.05, type: 'triangle', filter: 2400 })
      break
    case 'quake':
      tone({ freq: 48, toFreq: 24, duration: 0.7, gain: 0.26, type: 'sine' })
      noiseBurst({ duration: 0.6, gain: 0.14, filterFrom: 900, filterTo: 90 })
      break
    case 'echo':
      tone({ freq: 58, toFreq: 30, duration: 0.24, gain: 0.16, type: 'sine' })
      noiseBurst({ duration: 0.18, gain: 0.08, filterFrom: 2400, filterTo: 300 })
      break
    case 'twistTell':
      tone({ freq: 660, toFreq: 640, duration: 0.14, gain: 0.07, type: 'square', filter: 2600 })
      tone({ freq: 494, toFreq: 440, duration: 0.24, gain: 0.07, type: 'square', filter: 2600, delay: 0.18 })
      break
    case 'party':
      tone({ freq: 900, toFreq: 1800, duration: 0.3, gain: 0.05, type: 'sine' })
      noiseBurst({ duration: 0.12, gain: 0.1, filterFrom: 6000, filterTo: 1500, delay: 0.3 })
      for (let i = 0; i < 6; i++) bell({ freq: 784 * Math.pow(2, [0, 2, 4, 7, 9, 12][i] / 12), duration: 0.4, gain: 0.045, delay: 0.34 + i * 0.05 })
      break
    default:
      throw new Error(`no legacy port for ${id}`)
  }
  // Trim trailing silence so durations in the report mean something.
  let end = L.out.length - 1
  while (end > 0 && Math.abs(L.out[end]) < 1e-5) end--
  return L.out.slice(0, end + 1)
}
