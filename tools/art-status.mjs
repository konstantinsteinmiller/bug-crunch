#!/usr/bin/env node
/**
 * Which painted drop-ins are actually on disk, and which are still drawings.
 *
 *   pnpm art:status              # a summary per kind, plus what is missing
 *   pnpm art:status -- --all     # list every id, present or not
 *
 * From the art-generation-pipeline skill (`templates/art-status.mjs`), adapted
 * to bug-crunch: the runtime catalogue (`ART_CATALOGUE`) lists the STILLS, while
 * the strips and the two rosters that are not stills are keyed by ids the
 * renderer takes from the game itself — the bug designs, the shoes and the
 * bosses — so those are read from the same modules the renderer reads.
 *
 * The question this answers is "I sliced the art and only half the game
 * changed". A miss is SILENT by design — `spriteFor` treats a 404 as "keep
 * drawing this one" so a portal never sees a broken build — which is right in
 * play and useless at the bench. Nothing here touches a browser.
 *
 * Run through the `--import` hook (the pnpm script does):
 *   node --import ./tools/ts-resolve.mjs tools/art-status.mjs
 */
import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')
const ALL = process.argv.includes('--all')
const load = (rel) => import(pathToFileURL(join(ROOT, 'src', ...rel.split('/'))).href)

const { ART_CATALOGUE, ART_BRAND, BUG_PART_ART_IDS } = await load('game/artCatalogue.ts')
const { ART_FOLDERS } = await load('game/art.ts')
const { BUG_IDS } = await load('game/bugs.ts')
const { SHOE_IDS } = await load('game/shoes.ts')
const { BOSS_IDS } = await load('game/bosses.ts')

const catalogue = {
  // The designs' walk strips, and the parts a design is composed from (the
  // centipede's tail segment) — both live in `images/bugs/`.
  bug: [...BUG_IDS, ...BUG_PART_ART_IDS],
  shoe: [...SHOE_IDS],
  boss: [...BOSS_IDS],
  ...ART_CATALOGUE
}
const artTarget = (kind, id) => `${ART_FOLDERS[kind]}/${id}.webp`

let present = 0
let absent = 0
const rows = []

for (const [kind, ids] of Object.entries(catalogue)) {
  const missing = []
  let here = 0
  let bytes = 0
  for (const id of ids) {
    const file = join(PUBLIC, artTarget(kind, id))
    if (existsSync(file)) {
      here++
      bytes += statSync(file).size
      if (ALL) rows.push(`  ✓ ${kind}/${id}`)
    } else {
      missing.push(id)
      if (ALL) rows.push(`  · ${kind}/${id}`)
    }
  }
  present += here
  absent += missing.length
  const kb = bytes > 0 ? ` — ${(bytes / 1024).toFixed(0)} kB` : ''
  console.log(`${here === ids.length ? '✓' : here === 0 ? '·' : '½'} ${kind.padEnd(8)} ${String(here).padStart(3)}/${ids.length}${kb}`)
  if (missing.length && !ALL) {
    // The whole point: name them. A kind that is half painted is the case that
    // looks like "the art layer is broken" and is really "these ten are not cut yet".
    const shown = missing.slice(0, 12).join(', ')
    console.log(`    missing: ${shown}${missing.length > 12 ? `, …and ${missing.length - 12} more` : ''}`)
  }
}

// The brand bitmaps are painted through the same pipeline and never probed — the
// splash and the PWA manifest read them straight off disk — so they are counted
// here rather than folded into a kind that `spriteFor` would then go looking for.
const brand = []
for (const [name, rel] of Object.entries(ART_BRAND)) {
  const file = join(PUBLIC, rel)
  const here = existsSync(file)
  brand.push(`${here ? '\u2713' : '\u00b7'} ${name.padEnd(8)} ${rel}`
    + (here ? ` \u2014 ${(statSync(file).size / 1024).toFixed(0)} kB` : ' \u2014 missing'))
}
console.log(`\nbrand (painted, never probed \u2014 a placeholder from \`node scripts/make-brand.mjs\` counts):`)
for (const line of brand) console.log(`  ${line}`)

if (ALL) console.log(rows.join('\n'))
console.log(`\n${present} painted, ${absent} still drawn, ${present + absent} in the catalogue.`)
if (absent) {
  console.log('A missing file is not an error: the renderer draws that one. It is only'
    + '\na surprise when you expected a painting — slice the sheet it belongs to,'
    + '\nthen reload the game (a 404 is remembered for the life of the page).')
}
