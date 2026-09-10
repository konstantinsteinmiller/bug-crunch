// The locked gate PAIR — two banks the player commits to as one decision.
//
// Two banks `PAIR_GAP` apart with a passage rib down the centre line between
// them, so the door taken at the first is the lane run through the second. The
// shape already turns up past stage 42, where `beatGap` has closed enough for
// two banks to land back to back on their own; this is the deliberate, rare
// version of it for stages 8-41.
//
// What is worth pinning here is not that pairs EXIST — it is that the thing
// that makes one a decision survives the generator. Three separate mechanisms
// can quietly take that away, and each one leaves a pair that still looks
// correct on the road:
//
//   • `legalise` rule 5 grows a small add sitting beside a `-N`, which moves
//     the authored crossover (asking for `+8` at stage 22 printed `+22`);
//   • `legalise` rule 3 degrades a `×N` the stage's budget cannot pay for into
//     an add, which collapses both lanes into adds and deletes the crossover;
//   • and `bank()` lays a passage rib of its own when its counter reaches zero,
//     stacking a second rib on the first (stage 41 printed ten instead of five).
import { describe, expect, it } from 'vitest'
import {
  buildTrack, PAIR_GAP, PAIR_STAGE, PAIR_STAGE_LAST, pairOffers, maxPairs, pairChance
} from '@/game/track'
import { gateMulOpen } from '@/game/survival'

interface Leaf { op: string; value: number }
interface Bank { kind: 'gates'; y: number; leaves: Leaf[] }
interface Rocks { kind: 'rocks'; y: number; passage?: boolean }

/** Every pair on a stage, as the two banks plus the ribs between them. */
const pairsOn = (stage: number): Array<{ a: Bank; b: Bank; ribs: number }> => {
  const t = buildTrack(stage)
  const banks = t.events.filter((e): e is Bank => e.kind === 'gates')
    .slice().sort((p, q) => p.y - q.y)
  const ribs = t.events.filter((e): e is Rocks => e.kind === 'rocks' && !!e.passage)
  const out: Array<{ a: Bank; b: Bank; ribs: number }> = []
  for (let i = 1; i < banks.length; i++) {
    const a = banks[i - 1]!
    const b = banks[i]!
    if (Math.abs(b.y - a.y - PAIR_GAP) > 0.05) continue
    const between = ribs.filter((r) => r.y > a.y && r.y < b.y).length
    if (between > 0) out.push({ a, b, ribs: between })
  }
  return out
}

const STAGES = Array.from({ length: 60 }, (_, i) => i + 2)

describe('the locked gate pair', () => {
  const found = STAGES.flatMap((stage) => pairsOn(stage).map((p) => ({ stage, ...p })))

  it('exists, and is rare', () => {
    // Rare is the feature, so it is worth an assertion rather than a comment:
    // common enough that a player meets one, uncommon enough that it stays a
    // spike. Six of the 34 eligible stages at the shipped `pairChance`.
    const eligible = STAGES.filter((s) => s >= PAIR_STAGE && s <= PAIR_STAGE_LAST)
    const withPair = new Set(found.map((p) => p.stage))
    expect(withPair.size, 'no stage prints a pair at all').toBeGreaterThanOrEqual(3)
    expect(withPair.size / eligible.length, 'pairs have become the road, not a spike')
      .toBeLessThan(0.35)
  })

  it('never lands outside the stage range it is scoped to', () => {
    for (const p of found) {
      expect(p.stage, `stage ${p.stage} printed a pair`).toBeGreaterThanOrEqual(PAIR_STAGE)
      expect(p.stage, `stage ${p.stage} printed a pair`).toBeLessThanOrEqual(PAIR_STAGE_LAST)
    }
    for (const stage of [PAIR_STAGE - 1, PAIR_STAGE_LAST + 1, PAIR_STAGE_LAST + 5]) {
      expect(pairChance(stage), `stage ${stage} may roll a pair`).toBe(0)
      expect(maxPairs(stage), `stage ${stage} may hold a pair`).toBe(0)
    }
  })

  it('never prints two on one stage', () => {
    const perStage = new Map<number, number>()
    for (const p of found) perStage.set(p.stage, (perStage.get(p.stage) ?? 0) + 1)
    for (const [stage, n] of perStage) {
      expect(n, `stage ${stage} printed ${n} pairs`).toBeLessThanOrEqual(maxPairs(stage))
    }
  })

  it('walls the gap with exactly ONE rib', () => {
    // `bank()` lays its own rib when its passage counter runs out. If the pair
    // does not hold that counter off, a second rib lands on the same centre
    // line — same x, same few units of road, drawn twice.
    for (const p of found) {
      const span = PAIR_GAP - 0.6
      const most = Math.ceil(span / 0.9) + 1
      expect(p.ribs, `stage ${p.stage} stacked ${p.ribs} ribs in one gap`).toBeLessThanOrEqual(most)
      expect(p.ribs, `stage ${p.stage} left the gap open`).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps both lanes intact — a bill then a multiplier, against two adds', () => {
    for (const p of found) {
      // Four doors across the two banks: the gamble lane's `-S` and `×2`, and
      // the steady lane's two adds.
      const ops = [...p.a.leaves, ...p.b.leaves].map((l) => l.op).sort()
      expect(ops, `stage ${p.stage} lanes: ${JSON.stringify(ops)}`)
        .toEqual(['add', 'add', 'mul', 'sub'].sort())
      expect(p.a.leaves.some((l) => l.op === 'add'), `stage ${p.stage}`).toBe(true)
      // The multiplier is the whole gamble lane. If the stage's budget could not
      // pay for it, both lanes are adds and the pair has no crossover left.
      expect(p.b.leaves.some((l) => l.op === 'mul'), `stage ${p.stage} lost its multiplier`)
        .toBe(true)
    }
  })

  it('prints the values it authored, unrewritten', () => {
    // The failure this catches is silent: `legalise` grows a small add beside a
    // hostile door, the pair still looks fine, and the crossover has moved.
    for (const p of found) {
      const o = pairOffers(p.stage)
      const bill = [...p.a.leaves, ...p.b.leaves].find((l) => l.op === 'sub')
      const mul = [...p.a.leaves, ...p.b.leaves].find((l) => l.op === 'mul')
      const adds = [...p.a.leaves, ...p.b.leaves].filter((l) => l.op === 'add')
        .map((l) => l.value).sort((x, y) => y - x)
      expect(bill?.value, `stage ${p.stage} bill`).toBe(o.bill)
      expect(mul?.value, `stage ${p.stage} multiplier`).toBe(gateMulOpen(o.mul))
      expect(adds, `stage ${p.stage} adds`).toEqual([o.first, o.second].sort((x, y) => y - x))
    }
  })

  it('is a real decision: the better lane depends on the squad', () => {
    // The point of the whole feature. If the gamble lane wins at every squad
    // size the pair is a reading test, and if it loses at every size it is a
    // trap wearing two doors.
    for (let stage = PAIR_STAGE; stage <= PAIR_STAGE_LAST; stage++) {
      const o = pairOffers(stage)
      const gamble = (c: number): number => (c - o.bill) * o.mul
      const steady = (c: number): number => c + o.first + o.second
      const small = Math.max(1, Math.round(o.crossover * 0.5))
      const large = Math.round(o.crossover * 2)
      expect(steady(small), `stage ${stage}: gamble already wins at ${small}`)
        .toBeGreaterThan(gamble(small))
      expect(gamble(large), `stage ${stage}: gamble never wins, even at ${large}`)
        .toBeGreaterThan(steady(large))
      expect(o.crossover, `stage ${stage} crossover`).toBe(2 * o.bill + o.first + o.second)
    }
  })

  it('puts the bigger add on the bank that carries the bill', () => {
    // Not cosmetic: `legalise` rule 5 only inspects a bank holding a hostile
    // door, and it grows any add there that scores under `gateAddBase`. Putting
    // the larger add on that bank is what keeps the rule from rewriting it —
    // see `pairOffers`.
    for (const p of found) {
      const billBank = p.a.leaves.some((l) => l.op === 'sub') ? p.a : p.b
      const otherBank = billBank === p.a ? p.b : p.a
      const onBill = billBank.leaves.find((l) => l.op === 'add')!.value
      const onOther = otherBank.leaves.find((l) => l.op === 'add')!.value
      expect(onBill, `stage ${p.stage}: ${onBill} beside the bill vs ${onOther}`)
        .toBeGreaterThan(onOther)
    }
  })

  it('leaves the stage a multiplier for the rest of the road', () => {
    // A pair that spends the last `mulLeft` makes the next three-leaf bank
    // print `add | add | add`, which is not three different questions. Assert
    // the consequence rather than the counter: no triple anywhere is all-adds.
    for (const stage of STAGES) {
      const t = buildTrack(stage)
      for (const e of t.events) {
        if (e.kind !== 'gates' || e.leaves.length < 3) continue
        const kinds = new Set(e.leaves.map((l) => l.op))
        expect(kinds.size, `stage ${stage} @${e.y}: ${e.leaves.map((l) => l.op).join('|')}`)
          .toBeGreaterThanOrEqual(2)
      }
    }
  })
})
