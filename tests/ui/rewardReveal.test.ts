import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'

import RewardRevealModal from '@/components/organisms/RewardRevealModal.vue'
import FReward from '@/components/atoms/FReward.vue'
import {
  MAX_REVEALS, STAR_MILESTONES, newFoes, nextSeenBugs, rewardsForResult,
  type CampaignReward, type LevelOutcome
} from '@/game/campaignRewards'
import { emptyTally, type RunTally } from '@/game/stars'
import { SHOES } from '@/game/shoes'
import type { BugId } from '@/game/bugs'

/**
 * ─── Things won during the campaign ─────────────────────────────────────────
 *
 * Two halves, and the first is the one that can actually be wrong.
 *
 *   • `campaignRewards.ts` decides WHICH gift screens a finished level earned.
 *     It is pure arithmetic over a result and a saved bestiary, and the ways it
 *     can misfire are all invisible on screen: a first-ever score presented as
 *     a "new best", a species celebrated twice because the bestiary was never
 *     written back, a queue of ten cards after a restored cloud save.
 *   • `RewardRevealModal.vue` presents them ONE AT A TIME. The rule it exists
 *     to keep is that two gift screens must never fight over the display, and
 *     the caller must always hear `done` — including when it opened the modal
 *     with nothing in it, which is the case that deadlocks a result flow
 *     waiting on that event.
 *
 * jsdom has no 2-D context, so the drawings themselves are not exercised here;
 * the component is written to render its ribbon, caption and layout without one
 * precisely so this suite can still cover everything around them.
 */

const { fxSpy } = vi.hoisted(() => ({ fxSpy: vi.fn() }))
vi.mock('@/use/useGameAudio', () => ({ playFx: fxSpy }))

// A bundle of exactly the keys this component asks for. Deliberately NOT the
// real `en.ts`: this suite is the written-down contract for what the
// orchestrator has to add to all 21 locales, and it must fail if the component
// starts reaching for a key nobody was told about.
const messages = {
  en: {
    rewards: 'REWARDS',
    tapToContinue: 'Tap to continue',
    clickToContinue: 'Click to continue',
    reveal: {
      world: 'New place to stomp!',
      shoe: 'New shoes!',
      stars: 'Star milestone!',
      record: 'New best score!',
      chest: 'Treasure!',
      foe: 'A new bug!',
      starsTotal: '{n} stars',
      recordScore: '{n} points',
      recordBeat: 'Old best: {n}',
      chestCoins: '+{n} coins'
    },
    worlds: {
      picnic: 'Picnic Blanket',
      backyard: 'Overgrown Backyard',
      attic: 'Dusty Attic',
      arcade: 'Neon Arcade'
    },
    bugs: { beetle: 'Beetles', moth: 'Moths', ant: 'Ants' },
    shoes: { steelBoot: { name: 'Steel Boot' } }
  }
}

const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages })

const mountModal = (reward: CampaignReward | readonly CampaignReward[] | null) =>
  mount(RewardRevealModal, {
    props: { modelValue: true, reward },
    global: { plugins: [i18n] }
  })

/**
 * Tap the overlay the way a player does — through `FReward`'s own event, so the
 * test does not depend on that component's markup. Since the queue became a
 * montage this is the SKIP: one tap ends the whole run of prizes.
 */
const tapContinue = async (wrapper: ReturnType<typeof mountModal>): Promise<void> => {
  wrapper.findComponent(FReward).vm.$emit('continue')
  await nextTick()
}

/**
 * Let the card on screen hand over to the next one by itself.
 *
 * Comfortably past `DWELL_MS` in the component (1700 ms), which is not exported
 * — a test that pinned the exact number would fail on a tuning change that is
 * none of its business.
 */
const advanceCard = async (): Promise<void> => {
  vi.advanceTimersByTime(2000)
  await nextTick()
}

const tallyWith = (byKind: Partial<Record<BugId, number>>, score = 0): RunTally =>
  ({ ...emptyTally(), byKind, score, cleared: true })

const outcome = (over: Partial<LevelOutcome> = {}): LevelOutcome => ({
  tally: emptyTally(),
  unlockedWorld: null,
  starsBefore: 0,
  starsAfter: 0,
  isRecord: false,
  previousBest: 0,
  seenBugs: [],
  ...over
})

beforeEach(() => {
  fxSpy.mockClear()
})

// ─── The catalogue ──────────────────────────────────────────────────────────

describe('the star milestones', () => {
  it('are every shoe star gate, so each one puts a pair on the shelf', () => {
    for (const gate of SHOES.map((s) => s.starGate).filter((g) => g > 0)) {
      expect(STAR_MILESTONES, `shoe gate ${gate} is not a milestone`).toContain(gate)
    }
  })

  it('are sorted, unique, and never past a perfect 120', () => {
    const sorted = [...STAR_MILESTONES].sort((a, b) => a - b)
    expect(STAR_MILESTONES).toEqual(sorted)
    expect(new Set(STAR_MILESTONES).size).toBe(STAR_MILESTONES.length)
    expect(Math.max(...STAR_MILESTONES)).toBe(120)
  })
})

describe('a new foe', () => {
  it('is a species squished for the first time', () => {
    expect(newFoes(tallyWith({ beetle: 3 }), ['ant'])).toEqual(['beetle'])
  })

  it('is not one the player has already met', () => {
    expect(newFoes(tallyWith({ ant: 12 }), ['ant'])).toEqual([])
  })

  it('is not a species that merely APPEARED — it has to have been squished', () => {
    // `byKind` carries a zero for a kind that spawned and got away, and a bug
    // the player never touched is not a bug they have met.
    expect(newFoes(tallyWith({ moth: 0 }), [])).toEqual([])
  })

  it('is written back into the bestiary — and the write is skipped when nothing changed', () => {
    const seen: readonly BugId[] = ['ant']
    expect(nextSeenBugs(seen, tallyWith({ beetle: 1 }))).toEqual(['ant', 'beetle'])
    // Same array identity, so a caller can skip a cloud push on the 39 levels
    // out of 40 that introduce nobody.
    expect(nextSeenBugs(seen, tallyWith({ ant: 9 }))).toBe(seen)
  })
})

describe('a new personal best', () => {
  it('is not awarded for a FIRST score — there was nothing to beat', () => {
    const out = rewardsForResult(outcome({
      tally: tallyWith({}, 4200), isRecord: true, previousBest: 0
    }))
    expect(out).toEqual([])
  })

  it('is awarded when a real previous best was beaten, and carries it', () => {
    const out = rewardsForResult(outcome({
      tally: tallyWith({}, 4200), isRecord: true, previousBest: 3100
    }))
    expect(out).toEqual([{ kind: 'record', score: 4200, previous: 3100 }])
  })
})

describe('a star milestone', () => {
  it('fires on the level that crosses it', () => {
    const out = rewardsForResult(outcome({ starsBefore: 7, starsAfter: 10 }))
    expect(out).toEqual([{ kind: 'stars', stars: 9 }])
  })

  it('does not fire again once it is behind the player', () => {
    expect(rewardsForResult(outcome({ starsBefore: 9, starsAfter: 12 }))).toEqual([])
  })

  it('reports the HIGHEST crossed, so a restored save is one card and not five', () => {
    const out = rewardsForResult(outcome({ starsBefore: 0, starsAfter: 60 }))
    expect(out).toEqual([{ kind: 'stars', stars: 48 }])
  })
})

describe('the queue a level result earns', () => {
  it('builds a crescendo of scope: a bug, then a record, then stars, then a world', () => {
    const out = rewardsForResult(outcome({
      tally: tallyWith({ beetle: 2 }, 9000),
      isRecord: true,
      previousBest: 5000,
      starsBefore: 8,
      starsAfter: 11,
      unlockedWorld: 2
    }))
    expect(out.map((r) => r.kind)).toEqual(['foe', 'record', 'stars', 'world'])
  })

  it('is capped, and trims the LEAST significant end', () => {
    const out = rewardsForResult(outcome({
      // A wiped bestiary: five species at once, plus everything else.
      tally: tallyWith({ ant: 1, beetle: 1, flea: 1, moth: 1, centipede: 1 }, 9000),
      isRecord: true,
      previousBest: 5000,
      starsBefore: 8,
      starsAfter: 11,
      unlockedWorld: 2
    }))
    expect(out).toHaveLength(MAX_REVEALS)
    // The world survives; the surplus foe cards are what go.
    expect(out[out.length - 1]).toEqual({ kind: 'world', world: 2 })
  })

  it('still pays out on a FAILED run — a new bug is a new bug', () => {
    const failed: RunTally = { ...emptyTally(), byKind: { moth: 1 }, cleared: false }
    expect(rewardsForResult(outcome({ tally: failed }))).toEqual([{ kind: 'foe', bug: 'moth' }])
  })
})

// ─── The gift screen ────────────────────────────────────────────────────────

describe('the reveal modal', () => {
  // The queue plays itself now: a card dwells, then hands over. Fake timers so
  // the handover is a step this test takes rather than a second it waits.
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('presents a queue ONE AT A TIME, in order', async () => {
    const wrapper = mountModal([
      { kind: 'foe', bug: 'beetle' },
      { kind: 'world', world: 2 }
    ])
    await nextTick()

    expect(wrapper.text()).toContain('A new bug!')
    expect(wrapper.text()).toContain('Beetles')
    // The second prize is NOT on screen at the same time as the first.
    expect(wrapper.text()).not.toContain('New place to stomp!')

    await advanceCard()
    expect(wrapper.text()).toContain('New place to stomp!')
    expect(wrapper.text()).toContain('Overgrown Backyard')
    expect(wrapper.text()).not.toContain('A new bug!')
  })

  it('closes itself and reports done only after the LAST one', async () => {
    const wrapper = mountModal([
      { kind: 'stars', stars: 24 },
      { kind: 'record', score: 7700, previous: 5100 }
    ])
    await nextTick()

    await advanceCard()
    expect(wrapper.emitted('done')).toBeUndefined()

    await advanceCard()
    expect(wrapper.emitted('done')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('opened with nothing, it closes at once instead of stranding the caller', async () => {
    // The deadlock this prevents: a result flow that waits on `done` before
    // showing its own screen, opened on a level that happened to win nothing.
    const wrapper = mountModal([])
    await nextTick()
    expect(wrapper.emitted('done')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
    expect(fxSpy).not.toHaveBeenCalled()
  })

  it('takes a single reward as well as a list', async () => {
    const wrapper = mountModal({ kind: 'shoe', shoe: 'steelBoot' })
    await nextTick()
    expect(wrapper.text()).toContain('New shoes!')
    expect(wrapper.text()).toContain('Steel Boot')
  })

  it('queues a prize that arrives mid-show BEHIND the one on screen', async () => {
    const wrapper = mountModal([{ kind: 'foe', bug: 'moth' }])
    await nextTick()
    expect(wrapper.text()).toContain('Moths')

    // The chest is claimed while the gift screen is already up.
    await wrapper.setProps({
      reward: [{ kind: 'chest', coins: 80, gold: true }] as CampaignReward[]
    })
    // Still the moth: the screen did not change under the player's thumb.
    expect(wrapper.text()).toContain('Moths')
    expect(wrapper.emitted('done')).toBeUndefined()

    await advanceCard()
    expect(wrapper.text()).toContain('Treasure!')
    expect(wrapper.text()).toContain('+80 coins')
  })

  it('plays one of the game\'s two existing cues per card, and no others', async () => {
    const wrapper = mountModal([
      { kind: 'world', world: 3 },
      { kind: 'stars', stars: 36 },
      { kind: 'record', score: 10, previous: 5 },
      { kind: 'shoe', shoe: 'steelBoot' }
    ])
    await nextTick()
    await advanceCard()
    await advanceCard()
    await advanceCard()

    // A thing that is now YOURS → `unlock`; a number that went up → `star`.
    expect(fxSpy.mock.calls.map((c) => c[0])).toEqual(['unlock', 'star', 'star', 'unlock'])
  })

  it('names a prize with the key that already names it everywhere else', async () => {
    // No second name for a thing the player has met under another one: the
    // world card reads the level card's key, the bug card the objective
    // strip's, the shoe card the Locker's.
    const wrapper = mountModal([
      { kind: 'world', world: 4 },
      { kind: 'foe', bug: 'ant' }
    ])
    await nextTick()
    expect(wrapper.text()).toContain('Neon Arcade')
    await advanceCard()
    expect(wrapper.text()).toContain('Ants')
  })

  it('shows a pip per prize, so a child can see how many are still coming', async () => {
    const wrapper = mountModal([
      { kind: 'foe', bug: 'ant' },
      { kind: 'foe', bug: 'moth' },
      { kind: 'world', world: 2 }
    ])
    await nextTick()
    expect(wrapper.findAll('.reveal-card__pip')).toHaveLength(3)
    expect(wrapper.findAll('.reveal-card__pip.is-on')).toHaveLength(1)
    await advanceCard()
    expect(wrapper.findAll('.reveal-card__pip.is-on')).toHaveLength(2)
  })

  it('a tap ends the whole montage, not just the card on screen', async () => {
    // Five prizes in a row after a boss was measured as five taps charged to a
    // player who had just been having a good time, and the blind tester's note
    // was "ok I get it, can I just play". A tap here means "give me the game
    // back" — everything on the queue is already banked, so nothing is lost.
    const wrapper = mountModal([
      { kind: 'foe', bug: 'beetle' },
      { kind: 'stars', stars: 24 },
      { kind: 'world', world: 2 }
    ])
    await nextTick()
    expect(wrapper.text()).toContain('A new bug!')

    await tapContinue(wrapper)
    expect(wrapper.emitted('done')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

/**
   * ─── The prize is drawn at OBJECT size, and says so ───────────────────────
   *
   * The three number-shaped kinds show a glyph instead of a drawing, and this
   * card draws it at ~70–130 CSS px depending on the viewport — five to eight
   * times the 16 px a mark on a button gets. `GameIcon` cannot see its own box,
   * so the CALL SITE has to declare that, and this is the only call site in the
   * game that does.
   *
   * Without it the card is on the flat rung: the painting is masked to its own
   * alpha and filled with one cream, which welds the trophy's handles to its
   * bowl and hands the player a sticker of a prize instead of a picture of one.
   */
  it('asks for the hero rung on the glyph cards, because they are drawn at object size', async () => {
    for (const reward of [
      { kind: 'record', score: 900, previous: 400 },
      { kind: 'stars', stars: 9 },
      { kind: 'chest', coins: 50, gold: false }
    ] as const) {
      const w = mountModal(reward)
      await nextTick()
      const glyph = w.findComponent({ name: 'GameIcon' })
      expect(glyph.exists(), `${reward.kind} has no glyph`).toBe(true)
      expect(glyph.props('hero'), `${reward.kind} did not declare its size`).toBe(true)
    }
  })

  it('shows no pager for a single prize', async () => {
    const wrapper = mountModal({ kind: 'stars', stars: 15 })
    await nextTick()
    expect(wrapper.findAll('.reveal-card__pip')).toHaveLength(0)
    expect(wrapper.text()).toContain('15 stars')
  })
})
