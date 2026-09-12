/**
 * SCOUT — not a clip. The measuring tape the other beat sheets are cut with.
 *
 *   pnpm preview:video --scenarios scout --only-setup --formats 10s \
 *                      --orientations portrait --url-param scoutStage=12
 *
 * It plays a whole stage in the FROZEN sim as fast as the machine can step it —
 * no rendering, no recording — and prints the timeline a beat sheet needs:
 * when each gate bank was passed, when the miniboss planted, when the boss
 * spawned and died, and what the crowd was doing at each. Twenty seconds of
 * wall time for a stage, against four minutes to record one and watch it.
 *
 * Every number the scenarios schedule against comes from here, which is also
 * why they schedule against DISTANCE rather than time: the crowd's forward pace
 * is constant except where the game slows it down on purpose (a gate pass runs
 * at 0.45× for a beat, a boss guard-gate holds), so a clip timed off
 * `stageSpeed` alone runs ~10 % late by the end of a stage. `PACE` in
 * `_drive.mjs` is that correction, and this is what measured it.
 */

import { boot, installDrive, saveFixture, THIN_SHOP } from './_drive.mjs'

/** Read a `--url-param` off the URL the runner actually opened — the one place
 *  every parameter source has already been merged. */
const param = (ctx, key) => {
  try {
    return new URL(ctx.page.url()).searchParams.get(key)
  } catch {
    return null
  }
}

export default {
  id: 'scout',
  label: 'Stage timeline (no clip)',

  async setup(ctx) {
    // `--url-param scoutStage=14` overrides; the default is the fixture's.
    const stage = Number(param(ctx, 'scoutStage')) || saveFixture().ts_stage
    const policy = param(ctx, 'scoutPolicy') ?? 'optimal'
    // `--url-param scoutShop=thin` scouts the fail clips' under-invested save.
    const shop = param(ctx, 'scoutShop') === 'thin' ? { ts_upgrades: THIN_SHOP } : {}

    await boot(ctx, { stage, save: saveFixture(shop) })
    const { speed } = await installDrive(ctx, { stage, seed: 7, policy })

    const line = await ctx.evaluate((arg) => {
      const w = /** @type {any} */ (window)
      const P = w.__preview
      const G = P.game
      const D = w.__drive
      P.hold(true)
      G.startStage(arg.stage)
      P.vfx.resetVfx()
      P.vfx.drainFx()
      w.__vseed?.reseed(arg.seed)

      const track = G.getTrack()
      const banks = track.events.filter((e) => e.kind === 'gates')
        .map((e) => ({ y: e.y, offer: e.leaves.map((l) => `${l.op}${l.value}`).join('/'), at: null, squad: 0 }))
      const marks = []
      let bossAt = null
      let bossDeadAt = null
      let eliteAt = null
      let eliteGoneAt = null
      let sawElite = false
      let i = 0
      const dt = arg.dtMs

      for (let step = 0; step < arg.maxSteps; step++) {
        const t = (step * dt) / 1000
        const y = G.anchor().y
        while (i < banks.length && y >= banks[i].y) {
          banks[i].at = t
          banks[i].squad = G.squadCount.value
          i++
        }
        if (!sawElite && G.eliteAlive.value) { sawElite = true; eliteAt = t }
        if (sawElite && eliteGoneAt === null && !G.eliteAlive.value) eliteGoneAt = t
        if (bossAt === null && G.phase.value === 'boss') {
          bossAt = t
          marks.push(`boss spawns @${t.toFixed(1)}s squad ${G.squadCount.value} dps ${(G.squadCount.value * G.damage.value * G.runFireRate.value).toFixed(0)}`)
        }
        if (bossAt !== null && bossDeadAt === null && G.getBoss()?.dead) bossDeadAt = t
        if (G.phase.value === 'clear' || G.phase.value === 'wipe') {
          marks.push(`${G.phase.value} @${t.toFixed(1)}s`)
          break
        }
        D.step(dt)
      }

      return {
        stage: arg.stage,
        arenaY: track.arenaY,
        banks,
        eliteAt, eliteGoneAt, bossAt, bossDeadAt,
        marks,
        end: { phase: G.phase.value, squad: G.squadCount.value, peak: G.peakSquad.value, damage: G.damage.value, rate: G.runFireRate.value }
      }
    }, { stage, seed: 7, dtMs: 1000 / ctx.fps, maxSteps: Math.round((150 * ctx.fps)) })

    ctx.log.info(`── stage ${line.stage}, arena at ${line.arenaY?.toFixed(0)} u, ${speed.toFixed(2)} u/s nominal`)
    for (const b of line.banks) {
      ctx.log.info(`   bank y=${String(b.y).padStart(4)} ${b.offer.padEnd(22)} passed @${b.at === null ? ' never' : `${b.at.toFixed(1)}s`}  squad ${b.squad}`)
    }
    ctx.log.info(`   miniboss ${line.eliteAt?.toFixed(1) ?? '—'}s → ${line.eliteGoneAt?.toFixed(1) ?? '—'}s`)
    ctx.log.info(`   boss ${line.bossAt?.toFixed(1) ?? '—'}s → dead ${line.bossDeadAt?.toFixed(1) ?? '—'}s` +
      (line.bossAt !== null && line.bossDeadAt !== null ? ` (${(line.bossDeadAt - line.bossAt).toFixed(1)}s fight)` : ''))
    for (const m of line.marks) ctx.log.info(`   ${m}`)
    ctx.log.info(`   end: ${JSON.stringify(line.end)}`)
  },

  async record(ctx) {
    ctx.log.warn('scout is a measurement, not a clip — run it with --only-setup')
  }
}
