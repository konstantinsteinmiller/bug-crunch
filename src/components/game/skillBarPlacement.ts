/**
 * ─── Where the skill row sits ───────────────────────────────────────────────
 *
 * One number, kept in its own module because `SkillBar.vue` and the spec that
 * pins the gap both need it and neither should own it.
 *
 * ─── What used to be here ───────────────────────────────────────────────────
 *
 * A rule — `skillRowFitsUnderSquad` / `skillRowTopPx` — that measured the
 * viewport and CHOSE between two layouts: the row parked on the bottom strip
 * under the squad when there was room for it, and a column out at the right
 * edge of the screen when there was not. The reasoning was sound and the
 * measurement was correct; a landscape phone really does put a full-size
 * crowd's last body about three pixels above the HUD strip, so the fallback
 * fired exactly where it was designed to.
 *
 * It is gone because the fallback was wrong on the one viewport it mattered
 * most on. On a desktop the column landed beside the road — off the play
 * surface, in the far corner of a wide screen, nowhere near the thing the
 * player is watching — and the owner asked for the row to sit under the squad
 * on every viewport, shrunk to the lane, the way it already did on a phone.
 * Two layouts also meant two sets of positions to reason about for every
 * feature that has to avoid the buttons.
 *
 * So there is one layout now, and it needs no measurement to choose: the row is
 * centred on the lane in the stylesheet and parked on the bottom strip, and it
 * shrinks to fit the lane rather than moving off it. `SkillBar.vue` carries the
 * whole of that argument, including the cost accepted on a landscape phone.
 */

/** Gap between the row and the HUD strip beneath it, CSS pixels. */
export const SKILL_ROW_HUD_GAP_PX = 10
