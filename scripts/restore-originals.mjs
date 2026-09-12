#!/usr/bin/env node
/**
 * restore-originals — when a folder was already compressed by another tool
 * (TinyPNG, an old pipeline …), recover the pristine sources from git so the
 * compressor works from single-generation originals instead of re-encoding
 * lossy files.
 *
 *   node scripts/restore-originals.mjs <dir> --commit <sha> [--backup-dir <dir>] [--apply] [--min-ssim 0.9]
 *
 * For every png/jpg/webp under <dir>, the version at <sha> qualifies as the
 * original when it (1) exists there, (2) is LARGER than the current file,
 * (3) has the same pixel size and (4) is the same drawing (SSIM ≥ --min-ssim,
 * default 0.9 — art that was redrawn between the commits scores far lower).
 * Qualifying versions are written as <backup>/<name>-original.<ext>, the
 * location compress-images.mjs reads with --force. Without --apply it only
 * prints the decision table.
 *
 * Finding the commit: the compressed files were swapped in by ONE commit
 * (`git log --oneline -- <dir>` and look for the size drop; TinyPNG leaves
 * `tinified.zip` next to the assets); the commit BEFORE it holds the inputs.
 *
 * Follow with:  node scripts/compress-images.mjs <dir> --backup-dir <dir> --force
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, relative, resolve, dirname, basename, extname } from 'node:path'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import { ssim } from 'ssim.js'

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: { commit: { type: 'string' }, 'backup-dir': { type: 'string' }, apply: { type: 'boolean', default: false }, 'min-ssim': { type: 'string', default: '0.9' }, help: { type: 'boolean' } },
})
if (opt.help || !positionals[0] || !opt.commit) {
  console.log('usage: restore-originals <dir> --commit <sha> [--backup-dir <dir>] [--apply] [--min-ssim 0.9]')
  process.exit(opt.help ? 0 : 1)
}
const DIR = resolve(positionals[0])
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: DIR, encoding: 'utf8' }).trim()
const BACKUP = opt['backup-dir'] ? resolve(opt['backup-dir']) : null
const MIN = Number(opt['min-ssim'])
const SUFFIX = '-original'

async function dec(b) { const { data, info } = await sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, height: info.height } }
function grey(img) { const n = img.width * img.height, o = new Uint8ClampedArray(n * 4), d = img.data; for (let i = 0; i < n * 4; i += 4) { const a = d[i + 3] / 255, g = 128 * (1 - a); o[i] = d[i] * a + g; o[i + 1] = d[i + 1] * a + g; o[i + 2] = d[i + 2] * a + g; o[i + 3] = 255 } return { data: o, width: img.width, height: img.height } }
function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) { if (!['node_modules', '.git', 'dist'].includes(f)) yield* walk(p) }
    else if (/\.(png|jpe?g|webp)$/i.test(f) && !basename(f, extname(f)).endsWith(SUFFIX)) yield p
  }
}
const backupPath = (file) => {
  const ext = extname(file), name = basename(file, ext) + SUFFIX + ext
  return BACKUP ? join(BACKUP, relative(DIR, dirname(file)), name) : join(dirname(file), name)
}

const rows = []
for (const file of walk(DIR)) {
  const rel = relative(DIR, file).replaceAll('\\', '/')
  const gitPath = relative(REPO, file).replaceAll('\\', '/')
  const cur = readFileSync(file)
  let old
  try { old = execFileSync('git', ['show', `${opt.commit}:${gitPath}`], { cwd: REPO, maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'ignore'] }) } catch { rows.push({ rel, verdict: 'keep', why: `not in ${opt.commit}` }); continue }
  if (old.length <= cur.length) { rows.push({ rel, verdict: 'keep', why: `${opt.commit} version not larger (${old.length} vs ${cur.length} bytes)` }); continue }
  let a, b
  try { a = await dec(old); b = await dec(cur) } catch (e) { rows.push({ rel, verdict: 'keep', why: `undecodable (${e.message})` }); continue }
  if (a.width !== b.width || a.height !== b.height) { rows.push({ rel, verdict: 'keep', why: `pixel size differs ${a.width}x${a.height} vs ${b.width}x${b.height}` }); continue }
  const s = ssim(grey(a), grey(b)).mssim
  if (s < MIN) { rows.push({ rel, verdict: 'keep', why: `different drawing (ssim ${s.toFixed(3)})` }); continue }
  rows.push({ rel, verdict: 'restore', why: `${(old.length / 1024).toFixed(1)} KB original vs ${(cur.length / 1024).toFixed(1)} KB current, ssim ${s.toFixed(4)}` })
  if (opt.apply) {
    const dest = backupPath(file)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, old)
  }
}
for (const r of rows.sort((x, y) => x.verdict.localeCompare(y.verdict) || x.rel.localeCompare(y.rel))) console.log(`${r.verdict.padEnd(8)} ${r.rel.padEnd(36)} ${r.why}`)
const n = rows.filter((r) => r.verdict === 'restore').length
console.log(`\n${opt.apply ? 'restored' : 'would restore'} ${n} of ${rows.length}${opt.apply && n ? `\nnext:  node scripts/compress-images.mjs ${positionals[0]}${BACKUP ? ` --backup-dir ${opt['backup-dir']}` : ''} --force` : ''}`)
