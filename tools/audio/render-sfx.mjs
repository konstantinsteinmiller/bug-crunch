#!/usr/bin/env node
/**
 * Render the whole crush bank to WAVs — and pictures of them — for auditioning.
 *
 *   pnpm audio:render                          # every body × style, into <tmp>/bug-crunch-sfx
 *   pnpm audio:render -- --out ./my-sfx        # somewhere else
 *   pnpm audio:render -- --only beetle,robobug --styles ooze
 *   pnpm audio:render -- --png                 # + spectrogram/waveform PNGs (needs ffmpeg)
 *
 * What lands in `--out`:
 *
 *   <style>/<body>-crush.wav, -crush-heavy.wav, -hurt(-heavy).wav, -clang.wav
 *                            variant 0 of every kind the body can produce in play
 *   <style>/<body>-variants.wav   every light variant, then every heavy one, spaced
 *   <style>/<body>-rapid.wav      six kills in 1.2 s, with the runtime's own variant
 *                                 rotation and rate/gain jitter — the machine-gun test
 *   catalogue-<style>.wav    every body's light + heavy crush in bestiary order at
 *                            the RUNTIME gain (`CRUSH_MIX`), for loudness checks
 *   reference/legacy-*.wav   the old live-synth squish/hurt/clang/podPop/bossHit
 *                            and the `stompHeavy` slam, at their own mix gains
 *   report.txt / report.json per-render features and the loudness comparison
 *   png/…                    with --png: a spectrogram over a waveform per file,
 *                            and one per catalogue — distinctness at a glance
 *
 * Runs the game's own pure module through the `--import` hook (the pnpm script
 * does): node --import ./tools/ts-resolve.mjs tools/audio/render-sfx.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  legacyBossHit, legacyClang, legacyHurt, legacyPodPop, legacySquish, legacyStompHeavy
} from './legacySynth.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const load = (rel) => import(pathToFileURL(join(ROOT, 'src', ...rel.split('/'))).href)
const synth = await load('game/audio/crushSynth.ts')
const { audioFeatures, featureDistance } = await load('game/audio/audioFeatures.ts')

// ─── Args ───────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const OUT = resolve(arg('out', join(tmpdir(), 'bug-crunch-sfx')))
const RATE = Number(arg('rate', synth.CRUSH_RENDER_RATE))
const ONLY = arg('only', '') ? arg('only', '').split(',') : null
const STYLES = arg('styles', 'ooze,confetti,bubble').split(',')
const PNG = argv.includes('--png')

const subjects = synth.CRUSH_SUBJECTS.filter((s) => !ONLY || ONLY.includes(s))

// ─── WAV ────────────────────────────────────────────────────────────────────

/** 16-bit PCM mono with TPDF dither — what any player and ffmpeg read. */
const writeWav = (file, samples, sr) => {
  mkdirSync(dirname(file), { recursive: true })
  const n = samples.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sr, 24)
  buf.writeUInt32LE(sr * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    const d = (Math.random() - Math.random()) / 32768
    const v = Math.max(-1, Math.min(1, samples[i] + d))
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  writeFileSync(file, buf)
}

const concat = (parts, gapS, sr) => {
  const gap = Math.round(gapS * sr)
  const len = parts.reduce((a, p) => a + p.length + gap, gap)
  const out = new Float32Array(len)
  let at = gap
  for (const p of parts) { out.set(p, at); at += p.length + gap }
  return out
}

/** Linear-interpolated resample — what a BufferSource at playbackRate r does. */
const atRate = (x, rate) => {
  const n = Math.floor(x.length / rate)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * rate
    const j = Math.floor(p)
    const f = p - j
    out[i] = (x[j] ?? 0) * (1 - f) + (x[j + 1] ?? 0) * f
  }
  return out
}

const db = (v) => (v > 0 ? 20 * Math.log10(v) : -120)
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : String(v))

// ─── ffmpeg ─────────────────────────────────────────────────────────────────

const ffmpegBin = (() => {
  try {
    const req = createRequire(join(ROOT, 'package.json'))
    const p = req('ffmpeg-static')
    if (p && existsSync(p)) return p
  } catch { /* fall through to PATH */ }
  return 'ffmpeg'
})()

const picture = (wav, png, { width = 900, height = 300, legend = false } = {}) => {
  mkdirSync(dirname(png), { recursive: true })
  // 0–8 kHz, linear, 70 dB of range: where a phone speaker lives, and deep
  // enough to see the body without the inaudible tails looking important. The
  // per-file pictures carry a grid line every 1 kHz instead of a legend, so the
  // waveform underneath lines up with the spectrogram sample for sample.
  const top = Math.min(8000, RATE / 2)
  const spec = `showspectrumpic=s=${width}x${height}:legend=${legend ? 1 : 0}:scale=log:fscale=lin:drange=70:stop=${top}:color=intensity`
  const filter = legend
    ? `[0:a]${spec}[s]`
    : `[0:a]${spec},drawgrid=w=iw:h=ih*1000/${top}:t=1:c=white@0.18[g];` +
      `[0:a]showwavespic=s=${width}x110:colors=0x7fd6ff:scale=lin[w];[g][w]vstack[s]`
  const r = spawnSync(ffmpegBin, ['-v', 'error', '-y', '-i', wav, '-filter_complex', filter, '-map', '[s]', '-frames:v', '1', png], { encoding: 'utf8' })
  if (r.status !== 0) console.warn(`[audio] ffmpeg failed on ${wav}: ${r.stderr?.slice(0, 300)}`)
}

// ─── Render ─────────────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true })
const rows = []
const renders = new Map()
let renderMs = 0
let renderCount = 0

const render = (subject, kind, style, variant, heavy) => {
  const t0 = performance.now()
  const x = synth.renderCrush({ subject, kind, style, variant, heavy, sampleRate: RATE })
  renderMs += performance.now() - t0
  renderCount++
  return x
}

const heavyKinds = (subject, kind) => {
  const flags = new Set([false, true].map((h) => synth.canonicalHeavy(subject, kind, h)))
  return [...flags]
}

for (const style of STYLES) {
  const catalogue = []
  for (const subject of subjects) {
    const kinds = synth.isBossSubject(subject) ? synth.CRUSH_KINDS : synth.crushKindsFor(subject)
    for (const kind of kinds) {
      for (const heavy of heavyKinds(subject, kind)) {
        const x = render(subject, kind, style, 0, heavy)
        const name = `${subject}-${kind}${heavy && !synth.isBossSubject(subject) && subject !== 'pod' ? '-heavy' : ''}`
        const file = join(OUT, style, `${name}.wav`)
        writeWav(file, x, RATE)
        renders.set(`${style}/${name}`, x)
        const f = audioFeatures(x, RATE)
        const mixDb = f.phoneDb + db(synth.CRUSH_MIX[kind])
        rows.push({ style, subject, kind, heavy, name, file, ...f, mixDb })
        if (kind === 'crush') catalogue.push(x.map((v) => v * synth.CRUSH_MIX.crush))
        if (PNG) picture(file, join(OUT, 'png', style, `${name}.png`))
      }
    }

    // Every variant of the everyday crush, then the heavy ones.
    const light = Array.from({ length: synth.crushVariants(subject, 'crush', false) }, (_, v) => render(subject, 'crush', style, v, false))
    const heavyN = synth.canonicalHeavy(subject, 'crush', true) ? synth.crushVariants(subject, 'crush', true) : 0
    const heavy = Array.from({ length: heavyN }, (_, v) => render(subject, 'crush', style, v, true))
    writeWav(join(OUT, style, `${subject}-variants.wav`), concat([...light, ...heavy], 0.25, RATE), RATE)

    // Six kills in 1.2 s, the way the runtime plays them: no variant twice in a
    // row, ±`CRUSH_JITTER` playback rate, ±10 % gain.
    const pool = light.length ? light : heavy
    const rapid = new Float32Array(Math.round(RATE * 2))
    let last = -1
    for (let k = 0; k < 6; k++) {
      let v = Math.floor(Math.random() * pool.length)
      if (pool.length > 1 && v === last) v = (v + 1) % pool.length
      last = v
      const r = 1 + synth.CRUSH_JITTER.crush * (Math.random() * 2 - 1)
      const g = 0.62 * (0.9 + Math.random() * 0.2)
      const shot = atRate(pool[v], r)
      const at = Math.round(k * 0.2 * RATE)
      for (let i = 0; i < shot.length && at + i < rapid.length; i++) rapid[at + i] += shot[i] * g
    }
    for (let i = 0; i < rapid.length; i++) rapid[i] = Math.max(-0.98, Math.min(0.98, rapid[i]))
    const rapidFile = join(OUT, style, `${subject}-rapid.wav`)
    writeWav(rapidFile, rapid, RATE)
    if (PNG) picture(rapidFile, join(OUT, 'png', style, `${subject}-rapid.png`), { width: 1200 })
  }
  const catFile = join(OUT, `catalogue-${style}.wav`)
  writeWav(catFile, concat(catalogue, 0.3, RATE), RATE)
  if (PNG) picture(catFile, join(OUT, 'png', `catalogue-${style}.png`), { width: 2400, height: 520, legend: true })
}

// ─── The old mix, for reference ─────────────────────────────────────────────

const legacy = {
  'legacy-squish-ant': legacySquish(RATE, { size: 3.2 }),
  'legacy-squish-beetle': legacySquish(RATE, { size: 4.8, debris: true }),
  'legacy-squish-beetle-heavy': legacySquish(RATE, { size: 4.8, debris: true, heavy: true }),
  'legacy-stompHeavy': legacyStompHeavy(RATE),
  'legacy-hurt': legacyHurt(RATE),
  'legacy-clang': legacyClang(RATE),
  'legacy-podPop': legacyPodPop(RATE),
  'legacy-bossHit': legacyBossHit(RATE)
}
const legacyRows = []
for (const [name, x] of Object.entries(legacy)) {
  const file = join(OUT, 'reference', `${name}.wav`)
  writeWav(file, x, RATE)
  const f = audioFeatures(x, RATE)
  legacyRows.push({ name, file, ...f, mixDb: f.phoneDb })
  if (PNG) picture(file, join(OUT, 'png', 'reference', `${name}.png`))
}
writeWav(join(OUT, 'reference', 'legacy-catalogue.wav'), concat(Object.values(legacy), 0.3, RATE), RATE)

// ─── Report ─────────────────────────────────────────────────────────────────

const ref = Object.fromEntries(legacyRows.map((r) => [r.name, r]))
const lines = []
lines.push(`Bug Crunch crush bank — ${new Date().toISOString()}`)
lines.push(`rate ${RATE} Hz · ${renderCount} renders · ${fmt(renderMs / renderCount, 2)} ms average`)
lines.push('')
lines.push('Loudness is PHONE-weighted (max 50 ms, >150 Hz, +4 dB shelf over 1.7 kHz), dBFS.')
lines.push('"mix" is at the runtime gain (CRUSH_MIX), before the player\'s slider — compare')
lines.push('against the legacy cues, which are at their own vol() gains:')
for (const r of legacyRows) lines.push(`  ${r.name.padEnd(28)} mix ${fmt(r.mixDb).padStart(6)}  peak ${fmt(db(r.peak)).padStart(6)}  dur ${fmt(r.durationMs, 0).padStart(4)} ms`)
lines.push('')
lines.push(
  ['style', 'body', 'kind', 'dur', 'peak', 'dc', 'mix', 'Δstomp', 'centroid', 'hi>3k', 'lo<600', 'trans/100ms', 'envC']
    .map((h, i) => (i < 3 ? h.padEnd(i === 1 ? 12 : 9) : h.padStart(9))).join('')
)
for (const r of rows) {
  lines.push([
    r.style.padEnd(9), r.subject.padEnd(12), `${r.kind}${r.heavy ? '+H' : ''}`.padEnd(9),
    `${fmt(r.durationMs, 0)}ms`.padStart(9), fmt(db(r.peak)).padStart(9), r.dc.toExponential(0).padStart(9),
    fmt(r.mixDb).padStart(9), fmt(r.mixDb - ref['legacy-stompHeavy'].mixDb).padStart(9),
    `${fmt(r.centroidHz, 0)}`.padStart(9), fmt(r.hiShare, 2).padStart(9), fmt(r.loShare, 2).padStart(9),
    fmt(r.transients, 1).padStart(9), `${fmt(r.envCentroidMs, 0)}`.padStart(9)
  ].join(''))
}

// Closest pair per style among the everyday crushes — the distinctness floor.
lines.push('')
for (const style of STYLES) {
  const crushes = rows.filter((r) => r.style === style && r.kind === 'crush' && !r.heavy && !synth.isBossSubject(r.subject))
  let best = { d: Infinity, a: '', b: '' }
  for (let i = 0; i < crushes.length; i++) {
    for (let j = i + 1; j < crushes.length; j++) {
      const d = featureDistance(crushes[i], crushes[j])
      if (d < best.d) best = { d, a: crushes[i].subject, b: crushes[j].subject }
    }
  }
  lines.push(`closest pair (${style}): ${best.a} ~ ${best.b}  distance ${fmt(best.d, 2)}`)
}

// ─── Contact sheets ─────────────────────────────────────────────────────────
//
// One labelled grid per style and kind, so "is every body visibly different"
// is one picture rather than forty. Each tile keeps its own time axis (a flea is
// 90 ms, a robobug 400), which is what you want for shape; the durations are
// written on the label so nobody mistakes a stretched flea for a long sound.
if (PNG) {
  let sharp = null
  try { sharp = createRequire(join(ROOT, 'package.json'))('sharp') } catch { /* optional */ }
  if (sharp) {
    const TW = 450
    const TH = 205
    const COLS = 4
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const sheet = async (file, tiles) => {
      if (tiles.length === 0) return
      const rowsN = Math.ceil(tiles.length / COLS)
      const composites = []
      for (let i = 0; i < tiles.length; i++) {
        const { png, label } = tiles[i]
        if (!existsSync(png)) continue
        const left = (i % COLS) * TW
        const top = Math.floor(i / COLS) * TH
        composites.push({ input: await sharp(png).resize(TW - 4, TH - 4, { fit: 'fill' }).toBuffer(), left: left + 2, top: top + 2 })
        const svg = `<svg width="${TW}" height="22"><rect width="100%" height="22" fill="black" fill-opacity="0.6"/><text x="6" y="16" font-family="sans-serif" font-size="14" fill="#ffe27a">${esc(label)}</text></svg>`
        composites.push({ input: Buffer.from(svg), left, top })
      }
      await sharp({ create: { width: COLS * TW, height: rowsN * TH, channels: 3, background: '#111' } })
        .composite(composites).png().toFile(file)
    }
    for (const style of STYLES) {
      for (const group of [['crush'], ['hurt', 'clang']]) {
        const tiles = rows
          .filter((r) => r.style === style && group.includes(r.kind))
          .map((r) => ({
            png: join(OUT, 'png', style, `${r.name}.png`),
            label: `${r.subject} ${r.kind}${r.heavy && !synth.isBossSubject(r.subject) ? ' HEAVY' : ''} · ${fmt(r.durationMs, 0)} ms`
          }))
        await sheet(join(OUT, 'png', `sheet-${style}-${group.join('-')}.png`), tiles)
      }
    }
  }
}

const text = lines.join('\n')
writeFileSync(join(OUT, 'report.txt'), text)
writeFileSync(join(OUT, 'report.json'), JSON.stringify({ rate: RATE, legacy: legacyRows, renders: rows }, null, 2))
console.log(text)
console.log(`\n[audio] wrote ${OUT}`)
