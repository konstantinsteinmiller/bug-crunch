#!/usr/bin/env node
/**
 * ─── Brand assets, from code ────────────────────────────────────────────────
 *
 *   pnpm brand
 *
 * Bug Crunch has no art folder, and the two places that genuinely need a BITMAP
 * rather than a drawing are outside the renderer entirely:
 *
 *   • the LOGO — the PWA manifest, the favicon, and every portal's store page
 *     read it at fixed sizes from a file on disk;
 *   • the SPLASH TILE — the drifting backdrop behind the loading screen, which
 *     has to paint before a single line of JavaScript has run.
 *
 * Both are rendered here from SVG through sharp, so they are reproducible, they
 * are in the repo's own hand, and they can be regenerated the moment the
 * wordmark changes. When the art pipeline produces a painted logo or mascot
 * (`art-sheets` → `still-ui-logo`, `still-ui-mascot`), the slicer writes over
 * exactly these paths and this script stops being the source — which is the same
 * drop-in contract every other drawable in the game has.
 *
 * WHICH IS WHY IT DOES NOT OVERWRITE. A file that is already on disk is left
 * alone and reported, because by the time anybody runs this again the file at
 * that path is probably a painting, and this script cannot tell the difference:
 * both are just a webp at `logo/mascot.webp`. Re-running it to refresh the
 * wordmark would quietly swap the painted greeter back for the placeholder ant,
 * and the only symptom would be that the splash looked worse.
 *
 *   node scripts/make-brand.mjs            # fill in whatever is missing
 *   node scripts/make-brand.mjs --force    # rewrite the placeholders anyway
 *
 * The SPLASH TILE is no longer written here at all. `pnpm art:bg-tile` derives
 * it from the paintings themselves, which is a thing an SVG in this file cannot
 * do; see `tools/bg-tile.mjs`.
 */
import sharp from 'sharp'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = (p) => {
  const full = resolve(ROOT, p)
  mkdirSync(dirname(full), { recursive: true })
  return full
}

// ─── Palette ────────────────────────────────────────────────────────────────
// The same values the game draws with. Change them together.
const INK = '#2b1b2e'
const GOO = '#ff3f86'
const GOO_2 = '#ff6eaa'
const GOLD = '#ffcd00'
const GOLD_2 = '#f7a000'
const LIME = '#8ce35a'

/** A jagged splat blob, as an SVG path. Deterministic — the same shape every
 *  run, so a regeneration is a no-op unless the numbers here changed. */
const splatPath = (cx, cy, r, seed) => {
  const rnd = (i) => {
    const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453
    return x - Math.floor(x)
  }
  const n = 16
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 0.66 + rnd(i) * 0.5
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k])
  }
  let d = `M ${((pts[n - 1][0] + pts[0][0]) / 2).toFixed(1)} ${((pts[n - 1][1] + pts[0][1]) / 2).toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const q = pts[i]
    const nx = (pts[i][0] + pts[(i + 1) % n][0]) / 2
    const ny = (pts[i][1] + pts[(i + 1) % n][1]) / 2
    d += ` Q ${q[0].toFixed(1)} ${q[1].toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`
  }
  return `${d} Z`
}

/** Tapering finger, radiating out of a splat. */
const fingerPath = (cx, cy, a, len, wid) => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  const px = (x, y) => `${(cx + x * c - y * s).toFixed(1)} ${(cy + x * s + y * c).toFixed(1)}`
  return `M ${px(0, -wid)} Q ${px(len * 0.7, -wid * 0.5)} ${px(len, 0)} `
    + `Q ${px(len * 0.7, wid * 0.5)} ${px(0, wid)} Z`
}

// ─── The logo ───────────────────────────────────────────────────────────────

const logoSvg = (S) => {
  const cx = S / 2
  const cy = S / 2
  const fingers = [0.3, 1.1, 2.0, 2.9, 3.8, 4.7, 5.6]
    .map((a, i) => `<path d="${fingerPath(cx, cy, a, S * (0.30 + (i % 3) * 0.05), S * 0.055)}" fill="${GOO}"/>`)
    .join('')
  const drops = [[0.36, -0.34, 0.035], [-0.40, 0.26, 0.028], [0.30, 0.38, 0.022], [-0.30, -0.36, 0.02]]
    .map(([dx, dy, r]) => `<circle cx="${(cx + dx * S).toFixed(1)}" cy="${(cy + dy * S).toFixed(1)}" r="${(r * S).toFixed(1)}" fill="${GOO_2}"/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff3b0"/><stop offset="0.5" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_2}"/>
    </linearGradient>
    <linearGradient id="sole" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d5dbe8"/>
    </linearGradient>
  </defs>

  <!-- The splat: the game's own mark, behind everything. -->
  ${fingers}
  <path d="${splatPath(cx, cy, S * 0.30, 7)}" fill="${GOO}"/>
  <path d="${splatPath(cx, cy, S * 0.21, 13)}" fill="${GOO_2}" opacity="0.85"/>
  ${drops}

  <!-- The sole, coming down on it: toe up, five studs, a thick ink outline. -->
  <g transform="translate(${cx} ${cy}) rotate(-14)">
    <path d="M 0 ${(-S * 0.235).toFixed(1)}
             C ${(S * 0.145).toFixed(1)} ${(-S * 0.225).toFixed(1)} ${(S * 0.135).toFixed(1)} ${(-S * 0.03).toFixed(1)} ${(S * 0.115).toFixed(1)} ${(S * 0.10).toFixed(1)}
             C ${(S * 0.10).toFixed(1)} ${(S * 0.20).toFixed(1)} ${(-S * 0.10).toFixed(1)} ${(S * 0.20).toFixed(1)} ${(-S * 0.115).toFixed(1)} ${(S * 0.10).toFixed(1)}
             C ${(-S * 0.135).toFixed(1)} ${(-S * 0.03).toFixed(1)} ${(-S * 0.145).toFixed(1)} ${(-S * 0.225).toFixed(1)} 0 ${(-S * 0.235).toFixed(1)} Z"
          fill="url(#sole)" stroke="${INK}" stroke-width="${(S * 0.022).toFixed(1)}" stroke-linejoin="round"/>
    ${[[0, -0.17], [-0.055, -0.075], [0.055, -0.075], [-0.05, 0.055], [0.05, 0.055], [0, 0.135]]
      .map(([dx, dy]) => `<circle cx="${(dx * S).toFixed(1)}" cy="${(dy * S).toFixed(1)}" r="${(S * 0.026).toFixed(1)}" fill="${LIME}" stroke="${INK}" stroke-width="${(S * 0.012).toFixed(1)}"/>`)
      .join('')}
  </g>
</svg>`
}

// ─── The splash mascot ──────────────────────────────────────────────────────
//
// One ant, seen from above, in the game's own register: three lobes, six bent
// legs, two curling antennae, two enormous glossy eyes and a blush. It is the
// first thing a new player ever sees, and the whole job of the loading screen's
// gag is that they like it before the game has started.
//
// A STILL rather than a walk strip. The splash animates it with CSS — a float,
// a lunge on the shout, a giggle-shake on the laugh — and a strip would couple
// the panel count to three separate stylesheets for a motion nobody looks at
// for more than two seconds.

const mascotSvg = (S) => {
  const u = S / 100
  const ink = (w) => `stroke="${INK}" stroke-width="${(u * w).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"`
  const leg = (x, y, dx, dy, dx2, dy2) =>
    `<path d="M ${(x * u).toFixed(1)} ${(y * u).toFixed(1)} Q ${(dx * u).toFixed(1)} ${(dy * u).toFixed(1)} ${(dx2 * u).toFixed(1)} ${(dy2 * u).toFixed(1)}" fill="none" ${ink(2.6)}/>`
  const eye = (x, y, r) => `
    <ellipse cx="${(x * u).toFixed(1)}" cy="${(y * u).toFixed(1)}" rx="${(r * u).toFixed(1)}" ry="${(r * 1.06 * u).toFixed(1)}" fill="#ffffff" ${ink(1.5)}/>
    <circle cx="${(x * u).toFixed(1)}" cy="${((y + 0.6) * u).toFixed(1)}" r="${(r * 0.54 * u).toFixed(1)}" fill="${INK}"/>
    <circle cx="${((x - r * 0.3) * u).toFixed(1)}" cy="${((y - r * 0.2) * u).toFixed(1)}" r="${(r * 0.22 * u).toFixed(1)}" fill="#ffffff" opacity="0.95"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="body" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#c2643f"/><stop offset="0.55" stop-color="#8c3a24"/><stop offset="1" stop-color="#5e2415"/>
    </radialGradient>
  </defs>
  <!-- 0.78 so the antennae and the outer legs keep a margin: a mascot clipped
       by its own frame reads as a rendering bug, not as a crop. -->
  <g transform="translate(${(S / 2).toFixed(1)} ${(S * 0.54).toFixed(1)}) scale(0.78)">
    ${leg(-16, -8, -34, -18, -40, -2)}${leg(16, -8, 34, -18, 40, -2)}
    ${leg(-16, 4, -36, 4, -41, 16)}${leg(16, 4, 36, 4, 41, 16)}
    ${leg(-16, 16, -33, 26, -36, 38)}${leg(16, 16, 33, 26, 36, 38)}
    <path d="M ${(-8 * u).toFixed(1)} ${(-30 * u).toFixed(1)} Q ${(-22 * u).toFixed(1)} ${(-44 * u).toFixed(1)} ${(-14 * u).toFixed(1)} ${(-52 * u).toFixed(1)}" fill="none" ${ink(2.2)}/>
    <path d="M ${(8 * u).toFixed(1)} ${(-30 * u).toFixed(1)} Q ${(22 * u).toFixed(1)} ${(-44 * u).toFixed(1)} ${(14 * u).toFixed(1)} ${(-52 * u).toFixed(1)}" fill="none" ${ink(2.2)}/>
    <circle cx="${(-14 * u).toFixed(1)}" cy="${(-52 * u).toFixed(1)}" r="${(3.2 * u).toFixed(1)}" fill="#ffd9a8" ${ink(1.4)}/>
    <circle cx="${(14 * u).toFixed(1)}" cy="${(-52 * u).toFixed(1)}" r="${(3.2 * u).toFixed(1)}" fill="#ffd9a8" ${ink(1.4)}/>
    <ellipse cx="0" cy="${(26 * u).toFixed(1)}" rx="${(20 * u).toFixed(1)}" ry="${(24 * u).toFixed(1)}" fill="url(#body)" ${ink(3)}/>
    <ellipse cx="0" cy="${(4 * u).toFixed(1)}" rx="${(13 * u).toFixed(1)}" ry="${(13 * u).toFixed(1)}" fill="#5e2415" ${ink(2.6)}/>
    <ellipse cx="0" cy="${(-18 * u).toFixed(1)}" rx="${(19 * u).toFixed(1)}" ry="${(17 * u).toFixed(1)}" fill="url(#body)" ${ink(3)}/>
    ${eye(-7.5, -20, 7)}${eye(7.5, -20, 7)}
    <ellipse cx="${(-14 * u).toFixed(1)}" cy="${(-9 * u).toFixed(1)}" rx="${(4.4 * u).toFixed(1)}" ry="${(2.9 * u).toFixed(1)}" fill="#ff7896" opacity="0.55"/>
    <ellipse cx="${(14 * u).toFixed(1)}" cy="${(-9 * u).toFixed(1)}" rx="${(4.4 * u).toFixed(1)}" ry="${(2.9 * u).toFixed(1)}" fill="#ff7896" opacity="0.55"/>
  </g>
</svg>`
}

// ─── The splash tile ────────────────────────────────────────────────────────
//
// RETIRED as an output: `pnpm art:bg-tile` writes the tile now, from the game's
// own paintings rather than from stencils, so repainting a sprite and re-running
// it follows the art — which an SVG in this file can never do. The generator is
// kept because it is still the clearest statement of what the tile has to BE.
//
// Seamless by construction: every mark is drawn at its place AND at every
// wrapped copy that could still touch the tile, so nothing is cut at an edge.

const tileSvg = (S) => {
  const marks = []
  const stamp = (x, y, body) => {
    for (const dx of [0, -S, S]) {
      for (const dy of [0, -S, S]) {
        marks.push(`<g transform="translate(${x + dx} ${y + dy})">${body}</g>`)
      }
    }
  }
  const r = S * 0.055

  // An ant: three lobes, six legs, two antennae.
  const ant = `<g stroke="#ffffff" stroke-width="${(r * 0.22).toFixed(1)}" fill="#ffffff" stroke-linecap="round">
    <ellipse cx="0" cy="${(r * 0.8).toFixed(1)}" rx="${(r * 0.55).toFixed(1)}" ry="${(r * 0.7).toFixed(1)}"/>
    <ellipse cx="0" cy="0" rx="${(r * 0.34).toFixed(1)}" ry="${(r * 0.36).toFixed(1)}"/>
    <ellipse cx="0" cy="${(-r * 0.72).toFixed(1)}" rx="${(r * 0.48).toFixed(1)}" ry="${(r * 0.46).toFixed(1)}"/>
    <path d="M${(-r * 0.4).toFixed(1)} ${(-r * 0.2).toFixed(1)} L${(-r * 1.1).toFixed(1)} ${(-r * 0.5).toFixed(1)}" fill="none"/>
    <path d="M${(r * 0.4).toFixed(1)} ${(-r * 0.2).toFixed(1)} L${(r * 1.1).toFixed(1)} ${(-r * 0.5).toFixed(1)}" fill="none"/>
    <path d="M${(-r * 0.4).toFixed(1)} ${(r * 0.2).toFixed(1)} L${(-r * 1.1).toFixed(1)} ${(r * 0.3).toFixed(1)}" fill="none"/>
    <path d="M${(r * 0.4).toFixed(1)} ${(r * 0.2).toFixed(1)} L${(r * 1.1).toFixed(1)} ${(r * 0.3).toFixed(1)}" fill="none"/>
    <path d="M${(-r * 0.4).toFixed(1)} ${(r * 0.7).toFixed(1)} L${(-r * 1.05).toFixed(1)} ${(r * 1.1).toFixed(1)}" fill="none"/>
    <path d="M${(r * 0.4).toFixed(1)} ${(r * 0.7).toFixed(1)} L${(r * 1.05).toFixed(1)} ${(r * 1.1).toFixed(1)}" fill="none"/>
    <path d="M${(-r * 0.22).toFixed(1)} ${(-r * 1.05).toFixed(1)} L${(-r * 0.6).toFixed(1)} ${(-r * 1.6).toFixed(1)}" fill="none"/>
    <path d="M${(r * 0.22).toFixed(1)} ${(-r * 1.05).toFixed(1)} L${(r * 0.6).toFixed(1)} ${(-r * 1.6).toFixed(1)}" fill="none"/>
  </g>`

  // A splat.
  const splat = `<path d="${splatPath(0, 0, r * 1.25, 21)}" fill="#ffffff"/>`

  // A sole, from above.
  const shoe = `<g fill="#ffffff">
    <path d="M 0 ${(-r * 1.5).toFixed(1)} C ${(r * 0.95).toFixed(1)} ${(-r * 1.45).toFixed(1)} ${(r * 0.9).toFixed(1)} ${(-r * 0.2).toFixed(1)} ${(r * 0.75).toFixed(1)} ${(r * 0.65).toFixed(1)}
      C ${(r * 0.65).toFixed(1)} ${(r * 1.3).toFixed(1)} ${(-r * 0.65).toFixed(1)} ${(r * 1.3).toFixed(1)} ${(-r * 0.75).toFixed(1)} ${(r * 0.65).toFixed(1)}
      C ${(-r * 0.9).toFixed(1)} ${(-r * 0.2).toFixed(1)} ${(-r * 0.95).toFixed(1)} ${(-r * 1.45).toFixed(1)} 0 ${(-r * 1.5).toFixed(1)} Z"/>
  </g>`

  // A star, and a coin.
  const starPts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
    const rr = i % 2 === 0 ? r * 1.15 : r * 0.5
    return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`
  }).join(' ')
  const star = `<polygon points="${starPts}" fill="#ffffff"/>`
  const coin = `<g fill="none" stroke="#ffffff" stroke-width="${(r * 0.22).toFixed(1)}">
    <circle cx="0" cy="0" r="${(r * 1.0).toFixed(1)}"/><circle cx="0" cy="0" r="${(r * 0.55).toFixed(1)}"/>
  </g>`

  // Two of the six sit ON an edge — the splat on the vertical one, the star on
  // the horizontal — so the wrap is not merely correct in principle but visible:
  // half a splat on the right of the tile is the other half on the left, and a
  // reader (or `tests/ui/splashTiles.test.ts`) can see the seam close.
  const q = S / 4
  stamp(q * 0.6, q * 0.7, ant)
  stamp(q * 4.0, q * 0.5, splat)
  stamp(q * 1.8, q * 2.0, shoe)
  stamp(q * 3.4, q * 2.2, ant)
  stamp(q * 1.3, q * 4.0, star)
  stamp(q * 2.4, q * 3.4, coin)

  // NO GROUND RECT below. The tile composites over the splash's own radial
  // gradient, so it has to be motifs on transparency: bake a background into
  // it and the gradient is flattened, with nothing the CSS `opacity` can do
  // about it. `tests/ui/splashTiles.test.ts` pins the alpha channel for that
  // reason.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  ${marks.join('\n  ')}
</svg>`
}

// ─── Write ──────────────────────────────────────────────────────────────────

const FORCE = process.argv.includes('--force')

/** Written files and skipped ones, for the one line at the end. */
const wrote = []
const kept = []

/** True when this path should be (re)written. See the header: a file already on
 *  disk is very likely a painting, and a placeholder must never replace one. */
const claim = (path) => {
  const full = out(path)
  if (!FORCE && existsSync(full)) {
    kept.push(path)
    return null
  }
  wrote.push(path)
  return full
}

// Referenced so the retired generator above is not dead to a bundler or a
// linter; see its header for why it is kept.
void tileSvg

const run = async () => {
  const logo = Buffer.from(logoSvg(1024))

  const png = async (size, path) => {
    const to = claim(path)
    if (to) await sharp(logo).resize(size, size).png({ compressionLevel: 9 }).toFile(to)
  }
  const webp = async (size, path) => {
    const to = claim(path)
    if (to) await sharp(logo).resize(size, size).webp({ quality: 90, effort: 6 }).toFile(to)
  }

  await Promise.all([
    png(512, 'public/images/logo/logo_512x512.png'),
    png(192, 'public/images/logo/logo_192x192.png'),
    webp(256, 'public/images/logo/logo_256x256.webp'),
    png(512, 'public/images/icons/logo_512x512.png'),
    png(192, 'public/images/icons/logo_192x192.png'),
    webp(256, 'public/images/icons/logo_256x256.webp')
  ])

  // The favicon. A 32 px PNG renamed to `.ico` is served and rendered correctly
  // by every browser this game ships to — a real multi-size ICO container would
  // need a second dependency for no visible gain.
  const favTo = claim('public/favicon.ico')
  if (favTo) writeFileSync(favTo, await sharp(logo).resize(32, 32).png({ compressionLevel: 9 }).toBuffer())

  const mascotTo = claim('public/images/logo/mascot.webp')
  if (mascotTo) {
    await sharp(Buffer.from(mascotSvg(512))).webp({ quality: 92, effort: 6 }).toFile(mascotTo)
  }

  console.log(`brand: wrote ${wrote.length} file(s)${wrote.length ? `\n  + ${wrote.join('\n  + ')}` : ''}`)
  if (kept.length) {
    console.log(`  kept ${kept.length} file(s) that already exist (very likely painted — pass --force to replace):`)
    for (const k of kept) console.log(`  = ${k}`)
  }
  console.log('  the splash tile is built by `pnpm art:bg-tile`, from the paintings.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
