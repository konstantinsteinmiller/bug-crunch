#!/usr/bin/env node
/**
 * ─── art:promotion — the store-page side of the art pipeline ────────────────
 *
 *   pnpm art:promotion                 # the whole trip: plates → paint what is
 *                                      #   missing → cut every size → compress
 *   pnpm art:promotion --plates        # (re)build the plates and the prompt
 *                                      #   document, paint nothing, stop
 *   pnpm art:promotion --no-generate   # cut and compress from what is on disk
 *   pnpm art:promotion --only 1x1,16x9 # …just these aspect families
 *   pnpm art:promotion --force         # re-roll every master, painted or not
 *   pnpm art:promotion --check         # CI: is PROMPTS-PROMOTION.md current?
 *   pnpm art:promotion --no-compress   # leave the deliverables uncompressed
 *   pnpm art:promotion --keep-window   # leave the Gemini window open afterwards
 *
 * A SIDE STEP of the pipeline in `tools/slice-sheets.mjs`, sharing its manifest
 * discipline, its painter and its compressor, and sharing none of its plumbing:
 *
 *   · nothing here is a drawable. The renderer never probes for a cover, so
 *     there is no drop-in path, no fit normalisation and no magenta key;
 *   · the plates live in `art-sheets/promotion/` and the masters in
 *     `art-sheets/promotion/painted/`, ONE FOLDER DOWN from the sheets the Art
 *     Desk scans. The desk turns every block of every `art-sheets/PROMPTS-*.md`
 *     into a job it hands to the slicer, and the slicer would refuse all six
 *     covers and leave six paintings sitting in the folder it reads;
 *   · the deliverables land in `src/assets/promotion/`, not `public/`, because
 *     a cover is uploaded to a submission form by a human and must never be
 *     shipped to a player who will not look at it.
 *
 * What it produces, from `src/game/promotionSheet.ts`:
 *
 *   9 cover sizes x 2 formats   1920x1080, 1080x1920, 800x1200, 800x800,
 *                               628x628, 600x600, 512x512, 512x384, 512x340,
 *                               each as .jpg and .webp, each cut from the
 *                               master of its OWN aspect family
 *   4 brand files               logo 512 png / 256 webp / 192 png, and a
 *                               128x128 favicon.ico
 *
 * Everything but the favicon goes through `scripts/compress-images.mjs`. The
 * favicon does not, and that is deliberate: an .ico is a container, the
 * compressor writes png/jpg/webp, and a "compressed" favicon would be a PNG
 * with the wrong extension that Windows and Safari both refuse.
 *
 * Run through the ts hook, which is what lets it read the game's own manifest:
 *   node --import ./tools/ts-resolve.mjs tools/art-promotion.mjs
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')
const SHEETS = join(ROOT, 'art-sheets', 'promotion')
const PAINTED = join(SHEETS, 'painted')
const OUT = join(ROOT, 'src', 'assets', 'promotion')
const BACKUP = 'src/assets/promotion-backup'
const DOC = join(SHEETS, 'PROMPTS-PROMOTION.md')
const RECEIPT = join(PAINTED, '.painted.json')
const RENDERED = join(SHEETS, '.rendered.json')
const STATUS = join(SHEETS, 'PROMOTION-STATUS.md')

const { values: opt } = parseArgs({
  options: {
    plates: { type: 'boolean', default: false },
    // Negations are spelled out rather than written as `generate: false`,
    // because `parseArgs` has no `--no-x` form: it throws ERR_PARSE_ARGS_
    // UNKNOWN_OPTION on the flag the header documents.
    'no-generate': { type: 'boolean', default: false },
    'no-compress': { type: 'boolean', default: false },
    only: { type: 'string' },
    force: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    'keep-window': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false }
  }
})

const generate = !opt['no-generate']
const compress = !opt['no-compress']

if (opt.help) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf-8')
    .split('*/')[0].split('\n').slice(2, 20).map((l) => l.replace(/^ \* ?/, '')).join('\n'))
  process.exit(0)
}

const { default: sharp } = await import('sharp')
const manifest = await import(pathToFileURL(join(ROOT, 'src', 'game', 'promotionSheet.ts')).href)
const {
  BRAND_DELIVERABLES, COVER_ASPECTS, COVER_FLOOR, COVER_FORMATS, PLATE_FOCUS, PLATE_LAYERS,
  coverDeliverables, coverFile, plateStem, promotionPromptDoc, promptForCover
} = manifest

const rel = (f) => relative(ROOT, f).split('\\').join('/')
const rev = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 12)
const revOfFile = (f) => (existsSync(f) ? rev(readFileSync(f)) : null)
const readJson = (f, fallback) => {
  try { return JSON.parse(readFileSync(f, 'utf-8')) } catch { return fallback }
}
const writeJson = (f, v) => {
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`, 'utf-8')
}

const wanted = opt.only ? new Set(opt.only.split(',').map((s) => s.trim()).filter(Boolean)) : null
const unknown = wanted ? [...wanted].filter((id) => !COVER_ASPECTS.some((a) => a.id === id)) : []
if (unknown.length) {
  console.error(`--only ${unknown.join(', ')}: no such aspect. Known: ${COVER_ASPECTS.map((a) => a.id).join(', ')}`)
  process.exit(2)
}
const aspects = COVER_ASPECTS.filter((a) => !wanted || wanted.has(a.id))

// ─── 1. The prompt document ─────────────────────────────────────────────────
//
// The manifest owns the TEXT, and this writes it out — the same contract
// `pnpm art:prompts` has for the sheets, and the same reason: the prompt a
// painter is handed by hand and the prompt this tool sends to Gemini have to be
// one string, or the hand route debugs a prompt the automated route never sent.

const doc = promotionPromptDoc()
const docCurrent = existsSync(DOC) && readFileSync(DOC, 'utf-8') === doc
if (opt.check) {
  if (docCurrent) {
    console.log(`  = ${rel(DOC)}  unchanged`)
    process.exit(0)
  }
  console.error(`  ! ${rel(DOC)} is out of date — run pnpm art:promotion --plates`)
  process.exit(1)
}
mkdirSync(SHEETS, { recursive: true })
if (docCurrent) {
  console.log(`  = ${rel(DOC)}  unchanged`)
} else {
  writeFileSync(DOC, doc, 'utf-8')
  console.log(`  ✓ ${rel(DOC)}  ${(doc.length / 1024).toFixed(0)} kB`)
}

// ─── 2. The plates ──────────────────────────────────────────────────────────
//
// A cover plate is the game's own painted cast, composited at the target aspect
// — the picture the painter restyles, and the cover that ships until one is
// painted. Built with sharp alone: no browser, no canvas, no renderer. Every
// sprite it reads is already a finished bitmap in `public/images/`.

/** How much of the plate's short side one floor tile covers. See `buildPlate`. */
const FLOOR_SCALE = 0.8

/** A layer's bitmap: one frame of a strip, resized, rotated, faded. */
const layerBuffer = async (layer, short) => {
  const file = join(PUBLIC, layer.src)
  if (!existsSync(file)) return null
  const img = sharp(file)
  const meta = await img.metadata()
  const frames = layer.frames ?? 1
  // A walk is a horizontal strip of square frames and a splat is a strip of
  // four; either way the frame is as wide as the strip is tall, so the count
  // does not have to be trusted — it is checked against the geometry.
  const fw = Math.round(meta.width / frames)
  let buf = frames > 1
    ? await img.extract({ left: Math.min(layer.frame ?? 0, frames - 1) * fw, top: 0, width: fw, height: meta.height }).png().toBuffer()
    : await img.png().toBuffer()
  const width = Math.max(8, Math.round(layer.size * short))
  buf = await sharp(buf).resize({ width, kernel: 'lanczos3' }).png().toBuffer()
  if (layer.rotate) {
    buf = await sharp(buf).rotate(layer.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  }
  if (layer.opacity != null && layer.opacity < 1) {
    // sharp has no opacity knob: multiply the alpha channel down with a
    // one-pixel tile blended `dest-in`, which is the documented way.
    buf = await sharp(buf).composite([{
      input: Buffer.from([0, 0, 0, Math.round(layer.opacity * 255)]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-in'
    }]).png().toBuffer()
  }
  return buf
}

/**
 * Place a layer on a WxH plate, cropping it to what is actually visible.
 *
 * sharp refuses a composite that hangs off the base — "Image to composite must
 * have same dimensions or smaller" — and half the cast is deliberately falling
 * off an edge, because a cover whose subjects all sit politely inside the frame
 * reads as a product shot. So the overlap is worked out here and only the
 * visible rectangle is handed over.
 */
const place = async (buf, layer, W, H) => {
  const { width, height } = await sharp(buf).metadata()
  const left = Math.round(layer.cx * W - width / 2)
  const top = Math.round(layer.cy * H - height / 2)
  const sx = Math.max(0, -left)
  const sy = Math.max(0, -top)
  const vw = Math.min(width - sx, W - Math.max(0, left))
  const vh = Math.min(height - sy, H - Math.max(0, top))
  if (vw <= 0 || vh <= 0) return null
  const cropped = sx || sy || vw !== width || vh !== height
    ? await sharp(buf).extract({ left: sx, top: sy, width: vw, height: vh }).png().toBuffer()
    : buf
  return { input: cropped, left: Math.max(0, left), top: Math.max(0, top) }
}

const glowSvg = (W, H, f) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
  + `<defs><radialGradient id="g" cx="${(f.x * 100).toFixed(1)}%" cy="${(f.y * 100).toFixed(1)}%" r="62%">`
  + '<stop offset="0%" stop-color="#ffdf9b" stop-opacity="0.55"/>'
  + '<stop offset="60%" stop-color="#ffc46a" stop-opacity="0.18"/>'
  + '<stop offset="100%" stop-color="#ffc46a" stop-opacity="0"/>'
  + `</radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`
)

const vignetteSvg = (W, H, f) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
  + `<defs><radialGradient id="v" cx="${(f.x * 100).toFixed(1)}%" cy="${(f.y * 100).toFixed(1)}%" r="78%">`
  + '<stop offset="45%" stop-color="#2b1b2e" stop-opacity="0"/>'
  + '<stop offset="100%" stop-color="#2b1b2e" stop-opacity="0.5"/>'
  + `</radialGradient></defs><rect width="${W}" height="${H}" fill="url(#v)"/></svg>`
)

const buildPlate = async (aspect) => {
  const { w: W, h: H } = aspect.plate
  const short = Math.min(W, H)
  const focus = PLATE_FOCUS[aspect.shape]
  const floor = join(PUBLIC, COVER_FLOOR)
  if (!existsSync(floor)) throw new Error(`the cover floor ${COVER_FLOOR} is missing — paint it, or run pnpm art:export`)

  // The floor first, tiled edge to edge, then the glow under the cast so the
  // focal point is already lit before anything stands on it.
  //
  // THE TILE IS BLOWN UP, and it has to be. A floor tile is authored for the
  // play area — 512 px carrying a four-by-four check, which is right at the
  // size a player sees it and is fifteen checks across a 1920 px cover. At that
  // pitch the gingham reads as a vibrating moiré that fights the subject for
  // attention, which is the exact opposite of what a thumbnail needs. Scaled to
  // a fixed share of the SHORT side it is about five checks across whatever
  // shape the plate is, the same weight in every aspect, and quiet.
  const tile = Math.round(short * FLOOR_SCALE)
  const base = await sharp({ create: { width: W, height: H, channels: 3, background: '#d8c9a8' } })
    .composite([
      { input: await sharp(floor).resize(tile, tile, { kernel: 'lanczos3' }).png().toBuffer(), tile: true },
      { input: glowSvg(W, H, focus) }
    ]).png().toBuffer()

  const layers = []
  const missing = []
  for (const layer of PLATE_LAYERS[aspect.shape]) {
    const buf = await layerBuffer(layer, short)
    if (!buf) { missing.push(layer.src); continue }
    const put = await place(buf, layer, W, H)
    if (put) layers.push(put)
  }
  const png = await sharp(base)
    .composite([...layers, { input: vignetteSvg(W, H, focus) }])
    .png({ compressionLevel: 9 })
    .toBuffer()
  return { png, missing }
}

const plateFile = (aspect) => join(SHEETS, `${plateStem(aspect)}.png`)

console.log('\nplates')
const plates = new Map()
for (const aspect of aspects) {
  const file = plateFile(aspect)
  const { png, missing } = await buildPlate(aspect)
  const before = existsSync(file) ? readFileSync(file) : null
  // Byte-identical plates keep their file — and so their mtime — because the
  // plate's revision is what decides whether a painting has gone stale, and
  // rewriting an unchanged plate would mark every cover for a repaint.
  if (!before?.equals(png)) writeFileSync(file, png)
  plates.set(aspect.id, { file, rev: rev(png) })
  const note = missing.length ? `  (${missing.length} sprite(s) missing: ${missing.join(', ')})` : ''
  console.log(`  ${before?.equals(png) ? '=' : '✓'} ${rel(file)}  ${aspect.plate.w}x${aspect.plate.h}${note}`)
}

if (opt.plates) {
  console.log('\n--plates: stopping before the painter.')
  process.exit(0)
}

// ─── 3. The masters ─────────────────────────────────────────────────────────
//
// One generation per aspect family, through the Art Desk's own Gemini window —
// the same signed-in Chrome profile, the same throttle, the same shared
// allowance ledger. The receipt records the PLATE revision a master was painted
// against and the master's own hash, so "the plate moved since this was
// painted" is one string comparison, exactly as `painted/.sliced.json` does it
// for the sheets.

const receipt = readJson(RECEIPT, { files: {} })
receipt.files ??= {}

const masterOf = (aspect) => {
  const stem = plateStem(aspect)
  if (!existsSync(PAINTED)) return null
  const f = readdirSync(PAINTED).find((n) => /\.(png|jpe?g|webp)$/i.test(n) && n.replace(/\.[^.]+$/, '') === stem)
  return f ? join(PAINTED, f) : null
}

/** `paint` · `stale` · `ok` — what each family needs before anything is cut. */
const needs = (aspect) => {
  const master = masterOf(aspect)
  if (!master) return { state: 'paint', why: 'nothing painted yet', master: null }
  const line = receipt.files[basename(master)]
  const own = revOfFile(master)
  if (line?.painting && line.painting !== own) return { state: 'ok', why: 're-rolled by hand', master }
  if (line?.plate && line.plate !== plates.get(aspect.id)?.rev) {
    return { state: 'stale', why: `the plate changed (${line.plate} → ${plates.get(aspect.id)?.rev})`, master }
  }
  return { state: 'ok', why: 'painted', master }
}

const paintQueue = aspects
  .map((aspect) => ({ aspect, ...needs(aspect) }))
  .filter((j) => opt.force || j.state !== 'ok')

let painter = null
let painterError = null
let painted = 0

if (generate && paintQueue.length) {
  const { loadConfig } = await import(pathToFileURL(join(ROOT, 'tools', 'art-desk', 'config.mjs')).href)
  const { Gemini } = await import(pathToFileURL(join(ROOT, 'tools', 'art-desk', 'gemini.mjs')).href)
  const { countGeneration, usedOnAccount, usedToday } = await import(pathToFileURL(join(ROOT, 'tools', 'art-desk', 'usage.mjs')).href)
  const cfg = loadConfig(ROOT)
  const g = cfg.gemini
  painter = new Gemini({
    root: ROOT, profileDir: g.profileDir, url: g.url, chrome: g.chrome, chromeArgs: g.chromeArgs,
    log: (line, level) => console.log(`    ${level === 'err' ? '! ' : ''}${line}`)
  })

  console.log(`\npainting ${paintQueue.length} cover${paintQueue.length === 1 ? '' : 's'}`
    + `  (${usedToday()} generations today, ${usedOnAccount()} on this account, cap ${g.accountCap})`)

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let consecutive = 0
  for (const [i, job] of paintQueue.entries()) {
    if (usedOnAccount() >= g.accountCap) {
      painterError = `this account has had ${usedOnAccount()} generations (cap ${g.accountCap})`
        + ' — sign a different one in through the Art Desk, then run this again'
      break
    }
    if (usedToday() >= g.dailyCap) {
      painterError = `daily cap reached (${usedToday()}/${g.dailyCap})`
      break
    }
    if (i > 0) {
      const gap = Math.round(g.gapSeconds + Math.random() * g.jitterSeconds)
      console.log(`  … waiting ${gap} s before the next generation`)
      await sleep(gap * 1000)
    }
    const plate = plates.get(job.aspect.id)
    console.log(`  → ${job.aspect.id} (${job.why})`)
    let last = ''
    try {
      countGeneration()
      const { bytes } = await painter.paint({
        refFile: plate.file,
        prompt: promptForCover(job.aspect),
        timeoutMs: g.timeoutSeconds * 1000,
        onPhase: (phase, quiet) => {
          if (quiet && phase === last) return
          last = phase
          console.log(`    ${phase}`)
        }
      })
      // The masters folder is not the slicer's, so nothing else reads it — but
      // a replaced master is archived rather than dropped for the same reason
      // the desk archives a painting: the one that came back worse is the one
      // you want back.
      mkdirSync(PAINTED, { recursive: true })
      const type = bytes.slice(0, 4).toString('hex') === '89504e47' ? 'png'
        : bytes.slice(0, 2).toString('hex') === 'ffd8' ? 'jpg' : 'webp'
      const dest = join(PAINTED, `${plateStem(job.aspect)}.${type}`)
      for (const old of existsSync(PAINTED) ? readdirSync(PAINTED) : []) {
        if (/\.(png|jpe?g|webp)$/i.test(old) && old.replace(/\.[^.]+$/, '') === plateStem(job.aspect)) {
          const to = join(PAINTED, 'replaced', `${old.replace(/\.[^.]+$/, '')}.${Date.now()}${old.slice(old.lastIndexOf('.'))}`)
          mkdirSync(dirname(to), { recursive: true })
          renameSync(join(PAINTED, old), to)
          delete receipt.files[old]
        }
      }
      writeFileSync(dest, bytes)
      receipt.files[basename(dest)] = { plate: plate.rev, painting: rev(bytes), at: new Date().toISOString() }
      writeJson(RECEIPT, receipt)
      const meta = await sharp(bytes).metadata()
      console.log(`    ✓ ${rel(dest)}  ${meta.width}x${meta.height} ${type}, ${(bytes.length / 1024).toFixed(0)} kB`)
      painted++
      consecutive = 0
    } catch (e) {
      consecutive++
      console.log(`    ! ${job.aspect.id} failed: ${e.message}`)
      if (['QUOTA', 'SIGNED_OUT', 'CONSENT', 'BROWSER'].includes(e.code)) {
        painterError = `${e.code}: ${e.message}`
        break
      }
      if (consecutive >= g.maxConsecutiveFailures) {
        painterError = `${consecutive} failures in a row — stopping rather than spending the allowance on the same problem`
        break
      }
    }
  }
  if (!opt['keep-window']) await painter.closeWindow().catch(() => {})
} else if (paintQueue.length) {
  console.log(`\n${paintQueue.length} cover(s) have no current painting; --no-generate, so the plate is used instead.`)
}

// ─── 4. The deliverables ────────────────────────────────────────────────────
//
// Every size cut from its OWN family's master (or, failing that, its plate).
// `fit: cover` rather than `contain`, so a deliverable is never letterboxed —
// the plates are already at the deliverable's aspect, so the crop is a pixel or
// two and `cover` is what absorbs a return that came back 1376x768 when it was
// asked for 16:9.
//
// The originals are written GENEROUSLY (jpeg 92 4:4:4, webp 92) because
// `scripts/compress-images.mjs` searches downward from what it is given and
// measures the result against it. Writing a cheap original would hand the
// compressor a floor it cannot see below, and the cover would carry two
// generations of loss instead of one.

/**
 * What each deliverable was last cut from, and whether it has been compressed.
 *
 * TWO facts per file, not one. Keyed on the source revision alone, a run that
 * was told `--no-compress` books the file as done and every run after it agrees:
 * the deliverable is correct, has never been compressed, and nothing will ever
 * notice. `packed` is what re-queues it. An entry written by an older version of
 * this file is a bare string, which reads as "changed" and is re-cut once.
 */
const rendered = readJson(RENDERED, { files: {} })
rendered.files ??= {}

const sourceFor = (aspect) => {
  const master = masterOf(aspect)
  return master
    ? { file: master, from: 'painted', rev: revOfFile(master) }
    : { file: plateFile(aspect), from: 'plate', rev: plates.get(aspect.id)?.rev ?? revOfFile(plateFile(aspect)) }
}

mkdirSync(OUT, { recursive: true })
console.log('\ncovers')
/** Files the compressor still has to see: cut on this run, or cut by a run
 *  that was told not to compress. */
const pending = []
let cut = 0
const sources = new Map()
for (const { aspect, size } of coverDeliverables()) {
  if (wanted && !wanted.has(aspect.id)) continue
  const src = sources.get(aspect.id) ?? sourceFor(aspect)
  sources.set(aspect.id, src)
  for (const format of COVER_FORMATS) {
    const name = coverFile(size, format)
    const file = join(OUT, name)
    const stamp = `${src.rev}:${size.w}x${size.h}:${format}`
    const seen = rendered.files[name]
    if (!opt.force && existsSync(file) && seen?.stamp === stamp) {
      if (compress && !seen.packed) {
        pending.push({ file, name })
        console.log(`  = ${name}  unchanged (${src.from}), never compressed`)
      } else {
        console.log(`  = ${name}  unchanged (${src.from})`)
      }
      continue
    }
    const pipe = sharp(src.file).resize(size.w, size.h, { fit: 'cover', position: 'centre', kernel: 'lanczos3' }).flatten({ background: '#2b1b2e' })
    const buf = format === 'jpg'
      ? await pipe.jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer()
      : await pipe.webp({ quality: 92, effort: 6, smartSubsample: true }).toBuffer()
    writeFileSync(file, buf)
    rendered.files[name] = { stamp, packed: false }
    pending.push({ file, name })
    cut++
    console.log(`  ✓ ${name}  ${(buf.length / 1024).toFixed(0)} kB  (${src.from})`)
  }
}

// ─── 5. The brand files ─────────────────────────────────────────────────────
//
// Resized from the brand master the game already ships — never repainted here.
// A store page whose logo is a second generation of the logo is a store page
// for a game that does not exist.

/**
 * A single-image .ico around a PNG.
 *
 * Every .ico since Vista may hold a PNG payload instead of a DIB, which is the
 * only sane way to carry a 128 px icon with an alpha channel: the BMP route
 * needs an inverted AND mask and a bottom-up buffer, and gets the transparency
 * wrong in exactly the browsers that still ask for an .ico. Six fields, and
 * `width`/`height` are ONE BYTE each — 256 is written as 0, which is why this
 * caps at 255 and why the manifest asks for 128.
 */
const icoOf = (png, size) => {
  const dir = Buffer.alloc(6)
  dir.writeUInt16LE(0, 0)   // reserved
  dir.writeUInt16LE(1, 2)   // 1 = icon
  dir.writeUInt16LE(1, 4)   // one image
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size >= 256 ? 0 : size, 0)
  entry.writeUInt8(size >= 256 ? 0 : size, 1)
  entry.writeUInt8(0, 2)    // palette size — 0 for truecolour
  entry.writeUInt8(0, 3)    // reserved
  entry.writeUInt16LE(1, 4)   // colour planes
  entry.writeUInt16LE(32, 6)  // bits per pixel
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(dir.length + entry.length, 12)
  return Buffer.concat([dir, entry, png])
}

console.log('\nbrand')
for (const d of BRAND_DELIVERABLES) {
  const from = d.from.map((p) => join(PUBLIC, p)).find((f) => existsSync(f))
  if (!from) {
    console.log(`  ! ${d.file}  none of ${d.from.join(', ')} exists — run node scripts/make-brand.mjs, or paint still-ui-logo`)
    continue
  }
  const file = join(OUT, d.file)
  const stamp = `${revOfFile(from)}:${d.size}:${d.format}`
  const seen = rendered.files[d.file]
  if (!opt.force && existsSync(file) && seen?.stamp === stamp) {
    if (compress && !seen.packed) {
      pending.push({ file, name: d.file })
      console.log(`  = ${d.file}  unchanged, never compressed`)
    } else {
      console.log(`  = ${d.file}  unchanged`)
    }
    continue
  }
  const resized = sharp(from).resize(d.size, d.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
  const buf = d.format === 'webp'
    ? await resized.webp({ quality: 92, effort: 6 }).toBuffer()
    : await resized.png({ compressionLevel: 9 }).toBuffer()
  writeFileSync(file, d.format === 'ico' ? icoOf(buf, d.size) : buf)
  // The .ico is deliberately NOT queued for compression — see the header — so
  // it is booked as packed on the way out. Left `false` it would be offered to
  // the compressor again on every run for the rest of the project's life.
  rendered.files[d.file] = { stamp, packed: d.format === 'ico' }
  if (d.format !== 'ico') pending.push({ file, name: d.file })
  cut++
  console.log(`  ✓ ${d.file}  from ${rel(from)}  (${d.what})`)
}

// Written before the compressor runs as well as after it: a run that dies
// mid-compress has still CUT these files, and every entry it leaves behind says
// `packed: false`, so the next run compresses them instead of re-cutting them.
writeJson(RENDERED, rendered)

// ─── 6. Compress ────────────────────────────────────────────────────────────
//
// `--fresh --only <what was just written>`: these files are NEW originals, so
// any backup they have is from an older cut and compressing FROM it would ship
// the old cover. Same contract the Art Desk hands the slicer's output.

const run = (argv) => new Promise((res) => {
  const [cmd, ...args] = argv
  const child = spawn(cmd === 'node' ? process.execPath : cmd, args, {
    cwd: ROOT, stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '0' }
  })
  child.on('close', (code) => res(code))
  child.on('error', () => res(-1))
})

let compressed = 0
if (compress && pending.length) {
  console.log(`\ncompressing ${pending.length} file(s)`)
  const code = await run([
    'node', 'scripts/compress-images.mjs', 'src/assets/promotion',
    '--max-effort', '--backup-dir', BACKUP, '--fresh',
    '--only', pending.map((p) => rel(p.file)).join(',')
  ])
  if (code !== 0) {
    console.error(`\nthe compressor failed (exit ${code}) — the deliverables are written but not compressed`)
    process.exit(1)
  }
  for (const p of pending) rendered.files[p.name].packed = true
  writeJson(RENDERED, rendered)
  compressed = pending.length
} else if (compress) {
  console.log('\nnothing new to compress')
}

// ─── 7. What stands ─────────────────────────────────────────────────────────

const MARKS = { ok: '✓', stale: '!', paint: '·' }
const rows = COVER_ASPECTS.map((a) => {
  const n = needs(a)
  const src = sources.get(a.id) ?? sourceFor(a)
  return {
    id: a.id,
    label: a.label,
    mark: MARKS[n.state],
    state: n.state === 'ok' ? n.why : `${n.why} — the plate is shipping instead`,
    from: src.from,
    sizes: a.sizes.map((s) => `${s.w}x${s.h}`).join(', ')
  }
})

const tally = rows.reduce((t, r) => ({ ...t, [r.mark]: (t[r.mark] ?? 0) + 1 }), {})
const files = readdirSync(OUT).filter((f) => /\.(jpe?g|webp|png|ico)$/i.test(f)).length

writeFileSync(STATUS, [
  '# Promotion status — generated by `pnpm art:promotion`',
  '',
  'A report, not a contract: a picture of `art-sheets/promotion/painted/` and',
  '`src/assets/promotion/` at the moment it was written.',
  '',
  `**${tally['✓'] ?? 0} painted · ${tally['!'] ?? 0} need a repaint · ${tally['·'] ?? 0} still the plate`
  + ` — ${files} files in \`src/assets/promotion/\`**`,
  '',
  '| | Aspect | Cuts | Shipping | State |',
  '| --- | --- | --- | --- | --- |',
  ...rows.map((r) => `| ${r.mark} | **${r.id}** ${r.label} | \`${r.sizes}\` | ${r.from} | ${r.state} |`),
  '',
  '## What the marks mean',
  '',
  '* **✓** painted from the plate that is on disk now.',
  '* **!** painted from a plate that has since been rebuilt — the cast, the',
  '  layout or the floor moved. `pnpm art:promotion` re-rolls it.',
  '* **·** nothing painted for this aspect. The deliverables are cut from the',
  '  PLATE, which is a real composition of the game\'s real painted cast, so the',
  '  folder is complete and looks like a blocking pass rather than a cover.',
  '',
  'Every cover is painted without text, without a logo and without any interface;',
  'the logo ships as its own file beside them. See `src/game/promotionSheet.ts`.',
  ''
].join('\n'), 'utf-8')

console.log('')
for (const r of rows) console.log(`  ${r.mark} ${r.id.padEnd(5)} ${r.sizes.padEnd(28)} ${r.from.padEnd(7)} ${r.state}`)
console.log(`\n${rel(OUT)}: ${files} files`
  + `  ·  ${painted} painted, ${cut} cut, ${compressed} compressed`)
console.log(`${rel(STATUS)} written`)

if (painterError) {
  console.error(`\nthe painter stopped: ${painterError}`)
  process.exit(1)
}
