/**
 * FAIL — "the boss you cannot crack, and the clock that runs out anyway."
 *
 * A fail clip has a different job from a success clip: a browsing player has to
 * finish it thinking *that was winnable*. Two things make it winnable here, and
 * neither is staged — both are what the game does to this player on this board:
 *
 *   • the run is AHEAD when it happens. The Matriarch's bar is two thirds down
 *     and the clock is still running, which is the height the fall needs;
 *   • the reason is ON SCREEN, and it is legible: two taps land squarely on her
 *     and both CLANG off. A white sneaker, a boss that wants a slam from a
 *     harder shoe, and a viewer who can see the difference before the player
 *     admits it.
 *
 * Then the clock takes what is left, with her still standing. TIME'S UP, and the
 * retry is already running before the clip ends.
 *
 *   0.0–0.25 mid-fight: the boss moving, adds underfoot, the bar creeping down
 *   0.25–0.5 THE REASON — two taps on the body, two ricochets, no damage
 *   0.5–0.78 scrambling: the clock in the red, the bar not quite empty
 *   0.78     TIME'S UP
 *   0.78–1.0 …and the board is already back. With the result screen hidden, a
 *            clip that ended on the verdict would end on a still frame; it ends
 *            on the retry instead, which is the thing a preview is actually
 *            selling
 *
 * ── Why level 30 in the starter shoe ──
 *
 * Because it is the one loss this game reliably produces, and it is the RIGHT
 * one. Scouted every way, the `average` player clears ordinary levels — the
 * board is dense, a stomp takes two or three bodies at once, and a quota falls
 * to volume whether or not anybody is aiming. A BOSS does not fall to volume:
 * it wants slams through armour, and a player in the starter sneaker who taps
 * more than they charge cannot deliver them. That run reaches the Matriarch's
 * second phase and then runs out of clock, every time.
 *
 * It is also the same fight as `success-30s`, on purpose: a viewer who sees
 * both watches one player open her with a slam and another bounce off her, on
 * the same floor. The difference is a shoe, and the shoe is three hundred coins.
 */

import {
  bossAt, boot, budget, installDrive, levelRun, playOn, rideToVerdict,
  release, rollCamera, saveFixture, snapshot, tapAt, STARTER_LOADOUT
} from './_drive.mjs'

const LEVEL = 30
const SEED = 11

/** Where in the clip the clock runs out. The rest is the retry. */
const TIMEUP_AT = 0.78

export default {
  id: 'fail',
  label: 'The boss the wrong shoe cannot open',

  async setup(ctx) {
    // Same career, wrong shoe. Everything else — the level, the stars, the
    // hint flags, the muted audio — is the success clips' fixture.
    await boot(ctx, { level: LEVEL, save: saveFixture({ bc_level: LEVEL, ...STARTER_LOADOUT }) })
    await installDrive(ctx, { level: LEVEL, seed: SEED, policy: 'average' })

    const at = await levelRun(ctx, {
      level: LEVEL,
      // No drift correction on a CLOCK anchor: the level's timer runs on
      // simulated time, so "when the clock runs out" is the one moment in this
      // game that does not care how fast the player is working.
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

    // ── The fight, still winnable ──
    ctx.beat('fight')
    await t.until(clip * 0.25)
    const peak = await snapshot(ctx)
    ctx.log.info(
      `before the clangs: boss ${((peak.boss?.hp01 ?? 1) * 100).toFixed(0)} %, ${peak.timeLeft}s left`
    )

    // ── The reason ──
    //
    // Scripted, because a clip cannot wait for the `average` player to choose
    // this exact moment to tap the boss. Everything about it is the game's: the
    // boss is where the script put her, the armour check is the sim's, and the
    // CLANG is what a sneaker gets for tapping something that wanted a slam.
    const boss = await bossAt(ctx)
    if (boss) {
      ctx.beat('clang')
      await tapAt(ctx, t, boss.x, boss.y)
      const again = await bossAt(ctx)
      if (again) await tapAt(ctx, t, again.x, again.y, 180)
      await release(ctx)
    } else {
      ctx.log.warn('the boss was not on the board at the clang beat — the loss will be the clock alone')
    }

    // ── The scramble, and the clock ──
    ctx.beat('scramble')
    const verdict = await rideToVerdict(ctx, t, { timeoutMs: Math.max(3000, t.left()) })

    // ── …and straight back in ──
    if (verdict !== 'running') await playOn(ctx, t, verdict)
    await release(ctx)
    await t.until(clip)
  }
}
