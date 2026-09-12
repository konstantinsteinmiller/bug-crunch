/**
 * FAIL — "halved at the door, finished by the thing in the road."
 *
 * A fail clip has a different job from a success clip: a browsing player has to
 * finish it thinking *that was winnable*. Two things make it winnable here, and
 * neither is staged — both are what the game does to this player on this road:
 *
 *   • the crowd is AHEAD when it happens. It comes over the first bank of the
 *     clip at its biggest, which is the height the fall needs;
 *   • the mistake is ON SCREEN, in numbers, for two seconds before it lands:
 *     a `÷2` and a `+21` side by side, and the crowd walks into the `÷2`.
 *     Seventy-seven become thirty-three in one step, and the viewer read both
 *     doors before the player did.
 *
 * Then the miniboss — already planted across the road, sweeping the whole lane
 * every second and a half — takes what is left. Squad wiped out, and the retry
 * is already running before the clip ends.
 *
 *   0.0–0.2  in motion, mid-fight: the miniboss is holding the road
 *   0.2–0.4  a bank: the crowd is at its biggest
 *   0.4–0.5  THE MISTAKE — the `÷2` door, and half of them are gone
 *   0.5–0.75 the sweeps land on what is left
 *   0.75     SQUAD WIPED OUT
 *   0.75–1.0 …and the road is already moving again. With the result screen
 *            hidden, a clip that ended on the verdict would end on a still
 *            frame; it ends on the retry instead, which is the thing a preview
 *            is actually selling
 *
 * ── Why stage 22 with a thin shop ──
 *
 * The same `average` player as everywhere else — a quarter of a second late,
 * takes the nearest door, aims at a doorway's painted centre rather than at the
 * line that clears the pillar — carrying a shop two upgrade levels short of the
 * success clips' (`THIN_SHOP`). On stage 22 that run dies on the ROAD at ~16 s,
 * which is what this clip needs: the camera is still travelling, there is a
 * monster in frame, and the whole arc fits in ten seconds. The same player on
 * an easier road reaches the boss and dies there instead — a fine story, and a
 * static one (see `fail-30s`).
 */

import {
  boot, budget, installDrive, playOn, rideToVerdict, rollCamera, saveFixture, snapshot, stageRun, THIN_SHOP
} from './_drive.mjs'

const STAGE = 22

/** Where in the clip the crowd runs out. The rest is the retry. */
const WIPE_AT = 0.75

export default {
  id: 'fail',
  label: 'Halved at the door, wiped in the road',

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
    ctx.beat('ahead')

    // The bank, and the door the player takes. Nothing here is scripted: this
    // is what a quarter-second of reaction latency does when two doors are
    // eleven units apart and only one of them is the good one.
    await t.until(clip * 0.45)
    const cut = await snapshot(ctx)
    ctx.log.info(`after the door: squad ${cut.squad} (peak ${cut.peak}), ${cut.progress.toFixed(2)} along`)

    // The poster is the last frame in which this still looks survivable — a
    // halved crowd under a miniboss. That is the frame that says "I could do
    // better than that", which is the only thing a fail clip is for.
    await t.until(clip * 0.55)
    ctx.beat('poster')

    // Ride to the wipe, then press the button the player would press. The
    // budget keeps a fifth of the clip back for the retry: the scout that
    // chose the opening is an estimate, not a replay, so the verdict lands
    // within a second or so either side of the mark.
    const verdict = await rideToVerdict(ctx, t, { timeoutMs: Math.max(1500, t.left() - clip * 0.18) })
    if (verdict !== 'running') await playOn(ctx, t, verdict)

    await t.until(clip)
  }
}
