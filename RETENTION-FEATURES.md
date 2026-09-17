# Bug Crunch — retention features

*Why the loop goes flat at 30–50 seconds, what the first ten minutes should feel
like instead, and twenty features that get it there, all built on systems that
already exist.*

Companion to `ROADMAP.md`, which is mostly about meta (next-up strip, chest, leaderboards).
This document is about the **run itself**. Where a feature here replaces a roadmap item, it says so.

---

## 1. Diagnosis

### How this was measured

I ported the repo's own scripted players (`tools/preview-video/scenarios/_drive.mjs`,
policies `good` and `average`) to Node and ran them on `src/use/useBugCrunchGame.ts`
directly, with no renderer. Setup: a portrait-phone play rect (100 × 170 u), the starter sneaker, seed 7, and the
vial carried from level to level as in real play. Bots are not children. The absolute times flatter
a seven-year-old, so read the ratios.

| | 1-1 | 1-2 | 1-3 |
|---|---|---|---|
| clock · quota · max bodies alive | 55 s · 8 · 4 | 58 s · 12 · 5 | 50 s · 14 · 7 |
| spawn interval, start → end | 1.50 → 1.05 s | 1.35 → 0.90 s | 1.01 → 0.73 s |
| clear time, `good` / `average` | 13 s / 28 s | 16 s / 45 s | 12 s / 18 s |
| share of frames with an empty board (`good`) | 20 % | 14 % | 23 % |
| kills per stomp (`good`) | 1.00 | 1.08 | 1.00 |
| best chain (`good`) | ×3 | ×3 | ×5 |

### What is actually wrong

1. **A stomp is worth exactly one bug.** From 1-1 to 1-3 the `good` player lands 34 stomps
   for 35 kills: one double in the whole opening. Across all of world 1, only 13 % of its
   stomps take two or more bugs (8 % for `average`). The store tile sells a giant shoe over a swarm, but
   the first two minutes are a fingertip over one ant at a time. Cause: 4–7 bodies on a
   100 × 170 u board, where a sneaker stomp (r 9 u) covers about 1.5 % of the floor.

2. **A level has no shape.** The spawn director is a straight ramp (`spawnMs[1]` is always
   `spawnMs[0] × 0.72`), so there is no lull, no surge and no climax. The level ends on whichever
   ordinary squish meets the quota (`substep`: `squished >= quota → finish(true)`). The
   loudest frame of every level is the modal that comes after it.

3. **Nine nouns, one verb.** `stages.ts` adds a new creature or prop on every level of
   world 1, and nearly every one is answered with a tap. You tap where the sprinter stops, tap the knot on the
   crumbs, tap the piñata five times, tap the flea quickly, and tap the flea stuck in honey. Only armour asks for the slam.
   Two more of the GDD's verbs exist in code but are missing from the game:
   - `heelPivot()` fires when a child double-taps by accident, and nothing teaches it (it has no `LessonId` and no `HintId`).
   - The slide needs a honey rim or the Roller Skate, which costs 24 stars and 550 coins.

   Fever is a button on the HUD, not something you do on the board.

4. **The board has no places.** Bodies enter from a random edge (`edgeSpawn`) and walk
   across it. Crumbs are the only destination, and they are passive. The intro cutscene sets the stakes
   (they're taking the food), and the level then forgets them: no food on the board, no exit and no
   nest, so the player never has a reason to think "get that one first!".

5. **The payoffs arrive after the cliff.**
   - With 1-1 capped at 4 bodies, ×3 is the practical chain ceiling.
   - The first Fever is ready after ~30 s of play for `good` and ~90 s for `average`.
   - `combo.ts` says juice bleeds "while nothing is being squished", but `stepFever` decays the vial on every step. A 30-second 1-1 therefore loses a third of a vial, mostly during lesson pauses.
   - The first shoe that changes how you play costs 9 stars and 350 coins, which means around 1-6.

6. **New ideas stop at 1-9, just as levels get longer.**
   - World 1: nine new things across nine levels of 50–63 s.
   - World 2: three or four (stink bug, mower, magnet, and salt if the re-cut moves it to 2-2), now that the caterpillar has moved off 2-2.
   - World 3: three, and the data puts all three on 3-1. The moth's `debut` is 21, even though the table in `stages.ts` calls 3-3 its level.
   - World 4: two, both on one level, with clocks of 74–96 s.

7. **From 2-4 onward, the mower plays the level.** The timed sweeper kills a full-height band
   every 7.6 s. Its kills count toward the quota but pay no score and no chain (`sweepKill`).
   For `average` it takes 34 of 41 bodies on 2-4 and 93 of 109 on 4-8, while the player
   presses about 15 times in a 25-second level. 18 of the 36 non-boss levels have a sweeper.

8. **The first wall is a shell.** `average` slams only 12 % of the time. It bounces off shells
   26–56 times per level and loses 7 of the 9 levels from 1-4 to 2-3, because an armoured body
   it won't slam never dies and keeps its `maxAlive` slot. The re-cut moves the beetle to 1-3
   and adds a half-strength Queen on 1-4, so the first shell wall and the first real loss now
   both land between about 2:00 and 2:40.

### The missing ingredients

| Missing | Evidence above | Answered by |
|---|---|---|
| **Density**: the one-stomp-many-bugs moment | 1.0 kills per stomp | Rush Lines, Growth Spurt, Bug Party, Fizzy Bug |
| **Verb variety** | tap only; the pivot and slide are hidden | Beetle Bowling, Boss Trophies, Shoebox Trials, Mower Pedal |
| **A shape inside the level** (tension, release, climax) | straight 28 % ramp; ends on the Nth kill | Rush Lines, Big Finish, Twists, Boss Cameo |
| **Spatial goals** | edge spawns, no destinations | Nests, Picnic Heist, Splat Stencils |
| **Surprise** | the board never changes mid-level | Twists, Mystery Bumps, Fever Flavours |
| **A visible next goal** | "up next 1-3" as text | Peek, Boss Trophies, Boss Cameo |
| **Agency** | the mower takes 50–85 % of kills | Mower Pedal, Big Finish |
| **Progression that changes play** | first real shoe around 1-6 | Shoebox Trials, Boss Trophies, Bug Buddies |
| **A kind retry** | a fail is a wall | So Close! |

> **Instrumentation gap.** `src/use/useAnalytics.ts` is imported nowhere, and its six event
> names come from another game (`stage_start { squad }`, `gate_pass`, `upgrade_buy`). None of
> the success signals below can be read today. See step 0 of the build order.
>
> **Scout footnote.** The committed `_drive.mjs` releases a held slam at `chargeMs + 40` ms.
> A press spends about 290 ms in drop → impact → recover (sneaker) before charging even starts,
> so `good` and `ace` never landed a real slam. The working tree now fixes this (parallel work),
> and my harness used the fix. Any armoured-level scout numbers from before the fix understate
> every policy, so re-scout 1-3 to 2-3.

---

## 2. The first 10 minutes, beat by beat

**Assumptions.**
- World 1 follows the parallel re-cut as it stands in the working tree (still a draft):
  1-1 ant · 1-2 caterpillar · 1-3 beetle · 1-4 half-strength Queen · 1-5 sprinter · 1-6 crumbs · 1-7 piñata · 1-8 flea · 1-9 honey · 1-10 Queen, with salt moved to world 2.
  The measurements in §1 used the committed table. Every beat below hangs off level progress, so it survives further reshuffles.
- Times are for a median child: somewhere between the two bots, plus about 10 s per level for lessons and screens.

**Beats are keyed to level progress, not the clock**, so they land at the same point in the story for a fast
child and a slow one. Each level gets a four-beat shape (*kishōtenketsu*):
**open** (a seeded board) → **build** (a trickle of bugs, the chain) → **turn** (a rush, twist or cameo at ~50 %) → **close** (Big Finish).

| Time | Where | What the player sees, does, feels | Feature firing |
|---|---|---|---|
| 0:00 | intro | Ants swarm the sandwich (parallel work). The first tap skips. *Stakes.* | cutscene 01 |
| 0:10 | 1-1 open | The board is already alive. Drag, stomp, first squish. | existing lessons |
| 0:18 | 1-1 build | Third quick squish: the shoe puffs up with a *boing*. *My skill is visible.* | **Growth Spurt** |
| 0:25 | 1-1 turn | A snare roll. A sugar trail draws itself and five ants conga down it. One stomp takes three or four; the chain hits ×3 and the vial glugs. *Whoa.* | **Rush Lines** (hosts the `chain` lesson) |
| 0:38 | 1-1 close | The last ant turns gold and the music drops to a heartbeat. Stomp → slow-motion confetti, coins fly to the wallet. *Peak, then the end.* | **Big Finish** |
| 0:45 | result | Stars, and under them a napkin with something fuzzy and spiky wriggling. *What is that?* | **Peek** |
| 0:55 | 1-2 | It was a spiky caterpillar: the first thing you shouldn't stomp. | parallel debut, `spike` lesson |
| 1:15 | 1-2 turn | An ant conga marches right past the caterpillar. Stomp the line, not the spikes. *I aimed.* | **Rush Lines** × caterpillar |
| 1:30 | 1-2 | An arrow flows from the chain badge into the shoe. | Growth Spurt lesson |
| 1:45 | 1-3 turn | A beetle leads the conga. The tap bounces, the hold-to-slam lesson follows, and the slam takes the beetle and two ants behind it. | Rush Lines (beetle point), parallel debut, `slam` lesson |
| 2:00 | 1-3 | The vial is full; the hand points at it; the gilded boot. First Fever. | existing `fever` lesson + tuning |
| 2:15 | party | The basket tips: forty ants, a giant gold boot for 15 s, no way to lose. *Screaming.* | **Bug Party #1** |
| 2:40 | 1-4 | The half-strength Queen. The first real fight. | parallel boss, `boss` lesson |
| (3:20) | if lost | The boss bar freezes one tick short. The retry button pulses with a hold-hand and a full vial. *So close, and now I'm stronger.* | **So Close!** |
| 3:40 | 1-4 won | The Queen pops and drops a shining sticker of a spinning shoe. | **Boss Trophy**: Heel Spin |
| 4:00 | 1-5 turn | Teal sprinters bolt when a stomp lands near them (parallel debut). Then a ring of ants closes around the shoe; the hand double-taps: WHOOSH. | Rush Lines (ring) + `spin` lesson |
| 4:30 | 1-5 close | One to go: the hand holds on the gold shoe, and a slam finisher wipes the board. *Jackpot.* | **Big Finish** (slam) |
| 4:50 | 1-6 | Crumbs pull the ants into a knot. A slam flips a beetle, legs waving; flick it through the knot like a bowling ball. | **Beetle Bowling** |
| 5:35 | party | Party #2, after 1-6. | Bug Party |
| 5:55 | 1-7 | A piñata fly worth chasing. At 35 % a shoebox wobbles: three taps, then a Steel Boot for 12 s. Crunch the caterpillars you've avoided since 1-2. The Locker glows. | **Shoebox Trials** |
| 6:50 | 1-8 turn | Fleas leap away. Then the ground shakes: the Queen marches across with her guards. Slam her crown off. | **Boss Cameo** |
| 7:45 | 1-9 turn | Honey puddles hold the fleas. Then the lemonade glass tips, leaving a slick lane: press and drag to skid through a row. | **Twist**: Spill |
| 8:30 | 1-10 | The full Queen, crownless if you knocked it off. Peek has shown her crown for two levels. | Cameo payoff, Peek |
| 9:40 | 1-10 won | Trophy: Skid (slide on any floor). The world-2 cutscene plays. | Boss Trophy |
| 10:00 | 2-1 | Tall grass. A bump wriggles; stomp it, *boing*, and a dizzy ant pops out (or a piñata). | **Mystery Bumps** |
| 10:40 | 2-2 | Anthills keep pouring ants until you slam them shut. | **Nests** |

**Rhythm check.** The longest stretch without a new or unexpected beat is the 1-4 fight
(2:40–3:40), and that fight has three phases, each asking a new question about every 20 s.

**Tuning this timeline depends on**
- **1-1 quota 8 → 11**, so the rush sits in the middle of the level instead of ending it (3 ants, a rush of 5, 3 ants). Re-scout.
- **Decay juice only after 2 s without a squish**, which is what `combo.ts` already says it does. Together with rush kills and Growth Spurt, this puts the first Fever at about 2:00 for a median child.

### Past ten minutes: new ideas return to every level

| World | New moment per level (existing new creature/prop in brackets) |
|---|---|
| 2 | 2-1 Mystery Bumps · 2-2 Nests (if salt lands here too, salt panics the ants pouring out of a mound into a line) · 2-3 Picnic Heist · 2-4 (stink bug) + Fever Flavours · 2-5 (mower) + Mower Pedal · 2-6 Fizzy Bug · *party* · 2-7 (magnet) + Shoebox **pairs** · 2-8 King cameo · 2-9 Twist: Sprinkler · 2-10 King → Quake Slam |
| 3 | 3-1 (centipede, cobweb) + rushes from floor cracks · 3-2 Splat Stencils · 3-3 (moth) · 3-4 Twist: Blackout · 3-5 Firefly buddy · 3-6 (dark) · *party* · 3-7 Twist: Draft · 3-8 Matriarch cameo · 3-9 stencil pairs · 3-10 Matriarch → Echo Stomp |
| 4 | 4-1 (robobug, conveyor) · 4-2 On-Beat dance floor · 4-3 Twist: Surge · 4-4 Robo-snail buddy · 4-5 (full tilt) · 4-6 Twist: Glitch · *beat party* · 4-7 Robo Laser fever · 4-8 Roach cameo · 4-9 · 4-10 Roach → Endless |

---

## 3. Twenty features, ranked

**Score = Impact² ÷ Effort.**
- **Impact** (1–5) includes reach, meaning how many portal players ever get that far.
- **Effort** points: S = 1, S-M = 1.5, M = 2, L = 3.
- Impact is squared on purpose: a cheap feature nobody notices is worth less than its low cost suggests.

| # | Feature | Main lever | Enters | Effort | Impact | Score |
|---|---|---|---|---|---|---|
| 1 | Rush Lines | density, tension → release | 1-1 | S-M | 5 | 16.7 |
| 2 | Big Finish | peak-end, push-your-luck | 1-1 | S | 4 | 16.0 |
| 3 | Growth Spurt | visible mastery, snowball | 1-1 | S | 4 | 16.0 |
| 4 | So Close! | goal gradient, kind loss aversion | first fail | S | 4 | 16.0 |
| 5 | Peek | curiosity gap | 1-1 result | S | 3.5 | 12.3 |
| 6 | Shoebox Trials | sampling, endowment, choice | 1-7 | S-M | 4 | 10.7 |
| 7 | Bug Party | macro release, spectacle | after 1-3 | M | 4.5 | 10.1 |
| 8 | Beetle Bowling | new verb (flick), emergence | 1-6 | M | 4.5 | 10.1 |
| 9 | Boss Trophies | ability progression, anticipation | 1-4 | M | 4.5 | 10.1 |
| 10 | Uh-oh! Twists | surprise, set pieces | 1-9 | M | 4.5 | 10.1 |
| 11 | Mower Pedal | agency, timing | 2-5 | S | 3 | 9.0 |
| 12 | Mystery Bumps | variable reward on the core verb | 2-1 | S | 3 | 9.0 |
| 13 | Nests | proactive targets, spatial plan | 2-2 | S-M | 3.5 | 8.2 |
| 14 | Boss Cameo | rivalry, earned advantage | 1-8 | M | 4 | 8.0 |
| 15 | Picnic Heist | stakes, triage | 2-3 | M | 3.5 | 6.1 |
| 16 | Fizzy Bug | chain reactions | 2-6 | M | 3.5 | 6.1 |
| 17 | Splat Stencils | spatial goal, creativity | 3-2 | S-M | 3 | 6.0 |
| 18 | Fever Flavours | variety in the big payoff | 2-4 | M | 3 | 4.5 |
| 19 | Bug Buddies | companionship, nurture | 3-5 | L | 3.5 | 4.1 |
| 20 | On-Beat Stomps | rhythm entrainment | feel from launch; mechanic 4-2 | M | 2.5 | 3.1 |

Every new player-visible label below is an `aria-label` or a bug name. Add each key to
`src/i18n/locales/en.ts` first, then to the other 20 locale files. Every new lesson row
also goes into the "teaches every mechanic" list in `tests/game/tutorial.test.ts`.

---

### 1. Rush Lines — the conga

*At the turn of every level, a snare roll draws a sugar trail across the board and a tight
conga of bugs marches down it. One well-placed stomp takes four.*

**The moment**
- *Age 7:* The music drops to a drum roll and dotted sugar sprinkles itself across the
  blanket. Six ants bounce along it nose to tail. She drops the shoe in the middle of the line: pop-pop-pop-pop,
  four splats, the chain badge jumps and the vial glugs. She laughs and chases the last two.
- *Age 13:* The trail tells him where the lead ant will be in a second and a half. He parks the ring one
  body ahead and lets four pass under it. One slam takes five, and he taps the stragglers inside the window
  to keep the chain. On 1-3 a beetle leads the line, so he slams the point and taps the tail.

**Why it retains**
- **Fantasy delivered in the first 30 s.** It turns 1.0 kills per stomp into a real multi-kill.
- **Anticipation → release.** The 1.1 s tell is a readable wind-up, the splat is the payoff, and a short lull afterwards gives a breather: the "turn" of every level.
- **Predictable variety.** The lane is telegraphed (fair and learnable) while the formation changes.
- **Goal gradient.** One rush is 20–35 % of the quota, and the progress rail visibly lunges forward.

**Enters / escalates**
- 1-1 after the third ant (`at: 0.27` of the new quota of 11): five ants, hosting the `chain` lesson.
- 1-2: the lane runs past the caterpillar. Stomp the line, not the spikes.
- 1-3: a beetle leads the line (a V with an armoured point). Its ricochet triggers the `slam` lesson.
- 1-5: a **ring**, which the Heel Spin answers.
- 1-6: the lane runs through the crumb pile, and the line knots up, ready for a bowled beetle.
- From 1-7: sprinter lines. A near miss, or on a mouse a charging approach, bolts the whole line, and it stops winded in a fan.
- From x-5: two rushes per level (35 % and 70 %).
- World 2: V-formations with a beetle at the point (slam it or bowl it).
- World 3: lines crawl out of floor cracks (Nests).
- World 4: robobug platoons on the belt, arriving on the downbeat (On-Beat Stomps).

**What it breaks.** A spatial prediction ("where will the line be?") and a patience decision:
two bugs now, or five if you wait for the line to bunch. It is also the first reason to slam
something that has no armour.

**Textless beat** (lesson `rush`, gesture `tap`, scrim `soft`, bail-out 9 s, order 45)
1. Snare roll; the trail draws itself; a ring breathes where the line will enter.
2. A ghost hand hovers over the middle of the trail as the first ants appear.
3. As three ants overlap the ring, the hand drops: burst, and the chain badge animates.
4. Retires on the player's first stomp that kills two or more. If it bails out, it isn't marked taught and arms again on the next rush.

**Build it** (S-M, about 1.5 days)
- **`stages.ts`:** add `RushSpec { at, bug, count, shape: 'line' or 'ring' or 'vee', gap? }` and `LevelSpec.rushes`.
  - The generated default is one line at `at: 0.5`, using the level's lightest unarmoured roster bug, with `count` lerped from 5 to 12 along the world's `ease`.
  - OVERRIDES cover 1-1, 1-2 and 1-3.
  - The rush is **part of** the quota, so levels don't get longer.
- **Sim (`useBugCrunchGame.ts`):** module scalars `rushIdx`, `rushPhase`, `rushT` and the lane end-points (no allocation).
  - **Trigger.** In `substep`, when `squished >= quota × rushes[rushIdx].at`, pick a lane across the board's **short** axis, at least 20 u from the foot's row, and emit `{ k: 'rushTell', x0, y0, x1, y1 }`.
  - **Spawning.** After the tell, `spawnBug(id, x, y)` places `count` bodies spaced `size × 1.45` apart behind the lane start, all with one fixed heading. `march` bodies never steer, which makes them perfect for this.
  - **Director.** `stepSpawns` returns early during the tell and for a 1.4 s lull afterwards. Rush bodies may exceed `maxAlive` by `count`.
  - **Ring.** Bodies start on a 34 u circle around the foot, heading inward at 0.6× speed.
- **Renderer (`useBugCrunchArt.ts`):** `rushTell` draws a dotted crumb trail in the `crumbs` palette that fades out over the rush, plus an entry chevron. No painting needed.
- **Audio:** new `FxSound` `'rushTell'` (a synthesized snare roll rising over 1.1 s) and `'rushGo'` (a whistle). When one stomp drains three or more squishes, play a stacked chime. The parallel per-bug crush sounds are already capped by `THROTTLES.squish`.
- **Tutorial:** `GameScene.vue` arms `rush` on `rushTell` and points `lessonAt` at the lane midpoint. It calls `complete('rush')` when a drain holds a `stomp` plus two or more `squish` events.
- **Tests:**
  - `stages.test.ts`: every non-boss level has at least one rush, and rush counts stay at or below 40 % of the quota.
  - `sim.test.ts`: a rush spawns exactly `count` bodies, pauses the director, and survives the `maxAlive` cap.

**Risks → mitigation**
- *A child misses the whole line.* Nothing is lost: `bounce` turns the bodies back in and they become ordinary targets.
- *Portrait vs landscape.* The lane always crosses the short axis, so a conga is never 170 u long.
- *Low-end phones.* At most +12 bodies for about 6 s. The peak is `maxAlive + count` ≤ 42 on 4-9, well inside `MAX_BUGS` (160). Verify p95 frame time with `usePerfProbe` on a CPU-throttled run.

**Success signal.** Kills per stomp on 1-1 to 1-3: 1.00 → ≥ 1.4. Also level-3 reach rate and median session length.

---

### 2. Big Finish — end every level on its loudest frame

*The last bug of a level glows gold and the world holds its breath. Stomp it for a confetti
board-clear. Once you can slam, let the board fill up first and slam for the jackpot.*

**The moment**
- *Age 7:* One to go. Every bug gets a gold rim, the music ducks to a heartbeat, and the shoe
  shines. Tap! Slow-motion splat, every remaining bug pops into confetti, and coins arc into
  the wallet with a cash-register *ding*. Fireworks for doing what she was already doing.
- *Age 13:* At 17/18 on 2-3 with 22 s left, he stops squishing and lets the board refill to
  thirteen bodies. Then he charges and slams the gilded last one: thirteen bodies in one
  shockwave, ×12 in one frame. Greed against the clock, and against the time star.

**Why it retains**
- **Peak-end rule.** People remember a session by its peak and by how it ended. Today every level ends on its most ordinary frame.
- **Push-your-luck.** "Cash out now or build the pot" is a decision a 13-year-old makes every level.
- **Closure.** A completion ritual with a payout makes "next" feel earned.

**Enters / escalates**
- 1-1: the tap finish (celebration only).
- 1-5: the slam finish becomes available, two levels after the slam lesson on 1-3.
- World 3: during the one-to-go hold, the gilded bugs start to sprint away from the shoe, so greed has teeth.
- Boss levels: a "crown finish" in slow motion on the final counter-slam.
- Replaces ROADMAP #5 (Overtime).

**What it breaks.** A decision at the end of every level (finish now, or fill up and slam), and
a joyful use for the slam that has nothing to do with armour.

**Textless beat**
- **1-1** (lesson `finish`, gesture `watch`, hold 1.2 s)
  1. Gold rims pop onto every body and a ring appears around the shoe.
  2. A heartbeat pulse. Retires when seen, or on the kill.
- **1-5** (lesson `bigFinish`, gesture `hold`)
  1. At one to go, the hand presses on the shoe and a gold ring fills.
  2. Release: a ghost shockwave rolls over the bodies.
  3. The bodies flash.
  4. Retires on the first slam finish. If the player tap-finishes instead, it re-arms next level, up to three times.

**Build it** (S, about 1 day)
- **Sim:**
  - In `hitBug`'s kill path, emit `{ k: 'finishReady' }` once, when `squished === quota - 1`.
  - When the quota is met, store `finisherHeavy`, `finisherX` and `finisherY`.
  - In `substep`, run `resolveFinisher()` before `finish(true)`.
- **`resolveFinisher()`:**
  - **Heavy:** every live body goes through `hitBug`'s kill branch with `resolveStomp({ …, fever: true })` (the documented "everything dies to everything") and `chainOk: true`. It pays one coin per three bodies (cap 10) and emits `{ k: 'finisher', x, y, n, heavy }`.
  - **Tap:** the rest of the board gets `panic = SALT_PANIC_MS` and scatters.
  - The score reaches `tally` before `finish()`, so the leaderboard sees it.
- **Renderer:** `drawBug` reads an `isFinale()` flag and draws the gold rim. The `finisher` event triggers `punchZoom(0.1)`, a gold `screenFlash` and `burst`, and effects run at 0.3× speed for 500 ms. The sim is already stopped.
- **Flow (`GameScene.vue` `onLevelEnd`):** `await` about 900 ms **before** `showMidgameAd()`. An interstitial must never cut the celebration, and the playbook's rule that the ad goes before the result screen still holds.
- **Audio:** `setMusicRate(0.85)` plus a heartbeat on `finishReady`; a stacked sting on `finisher`.
- **Tests (`sim.test.ts`):** a slam finisher clears the board and banks the score; a tap finisher leaves the rest of the board fleeing.

**Risks → mitigation**
- *A child stalls at one-to-go without understanding.* Heartbeat plus glow; the glow pulses faster under 5 s left. The clock is the natural cap.
- *Reduced motion.* With `calm` on, no flash and no zoom.
- *Low-end phones with a 30-body finisher.* Stamp 12 decals at most and turn the rest into confetti particles. Squish audio is already throttled.

**Success signal.** Share of clears from 1-5 onward that end in a slam; forward press on the
result screen within 3 s; level-to-level continuation.

---

### 3. Growth Spurt — the chain makes the shoe bigger

*Every rung of the chain inflates the shoe with a boing. Break the chain and it deflates with a squeak.*

**The moment**
- *Age 7:* The shoe grows every time she squishes quickly. By the fifth bug it's a clown shoe
  taking two ants at once. She misses, it goes *pfffft*, and she hurries to grow it back.
- *Age 13:* The chain used to be a number in a corner; now it is reach. At ×12 his sneaker has +30 % radius, so the chain
  feeds itself. He routes through the densest part of the board to keep it, and only spends a slam when the
  window ring has room.

**Why it retains**
- **The skill system becomes physical.** `tutorial.ts` itself calls the chain "the whole of this game's skill expression" and "invisible in the fiction".
- **A snowball.** A positive feedback loop is the core of arcade flow (Pac-Man's power pellet, Katamari).
- **Kind loss aversion.** The loss is a funny deflate, and the score is kept.

**Enters / escalates.** Active from 1-1 (×2 = +6 %). The textless beat comes on the first
step-up after the `rush`/`chain` lesson. It grows with the ladder to a +40 % cap at ×50. Fever
multiplies on top, under a total cap, so the gilded boot stays the biggest thing in the game.

**What it breaks.** Where you go matters: staying in the crowd keeps you big. Multi-kills now come from skill.

**Textless beat** (lesson `grow`, gesture `flow`, hold 1.8 s)
1. The chain badge pulses.
2. An arrow flows from the badge to the shoe.
3. The shoe puffs up as the arrow arrives. Retires when seen.

**Build it** (S, ½–1 day)
- **`combo.ts`:** `chainScale(mult)` returns `1 + GROWTH[rung]`, with `GROWTH = [0, .06, .12, .18, .24, .30, .34, .37, .39, .40]`. Pin it as monotone and capped in `combo.test.ts`.
- **Sim:** `stompRadius(heavy)` multiplies by an eased `growth` scalar that chases `chainScale(comboMultiplier(chain.count))` (up in about 120 ms, down in about 260 ms, so it bounces rather than snaps).
  - Fever: `min(base × FEVER.radiusScale × growth, base × 2.6)`.
  - `seedBoard` must keep using the un-grown radius for its safe zone.
- **Rendering is free:** `drawShoe` already sizes the shoe from `stompRadius()`.
- **Audio:** a rubbery `'grow'` blip layered on `chainStep`'s pentatonic note, and `'deflate'` on `chainLost`, only from ×3 up, so small breaks stay quiet.
- **Balance:** re-scout 1-1 to 4-9. `optionals()` combo thresholds probably need one more rung.

**Risks → mitigation**
- *Aces find it too easy.* The cap handles that.
- *The ring hides under the thumb.* `TOUCH_LIFT_U` keeps it above the finger.
- *A bigger shoe scares sprinters from further away.* The scare band `SPRINT_SCARE_SCALE × r` grows with it, which is an intended counterweight (a big, clumsy shoe spooks things). Document it at the site.

**Success signal.** Share of stomps with two or more kills in world 1: 13 % → 25 %. Also median
best chain on 1-1 to 1-9, and time from a chain break to the next kill (players rushing to regrow).

---

### 4. So Close! — a fail screen that hands you a second wind

*When the clock runs out, the result screen shows the bugs you were missing as empty outlines,
and the retry starts with a full vial.*

**The moment**
- *Age 7:* TIME UP. Instead of a sad screen, the progress bar has two ant-shaped holes blinking at
  its end, and the retry button has a sparkling gold vial in it. She retries and starts with the
  gold boot ready. She feels powerful, not punished.
- *Age 13:* He fell one tick short on the half-Queen. The boss bar is frozen at the missing tick,
  and a hold-hand glyph pulses on retry, because he tapped her shell thirty times. On the retry
  he saves the charged vial for phase 3.

**Why it retains**
- **Goal gradient.** "Two left" pulls harder than "you lost".
- **Kind loss aversion.** The miss is framed as progress plus a gift.
- **Competence restored.** The tool hint turns a wall into a puzzle.
- **Nothing is sold.** No ad, no currency, no continue button.

**Enters / escalates**
- It first matters at the half-Queen (1-4). After that it matters on shell-heavy levels, where the measured `average` player lost 7 of 9.
- A Second Wind needs at least 60 % progress, at most once per level per session. Below 60 % the player gets the existing `relief` plus the tool hint.
- Replaces ROADMAP #11, turning its sentence into pictures, and builds on #4.

**What it breaks.** Not the run itself. It is the retry hook, and its hint steers the next attempt
toward a different verb (slam, avoid, flick).

**Textless beat** (lesson `secondWind`, `whilePaused`, gesture `point`)
1. The empty outlines blink on the rail.
2. An arrow flows from the outlines to the vial on the retry button.
3. The button pulses. Retires on retry.

In the level, the vial is full from the first frame, and the existing `fever` lesson arms if it hasn't been taught yet.

**Build it** (S, about 1 day)
- **`stars.ts`:** add `RunTally.ricochets`, incremented in `hitBug`'s `ricochet` branch. Add a pure `missHint(tally)` that returns `'slam'` for ricochets ≥ 8, `'avoid'` for spikes ≥ 3, otherwise null. `nearMiss01` is `squishes / quota`, or `1 - bossHp` on a boss.
- **`useSplatProgress.ts`:** `secondWindFor(level)`, backed by a `bc_last_near_miss` map written in the same `setStates` as `bankLevel`.
- **Sim:** `StartOptions.secondWind` sets `fever = { juice: 1, remainMs: 0 }` in `startLevel`.
- **`GameScene.vue`:** in the `!summary.cleared` branch, a `MissedRail` shows up to five `paintBug` outline silhouettes of the likeliest missing kinds by roster weight, or `BossBar` frozen with its ticks. The retry `FButton` gets a badge slot holding the vial and hint glyphs.
- **i18n:** new aria-labels `result.secondWind`, `result.hintSlam` and `result.hintAvoid`, in all 21 locales.

**Risks → mitigation**
- *Failing on purpose for a free vial.* It costs a whole level at ≥ 60 % progress, and it's capped per session.
- *It feels patronising to a 13-year-old.* It is framed as a second wind, not easy mode, and it helps strong players too.
- *Ad timing.* No interstitial ever follows a fail (the gate is `won && level > 2`). Keep it that way.

**Success signal.** Retry rate after a fail; clear rate on the second attempt; share of sessions
whose last screen is a fail screen (should drop); pass-through at 1-4.

---

### 5. Peek — the next level's secret, as a wriggling silhouette

*The "up next" line on the result screen becomes a little napkin with something bug-shaped
wriggling under it. Tap it and it squeaks, but you only get to see it by playing.*

**The moment**
- *Age 7:* Under the stars a napkin wobbles, and a black shape with long legs pokes out and hides. "What is it?!" She taps next.
- *Age 13:* The silhouette wears a crown, and two pips are left on the crown track: two levels to the Queen.

**Why it retains**
- **Curiosity gap.** A known gap that is cheap to close; an incomplete picture pulls harder than a list.
- **Zeigarnik effect.** A loop is opened at the very moment another one closes.
- **Goal gradient.** The crown track is a visible next goal that shrinks.

**Enters / escalates**
- Every result screen from 1-1.
- Priority: new creature > event (a rush shape, twist, cameo, party) > new hazard > boss.
- The last level of a world shows a blurred postcard of the next world's first frame.
- Before a boss, her trophy glows in the silhouette.
- Replaces ROADMAP #1: one mystery instead of a three-item list, because a list gets read while a silhouette gets wondered about.

**What it breaks.** Nothing on the board. It gives every level a promise before it starts, so the banner lands on "*that's* what it was".

**Textless beat** (lesson `peek`, `whilePaused`, gesture `point`, bail-out 4 s): a hand pulses on
the napkin; tap it and the silhouette hops. Retires on the tap, or on bail-out.

**Build it** (S, about 1 day)
- **New pure module `src/game/headline.ts`:** `nextHeadline(level)` diffs `levelSpec(n+1)` against `levelSpec(n)`. It looks for a roster entry whose `debut === n+1`, a new hazard, or a boss, plus a row per feature table (rushes, twists, trophies, party). Unit-test all 40 levels; a debut level must never return null.
  - Every later feature registers one row here, so it gets announced.
- **`PeekCard.vue`:** a 96 px canvas. Draw with `paintBug`/`paintHazard`/`paintBoss`, then fill with `source-in` in `INK` (`inkArt.ts`). The napkin is drawn in canvas, with a CSS wobble that respects `calm`. The crown pips are `GameIcon`.
  - It replaces the visible `result.upNext` row; keep that text `sr-only`.
- **Art loading:** `warmNextLevelArt` already preloads the next level's art, so no runtime requests are added (Poki-safe).
- **i18n:** aria-label `result.peekNext`.

**Risks → mitigation**
- *Short landscape viewports (`resultCompact`).* The card drops to 64 px and sits beside the stars, never over the forward button.

**Success signal.** Forward press within 3 s on the result screen; continuation rate after a clear; tap rate on the card (a proxy for curiosity).

---

### 6. Shoebox Trials — wear the shoe before you can buy it

*Stomp open a shoebox on the floor, and your sneaker becomes a Locker shoe for twelve seconds.*

**The moment**
- *Age 7:* A box with a ribbon wobbles on the blanket. Three stomps and the lid flies off in a
  sparkle; her foot is a big brown boot. She stomps the spiky caterpillar she's been avoiding
  since 1-2: CRUNCH, no ouch. Twelve seconds later, pop, the sneaker is back, and the
  Locker button glows with the boot's picture.
- *Age 13:* 2-7 has two boxes on opposite sides: roller skates or the electric sock. Skates for
  the centipede line, sock for the swarm at the magnet. He picks a route. After three trials he
  knows exactly which 550-coin shoe to buy.

**Why it retains**
- **Sampling and the endowment effect.** Twelve seconds of owning something makes its loss felt and the purchase meaningful.
- **Variable reward** on the floor.
- **Agency** once boxes come in pairs.
- **The Locker becomes remembered feelings instead of a stat sheet.** This is progression that changes how you play, and it is not a skin.

**Enters / escalates**
- 1-7: the Steel Boot, the answer to the 1-2 caterpillar. It arrives five levels after the problem, which keeps the owner's "answer at least two levels later" rule.
- 2-7 onward: **pairs**, pick one, the other box goes *poof*.
- Boss phase 2 gets a box from 2-10.
- About one level in three after that.
- If the player owns every shoe, the box holds "gilded laces": a 6-second mini-Fever, so a box is never worthless.

**What it breaks.** A temporary verb swap:

| Shoe | What it lets you do |
|---|---|
| Steel Boot | walk on spikes, stun a ring of bugs |
| Bunny Slipper | sneak up on fleas |
| Roller Skate | press and drag to plough a line |
| Cleat | tap through armour |
| Electric Sock | kills arc to nearby bugs |

**Textless beat** (lesson `shoebox`)
1. The box's lid hops, inside a ring.
2. A hand taps it three times (or holds, if the slam is taught) and the lid cracks.
3. Sparkle, the shoe swaps, and a timer ring drains around it. Retires on the first box opened.

The first trial of each shoe adds a one-time `watch` beat on its perk, for example a ring on the nearest caterpillar.

**Build it** (S-M, about 1.5 days)
- **Data:**
  - `hazards.ts`: HazardId `'shoebox'` (`stompable`, size 5, new optional `HazardSpec.hp` = 3, where a slam counts 2 through `blowDamage`).
  - `stages.ts`: `LevelSpec.trial` (one `ShoeId` or a pair) and `trialAt: 0.35`.
  - Constant `TRIAL_MS = 12_000`.
- **Sim:** the box drops in when `trialAt` is reached. `stompHazards` gets a `shoebox` branch (the HP lives in `h.charge`). On open, `startTrial(id)` sets `baseShoe = shoe; shoe = shoeSpec(id)`, applied only in the `hover`/`recover` states. `stepFoot` ticks it down and restores the base shoe.
  - That is roughly 30 lines, because every rule reads the one module-level `shoe`: `stompRadius`, `blowPierce`, `resolveStomp`'s `spikeProof`, the `silent` check in `stepBugs`, `land()`'s slide, `arcLightning`. The renderer draws the painted sprite through `getShoe()`.
- **Art:** one shoebox slot on the props sheet, with a procedural `paintHazard` fallback. Trial shoes are already drawn.
- **HUD:** a thin draining ring around the shoe. After the trial, the Locker `FHudButton` gets `:attention` with that shoe's glyph.
- **Save and preload:** save `bc_trials_seen`; `warmNextLevelArt` must include the trial shoe's sprite.

**Risks → mitigation**
- *"A taste, then a paywall."* Shoes cost only coins and stars earned by play. Nothing pops up after a trial; the Locker button just glows. The Locker's existing rewarded unlock stays something the player has to go and look for.
- *Balance.* The `noSpike` star must stay earnable, so the boot doesn't count as immunity for the objective.

**Success signal.** Locker opened within two levels of a trial; purchase rate of trialled shoes;
share of players wearing a non-starter shoe by 2-1.

---

### 7. Bug Party — a chaos round you can't lose, after the lesson levels

*After 1-3, and once per world, the picnic basket tips and forty ants pour out. You get the
giant gilded boot for fifteen seconds, and nothing can go wrong.*

**The moment**
- *Age 7:* The basket at the edge shakes, the lid pops, and a river of ants pours out under
  spinning disco lights. Her shoe is gold and enormous, and every stomp pops five. She is shrieking. Coins everywhere.
- *Age 13:* It's a score attack. His best is 212 ants, and the card shows his count and his top chain against that best.

**Why it retains**
- **Macro tension/release.** Three learning levels, then pure release, like Nintendo's bonus stages or Candy Crush's "sugar crush".
- **The fantasy early.** The store tile's promise, delivered at about 2:00.
- **A guaranteed power moment** for players whose vial isn't full yet.
- **A memory worth retelling.**

**Enters / escalates**
- After 1-3, then after x-6 in every world.
- Themed parties: world 2 is a lawn-sprinkler party with beetles to bowl, world 3 a moth-lantern night, world 4 a beat party (On-Beat Stomps).
- A party is not a level: no stars, no fail, never a gate.

**What it breaks.** Scale and tempo. For older kids it is also a skill test with its own personal best.

**Textless beat** (lesson `party`, gesture `watch`)
1. A ring on the shaking basket.
2. The boot turns gold (the existing Fever look).
3. A hand taps the river of ants. Retires on the first kill.

**Build it** (M, about 2 days)
- **`stages.ts`:** `partySpec(world)` (quota 0, time 15, `maxAlive` 40, spawn 140 → 110 ms, roster `[ant]`) and `partyAfter(level)`.
- **Sim:**
  - `StartOptions.party` sets `fever.remainMs = 15_000` and **keeps** the player's vial.
  - Spawns come from a basket point via `spawnBug(id, x, y)`.
  - In `substep`, a clock timeout is a win when `level.party` is set.
- **Flow (`GameScene.vue`):** `onNext` → `startParty()`, which is `startLevel` without `progress.setLevel`, keeping the gameplay bracket open like `onNext` does.
  - The result is a compact card showing count against best.
  - Bank coins through `partyPayout(kills)`; no stars, no reveals.
  - **Never** an interstitial after a party.
- **Save:** `bc_party_best` map.
- **Optional:** a 1.2 s stinger push on the basket, using the existing stinger format in `cutscene.ts`.
- **Perf:** 40 bodies plus `drawFeverLights` plus decals. Measure p95 at 4× CPU throttle; drop to `maxAlive` 28 on the low tier.

**Risks → mitigation**
- *Reward fatigue.* At most one party every 3–6 levels.
- *Before the half-Queen.* After 1-3 is the last calm before 1-4's fight, which is the right place for it.
- *Portal lifecycle.* Keep `gameplayStart` open through the party, since it is gameplay.

**Success signal.** Next-level start rate after a party; median session length; spread of party kill counts.

---

### 8. Beetle Bowling — slam it over, flick it through the crowd

*A slam flips a beetle onto its back. Swipe the shoe through it and it spins across the floor
like a bowling ball, flattening everything in its path.*

**The moment**
- *Age 7:* She slams the beetle and it flips over, tiny legs wiggling in the air. She swipes her
  finger across it and it shoots off spinning, knocks down a whole line of ants (bowling-pin
  sound) and bonks off the edge. Now she *hunts* beetles.
- *Age 13:* On 2-7 he flips two beetles, waits for the magnet to drag a knot of armour into the
  centre, and flicks one through it: seven kills, ×20. It caroms off the wall into a
  caterpillar, which a bowled shell kills safely.

**Why it retains.** The most frustrating body in the game becomes ammunition. Measured: the
`average` player bounces off shells 26–56 times a level and loses 7 of 9 levels between 1-4 and 2-3.
- **A new verb with a direction.** Aiming.
- **Emergent physics.** Mastery of angles.
- **The hazards.ts rule applied to a bug.** "Opportunities before obstacles."

**Enters / escalates**
- 1-6, three levels after the beetle (1-3), on the crumb level, where the pile gathers a knot worth bowling into.
- World 2: the Beetle King's adds can be bowled, and a shell bowled into the King during his spin phase counts as a hit.
- World 4: robobugs become pinballs that ricochet three times.
- Throughout: a bowled shell is a second answer to the caterpillar.

**What it breaks.** The first combination *of verbs*: slam, then flick. The drag gains a direction and a purpose.

**Textless beat** (lesson `kick`, gesture `drag`)
1. A flipped beetle, legs wiggling, inside a ring.
2. A dotted track runs through the beetle toward the nearest group, and the hand swipes along it.
3. A ghost beetle spins down the track and ants pop.
4. Retires on the first kick. If it bails out, it re-arms on the next flip, up to three times.
   It is armed only from 1-6, so a beetle flipped earlier by a slam or by Heel Spin is simply tap-killable until then.

**Build it** (M, about 2–2.5 days)
- **`bugs.ts`:** `BugSpec.flips` (beetle; later `pinball` on the robobug). Constants: `FLIP_MS 2600`, `KICK_SPEED 42 u/s`, `PUCK_SPEED 95`, `PUCK_FRICTION 1.6/s`, 2 bounces.
- **Sim `Bug`:** new fields `flipped` (ms), `puck`, `bounces`.
  - **Flipping.** `hitBug`'s `hurt` branch: when `spec.flips && heavy`, set `flipped = stun = FLIP_MS`. A flipped body counts as armour 0, so one tap kills it, which un-jams the board for players who never flick.
  - **Kicking.** `stepFoot` in `hover`/`recover` (no press needed, so it works on touch as a finger flick and on a mouse as a cursor flick): a flipped body within `stompRadius() × 0.8 + size` gets kicked when `foot.speed > KICK_SPEED`. `kick(b)` sets the velocity along `foot.heading` and emits `kick`.
  - **The puck.** In `stepBugs` it moves with exponential friction, and `bounce()` counts its bounces. An overlap pass like `slideDamage` hits other bodies (pierce 2, `chainOk`). The puck splats itself when its speed drops below 12 or after its second bounce.
- **Clock fix while in there:** `slideDamage`'s re-hit guard uses `performance.now()`, wall-clock time inside a fixed-step sim. Use `elapsed` for both.
- **Renderer:** `drawBug` draws a flipped pose (rotated 180°, a belly ellipse in `accent`, fast legs), a spin while it's a puck, and a streak ring.
- **Audio:** `'kick'` (thwock), a `'roll'` rumble while the puck moves, and `'pins'` when one puck kills three or more.
- **Tests (`sim.test.ts`):** a slam flips; a tap kills a flipped beetle; a fast hover pass kicks; a puck kills along its line and ends.

**Risks → mitigation**
- *Accidental kicks while aiming.* Only flipped bodies can be kicked, and an accidental kick is still fun.
- *Low-end phones.* Three pucks at most, each an O(n) pass.

**Success signal.** Ricochets per level on 1-3 to 2-3 down by at least 50 %; fail rate on 1-6 to 2-3; kick adoption by 2-1 of at least 40 %.

---

### 9. Boss Trophies — every boss drops a move you keep

*Beat a boss and it drops a trophy: a new move for the rest of the game, which changes how every later level plays.*

**The moment**
- *Age 7:* The half-strength Queen bursts into confetti, and a shining sticker of a spinning shoe
  falls out. On the next level ants circle her shoe; the hand taps twice, quickly. WHOOSH, the
  shoe spins and flings them all away. *Her* trick.
- *Age 13:* After 2-10 he has Quake Slam: a full charge sends out a ring that flips every beetle.
  His 3-star route on 2-7 is now quake, then bowl. Peek shows the Matriarch holding the next trophy.

**Why it retains**
- **Ability-gated progression** (Metroid, Zelda's one item per dungeon): this changes *how* you play, never how you look.
- **Anticipation.** "What will the next boss drop?"
- **Old levels become new.** New moves send players back for stars.

**Enters / escalates**

| Boss | Level | Move | Built on |
|---|---|---|---|
| Half-strength Queen (parallel work) | 1-4 | **Heel Spin**: double-tap spin, radius ×2.4, flips beetles, 1.8 s cooldown | existing `heelPivot()` |
| Goliath Queen | 1-10 | **Skid**: press and drag slides on any floor | existing `slide` state in `land()` |
| Beetle King | 2-10 | **Quake Slam**: a full charge sends a travelling ring that stuns and flips | `stunMs`, Beetle Bowling's `flipped` |
| Matriarch | 3-10 | **Echo Stomp**: a slam stomps again 400 ms later on the same spot (catches fleas landing, moths dipping) | a delayed `resolveArea` |
| Roach Prime | 4-10 | unlocks Endless (ROADMAP #14) with every move | — |

**What it breaks.** Four new verbs, all on the existing input grammar: double-tap, press-drag, a full hold, and hold timing.

**Textless beat.** One practice formation opens the level after the unlock, using a Rush Lines shape the move answers:
- `spin` (new gesture `double`: two quick hand drops with a swirl): a ring of ants.
- `skid` (`drag` with a press ring): a line.
- `quake` (`hold` filled completely, ring expands): a beetle knot.
- `echo` (`hold` plus a ghost second stomp): flea landings.

Each retires on use. The trophy itself arrives as a new `RewardRevealModal` card.

**Build it** (M overall: spin and skid are S, quake and echo M, about 3 days staged per world)
- **`src/game/moves.ts`:** `MoveId`, `MOVES` (move → boss, lesson), `movesUnlocked()`.
- **Save and rewards:** `bc_moves`, written by `bankLevel` on a boss clear. `campaignRewards.ts` gets a `{ kind: 'move', move }` reward, inserted after `record` and before `stars`, so the scope still builds.
- **Sim:** `StartOptions.moves`.
  - **Spin.** `press()`'s double-tap branch calls `heelPivot()` only once `spin` is unlocked. That removes today's accidental weak pivots from 1-1 to 1-3, which nothing teaches anyway.
  - **Skid.** `land()`'s slide gate becomes `shoe.slide || onSlickFloor() || hasSkid`.
  - **Quake.** A slam at charge ≥ 0.95 grows a stun/flip ring at 60 u/s out to 40 u.
  - **Echo.** Store `echoAt` and a position, resolved in `substep`.
- **Order:** land Heel Spin with the parallel 1-4 boss. If that boss moves, the trophy moves with it.

**Risks → mitigation**
- *Too many moves.* Four, then stop.
- *Children who never double-tap.* Spin is never *required*: a ring rush is also escapable by tapping.

**Success signal.** Use rate of each move in the three levels after its unlock; star improvement on replays of earlier levels; retry rate on boss levels.

---

### 10. Uh-oh! Twists — one set-piece surprise in the middle of a level

*Halfway through, something happens to the board: the lemonade tips, the lights go out, the sprinkler comes on, the arcade surges.*

**The moment**
- *Age 7:* The lemonade glass at the edge wobbles… and tips! A yellow river slides across the
  board. Bugs get stuck in it, and her shoe *skids* when she presses and drags: a whole line of splats.
- *Age 13:* 3-4, Blackout. The attic bulb pops, and only a torch circle around his shoe is lit.
  Moths glow and eyes glint in the dark. When the lights snap back, every bug is frozen, blinking,
  for one second: a free eight-kill chain.

**Why it retains**
- **Surprise.** A prediction error, the brain's novelty reward.
- **The "turn" beat of *kishōtenketsu*** inside a level.
- **The picnic's running joke becomes play.** Things keep going wrong for the human.
- **No new rules to memorise.** Every twist bends a system the player already knows.

**Enters / escalates**

| Twist | Level | What happens | Reuses |
|---|---|---|---|
| Lemonade Spill | 1-9 | a slick lane: bugs slow down, press-drag skids | honey's `bugSpeed`, `onSlickFloor()` slide, `paintGlass` (cutsceneArt) |
| Sprinkler | 2-9 | water arcs herd the bugs into a line along the wet stripe | salt `panic` + a heading override |
| Blackout | 3-4 | 8 s lit only by a torch, glowing eyes; lights back on = 1 s freeze | the `dark`/`torch` grade pass in `cutsceneArt.ts` |
| Draft | 3-7 | wind drifts bodies and the landing point sideways | the conveyor's drift, applied to the whole board |
| Surge | 4-3 | belts reverse at double speed, then stop dead for 2 s | `CONVEYOR_SPEED`, `h.angle` |
| Glitch | 4-6 | robobugs freeze in a pixel glitch and drop their plates | robobug `armor` → 0 for 3 s |

Twists fill exactly the world 2–4 levels that currently have nothing new, and each level keeps its twist on replay (determinism).

**What it breaks.** For 6–10 seconds the board's rules change, which creates a new spatial problem each time.

**Textless beat.**
- **The tell is always the first beat.** 1.2 s: bodies move at 0.6× speed, a round pictogram (tipping glass, bulb, sprinkler) pulses top-centre, and a wordless sting plays.
- **Twists that add a gesture get a second beat.** Spill → `skid` (`drag` with a press ring along the lane); Blackout → a `watch` ring on the torch.
- Each twist retires as `twist-<id>` the first time it is played through.

**Build it** (M framework, about 2 days; about ½ day per twist)
- **`src/game/twists.ts`:** `TwistId`, `TwistSpec { at, tellMs, activeMs }`, and `LevelSpec.twist` via OVERRIDES.
- **Sim:** twist phase scalars, triggered on progress (or phase index on a boss). The tell scales body speed, not the clocks.
  - Effects are either a temporary `Hazard` (a new lane-shaped HazardId `'slick'`, laid out like `conveyor`) or board-wide modifiers (`driftX`, `freezeMs`).
  - Emit `twistTell`, `twistStart` and `twistEnd`.
- **Renderer:** a `getGrade()` reader feeds a torch pass lifted out of `cutsceneArt.ts`. Bake the torch mask once per size and `drawImage` it scaled, because a full radial gradient every frame is expensive on low-end phones.
- **Audio:** one sting per world; a low-pass on the music during Blackout.

**Risks → mitigation**
- *A twist punishing a struggling child.* Every twist carries a payoff window (the hazards.ts rule); the tell slows the board; `relief` still applies.
- *Fear in the dark.* Cute glowing eyes, a warm torch, 8 s at most.
- *Photosensitivity.* Nothing flashes faster than 3 Hz, and with `calm` on, Blackout becomes a 50 % dim with no flicker.

**Success signal.** Abandon rate between 50 % and 80 % level progress (should drop); completion of twist levels compared with neighbouring levels; replays for 3 stars.

---

### 11. Mower Pedal — the big machine fires when *you* say

*The mower, the ceiling fan and the floor buffer stop crossing on a timer. They wait at the edge
behind a pedal you stomp, so you fire them when the lane is full.*

**The moment**
- *Age 7:* A big red pedal sits at the edge of the lawn with a mower parked behind it. She
  stomps it: VROOOM, the mower zooms across and clippings (and bugs) fly. The pedal light fills back up like a little clock.
- *Age 13:* He herds bugs with salt and honey, waits for twelve bodies in the mower's column, and fires. All twelve count toward his chain. Firing into an empty lane wastes six seconds.

**Why it retains.** Agency. Measured: the timed sweeper takes 34 of 41 bodies on 2-4 and 93 of 109 on 4-8, the player presses about 15 times in a 25-second level, and `sweepKill` pays no score or chain. At the moment the machine plays and the player watches. A pedal turns it into setup → trigger → payoff (PvZ's cherry bomb, Angry Birds' timing).

**Enters / escalates**
- 2-5, the sweeper's existing debut. All 18 sweeper levels inherit it.
- World 3: the ceiling fan gets two pedals, one per lane.
- World 4: the pedal rides the conveyor.
- Optional world-1 variant: a Rolling Pin on 1-8. Stomp its handle and it rolls down one lane, the caterpillar counter the GDD names.

**What it breaks.** The game's first *when* decision: timing through patience.

**Textless beat** (lesson `pedal`)
1. A ring on the pedal.
2. A hand taps it.
3. An arrow flows along the lane while the mower crosses. Retires on the first fire.

**Build it** (S, about 1 day plus a scout pass)
- **`hazards.ts`:** the sweeper becomes `stompable`; `SWEEPER_REST_MS` is replaced by `PEDAL_RECHARGE_MS 6000`, plus `PEDAL_IDLE_AUTOFIRE_MS 14_000`.
- **Sim `stepHazards`:** `travel` only advances while firing. `h.charge` states: 0 = parked, > 0 = crossing, < 0 = recharging.
- **Sim `stompHazards`:** hit-tests the pedal at the parked end (`board.x0 + 6`, lane y).
- **Sim `sweepKill`:** route through `hitBug`'s kill branch with a `fromMachine` flag. Score ×1 plus juice, and `chainOk` only when the player fired it.
- **Safety net:** a pedal left idle for 14 s honks and fires once by itself, with no chain credit, so a level can never stall.
- **Balance:** re-scout quotas on 2-4 to 4-9. Expect weaker players' clear times to rise 20–30 %, so lower the quotas to match.

**Risks → mitigation**
- *Harder for children who leaned on the free mower.* Auto-fire plus the quota re-tune.
- *The pedal ends up under the HUD.* It is placed from the measured play rect.

**Success signal.** Presses per level on sweeper levels (should rise); share of kills by the machine (target 25–35 %); kills per fire (a skill curve).

---

### 12. Mystery Bumps — something is moving under the grass

*Some bugs arrive hidden under the floor covering: a lump creeping under the grass, a sheet or a pile of tickets. You only find out what it is by stomping it.*

**The moment**
- *Age 7:* A bump wriggles under the tall grass. She stomps it: BOING, out pops a dizzy ant with
  stars around its head. The next one is shiny, and a piñata fly pops out dropping coins.
- *Age 13:* He learns the tells: a fast small bump is a sprinter, a slow wide one a beetle. Reading motion becomes a skill, and golden-rimmed bumps are worth a detour.

**Why it retains.**
- **Variable reward on the core verb.** The slot-machine pull, but every outcome is good.
- **Curiosity** and whack-a-mole attention.
- **The GDD's "tall grass obscuring vision"**, made fun instead of annoying.

**Enters / escalates.** 2-1 gives world 2 a floor that *behaves* differently, not just
new scenery. World 3 uses dust sheets and world 4 ticket piles. World 1 stays uncovered so the
gingham stays readable for the youngest players.

**What it breaks.** Uncertainty about what something is: reveal first, then act.

**Textless beat** (lesson `bump`)
1. A ring on a wriggling bump.
2. A hand taps it.
3. A dizzy ant pops out. Retires on the first reveal.

**Build it** (S, about 1 day)
- **Sim:** `Bug.hidden` plus a payload. `spawnBug` hides a `level.bumpShare` fraction of spawns (0.25 on 2-1).
  - While hidden, a body does no dodging, no sprinting and **no spikes** (kid-safe discovery), at 0.8× speed.
  - `hitBug` on a hidden body reveals it (stun 600 ms, no damage, counts as a hit, chain safe) and emits `reveal`.
  - The payload uses the deterministic `rnd()`: 73 % roster, 12 % piñata, 10 % coin cluster, 5 % golden (a Shoebox Trial).
- **Renderer:** an early branch in `drawBug` draws a bump from `WORLDS[w].floor` base and shade, wobbled by `b.cycle`, with a rim light and a golden rim for golden payloads. No painting.
- **Audio:** a throttled `'rustle'` and a `'boing'` on reveal.

**Risks → mitigation**
- *A revealed caterpillar spiking a curious child.* It comes out stunned with the ALERT showing.
- *Contrast on busy floors.* Rim light plus shadow.

**Success signal.** Stomp rate on bumps against visible bugs; completion of 2-1; unchanged time in level.

---

### 13. Nests — close the holes

*The bugs are coming from somewhere. Anthills and burrows on the board keep spawning them until you stomp them shut.*

**The moment**
- *Age 7:* Ants keep pouring out of a dirt mound. Stomp, it cracks; stomp, stomp, it caves in
  with a puff, and no more ants come out of it. The board goes quiet for a moment, and there's a little coin fountain.
- *Age 13:* 2-2 has two nests. Closing both early calms the board, but that also means fewer bodies toward the quota.
  He leaves one open beside the honey as a steady feed into his trap.

**Why it retains.** Generators (Gauntlet, PvZ's gravestones) turn a reactive whack loop into a
plan. They add spatial priority, visible progress, and a moment of release when a nest collapses.

**Enters / escalates**
- 2-2: fills the slot the caterpillar's move to 1-2 left empty.
- 2-3: Picnic Heist carriers head *to* the nests.
- World 3: floor cracks spawn centipedes and Rush Lines.
- World 4: vents spawn robobugs and reopen after 20 s unless a slam seals them.

**What it breaks.** A target that isn't a bug, and whose destruction changes how the board flows.

**Textless beat** (lesson `nest`)
1. An arrow flows from the nest to an ant coming out of it.
2. A hand taps it (or holds, if the slam is taught).
3. The nest collapses in a puff. Retires on the first nest closed.

**Build it** (S-M, about 1.5 days)
- **`hazards.ts`:** `'nest'` (`stompable`, `hp` 4, size 6). **`stages.ts`:** `LevelSpec.nests`.
- **Sim `stepSpawns`:** 60 % of spawns come out of a live nest mouth (`spawnBug(id, h.x, h.y)`, heading outward) instead of `edgeSpawn`.
- **Sim `stompHazards` (nest branch):** HP drops by `blowDamage(heavy)`. On collapse: `h.charge = -1`, emit `nestDown`, set a 5 s `spawnQuietMs` (spawn interval ×1.8), 3 coins.
- **Art:** a procedural mound in `propArt.ts` using `paintPod`'s shading, with crack stages by HP.

**Risks → mitigation**
- *Slower quotas.* The quiet window is short, and `maxAlive` is untouched.

**Success signal.** Nest-close rate; 2-2 clear time against the baseline; replays.

---

### 14. Boss Cameo — the boss marches through your level before the fight

*Two levels before the fight, the boss parades across the board with her escort. Land one slam
on her crown and she starts the real fight without it.*

**The moment**
- *Age 7:* On 1-8 the music changes, the floor shakes, and the giant Queen walks across the top of
  the board, crown held high, guards around her. CLANG! The crown flies into a corner and the Queen
  runs off holding her head. On 1-10 she has a bandage where the crown was, and she's a bit slower.
- *Age 13:* The window lasts six seconds and two guards are in the way. A crown knock is worth two
  fewer phase-1 hits on 1-10, which makes the no-spike star a real possibility.

**Why it retains**
- **Rivalry.** A nemesis introduced before the fight.
- **Earned advantage.** An investment in a future outcome.
- **The owner's own rule, applied to bosses.** Problem and answer, two levels apart.
- **A spectacle in an ordinary level.**

**Enters / escalates**
- 1-8: the Queen parades.
- 2-8: the Beetle King bursts up through the lawn.
- 3-8: the Matriarch's tail sweeps a lane; hit the tip.
- 4-8: a Roach Prime scanner drone.
- Later cameos use the `charge` tell, so the knock becomes a counter-slam instead of a free hit.

**What it breaks.** One very valuable target, a short window, and bodies in the way.

**Textless beat** (lesson `cameo`)
1. The floor shakes, the silhouette enters, and a ring sits on the crown.
2. A hand holds over her path.
3. The crown pops off. Retires on the knock, or when she leaves. The fight happens either way.

**Build it** (M, about 2 days)
- **`bosses.ts`:** `PhaseScript` gets `'cameo'` (one traversal, `CAMEO_MS 6500`, escort adds, vulnerable only to a heavy blow, one hit ends it). **`stages.ts`:** `LevelSpec.cameo { boss, at }`.
- **Sim:**
  - `spawnCameo(id)` starts the boss at an edge.
  - `stepBoss` sets `boss = null` when she leaves, without calling `finish`.
  - `stepSpawns`' `if (boss) return` becomes `if (boss && !boss.cameo) return`.
  - The HUD's `bossShown` stays false during a cameo.
- **Save:** `bc_crowns`. On the boss level, `startLevel` pre-spends 2 phase-0 hits, and `paintBoss` draws a bandage.
- **Art:** the four `images/bosses/*.webp` stills the cutscenes already use, plus a crown prop.

**Risks → mitigation**
- *Scary.* A cameo cannot hurt anything, and the knock is optional.
- *Portrait layout.* The path runs across the top third, where bosses already patrol.

**Success signal.** First-attempt clear rate on boss levels, with and without the crown; continuation from x-8 to x-10.

---

### 15. Picnic Heist — they're carrying your lunch away

*Food sits on the board, and ants carry pieces of it toward the exits and nests. Stomp a carrier and its piece hops back to the plate.*

**The moment**
- *Age 7:* A strawberry, a cookie and half a sandwich sit on the grass. Ants trot off toward a hole
  with crumbs bobbing on their backs. She stomps a carrier and the crumb bounces home with a happy *boop*. She guards her cookie.
- *Age 13:* Three carriers leave in three directions at once. He takes the one nearest an exit first, then skids through the other two.

**Why it retains.**
- **Stakes and triage.** Tower-defence-lite: "which one first?".
- **Kind loss aversion.** Nothing is lost until a carrier actually exits, and every carrier can be stopped.
- **The cutscene's premise becomes play.**

**Enters / escalates**
- 2-3 (cutscene 02: "They have a *route*?"), with nests as the destinations when present.
- World 3: bugs carry things into cracks. World 4: they carry tokens into the machine.
- New objective `{ kind: 'saved', n }`.

**What it breaks.** A priority decision every few seconds, and a reason to cross the board.

**Textless beat** (lesson `heist`)
1. A ring on the plate as a carrier lifts a crumb.
2. An arrow flows along its route to the exit.
3. A hand taps the carrier and the crumb flies home. Retires on the first rescue.

**Build it** (M, about 2 days)
- **`stars.ts`:** objective `saved` (lose `n` or fewer). `RunTally.lost`; `progress01` shows full until the objective is broken, like `noSpike`.
- **Sim:**
  - `Bug.carry`, and HazardId `'food'`, which pulls ant and sprinter headings toward it like `crumbs`.
  - At the food: `carry = 1`, and the heading turns to the nearest exit or nest.
  - At the exit: `lost++`, emit `stolen`, `killSlot` with no squish.
  - A carrier killed on the way: emit `rescue` plus juice.
- **Art:** export `paintPlate(ctx, x, y, left)` from `cutsceneArt.ts`; its `left` dial is exactly how much food remains. The crumb on a carrier's back is drawn in `drawBug`.

**Risks → mitigation**
- *Anxiety for young children.* Theft never fails the level (the clear is still the quota); it only costs the optional star. Carriers move at 0.85× speed and glow.
- *Long walks in portrait.* Exits sit on the long sides only.

**Success signal.** Share of 2-3 players earning the `saved` star; replay rate; how spread out the stomp positions are.

---

### 16. Fizzy Bug — the bug that pops its neighbours

*A round, soda-coloured bug that bursts like a shaken can when squished, popping every soft bug around it and setting off other fizzies.*

**The moment**
- *Age 7:* A bubbly orange bug wobbles near a crowd of ants. She stomps it. FSSSHH-POP! Bubbles
  spray and eight ants pop. Another fizzy nearby goes off too. *Chain reaction!* Next time she waits for it to walk into the crowd.
- *Age 13:* He salts a panic line past three fizzies, then taps the first: a four-link cascade, ×20 in half a second.

**Why it retains.** Player-built chain reactions (Peggle, Boom Blast) are among the most reliable
"whoa" moments there are, with outcomes of variable size. The bug teaches patience (don't pop it yet), and
bubbles keep it gentle (Juice Style `bubble`).

**Enters / escalates.** 2-6. World 3: fizzies ride centipede segments. World 4: a robo-fizz
with a ticking fuse (tap it and it pops a second later, so you have to throw the timing).

**What it breaks.** The first target you should *not* kill right away: wait, then trigger.

**Textless beat** (lesson `fizz`)
1. A ring on the fizzy.
2. An arrow flows from it into the nearby crowd.
3. The hand taps when the crowd is close, and a burst preview plays.
4. Retires on the first fizzy that pops two or more others (bail-out 10 s).

**Build it** (M, about 2 days plus a painting)
- **`bugs.ts`:** `BugId 'fizzy'` and a new `BugSpec.bursts` field (radius 13 u). hp 1, speed 8, `wander`, score 30, juice 0.08, cost 3, debut 16.
- **Sim:** the kill path queues the burst into a fixed ring buffer (8 slots), staggered 120 ms so a cascade stays readable. A burst kills unarmoured, non-spiky bodies (the pivot's rule) with `chainOk`.
- **Art:** a painted walk strip via the art pipeline (`art-todo.md` P1), with a procedural fallback in `bugArt.ts` first. Bubble particles via `burst()`.
- **Audio:** a synthesized fizz sweep plus a pop, added to the parallel per-bug crush set.
- **i18n:** bug name `bugs.fizzy`.

**Risks → mitigation**
- *Cascade frame spikes.* The staggered queue plus a per-frame burst cap.

**Success signal.** Share of fizzies killed with two or more pops, rising across levels (players learning); multi-kill share in world 2.

---

### 17. Splat Stencils — paint the picture with goo

*A faint outline (a star, a heart, a sun) appears on the floor. Every bug squished inside it paints it in, and a finished picture comes alive.*

**The moment**
- *Age 7:* A big dotted star appears in the attic dust. Squishing bugs inside it fills it with
  pink goo. When it's full, the star sparkles, spins up off the floor and rains coins. She wants to paint the next one.
- *Age 13:* The heart sits beside the cobweb. He lures bodies through the web and stomps them
  inside the lines, then times the Fever so the gilded boot paints half the heart in one slam.

**Why it retains.**
- **A spatial goal on the same verb.** *Where* you stomp starts to matter.
- **Creative ownership.** The decal layer already keeps every splat, so the floor really is her painting.
- **Closure.** Completing a picture.
- **Appeals to children who don't care about score.**

**Enters / escalates.** 3-2 (dust in the attic). 3-9 shows two stencils at once, so you choose.
In world 4 a stencil rides the conveyor. The painted floor shows on the result card.

**What it breaks.** A positional objective: herd, wait, then stomp.

**Textless beat** (lesson `stencil`)
1. The outline draws itself inside a ring.
2. A hand taps a bug inside it, and a blob of fill appears.
3. An arrow traces around the outline. Retires once the fill reaches 20 %.

**Build it** (S-M, about 1.5 days)
- **`stages.ts`:** `LevelSpec.stencil { shape, at }`.
- **Measure fill in the sim, not in pixels.** Each shape is 24 precomputed cell centres. A squish within `stompRadius + cell radius` of a cell marks it, and fill = marked ÷ 24. That is deterministic, testable, and needs no `getImageData`.
- **Events:** `stencilProgress` and `stencilDone`, with coins, juice and a spin-up.
- **Renderer:** a dotted outline, and cells drawn as goo blobs in the last squished `goo` colour, so it works in every Juice Style palette.
- **Optional objective:** `{ kind: 'paint', n }`.

**Risks → mitigation**
- *Outline under the HUD.* Place it in the play rect's centre band.
- *Low-end phones.* One stencil only on the low tier.

**Success signal.** Stencil completion rate; replays of 3-2 for stars.

---

### 18. Fever Flavours — what you squished decides what your Fever does

*The vial fills with the colours of whatever you squished, and the colour on top when it's full chooses the Fever.*

**The moment**
- *Age 7:* The vial is swirly green from beetles, so this Fever makes her boot shake the ground
  on every stomp and bugs flip upside down. Last time it was pink bubblegum, and squished ants stuck to the next ones. Every Fever is a surprise.
- *Age 13:* He wants Gold Rush for coins, so he tops the vial off with a piñata's yellow right at the end.

**Why it retains.** Today every Fever across 40 levels is the same gilded boot. Flavours add
variable reward to the game's biggest payoff: light resource strategy for older players, zero
decisions required from younger ones, and the vial's colour makes it readable at a glance.

**Enters / escalates.** 2-4, by which point the player has met five or more goo colours.

| Flavour | Goo on top | What it does |
|---|---|---|
| Gilded | default | today's Fever |
| Bubblegum | ants and sprinters (pink/teal) | squished bugs glue neighbours: two for one |
| Quake | beetles (green) | every stomp is a small quake that flips armour (pairs with Beetle Bowling) |
| Pogo | fleas (blue) | each tap hops the foot to the nearest body |
| Gold Rush | piñata (yellow) | kills drop coins, capped |
| Moonlight | world 3 moths | every flier is forced to dip |
| Robo Laser | world 4, from 4-7 | a tap draws a beam line |

**What it breaks.** Each Fever plays differently.

**Textless beat.** The first time each flavour fires: a `watch` ring on the vial's colour swirl,
plus a 1.5 s ghost demo around the shoe. Retires per flavour when seen.

**Build it** (M, about 2 days)
- **`combo.ts`:** a pure `FeverFlavour` table plus `flavourOf(mix)`.
- **Sim:** a 16-entry ring buffer of (goo family, amount) covering the top 35 % of the vial. `tryFever` stamps the flavour.
  - Hooks: `hitBug` (bubblegum queues a small burst, reusing the Fizzy Bug queue; gold emits `coin`), `land()` (quake ring), `press()` (Pogo retargets through `nearestBug`, as Single-Tap Mode already does).
- **`JuiceVial.vue`:** a liquid gradient built from the mix, using `BUGS[].goo`.

**Risks → mitigation**
- *Randomness feels unfair.* Every flavour is strictly a power-up.
- *Pogo feels out of control on imprecise taps.* Pogo runs 8 s instead of 10.

**Success signal.** Fevers per level; how many different flavours each player sees; time from vial-full to activation.

---

### 19. Bug Buddies — rescue a friend, and it helps you

*A firefly trapped in a jar, a robo-snail tangled in wires. Free them and they follow your shoe for the rest of the level, then come back in later levels.*

**The moment**
- *Age 7:* A little firefly is stuck in a jar with three moths flapping around it. She squishes
  the moths and taps the jar lid. The firefly spirals out, does a loop around the shoe, and settles on the toe.
  Every few seconds it zips off to gobble a bug near her shoe, and in the dark it lights a bigger circle. She loves it.
- *Age 13:* He rescues the firefly early every level, because it widens the torch during Blackout and marks piñatas.

**Why it retains.**
- **Attachment and nurture.** Pets are among the strongest hooks for 6–10-year-olds (Nintendogs, Pikmin).
- **Tonal balance.** A kind act sits next to the stomping, which also appeals to parents and portal moderators.
- **A collection with a gameplay effect.**

**Enters / escalates**
- Firefly: 3-5 (it pairs with Blackout on 3-4).
- Robo-snail: 4-4 (it eats conveyor riders).
- Optional Ladybug later, for a world 1/2 refresh.
- After a rescue, the buddy shows up already free in one of every three later levels of its world.

**What it breaks.** A small protect-and-release goal, and a helper that changes the pace.

**Textless beat** (lesson `buddy`)
1. A ring on the jar; the hand reaches toward the buddy and recoils (gesture `avoid`, "not this one"). The buddy is unstompable anyway, and the shoe passes over it with a giggle.
2. The hand taps the guards.
3. The hand taps the lid, and the buddy flies free. Retires on the rescue.

**Build it** (L, about 4–5 days including art)
- **`src/game/buddies.ts`:** `BuddySpec { id, world, trap, helpMs 3000, reach, eats }`.
- **Sim:** a separate `buddy` struct, **not** in the `bugs` pool, so no stomp can ever hit it. States: `trapped` → `free` → `helping`. Guards come from `spawnBug`.
  - Helping: every `helpMs`, `hitBug` the nearest eligible body within `reach` of the foot (`chainOk`).
- **Save:** `bc_buddies`; `StartOptions.buddy`. Reveal: a new `CampaignReward` `{ kind: 'buddy' }`.
- **Art:** painted walk strips, which is the L-effort part. Ship the procedural fallbacks first.

**Risks → mitigation**
- *A child stomps the buddy.* Impossible by design.
- *The buddy plays the level.* One kill every 3 s, under 10 % of the quota. This is the Mower Pedal lesson, applied again.

**Success signal.** Rescue rate; return to the next session, buddy owners against non-owners; completion of buddy levels.

---

### 20. On-Beat Stomps — the ants march to the music

*The marching ants step in time with the soundtrack, the shadow pulses on the beat, and a stomp that lands on the beat splats bigger and plays the chain's next note in time.*

**The moment**
- *Age 7:* She notices the ants bob along with the song and starts stomping to the music. The
  splats sparkle and the chain notes sound like a tune. She doesn't know it's a mechanic; it just feels right.
- *Age 13:* On 4-2's dance floor the tiles flash on the beat. An on-beat chain keeps its window 20 % longer, and he plays the level like a rhythm game.

**Why it retains.** Moving in time with music is rewarding in itself (Just Dance, Crypt of the
NecroDancer). It adds a mastery layer with no penalty and ties the new ~90 s soundtrack to the
play. The chain is already a pentatonic melody (`useGameAudio.ts`); with a little quantising, the player is playing the tune.

**Enters / escalates**
- **Feel layer from launch.** Once the parallel soundtrack lands, ants' walk cycles and the shadow pulse lock to its BPM. No rule, no lesson.
- **Mechanic at 4-2**, the arcade world's `trance` track.
- Later: world 4 rushes arrive on the downbeat, and world 4's party is a beat party.

**What it breaks.** Timing becomes a second dimension of the same tap.

**Textless beat** (lesson `beat`)
1. On each of four beats, a ring shrinks onto the shadow.
2. A hand taps as the ring meets the shadow.
3. A sparkle splat. Retires after three on-beat stomps.

**Build it** (M, about 2 days)
- **Music table:** `MUSIC_TRACKS[id].bpm`, including the parallel soundtrack.
- **`useSound.ts`:** music is the `bgMusic` `HTMLAudioElement`, and its `currentTime` is media time, which already follows `setMusicRate`. Add `musicBeatPhase()` = `(bgMusic.currentTime × bpm / 60) % 1`, shifted by the shared AudioContext's `outputLatency` (plus `baseLatency`).
- **`GameScene.vue`:** call `game.setBeat(phase)` before `game.step`. With no beat set, the sim stays deterministic for tests and the recorder.
- **Sim `land()`:** within ±110 ms of the beat, radius ×1.1, `chain.windowMs += 300`, juice ×1.25, and emit `onBeat`. When a beat is known, `stepBugs` phase-locks the ants' `cycle` (visual only).
- **`useGameAudio.ts`:** quantise the `chainStep` note to the next 16th note when that is within 60 ms.
- **Muted music:** the bonus turns off, and the visual pulse keeps running from a silent clock.

**Risks → mitigation**
- *Bluetooth or Android audio latency (100–250 ms).* Latency compensation, a generous window, and never required for a star.
- *rAF jitter.* The phase comes from the audio clock, not frame time.

**Success signal.** Share of stomps on the beat above chance (chance = 220 ms ÷ beat length); session length in world 4.

---

## 4. Recommended build order

### Step 0 — instrument first (½ day, not a feature)

`useAnalytics.ts` already has a portal fan-out (Poki `customEvent`, GamePix, gtag), and nothing
calls it. Its vocabulary belongs to another game. Replace it with:
- `level_start { level, attempt, relief, secondWind }`
- `level_end { level, won, progress01, durationMs, presses, multiKillStomps, ricochets, spikes, bestMult, fevers }`
- `feature { id, level }`, for first rush, finisher (tap or slam), party end, trial opened, and so on
- a `pagehide` "furthest level + last screen" beacon into the local ring

Ship each arm behind a boot-frozen flag, using the pattern in `src/use/perfVariants.ts`, so a control arm and a
feature arm can be compared on one portal. Without step 0, none of the success signals above can be read.

### The first five (about 5.5 engineer-days)

| Order | Feature | Days | Why now | Depends on |
|---|---|---|---|---|
| 1 | **Rush Lines** | 1.5 | Fixes the measured core fault (1.0 kills per stomp, a shapeless level) right at the 0:25 cliff. It also becomes the formation engine: rings answer Heel Spin, cracks and vents launch rushes in worlds 3–4, and On-Beat rushes arrive on the downbeat. | Step 0; a new `rush` lesson row; 1-1 quota 8 → 11; re-scout |
| 2 | **Growth Spurt** | 0.5–1 | Doubles the Rush payoff and makes the chain visible on the board. Balance both in **one** scout pass. | Rush Lines (tuned together) |
| 3 | **Big Finish** | 1 | Puts a peak at the end of every level from 0:38 onward, and gives the slam a joyful use. | `onLevelEnd` must await it before `showMidgameAd` |
| 4 | **So Close!** | 1 | The parallel half-Queen on 1-4 creates the first real fail at about 2:40. Without this, that screen is a wall; ship it with the boss. | `RunTally.ricochets` |
| 5 | **Peek** | 1 | Anticipation on every result screen from 0:45. Its `headline.ts` is the registry every later feature adds a row to, so each one gets announced. | none |

**Why these five.** All of them land in the first 90 seconds or at the first wall; all are S or S-M;
none needs new painted art (the art pipeline is the bottleneck, with 19 of 100 slots painted); and they
make every later feature land harder: rushes carry trophies, finishers pay out trials, Peek sells twists.

### The next wave, in order

| Feature | Days | Depends on |
|---|---|---|
| Shoebox Trials | 1.5 | `HazardSpec.hp`, which Nests reuses |
| Bug Party | 2 | a perf check at 4× CPU throttle |
| Beetle Bowling | 2.5 | its `flipped` state feeds Heel Spin's flip and Quake Slam; fix the `elapsed` clock in `slideDamage` alongside it |
| Boss Trophies | 3 | Heel Spin ships with the parallel 1-4 boss; Quake needs Bowling |
| Uh-oh! Twists | 2 + ½ each | the framework, then Spill on 1-9 |

Then Cameo, Mower Pedal and Nests, which fill world 2's empty levels before a median player reaches them.

---

## 5. What NOT to do

- **No rewarded "continue", "revive" or "double coins" buttons on fail or result screens.** For children that
  is the textbook dark pattern, and the brief allows rewarded ads only inside a flow the player already wanted.
  The Second Wind is free, and the Locker's video unlock stays the only rewarded slot.
- **No daily Bug Hunt streak (ROADMAP #3).** A visible streak is FOMO aimed at kids and a daily hook
  in disguise; it breaks the owner's constraint. A date-seeded level with no streak and no badge row would be acceptable later.
- **No random board per attempt.** It breaks determinism ("3-7 is 3-7"), leaderboards and the
  scout measurements that set every quota. Variety has to be *authored*: rushes, twists and cameos keyed to progress.
- **No loot boxes or random shoe drops.** Shoebox contents are authored per level, and Peek can show them.
- **Don't answer boredom with more skins, goo colours or shoes in the shop.** Sidegrades behind a price don't change the first ten minutes.
- **Don't make difficulty the variety.** Faster bugs and bigger quotas change clear time, not the verb.
  The scout shows the curve already does this.
- **No text call-outs, speech bubbles or quest logs.** Pre-readers, 21 locales.
- **No swipe-to-draw gestures (lasso, slice).** They collide with drag-to-aim on touch. Every verb above
  uses the existing grammar: tap, double-tap, hold, drag, flick.
- **No second "don't stomp" enemy.** Every avoid lesson taxes a six-year-old's only verb. The caterpillar
  is enough, and buddies are unstompable by construction rather than by rule.
- **No helpers that play the level.** The timed mower is the cautionary tale; buddies are capped under 10 % of the quota.
- **No online modes, live events or limited-time content.** Poki forbids runtime requests, and time limits are FOMO.
- **No ads inside set pieces.** Nothing during a twist, cameo or party, and no interstitial after a party. Keep "ad before the
  result screen, never before level 3", and let the Big Finish play out before the ad.
- **No main menu, level-select map or hub.** Every screen between a tap and the board is a place to drop out.
- **No strobing blackouts, scary bosses or realistic squish.** The Juice Style promise holds for every feature above.
