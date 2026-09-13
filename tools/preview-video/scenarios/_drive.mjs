/**
 * ─── Driving Splatix ────────────────────────────────────────────────────────
 *
 * Everything game-specific lives here, so the scenario modules read as beat
 * sheets. `record.mjs` and `lib/` are the skill's, copied verbatim; this file,
 * `preview.config.mjs` and `scenarios/*` are the game's half.
 *
 * ── The seams ──
 *
 *   window.__preview   { feed, game, vfx, art, artPreload, state, hold, held,
 *                        next, retry, play }  — `src/game/previewFeed.ts`, DEV
 *                        only, published under `?preview=1` (which every
 *                        recording URL carries, clean or not)
 *   window.__drive     the autopilot installed by `installDrive` below
 *
 * ── Why this game is STAGED and then PLAYED ──
 *
 * Splatix has no track. There is a board, a clock, a director that spawns
 * bodies on a timer, and one shoe that goes where the player points. Nothing
 * arrives on its own: the interesting moments — a ×20 chain, a full vial, the
 * gilded boot clearing a swarm — happen because somebody is PLAYING WELL, and
 * they happen when that player has put in the squishes.
 *
 * So a clip is made of three decisions:
 *
 *   1. WHO is playing: a save fixture (level, shoe, stars, every "seen" flag)
 *      that opens a board worth filming with no lesson in front of it.
 *   2. WHERE the clip starts: the simulation is FROZEN (`hold`) and then
 *      fast-forwarded, unrendered, until the board is at the moment the beat
 *      sheet wants — "the vial is one squish from full", "eight seconds into
 *      the boss". `setup()` therefore ends quiescent, which is what makes two
 *      takes identical (see the skill's troubleshooting, "the state at arm()
 *      comes out of REAL time").
 *   3. HOW it is played: the autopilot below, one decision per recorded frame.
 *      A beat sheet can take the wheel for a beat (`aim` / `hold` / `release`)
 *      when it needs one particular thing squished.
 *
 * ── The autopilot, and why it lives here rather than in `tests/` ──
 *
 * It is a POLICY over the live world: read the bodies, pick a target, move the
 * foot, press, release. It has to run inside the page because it reads the
 * simulation through `window.__preview` — the instance the app actually holds —
 * so it is defined as page-side source in `installDrive` and never imported.
 *
 * Three players, and the difference between them is the whole difference
 * between a success clip and a fail clip:
 *
 *   ace      picks the highest-value reachable body, slams what it cannot tap,
 *            never touches a caterpillar, and spends Fever the moment it is lit
 *   good     the same, a little slower, and it does not always slam
 *   average  hesitates, taps armour, and walks into the occasional spike
 *
 * ── Determinism ──
 *
 * `Math.random` is seeded by the recorder at document start and re-seeded here
 * at two points: before the fast-forward (so the staging is repeatable) and at
 * the top of `record()` (so the take does not inherit whatever the real-time
 * boot and its splash animations drew). The sim is stepped at exactly the
 * recording's frame time in both phases, and the autopilot's own jitter runs on
 * a small deterministic PRNG of its own rather than on `Math.random`, so the
 * physics before and after frame 0 are the same physics.
 */

/**
 * One tick of the simulation, in the recording's own frame time.
 *
 * The staging steps the frozen sim by exactly this, and the scene's loop is
 * handed exactly this by the virtual clock once recording starts — so the board
 * behaves the same either side of frame 0. It also means the FORMAT's fps is
 * part of the physics: `step()` accumulates in fixed 60 Hz sub-steps and caps
 * the catch-up, so a 15 fps draft advances the world by less time than it
 * advances the clock and lands its beats somewhere else. Draft at 30 fps and a
 * smaller frame instead.
 */
const frameMsFor = (ctx) => 1000 / ctx.fps

// ─── The save fixture ───────────────────────────────────────────────────────

/**
 * One `splatix_state` blob (`src/keys.ts`, `src/use/useSplatixState.ts`).
 *
 * Pin EVERY flag that can put something in front of the board: the wordless
 * tutorial, the control primers, the per-species hints, the Locker badge. A
 * first-run profile would spend the first four seconds of every clip teaching,
 * and the tutorial is designed to be impossible to skip.
 *
 * The career is a real mid-game one, not a completed one: world 2, a bank of
 * stars, two shoes owned and the steel boot on. A maxed save is worse than a
 * thin one here — with every shoe bought there is nothing on screen a viewer
 * could want.
 */
export const saveFixture = (over = {}) => ({
  sx_level: 14,
  sx_best_level: 14,
  sx_level_stars: {
    1: 3, 2: 3, 3: 3, 4: 3, 5: 2, 6: 3, 7: 2, 8: 3, 9: 3, 10: 3,
    11: 3, 12: 2, 13: 3
  },
  sx_coins: 420,
  sx_total_coins: 3100,
  sx_runs: 31,
  sx_total_squishes: 980,
  sx_best_score: 18_400,
  sx_best_combo: 20,
  sx_shoe: 'steelBoot',
  sx_shoes_owned: ['sneaker', 'steelBoot'],

  // ── Nothing may be taught during a clip ──
  sx_tutorial_seen: true,
  sx_onboarded: true,
  sx_results_seen: 20,
  sx_locker_spotlight: true,
  sx_hints_seen: {
    move: true, slam: true, beetle: true, flea: true, spike: true, stink: true,
    fever: true, honey: true, web: true, belt: true, sweeper: true, boss: true,
    pods: true
  },

  // The relief system, pinned flat: a failure record hands the next attempt a
  // slower board and a longer clock, and that may not differ between the
  // success take and the fail take of the same level.
  sx_failed_levels: {},

  // Nothing here posts a score (`preview.config.mjs` points the board at a dead
  // endpoint), but a run already "submitted" is the second belt.
  sx_submitted_score: 9_999_999,

  // The look, pinned: a clip must not inherit a previous session's toggles.
  sx_juice_style: 'ooze',
  sx_high_vis: false,
  sx_single_tap: false,
  sx_user_difficulty: 'medium',
  sx_music_track: 'cozy',

  // Silent at the source as well as at the browser (`--mute-audio`): the audio
  // graph never starts, so no `AudioContext.currentTime` runs alongside a clock
  // the recorder owns.
  sx_user_sound: 0,
  sx_user_music: 0,
  sx_mobile_mute: true,
  sx_haptics: false,
  ...over
})

/**
 * The same career, in the starter shoe.
 *
 * The fail clips are the success clips' save with this instead, and that is the
 * whole reason the loss reads as avoidable rather than as a wall: same level,
 * same board, same bugs — a player who never bought the steel boot, so the
 * caterpillars hurt and the shells take two blows.
 *
 * It is also what makes a fail take REPEATABLE. In the steel boot the same
 * level is a knife-edge, and a run that close is decided by which way one stomp
 * lands; a level that is genuinely out of reach ends the same way every time,
 * and "out of reach" here is one shoe.
 */
export const STARTER_LOADOUT = { sx_shoe: 'sneaker', sx_shoes_owned: ['sneaker'] }

/** Written into the page BEFORE the app's first line, so the game boots into
 *  it. `useSplatixState` reads `splatix_state` once, at module load. */
export const seedSaveScript = (save) => {
  try { localStorage.setItem('splatix_state', JSON.stringify(save)) } catch { /* private mode */ }
  // The recorder's own flag is read by `src/game/previewFeed.ts` from the URL —
  // nothing to do here — but the ART flag persists, and a context that inherits
  // "off" from a previous session would record the procedural game.
  try { localStorage.setItem('artOverrides', 'true') } catch { /* private mode */ }
  // The keyboard-cheat module publishes a SECOND handle on `window.__run` and
  // binds global keys. Off, always: two handles onto one singleton is how a
  // take ends up driven by the wrong module instance.
  try { localStorage.removeItem('cheat') } catch { /* private mode */ }
}

// ─── Boot ───────────────────────────────────────────────────────────────────

/**
 * Navigate with the save seeded, wait out every curtain, freeze the world.
 *
 * The freeze is the important part: from here to the first recorded frame the
 * simulation is advanced ONLY by this file, a fixed step at a time. Without it
 * the scene's own loop keeps running while `setup()` talks to the page over
 * CDP, and how far the level got depends on how busy the machine was.
 */
export const boot = async (ctx, { save, level } = {}) => {
  // Boot ON the level the clip records, not on the fixture's default. The
  // scene's own `startLevel()` runs before anything here can intervene, and the
  // renderer bakes a level's bug strips off `getLevel().roster` — booting on
  // one cast and staging another makes the first seconds of the take bake the
  // cast it is actually about, six milliseconds at a time.
  const blob = save ?? saveFixture(level ? { sx_level: level } : {})
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

  const status = await warmArt(ctx, level ?? blob.sx_level)
  ctx.log.info(`art: ${status.enabled ? `${status.probes} probes warmed` : 'overrides OFF'}`)
  return url
}

/**
 * Hold until every painting this level can ask for has decoded.
 *
 * Each one that arrives late drops the sprite bakes made from it and the
 * renderer re-bakes from the painting — so a clip that starts too early opens
 * on the procedural drawing and swaps to paint mid-shot.
 * `preloadArtOverrides` resolves on the settled probe for each want (a miss
 * settles too), which is the only honest signal: the dev server answers a
 * missing `images/*.webp` with the SPA fallback, so resource timings say
 * everything loaded either way.
 *
 * The NEXT level's cast is warmed as well, because a success clip ends by
 * pressing the result screen's forward button and playing on.
 */
export const warmArt = (ctx, level) => ctx.evaluate(async (n) => {
  const P = /** @type {any} */ (window).__preview
  if (!P.art.artOverridesEnabled()) return { enabled: false, probes: 0 }
  // Everything, not just this level's cast: a success clip ends by pressing the
  // result screen's forward button and playing on into the next level.
  await P.art.preloadArtOverrides(P.artPreload.allArtWants())
  P.artPreload.warmNextLevelArt(n + 1)
  return { enabled: true, probes: P.art.artProbeCount() }
}, level)

// ─── The autopilot ──────────────────────────────────────────────────────────

/**
 * Install `window.__drive`: a scripted player wired to the live game, plus the
 * fast-forward the staging is made of.
 *
 * @param {object} o
 * @param {number} o.level
 * @param {number} o.seed     re-seeds `Math.random` before the staging
 * @param {string} [o.policy] 'ace' | 'good' | 'average'
 * @param {boolean} [o.autoFever] let the player spend the vial themselves.
 *   Defaults to the policy's own habit. A beat sheet that has CUT ITS CLIP
 *   around the Fever turns this off and fires it itself: the `ace` spends the
 *   vial the frame it lights up, and a vial that fills two seconds early then
 *   gets spent two seconds off the beat. With it off the vial fills and WAITS —
 *   a full vial does not decay (see `combo.decayJuice`) — until the sheet says
 *   go.
 */
export const installDrive = async (ctx, { level, seed, policy = 'ace', autoFever }) => {
  return ctx.evaluate(async (arg) => {
    const w = /** @type {any} */ (window)
    const P = w.__preview
    const G = P.game

    // ── The players ──
    //
    // `reach` is how far from the foot a body may be and still be chosen, in
    // `u`; `react` is the pause between a body being chosen and the press, in
    // ms; `slam` is how readily the player charges rather than taps; `slip` is
    // the chance of taking a target it should not (a caterpillar, an armoured
    // body it cannot open); `commit` is how close the foot has to be before the
    // player presses, as a fraction of the stomp radius — over 1 and they are
    // pressing while the shoe is still travelling, which is what an impatient
    // player does. `sloppy` is how far off the body they aim, in `u`, chosen once
    // per target and held — which is what MISSES are actually made of.
    //
    // Those two are the whole of the fail clips, and `sloppy` is the one that
    // did the work. This game is FORGIVING by design: a stomp reaches
    // `radius + the body's own size`, so a bot that reacted a third of a second
    // late and pressed while still travelling still cleared a world-4 level with
    // eighty-four seconds to spare and no misses at all. What a struggling
    // player actually does is aim at the wrong place — and a shoe that lands
    // beside a bug is a miss, a broken chain, and a quota that does not get
    // met.
    //
    // The ace's reach is DELIBERATELY unbounded. A short reach does not make a
    // player look careful, it makes them look asleep: the board is 100 u wide
    // and nearly 200 u tall in portrait, so a 62 u reach left the autopilot with
    // nothing to do for two frames in five and the chain never climbed past ×2.
    // Distance is already priced into the choice below (`value / (6 + d)`) — a
    // far body simply has to be worth the walk.
    const PLAYERS = {
      ace: { reach: 999, react: 60, commit: 0.5, sloppy: 0, slam: 1, slip: 0, fever: true, jitter: 0.5 },
      good: { reach: 120, react: 140, commit: 0.8, sloppy: 2.5, slam: 0.7, slip: 0.05, fever: true, jitter: 1.2 },
      average: { reach: 55, react: 380, commit: 1.35, sloppy: 15, slam: 0.12, slip: 0.32, fever: false, jitter: 3.4 }
    }
    const player = PLAYERS[arg.policy] ?? PLAYERS.ace
    let autoFever = arg.autoFever === undefined ? player.fever : !!arg.autoFever

    // A PRNG of the autopilot's own, so its hesitation does not consume the
    // stream the renderer's sparks come from.
    let rngState = arg.seed >>> 0 || 1
    const rnd = () => {
      rngState = (rngState * 1_664_525 + 1_013_904_223) >>> 0
      return rngState / 4_294_967_296
    }

    let t = 0
    /** A point the beat sheet is holding the foot on, or null for the policy. */
    let forced = null
    /** A press the beat sheet is holding down, so a scripted slam can charge. */
    let forcedHold = false

    /** ms until the player commits to whatever it has chosen. */
    let waiting = 0
    /** ms the current press has been held; a slam needs `shoe.chargeMs`. */
    let holding = -1
    let heavyWanted = false
    /** ms before the next press is allowed. See `restMs`. */
    let rest = 0
    /**
     * The body this player is going for, held until it dies or is taken.
     *
     * Re-choosing every frame looked reasonable and played terribly: the foot
     * moves, which changes which body is nearest, which moves the foot — the
     * shoe dithered between two ants and pressed on neither. A person picks a
     * target and commits to it.
     */
    let locked = null

    /**
     * Why the player is not pressing, counted in frames.
     *
     * The autopilot is the least observable thing in this pipeline — it runs
     * inside a page, inside a fast-forward, with no renderer — and "it only
     * landed fifteen blows in twenty-seven seconds" is impossible to debug
     * without knowing WHICH of the four gates it sat behind. Reported by
     * `state()`, printed by `scout`.
     */
    const why = { press: 0, rest: 0, busy: 0, travel: 0, react: 0, empty: 0, held: 0 }

    const live = () => {
      const bugs = G.getBugs()
      const n = G.getBugCount()
      const out = []
      for (let i = 0; i < n; i++) if (bugs[i] && bugs[i].alive) out.push(bugs[i])
      return out
    }

    /**
     * Which body to go for.
     *
     * Value per unit of travel: a piñata fly across the board beats an ant
     * under the foot, an ant under the foot beats a piñata fly in the next
     * county. Spiky bodies are worth NEGATIVE value to a player in a shoe that
     * is not spike-proof — unless `slip` decides this is the moment it gets it
     * wrong, which is what the fail clips are made of.
     */
    const choose = () => {
      const f = G.getFoot()
      const shoe = G.getShoe()
      const boss = G.getBoss()
      let best = null
      for (const b of live()) {
        if (b.spec.airborne && b.dip < 0.5) continue
        const d = Math.hypot(b.x - f.x, b.y - f.y)
        if (d > player.reach) continue
        const spiky = b.spec.spiky && !shoe.spikeProof
        if (spiky && rnd() > player.slip) continue
        const armoured = shoe.pierce < b.spec.armor
        let value = b.spec.score + b.spec.juice * 400
        if (spiky) value = -value
        if (armoured) value *= 0.55
        const score = value / (6 + d)
        if (best === null || score > best.score) {
          // The BODY is kept, not a copy of where it was: the aim tracks it as
          // it walks, which is what makes a moving target feel aimed at.
          best = { score, bug: b, heavy: armoured || b.spec.hp > 1, id: b.id }
        }
      }
      // Nothing worth taking: go and stand on the boss, which is always worth
      // hitting and is the only thing on a boss board between waves of adds.
      if (best === null && boss && boss.alive) {
        return { score: 0, bug: null, boss: true, heavy: true, id: 'boss' }
      }
      return best
    }

    /**
     * Where the locked target is right now, or null if it is gone.
     *
     * `sloppy` is added HERE rather than at the press, and chosen once per lock
     * rather than per frame, because that is what being bad at this looks like:
     * a player commits to a spot slightly off the bug and walks the shoe to it.
     * Re-rolling it every frame would read as a tremor instead.
     */
    const targetAt = () => {
      if (!locked) return null
      if (locked.boss) {
        const b = G.getBoss()
        return b && b.alive ? { x: b.x + locked.ox, y: b.y + locked.oy } : null
      }
      if (!locked.bug || !locked.bug.alive) return null
      return { x: locked.bug.x + locked.ox, y: locked.bug.y + locked.oy }
    }

    /**
     * The gap this player leaves between two presses.
     *
     * The shoe's own cooldown is the floor, but never under the double-tap
     * window: two presses inside `DOUBLE_TAP_MS` in the same place are a HEEL
     * PIVOT, not two stomps, and an autopilot that hammers one spot spent half
     * its presses pivoting. The first cut of this file managed sixteen landed
     * blows in twenty-six seconds for exactly that reason.
     */
    const restMs = (shoe) => Math.max(shoe.cooldown, 280) + player.react

    /**
     * One decision, in the recording's own frame time.
     *
     * Deliberately a small state machine rather than "tap whatever is nearest":
     * the shoe takes real time to arrive, a slam takes real time to charge, and
     * a player who presses the instant a body exists looks like a cursor, not
     * like a person.
     */
    const tick = (dtMs) => {
      t += dtMs / 1000
      if (G.phase.value !== 'play') { holding = -1; locked = null; return }
      const shoe = G.getShoe()
      if (rest > 0) rest -= dtMs

      // The beat sheet has the wheel.
      if (forced !== null) {
        G.aim(forced.x, forced.y)
        if (forcedHold && holding < 0) { G.press(forced.x, forced.y, t * 1000); holding = 0 }
        else if (!forcedHold && holding >= 0) { G.release(); holding = -1 }
        if (holding >= 0) holding += dtMs
        return
      }

      // Fever is free score and the best two seconds of footage in the game.
      if (autoFever && G.feverCharged.value) G.tryFever()

      if (holding >= 0) {
        why.held++
        holding += dtMs
        // A slam is released once it is charged; a tap was already fired on the
        // way down (see `press`), so it is let go immediately.
        if (!heavyWanted || holding >= shoe.chargeMs + 40) {
          G.release()
          holding = -1
          rest = restMs(shoe)
          locked = null
        }
        return
      }

      // Commit to a target and hold it until it is dead or gone.
      let at = targetAt()
      if (at === null) {
        locked = choose()
        if (locked) {
          locked.ox = (rnd() - 0.5) * player.sloppy
          locked.oy = (rnd() - 0.5) * player.sloppy
        }
        at = targetAt()
        waiting = player.react
      }
      if (at === null) { why.empty++; return }

      // Aim, with a little hand-shake, and let the foot travel.
      const jx = (rnd() - 0.5) * player.jitter
      const jy = (rnd() - 0.5) * player.jitter
      G.aim(at.x + jx, at.y + jy)

      if (rest > 0) { why.rest++; return }
      const f = G.getFoot()
      // Only `hover` and `recover` take a press at all (see `press`), and a
      // press that lands in any other state is thrown away.
      if (f.state !== 'hover' && f.state !== 'recover') { why.busy++; return }

      const gap = Math.hypot(f.x - at.x, f.y - at.y)
      if (gap > G.stompRadius() * player.commit) { why.travel++; return }
      if (waiting > 0) { waiting -= dtMs; why.react++; return }
      why.press++

      heavyWanted = locked.heavy && rnd() < player.slam
      // The SIMULATED clock, never `performance.now()`.
      //
      // `press` takes the press time as an argument because two presses inside
      // `DOUBLE_TAP_MS` of each other, in the same place, are a HEEL PIVOT
      // rather than two stomps. During a fast-forward the whole level is
      // stepped in a second or two of wall time, so every press looks like the
      // second half of a double tap to a real clock — the first cut of this
      // file spent most of its presses pivoting and never held a chain past
      // ×2.
      G.press(f.x, f.y, t * 1000)
      holding = 0
    }

    const over = () => G.phase.value === 'won' || G.phase.value === 'lost'

    const state = () => ({
      phase: G.phase.value,
      level: G.getLevel().id,
      label: `${G.getLevel().world}-${G.getLevel().index}`,
      score: G.score.value,
      chain: G.chainCount.value,
      mult: G.chainMult.value,
      juice: Number(G.juice.value.toFixed(3)),
      fever: Math.round(G.feverMs.value),
      squished: G.squished.value,
      quota: G.quota.value,
      progress: Number(G.progress01.value.toFixed(3)),
      timeLeft: Math.round(G.timeLeft.value),
      alive: G.getBugCount(),
      boss: G.getBoss() ? { hp01: Number(G.bossHp.value.toFixed(3)), phase: G.bossPhaseIndex.value } : null,
      seconds: Number(t.toFixed(2)),
      why: { ...why }
    })

    let intervalId = 0

    w.__drive = {
      state,
      /** Put the player and its clock back to the top of a run. Called before
       *  every pass over a level, so the scout and the take play the same run. */
      reset: (s) => {
        rngState = (s >>> 0) || 1
        t = 0
        forced = null
        forcedHold = false
        waiting = 0
        holding = -1
        heavyWanted = false
        rest = 0
        locked = null
        autoFever = arg.autoFever === undefined ? player.fever : !!arg.autoFever
        for (const k of Object.keys(why)) why[k] = 0
      },
      seconds: () => t,
      /** Hand the vial back and forth between the player and the beat sheet. */
      autoFever: (on) => { autoFever = !!on },
      /** Take the wheel: hold the foot on a point until `release()`. */
      aim: (x, y) => { forced = { x, y } },
      /** Hold the press down while the wheel is taken — a scripted slam. */
      hold: (on) => { forcedHold = !!on },
      release: () => {
        forced = null
        forcedHold = false
        if (holding >= 0) { G.release(); holding = -1 }
        locked = null
        rest = 0
      },

      /** Where the boss is, or null. A beat sheet aims at it without having to
       *  reach into the simulation itself. */
      bossAt: () => {
        const b = G.getBoss()
        return b && b.alive ? { x: b.x, y: b.y, size: b.size, hp01: G.bossHp.value } : null
      },

      /** Where the nearest live body of a kind is, or null. Lets a beat sheet
       *  say "stand on the beetle" without knowing where it spawned. */
      nearest: (id) => {
        const f = G.getFoot()
        let best = null
        for (const b of live()) {
          if (id && b.id !== id) continue
          const d = Math.hypot(b.x - f.x, b.y - f.y)
          if (best === null || d < best.d) best = { d, x: b.x, y: b.y, id: b.id }
        }
        return best
      },

      /**
       * SETUP ONLY — advance the FROZEN sim, unrendered.
       *
       * One decision and one fixed step per iteration, exactly as the recording
       * will run it, with the effect queue drained and thrown away: every
       * squish, splat and shockwave of the fast-forward would otherwise be
       * consumed by the renderer in one batch on the next frame and open the
       * clip with a screenful of somebody else's goo.
       *
       * `stop` is a descriptor rather than a function so it can cross the CDP
       * boundary. Returns why it stopped.
       */
      fast: (dtMs, stop, maxSteps) => {
        const reached = () => {
          if (stop.kind === 'seconds') return t >= stop.value
          if (stop.kind === 'progress') return G.progress01.value >= stop.value
          if (stop.kind === 'squished') return G.squished.value >= stop.value
          if (stop.kind === 'juice') return G.juice.value >= stop.value
          if (stop.kind === 'chain') return G.chainCount.value >= stop.value
          if (stop.kind === 'timeLeft') return G.timeLeft.value <= stop.value
          if (stop.kind === 'bossHp') return G.bossHp.value <= stop.value
          if (stop.kind === 'phase') return G.phase.value === stop.value
          return true
        }
        let steps = 0
        while (steps < maxSteps && !reached() && !over()) {
          tick(dtMs)
          G.step(dtMs)
          G.drainEvents()
          steps++
        }
        return { steps, seconds: steps * dtMs / 1000, reached: reached(), ...state() }
      },

      /** One decision and one fixed step of the FROZEN sim, effects discarded.
       *  `fast` is this in a loop; the scout calls it a step at a time so it can
       *  watch the world between them. */
      step: (dtMs) => {
        tick(dtMs)
        G.step(dtMs)
        G.drainEvents()
      },

      /** RECORD ONLY — one decision per recorded frame, on the virtual clock.
       *  Timers fire before rAF in the recorder's clock, so the decision always
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
    return { policy: arg.policy, level: G.getLevel().id, autoFever }
  }, { level, seed, policy, autoFever })
}

// ─── Scouting ───────────────────────────────────────────────────────────────

/**
 * Play a whole level once, frozen and unrendered, and bring back its timeline.
 * SETUP only, a couple of seconds of wall time.
 *
 * This is what lets a beat sheet say "the vial fills at 62 % of the clip"
 * instead of carrying a hard-coded number that a rebalance quietly invalidates
 * — the clip would still record, and it would end four seconds after the shot
 * it exists for.
 *
 * ── The bookkeeping, which is the whole difficulty ──
 *
 * A scouting run REACHES A VERDICT, and a verdict is written down: stars, coins,
 * the resume level, the per-level failure record that hands out relief, the
 * best-score submission. Leave those and the recorded take is a measurably
 * different level from the one that was measured. So the save blob is
 * snapshotted before and restored after.
 *
 * The scene reacts too — its event pump puts the result screen up — and that
 * runs on the microtask after this evaluate returns, i.e. before anything else
 * the scenario does. Re-opening the level with the scene's own `play()`
 * afterwards is what clears it, because it is the same path a player takes.
 */
export const scoutLevel = async (ctx, { level, seed = 7 }) => {
  const frameMs = frameMsFor(ctx)
  const line = await ctx.evaluate((arg) => {
    const w = /** @type {any} */ (window)
    const P = w.__preview
    const G = P.game
    const D = w.__drive

    const before = JSON.parse(JSON.stringify(P.state.splatixState.value))
    P.hold(true)
    D.reset(arg.seed)
    P.play(arg.level)
    P.game.resetVial()
    P.vfx.resetVfx()
    w.__vseed?.reseed(arg.seed)

    const out = {
      level: arg.level,
      quota: G.quota.value,
      time: G.timeLeft.value,
      boss: G.getBoss() !== null,
      firstSquish: null,
      chain8: null,
      chain20: null,
      vialFull: null,
      feverAt: null,
      feverEnd: null,
      bossPhase2: null,
      bossDead: null,
      halfQuota: null,
      won: null,
      lost: null,
      seconds: 0,
      bestChain: 0,
      score: 0
    }

    for (let step = 0; step < arg.maxSteps; step++) {
      const t = (step * arg.dtMs) / 1000
      out.seconds = t
      if (out.firstSquish === null && G.squished.value > 0) out.firstSquish = t
      if (out.halfQuota === null && G.quota.value > 0 && G.squished.value >= G.quota.value / 2) out.halfQuota = t
      if (out.chain8 === null && G.chainCount.value >= 8) out.chain8 = t
      if (out.chain20 === null && G.chainCount.value >= 20) out.chain20 = t
      if (out.vialFull === null && G.juice.value >= 1) out.vialFull = t
      if (out.feverAt === null && G.feverMs.value > 0) out.feverAt = t
      if (out.feverAt !== null && out.feverEnd === null && G.feverMs.value <= 0) out.feverEnd = t
      if (out.bossPhase2 === null && G.bossPhaseIndex.value >= 1) out.bossPhase2 = t
      if (out.boss && out.bossDead === null && G.bossHp.value <= 0) out.bossDead = t
      out.bestChain = Math.max(out.bestChain, G.chainCount.value)
      out.score = G.score.value
      if (G.phase.value === 'won') { out.won = t; break }
      if (G.phase.value === 'lost') { out.lost = t; break }
      D.step(arg.dtMs)
    }

    return { line: out, before }
  }, { level, seed, dtMs: frameMs, maxSteps: Math.round(200 * ctx.fps) })

  // The scene's watchers have now run. Put the board and the save back.
  await ctx.evaluate((arg) => {
    const P = /** @type {any} */ (window).__preview
    P.play(arg.level)
    P.game.resetVial()
    P.state.setStates(arg.before)
  }, { level, before: line.before })

  const l = line.line
  const s = (v) => (v === null ? '—' : `${v.toFixed(1)}s`)
  ctx.log.info(
    `scouted level ${level}: quota ${l.quota} in ${l.time}s, ` +
    `first squish ${s(l.firstSquish)}, half ${s(l.halfQuota)}, ` +
    `×8 chain ${s(l.chain8)}, vial full ${s(l.vialFull)}, fever ${s(l.feverAt)}→${s(l.feverEnd)}, ` +
    (l.boss ? `boss p2 ${s(l.bossPhase2)} dead ${s(l.bossDead)}, ` : '') +
    `${l.won !== null ? `WON @${l.won.toFixed(1)}s` : `LOST @${s(l.lost)}`}, ` +
    `best chain ${l.bestChain}, score ${l.score}`
  )
  return l
}

/**
 * Open the level, then fast-forward the frozen board to the moment the clip
 * wants. SETUP only.
 *
 * @param {object} plan
 * @param {number} plan.level
 * @param {{kind: string, [k: string]: any}} plan.stop
 * @param {number} [plan.maxSeconds]  give up rather than spin if the board never
 *                                    produces what was asked for
 */
export const levelRun = async (ctx, { level, stop, seed = 7, maxSeconds = 150 }) => {
  const frameMs = frameMsFor(ctx)
  const maxSteps = Math.round((maxSeconds * 1000) / frameMs)

  // ── "Start the clip so that X lands here" ──
  //
  // Scout the level, take the time of the anchor event, and turn it into a
  // plain "fast-forward this many seconds". The clip is then cut from the run
  // the game actually plays rather than from an estimate of it.
  if (stop.kind === 'preroll') {
    const line = await scoutLevel(ctx, { level, seed })
    const at = line[stop.anchor]
    if (at === null || at === undefined) {
      throw new Error(
        `preview-video: level ${level} never reached "${stop.anchor}" in a scouting run ` +
        `(${JSON.stringify({ vialFull: line.vialFull, feverAt: line.feverAt, won: line.won, lost: line.lost })}). ` +
        'The beat sheet is aimed at something this level does not do any more.'
      )
    }
    // ── The drift factor ──
     //
     // The scout and the take do not play at the same SPEED. In the
     // fast-forward one decision is locked to one simulation step; during a
     // recording the autopilot ticks on a timer while the scene steps on its
     // own rAF, so the player gets slightly fewer decisions per simulated
     // second and everything downstream of their effort arrives late. Measured
     // on this game it is about a third: a vial that filled 5.8 s after the
     // opening frame in the scout took 7.6 s in the take.
     //
     // So the LEAD is shortened by `drift` — the clip opens closer to the
     // anchor, and the slower take stretches the gap back out to the beat the
     // sheet asked for. It is a property of the recorder, not of the level, so
     // it lives here with a default of 1 and is set per beat sheet.
    const drift = Math.max(0.1, stop.drift ?? 1)
    const lead = stop.lead / drift
    const start = Math.max(0, at - lead / 1000)
    ctx.log.info(
      `preroll: "${stop.anchor}" happens at ${at.toFixed(1)} s, clip wants it at ` +
      `${(stop.lead / 1000).toFixed(1)} s in (drift ×${drift}) → opening at ${start.toFixed(1)} s of the run`
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
    P.play(arg.level)
    P.game.resetVial()
    P.vfx.resetVfx()
    w.__vseed?.reseed(arg.seed)
    return { level: P.game.getLevel().id, phase: P.game.phase.value, quota: P.game.quota.value }
  }, { level, seed })
  if (opened.level !== level) {
    throw new Error(`preview-video: asked for level ${level} and got ${opened.level} — the save fixture did not take.`)
  }

  const at = await ctx.evaluate((arg) => {
    return /** @type {any} */ (window).__drive.fast(arg.frameMs, arg.stop, arg.maxSteps)
  }, { frameMs, stop, maxSteps })

  if (!at.reached) {
    ctx.log.warn(
      `staging never reached ${JSON.stringify(stop)} — stopped at ${at.seconds.toFixed(1)} s, ` +
      `phase ${at.phase}, ${at.squished}/${at.quota}`
    )
  }
  if (at.phase !== 'play') {
    throw new Error(
      `preview-video: the staging run ended (${at.phase}) before the clip started. ` +
      'A verdict is supposed to happen ON CAMERA — restage earlier, or give the fixture a better shoe.'
    )
  }
  ctx.log.info(
    `staged level ${level}: ${at.seconds.toFixed(1)} s in, ${at.squished}/${at.quota}, ` +
    `chain ×${at.mult}, vial ${(at.juice * 100).toFixed(0)} %, ${at.timeLeft}s left`
  )
  return at
}

// ─── The take ───────────────────────────────────────────────────────────────

/**
 * The first line of every `record()`: re-seed, let the world go, and put the
 * autopilot on the wheel.
 *
 * The re-seed is here rather than only in `installDrive` because `setup()` ends
 * with real frames still being drawn — the splash's fade, the board's idle
 * animation — and each of them pulls on the same stream the clip's goo comes
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

/** Where the nearest live body of a kind is, so a beat can be aimed at it. */
export const nearest = (ctx, id = null) =>
  ctx.evaluate((v) => /** @type {any} */ (window).__drive.nearest(v), id)

/** Where the boss is, for a beat that wants to stand on it. */
export const bossAt = (ctx) =>
  ctx.evaluate(() => /** @type {any} */ (window).__drive.bossAt())

/**
 * One deliberate TAP at a point — press, hold for a blink, release.
 *
 * A tap rather than a slam, because on armour that is the whole difference: the
 * blow CLANGS, nothing happens, and the shoe the player is wearing is the
 * reason. Under `TAP_MS` (150 ms) the foot never enters `charge` at all.
 */
export const tapAt = async (ctx, t, x, y, settleMs = 380) => {
  await aim(ctx, x, y)
  await t.wait(settleMs)
  await holdPress(ctx, true)
  await t.wait(110)
  await holdPress(ctx, false)
  await t.wait(140)
}

/** Hold the foot on a point (a scripted stomp, a scripted mistake). */
export const aim = (ctx, x, y) =>
  ctx.evaluate((p) => /** @type {any} */ (window).__drive.aim(p.x, p.y), { x, y })

/** Hold the press down while the wheel is taken — charges a slam. */
export const holdPress = (ctx, on = true) =>
  ctx.evaluate((v) => /** @type {any} */ (window).__drive.hold(v), on)

/** Give the wheel back to the policy. */
export const release = (ctx) => ctx.evaluate(() => /** @type {any} */ (window).__drive.release())

/** Let the player spend the vial themselves again, or stop them. */
export const autoFever = (ctx, on) =>
  ctx.evaluate((v) => /** @type {any} */ (window).__drive.autoFever(v), on)

/** Spend the vial now, whatever the policy thinks. */
export const fever = (ctx) => ctx.evaluate(() => {
  const G = /** @type {any} */ (window).__preview.game
  return G.tryFever()
})

/**
 * Spend the vial as soon as it is full, giving it up to `graceMs` to get there.
 *
 * The preroll aims the clip so the vial tops out on the beat, but the scout is
 * an ESTIMATE and not a replay — it plays with no renderer, and the renderer
 * pulls on the same `Math.random` the simulation does — so a take lands a
 * second either side of the run that was measured. Waiting a beat for the thing
 * the whole clip is cut around is better than firing into a 90 %-full vial and
 * letting the policy spend it somewhere off the beat.
 *
 * Waits in CLIP time (`t.wait`), so the grace comes out of the budget and can
 * never push the beat sheet past its last captured frame.
 */
export const feverWhenReady = async (ctx, t, graceMs = 1200) => {
  const step = 120
  for (let waited = 0; waited <= graceMs; waited += step) {
    if (await fever(ctx)) return true
    if (!(await t.wait(step))) break
  }
  return false
}

/**
 * Ride the clip out to the verdict and then back INTO the game.
 *
 * With the HUD hidden, a result screen is an invisible overlay that also stops
 * the world: the last seconds of a clip that ends on one are a still frame. So
 * the verdict is taken as the cue to press the button the player would press —
 * the scene's own `onNext` / `onRetry` — and the clip ends on the next level
 * opening, or on the retry's first stomps.
 *
 * @returns {Promise<'won'|'lost'|'running'>}
 */
export const rideToVerdict = async (ctx, t, { timeoutMs = 8000 } = {}) => {
  await ctx.stepUntil(
    () => {
      const p = /** @type {any} */ (window).__preview.game.phase.value
      return p === 'won' || p === 'lost'
    },
    { timeoutMs, label: 'verdict' }
  )
  const s = await snapshot(ctx)
  if (s.phase !== 'won' && s.phase !== 'lost') return 'running'
  ctx.beat(s.phase === 'won' ? 'clear' : 'fail')
  ctx.log.info(`verdict: ${s.phase} at ${s.squished}/${s.quota}, score ${s.score}, best ×${s.mult}`)
  return s.phase
}

/**
 * Press the result screen's own button and play on.
 *
 * A beat of video has to pass between the verdict and the press — the scene
 * hands the result screen an `onLevelEnd` that may await an ad gate, and its
 * event pump has not run yet on the frame the phase flipped.
 */
export const playOn = async (ctx, t, verdict) => {
  await t.wait(600)
  await ctx.evaluate((next) => {
    const P = /** @type {any} */ (window).__preview
    if (next) P.next()
    else P.retry()
  }, verdict === 'won')
  ctx.beat(verdict === 'won' ? 'nextLevel' : 'retry')
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
