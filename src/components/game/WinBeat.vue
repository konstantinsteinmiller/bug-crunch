<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'
import { paintBoss } from '@/game/bugArt'
import {
  winConditionBoss, winConditionIcon, type WinCondition
} from '@/game/winBeat'

/**
 * ─── The win card ───────────────────────────────────────────────────────────
 *
 * The thing that ended the level, in the middle of the screen, for the two
 * seconds between the last squash and the result panel.
 *
 * ── Why it is not the objective strip ──
 *
 * `ObjectiveList` already draws three rows with glyphs and ticks, and reusing
 * it here was the obvious move. It is the wrong one: the first of those three
 * is always "Clear the level", which at this exact moment is the least
 * informative sentence in the game — the player can see that they cleared it,
 * that is why the confetti is playing. The other two are STAR goals, which are
 * a reason to replay and are already given a screen of their own eight hundred
 * milliseconds later.
 *
 * What is missing in between is the answer to "why did it stop?", and that is
 * one fact with one number: the quota that filled, the boss that fell, or the
 * clock that ran out on a party. So this card carries exactly that, at a size
 * that is readable across a room, and nothing else.
 *
 * ── Why the number is a fraction ──
 *
 * `20 / 20` rather than `20`, because the two halves do different jobs: the
 * right-hand number is the CONDITION (this is what the level wanted) and the
 * left is the PROOF (and this is what you did). A single number is a score, and
 * the score already has a chip on the next screen.
 *
 * ── Wordless first ──
 *
 * The glyph, the number and the tick carry the whole meaning; the caption under
 * them is a reinforcement for a player who reads, and the boss's name is the
 * only string on the card that is not decorative. A player who cannot read this
 * language loses nothing, which is the same rule the tutorial runs on.
 */

interface Props {
  /** What ended the level, or null while nothing has. */
  condition: WinCondition | null
  /** Up. Driven by the beat's clock, not by the level's phase — the card comes
   *  up a beat AFTER the win, and on a boss level a good while after. */
  show: boolean
  /**
   * The left-hand half of the fraction: bodies squished AGAINST THE QUOTA.
   *
   * The sim's `squished`, not the tally's `squishes`. They agree in ordinary
   * play, which is exactly why the distinction is worth pinning: the right-hand
   * number is the quota, so the left one has to be the number the quota is
   * graded on, or the card is quietly comparing two different counts and will
   * read `1 / 11` the first time anything makes them diverge.
   */
  done: number
  /** Reduced motion: the stamp lands without the overshoot and the shine. */
  calm?: boolean
}

const props = withDefaults(defineProps<Props>(), { calm: false })
const { t } = useI18n()

const icon = computed(() => (props.condition ? winConditionIcon(props.condition) : 'check'))
const boss = computed(() => (props.condition ? winConditionBoss(props.condition) : null))

/**
 * The fraction, or null for the conditions that do not have one.
 *
 * A boss is one creature and a party is a clock; neither has a count worth
 * showing, and `1 / 1` under a dead queen ant would be a joke at the player's
 * expense.
 */
const count = computed(() => {
  const c = props.condition
  if (!c || c.kind !== 'quota') return null
  // Clamped to the quota: a Big Finish kills the whole floor, so a level asking
  // for 20 routinely ends on 27 and a card reading `27 / 20` makes the thing
  // that was met look like a thing that was missed.
  return { done: Math.min(props.done, c.n), need: c.n }
})

/** The boss's portrait — the creature itself, at card size. See `paintBoss`. */
const face = ref<HTMLCanvasElement | null>(null)

const drawBoss = (): void => {
  const c = face.value
  const id = boss.value
  if (!c || !id) return
  const rect = c.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const side = Math.max(1, Math.round((rect.width || 96) * dpr))
  if (c.width !== side || c.height !== side) { c.width = side; c.height = side }
  const ctx = c.getContext('2d')
  if (!ctx) return                          // jsdom has none, and the card still reads
  ctx.clearRect(0, 0, side, side)
  ctx.save()
  ctx.translate(side / 2, side / 2)
  // `2.4` is the box `paintBoss` fills at radius `r` — see its own note — so
  // this is the largest portrait that cannot clip its own legs off.
  paintBoss(ctx, id, side / 2 / 1.2, 0, 0)
  ctx.restore()
}

watch(() => [props.show, boss.value] as const, ([up]) => {
  if (up) void nextTick(drawBoss)
}, { immediate: true })
</script>

<template lang="pug">
  Transition(name="win-beat")
    div.win-beat(v-if="show && condition" :class="{ 'is-calm': calm }")
      //- `assertive`, where the level card is `polite`: this announcement has a
      //- two-second window and then the result panel takes the screen, so a
      //- reader that queued it politely would read it over the next screen.
      div.win-beat__card(role="status" aria-live="assertive")
        div.win-beat__mark
          canvas.win-beat__face(v-if="boss" ref="face" aria-hidden="true")
          GameIcon.win-beat__glyph(v-else :name="icon")
          span.win-beat__tick
            GameIcon(name="check")

        div.win-beat__count(v-if="count")
          span.win-beat__done {{ count.done }}
          span.win-beat__sep /
          span.win-beat__need {{ count.need }}
        span.win-beat__boss(v-else-if="boss") {{ t(`bosses.${boss}`) }}

        span.win-beat__caption {{ t('result.cleared') }}
</template>

<style scoped lang="sass">
.win-beat
  position: absolute
  inset: 0
  display: flex
  align-items: center
  justify-content: center
  padding: clamp(0.75rem, 4vmin, 2rem)
  pointer-events: none
  // Over the level card and the boss bar, under the tutorial's hand — a lesson
  // still on screen when a level ends is pointing at the board, and the board
  // is what this is celebrating.
  z-index: 26

.win-beat__card
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.2rem, 1.2vmin, 0.5rem)
  // Capped, because one of the three conditions carries a TRANSLATED name and
  // the others carry two digits. "Goliath Queen Ant" fits on one line in
  // English and does not in every locale this game ships to; without a cap the
  // card simply grows until it is wider than the phone it is on.
  max-width: min(22rem, 86vw)
  padding: clamp(0.7rem, 3.4vmin, 1.4rem) clamp(1.1rem, 5vmin, 2.2rem)
  border: 3px solid rgba(255, 217, 60, 0.55)
  border-radius: clamp(0.9rem, 3.6vmin, 1.8rem)
  background-color: rgba(10, 6, 20, 0.8)
  backdrop-filter: blur(6px)
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.65), 0 0 0 6px rgba(255, 217, 60, 0.1)

// ── The mark, and the tick over its shoulder ──
.win-beat__mark
  position: relative
  display: flex
  align-items: center
  justify-content: center

.win-beat__glyph
  width: clamp(2.6rem, 13vmin, 4.6rem)
  height: clamp(2.6rem, 13vmin, 4.6rem)
  color: #ffd93c
  filter: drop-shadow(3px 3px 0 rgba(0, 0, 0, 0.85))

.win-beat__face
  width: clamp(3.4rem, 17vmin, 6rem)
  height: clamp(3.4rem, 17vmin, 6rem)
  filter: drop-shadow(3px 4px 0 rgba(0, 0, 0, 0.6))

.win-beat__tick
  position: absolute
  right: -0.35em
  bottom: -0.25em
  display: flex
  align-items: center
  justify-content: center
  width: clamp(1.4rem, 6.6vmin, 2.2rem)
  height: clamp(1.4rem, 6.6vmin, 2.2rem)
  border-radius: 999px
  border: 3px solid rgba(10, 6, 20, 0.9)
  background-color: #3ddc6b
  color: #07210f
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5)
  // The stamp: it arrives after the card, oversized, and settles. The card is
  // the statement and the tick is the full stop.
  animation: win-beat-stamp 320ms cubic-bezier(0.18, 0.89, 0.32, 1.28) 160ms both

  :deep(svg)
    width: 74%
    height: 74%

.win-beat__count
  display: flex
  align-items: baseline
  gap: 0.18em
  color: #fff
  font-weight: 900
  line-height: 1
  font-size: clamp(1.7rem, 9vmin, 3.2rem)
  text-shadow: 4px 4px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000

.win-beat__sep,
.win-beat__need
  color: rgba(255, 255, 255, 0.62)
  font-size: 0.66em

.win-beat__boss
  color: #ffd9dd
  font-weight: 900
  text-transform: uppercase
  letter-spacing: 0.05em
  text-align: center
  text-wrap: balance
  line-height: 1.15
  font-size: clamp(0.8rem, 4vmin, 1.3rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.9)

.win-beat__caption
  color: #ffd93c
  font-weight: 900
  text-transform: uppercase
  letter-spacing: 0.12em
  line-height: 1.1
  text-align: center
  font-size: clamp(0.62rem, 3vmin, 0.95rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.9)

@keyframes win-beat-stamp
  0%
    scale: 2.4
    opacity: 0
  100%
    scale: 1
    opacity: 1

// Reduced motion: the tick is simply there, and the card fades instead of
// springing. Nothing is removed — see `winBeatPlan`, which keeps the hold.
.win-beat.is-calm .win-beat__tick
  animation: none

.win-beat-enter-active
  transition: opacity 200ms ease-out, scale 360ms cubic-bezier(0.18, 0.89, 0.32, 1.28)
.win-beat-leave-active
  transition: opacity 220ms ease-in, scale 220ms ease-in
.win-beat-enter-from
  opacity: 0
  scale: 0.72
.win-beat-leave-to
  opacity: 0
  scale: 1.06

.is-calm.win-beat-enter-active,
.is-calm.win-beat-leave-active
  transition: opacity 200ms linear
.is-calm.win-beat-enter-from,
.is-calm.win-beat-leave-to
  scale: 1
</style>
