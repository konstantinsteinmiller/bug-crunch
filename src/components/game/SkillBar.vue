<template lang="pug">
  div.skills(ref="barRef" :class="{ 'skills--under': under }" :style="barStyle")
    template(v-for="s in visible" :key="s.key")
      //- A slot the player does not own yet: a mystery, not a dead button. It
      //- answers a press with a shake and a hint and nothing else — see
      //- `SkillMystery.vue` for why it may share nothing with the button below.
      button.skills__btn.skills__btn--locked(
        v-if="s.state === 'locked'"
        type="button"
        aria-disabled="true"
        :class="{ 'skills__btn--nudge': nudged === s.key }"
        :aria-label="s.label"
        :title="s.label"
        @pointerdown.stop.prevent="onLocked(s.key)"
      )
        SkillMystery(:icon="s.icon" :shine-s="s.shineS")
        span.skills__hint(v-if="nudged === s.key" aria-hidden="true") {{ s.label }}
      //- Owned — or on TRIAL: the one free Frost Nova after the stage-4 boss is
      //- a real button for exactly one press, badged so it reads as a gift and
      //- not as a skill the player now owns (`skillTrial`).
      button.skills__btn(
        v-else
        type="button"
        :class="{ 'skills__btn--ready': s.ready, 'skills__btn--live': s.live, 'skills__btn--reveal': s.reveal, 'skills__btn--trial': s.state === 'trial', [`skills__btn--${s.id}`]: true }"
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
        //- The free use, counted.
        span.skills__badge(v-if="s.state === 'trial'" aria-hidden="true") {{ t('skills.uses', { n: 1 }) }}
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ArtIcon from '@/components/icons/ArtIcon.vue'
import SkillMystery from '@/components/game/SkillMystery.vue'
import useSounds from '@/use/useSound'
import {
  SKILL_SLOTS, claimReveal, revealKey, skillCharge, skillReady, skillReadyIn, slotState,
  type SkillId
} from '@/use/useSkills'
import {
  SKILL_ROW_HUD_GAP_PX, skillRowFitsUnderSquad
} from '@/components/game/skillBarPlacement'

/**
 * ─── The skill bar ──────────────────────────────────────────────────────────
 *
 * Up to four slots — the skills the player owns, and the ones still to come
 * as greyed mysteries (see `visible` below) — and the whole design problem is
 * WHERE.
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
  /** …and the same for the world being frozen, and for a flare being up. */
  frostLive?: boolean
  decoyLive?: boolean
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

/**
 * ─── Every slot, owned or still to come ─────────────────────────────────────
 *
 * This used to show only what the player owned, on the argument that a
 * permanently dead control teaches the player to ignore that corner of the
 * screen. The slots still to come are shown now as well, and the argument is
 * answered rather than overruled: a locked slot is not a dead control, because
 * it does not LOOK like a control (`SkillMystery.vue`) and it is not permanent —
 * it is a promise with a question mark on it, and the day it fills is the
 * payoff (`claimReveal`). See `SKILL_SLOTS` for the four of them.
 *
 * ── …except where there is no room for them ──
 *
 * The fallback column (a landscape phone, where the band under the squad does
 * not exist) is stacked up the right edge, and four buttons tall it reaches the
 * corner the incoming-attack badge lives in. So that layout shows only the NEXT
 * locked slot — the one the player is actually playing toward — and the row
 * under the squad, which is wide rather than tall, shows them all.
 */
/** Reveal keys (`revealKey`) whose reveal is playing right now. Declared ahead
 *  of `visible` because the re-measure watch below reads `visible` during setup. */
const revealing = ref<string[]>([])

const visible = computed(() => {
  const all = SKILL_SLOTS.map((slot, i) => {
    const state = slotState(slot)
    const usable = state !== 'locked'
    const id = slot.id
    const name = slot.labelKey ? t(slot.labelKey) : ''
    const label = state === 'owned'
      ? name
      : state === 'trial'
        ? t('skills.trialLabel', { name })
        : slot.unlockStage !== null
          ? t('skills.unlocksAt', { n: slot.unlockStage })
          : t('skills.locked')
    const live = (id === 'shield' && props.shieldLive) ||
      (id === 'frost' && !!props.frostLive) ||
      (id === 'decoy' && !!props.decoyLive)
    return {
      key: id ?? `slot-${i}`,
      id,
      state,
      icon: slot.icon,
      art: slot.art ?? '',
      label,
      // Staggered so a row of them never shimmers in lockstep.
      shineS: 3.2 + i * 0.55,
      ready: usable && id !== null ? skillReady(id) : false,
      charge: usable && id !== null ? skillCharge(id) : 0,
      leftMs: usable && id !== null ? skillReadyIn(id) : 0,
      live,
      reveal: id !== null && usable && revealing.value.includes(revealKey(id, state))
    }
  })
  if (under.value) return all
  const next = all.findIndex((s) => s.state === 'locked')
  return all.filter((s, i) => s.state !== 'locked' || i === next)
})

// A skill bought mid-run adds a button, and the first one to appear is what
// `measure` reads its size from — so the count is a re-measure trigger as much
// as a resize is.
watch(() => visible.value.length, () => { void nextTick(measure) })

const onUse = (id: SkillId | null): void => {
  if (id === null || !skillReady(id)) return
  emit('use', id)
}

// ─── A press on a locked slot ───────────────────────────────────────────────
//
// A shake and the hint, and a soft "no" — the same one the shop plays for a
// purchase the player cannot afford, because it is the same answer: not yet.
// Nothing else, and in particular never the steering the canvas would have
// done with the pointer (`.stop.prevent` in the template).
const { playSound } = useSounds()
const nudged = ref<string | null>(null)
let nudgeTimer: ReturnType<typeof setTimeout> | null = null
const onLocked = (key: string): void => {
  playSound('obstacle-hit', 0.03)
  nudged.value = null
  // Cleared and re-set on the next tick so a second press restarts the shake
  // rather than being swallowed by a class that is already on the element.
  void nextTick(() => { nudged.value = key })
  if (nudgeTimer) clearTimeout(nudgeTimer)
  nudgeTimer = setTimeout(() => { nudged.value = null }, 1800)
}

// ─── The reveal ─────────────────────────────────────────────────────────────
//
// Asked on mount and whenever the owned set changes, because the shield is
// gifted while this bar is unmounted (the result banner is up) and bought in a
// shop that is not this component. `claimReveal` answers "is this the first
// time" from the save, so the reveal plays exactly once per skill, ever.
const askReveals = (): void => {
  let any = false
  for (const slot of SKILL_SLOTS) {
    const state = slotState(slot)
    if (slot.id === null || state === 'locked') continue
    if (!claimReveal(slot.id, state)) continue
    const key = revealKey(slot.id, state)
    revealing.value = [...revealing.value, key]
    setTimeout(() => { revealing.value = revealing.value.filter((r) => r !== key) }, 1400)
    any = true
  }
  // The question mark coming off is a gift being handed over, and it sounds
  // like one — the sample the chest, the weapon reveal and the rally already
  // use for "something good was just given to you".
  if (any) playSound('reward-continue', 0.08)
}
onMounted(askReveals)
watch(() => SKILL_SLOTS.map((slot) => slotState(slot)).join(','), askReveals)
onUnmounted(() => { if (nudgeTimer) clearTimeout(nudgeTimer) })
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

// The two late skills glow in their own colours while they run: frost the ice
// of the nova, the flare its signal red.
.skills__btn--frost.skills__btn--live
  color: #bff0ff
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0.9rem rgba(140, 215, 255, 0.55)

.skills__btn--decoy.skills__btn--live
  color: #ff7d8c
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0.9rem rgba(255, 80, 100, 0.5)

// ─── The free try ───────────────────────────────────────────────────────────
//
// A real, ready button — but one that is visibly a GIFT: an icy halo breathing
// round it and a gold "×1" pinned to its shoulder, so nobody mistakes the one
// free Frost Nova for a skill they now own.
.skills__btn--trial.skills__btn--ready
  animation: skill-trial 1.5s ease-in-out infinite

@keyframes skill-trial
  0%, 100%
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 0 rgba(150, 220, 255, 0), 0 0 0.5rem rgba(150, 220, 255, 0.35)
  50%
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 0.32rem rgba(150, 220, 255, 0.22), 0 0 1.1rem rgba(150, 220, 255, 0.6)

.skills__badge
  position: absolute
  top: -0.3rem
  right: -0.4rem
  padding: 0.05rem 0.34rem
  border-radius: 999px
  border: 1.5px solid #3a2000
  background: linear-gradient(180deg, #ffe89a 0%, #ffc43a 55%, #e38f12 100%)
  color: #2a1600
  font-weight: 900
  font-size: clamp(0.58rem, 2.5vw, 0.74rem)
  line-height: 1.2
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.6)
  pointer-events: none

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

// ─── Locked slots ───────────────────────────────────────────────────────────
//
// Smaller than an owned button, so the row reads as "yours" and "not yet" at a
// glance, and transparent — the mystery disc is its own background.
.skills__btn--locked
  width: clamp(2.35rem, 10.5vw, 2.9rem)
  height: clamp(2.35rem, 10.5vw, 2.9rem)
  background-color: transparent
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.45)
  cursor: help

.skills__btn--nudge
  animation: skill-nudge 0.42s ease-in-out

.skills__hint
  position: absolute
  bottom: calc(100% + 0.4rem)
  left: 50%
  transform: translateX(-50%)
  padding: 0.25rem 0.55rem
  border-radius: 0.5rem
  background: rgba(10, 12, 18, 0.9)
  color: #d6dae1
  font-size: clamp(0.62rem, 2.8vw, 0.78rem)
  font-weight: 900
  letter-spacing: 0.03em
  white-space: nowrap
  pointer-events: none
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5)
  animation: skill-hint 1.8s ease-out forwards

// The fallback column hugs the right edge, so its hint hangs to the LEFT of the
// button instead of centring above it and running off the screen.
.skills:not(.skills--under) .skills__hint
  left: auto
  right: 0
  transform: none

// ─── The reveal ─────────────────────────────────────────────────────────────
//
// Declared after the ready-breathing so it wins while it runs; the class comes
// off after 1.4 s and the breathing takes over.
.skills__btn--reveal,
.skills__btn--reveal.skills__btn--ready
  animation: skill-reveal 1.25s cubic-bezier(0.2, 1.4, 0.4, 1) both

@keyframes skill-reveal
  0%
    transform: scale(0.55) rotate(-12deg)
    filter: grayscale(1) brightness(0.6)
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 0 rgba(255, 217, 60, 0.75)
  40%
    transform: scale(1.2) rotate(4deg)
    filter: grayscale(0) brightness(1.35)
  70%
    transform: scale(0.95) rotate(0)
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 1.3rem rgba(255, 217, 60, 0)
  100%
    transform: scale(1)
    filter: none
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 0 rgba(255, 217, 60, 0)

@keyframes skill-nudge
  0%, 100%
    transform: translateX(0)
  20%
    transform: translateX(-3px) rotate(-4deg)
  45%
    transform: translateX(3px) rotate(4deg)
  70%
    transform: translateX(-2px)

@keyframes skill-hint
  0%
    opacity: 0
    margin-bottom: -0.3rem
  12%, 78%
    opacity: 1
    margin-bottom: 0
  100%
    opacity: 0

@media (prefers-reduced-motion: reduce)
  .skills__btn--nudge,
  .skills__btn--reveal,
  .skills__btn--trial.skills__btn--ready
    animation: none

// A ready skill breathes, so it is findable without looking for it.
@keyframes skill-ready
  0%, 100%
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 0 rgba(255, 217, 60, 0)
  50%
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 0.28rem rgba(255, 217, 60, 0.16)
</style>
