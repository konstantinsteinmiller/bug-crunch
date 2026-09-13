# splatix

A mobile-first 2D **bug squisher**. You are a shoe. Drag it around a picnic
blanket, an attic floor or an arcade carpet and flatten everything crawling on
it before the clock runs out. Squish fast and the **Splat Chain** climbs — ×2,
×3, ×5, up to ×50 — and the music speeds up with it. Every squish fills the
**Juice vial**; fill it and the shoe turns into a giant golden boot for ten
seconds. Some bugs have shells a tap bounces off, some have spikes that hurt,
and every tenth level is a boss the size of a dinner plate.

40 levels · 4 worlds · 9 bugs · 4 bosses · 6 shoes. No reading required.

WIP: [playable demo](https://konstantinsteinmiller.github.io/splatix/)

Built with Vue 3 + TypeScript + Canvas 2D, shipping to CrazyGames, Playgama,
GamePix, GameMonetize, GameDistribution, Glitch.fun, itch.io, Wavedash, Poki and
Yandex Games from one codebase.

---

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:2050
pnpm test         # 595 unit, integration + simulation tests
pnpm type-check   # vue-tsc
pnpm build        # type-check + production build
```

## Highlights

* **No art payload.** The nine-bug cast, the four bosses, the six shoes, the
  four floors and every effect are hand-inked vector art *baked to frame strips
  at runtime*. Nothing gameplay-related ships as a bitmap, so the game is
  interactive the moment the JS parses. Drop-in painted overrides are wired and
  documented in [`art-todo.md`](./art-todo.md).
* **Synthesised audio.** A Fever second can fire forty squishes; any sample set
  would turn into a jam, so stomps, squelches, ricochets and the chain chime are
  generated per event with per-cue throttles. The chain chime climbs a
  **pentatonic ladder** that wraps every three octaves — a long chain is a
  rising phrase, not a dog whistle. See [`sound-todo.md`](./sound-todo.md).
* **One save object.** All persisted state lives in a single in-memory
  `splatix_state` record written to exactly one localStorage key, which the
  platform save layer mirrors to the SDK cloud store as one object.
* **Wordless onboarding.** The tutorial has no text, no OK button and nothing to
  dismiss. Three beats — move, tap, hold — and you leave each one by *doing* it.
  It is correct in all 21 locales because there is nothing in it to translate.
* **Fully responsive, every orientation.** 320×658 portrait through desktop
  fullscreen, landscape phones included, safe-area insets throughout, no fixed
  pixel sizing in the UI. Everything in the world is sized off one unit —
  `u = min(viewportW, viewportH) / 100` — so a wider screen shows more floor
  rather than bigger bugs.
* **21 languages**, key-parity enforced by a test.
* **Measured balance.** Quotas and clocks are not authored by feel: the preview
  pipeline's scout plays a whole level headlessly with a scripted player and
  reports when the quota fell. A competent run should finish at 55–70 % of the
  clock, and `tools/preview-video`'s `scout` scenario is how that is checked.
* **Optional global board.** Best score, posted to a Cloudflare Worker + D1
  (`worker/`). One read per page load, one write only on a personal record — and
  with no endpoint configured the whole feature is simply absent, which is how
  the Yandex build ships.

## How it plays

| Beat | What happens |
|---|---|
| **Learn** | First run only, and without a single word: a hand glyph drags along a dotted track with a ghost shoe behind it, then drops onto an ant, then presses and *holds* while a ring fills. Each beat retires when you do it. There is no OK button — a tutorial you can click past is a tutorial that teaches clicking past tutorials. |
| **Move** | The shoe goes where you point, always. On touch it rides slightly **above** your finger so your thumb never covers the target. The dashed ring on the floor is the stomp circle, exactly — if the ring and the hitbox ever disagreed the game would feel like it was cheating, and this is a game for children. |
| **Squish** | A tap is a quick stomp: everything inside the circle goes splat, in its own colour, leaving a permanent decal on the floor. |
| **Chain** | Squish again within 1.5 s and the multiplier climbs a **ladder** — ×1, ×2, ×3, ×5, ×8, ×12, ×20, ×30, ×40, ×50 — rather than a counter. The rungs are far apart on purpose: the gap is the tension and the jump is the payoff. The HUD badge grows, changes colour and drains its ring in real time. |
| **Slam** | Press and hold to charge, release to slam: a bigger circle, **+2 armour pierce** and **two blows' worth of damage**. That is what opens a beetle's shell — the starter sneaker can never tap through one and can always slam through one. |
| **Ricochet** | A tap on armour you cannot pierce CLANGS, does nothing, and **does not break the chain**. The player found the beetle; they just could not open it. Breaking the chain there would teach "do not stomp beetles", which is the opposite of the lesson. |
| **Get hurt** | The caterpillar's spikes knock the foot back, stun it for most of a second and end the chain. It is the one bug stomping is *wrong* for — herd it, wait it out, or buy the steel boot. |
| **Fill the vial** | Every squish adds juice, and a live chain adds up to 2.5× more. The vial bleeds slowly while nothing is being squished, but a **full vial never drains**: once you have earned Fever it is yours until you spend it. |
| **Fever** | Ten seconds of a gilded boot at 2.35× the radius, 1.5× score, and nothing armoured and nothing spiky. It is the same shoe, gold and huge, so the transformation reads as *your* shoe getting enormous rather than something else arriving. The vial carries between levels, so a Fever earned on the last squish is spent on the next board. |
| **Use the floor** | Honey grounds a flea. A magnet armed by a slam drags armoured bodies into one pile. Salt bursts and panics a swarm. A sweeper bar kills for free if you can herd into it. Crumbs pull ants towards one point you can slam. Cobwebs slow your own foot. Conveyors move everything standing on them, including your landing spot. |
| **Read the board** | Fleas sense the shadow and leap clear. Moths are only stompable at the bottom of their bob. Stink bugs burst into a haze that blurs and slows the foot. A centipede dies instantly to a blow on the head and loses a segment to anything else. |
| **Boss** | Every tenth level. Three scripted phases with a call-out above the health bar — stomp, pods, charge, spin, shield, beam, summon — and a counter window on the charge that a slam answers for double damage. The starter shoe can open every phase of every boss with a slam: no shell is ever a paywall. |
| **Stars** | Three objectives a level. The first is always "clear it", so a player who can beat a level always gets something; the other two are the reasons to come back — a chain to reach, an accuracy to hold, a species to hunt, a Fever to trigger. |
| **Spend** | Stars gate worlds, coins buy shoes. Six shoes, and **no shoe is strictly better than the starter**: the steel boot ignores spikes and reaches further at half the agility, the bunny slipper is invisible to dodgers but can barely open a shell, the roller skate ploughs a line, the cleat punctures anything over a tiny circle, the electric sock kills things it never touched. |
| **Come back** | Fail a level twice and the bugs quietly slow down and the clock lengthens — the quota never shrinks, because slowing the board helps a player who could not keep up while shrinking the quota would delete the objective they were failing. |
| **Compare** | Every finished run posts your **best score** to a global board. It is optional scenery: no network, no rank, no interruption to the game. |

## Architecture

```
src/game/          pure, testable domain — no Vue, no DOM
  bugs.ts          the 9-species bestiary + stomp resolution (armour, spikes, hp)
  shoes.ts         the 6 shoes, as a matrix nothing dominates
  combo.ts         the Splat Chain ladder, the Juice vial, Splat Fever
  stages.ts        the 40 levels: 4 world curves + hand-authored exceptions
  stars.ts         the objective language and its evaluator
  bosses.ts        4 bosses × 3 scripted phases
  hazards.ts       the 7 floor objects and their timings
  inkArt.ts        shared hand-inked vocabulary (blobs, cel tones, ink, light)
  bugArt.ts        the cast, painted + baked to 8-frame strips at idle
  footArt.ts       the six shoes, the shadow and the stomp ring
  floorArt.ts      four seamless tiles + the world vignettes
  propArt.ts       hazards; uiArt.ts comic words, splats, banners, HUD marks
  art.ts           the drop-in painted-override layer (probe → swap → re-bake)

src/use/           reactive layer (module-level singletons)
  useSplatixGame   the simulation — one `step(dtMs)`, no rendering, no DOM
  useSplatixArt    the renderer — floor, decals, hazards, bodies, boss, shoe, FX
  useVfx           pooled particles / floating text / decals + quality tiers
  useGameAudio     synth + sample cue router with per-cue throttling
  useSplatProgress stars, coins, the resume level, the relief record
  useLocker        the six shoes: owned, affordable, equipped
  useSplatixState  the single `splatix_state` blob + debounced persistence
  useLeaderboard   the global score board — never throws, blocks or delays a run

src/platforms/     platform registry, CSP, capability gates, resolvers
src/utils/save/    SaveManager, BlobStorage, per-platform cloud strategies
src/components/    F-* design system + game HUD + modals
worker/            Cloudflare Worker + D1 behind the leaderboard (deploys alone)
```

**Balance contract:** difficulty is measured, not guessed.
`tools/preview-video`'s `scout` scenario plays a whole level in the frozen
simulation with a scripted player (`ace` / `good` / `average`) and prints the
timeline: first squish, each chain rung, when the vial filled, when Fever ran,
each boss phase, and the verdict. Every quota and clock in `stages.ts` was set
against it — the first pass, authored by feel, had a mediocre bot clearing 2-7
in 30 s of a 101 s clock, which meant the timer was never a threat and the fail
state effectively did not exist outside boss levels.

**Performance contract:** the hot collections (`bugs`, `pods`, `hazes`) are
plain non-reactive arrays — Vue's proxy overhead on a few hundred entities
mutated 60×/s is exactly what drops frames on a phone. Only HUD scalars are
refs. Sprites are baked once and blitted; particles live in typed arrays with a
free-list; splat decals go onto a persistent layer rather than being re-drawn;
quality auto-degrades across four tiers off a rolling FPS average, and the DPR
cap moves with it.

## Save & cloud hydration

Everything persists inside one object:

```text
splatix_state = {
  sx_coins, sx_total_coins,                    // economy
  sx_shoe, sx_shoes_owned,                     // the Locker
  sx_level, sx_best_level, sx_level_stars,     // the campaign
  sx_failed_levels,                            // the relief record
  sx_best_score, sx_best_combo, sx_runs, sx_total_squishes,
  sx_tutorial_seen, sx_onboarded, sx_hints_seen,
  sx_juice_style, sx_high_vis, sx_single_tap,  // accessibility
  sx_user_language, sx_user_difficulty, ...    // settings
}
```

Every field is `sx_`-prefixed so the save layer's merge policy can allowlist the
payload by prefix rather than by an enumeration that would drift.

The load order is load-bearing and is what stops a returning player from being
rendered as a fresh install:

1. `main.ts` **awaits** the platform SDK init before `saveManager.init()`.
2. It **awaits** `saveManager.init()` before importing `App.vue`, so the whole
   module graph evaluates against hydrated storage.
3. `reloadSplatixState()` runs **before** the `saveDataVersion` bump, so every
   composable's watcher re-reads the hydrated blob rather than the stale one.
4. If hydrate didn't return data **and** local looks fresh, `SaveManager` retries
   3× at 1 s spacing before letting the app boot.
5. Hard checkpoints (level cleared, shoe bought, name changed) call
   `flushSaveNow()` to bypass both debounces.

`tests/save/SplatixStateCloudHydrate.test.ts` covers all of it end to end,
including transient-SDK-failure recovery, corrupt-blob degradation, and a
full write → cold-boot → read round trip.

## Building for platforms

```bash
pnpm build:crazy-web        pnpm build:playgama
pnpm build:gamepix          pnpm build:gamemonetize
pnpm build:game-distribution pnpm build:glitch
pnpm build:itch             pnpm build:wavedash
pnpm build:poki             pnpm build:yandex
```

Each mode reads its `.env.<platform>` file, DCEs the other platforms' SDK glue,
and emits a per-platform CSP. Every key, game id and title id in those files is
blank and ready to be filled before a deployment.

## Docs

| File | Contents |
|---|---|
| [`GDD.md`](./GDD.md) | The design: loop, rules table, art direction, feel non-negotiables |
| [`game-implementation-plan.md`](./game-implementation-plan.md) | Build state, architecture map, what's next, known trade-offs |
| [`description.md`](./description.md) | Store copy: short/long description, how to play, controls |
| [`ROADMAP.md`](./ROADMAP.md) | 18 prioritised retention / playtime / conversion features |
| [`art-todo.md`](./art-todo.md) | Drop-in painted-override manifest: every slot and what stays procedural |
| [`sound-todo.md`](./sound-todo.md) | Audio cue map + what is worth commissioning |
| [`tools/preview-video/README.md`](./tools/preview-video/README.md) | Generating the portal preview clips from real gameplay |
| [`worker/SETUP.md`](./worker/SETUP.md) | Deploying the leaderboard Worker + D1, start to finish |

## Dev tools

* `/#/bug-lab` — the design bench: every drawing, animated, at 24 / 40 / 64 /
  120 / 200 px over each of the four floors. The 24 px column is the acceptance
  test — a design that is mud there is mud on a phone. Lazy-routed, so it costs
  a player who never visits it nothing.
* `/#/art-sheets` — the art pipeline's export bench (dev only): bakes every
  drawable through its own painter onto reference sheets and writes them, the
  master prompts and the slice index into `art-sheets/`. `pnpm art:export`
  drives it headlessly; `pnpm slice-sheets` cuts the paintings back in.
* `/#/playground` — every painted drawable in motion (dev only), with one
  button that flips the art layer live. `?art=on` / `?art=off` / `__art.*`
  control the painted overrides on any build.
* `pnpm preview:video` — records the portal preview clips by playing the real
  game with a scripted player against a virtual clock. `--scenarios scout
  --only-setup` prints a level's whole timeline in a couple of seconds.
* Type `cmarc` anywhere to toggle debug mode.
* `localStorage.cheat = 'true'` + reload publishes the live simulation as
  `window.__run` and enables the cheat shortcuts (`ctrl+shift+alt` + `k` coins,
  `f` Fever, `n` clear the level, `r` fail it).
