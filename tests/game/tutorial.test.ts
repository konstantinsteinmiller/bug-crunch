import { beforeEach, describe, expect, it } from 'vitest'
import {
  LESSONS, LESSON_IDS, isLessonId, lessonSpec, outranks, type LessonId
} from '@/game/tutorial'
import * as tutor from '@/use/useTutorial'
import { HOLD_TO_LEARN_MS } from '@/use/useTutorial'

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
      'boss', 'stars', 'chest', 'locker', 'buy'
    ] as LessonId[]) {
      expect(LESSON_IDS).toContain(id)
    }
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

describe('curriculumProgress', () => {
  it('runs from nothing to everything', () => {
    expect(tutor.curriculumProgress.value).toBe(0)
    for (const id of LESSON_IDS) tutor.complete(id)
    expect(tutor.curriculumProgress.value).toBe(1)
  })
})
