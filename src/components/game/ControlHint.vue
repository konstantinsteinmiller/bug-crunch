<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { isMobilePortrait } from '@/use/useUser'
import { mobileCheck } from '@/utils/function'

/**
 * ─── The on-screen control primer ───────────────────────────────────────────
 *
 * One pill, one lesson at a time, phrased for the input device the player
 * actually has — a wrong verb ("Click" on a phone) reads as a bug — and it
 * retires itself the moment the action is performed. Nagging a competent player
 * is its own kind of failure.
 *
 *   move       the only control there is, and the only hint every player sees
 *   slam       hold to charge, which is the answer to everything armoured
 *   beetle     a shell that taps bounce off
 *   flea       a target that moves when you aim at it
 *   spike      the caterpillar, the one thing stomping is wrong for
 *   stink      the haze, and why a direct stomp is sometimes the worst option
 *   fever      the vial is full and the button is live
 *   honey      a puddle that holds a jumper still
 *   web        a floor that slows the foot
 *   belt       a floor that moves what is standing on it
 *   sweeper    a machine that kills for free, if you can herd into it
 *   boss       the charge tell, and the slam that answers it
 *   pods       the phase where the boss is not the target
 *
 * ─── Being held quiet ───────────────────────────────────────────────────────
 *
 * `suppressed` is the one way anything outside this component can silence it,
 * and it exists because of a single rule: A SCREEN MAY CARRY EXACTLY ONE
 * INSTRUCTION AT A TIME, and the one with a countdown on it wins. A boss tell is
 * about this second; a primer is about the game. So the scene holds this pill
 * quiet for as long as it is telling the player to do something else, and lets
 * it back when it is not.
 *
 * Held QUIET, not retired: `hint` is untouched, nothing is marked as seen, and
 * the same pill with the same text comes back the moment the flag drops.
 * Suppression is a property of the FRAME; the lesson belongs to the level.
 */

export type HintId =
  | 'move' | 'slam' | 'beetle' | 'flea' | 'spike' | 'stink' | 'fever'
  | 'honey' | 'web' | 'belt' | 'sweeper' | 'boss' | 'pods'

interface Props {
  hint: HintId | null
  /**
   * Hold the pill off the screen without touching the hint behind it.
   *
   * Default false. True hides the pill through the component's own transition —
   * so it leaves and returns the way it always does, rather than popping — and
   * changes nothing else: `hint` still says what is being taught, the text is
   * still computed for it, and dropping the flag brings the same pill back.
   *
   * The caller owns the WHY (see the block above). This component deliberately
   * does not know what it is being suppressed for: a pill that decided for
   * itself which of the scene's warnings outranked it would need to know about
   * every one of them, and would be wrong the first time a new one was added.
   */
  suppressed?: boolean
}

const props = withDefaults(defineProps<Props>(), { suppressed: false })
const { t } = useI18n()

/**
 * Whether the pill is on screen at all.
 *
 * Both halves in one condition so there is exactly one thing for the transition
 * to watch: a hint that retires and a hint that is being held quiet leave the
 * screen by the same 260 ms, which is the point — from the player's side there
 * is no difference between "that lesson is over" and "not now", and a pill that
 * vanished differently for the second would read as a glitch.
 */
const shown = computed(() => !!props.hint && !props.suppressed)

const isTouch = computed(() => mobileCheck() || isMobilePortrait.value
  || (typeof window !== 'undefined' && navigator.maxTouchPoints > 0))

const text = computed(() => {
  if (!props.hint) return ''
  // Each hint has a touch and a pointer phrasing — "Tap" against "Click",
  // "Drag" against "Move the mouse" — because a wrong verb reads as a bug.
  return t(`hints.${props.hint}.${isTouch.value ? 'touch' : 'desktop'}`)
})
</script>

<template lang="pug">
  //- `type="transition"` is LOAD-BEARING, not tidiness. `.control-hint` carries
  //- `animation: hint-breathe … infinite`, and Vue times a leave off whichever
  //- of transition-duration and animation-duration is longer — so it picked the
  //- 2.4 s animation and then waited for an `animationend` that an infinite
  //- animation never fires. The pill was removed from the render tree and left
  //- in the DOM FOREVER, breathing at full opacity.
  //-
  //- Measured in a browser: the component reported `suppressed: true, shown:
  //- false` while the element was still on screen. Nothing caught it because
  //- `@vue/test-utils` stubs `Transition` by default and renders the children
  //- straight through — see `tests/ui/controlHint.test.ts`, which pins the
  //- attribute.
  Transition(name="hint" type="transition")
    div.control-hint(v-if="shown")
      svg.control-hint__icon(viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true")
        //- A pointing hand — universally readable as "do this".
        path(d="M9 11V6a2 2 0 1 1 4 0v5")
        path(d="M13 8a2 2 0 1 1 4 0v6a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.4L4 15a1.6 1.6 0 0 1 2.6-1.9L8 15")
      span.control-hint__text {{ text }}
</template>

<style scoped lang="sass">
.control-hint
  display: inline-flex
  align-items: center
  gap: clamp(0.25rem, 1.4vw, 0.5rem)
  // Floors so the hint is always readable, and a max so it never spans a
  // desktop screen edge-to-edge.
  min-height: 1.75rem
  max-width: min(90vw, 26rem)
  padding: clamp(0.22rem, 1.2vw, 0.45rem) clamp(0.55rem, 3vw, 1rem)
  border: 2px solid rgba(255, 255, 255, 0.18)
  border-radius: 999px
  background-color: rgba(8, 14, 28, 0.72)
  backdrop-filter: blur(3px)
  pointer-events: none
  animation: hint-breathe 2.4s ease-in-out infinite

.control-hint__icon
  flex: 0 0 auto
  width: clamp(0.85rem, 3.6vw, 1.1rem)
  height: clamp(0.85rem, 3.6vw, 1.1rem)
  color: #ffd93c

.control-hint__text
  color: #fff
  font-weight: 900
  text-align: center
  line-height: 1.2
  font-size: clamp(0.62rem, 2.9vw, 0.92rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

.hint-enter-active, .hint-leave-active
  transition: opacity 260ms ease-out, translate 260ms ease-out
  // The breathing stops while the pill is arriving or leaving. It is an
  // opacity loop and the transition is an opacity ramp; run together, the fade
  // reads as a flicker rather than as the pill going away.
  animation: none

.hint-enter-from, .hint-leave-to
  opacity: 0
  translate: 0 0.5rem

@keyframes hint-breathe
  0%, 100%
    opacity: 0.92
  50%
    opacity: 0.68
</style>
