import type { ArtKind, ArtWant } from '@/game/art'
import type { EggLook } from '@/game/bosses'
import type { BugId } from '@/game/bugs'
import { GAME_ICON_NAMES, type GameIconName } from '@/components/icons/iconNames'
import { isLeadFloor, worldOfFloor, type FloorId } from '@/game/floors'

// ─── Which level floors have a painting yet ─────────────────────────────────
//
// Thirty-six of the forty floors are a level's OWN surface and, unlike the four
// a world ships with, they arrive one painting at a time over days. This list
// is the ship manifest for that batch, and it is explicit rather than derived
// for one reason: `spriteFor` probes the network the first time a floor is
// drawn, so an id named here that has no file behind it is a 404 on the level
// that uses it — and CrazyGames' QA console reports every 404 as a broken
// build. A floor that is NOT named here never probes and simply draws itself,
// which is what all thirty-six did before any of them were painted.
//
// So the rule is: add an id the moment its `.webp` lands in
// `public/images/bg/`, and never before.
// `tests/game/floorArt.test.ts` holds this list and that folder together in
// both directions, and `pnpm art:floors` prints the array to paste.
export const LEVEL_FLOOR_ART_IDS: readonly FloorId[] = []

const LEVEL_FLOOR_ART = new Set<string>(LEVEL_FLOOR_ART_IDS)

/**
 * The art id a floor is painted under, or null when nothing is painted for it.
 *
 * ONE rule, used by the renderer's probe and by the preloader alike, because
 * two copies of it drift into either a 404 storm or a painting nobody fetches.
 * A world's lead floor keeps the id it has always shipped under; a level floor
 * uses its own id, and only once its painting is actually in the manifest.
 */
export const floorArtIdFor = (floor: FloorId): string | null => {
  if (isLeadFloor(floor)) return `floor-${worldOfFloor(floor)}`
  return LEVEL_FLOOR_ART.has(floor) ? floor : null
}

/**
 * ─── Every still the renderer can ask for, by kind ──────────────────────────
 *
 * The runtime side of the art manifest. `artSheet.ts` — the bench-side manifest
 * that exports the reference sheets and writes the prompts — is the authority on
 * what each of these IS; this is the list a boot-path module can read without
 * dragging the bench, the painters and the whole renderer in behind it. A test
 * holds the two in agreement (`tests/ui/artManifest.test.ts`).
 *
 * Bugs are not here: their ids are the designs in `bugs.ts`, which is already on
 * the boot path, and they are STRIPS rather than stills. Nor are the shoes,
 * whose ids are the ones in `shoes.ts`, or the bosses, whose ids are in
 * `bosses.ts` — all three modules are pure data and cheap to import.
 *
 * The BRAND bitmaps are not here either. They are painted through the same
 * pipeline but never probed at run time — the splash, the PWA manifest and every
 * portal read them at fixed sizes from a file on disk, so they are named by
 * `ART_BRAND` below with explicit paths instead.
 */

/**
 * The HUD's own marks: the result banner (nine-sliced by CSS) and the six marks
 * `uiArt` fills from a glyph path onto a canvas.
 *
 * Kept as its own list because these are the ONLY ui ids the splash waits for —
 * see `artPreload.criticalArtWants`. The glyph slots below outnumber them five
 * to one and none of them is on screen before the first stomp.
 */
export const UI_HUD_MARKS = [
  'ribbon', 'locker', 'fever', 'star', 'timer', 'target', 'trophy', 'chest'
] as const

/**
 * The glyphs that are ALREADY a HUD mark, mapped to the mark's id.
 *
 * The inverse of `uiArt.UI_ICON_GLYPH`, and the reason it exists: `ui/star.webp`
 * and a would-be `ui/icon-star.webp` are the same picture painted twice. One
 * painting serves the canvas mark AND every `<GameIcon name="star">` in the DOM,
 * which is a sixth of the glyph set that never needs a generation of its own.
 *
 * Stated here rather than imported from `uiArt` because this module is on the
 * boot path and that one drags the whole ink-art vocabulary in behind it; the
 * manifest test holds the two together instead.
 */
export const UI_MARK_FOR_GLYPH = {
  boot: 'locker',
  flame: 'fever',
  star: 'star',
  clock: 'timer',
  target: 'target',
  trophy: 'trophy'
} as const satisfies Partial<Record<GameIconName, string>>

/**
 * ─── The glyphs the GAME colours, not the painter ───────────────────────────
 *
 * A mark in here is painted as a flat white silhouette — `greyscale: true` in
 * `artSheet.ts`, whose prompt says so in as many words — because its colour is
 * STATE, not art. A star is white when it is not yours and gold when it is; a
 * trophy is slate on a chip and cream on a gift card; a boot is white on candy
 * plastic. One painting has to be all of those, so the painting carries the
 * SHAPE and the stylesheet carries the colour, exactly as the vector does.
 *
 * Which matters because the two rungs of `GameIcon` tint differently. The
 * vector is `fill="currentColor"` and obeys `color:` for free. An `<img>` obeys
 * nothing — and that is not a cosmetic difference, it is an INVERSION: with the
 * art layer on, every star the player had just EARNED rendered silver-grey (the
 * untinted greyscale painting) beside an unearned socket rendering warm gold
 * (`icon-star-empty`, painted as a full-colour object). The screen said the one
 * they had not won was the special one.
 *
 * So a painting named here is drawn as a MASK filled with `currentColor`
 * instead of as a picture. Nothing is lost doing it: these are authored as one
 * bold shape with no outline and no shading, so their alpha IS the mark, and
 * masking it makes the painted and vector rungs genuinely interchangeable —
 * which is the whole drop-in contract. Everything NOT in here is an object
 * (the chest, the gem, the heart, the coin) whose colours are its own, and is
 * blitted as painted.
 *
 * `artSheet.ts` reads this same set to decide which prompts ask for a
 * silhouette, so the painting and the renderer cannot drift apart.
 */
export const TINTED_GLYPHS: ReadonlySet<GameIconName> = new Set<GameIconName>([
  // The six that are also a HUD mark (`UI_MARK_FOR_GLYPH` above) — one painting
  // serves the canvas and the DOM, and both tint it.
  'boot', 'flame', 'star', 'clock', 'target', 'trophy',
  // The affordances: pure controls, white on saturated plastic.
  'play', 'pause', 'replay', 'skip-forward', 'skip-back', 'stop',
  'menu', 'home', 'back', 'forward', 'close', 'check',
  'settings', 'shop', 'info', 'help',
  'music', 'music-off', 'sound', 'sound-off',
  'chart', 'leaderboard', 'share', 'fullscreen',
  'plus', 'minus', 'left', 'right', 'up', 'down',
  // `shield` is a noun and still a MARK, because what decides the register is
  // not what a glyph depicts but how small it is drawn. This one is the pierce
  // stat on a shoe card, ten to fourteen pixels wide, under the band an object
  // survives at all. Painted as one it came back a brown shield that reads as a
  // smudge on the navy card, beside two crisp white marks.
  'shield',
  // The empty star socket. It is the same mark as `star` in a different state,
  // and it has to dim to `rgba(255,255,255,0.22)` on the result screen — which
  // an untinted painting cannot do. Masking it uses only its alpha, so the gold
  // outline already on disk becomes the ghosted outline the row wants without
  // being repainted at all.
  //
  // It is the ONE entry `artSheet`'s own copy of this list leaves out, and that
  // divergence is deliberate and explained there: reclassifying it would re-pack
  // the painter's contact sheets for a mark that needs no repainting. A hollow
  // outline is the one shape whose colours cannot matter once it is masked.
  'star-empty'
])

/** Is this glyph's painting a silhouette the stylesheet colours? */
export const isTintedGlyph = (name: GameIconName): boolean => TINTED_GLYPHS.has(name)

/**
 * The art id a glyph is painted under — its HUD mark where it has one, and
 * `icon-<name>` otherwise.
 *
 * `GameIcon` asks this, so EVERY glyph the game draws can be replaced by a
 * painting without a call site opting in. A glyph with no painting is the
 * vector path, exactly as before, and with the art layer off nothing is even
 * requested.
 */
export const artIdForGlyph = (name: GameIconName): string =>
  (UI_MARK_FOR_GLYPH as Partial<Record<GameIconName, string>>)[name] ?? `icon-${name}`

/**
 * One slot per glyph that is not already a HUD mark.
 *
 * DERIVED from `GAME_ICON_NAMES` rather than typed out, so a glyph added to the
 * icon set is paintable the moment it exists — the set is the closed union of
 * everything the UI can draw, and a manifest that had to be edited alongside it
 * would be a manifest that is quietly one glyph short for a month.
 */
export const UI_GLYPH_ART_IDS: readonly string[] = GAME_ICON_NAMES
  .filter((n) => !(n in UI_MARK_FOR_GLYPH))
  .map((n) => `icon-${n}`)

/**
 * The brand bitmaps: painted through the pipeline, read straight off disk.
 *
 * Neither is probed by `spriteFor` — the splash is not optional and must be the
 * same picture on every build, including the portal builds that ship with the
 * art layer off — so they are named once, here, and the splash reads these
 * constants instead of spelling the paths out a second time.
 *
 * `scripts/make-brand.mjs` writes ship-quality placeholders at both paths; the
 * slicer writes over exactly the same paths when the paintings land.
 */
export const ART_BRAND = {
  /** The wordmark. The PWA manifest and every portal read it at fixed sizes. */
  logo: 'images/logo/logo_512x512.png',
  /** The greeter on the loading screen — the ant that dodges a stomp and taunts the shoe. */
  mascot: 'images/logo/mascot.webp'
} as const

/**
 * The brood's paintings — see "The brood" in `bosses.ts`.
 *
 * Each egg look is a STAGE sheet (whole → hairline → cracked → splitting, read
 * back as one strip) plus the empty shell a hatch leaves on the floor. Named here
 * rather than beside the painter because the preloader needs them for a boss
 * level and this module is the one on the boot path.
 */
export const EGG_ART_ID: Record<EggLook, string> = { egg: 'egg', capsule: 'egg-capsule' }
export const EGG_SHELL_ART_ID: Record<EggLook, string> = { egg: 'egg-shell', capsule: 'egg-capsule-shell' }
export const EGG_PROP_IDS = ['egg', 'egg-shell', 'egg-capsule', 'egg-capsule-shell'] as const
export type EggPropId = (typeof EGG_PROP_IDS)[number]

/**
 * The bug PARTS — paintings a creature is composed from that are not a design
 * of their own, keyed by the design they belong to.
 *
 * The one there is: a centipede is a painted head (its walk strip, `bug/centipede`)
 * towing a chain of segments that `bugArt.paintSegment` draws one at a time, each
 * on its own lag behind the head. Those segments were the last thing on a
 * painted board still inked, so they get a strip of their own under the same
 * `images/bugs/` folder, and they are wanted wherever their design is.
 */
export const CENTIPEDE_SEGMENT_ART = 'centipede-segment'
export const BUG_PART_ART: Readonly<Partial<Record<BugId, readonly string[]>>> = {
  centipede: [CENTIPEDE_SEGMENT_ART]
}
export const BUG_PART_ART_IDS: readonly string[] = Object.values(BUG_PART_ART).flat()

/** The paintings a design is drawn with besides its own walk strip. */
export const bugPartWants = (id: BugId): ArtWant[] =>
  (BUG_PART_ART[id] ?? []).map((part) => ['bug', part] as const)

export const ART_CATALOGUE: Record<Exclude<ArtKind, 'bug' | 'shoe' | 'boss'>, readonly string[]> = {
  prop: [
    // The seven floor objects, in the order a campaign meets them.
    'crumbs', 'honey', 'salt', 'sweeper', 'magnet', 'cobweb', 'conveyor',
    // The Shoebox Trial's present, dropped in by a level rather than laid out.
    // (Its sibling the SLICK lane is never painted — see `paintHazard`.)
    'shoebox',
    // The boss egg pod, and the coin the piñata fly drops.
    'pod', 'coin',
    // The brood: the ant egg and Roach Prime's capsule, each a four-panel crack
    // STAGE sheet, and each one's empty shell. `pod` stays — it is the whole-egg
    // still painted before the stages existed, and the fallback under them.
    ...EGG_PROP_IDS
  ],
  fx: [
    // The three rings: a quick stomp's ripple, a slam's shockwave, and Fever's
    // screen-clearing wave. One drawable each because they are drawn at wildly
    // different sizes and a single ring stretched to all three reads wrong at
    // the extremes.
    'ring-stomp', 'ring-slam', 'ring-fever',
    // The burst behind a comic word, the stink bug's haze, the salt cloud, and
    // the spark a ricochet throws.
    'burst', 'haze', 'salt-cloud', 'spark',
    // The scorch a Fever stomp leaves, the soft puff every particle bucket
    // tints per emitter, and the goo droplet every burst throws (both greyscale
    // by contract — see `artSheet.ts`).
    'scorch', 'smoke', 'goo-drop',
    // The floor decals, one four-panel VARIATION strip each. Two and not three:
    // `ooze` and `bubble` already share one picture in `paintSplat` and share
    // this one, while `confetti` branches to chips and gets its own. Greyscale
    // by contract — the game tints each stamp to the goo of whatever it came out
    // of, which is why there cannot be one file per bug colour.
    'splat', 'splat-confetti'
  ],
  // ── One seamless tile per FLOOR, and there are forty floors ──
  //
  // The four a world ships with keep ids built from the world NUMBER rather
  // than its theme name, so `floorArt` can derive them from the level without a
  // lookup table that could drift out of step with `stages.ts`.
  //
  // The other thirty-six are keyed on the floor's own id, because that is what
  // they are paintings OF — `picnic-planks` is the picnic table with the
  // blanket off it, and no formula relates it to the level it appears on. They
  // were deliberately absent from this list while they were procedural: a
  // catalogue entry is what makes the preloader ask for a file, and thirty-six
  // entries with no files behind them is thirty-six 404s on a portal that
  // grades them. They belong here now because they are being painted; an id
  // whose painting has not landed yet is still free at runtime (the floor draws
  // itself) but WILL be fetched, so keep this list and the folder in step.
  bg: ['floor-1', 'floor-2', 'floor-3', 'floor-4', ...LEVEL_FLOOR_ART_IDS],
  // The DOM's own art — the result banner and the six HUD marks, shown through
  // `ArtIcon` and `FReward` (see `uiArt.ts`) — and then one slot for every other
  // glyph in the icon set, shown through `GameIcon`.
  ui: [...UI_HUD_MARKS, ...UI_GLYPH_ART_IDS],
  // The cutscenes' set dressing, in the order the scenes meet it: the picnic
  // (01, 02, 05), the attic and its door (03), the arcade (04), and 1-10's
  // nursery. The creatures, the bosses, the hazards and the floors in those
  // scenes are the game's own paintings and are not repeated here.
  scene: [
    'plate', 'sandwich', 'glass', 'book', 'crumb',
    'attic-box', 'door',
    'cabinet', 'hopper',
    'nest', 'puff'
  ]
}
