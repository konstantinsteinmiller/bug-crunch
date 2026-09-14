<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'
import type { GameIconName } from '@/components/icons/iconNames'
import { objectiveLabel, progress01, type Objective, type ObjectiveTriple, type RunTally } from '@/game/stars'

/**
 * ─── The three stars, live ──────────────────────────────────────────────────
 *
 * A strip of three rows, each a glyph, a caption and a fill. It is the answer
 * to the question a star-rated level always raises and almost never answers:
 * *what am I supposed to be doing differently?*
 *
 * ── The one design decision worth stating ──
 *
 * It is NOT on screen during play. The first objective is always "finish the
 * level", which the rail at the top already shows, and the other two are
 * decisions the player makes with their hands rather than facts they consult —
 * a child reading a checklist mid-swarm is a child being squished. So this is
 * shown on the level banner before the level starts and again on the result
 * screen after it ends, and never in between.
 *
 * `compact` is the result screen's mode: the fills become tick marks, because
 * a bar that is still filling is a promise and the level is over.
 */

interface Props {
  objectives: ObjectiveTriple
  tally: RunTally
  quota: number
  /** Which of the three are met. */
  met: readonly [boolean, boolean, boolean]
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), { compact: false })
const { t } = useI18n()

/** One glyph per objective KIND, so the same lesson always wears the same mark
 *  — a player learns "the crosshair means accuracy" once, in world 1. */
const ICON: Record<Objective['kind'], GameIconName> = {
  clear: 'bug',
  combo: 'splat',
  noSpike: 'shield',
  time: 'clock',
  accuracy: 'target',
  fever: 'flame',
  kind: 'bug',
  feverKills: 'flame',
  noMiss: 'target',
  score: 'star'
}

const rows = computed(() => props.objectives.map((o, i) => {
  const label = objectiveLabel(o)
  const args: Record<string, unknown> = { ...label.args }
  // `kind` interpolates a bug's own translated name, which has to be resolved
  // here rather than inside the locale string — vue-i18n has no nested lookup.
  if (typeof args.bug === 'string') args.bug = t(args.bug as string)
  return {
    icon: ICON[o.kind],
    text: t(label.key, args),
    fill: progress01(o, props.tally, props.quota),
    met: props.met[i] === true
  }
}))
</script>

<template lang="pug">
  ul.objectives(:class="{ 'is-compact': compact }")
    li.objectives__row(v-for="(row, i) in rows" :key="i" :class="{ 'is-met': row.met }")
      span.objectives__star
        GameIcon(:name="row.met ? 'star' : 'star-empty'")
      GameIcon.objectives__icon(:name="row.icon")
      span.objectives__text {{ row.text }}
      span.objectives__bar(v-if="!compact" aria-hidden="true")
        span.objectives__bar-fill(:style="{ width: Math.round(row.fill * 100) + '%' }")
</template>

<style scoped lang="sass">
// ─── Sizing ──────────────────────────────────────────────────────────────────
//
// `cqmin`, not `vmin`. Inside the reward overlay — which declares itself a size
// container — these resolve against THE OVERLAY'S OWN BOX, which is the box the
// list actually has to fit inside: the visible one, already minus the safe-area
// insets, and honest inside a portal iframe or on a mobile browser whose URL bar
// has not finished collapsing (where `vh`/`vmin` report the large viewport and
// the last row ends up under the chrome). On the level banner, where there is no
// container, they fall back to the small viewport, which is what `vmin` meant
// here before — so the banner is unchanged and only the result screen gains.
.objectives
  display: flex
  flex-direction: column
  gap: clamp(0.18rem, 1.1cqmin, 0.4rem)
  width: 100%
  max-width: min(26rem, 92cqw)
  margin: 0
  padding: 0
  list-style: none

.objectives__row
  position: relative
  display: grid
  grid-template-columns: auto auto 1fr
  align-items: center
  gap: clamp(0.25rem, 1.4cqmin, 0.5rem)
  padding: clamp(0.2rem, 1.1cqmin, 0.4rem) clamp(0.4rem, 2.2cqmin, 0.8rem)
  border: 2px solid rgba(255, 255, 255, 0.16)
  border-radius: clamp(0.5rem, 2cqmin, 0.9rem)
  background-color: rgba(12, 8, 22, 0.55)
  overflow: hidden

// The BOX lives on the span, not on a `:deep(svg)` rule.
//
// `GameIcon` renders an `<svg>` normally but an `<img>` once the painted art
// layer is on, and an `svg` selector misses the image completely: the span is an
// `inline-flex` with no size of its own, so the painting fell back to its own
// intrinsic size — measured at 128 CSS px, which made every objective row ~132px
// tall, ate 400px of a result screen and upscaled the star 3x into a blur. Both
// children are `width/height: 100%` (see `GameIcon.vue`), so one sized parent is
// the only rule either of them needs, and the two are interchangeable again.
.objectives__star
  display: inline-flex
  flex: 0 0 auto
  width: clamp(0.85rem, 3.4cqmin, 1.15rem)
  height: clamp(0.85rem, 3.4cqmin, 1.15rem)
  // The vector takes this through `currentColor`…
  color: rgba(255, 255, 255, 0.3)

  // …and the painting cannot, so the unlit painted star is dimmed to roughly
  // the same reading instead. `star-empty` is already a different painting from
  // `star`, so this is a mood, not the whole difference.
  :deep(.is-painted)
    opacity: 0.45

.objectives__icon
  flex: 0 0 auto
  width: clamp(0.8rem, 3.2cqmin, 1.1rem)
  height: clamp(0.8rem, 3.2cqmin, 1.1rem)
  color: #9fb0cc

.objectives__text
  min-width: 0
  color: #e8edf7
  font-weight: 900
  line-height: 1.15
  font-size: clamp(0.58rem, 2.5cqmin, 0.85rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.75)
  // Two lines, then ellipsis: German and Vietnamese run 2-3x English here and a
  // row that grows a third line pushes the banner off a landscape phone.
  display: -webkit-box
  -webkit-line-clamp: 2
  line-clamp: 2
  -webkit-box-orient: vertical
  overflow: hidden

.objectives__bar
  position: absolute
  inset: auto 0 0 0
  height: 3px
  background-color: rgba(255, 255, 255, 0.1)

.objectives__bar-fill
  display: block
  height: 100%
  background-image: linear-gradient(90deg, #6ee7a0, #ffd93c)
  transition: width 200ms ease-out

.is-met
  border-color: rgba(255, 217, 60, 0.7)
  background-color: rgba(52, 38, 6, 0.6)

  // The lit treatment has to reach BOTH renderings of the mark: `color` for the
  // vector, and a glow that an `<img>` can also take. The filter sits on the
  // span so it applies to whichever child is there, and is sized in `em` so it
  // stays proportional as the row shrinks — a fixed 6px blur on a 14px star is
  // most of the star.
  .objectives__star
    color: #ffd93c
    filter: drop-shadow(0 0 0.25em rgba(255, 217, 60, 0.75))

    :deep(.is-painted)
      opacity: 1

  .objectives__icon
    color: #ffd93c

  .objectives__bar-fill
    background-image: linear-gradient(90deg, #ffd93c, #ffb703)

// The result screen's mode, and the tallest single block on it: three rows that
// have already said what they had to say, so they give their padding back first.
.is-compact
  gap: clamp(0.15rem, 0.9cqmin, 0.32rem)

  .objectives__row
    padding-block: clamp(0.14rem, 0.85cqmin, 0.28rem)
</style>
