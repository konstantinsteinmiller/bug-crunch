/**
 * SCOUT — not a clip. The measuring tape the other beat sheets are cut with.
 *
 *   pnpm preview:video --scenarios scout --only-setup --formats 10s \
 *                      --orientations portrait --url-param scoutLevel=14
 *
 * It plays a whole level in the FROZEN sim as fast as the machine can step it —
 * no rendering, no recording — and prints the timeline a beat sheet needs: when
 * the first body went under the foot, when the chain crossed ×8 and ×20, when
 * the vial filled, when Fever ran, when the boss changed phase and died, and
 * when the level was won or lost.
 *
 * Twenty seconds of wall time for a level, against four minutes to record one
 * and watch it.
 *
 * Every number the scenarios schedule against comes from here, which is also
 * why they schedule against EVENTS rather than against times: this game has no
 * fixed pace. A level's interesting moments arrive when the player has put in
 * the squishes, so "six seconds before the vial fills" survives a rebalance of
 * the bug juice values and "at 41 seconds" does not.
 *
 * ── The parameters ──
 *
 *   --url-param scoutLevel=20     which level (default: the fixture's)
 *   --url-param scoutPolicy=ace   'ace' | 'good' | 'average'
 *   --url-param scoutShoe=starter the fail clips' under-equipped save
 */

import { boot, installDrive, saveFixture, STARTER_LOADOUT } from './_drive.mjs'

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
  label: 'Level timeline (no clip)',

  async setup(ctx) {
    const level = Number(param(ctx, 'scoutLevel')) || saveFixture().bc_level
    const policy = param(ctx, 'scoutPolicy') ?? 'ace'
    const loadout = param(ctx, 'scoutShoe') === 'starter' ? STARTER_LOADOUT : {}

    await boot(ctx, { level, save: saveFixture({ bc_level: level, ...loadout }) })
    await installDrive(ctx, { level, seed: 7, policy })

    const line = await ctx.evaluate((arg) => {
      const w = /** @type {any} */ (window)
      const P = w.__preview
      const G = P.game
      const D = w.__drive
      P.hold(true)
      D.reset(arg.seed)
      P.play(arg.level)
      G.resetVial()
      P.vfx.resetVfx()
      w.__vseed?.reseed(arg.seed)

      const spec = G.getLevel()
      const marks = []
      const out = {
        level: spec.id,
        label: `${spec.world}-${spec.index}`,
        quota: G.quota.value,
        time: G.timeLeft.value,
        roster: spec.roster.map((r) => `${r.id}:${r.weight}`),
        hazards: [...spec.hazards],
        boss: spec.boss,
        // A boss level is data now (`BOSS_FIGHTS` in `stages.ts`), and the same
        // boss can be fought at two strengths — the Queen is 0.5 on 1-4, 1 on 1-10.
        bossScale: spec.bossScale,
        marks,
        rungs: {},
        firstSquish: null,
        halfQuota: null,
        vialFull: null,
        feverAt: null,
        feverEnd: null,
        bossPhase2: null,
        bossPhase3: null,
        bossDead: null,
        won: null,
        lost: null,
        bestChain: 0,
        misses: 0,
        end: null
      }

      const dt = arg.dtMs
      for (let step = 0; step < arg.maxSteps; step++) {
        const t = (step * dt) / 1000
        if (out.firstSquish === null && G.squished.value > 0) {
          out.firstSquish = t
          marks.push(`first squish @${t.toFixed(1)}s`)
        }
        if (out.halfQuota === null && G.quota.value > 0 && G.squished.value >= G.quota.value / 2) out.halfQuota = t
        for (const rung of [3, 5, 8, 12, 20, 30, 50]) {
          if (out.rungs[rung] === undefined && G.chainMult.value >= rung) out.rungs[rung] = t
        }
        if (out.vialFull === null && G.juice.value >= 1) {
          out.vialFull = t
          marks.push(`vial full @${t.toFixed(1)}s after ${G.squished.value} squishes`)
        }
        if (out.feverAt === null && G.feverMs.value > 0) {
          out.feverAt = t
          marks.push(`FEVER @${t.toFixed(1)}s`)
        }
        if (out.feverAt !== null && out.feverEnd === null && G.feverMs.value <= 0) out.feverEnd = t
        if (out.bossPhase2 === null && G.bossPhaseIndex.value >= 1) out.bossPhase2 = t
        if (out.bossPhase3 === null && G.bossPhaseIndex.value >= 2) out.bossPhase3 = t
        if (spec.boss && out.bossDead === null && G.bossHp.value <= 0) {
          out.bossDead = t
          marks.push(`boss down @${t.toFixed(1)}s`)
        }
        out.bestChain = Math.max(out.bestChain, G.chainCount.value)
        if (G.phase.value === 'won') { out.won = t; marks.push(`WON @${t.toFixed(1)}s`); break }
        if (G.phase.value === 'lost') { out.lost = t; marks.push(`LOST @${t.toFixed(1)}s`); break }
        D.step(dt)
      }

      const tally = G.tally.value
      out.why = D.state().why
      out.misses = tally.misses
      out.end = {
        score: G.score.value,
        squished: G.squished.value,
        quota: G.quota.value,
        timeLeft: Math.round(G.timeLeft.value),
        hits: tally.hits,
        misses: tally.misses,
        spikes: tally.spikes,
        fevers: tally.fevers,
        bestCombo: tally.bestCombo
      }
      return out
    }, { level, seed: 7, dtMs: 1000 / ctx.fps, maxSteps: Math.round(200 * ctx.fps) })

    const s = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(1)}s`)

    ctx.log.info(`── level ${line.level} (${line.label}), ${policy}${loadout.bc_shoe ? ` in the ${loadout.bc_shoe}` : ''}`)
    ctx.log.info(`   quota ${line.quota} in ${line.time}s · roster ${line.roster.join(', ')}`)
    ctx.log.info(`   hazards ${line.hazards.length ? line.hazards.join(', ') : 'none'}${line.boss ? ` · boss ${line.boss} at ${line.bossScale}× strength` : ''}`)
    ctx.log.info(`   first squish ${s(line.firstSquish)} · half quota ${s(line.halfQuota)}`)
    ctx.log.info(`   chain rungs ${[3, 5, 8, 12, 20, 30, 50].map((r) => `×${r} ${s(line.rungs[r])}`).join(' · ')}`)
    ctx.log.info(`   vial full ${s(line.vialFull)} · fever ${s(line.feverAt)} → ${s(line.feverEnd)}`)
    if (line.boss) {
      ctx.log.info(`   boss phases ${s(line.bossPhase2)} / ${s(line.bossPhase3)} · down ${s(line.bossDead)}`)
    }
    for (const m of line.marks) ctx.log.info(`   ${m}`)
    ctx.log.info(`   end: ${JSON.stringify(line.end)}`)
    // Frames the autopilot spent behind each gate. A clip that comes back flat
    // is usually this, not the level.
    ctx.log.info(`   autopilot: ${JSON.stringify(line.why)}`)
  },

  async record(ctx) {
    ctx.log.warn('scout is a measurement, not a clip — run it with --only-setup')
  }
}
