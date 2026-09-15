<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import FModal from '@/components/molecules/FModal.vue'
import FButton from '@/components/atoms/FButton.vue'
import GameIcon from '@/components/icons/GameIcon.vue'
import IconCoin from '@/components/icons/IconCoin.vue'
import ShoeCard from '@/components/game/ShoeCard.vue'
import useLocker from '@/use/useLocker'
import { coins, totalStars } from '@/use/useSplatProgress'
import useSounds from '@/use/useSound'
import { playFx } from '@/use/useGameAudio'
import { canOfferReward, isRewardGated } from '@/use/useAdGate'
import type { ShoeId } from '@/game/shoes'

/**
 * ─── The Locker ─────────────────────────────────────────────────────────────
 *
 * Six shoes, all six always visible, in a grid that reflows from one column on a
 * 320 px phone to three on a tablet.
 *
 * ── Why nothing is hidden ──
 *
 * A Locker with invisible rows is a Locker nobody plans around. A nine-year-old
 * who can SEE the roller skates, and can see they cost 550 coins and 24 stars,
 * has a reason to play the next level; one who cannot see them has a reason to
 * stop. So a shoe short of its star gate shows the gate, a shoe short of its
 * price shows the price, and neither is ever missing from the grid.
 *
 * ── Why buying equips ──
 *
 * A child who has just spent four hundred coins expects to be wearing the thing.
 * A shop that makes them press a second button to get what they bought reads as
 * a bug. `buy()` therefore equips; the only separate action is swapping between
 * shoes they already own.
 *
 * ── The second currency ──
 *
 * A shoe past its star gate but short of its price can also be paid for with a
 * rewarded video. That offer is resolved ONCE here and handed down to every
 * card, rather than six cards each asking the ad stack the same question — and
 * it is resolved as "can a video actually be filled right now", not "does this
 * build have ads at all". `isRewardGated` is the honest provider check (a build
 * with no provider hands rewards over for free, which is fine for a ×3 coin
 * bonus and absurd for a 900-coin shoe) and `canOfferReward` adds SDK
 * readiness, the rewarded throttle and the rate limit. Where either is false no
 * film button is rendered at all: an offer that cannot be filled reads as the
 * game being broken.
 */

const model = defineModel<boolean>({ required: true })
const { t } = useI18n()
const { playSound } = useSounds()
const { lockerRows, equippedShoe, buy, equip, owns, unlockWithAd, adUnlockInFlight } = useLocker()

/** Is a rewarded video genuinely available to spend on a shoe right now? */
const adReady = computed(() => isRewardGated && canOfferReward.value)

/** Which card is expanded. One at a time: six open cards is a wall of numbers,
 *  and the grid has to stay scannable on a phone. */
const openCard = ref<ShoeId | null>(null)

watch(model, (open) => { if (open) openCard.value = equippedShoe.value })

const onSelect = (id: ShoeId): void => {
  openCard.value = openCard.value === id ? null : id
}

const onAct = (id: ShoeId): void => {
  if (owns(id)) {
    if (equip(id)) playSound('modal-open', 0.06)
    return
  }
  if (buy(id)) {
    playFx('unlock')
  }
}

/**
 * Pay for a shoe with a rewarded video.
 *
 * The card is opened FIRST and deliberately. `unlockWithAd` hands control to an
 * ad that covers the whole screen for tens of seconds, and a player who comes
 * back to a grid that looks exactly as it did has no idea which of six shoes
 * they just earned — so the card they paid for is expanded before the video
 * starts and is still the open one when it ends, wearing its "Worn" plate.
 *
 * The unlock sound is the same `unlock` cue a purchase plays: the shoe arrived
 * the same way as far as the player is concerned, and only the price differed.
 */
const onAdUnlock = async (id: ShoeId): Promise<void> => {
  openCard.value = id
  if (await unlockWithAd(id)) {
    playFx('unlock')
  }
}

const equippedName = computed(() => t(`shoes.${equippedShoe.value}.name`))
</script>

<template lang="pug">
  FModal(v-model="model" :title="t('locker.title')")
    div.locker
      //- The wallet line: what the player has to spend, and what they are
      //- wearing. Both are answers to questions every row below raises.
      div.locker__wallet
        span.locker__stat
          IconCoin.locker__coin
          span {{ coins }}
        span.locker__stat
          GameIcon.locker__icon(name="star")
          span {{ totalStars }}
        span.locker__worn
          GameIcon.locker__icon(name="boot")
          span {{ equippedName }}

      div.locker__grid
        ShoeCard(
          v-for="row in lockerRows"
          :key="row.spec.id"
          :spec="row.spec"
          :owned="row.owned"
          :star-locked="row.starLocked"
          :affordable="row.affordable"
          :stars-short="row.starsShort"
          :coins-short="row.coinsShort"
          :equipped="row.spec.id === equippedShoe"
          :open="openCard === row.spec.id"
          :ad-ready="adReady"
          :ad-busy="adUnlockInFlight"
          @select="onSelect(row.spec.id)"
          @act="onAct(row.spec.id)"
          @ad-unlock="onAdUnlock(row.spec.id)"
        )

    template(#footer)
      FButton(class="px-6 sm:px-8" @click="model = false") {{ t('close') }}
</template>

<style scoped lang="sass">
.locker
  display: flex
  flex-direction: column
  gap: clamp(0.35rem, 1.8vmin, 0.75rem)
  padding-bottom: clamp(0.2rem, 1vmin, 0.4rem)

.locker__wallet
  display: flex
  align-items: center
  justify-content: center
  flex-wrap: wrap
  gap: clamp(0.3rem, 2vmin, 0.8rem)

.locker__stat, .locker__worn
  display: inline-flex
  align-items: center
  gap: 0.3em
  padding: clamp(0.14rem, 0.9vmin, 0.3rem) clamp(0.4rem, 2.2vmin, 0.75rem)
  border: 2px solid rgba(255, 255, 255, 0.18)
  border-radius: 999px
  background-color: rgba(8, 14, 28, 0.6)
  color: #fff
  font-weight: 900
  line-height: 1
  font-size: clamp(0.66rem, 2.8vmin, 0.95rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

.locker__worn
  border-color: rgba(103, 224, 138, 0.6)

.locker__coin, .locker__icon
  width: 1.1em
  height: 1.1em
  flex: 0 0 auto
  color: #ffd93c

.locker__worn .locker__icon
  color: #67e08a

// One column on a phone, two from 26rem, three from 40rem. Driven by the
// CONTAINER rather than the viewport where it is supported, so the grid is
// right inside the modal's own max-width instead of guessing from the screen.
.locker__grid
  display: grid
  grid-template-columns: 1fr
  gap: clamp(0.3rem, 1.6vmin, 0.6rem)
  // Each card keeps its OWN height. A grid's default `stretch` made every card
  // in a row as tall as the tallest, so opening one card grew its two or three
  // neighbours by the same 180px of empty panel — the whole grid ballooned, not
  // the card that was tapped, and on a 3-column layout that is most of the
  // Locker. Measured before this: open 313px, closed 313px. After: 313 and 127.
  align-items: start

@media (min-width: 26rem)
  .locker__grid
    grid-template-columns: repeat(2, minmax(0, 1fr))

@media (min-width: 44rem)
  .locker__grid
    grid-template-columns: repeat(3, minmax(0, 1fr))
</style>
