# Art todo — drop-in manifest

Survivalist draws **everything** from code: the survivors and the monster cast
are hand-inked vector art baked to frame strips at runtime, and the lane, gates,
crates, rounds and effects are Canvas 2D. Nothing below is required for the game
to ship — each entry is an *optional upgrade* that replaces a procedural drawing
with a painting, with **no code change**: drop the file at the exact path,
switch the art layer on, and the renderer picks it up. A missing or
still-decoding file always falls back to the drawing.

**Every path here is produced by the art pipeline** rather than by hand — see
[`art-sheets/README.md`](./art-sheets/README.md). The `/art-sheets` bench
exports a reference sheet and a master prompt per entry, an image model paints
it in the dark-fantasy register, and `pnpm slice-sheets` cuts the return back to
the path, registered against the drawing it replaces. The manifest that owns
this table is `src/game/artSheet.ts`; the runtime catalogue is
`src/game/artCatalogue.ts`; a test keeps the two in step.

Format for everything: **WebP**, sRGB, premultiplied alpha, at the size the
slicer caps it to: **256 px tall per frame** by default, or the manifest's
`maxEdge` where that is smaller. The logo is PNG, at the 512 its PWA icon needs.

**Nothing may read fixed pixel offsets out of one of these files.** The size
above is a payload decision and it changes; the reference sizes in `artSheet.ts`
are the shape the sheet is PAINTED at, not the shape it is written at. The gate
frame's nine-slice cut at `GATE_FRAME`'s own 1344x576 and lost its right-hand
post entirely the first time the gates were re-sliced at the default cap — the
cut simply started past the end of a 597 px file. Slice by FRACTION of the
bitmap that arrived, the way `paintGateFrame` and `blitBanner` both do now.

**The paintings are OFF by default.** `spriteFor()` probes nothing until
`?art=on` (remembered per device) or `VITE_ENABLE_ART_OVERRIDES=true` in the
build's env — a portal's QA console reports every missed probe as a broken
resource, so the flag stays off in every `.env.<platform>` until the art is in.

## Walk cycles (strips: N panels side by side, one locomotion cycle)

| Path | Subject | Notes |
| --- | --- | --- |
| `public/images/monsters/<design>.webp` | each of the 13 designs in `monsters.ts` | Played from the same clock as the bake, so the swap is seamless mid-stride. Authored facing as the bake does; the field mirrors by travel. Frame count is read off the strip's shape. |
| `public/images/heroes/<outfit>.webp` | the survivor, ×3 (`teal`, `amber`, `violet`) | Seen from BEHIND; the outfit's coat colour is its identity in the crowd. |

## Stills

| Path | Subject | Stays live over it |
| --- | --- | --- |
| `public/images/props/crate-damage.webp` | green-sealed supply crate | rim, chevron badge, HP number |
| `public/images/props/crate-rate.webp` | blue-sealed supply crate | rim, bolt badge, HP number |
| `public/images/props/barricade.webp` | barricade stone, **tiles left↔right** | chevrons, damage bar, HP number |
| `public/images/props/boulder-1..3.webp` | unbreakable boulder, three silhouettes | — (no number, on purpose) |
| `public/images/props/barrel.webp` | powder keg, intact | damage cracks, lit strobe |
| `public/images/props/pillar.webp` | divider pillar, 288×640 box | warning glow, hot overlay, beacon, topple |
| `public/images/props/coin.webp` | face-on coin | the spin (a squash on X) |
| `public/images/props/weapon-box.webp` | the weapon puzzle's prize, **shut** — cold, inert steel | weapon glyph, the shut cross-brace |
| `public/images/props/weapon-box-open.webp` | the same case **open** — lit, warm, obviously a pickup | weapon glyph, cracks, halo, reveal ring |
| `public/images/props/guard-plate.webp` | one plate of the armour over the shut case; **two butt edge to edge** | the damage dim, the hit flash |
| `public/images/props/lever-post.webp` | the lever's housing, 512×256 — bolted to the road, never moves | — |
| `public/images/props/lever-arm.webp` | the lever's arm, authored **UP**, 288×512, socket left EMPTY | the swing, the red/green knob in the socket |
| `public/images/gates/frame-add|sub|mul|div.webp` | gate frame per op, **nine-sliced** across the leaf | curtain, chevrons, plate, charge meter, sparks |
| `public/images/rounds/tracer.webp` | the crowd's round, authored UP | batched per bullet |
| `public/images/rounds/bolt-gunner.webp` | gunner's round, authored RIGHT | turned to heading |
| `public/images/rounds/bolt-boss.webp` | healer's bolt, authored RIGHT | turned to heading, ground shadow |
| `public/images/rounds/roller.webp` | the rolling boulder, face-on | scrolling bands, lane, shadow |
| `public/images/rounds/meteor.webp` | the boss's rock, tail UP | the ground mark |
| `public/images/rounds/bomb.webp` | bomber's charge | the fuse spark, the ring |
| `public/images/rounds/grenade.webp` | player's grenade | the tumble, the fuse spark, trail |
| `public/images/rounds/rocket.webp` | the launcher's rocket, nose UP, 288×512 box | turned to heading; the blast |
| `public/images/fx/muzzle.webp` | muzzle flash (additive) | the fade |
| `public/images/fx/smoke.webp` | smoke puff, **greyscale** | tinted per emitter |
| `public/images/fx/scorch.webp` | scorch mark, 512×282 | the fade |
| `public/images/fx/ring-shock|heat|heal.webp` | the three ring families, full circles | squashed flat, faded |
| `public/images/fx/shield.webp` | shield dome, face-on circle | ground ring, crest, countdown |
| `public/images/fx/guard.webp` | boss guard hexagon | crest, pulse |
| `public/images/fx/crest-shield|guard.webp` | the two heater-shield crests | — |
| `public/images/bg/ridge-far|near.webp` | ridge silhouettes, 1536×384, sky keyed | tinted per stage |
| `public/images/ui/crown.webp` | the elite's crown | — |
| `public/images/ui/ribbon.webp` | the result screen's banner, 1344×576, **nine-sliced by CSS** at the outer 17% | the title, printed across the middle band |
| `public/images/ui/chest.webp` | the shop button's chest (HUD and result screen) | — |
| `public/images/ui/skill-grenade.webp` | the grenade skill's button icon (skill bar and shop row) | the cooldown ring and count |
| `public/images/ui/skill-shield.webp` | the shield skill's button icon (skill bar and shop row) | the cooldown ring and count |
| `public/images/ui/weapon-card-rocket.webp` | the **weapon choice**'s launcher card — the launcher alone, three-quarter front-left, muzzle to the upper right, ember glow in the tube; ~100 px on screen, seen once | the plate, the halo, the ribbon, the perk lines, the ray burst (all DOM) |
| `public/images/ui/weapon-card-gatling.webp` | the weapon choice's gatling card — six barrels mid-spin, soul-blue glow between them, brass casings falling; same angle as the launcher so the pair reads as a set | the plate, the halo, the ribbon, the perk lines, the ray burst (all DOM) |
| `public/images/logo/logo_512x512.png` (+192 png, +256 webp) | the title logo | — |

## Owed by the three new roadside props (drawn procedurally today)

Added with the rescue cages, the auto-shield pickup and the open-box weapon
gift. All three are drawn from code right now and look finished; these are the
optional paintings. **Each needs its manifest wiring to land in the same pass**
— a `still(...)` in `src/game/artSheet.ts`, the id in `ART_CATALOGUE`, and a
`case` in `ArtSheets.vue` — because `artSheet.test.ts` pins the three in
agreement and a half-wired entry fails it.

| Path | Subject | Stays live over it |
| --- | --- | --- |
| `public/images/props/cage.webp` | a shut, tall barred iron cage lit from INSIDE, a huddled figure visible through the bars. Reference cell **1.5× taller than wide** (`CAGE_DRAW_TALL`), footprint `CAGE_R` = 0.68 square. The grey-iron/warm-lamp contrast is the entire read — **no coloured rim** | the `+N` on the lid, the HP number under the base (leave both areas clear) |
| `public/images/props/cage-open.webp` *(optional)* | the burst frame, if the two-state treatment `weapon-box` / `weapon-box-open` already has is wanted here too | — |
| `public/images/props/bulwark-box.webp` | squat dark-steel housing, `BULWARK_R` = 0.62 square, blue rim. Paint it **without** the crest on its face | the shield crest (drawn over the bitmap and rotates), the rim |
| `public/images/props/weapon-box-lid.webp` | the weapon case's own lid, hinged away up the road and lying almost flat — dark scorched wood banded with blackened iron, seen from behind and above so the camera reads its underside, its far rim catching the warm light spilling out of the open case. Aspect **2.425 : 1** (panel 512×211, `maxEdge` 256) | nothing — if the lit far rim is painted in, the renderer's procedural rim comes out in the same pass |
| `public/images/props/weapon-prize-gatling.webp` / `-rocket.webp` *(optional)* | the loose gun sitting in the open crate, so the lifted prize is a painting rather than the `weaponGlyph`. The existing `ui/weapon-card-*` stills are close in spirit but are three-quarter presentation cards at ~100 px; this wants the crate's own top-down-ish angle | the bob, the contact shadow |

Nothing is owed for the armed-bulwark badge over the crowd or the box's crest:
both draw through `paintCrest` on the existing `fx/crest-shield`. No sound is
owed either — all three props' cues are synthesised.

## Shipping today (the asset library's own bitmaps, always on)

| Path | Subject | Notes |
| --- | --- | --- |
| `public/images/props/box_256x256.webp` | supply crate | Stands in for both crates until `crate-damage` / `crate-rate` arrive. |
| `public/images/props/stone_256x256.webp` | barricade block | Tiled horizontally. |
| `public/images/props/coin_128x128.webp` | coin | Face-on. |

## Deliberately NOT bitmaps

* **The road tile** — a painted cobble tile was tried through the pipeline and
  was worse than the drawing: stones big enough to read at all read as objects
  under the crowd, and the ground must never compete with what stands on it.
  `paintLaneTile` in `useSurvivalArt.ts` has no probe on purpose.
* **Particles other than the smoke puff** — sparks, shards and dots are a few
  pixels each and tinted per emitter; a painting buys nothing at that size.
* **The gate curtain, the plate, the chevrons, the dismissal debris, the
  vignette, the speed lines** — additive or text-bearing Canvas work that
  animates every frame; a bitmap would only make them heavier or freeze them.
* **The claw furrows, the elite sweep band, the rocket's blast** — telegraphs
  and hits drawn from the simulation's own numbers, and a painting that stayed
  one size would be a lie the player only discovers by dying to it. (The
  rocket ITSELF is painted — it is an object with a fixed size — the blast is
  not.)

## Promo art still needed for store listings

| Path | Size | Notes |
| --- | --- | --- |
| `src/assets/promotion/cover_1080x1920.webp` | 1080×1920 | Portrait key art: a big crowd mid-gate-pass, the `+12` plate blown out. |
| `src/assets/promotion/cover_1920x1080.webp` | 1920×1080 | Landscape variant of the same moment. |
| `src/assets/promotion/cover_800x800.webp` | 800² | Square icon-ish crop — crowd + one gate. |
| `public/favicon.ico` | 48² | Derive from the painted logo once it lands. |
