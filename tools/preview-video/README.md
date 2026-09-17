# preview-video — bug-crunch's clips, generated rather than filmed

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

**Measured sizes** (`high`, CRF 14 — this game draws dozens of animated bodies
over a patterned floor and covers it in splat decals, so it compresses far worse
than a flat puzzle game): 10 s 720x1280
≈ 11 MB, 16 s 1920x1080 ≈ 19 MB, 16 s 1080x1620 ≈ 29 MB, 30 s 1080x1920
≈ 56 MB (~15 Mbps), 5 s 1080x1080 at 60 fps ≈ 6 MB. Every CrazyGames file is
well inside their 50 MB cap. If a spec ever states a BITRATE (some 1080p specs
say 10-12 Mbps), re-encode that format at `--quality balanced` (CRF 20) — one
capture, a different encoder, roughly half the size.

## The two cuts

| | what is on screen |
|---|---|
| default (`?feed=preview`) | no HUD, no boss tell, no objective call-out, no off-screen alert markers — and the comic words KEPT, because SQUISH! over a flattened beetle is what this game is sold on and it is art rather than interface |
| `--url-param feed=pure` | the same, plus the recorder no-ops `fillText`/`strokeText` for the whole page: not a word anywhere. For a spec that says "no hardcoded text, score counters, watermarks, UI or logos" |
| `--no-clean` | the game exactly as a player sees it, HUD and all. Still driven — the scripting seam rides on `?preview=1`, which is a separate parameter for exactly this reason |

The game-side half is `src/game/previewFeed.ts` (DEV-only, `'off'` in every
build a player loads) plus two hooks in `GameScene.vue`: the seam install, and
the **board sync** — `syncBoard()` carves the HUD's own bars out of the
playable area by MEASURING them, and the recorder hides the HUD with
`visibility`, which keeps its boxes. So a clean take plays on exactly the board
a player would have, and the shoe never wanders under a bar that is not being
drawn.

## How a clip is built

1. `boot()` — seed `bugcrunch_state`, navigate, wait out both splashes, then FREEZE
   the simulation (`__preview.hold(true)`) and hold until every painting the
   game can ask for has decoded.
2. `levelRun()` — **scout**: play the whole level frozen and unrendered (a
   couple of seconds) to find out when the vial fills / when the boss dies /
   when the clock runs out, restoring the save afterwards. Then re-open the
   level and fast-forward to `thatMoment − lead`.
3. `rollCamera()` — re-seed `Math.random`, release the hold, and put the
   scripted player (`_drive.mjs`, `PLAYERS`) on the wheel, one decision per
   recorded frame.
4. The beat sheet marks beats, and `rideToVerdict` + `playOn` end the clip on
   the next level opening rather than on a hidden result screen.

Nothing is faked: every clip is the game's own simulation, played through the
same `press` / `aim` / `release` a finger drives.

## The levels, and why

| clip | level | shoe | player | what the board does |
|---|---|---|---|---|
| `success` (10 s, CG, Poki) | 14 | steel boot | `ace` | four bug designs and a conveyor; the vial fills mid-clip and Fever is spent on a full board |
| `success-30s` | 30 | steel boot | `ace` | the Matriarch: chain, a scripted slam through a shell, Fever, three boss phases, the stars |
| `fail` (10 s, CG, Poki) | 30 | **starter sneaker** | `average` | the Matriarch: two taps CLANG off her armour and the clock runs out with the bar two thirds down |
| `fail-30s` | 30 | **starter sneaker** | `average` | the same Matriarch as `success-30s`, in a shoe that cannot open her |

The fail clips are the same game with one shoe missing. That is what makes them
fair — the loss is the Locker purchase they did not make — and it is what makes
them REPEATABLE: a level that is genuinely out of reach ends the same way every
time, while a run that is on a knife edge is decided by which way one stomp
lands.

Both of them film a BOSS, and that is not an accident either. Scouted every way,
the `average` player clears ordinary levels: the board is dense, one stomp takes
two or three bodies, and a quota falls to volume whether or not anybody is
aiming. A boss does not fall to volume — it wants slams through armour — so a
player who taps more than they charge reaches its second phase and then runs out
of clock, every time. `fail-30s` deliberately films the SAME boss as `success-30s`, because a
viewer who sees both watches one player open the Matriarch with a slam and
another bounce off her on the same floor — and the difference is three hundred
coins.

## Re-tuning it after a balance change

The beat sheets are anchored to EVENTS (`anchor: 'vialFull'`,
`anchor: 'bossDead'`, `anchor: 'lost'`), so a rebalance that moves them moves
the clip with it, and one that deletes them fails loudly instead of filming an
empty board. When a clip comes back wrong, look at the level first:

```bash
# the whole timeline of a level: the chain rungs, the vial, Fever, the boss
pnpm preview:video --scenarios scout --only-setup --formats 10s \
  --orientations portrait --url-param scoutLevel=14
# …as the fail clips' player sees it
pnpm preview:video --scenarios scout --only-setup --formats 10s \
  --orientations portrait --url-param scoutLevel=17 \
  --url-param scoutPolicy=average --url-param scoutShoe=starter
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
  level would put rows on the public board. `server.env` points it at a dead
  port instead.
- **The landscape cut is a wider board, not a zoomed one.** Everything in the
  game is sized off `u = min(width, height) / 100`, so a 16:9 frame shows MORE
  floor rather than bigger bugs. That is the game on a desktop, and it is why
  the landscape clips read as busier than the portrait ones.
- **The vial carries between levels.** `startLevel` keeps `fever.juice` on
  purpose (see `useBugCrunchGame`), so a scouting run that fills it leaves it full
  for the take. Every staging call therefore follows `play()` with
  `resetVial()`.
- **The players could not slam, and never aimed at an egg.** The autopilot let
  go of a charge at `chargeMs + 40`, but a press always opens with a quick stomp
  and the charge only starts after it recovers — so every "slam" landed as a tap,
  for every policy, and every number scouted before the fix is a player who never
  slams. It now holds until the foot's ring is full. It also only ever stood on a
  boss when the floor was empty, which left a `pods` phase to end by accident;
  eggs, and a boss whose phase can be hurt, are targets now. Both change what the
  staging reaches, so re-scout before trusting an old beat sheet's lead times —
  the fail clips' Matriarch still runs the clock out (about a quarter of her bar
  left, where it used to be two thirds).
- **Every boss fight has eggs now** ("The brood" in `src/game/bosses.ts`), laid
  by the Queen and Roach Prime and carried in by ants for the King and the
  Matriarch. The autopilot already aimed at every egg; it now skips one still in
  its hop from the boss (it cannot be stomped until it lands) and prices a
  carrier ant as its egg plus the ant. Eggs pay the chain and hatch into ants, so
  every boss clip's chain and vial timings moved — re-scout before trusting a
  boss beat sheet's lead times.
