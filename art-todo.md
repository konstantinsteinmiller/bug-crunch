# Bug Crunch — art to-do

Everything in this game is **drawn by code today** and renders at ship quality.
This file is the list of slots a painted asset can replace, in the order that
buys the most on screen.

## How a painting gets in

There is no renderer change. `spriteFor(kind, id)` in `src/game/art.ts` probes
`public/images/<folder>/<id>.webp`, and the moment the file decodes the painting
is used instead of the drawing. Delete the file and the drawing comes back.

| kind | folder | what lives there |
| --- | --- | --- |
| `bug` | `public/images/bugs/` | the nine species — **8-frame walk strips** |
| `boss` | `public/images/bosses/` | the four bosses — **8-frame strips** |
| `shoe` | `public/images/shoes/` | the six shoes — **single stills** |
| `prop` | `public/images/props/` | floor objects — single stills |
| `fx` | `public/images/fx/` | rings, bursts, haze — single stills |
| `bg` | `public/images/bg/` | one **seamless** floor tile per world |
| `ui` | `public/images/ui/` | the result banner, the HUD marks and every button glyph |
| brand | `public/images/logo/` | the wordmark and the splash mascot — painted, never probed |

**Switch the layer on** with `VITE_ENABLE_ART_OVERRIDES=true` in `.env.local`,
or from the debug overlay at run time. It ships **off** so a missing painting can
never hold the splash screen open.

### The tooling that is already here

```bash
pnpm art:prompts     # writes a prompt per drawable, from the manifest
pnpm art:status      # which slots are painted, which are still drawn
pnpm art:export      # export the reference sheets the prompts point at
pnpm slice-sheets    # cut a returned sheet into per-id webp files
pnpm compress-folder # squeeze public/images before shipping
```

**The icon set is painted nine at a time.** `PROMPTS-GRIDS.md` holds seven
*contact sheets* covering all fifty-seven square `ui` slots — a 3×3 lattice of
different icons that the slicer cuts into nine separate files, because the index
entry for a grid carries a target per cell instead of one for the sheet. Paint
them as sets: the reason they share a generation is that the painter balances
stroke weight, corner radius and margin across the nine in one pass, which is
the half of an icon set that cannot be done one icon at a time. If one cell
comes back wrong, re-roll that slot alone from `PROMPTS-STILLS.md` — every
square slot still has a single-icon sheet of its own.

**So every one of those slots is painted twice, and `UI_CUT_FROM` says which
painting ships** (`src/game/artSheet.ts`, written to `art-sheets/cut-from.json`
by `pnpm art:prompts`). Until 2026-09-18 nothing said, and each file was
whichever painting the slicer happened to cut last — a full re-slice would have
swapped the nine `grid-ui-objects-2` icons that ship for their stills' different
designs. The table reproduces what shipped that day, measured pixel for pixel:
47 slots from their own still, the nine objects-2 icons (coin, gem, heart,
flask, wheel, gift, bug, splat, bolt) from the grid. The two designs of those
nine are side by side in `art-sheets/compare/ui-objects-2-grid-vs-still.png`.
To use a re-rolled still, set its slot to `'still'` and run `pnpm art:prompts`;
a sheet all of whose files are cut elsewhere shows as **superseded** in
`PAINT-STATUS.md` and the Art Desk, never as "to paint".

**Ruled returns (2026-09-18).** Six sheets came back ruled like comic strips —
black rules on the beetle and robobug, a purple line between the moths, a white
cross on the splat, confetti and egg — and shipped only because the Art Desk
painted rules out on every slice. The shared prompt clause lost for reasons
`artSheet.ts` sets out above `continuousGround`; with it fixed, all six were
repainted clean (the moth took three rolls: one refused by a grid check its own
reference fails, one with its wing beat out of order). The desk now paints rules
out only on a return that has them (`--drop-borders-if-ruled`).

`/art-sheets` (dev route) renders the reference sheet for every drawable at the
exact box, frame count and anchor the renderer expects. **Paint over that sheet.**
`/bug-lab` (dev route) shows every drawing animated at 24 / 40 / 64 / 120 / 200 px
over each of the four floors — the 24 px column is the acceptance test: a design
that is mud there is mud on a phone.

### Rules every painting has to keep

1. **The anchor.** Each drawable is blitted from its own centre except the shoe,
   which is anchored on the toe at `SHOE_BOX.toeFromTop` (`src/game/artBoxes.ts`).
   Move the anchor and the stomp circle stops agreeing with the art.
2. **Premultiplied-safe alpha.** Everything composites; nothing may carry its own
   ground. (The splash tile has a test for exactly this —
   `tests/ui/splashTiles.test.ts`.)
3. **Frame count is fixed.** `BUG_FRAMES = 8` (`src/game/bugArt.ts`). A strip
   with a different count is sliced wrong, silently.
4. **Top-down, single key light from the upper left** (`SHADOW_DIR = 1.05` in
   `src/game/inkArt.ts`). Every drawing in the game agrees on this; one painting
   that does not will read as a sticker.
5. **Ink outline.** `#2b1b2e`, weight scaled to the drawable. It is what holds
   the cast together on four very different floors.
6. **No text, ever.** 21 locales.

---

## Priority 1 — the cast (the screen is 80 % this)

| Slot | File | Frames | Notes |
| --- | --- | --- | --- |
| Ant | `bugs/ant.webp` | 8 | The bug 70 % of all squishes land on. Worth painting first and painting twice. |
| Beetle | `bugs/beetle.webp` | 8 | Shell must read as **hard** at 30 px — it is the whole armour lesson. |
| Flea | `bugs/flea.webp` | 8 | Needs a crouch frame; the leap is the tell. |
| Caterpillar | `bugs/caterpillar.webp` | 8 | Spikes must be legible at 24 px or children get hurt by something they could not see. |
| Stink bug | `bugs/stinkbug.webp` | 8 | Should look like it is about to burp. |
| Centipede | `bugs/centipede.webp` | 8 | Head only — segments are drawn procedurally from `paintSegment`. |
| Piñata fly | `bugs/pinatafly.webp` | 8 | The treat. Bright, papery, obviously worth chasing. |
| Moth | `bugs/moth.webp` | 8 | Airborne; wings need a clear beat in the cycle — TWO per loop, as the drawing does (swept back in panels 2 and 6, widest in 4 and 8). |
| Robobug | `bugs/robobug.webp` | 8 | Hardest shell in the game. Should read as metal, not as shell. |

**Shadow note:** bodies are drawn with a soft contact shadow by the renderer.
Do not paint one in.

---

## Priority 2 — the player

| Slot | File | Notes |
| --- | --- | --- |
| Sneaker | `shoes/sneaker.webp` | On screen in every frame of every level. Toe at `toeFromTop`, sole down. |
| Steel boot | `shoes/steelBoot.webp` | Steel toe cap is the identity — it is why the caterpillar stops mattering. |
| Bunny slipper | `shoes/bunnySlipper.webp` | Ears laid back so the silhouette reads from above. |
| Roller skate | `shoes/rollerSkate.webp` | The wheels **are** the skate from this angle. |
| Cleat boot | `shoes/cleatBoot.webp` | Six studs; the drawing's promise is "this makes holes". |
| Electric sock | `shoes/electricSock.webp` | Soft shape, hard bolt. |

The gilded Fever boot is **not** a separate asset: the renderer re-tints and
scales the equipped shoe, which is what makes the transformation read as *your*
shoe getting huge.

---

## Priority 3 — the bosses

| Slot | File | Frames | Notes |
| --- | --- | --- | --- |
| Goliath Queen Ant | `bosses/queenAnt.webp` | 8 | World 1. Crown is the "this one is the boss" mark. |
| Beetle King | `bosses/beetleKing.webp` | 8 | World 2. |
| The Matriarch | `bosses/matriarch.webp` | 8 | World 3. Spawns pods — read as a carrier. |
| Roach Prime | `bosses/roachPrime.webp` | 8 | World 4. The campaign's last image. |

Each is drawn **from** its base bug, scaled and re-dressed
(`BOSSES[id].base`). Keeping that silhouette is what makes a boss legible the
instant it arrives; a painting that abandons it costs more than it gains.

---

## Priority 4 — the floors

Four **seamless** tiles, one per world. These cover the entire screen, so a soft
tile is a soft game.

| Slot | File | Theme |
| --- | --- | --- |
| World 1 | `bg/floor-1.webp` | Kitchen / picnic blanket — red-and-cream check, crumbs |
| World 2 | `bg/floor-2.webp` | Garden — soil, leaf litter, stones |
| World 3 | `bg/floor-3.webp` | Attic — bare boards, dust, cobweb corners |
| World 4 | `bg/floor-4.webp` | Arcade — dark carpet, neon nebulae |

Author at **≥ 2×** the CSS tile size and keep the wrap exact: motifs must be
redrawn on the far side rather than clipped. `tests/ui/splashTiles.test.ts`
enforces this for the splash tile and is the pattern to copy.

---

## Priority 5 — props and effects

**Props** — `props/crumbs · honey · salt · sweeper · magnet · cobweb · conveyor ·
pod · coin · shoebox`.
Honey and cobweb are the two that change how the game plays; paint those first.

**`props/shoebox` was painted 2026-09-18**, the Shoebox Trials' present: a pink box
with a yellow ribbon and bow, seen from above. It was the first subject that is
pink all over, and it showed that the slicer's spill pass had been greying every
pink and purple subject (see "Whose magenta is it" in `tools/slice-sheets.mjs`).
The slicer now asks the reference drawing first, and those were re-cut the same
day. The logo, Roach Prime's crown, the arcade cabinet's and hopper's neon, the
bunny slipper, the roller skate, the sneaker, the fever ring and the stink haze
have their painted pinks and purples back. Before, the logo's splat was half
see-through. Every other sprite cuts byte-identically to before. The slick lane of
the Spill twist is deliberately never painted — it is a strip as long as the board
it is spilt across.

**FX** — `fx/ring-stomp · ring-slam · ring-fever · burst · haze · salt-cloud ·
spark · scorch · smoke · goo-drop`.

* The three rings are separate assets on purpose: they are drawn at wildly
  different sizes and one ring stretched to all three reads wrong at the extremes.
* `smoke` is the per-particle puff and **must be greyscale** — every emitter
  tints it.
* `goo-drop` is the other tinted particle, and the only **2:1 landscape** still
  in the manifest. It is `useVfx`'s shape 4 — the teardrop a squish, a popped egg
  and a dying boss throw — and the game turns it to whichever way the droplet is
  flying and stretches it with the droplet's own speed. So the painting must be
  **head at the RIGHT, tail at the LEFT**, centred in its frame, and greyscale
  for the same reason `smoke` is: it is tinted to the goo of whatever it came out
  of. Painted at 192x96; `useVfx.bakeDropSprite` tints it with the same three ops
  the dust puff uses, and `paintGooDropRef` is the drawing underneath it.

---

## Priority 6 — the UI marks

`ui/ribbon` (the result banner, nine-sliced by CSS at `BANNER_CAP = 0.171`),
plus `ui/locker · fever · star · timer · target · trophy`.

The ribbon is the only one with a real geometry contract: the end caps are kept
at true size and the middle is stretched, so the two ends must be drawable at any
width without the art in them distorting.

---

## Priority 7 — every button glyph

The icon set (`src/components/icons/iconPaths.ts`) is ~57 solid vector glyphs in
one 24×24 box, and `GameIcon` now probes a painting for each of them before it
draws the path — so the WHOLE UI is paintable, not just the seven marks the HUD
draws on a canvas. No call site opts in; the id comes from
`artCatalogue.artIdForGlyph`.

Six glyphs are already a HUD mark and share its painting rather than getting one
of their own: `boot`→`ui/locker`, `flame`→`ui/fever`, `star`→`ui/star`,
`clock`→`ui/timer`, `target`→`ui/target`, `trophy`→`ui/trophy`. Every other
glyph is `ui/icon-<name>.webp`.

Two registers, and the manifest knows which is which:

* **Marks** — the affordances (play, pause, close, the arrows, the cog). These
  stay FLAT WHITE SILHOUETTES. They sit white on saturated candy plastic at
  16–24 px, where an illustration goes to mud; painting one buys a better
  silhouette, never a picture.
* **Objects** — the nouns (chest, coin, gem, gift, skull, bug, splat…). Full
  house style: flat saturated colour, the ink contour, one cel shadow, light
  from the upper left. This is the half that is worth the generations.

They are LAST on purpose: fifty-one small marks is most of a week's quota, and a
button glyph is the one thing in the game that already looks finished. They also
ride the last preload tier (`artPreload.remainingArtWants`) — the splash waits
for the HUD marks and nothing else.

---

## Priority 8 — the brand: the logo and the greeter

| Slot | File | Notes |
| --- | --- | --- |
| Wordmark | `logo/logo_512x512.png` (+ 256/192 and the `icons/` copies) | The PWA manifest, the favicon and every portal store page read it. |
| Mascot | `logo/mascot.webp` | The ant on the loading screen that a stomp comes for: it yelps as the ring closes in, dodges the shoe, and taunts it. |

Neither is ever probed: the splash must be the same picture on a portal build
with the art layer OFF, so both are read straight off disk and their manifest
targets are explicit (`artCatalogue.ART_BRAND`). `node scripts/make-brand.mjs`
writes ship-quality placeholders at exactly those paths and the slicer writes
over them — the same drop-in contract every other drawable has.

The mascot is authored TOP-DOWN like the rest of the cast. The splash animates
that one file with CSS (a float, a lunge on the shout, a shoulder-shake on the
laugh) and those beats are written against a creature seen from above; a
front-facing character would also stop being the bug on the blanket and start
being a logo with a face.

---

## Not a painting

These stay procedural, deliberately:

* **Splat decals.** Generated per hit from the bug's own goo colour and the
  player's chosen juice style (ooze / confetti / bubbles). A painted splat cannot
  be three styles and nine colours.
* **Comic words** (SQUISH! / CRUNCH! / SPLAT! / ULTRA SPLAT!). They are
  translated — 21 locales — so they are typeset, not drawn.
* **Particles.** Structure-of-arrays pool, tinted at draw time.
* **The stomp ring.** It must agree with the hitbox to the pixel; a painting
  cannot, because the radius changes with the shoe and with Fever.

---

## What is already in `public/images`

Three files survived the chassis copy and are **genuine reuse** — they match a
Bug Crunch slot by name, so the moment the art layer is switched on they are used:

| File | Slot | Why it fits |
| --- | --- | --- |
| `props/coin.webp` | the piñata fly's drop | A bright gold star coin. Also loaded directly by `IconCoin` and the coin burst, art layer or not. |
| `fx/smoke.webp` | the per-particle puff | Greyscale, which is the contract — every emitter tints it. |
| `fx/scorch.webp` | the Fever stomp's mark | Neutral dark ellipse; reads as a scorch on all four floors. |

Everything else the chassis left behind has been moved to
**`public/images/_legacy/`**, out of the probe path, rather than deleted:

* `ribbon-ironplate.webp` — was at `ui/ribbon.webp`, which IS probed. A dark iron
  plate with gold studs is the other game's result banner; switching the art
  layer on would have silently replaced Bug Crunch's red comic ribbon with it.
* `ring-heal / ring-heat / ring-shock` — chrome and rusted-stone rings. Nothing
  probes those names, but they sit one rename away from `ring-stomp`,
  `ring-slam` and `ring-fever`, and they are the wrong art direction for a
  picnic blanket.

If a slot's painting is wrong, this is the move: take it OUT of the folder the
probe reads. The drawing underneath is always there.

---

## Promotional art (needed before submission)

| Asset | Size | Where it is used |
| --- | --- | --- |
| Icon | 512×512, 192×192 | PWA manifest, every portal |
| Cover / thumbnail | 800×450 and 512×384 | CrazyGames, GamePix, GameMonetize |
| Square thumbnail | 512×512 | Poki, Playgama |
| Screenshots | 3–5 at 1280×720 and portrait 720×1280 | every portal |
| Animated preview | 5 s / 10 s / 16 s / 30 s | `pnpm preview:video` builds these from real gameplay |

The logo, favicon, mascot and splash tile are generated by
`node scripts/make-brand.mjs` and are ship-quality placeholders — replace the SVG
in that script rather than the output files, so every size stays in step. The
logo and the mascot are ALSO manifest slots (Priority 8), so the painted versions
drop in over exactly those paths.

The splash TILE is different: `pnpm art:bg-tile` derives it from the paintings
themselves — each sprite is trimmed to its ink, stretched to the full luminance
range and posterised to three greys, which keeps the outline and the big shadow
masses and throws the rest away. Nothing is traced by hand, so repainting a
sprite and re-running it follows the art. It skips a cast member that is not
painted yet and refuses to overwrite the committed tile below four motifs.
