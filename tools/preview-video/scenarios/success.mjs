/**
 * SUCCESS — "the doorway that doubles the crowd."
 *
 * The one thing a screenshot of this game cannot show: a crowd walking into a
 * doorway and coming out the other side twice the size — and what that crowd
 * then does to the road in front of it.
 *
 *   0.0–0.35  already running, guns already firing: the miniboss that planted
 *             itself across the road is taken apart, and the bank behind it
 *             comes over the top of the screen
 *   0.35–0.6  the approach: fire pours into the multiplier and its number
 *             CLIMBS. The pump is the mechanic nobody reads about and everybody
 *             understands the moment they watch the digits move
 *   0.6       through the door it chose, past the pillar it did not — and the
 *             crowd that comes out is twice the one that went in
 *   0.6–1.0   what that crowd does to the next stretch of road
 *
 * Beats are FRACTIONS of `ctx.durationMs` and the opening is cut from a scouted
 * run, so this one sheet plays the 5 s Poki square, the 10 s preview and the
 * 16 s CrazyGames cut. The 30 s trailer is a different story — `success-30s`.
 *
 * ── Why stage 14 ──
 *
 * The busiest road in the band a mid-career save can clear: eight banks, ten
 * foe events, two minibosses and a boulder field, so there is no stretch of it
 * that is just crowd-and-empty-road. Its `add18/mul1.6` sits three seconds
 * after the miniboss dies, which is how the clip gets a fight AND a payout in
 * ten seconds without cutting.
 */

import {
  boot, budget, installDrive, release, rollCamera, snapshot, stageRun
} from './_drive.mjs'

const STAGE = 14

/**
 * Where in the clip the crowd walks through the multiplier.
 *
 * Later on a five-second square (Poki's animated thumbnail, which LOOPS): the
 * payout is a white flash and a second of glowing bodies, and three fifths of
 * the way into a 5 s clip leaves two seconds of that wash to sit through. At
 * 0.72 the flash is the last thing the loop shows before it starts again.
 */
const payoffAt = (ctx) => (ctx.format.id === 'poki' ? 0.72 : 0.6)

export default {
  id: 'success',
  label: 'The gate that doubles the crowd',

  async setup(ctx) {
    await boot(ctx, { stage: STAGE })
    await installDrive(ctx, { stage: STAGE, seed: 7, policy: 'optimal' })

    const at = await stageRun(ctx, {
      stage: STAGE,
      stop: { kind: 'preroll', anchor: 'bank', match: 'mul', pick: 'first', lead: ctx.durationMs * payoffAt(ctx) },
      maxSeconds: 90
    })
    ctx.log.info(`opening frame: squad ${at.squad}, ${at.progress.toFixed(2)} along the road`)
  },

  async record(ctx) {
    const t = budget(ctx)
    const clip = ctx.durationMs

    // Let the world go. From here the balance suite's `optimal` player is at
    // the wheel, one decision per recorded frame.
    await rollCamera(ctx, { seed: 7 })

    // ── The approach and the pump ──
    // Nothing to script: the policy commits early to a pumpable leaf and holds
    // the crowd's fire on it, which is what a good player does.
    ctx.beat('approach')
    await t.until(clip * payoffAt(ctx))

    const through = await snapshot(ctx)
    ctx.log.info(`at the bank: squad ${through.squad}, ${through.progress.toFixed(2)} along`)

    // ── The payout ──
    //
    // NO poster beat here, deliberately. A gate payout is a white blowout that
    // swallows the crowd for half a second — the best BEAT in the clip and the
    // worst possible still — and the frames after it are a crowd on an empty
    // stretch of road. Frame 0 is the better card by a distance (a miniboss
    // over the squad with two banks of numbers coming over the top of the
    // screen), and CrazyGames asks for the cover to BE the opening frame
    // anyway, so leaving it unmarked gets both for free.
    await t.until(clip * 0.92)
    const end = await snapshot(ctx)
    ctx.log.info(`grew ${through.squad} → ${end.squad} (peak ${end.peak})`)

    // `release` is a no-op unless a beat took the wheel; it is here so the last
    // seconds are always the policy's, whatever came before them.
    await release(ctx)
    await t.until(clip)
  }
}
