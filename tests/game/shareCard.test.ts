import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SHARE_CARD_PX, drawShareCard, renderShareCard, type ShareCardSpec } from '@/game/shareCardArt'
import { bakeSurvivorSlice, primeSurvivors } from '@/game/heroSprites'
import { callsOf, fingerprint, textsOf, stubCanvases, type StubCanvas } from '../ui/shareCardStub'

/**
 * ─── The card ───────────────────────────────────────────────────────────────
 *
 * What a picture LOOKS like cannot be asserted in jsdom. What can — and what
 * every bug this feature is likely to grow would show up as — is the sequence
 * of calls it makes: the numeral is the run's stage, every word on it came from
 * the caller rather than from an English literal in the renderer, the bodies
 * are the game's own baked survivor strips, the crowd is bounded however big
 * the squad was, a run with no leaderboard placing prints no placing, and the
 * same run twice is the same card twice.
 */

// A German spec, deliberately: an English one cannot tell "the renderer printed
// the caption it was given" apart from "the renderer printed its own".
const SPEC: ShareCardSpec = {
  stage: 24,
  peakSquad: 186,
  title: 'splatix',
  recordLabel: 'Neuer Rekord!',
  stageWord: 'Level',
  squadWord: 'Trupp',
  rankValue: '#1130',
  rankOf: 'von 2345'
}

let stub: { made: StubCanvas[]; restore: () => void }

// Bake the survivor strips UP FRONT, synchronously, once.
//
// Not a convenience: `primeSurvivors` schedules its bake on a timer, so whether
// `survivorFrame` answers with a strip or with null would depend on whether
// that timer happened to fire during the previous spec's `await` — and the card
// takes a different path for each, which is a suite that passes or fails by
// coincidence. Draining the queue here is also the state a real result screen
// is always in: the loading screen does not leave until every outfit is baked.
beforeAll(() => {
  const bakery = stubCanvases()
  primeSurvivors()
  bakeSurvivorSlice(5000)
  bakery.restore()
})

beforeEach(() => { stub = stubCanvases() })
afterEach(() => { stub.restore() })

/** The card's own surface, picked by its size rather than its order — the
 *  render allocates a road tile and a banner plate alongside it. */
const card = (): StubCanvas => stub.made.find((c) => c.width === SHARE_CARD_PX)!

/** One blit per survivor. The banner plate blits too, but nine-sliced — three
 *  calls in the nine-argument form — so the five-argument ones are the crowd. */
const bodies = (c: StubCanvas): unknown[][] =>
  callsOf(c.ops, 'drawImage').filter((a) => a.length === 5)

const fresh = (spec: ShareCardSpec): StubCanvas => {
  stub.restore()
  stub = stubCanvases()
  drawShareCard(spec)
  return card()
}

describe('the card is 1080 square and drawn on its own surface', () => {
  it('allocates the square the share targets keep', () => {
    const canvas = drawShareCard(SPEC)
    expect(canvas).not.toBeNull()
    expect(SHARE_CARD_PX).toBe(1080)
    expect(card().width).toBe(1080)
    expect(card().height).toBe(1080)
  })

  it('paints on surfaces it made itself, never on the game canvas', () => {
    drawShareCard(SPEC)
    // The card, plus the road tile it bakes a pattern from. Every surface the
    // card touches is created inside the render.
    expect(stub.made.length).toBeGreaterThanOrEqual(2)
  })
})

describe('the words on the card are the caller\'s, in the caller\'s language', () => {
  it('prints the translated captions and never an English literal', () => {
    drawShareCard(SPEC)
    const printed = textsOf(card().ops)
    expect(printed).toContain('NEUER REKORD!')
    expect(printed).toContain('LEVEL')
    expect(printed).toContain('splatix')
    expect(printed).toContain('TRUPP')
    expect(printed).not.toContain('STAGE')
    expect(printed).not.toContain('SQUAD')
  })

  it('makes the stage number the loudest thing on it', () => {
    drawShareCard(SPEC)
    const ops = card().ops
    expect(textsOf(ops)).toContain('24')
    expect(textsOf(ops)).toContain('186')

    // The font is set immediately before each string is drawn, so the size a
    // string was set at is the last `set:font` before its `fillText`.
    const sizeOf = (text: string): number => {
      let px = 0
      for (const op of ops) {
        if (op.m === 'set:font') px = Number(/(\d+(?:\.\d+)?)px/.exec(String(op.a[0]))?.[1] ?? 0)
        if (op.m === 'fillText' && String(op.a[0]) === text) return px
      }
      return 0
    }
    // By a lot: at thumbnail size it is the only piece of type that survives.
    expect(sizeOf('24')).toBeGreaterThan(sizeOf('NEUER REKORD!') * 3)
    expect(sizeOf('24')).toBeGreaterThan(sizeOf('splatix') * 2)
  })
})

describe('the leaderboard line', () => {
  it('prints the placing and the population as two separate runs', () => {
    drawShareCard(SPEC)
    const printed = textsOf(card().ops)
    expect(printed).toContain('#1130')
    expect(printed).toContain('von 2345')
    // Never glued together — that would put English word order on the card.
    expect(printed.some((s) => s.includes('#1130 von'))).toBe(false)
  })

  it('prints the placing alone when the population has not landed', () => {
    drawShareCard({ ...SPEC, rankOf: '' })
    const printed = textsOf(card().ops)
    expect(printed).toContain('#1130')
    expect(printed.some((s) => s.startsWith('von'))).toBe(false)
  })

  it('prints nothing at all rather than inventing a rank', () => {
    drawShareCard({ ...SPEC, rankValue: '', rankOf: '' })
    const printed = textsOf(card().ops)
    expect(printed.some((s) => s.startsWith('#'))).toBe(false)
    // …and the rest of the card is still there.
    expect(printed).toContain('24')
    expect(printed).toContain('splatix')
  })
})

describe('the crowd', () => {
  it('is the game\'s own baked survivor strips, one blit per body', () => {
    drawShareCard({ ...SPEC, peakSquad: 12 })
    expect(bodies(card()).length).toBe(12)
    // A contact shadow under each, so nobody floats above the road.
    expect(callsOf(card().ops, 'ellipse').length).toBe(12)
  })

  it('caps itself rather than trying to draw two hundred readable bodies', () => {
    drawShareCard({ ...SPEC, peakSquad: 5000 })
    expect(bodies(card()).length).toBe(48)
  })

  it('always draws a crowd, even for a run that finished with almost nobody', () => {
    drawShareCard({ ...SPEC, peakSquad: 1 })
    expect(bodies(card()).length).toBeGreaterThanOrEqual(3)
  })

  it('makes a bigger squad a bigger mass of smaller bodies, not the same one rescaled', () => {
    const small = callsOf(fresh({ ...SPEC, peakSquad: 8 }).ops, 'ellipse').map((a) => Number(a[2]))
    const large = callsOf(fresh({ ...SPEC, peakSquad: 48 }).ops, 'ellipse').map((a) => Number(a[2]))
    expect(Math.max(...large)).toBeLessThan(Math.max(...small))
    expect(large.length).toBeGreaterThan(small.length * 3)
  })
})

describe('the same run always makes the same card', () => {
  it('has no clock and no randomness in it', () => {
    drawShareCard(SPEC)
    const first = fingerprint(card().ops)
    expect(fingerprint(fresh(SPEC).ops)).toBe(first)
  })

  it('changes when the run does', () => {
    drawShareCard(SPEC)
    const first = fingerprint(card().ops)
    expect(fingerprint(fresh({ ...SPEC, stage: 25 }).ops)).not.toBe(first)
  })
})

describe('encoding', () => {
  it('hands back a JPEG, because the card is a photograph of a gradient', async () => {
    const blob = await renderShareCard(SPEC)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob?.type).toBe('image/jpeg')
  })

  it('reports "no card" rather than throwing when there is no context to draw on', async () => {
    stub.restore()
    // A canvas with no 2D context at all — jsdom's own shape, and the shape of
    // a browser that refused the allocation.
    const real = document.createElement.bind(document)
    document.createElement = ((tag: string) => {
      if (String(tag).toLowerCase() !== 'canvas') return real(tag)
      return { width: 0, height: 0, getContext: () => null } as unknown as HTMLElement
    }) as typeof document.createElement
    try {
      expect(drawShareCard(SPEC)).toBeNull()
      await expect(renderShareCard(SPEC)).resolves.toBeNull()
    } finally {
      document.createElement = real
      stub = stubCanvases()
    }
  })
})
