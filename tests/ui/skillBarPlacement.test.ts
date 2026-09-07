import { describe, expect, it } from 'vitest'
import {
  SKILL_ROW_HUD_GAP_PX, skillRowFitsUnderSquad, skillRowTopPx
} from '@/components/game/skillBarPlacement'
import { CROWD_MAX_R, CROWD_SCREEN_Y, LANE_HALF, UNIT_R, VIEW_HEIGHT } from '@/game/survival'

/**
 * ─── Where the skill row lands, per device ──────────────────────────────────
 *
 * The skill buttons moved off the right rail and under the squad, because
 * reaching for them with a MOUSE dragged the crowd across the road and parked
 * it against that rail — the cursor steers while it is over the lane, so the
 * cost of pressing a skill was the run.
 *
 * The placement can only be taken where the screen pays for it, and that is a
 * geometry question with a different answer per device. jsdom has no layout
 * engine, so the rule is asserted against viewports MEASURED in a real browser
 * (Chrome, dev build, `.scene__top` / `.scene__bottom` read off the live HUD)
 * rather than against a rendered component:
 *
 *   1440x820 desktop      HUD strip 75 px   → 18 px of clearance, takes it
 *    390x844 phone        HUD strip 60 px   → 48 px of clearance, takes it
 *    844x390 phone, wide  HUD strip 75 px   → 65 px of overlap, falls back
 *
 * The landscape row is the load-bearing case: the camera's minimum zoom keeps a
 * full-size crowd 3 px off the HUD strip there, so a row under the squad would
 * be a row ON the squad, and the old right-edge column is correct instead.
 */

/** The scene's own sums, so a change to the camera moves this file with it. */
const cameraScale = (w: number, h: number, hudTop: number, hudBottom: number): number =>
  Math.max(16, Math.min(w / (LANE_HALF * 2 + 1.1 * 2), Math.max(160, h - hudTop - hudBottom) / VIEW_HEIGHT))

const squadFloorPx = (w: number, h: number, hudTop: number, hudBottom: number): number =>
  h * CROWD_SCREEN_Y + (CROWD_MAX_R + UNIT_R) * cameraScale(w, h, hudTop, hudBottom)

interface Device {
  name: string
  w: number
  h: number
  /** Measured in the browser: bar height + the scene's 8 px pad. */
  hudTop: number
  hudBottom: number
  /** The `clamp(2.9rem, 13vw, 3.6rem)` button, as it computes on that screen. */
  buttonPx: number
  under: boolean
}

const DEVICES: Device[] = [
  { name: 'desktop 1440x820', w: 1440, h: 820, hudTop: 68, hudBottom: 75, buttonPx: 58, under: true },
  { name: 'phone portrait 390x844', w: 390, h: 844, hudTop: 54, hudBottom: 60, buttonPx: 51, under: true },
  { name: 'phone landscape 844x390', w: 844, h: 390, hudTop: 68, hudBottom: 75, buttonPx: 58, under: false }
]

describe('the skill row only sits under the squad where it fits', () => {
  it.each(DEVICES)('$name', (d) => {
    const space = {
      viewportPx: d.h,
      hudBottomPx: d.hudBottom,
      squadFloorPx: squadFloorPx(d.w, d.h, d.hudTop, d.hudBottom),
      buttonPx: d.buttonPx
    }
    expect(skillRowFitsUnderSquad(space), `${d.name} chose the wrong layout`).toBe(d.under)
  })

  it('clears a full-size crowd wherever it does sit under the squad', () => {
    for (const d of DEVICES.filter((x) => x.under)) {
      const space = {
        viewportPx: d.h,
        hudBottomPx: d.hudBottom,
        squadFloorPx: squadFloorPx(d.w, d.h, d.hudTop, d.hudBottom),
        buttonPx: d.buttonPx
      }
      // The promise the placement makes, and the whole reason for the fallback:
      // the top of the row is below the last body of the biggest possible squad.
      expect(skillRowTopPx(space), `${d.name} would draw the buttons on the crowd`)
        .toBeGreaterThanOrEqual(space.squadFloorPx)
      // …and it is parked on the HUD strip rather than floating in the band, so
      // the gap it does have is spent on the side the cursor comes from.
      expect(d.h - skillRowTopPx(space) - d.buttonPx - d.hudBottom).toBe(SKILL_ROW_HUD_GAP_PX)
    }
  })

  it('falls back before it has measured anything', () => {
    // A component that has not been laid out reports a zero-height button, and
    // the scene reports a zero floor until the first `resize`. Neither is
    // "there is room" — the fallback is the answer that cannot be wrong.
    const space = { viewportPx: 820, hudBottomPx: 75, squadFloorPx: 660, buttonPx: 0 }
    expect(skillRowFitsUnderSquad(space)).toBe(false)
    expect(skillRowFitsUnderSquad({ ...space, buttonPx: 58, squadFloorPx: 0 })).toBe(false)
  })
})
