import type { ArtKind } from '@/game/art'
import { GAME_ICON_NAMES, type GameIconName } from '@/components/icons/iconNames'

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
  'ribbon', 'locker', 'fever', 'star', 'timer', 'target', 'trophy'
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
  /** The greeter on the loading screen — the ant that shouts BOO and giggles. */
  mascot: 'images/logo/mascot.webp'
} as const

export const ART_CATALOGUE: Record<Exclude<ArtKind, 'bug' | 'shoe' | 'boss'>, readonly string[]> = {
  prop: [
    // The seven floor objects, in the order a campaign meets them.
    'crumbs', 'honey', 'salt', 'sweeper', 'magnet', 'cobweb', 'conveyor',
    // The boss egg pod, and the coin the piñata fly drops.
    'pod', 'coin'
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
    // The scorch a Fever stomp leaves, and the soft puff every particle bucket
    // tints per emitter (greyscale by contract — see `artSheet.ts`).
    'scorch', 'smoke'
  ],
  // One seamless floor tile per world. The ids are keyed on the world NUMBER
  // rather than its theme name so `floorArt` can build the id from the level
  // without a lookup table that could drift out of step with `stages.ts`.
  bg: ['floor-1', 'floor-2', 'floor-3', 'floor-4'],
  // The DOM's own art — the result banner and the six HUD marks, shown through
  // `ArtIcon` and `FReward` (see `uiArt.ts`) — and then one slot for every other
  // glyph in the icon set, shown through `GameIcon`.
  ui: [...UI_HUD_MARKS, ...UI_GLYPH_ART_IDS]
}
