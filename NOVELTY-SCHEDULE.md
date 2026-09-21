# Bug Crunch — the novelty schedule

*What new thing arrives at every point in the first fifteen minutes where a
player is about to think "I've seen it all" — and where, today, nothing does.*

Companion to `RETENTION-FEATURES.md` (which fixed the **density** of the loop)
and `ROADMAP.md` (which is mostly meta). This document is about **variety**: not
how good a minute of Bug Crunch is, but how different minute nine is from
minute four. Everything below is derived from `src/game/stages.ts` as it stands
in the working tree, not from memory — the level numbers, clocks, quotas, rush
shapes and hazard slices in the tables were dumped out of `levelSpec()`.

---

## 1. Diagnosis — the play test found two different games failing

The blind test produced two failure shapes and they are not the same problem.

**Shape one — the phone players, out at 33 s and 48 s.** An input bug, fixed in
parallel. Not this document. (The same test is already cited in `stages.ts`'s
own Bug Party block, which moved the first party from after 1-3 to after 1-2 so
the game's loudest promise lands inside the shortest patience it has to
survive. That move is in the tree; the tables below assume it.)

**Shape two — the players who could actually hit things, out at 104 s, 159 s and
184 s.** All three said a version of the same sentence:

> "I think I've seen everything it can do now."
> "this is the same picnic blanket again isn't it"
> "I've basically seen the moves now"

And all three rated **the Bug Party** and **the Queen Ant** 5/5.

That pairing is the whole diagnosis. They did not quit because the game was
boring; they quit because the two beats they loved are the only two beats that
**change the frame**, and between them the game repeats its frame nine times.

### The fault is not beat density — it is beat SAMENESS

World 1 puts something new on nine of its ten levels, and `stages.ts` spends
four hundred lines proving it. The novelty is real. The problem is that almost
every beat is the same **kind** of beat: *one more creature*, met on the same
board, under the same win condition, in the same shoe.

Eight things do not change once, anywhere in the first ten minutes:

| Invariant | Where it is set | First change |
|---|---|---|
| The floor | one cached tile per world, `floorTile(world)` in `floorArt.ts` | 10:00, world 2 — **but see the note below** |
| The light | `floorAmbient(world)` — one RGBA per world, `WORLDS[w].floor.ambient` | 10:00, world 2 |
| The board | always the full rect; bodies enter from a random edge (`edgeSpawn`) | never |
| The win condition | `squished >= quota` before the clock, on 8 of 10 levels | 2:45 and 8:30 (the two Queens) |
| The floor objects | `hazards: []` on 1-1 … 1-5 — **five bare floors** | 4:45, the crumb pile on 1-6 |
| The shoe | the sneaker, but for two 12-second loans (`TRIAL_MS`) | whenever the boot is affordable, ~1-6, and nothing marks it |
| The rush formation | `line`, `ring`, `vee` — three shapes, all of them ants nose to tail | never (world 2 swaps the body, not the shape) |
| The permanent verb set | Heel Spin at 1-4, Skid at 1-10 | **six minutes apart** |

"This is the same picnic blanket again isn't it" is a literally accurate
description of `floorArt.ts`. One 256 px gingham tile is drawn under levels 1-1
to 1-10 and both world-1 parties, under one ambient wash, with a vignette of
fixed strength. Ten levels, two parties, twelve minutes, one picture.

> **In flight — the forty floors.** `src/game/floors.ts` landed in the working
> tree while this was being written: forty `FloorId`s, a legibility-constrained
> `FLOOR_PALETTE` for each, `floorForLevel(level)`, and
> `tests/game/floorPalette.test.ts` holding the polarity, mark-contrast and
> bug-brown-distance rules. Its opening paragraph is this section's argument in
> the author's own words. **It is data only — nothing in `src/` imports it yet**
> (`floorArt.ts` still bakes `floorTile(world)` and the renderer still calls it
> at `useBugCrunchArt.ts:800`), so the *rendered* game is still one tile per
> world. When it is wired, the first invariant in the table above is answered
> and N1/N2 below should ride the same pass. Nothing else in this document
> overlaps it: `floors.ts` says so itself — *"the ambient wash and the vignette
> … are still per-world"*, and a new tile is still an empty rectangle.

### Where the three quits landed

The exact lane cannot be pinned without instrumentation the project has
deliberately dropped, but the bracket is tight and it is enough. At the
median-child pace `RETENTION-FEATURES.md` §2 uses, 104 s is 1-3 — and a player
at 1-3 has not met the Queen, which contradicts all three testers rating her
5/5. So all three were on the fast lane (the scout's `good` player clears
1-5…1-9 in 13–17 s, and the same blind test reached its first party at 36 s),
and on any fast lane 104 / 159 / 184 s falls **between the half-strength Queen
on 1-4 and the full Queen on 1-10**.

That is exactly the stretch this document is about, and it is exactly the
stretch where the frame never changes.

---

## 2. The minute-by-minute novelty timeline, first fifteen minutes

Clock positions are the median-child pace from `RETENTION-FEATURES.md` §2,
re-anchored for `PARTY_AFTER = [2, 6, …]` (the party now follows 1-2, so it
lands ~35 s earlier and 1-3 ~20 s later; everything from 1-4 on is unchanged,
because the party happens either way). Two rows are marked **(+)** — 1-7 and 1-9
otherwise fall between the requested clock positions and both carry proposals.

| Clock | Level | What the player meets **today** | **Proposed** | The "seen it all" risk it answers |
|---|---|---|---|---|
| **0:30** | 1-1 (55 s, quota 11) | the conga at `at: 0.27` — five ants carrying sandwich crumbs, three in one stomp; Growth Spurt on the chain; Big Finish | **N1** golden hour *starts* here: noon, short hard shadows, so 1-9 has somewhere to move to | none yet — this minute works |
| **1:00** | 1-2 (58 s, quota 12) | the caterpillar (the first "don't"); the **Steel Boot** box at 25 % of quota; the conga walks past the spikes | *nothing.* This is the densest minute in the game | none — adding here would be the wrong document |
| **1:30** | party #1 (15 s, 40 bodies) | the gilded boot, ants out of the stolen sandwich, no fail state | **CR-1** put the caterpillar in `PARTY_GUESTS[1]` — the boot crunches the one body 1-2 forbade (free: `resolveStomp` checks `fever` first) | the party is the payoff of the level before it, and today it does not know that |
| **2:00** | 1-3 (50 s, quota 12) | the beetle; the ricochet arms the `slam` lesson; a V with an armoured point; the flip | *nothing* | none |
| **3:00** | 1-4 (52 s, boss) | the Goliath Queen at `scale: 0.5` — summon / eggs / charge; the `pods` lesson; **Heel Spin** trophy | *nothing* | none — rated 5/5 |
| **4:00** | 1-5 (54 s, quota 21) | the sprinter; a `ring` rush that practises the Heel Spin; the slam Big Finish | **N2** the lemonade glass stands on the blanket (bodies path round it); **N1** the light moves one notch | the first level after the boss high, on the fifth consecutive bare floor |
| **5:00** | 1-6 (56 s, quota 22) | the crumb pile — the first floor object, at 4:45; the `kick` lesson (Beetle Bowling) | **N3** the `cross` rush (two congas meeting on the pile); **N11** a bolting sprinter drags a crumb trail ants follow; **N8** party #2 is a piñata storm, not party #1 again | "the conga is always one line of ants"; "the second party is the first party" |
| **6:00 (+)** | 1-7 (58 s, quota 26) | the piñata fly; **Uh-oh: the Spill** — the lemonade lane, the skid gesture | **N9** the bar only fills for piñatas — the first level whose *win condition* is different; **N10** a 1.4 s banner stinger: the colony gets the sandwich off the blanket | "the win condition is always the same"; the story stops between cutscene 01 and 02 |
| **7:00** | 1-8 (61 s, quota 30) | the flea; the **Roller Skate** box | **N6** make it a **pair** — Skate *or* Steel Boot, one table edit: the first choice in the game; **N12** a practice formation the first time a *bought* shoe is worn | "I've basically seen the moves now" — the stretch contains no decisions |
| **8:00 (+)** | 1-9 (63 s, quota 34) | honey, four levels after the flea it answers | **N4** **Uh-oh: the Gust** (bodies and the landing point drift; the payoff is fleas blown into the honey); **N7** a ring of five beetles a Heel Spin flips at once, then one drag bowls three | the longest quiet run in the game (see §3, gap 1) |
| **9:00** | 1-10 (66 s, boss) | cutscene "Seconds"; the Queen at full strength; **Skid** trophy | **N5** her eggs arrive by **carrier ant** instead of being laid at her feet — same fight, one rule changed | `scaleBoss`'s own comment: "1-4 is the same fight 1-10 is, in miniature". True, and that is the liability |
| **10:00** | 2-1 (58 s, quota 34) | a **new world**: backyard floor, the Skid practice line, a flea-vee-beetle rush | **Mystery Bumps** (`RETENTION` #12, parked) is already scheduled here and is the right thing | none — the world change carries this minute |
| **15:00** | 2-4 → 2-5 (62–64 s) | 2-4: the stink bug **and** the mower together. 2-5: the same two hazards in a different order — all `headline.ts` can name for it is a second generated `line` rush. 2-6 (≈16:20): nothing at all | **CR-3** pin `OVERRIDES[14].hazards = ['honey']` so the mower lands on 2-5 where its own comment says it does; then **Mower Pedal** (`RETENTION` #11, parked) | the only stretch in the first twenty levels that `headline.ts` itself runs out of things to announce for |

### The same table, as a rhythm

```
 0:00 ████ cutscene 01
 0:10 ████ 1-1   conga · growth · big finish        <- frame change: the game starts
 0:55 ████ 1-2   caterpillar · STEEL BOOT box
 1:40 ████ PARTY                                    <- FRAME CHANGE  (rated 5/5)
 2:05 ████ 1-3   beetle · slam · flip
 2:45 ████ 1-4   QUEEN (half) -> Heel Spin          <- FRAME CHANGE  (rated 5/5)
 3:50 ░░░░ 1-5   sprinter                           }
 4:45 ░░░░ 1-6   crumb pile · kick                  }
 5:35 ████ PARTY #2  (identical to party #1)        }  ~4.5 minutes in which
 5:55 ░░▓░ 1-7   pinata · SPILL twist               }  the floor, the light,
 6:50 ░░░░ 1-8   flea · skate box                   }  the board, the win
 7:45 ░░░░ 1-9   honey                              }  condition and the shoe
 8:30 ████ 1-10  QUEEN (full) -> Skid               <- FRAME CHANGE   are constant
 9:50 ████ cutscene 02 + world 2                    <- FRAME CHANGE
10:00 ░░░░ 2-1 … 2-3   salt · slipper box
13:50 ░░░░ 2-4   stink bug + mower (two debuts, one level)
15:05 ____ 2-5   a second `line` rush, and nothing else
16:20 ____ 2-6   nothing `headline.ts` can name
```

`████` = the frame changed. `░░░░` = a new body or object on the same frame.
`____` = nothing. Four full-width bars in the first three minutes; then one in
the next five.

---

## 3. The gaps, ranked

Ranked by how long the game goes without changing its frame, weighted by how
many players are still there to notice.

### Gap 1 — 1-7's tail to 1-10 · ≈ 6:10 → 8:30 median · the worst one

Two and a half minutes across three levels (the back half of 1-7, then 1-8 and
1-9) in which the player meets: a flea, a shoebox, and a honey puddle. All three
are *one more creature or object on the same blanket*, all three are answered
with the tap they have had since 1-1, and none of them changes the floor, the
light, the board, the clock shape or the win condition.

This is where two of the three quits landed, and it is the stretch immediately
before the boss the same players rated 5/5 — i.e. the game loses them **one
level short of its best content**, which is the same failure shape the party
move in `stages.ts` was made to fix one level earlier.

Compounding it: 1-9 is measured in `stages.ts` as the hardest board of the five
for a weak player *on purpose* ("it is the step before the full Queen"), so the
flattest stretch is also the most effortful one.

### Gap 2 — 1-5 to 1-6 · ≈ 3:50 → 5:35 median · the post-boss trough

The first two levels after the half-strength Queen. Both have a beat — the
`ring` practice formation on 1-5 and the `kick` lesson on 1-6 — but **both are
lessons about verbs the player already owns**, both retire in seconds, and
neither changes anything about the board. 1-5 is the *fifth consecutive level
with `hazards: []`*: five bare gingham rectangles in a row, at the exact moment
the game has just shown a player what a set piece feels like.

The first quit (104 s) is in this bracket on any plausible fast lane.

### Gap 3 — 2-4 to 2-6 · ≈ 13:50 → 16:30 median · the *provably* empty levels

`src/game/headline.ts` is a machine-checkable definition of "this level has
nothing new": `whatsNew(prev, next)` returns null and `nextHeadline` falls
through to the boss crown. Walking all forty levels, that fall-through fires
where the next level is **not** a boss on exactly four: **2-6, 3-3, 3-5 and
3-9**. 2-5 and 2-6 straddle the fifteen-minute mark:

- **2-5 debuts nothing that matters.** Its `OVERRIDES` entry says *"2-5: the
  mower. Free kills for anyone who can herd."* — but the generic hazard slice
  (`w.hazards.slice(0, 1 + floor(index / 4))`) already hands the sweeper over on
  **2-4**, because index 4 crosses the threshold. So the mower debuts a level
  early, on top of the stink bug, and 2-5 inherits the same hazard **set** in a
  different order. The only thing `headline.ts` can find to announce for it is
  `{ kind: 'rush', shape: 'line', bug: 'flea' }` — the second generated rush the
  curve hands every level from index 5, in the `line` shape the player has seen
  since 1-1 with the body swapped. That is the weakest row in the Peek priority
  list, and it is the curve talking, not a designer.
  It also breaks the rule the file states and keeps everywhere else —
  *"a hazard never debuts on the same level as a creature"* — on 2-4.
- **2-6 debuts nothing at all**, `headline.ts` says so, and it is carried
  entirely by the party after it.

A one-line fix (CR-3) recovers a whole level of novelty and restores the rule.
Note that it makes 2-4 harder by taking a free-kill machine off it; bot balance
past 2-1 is explicitly not a concern, so this is a design call, not a scout one.

### Gap 4 — structural: no new permanent verb between 3:40 and 9:40

`moves.ts` gives Heel Spin at 1-4 and Skid at 1-10 and then says, correctly,
*"Four, and then it stops."* Six minutes of median play sit between them. The
fix is not a fifth move — it is making the two they own combine into a third
thing (N7) and making a *bought* shoe announce itself (N12).

### Gap 5 — `headline.ts` promises novelty it cannot deliver

`whatsNew` diffs the next level against **the previous one only**, so a hazard
that vanished for a level and came back reads as new. Peek therefore promises
"honey!" before 2-8 and "the magnet!" before 4-5 and 4-8 — things the player met
ten and twenty levels earlier. It is a curiosity gap that closes on nothing,
which is worse than no promise. See CR-6.

---

## 4. What the existing docs already cover — do not re-invent these

Four of the things this brief asks for are already specified, and one of the
gaps above is already scheduled to be filled. **`RETENTION-FEATURES.md` #11–20
are parked until the next Player Fit Tests**, which is why every proposal in §5
is built to stand without them.

| The gap | Already specified as | Status | What I would change |
|---|---|---|---|
| Gap 1 (1-7 → 1-10) | **Boss Cameo** — `RETENTION` #14. The Queen parades through **1-8** with her escort; slam her crown and she starts 1-10 without it | parked, not built | Nothing. This is the single best-aimed answer to the worst gap in the game, and its level (1-8) was chosen for exactly this reason. If one parked feature gets un-parked, it is this one |
| Gap 1, secondary | **Fever Flavours** — `RETENTION` #18, entering 2-4 | parked | The entry level is now wrong. By 1-7 the player has met five goo colours and every Fever across ten levels is the same gilded boot; pull it to 1-6 |
| Gap 3 (2-4 → 2-6) | **Mystery Bumps** (#12, 2-1), **Nests** (#13, 2-2), **Mower Pedal** (#11, 2-5), **Fizzy Bug** (#16, 2-6) | parked | Nothing. `RETENTION` §4 already says these "fill world 2's empty levels"; §3's own diagnosis found the same hole this document found |
| "The board has no places" | `RETENTION` §1.4, answered by Nests / Picnic Heist / Splat Stencils | parked | N2 below is the **zero-simulation** version of the same insight and ships in a day, so the board stops being an empty rectangle without waiting for the fit tests |
| Themed parties | `RETENTION` #7: *"world 2 is a lawn-sprinkler party, world 3 a moth-lantern night"* | one party variant per **world** | N8 is the finer grain the first fifteen minutes actually needs: the two parties inside **world 1** are currently byte-identical |
| The moth's level | `RETENTION` §1.6 already spotted that `moth.debut = 21` contradicts the "3-3: the moth" comment in `stages.ts` | open | CR-4. One number; it moves a debut into a level `headline.ts` currently finds empty |
| "the same picnic blanket again" | **Forty floors** — `src/game/floors.ts`, one `FloorId` per level with a legibility-tested palette | **data landed, unwired** (no `src/` importer) | Wire it. It is the most direct answer to the loudest quote in the test, and until `floorArt.ts` reads `floorForLevel(level)` the player sees none of it. N1 (the light) and N2 (the props) are the two halves it explicitly leaves alone |
| A first-sighting beat per species | `ROADMAP` #17 — 0.4× slow-motion for 900 ms on a species' first frame | open, and `ROADMAP` itself says the wordless tutorial "is the answer to #17 in a more general form; #17's slow-motion beat is still worth doing on top of it" | Nothing. It is the cheapest way to make the debuts in Gap 1 *land*, and it is not a novelty beat — it is amplification of one |
| A fifth world (`ROADMAP` #13) | "the cheapest ten levels this game will ever add" | open | Out of scope. It is novelty at minute 40, not minute 4 |

Two things this document deliberately does **not** propose, because the project
has already ruled them out: instrumentation as a prerequisite
(`RETENTION` §4 Step 0 is dropped, so every success signal below is readable
from `pnpm scout`, an existing `RunTally` field, a unit test, or the next blind
test), and any bot-balance work past 2-1.

---

## 5. Twelve proposed novelty beats

Ordered by build order, not by size: the first four are under three hours each
and all four land inside Gap 1 and Gap 2.

Every entry obeys the three standing rules — front-loaded, taught by a wordless
beat, and no meta screen. Where a beat needs **no** new lesson, that is stated
and is the reason it is cheap: the curriculum in `tutorial.ts` already has a row
for most of what is recombined below.

---

### N6 · A pair of boxes on 1-8 — the first choice in the game

**What the player sees.** Two shoeboxes wobble on opposite sides of the blanket
instead of one. Open the roller skate and you plough a line for twelve seconds;
open the steel boot and you walk on the caterpillars. The other box goes *poof*.

**Where, and why.** 1-8, which already carries a Roller Skate box at `TRIAL_AT`.
The stretch the testers quit in contains no decisions at all — every level is
"do the thing you did last level, to a new body". A pair is not a new verb; it
is the first time the player's own choice changes the next twelve seconds.

**Risk it answers.** "I've basically seen the moves now."

**The wordless beat.** None needed. `shoebox`, `perkRollerSkate` and
`perkSteelBoot` are all live rows in `tutorial.ts`, and `RETENTION` §6 already
specifies pairs (they simply start at 2-7). The player has seen a box on 1-2.

**Implementation.** `OVERRIDES[8].trial = ['rollerSkate', 'steelBoot']` in
`stages.ts` — `LevelSpec.trial` is already `ShoeId | readonly [ShoeId, ShoeId]`,
`dropTrial()` already lays two boxes, and `trialFor(authored, taken)` already
swaps a shoe the player owns for one they do not, so a box is never a shrug.
Add the level to the pairs assertion in `tests/game/stages.test.ts`.

**Cost.** 30 minutes. This is the cheapest real beat in the document.

**How you would know.** The next blind test: does anyone say the word "or"?
Mechanically, `pnpm scout` on 1-8 must stay at its measured 214/240 for
`average` — the steel boot's halved agility is the risk, and `trialFor` may hand
it to a player who is already struggling.

---

### N7 · A ring of beetles on 1-9 — the first two-verb combination

**What the player sees.** Five beetles close on the shoe in a ring. A tap clangs
off every one of them. One double-tap — the Heel Spin she won from the Queen
five levels ago — flips **all five** onto their backs at once, legs waving. Then
one drag through them bowls three across the blanket.

**Where, and why.** 1-9. The player has owned the spin since 1-4 and has been
given exactly one reason to use it (1-5's practice ring, which retires on first
use). Nothing in world 1 ever asks for two moves in sequence. 1-9's own roll is
2 % beetle, so the rush is where the shells come from — the same trick 1-6 uses
to guarantee a beetle for the bowling lesson.

**Risk it answers.** Gap 4 — six minutes with no new permanent verb. The answer
is not a fifth move; it is showing that the two they have make a third thing.

**The wordless beat.** None needed, by construction. `RushSpec.practice` fires a
formation **only for a player who owns the move** and is already how the game
teaches spin, skid, quake and echo. `spin` and `kick` are both existing rows.

**Implementation.** One entry appended to `OVERRIDES[9].rushes` in `stages.ts`:
`{ at: 0.5, bug: 'beetle', count: 5, shape: 'ring', practice: 'spin' }`.
`layRushRing()` already seeds a 34 u circle closing on the foot at 0.6× speed;
`RUSH_MAX_SHARE` (0.4 of a 34 quota = 13) is not threatened.

**Cost.** 1 hour, plus a 2-hour scout pass — five armoured bodies at once on the
weakest player's hardest world-1 board is exactly the jam `stages.ts` spent two
passes measuring out of 1-3 and 1-5.

**How you would know.** `pnpm scout` on 1-9: `average` holds ≥ 200/240 (206
today) or the count drops to three. `RunTally.multiKills` on 1-9 rises;
`ricochets` does **not** (a rise means players are tapping the ring, not
spinning it).

---

### N8 · The second party is not the first party

**What the player sees.** Party #1, after 1-2, is a river of ants out of the
stolen sandwich. Party #2, after 1-6, is the same sandwich raining **piñata
flies** — a coin storm instead of a body count, with 1-6's crumb trail still on
the floor underneath.

**Where, and why.** After 1-6, in the middle of Gap 2. The party is one of the
two beats the testers rated 5/5, and the game currently spends it twice on the
identical fifteen seconds. Repeating your best moment verbatim is how a best
moment becomes a routine.

**Risk it answers.** "I think I've seen everything it can do now" — said
immediately after the game showed them the same thing it showed them at 1:40.

**The wordless beat.** None needed. `party` retires on the first kill and never
returns, correctly: a piñata is a creature met on 1-7… which is *after* 1-6. So
party #2 is also a **piñata cameo** one level before its debut — a free Peek for
the level after next, and it costs the debut nothing because a body in a party
cannot hurt anyone.

**Implementation.** `PARTY_GUESTS` in `stages.ts` is
`Record<WorldId, readonly RosterEntry[]>`; key it by the level the party
**follows** instead, `Record<number, …>`, falling back to the world's list.
`partySpec(level)` already takes the level, so nothing downstream changes.
**Watch the coins:** `partyPayout(kills)` caps at 40, but `BugSpec.coins` (6 per
piñata) is paid through the kill path and is *not* inside that cap — weight the
flies to a third of the roll and pin the ceiling in `tests/game/stages.test.ts`.

**Cost.** 2 hours including the coin check.

**How you would know.** The spread of `bc_party_best` for party #2 against party
#1 (they should not be the same distribution); the next blind test's reaction to
the second party being an *event* rather than a rerun.

---

### N5 · The Queen comes back, and the colony carries her eggs

**What the player sees.** On 1-4 she squats at the end of a spent charge and
lays an egg at her own feet — the tell for her widest window. On 1-10 she does
**not**. Carrier ants walk in from the edge of the board with eggs held over
their heads, set them down away from her, and walk off. Stomp a carrier on the
way and the egg pops with it: two rungs for one stomp.

**Where, and why.** 1-10, the level that ends Gap 1, guarded by the boss the
testers rated 5/5. `scaleBoss`'s own doc comment is the problem statement:
*"the three phases and their scripts are NEVER touched, so 1-4 is the same fight
1-10 is, in miniature."* That is exactly right as pedagogy and exactly wrong as
a finale. One rule changed makes the second Queen a different fight without
touching a phase, a script or an armour value.

**Risk it answers.** "the same picnic blanket again" — applied to the boss. The
job moves off her body and onto the floor, so the player cannot stand under her
and win.

**The wordless beat.** None needed. The `pods` row exists and is armed by the
first egg **on the floor**; `bosses.ts` already documents the carrier and
already runs it for the Beetle King and the Matriarch. Change the arming
condition in `armBodyLessons` (`src/views/GameScene.vue:1533`) to the first
carrier on a `haul` fight, so the hand points at the ant rather than at the
ground where the egg will be.

**Implementation.** `BossFight` in `stages.ts` gains
`delivery?: EggDelivery`; `BOSS_FIGHTS[10]` becomes
`{ boss: 'queenAnt', scale: 1, delivery: 'haul' }`. `bossSpec(id, scale)` in
`bosses.ts:528` takes the override and applies it over `spec.delivery` before
memoising (the key gains the delivery so the two Queens cannot share a cached
spec). The carrier path — `CARRIER_WALK_MS`, the walk-in, the set-down, the
pop-with-the-carrier — is already written and already tested.

**Cost.** 3 hours plus a scout pass on 1-10 (`average` is 8/10 with the brood
today).

**How you would know.** 1-10 → 2-1 continuation, and the ×8 chain star's reach
rate: a carrier is two pops for one stomp, so the star should get *easier* while
the fight gets less familiar. `tests/game/bosses.test.ts` pins that a scaled
Queen and a delivery-overridden Queen are distinct objects.

---

### N1 · Golden hour — world 1's light moves across its ten levels

**What the player sees.** 1-1 is noon: flat white light, short hard shadows on
the gingham. By 1-5 the wash has warmed. By 1-9 the shadows are long and amber
and the vignette has closed in. The full Queen is fought at dusk.

**Where, and why.** It starts on 1-1 and the *visible* turn is 1-5 onward,
because that is where "the same picnic blanket again" gets said. It is the only
proposal here that changes something on every level of Gap 1 and Gap 2 at once.

**Risk it answers.** The literal quote — the half of it the forty floors do not
cover. `floors.ts` changes the **surface** per level and states outright that
*"the ambient wash and the vignette … are still per-world"*. Ten different
tables and lawns lit by the identical noon wash still read as one afternoon that
never moves; the hour is what says *time is passing*, and it is the cheaper
half. Build it in the same pass that wires `floorForLevel`.

**The wordless beat.** **None, and deliberately none.** The standing rule is
that every new *mechanic* gets a textless beat; this is scenery and changes no
rule, so pointing at it would be the same mistake the chest's retired lesson
was. If a player never notices the sun moving, it has still done its job.

**Implementation.** `WorldSpec.floor` gains `ambientEnd` beside `ambient`, and
`floorAmbient(world)` in `floorArt.ts:309` becomes `floorAmbient(world, index)`,
lerping the two along the world's own `ease(index)` — the same curve every other
dial in `stages.ts` rides, and the same curve `floorForLevel` indexes into.
`VIGNETTE_STRENGTH[world]` becomes `vignetteStrength(world, index)`. One call
site each, both in `useBugCrunchArt.ts:967–972`, inside the pass that already
paints the ambient and the vignette. **No cached tile is touched** — not the
four today nor the forty when they wire — so `scoped-art-invalidation`'s
contract holds and nothing re-bakes.

**Watch the legibility test.** `floorPalette.test.ts` judges each floor's
contrast against `BUG_INK` on the *unwashed* palette. A warm wash multiplies
over every one of a world's ten floors, so either the ambient stays inside an
alpha the test's `LUMA_BAND` margins already tolerate, or the test learns to
composite it. Pick the alpha first, then the colours.

**Cost.** 3 hours, including choosing four pairs of colours.

**How you would know.** Screenshots of 1-1 and 1-9 side by side — if they are
not obviously different pictures, the end colours are too timid. Frame time is
unchanged by construction (the `fillRect` already runs every frame). Watch that
`Juice Style`'s `bubble` palette still reads against the warmest wash.

---

### N2 · The picnic gets used — props on the board

**What the player sees.** From 1-5 the blanket has things on it. The lemonade
glass stands upright near one edge; on 1-6 a paperback lies face-down going soft
in the sun; on 1-7 a plate with a crust left on it. Bodies walk **around** them,
so the lanes bend. On 1-7 the glass that has been standing for three levels is
the one that tips.

**Where, and why.** 1-5, the fifth bare floor in a row and the first level of
Gap 2. The glass must stand for three levels before the Spill twist knocks it
over — today that twist tips a glass the board never had, which is a payoff with
no setup.

**Risk it answers.** `RETENTION` §1.4's "the board has no places" — in the
version that needs no simulation work. This is the other half the forty floors
do not cover: a new tile is still an **empty rectangle**. Ten different surfaces
with nothing standing on any of them is ten empty rectangles, and the thing that
makes a board a place is an object you have to go around.

**The wordless beat.** None in phase one. A prop that only occupies space
teaches itself: nothing walks through a lemonade glass. *If* a later pass makes
a prop stompable (a tap on the plate ringing like the salt shaker) that is a new
verb and gets a row like everything else.

**Implementation.** `LevelSpec.dressing?: readonly ('glass'|'plate'|'book')[]`
in `stages.ts`, laid in `layoutHazards()` (`useBugCrunchGame.ts:1039`) as
zero-effect `Hazard`s with a `solid` flag that `stepBugs()` steering reads.
Drawn in `useBugCrunchArt.ts` beside the party's sandwich (~line 838) with
`paintPicnicProp` — which `cutsceneArt.ts:357` already exports **for the game
board**, with a painting-first path, so no new art and no new preload tier.
`drawSpillGlass` (`useBugCrunchArt.ts:1467`) hides the standing glass when the
twist fires. Keep props off `SPAWN_MARGIN` and cap total prop area, or a level
jams.

**Cost.** 6 hours.

**How you would know.** `pnpm scout` on 1-5 … 1-7 inside noise of 205 / 234 /
219 of 240 — a prop that costs a weak player a clear is a prop in the wrong
place. Visually: a stranger shown 1-5 and 1-8 should not call them the same
level.

---

### N3 · The cross — a fourth rush shape

**What the player sees.** Two snare rolls instead of one. Two sugar trails draw
themselves across the blanket and **cross**, over the crumb pile. Two congas
arrive from different edges and interleave at the middle. One stomp on the
crossing takes from both lines.

**Where, and why.** 1-6, the crumb level. The pile already gathers a knot and
already marks the middle of the board, so the crossing point is signposted by a
thing the level was going to have anyway.

**Risk it answers.** The rush is the game's signature moment and it has had
three shapes since 1-1, all of them ants nose to tail. A player at 5:00 has seen
`line` six times.

**The wordless beat.** The existing `rush` row, unchanged — `retries: 2`, armed
on `rushTell`. The hand simply hovers over the **crossing** instead of the
middle of one lane. That it needs no new `LessonId` is the point: the game
already taught "drop the shoe where the most of them will be".

**Implementation.** `RushShape` in `stages.ts` gains `'cross'`. In the sim:
`layRushLane()` (`useBugCrunchGame.ts:1279`) lays a second lane at roughly a
right angle through the first lane's midpoint; `launchRush()` (1391) splits
`count` across the two with a half-`RUSH_GAP` offset on the second so the bodies
interleave rather than collide at the join; `getRush()` / `RushView` (806)
returns both lanes and `drawRushTrail` draws both. `RUSH_MAX_SHARE` and the
`RUSH_LULL_MS` director pause are untouched.

**Cost.** 6 hours.

**How you would know.** `RunTally.multiKills` on 1-6 rises against the 1.5–6
multi-kill stomps a level `RETENTION` §0 measured. `pnpm scout` on 1-6 holds
234/240. A `stages.test.ts` case that a `cross` rush never exceeds
`RUSH_MAX_SHARE` across **both** lanes, not each.

---

### N4 · Uh-oh: the Gust — a second twist for world 1

**What the player sees.** The board slows, a pictogram of a lifting napkin
pulses top-centre, a sting plays — then a breeze crosses the blanket. Bodies and
the shoe's landing point drift sideways for seven seconds. The payoff: the
crumb pile streams downwind into a line, and the fleas that were impossible to
land on get blown into the honey.

**Where, and why.** 1-9. It is 63 seconds long, it has a single debut (honey,
four levels after the problem it answers), it has no set piece at all, and it is
the last board before the full Queen — the exact place a player decides whether
there is anything left to see. World 1 gets **one** twist in ten levels today;
worlds 3 and 4 get two each.

**Risk it answers.** Gap 1, directly. The Spill on 1-7 is the only time in ten
minutes the rules of the board change mid-level, and it is 9 seconds long.

**The wordless beat.** A new `twistGust` row in `tutorial.ts`
(`watch`, `soft`, `bailoutMs: 5_000`, `holdMs: 2_200`), mirroring `twistDraft`,
plus the universal 1.2 s tell every twist already runs (`tellSpeed: 0.6`, the
pictogram, the sting). Add it to the "teaches every mechanic" list in
`tests/game/tutorial.test.ts`.

**Why not just reuse `draft`.** Because `TWIST_LEVELS[27] = 'draft'` is 3-7's
only new thing, and a twist id is taught once — moving it to world 1 would leave
3-7 empty and `headline.ts` would say so. A separate id that reuses `DRAFT_PUSH`
and the same board-wide `driftX` costs an hour more and takes nothing away.

**Implementation.** `TwistId` in `twists.ts` gains `'gust'` with
`{ tellMs: 1200, activeMs: 7000, tellSpeed: 0.6, afterMs: 0 }`;
`TWIST_LEVELS[9] = 'gust'` in `stages.ts`. The sim branch is the draft's
`driftX`; the payoff is rotating the `crumbs` heading-pull vector with the wind
for the duration, which is one multiply in `stepBugs`.

**Cost.** 4 hours. `RETENTION` §10 prices a twist at half a day against a
framework that is built.

**How you would know.** `pnpm scout` on 1-9: `average` must not fall below 200
of 240 — a twist that costs a weak player the hardest board in world 1 is a
twist in the wrong place, and the tell already slows the board for it.
`twistGust` taught-rate in `bc_taught`.

---

### N12 · A bought shoe announces itself

**What the player sees.** She saves up, buys the Steel Boot in the Locker, and
starts the next level. It opens on a slow line of caterpillars walking straight
at her — the one body the game has spent five levels telling her not to touch —
and the boot goes through all of them.

**Where, and why.** Wherever the purchase happens, which `RETENTION` §1.5 puts
at around 1-6: **inside Gap 2**. The single biggest change of feel available in
the first ten minutes is a thing the player buys with her own money, and the
board reacts to it with nothing at all. Meanwhile a boss trophy — a smaller
change — gets a whole practice formation.

**Risk it answers.** "I've basically seen the moves now", from a player who may
be wearing a shoe the game never showed her how to use.

**The wordless beat.** The `perk<Shoe>` rows already exist — one per shoe,
one-shot, written for the twelve-second trials. Fire the same row on the first
**owned** wear. A player who already saw it in a box keeps it retired, which is
correct.

**Implementation.** Do **not** put this in `levelSpec`: that function is
documented and tested as a pure function of `n`, and the board a player sees on
3-7 must be the board anybody sees on 3-7. Instead, a small
`SHOE_PRACTICE: Record<ShoeId, RushSpec>` table in `stages.ts` (exported data,
not wired into the generator), and `GameScene.vue` prepends the entry via
`StartOptions` when `bc_shoe` is not in a new `bc_shoe_debuted` set — the same
seam `startLevel` already uses for `secondWind` and `relief`.

**Cost.** 5 hours.

**How you would know.** Continuation into the level *after* a purchase; the
`perk<Shoe>` taught-rate for buyers against trial-ers. Guard in
`tests/game/stages.test.ts` that `levelSpec(n)` is unchanged by any of this.

---

### N9 · The fly hunt — the first level whose win condition is different

**What the player sees.** The bar at the top of 1-7 stops filling for ants. It
fills for **piñata flies**. The ants are still there, and they are still worth
squishing — they are what keeps the chain alive while she chases.

**Where, and why.** 1-7. It is the only level in world 1 whose debutant is a
**target** rather than a threat, its own `OVERRIDES` note calls it "the first
level where chasing is the RIGHT answer", and it currently asks nothing of the
player that 1-6 did not. The win condition is the largest invariant in the game
after the floor: 8 of the first 10 levels, and 35 of the 40, are
"squish N before the clock" — the other five are `BOSS_FIGHTS`.

**Risk it answers.** "everything it can do" — where "it" means the *shape of a
level*, not the cast.

**The wordless beat.** A new `goalKind` row, built from the existing `goal`
gesture (`flow`, an arrow from a squished body to the bar). Fired once on 1-7:
a squished piñata throws the arrow, a squished ant throws nothing. "That → this,
and only that", in two seconds, wordlessly. A separate row rather than re-arming
`goal`, so 1-1's retirement is untouched.

**Implementation.** `LevelSpec.quotaKind?: BugId` in `stages.ts`; `hitBug`
(`useBugCrunchGame.ts:2151`) increments `squished` only when
`!level.quotaKind || spec.id === level.quotaKind`. `hasFinish` (2289),
`noteQuotaStep` (2292), the rush triggers and `progress01({kind:'clear'})` all
read `squished`/`quota` and need no change, so the Big Finish, the rushes and
the star rail come free. The quota must fall hard — 26 becomes ~8 at a 10 %
piñata roll and a 5-hit body — and the `{ kind: 'pinatafly', n: 2 }` star has to
be re-cut, since it becomes the clear.

**Cost.** 8 hours including the balance pass. The most expensive item here and
the one that buys the most structural variety.

**How you would know.** `pnpm scout` on 1-7 holds `average` near 219/240 and
`good` at 240/240 — the failure mode is a board with no flies on it, so the
director needs a floor on piñata spawns. Then: does the next blind test describe
1-7 as a different level, or as 1-6 with fewer targets?

---

### N11 · A bolting sprinter draws a new trail

**What the player sees.** A sprinter spots the shoe and bolts — straight away
from the foot, the way it always has. This time its run crosses the crumb pile,
and it drags a streak of crumbs behind it. Ants turn and follow the new line.
She scared a bug into drawing her a conga.

**Where, and why.** 1-6, where crumbs debut at 31 % sprinters. It is the level
`stages.ts` calls "the level that answers them", and it is in Gap 2.

**Risk it answers.** "everything it can do" — from a player who has met six
species that have never once interacted with each other. This is the cheapest
emergence the existing cast can produce: two systems the player already knows
(the sprinter's predictable bolt, the crumb pile's pull) producing a third thing
neither was authored for.

**The wordless beat.** A new `trail` row, gesture `flow` — the arrow this game
already owns for "this causes that" — run once from the bolting sprinter,
through the pile, to the first ant that turns. Nothing to perform; `holdMs`
like `goal` and `grow`.

**Implementation.** In `stepBugs` (`useBugCrunchGame.ts:2725`): a body with
`sprints` whose bolt overlaps a `crumbs` hazard sets `trailMs` and drops trail
points; while a trail is live, `crumbs`' existing heading-pull re-targets
`march` bodies onto the newest point instead of the pile's centre. **The
renderer is already written** — `drawRushTrail` draws exactly this dotted sugar
line for Rush Lines, so the visual is a call, not a feature.

**Cost.** 8 hours.

**How you would know.** `RunTally.multiKills` on 1-6; a new scout policy that
deliberately baits a sprinter across the pile should beat one that does not, or
the pull is too weak to matter. `pnpm scout` on 1-6 holds 234/240 for `average`,
who will never do this on purpose.

---

### N10 · A banner stinger — the colony gets the sandwich onto the grass

**What the player sees.** Before 1-7, on the level banner rather than over the
board: 1.4 seconds of ants hoisting the sandwich off the edge of the blanket and
into the grass, cheering. No skip needed; it is shorter than the banner it rides.

**Where, and why.** 1-7, the middle of Gap 1. `cutscenes.md` states the problem
itself — *"Nothing punctuates the middle. A cutscene every ten levels is the
cheapest pacing tool there is"* — and then schedules one every ten levels, which
is 8+ minutes apart at the exact point the funnel is losing people. This is the
bridge between cutscene 01 ("The Crumb") and cutscene 02 ("The Trail"),
delivered at six minutes instead of ten.

**Risk it answers.** The story stops for the whole of Gap 1, and the story is
what makes a blanket a place rather than a texture.

**The wordless beat.** None — it *is* one. It is the same format as the four
boss stingers (`cutscene.ts`, 2 s each), which nothing teaches either.

**Implementation.** One stinger entry in `cutscene.ts` keyed to level 7, played
by `LevelBanner.vue`'s existing hold. Art is `paintPicnicProp(ctx, 'sandwich')`
plus the ant walk strip — both painted, both preloaded.

**Cost.** 3 hours.

**How you would know.** The banner's total on-screen time must not grow: if the
stinger extends the gap between a tap and the board, it has cost more than it
bought. Check `LEVEL_END_STING_MS`-style timing against the banner and, on a
low-end pass, that nothing new decodes at banner time.

---

## 6. Cheap recombination — novelty that is already paid for

The cast is much bigger than the first fifteen minutes uses. Ten species, nine
hazards, six shoes, six twists, four moves and four bosses, and a median player
who quits at three minutes has met four species, one floor object, one shoe, one
twist, one move and one boss. Everything below is a table edit or a table edit
plus a scout pass.

| # | The recombination | Cost | Why it is free |
|---|---|---|---|
| **CR-1** | **A caterpillar at the party.** Add `{ id: 'caterpillar', weight: 15 }` to world 1's `PARTY_GUESTS`. The gilded boot crunches the one body the game spent 1-2 forbidding — no ouch, no chain break | 15 min | `resolveStomp` checks `i.fever` **first and returns `'splat'`**, before the spike branch. The payoff is already implemented; nobody has ever put a caterpillar where a player could feel it |
| **CR-2** | **A `vee` with a caterpillar at the point.** `{ shape: 'vee', lead: 'caterpillar' }` on 1-9 — a formation whose point you must *not* stomp, and whose tail you must | 30 min + scout | `RushSpec.lead` already accepts any `BugId`; `rushBody()` only constrains the *body* of a generated rush, not an authored one |
| **CR-3** | **Give 2-5 its mower back.** `OVERRIDES[14].hazards = ['honey']` so the sweeper debuts on 2-5 as its own comment says, instead of arriving a level early on the hazard slice alongside the stink bug | 15 min | Turns 2-5 from "a second generated `line` rush" into a real debut, *and* restores the file's own rule that a hazard never debuts with a creature. Takes a free-kill machine off 2-4 — a design call, since bot balance past 2-1 is not a concern |
| **CR-4** | **Move the moth to its level.** `moth.debut` 21 → 23, which is what the "3-3: the moth" comment in `stages.ts` already claims | 5 min | Flagged in `RETENTION` §1.6 and never actioned. 3-3 is one of the four levels `headline.ts` currently finds nothing to say about; this makes it a debut |
| **CR-5** | **The Roller Skate for a whole level.** `LevelSpec.trialMs?` overriding `TRIAL_MS`, with 1-8's box dropped at `trialAt: 0.05` — "the skate level" rather than twelve seconds of one | 2 h + scout | `startTrial` / `endTrial` already swap the module-level `shoe` and every rule reads it. Only the clock is hard-coded. **Risk:** every measured star on 1-8 was scouted in the sneaker |
| **CR-6** | **Make Peek honest.** `whatsNew` in `headline.ts` diffs against the previous level only, so honey reads as new before 2-8 and the magnet before 4-5 and 4-8. Diff against the union of every earlier level instead | 1 h | ~10 lines and one case in `tests/game/headline.test.ts`. Today the curiosity gap closes on a thing the player met ten levels ago, which is worse than promising nothing |
| **CR-7** | **The Queen's second phase gets a box.** `RETENTION` §6 already specifies "boss phase 2 gets a box from 2-10" — pull it to **1-10**, the Steel Boot, during the egg phase | 1 h | `dropTrial()` is progress-triggered and boss levels have `quota: 0`; trigger on the phase index instead. Makes the finale of Gap 1 the first time a shoe and a boss are on the board together |
| **CR-8** | **A half-strength boss anywhere.** `BOSS_FIGHTS` is data and `scaleBoss` takes any 0.25–1 | — | Not proposed for world 1 (1-4 already does it), but worth writing down: a 0.4 Beetle King at 2-5 would fill Gap 3's emptiest level with the game's most expensive content for one table row |

**The rule these share.** Every one of them is a *relationship* the code already
supports between two things the player already knows. The game's cast is not too
small; its combinations are unused.

---

## 7. What NOT to add

Six things I considered and rejected. Recorded so they do not come back.

**1. A new species.** The obvious answer to "I've seen all the bugs" is an
eleventh bug, and it is wrong three times over. `art-todo.md` puts the painting
pipeline at 19 of 100 slots, and a species is an 8-frame walk strip. `bugs.ts`
states the set's design rule — each one breaks exactly one assumption the
previous tier taught — and the ten already cover ten assumptions; an eleventh
would be a variation, which is the exact complaint. And world 1 has no free
debut slot: `stages.ts`'s world-1 block spent two re-cuts getting nine ideas
into nine levels with a problem always one level ahead of its answer. The
testers did not say "not enough bugs". They said "the same blanket".

**2. Pulling world 3 or 4 fauna into world 1.** A moth over the picnic at 1-8
buys one genuine "what is *that*" and spends world 3's identity to do it —
`bugs.ts` already notes that worlds 3 and 4 drop the ant precisely so "a cast
that never loses anybody gets thinner every world". It also fights the debut
gate, which `levelSpec` re-applies after every override on purpose so that a
roster typo cannot leak the robo-bug into the picnic. Borrowing novelty from
minute 25 to spend at minute 7 is a loan, not income.

**3. Randomising the board, or a shuffle/daily mode.** Already ruled out in
`RETENTION` §5 and `ROADMAP` ("#3 is ruled out"), and worth restating because it
is the reflex answer to "it feels repetitive". It breaks `levelSpec`'s
determinism (3-7 is 3-7), the leaderboard, and every quota in the file, all of
which were set by scouted measurement against a fixed board. Variety in this
game has to be **authored**. And a daily anything is a time-limited hook aimed
at six-year-olds, which the brief forbids and Poki's no-runtime-requests rule
makes awkward anyway.

**4. A collection screen, a bestiary tab or an achievements list.** `ROADMAP`
#7 (Bug Cards) is tempting here because it would give Gap 1 a reason to keep
playing — and it is a meta modal, which the owner's standing rule forbids
outright, and a screen that is not the board. The same objection retires any
"you have seen 6 of 10 bugs" progress row. If the cast needs showing off, show
it off *on the board* — that is what CR-1, CR-2 and N8 do.

**5. More difficulty as the variety.** The curve already does this (`quota`
10 → 44 and `speed` 0.80 → 1.02 across world 1 alone) and it changes clear time,
not the verb. Decisive here: **the testers were winning when they quit.** A
harder 1-8 would have moved them out earlier, not later.

**6. A full cutscene in the middle of world 1.** `cutscenes.md` is right that
the middle is unpunctuated, and the temptation is a fifth scene at 1-5. But a
cutscene is something to *watch*, and these three players quit because there was
nothing left to *do*. N10 takes the 1.4 seconds of story and leaves the five
seconds of sitting still. The funnel cost of a skippable scene is already
measured in `cutscenes.md` §"The funnel cost"; do not spend it twice.

---

## 8. Build order

| Order | Beats | Days | Why now |
|---|---|---|---|
| 1 | **N6, N7, N8, N5** + **CR-1, CR-3, CR-4, CR-6** | ~1.5 | Every one is a table edit or close to it, and between them they land on 1-8, 1-9, 1-10, both parties and the two provably-empty world-2 levels — i.e. all three quiet stretches, in one afternoon and one scout pass |
| 2 | **wire `floors.ts`**, then **N1, N2** | ~2 | The look. The forty floors are already written and invisible; wiring them plus the hour plus something standing on the floor is the complete answer to the literal quote, and only N2 touches the simulation |
| 3 | **N3, N4, N12** | ~2 | A fourth rush shape, a second world-1 twist, and a purchase the board reacts to |
| 4 | **N9, N11** | ~2 | The two that change what a level *is*. Both need a real balance pass; neither should ship without `pnpm scout` on 1-6 and 1-7 |
| — | **Boss Cameo** (`RETENTION` #14, 1-8) | 2 | Parked with #11–20. If one thing gets un-parked for this problem, it is this one: it is aimed at the worst gap in the game and its level was chosen for that reason |

Total for the twelve proposed beats: **about 50 hours**, of which the first
seven hours cover all three quiet stretches. Wiring `floors.ts` is not counted —
it is somebody else's work, already written, and it should go first because it
is the only item on this page that is finished and unseen.

---

## 9. The one-line version

The game's novelty schedule is dense and its novelty *vocabulary* is one word
long: **one more creature**. The two beats every tester rated 5/5 — the party
and the Queen — are the only two that change the frame, and there are 4½ minutes
between the second one and the next. Fix that by changing the frame more often,
with the cast, the hazards, the shoes, the twists and the bosses the game
already owns.
