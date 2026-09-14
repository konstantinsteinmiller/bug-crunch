import { computed, ref, watch } from 'vue'
import { getState, setStates } from '@/use/useBugCrunchState'
import { saveDataVersion, flushSaveNow } from '@/use/useSaveStatus'
import { SHOES_OWNED_KEY, SHOE_KEY } from '@/keys'
import {
  SHOES, STARTER_SHOE, isShoeId, shoeAvailability, shoeSpec, type ShoeId
} from '@/game/shoes'
import { coins, spendCoins, totalStars } from '@/use/useSplatProgress'

/**
 * ─── The Locker ─────────────────────────────────────────────────────────────
 *
 * Which shoes the player owns and which one is on. Two fields in the save blob,
 * and both of them are defended against nonsense, because a corrupt value here
 * is the one save bug that can leave a player with no way to play:
 *
 *   · `owned` always contains the starter, re-seeded on every read;
 *   · `equipped` falls back to the starter whenever it names something the
 *     player does not own — which is exactly what happens to a save written by
 *     a build where a shoe existed that this one has removed.
 */

const readOwned = (): ShoeId[] => {
  const raw = getState<unknown>(SHOES_OWNED_KEY)
  const list = Array.isArray(raw) ? raw.filter(isShoeId) : []
  // The starter is always owned, whatever the blob says.
  if (!list.includes(STARTER_SHOE)) list.unshift(STARTER_SHOE)
  // Free shoes are owned by definition, so a price change in a later build
  // cannot strand somebody without the shoe they have been playing in.
  for (const s of SHOES) if (s.cost === 0 && !list.includes(s.id)) list.push(s.id)
  return list
}

const readEquipped = (owned: ShoeId[]): ShoeId => {
  const raw = getState<unknown>(SHOE_KEY)
  return isShoeId(raw) && owned.includes(raw) ? raw : STARTER_SHOE
}

export const ownedShoes = ref<ShoeId[]>(readOwned())
export const equippedShoe = ref<ShoeId>(readEquipped(ownedShoes.value))

/** The spec of the shoe currently on. Never null. */
export const equippedSpec = computed(() => shoeSpec(equippedShoe.value))

watch(saveDataVersion, () => {
  ownedShoes.value = readOwned()
  equippedShoe.value = readEquipped(ownedShoes.value)
})

export const owns = (id: ShoeId): boolean => ownedShoes.value.includes(id)

/**
 * Every shoe with its availability — what the Locker grid renders.
 *
 * A shoe past its star gate but short of its price shows its price; one short
 * of the star gate shows the gate. Neither is ever hidden: a Locker with
 * invisible rows is a Locker nobody plans around, and a child who cannot see
 * the roller skates has no reason to want them.
 */
export const lockerRows = computed(() => SHOES.map((spec) => ({
  spec,
  ...shoeAvailability(spec, ownedShoes.value, totalStars.value, coins.value)
})))

/** Is there something the player can afford right now? Drives the HUD badge. */
export const affordableShoes = computed(() =>
  lockerRows.value.filter((r) => r.affordable).length)

export const equip = (id: ShoeId): boolean => {
  if (!owns(id)) return false
  equippedShoe.value = id
  setStates({ [SHOE_KEY]: id })
  flushSaveNow()
  return true
}

/**
 * Buy a shoe and put it on.
 *
 * Equipping on purchase is deliberate: a child who has just spent four hundred
 * coins expects to be wearing the thing, and a Locker that makes them press a
 * second button to get what they bought reads as a bug. The spend is atomic —
 * `spendCoins` writes nothing when short — so a failed purchase changes
 * nothing at all.
 */
export const buy = (id: ShoeId): boolean => {
  if (owns(id)) return equip(id)
  const spec = shoeSpec(id)
  const avail = shoeAvailability(spec, ownedShoes.value, totalStars.value, coins.value)
  if (!avail.affordable) return false
  if (!spendCoins(spec.cost)) return false
  const next = [...ownedShoes.value, id]
  ownedShoes.value = next
  equippedShoe.value = id
  setStates({ [SHOES_OWNED_KEY]: next, [SHOE_KEY]: id })
  flushSaveNow()
  return true
}

/**
 * ─── The second currency: a rewarded video ──────────────────────────────────
 *
 * A shoe past its star gate but short of its price can also be paid for by
 * watching one. Ads substitute for COINS, never for PROGRESS: the star gate is
 * the game saying "you have played enough of this for the choice to mean
 * something", and a gate that can be skipped by sitting through a video is not
 * a gate, it is a shop. So `starLocked` refuses here exactly as it refuses in
 * `buy()`.
 *
 * ── Why the ad stack is imported lazily ──
 *
 * `useAdGate` pulls in `useAds`, which resolves a provider, installs the
 * audio-pause orchestrator and starts the throttle's prune timer AT MODULE
 * LOAD. This module is read at boot by the HUD's "you can afford something"
 * badge and by the save suite, neither of which wants an ad SDK in its graph.
 * The import is therefore paid for by the first player who actually taps the
 * film-strip button — by which point the LockerModal has already loaded the
 * same module for its own readiness gate, so it costs nothing at the tap.
 */

/** True while a shoe's rewarded video is in flight. One at a time: two ads
 *  racing would double-charge the throttle for one shoe. */
export const adUnlockInFlight = ref(false)

export const unlockWithAd = async (id: ShoeId): Promise<boolean> => {
  // Already owned is not a failure — it is the same "you wanted this shoe on"
  // intent `buy()` answers, so answer it the same way instead of spending a
  // video on something the player has.
  if (owns(id)) return equip(id)
  if (adUnlockInFlight.value) return false

  const spec = shoeSpec(id)
  const before = shoeAvailability(spec, ownedShoes.value, totalStars.value, coins.value)
  if (before.starLocked) return false

  // The flag is claimed SYNCHRONOUSLY, before the first `await`. Everything
  // above it — `owns`, `shoeSpec`, `shoeAvailability` — is synchronous too, so
  // two taps landing in the same tick cannot both get past this line. Setting
  // it after the dynamic import below would have left exactly that window open,
  // and a double-tap on a phone is not a rare event: it would have spent two of
  // the player's rewarded budget on one shoe.
  adUnlockInFlight.value = true
  try {
    const { claimReward, isRewardGated } = await import('@/use/useAdGate')
    // Belt and braces against the free grant. `claimReward` hands the perk over
    // without a video on any build that has no provider (local dev, itch, plain
    // web) — which is the right answer for a ×3 coin bonus and the wrong one
    // for a 900-coin shoe. The button is not rendered on those builds either,
    // but a limit that only hides UI is not a limit.
    if (!isRewardGated) return false

    // `granted` is set from INSIDE the reward callback rather than read off
    // `claimReward`'s resolution alone, so nothing is written on a dismissal,
    // a no-fill, a throttled refusal or an SDK error. Two independent proofs
    // of the same fact, because this one writes an unearned item into the save.
    let granted = false
    const ok = await claimReward(() => { granted = true })
    if (!ok || !granted) return false

    // Re-read availability AFTER the video. A rewarded ad is tens of seconds
    // long and a cloud hydrate can land inside it — the player may already own
    // this shoe on another device by the time the reward arrives, and the star
    // gate is re-checked because a save that came back with FEWER stars must
    // not be handed a shoe the player has not earned.
    if (owns(id)) return equip(id)
    const after = shoeAvailability(spec, ownedShoes.value, totalStars.value, coins.value)
    if (after.starLocked) return false

    // Only now does anything get written, and both fields go in one `setStates`
    // — same as `buy()`, so a shoe can never be owned-but-not-equipped or
    // equipped-but-not-owned in the blob. No coins are spent: the video WAS the
    // price.
    const next = [...ownedShoes.value, id]
    ownedShoes.value = next
    equippedShoe.value = id
    setStates({ [SHOES_OWNED_KEY]: next, [SHOE_KEY]: id })
    flushSaveNow()
    return true
  } finally {
    adUnlockInFlight.value = false
  }
}

/** Test seam. */
export const __resetLocker = (): void => {
  ownedShoes.value = [STARTER_SHOE]
  equippedShoe.value = STARTER_SHOE
  adUnlockInFlight.value = false
}

const useLocker = () => ({
  ownedShoes, equippedShoe, equippedSpec, lockerRows, affordableShoes,
  owns, equip, buy, unlockWithAd, adUnlockInFlight
})

export default useLocker
