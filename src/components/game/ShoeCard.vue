<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import GameIcon from '@/components/icons/GameIcon.vue'
import IconCoin from '@/components/icons/IconCoin.vue'
import FButton from '@/components/atoms/FButton.vue'
import { paintShoe, shoeSprite, SHOE_BOX } from '@/game/footArt'
import type { ShoeSpec } from '@/game/shoes'
import type { GameIconName } from '@/components/icons/iconNames'

/**
 * ─── One shoe in the Locker ─────────────────────────────────────────────────
 *
 * A picture, a name, three stat pips, and one button whose caption depends on
 * what the player can do with it right now.
 *
 * ── The picture is THE GAME'S OWN DRAWING ──
 *
 * Not an illustration of the shoe, and not an icon: the card renders it with
 * `paintShoe`, the exact function the renderer uses on the board, into a small
 * canvas. So the thing bought and the thing worn are one object, and a painted
 * override that lands in `images/shoes/` changes both at once. A card drawn from
 * a lookalike would be the one place in the game where the art can silently
 * drift out of agreement with itself.
 *
 * ── The stat pips ──
 *
 * Three rows of five, exactly as the GDD's matrix prints them. Pips rather than
 * numbers because the audience starts at six, and "speed 4" means nothing to a
 * six-year-old while four filled dots against five mean everything.
 *
 * ── The price is on the CLOSED card ──
 *
 * It did not used to be. The card showed art, a name and a padlock, and the
 * price, the star gate and the Buy button all lived inside the expanded body —
 * which only appeared once the card had been tapped. Nothing on the closed card
 * said there was anything to press, so the entire shop was invisible to a
 * player who never guessed that a shoe was a button. A six-year-old does not
 * explore a grid to find out whether it is interactive; they look for a price
 * tag, because that is what a shop has.
 *
 * So the tag row below the name is ALWAYS rendered: the coin cost of any shoe
 * they do not own, the star gate as well when they have not reached it, and
 * the state word ("Worn" / "Wear") when they do own it. The card the player can
 * afford right now goes further and makes itself the loud thing in the grid —
 * a gold rim and a breathing tag — because "you have the money for this one"
 * is the single most useful fact the Locker holds and it was previously two
 * taps deep.
 */

interface Props {
  spec: ShoeSpec
  owned: boolean
  starLocked: boolean
  affordable: boolean
  starsShort: number
  coinsShort: number
  equipped: boolean
  open: boolean
  /**
   * The platform can genuinely fill a rewarded video RIGHT NOW — a real
   * provider, an ad loaded, and the throttle not spent. Resolved by the parent
   * (`LockerModal`) so the card stays a pure render of props and one Locker
   * does not ask the ad stack six times.
   *
   * It is only an ingredient: the card still decides whether an OFFER makes
   * sense for this particular shoe (see `showAdUnlock`).
   */
  adReady?: boolean
  /** A shoe's video is in flight somewhere in the grid. Disables every film
   *  button, not just the one pressed — the reward is per-video, and a second
   *  request racing the first would spend two of the player's throttle budget
   *  for one shoe. */
  adBusy?: boolean
}

const props = withDefaults(defineProps<Props>(), { adReady: false, adBusy: false })
const emit = defineEmits<{
  (e: 'select'): void
  (e: 'act'): void
  (e: 'ad-unlock'): void
}>()
const { t } = useI18n()

const canvasRef = ref<HTMLCanvasElement | null>(null)

/**
 * Draw the shoe into the card's canvas.
 *
 * Re-run on mount and whenever the card's identity changes. The canvas is sized
 * from its own laid-out box times the device pixel ratio, so the drawing is
 * crisp on a phone at dpr 3 and does not cost four times the pixels on a
 * monitor at dpr 1.
 */
const draw = (): void => {
  const c = canvasRef.value
  if (!c) return
  const rect = c.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(rect.width * dpr))
  const h = Math.max(1, Math.round(rect.height * dpr))
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  // The origin sits high in the box and the shoe is drawn small, because the
  // ankle and lower leg run BACK out of the heel and fade over nearly three
  // half-lengths (`footArt.legAndCuff`). Centred and drawn large, the leg ran
  // off the bottom of the card and the fade read as a smudge behind the name.
  ctx.translate(w / 2, h * 0.4)
  const painted = shoeSprite(props.spec.id)
  const half = Math.min(w, h) * 0.26
  if (painted && painted.naturalWidth > 0) {
    const pw = half * SHOE_BOX.w
    const ph = pw * (painted.naturalHeight / painted.naturalWidth)
    // Anchored on the TOE, exactly as the renderer does it — the constant, not
    // a copy of its value, so a change to the authoring box cannot leave the
    // Locker drawing a painted shoe in a different place from the board.
    ctx.drawImage(painted, -pw / 2, -ph * SHOE_BOX.toeFromTop, pw, ph)
  } else {
    paintShoe(ctx, props.spec.id, props.spec, half)
  }
  ctx.restore()
}

onMounted(() => {
  draw()
  // A resize changes the canvas's box, and a canvas whose backing store no
  // longer matches its box is a blurry shoe. One observer per card; cheap, and
  // it is the only way to catch a rotation inside an open modal.
  if (typeof ResizeObserver !== 'undefined' && canvasRef.value) {
    const ro = new ResizeObserver(() => draw())
    ro.observe(canvasRef.value)
  }
})
watch(() => [props.spec.id, props.open], () => { void Promise.resolve().then(draw) })

/** Five pips per row, filled to the rank. */
const pips = computed(() => [
  { icon: 'right' as const, label: t('shoes.stats.speed'), n: props.spec.speedRank },
  { icon: 'target' as const, label: t('shoes.stats.radius'), n: props.spec.radiusRank },
  { icon: 'shield' as const, label: t('shoes.stats.pierce'), n: props.spec.pierceRank }
])

/**
 * The tag row: what this shoe costs, or what the player already has.
 *
 * A LIST rather than one chip, because a star-locked shoe owes two facts at
 * once — it costs 550 coins AND it does not open until 24 stars — and printing
 * only the nearer of the two is how a Locker ends up looking arbitrary. The
 * coin chip always states the PRICE, never the shortfall; the shortfall is the
 * expanded button's job, and a closed card that says "310 more coins" tells a
 * child what they are missing without ever telling them what the thing is
 * worth.
 *
 * `key` is stable per chip kind so Vue does not re-create the node (and restart
 * the affordable chip's pulse) on every coin the player earns.
 */
interface PriceChip {
  key: string
  /** `coin` is painted by `IconCoin`; everything else is a `GameIcon` glyph. */
  icon: GameIconName
  text: string
  /** Screen-reader wording for `text`, or '' when the glyph plus the number
   *  already say it (the "Worn" / "Wear" chips read as words on their own). */
  sr: string
  tone: string
}

const chips = computed<PriceChip[]>(() => {
  if (props.equipped) {
    return [{ key: 'worn', icon: 'check', text: t('locker.worn'), sr: '', tone: 'is-worn' }]
  }
  if (props.owned) {
    return [{ key: 'own', icon: 'boot', text: t('locker.wear'), sr: '', tone: 'is-owned' }]
  }
  const out: PriceChip[] = [{
    key: 'cost',
    // The coin is `IconCoin`, not a glyph — same painted coin the wallet line
    // and the HUD use, so the number on the tag and the number in the purse are
    // visibly the same currency.
    icon: 'coin',
    text: String(props.spec.cost),
    sr: t('locker.price', { n: props.spec.cost }),
    tone: props.affordable ? 'is-ready' : 'is-short'
  }]
  if (props.starLocked) {
    out.push({
      key: 'stars',
      icon: 'star',
      text: String(props.spec.starGate),
      sr: t('locker.starGate', { n: props.spec.starGate }),
      tone: 'is-locked'
    })
  }
  return out
})

/**
 * Offer the rewarded video?
 *
 * Only where it is an ALTERNATIVE to money the player does not have. Not on a
 * shoe they own, not on one they can already afford (a video that buys what a
 * button already buys is just a worse button), and — the rule that matters —
 * never on a star-locked shoe. Stars are progress; ads buy coins, not progress.
 *
 * `adReady` carries the platform half: a real provider with a loaded ad and
 * throttle budget left. An offer that cannot be filled is worse than no offer,
 * so when it is false the button is not rendered at all rather than rendered
 * disabled.
 */
const showAdUnlock = computed(() =>
  props.adReady && !props.owned && !props.starLocked && !props.affordable)

/** What the one button says, and whether it can be pressed. */
const action = computed(() => {
  if (props.equipped) return { label: t('locker.worn'), disabled: true, type: 'success' as const }
  if (props.owned) return { label: t('locker.wear'), disabled: false, type: 'success' as const }
  if (props.starLocked) {
    return { label: t('locker.needStars', { n: props.starsShort }), disabled: true, type: 'secondary' as const }
  }
  if (!props.affordable) {
    return { label: t('locker.needCoins', { n: props.coinsShort }), disabled: true, type: 'secondary' as const }
  }
  return { label: t('locker.buy', { n: props.spec.cost }), disabled: false, type: 'primary' as const }
})
</script>

<template lang="pug">
  div.shoe-card(
    :class="{ 'is-open': open, 'is-equipped': equipped, 'is-locked': starLocked, 'is-owned': owned, 'is-affordable': affordable }"
    @click="emit('select')"
  )
    div.shoe-card__art
      canvas.shoe-card__canvas(ref="canvasRef")
      span.shoe-card__lock(v-if="starLocked" aria-hidden="true")
        GameIcon(name="lock")
      span.shoe-card__worn(v-if="equipped" aria-hidden="true")
        GameIcon(name="check")

    span.shoe-card__name {{ t(`shoes.${spec.id}.name`) }}

    //- The price tag. Never behind a tap: this row is what tells a player the
    //- grid is a SHOP, and it is the whole reason the closed card is legible.
    div.shoe-card__tags
      span.shoe-card__tag(v-for="c in chips" :key="c.key" :class="c.tone")
        IconCoin.shoe-card__tag-icon(v-if="c.icon === 'coin'")
        GameIcon.shoe-card__tag-icon(v-else :name="c.icon")
        span.sr-only(v-if="c.sr") {{ c.sr }}
        //- Hidden from the reader only when the sr-only line above already
        //- says the number in words — otherwise "350" would be announced twice.
        span.shoe-card__tag-text(:aria-hidden="c.sr ? 'true' : undefined") {{ c.text }}

      //- MovieIcon Unlock — the second way to pay, offered only where a video
      //- can actually be filled. `.stop` keeps the tap off the card's own
      //- expand/collapse handler; it works because `FButton` forwards the
      //- native event as its `click` payload (it did not, once, and this whole
      //- class of binding threw instead of firing).
      FButton.shoe-card__ad(
        v-if="showAdUnlock"
        icon-only
        icon="movie"
        size="sm"
        type="warning"
        :is-disabled="adBusy"
        :aria-label="t('locker.adUnlock')"
        @click.stop="emit('ad-unlock')"
      )

    //- The perk, and the trade it asks for. One line each, and the trade is
    //- always shown: a Locker that only lists upsides is a Locker that lies.
    div.shoe-card__body(v-if="open")
      p.shoe-card__perk {{ t(`shoes.${spec.id}.perk`) }}
      p.shoe-card__trade {{ t(`shoes.${spec.id}.trade`) }}

      ul.shoe-card__stats
        li.shoe-card__stat(v-for="p in pips" :key="p.label")
          GameIcon.shoe-card__stat-icon(:name="p.icon")
          span.sr-only {{ p.label }}
          span.shoe-card__pips
            span.shoe-card__pip(v-for="i in 5" :key="i" :class="{ 'is-on': i <= p.n }")

      FButton(
        block
        size="sm"
        :type="action.type"
        :is-disabled="action.disabled"
        @click.stop="emit('act')"
      )
        span.shoe-card__cta
          IconCoin.shoe-card__cta-coin(v-if="!owned && !starLocked && affordable")
          | {{ action.label }}
</template>

<style scoped lang="sass">
.shoe-card
  display: flex
  flex-direction: column
  align-items: center
  gap: clamp(0.14rem, 0.9vmin, 0.3rem)
  padding: clamp(0.3rem, 1.6vmin, 0.6rem)
  border: 3px solid rgba(255, 255, 255, 0.16)
  border-radius: clamp(0.6rem, 2.4vmin, 1rem)
  background-color: rgba(10, 18, 36, 0.72)
  cursor: pointer
  transition: border-color 140ms ease-out, background-color 140ms ease-out

  &:hover
    border-color: rgba(255, 255, 255, 0.3)

.is-open
  border-color: rgba(255, 217, 60, 0.7)
  background-color: rgba(20, 30, 54, 0.85)

.is-equipped
  border-color: rgba(103, 224, 138, 0.8)

.is-locked
  opacity: 0.72

// "You can buy this one, right now." The loudest thing in the grid, and
// deliberately so: it is the fact the whole Locker exists to deliver, and it
// used to be two taps deep. The rim is a colour and a glow rather than extra
// border WIDTH, so an affordable card occupies exactly the same box as its
// neighbours and the grid does not jump as the player's coins cross a price.
.is-affordable:not(.is-owned)
  border-color: rgba(255, 217, 60, 0.85)
  background-color: rgba(38, 32, 14, 0.82)
  box-shadow: 0 0 0.6rem rgba(255, 205, 0, 0.35)

.shoe-card__art
  position: relative
  width: 100%
  aspect-ratio: 1 / 1
  max-height: clamp(3.4rem, 18vmin, 6rem)

.shoe-card__canvas
  display: block
  width: 100%
  height: 100%

.shoe-card__lock, .shoe-card__worn
  position: absolute
  right: 4%
  top: 4%
  display: flex
  align-items: center
  justify-content: center
  width: clamp(1.1rem, 4.5vmin, 1.5rem)
  height: clamp(1.1rem, 4.5vmin, 1.5rem)
  border-radius: 999px
  border: 2px solid rgba(0, 0, 0, 0.55)

  // `.game-icon`, not `svg`: `GameIcon` renders an `<img>` once the painted art
  // layer is on, and an `svg` selector misses it — the painting then took its
  // intrinsic size and filled (and overflowed) the badge. The class is on the
  // component's root either way, so this one rule sizes both.
  :deep(.game-icon)
    width: 62%
    height: 62%

.shoe-card__lock
  background-color: rgba(20, 26, 44, 0.9)
  color: #9fb0cc

.shoe-card__worn
  background-color: #1f9d4d
  color: #fff

.shoe-card__name
  color: #fff
  font-weight: 900
  text-align: center
  line-height: 1.1
  font-size: clamp(0.6rem, 2.6vmin, 0.9rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

// ─── The price tag row ──────────────────────────────────────────────────────
//
// Wraps rather than shrinks: a star-locked shoe carries two chips plus, on some
// builds, the film button, and at 320px in a single column there is room for
// all three on one line — but at three columns on a tablet there is not, and a
// row that refused to wrap would either clip the star gate or squeeze the
// button below its 44px touch floor. Wrapping costs a line; neither of the
// other two outcomes is allowed.
.shoe-card__tags
  display: flex
  flex-wrap: wrap
  align-items: center
  justify-content: center
  gap: clamp(0.2rem, 1vmin, 0.4rem)
  width: 100%

.shoe-card__tag
  display: inline-flex
  align-items: center
  gap: 0.28em
  // Padding and type are both fluid, so the chip is a chip on a 320px phone and
  // on a 4K monitor. No fixed px anywhere: this row sits under a canvas that is
  // already sized from `vmin`, and a px tag would drift out of scale with it.
  padding: clamp(0.1rem, 0.7vmin, 0.24rem) clamp(0.3rem, 1.6vmin, 0.55rem)
  border: 2px solid rgba(255, 255, 255, 0.16)
  border-radius: 999px
  background-color: rgba(8, 14, 28, 0.7)
  color: #fff
  font-weight: 900
  line-height: 1
  font-size: clamp(0.58rem, 2.4vmin, 0.85rem)
  text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)

  // Sized in `em` off the chip's own fluid type, so the glyph and the number
  // stay optically matched at every screen size — the same rule `FButton` uses
  // for its label/glyph pair.
  .shoe-card__tag-icon
    flex: 0 0 auto
    width: 1.15em
    height: 1.15em

  &.is-ready
    border-color: rgba(255, 217, 60, 0.9)
    background-image: linear-gradient(to bottom, #ffcd00, #f7a000)
    color: #2a1c00
    text-shadow: none
    animation: shoe-tag-breathe 1.6s ease-in-out infinite

  &.is-short
    color: #ffd93c

  &.is-locked
    border-color: rgba(159, 176, 204, 0.4)
    color: #9fb0cc
    // The parent `.is-locked` already dims the whole card; a second dimming
    // here would take the gate below readable on an OLED phone at low
    // brightness, which is the one fact a locked card exists to carry.
    opacity: 1

  &.is-worn
    border-color: rgba(103, 224, 138, 0.7)
    color: #67e08a

  &.is-owned
    border-color: rgba(103, 224, 138, 0.45)
    color: #c8f2d6

// The coin tag breathes instead of bouncing: a translate would reflow nothing
// but would make the tag drift out of the chip row on a card that is already
// only a few hundred pixels tall, and six of them animating on one screen at
// different phases reads as noise rather than invitation.
@keyframes shoe-tag-breathe
  0%, 100%
    filter: brightness(1)
  50%
    filter: brightness(1.22)

@media (prefers-reduced-motion: reduce)
  .shoe-card__tag.is-ready
    animation: none

// The film button is a square glyph control and carries `FButton`'s own 2.25rem
// touch floor, so it can never be crushed by the wrapping row.
.shoe-card__ad
  flex: 0 0 auto

.shoe-card__body
  display: flex
  flex-direction: column
  align-items: stretch
  gap: clamp(0.2rem, 1.1vmin, 0.4rem)
  width: 100%

.shoe-card__perk, .shoe-card__trade
  margin: 0
  text-align: center
  line-height: 1.2
  font-size: clamp(0.52rem, 2.2vmin, 0.74rem)

.shoe-card__perk
  color: #c8f2d6

.shoe-card__trade
  color: #ffb9a8

.shoe-card__stats
  display: flex
  flex-direction: column
  gap: 0.18rem
  margin: 0
  padding: 0
  list-style: none

.shoe-card__stat
  display: flex
  align-items: center
  gap: 0.35em

.shoe-card__stat-icon
  flex: 0 0 auto
  width: clamp(0.65rem, 2.6vmin, 0.9rem)
  height: clamp(0.65rem, 2.6vmin, 0.9rem)
  color: #9fb0cc

.shoe-card__pips
  display: flex
  gap: 0.2em

.shoe-card__pip
  display: block
  width: clamp(0.3rem, 1.4vmin, 0.45rem)
  height: clamp(0.3rem, 1.4vmin, 0.45rem)
  border-radius: 999px
  background-color: rgba(255, 255, 255, 0.16)

  &.is-on
    background-color: #ffd93c

.shoe-card__cta
  display: inline-flex
  align-items: center
  gap: 0.3em

.shoe-card__cta-coin
  width: 1.1em
  height: 1.1em

.sr-only
  position: absolute
  width: 1px
  height: 1px
  padding: 0
  margin: -1px
  overflow: hidden
  clip: rect(0, 0, 0, 0)
  white-space: nowrap
  border: 0
</style>
