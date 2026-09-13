import { computed, ref, watch } from 'vue'
import { getState, setStates } from '@/use/useSplatixState'
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

/** Test seam. */
export const __resetLocker = (): void => {
  ownedShoes.value = [STARTER_SHOE]
  equippedShoe.value = STARTER_SHOE
}

const useLocker = () => ({
  ownedShoes, equippedShoe, equippedSpec, lockerRows, affordableShoes,
  owns, equip, buy
})

export default useLocker
