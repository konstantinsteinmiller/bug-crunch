/**
 * SUCCESS-30 — "a whole level, and the thing standing at the end of the world."
 *
 * Not the ten-second clip held longer: a whole run in miniature. A viewer who
 * is still here at second ten is watching the game, not an advert, so it gets
 * a middle — the board gets busier, the player gets better at it, and the two
 * arrive at the same place.
 *
 *   0–2    already playing: bodies going under the foot, comic words in the air
 *   2–8    the chain builds and the multiplier climbs through its rungs; the
 *          music speeds up with it, which is audible even on a muted clip
 *          because the SCREEN speeds up with it too
 *   8–12   a beetle: the tap CLANGS off, the foot lifts, the ring swells, and
 *          the slam opens it. The one beat in the clip that shows a second verb
 *   12–18  the vial fills and FEVER is spent — the gilded boot, a swarm deleted
 *   18–26  the BOSS: the Matriarch, her pods, her phases and the last blow
 *   26–30  the result screen's stars, and the next level opening underneath
 *
 * The arc is the LEVEL's, not a script's — level 30 is a boss board, so the adds
 * and the pods it throws are what fills the first two thirds, and the staging
 * only starts the clip the right distance back from the kill.
 *
 * ── Why level 30 rather than 20 ──
 *
 * Both are boss boards; the world-3 fight simply lasts long enough to BE a
 * thirty-second clip. Scouted with the `ace` player, the Beetle King is down in
 * sixteen seconds and the back half of the clip is aftermath; the Matriarch
 * takes just under thirty, with her second phase at twenty-four, which is
 * exactly the shape this cut wants.
 */

import {
  aim, autoFever, boot, budget, feverWhenReady, holdPress, installDrive, levelRun,
  nearest, playOn, release, rideToVerdict, rollCamera, snapshot
} from './_drive.mjs'

const LEVEL = 30
const SEED = 7

/**
 * The clip is cut to END on the boss going down: the staging scouts the level,
 * finds when that actually happens, and opens the board that many seconds
 * earlier. Everything before it comes for free, because a boss board authors it
 * — waves of adds between the boss's own phases.
 *
 * 0.8 rather than 0.95, because the scout is an ESTIMATE and not a replay: it
 * plays the level with no renderer, and the renderer pulls on the same
 * `Math.random` the simulation does, so a take drifts a second or two from the
 * run that was measured. Aiming the kill at four fifths leaves that much slack
 * at both ends — early, and the result screen simply gets longer; late, and it
 * still lands.
 */
const KILL_AT = 0.8

export default {
  id: 'success-30s',
  label: 'Chain, slam, Fever, the Matriarch',

  async setup(ctx) {
    await boot(ctx, { level: LEVEL })
    // The beat sheet owns the vial — see `success.mjs`.
    await installDrive(ctx, { level: LEVEL, seed: SEED, policy: 'ace', autoFever: false })

    const at = await levelRun(ctx, {
      level: LEVEL,
      stop: { kind: 'preroll', anchor: 'bossDead', lead: ctx.durationMs * KILL_AT, drift: 1.25 },
      seed: SEED,
      maxSeconds: 180
    })
    ctx.log.info(`opening frame: boss at ${((at.boss?.hp01 ?? 1) * 100).toFixed(0)} %, chain ×${at.mult}`)
  },

  async record(ctx) {
    const t = budget(ctx)
    const clip = ctx.durationMs

    await rollCamera(ctx, { seed: SEED })

    // ── 0–8: the chain ──
    ctx.beat('chain')
    await t.until(clip * 0.26)
    const built = await snapshot(ctx)
    ctx.log.info(`chain beat: ×${built.mult} on ${built.chain}, score ${built.score}`)

    // ── 8–12: the shell ──
    //
    // Scripted, because it is the one beat that will not happen on its own in a
    // window this narrow: the policy only slams what it has to, and whether a
    // beetle is within reach at second eight is luck. Stand on one, hold, and
    // let go — which is exactly the gesture the tutorial teaches.
    const shell = await nearest(ctx, 'beetle')
    if (shell) {
      ctx.beat('slam')
      await aim(ctx, shell.x, shell.y)
      await t.wait(420)
      await holdPress(ctx, true)
      await t.wait(700)
      await holdPress(ctx, false)
      await t.wait(280)
      await release(ctx)
    } else {
      ctx.log.warn('no beetle in reach at the slam beat — the policy keeps the wheel')
    }
    await t.until(clip * 0.4)

    // ── 12–18: Fever ──
    const lit = await feverWhenReady(ctx, t, 2500)
    if (lit) ctx.beat('fever')
    else ctx.log.info('vial not full at the Fever beat — the policy will spend it when it is')
    await autoFever(ctx, true)
    await t.until(clip * 0.6)

    // ── 18–26: the boss ──
    ctx.beat('boss')
    const verdict = await rideToVerdict(ctx, t, { timeoutMs: Math.max(4000, t.left()) })

    // ── 26–30: the stars, and the next level ──
    if (verdict !== 'running') await playOn(ctx, t, verdict)
    await release(ctx)
    await t.until(clip)
  }
}
