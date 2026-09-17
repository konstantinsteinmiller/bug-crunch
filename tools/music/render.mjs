#!/usr/bin/env node
// ─── pnpm music:render ──────────────────────────────────────────────────────
//
// Renders the Bug Crunch theme ("Crunch Parade") from `score.mjs`: a
// deterministic offline synthesiser + sequencer in plain Node, mastered, written
// as a float WAV to a work folder and encoded to Ogg Vorbis into
// `public/audio/music/`. Same score + same seed = the same file, bit for bit, up
// to the encoder.
//
//   pnpm music:render                         render, check, encode
//   pnpm music:render -- --analyse            + spectrograms, waveforms, seam
//                                               pictures and loudness at x1.16
//   pnpm music:render -- --work <dir>         where the WAV/PNGs go
//                                               (default: $TMP/bug-crunch-music)
//   pnpm music:render -- --no-ogg             render + report only
//   pnpm music:render -- --force              render despite harmony clashes
//
// ─── How the loop is made seamless ──────────────────────────────────────────
//
// The game plays this file with `audio.loop = true` for a whole level. A loop
// rendered naively starts dry — no reverb, no delay repeats, compressor at rest
// — while its end is full of tails, so the seam is audible as the room
// vanishing. Here every event is mixed THREE times: at its place in the loop,
// one loop earlier, and one loop later, into a buffer that runs from 8 s before
// the loop to 2 s after it. Effects and dynamics then run continuously across
// the whole thing, and the middle copy is cut out. Its first sample carries the
// tails of the previous pass; its last sample runs into the next pass. The
// render proves it: the audio just past the cut must equal the audio at the
// loop's start, and the report prints the difference.
//
// ─── Why the file is quiet ──────────────────────────────────────────────────
//
// It is mastered to the loudness of the tracks that already ship (-28 LUFS
// sits between `bg-cozy` at -33 and `trance` at -27), not to streaming
// loudness. `useSound` sets one element volume for every track, and the SFX
// balance was tuned against those files; a -14 LUFS track would arrive 13 dB
// on top of every squish.

import { mkdirSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

import {
  SR, Biquad, clamp, compress, dbToGain, freeverb, gainToDb, integratedLufs, limit, pingPong, rng, truePeakDb, wavFloat32
} from './lib/dsp.mjs'
import * as voices from './lib/voices.mjs'
import { expand } from './lib/notation.mjs'
import { checkHarmony } from './lib/harmony.mjs'
import * as score from './score.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

// ─── Settings ───────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const WORK = resolve(opt('work', process.env.MUSIC_WORK_DIR ?? join(tmpdir(), 'bug-crunch-music')))
const OUT_OGG = resolve(ROOT, opt('out', 'public/audio/music/crunch-parade.ogg'))
const BASENAME = 'crunch-parade'
/** Integrated loudness of the shipped file — see "Why the file is quiet". */
const TARGET_LUFS = Number(opt('lufs', -28))
/** Vorbis quality. Measured on this mix (decode, subtract): q1 760 KB / 21.8 dB
 *  SNR, q2 870 KB / 23.7 dB, q3 1 000 KB / 25.4 dB — and the same within 0.3 dB
 *  at +12 dB, so the quiet master costs the codec nothing. q2 buys the claps and
 *  hats ~2 dB less coding noise for 110 KB, and stays well inside the budget. */
const VORBIS_Q = Number(opt('quality', 2))
/** Level the bus compressor and limiter are calibrated at, before the final trim. */
const NOMINAL_LUFS = -16
const PRE_SEC = 8
const POST_SEC = 2

const ffmpegPath = (() => {
  try {
    const p = createRequire(join(ROOT, 'package.json'))('ffmpeg-static')
    if (p && existsSync(p)) return p
  } catch { /* fall through to PATH */ }
  return 'ffmpeg'
})()

const ffmpeg = (args, input) => {
  const r = spawnSync(ffmpegPath, ['-hide_banner', '-nostats', ...args], { input, maxBuffer: 1 << 28 })
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}\n${r.stderr?.toString()}`)
  return r.stderr.toString()
}

const VOICES = {
  kick: voices.kick,
  snare: voices.snare,
  clap: voices.clap,
  snap: voices.snap,
  hatClosed: voices.hatClosed,
  hatOpen: voices.hatOpen,
  shaker: voices.shaker,
  woodblock: voices.woodblock,
  cowbell: voices.cowbell,
  tom: voices.tom,
  crash: voices.crash,
  slideWhistle: voices.slideWhistle,
  boing: voices.boing,
  slapBass: voices.slapBass,
  pizzBass: voices.pizzBass,
  marimba: voices.marimba,
  xylophone: voices.xylophone,
  pizz: voices.pizz,
  kazoo: voices.kazoo,
  clav: voices.clav,
  brass: voices.brass
}

const t0 = Date.now()
const log = (...a) => console.log(...a)
const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : String(x))

// ─── 1. Score ───────────────────────────────────────────────────────────────

const expanded = expand(score)
const { events, stepSec, loopSec, bars } = expanded
log(`${score.TITLE}: ${bars.length} bars at ${score.TEMPO} BPM = ${fmt(loopSec, 2)} s, ${events.length} events`)

const harmony = checkHarmony(score, expanded)
log(`harmony: ${harmony.notes} pitched notes, ${harmony.passing} passing tones, ${harmony.clashes.length} clashes, ${harmony.leaps.length} leaps, ${harmony.rubs.length} rubs`)
for (const c of harmony.clashes) log(`  CLASH ${c}`)
for (const c of harmony.leaps) log(`  leap  ${c}`)
for (const c of harmony.rubs) log(`  rub   ${c}`)
if (harmony.clashes.length && !flag('force')) {
  console.error('refusing to render with harmony clashes (pass --force to override)')
  process.exit(1)
}

// ─── 2. Performance → buses ─────────────────────────────────────────────────

const LOOP = Math.round(loopSec * SR)
const PRE = PRE_SEC * SR
const POST = POST_SEC * SR
const N = PRE + LOOP + POST
const stereo = () => [new Float32Array(N), new Float32Array(N)]

const BUS_NAMES = ['drums', 'bass', 'lead', 'kazoo', 'counter', 'comp', 'fx']
const bus = Object.fromEntries(BUS_NAMES.map((n) => [n, stereo()]))
const revSend = new Float32Array(N)
const dlySend = new Float32Array(N)
const kicks = []

// Open hats are choked by the next closed hat, wrapping round the loop.
const chokers = {}
for (const [name, part] of Object.entries(score.PARTS)) {
  if (part.chokedBy) chokers[name] = events.filter((e) => e.part === part.chokedBy).map((e) => e.time).sort((a, b) => a - b)
}

const choke = (buf, samples) => {
  const fade = Math.round(0.01 * SR)
  const cut = (ch) => {
    for (let i = Math.max(0, samples - fade); i < ch.length; i++) {
      ch[i] *= i >= samples ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (i - (samples - fade))) / fade)
    }
  }
  if (Array.isArray(buf)) buf.forEach(cut)
  else cut(buf)
}

const place = (target, buf, start, gain, pan, rev, dly) => {
  const th = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4
  const gl = Math.cos(th) * Math.SQRT2 * gain
  const gr = Math.sin(th) * Math.SQRT2 * gain
  const [L, R] = target
  const isStereo = Array.isArray(buf)
  const len = isStereo ? buf[0].length : buf.length
  const from = Math.max(0, -start)
  const to = Math.min(len, N - start)
  for (let i = from; i < to; i++) {
    const j = start + i
    let mono
    if (isStereo) {
      L[j] += buf[0][i] * gain
      R[j] += buf[1][i] * gain
      mono = 0.5 * (buf[0][i] + buf[1][i])
    } else {
      mono = buf[i]
      L[j] += mono * gl
      R[j] += mono * gr
    }
    if (rev) revSend[j] += mono * gain * rev
    if (dly) dlySend[j] += mono * gain * dly
  }
}

for (const ev of events) {
  const mix = score.MIX[ev.part]
  if (!mix) throw new Error(`no MIX entry for part ${ev.part}`)
  const fn = VOICES[ev.voice]
  if (!fn) throw new Error(`no voice ${ev.voice} (part ${ev.part})`)
  const buf = fn(ev, rng(ev.seed))

  if (chokers[ev.part]?.length) {
    const times = chokers[ev.part]
    const next = times.find((t) => t > ev.time + 0.002) ?? times[0] + loopSec
    choke(buf, Math.round((next - ev.time) * SR))
  }

  const pan = (mix.pan ?? 0) + (mix.spread && ev.chordVoice != null ? (ev.chordVoice - 1) * mix.spread : 0)
  const offset = Math.round(ev.time * SR)
  for (const cycle of [-1, 0, 1]) {
    const start = PRE + offset + cycle * LOOP
    place(bus[mix.bus], buf, start, mix.gain, pan, mix.rev ?? 0, mix.dly ?? 0)
    if (ev.voice === 'kick') kicks.push({ at: start, vel: ev.vel })
  }
}
log(`performed in ${((Date.now() - t0) / 1000).toFixed(1)} s`)

// ─── 3. Effects, side-chain, sum ────────────────────────────────────────────

// The duck: every kick pulls the bed down a couple of dB for ~120 ms. Computed
// from the score's kick times rather than detected — it cannot miss a ghost
// kick or trip on a clap, and it is identical on every pass of the loop.
const duck = new Float32Array(N)
{
  const att = Math.round(0.004 * SR)
  const span = Math.round(0.45 * SR)
  for (const { at, vel } of kicks) {
    for (let k = 0; k < span; k++) {
      const j = at + k
      if (j < 0 || j >= N) continue
      const env = (k < att ? k / att : Math.exp(-(k - att) / (0.12 * SR))) * vel
      if (env > duck[j]) duck[j] = env
    }
  }
}

{
  const hp = new Biquad('highpass', 280, 0.7071)
  hp.run(revSend)
}
const [revL, revR] = freeverb(revSend, { room: 0.6, damp: 0.5, predelayMs: 14 })
new Biquad('lowpass', 5500, 0.7071).run(revL)
new Biquad('lowpass', 5500, 0.7071).run(revR)
const [dlyL, dlyR] = pingPong(dlySend, { delaySec: 3 * stepSec, feedback: 0.32 })

const REV_RETURN = 3.1
const DLY_RETURN = 1.4
const DUCK = { bass: 0.18, bed: 0.22, returns: 0.4 }

const loopSlice = (ch) => ch.subarray(PRE, PRE + LOOP)
const stemLufs = {
  drums: integratedLufs(loopSlice(bus.drums[0]), loopSlice(bus.drums[1])),
  bass: integratedLufs(loopSlice(bus.bass[0]), loopSlice(bus.bass[1])),
  lead: integratedLufs(loopSlice(bus.lead[0]), loopSlice(bus.lead[1])),
  kazoo: integratedLufs(loopSlice(bus.kazoo[0]), loopSlice(bus.kazoo[1])),
  counter: integratedLufs(loopSlice(bus.counter[0]), loopSlice(bus.counter[1])),
  comp: integratedLufs(loopSlice(bus.comp[0]), loopSlice(bus.comp[1])),
  fx: integratedLufs(loopSlice(bus.fx[0]), loopSlice(bus.fx[1])),
  reverb: integratedLufs(loopSlice(revL).map((x) => x * REV_RETURN), loopSlice(revR).map((x) => x * REV_RETURN)),
  delay: integratedLufs(loopSlice(dlyL).map((x) => x * DLY_RETURN), loopSlice(dlyR).map((x) => x * DLY_RETURN))
}

const [ML, MR] = stereo()
for (let j = 0; j < N; j++) {
  const d = duck[j]
  const gBass = 1 - DUCK.bass * d
  const gBed = 1 - DUCK.bed * d
  const gRet = 1 - DUCK.returns * d
  ML[j] = bus.drums[0][j] + bus.fx[0][j] + bus.bass[0][j] * gBass +
    (bus.lead[0][j] + bus.kazoo[0][j] + bus.counter[0][j] + bus.comp[0][j]) * gBed +
    (revL[j] * REV_RETURN + dlyL[j] * DLY_RETURN) * gRet
  MR[j] = bus.drums[1][j] + bus.fx[1][j] + bus.bass[1][j] * gBass +
    (bus.lead[1][j] + bus.kazoo[1][j] + bus.counter[1][j] + bus.comp[1][j]) * gBed +
    (revR[j] * REV_RETURN + dlyR[j] * DLY_RETURN) * gRet
}
for (const k of Object.keys(bus)) delete bus[k] // free ~250 MB before mastering

// ─── 4. Master ──────────────────────────────────────────────────────────────

// DC and sub-rumble out.
new Biquad('highpass', 28, 0.7071).run(ML)
new Biquad('highpass', 28, 0.7071).run(MR)

// Mono below ~120 Hz: the side channel is high-passed (4th-order Butterworth).
// Stereo bass is lost on a phone anyway and costs headroom everywhere else.
{
  const s1 = new Biquad('highpass', 120, 0.5412)
  const s2 = new Biquad('highpass', 120, 1.3066)
  for (let j = 0; j < N; j++) {
    const m = 0.5 * (ML[j] + MR[j])
    const s = s2.process(s1.process(0.5 * (ML[j] - MR[j])))
    ML[j] = m + s
    MR[j] = m - s
  }
}

// A wide 1.5 dB dip where the squish's body lives, and a gentle shelf off the
// top so the hats never become a hiss on top of the board.
for (const ch of [ML, MR]) {
  new Biquad('peak', 2300, 0.8, -1.5).run(ch)
  new Biquad('highshelf', 9000, 0.7071, -2).run(ch)
}

const preLufs = integratedLufs(loopSlice(ML), loopSlice(MR))
{
  const g = dbToGain(NOMINAL_LUFS - preLufs)
  for (let j = 0; j < N; j++) {
    ML[j] *= g
    MR[j] *= g
  }
}
const comp = compress(ML, MR, { thresholdDb: -17, ratio: 2, kneeDb: 8, attackMs: 15, releaseMs: 170 })
const lim = limit(ML, MR, { ceilingDb: -1, lookaheadMs: 5, releaseMs: 90 })

const glued = integratedLufs(loopSlice(ML), loopSlice(MR))
{
  const g = dbToGain(TARGET_LUFS - glued)
  for (let j = 0; j < N; j++) {
    ML[j] *= g
    MR[j] *= g
  }
}

// ─── 5. Seam proof ──────────────────────────────────────────────────────────

let seamDiff = 0
let seamRef = 1e-9
{
  const span = POST - Math.round(0.05 * SR) // stay clear of the buffer's far end
  for (let k = 0; k < span; k++) {
    seamDiff = Math.max(seamDiff, Math.abs(ML[PRE + LOOP + k] - ML[PRE + k]), Math.abs(MR[PRE + LOOP + k] - MR[PRE + k]))
    seamRef = Math.max(seamRef, Math.abs(ML[PRE + k]), Math.abs(MR[PRE + k]))
  }
}

const outL = ML.slice(PRE, PRE + LOOP)
const outR = MR.slice(PRE, PRE + LOOP)

// The step across the seam, against how big a sample-to-sample step normally is.
const deltas = new Float32Array(LOOP - 1)
for (let i = 1; i < LOOP; i++) deltas[i - 1] = Math.max(Math.abs(outL[i] - outL[i - 1]), Math.abs(outR[i] - outR[i - 1]))
const sortedDeltas = Float32Array.from(deltas).sort()
const p999 = sortedDeltas[Math.floor(sortedDeltas.length * 0.999)]
const seamStep = Math.max(Math.abs(outL[0] - outL[LOOP - 1]), Math.abs(outR[0] - outR[LOOP - 1]))

let dcL = 0
let dcR = 0
for (let i = 0; i < LOOP; i++) {
  dcL += outL[i]
  dcR += outR[i]
}

// ─── 6. Report ──────────────────────────────────────────────────────────────

const finalLufs = integratedLufs(outL, outR)
const tp = truePeakDb(outL, outR)
log('')
log('stems (integrated LUFS, pre-master; LU relative to drums):')
for (const [k, v] of Object.entries(stemLufs)) log(`  ${k.padEnd(8)} ${fmt(v).padStart(6)}   ${fmt(v - stemLufs.drums).padStart(6)} LU`)
log('')
log('sections (short-term energy of the master):')
{
  let at = 0
  for (const s of score.SECTIONS) {
    const a = Math.round(at * 16 * stepSec * SR)
    const b = Math.round((at + s.chords.length) * 16 * stepSec * SR)
    let acc = 0
    for (let i = a; i < b; i++) acc += outL[i] * outL[i] + outR[i] * outR[i]
    const rms = gainToDb(Math.sqrt(acc / (2 * (b - a))))
    const mm = Math.floor((at * 16 * stepSec) / 60)
    const ss = ((at * 16 * stepSec) % 60).toFixed(1).padStart(4, '0')
    log(`  bar ${String(at + 1).padStart(2)}  ${mm}:${ss}  ${s.name.padEnd(10)} ${String(s.chords.length).padStart(2)} bars  RMS ${fmt(rms)} dBFS`)
    at += s.chords.length
  }
}
log('')
log(`master: pre ${fmt(preLufs)} LUFS → nominal ${NOMINAL_LUFS} → comp max ${fmt(comp.maxGrDb)} dB GR (mean ${fmt(comp.meanGrDb, 2)}) → limiter ${lim.samplesOver} samples over, max ${fmt(lim.maxGrDb, 2)} dB → trim to ${TARGET_LUFS}`)
log(`final:  ${fmt(finalLufs)} LUFS integrated, true peak ${fmt(tp)} dBTP, DC ${(dcL / LOOP).toExponential(1)} / ${(dcR / LOOP).toExponential(1)}`)
log(`seam:   next-pass vs loop-start max diff ${fmt(gainToDb(seamDiff / seamRef))} dB re local peak; step across the cut ${seamStep.toExponential(2)} vs 99.9th-pct step ${p999.toExponential(2)}`)

// ─── 7. Files ───────────────────────────────────────────────────────────────

mkdirSync(WORK, { recursive: true })
const wavPath = join(WORK, `${BASENAME}.wav`)
writeFileSync(wavPath, wavFloat32(outL, outR))
log(`wav:    ${wavPath}`)

if (!flag('no-ogg')) {
  mkdirSync(dirname(OUT_OGG), { recursive: true })
  ffmpeg(['-y', '-loglevel', 'error', '-i', wavPath, '-c:a', 'libvorbis', '-q:a', String(VORBIS_Q),
    '-map_metadata', '-1', '-metadata', `title=${score.TITLE}`, '-metadata', 'artist=Bug Crunch', OUT_OGG])
  const size = statSync(OUT_OGG).size
  // Decode it back and count samples: a Vorbis file whose granule positions
  // are wrong decodes long or short, and a loop that is 1 024 samples long
  // clicks on every pass no matter how clean the render was.
  const dec = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', OUT_OGG, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 })
  const decodedSamples = dec.stdout.length / 8
  log(`ogg:    ${OUT_OGG} — ${(size / 1024).toFixed(0)} KB, q${VORBIS_Q}, decodes to ${decodedSamples} samples (render ${LOOP}${decodedSamples === LOOP ? ', exact' : ', MISMATCH'})`)
}

// ─── 8. Analysis (optional) ─────────────────────────────────────────────────

if (flag('analyse')) {
  const png = (name) => join(WORK, name)
  const seamSec = 2
  const seamN = seamSec * SR
  const seamWav = join(WORK, `${BASENAME}-seam.wav`)
  const sL = new Float32Array(2 * seamN)
  const sR = new Float32Array(2 * seamN)
  sL.set(outL.subarray(LOOP - seamN), 0)
  sL.set(outL.subarray(0, seamN), seamN)
  sR.set(outR.subarray(LOOP - seamN), 0)
  sR.set(outR.subarray(0, seamN), seamN)
  writeFileSync(seamWav, wavFloat32(sL, sR))
  const zoomN = Math.round(0.025 * SR)
  const zoomWav = join(WORK, `${BASENAME}-seam-zoom.wav`)
  writeFileSync(zoomWav, wavFloat32(sL.subarray(seamN - zoomN, seamN + zoomN), sR.subarray(seamN - zoomN, seamN + zoomN)))

  // The picture of the seam is drawn from the DECODED ogg when there is one:
  // that is the file the browser loops, not the render.
  const src = !flag('no-ogg') ? OUT_OGG : wavPath
  // Waveforms are drawn with a display-only gain up to ~-0.5 dBFS: at -28 LUFS
  // the real file is a thin line, and a thin line hides exactly the seam steps
  // and clipped flats these pictures exist to show.
  const show = `volume=${fmt(-tp - 0.5)}dB,`
  const spectrum = 'showspectrumpic=s=1600x640:mode=combined:color=intensity:scale=log:fscale=lin:legend=1:stop=16000'
  ffmpeg(['-y', '-loglevel', 'error', '-i', src, '-lavfi', spectrum, png(`${BASENAME}-spectrogram.png`)])
  ffmpeg(['-y', '-loglevel', 'error', '-i', src, '-lavfi', `${show}showwavespic=s=1600x480:split_channels=1:filter=peak`, png(`${BASENAME}-waveform.png`)])
  ffmpeg(['-y', '-loglevel', 'error', '-i', seamWav, '-lavfi', 'showspectrumpic=s=1200x600:mode=combined:color=intensity:scale=log:fscale=lin:legend=1:stop=16000', png(`${BASENAME}-seam-spectrogram.png`)])
  ffmpeg(['-y', '-loglevel', 'error', '-i', seamWav, '-lavfi', `${show}showwavespic=s=1200x400:split_channels=1:filter=peak`, png(`${BASENAME}-seam-waveform.png`)])
  ffmpeg(['-y', '-loglevel', 'error', '-i', zoomWav, '-lavfi', `${show}showwavespic=s=1000x400:split_channels=1:draw=full`, png(`${BASENAME}-seam-zoom.png`)])

  const loud = (label, args) => {
    // Only the Summary block — the per-frame lines above it carry an `I:` too.
    const all = ffmpeg(args)
    const err = all.slice(all.lastIndexOf('Summary:'))
    const I = /I:\s+(-?[\d.]+) LUFS/.exec(err)?.[1]
    const LRA = /LRA:\s+(-?[\d.]+) LU/.exec(err)?.[1]
    const TP = /Peak:\s+(-?[\d.inf]+) dBFS/.exec(err)?.[1]
    log(`  ${label.padEnd(26)} I ${I} LUFS  LRA ${LRA} LU  TP ${TP} dBTP`)
  }
  log('')
  log('ffmpeg ebur128:')
  loud('render (wav)', ['-i', wavPath, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
  if (!flag('no-ogg')) {
    loud('ogg', ['-i', OUT_OGG, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    // x1.16 two ways: tape speed (pitch up, what the design notes describe) and
    // pitch-preserving time stretch (what a media element does by default).
    loud('ogg x1.16 tape', ['-i', OUT_OGG, '-af', `asetrate=${Math.round(SR * 1.16)},aresample=${SR},ebur128=peak=true`, '-f', 'null', '-'])
    loud('ogg x1.16 stretch', ['-i', OUT_OGG, '-af', 'atempo=1.16,ebur128=peak=true', '-f', 'null', '-'])
    ffmpeg(['-y', '-loglevel', 'error', '-i', OUT_OGG, '-lavfi', `atempo=1.16,${spectrum}`, png(`${BASENAME}-x116-stretch-spectrogram.png`)])
  }
  const stats = ffmpeg(['-i', src, '-af', 'astats=measure_perchannel=none', '-f', 'null', '-'])
  log('ffmpeg astats:')
  for (const line of stats.split('\n')) if (/DC offset|Peak level dB|RMS level dB|Flat factor|Peak count|Crest/.test(line)) log(`  ${line.replace(/^\[.*?\]\s*/, '')}`)
  log(`pictures in ${WORK}`)
}

log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
