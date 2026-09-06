<template lang="pug">
  div.skills(:style="barStyle")
    button.skills__btn(
      v-for="s in visible"
      :key="s.id"
      type="button"
      :class="{ 'skills__btn--ready': s.ready, 'skills__btn--live': s.live }"
      :disabled="!s.ready"
      :aria-label="s.label"
      :title="s.label"
      @pointerdown.stop.prevent="onUse(s.id)"
    )
      //- The cooldown ring. An SVG arc rather than a CSS conic gradient: the
      //- ring has to read at 44px on a phone, and a stroked circle keeps its
      //- weight at any size where a gradient wedge turns to mush.
      svg.skills__ring(viewBox="0 0 44 44" aria-hidden="true")
        circle.skills__ring-track(cx="22" cy="22" r="19")
        circle.skills__ring-fill(
          cx="22" cy="22" r="19"
          :stroke-dasharray="RING"
          :stroke-dashoffset="RING * (1 - s.charge)"
        )

      //- The glyph, or its painting once the art pipeline has one — see `ArtIcon`.
      ArtIcon.skills__icon(kind="ui" :id="s.art" :fallback="s.icon")

      //- Seconds remaining, so the wait is a number and not a guess.
      span.skills__count(v-if="!s.ready") {{ Math.ceil(s.leftMs / 1000) }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ArtIcon from '@/components/icons/ArtIcon.vue'
import type { GameIconName } from '@/components/icons/iconNames'
import {
  skillCharge, skillOwned, skillReady, skillReadyIn, type SkillId
} from '@/use/useSkills'

/**
 * ─── The skill bar ──────────────────────────────────────────────────────────
 *
 * Two buttons, and the whole design problem is WHERE.
 *
 * The road runs down the middle of the screen and the crowd sits low in it, so
 * the centre is unavailable at any height a thumb can reach. The bottom corners
 * are already spoken for — mute/board/settings on the left, the shop on the
 * right — and a control that overlaps either of those gets pressed by accident
 * on a phone.
 *
 * So the bar sits on the RIGHT EDGE, stacked vertically, just above the bottom
 * bar: inside the natural arc of a right thumb, clear of the shop button below
 * it, and outside the lane rails on every viewport the game supports. It is
 * anchored to the HUD's own bottom inset, so it rides above the safe-area on a
 * notched phone rather than under it.
 *
 * `pointerdown` rather than `click`, and stopped: the canvas underneath treats
 * a pointer as steering, and a skill press must not also throw the crowd
 * sideways. `.prevent` keeps a phone from firing the synthetic click afterwards.
 */
const { t } = useI18n()

const emit = defineEmits<{ (e: 'use', id: SkillId): void }>()

/** Circumference of r=19, for the cooldown arc. */
const RING = 2 * Math.PI * 19

interface Props {
  /** True while the shield is actually up — the button glows rather than waits. */
  shieldLive: boolean
  /**
   * Half the road's width in CSS pixels, measured by the scene.
   *
   * On a desktop viewport the road is a narrow strip down the middle with a lot
   * of empty page either side, so the bar is parked just OUTSIDE the right rail
   * rather than out at the window edge: a mouse reaching for a skill should not
   * have to cross the whole margin. On a phone the road fills the screen, there
   * is no margin to sit in, and the bar stays at the edge.
   */
  laneHalfPx: number
}
const props = defineProps<Props>()

/**
 * Where the bar sits horizontally.
 *
 * `null` on a narrow screen — the stylesheet's edge anchoring is correct there.
 * On a wide one it is pinned a short gap right of the rail.
 */
const rightOffset = computed(() => {
  if (typeof window === 'undefined') return null
  const margin = (window.innerWidth - props.laneHalfPx * 2) / 2
  // Only when there is genuinely room beside the road for a button plus a gap.
  if (margin < 92) return null
  return `${Math.max(8, margin - 74)}px`
})

const barStyle = computed(() => (rightOffset.value ? { right: rightOffset.value } : {}))

const ORDER: ReadonlyArray<{ id: SkillId; icon: GameIconName; art: string; key: string }> = [
  { id: 'grenade', icon: 'bomb', art: 'skill-grenade', key: 'skills.grenade' },
  { id: 'shield', icon: 'shield', art: 'skill-shield', key: 'skills.shield' }
]

/**
 * Only what the player owns. An unbought shield shows nothing at all rather
 * than a locked button: the shop is where things are bought, and a permanently
 * dead control in the middle of a run teaches the player to ignore that corner
 * of the screen — which is the corner the grenade lives in.
 */
const visible = computed(() =>
  ORDER.filter((s) => skillOwned(s.id)).map((s) => ({
    id: s.id,
    icon: s.icon,
    art: s.art,
    label: t(s.key),
    ready: skillReady(s.id),
    charge: skillCharge(s.id),
    leftMs: skillReadyIn(s.id),
    live: s.id === 'shield' && props.shieldLive
  }))
)

const onUse = (id: SkillId): void => {
  if (!skillReady(id)) return
  emit('use', id)
}
</script>

<style scoped lang="sass">
.skills
  position: absolute
  right: calc(clamp(0.35rem, 2vw, 0.7rem) + env(safe-area-inset-right, 0px))
  // Clear of the bottom bar, which owns the corners.
  bottom: calc(clamp(4.6rem, 17vw, 6.2rem) + env(safe-area-inset-bottom, 0px))
  display: flex
  flex-direction: column
  gap: clamp(0.4rem, 2.2vw, 0.7rem)
  // The HUD layer is pointer-events: none; the buttons opt back in.
  pointer-events: none
  z-index: 30

.skills__btn
  position: relative
  pointer-events: auto
  width: clamp(2.9rem, 13vw, 3.6rem)
  height: clamp(2.9rem, 13vw, 3.6rem)
  padding: 0
  border: none
  border-radius: 50%
  background-color: rgba(8, 14, 28, 0.82)
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5)
  color: rgba(255, 255, 255, 0.42)
  display: flex
  align-items: center
  justify-content: center
  // A skill on cooldown is dimmed, not hidden: the player has to be able to see
  // that they own it and that it is coming back.
  transition: color 0.2s ease, background-color 0.2s ease
  -webkit-tap-highlight-color: transparent

.skills__btn--ready
  color: #ffd93c
  background-color: rgba(24, 34, 58, 0.92)
  animation: skill-ready 2.2s ease-in-out infinite

.skills__btn--live
  color: #7fe3ff

.skills__icon
  width: 52%
  height: 52%

// A painting carries its own colours and outline, so it sits larger than the
// flat glyph — and the cooldown dim the glyph gets through `color` is done
// with a filter here, so a spent skill still reads as spent.
img.skills__icon
  width: 66%
  height: 66%
  filter: saturate(0.35) brightness(0.55)
  transition: filter 0.2s ease

.skills__btn--ready img.skills__icon,
.skills__btn--live img.skills__icon
  filter: none

.skills__ring
  position: absolute
  inset: 0
  width: 100%
  height: 100%
  transform: rotate(-90deg)

.skills__ring-track
  fill: none
  stroke: rgba(255, 255, 255, 0.12)
  stroke-width: 3

.skills__ring-fill
  fill: none
  stroke: currentColor
  stroke-width: 3
  stroke-linecap: round
  opacity: 0.9
  transition: stroke-dashoffset 0.2s linear

.skills__count
  position: absolute
  font-weight: 900
  font-size: clamp(0.7rem, 3.2vw, 0.95rem)
  color: #fff
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

// A ready skill breathes, so it is findable without looking for it.
@keyframes skill-ready
  0%, 100%
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 0 rgba(255, 217, 60, 0)
  50%
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 0.28rem rgba(255, 217, 60, 0.16)
</style>
