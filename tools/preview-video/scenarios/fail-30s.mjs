/**
 * FAIL-30 — "a hundred and fifty of them, and then a `÷5`."
 *
 * The 30 s fail is not the 10 s fail held longer: it is the RUN that explains
 * the loss, and it is told entirely in the numbers painted on the doors.
 *
 *   0–4    a bank pays out; the crowd is building
 *   4–7    a THREE-door bank with a `×2.4` in it — a hundred and fifty
 *          survivors, the biggest crowd of the run. This looks won
 *   7–13   the road's ordinary traffic, and the crowd carries it comfortably
 *   13     THE MISTAKE: a `÷5` next to a `+31`, and it takes the wrong one.
 *          A hundred and fifty become seventy in a single step
 *   13–22  the bleed: `−16` against `÷3`, then `−16` again. Every bank from
 *          here is a dilemma with no good answer, and each one costs
 *   22–26   nine survivors left, and the road does not stop
 *   26      SQUAD WIPED OUT
 *   26–30  …and the retry is already running
 *
 * Nothing in it is scripted. It is the balance suite's `average` player — a
 * quarter of a second late, takes the door it is nearest, aims at a doorway's
 * painted centre rather than at the line that clears the pillar — on stage 25
 * with a shop two upgrade levels short of the success clips' (`THIN_SHOP`).
 *
 * ── Why this road and not a boss fight ──
 *
 * The first cut of this clip lost at the boss, and it did not land: the fight
 * is a DPS race, the scout is an estimate rather than a replay (no renderer,
 * so a different `Math.random` stream), and the take drifted far enough that
 * the crowd was still alive when the clip ran out — a fail clip with no fail in
 * it. A run that dies to a cascade of hostile doors is in freefall from the
 * moment it goes wrong, so the verdict lands where the scout says it will, and
 * the camera is still travelling while it happens.
 */

import {
  boot, budget, installDrive, playOn, rideToVerdict, rollCamera, saveFixture, snapshot, stageRun, THIN_SHOP
} from './_drive.mjs'

const STAGE = 25

/** Where in the clip the crowd runs out. The rest is the retry. */
const WIPE_AT = 0.82

export default {
  id: 'fail-30s',
  label: 'A hundred and fifty, and then a ÷5',

  async setup(ctx) {
    await boot(ctx, { stage: STAGE, save: saveFixture({ ts_upgrades: THIN_SHOP, ts_stage: STAGE }) })
    await installDrive(ctx, { stage: STAGE, seed: 7, policy: 'average' })

    const at = await stageRun(ctx, {
      stage: STAGE,
      stop: { kind: 'preroll', anchor: 'wipe', lead: ctx.durationMs * WIPE_AT },
      maxSeconds: 120
    })
    ctx.log.info(`opening frame: squad ${at.squad}, phase ${at.phase}, ${at.progress.toFixed(2)} along`)
  },

  async record(ctx) {
    const t = budget(ctx)
    const clip = ctx.durationMs

    await rollCamera(ctx, { seed: 7 })
    ctx.beat('building')

    // The peak: the three-door bank with the multiplier in it. This is the
    // poster as well as the beat — the biggest crowd of the run, under the
    // numbers that built it, and the last moment the run is winning.
    await t.until(clip * 0.13)
    ctx.beat('poster')
    const peak = await snapshot(ctx)
    ctx.log.info(`peak: squad ${peak.squad} (run peak ${peak.peak}), ${peak.progress.toFixed(2)} along`)

    // THE MISTAKE, and the bleed after it.
    await t.until(clip * 0.5)
    const cut = await snapshot(ctx)
    ctx.log.info(`after the ÷5: squad ${cut.squad}, ${cut.progress.toFixed(2)} along`)

    await t.until(clip * 0.7)
    ctx.log.info(`  bleeding: ${JSON.stringify(await snapshot(ctx))}`)

    const verdict = await rideToVerdict(ctx, t, { timeoutMs: Math.max(1500, t.left() - clip * 0.1) })
    if (verdict !== 'running') await playOn(ctx, t, verdict)

    await t.until(clip)
  }
}
