#!/usr/bin/env node
/**
 * ─── Character models: who a death is painted as ───────────────────────────
 *
 *   pnpm art:models            # (re)write art-sheets/models/<design>.png
 *   pnpm art:models --check    # exit 1 if one is missing or out of date
 *
 * A boss's death is painted from TWO images: its layout (`death-<design>.png`,
 * the fall, drawn) and its CHARACTER MODEL — one frame of the creature's walk,
 * exactly as the game shows it. Without the model the painter has nothing but
 * words to go on, and words are not a character: the first painted death came
 * back as a lanky skeletal ghoul with a knife in place of the stubby, big-headed
 * imp the player had just watched walk up the road. The swap at the kill is
 * then a costume change, which is the one thing a death strip must never be.
 *
 * The model is cut from the SLICED painted walk (`public/images/monsters/`) —
 * the frames the game actually plays, already keyed and registered — and only
 * falls back to the drawn walk reference while the walk is unpainted. It is
 * rewritten whenever that walk is re-cut: `tools/slice-sheets.mjs` calls
 * `writeModels` for the walks it just wrote, and `pnpm art:prompts` checks them
 * all, so a death is never painted from a creature that has since changed.
 *
 * One frame, not the sheet: a walk SHEET is itself a grid of eight standing
 * poses, and handed that next to a grid of eight falling ones an image model
 * tends to answer with the grid it likes better. One big clear figure says
 * "this is who" and nothing about "where".
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Height of a model image, px: the figure big enough to read every detail. */
export const MODEL_H = 640
/** Room left round the figure once it is trimmed, as a share of its height. */
const MODEL_PAD = 0.06
/** The flat background every reference is painted on (`BACKGROUND_RULE`). */
const MAGENTA = { r: 255, g: 0, b: 255 }

/** Where a design's model lives, relative to `art-sheets/`. The manifest's
 *  `DeathSpec.model` says the same thing, and a test holds them together. */
export const modelRel = (design) => `models/${design}.png`

/**
 * Every death in the index with the walk it borrows its look from: the sliced
 * strip (if the walk is painted) and the drawn reference (always).
 */
export const modelSources = (root, index) => {
  const walks = new Map((index.walks ?? []).filter((w) => w.kind === 'monster').map((w) => [w.id, w]))
  return (index.walks ?? [])
    .filter((d) => d.kind === 'death' && String(d.id).startsWith('death-'))
    .map((d) => {
      const design = d.id.slice('death-'.length)
      const walk = walks.get(design)
      return {
        design,
        file: join(root, 'art-sheets', modelRel(design)),
        strip: walk?.target ? join(root, 'public', walk.target) : null,
        reference: walk?.file ? join(root, 'art-sheets', walk.file) : null,
        // A panel's shape is a strip frame's shape: the slicer cuts one to the other.
        aspect: walk?.panel ? walk.panel.w / walk.panel.h : 156 / 176,
        panel: walk?.panel ?? null
      }
    })
}

/**
 * One model image: frame 0 of the painted strip, or panel 1 of the drawn
 * walk, scaled to `MODEL_H` and laid flat on magenta. Null when neither exists.
 */
export const buildModel = async (sharp, src) => {
  let frame = null
  let from = null
  if (src.strip && existsSync(src.strip)) {
    const img = sharp(src.strip)
    const { width, height } = await img.metadata()
    const fw = Math.min(width, Math.round(height * src.aspect))
    frame = await img.extract({ left: 0, top: 0, width: fw, height }).png().toBuffer()
    from = src.strip
  } else if (src.reference && existsSync(src.reference) && src.panel) {
    frame = await sharp(src.reference)
      .extract({ left: 0, top: 0, width: src.panel.w, height: src.panel.h }).png().toBuffer()
    from = src.reference
  }
  if (!frame) return null
  // Trimmed to the figure first: the frame's headroom and side room are there
  // for the game's blit, and in a reference they only make the creature — and
  // the scar, the spots, the colour inside its ears — smaller.
  const figure = await sharp(frame).trim({ background: from === src.strip ? { r: 0, g: 0, b: 0, alpha: 0 } : MAGENTA, threshold: 24 })
    .png().toBuffer().catch(() => frame)
  const inner = Math.round(MODEL_H / (1 + 2 * MODEL_PAD))
  const pad = Math.round((MODEL_H - inner) / 2)
  const png = await sharp(figure)
    .resize({ height: inner, kernel: 'lanczos3' })
    .extend({ top: pad, bottom: MODEL_H - inner - pad, left: pad, right: pad, background: { ...MAGENTA, alpha: 0 } })
    .flatten({ background: MAGENTA })
    .png({ compressionLevel: 9 })
    .toBuffer()
  return { png, from }
}

/**
 * Write (or with `check`, only compare) the models. `only` limits it to some
 * designs — the slicer passes the walks it just cut. Returns one line per model.
 */
export const writeModels = async ({ root = ROOT, check = false, only = null, log = console.log } = {}) => {
  const indexFile = join(root, 'art-sheets', 'sheet-index.json')
  if (!existsSync(indexFile)) return []
  const index = JSON.parse(readFileSync(indexFile, 'utf-8'))
  const { default: sharp } = await import('sharp')
  const out = []
  for (const src of modelSources(root, index)) {
    if (only && !only.includes(src.design)) continue
    const built = await buildModel(sharp, src)
    const rel = relative(root, src.file).split('\\').join('/')
    if (!built) {
      out.push({ design: src.design, file: src.file, state: 'missing' })
      log(`  ! ${rel}  no walk to take it from — export or paint walk-${src.design} first`)
      continue
    }
    const current = existsSync(src.file) ? readFileSync(src.file) : null
    const fromRel = relative(root, built.from).split('\\').join('/')
    if (current?.equals(built.png)) {
      out.push({ design: src.design, file: src.file, state: 'same', from: built.from })
      log(`  = ${rel}  unchanged (from ${fromRel})`)
      continue
    }
    if (check) {
      out.push({ design: src.design, file: src.file, state: 'stale', from: built.from })
      log(`  ! ${rel} is ${current ? 'out of date' : 'missing'} — run pnpm art:models`)
      continue
    }
    mkdirSync(dirname(src.file), { recursive: true })
    writeFileSync(src.file, built.png)
    out.push({ design: src.design, file: src.file, state: 'written', from: built.from })
    log(`  ✓ ${rel}  from ${fromRel}`)
  }
  return out
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const check = process.argv.includes('--check')
  const res = await writeModels({ check })
  if (check && res.some((r) => r.state !== 'same')) process.exit(1)
}
