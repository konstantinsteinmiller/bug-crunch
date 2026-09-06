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
        //- What the weapon is actually worth, as a bare multiplier.
        //- Deliberately a NUMBER rather than a word: it is the one thing the
        //- player wants to know at the moment of pickup, it answers "was that
        //- detour worth it", and it needs no translating in any of the
        //- twenty-one languages this ships in.
        span.wtag__note(v-else) ×{{ mult }}
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
  /** The weapon the player is actually carrying, or `null`. */
  active: WeaponId | null
}
const props = defineProps<Props>()

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
const mode = computed<'active' | 'puzzle' | null>(() =>
  props.active ? 'active' : props.puzzle ? 'puzzle' : null
)

const weapon = computed<WeaponId | null>(() => props.active ?? props.puzzle)
const icon = computed<GameIconName>(() =>
  weapon.value ? WEAPON_ICONS[weapon.value] : 'star'
)
const name = computed(() => (weapon.value ? t(`weapons.${weapon.value}`) : ''))

/** The weapon's total damage multiplier over the squad's own gun, shop levels
 *  included — see `weaponTotalMul`. */
const mult = computed(() => (props.active ? weaponTotalMul(props.active) : 0))

/** The accessible name says which of the two states this is — a screen reader
 *  gets no help at all from a dimmed glyph and a row of dots. */
const label = computed(() => {
  if (!weapon.value) return ''
  return props.active
    ? t('hud.weaponActive', { name: name.value })
    : t('hud.weaponLocked', { name: name.value, n: props.pulled, total: props.total })
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

.wtag__icon
  flex: 0 0 auto
  width: clamp(1.05rem, 4.6vw, 1.5rem)
  height: clamp(1.05rem, 4.6vw, 1.5rem)
  color: #7d8798

.wtag--active .wtag__icon
  color: #ffd93c
  filter: drop-shadow(0 0 6px rgba(255, 200, 60, 0.55))

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

.wtag__note
  font-size: clamp(0.44rem, 2vw, 0.58rem)
  font-weight: 700
  line-height: 1
  color: rgba(255, 233, 168, 0.75)
  white-space: nowrap

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
