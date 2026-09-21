#!/usr/bin/env node
// ─── pnpm music:render ──────────────────────────────────────────────────────
//
// Renders the Bug Crunch score from data: a deterministic offline synthesiser +
// sequencer in plain Node, mastered, written as a float WAV to a work folder and
// encoded to Ogg Vorbis into `public/audio/music/`. Same score + same seed = the
// same file, bit for bit (the encode is `bitexact`, so even the Ogg stream serial
// is fixed).
//
// Five pieces, one band, one pipeline (see `TRACKS` below):
//
//   parade   Crunch Parade — the theme and the default bed          score.mjs
//   attic    Attic Tiptoe — world 3's bed                           scores/attic.mjs
//   boss     Boss Stomp — every boss level                          scores/boss.mjs
//   fever    Fever Stinger — exactly FEVER_MS, over Splat Fever     scores/fever-stinger.mjs
//   result   Result Sting — the cleared result screen               scores/result-sting.mjs
//
//   pnpm music:render                         render, check, encode every piece
//   pnpm music:render -- --track boss,attic   only those
//   pnpm music:render -- --analyse            + spectrograms, waveforms, seam /
//                                               ending pictures and loudness
//   pnpm music:render -- --work <dir>         where the WAV/PNGs go
//                                               (default: $TMP/bug-crunch-music)
//   pnpm music:render -- --out-dir <dir>      where the .ogg files go
//                                               (default: public/audio/music)
//   pnpm music:render -- --no-ogg             render + report only
//   pnpm music:render -- --force              render despite harmony clashes
//
// ─── How a LOOP is made seamless ────────────────────────────────────────────
//
// The game plays a bed with `audio.loop = true` for a whole level. A loop
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
// ─── How a ONE-SHOT ends clean ──────────────────────────────────────────────
//
// The fever stinger and the result sting are cut to an exact length (441 000
// samples for a 10 s stinger) and must not stop on a sound. Every event is
// mixed once; the score puts its last hit early enough to ring out, and the
// last 60 ms get a raised-cosine fade to digital zero as insurance. The report
// prints how loud the audio still was before that fade — a number near the
// noise floor means the fade did nothing audible, which is the point.
//
// ─── Why the files are quiet ────────────────────────────────────────────────
//
// Mastered to the loudness of the tracks that already ship (-28 LUFS sits
// between `bg-cozy` at -33 and `trance` at -27), not to streaming loudness.
// `useSound` sets one element volume for every bed, and the SFX balance was
// tuned against those files; a -14 LUFS track would arrive 13 dB on top of
// every squish. The stinger and the sting play through the same music volume
// (see `playMusicCue` in `useSound.ts`), so they are mastered on the same scale.

import { mkdirSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

import {
  SR, Biquad, clamp, compress, dbToGain, freeverb, gainToDb, integratedLufs, limit, pingPong, rng, truePeakDb, wavFloat32
} from './lib/dsp.mjs'
import * as voices from './lib/voices.mjs'
import { expand } from './lib/notation.mjs'
import { checkHarmony } from './lib/harmony.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

/** Every piece the game ships, in render order. */
const TRACKS = {
  parade: 'score.mjs',
  attic: 'scores/attic.mjs',
  boss: 'scores/boss.mjs',
  fever: 'scores/fever-stinger.mjs',
  result: 'scores/result-sting.mjs'
}

// ─── Settings ───────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const WORK = resolve(opt('work', process.env.MUSIC_WORK_DIR ?? join(tmpdir(), 'bug-crunch-music')))
const OUT_DIR = resolve(ROOT, opt('out-dir', 'public/audio/music'))
const ONLY = opt('track', 'all')
const WANTED = ONLY === 'all' ? Object.keys(TRACKS) : ONLY.split(',').map((s) => s.trim()).filter(Boolean)
for (const id of WANTED) {
  if (!TRACKS[id]) {
    console.error(`unknown track "${id}" — one of: ${Object.keys(TRACKS).join(', ')}`)
    process.exit(1)
  }
}

/** Level the bus compressor and limiter are calibrated at, before the final trim. */
const NOMINAL_LUFS = -16

/**
 * Per-piece render settings. A score exports `RENDER` to override any of these;
 * Crunch Parade exports none, and these defaults ARE its settings — which is how
 * this file can render four more pieces and still produce the parade bit for
 * bit (the WAV hash is the check).
 *
 * `buses` says how each bus meets the kick side-chain: `dry` is never ducked
 * (drums, cartoon accents), `bass` a little, `bed` a little more. Order matters
 * only for reproducibility — sums run in this order.
 */
const DEFAULT_RENDER = {
  /** Basename in `public/audio/music/`. */
  file: 'crunch-parade',
  /** `true` for a seamless bed; `{ lengthSec }` for a one-shot cut to length. */
  loop: true,
  lufs: -28,
  /** Vorbis quality. Measured on the parade (decode, subtract): q1 760 KB /
   *  21.8 dB SNR, q2 870 KB / 23.7 dB, q3 1 000 KB / 25.4 dB — and the same
   *  within 0.3 dB at +12 dB, so the quiet master costs the codec nothing. */
  quality: 2,
  buses: { drums: 'dry', bass: 'bass', lead: 'bed', kazoo: 'bed', counter: 'bed', comp: 'bed', fx: 'dry' },
  reverb: { room: 0.6, damp: 0.5, predelayMs: 14, hp: 280, lp: 5500, ret: 3.1 },
  delay: { steps: 3, feedback: 0.32, ret: 1.4 },
  duck: { bass: 0.18, bed: 0.22, returns: 0.4 },
  compressor: { thresholdDb: -17, ratio: 2, kneeDb: 8, attackMs: 15, releaseMs: 170 },
  /** Pre-roll a loop is rendered with, so the first pass inherits real tails. */
  preSec: 8,
  postSec: 2
}

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
  brass: voices.brass,
  // Added with the attic, the boss, the fever stinger and the result sting.
  chip: voices.chip,
  timpani: voices.timpani,
  tuba: voices.tuba,
  musicBox: voices.musicBox,
  theremin: voices.theremin,
  bassoon: voices.bassoon,
  toyOrgan: voices.toyOrgan,
  riser: voices.riser
}

const t00 = Date.now()
const log = (...a) => console.log(...a)
const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : String(x))

const renderTrack = async (id) => {
  const t0 = Date.now()
  const score = await import(pathToFileURL(join(HERE, TRACKS[id])).href)
  const R = { ...DEFAULT_RENDER, ...(score.RENDER ?? {}) }
  for (const k of ['reverb', 'delay', 'duck', 'compressor']) R[k] = { ...DEFAULT_RENDER[k], ...(score.RENDER?.[k] ?? {}) }
  const isLoop = R.loop === true
  const BASENAME = R.file
  const OUT_OGG = join(OUT_DIR, `${BASENAME}.ogg`)

  log('')
  log(`═══ ${id}: ${score.TITLE} ═══`)

  // ─── 1. Score ─────────────────────────────────────────────────────────────

  const expanded = expand(score)
  const { events, stepSec, bars } = expanded
  const loopSec = isLoop ? expanded.loopSec : R.loop.lengthSec
  log(`${score.TITLE}: ${bars.length} bars at ${score.TEMPO} BPM = ${fmt(expanded.loopSec, 3)} s, ${events.length} events, ${isLoop ? 'LOOP' : `ONE-SHOT cut at ${fmt(loopSec, 3)} s`}`)

  const harmony = checkHarmony(score, expanded)
  log(`harmony: ${harmony.notes} pitched notes, ${harmony.passing} passing tones, ${harmony.clashes.length} clashes, ${harmony.leaps.length} leaps, ${harmony.rubs.length} rubs`)
  for (const c of harmony.clashes) log(`  CLASH ${c}`)
  for (const c of harmony.leaps) log(`  leap  ${c}`)
  for (const c of harmony.rubs) log(`  rub   ${c}`)
  if (harmony.clashes.length && !flag('force')) {
    console.error('refusing to render with harmony clashes (pass --force to override)')
    process.exit(1)
  }

  // ─── 2. Performance → buses ───────────────────────────────────────────────

  const LOOP = Math.round(loopSec * SR)
  // A one-shot starts from silence on purpose (it is an entrance), so it needs
  // only enough pre-roll to hold an event humanised a few ms early.
  const PRE = isLoop ? R.preSec * SR : Math.round(0.05 * SR)
  const POST = R.postSec * SR
  const N = PRE + LOOP + POST
  const stereo = () => [new Float32Array(N), new Float32Array(N)]

  const BUS_NAMES = Object.keys(R.buses)
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
    const [L, Rr] = target
    const isStereo = Array.isArray(buf)
    const len = isStereo ? buf[0].length : buf.length
    const from = Math.max(0, -start)
    const to = Math.min(len, N - start)
    for (let i = from; i < to; i++) {
      const j = start + i
      let mono
      if (isStereo) {
        L[j] += buf[0][i] * gain
        Rr[j] += buf[1][i] * gain
        mono = 0.5 * (buf[0][i] + buf[1][i])
      } else {
        mono = buf[i]
        L[j] += mono * gl
        Rr[j] += mono * gr
      }
      if (rev) revSend[j] += mono * gain * rev
      if (dly) dlySend[j] += mono * gain * dly
    }
  }

  const cycles = isLoop ? [-1, 0, 1] : [0]
  for (const ev of events) {
    const mix = score.MIX[ev.part]
    if (!mix) throw new Error(`no MIX entry for part ${ev.part}`)
    if (!bus[mix.bus]) throw new Error(`part ${ev.part}: unknown bus "${mix.bus}"`)
    const fn = VOICES[ev.voice]
    if (!fn) throw new Error(`no voice ${ev.voice} (part ${ev.part})`)
    const buf = fn(ev, rng(ev.seed))

    if (chokers[ev.part]?.length) {
      const times = chokers[ev.part]
      const next = times.find((t) => t > ev.time + 0.002) ?? times[0] + loopSec
      choke(buf, Math.round((next - ev.time) * SR))
    }

    const pan = (mix.pan ?? 0) + (mix.spread && ev.chordVoice != null ? (ev.chordVoice - 1) * mix.spread : 0)
    // A one-shot's downbeat is sample 0: an event humanised a hair early would
    // otherwise be cut mid-attack and the file would open on a click.
    const offset = Math.round((isLoop ? ev.time : Math.max(0, ev.time)) * SR)
    for (const cycle of cycles) {
      const start = PRE + offset + cycle * LOOP
      place(bus[mix.bus], buf, start, mix.gain, pan, mix.rev ?? 0, mix.dly ?? 0)
      if (ev.voice === 'kick') kicks.push({ at: start, vel: ev.vel })
    }
  }
  log(`performed in ${((Date.now() - t0) / 1000).toFixed(1)} s`)

  // ─── 3. Effects, side-chain, sum ──────────────────────────────────────────

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
    const hp = new Biquad('highpass', R.reverb.hp, 0.7071)
    hp.run(revSend)
  }
  const [revL, revR] = freeverb(revSend, { room: R.reverb.room, damp: R.reverb.damp, predelayMs: R.reverb.predelayMs })
  new Biquad('lowpass', R.reverb.lp, 0.7071).run(revL)
  new Biquad('lowpass', R.reverb.lp, 0.7071).run(revR)
  const [dlyL, dlyR] = pingPong(dlySend, { delaySec: R.delay.steps * stepSec, feedback: R.delay.feedback })

  const REV_RETURN = R.reverb.ret
  const DLY_RETURN = R.delay.ret
  const DUCK = R.duck

  const loopSlice = (ch) => ch.subarray(PRE, PRE + LOOP)
  const stemLufs = {}
  for (const n of BUS_NAMES) stemLufs[n] = integratedLufs(loopSlice(bus[n][0]), loopSlice(bus[n][1]))
  stemLufs.reverb = integratedLufs(loopSlice(revL).map((x) => x * REV_RETURN), loopSlice(revR).map((x) => x * REV_RETURN))
  stemLufs.delay = integratedLufs(loopSlice(dlyL).map((x) => x * DLY_RETURN), loopSlice(dlyR).map((x) => x * DLY_RETURN))

  const dryBuses = BUS_NAMES.filter((n) => R.buses[n] === 'dry').map((n) => bus[n])
  const bassBuses = BUS_NAMES.filter((n) => R.buses[n] === 'bass').map((n) => bus[n])
  const bedBuses = BUS_NAMES.filter((n) => R.buses[n] === 'bed').map((n) => bus[n])
  const sum = (list, ch, j) => {
    let s = 0
    for (const b of list) s += b[ch][j]
    return s
  }

  const [ML, MR] = stereo()
  for (let j = 0; j < N; j++) {
    const d = duck[j]
    const gBass = 1 - DUCK.bass * d
    const gBed = 1 - DUCK.bed * d
    const gRet = 1 - DUCK.returns * d
    ML[j] = sum(dryBuses, 0, j) + sum(bassBuses, 0, j) * gBass + sum(bedBuses, 0, j) * gBed +
      (revL[j] * REV_RETURN + dlyL[j] * DLY_RETURN) * gRet
    MR[j] = sum(dryBuses, 1, j) + sum(bassBuses, 1, j) * gBass + sum(bedBuses, 1, j) * gBed +
      (revR[j] * REV_RETURN + dlyR[j] * DLY_RETURN) * gRet
  }
  for (const k of Object.keys(bus)) delete bus[k] // free ~250 MB before mastering

  // ─── 4. Master ────────────────────────────────────────────────────────────

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
  const comp = compress(ML, MR, R.compressor)
  const lim = limit(ML, MR, { ceilingDb: -1, lookaheadMs: 5, releaseMs: 90 })

  const glued = integratedLufs(loopSlice(ML), loopSlice(MR))
  {
    const g = dbToGain(R.lufs - glued)
    for (let j = 0; j < N; j++) {
      ML[j] *= g
      MR[j] *= g
    }
  }

  // ─── 5. Seam proof (loops) / clean-ending proof (one-shots) ───────────────

  const outL = ML.slice(PRE, PRE + LOOP)
  const outR = MR.slice(PRE, PRE + LOOP)

  let seamLine = ''
  if (isLoop) {
    let seamDiff = 0
    let seamRef = 1e-9
    const span = POST - Math.round(0.05 * SR) // stay clear of the buffer's far end
    for (let k = 0; k < span; k++) {
      seamDiff = Math.max(seamDiff, Math.abs(ML[PRE + LOOP + k] - ML[PRE + k]), Math.abs(MR[PRE + LOOP + k] - MR[PRE + k]))
      seamRef = Math.max(seamRef, Math.abs(ML[PRE + k]), Math.abs(MR[PRE + k]))
    }
    // The step across the seam, against how big a sample-to-sample step normally is.
    const deltas = new Float32Array(LOOP - 1)
    for (let i = 1; i < LOOP; i++) deltas[i - 1] = Math.max(Math.abs(outL[i] - outL[i - 1]), Math.abs(outR[i] - outR[i - 1]))
    const sortedDeltas = Float32Array.from(deltas).sort()
    const p999 = sortedDeltas[Math.floor(sortedDeltas.length * 0.999)]
    const seamStep = Math.max(Math.abs(outL[0] - outL[LOOP - 1]), Math.abs(outR[0] - outR[LOOP - 1]))
    seamLine = `seam:   next-pass vs loop-start max diff ${fmt(gainToDb(seamDiff / seamRef))} dB re local peak; step across the cut ${seamStep.toExponential(2)} vs 99.9th-pct step ${p999.toExponential(2)}`
  } else {
    // How loud was it just before the insurance fade, and how loud at its peak?
    const fadeN = Math.round(0.06 * SR)
    const probeN = Math.round(0.1 * SR)
    let peak = 1e-12
    for (let i = 0; i < LOOP; i++) peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]))
    let tail = 0
    for (let i = LOOP - fadeN - probeN; i < LOOP - fadeN; i++) tail = Math.max(tail, Math.abs(outL[i]), Math.abs(outR[i]))
    for (let k = 0; k < fadeN; k++) {
      const g = 0.5 - 0.5 * Math.cos((Math.PI * k) / fadeN)
      outL[LOOP - 1 - k] *= g
      outR[LOOP - 1 - k] *= g
    }
    seamLine = `ending: ${LOOP} samples exactly; last 100 ms before the 60 ms fade peak ${fmt(gainToDb(tail / peak))} dB re track peak; first sample ${outL[0].toExponential(1)}; last sample ${outL[LOOP - 1].toExponential(1)}`
  }

  let dcL = 0
  let dcR = 0
  for (let i = 0; i < LOOP; i++) {
    dcL += outL[i]
    dcR += outR[i]
  }

  // ─── 6. Report ────────────────────────────────────────────────────────────

  const finalLufs = integratedLufs(outL, outR)
  const tp = truePeakDb(outL, outR)
  const ref = stemLufs.drums ?? stemLufs[BUS_NAMES[0]]
  log('')
  log(`stems (integrated LUFS, pre-master; LU relative to ${stemLufs.drums != null ? 'drums' : BUS_NAMES[0]}):`)
  for (const [k, v] of Object.entries(stemLufs)) log(`  ${k.padEnd(8)} ${fmt(v).padStart(6)}   ${fmt(v - ref).padStart(6)} LU`)
  log('')
  log('sections (short-term energy of the master):')
  {
    let at = 0
    for (const s of score.SECTIONS) {
      const a = Math.round(at * 16 * stepSec * SR)
      const b = Math.min(LOOP, Math.round((at + s.chords.length) * 16 * stepSec * SR))
      let acc = 0
      for (let i = a; i < b; i++) acc += outL[i] * outL[i] + outR[i] * outR[i]
      const rms = gainToDb(Math.sqrt(acc / (2 * Math.max(1, b - a))))
      const mm = Math.floor((at * 16 * stepSec) / 60)
      const ss = ((at * 16 * stepSec) % 60).toFixed(1).padStart(4, '0')
      log(`  bar ${String(at + 1).padStart(2)}  ${mm}:${ss}  ${s.name.padEnd(10)} ${String(s.chords.length).padStart(2)} bars  RMS ${fmt(rms)} dBFS`)
      at += s.chords.length
    }
  }
  log('')
  log(`master: pre ${fmt(preLufs)} LUFS → nominal ${NOMINAL_LUFS} → comp max ${fmt(comp.maxGrDb)} dB GR (mean ${fmt(comp.meanGrDb, 2)}) → limiter ${lim.samplesOver} samples over, max ${fmt(lim.maxGrDb, 2)} dB → trim to ${R.lufs}`)
  log(`final:  ${fmt(finalLufs)} LUFS integrated, true peak ${fmt(tp)} dBTP, DC ${(dcL / LOOP).toExponential(1)} / ${(dcR / LOOP).toExponential(1)}`)
  log(seamLine)

  // ─── 7. Files ─────────────────────────────────────────────────────────────

  mkdirSync(WORK, { recursive: true })
  const wavPath = join(WORK, `${BASENAME}.wav`)
  writeFileSync(wavPath, wavFloat32(outL, outR))
  log(`wav:    ${wavPath}`)

  if (!flag('no-ogg')) {
    mkdirSync(dirname(OUT_OGG), { recursive: true })
    // `bitexact`: a fixed Ogg stream serial and no encoder tag, so a re-render
    // of an unchanged score is an unchanged file rather than a binary diff.
    ffmpeg(['-y', '-loglevel', 'error', '-i', wavPath, '-c:a', 'libvorbis', '-q:a', String(R.quality),
      '-fflags', '+bitexact', '-flags:a', '+bitexact',
      '-map_metadata', '-1', '-metadata', `title=${score.TITLE}`, '-metadata', 'artist=Bug Crunch', OUT_OGG])
    const size = statSync(OUT_OGG).size
    // Decode it back and count samples: a Vorbis file whose granule positions
    // are wrong decodes long or short, and a loop that is 1 024 samples long
    // clicks on every pass no matter how clean the render was.
    const dec = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', OUT_OGG, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 })
    const decodedSamples = dec.stdout.length / 8
    log(`ogg:    ${OUT_OGG} — ${(size / 1024).toFixed(0)} KB (${fmt((size * 8) / loopSec / 1000, 0)} kb/s), q${R.quality}, decodes to ${decodedSamples} samples (render ${LOOP}${decodedSamples === LOOP ? ', exact' : ', MISMATCH'})`)
  }

  // ─── 8. Analysis (optional) ───────────────────────────────────────────────

  if (flag('analyse')) {
    const png = (name) => join(WORK, name)
    // The pictures are drawn from the DECODED ogg when there is one: that is
    // the file the browser plays, not the render.
    const src = !flag('no-ogg') ? OUT_OGG : wavPath
    // Waveforms are drawn with a display-only gain up to ~-0.5 dBFS: at -28 LUFS
    // the real file is a thin line, and a thin line hides exactly the seam steps
    // and clipped flats these pictures exist to show.
    const show = `volume=${fmt(-tp - 0.5)}dB,`
    const spectrum = `showspectrumpic=s=${isLoop ? 1600 : 1200}x640:mode=combined:color=intensity:scale=log:fscale=lin:legend=1:stop=16000`
    ffmpeg(['-y', '-loglevel', 'error', '-i', src, '-lavfi', spectrum, png(`${BASENAME}-spectrogram.png`)])
    ffmpeg(['-y', '-loglevel', 'error', '-i', src, '-lavfi', `${show}showwavespic=s=1600x480:split_channels=1:filter=peak`, png(`${BASENAME}-waveform.png`)])

    if (isLoop) {
      const seamSec = 2
      const seamN = seamSec * SR
      const seamWav = join(WORK, `${BASENAME}-seam.wav`)
      // The seam is cut out of the DECODED file, so the picture shows what the
      // browser's loop actually joins.
      const decoded = !flag('no-ogg') ? decodeOgg(OUT_OGG) : [outL, outR]
      const [dL, dR] = decoded
      const n = dL.length
      const sL = new Float32Array(2 * seamN)
      const sR = new Float32Array(2 * seamN)
      sL.set(dL.subarray(n - seamN), 0)
      sL.set(dL.subarray(0, seamN), seamN)
      sR.set(dR.subarray(n - seamN), 0)
      sR.set(dR.subarray(0, seamN), seamN)
      writeFileSync(seamWav, wavFloat32(sL, sR))
      const zoomN = Math.round(0.025 * SR)
      const zoomWav = join(WORK, `${BASENAME}-seam-zoom.wav`)
      writeFileSync(zoomWav, wavFloat32(sL.subarray(seamN - zoomN, seamN + zoomN), sR.subarray(seamN - zoomN, seamN + zoomN)))
      ffmpeg(['-y', '-loglevel', 'error', '-i', seamWav, '-lavfi', 'showspectrumpic=s=1200x600:mode=combined:color=intensity:scale=log:fscale=lin:legend=1:stop=16000', png(`${BASENAME}-seam-spectrogram.png`)])
      ffmpeg(['-y', '-loglevel', 'error', '-i', seamWav, '-lavfi', `${show}showwavespic=s=1200x400:split_channels=1:filter=peak`, png(`${BASENAME}-seam-waveform.png`)])
      ffmpeg(['-y', '-loglevel', 'error', '-i', zoomWav, '-lavfi', `${show}showwavespic=s=1000x400:split_channels=1:draw=full`, png(`${BASENAME}-seam-zoom.png`)])
    } else {
      // The two ends of a one-shot: its entrance and its last half second.
      const [dL, dR] = !flag('no-ogg') ? decodeOgg(OUT_OGG) : [outL, outR]
      const edge = Math.round(0.5 * SR)
      const endWav = join(WORK, `${BASENAME}-ending.wav`)
      writeFileSync(endWav, wavFloat32(dL.subarray(dL.length - edge), dR.subarray(dR.length - edge)))
      ffmpeg(['-y', '-loglevel', 'error', '-i', endWav, '-lavfi', `${show}showwavespic=s=1000x400:split_channels=1:draw=full`, png(`${BASENAME}-ending.png`)])
    }

    const loud = (label, args) => {
      // Only the Summary block — the per-frame lines above it carry an `I:` too.
      const all = ffmpeg(args)
      const err = all.slice(all.lastIndexOf('Summary:'))
      const I = /I:\s+(-?[\d.]+) LUFS/.exec(err)?.[1]
      const LRA = /LRA:\s+(-?[\d.]+) LU/.exec(err)?.[1]
      const TP = /Peak:\s+(-?[\d.inf]+) dBFS/.exec(err)?.[1]
      const S = [...all.matchAll(/ S:\s*(-?[\d.]+)/g)].map((m) => Number(m[1])).filter((x) => x > -100)
      log(`  ${label.padEnd(26)} I ${I} LUFS  LRA ${LRA} LU  TP ${TP} dBTP${S.length ? `  S max ${fmt(Math.max(...S))}` : ''}`)
    }
    log('')
    log('ffmpeg ebur128:')
    loud('render (wav)', ['-i', wavPath, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    if (!flag('no-ogg')) {
      loud('ogg', ['-i', OUT_OGG, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
      if (isLoop) {
        // x1.16 two ways: tape speed (pitch up) and pitch-preserving time
        // stretch (what a media element does by default). One-shots play on
        // Web Audio at x1 and never meet the chain's rate.
        loud('ogg x1.16 tape', ['-i', OUT_OGG, '-af', `asetrate=${Math.round(SR * 1.16)},aresample=${SR},ebur128=peak=true`, '-f', 'null', '-'])
        loud('ogg x1.16 stretch', ['-i', OUT_OGG, '-af', 'atempo=1.16,ebur128=peak=true', '-f', 'null', '-'])
        ffmpeg(['-y', '-loglevel', 'error', '-i', OUT_OGG, '-lavfi', `atempo=1.16,${spectrum}`, png(`${BASENAME}-x116-stretch-spectrogram.png`)])
      }
    }
    const stats = ffmpeg(['-i', src, '-af', 'astats=measure_perchannel=none', '-f', 'null', '-'])
    log('ffmpeg astats:')
    for (const line of stats.split('\n')) if (/DC offset|Peak level dB|RMS level dB|Flat factor|Peak count|Crest/.test(line)) log(`  ${line.replace(/^\[.*?\]\s*/, '')}`)
    log(`pictures in ${WORK}`)
  }

  log(`${id} done in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
}

/** Decode an ogg back to two float channels at SR. */
const decodeOgg = (file) => {
  const dec = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 30 })
  // Copied, not viewed: a Buffer's byteOffset need not be float-aligned.
  const all = new Float32Array(new Uint8Array(dec.stdout).buffer)
  const n = all.length / 2
  const L = new Float32Array(n)
  const Rr = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    L[i] = all[2 * i]
    Rr[i] = all[2 * i + 1]
  }
  return [L, Rr]
}

for (const id of WANTED) await renderTrack(id)
log('')
log(`all done in ${((Date.now() - t00) / 1000).toFixed(1)} s`)
