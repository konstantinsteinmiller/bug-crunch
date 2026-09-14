<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'

/**
 * ─── The three stars, awarded ───────────────────────────────────────────────
 *
 * The result screen's headline. Three sockets that fill IN SEQUENCE, ~320 ms
 * apart, each one landing with a spring, a flash and a burst.
 *
 * ── Why it is staggered ──
 *
 * Three stars appearing at once is a state. Three stars landing one after
 * another is an EVENT, and it is the moment the whole level was for. The
 * stagger also gives the sound somewhere to go: one chime per star, rising, so
 * a three-star clear is a three-note phrase and a one-star clear is a single
 * note that does not pretend otherwise.
 *
 * The caller owns the sound — `@land` fires once per star as it arrives, with
 * its index — because the audio module is the scene's business and this is a
 * picture.
 */

interface Props {
  /** How many are earned, 0..3. */
  stars: number
  /** Which were already held before this run, so a replay can show what is NEW
   *  rather than re-awarding what the player already had. */
  previous?: number
  /** Reduced motion: land them all at once, silently. */
  calm?: boolean
}

const props = withDefaults(defineProps<Props>(), { previous: 0, calm: false })
const emit = defineEmits<{ (e: 'land', index: number): void }>()
const { t } = useI18n()

/** How many are currently shown as lit. Animated up from 0. */
const lit = ref(0)
const timers: ReturnType<typeof setTimeout>[] = []

const STEP_MS = 340

const run = (): void => {
  for (const id of timers) clearTimeout(id)
  timers.length = 0
  lit.value = 0
  const n = Math.max(0, Math.min(3, props.stars))
  if (props.calm) {
    lit.value = n
    return
  }
  for (let i = 0; i < n; i++) {
    timers.push(setTimeout(() => {
      lit.value = i + 1
      emit('land', i)
    }, 260 + i * STEP_MS))
  }
}

onMounted(run)
watch(() => props.stars, run)
</script>

<template lang="pug">
  div.stars(:aria-label="t('result.starsEarned', { n: stars })")
    div.stars__socket(
      v-for="i in 3"
      :key="i"
      :class="{ 'is-lit': i <= lit, 'is-new': i <= lit && i > previous }"
    )
      GameIcon.stars__empty(name="star-empty")
      GameIcon.stars__full(name="star")
      span.stars__burst(aria-hidden="true")
</template>

<style scoped lang="sass">
// ─── Sizing ──────────────────────────────────────────────────────────────────
//
// `cqmin`, not `vmin`: inside the reward overlay these resolve against the
// overlay's own box (see `FReward.vue`), and on the level banner — where there
// is no size container — they fall back to the small viewport, which is what
// `vmin` meant here before.
//
// The rem CEILINGS are a resolution budget, not a taste call. A painted mark is
// `images/ui/star.webp`; drawn larger than its source it is a blur, and this row
// is the first thing on the result screen. 4.2rem = 67.2 CSS px wants 134 device
// px at dpr 2 and 202 at dpr 3 — 0.53x and 0.79x of a 256px sheet, so the mark is
// never asked for pixels it does not have. The old 4.8rem was 1.2x / 1.8x of the
// 128px sheet these were cut at, which is the blur the row was reported for.
.stars
  display: flex
  align-items: center
  justify-content: center
  gap: clamp(0.25rem, 1.8cqmin, 0.7rem)

.stars__socket
  --star-edge: clamp(2rem, 10.5cqmin, 3.4rem)
  position: relative
  display: flex
  align-items: center
  justify-content: center
  width: var(--star-edge)
  height: var(--star-edge)

  // The middle star sits a little higher, the way every mobile game's star row
  // does. It is what stops three identical marks reading as a progress bar.
  &:nth-child(2)
    --star-edge: clamp(2.4rem, 12.8cqmin, 4.2rem)
    margin-bottom: clamp(0.25rem, 1.8cqmin, 0.7rem)

.stars__empty, .stars__full
  position: absolute
  inset: 0
  width: 100%
  height: 100%

.stars__empty
  color: rgba(255, 255, 255, 0.22)

.stars__full
  color: #ffd93c
  opacity: 0
  scale: 2.2
  rotate: -25deg
  filter: drop-shadow(0 0 0 rgba(255, 217, 60, 0))

// The glow is a FRACTION OF THE STAR, not 12 hard pixels. At the sizes this row
// actually runs at — 40-67px — a 12px blur is a quarter of the mark's radius of
// haze laid over its own outline, which is most of why a painted star read as
// soft. 0.14 of the edge keeps the halo and gives the silhouette back.
.is-lit .stars__full
  opacity: 1
  scale: 1
  rotate: 0deg
  filter: drop-shadow(0 0 calc(var(--star-edge) * 0.14) rgba(255, 217, 60, 0.8))
  transition: opacity 120ms ease-out, scale 420ms cubic-bezier(0.18, 0.89, 0.32, 1.28), rotate 420ms cubic-bezier(0.18, 0.89, 0.32, 1.28), filter 320ms ease-out

.stars__burst
  position: absolute
  inset: -30%
  border: 3px solid rgba(255, 217, 60, 0.9)
  border-radius: 999px
  opacity: 0
  pointer-events: none

.is-lit .stars__burst
  animation: star-burst 460ms ease-out

// A star the player did NOT have before keeps a slow shimmer, so a replay that
// added one says which one it added.
.is-new .stars__full
  animation: star-shimmer 2.2s ease-in-out 0.6s infinite

@keyframes star-burst
  0%
    opacity: 0.95
    scale: 0.4
  100%
    opacity: 0
    scale: 1.5

@keyframes star-shimmer
  0%, 100%
    filter: drop-shadow(0 0 calc(var(--star-edge) * 0.12) rgba(255, 217, 60, 0.7))
  50%
    filter: drop-shadow(0 0 calc(var(--star-edge) * 0.22) rgba(255, 255, 190, 1))

@media (prefers-reduced-motion: reduce)
  .is-lit .stars__full
    transition: opacity 120ms ease-out
  .stars__burst, .is-new .stars__full
    animation: none
</style>
