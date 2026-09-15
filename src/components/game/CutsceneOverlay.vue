<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FButton from '@/components/atoms/FButton.vue'

/**
 * ─── The skip control ───────────────────────────────────────────────────────
 *
 * The button is the AFFORDANCE; the whole screen is the HIT AREA. Both, and for
 * different reasons — the full spec is in `cutscenes.md`.
 *
 *   THE SCREEN SKIPS because that is what protects the funnel. The impatient
 *   player's first tap lands somewhere, and wherever it lands it has to count:
 *   `utils/pokiPlugin.ts` gates `gameplayStart` on the first real interaction
 *   because Poki's conversion-to-play is measured on it, and a scene that only
 *   accepts taps inside a 44 px rectangle wastes the first input of everyone
 *   who did not aim at the rectangle.
 *
 *   THE BUTTON EXISTS so the player knows the screen skips. Most people will not
 *   try tapping a cutscene; they sit through it feeling mildly trapped, and that
 *   feeling is the thing a skip control is actually for. Its job is
 *   discoverability, not exclusivity — pressing it and tapping the sky do the
 *   same thing, deliberately.
 *
 * The scene itself is `aria-hidden`: it is wordless decoration with nothing to
 * announce, so the button is the only thing in here a reader ever meets.
 */

const emit = defineEmits<{ (e: 'skip'): void }>()
const { t } = useI18n()

/** One press, one skip. Guards against a double-tap skipping the cutscene AND
 *  dismissing the level banner that is about to appear behind it. */
const spent = ref(false)
const btn = ref<InstanceType<typeof FButton> | null>(null)

const skip = (): void => {
  if (spent.value) return
  spent.value = true
  emit('skip')
}

/** `Esc` for the convention, `Space` and `Enter` because the button has focus
 *  and a player who has tabbed to it expects them to work. */
const onKey = (e: KeyboardEvent): void => {
  if (e.code !== 'Escape' && e.code !== 'Space' && e.code !== 'Enter') return
  e.preventDefault()
  skip()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  // The only interactive thing on screen, so it takes focus — a keyboard player
  // should not have to hunt for it inside nine seconds.
  void btn.value?.$el?.focus?.({ preventScroll: true })
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template lang="pug">
  //- The catcher. Covers everything, sits under the button, and turns any tap
  //- into a skip. `touch-none` so a drag across the scene does not scroll the
  //- portal's iframe instead of skipping.
  div.cutscene-skip.fixed.inset-0.touch-none(
    class="z-[90]"
    @pointerdown.prevent="skip"
  )
    div.cutscene-skip__corner
      FButton(
        ref="btn"
        icon="skip-forward"
        type="secondary"
        size="md"
        :is-disabled="spent"
        @click.stop="skip"
      ) {{ t('cutscene.skip') }}
</template>

<style scoped lang="sass">
.cutscene-skip
  // Decoration over a scene that is itself decoration: nothing here is
  // announced, and the button below re-enables its own pointer events.
  cursor: pointer

// Bottom-right on EVERY device, rather than moving to a desktop convention.
// The game is one layout that reflows, and a control that relocates between
// form factors is two layouts to reason about. The corner is free in both: the
// HUD is not mounted during a cutscene, so there is no collision with
// `.scene__locker`, which normally lives here.
//
// The safe-area insets are not polish. Bottom-right on a phone is the corner
// that collides with the iOS home indicator and the Android gesture bar, and a
// skip button under the home bar is a skip button that opens the app switcher.
.cutscene-skip__corner
  position: absolute
  right: calc(clamp(0.5rem, 3vw, 1rem) + env(safe-area-inset-right, 0px))
  bottom: calc(clamp(0.5rem, 3vw, 1rem) + env(safe-area-inset-bottom, 0px))
  display: flex
  // The catcher owns the taps; the button takes its own back so a press reads
  // as a press and gets the focus ring.
  pointer-events: auto

  // Fully opaque from the first frame and never animated in. A skip control
  // that fades up over half a second is invisible during exactly the window in
  // which an impatient player decides whether to bounce.
  //
  // It also does NOT pulse. `FReward`'s tap-to-continue hint pulses because it
  // is asking for an action; this one is offering an escape, and an escape
  // hatch that throbs reads as the game nagging the player to leave.
  :deep(button)
    // The scene behind it is a bright, sunlit, pale gingham — the hardest
    // background this game has for UI. The plate and contour `FButton` already
    // carries are what keep it readable; this only guarantees the touch floor.
    min-height: 2.75rem
</style>
