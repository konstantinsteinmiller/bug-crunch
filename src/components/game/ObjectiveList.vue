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
.objectives
  display: flex
  flex-direction: column
  gap: clamp(0.2rem, 1.2vmin, 0.45rem)
  width: 100%
  max-width: min(26rem, 92vw)
  margin: 0
  padding: 0
  list-style: none

.objectives__row
  position: relative
  display: grid
  grid-template-columns: auto auto 1fr
  align-items: center
  gap: clamp(0.25rem, 1.4vmin, 0.5rem)
  padding: clamp(0.22rem, 1.2vmin, 0.45rem) clamp(0.4rem, 2.2vmin, 0.8rem)
  border: 2px solid rgba(255, 255, 255, 0.16)
  border-radius: clamp(0.5rem, 2vmin, 0.9rem)
  background-color: rgba(12, 8, 22, 0.55)
  overflow: hidden

.objectives__star
  display: inline-flex
  flex: 0 0 auto

  :deep(svg)
    width: clamp(0.9rem, 3.6vmin, 1.25rem)
    height: clamp(0.9rem, 3.6vmin, 1.25rem)
    color: rgba(255, 255, 255, 0.3)

.objectives__icon
  flex: 0 0 auto
  width: clamp(0.8rem, 3.2vmin, 1.1rem)
  height: clamp(0.8rem, 3.2vmin, 1.1rem)
  color: #9fb0cc

.objectives__text
  min-width: 0
  color: #e8edf7
  font-weight: 900
  line-height: 1.15
  font-size: clamp(0.6rem, 2.6vmin, 0.88rem)
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

  .objectives__star :deep(svg)
    color: #ffd93c
    filter: drop-shadow(0 0 6px rgba(255, 217, 60, 0.7))

  .objectives__icon
    color: #ffd93c

  .objectives__bar-fill
    background-image: linear-gradient(90deg, #ffd93c, #ffb703)

.is-compact .objectives__row
  padding-block: clamp(0.18rem, 1vmin, 0.34rem)
</style>
