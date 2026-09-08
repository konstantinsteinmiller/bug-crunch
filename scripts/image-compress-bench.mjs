#!/usr/bin/env node
/**
 * image-compress-bench — A/B every npm image codec × setting on your own
 * images and score size against quality, so compress-images.mjs' defaults are
 * a measurement, not a guess.
 *
 *   pnpm compress-bench <file|dir>... [--pairs <origDir>,<refDir>] [--out <report.md>] [--json <file>] [--only <substr>]
 *
 *   <file|dir>       sample images (png / jpg / webp); dirs are walked
 *   --pairs A,B      "reference" set: A holds originals, B the same relative
 *                    paths as compressed by the tool you want to beat (TinyPNG
 *                    downloads, an old pipeline …). Every candidate is then also
 *                    reported relative to that tool's output.
 *   --out            markdown report path (default: prints to stdout)
 *   --json           raw per-file results
 *   --only           run only inputs whose path contains this string
 *   --parallel N     files benchmarked at once (default 4; the ms column is
 *                    then under N-way load — compare rows, not machines)
 *
 * Codecs: sharp is required. @napi-rs/image and @jsquash/{oxipng,webp,jpeg}
 * are picked up when installed (pnpm add -D @napi-rs/image @jsquash/oxipng
 * @jsquash/webp @jsquash/jpeg) and skipped with a note when not.
 *
 * Quality metric: SSIM (ssim.js) and PSNR on RGB after compositing over
 * mid-grey, so alpha changes count and RGB garbage under alpha=0 does not.
 * A transparent PNG scored without compositing looks far worse than it is.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, extname, basename, dirname, relative, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import { ssim } from 'ssim.js'

const require = createRequire(import.meta.url)
const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: { pairs: { type: 'string', multiple: true }, out: { type: 'string' }, json: { type: 'string' }, only: { type: 'string' }, parallel: { type: 'string' }, help: { type: 'boolean' } },
})
if (opt.help || (!positionals.length && !opt.pairs)) {
  console.log('usage: image-compress-bench <file|dir>... [--pairs origDir,refDir] [--out report.md] [--json results.json] [--only substr] [--parallel 4]')
  process.exit(opt.help ? 0 : 1)
}

// ---- optional codecs ------------------------------------------------------
const notes = []
let napi = null
try { napi = await import('@napi-rs/image') } catch { notes.push('@napi-rs/image not installed — napi candidates skipped') }

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData { constructor(data, width, height) { this.data = data; this.width = width; this.height = height } }
}
async function loadWasm(pkg, rel) {
  return WebAssembly.compile(readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), rel)))
}
const js = { oxipng: null, webp: null, jpeg: null }
for (const [key, pkg, entry, wasm] of [
  ['oxipng', '@jsquash/oxipng', '@jsquash/oxipng/optimise.js', 'codec/pkg/squoosh_oxipng_bg.wasm'],
  ['webp', '@jsquash/webp', '@jsquash/webp/encode.js', 'codec/enc/webp_enc_simd.wasm'],
  ['jpeg', '@jsquash/jpeg', '@jsquash/jpeg/encode.js', 'codec/enc/mozjpeg_enc.wasm'],
]) {
  try {
    const mod = await import(entry)
    await mod.init(await loadWasm(pkg, wasm))
    js[key] = mod.default
  } catch (e) { notes.push(`${pkg} not usable (${String(e.message ?? e).slice(0, 60)}) — skipped`) }
}

// ---- metrics ---------------------------------------------------------------
async function decodeRGBA(buf) {
  const { data, info } = await sharp(buf, { failOn: 'none' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}
function compositeGrey(img) {
  const n = img.width * img.height, out = new Uint8ClampedArray(n * 4), d = img.data
  for (let i = 0; i < n * 4; i += 4) {
    const a = d[i + 3] / 255, g = 128 * (1 - a)
    out[i] = d[i] * a + g; out[i + 1] = d[i + 1] * a + g; out[i + 2] = d[i + 2] * a + g; out[i + 3] = 255
  }
  return { data: out, width: img.width, height: img.height }
}
function psnr(a, b) {
  let se = 0
  const n = a.width * a.height
  for (let i = 0; i < n * 4; i += 4) for (let c = 0; c < 3; c++) { const d = a.data[i + c] - b.data[i + c]; se += d * d }
  const mse = se / (n * 3)
  return mse === 0 ? 99 : 10 * Math.log10(255 * 255 / mse)
}
async function score(refGrey, outBuf) {
  const out = compositeGrey(await decodeRGBA(outBuf))
  if (out.width !== refGrey.width || out.height !== refGrey.height) return { ssim: 0, psnr: 0 }
  return { ssim: ssim(refGrey, out).mssim, psnr: psnr(refGrey, out) }
}

// ---- candidates ------------------------------------------------------------
const C = []
const add = (fmt, name, run, available = true) => { if (available) C.push({ fmt, name, run }) }
const raw = (b) => decodeRGBA(b)

// PNG
add('png', 'sharp lossless c9 adaptive', (b) => sharp(b).png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer())
for (const q of [60, 70, 80, 90]) add('png', `sharp palette q${q} e10`, (b) => sharp(b).png({ palette: true, quality: q, effort: 10, dither: 1.0, compressionLevel: 9 }).toBuffer())
add('png', 'sharp palette q80 e7', (b) => sharp(b).png({ palette: true, quality: 80, effort: 7, dither: 1.0, compressionLevel: 9 }).toBuffer())
add('png', 'napi oxipng (lossless)', (b) => napi.losslessCompressPng(b, {}), !!napi)
add('png', 'jsquash oxipng L4 (lossless)', async (b) => Buffer.from(await js.oxipng(b, { level: 4, optimiseAlpha: true })), !!js.oxipng)
for (const [lo, hi] of [[50, 85], [65, 90], [70, 99]]) add('png', `napi quant ${lo}-${hi} s1`, (b) => napi.pngQuantize(b, { minQuality: lo, maxQuality: hi, speed: 1 }), !!napi)
add('png', 'napi quant 65-90 s4', (b) => napi.pngQuantize(b, { minQuality: 65, maxQuality: 90, speed: 4 }), !!napi)
add('png', 'napi quant 65-90 s1 + napi oxipng', async (b) => napi.losslessCompressPng(await napi.pngQuantize(b, { minQuality: 65, maxQuality: 90, speed: 1 }), {}), !!napi)
add('png', 'sharp palette q80 + napi oxipng', async (b) => napi.losslessCompressPng(await sharp(b).png({ palette: true, quality: 80, effort: 10, dither: 1.0 }).toBuffer(), {}), !!napi)

// JPEG
for (const q of [70, 75, 80, 85, 90]) add('jpeg', `sharp mozjpeg q${q}`, (b) => sharp(b).jpeg({ mozjpeg: true, quality: q }).toBuffer())
add('jpeg', 'sharp mozjpeg q80 444', (b) => sharp(b).jpeg({ mozjpeg: true, quality: 80, chromaSubsampling: '4:4:4' }).toBuffer())
add('jpeg', 'sharp libjpeg q80 prog', (b) => sharp(b).jpeg({ mozjpeg: false, quality: 80, progressive: true, optimiseCoding: true }).toBuffer())
for (const q of [75, 80, 85]) add('jpeg', `napi mozjpeg q${q}`, (b) => napi.compressJpeg(b, { quality: q }), !!napi)
add('jpeg', 'jsquash mozjpeg q80', async (b) => Buffer.from(await js.jpeg(await raw(b), { quality: 80 })), !!js.jpeg)

// WEBP — effort 5 throughout: effort 6 costs ~20x the time for ~3% (one row
// keeps it for reference; TinyPNG's webp output matches "q75 e6").
for (const q of [70, 75, 80, 85, 90]) add('webp', `sharp q${q} e5 smart`, (b) => sharp(b).webp({ quality: q, effort: 5, smartSubsample: true }).toBuffer())
add('webp', 'sharp q75 e6 smart', (b) => sharp(b).webp({ quality: 75, effort: 6, smartSubsample: true }).toBuffer())
add('webp', 'sharp q80 e5 plain', (b) => sharp(b).webp({ quality: 80, effort: 5, smartSubsample: false }).toBuffer())
add('webp', 'sharp q80 e4 smart', (b) => sharp(b).webp({ quality: 80, effort: 4, smartSubsample: true }).toBuffer())
add('webp', 'sharp q80 e5 smart alpha80', (b) => sharp(b).webp({ quality: 80, effort: 5, smartSubsample: true, alphaQuality: 80 }).toBuffer())
add('webp', 'sharp q80 e5 smart drawing', (b) => sharp(b).webp({ quality: 80, effort: 5, smartSubsample: true, preset: 'drawing' }).toBuffer())
add('webp', 'sharp nearLossless q60', (b) => sharp(b).webp({ nearLossless: true, quality: 60, effort: 6 }).toBuffer())
add('webp', 'sharp lossless e6', (b) => sharp(b).webp({ lossless: true, effort: 6 }).toBuffer())
for (const q of [75, 80, 85]) add('webp', `napi webp q${q}`, (b) => new napi.Transformer(b).webp(q), !!napi)
add('webp', 'jsquash webp q80 m6', async (b) => Buffer.from(await js.webp(await raw(b), { quality: 80, method: 6 })), !!js.webp)
add('webp', 'jsquash webp q80 m6 sharpYUV', async (b) => Buffer.from(await js.webp(await raw(b), { quality: 80, method: 6, use_sharp_yuv: 1 })), !!js.webp)

// ---- inputs ----------------------------------------------------------------
const fmtOf = (f) => ({ '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp' })[extname(f).toLowerCase()]
function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (fmtOf(f)) yield full
  }
}
const inputs = []
for (const p of positionals) {
  const full = resolve(p)
  if (statSync(full).isDirectory()) for (const f of walk(full)) inputs.push({ set: 'samples', id: relative(full, f), file: f, fmt: fmtOf(f) })
  else if (fmtOf(full)) inputs.push({ set: 'samples', id: basename(full), file: full, fmt: fmtOf(full) })
}
if (opt.pairs) {
  const [a, b] = opt.pairs.length >= 2 ? opt.pairs : opt.pairs[0].split(/[,;]/)
  if (!a || !b) { console.error('--pairs needs two directories: --pairs origDir,refDir'); process.exit(1) }
  const origDir = resolve(a), refDir = resolve(b)
  for (const f of walk(origDir)) {
    const rel = relative(origDir, f), ref = join(refDir, rel)
    if (existsSync(ref)) inputs.push({ set: 'pairs', id: rel.replaceAll('\\', '/'), file: f, ref, fmt: fmtOf(f) })
  }
}
const sel = inputs.filter((i) => !opt.only || i.id.includes(opt.only))
if (!sel.length) { console.error('no inputs'); process.exit(1) }

// ---- run -------------------------------------------------------------------
// Files run in parallel (encodes are single-threaded); the JSON is rewritten
// after every file so a crash or Ctrl-C keeps what was measured; an input
// that vanished or cannot be decoded is skipped, not fatal.
const parallel = Number(opt.parallel ?? 4)
console.error(`sharp/libvips ${sharp.versions.vips}; ${C.length} candidates; ${sel.length} inputs; ${parallel} in parallel${notes.length ? '\n' + notes.join('\n') : ''}`)
const results = []
async function bench(inp) {
  const buf = readFileSync(inp.file)
  const refImg = await decodeRGBA(buf)
  const refGrey = compositeGrey(refImg)
  const row = { set: inp.set, id: inp.id, fmt: inp.fmt, width: refImg.width, height: refImg.height, origBytes: buf.length, out: [] }
  if (inp.ref) {
    const rb = readFileSync(inp.ref)
    row.refBytes = rb.length
    row.out.push({ name: 'reference tool', bytes: rb.length, ms: 0, ...(await score(refGrey, rb)) })
  }
  for (const c of C.filter((c) => c.fmt === inp.fmt)) {
    const t0 = performance.now()
    try {
      const out = await c.run(buf)
      const ms = performance.now() - t0
      row.out.push({ name: c.name, bytes: out.length, ms, ...(await score(refGrey, out)) })
    } catch (e) { row.out.push({ name: c.name, error: String(e?.message ?? e).slice(0, 100) }) }
  }
  const best = row.out.filter((o) => !o.error).sort((a, b) => a.bytes - b.bytes)[0]
  console.error(`${inp.set}/${inp.id} ${row.width}x${row.height} ${(buf.length / 1024).toFixed(0)} KB → smallest ${best?.name} ${(best?.bytes / 1024).toFixed(1)} KB ssim ${best?.ssim?.toFixed(4)}`)
  return row
}
let next = 0
await Promise.all(Array.from({ length: Math.max(1, parallel) }, async () => {
  while (next < sel.length) {
    const inp = sel[next++]
    try {
      results.push(await bench(inp))
    } catch (e) {
      notes.push(`${inp.set}/${inp.id}: skipped (${String(e?.message ?? e).slice(0, 80)})`)
      console.error(notes.at(-1))
    }
    if (opt.json) writeFileSync(opt.json, JSON.stringify({ notes, results }, null, 1))
  }
}))
results.sort((a, b) => sel.findIndex((i) => i.id === a.id) - sel.findIndex((i) => i.id === b.id))

// ---- report ----------------------------------------------------------------
const kb = (n) => (n / 1024).toFixed(1)
const pct = (a, b) => ((a / b - 1) * 100).toFixed(1) + '%'
let md = `# Image compression benchmark\n\n_${new Date().toISOString().slice(0, 10)} · sharp/libvips ${sharp.versions.vips} · ${sel.length} inputs_\n${notes.map((n) => `\n> ${n}`).join('')}\n`
for (const row of results.filter((r) => r.set === 'samples')) {
  md += `\n## ${row.id} (${row.fmt}, ${row.width}x${row.height}, ${kb(row.origBytes)} KB)\n\n| candidate | KB | vs original | SSIM | PSNR | ms |\n|---|---:|---:|---:|---:|---:|\n`
  for (const o of [...row.out].sort((a, b) => (a.bytes ?? 1e12) - (b.bytes ?? 1e12))) {
    md += o.error ? `| ${o.name} | — | ${o.error} | | | |\n` : `| ${o.name} | ${kb(o.bytes)} | ${pct(o.bytes, row.origBytes)} | ${o.ssim.toFixed(4)} | ${o.psnr.toFixed(2)} | ${o.ms.toFixed(0)} |\n`
  }
}
for (const fmt of ['png', 'jpeg', 'webp']) {
  const rows = results.filter((r) => r.set === 'pairs' && r.fmt === fmt)
  if (!rows.length) continue
  const names = [...new Set(rows.flatMap((r) => r.out.map((o) => o.name)))]
  const origTotal = rows.reduce((s, r) => s + r.origBytes, 0), refTotal = rows.reduce((s, r) => s + r.refBytes, 0)
  md += `\n## Reference pairs — ${fmt} (${rows.length} files, ${kb(origTotal)} KB original, reference tool ${kb(refTotal)} KB)\n\n| candidate | total KB | vs original | vs reference | files ≤ ref | mean SSIM | min SSIM | mean PSNR | total ms |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|\n`
  const agg = names.map((name) => {
    const xs = rows.map((r) => ({ r, o: r.out.find((o) => o.name === name) })).filter((x) => x.o && !x.o.error)
    if (!xs.length) return { name, error: rows[0].out.find((o) => o.name === name)?.error ?? 'n/a' }
    const total = xs.reduce((s, x) => s + x.o.bytes, 0)
    return { name, total, n: xs.length, leq: xs.filter((x) => x.o.bytes <= x.r.refBytes).length, ssim: xs.reduce((s, x) => s + x.o.ssim, 0) / xs.length, minSsim: Math.min(...xs.map((x) => x.o.ssim)), psnr: xs.reduce((s, x) => s + x.o.psnr, 0) / xs.length, ms: xs.reduce((s, x) => s + x.o.ms, 0) }
  }).sort((a, b) => (a.total ?? 1e12) - (b.total ?? 1e12))
  for (const a of agg) {
    md += a.error ? `| ${a.name} | — | ${a.error} | | | | | | |\n` : `| ${a.name} | ${kb(a.total)} | ${pct(a.total, origTotal)} | ${pct(a.total, refTotal)} | ${a.leq}/${a.n} | ${a.ssim.toFixed(4)} | ${a.minSsim.toFixed(4)} | ${a.psnr.toFixed(2)} | ${a.ms.toFixed(0)} |\n`
  }
}
if (opt.out) { writeFileSync(opt.out, md); console.error(`report: ${opt.out}`) } else console.log(md)
