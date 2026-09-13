/**
 * ─── Painted-art boxes the manifest shares with the renderer ────────────────
 *
 * The geometry a painting is blitted into, for the drawables whose box is not
 * simply a square. They live HERE, in a module with no imports, rather than
 * beside the painters, because the art manifest (`artSheet.ts`) needs them too
 * — and the manifest has to load under plain Node for `pnpm art:prompts`, where
 * the renderer (Vue, the save, the audio) cannot.
 */

/**
 * The box a painted shoe is authored in, in units of the shoe's half-length.
 *
 * PORTRAIT, and that is the whole reason this constant exists: the shoe body is
 * roughly square, but the ankle and lower leg recede out of the frame BEHIND the
 * heel and need room the body does not. `toeFromTop` is where the toe sits
 * inside that box as a fraction of its height — the renderer anchors the
 * painting on it, so a painting with a longer leg still lands with its toe on
 * the stomp point.
 */
export const SHOE_BOX = { w: 2.2, h: 4.4, toeFromTop: 0.26 } as const

/**
 * The result banner's nine-slice, as a fraction of its own width.
 *
 * Mirrors `uiArt.BANNER.cap`. Stated separately here so a Node-side tool can
 * reason about the cut without importing the painter.
 */
export const BANNER_CAP = 0.171
