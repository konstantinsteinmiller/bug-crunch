<template lang="pug">
  div.skills(ref="barRef" :class="{ 'skills--under': under }" :style="barStyle")
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ArtIcon from '@/components/icons/ArtIcon.vue'
import type { GameIconName } from '@/components/icons/iconNames'
import {
  skillCharge, skillOwned, skillReady, skillReadyIn, type SkillId
} from '@/use/useSkills'
import {
  SKILL_ROW_HUD_GAP_PX, skillRowFitsUnderSquad
} from '@/components/game/skillBarPlacement'

/**
 * ─── The skill bar ──────────────────────────────────────────────────────────
 *
 * Two buttons, and the whole design problem is WHERE.
 *
 * ─── Why not the right edge ─────────────────────────────────────────────────
 *
 * It used to live out there, stacked vertically just outside the right rail,
 * on a thumb argument: inside the arc of a right hand, clear of the corners
 * that mute/board/settings and the shop already own.
 *
 * That argument ignores what a MOUSE has to do to reach it. On a desktop the
 * crowd follows the cursor while it is over the road, so a player reaching for
 * a skill drags their whole squad across the lane and parks it against the
 * right rail on the way — every single time. The button was reachable and the
 * cost of reaching it was the run. Steering already stops at the rails (see
 * `onPointerMove` in the scene), so the crowd is not dragged out of the road —
 * it is dragged to the WRONG SIDE of it, which is worse than either.
 *
 * ─── So it sits under the squad ─────────────────────────────────────────────
 *
 * Centred on the road, low, in the band between the deepest a survivor is ever
 * drawn (`squadFloorPx`) and the top of the bottom HUD strip (`hudBottomPx`).
 * The camera already keeps the crowd out of that strip — `setViewport` is given
 * the HUD's measured height precisely so the squad is never framed underneath
 * it — which makes this the one piece of screen the crowd cannot reach.
 *
 * Two things fall out of it, and both are the point:
 *
 *   • the cursor travels DOWN the same column it was already in, so the crowd
 *     does not move at all on the way to the button;
 *   • the button is a long way from where the cursor sits while steering, so a
 *     left click meant for the road does not land on a skill. The row is pushed
 *     as low as the strip allows rather than centred in it, because every pixel
 *     of that gap is bought from the same budget.
 *
 * ─── …unless the screen has no such band ────────────────────────────────────
 *
 * A landscape phone has none: measured at 844x390, the crowd's own footprint
 * ends 3 px above the HUD strip, and a row placed there would sit on the squad.
 * So the placement is CONDITIONAL — it takes the band when the band clears a
 * full-size crowd, and otherwise falls back to the old right-edge column, which
 * is out beside the road where a crowd never is. Portrait phones and desktops
 * measure 48 px and 18 px of clearance respectively and take the band.
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
   *
   * Only used by the fallback layout; the placement under the squad is centred
   * on the road, which is the middle of the viewport on every aspect ratio.
   */
  laneHalfPx: number
  /** The lowest pixel a survivor can ever be drawn at — the scene measures it
   *  off the camera, for a FULL-SIZE crowd. */
  squadFloorPx: number
  /** Height of the bottom HUD strip in CSS pixels, safe-area included: what
   *  the row sits on top of. */
  hudBottomPx: number
}
const props = defineProps<Props>()

const barRef = ref<HTMLElement | null>(null)
/** One button's height, and the viewport's, both re-read on resize.
 *
 * A BUTTON rather than the bar: the fallback stacks two of them and the
 * placement lays them in a row, so measuring the container would feed the
 * layout's own height back into the choice between the two layouts and pin it
 * to whichever it started in. A button is the same size in both. */
const btnPx = ref(0)
const viewPx = ref(0)

const measure = (): void => {
  if (typeof window === 'undefined') return
  viewPx.value = window.innerHeight
  const first = barRef.value?.firstElementChild
  btnPx.value = first ? first.getBoundingClientRect().height : 0
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})
onUnmounted(() => {
  if (typeof window !== 'undefined') window.removeEventListener('resize', measure)
})

/** Is there room under the squad? See `skillBarPlacement.ts` for the rule and
 *  the measurements behind it. */
const under = computed(() => skillRowFitsUnderSquad({
  viewportPx: viewPx.value,
  hudBottomPx: props.hudBottomPx,
  squadFloorPx: props.squadFloorPx,
  buttonPx: btnPx.value
}))

/**
 * Where the bar sits horizontally, in the fallback.
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

const barStyle = computed(() => {
  // Centred on the road and parked on the HUD strip. `left`/`transform` beat
  // the stylesheet's edge anchoring, and `right: auto` releases it.
  if (under.value) {
    return {
      left: '50%',
      right: 'auto',
      bottom: `${Math.round(props.hudBottomPx + SKILL_ROW_HUD_GAP_PX)}px`,
      transform: 'translateX(-50%)'
    }
  }
  return rightOffset.value ? { right: rightOffset.value } : {}
})

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

// A skill bought mid-run adds a button, and the first one to appear is what
// `measure` reads its size from — so the count is a re-measure trigger as much
// as a resize is.
watch(() => visible.value.length, () => { void nextTick(measure) })

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
  // The HUD layer is pointer-events: none; the buttons opt back in. Note that
  // the CONTAINER stays transparent to the canvas in both layouts, so the gap
  // between the two buttons is still road the player can steer through.
  pointer-events: none
  z-index: 30

// Under the squad: a row, because the band it sits in is short and the road is
// wide. The inline style carries the position — see `barStyle`.
.skills--under
  flex-direction: row
  align-items: center

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
