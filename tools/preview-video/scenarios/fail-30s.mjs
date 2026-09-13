/**
 * FAIL-30 — "a boss, in the wrong shoe."
 *
 * The thirty-second fail is a different story from the ten-second one. Ten
 * seconds can only show a mistake and its price; thirty can show somebody being
 * OUT-EQUIPPED, which is the more useful story — it is the one that sells the
 * Locker.
 *
 *   0–3    the board, already busy: adds pouring out of the boss
 *   3–10   the run goes well. The chain builds, the vial fills, the score moves
 *   10–15  FEVER, spent on the swarm — and it barely dents the boss, because
 *          Fever is a swarm answer and a boss is not a swarm
 *   15–22  the boss's own phase: armour this shoe cannot open in one blow, and
 *          the CLANG of a tap that was not a slam, twice
 *   22–26  the clock in the red with the bar two thirds full
 *   26     TIME'S UP
 *   26–30  the board is already back — the retry, not the result screen
 *
 * ── Why the same boss as `success-30s`, in the starter shoe ──
 *
 * Because it is the same fight, and that is the entire point: a viewer who
 * watches both sees one player open the Matriarch with a slam and another bounce
 * off her, on the same floor, against the same boss. The difference is a shoe,
 * and the shoe is three hundred coins.
 */

import {
  boot, budget, feverWhenReady, installDrive, levelRun, playOn, release, rideToVerdict,
  rollCamera, saveFixture, snapshot, STARTER_LOADOUT
} from './_drive.mjs'

const LEVEL = 30
const SEED = 11

/** Where in the clip the clock runs out. The rest is the retry. */
const TIMEUP_AT = 0.86

export default {
  id: 'fail-30s',
  label: 'The Matriarch, in the wrong shoe',

  async setup(ctx) {
    await boot(ctx, { level: LEVEL, save: saveFixture({ sx_level: LEVEL, ...STARTER_LOADOUT }) })
    await installDrive(ctx, { level: LEVEL, seed: SEED, policy: 'average' })

    const at = await levelRun(ctx, {
      level: LEVEL,
      stop: { kind: 'preroll', anchor: 'lost', lead: ctx.durationMs * TIMEUP_AT },
      seed: SEED,
      maxSeconds: 200
    })
    ctx.log.info(
      `opening frame: boss at ${((at.boss?.hp01 ?? 1) * 100).toFixed(0)} %, ` +
      `${at.timeLeft}s left, chain ×${at.mult}`
    )
  },

  async record(ctx) {
    const t = budget(ctx)
    const clip = ctx.durationMs

    await rollCamera(ctx, { seed: SEED })

    // ── 0–10: it is going well ──
    ctx.beat('chain')
    await t.until(clip * 0.33)
    const good = await snapshot(ctx)
    ctx.log.info(`going well: chain ×${good.mult}, score ${good.score}, boss ${((good.boss?.hp01 ?? 1) * 100).toFixed(0)} %`)

    // ── 10–15: Fever, spent on the wrong problem ──
    const lit = await feverWhenReady(ctx, t, 1500)
    if (lit) ctx.beat('fever')
    await t.until(clip * 0.5)
    const after = await snapshot(ctx)
    ctx.log.info(`fever moved the boss ${((good.boss?.hp01 ?? 1) * 100).toFixed(0)} % → ${((after.boss?.hp01 ?? 1) * 100).toFixed(0)} %`)

    // ── 15–26: the boss, and the clock ──
    ctx.beat('boss')
    const verdict = await rideToVerdict(ctx, t, { timeoutMs: Math.max(3000, t.left()) })

    // ── 26–30: straight back in ──
    if (verdict !== 'running') await playOn(ctx, t, verdict)
    await release(ctx)
    await t.until(clip)
  }
}
