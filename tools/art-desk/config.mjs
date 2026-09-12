/**
 * Where things are. The defaults are the layout the art-generation-pipeline
 * skill scaffolds, so a project built on it needs no config at all; anything
 * else goes in `art-desk.config.json` at the project root, e.g.
 *
 *   {
 *     "sheetsDir": "art/sheets",
 *     "compress": null,                      // no compressor in this project
 *     "gemini": { "gapSeconds": 180, "dailyCap": 20 }
 *   }
 *
 * Commands are argv arrays run from the project root. `node` means the Node
 * running the desk. Placeholders: {painting} is the painted file, {files} the
 * comma-joined list of files the slicer just wrote, {compressRoot} the folder
 * the compressor keys its backups by. A command set to null is skipped.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const DEFAULTS = {
  sheetsDir: 'art-sheets',
  paintedDir: 'art-sheets/painted',
  indexFile: 'art-sheets/sheet-index.json',
  // Where the slicer's `target` paths are relative to.
  outDir: 'public',
  slice: ['node', 'tools/slice-sheets.mjs', '{painting}'],
  compressRoot: 'public/images',
  // --fresh: the slicer has just written NEW originals over files that may
  // have backups from an earlier cut — see processFile in the compressor.
  compress: ['node', 'scripts/compress-images.mjs', '{compressRoot}', '--backup-dir', 'public-backup', '--fresh', '--only', '{files}'],
  // Where a manual Gemini download lands; the desk files it under the job it
  // was armed for.
  watchDir: join(homedir(), 'Downloads'),
  // Said when a job's `+ also` image is missing — how this project makes it.
  alsoHint: null,
  port: 5178,
  gemini: {
    url: 'https://gemini.google.com/app',
    // One Chrome profile for every project: sign in to Google once.
    profileDir: join(homedir(), '.art-desk', 'gemini-chrome'),
    chrome: null,
    // Extra Chrome switches for that window, e.g. ["--window-position=2000,0"].
    chromeArgs: [],
    // Between two generations: gapSeconds plus up to jitterSeconds at random.
    gapSeconds: 90,
    jitterSeconds: 60,
    // Generations per calendar day across ALL projects (counted in
    // ~/.art-desk/usage.json) — a ceiling under the account's own quota.
    dailyCap: 40,
    timeoutSeconds: 420,
    // Re-rolls when a return comes back unusable (no image, or the slicer
    // refuses its grid). Each one is another generation off the quota.
    retries: 1,
    // Stop the queue after this many failures in a row.
    maxConsecutiveFailures: 3
  }
}

export const loadConfig = (root) => {
  const file = join(root, 'art-desk.config.json')
  let user = {}
  if (existsSync(file)) {
    try {
      user = JSON.parse(readFileSync(file, 'utf-8'))
    } catch (e) {
      throw new Error(`${file} is not valid JSON: ${e.message}`)
    }
  }
  const c = { ...DEFAULTS, ...user, gemini: { ...DEFAULTS.gemini, ...(user.gemini ?? {}) } }
  const abs = (p) => (p ? resolve(root, p) : p)
  return {
    ...c,
    root,
    project: (() => {
      try { return JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')).name } catch { return 'project' }
    })(),
    sheetsDir: abs(c.sheetsDir),
    paintedDir: abs(c.paintedDir),
    indexFile: abs(c.indexFile),
    outDir: abs(c.outDir),
    compressRoot: abs(c.compressRoot),
    watchDir: c.watchDir ? resolve(c.watchDir.replace(/^~(?=$|[\\/])/, homedir())) : null,
    gemini: { ...c.gemini, profileDir: resolve(c.gemini.profileDir.replace(/^~(?=$|[\\/])/, homedir())) }
  }
}
