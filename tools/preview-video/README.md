# preview-video — Survivalist's clips, generated rather than filmed

```bash
pnpm preview:video                       # every format, both scenarios
pnpm preview:video --formats crazygames  # one deliverable
pnpm preview:video --help
```

Output, one folder per quality. **`high/` is what gets uploaded** — every
deliverable, every format, same folder:

```
preview-videos/high/success-10s-portrait-720x1280.mp4  (+ .png poster)
preview-videos/high/fail-30s-landscape-1920x1080.mp4
preview-videos/high/success-crazygames-portrait-1080x1620.mp4
…
preview-videos/lossless/…    the archive (yuv444p, qp 0 — Safari and QuickTime
                             refuse 4:4:4, and no portal validator will take it)
preview-videos/balanced/…    the portal cuts again at CRF 20, for a bitrate cap
```

Every format therefore declares at least two qualities on purpose: a format
with exactly one writes into the output ROOT instead of a folder, and half the
delivery set living somewhere else is how the wrong file gets uploaded.

`record.mjs` and `lib/` come from the `gameplay-video-pipeline` skill and are
copied VERBATIM — if something needs changing to make this game work, it
belongs in `scenarios/_drive.mjs`. `CONTRACT.md` is their contract.
`preview.config.mjs` and `scenarios/*` are this game's half.

---

## What the four formats are

| format | shape | who asked for it |
|---|---|---|
| `10s` | 10 s, 720x1280 + 1280x720 | the generic preview |
| `30s` | 30 s, 1080x1920 + 1920x1080, H.264 | the "pure gameplay" trailer shape |
| `crazygames` | 16 s, 1920x1080 + **1080x1620** (2:3, not 9:16), `high` only, under 50 MB | docs.crazygames.com/requirements/game-covers |
| `poki` | 5 s, **1080x1080 at 60 fps** | developers.poki.com/guide/your-game-page |

Each records a SUCCESS and a FAIL clip in every orientation it declares.

**Measured sizes** (`high`, CRF 14 — this game draws hundreds of animated
bodies, so it compresses far worse than a flat puzzle game): 10 s 720x1280
≈ 11 MB, 16 s 1920x1080 ≈ 19 MB, 16 s 1080x1620 ≈ 29 MB, 30 s 1080x1920
≈ 56 MB (~15 Mbps), 5 s 1080x1080 at 60 fps ≈ 6 MB. Every CrazyGames file is
well inside their 50 MB cap. If a spec ever states a BITRATE (some 1080p specs
say 10-12 Mbps), re-encode that format at `--quality balanced` (CRF 20) — one
capture, a different encoder, roughly half the size.

## The two cuts

| | what is on screen |
|---|---|
| default (`?feed=preview`) | no HUD, no damage numbers, no health bars, no elite marker — and the numbers on the gates and crates KEPT, because "×2.4" over a doorway is what this genre is sold on |
| `--url-param feed=pure` | the same, plus the recorder no-ops `fillText`/`strokeText` for the whole page: no digit anywhere. For a spec that says "no hardcoded text, score counters, watermarks, UI or logos" |
| `--no-clean` | the game exactly as a player sees it, HUD and all. Still driven — the scripting seam rides on `?preview=1`, which is a separate parameter for exactly this reason |

The game-side half is `src/game/previewFeed.ts` (DEV-only, `'off'` in every
build a player loads) plus two hooks in `GameScene.vue`: the seam install, and
the **inset-free layout branch** — the recorder hides the HUD with
`visibility`, which keeps its boxes, so without that branch the camera still
refuses to use the 200 px the bars occupy. Ignoring the insets is worth ~40 %
more scale on a phone-shaped clip.

## How a clip is built

1. `boot()` — seed `tower_state`, navigate, wait out both splashes, then FREEZE
   the simulation (`__preview.hold(true)`) and hold until every painting the
   stage can ask for has decoded.
2. `stageRun()` — **scout**: play the whole stage frozen and unrendered (a
   couple of seconds) to find out when the boss dies / when the crowd runs out /
   when each bank is crossed, restoring the save afterwards. Then re-open the
   stage and fast-forward to `thatMoment − lead`.
3. `rollCamera()` — re-seed `Math.random`, release the hold, and put the
   balance suite's own scripted player (`tests/sim/policies.ts`) on the wheel,
   one decision per recorded frame.
4. The beat sheet marks beats, and `rideToVerdict` + `playOn` end the clip on
   the road moving again rather than on a hidden result screen.

Nothing is faked: every clip is the game's own simulation, played by a policy
the balance suite measures the game with.

## The stages, and why

| clip | stage | shop | player | what the road does |
|---|---|---|---|---|
| `success` (10 s, CG, Poki) | 14 | full | `optimal` | miniboss at 12.7 s, `add18/mul1.6` at 23.2 s: 101 → 202 |
| `success-30s` | 14 | full | `optimal` | four banks, a dilemma, the multiplier, boss dead at ~44 s |
| `fail` (10 s, CG, Poki) | 22 | `THIN_SHOP` | `average` | ahead at 10 s, halved by a `÷2` at 12.2 s, wiped in the road at 15.9 s |
| `fail-30s` | 25 | `THIN_SHOP` | `average` | 158 survivors off a `×2.4` at 17.7 s, gutted by a `÷5` at 27.1 s, bled out by four hostile banks, wiped at 40 s |

The fail clips are the same game with two upgrade levels missing. That is what
makes them fair — the loss is the crowd they did not build — and both of them
die on the ROAD rather than at a boss, which is what makes them REPEATABLE.
A losing boss fight is a DPS race, and the scout that picks the opening is an
estimate rather than a replay (it runs with no renderer, so a different
`Math.random` stream): the first cut of `fail-30s` lost at stage 26's boss, and
the take drifted far enough that the crowd was still alive when the clip ran
out. With the full shop it is worse still — two scouting runs of the same seed
on stage 14 had the crowd wipe at 57 s and kill the boss at 95 s, because a
fight that close is decided by which way one slam lands.

## Re-tuning it after a balance change

The beat sheets are anchored to EVENTS (`anchor: 'bossDead'`, `anchor: 'wipe'`,
`anchor: 'bank', match: 'mul'`), so a rebalance that moves them moves the clip
with it, and one that deletes them fails loudly instead of filming an empty
road. When a clip comes back wrong, look at the road first:

```bash
# the whole timeline of a stage: every bank, the miniboss, the boss, the verdict
pnpm preview:video --scenarios scout --only-setup --formats 10s \
  --orientations portrait --url-param scoutStage=14
# …as the fail clips' player sees it
pnpm preview:video --scenarios scout --only-setup --formats 10s \
  --orientations portrait --url-param scoutStage=22 \
  --url-param scoutPolicy=average --url-param scoutShop=thin
```

`scout` is a measurement, not a clip (`--only-setup` always). Everything the
beat sheets schedule against came out of it.

## Authoring loop

```bash
# the opening frame only — seconds a cycle
pnpm preview:video --only-setup --formats 10s --scenarios success --orientations portrait

# a draft: quarter of the pixels, same layout, cheap encode, frames kept
pnpm preview:video --formats 30s --scenarios success --orientations portrait \
  --portrait 540x960 --dpr 1 --quality balanced --keep-frames
```

**Do not draft at `--fps 15`** (the skill's generic advice). `step()` caps a
tick at 60 ms, so a 66.7 ms frame advances the world by less time than it
advances the clock: the simulation behaves differently at 15 fps than at the 30
the clips are recorded at, and the beats land somewhere else. Drop the
resolution instead — the layout is identical at 540x960 dpr 1 and 1080x1920
dpr 2.

## Things that bit, and are now handled

- **ASI in page-side closures.** A statement followed by a line starting with
  `(window)` — which is what a `/** @type {any} */ (window)` cast looks like —
  is ONE expression: `P.hold(true)(window)…`. Every closure in `_drive.mjs`
  takes `window` into a local first.
- **The scout is an estimate, not a replay.** It plays with no renderer, and the
  renderer pulls on the same `Math.random` the simulation does, so a take drifts
  a second or two from the run that was measured. The beat sheets aim their
  verdict at ~0.8 of the clip and keep the tail free.
- **The dev server posts to the LIVE leaderboard.** `.env` points at the
  production worker with an open origin list, so a recorded run that clears a
  stage would put rows on the public board. `server.env` points it at a dead
  port instead.
- **The landscape cut is a vertical road on a wide frame.** `setViewport` fits
  the lane's width but never zooms past the vertical fit, so on 16:9 the lane is
  a strip with terrain either side. That is the game on a desktop; the only way
  to fill the frame would be to show less road than a player can react to.
