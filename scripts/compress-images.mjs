#!/usr/bin/env node
/**
 * compress-images — TinyPNG-style "smart lossy" compression for a folder tree,
 * done locally with npm packages only (no API key, no system binaries).
 *
 *   pnpm compress-folder <dir> [options]
 *   npm run compress-folder -- <dir> [options]     (npm needs the "--"; without
 *                                                   it npm eats every --flag)
 *
 *   --dry-run            plan and measure, write nothing
 *   --force              re-compress files that already have a backup (the
 *                        backup is used as the pristine source, so re-runs
 *                        never stack generation loss)
 *   --no-backup          overwrite in place without keeping <name>-original.<ext>
 *   --backup-dir <dir>   put backups under <dir>/<relative path> instead of next
 *                        to the file (use this for public/ trees — Vite copies
 *                        public/ verbatim, so a sibling backup would ship)
 *   --ext png,jpg,webp   which extensions to touch (default: png,jpg,jpeg,webp)
 *   --min-ssim <0..1>    quality floors (defaults: see CONFIG); the search
 *   --min-psnr <dB>      finds the smallest encode that clears ALL of them
 *   --max-alpha-err <n>  (SSIM, PSNR, mean alpha error on soft edges)
 *   --quality <n>        starting quality for every format (search goes down
 *                        from here while the floors hold, up until they do)
 *   --png-quality <n>    / --jpeg-quality <n> / --webp-quality <n>
 *   --min-quality <n>    / --max-quality <n>  bounds of that search
 *   --concurrency <n>    parallel files (default: half the cores, max 8)
 *   --max-effort         webp: one extra encode at libwebp effort 6 for the
 *                        chosen quality (~3% smaller, ~20x slower per encode)
 *   --only <files>       compress just these files (comma-separated, or the
 *                        flag repeated) instead of walking <dir>; they must
 *                        sit under <dir>, which still decides the backup path
 *   --fresh              the files on disk are NEW originals (a re-slice just
 *                        wrote them): retire any backup they have instead of
 *                        compressing from it — see processFile
 *   --json <file>        write the per-file report as JSON
 *   --quiet              only print the summary
 *
 * WHAT IT DOES PER FORMAT (picked by scripts/image-compress-bench.mjs — see
 * IMAGE-COMPRESSION-BENCH.md for the numbers behind the defaults)
 *
 *   png   lossy: libimagequant palette quantisation (the same algorithm family
 *         TinyPNG uses) via sharp, dithered, max effort, then an oxipng
 *         lossless re-pack via @napi-rs/image (6-17% smaller, pixels
 *         untouched). If no quality in the search window clears the floors,
 *         or nothing is smaller, a lossless re-encode (oxipng, else libvips
 *         palette-free) is tried instead.
 *   jpeg  mozjpeg (trellis quantisation, progressive, optimised Huffman) via
 *         sharp, EXIF orientation baked in, metadata stripped.
 *   webp  libwebp via sharp, effort 5 (6 with --max-effort), sharp-YUV chroma
 *         ("smartSubsample").
 *
 * Every candidate is decoded again and compared to the ORIGINAL with SSIM,
 * PSNR (both over the content box, composited over grey so alpha changes
 * count) and the mean alpha error on soft edges; an output is written only if
 * it clears the floors AND is smaller than the input. Nothing is ever made
 * bigger or visibly worse — the worst case is "kept as is".
 */
import { readdir, readFile, writeFile, stat, mkdir, copyFile, access } from 'node:fs/promises'
import { join, extname, basename, dirname, isAbsolute, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { availableParallelism } from 'node:os'
import sharp from 'sharp'
import { ssim } from 'ssim.js'

// ---------------------------------------------------------------------------
// CONFIG — the knobs the benchmark settled on. Change here, not inline.
// ---------------------------------------------------------------------------
const CONFIG = {
  // Calibrated against 55 real TinyPNG outputs (see IMAGE-COMPRESSION-BENCH.md):
  // these floors reproduce TinyPNG's total size within 2% while never going
  // as low as its worst files (31.7 dB / SSIM 0.95). Stricter: 0.985 / 38.
  // TinyPNG-aggressive: 0.97 / 35.
  minSsim: 0.98,              // perceptual floor vs the original (SSIM, grey-composited, content box)
  minPsnr: 36,                // second floor; SSIM alone is blind to spread-out palette noise
  // Third floor: mean |Δalpha| on the original's semi-transparent pixels.
  // Palette PNGs trade alpha levels for colours — at quality ≤ 90 a logo's
  // anti-aliased edge collapses to ~10 alpha steps and looks jagged while SSIM
  // and PSNR still pass. WebP/JPEG never trip this (alpha lossless / none).
  maxAlphaErr: 6,
  qualityMin: 50,             // the search never goes below this quality
  qualityMax: 95,             // …or above this (keeps the original instead)
  png: { quality: 80, effort: 10, dither: 1.0, compressionLevel: 9 },
  jpeg: { quality: 80 },
  // effort 6 is ~20x slower than 5 on alpha sprites for ~3% smaller files, so
  // the search runs at 5 and --max-effort adds one final encode at 6.
  webp: { quality: 80, effort: 5, finalEffort: 6, smartSubsample: true },
  exts: ['png', 'jpg', 'jpeg', 'webp'],
  skipDirs: new Set(['node_modules', '.git', 'dist', '.mcp-browser-profiles']),
  backupSuffix: '-original',
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const options = {
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    'no-backup': { type: 'boolean', default: false },
    'backup-dir': { type: 'string' },
    ext: { type: 'string' },
    'min-ssim': { type: 'string' },
    'min-psnr': { type: 'string' },
    'max-alpha-err': { type: 'string' },
    quality: { type: 'string' },
    'png-quality': { type: 'string' },
    'jpeg-quality': { type: 'string' },
    'webp-quality': { type: 'string' },
    'min-quality': { type: 'string' },
    'max-quality': { type: 'string' },
    concurrency: { type: 'string' },
    'max-effort': { type: 'boolean', default: false },
    only: { type: 'string', multiple: true },
    fresh: { type: 'boolean', default: false },
    json: { type: 'string' },
    quiet: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
}
const { values: opt, positionals } = parseArgs({ allowPositionals: true, options })

// `npm run compress-folder public/images --backup-dir x` never delivers the
// flags: npm keeps everything that looks like an option for itself (visible
// as npm_config_backup_dir=true) and forwards only the positionals. That once
// produced sibling backups inside public/ at default effort, so refuse to run
// with silently-defaulted options. pnpm forwards flags as they are.
if (process.env.npm_config_user_agent?.startsWith('npm/')) {
  const lost = Object.keys(options).filter((k) => process.env[`npm_config_${k.replaceAll('-', '_')}`] !== undefined && !process.argv.includes(`--${k}`))
  if (lost.length || positionals.length > 1) {
    console.error(`npm swallowed flags: ${lost.map((k) => `--${k}`).join(' ') || '(their values arrived as extra positionals: ' + positionals.slice(1).join(' ') + ')'}`)
    console.error(`put them behind "--":   npm run compress-folder -- ${positionals[0] ?? '<dir>'} ${lost.map((k) => `--${k}`).join(' ')}`)
    console.error('or call   node scripts/compress-images.mjs <dir> …   directly (pnpm forwards flags as they are)')
    process.exit(2)
  }
}
if (opt.help || !positionals[0]) {
  console.log('usage: compress-images <dir> [--dry-run] [--force] [--no-backup] [--backup-dir <dir>] [--ext png,jpg,webp] [--min-ssim 0.98] [--min-psnr 36] [--max-alpha-err 6] [--quality n] [--png-quality n] [--jpeg-quality n] [--webp-quality n] [--min-quality 50] [--max-quality 95] [--max-effort] [--only a.webp,b.webp] [--fresh] [--concurrency n] [--json report.json] [--quiet]')
  process.exit(opt.help ? 0 : 1)
}
const ROOT = resolve(positionals[0])
const exts = new Set((opt.ext ? opt.ext.split(',') : CONFIG.exts).map((e) => e.trim().toLowerCase().replace(/^\./, '')))
const minSsim = opt['min-ssim'] ? Number(opt['min-ssim']) : CONFIG.minSsim
const minPsnr = opt['min-psnr'] ? Number(opt['min-psnr']) : CONFIG.minPsnr
const maxAlphaErr = opt['max-alpha-err'] ? Number(opt['max-alpha-err']) : CONFIG.maxAlphaErr
const qualityMin = Number(opt['min-quality'] ?? CONFIG.qualityMin)
const qualityMax = Number(opt['max-quality'] ?? CONFIG.qualityMax)
const qualityFor = (fmt) => Number(opt[`${fmt}-quality`] ?? opt.quality ?? CONFIG[fmt].quality)
// Each encode is single-threaded inside libvips, so files-in-parallel is where
// the cores go; half of them, capped, leaves the machine usable meanwhile.
const concurrency = Number(opt.concurrency ?? Math.max(1, Math.min(8, Math.floor(availableParallelism() / 2))))
const backupDir = opt['backup-dir'] ? resolve(opt['backup-dir']) : null

// oxipng (Rust, prebuilt) for the PNG re-pack + lossless fallback. The script
// still runs without it — PNGs just come out 6-17% larger.
let losslessCompressPng = null
try { ({ losslessCompressPng } = await import('@napi-rs/image')) } catch { /* optional */ }

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const exists = (p) => access(p).then(() => true, () => false)
const fmtOf = (file) => ({ png: 'png', jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp' })[extname(file).slice(1).toLowerCase()]
const isBackup = (file) => basename(file, extname(file)).endsWith(CONFIG.backupSuffix)
const backupPathFor = (file) => {
  const ext = extname(file)
  const name = basename(file, ext) + CONFIG.backupSuffix + ext
  return backupDir ? join(backupDir, relative(ROOT, dirname(file)), name) : join(dirname(file), name)
}
const kb = (n) => (n / 1024).toFixed(1) + ' KB'
const pct = (a, b) => (b === 0 ? '0%' : ((a / b - 1) * 100).toFixed(1) + '%')

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!CONFIG.skipDirs.has(entry.name)) yield* walk(full)
    } else if (entry.isFile() && exts.has(extname(entry.name).slice(1).toLowerCase()) && !isBackup(full)) {
      yield full
    }
  }
}

async function decodeRGBA(buf) {
  // .rotate() bakes EXIF orientation in, so a JPEG that relied on the tag we
  // strip still displays the same way — and the metric compares like with like.
  const { data, info } = await sharp(buf, { failOn: 'none' }).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}
// Composite over mid-grey: alpha edits become visible to the metrics, and the
// RGB garbage most encoders leave under alpha=0 becomes invisible to them.
function compositeGrey(img) {
  const n = img.width * img.height
  const out = new Uint8ClampedArray(n * 4)
  const d = img.data
  for (let i = 0; i < n * 4; i += 4) {
    const a = d[i + 3] / 255, g = 128 * (1 - a)
    out[i] = d[i] * a + g
    out[i + 1] = d[i + 1] * a + g
    out[i + 2] = d[i + 2] * a + g
    out[i + 3] = 255
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
// Metrics are taken over the bounding box of non-transparent pixels. Without
// this a sprite with a lot of padding passes the floors on the strength of its
// empty margins, while a tight 128px icon is held to a stricter standard.
function contentBox(img) {
  const { width: w, height: h, data: d } = img
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] !== 0) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0 || x1 - x0 < 16 || y1 - y0 < 16) return { x: 0, y: 0, w, h }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
function crop(img, b) {
  if (b.x === 0 && b.y === 0 && b.w === img.width && b.h === img.height) return img
  const out = new Uint8ClampedArray(b.w * b.h * 4)
  for (let y = 0; y < b.h; y++) {
    const from = ((b.y + y) * img.width + b.x) * 4
    out.set(img.data.subarray(from, from + b.w * 4), y * b.w * 4)
  }
  return { data: out, width: b.w, height: b.h }
}
function reference(img) {
  const box = contentBox(img)
  const rgba = crop(img, box)
  let edges = 0
  for (let i = 3; i < rgba.data.length; i += 4) if (rgba.data[i] > 0 && rgba.data[i] < 255) edges++
  return { width: img.width, height: img.height, box, rgba, edges, grey: compositeGrey(rgba) }
}
function alphaError(ref, out) {
  if (!ref.edges) return 0
  let sum = 0
  const a = ref.rgba.data, b = out.data
  for (let i = 3; i < a.length; i += 4) if (a[i] > 0 && a[i] < 255) sum += Math.abs(a[i] - b[i])
  return sum / ref.edges
}
async function measure(ref, outBuf) {
  const img = await decodeRGBA(outBuf)
  if (img.width !== ref.width || img.height !== ref.height) return { ssim: 0, psnr: 0, alphaErr: 255 }
  const rgba = crop(img, ref.box)
  const out = compositeGrey(rgba)
  return { ssim: ssim(ref.grey, out).mssim, psnr: psnr(ref.grey, out), alphaErr: alphaError(ref, rgba) }
}

// ---------------------------------------------------------------------------
// encoders — each returns { buf, label } for a quality
// ---------------------------------------------------------------------------
const encoders = {
  png: async (src, q) => ({
    buf: await sharp(src).rotate().png({ palette: true, quality: q, effort: CONFIG.png.effort, dither: CONFIG.png.dither, compressionLevel: CONFIG.png.compressionLevel }).toBuffer(),
    label: `png palette q${q}`,
  }),
  jpeg: async (src, q) => ({
    buf: await sharp(src).rotate().jpeg({ mozjpeg: true, quality: q }).toBuffer(),
    label: `mozjpeg q${q}`,
  }),
  webp: async (src, q, effort = CONFIG.webp.effort) => ({
    buf: await sharp(src).rotate().webp({ quality: q, effort, smartSubsample: CONFIG.webp.smartSubsample }).toBuffer(),
    label: `webp q${q} e${effort}`,
  }),
}
async function losslessPng(src) {
  if (losslessCompressPng) {
    try { return { buf: await losslessCompressPng(src, {}), label: 'png lossless (oxipng)' } } catch { /* fall through */ }
  }
  return { buf: await sharp(src).rotate().png({ compressionLevel: 9, adaptiveFiltering: true, palette: false }).toBuffer(), label: 'png lossless (libvips)' }
}

/**
 * Smart-lossy search: the smallest encode that clears the SSIM + PSNR floors.
 * Starts at the configured quality; walks DOWN in steps of 10 while the floors
 * hold (then refines by 5 and by 2), or UP in steps of 5 until they do.
 * Typically 4-6 encodes per file. Every encode is decoded again and scored
 * against the original, so the floors are measured, not assumed.
 */
async function compressBuffer(src, fmt) {
  const ref = reference(await decodeRGBA(src))
  const cache = new Map()
  const tryQ = async (q) => {
    if (!cache.has(q)) {
      const { buf, label } = await encoders[fmt](src, q)
      cache.set(q, { q, buf, label, ...(await measure(ref, buf)) })
    }
    return cache.get(q)
  }
  const ok = (r) => r.ssim >= minSsim && r.psnr >= minPsnr && r.alphaErr <= maxAlphaErr
  const better = (a, b) => (!a || b.buf.length < a.buf.length ? b : a)
  const start = qualityFor(fmt)
  let best = null
  let qLow = null // lowest quality known to clear the floors
  const first = await tryQ(start)
  if (ok(first)) {
    best = first
    qLow = start
    while (qLow - 10 >= qualityMin) {
      const c = await tryQ(qLow - 10)
      if (!ok(c)) break
      qLow -= 10
      best = better(best, c)
    }
    if (qLow - 5 >= qualityMin) {
      const c = await tryQ(qLow - 5)
      if (ok(c)) { qLow -= 5; best = better(best, c) }
    }
  } else {
    for (let q = start + 5; q <= qualityMax; q += 5) {
      const c = await tryQ(q)
      if (ok(c)) { best = c; qLow = q; break }
    }
  }
  // One finer probe: a 5-step grid overshoots the floor by up to ~10% in size.
  if (qLow !== null && qLow - 2 >= qualityMin) {
    const c = await tryQ(qLow - 2)
    if (ok(c)) best = better(best, c)
  }
  if (best && fmt === 'png' && losslessCompressPng) {
    // Lossless re-pack (oxipng: filters + deflate) of the quantised PNG —
    // 6-17% smaller in the benchmark, pixels untouched, so no re-scoring.
    try {
      const packed = await losslessCompressPng(best.buf, {})
      if (packed.length < best.buf.length) best = { ...best, buf: packed, label: `${best.label} + oxipng` }
    } catch { /* keep the libvips encode */ }
  }
  if (best && fmt === 'webp' && opt['max-effort']) {
    // One expensive encode at the chosen quality; keep it only if it still
    // clears the floors and is actually smaller.
    const { buf, label } = await encoders.webp(src, best.q, CONFIG.webp.finalEffort)
    const c = { q: best.q + 0.5, buf, label, ...(await measure(ref, buf)) }
    cache.set(c.q, c)
    if (ok(c) && buf.length < best.buf.length) best = c
  }
  const tried = [...cache.values()].sort((a, b) => a.q - b.q).map((c) => `${c.label}=${kb(c.buf.length)}/${c.ssim.toFixed(4)}/${c.psnr.toFixed(1)}dB${ref.edges ? `/α${c.alphaErr.toFixed(1)}` : ''}`)
  if (best && best.buf.length < src.length) return { buf: best.buf, label: best.label, ssim: best.ssim, psnr: best.psnr, alphaErr: best.alphaErr, tried }
  if (fmt === 'png') {
    const { buf, label } = await losslessPng(src)
    if (buf.length < src.length) return { buf, label, ssim: 1, psnr: 99, alphaErr: 0, tried }
  }
  return { buf: null, tried }
}

// ---------------------------------------------------------------------------
// per-file driver
// ---------------------------------------------------------------------------
async function processFile(file) {
  const fmt = fmtOf(file)
  const rel = relative(ROOT, file) || basename(file)
  const backup = backupPathFor(file)
  let hasBackup = await exists(backup)
  // --fresh: the file on disk is a NEW original — the slicer just re-cut it —
  // so a backup is the PREVIOUS original. Skipping (the default) would ship the
  // new art uncompressed; --force would compress the OLD art back over it,
  // because it reads the backup as the pristine source. Retire the old one:
  // the new file becomes the backup, and a later --force stays correct.
  if (opt.fresh && hasBackup) {
    if (opt['dry-run'] || opt['no-backup']) hasBackup = false
    else await copyFile(file, backup)
  }
  if (hasBackup && !opt.force && !opt.fresh) return { rel, status: 'skip', note: 'already compressed (backup exists; --force to redo)' }

  const srcPath = hasBackup ? backup : file
  const src = await readFile(srcPath)
  const meta = await sharp(src, { failOn: 'none' }).metadata().catch(() => null)
  if (!meta) return { rel, status: 'skip', note: 'not decodable' }
  if ((meta.pages ?? 1) > 1) return { rel, status: 'skip', note: 'animated — not handled' }

  const t0 = performance.now()
  const { buf, label, ssim: s, psnr: p, alphaErr, tried } = await compressBuffer(src, fmt)
  const ms = performance.now() - t0
  const current = (await stat(file)).size
  if (!buf) return { rel, status: 'keep', before: src.length, after: current, note: `no smaller encode above SSIM ${minSsim} / ${minPsnr} dB / alpha ±${maxAlphaErr}`, tried, ms }
  if (opt['dry-run']) return { rel, status: 'plan', before: src.length, after: buf.length, label, ssim: s, psnr: p, alphaErr, tried, ms }

  if (!opt['no-backup'] && !hasBackup) {
    await mkdir(dirname(backup), { recursive: true })
    await copyFile(file, backup)
  }
  await writeFile(file, buf)
  return { rel, status: 'done', before: src.length, after: buf.length, label, ssim: s, psnr: p, alphaErr, tried, ms }
}

async function pool(items, n, fn) {
  const out = []
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx]).catch((e) => ({ rel: relative(ROOT, items[idx]), status: 'error', note: String(e?.message ?? e) }))
    }
  }))
  return out
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
if (!(await stat(ROOT).catch(() => null))?.isDirectory()) {
  console.error(`not a directory: ${ROOT}`)
  process.exit(1)
}
const files = []
if (opt.only) {
  for (const p of opt.only.flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)) {
    const full = resolve(p)
    const rel = relative(ROOT, full)
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
      console.error(`--only ${p} is not under ${ROOT}`)
      process.exit(1)
    }
    if (!(await stat(full).catch(() => null))?.isFile()) {
      console.error(`--only ${p}: no such file`)
      process.exit(1)
    }
    if (exts.has(extname(full).slice(1).toLowerCase()) && !isBackup(full)) files.push(full)
  }
} else {
  for await (const f of walk(ROOT)) files.push(f)
}
if (!files.length) {
  console.log(`no ${[...exts].join('/')} files under ${ROOT}`)
  process.exit(0)
}
console.log(`${opt['dry-run'] ? 'planning' : 'compressing'} ${files.length} files under ${ROOT} (floors: SSIM ${minSsim}, ${minPsnr} dB, alpha ±${maxAlphaErr}; quality ${qualityMin}-${qualityMax}; ${concurrency} parallel)`)

const results = await pool(files, concurrency, async (file) => {
  const r = await processFile(file)
  if (!opt.quiet) {
    const tag = { done: '✓', plan: '→', keep: '=', skip: '·', error: '✗' }[r.status]
    const size = r.before != null && r.after != null ? ` ${kb(r.before)} → ${kb(r.after)} (${pct(r.after, r.before)})` : ''
    const how = r.label ? `  ${r.label}, ssim ${r.ssim.toFixed(4)}, ${r.psnr.toFixed(1)} dB${r.alphaErr ? `, alpha ±${r.alphaErr.toFixed(1)}` : ''}` : r.note ? `  ${r.note}` : ''
    console.log(`${tag} ${r.rel}${size}${how}`)
  }
  return r
})

const changed = results.filter((r) => r.status === 'done' || r.status === 'plan')
const before = changed.reduce((s, r) => s + r.before, 0)
const after = changed.reduce((s, r) => s + r.after, 0)
const count = (st) => results.filter((r) => r.status === st).length
console.log(`\n${opt['dry-run'] ? 'would compress' : 'compressed'} ${changed.length} files: ${kb(before)} → ${kb(after)} (${pct(after, before)}), kept ${count('keep')}, skipped ${count('skip')}, errors ${count('error')}`)
if (backupDir) console.log(`backups under ${backupDir}`)
else if (!opt['no-backup'] && !opt['dry-run'] && count('done')) console.log(`originals kept next to each file as <name>${CONFIG.backupSuffix}.<ext>`)
for (const r of results.filter((r) => r.status === 'error')) console.error(`✗ ${r.rel}: ${r.note}`)

if (opt.json) {
  await writeFile(opt.json, JSON.stringify({ root: ROOT, minSsim, minPsnr, maxAlphaErr, qualityMin, qualityMax, dryRun: opt['dry-run'], results }, null, 2))
  console.log(`report: ${opt.json}`)
}
process.exit(count('error') ? 1 : 0)
