# Survivalist — retention roadmap

Eighteen features, ranked by *impact per hour of work*, aimed at four numbers:

* **D1** — do they come back tomorrow?
* **APT** — average playtime per session
* **Pick-up** — how fast a brand-new player understands the game
* **Put-down resistance** — how hard it is to stop after a run ends

Each item states the metric it moves, the concrete implementation (real files in
this repo), the effort, and the risk of it backfiring. Nothing here is
speculative UI — every one of them can be built on the systems that already
exist (`useSurvivalGame.ts`, `useVfx.ts`, `useGameAudio.ts`, `useUpgrades.ts`).

> **Read this first.** The single biggest retention risk this game had was not
> on the list below: it was that **nothing on it could be lost**. Thirty-stage
> career simulations (`tests/sim/CAREER.md`) found every competent player
> clearing the whole campaign on any purchasing strategy, with the boss dying
> before its first swing from stage 8 on. Players churn when a game frustrates
> them; they also churn, more quietly, when nothing has threatened them for
> twenty stages. That is fixed (proportional bites, boss guard phases, boss
> rage), and it is the prerequisite for everything here — a milestone chest is
> worthless if the milestone was never in doubt. **Re-run the career study after
> any balance change**, because none of these features can be judged against a
> game that plays itself.

---

## Tier 1 — build these first (highest impact, ≤ 1 day each)

> **Shipped 2026-09-09, as one onboarding pass** (see the *Poki fit test*
> block in `game-implementation-plan.md` for the measurements behind it):
> **#1** auto-advance ring on the result screens of stages 1–5 (6 s,
> cancelled by any touch; none from stage 6 on); **#3** the free rally, automatic and silent, once per stage on
> stages 2–3 for a first session; **#2** re-cut as the **gift ladder** — a
> weapon choice into stage 3, the shield into stage 4, a weapon on the road
> every other stage from 4, promised on every banner and on a HUD chip, with
> the beats marked on the progress rail; **#4** finished — the opening
> doorway stands inside the first screen and races under the crowd's fire
> while the controls lightbox is up. Continuous handover now runs through
> stage 3, so the first result screen lands after stage 4.

### 1. Kill the dead air between runs — **SHIPPED**
**Moves:** put-down resistance, APT · **Effort:** 2 h · **Risk:** low

The result screen is currently a full stop: the player must read it and press a
button. A runner's whole retention model is that the next attempt starts before
the decision to stop is made.

*Implementation:* in `GameScene.vue`, add a 2.5 s auto-advance on the result
overlay — a thin radial timer on the primary button that fires `onNext()` /
`onRetry()` when it completes, cancelled by any pointer-down. Keep the buttons
for players who want the shop. Measure: % of sessions with ≥ 3 consecutive
stages (expect a large jump).

### 2. Milestone chests every 5 stages
**Moves:** D1, put-down resistance · **Effort:** 3 h · **Risk:** low

A goal 2–3 stages ahead is the single cheapest way to stop a session ending at
stage 7. The HUD's progress rail already exists; it just has nothing beyond the
current stage.

*Implementation:* add `nextMilestone(stage)` to `src/game/survival.ts` (every 5
stages, coin payout scaling with the stage). Show a small chest chip beside the
stage label with "2 stages to go", and on the result screen replace the coin
readout with a chest-opening sequence when the milestone lands (reuse
`spawnCoinExplosion` in `useCoinExplosion.ts`). Persist claimed milestones under
a new `ts_milestones` key in `src/keys.ts`.

### 3. A free revive at the boss, once per stage — **SHIPPED** (first session only)
**Moves:** APT, D1 · **Effort:** 3 h · **Risk:** medium (can devalue failure)

*As built:* no button and no screen. The sim asks a policy the scene installs
(`setRallyPolicy`), and the scene answers "**70 %** of the peak squad, at least
3" on stages 2–3, past 75 % of the road, once per stage, only while the player
has never cleared stage 3. Stage 4 keeps the real floor.

*Revised after playtest, and both halves of the revision matter:*

- **40 % was not a rescue.** Two fifths of a peak squad comes back too thin to
  survive the stretch of road that had just killed it, dies again within
  seconds, and reads as the game teasing the player. The point of this feature
  is a first stage-2 CLEAR, not a longer stage-2 death, so the share is now 70 %
  — a squad that can actually finish.
- **An unexplained gift is worth less than nothing.** It shipped announced by
  one word on the stage banner, *Rally!*, which names the mechanic without
  explaining it: survivors reappeared a frame after the last one died and the
  honest reading was that the game had glitched. It now says who saved you and
  how many came back — *"A guardian angel saved you! / 40 survivors are back"* —
  under the boss rail for three seconds (`GuardianBanner.vue`), over an in-world
  miracle anchored to the crowd rather than to the road: a column of light, a
  halo bobbing over the squad, ground rings, and feathers falling through rising
  sparks (the `rally` VFX case and `drawRallyHalo`). The halo lasts 1400 ms
  against the 1500 ms of collision immunity a rallied crowd gets, so the light
  going out is also the readout for the grace period — which nothing previously
  taught, and which had the same "is this broken?" failure mode as the rally
  itself.

Wiping at 90 % of a stage is the most common rage-quit point in this genre.

*Implementation:* when `finishRun(false)` fires and `progress01 > 0.75`, offer
"Rally!" on the result screen: restore 40 % of `peakSquad`, respawn at
`arenaY - 12`, and set a per-stage flag so it cannot be used twice. The
simulation already supports this — `startStage` + `debugAddUnits` is 90 % of the
code path. Gate it to once per stage so the loss still means something.

### 4. First-15-seconds scripted opening
**Moves:** pick-up, D1 · **Effort:** 3 h · **Risk:** low

Stage 1 already opens with a clear run, one unthreatened gate and one crate
(`buildTrack`'s hand-shaped opening). Go further: make the FIRST gate pair
`+1 | +1` with a deliberately slow approach so the player watches the number
climb twice before reaching it, and hold the "Tap to move" hint until they
actually move.

*Implementation:* `src/game/track.ts` — extend the opening clear zone to 20
units and drop the first gate's `y` to 18; in `GameScene.vue` gate the second
hint (`gate`) behind `hintsDone.has('move')`. Measure: % of first sessions that
reach the stage-1 boss (target > 85 %).

### 5. Combo meter for uninterrupted growth
**Moves:** put-down resistance, APT · **Effort:** 4 h · **Risk:** low

Give the player a reason to play *well* rather than merely survive: a streak
counter that ticks up for every gate passed without losing a survivor, and
resets on a death. Each streak level raises coin gain by 10 % and pitches the
gate-tick ladder up a fifth.

*Implementation:* a `streak` ref in `useSurvivalGame.ts`, incremented in the
gate-crossing branch and zeroed in `killUnit`. Feed it into `playFx('gateTick',
value + streak * 2)` (the pentatonic ladder in `useGameAudio.ts` already handles
arbitrary steps) and show it as a chip under the stage label.

---

## Tier 2 — depth that keeps week-one players (1–3 days each)

### 6. In-run weapon pickups
**Moves:** APT, put-down resistance · **Effort:** 2 d · **Risk:** medium

Every run currently plays the same; only the numbers change. Add three
temporary weapons dropped by crates (~25 % of crates): **shotgun** (three-round
spread, half rate), **laser** (piercing beam that damages everything in the
column), **mortar** (arcs over barricades). 20-second timer, visible as a ring
on the HUD.

*Implementation:* a `weapon` field on the run state; `stepShooting` branches on
it for the emission pattern, `resolveBullet` gains a `pierce` flag. Draw the
variants in `drawBullets`. This is the highest-variance-per-hour feature in the
list — it is what makes run 40 feel different from run 4.

### 7. Gate variety pack
**Moves:** pick-up (readability), put-down resistance · **Effort:** 1 d

Four new leaf types, all reusing the existing gate frame and number plate:
`−N` (trap, drawn in red), `×N` with a shrinking timer, a **locked** gate that
must be shot to full before it opens, and a **mystery** gate that resolves on
contact. Two per stage maximum — the `+N` gate must stay the default or the
core loop blurs.

*Implementation:* extend `GateOp` in `src/game/survival.ts` and the
`gatePair()` roller in `track.ts`; the renderer switches its tint table on the
op.

### 8. Rescue cages — **SHIPPED**, with a curve instead of the flat +5
**Moves:** APT, pick-up · **Effort:** 1 d

Caged survivors on the roadside that break open for a flat `+5`. It is a second
reason to steer off the racing line, it reads instantly, and it costs one new
entity type.

*Implementation:* a `Cage` entity mirroring `Crate` (hp, position), paying
`spawnUnit` on death rather than damage.

*As built*, the flat `+5` did not survive being measured against the thing it
competes with. `gateAddBase` runs 8 / 10 / 13 / 18 / 24 / 41 at stages
6 / 8 / 12 / 20 / 30 / 60, so a flat five is **63 % of a door at stage 6 and
12 % at stage 60** — a five-fold decay against an approach cost that does not
decay at all. That is the "decisive at 3, invisible at 30" shape, so the payout
became `max(5, round(gateAddBase(stage) × 0.6))`: it reproduces the roadmap's
number exactly at the debut stage (0.6 × 8 = 4.8 → 5) and holds ~60 % of a door
forever. Capped under a door's face value, so a cage is never the correct line.

Placement is a pass over the FINISHED road rather than a beat, which is what
keeps the hand-authored stages 1–15 untouched: one cage per stage from stage 6,
six units in front of a gate bank, on the shoulder away from that bank's best
leaf (ranked with the same `offerScore` the coin trails use) at 2.9 from the
centre — 1.25 units clear of a full-size crowd sitting dead centre, so a
zero-input run can never collect one. Coverage is 74 of 75 stages; the pass
declines rather than jam a prop behind a wall or across the weapon puzzle's
firing lanes.

It reads apart from a crate by silhouette (tall, with bars breaking the
outline, against the crates' squat block), by light (lit from INSIDE by a warm
lamp — light coming out of a dark shape, the inverse of a crate's lit face) and
by wear (bars bend and the prop rattles; a crate cracks and tumbles). It grinds
on contact exactly like a crate, deliberately, so the player never has to work
out which box is which before deciding a detour is safe.

### 8b. The auto-shield pickup ("bulwark") — **SHIPPED**, requested directly
**Moves:** put-down resistance · not from this roadmap

A roadside box that arms a one-shot absorb: the next BIG blow is vetoed whole,
and the pickup is spent. Not a timer — the game already has a timed shield
skill, and the two now divide the work along a line worth remembering: **the
skill answers bodies, the bulwark answers blows.** The bulwark is asked first
because it is the only one of the two that CAN be — a blow is only vetoable
atomically, before any body is billed, whereas the skill's halving lives inside
`killUnit` where the blow no longer exists as an object.

"Big" is `n > squad × 5 %` **and** `n ≥ 3`, where the floor is `BOSS_MIN_KILL`
— reused rather than invented, because 3 is already this game's definition of a
real hit. That excludes the case this was specified against twice over: a
ten-strong squad losing one body to a barricade is 10 % of the crowd but 1 < 3.

The hard part was that losses run through `killUnit` one body at a time, so
"count the dead this frame" mixes two sources and refunds a loss already taken.
Every area attack now evaluates its victim set FIRST — slam, charge, rake,
meteor, bolt burst, bomber, roller, sweep, bite, wall and boulder contact,
passage rib, body-check. One source honestly could not be pre-counted: the
gunner's round bills across frames as it travels, so no instant holds a victim
set describing the whole hit; it is measured by INTENT (the budget fixed when
the gunner fired), asked once, and the cost of that choice is written at the
call site. Grind damage and hostile gates are deliberately never asked — a
grind is a rate, not a blow, and absorbing a `÷N` would make a bank's decision
optional.

### 9. Boss phase two — **SHIPPED**, and not off a health threshold
**Moves:** put-down resistance, APT · **Effort:** 1 d

At 50 % health the boss should change behaviour — faster slams, a charge down
the lane, and a colour shift. Right now the fight has one idea and reveals it in
the first four seconds.

*Implementation:* `stepBoss` in `useSurvivalGame.ts` — add `enraged` state at
`hp / maxHp < 0.5`, halve `slamCd`, add a telegraphed lane-wide charge; the
renderer already flashes on `boss.flash` and can tint on `enraged`.

*As built*, three of those four instructions turned out to be wrong in this
codebase, and the reasons are worth keeping:

- **The turn hangs off the existing guard gate, not `hp/maxHp < 0.5`.** A bare
  threshold and the 0.33 gate land on the SAME TICK for a squad that puts a
  third of the bar in per frame — the exact case `damageBoss`'s clamp exists for
  — and worse, a threshold *un-crosses*: there is a healing archetype whose
  entire job is to push the bar back up. `BOSS_ENRAGE_AT` is therefore a bound,
  not a trigger: the fight turns at the first gate at or below half, which is
  already the beat whose own cue comment says "the last third is not the same
  fight as the first". The gate counter only counts up, so the latch is
  monotonic by construction. Stage 1 is excluded — its single gate sits at
  exactly 0.5 and it is the tutorial.
- **Halving the cooldown is not survivable.** `SLAM_CD_MIN` (0.95 s) is the
  point where the cooldown drops under the wind-up, and `SLAM_TELEGRAPH`'s note
  already records that 0.62 s of warning measured a 0 % clear rate. Phase two
  instead moves the boss down the curve it was already climbing (×0.7 at once
  rather than over nine swings), floor untouched — and the multiplier is divided
  by `endlessPressure(stage)`, so the ADDED crowd loss is ~0.43 at stage 4 and
  ~0.35 at stage 120 instead of doubling with depth.
- **The charge goes to `meteor` and `claw` only.** The healer's cycle is a
  two-way decision with a measured gap invariant and the summoner has no attack
  clock at all; hijacking either is how those invariants rot. Both still get the
  tempo, the colour and the sound.

The charge honours the travelling-telegraph contract: 1.5 s minimum wind-up
(against the slam's 0.75 s, because dodging it is a 3.55-unit lateral commitment
rather than a step), and the last 0.38 s of the warning is the BODY running down
the lane rather than a mark on the floor. The lane is locked at the boss's own x
with no lead — leading a column would move the answer while the player is on
their way to it.

### 10. Squad skins bought with coins
**Moves:** D1, conversion · **Effort:** 1 d

The coin sink is currently pure power, which caps at "maxed". Cosmetic outfits
give coins a second job and make the crowd personal.

*Implementation:* `heroSprites.ts` already bakes per-outfit strips from a small
`OUTFITS` table — a skin is three hex colours plus a name. Add an `ts_skin` key,
a tab in `UpgradeModal.vue`, and pass the chosen outfit set into
`outfitIndex()`.

### 11. Daily expedition — **SHIPPED**
**Moves:** D1 · **Effort:** 1 d · **Risk:** low

One special seeded stage per day with a fixed layout for everyone and a 3× coin
payout — a reason to open the game tomorrow that is not a login popup (the user
explicitly does not want daily-login modals, and this is the version that
respects that).

*Implementation:* `buildTrack(seed)` is already a pure function of an integer —
pass `YYYYMMDD` as the seed. One chip on the HUD, one flag in the save.

*As built* (`useDailyExpedition.ts`, `DailyExpedition.vue`), with four decisions
the line above does not contain:

- **The clock is UTC.** Local time makes "the same road for everyone" false —
  two players at the same instant get different roads — and lets one player take
  two expeditions against one real day by crossing their own midnight twice.
  The cost is honest and visible: the day flips at 01:00 in Europe and mid-
  afternoon on the US west coast, so the spent chip shows a live countdown to
  the next road rather than the word "tomorrow". This deliberately disagrees
  with the daily chest, which is local on purpose: a per-player allowance
  belongs in that player's day, a shared object needs a shared clock.
- **The flag records the day the run STARTED**, flushed before the first frame.
  A flag written on completion lets a losing player reload the tab and take the
  identical road again knowing everything they just learned.
- **The stage is 16** — the first rung the generator authors itself. Anything in
  1–15 dispatches to a hand-authored road, and every day would print the same
  teaching stage. It carries no autobalancer, so it is the same fight for
  everyone on the same seed.
- **The ×3 is applied once, to that run's own total**, and the rewarded video is
  priced off the un-multiplied figure — otherwise the two compound into 9× on
  one screen a day and re-price the whole upgrade curve. The expedition writes
  no campaign stage, no best-stage, no streak, no failure ledger, and posts
  nothing to the board.

There is no menu in this game — it boots straight into a run — so the chip lives
in the HUD's bottom-left meta cluster, and because that puts it beside settings
during live gameplay, the first tap only arms it: one stray touch would abandon
the run AND burn the day.

### 12. Endless mode after stage 20 — **SHIPPED**, and not the way it is written here
**Moves:** put-down resistance, APT (whales of playtime) · **Effort:** 1 d

The plan was "the curve flattens into infinity: same generator, HP scaling
continues". Measured, that is exactly what the game already did — and it is the
version that does not work. Fourteen generator knobs plateaued between stages 17
and 34, so a stage-100 road was a stage-34 road with more enemy health: the same
beat spacing, the same pack size, the same three-leaf frequency, forever. HP
scaling alone is not a difficulty curve, it is a multiplier on one.

What shipped instead keeps every knob climbing (see the endless entries in
`game-implementation-plan.md`), fixes two hard breaks that only exist at depth
(`MAX_SQUAD` overrun at stage 86, identical gate doors from stage 161), and
uncaps the three shop tracks that are not physically bounded — a benchmark
career reached stage 80 with everything maxed and 893 063 coins unspent.

Still outstanding from this item: **the personal-best line on the progress
rail.** The number itself is persisted and posted (see the global board), it is
simply not drawn on the rail yet.

---

## Tier 3 — polish and instrumentation (do continuously)

### 13. Haptics on mobile — **SHIPPED**
**Moves:** juice, pick-up · **Effort:** 1 h · **Risk:** low

`navigator.vibrate(8)` on a gate tick, `vibrate(25)` on a gate pass,
`vibrate([40, 30, 60])` on a boss slam. Gate it behind a settings toggle and
`mobileCheck()`. Cheap, and it is the single most underused juice channel on
phones.

*Shipped as* `src/use/useHaptics.ts`, called from `applyFx` beside the `playFx`
calls, with three cues named for what the HAND feels rather than for the event:
`tick` (8 ms), `reward` (25 ms), `impact` (`[40,30,60]`). Two things the plan
above did not anticipate:

- **The `÷N` trap door takes `impact`, not `reward`.** The renderer already
  grades that door as a hit; a payout tap there would be the motor telling the
  player they gained something while the screen tells them they lost.
- **It needs a tighter throttle than the mixer does.** A gate tick fires up to
  ~25 times a second across three leaves, and a motor with a ~20 ms spin-down
  turns that into one continuous buzz. Capped at ~6/s, which leaves a stage-1
  pump entirely intact.

It refuses on the same gates the sound does (paused, ad-suspended, platform
mute, mobile mute) plus availability — iOS Safari has no API and desktop Chrome
has a no-op one, so the settings row only renders where a motor exists, on the
**General** tab because the Audio tab is dropped on touch devices.

### 14. Music that follows the squad
**Moves:** juice, APT · **Effort:** 2 h

`useSound.ts` already exposes `setMusicRate()`. Drive it from squad size:
`1.0 + min(0.18, squad / 600)`, plus a hard drop to `0.85` for the two seconds
after a wipe. The track speeding up as the crowd grows is felt long before it is
noticed.

### 15. Screen-space crowd counter pop — **SHIPPED**, and the ladder had to keep going
**Moves:** juice · **Effort:** 2 h

When the squad crosses 25 / 50 / 100 / 200, punch the HUD counter and fire a
one-shot fanfare. Round numbers are free dopamine and they give the player a
vocabulary for their own runs ("I got to 200").

*Shipped* with the ladder DOUBLING past 200 — 25, 50, 100, 200, 400, 800,
1600 — rather than stopping there or stepping by a fixed amount. The four
numbers in the plan already are a doubling ladder, and this squad grows
multiplicatively (`GATE_MUL_MAX` is 3): one door can cross eight fixed
thresholds in a single frame, while a stage-2 player creeping 30 → 60 would
collect nothing. Doubling prices every rung at the same *relative* achievement,
and a four-figure run collects six or seven across it.

The state is one number (the highest rung announced), not a set, which buys
three properties for free: a squad oscillating around 100 is silent, a
wipe-and-rally back to 300 announces only 200, and a ×3 from 300 → 900
announces 800 alone. It re-arms on a stage change AND on `phase` re-entering
`run` from a result — two signals, because a retry repeats the stage number and
a stage jump can skip the result screen.

The fanfare is **synthesised**, not one of the four shipped samples: every one
of them already means something else (`celebration-1` = stage cleared,
`celebration-3` = boss dead, `reward-continue` = here is a gift), and a
mid-stage chime that sounds like a stage clear tells the player their run just
ended. It is three notes of the game's own pentatonic ladder an octave above
the reward chord, and it brightens with the rung.

### 16. Performance headroom for 200+ crowds
**Moves:** APT on low-end Android · **Effort:** 1 d

Currently the crowd is sorted every frame (`order.sort` in `useSurvivalArt.ts`)
and each survivor costs a `drawImage` plus a shadow ellipse. Two easy wins:
bucket-sort by `y` into 16 bands instead of a comparison sort, and draw the
shadows for the whole crowd in ONE path (`ctx.beginPath()` + N `ellipse()` calls
+ one `fill()`). Expect ~25 % of the crowd's frame cost back.

### 17. Analytics that can actually answer "why did they stop?"
**Moves:** everything (measurement) · **Effort:** 4 h · **Risk:** none

Without these the rest of this list is guesswork. Emit: `stage_start`,
`stage_end{cleared, stage, peakSquad, damage, durationMs}`,
`gate_pass{value, op, gain}`, `wipe{stage, progress01, cause}`,
`shop_open{coins}`, `upgrade_buy{id, level}`. The wipe *cause* (foe / barricade
/ boss slam) is the one that tells you which system to tune.

*Implementation:* a thin `track(event, props)` in `src/use/useAnalytics.ts`
that forwards to whichever portal SDK is active (each already has an event API)
and no-ops elsewhere.

### 18. Share card for a best run — **SHIPPED**
**Moves:** organic acquisition, D1 · **Effort:** 1 d

On a new record compared to all pears from the leaderboard on the same stage, render a 1080×1080 canvas (stage, peak squad, the crowd
silhouette) and offer `navigator.share`. Portal traffic is not viral, but the
card doubles as the promo art pipeline for store listings.

*As built* (`game/shareCardArt.ts` + `use/useShareCard.ts`): offered on the
three conditions the result screen already computes — `isRecord`, a real rank
string, and a device that can actually share — so it costs **no new network
request** and nothing at all on a run that is not a record. The crowd is blitted
from the real baked survivor strips through the renderer's own contracts, so the
card is the game rather than a drawing of it, and the whole thing is
deterministic (no `Math.random`, no clock) which is what makes it testable.

Two traps worth keeping:

- **`navigator.share` existing proves nothing on a portal.** It is present
  inside a cross-origin iframe whether or not the parent wrote
  `allow="web-share"`, and `canShare({})` lies — the probe has to be a real
  `File`, and the permissions policy has to be read separately. The blob
  download fallback is offered ONLY on the unframed own-domain build, because a
  sandbox without `allow-downloads` drops it silently, which is exactly the dead
  button this feature must not have. Anything that rejects at runtime retires
  the button for the session.
- **JPEG, not PNG.** The card is a full-bleed gradient over gravel noise —
  PNG's worst case — and a multi-megabyte file hangs a phone's share sheet.

---

## What NOT to build

* **A daily-login calendar / battle pass / achievement wall.** They were removed
  from this build on purpose. They add sessions on paper and dilute the loop in
  practice — every one of them is a screen between the player and the road.
* **A pre-run loadout screen.** The game's biggest asset is that it starts
  playing in under a second. Anything that adds a decision before the first
  gate costs more than it returns.
* **Rewarded-video buttons in the HUD.** Also removed deliberately. If ads come
  back, put them at the natural break (between stages), never mid-run.

---

## Suggested order of work

1 → 4 → 2 → 3 → 5 (one week: the "one more run" loop is complete)
→ 17 (measure) → 6 → 9 → 7 (two weeks: the runs stop feeling identical)
→ 10 → 11 → 12 (the reasons to come back) → 13 – 16 (continuous polish).
