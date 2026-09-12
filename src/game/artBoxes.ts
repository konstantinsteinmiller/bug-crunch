/**
 * ─── Painted-art boxes the manifest shares with the renderer ────────────────
 *
 * The geometry a painting is blitted into, for the stills whose box is not
 * simply their panel. They live HERE, in a module with no imports, rather than
 * beside the painters in `useSurvivalArt`, because the art manifest
 * (`artSheet.ts`) needs them too — and the manifest has to load under plain Node
 * for `pnpm art:prompts`, where the renderer (Vue, the save, the audio) cannot.
 * `useSurvivalArt` imports and re-exports both, so nothing that read them from
 * there had to change.
 */

/**
 * The gate frame painting's own geometry, shared with the art bench.
 *
 * The reference is drawn at `ppu` px per world unit with a two-leaf door
 * (`refHalfW`) centred in a `w` x `h` panel, the leaf's origin at the panel's
 * centre. `cap` is how much of each side is blitted at true size; the span
 * between the caps is stretched to whatever leaf it is drawn on.
 */
export const GATE_FRAME = { ppu: 220, w: 1344, h: 576, cap: 260, refHalfW: 2.05 } as const

/**
 * The box a painted rocket is blitted into, in units of the shell's radius
 * `rr`: `w` wide and `h` tall, its top edge `top` above the shell's centre.
 * 9:16 — a ratio the image tools offer — with the plume given the room it
 * has in the drawing.
 */
export const ROCKET_BOX = { w: 3.6, h: 6.4, top: 2 } as const
