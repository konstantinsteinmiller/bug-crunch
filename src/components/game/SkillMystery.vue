<template lang="pug">
  //- A locked skill slot: grey on grey, with a question mark that is the only
  //- thing on it with any shine. See the header in the script for why it may
  //- look like nothing else on the bar.
  span.mystery
    svg.mystery__disc(viewBox="0 0 44 44" aria-hidden="true")
      defs
        radialGradient(:id="ids.disc" cx="50%" cy="38%" r="62%")
          stop(offset="0%" stop-color="#434955")
          stop(offset="70%" stop-color="#262a33")
          stop(offset="100%" stop-color="#171a20")
      circle(cx="22" cy="22" r="20.5" :fill="`url(#${ids.disc})`")
      //- Rivets rather than a solid rim: a cold, engraved band that reads as
      //- "sealed" from across the screen, and cannot be mistaken for the
      //- cooldown ring an owned skill wears.
      circle.mystery__rim(cx="22" cy="22" r="19")
      circle.mystery__inner(cx="22" cy="22" r="15.2")

    //- What is coming, barely: the skill's own glyph as a dim silhouette, so a
    //- player who looks closely has something to guess from. An empty slot has
    //- no glyph yet and shows the question mark alone.
    GameIcon.mystery__ghost(v-if="icon" :name="icon")

    svg.mystery__mark(viewBox="0 0 44 44" aria-hidden="true")
      defs
        linearGradient(:id="ids.metal" x1="0" y1="0" x2="1" y2="1" spreadMethod="reflect")
          stop(offset="0%" stop-color="#fbfcfe")
          stop(offset="26%" stop-color="#b9bfc9")
          stop(offset="50%" stop-color="#6d7480")
          stop(offset="74%" stop-color="#d9dde3")
          stop(offset="100%" stop-color="#8b919c")
          //- The shine: the whole gradient slides diagonally across the glyph on
          //- a slow loop. Left out entirely for a player who asked the OS for
          //- less motion — an SVG animation is not reachable from a stylesheet.
          animateTransform(
            v-if="!still"
            attributeName="gradientTransform"
            type="translate"
            from="-1 -1"
            to="1 1"
            :dur="`${shineS}s`"
            repeatCount="indefinite"
          )
      g.mystery__q
        text.mystery__glyph(
          x="22" y="31"
          text-anchor="middle"
          :fill="`url(#${ids.metal})`"
        ) ?
        //- A four-point spark on the question mark's shoulder, twinkling off the
        //- beat of the shine so the two never pulse together.
        //- Positioned by the GROUP and animated on the path: a CSS transform on
        //- the path itself would replace an SVG `transform` attribute rather
        //- than compose with it, and the spark would twinkle at the origin.
        g(v-if="!still" transform="translate(29.5 12.5)")
          path.mystery__spark(d="M0,-3 L0.8,-0.8 L3,0 L0.8,0.8 L0,3 L-0.8,0.8 L-3,0 L-0.8,-0.8 Z")
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import type { GameIconName } from '@/components/icons/iconNames'

/**
 * ─── A locked skill slot ────────────────────────────────────────────────────
 *
 * The one thing it must never look like is a skill on cooldown. A cooldown is
 * a button the player owns and is waiting for; this is a button they do not
 * own at all, and a player who confuses the two either presses a dead control
 * in the middle of a fight or stops trusting the bar. So it shares nothing with
 * the owned buttons except its position:
 *
 *   • no cooldown ring — a riveted grey rim instead;
 *   • no colour at all — every tone on it is a grey, and the only highlight is
 *     the shine running across the question mark;
 *   • a question mark in the game's own display face, metallic, bobbing gently,
 *     with a spark on its shoulder — "fancy yet grey", the brief's own words,
 *     and the reason the slot reads as a mystery rather than as a fault.
 *
 * The silhouette behind it is the skill's real glyph at very low contrast, when
 * the slot has a skill yet (`SkillSlot.icon`). It is the half of the tease that
 * rewards looking: the question mark says "something is coming", the ghost
 * says "and you could almost tell what".
 */

const props = defineProps<{
  /** The glyph of the skill that will fill this slot, or null for a slot
   *  whose skill has not been designed yet. */
  icon: GameIconName | null
  /** Seconds per shine sweep. Slots pass different values so a row of them
   *  does not shimmer in lockstep, which reads as one animation, not three. */
  shineS?: number
}>()

const shineS = computed(() => props.shineS ?? 3.2)

/** Gradient ids have to be unique per instance: a row carries up to three of
 *  these, and a duplicated id makes every slot paint with the first one's. */
const uid = useId()
const ids = { disc: `mystery-disc-${uid}`, metal: `mystery-metal-${uid}` }

/** `prefers-reduced-motion`, read once on mount. */
const still = ref(false)
onMounted(() => {
  still.value = typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
})
</script>

<style scoped lang="sass">
.mystery
  position: relative
  display: block
  width: 100%
  height: 100%

.mystery__disc,
.mystery__mark
  position: absolute
  inset: 0
  width: 100%
  height: 100%

.mystery__rim
  fill: none
  stroke: #7b818c
  stroke-width: 1.6
  stroke-dasharray: 1.2 2.6
  stroke-linecap: round
  opacity: 0.7

.mystery__inner
  fill: none
  stroke: rgba(255, 255, 255, 0.07)
  stroke-width: 1

.mystery__ghost
  position: absolute
  left: 22%
  top: 22%
  width: 56%
  height: 56%
  color: #8d939d
  opacity: 0.2

.mystery__q
  transform-box: fill-box
  transform-origin: 50% 60%
  animation: mystery-float 2.8s ease-in-out infinite

.mystery__glyph
  font-family: 'Angry', sans-serif
  font-size: 27px
  stroke: #10131a
  stroke-width: 2.6
  stroke-linejoin: round
  paint-order: stroke
  filter: drop-shadow(0 1.2px 0 rgba(0, 0, 0, 0.6))

.mystery__spark
  fill: #eef1f5
  transform-box: fill-box
  transform-origin: center
  animation: mystery-spark 3.2s ease-in-out 1.1s infinite

@keyframes mystery-float
  0%, 100%
    transform: translateY(0) rotate(-5deg)
  50%
    transform: translateY(-1.6px) rotate(5deg)

@keyframes mystery-spark
  0%, 62%, 100%
    opacity: 0
    transform: scale(0.3)
  74%
    opacity: 0.95
    transform: scale(1)
  86%
    opacity: 0
    transform: scale(0.5)

@media (prefers-reduced-motion: reduce)
  .mystery__q
    animation: none
</style>
