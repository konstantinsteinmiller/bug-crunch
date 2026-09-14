<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FModal from '@/components/molecules/FModal.vue'
import { bestScore } from '@/use/useSplatProgress'
import { playerDisplayName } from '@/use/usePlayerIdentity'
import { formatCount } from '@/utils/localeNumber'
import {
  ensureBoard, leaderboard, leaderboardFailed,
  leaderboardPending, playerTotal, rankFor
} from '@/use/useLeaderboard'

/**
 * ─── The global board ───────────────────────────────────────────────────────
 *
 * The top 100 by BEST SINGLE-LEVEL SCORE, with the deepest level as the second
 * column — two players on the same points total are not the same player, and
 * how far into the campaign they got is the thing they compare.
 *
 * Four states, and three of them are not the happy one: still loading, nothing
 * to show, and the endpoint is unreachable. All three have to say something
 * plain, because a leaderboard that opens onto a blank rectangle reads as a
 * broken game rather than a quiet network.
 *
 * The player is told where they stand even when they are not on the board —
 * that footer is the whole reason a player who is #4 000 opens this screen at
 * all.
 */

const model = defineModel<boolean>({ required: true })
const { t, locale } = useI18n()

/**
 * Group a number for the player's language.
 *
 * Read `locale.value` INSIDE the call, not once at setup: this modal is mounted
 * for the whole session, so a formatter captured at first paint would keep
 * English commas on a board the player has since switched to German.
 *
 * It earns its place from four digits up, which three of these four columns
 * reach: the board is 2 531 players, ranks run to #2,531, and the top scores are
 * five digits (13,625). See `src/utils/localeNumber.ts`, which also explains why
 * the digits stay Latin.
 */
const fmt = (n: number): string => formatCount(n, locale.value)

const entries = computed(() => leaderboard.value?.entries ?? [])

/**
 * The name the player's row would carry.
 *
 * Resolved lazily rather than at import time: `resolveIdentity` mints and
 * persists an id on its first call, and doing that before the player has ever
 * opened the board would put an identity in the save of someone who never used
 * the feature.
 */
const ownName = ref('')

/**
 * Highlight the player's own row.
 *
 * A NAME MATCH, not an id match, and it can false-positive: the board endpoint
 * publishes no ids (deliberately — a public id is a public write key), so two
 * players who both called themselves "Ace" both get the highlight. That is the
 * right trade here. The alternative is highlighting nothing, and the row a
 * player came to find is the only row on the screen they care about.
 */
const isYou = (name: string): boolean => ownName.value.length > 0 && name === ownName.value

const onBoard = computed(() => entries.value.some((e) => isYou(e.name)))

/** The player's own rank, for the footer. `0` means "nothing to say yet". */
const ownRank = computed(() => rankFor(bestScore.value))

/** The player's placing, grouped for their language.
 *
 *  There is no "past the last row we can see" branch any more. `rankFor` never
 *  returns a sentinel — below the published cut it estimates and pins the
 *  answer — so this renders a number or the footer does not render at all. */
const ownRankLabel = computed(() => fmt(ownRank.value))

/** The bare placing, for the rare board that gave a rank but no population —
 *  a `/score` reply landing before any `/top` has. Built in `<script>` because
 *  pug reads a leading `#` in a template as an id shorthand. */
const ownRankHash = computed(() => `#${ownRankLabel.value}`)

const showOwnRank = computed(() => !onBoard.value && ownRank.value !== 0)

const showLoading = computed(() => leaderboardPending.value && entries.value.length === 0)
const showFailed = computed(() =>
  !leaderboardPending.value && leaderboardFailed.value && entries.value.length === 0)
const showEmpty = computed(() =>
  !leaderboardPending.value && !leaderboardFailed.value && leaderboard.value !== null
  && entries.value.length === 0)

// Fetched on OPEN, not on mount: the modal is mounted for the whole session and
// most sessions never open it. `ensureBoard` is idempotent and cached, so a
// player who opens the board six times still costs one request — and a previous
// failure is retried, which makes reopening the screen the retry button.
watch(model, (open) => {
  if (!open) return
  void ensureBoard()
  void playerDisplayName().then((name) => { ownName.value = name })
}, { immediate: true })
</script>

<template lang="pug">
  FModal(v-model="model" :title="t('leaderboard.title')")
    div.board
      div.board__head
        span.board__col.is-rank {{ t('leaderboard.rank') }}
        span.board__col.is-name {{ t('leaderboard.player') }}
        span.board__col.is-score {{ t('leaderboard.score') }}
        span.board__col.is-level {{ t('leaderboard.level') }}

      div.board__state(v-if="showLoading") {{ t('leaderboard.loading') }}
      div.board__state.is-failed(v-else-if="showFailed") {{ t('leaderboard.failed') }}
      div.board__state(v-else-if="showEmpty") {{ t('leaderboard.empty') }}

      div.board__list(v-else)
        div.board-row(
          v-for="(entry, i) in entries"
          :key="`${entry.rank}-${entry.name}-${i}`"
          :class="{ 'is-you': isYou(entry.name) }"
        )
          span.board-row__rank {{ fmt(entry.rank) }}
          span.board-row__name
            span.board-row__name-text {{ entry.name }}
            span.board-row__you(v-if="isYou(entry.name)") {{ t('leaderboard.you') }}
          span.board-row__score {{ fmt(entry.score) }}
          span.board-row__level {{ entry.squad }}

      //- Where the player stands when they are not up there. The reason a
      //- player outside the top 100 opens this screen at all.
      //-
      //- ONE message, not a rank span plus an "of N" span. `yourRank` is a whole
      //- sentence in every locale and several of them order it the other way
      //- round — Japanese is "{total} 人中 #{n} 位", Korean and Turkish likewise
      //- put the population first — so a split into two spans renders those
      //- languages backwards. It also rendered "You are #1,130 of  of 154,331"
      //- in the rest, because `yourRank` already contains `of {total}` and was
      //- only ever handed `{ n }`, leaving a dangling "of ".
      div.board__footer(v-if="showOwnRank")
        span.board__footer-rank(v-if="playerTotal > 0") {{ t('leaderboard.yourRank', { n: ownRankLabel, total: fmt(playerTotal) }) }}
        span.board__footer-rank(v-else) {{ ownRankHash }}
</template>

<style scoped lang="sass">
// One grid template, shared by the header and every row, so the columns line up
// without a table and without a fixed width anywhere. The name column is the
// only flexible one — the three numbers are as wide as their content and no
// wider, which is what keeps four columns on a 320 px screen.
$cols: clamp(1.6rem, 8vw, 2.4rem) minmax(0, 1fr) clamp(2rem, 9vw, 3rem) clamp(2.2rem, 10vw, 3.4rem)

.board
  display: flex
  flex-direction: column
  gap: clamp(0.15rem, 0.8vw, 0.3rem)
  width: 100%

.board__head
  display: grid
  grid-template-columns: $cols
  gap: clamp(0.3rem, 2vw, 0.6rem)
  padding: 0 clamp(0.3rem, 1.6vw, 0.6rem) clamp(0.15rem, 0.8vw, 0.3rem)
  border-bottom: 2px solid rgba(255, 255, 255, 0.12)

.board__col
  color: #9fb2d0
  font-weight: 900
  text-transform: uppercase
  letter-spacing: 0.02em
  font-size: clamp(0.5rem, 2.2vw, 0.65rem)
  text-align: right

  &.is-rank, &.is-name
    text-align: left

.board__list
  display: flex
  flex-direction: column
  gap: clamp(0.15rem, 0.8vw, 0.3rem)

.board-row
  display: grid
  grid-template-columns: $cols
  align-items: center
  gap: clamp(0.3rem, 2vw, 0.6rem)
  padding: clamp(0.22rem, 1.2vw, 0.42rem) clamp(0.3rem, 1.6vw, 0.6rem)
  border: 2px solid transparent
  border-radius: clamp(0.35rem, 1.8vw, 0.6rem)
  background-color: rgba(0, 0, 0, 0.22)

  // Zebra striping rather than a border per row: 100 rows of border is a wall.
  &:nth-child(even)
    background-color: rgba(0, 0, 0, 0.08)

  // The row the player came here to find.
  &.is-you
    border-color: #ffcd00
    background-image: linear-gradient(to bottom, #3a4a24, #2a3a18)
    background-color: transparent

.board-row__rank
  color: #ffd93c
  font-weight: 900
  font-size: clamp(0.62rem, 2.8vw, 0.85rem)
  text-align: left
  text-shadow: 1px 1px 0 #000

.board-row__name
  display: flex
  align-items: baseline
  gap: 0.35em
  min-width: 0

.board-row__name-text
  overflow: hidden
  text-overflow: ellipsis
  white-space: nowrap
  color: #fff
  font-weight: 700
  font-size: clamp(0.62rem, 2.8vw, 0.85rem)
  text-align: left

.board-row__you
  flex: 0 0 auto
  color: #ffcd00
  font-weight: 900
  text-transform: uppercase
  letter-spacing: 0.03em
  font-size: clamp(0.45rem, 2vw, 0.6rem)

.board-row__score
  color: #8fd6ff
  font-weight: 900
  font-size: clamp(0.62rem, 2.8vw, 0.85rem)
  text-align: right
  text-shadow: 1px 1px 0 #000

.board-row__level
  color: #b9cbe8
  font-weight: 700
  font-size: clamp(0.6rem, 2.6vw, 0.8rem)
  text-align: right

.board__state
  padding: clamp(1rem, 8vw, 2.5rem) clamp(0.5rem, 3vw, 1rem)
  color: #b9cbe8
  font-weight: 700
  text-align: center
  font-size: clamp(0.65rem, 3vw, 0.9rem)
  line-height: 1.35

  &.is-failed
    color: #ffa6a6

.board__footer
  display: flex
  flex-wrap: wrap
  align-items: baseline
  justify-content: center
  gap: 0.15rem 0.4rem
  margin-top: clamp(0.2rem, 1.2vw, 0.45rem)
  padding: clamp(0.3rem, 1.6vw, 0.55rem) clamp(0.4rem, 2vw, 0.8rem)
  border: 2px solid #ffcd00
  border-radius: clamp(0.35rem, 1.8vw, 0.6rem)
  background-color: rgba(0, 0, 0, 0.3)

.board__footer-rank
  color: #ffd93c
  font-weight: 900
  text-transform: uppercase
  font-size: clamp(0.68rem, 3.2vw, 0.95rem)
  text-shadow: 2px 2px 0 #000
</style>
