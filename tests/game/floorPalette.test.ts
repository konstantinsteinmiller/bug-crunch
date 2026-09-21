import { describe, expect, it } from 'vitest'
import {
  BUG_BROWNS, BUG_INK, FLOORS, FLOOR_IDS, FLOOR_PALETTE, INK_CONTRAST_MAX, INK_CONTRAST_MIN,
  LUMA_BAND, MARK_CONTRAST_MAX, MIN_BROWN_DISTANCE, STRUCTURE_CONTRAST_MAX,
  colourDistance, contrastRatio, floorField, floorForLevel, isLeadFloor, relLuminance,
  worldOfFloor, type FloorId
} from '@/game/floors'
import { FLOOR_TILE_PX, paintFloorTile } from '@/game/floorArt'
import { LEVELS_PER_WORLD, TOTAL_LEVELS, WORLDS, WORLD_COUNT, worldOf, type WorldId } from '@/game/stages'
import { BUGS } from '@/game/bugs'

/**
 * ─── The floors are legible, and that is arithmetic ─────────────────────────
 *
 * Forty procedural floors is forty chances to draw one that eats the bugs, and
 * "it looked fine to me" does not survive a phone in sunlight. So every floor
 * states its palette as data in `floors.ts` and this file holds all forty to the
 * same three rules — the ones written out at the top of that file:
 *
 *   1. it commits to a POLARITY, and its field sits in that polarity's band;
 *   2. its own MARKS stay quieter than a body;
 *   3. it is not the colour of the thing walking on it.
 *
 * Nothing here rasterises a canvas. The palette is the contract: `floorArt.ts`
 * paints from it, which is what makes checking the numbers the same as checking
 * the picture. The contract has exactly two carve-outs, both stated at the top
 * of that file — neutral highlight and shadow at low alpha, and the small tuft
 * of a second material growing on a floor (moss in a joint, clover in a lawn).
 * Neither can move the field a body is read against.
 *
 * The margins are printed beside each assertion on purpose. They are what an
 * author needs when a new floor fails: how much room the tightest floor the
 * game already ships has, and therefore how much of a change is a tweak and how
 * much of one is a different floor.
 */

const WORLD_IDS: WorldId[] = [1, 2, 3, 4]

/** The four tiles the game shipped with, which every threshold was set from. */
const LEAD: Record<WorldId, FloorId> = {
  1: 'picnic-gingham', 2: 'yard-lawn', 3: 'attic-boards', 4: 'arcade-grid'
}

describe('a floor per level', () => {
  it('is forty distinct floors, ten to a world', () => {
    expect(FLOOR_IDS).toHaveLength(TOTAL_LEVELS)
    expect(new Set(FLOOR_IDS).size).toBe(TOTAL_LEVELS)
    for (const w of WORLD_IDS) expect(FLOORS[w]).toHaveLength(LEVELS_PER_WORLD)
    expect(WORLD_COUNT * LEVELS_PER_WORLD).toBe(TOTAL_LEVELS)
  })

  it('gives every level its own floor, and every floor a level', () => {
    const seen = new Set<FloorId>()
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      const id = floorForLevel(n)
      expect(FLOOR_PALETTE[id]).toBeDefined()
      expect(seen.has(id)).toBe(false)
      seen.add(id)
      // A floor never leaves its world: the ten levels of a world are ten
      // surfaces of the SAME place, which is the whole grouping rule.
      expect(worldOfFloor(id)).toBe(worldOf(n))
    }
    expect(seen.size).toBe(TOTAL_LEVELS)
  })

  it('is total — anything off the campaign clamps onto it', () => {
    expect(floorForLevel(0)).toBe(floorForLevel(1))
    expect(floorForLevel(-99)).toBe(floorForLevel(1))
    expect(floorForLevel(TOTAL_LEVELS + 500)).toBe(floorForLevel(TOTAL_LEVELS))
    expect(floorForLevel(Number.NaN)).toBe(floorForLevel(1))
    expect(floorForLevel(7.8)).toBe(floorForLevel(7))
  })

  it('keeps each world opening on the tile it shipped with', () => {
    // Nothing regresses: 1-1 is still the gingham blanket, palette untouched,
    // and it is still the one the art pipeline has a painting of.
    for (const w of WORLD_IDS) {
      const id = LEAD[w]
      expect(floorForLevel((w - 1) * LEVELS_PER_WORLD + 1)).toBe(id)
      expect(isLeadFloor(id)).toBe(true)
      const p = FLOOR_PALETTE[id]
      const f = WORLDS[w].floor
      expect([p.base, p.alt, p.line, p.shade]).toEqual([f.base, f.alt, f.line, f.shade])
    }
    // …and no other floor claims a painting that does not exist.
    expect(FLOOR_IDS.filter(isLeadFloor)).toEqual(WORLD_IDS.map((w) => LEAD[w]))
  })
})

describe('colour maths', () => {
  it('is the WCAG arithmetic, not an approximation of it', () => {
    expect(relLuminance('#000000')).toBeCloseTo(0, 6)
    expect(relLuminance('#ffffff')).toBeCloseTo(1, 6)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 4)
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 6)
    // Order must not matter, or half the assertions below would be luck.
    expect(contrastRatio('#e8534f', '#fdf4ea')).toBeCloseTo(contrastRatio('#fdf4ea', '#e8534f'), 9)
  })

  it('rejects a malformed colour rather than reading it as black', () => {
    expect(() => relLuminance('#fff')).toThrow()
    expect(() => relLuminance('rgba(0,0,0,0.5)')).toThrow()
    expect(() => colourDistance('#000000', 'transparent')).toThrow()
  })

  it('measures distance perceptually enough to separate a brown from a green', () => {
    expect(colourDistance('#8c3a24', '#8c3a24')).toBe(0)
    // Same luminance, different colour: luminance alone would call these equal.
    expect(relLuminance('#7a5a3c')).toBeCloseTo(relLuminance('#3c7a5a'), 1)
    expect(colourDistance('#7a5a3c', '#3c7a5a')).toBeGreaterThan(MIN_BROWN_DISTANCE)
  })
})

describe('the bug palette the floors are held against', () => {
  it('finds the browns by hue rather than by hand', () => {
    // If somebody re-colours the ant, the rule follows it. If the derivation
    // ever returns nothing, every distance assertion below becomes vacuous —
    // which is exactly how a legibility test quietly stops testing anything.
    expect(BUG_BROWNS.length).toBeGreaterThanOrEqual(4)
    const ant = BUGS.find((b) => b.id === 'ant')!
    const centipede = BUGS.find((b) => b.id === 'centipede')!
    expect(BUG_BROWNS).toContain(ant.body)
    expect(BUG_BROWNS).toContain(ant.shade)
    expect(BUG_BROWNS).toContain(centipede.body)
    expect(BUG_BROWNS).toContain(centipede.shade)
    // …and never a bright accent, which is the one thing that must stay loud.
    for (const b of BUGS) expect(BUG_BROWNS).not.toContain(b.accent)
  })

  it('states the outline colour the drawer actually inks with', () => {
    // `bugArt.ts` keeps `INK` private; this is the copy the policy is written
    // against, and a warm near-black is what both bands are measured from.
    expect(relLuminance(BUG_INK)).toBeLessThan(0.02)
    expect(LUMA_BAND.dark[1]).toBeLessThan(LUMA_BAND.light[0])
  })
})

describe('every floor commits to a polarity', () => {
  it.each(FLOOR_IDS)('%s sits in its own luminance band', (id) => {
    const p = FLOOR_PALETTE[id]
    const l = relLuminance(floorField(id))
    const [lo, hi] = LUMA_BAND[p.key]
    expect(l).toBeGreaterThanOrEqual(lo)
    expect(l).toBeLessThanOrEqual(hi)
  })

  it.each(FLOOR_IDS)('%s lets the bug outline either silhouette or vanish', (id) => {
    const p = FLOOR_PALETTE[id]
    const c = contrastRatio(floorField(id), BUG_INK)
    if (p.key === 'light') {
      // A dark body is read by its outline. Thinnest in the game: the attic's
      // own boards at 2.58, against a floor of 2.4.
      expect(c).toBeGreaterThanOrEqual(INK_CONTRAST_MIN)
    } else {
      // A lit body is read by its fill, and a half-visible outline would be the
      // mud case. The arcade's grid is at 1.07, against a ceiling of 1.4.
      expect(c).toBeLessThanOrEqual(INK_CONTRAST_MAX)
    }
  })

  it('leaves nothing in the mud between the two bands', () => {
    for (const id of FLOOR_IDS) {
      const l = relLuminance(floorField(id))
      const inMud = l > LUMA_BAND.dark[1] && l < LUMA_BAND.light[0]
      expect(inMud, `${id} is in the mud at ${l.toFixed(3)}`).toBe(false)
    }
  })

  it('keeps a world on one polarity, so a world reads as one light', () => {
    for (const w of WORLD_IDS) {
      const keys = new Set(FLOORS[w].map((id) => FLOOR_PALETTE[id].key))
      expect(keys.size).toBe(1)
    }
    // And the arcade is the dark one — the only place in the game where the
    // bugs are the bright things.
    expect(FLOOR_PALETTE['arcade-grid'].key).toBe('dark')
    expect(FLOOR_PALETTE['picnic-gingham'].key).toBe('light')
  })
})

describe("a floor's own texture never reads as a bug", () => {
  it.each(FLOOR_IDS)('%s keeps its marks under the ceiling', (id) => {
    const p = FLOOR_PALETTE[id]
    const field = floorField(id)
    // `base` is included even when it is not the field: on a blended tile (the
    // gingham, the napkin) the flood fill shows through as a mark of its own.
    for (const [name, hex] of [['base', p.base], ['alt', p.alt], ['shade', p.shade]] as const) {
      const c = contrastRatio(field, hex)
      expect(c, `${id}.${name} at ${c.toFixed(2)}`).toBeLessThanOrEqual(MARK_CONTRAST_MAX)
    }
  })

  it.each(FLOOR_IDS)('%s only lets a full-tile structure shout', (id) => {
    const p = FLOOR_PALETTE[id]
    const c = contrastRatio(floorField(id), p.line)
    const ceiling = p.structure ? STRUCTURE_CONTRAST_MAX : MARK_CONTRAST_MAX
    expect(c, `${id}.line at ${c.toFixed(2)}`).toBeLessThanOrEqual(ceiling)
  })

  it('does not hand the exemption out for free', () => {
    // A floor may only declare `structure` when it needs it: a dim line that
    // clears the ordinary ceiling has no business claiming to be a grid, and
    // the flag would then be a comment rather than a contract.
    for (const id of FLOOR_IDS) {
      const p = FLOOR_PALETTE[id]
      if (!p.structure) continue
      const c = contrastRatio(floorField(id), p.line)
      expect(c, `${id} declares structure it does not need`).toBeGreaterThan(MARK_CONTRAST_MAX)
    }
    // The exemption is never a licence for a compact mark.
    for (const id of FLOOR_IDS) {
      const p = FLOOR_PALETTE[id]
      for (const hex of [p.base, p.alt, p.shade]) {
        expect(contrastRatio(floorField(id), hex)).toBeLessThanOrEqual(MARK_CONTRAST_MAX)
      }
    }
  })
})

describe('no floor is the colour of what walks on it', () => {
  it.each(FLOOR_IDS)('%s stays clear of the bug palette browns', (id) => {
    const field = floorField(id)
    for (const brown of BUG_BROWNS) {
      const d = colourDistance(field, brown)
      expect(d, `${id} is ${d.toFixed(1)} from ${brown}`).toBeGreaterThanOrEqual(MIN_BROWN_DISTANCE)
    }
  })

  it('is a rule the shipped attic only just clears', () => {
    // The tightest call in the game, and the reason the other nine attic floors
    // are dust, slate, plaster and tin rather than nine more browns.
    const ant = BUGS.find((b) => b.id === 'ant')!
    const d = colourDistance(floorField('attic-boards'), ant.body)
    expect(d).toBeGreaterThanOrEqual(MIN_BROWN_DISTANCE)
    expect(d).toBeLessThan(90)
  })
})

describe('the palette is well formed', () => {
  it.each(FLOOR_IDS)('%s states four colours and no duplicates', (id) => {
    const p = FLOOR_PALETTE[id]
    const four = [p.base, p.alt, p.line, p.shade]
    for (const hex of four) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(new Set(four).size).toBe(4)
    if (p.field !== undefined) expect(p.field).toMatch(/^#[0-9a-f]{6}$/)
  })

  it.each(FLOOR_IDS)('%s is lit the way its polarity says', (id) => {
    const p = FLOOR_PALETTE[id]
    // `line` is the bright mark and `shade` the dark one, on every floor, so a
    // painter can reach for either without checking which world it is in.
    expect(relLuminance(p.line)).toBeGreaterThan(relLuminance(p.shade))
    expect(relLuminance(p.shade)).toBeLessThanOrEqual(relLuminance(floorField(id)))
  })

  it('only states a blended field where the painter actually blends', () => {
    // Two floors in the game have no single flood fill — the two checks. Every
    // other `field` would be a number nobody maintains.
    const blended = FLOOR_IDS.filter((id) => FLOOR_PALETTE[id].field !== undefined)
    expect(blended).toEqual(['picnic-gingham', 'picnic-napkin'])
  })
})

/**
 * ─── …and all forty of them actually paint ──────────────────────────────────
 *
 * Still no raster. This is a RECORDING stub of the 2D context — every call is
 * counted and nothing is drawn — which answers the two questions a palette
 * cannot: does the painter run at all, and does it cover the tile.
 *
 * It is worth the forty lines because a procedural floor fails silently. A typo
 * in a painter that world 3 alone reaches is a level nobody looks at until a
 * player does, and a floor that forgot its flood fill is a board of transparent
 * black with bugs on it.
 */
interface Recorder {
  ctx: CanvasRenderingContext2D
  calls: number
  depth: number
  minDepth: number
  /** The share of the tile a FIELD fill lands on, 0..1 — see below. */
  coverage: () => number
}

/** `[a, b, c, d, e, f]`, the canvas matrix. The stub carries one so a `fillRect`
 *  inside `stamp`'s translate or `boards`' quarter-turn lands where it really
 *  would; a coverage check on untransformed coordinates would be fiction. */
type M = [number, number, number, number, number, number]
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
]
const apply = (m: M, x: number, y: number): [number, number] =>
  [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

/** Sample points, 16 to an edge. A field fill that misses one of these leaves a
 *  16 px band of bare canvas on the board, which is the whole failure mode. */
const PROBES = 16
/** A fill only counts toward coverage if it is at least this share of the tile:
 *  a floor is covered by its FIELD, and a scatter of crumbs is not a field. */
const FIELD_SHARE = 1 / 16

const recorder = (): Recorder => {
  const hits = new Set<number>()
  const r: Recorder = {
    ctx: null as never, calls: 0, depth: 0, minDepth: 0,
    coverage: () => hits.size / (PROBES * PROBES)
  }
  let m: M = [1, 0, 0, 1, 0, 0]
  const stack: M[] = []
  const gradient = { addColorStop: () => { r.calls++ } }
  const noop = (): void => { r.calls++ }
  const ctx = {
    save: () => { r.calls++; r.depth++; stack.push([...m] as M) },
    restore: () => {
      r.calls++; r.depth--; r.minDepth = Math.min(r.minDepth, r.depth)
      m = stack.pop() ?? [1, 0, 0, 1, 0, 0]
    },
    translate: (x: number, y: number) => { r.calls++; m = mul(m, [1, 0, 0, 1, x, y]) },
    rotate: (a: number) => {
      r.calls++
      m = mul(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0])
    },
    scale: (x: number, y: number) => { r.calls++; m = mul(m, [x, 0, 0, y, 0, 0]) },
    setTransform: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, arc: noop, ellipse: noop,
    fill: noop, stroke: noop, clip: noop, clearRect: noop,
    createLinearGradient: () => { r.calls++; return gradient },
    createRadialGradient: () => { r.calls++; return gradient },
    createPattern: () => { r.calls++; return null },
    fillRect: (x: number, y: number, w: number, h: number) => {
      r.calls++
      const xs: number[] = []
      const ys: number[] = []
      for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
        const [tx, ty] = apply(m, px, py)
        xs.push(tx); ys.push(ty)
      }
      const x0 = Math.min(...xs); const x1 = Math.max(...xs)
      const y0 = Math.min(...ys); const y1 = Math.max(...ys)
      if ((x1 - x0) * (y1 - y0) < FLOOR_TILE_PX * FLOOR_TILE_PX * FIELD_SHARE) return
      const step = FLOOR_TILE_PX / PROBES
      for (let j = 0; j < PROBES; j++) {
        const sy = j * step + step / 2
        if (sy < y0 || sy > y1) continue
        for (let i = 0; i < PROBES; i++) {
          const sx = i * step + step / 2
          if (sx >= x0 && sx <= x1) hits.add(j * PROBES + i)
        }
      }
    },
    strokeRect: noop,
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    lineCap: 'butt', lineJoin: 'miter', shadowBlur: 0, shadowColor: ''
  }
  r.ctx = ctx as unknown as CanvasRenderingContext2D
  return r
}

describe('every floor actually paints', () => {
  it.each(FLOOR_IDS)('%s draws, covers the tile and balances its state', (id) => {
    const r = recorder()
    expect(() => paintFloorTile(r.ctx, id)).not.toThrow()
    // Nothing here is a token amount of drawing: the thinnest floor in the
    // game is still a flood, a texture and a detail pass.
    expect(r.calls).toBeGreaterThan(50)
    // Its FIELD reaches every corner — a flood, a wash, or a set of boards that
    // between them leave nothing — so no part of the board is bare canvas.
    expect(r.coverage()).toBe(1)
    // Every `save` got its `restore`, and no painter restored past the state it
    // was handed — which is what lets the art bench and the Peek card hand one
    // of these a context of their own.
    expect(r.depth).toBe(0)
    expect(r.minDepth).toBe(0)
  })

  it('paints a world handed instead of a floor, and paints its LEAD floor', () => {
    // `paintFloorTile(ctx, 3)` is "show me the attic" — the call the cutscenes,
    // the art bench and the reward reveal make. It must never be a crash and
    // never be a random one of the ten.
    for (const w of WORLD_IDS) {
      const byWorld = recorder()
      const byFloor = recorder()
      paintFloorTile(byWorld.ctx, w)
      paintFloorTile(byFloor.ctx, LEAD[w])
      expect(byWorld.calls).toBe(byFloor.calls)
      expect(byWorld.coverage()).toBe(byFloor.coverage())
    }
  })
})
