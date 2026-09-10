import { WEAPON_PICK_STAGE, stageHasWeapon, weaponForStage, type WeaponId } from '@/game/weapons'

/**
 * ─── The gift ladder ────────────────────────────────────────────────────────
 *
 * What the opening stages hand over, in order, and — the half that matters —
 * what they PROMISE next. A goal two stages ahead is the cheapest reason there
 * is to start the next stage, and until this existed the game had exactly one
 * gift (the shield, on the stage-1 banner) and never once said what was coming.
 *
 *   stage 1 cleared → the banner says: choose a weapon, next stage
 *   stage 2 cleared → the reveal: launcher or gatling, for stage 3
 *   stage 3 cleared → the shield, and the banner says: a weapon on the road at 4
 *   stage 4+        → the next puzzle stage, named by the weapon its box holds
 *
 * One module so the banner, the HUD chip and the scene cannot disagree about
 * what is next. Pure functions of the stage number, like the road itself.
 */

/** The shield arrives with the banner that opens this stage. */
export const SHIELD_GIFT_STAGE = 4

export type LadderIcon = 'gift' | 'shield' | WeaponId

export interface Unlock {
  /** The stage whose OPENING the unlock lands on. */
  atStage: number
  icon: LadderIcon
  /** Which i18n label describes it. */
  kind: 'weaponPick' | 'shield' | 'weapon'
  weapon?: WeaponId
}

/** The next puzzle stage strictly after `stage`, if any within `horizon`. */
export const nextWeaponStage = (stage: number, horizon = 400): number | null => {
  for (let s = Math.max(1, Math.floor(stage)) + 1; s <= stage + horizon; s++) {
    if (stageHasWeapon(s)) return s
  }
  return null
}

/**
 * What the player is playing TOWARD while on `stage`.
 *
 * `null` past the horizon only — on the authored road there is always a next
 * box, because the puzzle runs every other stage forever.
 */
export const nextUnlock = (stage: number): Unlock | null => {
  const s = Math.max(1, Math.floor(stage))
  if (s < WEAPON_PICK_STAGE) {
    return { atStage: WEAPON_PICK_STAGE, icon: 'gift', kind: 'weaponPick' }
  }
  if (s < SHIELD_GIFT_STAGE) {
    return { atStage: SHIELD_GIFT_STAGE, icon: 'shield', kind: 'shield' }
  }
  const at = nextWeaponStage(s)
  if (at === null) return null
  const weapon = weaponForStage(at)
  return { atStage: at, icon: weapon, kind: 'weapon', weapon }
}

/** Stages between here and the unlock: 1 means "next stage". */
export const stagesAway = (stage: number, unlock: Unlock): number =>
  Math.max(1, unlock.atStage - Math.floor(stage))
