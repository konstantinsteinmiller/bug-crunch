import type { ArtKind } from '@/game/art'

/**
 * ─── Every still the renderer can ask for, by kind ──────────────────────────
 *
 * The runtime side of the art manifest. `artSheet.ts` — the bench-side
 * manifest that exports the reference sheets and writes the prompts — is the
 * authority on what each of these IS; this is the list a boot-path module can
 * read without dragging the bench, the painters and the whole renderer in
 * behind it. A test holds the two in agreement.
 *
 * Monsters and survivors are not here: their ids are the designs in
 * `monsters.ts` and the outfits in `heroSprites.ts`, and both modules are
 * already on the boot path.
 *
 * The logo is not here either. It is painted through the same pipeline but
 * never probed at run time — the manifest lists it with an explicit target
 * under `images/logo/`, where the PWA manifest and the portals read it.
 */
export const ART_CATALOGUE: Record<Exclude<ArtKind, 'monster' | 'hero'>, readonly string[]> = {
  prop: [
    'crate-damage', 'crate-rate', 'barricade',
    'boulder-1', 'boulder-2', 'boulder-3',
    'barrel', 'pillar', 'coin',
    // The weapon puzzle: the prize shut and open, the armour over it, and the
    // lever that opens it — a housing and a swinging arm.
    'weapon-box', 'weapon-box-open', 'guard-plate', 'lever-post', 'lever-arm'
  ],
  gate: ['frame-add', 'frame-sub', 'frame-mul', 'frame-div'],
  round: ['tracer', 'bolt-gunner', 'bolt-boss', 'roller', 'meteor', 'bomb', 'grenade', 'rocket'],
  fx: [
    'muzzle', 'smoke', 'scorch',
    'ring-shock', 'ring-heat', 'ring-heal',
    'shield', 'guard', 'crest-shield', 'crest-guard'
  ],
  // No road tile: painted cobbles read as objects under the crowd, and the
  // procedural gravel stays. See `artSheet.ts`.
  bg: ['ridge-far', 'ridge-near'],
  // The crown is on the field; the rest are the DOM's — the result banner
  // (nine-sliced by CSS), the shop chest and the two skill buttons' icons,
  // shown through `ArtIcon` and `FReward`. See `uiArt.ts`.
  ui: ['crown', 'ribbon', 'chest', 'skill-grenade', 'skill-shield']
}
