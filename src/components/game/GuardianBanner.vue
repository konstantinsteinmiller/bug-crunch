<template lang="pug">
  Transition(name="guardian")
    div.guardian(v-if="show" role="status" aria-live="polite")
      div.guardian__plate
        //- The sigil. Drawn here rather than pulled from `iconPaths` on
        //- purpose: the shared set is one flat 24-unit box in a single colour,
        //- and this is a wide two-tone emblem used in exactly one place in the
        //- game. Same argument as `IncomingWarning`'s triangle.
        svg.guardian__sigil(viewBox="0 0 48 26" aria-hidden="true")
          ellipse.guardian__halo(cx="24" cy="4.6" rx="4.9" ry="2.1")
          g.guardian__wings
            path(d="M21.4 13.2C16.4 10.4 11 9.8 5.6 10.9")
            path(d="M21.4 15.6C17 13.8 12.3 13.8 7.7 15.2")
            path(d="M21.6 17.9C17.6 17.2 14 17.8 10.4 19.4")
            path(d="M26.6 13.2C31.6 10.4 37 9.8 42.4 10.9")
            path(d="M26.6 15.6C31 13.8 35.7 13.8 40.3 15.2")
            path(d="M26.4 17.9C30.4 17.2 34 17.8 37.6 19.4")
        div.guardian__text
          span.guardian__title {{ t('flow.guardian') }}
          //- The half that answers the actual question. "Guardian angel" says a
          //- thing happened; this says WHAT it handed back, in the unit the
          //- player has been watching in the HUD all run.
          span.guardian__sub {{ t('flow.guardianSub', { n: count }) }}
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * ─── The rally announcement ─────────────────────────────────────────────────
 *
 * What the player reads when a wiped crowd is handed back mid-run.
 *
 * The rally (`GameScene`'s policy, `tryRally` in the sim) shipped with nothing
 * but a one-word banner and it did not survive contact: survivors reappeared a
 * frame after the last one died and the honest reading was that the game had
 * glitched. A gift the player cannot explain is not a gift — it is a bug they
 * happened to benefit from, and it teaches them that the rules are soft.
 *
 * So it is named. An agent ("a guardian angel"), an outcome ("saved you") and
 * the number of bodies that came back, held long enough to be read DURING the
 * fight that is still going on — three seconds, twice the handover banner's
 * 1.7, because this one arrives while the player is being attacked rather than
 * over an empty stretch of new road.
 *
 * It sits directly under the boss / progress rail rather than mid-screen where
 * `StageBanner` lives, for two reasons: the crowd is the thing the player must
 * keep steering and the middle of the screen is where they are looking to do
 * it, and the in-world halo (`drawRallyHalo`) is already occupying that space
 * with the other half of the same message. Words up top, miracle on the road.
 */
const { t } = useI18n()

defineProps<{
  show: boolean
  /** Survivors handed back — the `+N` the in-world burst also shouts. */
  count: number
}>()
</script>

<style scoped lang="sass">
.guardian
  // Hung under the HUD rather than added to it: this is up for three seconds
  // and the rail, the chips and the hint below them may not move because of it.
  position: absolute
  top: 100%
  left: 0
  right: 0
  margin-top: clamp(0.25rem, 1.4vw, 0.5rem)
  display: flex
  justify-content: center
  pointer-events: none
  z-index: 44

// The pill. Dark enough to hold white text over a lit road, and gold-rimmed
// rather than cyan: cyan is the shield the player BOUGHT, gold is everything
// the game hands them for free.
.guardian__plate
  display: flex
  align-items: center
  gap: clamp(0.4rem, 2.2vw, 0.7rem)
  max-width: min(92%, 30rem)
  padding: clamp(0.3rem, 1.5vw, 0.5rem) clamp(0.65rem, 3.2vw, 1.05rem)
  border-radius: 999px
  background-color: rgba(10, 20, 38, 0.86)
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 0.13rem rgba(255, 217, 60, 0.36)

.guardian__sigil
  flex: 0 0 auto
  width: clamp(2.2rem, 11vw, 3.1rem)
  height: auto
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.75))
  // The wing beat. One slow pulse, so the emblem is alive for the whole three
  // seconds without ever competing with the road underneath it.
  animation: guardian-beat 1.15s ease-in-out infinite

.guardian__halo
  fill: none
  stroke: #ffe9a8
  stroke-width: 2

.guardian__wings
  fill: none
  stroke: #ffd76a
  stroke-width: 2.3
  stroke-linecap: round

.guardian__text
  display: flex
  flex-direction: column
  align-items: flex-start
  min-width: 0
  line-height: 1.12

.guardian__title
  font-weight: 900
  // Three words in English and rather more in German — the pill is capped at
  // 92 % of the screen and the line wraps inside it, which is why the sigil is
  // a flex-fixed column of its own rather than part of the text flow.
  font-size: clamp(0.78rem, 3.9vw, 1.05rem)
  letter-spacing: 0.02em
  color: #fff
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.75), 0 0 0.9rem rgba(255, 214, 120, 0.55)

.guardian__sub
  font-weight: 800
  font-size: clamp(0.62rem, 3.1vw, 0.8rem)
  letter-spacing: 0.04em
  text-transform: uppercase
  color: #ffd76a

@keyframes guardian-beat
  0%, 100%
    transform: scale(1)
    opacity: 0.94
  50%
    transform: scale(1.09)
    opacity: 1

// Lands hard on the beat the survivors reappear on, and leaves gently: the
// arrival is the news, the departure is not.
.guardian-enter-active
  transition: opacity 0.14s ease, transform 0.34s cubic-bezier(0.2, 1.7, 0.4, 1)

.guardian-leave-active
  transition: opacity 0.45s ease, transform 0.45s ease

.guardian-enter-from
  opacity: 0
  transform: translateY(-0.5rem) scale(0.82)

.guardian-leave-to
  opacity: 0
  transform: translateY(-0.4rem) scale(0.98)

// Reduced motion keeps the label and drops the beat — the information is in
// the words, and the pulse is decoration.
@media (prefers-reduced-motion: reduce)
  .guardian__sigil
    animation: none
</style>
