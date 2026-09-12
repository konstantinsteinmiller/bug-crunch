<template lang="pug">
  Transition(name="wtag")
    div.wtag(v-if="mode" :class="`wtag--${mode}`" role="status" :aria-label="label")
      GameIcon.wtag__icon(:name="icon")
      div.wtag__body
        span.wtag__name {{ name }}
        //- The puzzle's whole affordance. Two pips, one per lever, filled as
        //- they go over — so a player who shot one and moved on can still see
        //- that there is exactly one thing left to do about it.
        div.wtag__pips(v-if="mode === 'puzzle'")
          span.wtag__pip(
            v-for="i in total"
            :key="i"
            :class="{ 'is-on': i <= pulled }"
          )
        //- The gift's price, which is the whole of what makes it a gift. It
        //- takes the pips' slot because a box with no levers has no pips, and
        //- the row was rendering EMPTY there — a badge that showed a name and
        //- then nothing, which reads as a thing still loading.
        span.wtag__note(v-else-if="mode === 'gift'") {{ t('hud.weaponFree') }}
        //- What the weapon is actually worth, as a bare multiplier.
        //- Deliberately a NUMBER rather than a word: it is the one thing the
        //- player wants to know at the moment of pickup, it answers "was that
        //- detour worth it", and it needs no translating in any of the
        //- twenty-one languages this ships in.
        span.wtag__note(v-else) ×{{ mult }}
      //- The second gun — stage 2's overlay (`sideWeapon`): a glyph and its own
      //- multiplier after a plus, because two weapons firing at once is a SUM
      //- and the badge should read like one. Before the box is broken the same
      //- slot promises it: the gift ahead, FREE, since it now adds rather
      //- than replaces.
      template(v-if="second")
        span.wtag__plus(aria-hidden="true") +
        GameIcon.wtag__icon.wtag__icon--second(:name="second.icon" :class="{ 'is-gift': second.gift }")
        span.wtag__note.wtag__note--second(:class="{ 'is-gift': second.gift }") {{ second.note }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'
import type { GameIconName } from '@/components/icons/iconNames'
import type { WeaponId } from '@/game/weapons'
import { weaponTotalMul } from '@/use/useUpgrades'

/**
 * ─── The weapon tag ─────────────────────────────────────────────────────────
 *
 * One badge doing two jobs, in the order the player meets them:
 *
 *   GIFT   — a LIT glyph and the word "free", while stage 2's open box is on
 *            the road. It is a third state rather than a puzzle with zero
 *            pips, because the two say opposite things: the puzzle badge is a
 *            to-do list ("there are two of these and you have both to do") and
 *            the gift badge is a price tag ("this one costs nothing"). Dimmed
 *            with an empty pip row — which is what a zero-lever puzzle rendered
 *            as — the badge was actively arguing against the box, whose entire
 *            job on stage 2 is to be walked into. The glyph is lit here for the
 *            same reason the box on the road is: the player is being told what
 *            the prize is BEFORE they commit to steering at it.
 *   PUZZLE — a dimmed glyph and a row of pips while a lever puzzle is live.
 *            This is the entire discoverability budget of the mechanic. The
 *            levers themselves are out at the rails with a chevron over them,
 *            which teaches "shoot this"; nothing on the road can teach "there
 *            are TWO of these and you have both of them to do", because the
 *            second one is not on screen yet when the first is shot. A player
 *            who pulls one lever and sees `1/2` light up knows there is a
 *            second; a player who sees nothing concludes the lever was scenery.
 *   ACTIVE — the same glyph, lit, once the box is broken. It is the answer to
 *            "why is my gun different", which a run that changes its own fire
 *            rate mid-stage has to be able to answer at a glance.
 *
 * Top LEFT, under the run HUD, because the top right is the dodge alarm's and
 * a badge that moved between the two states would read as two different things.
 * It is the same object throughout — the pips fill, the glyph lights, the
 * caption changes — which is what makes the beat legible as one arc.
 */

const { t } = useI18n()

interface Props {
  /** The weapon the live puzzle would hand over, or `null` if none is live. */
  puzzle: WeaponId | null
  /** Levers pulled so far, and how many there are. */
  pulled: number
  total: number
  /** …and whether that box is the FREE one — stage 2's gift. See
   *  `puzzleGift`: it is carried rather than inferred from `total === 0`. */
  gift: boolean
  /** The weapon the player is actually carrying, or `null`. */
  active: WeaponId | null
  /** …and what it is worth against its full self — below 1 only for the
   *  stage-1 boss's launcher (`weaponPower`). */
  power?: number
  /** A second gun firing alongside (`sideWeapon`), and its power. */
  side?: WeaponId | null
  sidePower?: number
}
const props = withDefaults(defineProps<Props>(), { power: 1, side: null, sidePower: 1 })

const WEAPON_ICONS: Record<WeaponId, GameIconName> = {
  rocket: 'rocket',
  gatling: 'gatling'
}

/**
 * ACTIVE wins.
 *
 * They can overlap for a frame — the box is broken and the puzzle refs have not
 * been cleared yet — and in that frame the truthful thing to show is the weapon
 * in the player's hands, not the puzzle they have just finished.
 */
const mode = computed<'active' | 'gift' | 'puzzle' | null>(() =>
  props.active ? 'active' : props.puzzle ? (props.gift ? 'gift' : 'puzzle') : null
)

const weapon = computed<WeaponId | null>(() => props.active ?? props.puzzle)
const icon = computed<GameIconName>(() =>
  weapon.value ? WEAPON_ICONS[weapon.value] : 'star'
)
const name = computed(() => (weapon.value ? t(`weapons.${weapon.value}`) : ''))

/** The weapon's total damage multiplier over the squad's own gun, shop levels
 *  included — see `weaponTotalMul`. */
const mult = computed(() =>
  props.active ? Math.round(weaponTotalMul(props.active) * props.power * 10) / 10 : 0
)

/**
 * The second slot: the gun firing alongside, or — while a weapon is held and a
 * gift box of a different one is still ahead — that gift, which will ADD to it.
 */
const second = computed<{ icon: GameIconName; note: string; gift: boolean } | null>(() => {
  if (!props.active) return null
  if (props.side) {
    const m = Math.round(weaponTotalMul(props.side) * props.sidePower * 10) / 10
    return { icon: WEAPON_ICONS[props.side], note: `×${m}`, gift: false }
  }
  if (props.puzzle && props.gift && props.puzzle !== props.active) {
    return { icon: WEAPON_ICONS[props.puzzle], note: t('hud.weaponFree'), gift: true }
  }
  return null
})

/** The accessible name says which of the two states this is — a screen reader
 *  gets no help at all from a dimmed glyph and a row of dots. */
const label = computed(() => {
  if (!weapon.value) return ''
  if (props.active && props.side) {
    return t('hud.weaponsActive', { a: name.value, b: t(`weapons.${props.side}`) })
  }
  if (props.active) return t('hud.weaponActive', { name: name.value })
  // A gift has no levers, so the locked wording's "{n} of {total}" would read
  // "0 of 0" to a screen reader — which is worse than silence, because it
  // describes a lock that is not there.
  if (mode.value === 'gift') return t('hud.weaponGift', { name: name.value })
  return t('hud.weaponLocked', { name: name.value, n: props.pulled, total: props.total })
})
</script>

<style scoped lang="sass">
.wtag
  position: absolute
  display: flex
  align-items: center
  gap: clamp(0.25rem, 1.4vw, 0.45rem)
  // Under the run HUD's own rows. Measured generously rather than tied to the
  // bar's height: the bar grows a miniboss rail mid-fight, and a badge that
  // jumped down the screen when an elite appeared would read as a new thing.
  top: calc(clamp(4.6rem, 20vw, 6.4rem) + env(safe-area-inset-top, 0px))
  left: calc(clamp(0.4rem, 2.2vw, 0.8rem) + env(safe-area-inset-left, 0px))
  padding: clamp(0.18rem, 1vw, 0.32rem) clamp(0.36rem, 2vw, 0.6rem)
  border-radius: 999px
  border: 2px solid rgba(255, 255, 255, 0.16)
  background-color: rgba(8, 14, 28, 0.72)
  pointer-events: none
  z-index: 41
  max-width: min(52vw, 15rem)

.wtag--active
  border-color: rgba(255, 214, 96, 0.7)
  background-color: rgba(48, 30, 4, 0.8)
  // A one-shot pop rather than a loop: the arrival is the event, and a badge
  // that pulses for the rest of the stage is a badge the player stops seeing.
  animation: wtag-pop 0.42s cubic-bezier(0.2, 1.5, 0.4, 1)

// The gift, on the road and free. Warm like the active badge because it is the
// same promise one beat earlier, but WITHOUT `wtag-pop`: the pop is the
// arrival, and if the badge already jumped when the box came into view the
// player gets no read at all on the moment they actually collect it. That
// hand-off — warm badge, then the same badge popping and gaining a ×N — is
// what keeps an open box's payoff worth watching.
.wtag--gift
  border-color: rgba(255, 214, 96, 0.42)
  background-color: rgba(32, 22, 6, 0.78)

.wtag__icon
  flex: 0 0 auto
  width: clamp(1.05rem, 4.6vw, 1.5rem)
  height: clamp(1.05rem, 4.6vw, 1.5rem)
  color: #7d8798

.wtag--active .wtag__icon
  color: #ffd93c
  filter: drop-shadow(0 0 6px rgba(255, 200, 60, 0.55))

.wtag--gift .wtag__icon
  color: #ffd07a

.wtag__body
  display: flex
  flex-direction: column
  gap: 0.12rem
  min-width: 0

.wtag__name
  font-weight: 900
  font-size: clamp(0.5rem, 2.4vw, 0.68rem)
  letter-spacing: 0.04em
  text-transform: uppercase
  line-height: 1
  color: #cdd6e4
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

.wtag--active .wtag__name
  color: #ffe9a8

.wtag--gift .wtag__name
  color: #f0dcb4

.wtag__note
  font-size: clamp(0.44rem, 2vw, 0.58rem)
  font-weight: 700
  line-height: 1
  color: rgba(255, 233, 168, 0.75)
  white-space: nowrap

// The active badge's note is a bare multiplier that the eye finds because the
// whole pill just popped. The gift's note is a WORD, on a pill that arrives
// quietly, and it is the argument for steering — so it gets the weight the
// animation is not spending.
.wtag--gift .wtag__note
  font-weight: 900
  letter-spacing: 0.06em
  color: #ffd07a

.wtag__pips
  display: flex
  gap: 0.16rem

.wtag__pip
  width: clamp(0.3rem, 1.5vw, 0.44rem)
  height: clamp(0.3rem, 1.5vw, 0.44rem)
  border-radius: 999px
  background-color: rgba(255, 255, 255, 0.22)
  border: 1px solid rgba(0, 0, 0, 0.5)
  transition: background-color 0.18s ease, box-shadow 0.18s ease

.wtag__pip.is-on
  background-color: #7ee08a
  box-shadow: 0 0 6px rgba(126, 224, 138, 0.8)

// ─── The second gun ──────────────────────────────────────────────────────────
// Smaller than the first: it is the gun the player already had, and the name
// on the badge belongs to the one that just arrived.
.wtag__plus
  flex: 0 0 auto
  font-weight: 900
  font-size: clamp(0.55rem, 2.4vw, 0.72rem)
  line-height: 1
  color: rgba(255, 233, 168, 0.6)

.wtag .wtag__icon--second
  width: clamp(0.85rem, 3.8vw, 1.2rem)
  height: clamp(0.85rem, 3.8vw, 1.2rem)
  color: #ffd93c
  filter: drop-shadow(0 0 4px rgba(255, 200, 60, 0.45))

  &.is-gift
    color: #ffd07a
    filter: none
    opacity: 0.85

.wtag__note--second
  flex: 0 0 auto

  &.is-gift
    font-weight: 900
    letter-spacing: 0.06em
    color: #ffd07a

@keyframes wtag-pop
  0%
    transform: scale(0.7)
  60%
    transform: scale(1.12)
  100%
    transform: scale(1)

.wtag-enter-active
  transition: opacity 0.18s ease

.wtag-leave-active
  transition: opacity 0.3s ease

.wtag-enter-from, .wtag-leave-to
  opacity: 0
</style>
