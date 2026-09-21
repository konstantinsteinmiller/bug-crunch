/**
 * ─── The floors are legible, and a PAINTING is a floor ──────────────────────
 *
 *   pnpm art:floors            # measure every painted floor tile
 *   pnpm art:floors --ids      # …and print the LEVEL_FLOOR_ART_IDS array
 *
 * `tests/game/floorPalette.test.ts` holds all forty floors to three rules —
 * a floor commits to a polarity and its field sits in that polarity's band, its
 * own marks stay quieter than a body, and it is not the colour of the thing
 * walking on it. It is the most valuable test in the game and it has one blind
 * spot: it reads the PALETTE.
 *
 * A painted tile does not go through the palette. `floorTile()` blits the
 * painting and `paintFloorTile` never runs, so every number that test checks
 * describes a drawing the player is no longer looking at. Thirty-six paintings
 * arriving from an image model is thirty-six chances to put a floor in the game
 * that eats the bugs, with fifteen passing test cases on top of it.
 *
 * So this measures the pixels that actually ship, against the same constants,
 * imported from the same module. Nothing here restates a threshold: if
 * `MARK_CONTRAST_MAX` moves, this moves with it.
 *
 * ── What it measures, and why each one ──
 *
 *   FIELD        the per-channel MEDIAN of the tile, not the mean. A mean is
 *                dragged by the marks — a dark seam across a pale board pulls
 *                it toward the seam — and the field is defined as what the tile
 *                reads as, which is its bulk. The median IS the bulk.
 *   BAND         that field's luminance sits inside its polarity's band, and
 *                not in the mud between the two.
 *   INK          a light floor silhouettes the bug outline, a dark floor lets
 *                it vanish. The same two-sided rule the palette test applies.
 *   MARKS        per-pixel contrast against the field. Two separate failures
 *                live here and both matter:
 *                  · TONE — the 99.5th percentile over the ceiling means the
 *                    whole tile is louder than a floor may be;
 *                  · BLOBS — a compact patch over the ceiling that is about the
 *                    size of a bug IS a bug as far as a player scanning the
 *                    board is concerned. Measured as connected components, and
 *                    it is the one check the palette test cannot express at
 *                    all: a palette has no geometry.
 *                A `structure` floor may shout, but only along something that
 *                crosses the tile — so its bright components must SPAN it.
 *   BROWNS       the field is not the colour of a bug.
 *   SEAM         it is declared `tile: 'xy'`, so it is laid edge to edge
 *                forever. The step across the wrap must be no worse than the
 *                steps inside the tile, or every board in that level is ruled
 *                with a grid the painter never drew.
 */
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import {
  BUG_BROWNS, BUG_INK, FLOOR_IDS, FLOOR_PALETTE, INK_CONTRAST_MAX, INK_CONTRAST_MIN,
  LUMA_BAND, MARK_CONTRAST_MAX, MIN_BROWN_DISTANCE, STRUCTURE_CONTRAST_MAX,
  colourDistance, contrastRatio, isLeadFloor, relLuminance, worldOfFloor
} from '../src/game/floors.ts'

const BG_DIR = join(process.cwd(), 'public', 'images', 'bg')
const WANT_IDS = process.argv.includes('--ids')

/** The tile is measured at the size the game bakes it to — `FLOOR_TILE_PX`. */
const N = 256

/**
 * How big a compact mark may be before it reads as a body, in pixels of a
 * 256-tile.
 *
 * A bug is about 13 px across against this tile (the number `floors.ts` states
 * when it explains why a full-width rule is exempt), so a disc of one is about
 * 130 px². Two thirds of that is the threshold: a mark that size is already
 * ambiguous at a glance, and the whole point of the ceiling is that a player
 * scanning for something to stomp must never be made to look twice.
 */
const BLOB_PX = 90

/** A bug's width against a 256 tile — the number `floors.ts` states when it
 *  explains why a mark that crosses the whole tile cannot be mistaken for one. */
const BUG_PX = 13

/** A `structure` mark has to cross the tile. Not the whole way — a diagonal
 *  trace and a grid line both leave gaps — but far enough that no body is that
 *  shape. */
const SPAN_FRAC = 0.55

/**
 * How much louder a PAINTING may be than the palette ceiling, and why there is
 * a multiplier here at all.
 *
 * `MARK_CONTRAST_MAX` governs a floor's declared TONES — three flat colours,
 * each covering a broad area. A painting of the same floor is those tones plus
 * everything that makes it a painting: a weave, a grain, the tooth of paper,
 * the shadow in a fold. Even blurred to a bug's width the gingham blanket the
 * game opens on measures 3.84 against a palette ceiling of 3, and that tile is
 * correct — it is the reference the whole palette was tuned from.
 *
 * So the four floors the game already ships ARE the calibration set, exactly as
 * they are for the palette test's own margins, and this gate's job is to catch
 * a painting that is worse than they are rather than to re-litigate them. 1.4
 * clears the loudest of the four with a little room and still fails a tile at
 * double the ceiling, which is what an image model hands back when it paints a
 * floor as a picture of a floor.
 */
const PAINTED_HEADROOM = 1.4

/**
 * Above this share of loud pixels the tile is a PATTERN, not a field with marks
 * on it, and the blob rule stops applying.
 *
 * A gingham check is a quarter of the tile in dark squares. Each square is
 * about five bugs across, they repeat on a lattice, and no player has ever
 * tried to stomp one — the thing that makes a mark read as a body is being an
 * ISOLATED bug-sized object on quiet ground, which is precisely what a mark on
 * a 25 %-loud tile is not. The tone ceiling above still governs those tiles, so
 * a check that is far too contrasty is still caught; what is dropped is only
 * the claim that each of its squares is a suspected insect.
 */
const PATTERN_COVERAGE = 0.10

const hex = (r, g, b) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`

const srgbToLin = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const linToSrgb = (v) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
  return c * 255
}

/**
 * The colour the tile READS as from arm's length: the AREA-WEIGHTED mean,
 * averaged in linear light.
 *
 * A median was the first thing tried here and it is wrong in the one case that
 * matters most. `floors.ts` defines the gingham's field by saying the tile is
 * "a quarter cream, a half mid and a quarter double, and the area-weighted read
 * is the mid" — area-weighted is a MEAN. On the real painting a per-channel
 * median returned `#b1353d`, the red of the stripe, against a declared field of
 * `#f19b95`: the median of a two-tone check is one of the two tones, which is
 * exactly the thing a blended field is defined NOT to be.
 *
 * Averaged in linear light rather than in sRGB because that is what "from arm's
 * length" physically is — the light from the stripes and the light from the
 * cream adding on a retina, not their code values.
 */
const fieldOf = (px) => {
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < px.length; i += 4) {
    r += srgbToLin(px[i]); g += srgbToLin(px[i + 1]); b += srgbToLin(px[i + 2])
    n++
  }
  return hex(linToSrgb(r / n), linToSrgb(g / n), linToSrgb(b / n))
}

/**
 * Connected components of a boolean mask, 4-connected, iteratively.
 *
 * Iterative rather than recursive on purpose: a `structure` floor's grid is one
 * component that can cover a third of the tile, and a recursive flood fill over
 * twenty thousand pixels overflows the stack.
 */
const components = (mask, n) => {
  const seen = new Uint8Array(n * n)
  const out = []
  const stack = []
  for (let s = 0; s < n * n; s++) {
    if (!mask[s] || seen[s]) continue
    stack.length = 0
    stack.push(s)
    seen[s] = 1
    let area = 0, x0 = n, x1 = -1, y0 = n, y1 = -1
    while (stack.length) {
      const p = stack.pop()
      const x = p % n, y = (p / n) | 0
      area++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1) }
      if (x < n - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1) }
      if (y > 0 && mask[p - n] && !seen[p - n]) { seen[p - n] = 1; stack.push(p - n) }
      if (y < n - 1 && mask[p + n] && !seen[p + n]) { seen[p + n] = 1; stack.push(p + n) }
    }
    out.push({ area, w: x1 - x0 + 1, h: y1 - y0 + 1 })
  }
  return out
}

/** Mean absolute channel step between two pixel rows/cols of equal length. */
const step = (a, b) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i])
  return s / a.length
}

const rowAt = (px, y, n) => {
  const out = []
  for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4
    out.push(px[i], px[i + 1], px[i + 2])
  }
  return out
}
const colAt = (px, x, n) => {
  const out = []
  for (let y = 0; y < n; y++) {
    const i = (y * n + x) * 4
    out.push(px[i], px[i + 1], px[i + 2])
  }
  return out
}

const measure = async (id, file) => {
  const p = FLOOR_PALETTE[id]
  const src = await readFile(file)
  const { data } = await sharp(src)
    .resize(N, N, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // ── The marks are measured at BUG SCALE, not per pixel ──
  //
  // A floor IS fine texture: a weave, a grain, blades of grass, the tooth of
  // paper. Measured pixel to pixel all four of the tiles this game already
  // ships fail a 3:1 ceiling by a wide margin, and they are right and the
  // measurement was wrong — the rule is that no mark READS AS A BUG, and
  // nothing a third of a bug across reads as anything at all. Blurring to
  // roughly a bug's own width is what turns "is this pixel loud" into "is there
  // something bug-shaped and loud here", which is the actual contract.
  const { data: soft } = await sharp(src)
    .resize(N, N, { fit: 'fill' })
    .blur(BUG_PX / 2.5)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const field = fieldOf(data)
  const lum = relLuminance(field)
  const [lo, hi] = LUMA_BAND[p.key]
  const ink = contrastRatio(field, BUG_INK)
  const ceiling = (p.structure === true ? STRUCTURE_CONTRAST_MAX : MARK_CONTRAST_MAX) * PAINTED_HEADROOM

  // Contrast against the field, at bug scale.
  const cs = new Float32Array(N * N)
  const mask = new Uint8Array(N * N)
  for (let i = 0, k = 0; i < soft.length; i += 4, k++) {
    const c = contrastRatio(field, hex(soft[i], soft[i + 1], soft[i + 2]))
    cs[k] = c
    // The BLOB mask is always the ordinary ceiling, even on a structure floor:
    // the exemption is for a line that crosses the tile, never for a patch, so
    // the patch test has to keep measuring against the strict number.
    if (c > MARK_CONTRAST_MAX) mask[k] = 1
  }
  const sorted = Float32Array.from(cs).sort()
  const p995 = sorted[Math.floor(sorted.length * 0.995)]

  let loud = 0
  for (let k = 0; k < mask.length; k++) loud += mask[k]
  const coverage = loud / (N * N)

  const blobs = coverage > PATTERN_COVERAGE ? [] : components(mask, N)
    .filter((c) => c.area >= BLOB_PX)
    .filter((c) => !(p.structure === true
      && (c.w >= N * SPAN_FRAC || c.h >= N * SPAN_FRAC)))

  const brown = Math.min(...BUG_BROWNS.map((b) => colourDistance(field, b)))

  // The wrap, against the tile's own interior steps.
  const seam = Math.max(
    step(rowAt(data, 0, N), rowAt(data, N - 1, N)),
    step(colAt(data, 0, N), colAt(data, N - 1, N))
  )
  let inner = 0
  for (let y = 1; y < N; y += 8) inner = Math.max(inner, step(rowAt(data, y - 1, N), rowAt(data, y, N)))
  for (let x = 1; x < N; x += 8) inner = Math.max(inner, step(colAt(data, x - 1, N), colAt(data, x, N)))

  const fails = []
  if (lum < lo || lum > hi) {
    fails.push(`field ${field} luminance ${lum.toFixed(3)} outside the ${p.key} band [${lo}, ${hi}]`)
  }
  if (lum > LUMA_BAND.dark[1] && lum < LUMA_BAND.light[0]) {
    fails.push(`field ${field} is in the MUD at ${lum.toFixed(3)} — neither silhouetted nor lit`)
  }
  if (p.key === 'light' && ink < INK_CONTRAST_MIN) {
    fails.push(`ink contrast ${ink.toFixed(2)} under ${INK_CONTRAST_MIN} — a dark body will not silhouette`)
  }
  if (p.key === 'dark' && ink > INK_CONTRAST_MAX) {
    fails.push(`ink contrast ${ink.toFixed(2)} over ${INK_CONTRAST_MAX} — the outline half-shows`)
  }
  if (p995 > ceiling) {
    fails.push(`marks: 99.5th pct contrast ${p995.toFixed(2)} over the ${p.structure ? 'structure ' : ''}ceiling ${ceiling.toFixed(2)}`)
  }
  if (blobs.length) {
    const big = blobs.sort((a, b) => b.area - a.area)[0]
    fails.push(`${blobs.length} compact mark(s) over ${MARK_CONTRAST_MAX}:1 — biggest ${big.area}px (${big.w}x${big.h}); a bug is ~13px across`)
  }
  if (brown < MIN_BROWN_DISTANCE) {
    fails.push(`field is ${brown.toFixed(0)} from a bug's own brown (floor is ${MIN_BROWN_DISTANCE})`)
  }
  if (seam > inner * 1.6 + 2) {
    fails.push(`seam step ${seam.toFixed(1)} vs interior ${inner.toFixed(1)} — the tile does not wrap`)
  }

  return { id, field, lum, ink, p995, ceiling, blobs: blobs.length, coverage, brown, seam, inner, fails }
}

const main = async () => {
  if (!existsSync(BG_DIR)) { console.error(`no ${BG_DIR}`); process.exit(1) }
  const files = await readdir(BG_DIR)

  /** Every floor that has a painting on disk, by the id the renderer probes. */
  const jobs = []
  for (const id of FLOOR_IDS) {
    const name = isLeadFloor(id) ? `floor-${worldOfFloor(id)}` : id
    const file = join(BG_DIR, `${name}.webp`)
    if (files.includes(`${name}.webp`)) jobs.push({ id, name, file })
  }

  if (!jobs.length) {
    console.log('No floor paintings on disk yet — nothing to measure.')
    return
  }

  console.log(`Measuring ${jobs.length} painted floor tile(s) at ${N}px against floors.ts\n`)
  console.log('  floor                    field     lum    ink   p99.5/ceil  blob  cov%  brown  seam/inner')
  const bad = []
  for (const j of jobs) {
    const r = await measure(j.id, j.file)
    const ok = r.fails.length === 0
    console.log(
      `  ${ok ? '✓' : '×'} ${j.id.padEnd(22)} ${r.field}  ${r.lum.toFixed(3)}  ${r.ink.toFixed(2)}`
      + `   ${r.p995.toFixed(2)}/${r.ceiling.toFixed(1).padEnd(4)}  ${String(r.blobs).padStart(3)}`
      + `  ${(r.coverage * 100).toFixed(1).padStart(4)}  ${r.brown.toFixed(0).padStart(5)}  ${r.seam.toFixed(1)}/${r.inner.toFixed(1)}`
    )
    if (!ok) bad.push(r)
  }

  if (WANT_IDS) {
    const ids = jobs.filter((j) => !isLeadFloor(j.id)).map((j) => j.id)
    console.log('\nLEVEL_FLOOR_ART_IDS — paste into src/game/artCatalogue.ts:\n')
    console.log(`export const LEVEL_FLOOR_ART_IDS: readonly FloorId[] = [\n${
      ids.length ? ids.map((i) => `  '${i}'`).join(',\n') : ''
    }\n]`)
  }

  if (bad.length) {
    console.log(`\n${bad.length} floor painting(s) FAIL the legibility contract:\n`)
    for (const r of bad) {
      console.log(`  ${r.id}`)
      for (const f of r.fails) console.log(`    · ${f}`)
    }
    console.log('\nRepaint from the sheet — do not hand-edit the file, the next re-roll loses it.')
    process.exit(1)
  }
  console.log('\nAll measured floor paintings clear the same rules the palettes are held to.')
}

main().catch((e) => { console.error(e); process.exit(1) })
