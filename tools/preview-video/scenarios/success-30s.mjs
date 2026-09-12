/**
 * SUCCESS-30 — "the last half of a stage, and the thing standing at the end."
 *
 * Not the ten-second clip held longer: a whole run in miniature. A viewer who
 * is still here at second ten is watching the game, not an advert, so it gets
 * a middle — the road gets harder, the crowd gets bigger, and the two arrive at
 * the same place.
 *
 *   0–1    already running, a bank already on screen
 *   1–9    two ordinary banks and the traffic between them: the crowd grows
 *   9–14   the DILEMMA: `−4` against `÷2`. Every door hostile, no right answer,
 *          only a cheaper wrong one — and it is the only bank in the clip the
 *          crowd comes out of smaller
 *   14–19  THE PAYOFF: a three-door bank with the multiplier in it, pumped on
 *          the way in; the crowd that walks out of it is the one that fights
 *   19–25  the arena: the boss, its telegraphed slam, and the kill
 *   25–30  the road opens again under the crowd and the next stage starts
 *
 * The arc is the ROAD's, not a script's — stage 14 authors a bank every four
 * seconds, a miniboss, a dilemma and then a multiplier eleven units short of
 * its arena. The staging just starts the clip the right distance back.
 */

import {
  boot, budget, installDrive, playOn, rideToVerdict, rollCamera, snapshot, stageRun
} from './_drive.mjs'

const STAGE = 14

/**
 * The clip is cut to END on the kill: the staging scouts the stage, finds when
 * the boss actually dies, and opens the road that many seconds earlier.
 *
 * Everything before it comes for free, because stage 14 authored it: four
 * banks, a dilemma among them, and a multiplier just short of the arena.
 *
 * 0.82 rather than 0.95, because the scout is an ESTIMATE and not a replay: it
 * plays the stage with no renderer, and the renderer pulls on the same
 * `Math.random` the simulation does, so a take drifts a second or two from the
 * run that was measured (it came back ~3 s early on the first try). Aiming the
 * kill at four fifths leaves that much slack at both ends — early, and the road
 * that opens afterwards simply gets longer; late, and it still lands.
 */
const KILL_AT = 0.82

export default {
  id: 'success-30s',
  label: 'Gates, miniboss, boss',

  async setup(ctx) {
    await boot(ctx, { stage: STAGE })
    await installDrive(ctx, { stage: STAGE, seed: 7, policy: 'optimal' })

    const at = await stageRun(ctx, {
      stage: STAGE,
      stop: { kind: 'preroll', anchor: 'bossDead', lead: ctx.durationMs * KILL_AT },
      maxSeconds: 90
    })
    ctx.log.info(`opening frame: squad ${at.squad}, ${at.progress.toFixed(2)} along the road`)
  },

  async record(ctx) {
    const t = budget(ctx)
    const clip = ctx.durationMs

    await rollCamera(ctx, { seed: 7 })
    ctx.beat('road')

    // ── The road does the first two thirds on its own ──
    // A bank, a miniboss and whatever the generator put between them. Logged at
    // the quarters so a take that drifts can be compared line by line against
    // the one before it.
    await t.until(clip * 0.25)
    ctx.log.info(`  ¼: ${JSON.stringify(await snapshot(ctx))}`)
    await t.until(clip * 0.5)
    ctx.log.info(`  ½: ${JSON.stringify(await snapshot(ctx))}`)

    // The poster: the crowd at its biggest, a couple of seconds after the last
    // bank paid out and well clear of the white flash it paid out WITH. Not the
    // boss fight — the boss spends most of it behind its own guard crest — and
    // not the kill, which is a blowout. A wall of four hundred bodies under a
    // row of gate numbers is the frame that says what this game is.
    await t.until(clip * 0.58)
    ctx.beat('poster')
    const through = await snapshot(ctx)
    ctx.log.info(`  poster: ${JSON.stringify(through)}`)

    // ── The arena ──
    await t.until(clip * 0.78)
    const boss = await snapshot(ctx)
    ctx.log.info(`boss beat: phase ${boss.phase}, squad ${boss.squad}, boss ${JSON.stringify(boss.boss)}`)

    // ── The kill, and back into the game ──
    // `rideToVerdict` rolls the clip forward until the stage actually resolves
    // rather than assuming a fight length; whatever is left afterwards is the
    // next road opening under the crowd, which is the ending either way.
    const verdict = await rideToVerdict(ctx, t, { timeoutMs: Math.max(1500, t.left() - 2500) })
    if (verdict !== 'running') await playOn(ctx, t, verdict)

    await t.until(clip)
  }
}
