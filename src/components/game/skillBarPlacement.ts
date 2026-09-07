/**
 * ─── Where the skill row goes ───────────────────────────────────────────────
 *
 * The rule `SkillBar.vue` places itself with, pulled out of the component so it
 * can be measured without a layout engine — jsdom has none, and the decision
 * this makes is exactly the kind that goes quietly wrong on one device.
 *
 * The geometry it reasons about, all in CSS pixels:
 *
 *      0 ┌──────────────────┐
 *        │   road, crowd    │
 *        │        ▓▓        │ ← the anchor row, at `CROWD_SCREEN_Y`
 *        │       ▓▓▓▓       │
 *        ├──────────────────┤ ← `squadFloorPx`: a FULL-SIZE crowd's last body
 *        │   [ ● ]  [ ● ]   │ ← the row, parked on the strip below it
 *        ├──────────────────┤ ← `viewportPx - hudBottomPx`
 *        │  mute   settings │   the bottom HUD strip
 *        └──────────────────┘
 *
 * The row is pushed as LOW as the strip allows rather than centred in the band,
 * because the whole point of moving it under the squad is to be far from where
 * a steering cursor lives — every pixel of that gap is bought from the same
 * budget, and the strip below is UI rather than road.
 */

/** Gap between the row and the HUD strip beneath it. */
export const SKILL_ROW_HUD_GAP_PX = 10

export interface SkillRowSpace {
  /** Viewport height. */
  viewportPx: number
  /** Height of the bottom HUD strip, safe-area padding included. */
  hudBottomPx: number
  /** The lowest pixel a survivor can ever be drawn at — the crowd's anchor row
   *  plus a full-size crowd's radius plus one body. */
  squadFloorPx: number
  /** One button's height. The row is one button tall. */
  buttonPx: number
}

/** Top edge of the row once it is parked on the HUD strip. */
export const skillRowTopPx = (s: SkillRowSpace): number =>
  s.viewportPx - s.hudBottomPx - SKILL_ROW_HUD_GAP_PX - s.buttonPx

/**
 * Is there room under the squad for it?
 *
 * The test is the promise the placement makes: the row's TOP edge clears the
 * crowd's floor. Anything less would draw the buttons over the back ranks of a
 * big squad — a control sitting on the one thing it was moved to be far from —
 * so a viewport that cannot pay for it (a landscape phone: measured at
 * 844x390 the crowd's footprint ends 3 px above the strip) keeps the old
 * right-edge column instead, out beside the road where no crowd ever goes.
 *
 * The zero guards are the pre-measurement state: a component that has not been
 * laid out yet, or a scene that has not sized the camera. Both mean "not known
 * to be safe", and the fallback is the safe answer.
 */
export const skillRowFitsUnderSquad = (s: SkillRowSpace): boolean =>
  s.buttonPx > 0 && s.squadFloorPx > 0 && skillRowTopPx(s) >= s.squadFloorPx
