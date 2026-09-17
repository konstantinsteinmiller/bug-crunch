import { beforeEach, describe, expect, it } from 'vitest'
import {
  LESSONS, LESSON_IDS, isLessonId, lessonSpec, outranks, type LessonId
} from '@/game/tutorial'
import * as tutor from '@/use/useTutorial'
import { HOLD_TO_LEARN_MS } from '@/use/useTutorial'
import { EGG_LAY_MS, bossSpec } from '@/game/bosses'
import { BOSS_FIGHTS } from '@/game/stages'

/**
 * ─── The curriculum, and the director that runs it ──────────────────────────
 *
 * The tutorial is the one system in this game whose failure is silent: it does
 * not crash, it does not throw, it simply never tells a six-year-old that the
 * charged stomp exists — which is exactly how the first build shipped. So the
 * rules are pinned here rather than left to be noticed.
 */

beforeEach(() => {
  tutor.__resetTutorial()
})

describe('the lesson list', () => {
  it('has a unique id for every lesson, and the lookup agrees', () => {
    expect(new Set(LESSON_IDS).size).toBe(LESSONS.length)
    for (const l of LESSONS) expect(lessonSpec(l.id)).toBe(l)
  })

  it('guards its own type predicate', () => {
    expect(isLessonId('move')).toBe(true)
    expect(isLessonId('parkour')).toBe(false)
    expect(isLessonId(7)).toBe(false)
  })

  it('gives every lesson a way out', () => {
    // A player who does not do the thing must never be stuck being told to.
    for (const l of LESSONS) {
      expect(l.bailoutMs).toBeGreaterThan(0)
      if (l.holdMs !== undefined) expect(l.holdMs).toBeLessThan(l.bailoutMs)
    }
  })

  it('orders the control before anything that uses it', () => {
    expect(outranks('move', 'stomp')).toBe(true)
    expect(outranks('stomp', 'goal')).toBe(true)
    expect(outranks('goal', 'chain')).toBe(true)
    // And the board before the meta: a shop lesson must never outrank the
    // lesson that teaches the game it is a shop for.
    for (const meta of ['stars', 'chest', 'locker', 'buy'] as const) {
      expect(outranks('move', meta)).toBe(true)
    }
  })

  it('gives every lesson a distinct rank, so two can never tie', () => {
    const orders = LESSONS.map((l) => l.order)
    expect(new Set(orders).size).toBe(orders.length)
  })

  // The lessons that land on a modal are the ones about the modal. A board
  // lesson that ran through the pause would tick its bail-out away behind the
  // result screen; a meta lesson that stopped with the board would never get a
  // single frame.
  it('runs exactly the meta lessons through a pause', () => {
    const paused = LESSONS.filter((l) => l.whilePaused).map((l) => l.id).sort()
    expect(paused).toEqual(['buy', 'chest', 'locker', 'stars'])
  })

  it('never dims a lesson that lands on a modal', () => {
    for (const l of LESSONS) {
      if (l.id === 'stars' || l.id === 'buy') expect(l.scrim).toBe('none')
    }
  })

  it('teaches every mechanic the game actually has', () => {
    // The list this test exists to defend. A mechanic added to the game without
    // a row here is a mechanic no child will ever be told about — see the
    // header of `game/tutorial.ts`.
    for (const id of [
      'move', 'stomp', 'goal', 'chain', 'slam', 'spike', 'dodge', 'fever',
      'boss', 'pods', 'stars', 'quests', 'chest', 'locker', 'buy'
    ] as LessonId[]) {
      expect(LESSON_IDS).toContain(id)
    }
  })
})

/**
 * ─── The one lesson about the HUD rather than the game ──────────────────────
 *
 * The level card says, in the player's own language, what the other two stars
 * want. Then it dissolves and two marks appear under the chest, and nothing
 * connects the two: a reviewer read the pair as anonymous roundels, and a
 * six-year-old has less to go on than a reviewer. `quests` is the connection —
 * an arrow from the words to the marks, run once, while both are on screen.
 */
describe('the quest-badge lesson', () => {
  const quests = lessonSpec('quests')

  it('is a flow, because there is nothing to DO — only something to see', () => {
    // The same shape as `goal`, which is the other lesson in this game that
    // explains a relationship rather than a gesture. A hand would be a lie:
    // there is nothing here to copy.
    expect(quests.gesture).toBe('flow')
    expect(quests.holdMs).toBeGreaterThan(0)
  })

  it('outlives the level card it starts on', () => {
    // GameScene holds the banner up for exactly as long as this lesson runs. If
    // the hold were shorter than the lesson the arrow would spend its last
    // second pointing at empty space, which is the failure it exists to fix.
    expect(quests.holdMs!).toBeGreaterThan(1700)
  })

  it('never blacks out a live board to explain a HUD widget', () => {
    // It lands mid-level, with a clock running and bugs walking. `hole` is
    // documented as the OPENING scrim, for the beats where the player has
    // nothing else to be doing.
    expect(quests.scrim).toBe('soft')
  })

  it('stops with the board, unlike the lessons that are about modals', () => {
    // Not `whilePaused`: the level card is not a pause, and a lesson that ran
    // through one would tick its bail-out away behind the result screen.
    expect(quests.whilePaused).toBeUndefined()
  })

  it('yields to every lesson about the game itself', () => {
    // A caterpillar walking into the foot always wins the screen. This is the
    // least urgent thing the game ever explains.
    for (const id of [
      'move', 'stomp', 'goal', 'chain', 'slam', 'spike', 'dodge', 'fever', 'boss', 'pods'
    ] as LessonId[]) {
      expect(outranks(id, 'quests'), `${id} must outrank quests`).toBe(true)
    }
  })

  it('comes after the star row has been explained', () => {
    // `stars`, on the result screen, is what tells a player a star is a thing
    // at all. Explaining where the stars live during play before that would be
    // an answer to a question nobody has yet.
    expect(outranks('stars', 'quests')).toBe(true)
  })

  it('can be put back when its moment passes without it getting the screen', () => {
    // The level card is only up for a moment. A `quests` still sitting in the
    // queue when it goes has to be shelved rather than played to an empty card
    // on the next level's clock.
    tutor.arm('spike')
    tutor.arm('quests')
    expect(tutor.activeLesson.value).toBe('spike')
    tutor.shelve('quests')
    tutor.complete('spike')
    expect(tutor.activeLesson.value).toBeNull()
    expect(tutor.isTaught('quests')).toBe(false)
    tutor.arm('quests')
    expect(tutor.activeLesson.value).toBe('quests')
  })

  it('retires itself after one showing and never returns', () => {
    tutor.arm('quests')
    tutor.step(quests.holdMs! - 10)
    expect(tutor.activeLesson.value).toBe('quests')
    tutor.step(20)
    expect(tutor.activeLesson.value).toBeNull()
    expect(tutor.isTaught('quests')).toBe(true)
    tutor.arm('quests')
    expect(tutor.activeLesson.value).toBeNull()
  })
})

describe('the director', () => {
  it('starts knowing nothing and showing nothing', () => {
    expect(tutor.activeLesson.value).toBeNull()
    expect(tutor.isTaught('move')).toBe(false)
  })

  it('puts an armed lesson on screen', () => {
    tutor.arm('move')
    expect(tutor.activeLesson.value).toBe('move')
    expect(tutor.activeSpec.value?.gesture).toBe('drag')
  })

  it('shows one at a time, lowest rank first', () => {
    tutor.arm('fever')
    tutor.arm('stomp')
    // `stomp` outranks `fever`, but `fever` was armed first and is already up —
    // swapping the lesson under the player mid-animation is worse than an
    // out-of-order pair.
    expect(tutor.activeLesson.value).toBe('fever')
    tutor.complete('fever')
    expect(tutor.activeLesson.value).toBe('stomp')
  })

  it('promotes the lowest rank out of a queue', () => {
    tutor.arm('move')
    tutor.arm('buy')
    tutor.arm('chain')
    expect(tutor.activeLesson.value).toBe('move')
    tutor.complete('move')
    // `chain` (40) beats `buy` (130).
    expect(tutor.activeLesson.value).toBe('chain')
  })

  it('ignores a lesson that is already taught', () => {
    tutor.complete('move')
    tutor.arm('move')
    expect(tutor.activeLesson.value).toBeNull()
  })

  it('ignores a double arm', () => {
    tutor.arm('move')
    tutor.arm('move')
    tutor.complete('move')
    expect(tutor.activeLesson.value).toBeNull()
  })

  // A player who works out the chain on their own before the game gets round to
  // mentioning it has earned the right never to be told.
  it('teaches a lesson that was never shown, when the player just does it', () => {
    expect(tutor.isTaught('chain')).toBe(false)
    tutor.complete('chain')
    expect(tutor.isTaught('chain')).toBe(true)
    tutor.arm('chain')
    expect(tutor.activeLesson.value).toBeNull()
  })

  it('shelves a lesson without teaching it, so its moment can come round again', () => {
    tutor.arm('buy')
    expect(tutor.activeLesson.value).toBe('buy')
    tutor.shelve('buy')
    expect(tutor.activeLesson.value).toBeNull()
    expect(tutor.isTaught('buy')).toBe(false)
    tutor.arm('buy')
    expect(tutor.activeLesson.value).toBe('buy')
  })
})

describe('the director\'s clock', () => {
  it('fills the ring while the player is doing the thing', () => {
    tutor.arm('move')
    tutor.step(300, true)
    expect(tutor.lessonProgress.value).toBeGreaterThan(0)
    expect(tutor.lessonProgress.value).toBeLessThan(1)
  })

  // The regression this case exists for: the first rewrite filled the ring and
  // then never completed the lesson, so the opening drag sat on screen with a
  // full ring and no way past it until the bail-out.
  it('retires the held lesson once the gesture has been held long enough', () => {
    tutor.arm('move')
    tutor.step(HOLD_TO_LEARN_MS - 20, true)
    expect(tutor.activeLesson.value).toBe('move')
    tutor.step(40, true)
    expect(tutor.activeLesson.value).toBeNull()
    expect(tutor.isTaught('move')).toBe(true)
  })

  it('does not fill it while they are not', () => {
    tutor.arm('move')
    tutor.step(300, false)
    expect(tutor.lessonProgress.value).toBe(0)
    expect(tutor.activeLesson.value).toBe('move')
  })

  it('retires a watch-only lesson after it has been seen for long enough', () => {
    tutor.arm('stars')
    const hold = lessonSpec('stars').holdMs!
    tutor.step(hold - 10)
    expect(tutor.activeLesson.value).toBe('stars')
    tutor.step(20)
    expect(tutor.activeLesson.value).toBeNull()
    expect(tutor.isTaught('stars')).toBe(true)
  })

  it('bails out — and counts as taught, so it never nags twice', () => {
    tutor.arm('move')
    tutor.step(lessonSpec('move').bailoutMs + 1, false)
    expect(tutor.activeLesson.value).toBeNull()
    expect(tutor.isTaught('move')).toBe(true)
  })

  it('is a no-op with nothing on screen', () => {
    expect(() => tutor.step(16.7, true)).not.toThrow()
    expect(tutor.activeLesson.value).toBeNull()
  })

  it('resets the clock between lessons, so the second is not born expired', () => {
    tutor.arm('move')
    tutor.step(lessonSpec('move').bailoutMs - 50, false)
    tutor.arm('chain')
    tutor.complete('move')
    expect(tutor.activeLesson.value).toBe('chain')
    tutor.step(50, false)
    expect(tutor.activeLesson.value).toBe('chain')
  })
})

/**
 * ─── The boss's eggs ────────────────────────────────────────────────────────
 *
 * The first boss moved from 1-10 to 1-4, which puts her egg phase in front of a
 * player four levels into the game. Until then the only thing that said "the
 * eggs are the job now" was a line of text under the boss bar.
 */
describe('the eggs lesson', () => {
  const pods = lessonSpec('pods')

  it('shows the hand dropping onto an egg — the stomp lesson, on a new target', () => {
    expect(pods.gesture).toBe('tap')
    // Retired by the first egg squished, not by being looked at.
    expect(pods.holdMs).toBeUndefined()
    expect(pods.scrim).toBe('soft')
    expect(pods.whilePaused).toBeUndefined()
  })

  it('waits for the boss to be introduced first, and still beats the HUD lessons', () => {
    expect(outranks('boss', 'pods')).toBe(true)
    expect(outranks('pods', 'quests')).toBe(true)
    expect(outranks('pods', 'stars')).toBe(true)
  })

  it('never nags: a player who squished an egg on their own is never shown it', () => {
    tutor.complete('pods')
    tutor.arm('pods')
    expect(tutor.activeLesson.value).toBeNull()
  })

  // Every boss fight has eggs now, and a hatch is the lesson's second half: the
  // consequence of NOT tapping. So the hand has to stay up long enough for the
  // first egg it points at to hatch under it, in every fight a player can meet
  // one in — the half-strength Queen's slower clock, and her egg's hop, included.
  it('stays up long enough to watch the egg it points at hatch, in every boss fight', () => {
    for (const [level, fight] of Object.entries(BOSS_FIGHTS)) {
      const egg = bossSpec(fight.boss, fight.scale).podHatchMs + EGG_LAY_MS
      expect(pods.bailoutMs, `level ${level}: an egg takes ${egg} ms`).toBeGreaterThan(egg)
    }
  })

  it('is armed by an egg the same way wherever it lands — by its id, once', () => {
    tutor.arm('pods')
    expect(tutor.activeLesson.value).toBe('pods')
    tutor.complete('pods')
    expect(tutor.isTaught('pods')).toBe(true)
    tutor.arm('pods')
    expect(tutor.activeLesson.value).toBeNull()
  })
})

/**
 * ─── A lesson that has to come before the harm ──────────────────────────────
 *
 * The director never pre-empts: a lesson armed while another is up waits in the
 * queue. The scene makes ONE exception, for spikes — the first board that can
 * hurt the player is now 1-2, where a HUD arrow or the Fever button's lesson can
 * be mid-show when the first caterpillar walks in — using nothing but `arm` and
 * `shelve`. This pins that those two primitives are enough.
 */
describe('spikes taking the screen', () => {
  it('can displace a lesson it outranks without teaching it', () => {
    tutor.arm('fever')
    expect(tutor.activeLesson.value).toBe('fever')
    expect(outranks('spike', 'fever')).toBe(true)

    // What `armBodyLessons` does: queue spikes, then shelve what is up.
    tutor.arm('spike')
    expect(tutor.activeLesson.value).toBe('fever')
    tutor.shelve('fever')
    expect(tutor.activeLesson.value).toBe('spike')
    expect(tutor.isTaught('fever')).toBe(false)

    // …and Fever comes back once spikes are done, because the vial is still full.
    tutor.arm('fever')
    tutor.complete('spike')
    expect(tutor.activeLesson.value).toBe('fever')
  })

  it('is never displaced itself by the lessons the scene arms beside it', () => {
    for (const id of ['dodge', 'fever', 'boss', 'pods', 'quests'] as LessonId[]) {
      expect(outranks('spike', id), `spike must outrank ${id}`).toBe(true)
    }
  })
})

describe('curriculumProgress', () => {
  it('runs from nothing to everything', () => {
    expect(tutor.curriculumProgress.value).toBe(0)
    for (const id of LESSON_IDS) tutor.complete(id)
    expect(tutor.curriculumProgress.value).toBe(1)
  })
})
