# Bug Crunch — cutscenes

## The problem this solves

The game currently explains **nothing**. A player arrives from a portal tile,
watches a loading ant say "Boo!", and is dropped onto a gingham blanket with a
shoe. The tutorial teaches the *controls* well — wordlessly, one gesture at a
time — but nothing anywhere says **why there is a shoe** or **why the bugs must
go**. The store copy carries the premise ("Squish the bugs before they take the
picnic!") and the game never does.

That is two separate losses:

1. **No stakes on the first level.** A player who understands they are defending
   their own lunch reads level 1-1 as a situation. A player who does not reads it
   as a tapping exercise, which is a thing you stop doing when your tea is ready.
2. **Nothing punctuates the middle.** Forty levels of the same verb is a lot of
   the same verb. A cutscene every ten levels is the cheapest pacing tool there
   is: it marks a chapter, pays off the last ten levels, and sells the next ten.

---

## The premise

> **Somebody is trying to eat a sandwich. The ants have other plans.**

The player is never seen. This is a top-down game and the camera never leaves
the floor, so the character exists entirely as **a shoe, a shadow, and the things
they brought with them** — a plate, a lemonade glass, a paperback going soft in
the sun. That is not a limitation to work around; it is the best thing about the
premise. The player is not playing *a character who stomps bugs*. The player is
the foot. The character is whoever is attached to it, and the game never has to
decide.

The escalation across the four worlds is a single joke told four times, bigger
each time:

| World | Where | What they took | The character's read on it |
|---|---|---|---|
| 1 · Picnic Blanket | the blanket | a crumb, then the sandwich | "Fine. FINE." |
| 2 · Overgrown Backyard | off the blanket, into the grass | the whole picnic | "They have a *route*?" |
| 3 · Dusty Attic | indoors, upstairs | they live here | "They have *always* lived here." |
| 4 · Neon Arcade | an arcade cabinet | the high score | (no longer about the sandwich) |

The comedy is that **the bugs never escalate and the human never de-escalates**.
The ants remain ordinary, cheerful, and completely unbothered. The person
attached to the shoe goes from mildly annoyed to waging a campaign across four
locations. Nobody ever says a word about it.

### The one design call worth stating up front

The brief floated two motivations: *angry that they touched his food*, or
*just a bit sadistic*. *This document takes the first and rejects the second*,
and the reasoning is worth writing down because it will come up again:

- **The audience starts at six.** `src/game/tutorial.ts` opens by stating that,
  and every teaching decision in the game follows from it. Cruelty-as-motivation
  reads differently to a six-year-old than it does to an adult reading a design
  doc.
- **The game already has an accessibility setting whose entire purpose is that
  squishing not be unpleasant.** `JUICE_STYLE` offers `confetti` (piñata paper)
  and `bubble` (soap) precisely so that "a six-year-old, a squeamish adult, a
  parent watching over a shoulder" can keep playing. A cutscene that frames the
  player as enjoying the cruelty argues against a feature the game already
  shipped, and it would look absurd playing over the confetti setting.
- **Portal moderation.** Poki, CrazyGames and GamePix all review for tone on a
  kids-facing title. "Defends lunch" passes without a thought. "Enjoys it"
  invites a conversation nobody wants to have during a submission round.

None of which means the character has to be *nice*. The pettiness is the joke —
it just lives in the **over-reaction**, not in the enjoyment. Declaring total war
on an ant colony over one crumb is funny. Enjoying the squishing is not, and it
is also not necessary: the game's own juice does that work.

---

## The rules every cutscene keeps

These are binding, in the same way the tutorial's rules are binding.

1. **WORDLESS.** Not one line of dialogue, not one caption. The game ships to 21
   locales and states plainly in its own store copy that no reading is required.
   A wordless cutscene is correct in all 21 for free, exactly as the lessons are.
   Sound and picture carry everything.
2. **SKIPPABLE FROM THE FIRST FRAME.** Any tap, click or key skips instantly,
   and a **Skip button sits in the bottom-right corner** from frame one. Not
   "after 2 seconds", not "hold to skip". See *The skip control* for the spec and
   *The funnel cost* for why this is not a courtesy but the thing that stops the
   feature from costing money.
3. **ONCE, EVER.** A cutscene that has played is recorded in the save blob and
   never plays again, on any device the save reaches. Nobody watches the intro
   twice, and a returning player who lost their save is a rounding error next to
   a player who quits because they cannot get back to the game.
4. **SHORT.** As built: 9.5 s for the intro, 5 s for 02-04, 7 s for the finale,
   5.8 s for 1-10's rematch, 2 s for a boss stinger. If a beat cannot be read in a second and a half, it is
   two beats or it is cut. (05's retreat montage is the one place that breaks the
   second-and-a-half floor on purpose: four held frames of 0.8-1.0 s that read as
   one sentence — "back the way we came" — rather than as four beats.)
5. **IT IS THE GAME'S OWN CAMERA.** Cutscenes are rendered by the existing canvas
   renderer with the existing painted art, in the existing top-down view. No
   video files, no second art style, no separate asset pipeline. A cutscene that
   looks like a different game teaches the player about a different game.
6. **`prefers-reduced-motion` IS HONOURED.** The camera flight becomes a series of
   held frames with cuts instead of moves. Every other animated thing in this
   codebase already does this and so does this one.
7. **IT RESPECTS THE JUICE STYLE.** No cutscene shows a squish that the player's
   own `JUICE_STYLE` setting would not show. In practice: no cutscene shows a
   squish at all. The shoe comes down and we cut.
8. **NOTHING POPS.** A creature may only come into existence, stop existing, or
   jump somewhere **the camera cannot see it happen**: outside the frame, under
   something the set paints over the cast (the door, the paperback, the conveyor's
   machines), or on a real cut — a beat that changes the set or the world. That
   holds on a portrait phone, a landscape phone and a desktop, with reduced motion
   on and off, and at every quality tier. A pop reads as a bug, not as a story
   beat. `tests/game/cutscene.test.ts` samples every scene at 60 Hz under all of
   those and follows each creature by id.

---

## Cutscene 01 — "The Crumb"

**When:** once, immediately before level 1-1, after loading finishes and before
the level banner. **Length:** 9.5 s. **New art required:** none.

The whole scene is the existing picnic floor tile, the painted `ant` walk strip,
the painted `sneaker`, the `crumbs` prop, and the mascot. It is a camera move
over a board that already exists.

### Why it opens on the mascot

The loading screen already stars a cheerful worker ant who waves at the player
and shouts "Boo!". That ant is *already painted*, already on screen for several
seconds before every session, and is currently a decoration with no connection to
anything.

**It is the ant that takes the crumb.** The greeter waves at you on the loading
screen, and the first thing it does in the game is rob you. That single link
turns the splash from furniture into a setup, costs nothing, and gives the player
a face to be annoyed at.

### The beats

| # | t (s) | Camera | What happens | Sound |
|---|---|---|---|---|
| 1 | 0.0 – 1.6 | **Wide and still.** The whole blanket, zoomed well out. | A plate, a lemonade glass, a paperback face-down, and one sandwich. **Nobody.** Nothing moves. Sun. | Warm afternoon bed: birds, distant lawnmower. No music yet. |
| 2 | 1.6 – 3.0 | **Slow push in** on the sandwich. | A single crumb tips off the edge of the plate and lands on the gingham. As the frame closes, the mascot ant hurries in from the top-right corner. | The push is silent. One soft *tik* as the crumb lands. |
| 3 | 3.0 – 4.4 | **Hold, close.** | The mascot stops dead at the crumb, looks *up at the camera*, **waves** — the same wave as the loading screen — and picks the crumb up. In the last beat of the wave, **three scouts dash in** from the corners behind it. | A cheeky three-note sting on the wave. |
| 4 | 4.4 – 6.0 | **Track** with the ant, pulling back as it goes. | The raid is on: ants **rush in from every corner** of the widening frame, brake hard at the plate and start tugging at the sandwich. The scouts turn round loaded and head home down-left **beside the mascot** — it is the first of a stream, not a creature on its own. | Music fades in under: one small marching figure. |
| 5 | 6.0 – 7.4 | **Keep pulling back**, fast now. | Wide: the plate is **overrun**, a stream of carriers is hauling pieces off towards the lower-left, a beetle is dragging a big one, and more are still dashing in from the edges. The sandwich is **moving** — being carried, wholesale, off the plate. | The march multiplies. It stops being cute. |
| 6 | 7.4 – 8.6 | **Hold wide.** | A **shoe-shaped shadow** slides across the blanket and grows. Every ant stops at once — the late ones frozen **mid-dash**. The mascot, mid-carry, is caught in the stream. | Everything drops out. One held breath of near-silence. |
| 7 | 8.6 – 9.5 | **Snap in** to gameplay framing. | The sneaker descends into frame and **holds, poised**, exactly where the player's foot will be on the first frame of 1-1. | The charge whine, cut off by the level's music starting. |

### Why it is a rush, not a line

The first build of beat 4 was a **column switched on at 4.4 s**: eight ants
appeared in a line around the mascot in a single frame, just as the camera pulled
back to reveal them. Players do not read that as a colony. They read it as the
game glitching — the owner's note was *"1 ant turns into a line of ants from one
moment to another"*.

So every creature after the mascot now **enters from outside the frame**, on its
own clock (the `raid` track in `cutscene.ts`):

- **Staggered.** 24 raiders set off over two and a half seconds, never two in lockstep. Three
  scouts go first, during the close-up; the rest follow as the frame widens.
- **From the corners, and further out the later they go.** Portrait and landscape
  crop the same camera differently (the renderer fits the *short* edge), so the
  only place that is off-frame on every screen is past the short-edge half-width
  on **both** axes. Under `prefers-reduced-motion` the camera *cuts* to the 1.0
  framing at 4.4 s instead of easing there, so every entrance after that has to
  clear a hundred-unit frame, and after 6.0 s the whole 0.58 wide shot.
- **A dash that brakes.** Distance-to-go decays exponentially, so a raider
  crossing the frame edge moves at the same number of **screen pixels a second**
  at any zoom. The long off-screen part of a far entry goes by unseen, and every
  raider brakes into shot at the same readable scurry.
- **Some leave loaded.** About half turn round after a moment at the plate and
  walk their piece home down-left — the way the mascot went — so by the wide shot
  it is simply the first of a stream. Beetles always haul, and theirs is the big
  piece.

The quality tier thins the raid like any other crowd, and it is thinned **evenly
across the whole raid** rather than from the end. The tier is also **read once,
when the scene starts**: the ladder calibrates over the first ten seconds of
rendering, which for a new player are exactly the seconds the intro plays in, and
a step down mid-scene would delete half the raid in shot.

### Why it ends where it ends

Beat 7 is not a flourish. It hands over on the game's own first frame: the
cutscene's last camera position **is** the gameplay camera, and the shoe's last
position **is** the foot's starting position. There is no cut, no fade, no "Level
1-1" card between them — the banner comes up over a board that is already live.
The player's first instinct after watching a shoe hang over a swarm is to drop
it, and that instinct is exactly the `stomp` lesson, which arms immediately.

The intro does not teach a control. It creates the *want* that the tutorial then
teaches the player to satisfy. Those are different jobs and they should not be
done by the same beat.

---

## The skip control

**Bottom-right, on every device, visible from the first frame, never fading.**

### The button is the affordance; the screen is the hit area

These are two different things and the design needs both:

- **The whole screen skips.** That is what protects the funnel: the impatient
  player's very first tap lands *somewhere*, and wherever it lands it must count.
  A scene that only accepts taps inside a 44 px rectangle wastes the first input
  of everyone who did not aim, and that input is the one Poki's
  conversion-to-play is measured on.
- **The button exists so the player knows the screen skips.** Most players will
  not try tapping a cutscene; they will sit through it, mildly trapped, and that
  feeling is what a skip control is actually for. The button's job is
  *discoverability*, not exclusivity.

So the button is not a hit target that happens to be drawn — it is a **label for a
gesture the whole screen already accepts**. Pressing it and tapping the sky do
the same thing, and that is deliberate.

*A consequence worth stating: because the whole screen skips, accidental skips
are inherent, and no amount of moving the button avoids them. Bottom-right is
exactly where a right thumb rests on a phone — but a thumb resting there would
have skipped the scene from any position, so placing the button elsewhere buys
nothing. The mitigation is not placement, it is that the scene is short and the
player loses nine seconds of story they can live without.*

### Placement and size

| | Mobile | Desktop |
|---|---|---|
| Corner | bottom-right | bottom-right |
| Inset | `clamp(0.5rem, 3vw, 1rem)` **+ `env(safe-area-inset-right / -bottom)`** | same |
| Min height | **2.75 rem (44 px)** — the WCAG floor `FButton` already enforces | 2.75 rem |
| Content | `skip-forward` glyph **+ the word** | same |

The safe-area insets are not optional. Bottom-right on a phone is the corner that
collides with the home indicator on iOS and the gesture bar on Android, and this
project already has the idiom — the HUD's own bottom bar pads with
`env(safe-area-inset-bottom)` and `FReward` does the same. A skip button that
sits under the home bar is a skip button that opens the app switcher.

The button keeps the **same corner on both** rather than moving to a
desktop-conventional position. The game is one layout that reflows; a control
that relocates between form factors is two layouts to reason about, and the
bottom-right corner is free in both — during a cutscene the HUD is hidden
(`visibility: hidden` on `.scene__hud`, which also switches its controls'
pointer events off), so there is no collision with `.scene__locker`, which
normally lives there.

### Appearance

It has to read against a **bright, sunlit, pale-gingham scene**, which is the
hardest background this game has for white UI. So it carries its own plate rather
than floating as text: the existing `FButton` `secondary` treatment — dark plate,
ink contour, the same depth plate every other button in the game stands on.

It is **fully opaque from frame one and never animates in**. A skip control that
fades up over half a second is invisible during the exact window when the
impatient player is deciding whether to bounce.

It does **not** pulse. `FReward`'s tap-to-continue hint pulses because it is
asking for an action; this one is offering an escape, and an escape hatch that
throbs reads as the game nagging you to leave.

### The word

`skip-forward` is a conventional glyph and the icon set already ships it, so
icon-only was considered and rejected for one reason: **a cutscene never
replays** (rule 3). Every other icon-only control in this game costs one tap to
undo. This one is irreversible, and an irreversible control gets a word.

New i18n key — **`cutscene.skip` → "Skip"**, English first, then propagated to all
21 locales. It is the shortest word in this entire UI and the one most likely to
already exist as a loanword, so the row is cheap; it still goes through the same
pass every other string does, and no locale ships without it.

Reuse note: `tapToContinue` / `clickToContinue` already exist and are *not* right
here. Those name the gesture; this names the outcome. A player who reads "Tap to
continue" on a cutscene reasonably expects it to advance a beat, not abandon the
scene.

### Behaviour

- **One press, one skip.** The control is disabled the instant it fires so a
  double-tap cannot skip the cutscene *and* the level banner behind it.
- **Keyboard.** `Esc` and `Space` skip; the button is a real `<button>`, focusable,
  and reachable by Tab — it is the only interactive element on screen, so it takes
  focus on mount.
- **Screen readers.** A real button with a real label. The scene itself is
  `aria-hidden` — it is wordless decoration and there is nothing to announce.
- **It never fires `gameplayStart`.** Skipping is not playing. The bracket opens
  on the player's first interaction with the *game*, which the existing Poki gate
  already handles.
- **Skipping is not a different outcome.** Skip jumps to the cutscene's final
  state — the shoe poised over the board — rather than cutting to black. The
  player who skips and the player who watches start level 1-1 from the same
  frame.

## The slate — what shipped

All ten scenes are **built**: six cutscenes and the four boss stingers.
Everything below describes what the game actually plays, not what was planned.

| # | id | When | Length | Beats | Set dressing it paints |
|---|---|---|---|---|---|
| 01 | `intro` | before 1-1 | 9.5 s | 7 | plate, sandwich, glass, book, crumb |
| 02 | `trail` | before 2-1 | 5 s | 5 | the same, on a patch of blanket |
| 03 | `inside` | before 3-1 | 5 s | 5 | attic box, door |
| 04 | `mecha` | before 4-1 | 5 s | 5 | cabinet, conveyor machine |
| 1-10 | `rematch` | before 1-10 | 5.8 s | 6 | nest, sandwich, puff |
| 05 | `finale` | after the last boss | 7 s | 7 | the picnic, the attic, the arcade |
| — | `stinger-<boss>` ×4 | before each boss level | 2 s | 3 | the world's own set (bare gingham for the Queen) |

**The creatures never needed the art pipeline**: every one is a painted walk
strip the board already blits, every boss is one of the four
`images/bosses/*.webp` stills, and every hazard is a painted prop.

**The set dressing did, in the end.** The first pass drew it in canvas in the
`inkArt` vocabulary and called it background — but once the rest of the game
was painted, the plate and the cabinet were the only drawings left in shot, and
a hand-painted ant on an inked plate is two art styles in one frame (rule 5).
So every piece of dressing is now a drop-in like a prop — see *Painted set
dressing* below — and the drawing is what plays until its painting exists.

### 02 — "The Trail" · before 2-1 · 5 s

| # | t (s) | Camera | What happens |
|---|---|---|---|
| 1 | 0.0 – 1.1 | close on the plate, **zoom 2.0** | The plate. Empty. A few crumbs, and a line of ants walking off it. |
| 2 | 1.1 – 2.2 | follow the line down, 1.7 | Along the column, past the paperback, towards the hem. |
| 3 | 2.2 – 3.2 | over the hem, 1.4 | Off the blanket. The grass is not empty either. |
| 4 | 3.2 – 4.2 | pull back hard, 0.56 | A column across the yard, a second line joining it, and a beetle standing over the junction doing nothing at all. |
| 5 | 4.2 – 5.0 | snap to gameplay framing | The shoe comes down on grass. |

**The picnic is parked off the board, not faded out.** The hand-off rule says the
last frame of a scene is the first frame of the level, and 2-1 is bare grass. So
the blanket is a finite patch at world x 106..186 — east of the 0..100 board —
and the last camera move genuinely *leaves it behind*. The floor is world 2 for
all five seconds and the blanket is the world-1 tile clipped to that patch, which
is the only way a camera can cross an EDGE rather than cut to another place.

*Sized for a phone, not for a square window.* The renderer scales on the short
edge, so a portrait handset sees ~205 world units of height; a blanket sized to
fill a square viewport has grass above and below it on a phone, and beat 1 is
supposed to be nothing but blanket. It is 80 × 116 units.

**Both lines are much longer than the shot, on purpose.** A looping column is
born at one end and recycled at the other, so both ends must be off-frame for the
whole scene. The first build started the route at the plate's centre — an ant
appeared on the plate every half-second of the opening close-up — and stopped the
supply line dead thirteen units short of the route, where its ants vanished in
the middle of the pull-back. Now the route comes over the far corner of the
blanket **empty-handed**, crosses the plate (they pick up from there), and leaves
past the corner of the 0.56 wide shot; the supply line crosses the grass from the
upper left, **joins the route** just past the hem and runs down it as a second
file. The foreman has been standing there since before the scene started, rather
than being switched on at 2.2 s where a portrait phone could see it.

### 03 — "Inside" · before 3-1 · 5 s

| # | t (s) | Camera | What happens |
|---|---|---|---|
| 1 | 0.0 – 1.0 | the foot of a door, 2.0 | A dark door, a hot strip of daylight under it, and the column walking *under* it. |
| 2 | 1.0 – 1.9 | into the gap, 3.0 | Everything goes dark. |
| 3 | 1.9 – 3.0 | out into the attic, 1.3 | A torch finds cobwebs and taped boxes. |
| 4 | 3.0 – 4.2 | the beam widens, 0.78 | The floor is **moving** — sixteen bodies, all headings. |
| 5 | 4.2 – 5.0 | snap, 1.0 | The beam narrows to the stomp ring. The shoe is in it. |

**The climb is played on a dial, not on a camera.** A top-down camera cannot pan
up through a house, so the staircase is `dark` going to 0.88 and back. The
audience reads the height and the game never draws a stair it has no art for.

**The door is painted OVER the cast.** A column that walks on top of the door it
is supposed to be going under is not going under anything, and that occlusion is
the whole shot. The one cue doing the work is the strip of daylight: a dark band
alone is a shadow; a dark band with light leaking out from under it is a door.
It has to be brighter than it looks like it needs to be, because the beat runs
under an ink wash — the first cut measured RGB 156 on screen and read as a warmer
floorboard.

**The door is also where the trail is recycled.** Its head walks under the door
and is re-born off the bottom-left corner of the shot. The trail exists exactly
while the door does (`on: 'door'`), and the moving floor and the moth arrive on
the cut to the attic (`on: 'attic'`) — the first build let the trail stand in the
torch beam for a fifth of a second after the door had gone, and switched the
floor on a tenth of a second into the lit shot.

### 04 — "Mecha" · before 4-1 · 5 s

| # | t (s) | Camera | What happens |
|---|---|---|---|
| 1 | 0.0 – 1.0 | the whole cabinet, 0.86 | A cabinet in attract mode: neon bezel, marquee, a lattice running on the screen. |
| 2 | 1.0 – 2.0 | in on the marquee, 1.9 | A roach walks across it. It has **plating**. |
| 3 | 2.0 – 2.9 | push through, 3.4 | The glass blows out. |
| 4 | 2.9 – 4.2 | out to 0.58 | The factory floor: a conveyor line running out of one machine and into another, magnets, a rack of pods, and **Mecha Roach Prime** standing over the output machine. |
| 5 | 4.2 – 5.0 | snap, 1.0 | The shoe comes down on an arcade. |

**Beat 1 has to show the cabinet AS a cabinet.** The first cut framed the camera
inside the screen and read as a dark field with two neon lines across it, which
is not a cabinet, it is a gradient — the bezel has to be in shot for the marquee
above it to mean anything.

**The marquee roach is paced against the CAMERA.** Beat 2 sees only x 24..76, so
a roach that walks the full width during beat 1 leaves an empty marquee for the
beat that is about it. It crosses half the marquee per beat.

**This is the first time the game has ever drawn `images/bosses/*.webp`.** The
four boss paintings have been preloaded on every world's levels since the art
pipeline landed and `paintBoss` never asked for them — it draws the procedural
body. 04 and the stingers read them painted-first. Roach Prime is gone from the
frame before the hand-off, because 4-1 has no boss in it — **framed out, not
switched off**: it stands up in the corner, past the gameplay framing's short-edge
half-width on both axes, so the snap to 1.0 leaves it behind on every screen. The
first build switched it off at 4.3 s, in the middle of the wide shot.

**The conveyor's ends are inside machines.** A looping line is recycled at its
ends, and the 0.58 pull-back sees a hundred and fifty units either side of the
board — a conveyor long enough to hide its own ends off-frame would need four
times the robobugs. So both ends sit inside a box the arcade paints over the cast.
The first build had robobugs appearing out of the floor at one end of the line
and vanishing at the other. The marquee roach likewise walks off the marquee and
stops existing with the glass, rather than being switched off while the push-in
was still looking at it.

### 05 — "One Crumb" · after the final boss · 7 s

| # | t (s) | World | Camera | What happens |
|---|---|---|---|---|
| 1 | 0.0 – 0.9 | arcade | 0.72 | The arcade goes quiet. Nobody is working. |
| 2 | 0.9 – 1.7 | attic | 0.66 | Back down through the attic. |
| 3 | 1.7 – 2.5 | backyard | 0.62 | Out across the backyard. |
| 4 | 2.5 – 3.5 | picnic | 0.58 | The blanket. The opening shot. **The sandwich is back.** |
| 5 | 3.5 – 5.0 | picnic | 2.0 | Push in. One ant crawls out from under the paperback, strolls over and takes one crumb. |
| 6 | 5.0 – 6.0 | picnic | 2.6 | It looks up at the camera. Beat. Nothing happens. *(no cue — the joke is the silence)* |
| 7 | 6.0 – 7.0 | picnic | 0.58 | It walks away with it. |

**The retreat is four cuts, not a flight.** Flying a camera between four places
that do not adjoin would take longer than the whole scene has and would answer a
question nobody asked. Four held frames read as "back the way we came" for free,
each on its own `world`, wiped through `dark`.

**There is no shoe anywhere in it**, at any point. That is the ending.

**The last ant comes out from under the paperback.** The first build had it "enter
from off the board's east edge" — but the 0.58 framing of beat 4 sees fifty units
past that edge, so it appeared from nothing in plain view. A walk in from truly
off-frame at that zoom is a hundred and twenty units in a second and a half, which
is a sprint, and the joke is a stroll. The paperback is fifty units away, it is
where an ant would actually be, and the picnic paints it over the cast.

**Beat 6 frames the whole sandwich and the one crumb together.** The joke is the
ratio between them; a close-up of the ant alone throws it away. The crumb sits on
the gingham well clear of the plate for the same reason — the first cut put it
inside the plate's radius, where a one-unit speck on a white disc is not a crumb
being taken, it is an ant eating the sandwich.

**Where 05 is triggered, and why.** `onLevelEnd` in `GameScene.vue`, gated on
`won && level === TOTAL_LEVELS`, **after** the interstitial gate and **before**
the reveal and result screens.

- It is the only place in the game that knows the last boss was actually
  *beaten*. `onNext` clamps at `TOTAL_LEVELS` and never fires past it, and the
  result screen's `campaignDone` branch is a readout rather than an event.
- After the ad, because the rule the flow already keeps is *the ad goes before
  the result screen, always* — putting the scene first would drop an ad break
  inside the story beat, and moving the ad after the scene would drop it between
  the payoff and the campaign-complete screen.
- Before the screens, because this document ends the scene with "roll the
  campaign-complete screen". The payoff lands, then the numbers.
- `stopBattleMusic()` has already run by then, so the scene opens on a quiet
  board — which is exactly what "the arcade goes quiet" asks for.

It is awaited, and the promise resolves on the scene ending **or** on a skip, so
a player who skips still gets the result screen. That path is verified in a real
browser, not only in a unit test: the promise never resolving would hang the end
of the campaign.

### 1-10 — "Seconds" · before 1-10 · 5.8 s

The Goliath Queen is fought twice in world 1: at half strength on 1-4, which is
where her once-ever stinger plays, and at full strength on 1-10, which opened on
nothing at all. This is 1-10's scene. It has one job — *she's back, and bigger* —
and one thing to plant: the fight's egg phase.

| # | t (s) | Camera | What happens | Sound |
|---|---|---|---|---|
| 1 | 0.0 – 1.2 | close on the nest, 2.2 | A napkin nest in the corner of the blanket, a clutch of five eggs **wobbling** in it, nurses crawling over them, two workers still bringing more eggs in. The Queen is just out of shot. | `podHatch` — the fight's own egg cue, heard first here |
| 2 | 1.2 – 2.4 | pull back, 1.15 | The eggs are **hers**: the Queen lounges beside them, a size smaller than the fight's. Four ants hurry **the sandwich from 01** up to her, under her chin. | `slide` |
| 3 | 2.4 – 2.85 | push in on her face, 1.5 | **CHOMP.** She lunges; half the sandwich is gone; she boings up a size. | `podPop` |
| 4 | 2.85 – 3.4 | ease back, 1.35 | **CHOMP.** All of it; up another size, overshoot, settle — full size. | `bossCharge` (rising: the power-up) |
| 5 | 3.4 – 4.6 | push in, 1.7 | She rears up and looks straight at the player, and **huffs** — two puffs of steam, twice. The lunch crew bolts. The eggs rattle. | `bossPhase` |
| 6 | 4.6 – 5.8 | snap to gameplay framing, 1.0 | She **charges** onto the board and skids to her spot, turning to face down; the shoe comes down on the foot. | `charge` |

**The joke is lunch.** "Full strength" to a six-year-old is *bigger*, and the
funniest reason a monster gets bigger is that it ate something — so she eats the
sandwich the colony stole in 01, nine levels ago, and grows a size per bite. It
is exciting rather than scary because the thing that powered her up is a picnic
sandwich, and the anger is a huff of cartoon steam. No squish, no teeth.

**The eggs are planted, not taught.** Nothing points at them. They open the
scene, they are hers, they wobble — gently from the first frame, hard while she
roars — and the cue over that first shot is `podHatch`, the sound the fight
makes when an egg gets away. When the fight's egg phase lays eggs on the board,
the player has already seen one move. (They are the fight's own pod painter,
`paintPod`, in the Queen's accent.)

**Everything that is not the Queen lives in the corner.** 1-10's board has no
nest, no eggs and no ants on it, so the nursery sits past the board's top-left
corner (`LAIR_NEST`), where the snap to gameplay framing leaves it behind on
every screen shape — the same diagonal rule every entrance in these scenes
keeps. The lunch crew runs back off the left edge, past the hand-off frame of
every screen up to 21:9. Only the Queen crosses onto the board.

**She lands where the level already put her.** The level is started under the
scene, so the sim has spawned her before the first frame — a third of the way
down a board whose height is the screen's minus the HUD's. No beat sheet can
know that number, so the scene is handed a **stage** (`CutsceneStage`, built per
frame by `GameScene` from the live sim): her last path key is pinned to the
stage's boss, her sizes are scaled to the size the sim gave her (a short
landscape board spawns a smaller Queen, and she grows into *that* one), and she
arrives facing down — the way the fight turns her on its first frame. The same
stage lays 1-10's honey and crumbs on the blanket for the whole scene, and lands
the shoe on the foot at the size the board draws it, with the board's own shadow
and stomp ring fading in over the last stretch. Played for real in a browser,
the scene's last frame and the fight's first frame are the same picture on a
portrait phone and on a desktop.

**What the first build got wrong**, and what to keep for the next scene:

- *The crew fled up past the nest* — the obvious corner — and from under her
  chin that line runs straight across her face at the one moment the scene is
  about her face. They run back the way they came instead.
- *The puffs faded out*, and a drawn puff is overlapping lobes: at half opacity
  every lobe's outline showed through the others and the huff ended as grey soap
  bubbles. They shrink away now.
- *The nest's edge jittered* every other point and read as a comic-book BANG. It
  is a squircle with soft scallops.
- *Her rear-up shadow*, at the ant's opacity, showed through a Queen who is
  mostly legs and air as a grey slab. A boss's is lighter.
- *The path turned her in a single frame at every key*, which on a painting forty
  units across is the whole Queen spinning. Her heading is keyframed on its own
  (`turns`).

### The boss stingers · 2 s each

Built, one per boss, keyed `stinger-<bossId>` so the once-ever record treats each
separately. The camera finds the boss at 0.7, it fills the frame at 1.5, and the
last 400 ms snaps to gameplay framing with the shoe down — the same hand-off
every other scene makes. Its escort scatters outwards as it arrives, because a
boss reads as big from what is beside it rather than from how many pixels it is.

World 1's stinger uses a **bare** floor rather than the picnic set: the plate sits
at (50,42) and the boss at (50,26), so the set dressing puts an empty dinner
plate directly under the Queen and she reads as standing on a plinth.

The Queen's stinger plays before **1-4**, her half-strength debut, because a
stinger is once-ever and keyed by boss. 1-10 opens on its own scene instead
(`openingCutscene`), and a replay of 1-10 opens on the banner — never on a
stinger 1-4 already spent.

They do not compete with the boss lesson (open question 4): a stinger owns the
frame completely, and `teachLevelHints` — which arms `boss` — runs from
`endCutscene`, after the stinger has let go.

---

## How it is built

A cutscene is **data**, and after the second scene landed rather more of it is
data than the intro alone could justify.

```
Cutscene = {
  id,                       // recorded in the save blob; plays once ever
  world, set,               // the default floor and set dressing
  beats: Beat[],            // in order, each with its own duration
  actors: ActorTrack[]      // declarative; see below
}

Beat = {
  ms,                       // how long this beat holds
  camera: { x, y, zoom },   // world coords + scale; tweened from the last beat
  ease?, sfx?, note,
  world?, set?,             // override the scene's, from this beat on
  dials?: { shoe, dark, torch, sandwich, glow, crumb, ease? },
  hold?                     // actor time stops here and stays stopped
}

cutsceneFrame(scene, t, calm, crowd, stage?)
Stage = {                   // what the level has ALREADY put on the board
  boss?: { x, y, size },    // a walker with `pin: 'boss'` lands here
  props?: [...],            // the level's hazards, where it laid them
  foot?: { x, y, r, z }     // every opener's shoe lands here
}
```

### What got lifted into data when 02 landed, and what did not

The first cut of `cutscene.ts` had the beats as data and the intro's cast as a
script, with a note saying that when the second scene landed, the parts the two
had in common were the parts worth lifting. Three things repeated:

- **The floor, per beat.** 05 retreats through four worlds in seven seconds.
- **The dials.** Every scene wants a handful of scalars that tween exactly the
  way the camera does — how far down the shoe is, how dark it is, how tight the
  torch is, how much sandwich is left, how hot the neon is, whether the crumb is
  still on the blanket. They were `span(t, a, b)` calls hard-coded against the
  intro's beat table; they are keyframes now, resolved exactly like the camera,
  with their own optional easing for the case where the camera cuts and the dial
  should not (05 does this on every wipe).
- **The cast.** Six shapes cover every creature in all nine scenes:
  **walker** (a keyframed path, with heading taken from the direction of travel
  rather than authored), **column** (N bugs evenly phased down a line, with
  optional corners so one line can *join* another), **ring** (N closing on or
  fleeing a point), **swarm** (N crawling inside a box, deterministic from the
  index), **raid** (N rushing in from off-frame on their own staggered clocks,
  tugging at a prize, some hauling a piece home), **still**. Any track can be
  pinned to a set (`on: 'door'`) so it exists exactly while that place is on
  screen.

  1-10 added to the **walker** rather than adding a shape: a walker can be a
  boss (`boss`), be pinned to the stage's boss (`pin`), change size (`sizes`),
  turn on keys of its own rather than the path's (`turns`), huff (`huff`), and
  carry an egg or — with a `crew` of bearers under it — the sandwich (`load`).
  One actor for four bearers, because four walkers on four copies of one path is
  four chances for the crew to come apart in the middle of a shot.

  **raid** is the one shape used by a single scene, and it earns the exception:
  it is the only shape that can *enter*. The others are all present from the first
  frame they exist in, so the only way to bring one on mid-shot is to switch it on
  — which is the pop rule 8 forbids, and the exact bug 01 shipped with.
- **The covers.** Where a set paints something *over* the cast — 03's door, the
  picnic's paperback, 04's conveyor machines — the geometry lives beside the
  staging (`setCovers` in `cutscene.ts`), not only in the painter, because a
  creature is allowed to be born or recycled under a cover and the no-pop test
  needs to know where they are.

Three things stayed **code**, deliberately:

- **The sets.** The plate, the blanket's hem, the attic's boxes, the door, the
  cabinet's attract screen, the factory floor. These are drawings, one per place,
  and a generic prop table would be a worse version of a canvas function that
  nobody could read. `cutsceneArt.ts` owns one painter per `set` name — plus an
  optional **over-pass** for the two sets that have something in FRONT of the
  cast (03's door, 04's glass).
- **The choreography.** Where the greeter stops, how long the look holds, which
  beat the roach has to be centred on. That is direction, and it belongs beside
  the beat it serves.
- **The grade.** `dark`/`torch`/`glow` are dials, but what they *look like* — the
  beam's falloff, the warm cast inside it, the neon bloom — is one screen-space
  pass at the end of the draw.

There is no general actor engine and there should not be one. The bar for a track
kind or a dial was "at least two scenes need it", and everything that cleared it
is in and everything that did not is a few lines in a painter.

### Painted set dressing

Every piece of dressing the scenes draw is a still of its own art kind,
**`scene`**, at `images/scenes/<id>.webp` — catalogued in `artCatalogue.ts`,
declared with its prompt in `artSheet.ts`, and drawn painted-first by its painter
in `cutsceneArt.ts` with the drawing as the fallback:

| id | What | What stays drawn over it |
|---|---|---|
| `plate` | the empty plate | the sandwich, which is its own painting |
| `sandwich` | the two halves | nothing — the `sandwich` dial shrinks and slides it |
| `glass`, `book`, `crumb` | the lemonade, the paperback, one crumb | shadows |
| `attic-box` | one taped box, stretched to each of four sizes | shadows |
| `door` | ONE 46-unit tile of the door's lower edge, repeated along it | the daylight under it |
| `cabinet` | the cabinet face, its screen empty | the attract screen, scanlines, the blow-out |
| `hopper` | the conveyor machine, mirrored for the far end | the lid chevron and the status light |
| `nest`, `puff` | 1-10's napkin nest; one puff of steam | the eggs; the huff's growth |

Its own kind rather than more `prop`s, because nothing about it is a prop: no
level lays one out, and a player who has watched every scene never needs one
again. So the preloader asks for them **per scene**: `cutsceneArtWants` lists a
scene's floors, dressing, creatures, bosses and carried things, and `artPreload`
holds the splash for the first screen's scene, warms the next level's scene
alongside its boss, warms the finale before the last level, and leaves watched
scenes out of the background tier.

The box each is painted into is `SCENE_ART_BOX` in `cutscene.ts` — a module the
manifest can load under plain Node — and the reference bench draws each drawing
into exactly that box (`paintSceneRef`). The blanket's hem is the one piece left
drawn on purpose: it is a contour tracing whatever patch the set lays down, and
a painting cannot trace a shape it was not painted for.

### The one thing that turned out to be missing

`spriteFor('ui', 'mascot')` **returns null and always has.** The sheet manifest
declares the mascot still, and the painting was never produced — so 01's wave,
the scene's whole emotional hook, has been rendering as a plain walking ant since
it shipped.

The art desk was not available for this pass, so the gesture is **drawn** out of
the one thing a top-down camera can show: the creature **rears up**. It stops,
its walk cycle freezes, it grows by a third, its shadow separates from it and it
turns its head down the screen — which is as close to eye contact as this view
has. 01 and 05 both use it, and 05 holds it for a full second.

*If `images/ui/mascot.webp` is ever painted, it drops straight in: the renderer
still reads it painted-first and the drawn rear-up is the fallback.*

---

## The funnel cost, and what to measure

**This feature can lose money if it is built carelessly**, and the mechanism is
specific enough to name.

`src/utils/pokiPlugin.ts` gates `gameplayStart()` on the player's **first real
interaction**, deliberately: Poki's Web Fit Test grades *conversion-to-play* on
that event, with a **65 % gate**. A start fired at load time "counts every bounced
loader visit as a play and quietly poisons the one metric the funnel gates on".

A cutscene sits **exactly** in that window — after the loader, before the first
input. Which gives one hard rule and one number to watch:

- **The cutscene must never fire `gameplayStart`.** It is not gameplay. The
  bracket opens when the player touches the game, which — because the first tap
  also skips the cutscene — is the same event either way.
- **The first tap must skip it.** If the first tap skips the cutscene, then every
  player who was going to play still converts at the same moment they would have
  before, and the cutscene is free. If the first tap is *swallowed* by an
  unskippable scene, every impatient player's first input is spent on nothing and
  the conversion metric eats the difference.

**What to measure before shipping it wide:** conversion-to-play and
D1 retention, cutscene arm against control arm, on one portal. The hypothesis is
that stakes improve retention and the skip keeps conversion flat. If conversion
drops more than a point, the intro moves to *after* 1-1 — which is a worse story
beat and a better funnel, and that is a trade worth making with numbers rather
than taste. `src/use/useAnalytics.ts` already has the event bus for it.

---

## Open questions

1. **Does the intro play before or after the level banner?** Written above as
   *before*, so the banner lands on a live board. Worth trying both — the banner
   may be a better "chapter card" after the fiction than before it.
2. **Music.** The cutscene wants the level track to *start* on beat 7, which means
   the board music has to be startable on a cue rather than on level load. Small
   change, but it is a change to `useGameAudio`'s ownership of the track.
3. ~~**Does 05 gate on the final boss or on 100 %?**~~ **Settled: the boss.**
   `onLevelEnd`, on `won && level === TOTAL_LEVELS`. Gating on 40/40 stars would
   mean almost nobody sees the ending of the game, and the scene costs seven
   seconds that a finisher has earned. See *05 — "One Crumb"* for where in the
   result flow it sits and why it is there rather than a step either side.
4. ~~**Do the stingers need the `whilePaused` treatment?**~~ **Settled: no.** A
   stinger owns the frame outright, and the boss lesson cannot compete with it
   because `teachLevelHints` — which arms `boss` — is called from `endCutscene`,
   i.e. after the stinger has already let go of the screen.
5. **`images/ui/mascot.webp` was never painted.** The sheet manifest declares it,
   `spriteFor('ui', 'mascot')` has always returned null, and the intro's wave has
   been rendering as a plain walking ant since it shipped. It is now drawn (see
   *The one thing that turned out to be missing*), and the painted read is still
   first — but the sheet is still unpainted and the art bench should be pointed
   at it.
6. **~~The HUD is on screen during every scene.~~ Resolved.** The score, the
   timer, the boss bar and the phase call-out used to sit over every scene (on
   1-10 "Clear the swarm!" was written across the Queen's nest). `.scene__hud`
   now takes `.is-cutscene` while `cutsceneActive` and hides with `visibility`
   — not `display`, which would zero the bars `syncBoard` measures before the
   level spawns its boss. Only the skip control is on screen during a scene.
7. **Should 02-04 be moved to AFTER their world's first level?** The same funnel
   question the intro has, with less at stake: a player reaching 2-1 has already
   converted, so the conversion metric is not exposed. Only the interruption is,
   and five seconds between two levels is a smaller ask than nine before the
   first one. Worth measuring with the same arms.
