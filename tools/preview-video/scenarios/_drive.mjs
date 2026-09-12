/**
 * ─── Driving Survivalist ────────────────────────────────────────────────────
 *
 * Everything game-specific lives here, so the scenario modules read as beat
 * sheets. `record.mjs` and `lib/` are the skill's, copied verbatim; this file,
 * `preview.config.mjs` and `scenarios/*` are the game's half.
 *
 * ── The seams ──
 *
 *   window.__preview   { feed, game, vfx, art, artPreload, state, hold, held,
 *                        next, retry }   — `src/game/previewFeed.ts`, DEV only,
 *                        published under `?preview=1` (which every recording
 *                        URL carries, clean or not)
 *   window.__drive     the autopilot installed by `installDrive` below
 *
 * ── Why this game is staged rather than scripted ──
 *
 * Glyphyx (the skill's worked example) is a turn game: every beat is a board
 * forced into place and a stone carried onto it. A crowd runner has no turns.
 * The road is an authored score (`buildTrack(stage)` is deterministic per
 * stage), the only input is one lane position, and the interesting moments —
 * a gate bank, a miniboss, the boss — arrive when the crowd reaches them. So
 * the clip is made of three decisions instead of twenty:
 *
 *   1. WHO is playing: a save fixture (stage, upgrade levels) that opens the
 *      road with a crowd worth filming.
 *   2. WHERE the clip starts: the simulation is FROZEN (`hold`) and then
 *      fast-forwarded, unrendered, until the road is at the moment the beat
 *      sheet wants — "a multiplier bank fifteen units ahead", "70 % of the
 *      way in". `setup()` therefore ends quiescent, which is what makes two
 *      takes identical (see the skill's troubleshooting, "the state at arm()
 *      comes out of REAL time").
 *   3. HOW it is played: the balance suite's own scripted players
 *      (`tests/sim/policies.ts`) steer, one decision per recorded frame —
 *      `optimal` for a success clip, `average` for a fail. Reusing them rather
 *      than writing a second autopilot means the clip shows the game a
 *      MEASURED player gets, and they already know this game's geometry better
 *      than anything written here would. A beat sheet can still take the wheel
 *      for a beat (`aim` / `release`) when it needs one particular door taken;
 *      none of the four currently has to.
 *
 * ── Determinism ──
 *
 * `Math.random` is seeded by the recorder at document start and re-seeded here
 * at two points: before the fast-forward (so the staging is repeatable) and at
 * the top of `record()` (so the take does not inherit whatever the real-time
 * boot and its splash animations drew). The sim is stepped at exactly the
 * recording's frame time in both phases, so the physics before and after the
 * first frame are the same physics.
 */

/**
 * One tick of the simulation, in the recording's own frame time.
 *
 * The staging steps the frozen sim by exactly this, and the scene's loop is
 * handed exactly this by the virtual clock once recording starts — so the road
 * behaves the same either side of frame 0. It also means the FORMAT's fps is
 * part of the physics: `step()` caps a tick at 60 ms, so a 15 fps draft
 * advances the world by less time than it advances the clock and lands its
 * beats somewhere else. Draft at 30 fps and a smaller frame instead.
 */
const frameMsFor = (ctx) => 1000 / ctx.fps

// ─── The save fixture ───────────────────────────────────────────────────────

/**
 * One `tower_state` blob (`src/keys.ts`, `useTowerState.ts`).
 *
 * Pin EVERY flag that can put something in front of the road: the tutorial
 * lightbox, the control primers, the shop spotlight, the weapon choice, the
 * boss-reward card. A first-run profile would spend the first two seconds of
 * every clip teaching.
 *
 * The upgrade levels are a real mid-career shop, not a maxed one: squad 6 /
 * power 8 / rate 6 is roughly what a player who has reached stage 12 has
 * bought, and it is what makes the crowd on screen look like something the
 * viewer could have. A maxed save deletes the road's difficulty and the clip
 * stops showing a game.
 */
export const saveFixture = (over = {}) => ({
  ts_stage: 12,
  ts_best_stage: 14,
  ts_best_squad: 260,
  ts_coins: 900,
  ts_total_coins: 26_000,
  ts_runs: 40,
  ts_total_kills: 3200,
  ts_upgrades: { squad: 6, power: 8, rate: 6, range: 4, scavenge: 3, grenade: 1, shield: 1 },

  // ── Nothing may be taught during a clip ──
  ts_tutorial_seen: true,
  ts_onboarded: true,
  ts_shop_spotlight_seen: true,
  ts_results_seen: 9,
  ts_guard_hint_seen: true,
  ts_lever_hint_seen: true,
  ts_cage_hint_seen: true,
  ts_bulwark_hint_seen: true,
  ts_gaze_taught: true,
  ts_skills_revealed: ['grenade', 'shield', 'frost', 'decoy'],
  ts_weapon_pick: 'rocket',
  ts_boss_reward: true,

  // The autobalancer, pinned flat: a clear streak winds the next stage UP and a
  // failure record winds it DOWN, and neither may be allowed to differ between
  // the success take and the fail take of the same stage.
  ts_challenge: 0,
  ts_failed_stages: {},
  ts_reward_declines: 0,

  // Nothing here posts a score (`preview.config.mjs` points the board at a dead
  // endpoint), but a stage already "submitted" is the second belt.
  ts_submitted_stage: 9999,

  // Silent at the source as well as at the browser (`--mute-audio`): the audio
  // graph never starts, so no `AudioContext.currentTime` runs alongside a clock
  // the recorder owns.
  ts_user_sound_volume: 0,
  ts_user_music_volume: 0,
  ts_mobile_mute: true,
  ts_user_haptics: false,
  ...over
})

/**
 * The same career, under-invested.
 *
 * The fail clips are the success clips' save with this shop instead, and that
 * is the whole reason the loss reads as avoidable rather than as a wall: same
 * stage, same road, same doors — a player who spent their coins on fewer of the
 * right things and arrives at the boss without the damage to finish it.
 *
 * It is also what makes a fail take REPEATABLE. With the full shop the same
 * road is a knife-edge: two scouting runs of the same seed had the crowd wipe
 * at 57 s and kill the boss at 95 s, because a fight that close is decided by
 * which way one slam lands. A fight that is genuinely out of reach ends the
 * same way every time, and "out of reach" is still only two upgrade levels.
 */
export const THIN_SHOP = { squad: 4, power: 4, rate: 3, range: 2, scavenge: 2, grenade: 0, shield: 0 }

/** Written into the page BEFORE the app's first line, so the game boots into
 *  it. `useTowerState` reads `tower_state` once, at module load. */
export const seedSaveScript = (save) => {
  try { localStorage.setItem('tower_state', JSON.stringify(save)) } catch { /* private mode */ }
  // The recorder's own flag, read by `src/game/previewFeed.ts` from the URL —
  // nothing to do here — but the ART flag persists, and a context that inherits
  // "off" from a previous session would record the procedural game.
  try { localStorage.setItem('artOverrides', 'true') } catch { /* private mode */ }
}

// ─── Boot ───────────────────────────────────────────────────────────────────

/**
 * Navigate with the save seeded, wait out every curtain, freeze the world.
 *
 * The freeze is the important part: from here to the first recorded frame the
 * simulation is advanced ONLY by this file, a fixed step at a time. Without it
 * the scene's own loop keeps running while `setup()` talks to the page over
 * CDP, and how far the road got depends on how busy the machine was.
 */
export const boot = async (ctx, { save, stage } = {}) => {
  // Boot ON the stage the clip records, not on the fixture's default. The
  // scene's own `startStage()` runs before anything here can intervene, and the
  // renderer primes a stage's monster strips off `stage.value` — booting on one
  // road and staging another makes the first seconds of the take bake the cast
  // it is actually about, six milliseconds at a time.
  const blob = save ?? saveFixture(stage ? { ts_stage: stage } : {})
  // The runner has already opened the page at the FULL recording URL — the
  // resolved port and every parameter: the config's (`tier`, `art`), the
  // format's, the clean feed's (`feed=…`), the scenario's, `--url-param`.
  // Reuse it. Rebuilding it from the config silently drops all of them, and
  // the clip records with the HUD on while every log line looks right.
  const current = typeof ctx.page.url === 'function' ? ctx.page.url() : ''
  if (!/^https?:/.test(current)) {
    throw new Error(
      `preview-video: boot() expected the runner to have opened the recording URL, but the page is at "${current}".`
    )
  }
  const url = current.split('#')[0]

  await ctx.page.addInitScript(seedSaveScript, blob)
  // Bounce through about:blank first: the router is on HASH history, so a
  // `goto` back to the same address with a `#/` on it is a same-document
  // navigation — the document is never rebuilt and the init scripts never run.
  await ctx.page.goto('about:blank')
  await ctx.page.goto(url, { waitUntil: 'domcontentloaded' })

  // The seam, then the two curtains. "Present in the DOM" is not "gone": the
  // clean feed has hidden both, and a hidden splash still owns the screen for
  // its own fade.
  await ctx.waitFor(() => !!(/** @type {any} */ (window).__preview), null, { timeout: 45_000 })
  await ctx.waitFor(() => {
    const stat = document.getElementById('static-splash')
    return (!stat || stat.classList.contains('hidden')) && !document.querySelector('.splash-backdrop')
  }, null, { timeout: 45_000 })

  await ctx.evaluate(() => { /** @type {any} */ (window).__preview.hold(true) })

  const status = await warmArt(ctx, stage)
  ctx.log.info(`art: ${status.enabled ? `${status.probes} probes warmed` : 'overrides OFF'}`)
  return url
}

/**
 * Hold until every painting this stage can ask for has decoded.
 *
 * Each one that arrives late drops the sprite bakes made from it and the
 * renderer re-bakes from the painting — so a clip that starts too early opens
 * on the procedural drawing and swaps to paint mid-shot. `preloadArtOverrides`
 * resolves on the settled probe for each want (a miss settles too), which is
 * the only honest signal: the dev server answers a missing `images/*.webp`
 * with the SPA fallback, so resource timings say everything loaded either way.
 *
 * The boss's DEATH strip is asked for separately because the game only requests
 * it at 80 % of the road (`deathArtDue`) — mid-clip, in every one of these
 * scenarios.
 */
export const warmArt = (ctx, stage) => ctx.evaluate(async (n) => {
  const P = /** @type {any} */ (window).__preview
  if (!P.art.artOverridesEnabled()) return { enabled: false, probes: 0 }
  const wants = [
    ...P.artPreload.allArtWants(),
    P.artPreload.deathArtWant(n),
    P.artPreload.deathArtWant(n + 1)
  ]
  await P.art.preloadArtOverrides(wants)
  return { enabled: true, probes: P.art.artProbeCount() }
}, stage)

// ─── The autopilot ──────────────────────────────────────────────────────────

/**
 * Install `window.__drive`: the balance suite's policies, wired to the live
 * game, plus the fast-forward the staging is made of.
 *
 * `tests/sim/policies.ts` is imported straight off the dev server. It is pure
 * — it reads a view and returns a lane x — and it imports only `@/game/survival`
 * and `@/game/threats`, both of which are constants and pure functions, so it
 * does not matter whether Vite hands this import the same module instance the
 * app is holding. The SIMULATION is never imported that way: that one comes
 * through `window.__preview`, which the app published itself.
 *
 * @param {object} o
 * @param {number} o.stage
 * @param {number} o.seed     re-seeds `Math.random` before the staging
 * @param {string} [o.policy] 'optimal' | 'good' | 'average' | 'careless' | …
 */
export const installDrive = async (ctx, { stage, seed, policy = 'optimal' }) => {
  const frameMs = frameMsFor(ctx)
  return ctx.evaluate(async (arg) => {
    const w = /** @type {any} */ (window)
    const P = w.__preview
    const G = P.game
    const [policies, survival] = await Promise.all([
      import('/tests/sim/policies.ts'),
      import('/src/game/survival.ts')
    ])

    const speed = survival.stageSpeed(arg.stage)
    const player = policies.policyById(arg.policy)
    player.reset(arg.seed)

    let t = 0
    /** A lane the beat sheet is holding the crowd on, or null for the policy. */
    let forced = null

    const view = () => ({
      stage: arg.stage,
      phase: G.phase.value,
      t,
      speed,
      anchorX: G.anchor().x,
      anchorY: G.anchor().y,
      squad: G.squadCount.value,
      crowdR: G.crowdRadius(),
      damage: G.damage.value,
      fireRate: G.runFireRate.value,
      dps: G.squadCount.value * G.damage.value * G.runFireRate.value,
      gates: G.getGates(),
      dividers: G.getDividers(),
      crates: G.getCrates(),
      barricades: G.getBarricades(),
      rocks: G.getRocks(),
      foes: G.getFoes(),
      pickups: G.getPickups(),
      boss: G.getBoss(),
      incoming: G.incomingThreat()
    })

    /** One decision. Steers, and moves the policy's own clock on. */
    const tick = (dtMs) => {
      const x = forced === null ? player.decide(view()) : forced
      if (Number.isFinite(x)) G.steerTo(x)
      t += dtMs / 1000
    }

    const over = () => G.phase.value === 'clear' || G.phase.value === 'wipe'

    /**
     * Where an AUTHORED bank is, straight off the track.
     *
     * `getGates()` only knows about banks the streamer has materialised —
     * `LOOKAHEAD` is 30 units, about five seconds of road — so it cannot answer
     * "start the clip far enough back that the multiplier lands at second six".
     * The track is the whole stage's score and is built deterministically from
     * the stage number, so the staging asks IT.
     *
     * Matched on the OFFER rather than on a hard-coded y: a rebalance that
     * moves stage 13's `×2.4` up the road moves the clip with it, and a
     * rebalance that removes it fails loudly instead of filming an empty road.
     *
     * @param {{ops?: string[], minValue?: number, last?: boolean, after?: number}} spec
     */
    const trackBankY = (spec) => {
      const events = G.getTrack().events.filter((e) => e.kind === 'gates')
      const from = G.anchor().y + (spec.after ?? 0)
      const hits = events.filter((e) => e.y > from && e.leaves.some((l) => (
        (!spec.ops || spec.ops.length === 0 || spec.ops.includes(l.op)) &&
        l.value >= (spec.minValue ?? 0)
      )))
      const hit = spec.last ? hits[hits.length - 1] : hits[0]
      return hit ? { y: hit.y, leaves: hit.leaves.map((l) => ({ op: l.op, value: l.value, x: l.x })) } : null
    }

    /** The live bank nearest ahead whose op is in `ops`, or null. */
    const bankAhead = (ops) => {
      const y0 = G.anchor().y
      let best = null
      for (const g of G.getGates()) {
        if (g.used || g.dismissed) continue
        if (ops.length > 0 && !ops.includes(g.op)) continue
        const gap = g.y - y0
        if (gap <= 0) continue
        if (best === null || gap < best.gap) best = { gap, x: g.x, op: g.op, value: g.value, bankId: g.bankId }
      }
      return best
    }

    const state = () => ({
      phase: G.phase.value,
      stage: G.stage.value,
      squad: G.squadCount.value,
      peak: G.peakSquad.value,
      progress: G.progress01.value,
      anchorY: G.anchor().y,
      damage: G.damage.value,
      fireRate: G.runFireRate.value,
      boss: G.getBoss() ? { hp01: G.bossHp01.value, dead: !!G.getBoss().dead } : null,
      elite: G.eliteAlive.value,
      seconds: t
    })

    let intervalId = 0

    w.__drive = {
      view,
      state,
      bankAhead,
      trackBankY,
      /** Put the policy and its clock back to the top of a run. Called before
       *  every pass over a stage, so the scout and the take play the same run. */
      reset: (s) => {
        player.reset(s)
        t = 0
        forced = null
      },
      seconds: () => t,
      /** Take the wheel: hold the crowd on lane `x` until `release()`. */
      aim: (x) => { forced = x },
      release: () => { forced = null },

      /**
       * SETUP ONLY — advance the FROZEN sim, unrendered.
       *
       * One decision and one fixed step per iteration, exactly as the recording
       * will run it, with the effect queue drained and thrown away: every gate
       * pass, explosion and death of the fast-forward would otherwise be
       * consumed by the renderer in one batch on the next frame and open the
       * clip with a screenful of other people's sparks.
       *
       * `stop` is a descriptor rather than a function so it can cross the CDP
       * boundary. Returns why it stopped.
       */
      fast: (dtMs, stop, maxSteps) => {
        // A track bank is resolved ONCE, against the road as it stands now, and
        // then held as a y: re-reading it every step would re-target the moment
        // the crowd passes the bank it was aiming at.
        let targetY = null
        if (stop.kind === 'trackBank') {
          const hit = trackBankY(stop)
          if (!hit) {
            return { steps: 0, seconds: 0, reached: false, missing: 'bank', ...state() }
          }
          targetY = hit.y - (stop.gap ?? 0)
        }
        const reached = () => {
          if (stop.kind === 'trackBank') return G.anchor().y >= targetY
          if (stop.kind === 'y') return G.anchor().y >= stop.value
          if (stop.kind === 'progress') return G.progress01.value >= stop.value
          if (stop.kind === 'phase') return G.phase.value === stop.value
          if (stop.kind === 'bank') {
            if (G.squadCount.value < (stop.minSquad ?? 0)) return false
            const b = bankAhead(stop.ops ?? [])
            return b !== null && b.gap <= stop.gap
          }
          if (stop.kind === 'seconds') return t >= stop.value
          return true
        }
        let steps = 0
        while (steps < maxSteps && !reached() && !over()) {
          tick(dtMs)
          G.step(dtMs)
          P.vfx.drainFx()
          steps++
        }
        return { steps, seconds: steps * dtMs / 1000, reached: reached(), ...state() }
      },

      /** One decision and one fixed step of the FROZEN sim, effects discarded.
       *  `fast` is this in a loop; `scout` calls it a step at a time so it can
       *  watch the world between them. */
      step: (dtMs) => {
        tick(dtMs)
        G.step(dtMs)
        P.vfx.drainFx()
      },

      /** RECORD ONLY — one decision per recorded frame, on the virtual clock.
       *  Timers fire before rAF in the recorder's clock, so the steer always
       *  lands on the frame the scene is about to simulate. */
      start: (periodMs) => {
        if (intervalId) clearInterval(intervalId)
        intervalId = setInterval(() => tick(periodMs), periodMs)
      },
      stop: () => {
        if (intervalId) clearInterval(intervalId)
        intervalId = 0
      }
    }

    // The staging starts from a known stream. Everything the boot, the splash
    // and the first frames drew has already spent an unknowable number of them.
    w.__vseed?.reseed(arg.seed)
    return { policy: player.id, speed }
  }, { stage, seed, policy })
}

/**
 * Play the whole stage once, frozen and unrendered, and bring back its
 * timeline. SETUP only, a couple of seconds of wall time.
 *
 * This is what lets a beat sheet say "the boss dies at 94 % of the clip"
 * instead of carrying a hard-coded number that a rebalance quietly invalidates
 * — the clip would still record, and it would end four seconds after the shot
 * it exists for.
 *
 * ── The bookkeeping, which is the whole difficulty ──
 *
 * A scouting run REACHES A VERDICT, and a verdict is written down: the clear
 * streak that winds the next stage up, the resume stage, the per-stage failure
 * record that hands out relief. Leave those and the recorded take is a
 * measurably different fight from the one that was measured. So the save blob
 * is snapshotted before and restored after.
 *
 * The scene reacts too — its `watch(phase)` puts the result screen up (or flows
 * straight into the next stage), and that watcher runs on the microtask after
 * this evaluate returns, i.e. before anything else the scenario does. Pressing
 * the scene's own retry afterwards is what clears it, because it is the same
 * path a player takes: the overlay goes down and the stage re-opens.
 */
export const scoutStage = async (ctx, { stage, seed = 7 }) => {
  const frameMs = frameMsFor(ctx)
  const line = await ctx.evaluate((arg) => {
    const w = /** @type {any} */ (window)
    const P = w.__preview
    const G = P.game
    const D = w.__drive

    const before = JSON.parse(JSON.stringify(P.state.towerState.value))
    P.hold(true)
    D.reset(arg.seed)
    G.startStage(arg.stage)
    P.vfx.resetVfx()
    P.vfx.drainFx()
    w.__vseed?.reseed(arg.seed)

    const track = G.getTrack()
    const banks = track.events.filter((e) => e.kind === 'gates').map((e) => ({
      y: e.y,
      offer: e.leaves.map((l) => `${l.op}${l.value}`).join('/'),
      at: null,
      squad: 0
    }))
    const out = {
      arenaY: track.arenaY,
      banks,
      lastBank: null,
      payoffBank: null,
      elite: null,
      eliteGone: null,
      boss: null,
      bossDead: null,
      clear: null,
      wipe: null,
      seconds: 0,
      peak: 0
    }

    let i = 0
    let sawElite = false
    for (let step = 0; step < arg.maxSteps; step++) {
      const t = (step * arg.dtMs) / 1000
      out.seconds = t
      const y = G.anchor().y
      while (i < banks.length && y >= banks[i].y) {
        banks[i].at = t
        banks[i].squad = G.squadCount.value
        out.lastBank = t
        i++
      }
      if (!sawElite && G.eliteAlive.value) { sawElite = true; out.elite = t }
      if (sawElite && out.eliteGone === null && !G.eliteAlive.value) out.eliteGone = t
      if (out.boss === null && G.phase.value === 'boss') out.boss = t
      if (out.boss !== null && out.bossDead === null && G.getBoss()?.dead) out.bossDead = t
      if (G.phase.value === 'clear') { out.clear = t; break }
      if (G.phase.value === 'wipe') { out.wipe = t; break }
      D.step(arg.dtMs)
    }
    out.peak = G.peakSquad.value

    // The biggest single jump in the crowd, which is what a payoff IS. Read off
    // the banks the run actually crossed rather than assumed from the offers:
    // a `×2.4` the crowd walked past is not a payoff.
    let best = null
    for (let k = 1; k < banks.length; k++) {
      const b = banks[k]
      if (b.at === null) continue
      const gain = b.squad - (banks[k - 1].squad || 0)
      if (best === null || gain > best.gain) best = { gain, at: b.at, offer: b.offer, y: b.y }
    }
    out.payoffBank = best

    return { line: out, before }
  }, { stage, seed, dtMs: frameMs, maxSteps: Math.round(150 * ctx.fps) })

  // The scene's phase watcher has now run. Put the road and the save back.
  await ctx.evaluate((before) => {
    const P = /** @type {any} */ (window).__preview
    P.retry()
    P.state.setStates(before)
  }, line.before)

  const l = line.line
  ctx.log.info(
    `scouted stage ${stage}: ${l.banks.filter((b) => b.at !== null).length}/${l.banks.length} banks, ` +
    `miniboss ${l.elite?.toFixed(1) ?? '—'}s, boss ${l.boss?.toFixed(1) ?? '—'}s→${l.bossDead?.toFixed(1) ?? '—'}s, ` +
    `${l.clear !== null ? `CLEAR @${l.clear.toFixed(1)}s` : `WIPE @${l.wipe?.toFixed(1)}s`}, peak ${l.peak}` +
    (l.payoffBank ? `, biggest door ${l.payoffBank.offer} @${l.payoffBank.at.toFixed(1)}s (+${l.payoffBank.gain})` : '')
  )
  return l
}

/**
 * Open the stage, then fast-forward the frozen road to the moment the clip
 * wants. SETUP only.
 *
 * @param {object} plan
 * @param {number} plan.stage
 * @param {{kind: 'progress'|'phase'|'bank'|'seconds', [k: string]: any}} plan.stop
 * @param {number} [plan.maxSeconds]  give up rather than spin if the road never
 *                                    produces what was asked for
 */
export const stageRun = async (ctx, { stage, stop, seed = 7, maxSeconds = 90 }) => {
  const frameMs = frameMsFor(ctx)
  const maxSteps = Math.round((maxSeconds * 1000) / frameMs)

  // ── "Start the clip so that X lands here" ──
  //
  // Scout the stage, take the time of the anchor event, and turn it into a
  // plain "fast-forward this many seconds". The clip is then cut from the run
  // the game actually plays rather than from an estimate of it.
  if (stop.kind === 'preroll') {
    const line = await scoutStage(ctx, { stage, seed })
    let at = line[stop.anchor]

    // `anchor: 'bank'` aims at a DOOR rather than at an event of the run: the
    // offer is matched as text ('mul', '÷', 'sub4') against the leaves the
    // scout recorded, so a beat sheet says "open six seconds before the
    // multiplier" and keeps meaning that when the road is rebalanced.
    if (stop.anchor === 'bank') {
      const hits = line.banks.filter((b) => b.at !== null && (!stop.match || b.offer.includes(stop.match)))
      const pick = stop.pick ?? 'first'
      const chosen = pick === 'last'
        ? hits[hits.length - 1]
        : pick === 'biggest'
          ? hits.reduce((best, b, i) => {
            const gain = b.squad - (line.banks[line.banks.indexOf(b) - 1]?.squad ?? 0)
            return best === null || gain > best.gain ? { gain, b } : best
          }, null)?.b
          : hits[0]
      if (!chosen) {
        throw new Error(
          `preview-video: stage ${stage} has no bank matching "${stop.match}" that the run reaches ` +
          `(it crossed ${line.banks.filter((b) => b.at !== null).map((b) => b.offer).join(', ')}).`
        )
      }
      at = chosen.at
      ctx.log.info(`anchor bank: ${chosen.offer} at y=${chosen.y}, crossed ${chosen.at.toFixed(1)} s in with ${chosen.squad}`)
    }

    if (at === null || at === undefined) {
      throw new Error(
        `preview-video: stage ${stage} never reached "${stop.anchor}" in a scouting run ` +
        `(${JSON.stringify({ boss: line.boss, bossDead: line.bossDead, clear: line.clear, wipe: line.wipe })}). ` +
        'The beat sheet is aimed at something this road does not do any more.'
      )
    }
    const start = Math.max(0, at - stop.lead / 1000)
    ctx.log.info(
      `preroll: "${stop.anchor}" happens at ${at.toFixed(1)} s, clip wants it at ` +
      `${(stop.lead / 1000).toFixed(1)} s in → opening at ${start.toFixed(1)} s of the run`
    )
    stop = { kind: 'seconds', value: start }
  }

  // NB: every page-side closure in this file takes `window` into a local first.
  // A statement followed by a line that STARTS with `(window)` — which is what
  // a `/** @type {any} */ (window)` cast looks like to the parser — is one
  // expression: `P.hold(true)(window).…`. It cost a take and an hour.
  const opened = await ctx.evaluate((arg) => {
    const w = /** @type {any} */ (window)
    const P = w.__preview
    P.hold(true)
    w.__drive.reset(arg.seed)
    P.game.startStage(arg.stage)
    P.vfx.resetVfx()
    P.vfx.drainFx()
    w.__vseed?.reseed(arg.seed)
    return { stage: P.game.stage.value, phase: P.game.phase.value, squad: P.game.squadCount.value }
  }, { stage, seed })
  if (opened.stage !== stage) {
    throw new Error(`preview-video: asked for stage ${stage} and got ${opened.stage} — the save fixture did not take.`)
  }

  const at = await ctx.evaluate((arg) => {
    return /** @type {any} */ (window).__drive.fast(arg.frameMs, arg.stop, arg.maxSteps)
  }, { frameMs, stop, maxSteps })

  if (at.missing === 'bank') {
    throw new Error(
      `preview-video: stage ${stage} has no gate bank matching ${JSON.stringify(stop)}. ` +
      'The road was rebalanced under this beat sheet — pick the offer it should open on again ' +
      '(tools/preview-video/README has the track dump).'
    )
  }
  if (!at.reached) {
    ctx.log.warn(
      `staging never reached ${JSON.stringify(stop)} — stopped at ${at.seconds.toFixed(1)} s, ` +
      `phase ${at.phase}, squad ${at.squad}`
    )
  }
  if (at.phase !== 'run' && at.phase !== 'boss') {
    throw new Error(
      `preview-video: the staging run ended (${at.phase}) before the clip started. ` +
      'A fail take is supposed to happen ON CAMERA — restage earlier, or give the fixture better upgrades.'
    )
  }
  ctx.log.info(
    `staged stage ${stage}: ${at.seconds.toFixed(1)} s of road, ${at.progress.toFixed(2)} in, ` +
    `squad ${at.squad}, dmg ${at.damage.toFixed(1)}, rate ${at.fireRate.toFixed(2)}`
  )
  return at
}

// ─── The take ───────────────────────────────────────────────────────────────

/**
 * The first line of every `record()`: re-seed, let the world go, and put the
 * autopilot on the wheel.
 *
 * The re-seed is here rather than only in `installDrive` because `setup()` ends
 * with real frames still being drawn — the splash's ghosts, the crowd's idle
 * jitter — and each of them pulls on the same stream the clip's sparks come
 * from. At this point the virtual clock is armed and nothing else can draw
 * before frame 1.
 */
export const rollCamera = async (ctx, { seed = 7 } = {}) => {
  const periodMs = frameMsFor(ctx)
  await ctx.evaluate((arg) => {
    const w = /** @type {any} */ (window)
    w.__vseed?.reseed(arg.seed)
    w.__drive.start(arg.periodMs)
    w.__preview.hold(false)
  }, { seed, periodMs })
}

/** Whatever the game thinks is true right now — for logging and assertions. */
export const snapshot = (ctx) => ctx.evaluate(() => /** @type {any} */ (window).__drive.state())

/** The live bank nearest ahead, with its lane and its offer. */
export const bankAhead = (ctx, ops = []) =>
  ctx.evaluate((o) => /** @type {any} */ (window).__drive.bankAhead(o), ops)

/** Where an authored bank sits on the track, matched on its offer. */
export const trackBank = (ctx, spec) =>
  ctx.evaluate((s) => /** @type {any} */ (window).__drive.trackBankY(s), spec)

/** Hold the crowd on one lane (a scripted mistake, a scripted commitment). */
export const aim = (ctx, x) => ctx.evaluate((v) => /** @type {any} */ (window).__drive.aim(v), x)

/** Give the wheel back to the policy. */
export const release = (ctx) => ctx.evaluate(() => /** @type {any} */ (window).__drive.release())

/**
 * Ride the clip out to the verdict and then back INTO the game.
 *
 * With the HUD hidden, a result screen is an invisible overlay that also stops
 * the world: the last seconds of a clip that ends on one are a still frame. So
 * the verdict is taken as the cue to press the button the player would press —
 * the scene's own `onNext` / `onRetry` — and the clip ends on the next road
 * opening, or on the retry's first strides.
 *
 * @returns {Promise<'clear'|'wipe'|'running'>}
 */
export const rideToVerdict = async (ctx, t, { timeoutMs = 8000 } = {}) => {
  await ctx.stepUntil(
    () => {
      const p = /** @type {any} */ (window).__preview.game.phase.value
      return p === 'clear' || p === 'wipe'
    },
    { timeoutMs, label: 'verdict' }
  )
  const s = await snapshot(ctx)
  if (s.phase !== 'clear' && s.phase !== 'wipe') return 'running'
  ctx.beat(s.phase === 'clear' ? 'clear' : 'wipe')
  ctx.log.info(`verdict: ${s.phase} at ${s.progress.toFixed(2)}, squad ${s.squad}, peak ${s.peak}`)
  return s.phase
}

/**
 * Press the result screen's own button and play on.
 *
 * A beat of video has to pass between the verdict and the press — the game
 * hands the result screen a `presentResult` that may await an ad gate, and the
 * scene's phase watcher has not run yet on the frame the phase flipped.
 */
export const playOn = async (ctx, t, verdict) => {
  await t.wait(600)
  await ctx.evaluate((next) => {
    const P = /** @type {any} */ (window).__preview
    if (next) P.next()
    else P.retry()
  }, verdict === 'clear')
  ctx.beat(verdict === 'clear' ? 'nextRoad' : 'retry')
}

/**
 * A wall clock for `record()` that cannot overrun the clip.
 *
 * Every wait is clamped to what is left of `ctx.durationMs`, and `wait` returns
 * false once the budget is spent — so `--duration 6` ends the beat sheet early
 * instead of scheduling beats past the last captured frame.
 */
export const budget = (ctx) => {
  const total = Math.max(1000, Number(ctx.durationMs) || 10_000)
  let spent = 0
  return {
    async wait(ms) {
      const left = total - spent
      if (left <= 0) return false
      const take = Math.min(Math.max(0, ms), left)
      spent += take
      if (take > 0) await ctx.wait(take)
      return spent < total
    },
    /** Wait until `at` ms into the clip (no-op if already past it). */
    until(at) { return this.wait(Math.max(0, at - spent)) },
    left: () => total - spent,
    spent: () => spent
  }
}
