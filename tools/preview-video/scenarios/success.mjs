/**
 * SUCCESS — "the vial fills and the boot turns gold."
 *
 * The one thing a screenshot of this game cannot show: a chain climbing while
 * the board fills up, the vial topping out, and a shoe three times its own size
 * flattening everything on screen at once.
 *
 *   0.0–0.45  already playing, already chaining: bodies going under the foot
 *             one after another, the multiplier climbing, the comic words
 *             stacking up. This is the GAME, and it has to be the first thing
 *             on screen — a clip that opens on an empty board opens on nothing
 *   0.45–0.6  the board thickens. The chain is high, the squishes are close
 *             together, and the vial is visibly nearly full
 *   0.6       FEVER. The screen flashes gold, the boot arrives, and the next
 *             two seconds are a swarm being deleted a bootprint at a time
 *   0.6–1.0   what a gilded boot does to a level
 *
 * Beats are FRACTIONS of `ctx.durationMs` and the opening is cut from a scouted
 * run, so this one sheet plays the 5 s Poki square, the 10 s preview and the
 * 16 s CrazyGames cut. The 30 s trailer is a different story — `success-30s`.
 *
 * ── Why level 14 ──
 *
 * World 2, mid-run: six designs on the roster — ants, beetles, caterpillars,
 * stink bugs, fleas and the piñata fly — with a honey puddle and a sweeper bar
 * on the floor. Scouted, the vial fills at 11 s of a 62 s clock and the level is
 * cleared at 36, so a ten-second window around the Fever has a full board either
 * side of it. World 1 is too thin to film; world 4 is too busy to read.
 */

import {
  autoFever, boot, budget, feverWhenReady, installDrive, levelRun, release,
  rollCamera, snapshot
} from './_drive.mjs'

const LEVEL = 14
const SEED = 7

/**
 * Where in the clip the vial is spent.
 *
 * Later on a five-second square (Poki's animated thumbnail, which LOOPS): Fever
 * is a gold flash and two seconds of carnage, and three fifths of the way into
 * a 5 s clip leaves too much of the aftermath to sit through. At 0.68 the flash
 * is very nearly the last thing the loop shows before it starts again.
 */
const feverAt = (ctx) => (ctx.format.id === 'poki' ? 0.68 : 0.58)

export default {
  id: 'success',
  label: 'The vial fills and the boot turns gold',

  async setup(ctx) {
    await boot(ctx, { level: LEVEL })
    // The beat sheet owns the vial: this clip is CUT around the Fever, and the
    // `ace` would otherwise spend it the frame it lit up — which the preroll
    // cannot predict to better than a second.
    await installDrive(ctx, { level: LEVEL, seed: SEED, policy: 'ace', autoFever: false })

    // Open the clip so the vial tops out exactly where the beat sheet wants it.
    // The scout plays the level through once, unrendered, and reports when that
    // actually happens — so a rebalance of the bug juice values moves the clip
    // with it instead of stranding the beat.
    const at = await levelRun(ctx, {
      level: LEVEL,
      // `drift` is the recorder's own slowdown — see `levelRun`. The vial is
      // the one anchor in this game that depends entirely on how fast the
      // player is working, so it needs the correction most.
      stop: { kind: 'preroll', anchor: 'vialFull', lead: ctx.durationMs * feverAt(ctx), drift: 1.33 },
      seed: SEED,
      maxSeconds: 150
    })
    ctx.log.info(
      `opening frame: ${at.squished}/${at.quota}, chain ×${at.mult}, ` +
      `vial ${(at.juice * 100).toFixed(0)} %`
    )
  },

  async record(ctx) {
    const t = budget(ctx)
    const clip = ctx.durationMs

    // Let the world go. From here the `ace` player is at the wheel, one decision
    // per recorded frame.
    await rollCamera(ctx, { seed: SEED })

    // ── The chain ──
    // Nothing to script: the policy takes the highest-value body it can reach
    // and keeps the window alive, which is what a good player does and what the
    // whole game is about.
    ctx.beat('chain')
    await t.until(clip * feverAt(ctx) - 400)

    const before = await snapshot(ctx)
    ctx.log.info(`at the vial: chain ×${before.mult}, ${before.squished}/${before.quota}, vial ${(before.juice * 100).toFixed(0)} %`)

    // ── Fever ──
    //
    // The policy is not allowed to spend it (see `setup`), so the vial has been
    // sitting full and waiting for this line — and a full vial does not decay.
    const lit = await feverWhenReady(ctx, t, 2000)
    ctx.beat('fever')
    if (!lit) ctx.log.warn('the vial never filled inside the beat — the preroll drifted')
    // From here it is the player's again, in case the clip is long enough to
    // earn a second one.
    await autoFever(ctx, true)

    // NO poster beat on the flash itself, deliberately. Fever opens on a gold
    // screen-wide blowout that swallows the board for a third of a second — the
    // best BEAT in the clip and the worst possible still. Frame 0 is the better
    // card by a distance (a full board, a chain badge lit, comic words in the
    // air), and CrazyGames asks for the cover to BE the opening frame anyway,
    // so leaving it unmarked gets both for free.
    await t.until(clip * 0.93)
    const end = await snapshot(ctx)
    ctx.log.info(
      `fever took ${before.squished} → ${end.squished} squishes, score ${before.score} → ${end.score}`
    )

    // `release` is a no-op unless a beat took the wheel; it is here so the last
    // seconds are always the policy's, whatever came before them.
    await release(ctx)
    await t.until(clip)
  }
}
