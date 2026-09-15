<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'
import { ICON_PATHS } from '@/components/icons/iconPaths'
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
 *
 * ── Why the badge is a STAR THAT FILLS, and not a glyph in a ring ──
 *
 * The first cut was a glyph in a progress ring, and a reviewer looking at the
 * HUD read the pair as two anonymous roundels: nothing said they were GOALS,
 * let alone which goals. That is the harder half of the problem. A player who
 * does not know a mark is a goal has no reason to look at it twice, and this
 * HUD is already full of discs that are NOT goals — the coin, the chest, the
 * vial. One more disc joins that set by default.
 *
 * So the badge is drawn as the one mark this game has spent its whole campaign
 * teaching. A star means "a thing you can earn" on the level card, in the rail,
 * on the result screen and in the world map, and `ICON_PATHS.star` is the exact
 * silhouette `StarRow` fills. Here it is the badge itself: an empty star that
 * fills from the bottom as the objective is met, and is solid gold when the
 * star is currently yours.
 *
 * That is three facts in one glance and no words — THIS IS A STAR (the shape),
 * IT IS THAT STAR (the glyph on it), YOU ARE THIS FAR (the fill) — and the
 * middle one survives because the fill is the silhouette rather than a second
 * mark competing with the glyph inside it.
 *
 * ── The ring had to go, and the intermediate version is why ──
 *
 * The obvious cheap fix was to keep the ring and put a small star PLATE behind
 * the glyph. Measured in a browser at 320x480 it fails, for a reason that is
 * only visible in a screenshot: half the glyphs in the table below are
 * themselves radial. `splat` — which is the mark for `combo`, and `combo` is
 * fifteen of the game's thirty-eight star objectives — is a starburst, so a
 * starburst inside a star outline at 22 px is one illegible blob, and `target`
 * on a star reads as a wheel. A badge cannot carry two competing silhouettes
 * at thumbnail size; it can carry one silhouette with a mark ON it, which is
 * what a medal is.
 *
 * The fill also says more than the ring did. An arc creeping round a groove is
 * a meter; a star filling up is the thing you are earning, filling up.
 *
 * ── Why the star is the VECTOR and not `GameIcon` ──
 *
 * Every other mark on the badge may be swapped for a painting. This one is
 * structure rather than content — a shape the stylesheet colours and clips by
 * state — and a painted star would arrive as a picture with its own baked
 * highlights that neither the fill nor the lost state could touch.
 *
 * ── `spotlight` ──
 *
 * The `quests` lesson (`game/tutorial.ts`) runs a wordless arrow from the level
 * card's objective rows to this pair, once ever. `spotlight` is the far end of
 * it: while the arrow is travelling, the badges breathe and glow so that what
 * it lands on is unmistakable. It is a prop rather than a read of
 * `useTutorial`, because everything else this component knows is a prop and a
 * badge that quietly reached into the tutorial director could not be tested
 * without one.
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
  /** The `quests` lesson is pointing at these right now — see the header. */
  spotlight?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  score: undefined, timeLeft: undefined, spotlight: false
})
const { t } = useI18n()

/** The game's own star, borrowed as the badge's whole silhouette. One shape for
 *  "a thing you can earn", everywhere it appears. */
const STAR = ICON_PATHS.star.join('')

/**
 * The star's own bounding box inside `ICON_PATHS`' 24-unit grid, squared up.
 *
 * `GameIcon` draws every glyph in `0 0 24 24`, where this star spans about 74 %
 * of the box — correct for a row of buttons, where every mark needs the same
 * optical weight. Here the star IS the badge, and 74 % of 22 px leaves a core
 * too small for the glyph that has to sit in it. Cropping the viewBox to the
 * path's own extents gives the star the whole badge and its inner well grows
 * with it: the concave vertices sit at 4.73 of these units from the centre, so
 * the well is 53 % of the badge and the 48 % glyph clears it at every size.
 */
const STAR_BOX = '3.05 3.05 17.9 17.9'

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

    return {
      key: `${i}-${o.kind}`,
      icon: ICON[o.kind],
      fill,
      pct: Math.round(fill * 100),
      // The star, filled from the bottom. `inset()` percentages resolve against
      // the element's own border box, and the layer is an absolutely-positioned
      // `<svg>` filling the badge — so this is the same number in every
      // viewport with no geometry to keep in step.
      clip: `inset(${((1 - fill) * 100).toFixed(2)}% 0 0 0)`,
      met,
      lost,
      aria
    }
  }))
</script>

<template lang="pug">
  ul.quests(v-if="badges.length > 0" role="list" :aria-label="t('quests.title')")
    li.quests__badge(
      v-for="b in badges"
      :key="b.key"
      role="img"
      :aria-label="b.aria"
      :data-fill="b.pct"
      :class="{ 'is-met': b.met, 'is-lost': b.lost, 'is-spotlit': spotlight }"
    )
      //- The empty star. Its rim is what makes the silhouette survive a busy
      //- picnic-blanket floor; its fill is the dark plate the glyph sits on.
      svg.quests__plate(:viewBox="STAR_BOX" aria-hidden="true" focusable="false")
        path(:d="STAR")
      //- The same star again, in gold, clipped to the reading. Two stacked
      //- copies rather than one path with a `clipPath`: a `clipPath` needs an
      //- id, and an id inside a `v-for` inside a component that can be mounted
      //- twice is a collision waiting for the day somebody puts these on the
      //- result screen as well.
      svg.quests__fill(
        :viewBox="STAR_BOX"
        :style="{ clipPath: b.clip }"
        aria-hidden="true"
        focusable="false"
      )
        path(:d="STAR")
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
// tops out at ~63 px.
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

// A star carries roughly two thirds of a disc's ink at the same width, so the
// box grew a little when the disc became a star — measured against the coin
// badge at every shipped viewport, the pair lands at 50 px on a 320-wide portal
// frame and 63 px on a desktop, under a wallet column that is never narrower
// than 64 px.
//
// No `background-color` and no `border-radius`: the star IS the badge, so a
// disc behind it would be the roundel this component was rewritten to stop
// being. The shadow is a `drop-shadow` for the same reason — it has to follow
// the points, not a box.
.quests__badge
  position: relative
  flex: 0 0 auto
  width: clamp(1.4rem, 7.4vmin, 1.8rem)
  height: clamp(1.4rem, 7.4vmin, 1.8rem)
  filter: drop-shadow(0 0.08em 0.14em rgba(20, 10, 26, 0.75))

.quests__plate, .quests__fill, .quests__cross
  position: absolute
  inset: 0
  display: block
  width: 100%
  height: 100%
  overflow: visible

// ─── The empty star ─────────────────────────────────────────────────────────
//
// Dark enough to be the glyph's plate, with a rim bright enough to hold the
// silhouette against a red-and-white gingham floor. The stroke is in the path's
// own units so it scales with the badge instead of being a fat rim at 22 px and
// a hairline at 29 px.
.quests__plate
  fill: rgba(14, 9, 24, 0.72)
  stroke: rgba(226, 234, 248, 0.62)
  stroke-width: 0.9
  stroke-linejoin: round
  transition: stroke 220ms ease-out

// ─── …and the same star filling up ──────────────────────────────────────────
//
// Amber rather than the earned gold until the star is actually met, so that
// "filling" and "yours" are two different readings instead of one colour at two
// heights — and so the glyph keeps a background it can be read against for the
// whole climb.
.quests__fill
  fill: #c8891a
  transition: clip-path 260ms ease-out, fill 220ms ease-out

.quests__glyph
  position: absolute
  top: 50%
  left: 50%
  translate: -50% -50%
  // The glyph's OWN box. `GameIcon` fills it at 100% either way it renders.
  //
  // 48 %, against the star's 53 % well: the mark has to sit INSIDE the concave
  // vertices or its corners cross the arms and the two silhouettes merge.
  width: 48%
  height: 48%
  color: #eaf0fb
  // A dark keyline, twice, so one glyph reads at both ends of the fill — the
  // same mark spends part of every level half on the dark plate and half on
  // amber. It costs nothing on the vector rung and works identically on the
  // painted `<img>` and the masked `<span>`, because all three are alpha
  // silhouettes as far as `drop-shadow` is concerned.
  filter: drop-shadow(0 0 1px rgba(16, 9, 28, 0.95)) drop-shadow(0 0 1px rgba(16, 9, 28, 0.95))

.quests__cross line
  stroke: #ff8f8f
  stroke-width: 3

// ─── Met: the game's earned-star treatment ──────────────────────────────────
// `#ffd93c` and a glow, the same gold `StarRow` lights a socket with, so a
// badge going gold and a star landing later are visibly the same event. The
// glyph flips to ink, which is the only colour that reads on a full gold star —
// and the flip is itself the "click" that says the star is now yours.
.is-met
  animation: quest-pop 420ms cubic-bezier(0.18, 0.89, 0.32, 1.28)
  filter: drop-shadow(0 0.08em 0.14em rgba(20, 10, 26, 0.75)) drop-shadow(0 0 0.3em rgba(255, 217, 60, 0.7))

  .quests__fill
    fill: #ffd93c

  .quests__plate
    stroke: rgba(255, 217, 60, 0.95)

  .quests__glyph
    color: #3b2606
    filter: drop-shadow(0 0 1px rgba(255, 240, 190, 0.9))

// ─── Lost: the star is gone and saying so now beats saying so on the result
// screen, which is where this information used to arrive — too late to act on.
.is-lost
  opacity: 0.82

  .quests__plate
    fill: rgba(30, 10, 14, 0.72)
    stroke: rgba(255, 143, 143, 0.5)

  .quests__glyph
    color: rgba(255, 255, 255, 0.42)

// ─── Spotlit: the far end of the one lesson that explains these ─────────────
//
// The `quests` lesson runs an arrow from the level card's objective rows to
// this pair, once ever. An arrow that lands on something inert teaches nothing,
// so for the two seconds it is travelling the badges breathe and the rim goes
// white — the destination has to be the loudest thing in that corner, or the
// player's eye stops at the arrowhead.
//
// After `.is-met` and `.is-lost` on purpose: while the lesson is running, this
// is what the badge is for, and its animation must win the cascade.
.is-spotlit
  animation: quest-call 1200ms ease-in-out infinite

  .quests__plate
    stroke: #ffffff
    stroke-width: 1.3

// Staggered, so the pair reads as two things arriving rather than as one wide
// thing pulsing.
.is-spotlit + .is-spotlit
  animation-delay: 200ms

@keyframes quest-pop
  0%
    scale: 1
  45%
    scale: 1.18
  100%
    scale: 1

// 1.14, not the pop's 1.18: `scale` is paint rather than layout, so the pair
// never widens the wallet column — but at 1.18 each badge grows 2.5 px into a
// 5 px gap from both sides and the two stars touch at the peak.
@keyframes quest-call
  0%, 100%
    scale: 1
    filter: drop-shadow(0 0.08em 0.14em rgba(20, 10, 26, 0.75)) drop-shadow(0 0 0 rgba(255, 217, 60, 0))
  50%
    scale: 1.14
    filter: drop-shadow(0 0.08em 0.14em rgba(20, 10, 26, 0.75)) drop-shadow(0 0 0.42em rgba(255, 217, 60, 0.95))

@media (prefers-reduced-motion: reduce)
  .quests__fill
    transition: none
  .is-met
    animation: none
  // The pulse goes; the BRIGHTENING stays. Reduced motion is a request for less
  // movement, not for less teaching — the rim rule above is untouched, so the
  // pair is still the loudest thing in the corner when the arrow arrives.
  .is-spotlit
    animation: none
    filter: drop-shadow(0 0.08em 0.14em rgba(20, 10, 26, 0.75)) drop-shadow(0 0 0.42em rgba(255, 217, 60, 0.95))
</style>
