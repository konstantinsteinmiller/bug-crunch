#!/usr/bin/env node
/**
 * ─── Build the rendered SFX: audition, measure, and (with --ship) ship ──────
 *
 *   pnpm audio:sfx                              # audition set into <tmp>/bug-crunch-sfx-build
 *   pnpm audio:sfx -- --out ./my-dir --png      # + spectrogram/waveform PNGs (ffmpeg)
 *   pnpm audio:sfx -- --only finisher,pins      # a few cues (audition only)
 *   pnpm audio:sfx -- --ship                    # write public/audio/sfx/sfx-*.ogg and
 *                                               # src/game/audio/sfxSprites.ts
 *
 * The pipeline, per cue (`tools/audio/sfx/recipes.mjs` is the cue sheet):
 *
 *   render every take at 44.1 kHz from its seed          (deterministic)
 *   → room (FFT convolution with a synthetic IR), post-filter
 *   → master: DC block, sub cut, presence, top cut, edges  (`sfx/master.mjs`)
 *     loops: three periods rendered, the middle one kept, filters run circularly
 *   → level: takes loudness-matched to each other on the cue's own meter, then
 *     ONE scale so the loudest take's true peak sits at the ceiling (with up to
 *     `limitDb` of look-ahead true-peak limiting), so the file is as clean as the
 *     codec allows and the mix level lives in the runtime gain
 *   → runtime gain = target − the file's level (phone-weighted, before slider)
 *
 * Then per sprite: decimate to 22.05 kHz (windowed-sinc, alias-free), lay the
 * takes out with silent gaps (loops get a guard copy of their own tail/head on
 * both sides, so neither the decoder's resampler nor the Vorbis window ever
 * sees a discontinuity at a loop point), encode Vorbis, DECODE IT BACK and
 * re-measure every slot from the decoded file — what ships is what is reported.
 *
 * Runs the game's own TS modules through the resolver hook:
 *   node --import ./tools/ts-resolve.mjs tools/audio/build-sfx.mjs
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { CUES, SPRITES } from './sfx/recipes.mjs'
import { hashString, svf } from './sfx/dsp.mjs'
import { measure, truePeak, db } from './sfx/loudness.mjs'
import { legacyCue, LEGACY_CUES } from './sfx/legacyCues.mjs'
import { CEILING_DB, RENDER_SR, metricOf, renderCue } from './sfx/render.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const OUT = resolve(arg('out', join(tmpdir(), 'bug-crunch-sfx-build')))
const SHIP = argv.includes('--ship')
const PNG = argv.includes('--png')
const ONLY = arg('only', '') ? arg('only', '').split(',') : null
const QUALITY = Number(arg('q', 2))
const SR = RENDER_SR
const SHIP_SR = 22050
const GAP_S = 0.06
const GUARD_S = 0.15

if (SHIP && ONLY) {
  console.error('[sfx] --ship builds every cue; drop --only')
  process.exit(1)
}

// ─── ffmpeg ─────────────────────────────────────────────────────────────────

const ffmpegBin = (() => {
  try {
    const p = createRequire(join(ROOT, 'package.json'))('ffmpeg-static')
    if (p && existsSync(p)) return p
  } catch { /* PATH */ }
  return 'ffmpeg'
})()

const ff = (args, input) => {
  const r = spawnSync(ffmpegBin, ['-hide_banner', '-nostats', '-loglevel', 'error', ...args], { input, maxBuffer: 1 << 28 })
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}\n${r.stderr?.toString()}`)
  return r
}

const decodeFile = (file, sr) => {
  const r = ff(['-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(sr), '-'])
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length))
}

const picture = (wav, png, { width = 1000, height = 300, top = 11000 } = {}) => {
  mkdirSync(dirname(png), { recursive: true })
  const spec = `showspectrumpic=s=${width}x${height}:legend=0:scale=log:fscale=lin:drange=80:stop=${top}:color=intensity`
  const filter = `[0:a]${spec},drawgrid=w=iw:h=ih*1000/${top}:t=1:c=white@0.15[g];[0:a]showwavespic=s=${width}x120:colors=0x7fd6ff:scale=lin[w];[g][w]vstack[s]`
  try { ff(['-y', '-i', wav, '-filter_complex', filter, '-map', '[s]', '-frames:v', '1', png]) } catch (e) { console.warn(String(e).slice(0, 300)) }
}

// ─── WAV ────────────────────────────────────────────────────────────────────

const writeWav = (file, x, sr) => {
  mkdirSync(dirname(file), { recursive: true })
  const n = x.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24)
  buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
  // TPDF dither, seeded so two builds write identical files.
  let s = 12345
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, x[i] + (r() - r()) / 32768))
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  writeFileSync(file, buf)
}

const concat = (parts, gapS, sr) => {
  const gap = Math.round(gapS * sr)
  const out = new Float32Array(parts.reduce((a, p) => a + p.length + gap, gap))
  let at = gap
  for (const p of parts) { out.set(p, at); at += p.length + gap }
  return out
}

const scaled = (x, g) => Float32Array.from(x, (v) => v * g)

// ─── Decimation 44.1 → 22.05 kHz ────────────────────────────────────────────

const HALF = (() => {
  const taps = 191
  const fc = 10300 / SR
  const h = new Float64Array(taps)
  const c = (taps - 1) / 2
  // Kaiser window, beta 8.
  const i0 = (x) => { let s = 1, t = 1; for (let k = 1; k < 30; k++) { t *= (x / (2 * k)) ** 2; s += t } return s }
  let sum = 0
  for (let k = 0; k < taps; k++) {
    const m = k - c
    const sinc = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m)
    const w = i0(8 * Math.sqrt(1 - (m / c) ** 2)) / i0(8)
    h[k] = sinc * w
    sum += h[k]
  }
  for (let k = 0; k < taps; k++) h[k] /= sum
  return h
})()

export const decimate2 = (x) => {
  const c = (HALF.length - 1) / 2
  const out = new Float32Array(Math.ceil(x.length / 2))
  for (let m = 0; m < out.length; m++) {
    let acc = 0
    const n = m * 2
    for (let k = 0; k < HALF.length; k++) {
      const i = n + c - k
      if (i >= 0 && i < x.length) acc += HALF[k] * x[i]
    }
    out[m] = acc
  }
  return out
}

/** Circular decimation for one loop period (period must be even at 44.1k). */
const decimateLoop = (x) => {
  const L = x.length
  const tri = new Float32Array(L * 3)
  tri.set(x, 0); tri.set(x, L); tri.set(x, 2 * L)
  const d = decimate2(tri)
  return d.slice(L / 2, L)
}

// ─── Render + master every cue ──────────────────────────────────────────────

const cues = Object.entries(CUES).filter(([id]) => !ONLY || ONLY.includes(id))
const built = new Map()
const t0 = performance.now()

for (const [id, c] of cues) {
  built.set(id, renderCue(id, c, SR))
  process.stdout.write(`. ${id}`)
}
console.log(`\n[sfx] rendered ${built.size} cues in ${((performance.now() - t0) / 1000).toFixed(1)} s`)

// ─── Audition set ───────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true })
const rows = []
for (const { id, c, takes, gain } of built.values()) {
  const atMix = takes.map((x) => scaled(x, gain))
  const file = join(OUT, 'new', `${id}.wav`)
  if (c.loop) {
    const P = atMix[0].length
    const tiled = new Float32Array(P * 4)
    for (let k = 0; k < 4; k++) tiled.set(atMix[0], k * P)
    writeWav(file, tiled, SR)
    // The seam, magnified: 20 ms either side of the loop point.
    const w = Math.round(0.02 * SR)
    const seam = new Float32Array(2 * w)
    for (let i = 0; i < w; i++) { seam[i] = atMix[0][P - w + i]; seam[w + i] = atMix[0][i] }
    writeWav(join(OUT, 'loops', `${id}-seam.wav`), seam, SR)
  } else {
    writeWav(file, concat(atMix, 0.25, SR), SR)
  }
  const ms = atMix.map((x) => measure(x, SR))
  const avg = (k) => ms.reduce((a, m) => a + m[k], 0) / ms.length
  const max = (k) => Math.max(...ms.map((m) => m[k]))
  let legacy = null
  if (LEGACY_CUES.includes(id)) {
    const powers = c.pick === 'index' && c.slots > 1 ? [0, 1] : [c.gainPower ? 1 : 0]
    const lx = powers.map((p) => legacyCue(id, SR, p))
    writeWav(join(OUT, 'old', `${id}.wav`), concat(lx, 0.25, SR), SR)
    const lm = lx.map((x) => measure(x, SR))
    legacy = { ph50: lm.reduce((a, m) => a + m.phoneDb, 0) / lm.length, ph400: lm.reduce((a, m) => a + m.phone400, 0) / lm.length, M: Math.max(...lm.map((m) => m.momentary)) }
    // Old then new, for a quick A/B.
    writeWav(join(OUT, 'ab', `${id}.wav`), concat([...lx, new Float32Array(Math.round(0.4 * SR)), ...atMix.slice(0, c.loop ? 1 : 3)], 0.3, SR), SR)
  }
  rows.push({
    id, sprite: c.sprite, tier: SPRITES[c.sprite].tier, slots: c.slots, pick: c.pick,
    durMs: avg('durationMs'), maxDurMs: max('durationMs'), tp: max('truePeakDb'), dc: Math.max(...ms.map((m) => Math.abs(m.dc))),
    ph50: avg('phoneDb'), ph400: avg('phone400'), M: avg('momentary'), I: avg('integrated'),
    target: c.target, metric: c.metric, gain, legacy
  })
}

// ─── What a phone speaker makes of it ──────────────────────────────────────
//
// A small-speaker model for auditioning only: nothing under ~300 Hz (4th-order),
// a +4 dB bump around 2.5 kHz, rolled off over 8 kHz. Listen to phone/ to hear
// the mix the way most of this game's players will.
const phoneSim = (x, sr) => {
  const y = Float32Array.from(x)
  svf(y, sr, 'hp', 300, 0.5412); svf(y, sr, 'hp', 300, 1.3066)
  svf(y, sr, 'peak', 2500, 0.7, { gain: 4 })
  svf(y, sr, 'lp', 8000, 0.7071)
  return y
}
for (const { id, c, takes, gain } of built.values()) {
  const parts = c.loop ? [takes[0], takes[0], takes[0], takes[0]].map((x) => scaled(x, gain)) : takes.map((x) => scaled(x, gain))
  writeWav(join(OUT, 'phone', `${id}.wav`), phoneSim(concat(parts, c.loop ? 0 : 0.25, SR), SR), SR)
}

// ─── Rapid fire: the machine-gun test ───────────────────────────────────────
//
// The runtime's own rotation (never the same take twice in a row), its rate
// and gain jitter, at the rate the throttle lets through.

const atRate = (x, rate) => {
  const n = Math.floor(x.length / rate)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * rate, j = Math.floor(p), f = p - j
    out[i] = (x[j] ?? 0) * (1 - f) + (x[j + 1] ?? 0) * f
  }
  return out
}
const rapid = (id, count, everyS) => {
  const b = built.get(id)
  if (!b) return
  const out = new Float32Array(Math.round((count * everyS + 1.2) * SR))
  let last = -1
  let r = hashString(id)
  const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296 }
  for (let k = 0; k < count; k++) {
    let v = Math.floor(rnd() * b.takes.length)
    if (b.takes.length > 1 && v === last) v = (v + 1) % b.takes.length
    last = v
    const rate = 1 + (b.c.rate ?? 0) * (rnd() * 2 - 1)
    const g = b.gain * (0.9 + rnd() * 0.2)
    const shot = atRate(b.takes[v], rate)
    const at = Math.round(k * everyS * SR)
    for (let i = 0; i < shot.length && at + i < out.length; i++) out[at + i] += shot[i] * g
  }
  writeWav(join(OUT, 'rapid', `${id}.wav`), out, SR)
}
rapid('stompLight', 12, 0.1)
rapid('stompHeavy', 6, 0.45)
rapid('kick', 8, 0.14)
rapid('arc', 12, 0.06)
rapid('sweep', 10, 0.09)
rapid('grow', 8, 0.1)
rapid('flip', 8, 0.1)
rapid('tick', 10, 1)

// A whole chain: every rung the ladder plays, then the lapse.
if (built.has('chainStep')) {
  const cs = built.get('chainStep')
  const out = new Float32Array(Math.round(4.5 * SR))
  cs.takes.forEach((x, i) => {
    const at = Math.round(i * 0.24 * SR)
    for (let k = 0; k < x.length && at + k < out.length; k++) out[at + k] += x[k] * cs.gain
  })
  writeWav(join(OUT, 'rapid', 'chainStep-ladder.wav'), out, SR)
}

// ─── Context mixes: cues that land together in the game ─────────────────────

const legacySample = (name, ratio) => {
  const f = join(ROOT, 'public', 'audio', 'sfx', `${name}.ogg`)
  return scaled(decodeFile(f, SR), ratio)
}
const place = (len, parts) => {
  const out = new Float32Array(Math.round(len * SR))
  for (const [x, at] of parts) {
    const n0 = Math.round(at * SR)
    for (let i = 0; i < x.length && n0 + i < out.length; i++) out[n0 + i] += x[i]
  }
  return out
}
const mixTake = (id, slot = 0) => (built.has(id) ? scaled(built.get(id).takes[slot], built.get(id).gain) : new Float32Array(1))
if (!ONLY) {
  const ctx = [
    ['finisher-slam+fanfare', 2.2, [[mixTake('finisher', 1), 0], [legacySample('celebration-1', 0.71), 0]]],
    ['finisher-tap+fanfare', 2.2, [[mixTake('finisher', 0), 0], [legacySample('celebration-1', 0.71), 0]]],
    ['spike+chainBreak+deflate', 1.2, [[mixTake('spike', 0), 0], [mixTake('chainBreak', 0), 0], [mixTake('deflate', 0), 0]]],
    ['rushTell+rushGo', 1.8, [[mixTake('rushTell'), 0], [mixTake('rushGo'), 1.1]]],
    ['fever-ready-start-end', 3.2, [[mixTake('feverReady'), 0], [mixTake('feverStart'), 0.9], [mixTake('feverEnd'), 2.5]]],
    ['stars', 1.8, [[mixTake('star', 0), 0.26], [mixTake('star', 1), 0.6], [mixTake('star', 2), 0.94]]],
    ['slam-kill', 0.9, [[mixTake('stompHeavy', 0), 0], [mixTake('chainStep', 3), 0.01], [mixTake('grow', 1), 0.01]]],
    ['boss-charge-tell', 1.6, [[mixTake('bossCharge'), 0], [mixTake('stompHeavy', 1), 0.95]]]
  ]
  for (const [name, len, parts] of ctx) writeWav(join(OUT, 'context', `${name}.wav`), place(len, parts), SR)
}

// ─── Sprites ────────────────────────────────────────────────────────────────

const manifest = { sprites: {}, cues: {} }
const spriteRows = []
const codecRows = []
if (!ONLY) {
  const spriteDir = SHIP ? join(ROOT, 'public', 'audio', 'sfx') : join(OUT, 'sprites')
  mkdirSync(spriteDir, { recursive: true })
  for (const [sid, sp] of Object.entries(SPRITES)) {
    const members = [...built.values()].filter((b) => b.c.sprite === sid)
    const parts = []
    let cursor = Math.round(GAP_S * SHIP_SR)
    const layout = []
    for (const m of members) {
      const slots = []
      let loop = null
      for (const x of m.takes) {
        if (m.c.loop) {
          const period = decimateLoop(x)
          const P = period.length
          const G = Math.round(GUARD_S * SHIP_SR)
          const seg = new Float32Array(P + 2 * G)
          for (let i = 0; i < seg.length; i++) seg[i] = period[((i - G) % P + P) % P]
          parts.push([seg, cursor])
          slots.push([cursor, seg.length])
          loop = [cursor + G, cursor + G + P]
          cursor += seg.length + Math.round(GAP_S * SHIP_SR)
        } else {
          const d = decimate2(x)
          parts.push([d, cursor])
          slots.push([cursor, d.length])
          cursor += d.length + Math.round(GAP_S * SHIP_SR)
        }
      }
      layout.push({ m, slots, loop })
    }
    const pcm = new Float32Array(cursor)
    for (const [x, at] of parts) pcm.set(x, at)
    const base = `sfx-${sid}`
    writeWav(join(OUT, 'sprites-src', `${base}.wav`), pcm, SHIP_SR)
    const ogg = join(spriteDir, `${base}.ogg`)
    ff(['-y', '-f', 'f32le', '-ar', String(SHIP_SR), '-ac', '1', '-i', 'pipe:0', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
      '-c:a', 'libvorbis', '-q:a', String(QUALITY), ogg], Buffer.from(pcm.buffer))
    const bytes = statSync(ogg).size
    // Decode what ships and re-measure it.
    const dec = decodeFile(ogg, SHIP_SR)
    let errE = 0, sigE = 0
    for (let i = 0; i < Math.min(dec.length, pcm.length); i++) { const e = dec[i] - pcm[i]; errE += e * e; sigE += pcm[i] * pcm[i] }
    const snr = 10 * Math.log10(sigE / Math.max(1e-20, errE))
    spriteRows.push({ sid, tier: sp.tier, seconds: pcm.length / SHIP_SR, decodedSamples: dec.length, samples: pcm.length, bytes, snr })
    manifest.sprites[sid] = { file: base, tier: sp.tier, seconds: +(pcm.length / SHIP_SR).toFixed(3), bytes }
    for (const { m, slots, loop } of layout) {
      const entry = {
        sprite: sid, gain: +m.gain.toFixed(5), pick: m.c.pick,
        slots: slots.map(([a, n]) => [+(a / SHIP_SR).toFixed(5), +(n / SHIP_SR).toFixed(5)])
      }
      if (loop) entry.loop = [+(loop[0] / SHIP_SR).toFixed(5), +(loop[1] / SHIP_SR).toFixed(5)]
      if (m.c.rate) entry.rate = m.c.rate
      if (m.c.ratePower) entry.ratePower = m.c.ratePower
      if (m.c.gainPower) entry.gainPower = m.c.gainPower
      if (m.c.indexScale !== undefined) entry.indexScale = m.c.indexScale
      if (m.c.indexBase !== undefined) entry.indexBase = m.c.indexBase
      manifest.cues[m.id] = entry
      // The decoded slots, at the mix, back to back — what a player hears.
      const decSlots = slots.map(([a, n]) => scaled(dec.slice(a, a + n), m.gain))
      const decTp = Math.max(...slots.map(([a, n]) => db(truePeak(dec.slice(a, a + n)))))
      const decLevel = decSlots.reduce((acc, x) => acc + metricOf(x, SHIP_SR, m.c.metric), 0) / decSlots.length
      const srcLevel = slots.reduce((acc, [a, n]) => acc + metricOf(scaled(pcm.slice(a, a + n), m.gain), SHIP_SR, m.c.metric), 0) / slots.length
      // The gain is set on what SHIPS: Vorbis adds up to ~1 dB of energy to a
      // noisy cue (a swish, a shaker), so the codec's drift is taken back out.
      const drift = decLevel - srcLevel
      entry.gain = +(m.gain * Math.pow(10, -drift / 20)).toFixed(5)
      codecRows.push({ id: m.id, decTp, drift })
      writeWav(join(OUT, 'decoded', `${m.id}.wav`), concat(m.c.loop ? [decSlots[0]] : decSlots, 0.25, SHIP_SR), SHIP_SR)
      if (loop) {
        // Seam check on the DECODED loop: the loop region tiled.
        const [a, bEnd] = loop
        const period = dec.slice(a, bEnd)
        const tiled = new Float32Array(period.length * 4)
        for (let k = 0; k < 4; k++) tiled.set(period, k * period.length)
        writeWav(join(OUT, 'loops', `${m.id}-decoded-x4.wav`), scaled(tiled, m.gain), SHIP_SR)
        // The step across the seam against the loop's own 99th-percentile step:
        // a pulse train's steps vary a lot, so the mean is the wrong yardstick.
        const jump = Math.abs(period[0] - period[period.length - 1])
        const steps = Array.from({ length: period.length - 1 }, (_, i) => Math.abs(period[i + 1] - period[i])).sort((x, y) => x - y)
        const typ = steps[Math.floor(steps.length * 0.99)]
        codecRows[codecRows.length - 1].seam = { jump, typ }
      }
    }
  }
}

// ─── Report ─────────────────────────────────────────────────────────────────

const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '-inf')
const L = []
L.push(`Bug Crunch rendered SFX — ${new Date().toISOString()}`)
L.push(`render ${SR} Hz → ship ${SHIP_SR} Hz Vorbis q${QUALITY}, ceiling ${CEILING_DB} dBTP`)
L.push('')
L.push('Levels are AT THE MIX (runtime gain, before the player\'s slider). ph50/ph400 = phone-weighted')
L.push('(loudest 50/400 ms, >150 Hz, +4 dB over 1.7 kHz); M = EBU momentary max, I = integrated LUFS;')
L.push('TPmix = true peak at the mix gain. "old" = the live synth it replaces.')
L.push('')
L.push(['cue', 'tier', 'n', 'pick', 'dur', 'TPmix', 'ph50', 'ph400', 'M', 'I', 'target', 'old', 'Δold', 'gain'].map((h, i) => (i === 0 ? h.padEnd(13) : h.padStart(8))).join(''))
for (const r of rows) {
  const lvl = r.metric === 'ph400' ? r.ph400 : r.ph50
  const old = r.legacy ? (r.metric === 'ph400' ? r.legacy.ph400 : r.legacy.ph50) : NaN
  L.push([
    r.id.padEnd(13), String(r.tier).padStart(8), String(r.slots).padStart(8), r.pick.padStart(8), `${Math.round(r.maxDurMs)}ms`.padStart(8),
    f1(r.tp).padStart(8), f1(r.ph50).padStart(8), f1(r.ph400).padStart(8), f1(r.M).padStart(8), f1(r.I).padStart(8),
    `${f1(r.target)}${r.metric === 'ph400' ? 'L' : ''}`.padStart(8), f1(old).padStart(8), (Number.isFinite(old) ? f1(lvl - old) : '').padStart(8), r.gain.toFixed(4).padStart(8)
  ].join(''))
}
L.push('')
L.push('(target: ph50 unless marked L = ph400)')
if (spriteRows.length) {
  L.push('')
  L.push('Sprites (what ships):')
  let t1 = 0, t2 = 0
  for (const s of spriteRows) {
    L.push(`  sfx-${s.sid}.ogg  tier ${s.tier}  ${s.seconds.toFixed(2)} s  ${(s.bytes / 1024).toFixed(1)} KB  decoded ${s.decodedSamples}/${s.samples} samples  codec SNR ${s.snr.toFixed(1)} dB`)
    if (s.tier === 1) t1 += s.bytes; else t2 += s.bytes
  }
  L.push(`  tier 1 ${(t1 / 1024).toFixed(1)} KB · tier 2 ${(t2 / 1024).toFixed(1)} KB · total ${((t1 + t2) / 1024).toFixed(1)} KB`)
  L.push('')
  L.push('Decoded check (per cue): max true peak of the shipped slots, level drift through the codec (taken out of the shipped gain), loop seam:')
  for (const c of codecRows) {
    L.push(`  ${c.id.padEnd(13)} TP ${f1(c.decTp).padStart(6)} dBTP   drift ${c.drift >= 0 ? '+' : ''}${c.drift.toFixed(2)} dB${c.seam ? `   seam step ${c.seam.jump.toExponential(1)} vs p99 step ${c.seam.typ.toExponential(1)}` : ''}`)
  }
}
const text = L.join('\n')
writeFileSync(join(OUT, 'report.txt'), text)
writeFileSync(join(OUT, 'report.json'), JSON.stringify({ rows, spriteRows, codecRows, manifest }, null, 2))
console.log(text)

// ─── Manifest ───────────────────────────────────────────────────────────────

if (SHIP) {
  const file = join(ROOT, 'src', 'game', 'audio', 'sfxSprites.ts')
  const body = `/**
 * GENERATED by \`pnpm audio:sfx -- --ship\` (tools/audio/build-sfx.mjs) — do not
 * edit by hand; change the cue sheet (tools/audio/sfx/recipes.mjs) and rebuild.
 *
 * Which sprite file each rendered cue lives in, where its takes sit in it
 * (seconds), how the runtime picks a take, and the gain that puts it at its
 * target level in the mix (before the player's slider). Tier 1 is what the
 * first level needs; tier 2 loads after it.
 */
import type { SfxCueSpec, SfxSpriteSpec } from '@/game/audio/sfxPick'

export const SFX_SPRITES: Readonly<Record<string, SfxSpriteSpec>> = ${JSON.stringify(manifest.sprites, null, 2)}

export const SFX_CUES: Readonly<Record<string, SfxCueSpec>> = ${JSON.stringify(manifest.cues, null, 2)}
`
  writeFileSync(file, body.replace(/"([a-zA-Z0-9_]+)":/g, '$1:').replace(/"/g, "'"))
  console.log(`[sfx] wrote ${file}`)
}

// ─── Pictures ───────────────────────────────────────────────────────────────

if (PNG) {
  for (const r of rows) {
    picture(join(OUT, 'new', `${r.id}.wav`), join(OUT, 'png', 'new', `${r.id}.png`))
    if (existsSync(join(OUT, 'old', `${r.id}.wav`))) picture(join(OUT, 'old', `${r.id}.wav`), join(OUT, 'png', 'old', `${r.id}.png`), { width: 600 })
  }
  for (const f of ['charge', 'slide']) {
    if (existsSync(join(OUT, 'loops', `${f}-seam.wav`))) {
      picture(join(OUT, 'loops', `${f}-seam.wav`), join(OUT, 'png', 'loops', `${f}-seam.png`), { width: 800 })
      picture(join(OUT, 'loops', `${f}-decoded-x4.wav`), join(OUT, 'png', 'loops', `${f}-decoded-x4.png`), { width: 1200 })
    }
  }
}
console.log(`\n[sfx] audition set in ${OUT}`)
