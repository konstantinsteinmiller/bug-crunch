# Bug Crunch — retention roadmap

Eighteen features, ordered by **expected return per day of work**, with the
metric each one is meant to move and the actual files it would be built in.

> **Since this list was written, four of its neighbours have shipped** — not
> from this list, but from a playtest. They are recorded at the bottom under
> *Already built*, because a roadmap that still proposes what exists is a
> roadmap nobody trusts.

Nothing here is a rewrite. Every item lands on top of the shipped systems:
`bugcrunch_state` (one save blob, `src/use/useBugCrunchState.ts`), the pure level
generator (`src/game/stages.ts`), the pure objective evaluator
(`src/game/stars.ts`), the headless simulation (`src/use/useBugCrunchGame.ts`),
and the drop-in art pipeline (`src/game/art.ts`).

**The four metrics, and what moves them**

| Metric | What actually moves it |
| --- | --- |
| **D1 retention** | a reason to open the app tomorrow that existed *yesterday*: unfinished progress the player can see, and a reward with their name already on it |
| **Average playtime** | a next thing to do that is visible *before* the current thing ends |
| **Easy to pick up** | fewer decisions in the first 60 seconds |
| **Hard to put down** | a session that ends on a cliff rather than on a wall |

---

## Tier 1 — the first week of work

### 1. A three-level "next up" strip on the result screen

**Moves:** average playtime, hard-to-put-down.

The result screen currently ends on one forward button. A player who has just
cleared 2-4 has no idea that 2-5 introduces the flea, that 2-7 is a conveyor
level, or that the boss is three levels away. A run ends on a full stop instead
of on a comma.

*Build it:* a strip under the star row, fed by `levelSpec(n + 1 … n + 3)` — the
generator is already pure and memoised, so this costs nothing. Show each level's
label, its new bug (first `roster` entry whose `debut === n`), and a boss crown
on a boss level (`levelSpec(n).boss` — 1-4 as well as every tenth). Reuse `ObjectiveList`'s chip styling and `GameIcon`.
`GameScene.vue`'s `warmNextLevelArt` already pre-warms the art for `level + 1`;
extend it to the strip's range so the preview is never a blank box.

**Instrument it:** the share of result screens whose forward button is pressed
within 3 s.

---

### 2. Pick-up-where-you-left-off, with the board still on screen

**Moves:** D1 retention.

`bc_level` is saved, so a returning player resumes on the right level — but they
resume on a cold start that looks exactly like a first start. Nothing tells them
they were four squishes from a three-star clear.

*Build it:* on boot, if `bc_failed_levels[level] > 0` or the player's best on
this level is under three stars, show a two-line "last time" card over the level
banner: the stars they hold, and the single objective they missed (already
computed — `evaluate(spec.objectives, tally)` and the banked
`bc_level_stars`). It dismisses on the first pointer-down, so it costs a
returning player nothing and a new player never sees it.

---

### 3. A daily Bug Hunt with a visible streak

**Moves:** D1 retention (the single biggest lever on this list).

One generated level a day, seeded from the date, that uses bugs and hazards the
player has already met. Clearing it pays coins and one **Hunt Badge**; the badge
row is the streak.

*Build it:* `levelSpec` already takes a seed and `startLevel` already accepts
`seed`. Add `dailySpec(dateKey)` beside `levelSpec` in `stages.ts` — same eased
curves, difficulty pinned to the player's `bc_best_level`, roster filtered by
`rosterForLevel(..., bestLevel)`. Store `bc_daily_done` (date string) and
`bc_daily_streak` in the save blob; both are prefixed fields, so
`SaveMergePolicy` carries them to the cloud with everything else. Entry point:
a badge on the HUD's level chip, not a modal — the brief rules out daily-login
modals, and a badge is not one.

**Care:** the streak must survive a time-zone change. Key it on the device's
local date and forgive exactly one missed day per week.

---

### 4. Near-miss relief that the player can feel

**Moves:** D1 retention, hard-to-put-down.

`StartOptions.relief` exists and is wired, but nothing tells the player it is
there. A six-year-old who fails 3-6 four times does not conclude "the game is
being kind"; they conclude they are bad at it and close the tab.

*Build it:* on the second consecutive failure of a level, show a "the bugs are
slowing down" flash on the level banner and bump `relief` one step. On the
fourth, offer a one-off free **Slow-Mo Start** (the first ten seconds at 0.75
speed). Both read from `bc_failed_levels`, which is already banked per level.
Keep the quota untouched — slowing the board helps the player who could not keep
up, shrinking the quota deletes the objective they were failing.

---

### 5. End the session on a cliff, not a wall

**Moves:** hard-to-put-down.

When a level is cleared with more than 25 s left on the clock, do not go to the
result screen immediately: run a three-second **Overtime** where the board
floods and every squish is pure score, with the clock counting down in red.

*Build it:* in `useBugCrunchGame.finish`, when `won && timeLeft > 25`, enter a new
`phase: 'overtime'` instead of `'won'`, set `spawnMs` to its floor and
`maxAlive` to double, and finish for real when the timer expires. The renderer
needs no new state; the HUD swaps its rail for an OVERTIME banner. Feed the
overtime score into `tally.score` so it lands on the leaderboard.

---

## Tier 2 — the second and third weeks

### 6. Three shoe *loadout* slots instead of one equipped shoe

**Moves:** average playtime.

Six shoes exist and exactly one is worn. A player who has bought the roller
skate rarely takes it off, because switching means opening the Locker between
levels. Let them carry three and swap mid-level on a long cooldown.

*Build it:* `bc_shoe` becomes `bc_loadout: ShoeId[]` (cap 3, migrate the old
scalar on read — `useBugCrunchState` already versions the blob). `startLevel`
takes the first; add `swapShoe(id)` to the sim, gated on a 12 s cooldown and
forbidden mid-slam. The Locker's cards get a slot picker; the HUD gets a small
shoe-swap dial above the vial.

---

### 7. Star-priced "Bug Cards" — a collection, not a shop

**Moves:** D1 retention, average playtime.

Nine bugs and four bosses already have art, flavour and stats. A card per
species, unlocked by squishing N of them, is a collection that fills itself out
of play the player was doing anyway.

*Build it:* `bc_kind_totals: Partial<Record<BugId, number>>`, incremented from
the same place `tally.byKind` is. A card flips at 10 / 50 / 200. The card face is
`paintBug` at a large size plus the spec's own numbers — no new art. Surface it
behind the Locker's existing modal as a second tab, so no new button lands on
the HUD.

---

### 8. Personal-best ghosts on the level banner

**Moves:** average playtime, hard-to-put-down.

The board already tracks time and squishes. Show, on the objective rail, a thin
second marker at the pace of the player's best clear of this level. Beating your
own ghost is the cheapest replay motivation there is, and it needs no server.

*Build it:* bank `bc_level_pace[level] = squishes-per-second` on a clear that
beats the previous. `SplatHud`'s rail gets a `ghost` prop — one absolutely
positioned 2 px marker at `pace * elapsed / quota`.

---

### 9. A weekly leaderboard beside the all-time one

**Moves:** D1 retention.

`#1 of 154,331` on the result screen is unreachable for anyone who did not play
on day one. A weekly board resets the ceiling every Monday and makes the number
mean something to a player in week nine.

*Build it:* the Cloudflare Worker in `worker/` already stores scores in D1. Add a
`week` column (ISO week key) and a second query; the client sends nothing new.
`LeaderboardModal` gets a two-tab header. The result-screen chip shows the
**weekly** rank, because that is the one a new player can move.

---

### 10. Three-star chase rewards

**Moves:** average playtime.

Stars gate worlds and price shoes, and that is all they do. Add payouts at 15 /
30 / 60 / 90 stars — a juice style, a shoe colourway, a Locker slot — so
re-clearing an old level for its missed star has a destination.

*Build it:* pure addition to `stages.ts` (`STAR_REWARDS`), banked as
`bc_star_rewards_claimed`. The result screen already knows `previousStars` and
`stars`; show the next threshold under the star row.

---

### 11. "One more thing" on the fail screen

**Moves:** hard-to-put-down.

A failed level currently offers Retry and the Locker. Add a third, quieter line:
the single objective the run came closest to, with its actual number — *"×6 chain
— you reached ×5."* Specific misses read as solvable; a blank star reads as a
wall.

*Build it:* `progress01(objective, tally, quota)` already returns exactly this
per objective. Take the highest non-met one and print it. No new state.

---

### 12. Combo insurance as the one rewarded-ad slot

**Moves:** hard-to-put-down, conversion.

When a chain of ×12 or better breaks with more than 20 s left, offer to restore
it for a rewarded ad. It is the only moment in this game where a player has
something they want back and knows exactly what it is worth.

*Build it:* the rewarded plumbing is already in `src/platforms/` behind the
capability gate. Fire at most once per level and only above the multiplier
threshold. **Gate on readiness** — never show an offer that cannot be filled —
and follow the playbook's ad-audio mute guarantee.

---

## Tier 3 — the month after

### 13. A fifth world built out of what already exists

**Moves:** average playtime.

`WORLDS` is four entries of pure data and `levelSpec` generates the ten levels of
each from eased curves. A fifth world is a new floor tile, a new boss script and
one record entry — it is the cheapest ten levels this game will ever add.

*Build it:* `WORLDS[5]` + `BOSSES.<new>` + `paintFloorTile` case 5 +
`VIGNETTE_STRENGTH[5]`. `TOTAL_LEVELS` is derived, and the tests in
`tests/game/stages.test.ts` cover the new world the moment it is added.

---

### 14. Endless mode, unlocked by the first boss

**Moves:** average playtime, hard-to-put-down.

One board, no quota, difficulty ramping forever, one score. It is the mode that
makes the leaderboard matter and the mode a player opens when they do not want to
commit to a level.

*Build it:* a level spec with `quota: 0`, `time: Infinity` and a ramp driven by
`elapsed` rather than by `levelSpec`. `finish` triggers on a life counter
instead. Reuses the entire sim; the only new UI is a depth readout where the
clock sits.

---

### 15. Two-finger co-op on tablets

**Moves:** average playtime, D1 retention.

The sim already has one foot and a board. A second foot, driven by a second
pointer, on the same screen, is a local co-op mode that turns a tablet into a
shared toy — and shared toys get opened again.

*Build it:* `foot` becomes a two-element array; `press/aim/release` take a
pointer index. `resolveArea` is already position-based. Score is shared, chain is
shared, and the tutorial does not change. The one real cost is the renderer
drawing two shoes and two rings.

---

### 16. A squish-cam replay of the best chain

**Moves:** D1 retention (through sharing), hard-to-put-down.

Record the four seconds around the level's best chain and offer it on the result
screen as a looping clip.

*Build it:* the preview-video pipeline (`tools/preview-video/`) already records
the real renderer against a virtual clock. The sim's event stream
(`drainEvents`) is a complete, replayable log — bank the events and the seed, and
replay them into an offscreen canvas.

---

### 17. Bug behaviours that teach, not just threaten

**Moves:** easy-to-pick-up.

The flea dodges, the beetle armours, the caterpillar spikes — and a new player
meets each one cold, mid-level, with a clock running. Give each species a
**first-sighting beat**: the first time a bug type appears, the board slows to
0.4× for 900 ms and the ALERT glyph points at it.

*Build it:* `ControlHint` already has a per-species primer and `hintsSeen`
already persists. Add the slow-motion window in `substep` (scale `dt`) and fire
it from the same place the primer is chosen in `GameScene.vue`.

---

### 18. An in-game "what changed" note after an update

**Moves:** D1 retention for returning players.

A player who comes back after three weeks should be told, in one line and one
picture, what is new. `APP_VERSION` is already injected at build time.

*Build it:* store `bc_seen_version`; when it differs from `APP_VERSION` and a
`WHATS_NEW[version]` entry exists, show a single banner over the level banner —
never a modal, never a gate. One i18n key per release.

---

---

## Already built (playtest, 2026-09-13/14)

These were not on the list above; they came out of playing the game and are
done, tested and in the browser. Where one of them displaces an item above, that
item says so.

* **An idle treasure chest.** Fills on wall-clock time, pays 20 coins at three
  minutes and 80 at ten, capped at 240 a calendar day in the player's own
  timezone. The cap was set against `levelPayout`: playing earns ~50 coins/min
  across the campaign and the chest ~8, and a whole perfect day of idling is
  still less than the cheapest shoe. `useTreasureChest.ts`, and the numbers are
  pinned as a *relationship* so re-pricing a shoe fails the test.
* **Reward reveals.** A world opening, a shoe unlocked, a star milestone, a
  personal best, a big chest prize and a species met for the first time each get
  their own gift screen, queued, before the result screen.
  `campaignRewards.ts` + `RewardRevealModal.vue`.
* **A thirteen-lesson wordless tutorial.** Every mechanic and both halves of the
  shop flow. `game/tutorial.ts` + `useTutorial.ts`. This is the answer to
  **#17 (bug behaviours that teach)** in a more general form; #17's slow-motion
  first-sighting beat is still worth doing on top of it.
* **A rewarded-video unlock in the Locker.** Watch a video instead of paying
  coins, star gate still enforced, and the button is not rendered at all when no
  video is ready. **This is the game's one rewarded slot, so it displaces #12
  (combo insurance)** — a second rewarded prompt during a run would be the
  second interruption in a game built to have none.
* **The sprinter ant, and a re-cut opening.** 1-1 through 1-6 now each introduce
  exactly one new creature or floor object, with a problem always one level
  ahead of its answer. Part of what **#1 (the "next up" strip)** was for is now
  handled by the levels themselves; the strip is still worth building.
* **A second re-cut, and the first boss inside the funnel.** Players still
  drifted off 30-50 s in, so world 1 now runs ant · caterpillar · beetle ·
  **Goliath Queen at half strength (1-4)** · sprinter · crumbs · piñata fly ·
  flea · honey · full Queen (1-10); the salt shaker moved to 2-2. Boss levels are
  data (`BOSS_FIGHTS` in `stages.ts`), strength is one helper (`scaleBoss`), and
  the boss's egg phase got its own wordless lesson. Scouted numbers are in the
  world-1 block of `stages.ts`.

## Already built (the retention set pieces, 2026-09-18)

`RETENTION-FEATURES.md` #1–10, retrofitted onto the cutscenes and front-loaded
into the first five minutes. §0 of that document has the details and the scout
numbers. Four of them displace items above:

* **Peek** — a silhouette under a napkin on every result screen, naming the next
  level's new thing, with crown pips counting down to the boss. **Replaces #1** (a
  mystery instead of a three-item list).
* **So Close!** — a near miss (≥ 60 %) shows the bugs it was short by as ghosts, and
  its retry opens with a full vial and a hint glyph. **Covers #4 and #11.**
* **Big Finish** — the last body is gilded. Tap it for confetti; slam it for a
  board-clear jackpot. **Replaces #5 (Overtime).**
* **Rush Lines**, **Growth Spurt**, **Shoebox Trials** (Steel Boot on 1-2),
  **Bug Party** (after 1-3 and every x-6), **Beetle Bowling**, **Boss Trophies**
  (Heel Spin, Skid, Quake Slam, Echo Stomp) and the **Uh-oh! Twists** (Spill on 1-7,
  then one per world) — none of which were on this list.

**#3 (the daily streak) is ruled out** by `RETENTION-FEATURES.md` §5: a visible streak
is FOMO aimed at children, and a daily hook in disguise.

---

## What NOT to build

Recorded here so it does not get re-proposed:

* **A main menu.** The game starts in the first scene on purpose. Every screen
  between the tap and the board is a place to drop out of.
* **A Battle Pass, achievements, daily-login or daily-mission modals.** Ruled out
  by the brief, and every one of them is a screen that is not the board.
* **An energy or lives system.** It converts on adults and it kills children's
  sessions outright.
* **Interstitials before level 3.** The opening minutes are the whole retention
  funnel. `GameScene.vue` already refuses; keep it that way.
* **Text-heavy tutorials.** The audience starts at six. Everything the tutorial
  teaches, it teaches by making the player do it.
