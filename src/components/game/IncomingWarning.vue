<template lang="pug">
  Transition(name="incoming")
    div.incoming(v-if="show" role="status" :aria-label="t('hud.incoming')")
      svg.incoming__glyph(viewBox="0 0 24 24" aria-hidden="true")
        path(
          d="M12 3.2 22 20.4H2Z"
          fill="currentColor"
          stroke="rgba(0,0,0,0.55)"
          stroke-width="1.4"
          stroke-linejoin="round"
        )
        rect(x="11" y="9" width="2" height="6" rx="1" fill="#1b0d04")
        rect(x="11" y="16.2" width="2" height="2" rx="1" fill="#1b0d04")
      //- The instruction, not just the alarm. A warning symbol says "something
      //- is wrong"; this says what to do about it, which is the only part that
      //- helps a player who has not worked out that the ring on the ground is
      //- dodgeable. One word, because it is read at a glance mid-dodge.
      span.incoming__word {{ t('hud.dodge') }}
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * ─── The incoming-attack warning ────────────────────────────────────────────
 *
 * A badge in a FIXED corner, up for exactly as long as a big attack is winding
 * up.
 *
 * The in-world telegraphs — the ring on the ground, the falling rock — solve
 * "where is the damage coming from". This solves a different half of the same
 * problem: "am I about to be hit at all". A player whose eyes are on the boss,
 * or on their own thumb, has no reliable place to check, and the answer was
 * only ever painted on the one patch of road they were not looking at.
 *
 * So it is always in the same place. A corner badge is worth more than a
 * prettier in-world effect precisely because it never moves: it can be learned
 * once and then checked with peripheral vision, which is all a player steering
 * with a thumb has spare.
 *
 * Top RIGHT, and small. The left is where the run's own numbers live and the
 * middle is the road; the right corner is the only real estate that is quiet
 * during a fight. It is deliberately not a countdown — the ring on the ground
 * already says how long, and two clocks disagreeing is worse than one.
 */
const { t } = useI18n()

defineProps<{ show: boolean }>()
</script>

<style scoped lang="sass">
.incoming
  position: absolute
  display: flex
  flex-direction: column
  align-items: center
  gap: 0.1rem
  // ─── How big the alarm is ──────────────────────────────────────────────────
  //
  // A TENTH OF THE SCREEN'S WIDTH, as a floor. This used to be `clamp(1.9rem,
  // 8.5vw, 2.6rem)`, which is a phone rule that a desktop window silently
  // repeals: 8.5vw only wins between roughly 360 px and 490 px of viewport, and
  // above that the badge is pinned at 2.6rem — about **2 %** of a 1920 px
  // screen, in the one corner a player is not looking at. The thing has to be
  // caught in peripheral vision while the eyes are on the crowd, and peripheral
  // vision reads SIZE before it reads shape or colour.
  //
  // The `vh` term is a guard, not a preference: 10vw on a landscape phone
  // (844 x 390) is a badge a fifth of the screen tall, and this is an overlay on
  // a fight, not the fight. It only ever binds where the viewport is much wider
  // than it is tall, which is exactly where 10vw stops being modest.
  --incoming-size: min(max(10vw, 1.9rem), 22vh)
  top: calc(clamp(2.6rem, 11vw, 3.6rem) + env(safe-area-inset-top, 0px))
  right: calc(clamp(0.4rem, 2.2vw, 0.8rem) + env(safe-area-inset-right, 0px))
  // Sized by its CONTENT, not by the glyph. The word under it is one short verb
  // in English and "Ausweichen" in German, and a box pinned to the glyph's width
  // would have pushed the longer ones off the right edge of the screen. Anchored
  // on the right, so anything wider grows inward across the road rather than out
  // of the viewport.
  color: #ffb32e
  // Never eats a steer — the player is mid-dodge when this is up.
  pointer-events: none
  z-index: 42
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.7))
  animation: incoming-pulse 0.42s ease-in-out infinite

.incoming__glyph
  width: var(--incoming-size)
  height: var(--incoming-size)
  display: block

.incoming__word
  font-weight: 900
  // Tied to the glyph rather than to the viewport, so the word never detaches
  // from the triangle it belongs to. Floored at 0.55rem — the old minimum —
  // because a caption that scales all the way down stops being legible before
  // the glyph does.
  font-size: max(0.55rem, calc(var(--incoming-size) * 0.28))
  letter-spacing: 0.08em
  text-transform: uppercase
  line-height: 1
  color: #fff
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.8)
  white-space: nowrap

// Fast enough to read as an alarm rather than as decoration, and it flashes to
// white at the top of each beat so it still registers in peripheral vision.
@keyframes incoming-pulse
  0%, 100%
    transform: scale(1)
    color: #ffb32e
  50%
    transform: scale(1.16)
    color: #fff1c9

.incoming-enter-active
  transition: opacity 0.09s ease

.incoming-leave-active
  transition: opacity 0.22s ease

.incoming-enter-from, .incoming-leave-to
  opacity: 0
</style>
