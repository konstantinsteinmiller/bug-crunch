import type { ArtKind } from '@/game/art'

/**
 * ─── Every still the renderer can ask for, by kind ──────────────────────────
 *
 * The runtime side of the art manifest. `artSheet.ts` — the bench-side manifest
 * that exports the reference sheets and writes the prompts — is the authority on
 * what each of these IS; this is the list a boot-path module can read without
 * dragging the bench, the painters and the whole renderer in behind it. A test
 * holds the two in agreement.
 *
 * Bugs are not here: their ids are the designs in `bugs.ts`, which is already on
 * the boot path, and they are STRIPS rather than stills. Nor are the shoes,
 * whose ids are the ones in `shoes.ts`, or the bosses, whose ids are in
 * `bosses.ts` — all three modules are pure data and cheap to import.
 *
 * The logo is not here either. It is painted through the same pipeline but never
 * probed at run time — the manifest lists it with an explicit target under
 * `images/logo/`, where the PWA manifest and the portals read it.
 */
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
  // The DOM's own art — the result banner (nine-sliced by CSS) and the six HUD
  // marks, shown through `ArtIcon` and `FReward`. See `uiArt.ts`.
  ui: ['ribbon', 'locker', 'fever', 'star', 'timer', 'target', 'trophy']
}
