#!/usr/bin/env node
/**
 * ─── Brand assets, from code ────────────────────────────────────────────────
 *
 *   pnpm brand
 *
 * Bug Crunch has no art folder, and the places that genuinely need a BITMAP
 * rather than a drawing are outside the renderer entirely:
 *
 *   • the LOCKUP — the wordmark the splash shows, the PWA manifest's `any`
 *     icons, and every portal's store page, read at fixed sizes from disk;
 *   • the MARK — the same identity reduced to ONE object on a tile, which is
 *     what the favicon, the apple-touch icon and the manifest's `maskable`
 *     icons need;
 *   • the SPLASH MASCOT — the ant that greets a first-time player.
 *
 * All rendered here from SVG through sharp, so they are reproducible, they are
 * in the repo's own hand, and they can be regenerated the moment the wordmark
 * changes. When the art pipeline produces a painted logo or mascot
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
 *   node scripts/make-brand.mjs                    # fill in whatever is missing
 *   node scripts/make-brand.mjs --force            # rewrite everything
 *   node scripts/make-brand.mjs --force --only logo,favicon
 *                                                  # …or only what you meant
 *
 * `--only` exists because `--force` is otherwise all-or-nothing, and the one
 * thing a wordmark refresh must NOT do is take the painted mascot with it. Its
 * arguments are substrings matched against the output paths.
 *
 * ─── Two artefacts, one identity ────────────────────────────────────────────
 *
 * A wordmark that works at 512 px is mud at 16 px: at a favicon's size "BUG
 * CRUNCH" is nine strokes of grey, and no amount of weight fixes it, because
 * the problem is that there is no room for nine letters. So there are two
 * drawings and they share their parts:
 *
 *   LOCKUP (`logoSvg`) — the gilded sole coming down, and BUG over CRUNCH set
 *     in the game's own display face. Used at 192/256/512 for the splash, the
 *     manifest's `any` icons and the portal store pages.
 *   MARK (`markSvg`) — the SAME sole, on the SAME splat, alone on a warm ink
 *     tile. No letters at all. Used for the favicon (16/32/48), the apple-touch
 *     icon and the manifest's `maskable` icons.
 *
 * They are one identity because `sole()` and `splat()` are literally the same
 * functions in both — the mark is the lockup with the words taken out and the
 * remaining object made to fill the frame — so a change to the silhouette
 * lands on the favicon and the splash in the same run.
 *
 * ─── The lettering ─────────────────────────────────────────────────────────
 *
 * `GLYPH` below holds the outlines of B U G C R N H, lifted from the game's own
 * display face (`src/assets/css/font/angrybirds-regular.ttf`, the `Angry`
 * @font-face in `src/assets/css/fonts.sass`) and frozen as path data. Not
 * `<text>`: librsvg resolves a font family against the MACHINE's installed
 * fonts, and `Angry` is not installed on anybody's machine — it is a file in
 * this repo. A `<text>` element would silently render in Arial on one dev's
 * box and DejaVu on CI, which is the one failure mode a brand generator cannot
 * have. Outlines are the same letterforms everywhere, forever.
 *
 * The SPLASH TILE is not written here at all. `pnpm art:bg-tile` derives it from
 * the paintings themselves, which is a thing an SVG in this file cannot do; see
 * `tools/bg-tile.mjs`.
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
// The same values the game draws with — `INK` and the goo/gold/lime fills are
// `src/game/inkArt.ts`'s and the renderer's. Change them together.
//
// INK is a warm near-black, never `#000`: pure black reads as vector clip-art,
// and everything in Bug Crunch is meant to look drawn.
const INK = '#2b1b2e'
const GOO = '#ff3f86'
const GOO_2 = '#ff6eaa'
const GOLD = '#ffcd00'
const GOLD_2 = '#f7a000'
const GOLD_HI = '#fff3b0'
const LIME = '#8ce35a'
const LIME_2 = '#b6f27f'
/** The tile the mark sits on: INK lifted just off black, and INK pushed under
 *  it, so the ground itself carries the same upper-left key light as the art. */
const TILE_HI = '#402a46'
const TILE_LO = '#1b1020'

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

// ─── The sole ───────────────────────────────────────────────────────────────
//
// The game's verb, as one object: the Gilded Boot's tread coming down, toe up.
// Authored in a 1×1 box centred on the origin so both drawings scale the SAME
// geometry — this function is the reason the favicon and the splash are the
// same brand rather than two that resemble each other.
//
/** The outline, in a unit box: width 0.46, height 0.60, origin at its centre.
 *  Wide rounded forefoot, a waist, a smaller oval heel — a sole read from above.
 *  Nearly square on purpose: everything here has to survive being resampled to
 *  16 px, and a silhouette survives on its NARROWEST axis. An anatomically
 *  honest sole is 1:2.4 and turns into a stripe. */
const SOLE_D = 'M 0 -0.300'
  + ' C 0.120 -0.300 0.215 -0.255 0.219 -0.170'
  + ' C 0.222 -0.100 0.185 -0.040 0.160 0.010'
  + ' C 0.140 0.050 0.128 0.075 0.130 0.110'
  + ' C 0.133 0.160 0.168 0.180 0.168 0.220'
  + ' C 0.168 0.272 0.092 0.300 0 0.300'
  + ' C -0.092 0.300 -0.168 0.272 -0.168 0.220'
  + ' C -0.168 0.180 -0.133 0.160 -0.130 0.110'
  + ' C -0.128 0.075 -0.140 0.050 -0.160 0.010'
  + ' C -0.185 -0.040 -0.222 -0.100 -0.219 -0.170'
  + ' C -0.215 -0.255 -0.120 -0.300 0 -0.300 Z'

/**
 * The tread: two lime BARS on the forefoot and one oval on the heel.
 *
 * Dots were the first try and they are a trap — two on the forefoot over one on
 * the heel is a pair of eyes over a mouth, and once seen the sole is a face
 * forever. Bars read as tread at every size, and three of them are still three
 * distinct marks at 48 px where five studs are one grey smear.
 *
 * `[x, y, halfWidth, halfHeight]` in the same unit box the outline uses.
 */
const SOLE_TREAD = [
  [0, -0.196, 0.140, 0.050],
  [0, -0.072, 0.112, 0.040],
  [0, 0.205, 0.098, 0.048]
]

/** The arch groove: the waist of a real sole is a step, not a colour change,
 *  and one ink line across it is what stops the silhouette reading as a peanut. */
const SOLE_GROOVE = [0.048, 0.125]

/**
 * The sole, ready to drop into either drawing.
 *
 * Lit from the upper left like everything else in the game: the gold ramp does
 * the body, and a clipped copy of the silhouette pushed down-right leaves a
 * bright rim along the top-left edge. Derived from the outline rather than
 * authored beside it, so the highlight cannot drift out of register when the
 * silhouette changes.
 *
 * @param size    the height of the sole in user units
 * @param opts.ink    outline width, in user units
 * @param opts.tread  draw the tread (off below ~32 px, where it is noise)
 */
let soleSeq = 0
const sole = (size, { ink, tread = true } = {}) => {
  const k = size / 0.60
  const n = (v) => (v * k).toFixed(2)
  const scaled = (d) => d.replace(/-?\d*\.?\d+/g, (m) => n(parseFloat(m)))
  const d = scaled(SOLE_D)
  const id = `soleClip${soleSeq++}`
  const lift = (0.035 * k).toFixed(2)
  const bars = tread
    ? SOLE_TREAD.map(([x, y, hw, hh]) =>
      `<rect x="${n(x - hw)}" y="${n(y - hh)}" width="${n(hw * 2)}" height="${n(hh * 2)}" rx="${n(hh)}"`
      + ` fill="${LIME}" stroke="${INK}" stroke-width="${(ink * 0.55).toFixed(2)}"/>`)
      .join('')
    : ''
  return `<g>
    <clipPath id="${id}"><path d="${d}"/></clipPath>
    <path d="${d}" fill="url(#gold)"/>
    <g clip-path="url(#${id})">
      <rect x="${n(-0.4)}" y="${n(-0.4)}" width="${n(0.8)}" height="${n(0.8)}" fill="${GOLD_HI}"/>
      <path d="${d}" transform="translate(${lift} ${lift})" fill="url(#gold)"/>
    </g>
    ${bars}
    <path d="M ${n(-SOLE_GROOVE[1])} ${n(SOLE_GROOVE[0] - 0.022)} Q 0 ${n(SOLE_GROOVE[0] + 0.030)} ${n(SOLE_GROOVE[1])} ${n(SOLE_GROOVE[0] - 0.022)}"
          fill="none" stroke="${INK}" stroke-width="${(ink * 0.7).toFixed(2)}" stroke-linecap="round" opacity="0.8"/>
    <path d="${d}" fill="none" stroke="${INK}" stroke-width="${ink.toFixed(2)}" stroke-linejoin="round"/>
  </g>`
}

// ─── The lettering ──────────────────────────────────────────────────────────
//
// Outlines from `angrybirds-regular.ttf` (unitsPerEm 2048, y-up flipped to
// SVG's y-down, so caps run from y≈-1640 to the baseline at y=0). `a` is the
// advance width. See the header for why these are frozen path data rather than
// a `<text>` element.
//
// To re-extract after a font change: walk `loca`/`glyf` for the glyph ids the
// `cmap` gives for B U G C R N H, emit each contour as M/L/Q with y negated.

const GLYPH_UPM = 2048

const GLYPH = {
  B: { a: 1185, d: 'M63 -1567Q210 -1614 379 -1632Q455 -1640 526 -1641Q614 -1641 696 -1628Q782 -1616 852 -1588.5Q922 -1561 972 -1518Q1022 -1475 1049.5 -1414.5Q1077 -1354 1077 -1272Q1077 -1247 1066 -1205Q1055 -1163 1025 -1112Q995 -1061 945 -1002.5Q895 -944 819 -885Q936 -826 1004.5 -764Q1073 -702 1106 -643Q1139 -584 1143 -528Q1144 -512 1144 -497Q1144 -459 1137 -426Q1117 -342 1040 -263Q963 -184 858.5 -117.5Q754 -51 635 0Q516 51 416 80Q410 64 401.5 43.5Q393 23 383 -16L262 25L225 -51L131 -25L131 -1229L92 -1282L188 -1341L74 -1423L119 -1483L63 -1567ZM406 -911Q480 -931 537 -959Q594 -987 638 -1017Q682 -1047 710.5 -1075.5Q739 -1104 754 -1126Q785 -1175 785 -1215Q785 -1238 774 -1257Q745 -1310 684 -1339Q633 -1362 565 -1362Q559 -1362 554 -1362Q479 -1360 393 -1319Q389 -1251 389 -1149Q389 -1047 406 -911ZM414 -199Q492 -232 564.5 -264.5Q637 -297 692.5 -337Q748 -377 778 -427Q804 -469 804 -521Q804 -531 803 -543Q797 -606 752 -639Q707 -672 646 -681Q617 -685 588 -685Q555 -685 520 -680Q454 -670 410 -649Q406 -618 403.5 -570Q401 -522 401 -464Q401 -406 403.5 -337Q406 -268 414 -199Z' },
  U: { a: 1169, d: 'M63 -803Q63 -909 69.5 -1028Q76 -1147 83 -1254.5Q90 -1362 98 -1446Q106 -1530 111 -1571L139 -1585L184 -1526L238 -1581L293 -1409L397 -1546Q387 -1468 378 -1364Q369 -1260 363.5 -1145Q358 -1030 357 -914Q357 -900 357 -886Q357 -786 364 -697Q371 -596 386 -516Q401 -436 428 -397Q465 -344 508 -326Q543 -311 581 -311Q589 -311 598 -311Q645 -315 693 -333.5Q741 -352 786 -373Q786 -457 785 -567.5Q784 -678 784 -799Q784 -920 783 -1042.5Q782 -1165 782 -1272L782 -1459L782 -1579L817 -1599L907 -1409L985 -1583Q1001 -1581 1033 -1577Q1065 -1573 1087 -1571Q1087 -1516 1088.5 -1412.5Q1090 -1309 1090 -1175L1090 -887Q1090 -733 1087.5 -576.5Q1085 -420 1082 -271.5Q1079 -123 1075 0L1051 14L975 -139L899 -2L834 -18L825 -102Q731 -53 634 -22.5Q537 8 452 17Q414 21 379 22Q337 22 301 15Q235 4 209 -27Q139 -107 101 -308.5Q63 -510 63 -803Z' },
  G: { a: 1161, d: 'M59 -721Q59 -734 59 -748Q59 -861 75 -968Q92 -1088 131 -1194Q170 -1300 227 -1376Q290 -1460 395 -1509.5Q500 -1559 614 -1577Q690 -1589 765 -1589Q802 -1589 838 -1586Q947 -1577 1018 -1546L1024 -1516L846 -1473L983 -1397L926 -1341Q930 -1327 931 -1315Q932 -1303 936 -1290Q920 -1290 904.5 -1291Q889 -1292 872 -1292Q819 -1292 764 -1287Q709 -1282 655.5 -1267.5Q602 -1253 554 -1227.5Q506 -1202 467 -1161Q412 -1102 388 -999Q366 -905 366 -802Q366 -793 367 -784Q369 -671 395.5 -567Q422 -463 469 -401Q502 -356 558 -346Q598 -339 639 -339Q655 -339 672 -340Q738 -346 811 -365L797 -778L821 -788L893 -670L967 -831L1018 -803L1057 -819L1073 66L1034 41L993 88L928 -41L864 68L836 61L827 -68Q753 -50 677 -37Q606 -26 539 -26Q533 -26 528 -26Q456 -27 392 -45Q328 -63 279 -106Q207 -167 160 -264.5Q113 -362 87 -478Q61 -594 59 -721Z' },
  C: { a: 989, d: 'M58 -729Q61 -827 70 -913Q78 -1011 108.5 -1115Q139 -1219 190.5 -1309Q242 -1399 314.5 -1469.5Q387 -1540 481 -1575Q559 -1603 651 -1603Q660 -1603 670 -1603Q772 -1600 897 -1546L905 -1507L778 -1438L889 -1331L819 -1296L858 -1229Q815 -1241 769 -1247Q734 -1252 700 -1252L677 -1251Q631 -1249 587 -1236Q543 -1223 506 -1192Q465 -1159 433 -1088.5Q401 -1018 381.5 -930Q362 -842 356 -743Q354 -708 354 -675Q354 -613 361 -556Q372 -467 404 -397.5Q436 -328 489 -297Q520 -279 564 -273Q595 -269 628 -270Q641 -270 654 -270Q700 -272 745.5 -279.5Q791 -287 827 -295Q823 -285 822 -272.5Q821 -260 817 -248Q813 -234 811 -219L909 -172L754 -70L887 -35L870 2Q780 35 675 42Q648 44 621 44Q544 44 470 29Q371 9 288 -40.5Q205 -90 162 -170Q119 -248 96.5 -341Q74 -434 65 -532Q58 -606 58 -680Q57 -704 58 -729Z' },
  R: { a: 1187, d: 'M61 -1401L109 -1466L94 -1481Q88 -1489 81 -1498Q74 -1507 70 -1520Q154 -1545 269.5 -1566Q385 -1587 506 -1593Q544 -1595 582 -1595Q663 -1595 741 -1586Q856 -1573 940 -1528Q1042 -1473 1086 -1362Q1120 -1276 1121 -1178Q1121 -1151 1118 -1123Q1106 -995 1039.5 -870Q973 -745 854 -664Q891 -584 938 -486.5Q985 -389 1029 -300Q1073 -211 1106 -144.5Q1139 -78 1149 -59L1120 -33L950 -154L981 -4L924 -20L891 16L559 -528L387 -485Q381 -381 377 -289Q375 -250 373 -210Q371 -170 370 -135Q369 -100 368 -71.5Q367 -43 367 -29L348 -14L268 -133L219 -4L147 -90L123 -68Q123 -127 122 -212Q121 -297 121 -395.5Q121 -494 120 -600.5Q119 -707 119 -812L119 -1017L119 -1200L82 -1235L219 -1356L61 -1401ZM391 -754Q457 -772 529.5 -797.5Q602 -823 663.5 -861Q725 -899 766 -950Q807 -1001 811 -1073Q811 -1081 811 -1090Q811 -1160 779 -1202Q743 -1249 683 -1268Q638 -1282 584 -1282Q566 -1282 548 -1280Q473 -1274 401 -1253Q399 -1130 395 -1006.5Q391 -883 391 -754Z' },
  N: { a: 1157, d: 'M92 -10L125 -1589L188 -1602L317 -1454L377 -1612L401 -1599L782 -809L838 -827L842 -1563L883 -1534L926 -1589L995 -1487L1075 -1589L1057 -10L1040 -4L961 -160L909 2L860 -29L821 -6L422 -846L377 -842L350 4L322 16L248 -109L174 -2L143 -23L92 -10Z' },
  H: { a: 1230, d: 'M90 35L115 -1571L154 -1559L190 -1587L264 -1430L354 -1591L401 -1583L395 -979L856 -993L868 -1597L915 -1610L975 -1460L1061 -1606L1120 -1559L1157 -1575L1122 25L1075 57L1028 -139L969 33L899 -12L864 4L866 -608L381 -584L360 -4L305 -18L252 45L186 -98L117 43L90 35Z' }
}

/** Shift every coordinate pair in a path by (dx, dy). The extracted data is
 *  absolute M/L/Q/Z only, so the numbers alternate x, y and nothing else. */
const shiftPath = (d, dx, dy) => {
  let i = 0
  return d.replace(/-?\d*\.?\d+/g, (m) => {
    const v = parseFloat(m) + (i++ % 2 === 0 ? dx : dy)
    return String(Math.round(v * 100) / 100)
  })
}

/** The tight box of a path, from its coordinates. Q control points can sit a
 *  hair outside the true curve, which makes this very slightly generous — the
 *  right direction for centring a logo. */
const pathBox = (d) => {
  const nums = d.match(/-?\d*\.?\d+/g).map(Number)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < nums.length; i += 2) {
    const x = nums[i]
    const y = nums[i + 1]
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
}

/**
 * One word as a single path, in font units.
 *
 * `track` tightens the default advances — display lettering at logo size wants
 * less air between letters than the same face at 14 px body size, and the
 * negative value here is what keeps CRUNCH from reading as six separate marks.
 */
const word = (text, track = -0.045) => {
  let x = 0
  let d = ''
  for (const ch of text) {
    const g = GLYPH[ch]
    if (!g) throw new Error(`make-brand: no outline for '${ch}' — extract it from the font first`)
    d += shiftPath(g.d, x, 0)
    x += g.a + track * GLYPH_UPM
  }
  return { d, box: pathBox(d) }
}

/**
 * Set a word into a box, in the house style.
 *
 * Three passes, which is the whole recipe for a cartoon wordmark:
 *   1. an INK copy, pushed DOWN — the extrusion the letters stand on;
 *   2. the gold copy with its own fat ink outline;
 *   3. a cream gloss clipped to the top of the letters, because the key light
 *      is upper-left and a flat gold fill reads as a printed sticker.
 *
 * The gloss goes UNDER the contour, not over it. A stroke is centred on its
 * path, so its inner half lies inside the fill — glossing on top of that half
 * lightens the ink itself and the letters come back silver instead of gold.
 *
 * @param targetW  the ink's width, in user units (height follows the aspect)
 * @param ink      contour width. Scales WITH the word: a contour is part of a
 *                 letterform, so the smaller line wants a thinner one or its
 *                 counters fill in and the gold is a ribbon.
 * @param drop     the extrusion's depth. The same for every line, because it
 *                 is not part of the letterform — it is how far the one slab
 *                 stands off the one ground under the one lamp, and a deeper
 *                 shadow on the bigger word reads as two separate logos.
 */
let glossSeq = 0
const setWord = (text, { cx, cy, targetW, ink, drop, tilt = 0 }) => {
  const { d, box } = word(text)
  const k = targetW / box.w
  const tx = cx - (box.x0 + box.w / 2) * k
  const ty = cy - (box.y0 + box.h / 2) * k
  const swLocal = (ink / k).toFixed(0)
  const clipId = `gloss${glossSeq++}`
  const place = (dy) => `translate(${(tx).toFixed(1)} ${(ty + dy).toFixed(1)}) scale(${k.toFixed(5)})`
  return `<g transform="rotate(${tilt} ${cx.toFixed(1)} ${cy.toFixed(1)})">
    <defs>
      <clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">
        <rect x="${(box.x0 - 500).toFixed(0)}" y="${(box.y0 - 500).toFixed(0)}"
              width="${(box.w + 1000).toFixed(0)}" height="${(box.h * 0.36 + 500).toFixed(0)}"/>
      </clipPath>
    </defs>
    <g transform="${place(drop)}">
      <path d="${d}" fill="${INK}" stroke="${INK}" stroke-width="${swLocal}" stroke-linejoin="round" stroke-linecap="round"/>
    </g>
    <g transform="${place(0)}">
      <path d="${d}" fill="url(#gold)"/>
      <g clip-path="url(#${clipId})">
        <path d="${d}" fill="#fff6c8" opacity="0.55"/>
      </g>
      <path d="${d}" fill="none" stroke="${INK}" stroke-width="${swLocal}" stroke-linejoin="round" stroke-linecap="round"/>
    </g>
  </g>`
}

// ─── Shared defs ────────────────────────────────────────────────────────────
//
// One gold ramp, one tile ramp, both lit from the upper left — the same lamp
// `SHADOW_DIR` in `src/game/inkArt.ts` points the renderer's shadows away from.

const DEFS = `<defs>
    <linearGradient id="gold" x1="0.15" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#ffe680"/><stop offset="0.42" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_2}"/>
    </linearGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="${TILE_HI}"/><stop offset="1" stop-color="${TILE_LO}"/>
    </linearGradient>
  </defs>`

/** The splat the sole is coming down on — pink burst, lime under-spatter, a few
 *  flung drops. Shared shape language with the lockup and the mark. */
const splat = (cx, cy, r, { drops = true } = {}) => {
  const fingers = [0.3, 1.1, 2.0, 2.9, 3.8, 4.7, 5.6]
    .map((a, i) => `<path d="${fingerPath(cx, cy, a, r * (0.98 + (i % 3) * 0.17), r * 0.185)}" fill="${GOO}"/>`)
    .join('')
  const limeFingers = [0.75, 2.45, 4.2, 5.2]
    .map((a, i) => `<path d="${fingerPath(cx, cy, a, r * (1.02 + (i % 2) * 0.22), r * 0.13)}" fill="${LIME}"/>`)
    .join('')
  const flung = drops
    ? [[1.30, -1.18, 0.135], [-1.36, 0.86, 0.105], [1.02, 1.26, 0.085], [-1.05, -1.22, 0.075], [0.15, -1.45, 0.06]]
      .map(([dx, dy, rr], i) => `<circle cx="${(cx + dx * r).toFixed(1)}" cy="${(cy + dy * r).toFixed(1)}" r="${(rr * r).toFixed(1)}" fill="${i % 2 ? LIME_2 : GOO_2}"/>`)
      .join('')
    : ''
  // The ink contour is drawn on the OUTER shapes only, as a fat stroke UNDER
  // their own fills — so the fingers and the blob share one silhouette line
  // instead of each carrying a visible seam where they overlap.
  const outline = `<g fill="none" stroke="${INK}" stroke-width="${(r * 0.085).toFixed(1)}" stroke-linejoin="round">
      ${[0.3, 1.1, 2.0, 2.9, 3.8, 4.7, 5.6].map((a, i) => `<path d="${fingerPath(cx, cy, a, r * (0.98 + (i % 3) * 0.17), r * 0.185)}"/>`).join('')}
      <path d="${splatPath(cx, cy, r, 7)}"/>
    </g>`
  return `${outline}${limeFingers}${fingers}
    <path d="${splatPath(cx, cy, r, 7)}" fill="${GOO}"/>
    <path d="${splatPath(cx, cy, r * 0.70, 13)}" fill="${GOO_2}" opacity="0.9"/>
    ${flung}`
}

// ─── The lockup ─────────────────────────────────────────────────────────────
//
// Square, because every consumer of it is a square slot: the manifest's 192/512,
// the portals' store tiles, and the splash card in `index.html` /
// `FLogoProgress.vue`, which both show the file as a 1:1 box.
//
// The ink is laid out to fill that square with a small even margin, so neither
// splash needs a measured crop — a crop is a constant that has to be
// re-measured every time the art changes, and the one thing this generator can
// guarantee is where it put the ink. `tests/ui/brandLockup.test.ts` pins it.

const logoSvg = (S) => {
  const u = (v) => v * S
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  ${DEFS}

  <!-- The splat, behind everything: wide enough that it reads as a burst the
       words are standing in, rather than pink peeking out between two lines. -->
  <g>${splat(u(0.5), u(0.555), u(0.315))}</g>

  <!-- The sole coming down, toe up, tilted out of square so it reads as
       mid-swing rather than parked. -->
  <g transform="translate(${u(0.5).toFixed(1)} ${u(0.205).toFixed(1)}) rotate(-15)">
    ${sole(u(0.280), { ink: u(0.021) })}
  </g>

  <!-- BUG over CRUNCH. Both words are set to the SAME ink width, which is what
       squares off a two-line wordmark: the short word simply gets a bigger cap
       height, and the block reads as one solid shape instead of a long line
       with a stub over it. -->
  ${setWord('BUG', { cx: u(0.5), cy: u(0.485), targetW: u(0.50), ink: u(0.030), drop: u(0.016), tilt: -2.6 })}
  ${setWord('CRUNCH', { cx: u(0.5), cy: u(0.765), targetW: u(0.800), ink: u(0.025), drop: u(0.016), tilt: 1.4 })}
</svg>`
}

// ─── The mark ───────────────────────────────────────────────────────────────
//
// The favicon problem, solved by not trying: no letters. One gilded sole on one
// pink splat on one warm ink tile, which at 16 px is still three distinguishable
// things — a dark rounded square, a hot pink burst, a gold slab — and at 512 px
// is the lockup's own hero object at full detail.
//
// @param opts.bleed  fill the frame corner to corner (apple-touch / maskable,
//                    where the OS supplies the rounding and would otherwise
//                    round OUR rounding a second time). Off → rounded tile with
//                    transparent corners, which is what a browser tab wants.
// @param opts.inset  how much of the frame the CONTENT may use. Maskable icons
//                    are cropped to a circle of 80% diameter, so their content
//                    has to stop well short of the edge.
// @param opts.tread  tread on/off. Off below 48 px: it is not just invisible
//                    there, it dilutes the gold a 16 px downsample has to find.

const markSvg = (S, { bleed = false, inset = 1, tread = true } = {}) => {
  const u = (v) => v * S
  const pad = bleed ? 0 : 0.045
  const tile = bleed
    ? `<rect x="0" y="0" width="${S}" height="${S}" fill="url(#tile)"/>`
    : `<rect x="${u(pad).toFixed(1)}" y="${u(pad).toFixed(1)}" width="${u(1 - pad * 2).toFixed(1)}" height="${u(1 - pad * 2).toFixed(1)}" rx="${u(0.215).toFixed(1)}" fill="url(#tile)"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  ${DEFS}
  ${tile}
  <g transform="translate(${(S / 2).toFixed(1)} ${(S / 2).toFixed(1)}) scale(${inset.toFixed(3)})">
    <g>${splat(0, 0, u(0.290), { drops: false })}</g>
    <g transform="rotate(-18)">
      ${sole(u(0.560), { ink: u(0.036), tread })}
    </g>
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
  const splatMark = `<path d="${splatPath(0, 0, r * 1.25, 21)}" fill="#ffffff"/>`

  // A sole, from above — the same unit outline the mark and the lockup use.
  const shoe = `<g fill="#ffffff">
    <path d="${SOLE_D.replace(/-?\d*\.?\d+/g, (m) => (parseFloat(m) * r * 4.8).toFixed(1))}"/>
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
  stamp(q * 4.0, q * 0.5, splatMark)
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

// ─── The .ico container ─────────────────────────────────────────────────────
//
// A real multi-size ICO, not a PNG with the extension swapped. The previous
// generator shipped one 32 px PNG called `favicon.ico`; every browser we ship to
// does render that, but it has to RESAMPLE it to 16 px in the tab strip, and a
// 32→16 box filter on a detailed mark is exactly the mud this redesign exists
// to fix. Three renditions, each rasterised from the SVG at its own size, let
// the browser pick instead of guess.
//
// Entries are uncompressed 32-bit DIBs rather than embedded PNGs. PNG-in-ICO is
// fine in every modern browser, but DIB is fine in every browser AND in
// Explorer, the Windows taskbar, and whatever a portal's back office uses to
// make a thumbnail — and at these sizes the whole file is still ~15 KB.
const icoFromRgba = (images) => {
  const dibs = images.map(({ size, data }) => {
    const rowBytes = size * 4
    const xor = Buffer.alloc(rowBytes * size)
    // A DIB is bottom-up, and its pixel order is BGRA.
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * rowBytes
      for (let x = 0; x < size; x++) {
        const s = src + x * 4
        const d = y * rowBytes + x * 4
        xor[d] = data[s + 2]
        xor[d + 1] = data[s + 1]
        xor[d + 2] = data[s]
        xor[d + 3] = data[s + 3]
      }
    }
    // The AND mask: 1 bpp, rows padded to 4 bytes, bottom-up, set where the
    // pixel is transparent. 32-bit DIBs carry their own alpha and most
    // consumers ignore this, but a wrong one shows as a black box in the ones
    // that do not.
    const maskRow = Math.ceil(size / 8 / 4) * 4
    const and = Buffer.alloc(maskRow * size, 0)
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * rowBytes
      for (let x = 0; x < size; x++) {
        if (data[src + x * 4 + 3] === 0) and[y * maskRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
    const header = Buffer.alloc(40)
    header.writeUInt32LE(40, 0)
    header.writeInt32LE(size, 4)
    header.writeInt32LE(size * 2, 8) // XOR + AND, stacked
    header.writeUInt16LE(1, 12)
    header.writeUInt16LE(32, 14)
    header.writeUInt32LE(0, 16)
    header.writeUInt32LE(xor.length + and.length, 20)
    return { size, body: Buffer.concat([header, xor, and]) }
  })

  const dir = Buffer.alloc(6 + dibs.length * 16)
  dir.writeUInt16LE(0, 0)
  dir.writeUInt16LE(1, 2)
  dir.writeUInt16LE(dibs.length, 4)
  let offset = dir.length
  dibs.forEach((d, i) => {
    const o = 6 + i * 16
    dir.writeUInt8(d.size === 256 ? 0 : d.size, o)
    dir.writeUInt8(d.size === 256 ? 0 : d.size, o + 1)
    dir.writeUInt8(0, o + 2)
    dir.writeUInt8(0, o + 3)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(d.body.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += d.body.length
  })
  return Buffer.concat([dir, ...dibs.map((d) => d.body)])
}

// ─── Write ──────────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2)
if (ARGS.includes('--help') || ARGS.includes('-h')) {
  console.log(`usage: node scripts/make-brand.mjs [--force] [--only a,b] [--list]

  --force        rewrite files that already exist (default: keep them, because
                 the file on disk is probably a painting from the art pipeline)
  --only a,b     restrict the run to output paths containing any of these
                 substrings — e.g. --only logo,favicon leaves the painted
                 mascot alone while the wordmark is refreshed
  --list         print the outputs and exit`)
  process.exit(0)
}
const FORCE = ARGS.includes('--force')
/** Build `favicon.ico` by resampling this PNG instead of the mark SVG — the
 *  painted route. See the favicon branch in `run()`. */
const ICO_FROM = ARGS.includes('--ico-from') ? ARGS[ARGS.indexOf('--ico-from') + 1] : null
const onlyArg = ARGS.find((a) => a.startsWith('--only'))
const ONLY = (onlyArg?.includes('=') ? onlyArg.split('=')[1] : ARGS[ARGS.indexOf('--only') + 1] ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean)

/** Written files, skipped ones, and ones `--only` filtered out. */
const wrote = []
const kept = []
const skipped = []

/** True when this path should be (re)written. See the header: a file already on
 *  disk is very likely a painting, and a placeholder must never replace one. */
const claim = (path) => {
  if (ONLY.length && !ONLY.some((s) => path.includes(s))) {
    skipped.push(path)
    return null
  }
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

/**
 * Every bitmap this script owns, in one list so `--list` and the run agree.
 *
 * `logo_*` is the LOCKUP and `mark_*` is the MARK — see the header. The
 * `images/icons/` copies mirror `images/logo/` because `artSheet.ts` names them
 * as slice targets for the painted logo.
 */
const OUTPUTS = [
  { path: 'public/images/logo/logo_512x512.png', kind: 'logo', size: 512 },
  { path: 'public/images/logo/logo_256x256.webp', kind: 'logo', size: 256 },
  { path: 'public/images/logo/logo_192x192.png', kind: 'logo', size: 192 },
  { path: 'public/images/icons/logo_512x512.png', kind: 'logo', size: 512 },
  { path: 'public/images/icons/logo_256x256.webp', kind: 'logo', size: 256 },
  { path: 'public/images/icons/logo_192x192.png', kind: 'logo', size: 192 },
  // The maskable pair. `inset` keeps the sole inside the 80 %-diameter circle
  // Android crops a maskable icon to; `bleed` fills the corners the OS will
  // round itself.
  { path: 'public/images/logo/mark_512x512.png', kind: 'mark', size: 512, opts: { bleed: true, inset: 0.72 } },
  { path: 'public/images/logo/mark_192x192.png', kind: 'mark', size: 192, opts: { bleed: true, inset: 0.72 } },
  // apple-touch-icon: a full square, opaque (iOS composites a transparent one
  // onto black and the ink tile would vanish into it), rounded by iOS itself.
  { path: 'public/images/logo/mark_180x180.png', kind: 'mark', size: 180, opts: { bleed: true, inset: 0.88 } },
  // The tab strip's PNG, for the browsers that prefer one to the .ico. Tread
  // OFF at this size — the same rule the .ico's own 32 px entry uses, so the
  // two renditions a browser may pick between at 32 px are the same drawing.
  { path: 'public/images/logo/mark_32x32.png', kind: 'mark', size: 32, opts: { tread: false } },
  { path: 'public/favicon.ico', kind: 'favicon' },
  { path: 'public/images/logo/mascot.webp', kind: 'mascot', size: 512 }
]

/**
 * ─── The art pipeline's reference sheets ────────────────────────────────────
 *
 *   node scripts/make-brand.mjs --references
 *
 * The lockup and the mark, each on the flat magenta ground every reference in
 * `art-sheets/` is laid on, at the size `artSheet.ts` declares for them.
 *
 * WHY THIS SCRIPT OWNS THEM. Every other reference is drawn by whatever draws
 * the thing at run time — a bug by `bugArt`, the chest by `uiArt.paintChest` —
 * because a reference that is a SECOND drawing of the subject is a reference
 * that drifts away from it. The brand's run-time drawing is this file: the
 * splash and the manifest read the bitmaps it emits, so the honest reference is
 * the same SVG those bitmaps are rasterised from, and nothing else can be.
 *
 * `ArtSheets.vue` therefore skips these two ids on export rather than rendering
 * its own. Its logo branch used to draw BUG CRUNCH as one line of 266 px type
 * across a 1024 panel — about 1050 px of advances before a 61 px stroke — so
 * the reference the painter worked from was clipped off both edges and was not
 * the lockup the game shows in any case.
 *
 * Always written, never claimed: a reference is regenerable by definition, and
 * the no-overwrite rule above exists to protect PAINTINGS.
 */
const REFERENCES = [
  { file: 'art-sheets/still-ui-logo.png', svg: () => logoSvg(1024), size: 1024 },
  { file: 'art-sheets/still-ui-mark.png', svg: () => markSvg(1024, { tread: true }), size: 1024 }
]

if (ARGS.includes('--references')) {
  const MAGENTA = { r: 255, g: 0, b: 255, alpha: 1 }
  await Promise.all(REFERENCES.map(async ({ file, svg, size }) => {
    const art = await sharp(Buffer.from(svg())).resize(size, size).png().toBuffer()
    const full = out(file)
    mkdirSync(dirname(full), { recursive: true })
    await sharp({ create: { width: size, height: size, channels: 4, background: MAGENTA } })
      .composite([{ input: art }])
      .png({ compressionLevel: 9 })
      .toFile(full)
    console.log(`  + ${file}  ${size}x${size}`)
  }))
  console.log('brand: reference sheets written. Repaint them with `pnpm art:desk`'
    + ' (stems still-ui-logo, still-ui-mark).')
  process.exit(0)
}

if (ARGS.includes('--list')) {
  for (const o of OUTPUTS) console.log(`${o.kind.padEnd(8)} ${o.path}`)
  process.exit(0)
}

const run = async () => {
  const logo = Buffer.from(logoSvg(1024))

  const render = async (o) => {
    const to = claim(o.path)
    if (!to) return
    if (o.kind === 'favicon') {
      // 16 / 32 / 48, each rasterised from the SVG at its own size rather than
      // resampled from one big one.
      //
      // The tread comes off below 48. It is not merely invisible at 32 — it is
      // ACTIVELY harmful, because a browser that shows a 16 px icon on a 1× tab
      // strip may downsample the 32 from either this file or `mark_32x32.png`,
      // and three lime bars averaged into a 16 px gold slab take the gold from
      // 15 % of the frame to 4 %. The mark stops being a gold object on pink and
      // becomes a mottled smudge. `tests/ui/brandLockup.test.ts` measures it.
      //
      // ── …unless the mark has been PAINTED ──
      //
      // `--ico-from <png>` builds the three entries by resampling one painting
      // instead of rasterising the SVG. It is not a convenience: once the art
      // pipeline has painted `mark_512x512.png`, every other slot the browser
      // and the OS read — `mark_32x32.png`, the apple-touch icon, both maskable
      // icons — is that painting, and a browser is free to pick between the .ico
      // and `mark_32x32.png` for the same 32 px tab. Two different marks in that
      // pair is worse than either one of them.
      //
      // Measured at 16 px, drawn against painted: gold 12.5 % -> 14.1 %, pink
      // 3.9 % -> 6.3 %, lime 0 % -> 4.7 %. The painting keeps more of the brand's
      // colour; the drawing keeps a cleaner silhouette. The tie is broken by the
      // consistency rule above, not by the numbers.
      const images = ICO_FROM
        ? await Promise.all([16, 32, 48].map(async (size) => ({
          size,
          data: await sharp(out(ICO_FROM)).resize(size, size).ensureAlpha().raw().toBuffer()
        })))
        : await Promise.all([16, 32, 48].map(async (size) => ({
          size,
          data: await sharp(Buffer.from(markSvg(size, { tread: size >= 48 })))
            .ensureAlpha().raw().toBuffer()
        })))
      writeFileSync(to, icoFromRgba(images))
      return
    }
    const svg = o.kind === 'mark'
      ? Buffer.from(markSvg(o.size, o.opts))
      : o.kind === 'mascot'
        ? Buffer.from(mascotSvg(o.size))
        : logo
    const pipe = o.kind === 'logo'
      ? sharp(svg).resize(o.size, o.size)
      : sharp(svg)
    await (o.path.endsWith('.webp')
      ? pipe.webp({ quality: 92, effort: 6 }).toFile(to)
      : pipe.png({ compressionLevel: 9 }).toFile(to))
  }

  await Promise.all(OUTPUTS.map(render))

  console.log(`brand: wrote ${wrote.length} file(s)${wrote.length ? `\n  + ${wrote.join('\n  + ')}` : ''}`)
  if (kept.length) {
    console.log(`  kept ${kept.length} file(s) that already exist (very likely painted — pass --force to replace):`)
    for (const k of kept) console.log(`  = ${k}`)
  }
  if (skipped.length) {
    console.log(`  --only ${ONLY.join(',')} skipped ${skipped.length} file(s):`)
    for (const s of skipped) console.log(`  - ${s}`)
  }
  console.log('  the splash tile is built by `pnpm art:bg-tile`, from the paintings.')
}

export { logoSvg, markSvg, mascotSvg, icoFromRgba, word, setWord, GLYPH, GLYPH_UPM }

// Only when run directly — the SVG builders are imported by `tests/ui/
// brandLockup.test.ts`, which must not trigger a write.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
