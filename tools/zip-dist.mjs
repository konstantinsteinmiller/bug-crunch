#!/usr/bin/env node
/**
 * ─── Pack a build folder into a REAL zip ────────────────────────────────────
 *
 *   node tools/zip-dist.mjs <dir> <out.zip>
 *   node tools/zip-dist.mjs dist dist/bug-crunch-poki.zip
 *
 * Every `build:<portal>` script used to end with the Windows idiom
 *
 *     cd dist && tar -a -cf ../game-portal.zip *
 *
 * which is correct under cmd.exe or PowerShell, where `tar` is Windows' bundled
 * **bsdtar** and `-a` picks the format from the `.zip` suffix. Run the same
 * script from Git Bash — or from any Node process whose PATH puts Git's
 * `/usr/bin` first, including one started from Git Bash — and `tar` is **GNU
 * tar**, whose `-a` knows gzip/bzip2/xz/zstd and not zip. It does not error. It
 * writes a plain TAR under the name `.zip`.
 *
 * Nothing downstream notices: the file is the right size, has the right name,
 * and `tar -tf` lists it happily, because it is a tar. The portal's uploader
 * takes it, spins, and answers "We couldn't read your zip file" — which reads
 * as a problem with the build and is really a problem with $PATH. It cost a
 * full upload round to find, and it was still live in all seven build scripts:
 * only `pnpm deploy:poki` packed correctly, because that one already went
 * through `tools/poki-deploy/lib/zip.mjs`.
 *
 * So this is that same writer, as a command the scripts can call. No shell, no
 * dependency, no ambiguity about which `tar` is on the PATH.
 *
 * The output is EXCLUDED from its own archive, so building twice in a row does
 * not pack the previous zip inside the new one — the usual consequence of
 * writing the archive into the folder it is archiving.
 */
import { basename, resolve } from 'node:path'
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { zipDir, inspectZip } from './poki-deploy/lib/zip.mjs'

const [dir, out] = process.argv.slice(2)

if (!dir || !out) {
  console.error('usage: node tools/zip-dist.mjs <dir> <out.zip>')
  process.exit(1)
}

const from = resolve(dir)
const to = resolve(out)

if (!existsSync(from)) {
  console.error(`zip-dist: ${dir} does not exist — run the build first.`)
  process.exit(1)
}

// A stale archive from a previous run would otherwise be walked into the new
// one before it is overwritten.
if (existsSync(to)) rmSync(to)

/**
 * ─── The favicon gate ───────────────────────────────────────────────────────
 *
 * `public/favicon.ico` is written by `scripts/make-brand.mjs` as three entries —
 * 16, 32 and 48 — and nothing else in this repo should ever write it. It was
 * found once carrying two non-square 128x118 entries instead, and the only
 * reason anybody noticed is that a test happened to read it. Neither `vite
 * build` nor the test suite reproduces that (both were hashed before and after),
 * so the writer is something outside this repo's own commands — which is exactly
 * the case a gate is for: whatever did it, the build must not pack the result.
 *
 * Note the near-miss that makes this worth gating rather than trusting: the
 * promotion pass (`pnpm art:promotion`) ALSO produces a file called
 * `favicon.ico`, at 128 px, for portal store pages. It writes it to
 * `src/assets/promotion/`, not here — but two files of the same name and
 * different contracts is one copy-paste away from shipping the wrong one.
 */
const favicon = resolve(from, 'favicon.ico')
if (existsSync(favicon)) {
  const b = readFileSync(favicon)
  const count = b.length >= 6 ? b.readUInt16LE(4) : 0
  const sizes = []
  for (let i = 0; i < count; i++) sizes.push(b.readUInt8(6 + i * 16) || 256)
  const want = [16, 32, 48]
  if (sizes.length !== want.length || sizes.some((s, i) => s !== want[i])) {
    console.error(
      `zip-dist: ${dir}/favicon.ico carries [${sizes.join(', ')}] — expected [${want.join(', ')}].\n`
      + '  Something overwrote it. Rebuild it from the painted mark and build again:\n'
      + '    node scripts/make-brand.mjs --force --only favicon '
      + '--ico-from public/images/logo/mark_512x512.png'
    )
    process.exit(1)
  }
}

const outName = basename(to)
zipDir(from, to, { exclude: (name) => name === outName || name.endsWith('.zip') })

const info = inspectZip(to)
const kb = (statSync(to).size / 1024).toFixed(0)
console.log(`zip-dist: ${out}  ${kb} kB, ${info.entries ?? '?'} entries`)

// The whole point of this file: prove the bytes are a zip rather than trusting
// the extension that fooled everyone last time.
if (!info.ok) {
  console.error(`zip-dist: ${out} is NOT a valid zip — ${info.why ?? 'unknown'}`)
  process.exit(1)
}
