import { computed, ref } from 'vue'
import type { GameIconName } from '@/components/icons/iconNames'
import {
  DECOY_GIFT_STAGE, FROST_GIFT_STAGE, FROST_TRIAL_STAGE, SHIELD_GIFT_STAGE
} from '@/game/ladder'
import { BEST_STAGE_KEY, FROST_TRIAL_KEY, SKILL_READY_KEY, SKILL_REVEALED_KEY } from '@/keys'
import { flushSaveNow } from '@/use/useSaveStatus'
import { getState, setState } from '@/use/useTowerState'
import { DECOY_COOLDOWN_MS, FROST_COOLDOWN_MS } from '@/game/skills'
import {
  SKILL_COOLDOWN_MS, grenadeMult, shieldSeconds, shieldUnlocked
} from '@/use/useUpgrades'

/**
 * ─── The active skills ──────────────────────────────────────────────────────
 *
 * Everything else the player owns is passive: the shop sells numbers and the
 * simulation reads them. These are buttons, and they are the only moment in the
 * game where the player does something other than steer.
 *
 *   GRENADE  owned from the start, 3x the crowd's fire at level 0 and 6x at 20.
 *   SHIELD   bought in the shop, halves what the road takes for 3-6 seconds.
 *   FROST    reached on stage 7 (one free use after the stage-4 boss): every
 *            hostile thing freezes, mid-swing, for 3.5 s. See `game/skills.ts`.
 *   DECOY    reached on stage 10: a flare the whole fight turns to, ending in a
 *            burst.
 *
 * ── Why the cooldown is a TIMESTAMP in the save ──
 *
 * Each runs its own clock — thirty seconds for the grenade and the shield, a
 * fight's worth for the two late ones (`skillCooldownMs`) — and it runs across
 * runs, which is the whole design: a cooldown that reset on death would make
 * dying the cheapest way to get a grenade back, and the interesting question —
 * "do I spend it here or keep it for the boss?" — would stop existing.
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

export type SkillId = 'grenade' | 'shield' | 'frost' | 'decoy'

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

/**
 * How long `id` waits between uses, ms.
 *
 * The grenade and the shield are the run's rhythm and share the shop's thirty
 * seconds. The two late skills are escape hatches and are priced by the fight
 * rather than by the minute — see `game/skills.ts`.
 */
export const skillCooldownMs = (id: SkillId): number =>
  id === 'frost' ? FROST_COOLDOWN_MS
    : id === 'decoy' ? DECOY_COOLDOWN_MS
      : SKILL_COOLDOWN_MS

/** Ms until `id` is usable, 0 when it already is. */
export const skillReadyIn = (id: SkillId): number => {
  void clock.value
  const left = readyAt(id) - Date.now()
  if (left <= 0) return 0
  // A clock moved backwards can never strand a skill for longer than its own
  // cooldown.
  return Math.min(left, skillCooldownMs(id))
}

/** 0..1 across the cooldown — 1 means ready. Drives the ring on the button. */
export const skillCharge = (id: SkillId): number => {
  const left = skillReadyIn(id)
  return left <= 0 ? 1 : 1 - left / skillCooldownMs(id)
}

export const skillReady = (id: SkillId): boolean => skillReadyIn(id) <= 0

/** Start the clock. Called only when the skill actually did something. */
export const startCooldown = (id: SkillId): void => {
  const next = { ...readReady(), [id]: Date.now() + skillCooldownMs(id) }
  setState(SKILL_READY_KEY, next)
  clock.value = Date.now()
}

/** Test seam: forget every cooldown. */
export const __resetSkillCooldowns = (): void => {
  setState(SKILL_READY_KEY, {})
  clock.value = Date.now()
}

/**
 * The deepest stage the save has CLEARED — which is what the late skills are
 * keyed to. Read through the reactive save blob rather than the run's own
 * `bestStage` ref, so a cloud save that lands after boot fills the slots it
 * paid for in the same tick, exactly as a bought shield does.
 */
const clearedBest = (): number => Number(getState(BEST_STAGE_KEY, 0)) || 0

/**
 * The grenade is owned from the first run and the shield has to be bought (or
 * is gifted at stage 4). The two late skills are REACHED: owned from the opening
 * of their stage, which is the moment the stage before it is first cleared.
 */
export const skillOwned = (id: SkillId): boolean => {
  switch (id) {
    case 'grenade': return true
    case 'shield': return shieldUnlocked.value
    case 'frost': return clearedBest() >= FROST_GIFT_STAGE - 1
    case 'decoy': return clearedBest() >= DECOY_GIFT_STAGE - 1
  }
}

/**
 * ─── One free Frost Nova ────────────────────────────────────────────────────
 *
 * The stage-4 boss's gift: the skill's button, filled for exactly ONE use,
 * three stages before it is the player's for good. A skill met for the first
 * time on the stage that also introduces it is a skill most players hold on to
 * "for later" and never press; a free one they have already watched freeze a
 * boss is a button they arrive at stage 7 wanting back.
 *
 * Offered off the cleared stage rather than written at the kill, so a save that
 * crossed stage 4 before the trial existed still gets its one use — the only
 * thing the save records is that it was SPENT (`FROST_TRIAL_KEY`).
 */
export const skillTrial = (id: SkillId): boolean =>
  id === 'frost' &&
  !skillOwned('frost') &&
  clearedBest() >= FROST_TRIAL_STAGE - 1 &&
  getState<unknown>(FROST_TRIAL_KEY, null) !== 'spent'

/** The one free use is gone. Flushed like a purchase: it is a permanent change
 *  to the save, and a reload must not hand it back. */
export const spendTrial = (id: SkillId): void => {
  if (id !== 'frost') return
  setState(FROST_TRIAL_KEY, 'spent')
  void flushSaveNow()
}

/** Can the button be pressed at all right now — owned or on trial, and off its
 *  clock? The scene's one gate before it asks the simulation. */
export const skillUsable = (id: SkillId): boolean =>
  (skillOwned(id) || skillTrial(id)) && skillReady(id)

export const grenadeMultiplier = computed(() => grenadeMult.value)
export const shieldDuration = computed(() => shieldSeconds.value)

/**
 * ─── The slots, owned and not ───────────────────────────────────────────────
 *
 * The skill bar used to show only what the player owned, on the argument that a
 * permanently dead control teaches the player to stop looking at that corner.
 * It now shows the skills still to come as well — greyed, behind a question
 * mark — and the reason is the same argument pointed the other way: what is
 * NOT dead is a promise. A slot that is visibly waiting to be filled is the
 * cheapest reason there is to play the next stage (`ladder.ts` makes the same
 * bet with its "next unlock" chip), and the thing that keeps it from reading as
 * a broken button is that it looks nothing like one: no ring, no countdown, no
 * press response beyond a shake and a hint.
 *
 * Four slots, in the order they fill. Each one that is not the player's yet
 * wears its skill's glyph as a faint silhouette behind the question mark — the
 * half of the tease that rewards looking — and says when it opens.
 *
 * A slot is in one of three states (`slotState`): OWNED, a TRIAL (the one free
 * Frost Nova — a real button for exactly one press, see `skillTrial`), or
 * LOCKED. A trial that has been spent goes back to locked until the stage that
 * owns it for good.
 */
export interface SkillSlot {
  /** The skill that lives here, or `null` for a slot whose skill is not built
   *  yet — it stays a mystery until it is. */
  id: SkillId | null
  /** The glyph the button wears once owned, and the faint silhouette behind the
   *  question mark while locked. `null` means no silhouette at all. */
  icon: GameIconName | null
  /** Painted-art id for the owned button (`ArtIcon`), when there is one. */
  art: string | null
  /** i18n key of the skill's name. */
  labelKey: string | null
  /** The stage whose OPENING hands it over, when that is a stage. The shield is
   *  a gift (`SHIELD_GIFT_STAGE`) — it can also be bought earlier in the shop,
   *  in which case the slot simply fills sooner. */
  unlockStage: number | null
}

export const SKILL_SLOTS: readonly SkillSlot[] = [
  { id: 'grenade', icon: 'bomb', art: 'skill-grenade', labelKey: 'skills.grenade', unlockStage: null },
  { id: 'shield', icon: 'shield', art: 'skill-shield', labelKey: 'skills.shield', unlockStage: SHIELD_GIFT_STAGE },
  { id: 'frost', icon: 'snowflake', art: 'skill-frost', labelKey: 'skills.frost', unlockStage: FROST_GIFT_STAGE },
  { id: 'decoy', icon: 'flare', art: 'skill-decoy', labelKey: 'skills.decoy', unlockStage: DECOY_GIFT_STAGE }
]

export type SlotState = 'owned' | 'trial' | 'locked'

/** Which of the three a slot is in right now. An empty slot is always locked. */
export const slotState = (slot: SkillSlot): SlotState => {
  if (slot.id === null) return 'locked'
  if (skillOwned(slot.id)) return 'owned'
  return skillTrial(slot.id) ? 'trial' : 'locked'
}

/** Is this slot the player's yet? An empty slot never is. */
export const slotOwned = (slot: SkillSlot): boolean =>
  slot.id !== null && skillOwned(slot.id)

/**
 * ─── The reveal, played once ────────────────────────────────────────────────
 *
 * The question mark is only worth what the moment it comes off is worth, so
 * the first time a skill the player did not own shows up owned, its button
 * plays a reveal. The shield is gifted while the result banner is up, when the
 * bar is not even mounted — so "became owned" cannot be watched from inside the
 * component. It is remembered in the SAVE instead (`SKILL_REVEALED_KEY`).
 *
 * In the save rather than in module memory, because memory would have to be
 * seeded with "what was owned at boot", and on a cloud-save portal boot is
 * before the save has arrived — every returning player would be shown a reveal
 * for a skill they have owned for weeks. A save that predates the key is
 * treated as having revealed everything it already owns, for the same reason —
 * of the skills that EXISTED before the key did. Frost and the flare are new to
 * every save, so a veteran who is already past stage 10 gets both reveals.
 *
 * Keys are the skill id for its own reveal and `<id>:trial` for the free use's,
 * so the trial and the day the skill is owned for good are two moments.
 */
export const revealKey = (id: SkillId, state: SlotState): string =>
  state === 'trial' ? `${id}:trial` : id

const readRevealed = (): string[] | null => {
  const raw = getState<string[] | null>(SKILL_REVEALED_KEY, null)
  return Array.isArray(raw) ? raw : null
}

/** Should this slot's button play its reveal now? True exactly once per key,
 *  ever, and asking marks it spent. */
export const claimReveal = (id: SkillId, state: SlotState = 'owned'): boolean => {
  if (state === 'locked') return false
  if (state === 'owned' ? !skillOwned(id) : !skillTrial(id)) return false
  let seen = readRevealed()
  if (seen === null) {
    // A save from before reveals existed: everything it owned was earned before
    // there was a question mark to take off, so none of THAT gets one.
    seen = (['grenade', 'shield'] as const).filter((s) => skillOwned(s))
    setState(SKILL_REVEALED_KEY, seen)
  }
  const key = revealKey(id, state)
  if (seen.includes(key)) return false
  setState(SKILL_REVEALED_KEY, [...seen, key])
  return true
}

/** Test seam: forget which reveals have played — as a save that has the key but
 *  has revealed nothing, so the next newly owned skill reveals. */
export const __resetSkillReveals = (): void => { setState(SKILL_REVEALED_KEY, ['grenade']) }
