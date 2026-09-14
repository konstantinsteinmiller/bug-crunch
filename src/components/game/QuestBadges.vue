<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'
import type { GameIconName } from '@/components/icons/iconNames'
import {
  meets, objectiveLabel, progress01,
  type Objective, type ObjectiveTriple, type RunTally
} from '@/game/stars'

/**
 * ─── The other two stars, during play ───────────────────────────────────────
 *
 * Two small discs under the treasure chest, one per non-`clear` objective: a
 * glyph, a ring that fills, and — this is the point — a state you can see
 * without reading anything.
 *
 * ── How this squares with `ObjectiveList`'s "never during play" ──
 *
 * `ObjectiveList` argues, correctly, that a CHECKLIST on screen mid-swarm is a
 * child being squished: three rows of prose beside the board is a thing you
 * stop and read, and stopping is how you lose. Nothing here asks to be read.
 * There are no words, no numbers and no bars — two marks the size of a thumb-
 * nail, parked in the HUD corner the chest already owns, answering one question
 * in peripheral vision: *do I still have that star?*
 *
 * So the first objective is deliberately absent. It is always "clear the
 * level", and the rail across the top of the HUD has been counting that out the
 * whole time; a third badge saying the same thing would turn two marks into a
 * list, which is the thing we are not doing.
 *
 * ── Why `cleared` is forced true ──
 *
 * `meets` and `progress01` both gate every other objective on `t.cleared` —
 * rightly, because a ×20 chain in a level you ran out of time on has earned
 * nothing. But `cleared` is false for the entire run, so grading the live tally
 * as-is would paint every badge as failed from the first frame. These badges
 * answer a different question — *would this star be mine if I finished right
 * now?* — so they grade against `{ ...tally, cleared: true }` and leave the
 * actual clear to the rail above.
 *
 * ── The live readings the tally does not carry ──
 *
 * `score` and `timeLeft` are only written into `RunTally` when the level ENDS
 * (see `finish()` in `useBugCrunchGame`), so a `score` badge reading the tally
 * mid-run would sit at zero all level and a `time` badge would read as already
 * lost. Both are therefore accepted as optional live props and merged over the
 * tally; the tally's own values are the fallback, which is what makes this
 * component correct on a finished run too.
 */

interface Props {
  objectives: ObjectiveTriple
  /** The live tally — `useBugCrunchGame.tally`. */
  tally: RunTally
  /** The level's squish quota, for the `clear` reading `progress01` wants. */
  quota: number
  /** Live score. The tally only banks it at the end; omit on a finished run. */
  score?: number
  /** Live seconds on the clock. Same story. */
  timeLeft?: number
}

const props = withDefaults(defineProps<Props>(), { score: undefined, timeLeft: undefined })
const { t } = useI18n()

/** Ring circumference for r=15.5 in the 36×36 box. Constant, not `pathLength`:
 *  older WebKit ignores `pathLength` on a `<circle>` and draws a full ring. */
const RING = 2 * Math.PI * 15.5

/** The same glyph table `ObjectiveList` uses, so one idea wears one mark
 *  everywhere in the game — the banner, the badge and the result screen. */
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

/**
 * Can this objective never be met again, whatever the player does from here?
 *
 * Only three of them can be spent: two budgets that only ever shrink, and a
 * clock that only ever runs down. Everything else is a counter climbing towards
 * a target and is therefore always still reachable — `accuracy` included, which
 * a run of clean stomps pulls back up.
 */
const isLost = (o: Objective, tally: RunTally): boolean => {
  switch (o.kind) {
    case 'noSpike': return tally.spikes > 0
    case 'noMiss': return tally.misses > o.n
    // Guarded on a POSITIVE reading: a tally still holding its end-of-level
    // zero because the level has not ended would otherwise read as lost on
    // frame one of every level with a `time` objective.
    case 'time': return tally.timeLeft > 0 && tally.timeLeft < o.n
    default: return false
  }
}

/** The tally as the badges grade it — see the header. */
const live = computed<RunTally>(() => ({
  ...props.tally,
  cleared: true,
  score: props.score ?? props.tally.score,
  timeLeft: props.timeLeft ?? props.tally.timeLeft
}))

const badges = computed(() => props.objectives
  .map((o, i) => ({ o, i }))
  // The rail already counts the clear out; see the header.
  .filter(({ o }) => o.kind !== 'clear')
  .map(({ o, i }) => {
    const lost = isLost(o, live.value)
    const met = !lost && meets(o, live.value)
    const fill = lost ? 0 : progress01(o, live.value, props.quota)

    const label = objectiveLabel(o)
    const args: Record<string, unknown> = { ...label.args }
    // `kind` interpolates a bug's own translated name, which vue-i18n cannot
    // look up from inside a locale string — resolved here, as `ObjectiveList`
    // resolves it.
    if (typeof args.bug === 'string') args.bug = t(args.bug as string)
    const objective = t(label.key, args)

    // Icon-only, `pointer-events: none` and never focused: this label is the
    // ENTIRE accessible name, so it carries the state as well as the wording.
    const aria = lost
      ? t('quests.missed', { objective })
      : met
        ? t('quests.onTrack', { objective })
        : t('quests.progress', { objective, n: Math.round(fill * 100) })

    return { key: `${i}-${o.kind}`, icon: ICON[o.kind], fill, met, lost, aria }
  }))
</script>

<template lang="pug">
  ul.quests(v-if="badges.length > 0" role="list")
    li.quests__badge(
      v-for="b in badges"
      :key="b.key"
      role="img"
      :aria-label="b.aria"
      :class="{ 'is-met': b.met, 'is-lost': b.lost }"
    )
      svg.quests__ring(viewBox="0 0 36 36" aria-hidden="true" focusable="false")
        circle.quests__track(cx="18" cy="18" r="15.5" fill="none")
        circle.quests__fill(
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke-linecap="round"
          transform="rotate(-90 18 18)"
          :stroke-dasharray="RING"
          :stroke-dashoffset="RING * (1 - b.fill)"
        )
      //- The glyph sits in a SIZED WRAPPER rather than being sized by a
      //- `:deep(svg)` rule. `GameIcon` renders an `<img>` instead of an `<svg>`
      //- the moment the painted art layer is on, an `:deep(svg)` rule does not
      //- match it, and the painting then lands at its intrinsic 128 px and
      //- tears the HUD open. A box with a width and a height sizes both.
      span.quests__glyph
        GameIcon(:name="b.icon")
      //- Above the glyph, not under it — a strike a colour-blind player reads
      //- without being told which of the two reds is the sad one.
      svg.quests__cross(v-if="b.lost" viewBox="0 0 36 36" aria-hidden="true" focusable="false")
        line(x1="9" y1="27" x2="27" y2="9" stroke-linecap="round")
</template>

<style scoped lang="sass">
// ─── Two marks, not a panel ─────────────────────────────────────────────────
//
// Sized in `clamp(rem, vmin, rem)` like the rest of the HUD. The ceiling is
// what matters here: the pair has to stay NARROWER than the coin badge above
// it, because `.scene__wallet` is a max-content column and anything wider would
// widen the column and take the room away from the score strip. The coin badge
// measures 65-70 px across every viewport this game ships to; the pair below
// tops out at ~62 px.
.quests
  display: flex
  align-items: center
  justify-content: center
  gap: clamp(0.15rem, 1vmin, 0.35rem)
  margin: 0
  padding: 0
  list-style: none
  // Information, never a control. The chest directly above IS a control and
  // must keep every pixel of its hit area, so nothing down here may eat a tap
  // that was aimed a little low.
  pointer-events: none

.quests__badge
  position: relative
  flex: 0 0 auto
  width: clamp(1.3rem, 7.1vmin, 1.75rem)
  height: clamp(1.3rem, 7.1vmin, 1.75rem)
  border-radius: 999px
  background-color: rgba(12, 8, 22, 0.55)
  box-shadow: 0 0.08em 0.18em rgba(43, 27, 46, 0.45)

.quests__ring, .quests__cross
  position: absolute
  inset: 0
  display: block
  width: 100%
  height: 100%
  overflow: visible

.quests__track
  stroke: rgba(255, 255, 255, 0.16)
  stroke-width: 3

// Thicker than the track it runs over: at 23 px on a 320-wide portal frame the
// arc is the only thing on the badge that MOVES, and a hairline that matches
// the groove it sits in reads as decoration rather than as a reading.
.quests__fill
  stroke: #6ee7a0
  stroke-width: 3.6
  transition: stroke-dashoffset 220ms ease-out, stroke 220ms ease-out

.quests__glyph
  position: absolute
  top: 50%
  left: 50%
  translate: -50% -50%
  // The glyph's OWN box. `GameIcon` fills it at 100% either way it renders.
  width: 52%
  height: 52%
  color: #b9c6dd

.quests__cross line
  stroke: #ff8f8f
  stroke-width: 3

// ─── Met: the game's earned-star treatment ──────────────────────────────────
// `#ffd93c` and a glow, the same gold `StarRow` lights a socket with, so a
// badge going gold and a star landing later are visibly the same event.
.is-met
  background-color: rgba(52, 38, 6, 0.6)
  animation: quest-pop 420ms cubic-bezier(0.18, 0.89, 0.32, 1.28)

  .quests__fill
    stroke: #ffd93c

  .quests__glyph
    color: #ffd93c
    filter: drop-shadow(0 0 0.35em rgba(255, 217, 60, 0.75))

// ─── Lost: the star is gone and saying so now beats saying so on the result
// screen, which is where this information used to arrive — too late to act on.
.is-lost
  background-color: rgba(38, 10, 14, 0.55)
  opacity: 0.8

  .quests__track
    stroke: rgba(255, 143, 143, 0.22)

  .quests__glyph
    color: rgba(255, 255, 255, 0.4)
    filter: none

@keyframes quest-pop
  0%
    scale: 1
  45%
    scale: 1.18
  100%
    scale: 1

@media (prefers-reduced-motion: reduce)
  .quests__fill
    transition: none
  .is-met
    animation: none
</style>
