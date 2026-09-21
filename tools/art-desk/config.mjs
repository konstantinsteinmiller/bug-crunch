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
  // Rules are painted out for the queue, and it is a considered trade rather
  // than a convenience.
  //
  // Gemini ruled a walk sheet like a comic strip perhaps one time in three —
  // "DO NOT DRAW THE GRID" in capitals did not stop it. Without a paint-out the
  // slicer refuses the return, the desk re-rolls, and the re-roll rules it
  // again: two generations off a shared cap for a painting that was otherwise
  // fine, which is what happened to the beetle. (The prompt has since been
  // fixed — one continuous ground, stated first and checked last, "in any
  // colour" — and the first seven returns after it came back unruled. The
  // salvage stays for the one that does not.)
  //
  // `--drop-borders-if-ruled`, NOT `--drop-borders`. The plain flag paints a
  // band down every cut line of every return, ruled or clean, and erases
  // whatever a clean painting put within 3 % of a panel of a cut: the moth
  // shipped with its wing tips sheared flat at the frame edge. This one paints
  // out only a return the detector finds ruled, and the slicer records it in
  // its receipt, so a plain `pnpm slice-sheets` cuts those bytes the same way
  // instead of refusing what the desk accepted.
  //
  // The risk the slicer warns about is real — a ruled return often carries
  // CAPTIONS too, and those it cannot remove — so this is only safe alongside
  // the rule that every accepted painting is looked at at 24 px before it is
  // kept (`/#/playground`, `/#/bug-lab`). Look at it. The flag buys the
  // generation back; it does not decide whether the art is good.
  slice: ['node', 'tools/slice-sheets.mjs', '{painting}', '--drop-borders-if-ruled'],
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
    gapSeconds: 15,
    jitterSeconds: 10,
    // ─── Two different ceilings ───
    //
    // `dailyCap` is the hard stop: reach it and the queue ends the run.
    // `Infinity` switches it off, which is the default now — the thing that
    // actually runs out is not the day, it is the ACCOUNT.
    //
    // `accountCap` is how many generations one Google account is good for
    // before Gemini starts refusing. Reaching it does NOT end the run: the
    // queue PAUSES, asks for a different account to be signed in, and carries
    // on from where it stopped once that is confirmed. Nothing is lost and no
    // quota is spent discovering the wall — the count is what stops it, not a
    // refusal.
    //
    // Both are counted in ~/.art-desk/usage.json across ALL projects.
    // `accountCap` counts from the last confirmed account switch, not from
    // midnight, because that is the span that shares a quota.
    dailyCap: Infinity,
    accountCap: 120,
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
