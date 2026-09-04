import { computed, ref } from 'vue'
import { SKILL_READY_KEY } from '@/keys'
import { getState, setState } from '@/use/useTowerState'
import {
  SKILL_COOLDOWN_MS, grenadeMult, shieldSeconds, shieldUnlocked
} from '@/use/useUpgrades'

/**
 * ─── The active skills ──────────────────────────────────────────────────────
 *
 * Everything else the player owns is passive: the shop sells numbers and the
 * simulation reads them. These two are buttons, and they are the only moment in
 * the game where the player does something other than steer.
 *
 *   GRENADE  owned from the start, 3x the crowd's fire at level 0 and 6x at 20.
 *   SHIELD   bought in the shop, halves what the road takes for 3-6 seconds.
 *
 * ── Why the cooldown is a TIMESTAMP in the save ──
 *
 * Both share a thirty-second clock that runs across runs, which is the whole
 * design: a cooldown that reset on death would make dying the cheapest way to
 * get a grenade back, and the interesting question — "do I spend it here or
 * keep it for the boss?" — would stop existing.
 *
 * So it is stored as the absolute epoch ms at which each skill is next ready,
 * inside the save blob. Absolute rather than remaining-time because a remaining
 * count only ticks while something is running it: a player who closes the tab
 * for a minute has genuinely waited a minute, and the clock has to know that.
 * It survives a reload, a stage change and a wipe, exactly as intended.
 *
 * The one thing a timestamp cannot survive is the player moving their device
 * clock backwards. `readyIn` clamps to the cooldown length, so the worst case is
 * one skill that waits thirty seconds instead of forever.
 */

export type SkillId = 'grenade' | 'shield'

type ReadyMap = Partial<Record<SkillId, number>>

const readReady = (): ReadyMap => {
  const raw = getState<ReadyMap>(SKILL_READY_KEY, {})
  return raw && typeof raw === 'object' ? raw : {}
}

/**
 * Bumped every frame the HUD wants a fresh countdown.
 *
 * The cooldown is wall-clock, not reactive state, so nothing would otherwise
 * tell Vue that a button became ready. One ref ticked by the scene's own loop is
 * cheaper than a timer per button and stays in step with the frame the player
 * is looking at.
 */
const clock = ref(0)
export const tickSkills = (): void => { clock.value = Date.now() }

const readyAt = (id: SkillId): number => readReady()[id] ?? 0

/** Ms until `id` is usable, 0 when it already is. */
export const skillReadyIn = (id: SkillId): number => {
  void clock.value
  const left = readyAt(id) - Date.now()
  if (left <= 0) return 0
  // A clock moved backwards can never strand a skill for longer than its own
  // cooldown.
  return Math.min(left, SKILL_COOLDOWN_MS)
}

/** 0..1 across the cooldown — 1 means ready. Drives the ring on the button. */
export const skillCharge = (id: SkillId): number => {
  const left = skillReadyIn(id)
  return left <= 0 ? 1 : 1 - left / SKILL_COOLDOWN_MS
}

export const skillReady = (id: SkillId): boolean => skillReadyIn(id) <= 0

/** Start the clock. Called only when the skill actually did something. */
export const startCooldown = (id: SkillId): void => {
  const next = { ...readReady(), [id]: Date.now() + SKILL_COOLDOWN_MS }
  setState(SKILL_READY_KEY, next)
  clock.value = Date.now()
}

/** Test seam: forget every cooldown. */
export const __resetSkillCooldowns = (): void => {
  setState(SKILL_READY_KEY, {})
  clock.value = Date.now()
}

/** The grenade is owned from the first run; the shield has to be bought. */
export const skillOwned = (id: SkillId): boolean =>
  id === 'grenade' ? true : shieldUnlocked.value

export const grenadeMultiplier = computed(() => grenadeMult.value)
export const shieldDuration = computed(() => shieldSeconds.value)
