# Splatix — art to-do

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
| `ui` | `public/images/ui/` | the result banner and the HUD marks |

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
| Moth | `bugs/moth.webp` | 8 | Airborne; wings need a clear up/down in the cycle. |
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
pod · coin`.
Honey and cobweb are the two that change how the game plays; paint those first.

**FX** — `fx/ring-stomp · ring-slam · ring-fever · burst · haze · salt-cloud ·
spark · scorch · smoke`.

* The three rings are separate assets on purpose: they are drawn at wildly
  different sizes and one ring stretched to all three reads wrong at the extremes.
* `smoke` is the per-particle puff and **must be greyscale** — every emitter
  tints it.

---

## Priority 6 — the UI marks

`ui/ribbon` (the result banner, nine-sliced by CSS at `BANNER_CAP = 0.171`),
plus `ui/locker · fever · star · timer · target · trophy`.

The ribbon is the only one with a real geometry contract: the end caps are kept
at true size and the middle is stretched, so the two ends must be drawable at any
width without the art in them distorting.

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
Splatix slot by name, so the moment the art layer is switched on they are used:

| File | Slot | Why it fits |
| --- | --- | --- |
| `props/coin.webp` | the piñata fly's drop | A bright gold star coin. Also loaded directly by `IconCoin` and the coin burst, art layer or not. |
| `fx/smoke.webp` | the per-particle puff | Greyscale, which is the contract — every emitter tints it. |
| `fx/scorch.webp` | the Fever stomp's mark | Neutral dark ellipse; reads as a scorch on all four floors. |

Everything else the chassis left behind has been moved to
**`public/images/_legacy/`**, out of the probe path, rather than deleted:

* `ribbon-ironplate.webp` — was at `ui/ribbon.webp`, which IS probed. A dark iron
  plate with gold studs is the other game's result banner; switching the art
  layer on would have silently replaced Splatix's red comic ribbon with it.
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
in that script rather than the output files, so every size stays in step.
