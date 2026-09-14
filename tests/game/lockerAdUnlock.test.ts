// ─── Paying for a shoe with a rewarded video ────────────────────────────────
//
// `unlockWithAd` writes an unearned item into the save, so every one of its
// refusals is load-bearing and every one of them is pinned here:
//
//   · a star-locked shoe is refused. Ads substitute for COINS, never for
//     PROGRESS — a gate that can be skipped by sitting through a video is not a
//     gate, it is a shop.
//   · a build with no ad provider is refused. `claimReward` hands the perk over
//     for free where there is nothing to play, which is the right answer for a
//     ×3 coin bonus and absurd for a 900-coin shoe.
//   · a dismissal, a no-fill, a throttled refusal and an SDK error all write
//     NOTHING. The reward has to land; `ok === true` on its own is not enough,
//     which is why the grant callback is the second witness.
//   · a second tap while a video is up is refused, so one shoe cannot cost two
//     of the player's throttle budget.
//   · the star gate is re-checked AFTER the video, because a cloud hydrate can
//     land inside thirty seconds of ad.
//
// The whole ad stack is mocked: this is about the Locker's own arithmetic, and
// `useAds`'s real behaviour (the audio mute, the pause gate, the throttle) is
// pinned by the platform suite.

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── The save layer: an in-memory blob, so nothing here touches localStorage ──
vi.mock('@/use/useBugCrunchState', () => {
  const store = new Map<string, unknown>()
  return {
    __store: store,
    getState: (key: string) => store.get(key),
    setState: (key: string, value: unknown) => { store.set(key, value) },
    setStates: (patch: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(patch)) store.set(k, v)
    },
    removeState: (key: string) => { store.delete(key) }
  }
})

vi.mock('@/use/useSaveStatus', async () => {
  const { ref } = await import('vue')
  return { saveDataVersion: ref(0), flushSaveNow: vi.fn() }
})

vi.mock('@/use/useSplatProgress', async () => {
  const { ref } = await import('vue')
  return { coins: ref(0), totalStars: ref(0), spendCoins: vi.fn(() => false) }
})

// ── The ad gate ──
// `isRewardGated` is a plain const in the real module, so it is mocked as a
// getter over a mutable cell: the tests need to flip it, and a `let` export
// cannot be reassigned from outside.
const adGate = vi.hoisted(() => ({
  gated: true,
  claimReward: vi.fn(async (_grant: () => void) => false)
}))

vi.mock('@/use/useAdGate', () => ({
  get isRewardGated() { return adGate.gated },
  claimReward: adGate.claimReward
}))

import { SHOES_OWNED_KEY, SHOE_KEY } from '@/keys'
import { shoeSpec } from '@/game/shoes'

const load = async () => {
  const locker = await import('@/use/useLocker')
  const progress = await import('@/use/useSplatProgress')
  const state = await import('@/use/useBugCrunchState') as unknown as {
    __store: Map<string, unknown>
  }
  const save = await import('@/use/useSaveStatus')
  return { locker, progress, state, save }
}

/** 350 coins, 9 stars. */
const BOOT = shoeSpec('steelBoot')
/** 900 coins, 48 stars — the far end of the ladder. */
const SOCK = shoeSpec('electricSock')

beforeEach(async () => {
  const { locker, progress, state } = await load()
  locker.__resetLocker()
  state.__store.clear()
  progress.coins.value = 0
  progress.totalStars.value = 0
  adGate.gated = true
  adGate.claimReward.mockReset()
  adGate.claimReward.mockImplementation(async () => false)
})

/** The provider that behaves: the video played to the end. */
const aCompletedView = () =>
  adGate.claimReward.mockImplementation(async (grant: () => void) => { grant(); return true })

describe('a completed view buys the shoe', () => {
  it('owns AND equips it, in one write, spending no coins', async () => {
    const { locker, progress, state, save } = await load()
    progress.totalStars.value = BOOT.starGate
    aCompletedView()

    await expect(locker.unlockWithAd('steelBoot')).resolves.toBe(true)

    expect(locker.owns('steelBoot')).toBe(true)
    expect(locker.equippedShoe.value).toBe('steelBoot')
    expect(state.__store.get(SHOES_OWNED_KEY)).toContain('steelBoot')
    expect(state.__store.get(SHOE_KEY)).toBe('steelBoot')
    // The video WAS the price.
    expect(progress.spendCoins).not.toHaveBeenCalled()
    expect(progress.coins.value).toBe(0)
    // Flushed, like `buy()` — a shoe earned by watching an ad that vanishes on
    // reload is worse than no offer at all.
    expect(save.flushSaveNow).toHaveBeenCalled()
  })

  it('drops the in-flight flag afterwards', async () => {
    const { locker, progress } = await load()
    progress.totalStars.value = BOOT.starGate
    aCompletedView()

    await locker.unlockWithAd('steelBoot')
    expect(locker.adUnlockInFlight.value).toBe(false)
  })
})

describe('nothing is written unless the reward lands', () => {
  const noWrite = async (label: string) => {
    const { locker, state } = await load()
    await expect(locker.unlockWithAd('steelBoot'), label).resolves.toBe(false)
    expect(locker.owns('steelBoot'), label).toBe(false)
    expect(state.__store.has(SHOES_OWNED_KEY), label).toBe(false)
    expect(locker.adUnlockInFlight.value, label).toBe(false)
  }

  beforeEach(async () => {
    const { progress } = await load()
    progress.totalStars.value = BOOT.starGate
  })

  it('a dismissal grants nothing', async () => {
    adGate.claimReward.mockImplementation(async () => false)
    await noWrite('dismissed')
  })

  it('a "successful" call that never ran the grant callback grants nothing', async () => {
    // The second witness. A provider that resolves `true` without ever invoking
    // the grant is a contract violation, and the one that would hand out a free
    // shoe if `ok` alone were trusted.
    adGate.claimReward.mockImplementation(async () => true)
    await noWrite('resolved true, never granted')
  })

  it('an SDK throw grants nothing and does not strand the flag', async () => {
    adGate.claimReward.mockImplementation(async () => { throw new Error('sdk exploded') })
    const { locker, state } = await load()

    await expect(locker.unlockWithAd('steelBoot')).rejects.toThrow('sdk exploded')

    expect(locker.owns('steelBoot')).toBe(false)
    expect(state.__store.has(SHOES_OWNED_KEY)).toBe(false)
    expect(locker.adUnlockInFlight.value, 'the flag was never released').toBe(false)
  })
})

describe('ads substitute for coins, never for progress', () => {
  it('refuses a star-locked shoe without even requesting a video', async () => {
    const { locker } = await load()
    aCompletedView()
    // 9 stars banked, the sock wants 48.
    const { progress } = await load()
    progress.totalStars.value = 9

    await expect(locker.unlockWithAd('electricSock')).resolves.toBe(false)

    expect(locker.owns('electricSock')).toBe(false)
    expect(adGate.claimReward, 'a video was requested for a shoe that cannot be sold')
      .not.toHaveBeenCalled()
  })

  it('re-checks the gate AFTER the video', async () => {
    // Thirty seconds is long enough for a cloud hydrate to land and replace the
    // save with one holding fewer stars. The shoe must not be handed over on
    // the strength of a check made before the ad.
    const { locker, progress, state } = await load()
    progress.totalStars.value = SOCK.starGate
    adGate.claimReward.mockImplementation(async (grant: () => void) => {
      progress.totalStars.value = 0
      grant()
      return true
    })

    await expect(locker.unlockWithAd('electricSock')).resolves.toBe(false)
    expect(locker.owns('electricSock')).toBe(false)
    expect(state.__store.has(SHOES_OWNED_KEY)).toBe(false)
  })
})

describe('a build with no rewarded inventory cannot pay this way', () => {
  it('refuses outright rather than granting for free', async () => {
    adGate.gated = false
    aCompletedView()
    const { locker, progress } = await load()
    progress.totalStars.value = BOOT.starGate

    await expect(locker.unlockWithAd('steelBoot')).resolves.toBe(false)

    expect(locker.owns('steelBoot')).toBe(false)
    expect(adGate.claimReward, 'claimReward would have granted the shoe for free')
      .not.toHaveBeenCalled()
  })
})

describe('one video per shoe', () => {
  it('refuses a second request while one is in flight', async () => {
    const { locker, progress } = await load()
    progress.totalStars.value = BOOT.starGate

    let release!: (v: boolean) => void
    adGate.claimReward.mockImplementation((grant: () => void) =>
      new Promise<boolean>((resolve) => {
        release = (ok) => { if (ok) grant(); resolve(ok) }
      }))

    const first = locker.unlockWithAd('steelBoot')
    // No `await` in between, deliberately: the flag is claimed before the first
    // suspension point, which is the only thing that makes a double-TAP (two
    // presses in one tick, not two ticks) impossible rather than merely
    // unlikely.
    expect(locker.adUnlockInFlight.value).toBe(true)

    await expect(locker.unlockWithAd('steelBoot')).resolves.toBe(false)

    // Wait for the FIRST call's lazy `import()` to land before counting — the
    // dynamic import costs a macrotask, so an immediate count would read 0 and
    // pass for entirely the wrong reason.
    await vi.waitFor(() => expect(adGate.claimReward).toHaveBeenCalled())
    expect(adGate.claimReward, 'a second video was requested for one shoe')
      .toHaveBeenCalledTimes(1)

    release(true)
    await expect(first).resolves.toBe(true)
  })
})

describe('a shoe already owned', () => {
  it('is simply worn — no video is spent on it', async () => {
    const { locker, progress } = await load()
    progress.totalStars.value = BOOT.starGate
    aCompletedView()
    await locker.unlockWithAd('steelBoot')
    adGate.claimReward.mockClear()

    // Swap to the starter, then ask for the boot again.
    expect(locker.equip('sneaker')).toBe(true)
    await expect(locker.unlockWithAd('steelBoot')).resolves.toBe(true)

    expect(locker.equippedShoe.value).toBe('steelBoot')
    expect(adGate.claimReward).not.toHaveBeenCalled()
  })
})
