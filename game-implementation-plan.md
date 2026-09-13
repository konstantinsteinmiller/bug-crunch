# SPLATIX — Game Implementation Plan

> Living document. If a session runs out of context, resume from the first
> unchecked box. Every phase is independently shippable: the game must BUILD and
> RUN after each one.

---

## 0. What this repo is

A fresh copy of the **Survivalist** web-game chassis (Vue 3 + Vite + TS + pug +
Tailwind + SASS), already renamed to `splatix`, with the gameplay art deleted.
Everything below the gameplay line is production-grade and **stays**:

| Kept as-is | Where |
| --- | --- |
| 10 platform integrations (CrazyGames, GameDistribution, Glitch, itch, Wavedash, GamePix, GameMonetize, Playgama, Yandex, Poki) | `src/platforms/`, `src/utils/*Plugin.ts` |
| `SaveManager` + per-platform `SaveStrategy` + `BlobStorage` | `src/utils/save/` |
| Ad abstraction (`AdProvider`, `useAds`, `useAdGate`) | `src/use/ads/`, `src/use/useAds.ts` |
| Unified pause gate + audio suspend | `useGamePause`, `useGamePauseAudio`, `useAssets` |
| Leaderboard stack (Cloudflare Worker + D1, snapshot, seed, composable, modal) | `worker/`, `src/use/useLeaderboard.ts`, `scripts/leaderboard-*.mjs` |
| Art-generation pipeline (sheets → prompts → slicer → Art Desk → playground) | `tools/export-sheets.mjs`, `tools/slice-sheets.mjs`, `tools/art-desk/`, `src/views/ArtSheets.vue`, `src/views/Playground.vue` |
| Image compressor pipeline | `scripts/compress-images.mjs`, `scripts/image-compress-bench.mjs` |
| Gameplay-video pipeline | `tools/preview-video/` |
| Perf probe + A/B runner + quality tiers | `usePerfProbe`, `perfVariants`, `useVfx` tiers |
| F-Components (already fluid `clamp()`, no `scale-*`, measured modal header) | `src/components/atoms/`, `src/components/molecules/FModal.vue` |
| 21-locale i18n with lazy chunks | `src/i18n/` |
| Icon set (44 glyphs) | `src/components/icons/` |
| `angrybirds-regular.ttf` as the ONLY font | `src/assets/css/fonts.sass` |

**Everything above the gameplay line is replaced.**

---

## 1. The game

Top-down 2D arcade bug-stomper. The player owns a giant foot; bugs swarm the
floor; you stomp them. See `GDD.md` — this plan implements it in full.

### 1.1 Core loop

`hover foot → read bug behaviour → choose stomp type → squish → combo → juice →
fever → clear objectives → stars → coins → new shoes → harder stage`

### 1.2 Controls (all devices)

| Action | Touch | Mouse | Keyboard |
| --- | --- | --- | --- |
| Move foot | drag (foot offset **above** the finger) | mouse move | — |
| Quick stomp | tap | left click | — |
| Heavy slam | press and hold ≥ 300 ms, release | right click / hold LMB | — |
| Slide / skater drag | stomp then keep dragging (needs skates or slick floor) | click-drag | — |
| Heel pivot spin | double-tap in place | double-click | — |
| Fever | FEVER button | FEVER button | `Space` |

*Single-Tap Mode* (accessibility, ages 6-7): a tap anywhere auto-targets the
nearest stompable bug inside a generous radius.

### 1.3 Bestiary (`src/game/bugs.ts`)

| id | HP | Tier | Behaviour | Counter |
| --- | --- | --- | --- | --- |
| `ant` | 1 | fodder | marches a sugar trail | any stomp |
| `beetle` | 3 | heavy | slow; light taps CLANG off the shell | heavy slam / steel boot / cleat |
| `flea` | 1 | dodger | senses the shadow, ALERT icon, leaps after 250 ms | feint, slippers, slide |
| `centipede` | 6 seg | tactical | serpentine; head kill = instant, mid = split | head stomp |
| `caterpillar` | 1 | punisher | slow; spikes hurt soft shoes (OUCH, combo reset) | steel boot / hazard |
| `stinkbug` | 1 | disrupter | direct stomp = purple haze, slow + blur 3 s | cleat puncture / hazard |
| `pinatafly` | 5 | bonus | zig-zag; drops coins + confetti | rapid taps |
| `moth` | 2 | world 3 | glowing, drifts | any |
| `robobug` | 2 | world 4 | plated; EMP-stuns on death | electric sock / slam |

### 1.4 Footwear (`src/game/shoes.ts`)

| id | Speed | Radius | Pierce | Ability |
| --- | --- | --- | --- | --- |
| `sneaker` | 3 | medium | low | balanced starter |
| `steelBoot` | 1 | huge | max | immune to spikes, slam shockwave stuns |
| `bunnySlipper` | 5 | small | zero | silent tread — dodgers never see the shadow |
| `rollerSkate` | 4 | narrow | medium | continuous drag / roll-over |
| `cleatBoot` | 3 | small | high | punctures shells and stink sacs |
| `electricSock` | 4 | medium | low | static charge → chain lightning on stomp |

### 1.5 Worlds and levels (`src/game/stages.ts`)

4 worlds × 10 levels = **40 levels**; level 10 of each world is the boss.

1. **Picnic Blanket** — gingham, crumbs, syrup. Ants, flies, beetles.
2. **Overgrown Backyard** — grass tufts that hide bugs, mud slicks. Caterpillars, beetles, stink bugs.
3. **Dusty Attic** — cobwebs that slow the foot, trick floorboards. Centipedes, moths.
4. **Neon Arcade Floor** — slick lino, soda spills, conveyors. Robo-bugs, everything.

Each level: 1–3 minutes, 3 star objectives (quota / combo / no-damage variants).

### 1.6 Bosses (`src/game/bosses.ts`)

* W1 **Goliath Queen Ant** — spawn swarm → egg sacs → charge (slam the wind-up).
* W2 **Thornback Beetle King** — armour plates → caterpillar summon → spin rage.
* W3 **Centipede Matriarch** — sever segments → web drop → head charge.
* W4 **Mecha Roach Prime** — shield phases → conveyor adds → laser sweep.

### 1.7 Systems

* **Splat Chain** — 1.5 s window, ×2 → ×50, resets on a bare-floor miss or spike damage.
* **Juice Meter → Splat Fever** — fills on squish by bug mass; 10 s gilded-boot frenzy.
* **Hazards** — honey, magnet, salt shaker, sweeper (mower/fan), cobweb, conveyor.
* **Juice Style** — `ooze` (default) / `confetti` / `bubble` — pure palette + particle swap.
* **Accessibility** — high-vis shadow ring, single-tap mode, reduced-motion.

### 1.8 Explicitly OUT (user instruction)

No Battle Pass, no Achievements, no daily logins, no daily missions, no
rewarded-ad buttons or modals. Ad **infrastructure** stays (interstitials keep
portal compliance); no reward-ad UI is shown.

---

## 2. State — `splatix_state`

ONE in-memory `Record<string, any>`, ONE localStorage key (`splatix_state`),
ONE cloud blob. Field names are `sx_`-prefixed and catalogued in `src/keys.ts`.

```
sx_coins           sx_total_coins      sx_stars          sx_level_stars
sx_level           sx_best_score       sx_best_combo     sx_shoes_owned
sx_shoe            sx_runs             sx_total_squishes sx_tutorial_seen
sx_onboarded       sx_hints_seen       sx_results_seen   sx_juice_style
sx_high_vis        sx_single_tap       sx_locker_spotlight
sx_user_sound      sx_user_music       sx_user_language  sx_user_difficulty
sx_music_track     sx_haptics
```

Hydration contract (proved end-to-end with Chrome MCP, see Phase 12):
`SaveManager.init()` → `reloadSplatixState()` → `saveDataVersion` bump →
every composable re-reads. A returning player must never see fresh defaults.

---

## 3. Phases

> **All thirteen phases are done.** Everything below is a record of what shipped
> rather than a queue; the notes under each phase are the places the plan and
> the build disagreed, and why the build won.

### Phase 1 — Foundation rename and prune ✅
- [x] `useTowerState.ts` → `useSplatixState.ts` (`splatix_state`, `sx_`)
- [x] `src/keys.ts` rewritten for Splatix
- [x] `SaveMergePolicy` / `BlobStorage` / `CrazyGamesStrategy` / `main.ts` prefix updates
- [x] Delete Survivalist gameplay modules + components + tests
- [x] `.env*` secrets cleared (game ids, glitch tokens, leaderboard url)

### Phase 2 — Pure game data ✅
- [x] `game/bugs.ts`, `game/shoes.ts`, `game/hazards.ts`
- [x] `game/combo.ts` (combo, juice, fever, score — pure)
- [x] `game/stages.ts` (40 levels, deterministic spawn tables, objectives)
- [x] `game/bosses.ts` (4 bosses × 3 phases)
- [x] `game/juiceStyle.ts` (3 palettes)
- [x] `game/stars.ts` (objective evaluation)

### Phase 3 — Procedural art ✅
- [x] `game/bugArt.ts` — vector bugs, baked to 8-frame strips (walk cycles)
- [x] `game/footArt.ts` — 6 shoes from above, the ankle, the shadow, the stomp ring
- [x] `game/propArt.ts` — hazards, crumbs, props
- [x] `game/floorArt.ts` — 4 seamless world floors + per-world vignette
- [x] `game/uiArt.ts` — comic words, banner, splat decals, star, HUD marks
- [x] `game/artBoxes.ts`, `game/artCatalogue.ts`, `game/artSheet.ts`, `game/artPreload.ts`

*Deviations:* the shoe is drawn at **0.58×** its stomp radius (`SHOE_FRAC`) after
an in-browser pass found it covering its own hit ring — the one mark the screen
must always show. The ring is drawn OVER the shoe for the same reason. The leg
leaves the frame behind the HEEL, not the toe: out of the toe it read as two
antennae on a board covered in insects.

### Phase 4 — Simulation ✅
- [x] `use/useSplatixGame.ts` — fixed-step sim, pooled entities, foot state machine
- [x] Persistent splat-decal layer with a budget (in `useSplatixArt`, not a
      separate `decals.ts` — it needs the camera and the world transform)
- [x] Bug AI: crawl, hop, scurry, dodge, segment trail, airborne bob, boss phases
- [x] Hazards, conveyors, sweepers, magnets, salt, cobweb, honey, crumbs

*Deviations found by the headless sim tests and the preview scout:*
* `release()` cleared `foot.charge` one line after `slam()` set it, so **every
  held slam resolved as an ordinary tap** — the hold-to-slam mechanic was dead.
* A blow that landed on a **boss** counted as a MISS, because only bugs were
  counted — it broke the chain and made the accuracy objective unreachable on
  every boss level.
* A **slam now does two blows' damage** (`blowDamage`). At one it cost a charge
  and a long recovery to do a tap's work, so charging was only ever worth it for
  armour.
* The board is **seeded at level start** (`seedBoard`) instead of filling one bug
  at a time from empty: the first two seconds of every level were a floor.

### Phase 5 — Renderer ✅
- [x] `use/useSplatixArt.ts` — drawScene, camera shake, decal layer, fever lights
- [x] `use/useVfx.ts` — goo, confetti and bubble emitters per juice style
- [x] Quality tiers wired (`high`/`medium`/`low`/`min`) with DPR caps

### Phase 6 — Audio ✅
- [x] `use/useGameAudio.ts` — synthesised squish/stomp/clang/chain/boss cues,
      per-cue throttles, sample cues where a recording is better, pentatonic
      chain ladder wrapping every three octaves

### Phase 7 — UI ✅
- [x] `views/GameScene.vue` — canvas + HUD + result, fully responsive
- [x] `components/game/` — `SplatHud`, `JuiceVial`, `ObjectiveList`, `LevelBanner`,
      `BossBar`, `StarRow`, `ShoeCard`, `TutorialOverlay`, `ControlHint`
- [x] `components/organisms/LockerModal.vue`, `OptionsModal.vue`, `LeaderboardModal.vue`
- [x] Safe-area everywhere, 320×658 → 4K, portrait + landscape + tablet

*Deviation:* the inherited **portrait lock is gone**. The brief asks for all
mobile orientations, and the board is defined in `u = min(w, h) / 100`, so a
landscape phone simply gets a wider board. The HUD bars are capped at `--hud-max`
and centred so a 1440 px desktop does not stretch the score strip into a
1400 px-wide progress rail.

### Phase 8 — Onboarding ✅
- [x] Text-free 3-beat animated tutorial (move → tap-stomp → hold-slam)
- [x] Control-hint pill ("Tap to move" / "Click to move"), device-correct verb
- [x] First-15-seconds funnel: 1-1 is a guaranteed win — one bug design, no
      hazards, a quota of 8 and nothing that can punish a wrong tap

### Phase 9 — Progression and leaderboard ✅
- [x] `use/useSplatProgress.ts` — stars, coins, world unlocks, relief record
- [x] `use/useLocker.ts` — shoe ownership / equip / purchase
- [x] Leaderboard rank badge on the result screen

### Phase 10 — i18n ✅
- [x] `en.ts` rewritten; all 20 other locales regenerated with the same key shape,
      parity and placeholders locked by `tests/i18nParity.test.ts`

### Phase 11 — Pipelines ✅
- [x] Art sheets export + prompts for the new cast
- [x] `preview-video` scenarios rewritten for Splatix (`scout`, `success`,
      `success-30s`, `fail`, `fail-30s`) with a page-side autopilot
- [x] `art-todo.md`, `sound-todo.md`

### Phase 12 — Tests and verification ✅
- [x] Unit tests for combo / stars / stages / bugs / shoes / hazards / bosses
- [x] A headless end-to-end suite that drives the real simulation
      (`tests/game/sim.test.ts`): input, chain, armour, spikes, Fever, the
      verdict and the boss
- [x] Survivalist-only tests deleted; SaveManager / platform / i18n tests kept
- [x] In-browser verification with the Chrome DevTools MCP: boot, tutorial,
      control hint, stomp, chain, Fever, boss, result screen, reload-hydration,
      320×658 / landscape / tablet / desktop
- [x] `pnpm type-check`, `pnpm test`, `pnpm build`

### Phase 13 — Docs ✅
- [x] `description.md`, `ROADMAP.md` (18 retention features), `README.md`

---

## 3b. The balance pass

Difficulty is **measured**, not guessed. `pnpm preview:video --scenarios scout
--only-setup --url-param scoutLevel=N` plays a whole level in the frozen
simulation with a scripted player and prints its timeline.

What that found, and what changed:

| Finding | Change |
| --- | --- |
| A mediocre bot cleared 2-7 in 30 s of a 101 s clock — the timer was never a threat | Quotas up ~25 %, clocks down ~35 %. Levels are now 48–96 s. |
| A third of a scouted run's frames had **nothing on the board** to aim at | `maxAlive` up ~20 %, spawn intervals down ~25 %, plus the level-start seeding |
| The Juice vial could never fill: the gain clamped to exactly 1 and the next sim step decayed it, so `feverReady` was true for one frame | A **full vial does not decay** (`decayJuice`) |
| A vial filled on the last squish of a level was thrown away | The vial **carries between levels**; only the running fever is cleared |
| Fever was unreachable inside an early level's quota | Per-bug juice doubled; the chain bonus raised to +10 %/rung |
| A tap went straight through a beetle — `pierce 1` vs `armor 1` — deleting the whole hold-to-slam lesson | Beetle armour 2, robobug 3. The starter can still slam through everything. |

## 3c. Known trade-offs

* **The `ace` autopilot is better than any human.** It clears a level in ~30 % of
  the clock. The balance targets were set against the `average` player instead,
  which lands at ~55 %. A real six-year-old is slower than both, which is what
  the relief system is for.
* **Bosses are the only reliable loss.** An ordinary level's quota falls to
  volume — one stomp takes two or three bodies — so a player who is merely slow
  still clears it. That is deliberate for this audience; the tension lives in the
  stars and the boss.
* **Splat decals never expire within a level.** They are budget-capped and
  composited into one layer, so the cost is bounded, but a long Fever leaves a
  floor that is more goo than floor. That is the intended look.

## 4. Responsiveness contract

* Canvas fills the viewport; the play field is the viewport minus safe areas.
* All entity sizes derive from `u = min(fieldW, fieldH) / 100` — never fixed px.
* HUD uses `clamp()` / `vmin` / `%` exclusively; no `scale-*` transforms.
* `env(safe-area-inset-*)` on every edge-anchored cluster.
* Minimum portrait target: **320 × 658**. Landscape phone, tablet, desktop, 4K.
* Nothing overlaps: top bar, bottom bar, vial rail and fever button are laid out
  in a flex column that reserves its own space; gameplay never draws under them
  (a `playInsets` rect is fed into the sim so spawns avoid HUD gutters).

## 5. Performance contract

* Structure-of-arrays particle pool (existing), pooled bugs / decals / texts.
* Splat decals baked into ONE offscreen canvas; budget-capped and composited.
* DPR cap `min(dpr, 2)` at high tier, lower on `medium`/`low`.
* Zero allocation in the hot path; no closures per frame.
* Hot-path load: bundle-parse only. Sound decode + painted-art probing deferred
  to an idle slot after first paint.
