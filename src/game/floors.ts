/**
 * ─── Forty floors ───────────────────────────────────────────────────────────
 *
 * One floor per LEVEL, not one per world. Ten picnic levels on one red blanket
 * is the same picture ten times, and a player who stays for a whole world sees
 * it for six or seven minutes — long enough that the board stops registering as
 * a place and starts registering as a background.
 *
 * So every level gets its own floor, and the ten floors of a world are ten
 * things you would find in that ONE place: the picnic is a blanket, then the
 * table it is laid on, then the paper cloth, the trodden lawn, the patio, the
 * path, the basket lid, the floured board, the decking and the napkin. The
 * world still reads as a world — it is the same afternoon, from ten angles —
 * and no two levels in a session look alike.
 *
 * This file is the DATA half: which floor a level is on, and what colours that
 * floor is made of. `floorArt.ts` is the drawing half and reads its palette
 * from here, so a colour cannot be in the painter and not in the palette.
 *
 * ── The first floor of every world is the old one ──
 *
 * `FLOORS[w][0]` is the tile that world shipped with, palette untouched (the
 * entries below spread `WORLDS[w].floor` rather than restating it). Nothing
 * regresses, the four painted tiles in `public/images/bg` still land on the
 * levels they were painted for, and the other thirty-six are new work.
 *
 * ── Why the palette is data and not just paint ──
 *
 * The bugs are small, dark, ink-outlined bodies — an ant is about 13 px across
 * on a phone, against a 256 px tile — and the whole game is finding them fast.
 * A floor that swallows them is not a style choice, it is a broken level. Three
 * things can break one, and all three are arithmetic on the palette rather than
 * taste, so all three are pinned by `tests/game/floorPalette.test.ts`:
 *
 *   1. THE POLARITY. A body reads either as a dark silhouette on a light floor
 *      (its ink outline does the work) or as a lit shape on a dark floor (its
 *      body and accent do). In between — a mid floor — it is neither, and a
 *      brown ant on a brown board disappears. Every floor must COMMIT: `key`
 *      is 'light' or 'dark', the two luminance bands do not touch, and the mud
 *      in between is closed.
 *   2. THE MARKS. The tile's own texture must stay quieter than a body, or the
 *      player's eye stops on a crumb. Every mark colour sits within a stated
 *      contrast of the field.
 *   3. THE BUG'S OWN COLOUR. A floor may not be the colour of the thing walking
 *      on it. The browns are the dangerous ones — the ant and the centipede are
 *      brown, and half of what a floor is made of (wood, wicker, card, straw) is
 *      brown too — so the distance is measured against them by name.
 */

import { BUGS } from '@/game/bugs'
import { LEVELS_PER_WORLD, WORLDS, indexOf, worldOf, type WorldId } from '@/game/stages'

// ─── The floors ─────────────────────────────────────────────────────────────

/**
 * Every floor in the game, by name.
 *
 * The prefix is the WORLD, not the theme string in `stages.ts`: a reader
 * scanning this list should be able to see at a glance that all ten picnic
 * floors are picnic-adjacent, and a typo in one is a type error rather than a
 * board that silently falls back.
 */
export type FloorId =
  // World 1 — the picnic. A bright afternoon, ten surfaces of it.
  | 'picnic-gingham' | 'picnic-planks' | 'picnic-paper' | 'picnic-grass'
  | 'picnic-patio' | 'picnic-sand' | 'picnic-wicker' | 'picnic-flour'
  | 'picnic-decking' | 'picnic-napkin'
  // World 2 — the backyard. Everything underfoot past the back door.
  | 'yard-lawn' | 'yard-clover' | 'yard-flagstone' | 'yard-gravel'
  | 'yard-straw' | 'yard-turf' | 'yard-leaves' | 'yard-brick'
  | 'yard-pond' | 'yard-greenhouse'
  // World 3 — the attic. What is stacked, spread and forgotten up there.
  | 'attic-boards' | 'attic-dustsheet' | 'attic-newsprint' | 'attic-wallpaper'
  | 'attic-insulation' | 'attic-slate' | 'attic-rug' | 'attic-cardboard'
  | 'attic-plaster' | 'attic-tin'
  // World 4 — the arcade. Ten dark surfaces lit from inside.
  | 'arcade-grid' | 'arcade-carpet' | 'arcade-circuit' | 'arcade-tile'
  | 'arcade-star' | 'arcade-dance' | 'arcade-vinyl' | 'arcade-pixel'
  | 'arcade-vent' | 'arcade-token'

/**
 * A world's ten floors, in the order its levels meet them.
 *
 * Index 0 is the world's OWN tile — the one it shipped with and the one the art
 * pipeline has a painting of. The order after that is loose, but not random: it
 * alternates soft and hard surfaces so two cloth levels never sit next to each
 * other, and it keeps the busiest textures off the levels that are already the
 * busiest boards (a world's 9th and 10th).
 */
export const FLOORS: Readonly<Record<WorldId, readonly FloorId[]>> = {
  1: [
    'picnic-gingham', 'picnic-planks', 'picnic-paper', 'picnic-grass',
    'picnic-patio', 'picnic-sand', 'picnic-wicker', 'picnic-flour',
    'picnic-decking', 'picnic-napkin'
  ],
  2: [
    'yard-lawn', 'yard-flagstone', 'yard-clover', 'yard-gravel',
    'yard-straw', 'yard-brick', 'yard-turf', 'yard-leaves',
    'yard-pond', 'yard-greenhouse'
  ],
  3: [
    'attic-boards', 'attic-dustsheet', 'attic-slate', 'attic-newsprint',
    'attic-insulation', 'attic-cardboard', 'attic-wallpaper', 'attic-tin',
    'attic-rug', 'attic-plaster'
  ],
  4: [
    'arcade-grid', 'arcade-carpet', 'arcade-circuit', 'arcade-tile',
    'arcade-star', 'arcade-vent', 'arcade-dance', 'arcade-pixel',
    'arcade-vinyl', 'arcade-token'
  ]
}

/** Every floor id, in campaign order. 1-1's first, 4-10's last. */
export const FLOOR_IDS: readonly FloorId[] = [
  ...FLOORS[1], ...FLOORS[2], ...FLOORS[3], ...FLOORS[4]
]

/**
 * Which way round a body reads on this floor.
 *
 *   light   the floor is brighter than the near-black outline every bug is
 *           inked with, so a body is a SILHOUETTE. Twenty-nine floors.
 *   dark    the floor is darker than that outline, so the outline vanishes and
 *           the body's own lit fill and accent are what carry it. The arcade,
 *           all ten of it — a neon floor is the one place in the game where the
 *           bugs are the bright things.
 *
 * There is deliberately no third value. "Mid" is the band where a dark bug on a
 * dark-ish floor is neither silhouetted nor lit, and it is where every floor
 * that has ever eaten a bug has sat.
 */
export type FloorKey = 'light' | 'dark'

export interface FloorPalette {
  /** The flood fill the tile starts from — the colour under every mark. */
  base: string
  /** The second field colour: the other plank, the other check, the shadow
   *  half of a gradient. Covers a large share of the tile. */
  alt: string
  /** The bright mark: a highlight, a blade tip, a joint, a neon rule. */
  line: string
  /** The dark mark — AND the colour `paintVignette` darkens the board's rim
   *  with, which is why it is held to the mark ceiling like everything else.
   *  A shade too far under the field turns the rim into a place bugs vanish. */
  shade: string
  /**
   * What the finished tile READS as from arm's length.
   *
   * Left out on every floor that is a flood fill with marks on top — there it
   * IS `base`, and repeating it would be one more number that can go stale.
   * Stated only where the tile has no single flood fill: a gingham check is a
   * quarter cream, a half mid and a quarter dark, and `base` is none of those.
   * This is the colour the legibility test judges, so an author who changes a
   * blended painter must change this with it.
   */
  field?: string
  key: FloorKey
  /**
   * `line` on this floor is STRUCTURE — a rule, a grid, a joint, a trace — that
   * crosses the whole tile, never a compact mark.
   *
   * It buys an exemption from the mark ceiling, and it is geometry that earns
   * it: a bug is ~13 px across on a phone against a 256 px tile, so a line that
   * runs the full 256 cannot be mistaken for one however bright it is. That is
   * how the arcade keeps its neon. Nothing declares this to get away with a
   * bright BLOB — the exemption covers `line` only, and `alt` and `shade` are
   * bound on every floor.
   */
  structure?: boolean
}

/** The four world tiles, restated from `stages.ts` rather than copied, so the
 *  lead floor of a world and the world's own palette can never drift apart. */
const worldFloor = (w: WorldId): Pick<FloorPalette, 'base' | 'alt' | 'line' | 'shade'> => {
  const f = WORLDS[w].floor
  return { base: f.base, alt: f.alt, line: f.line, shade: f.shade }
}

/**
 * Every floor's colours.
 *
 * Read top to bottom it is also the art direction: world 1 is bleached and
 * warm, world 2 is green going dry, world 3 is dusty and desaturated (the
 * attic's dark comes from its AMBIENT wash, not from its floors — a wash falls
 * on the bugs too and keeps the contrast, where a dark floor alone would eat
 * them), and world 4 is ten kinds of near-black with something lit in it.
 */
export const FLOOR_PALETTE: Readonly<Record<FloorId, FloorPalette>> = {
  // ═══ World 1 — the picnic ═════════════════════════════════════════════════
  // The red gingham blanket the game opens on. `base` is the stripe colour, not
  // the field: the check is two 55 % stripe passes over cream, so the tile is a
  // quarter cream, a half mid (#f19b95) and a quarter double (#ec746e), and the
  // area-weighted read is the mid.
  'picnic-gingham': { ...worldFloor(1), field: '#f19b95', key: 'light' },
  // The picnic TABLE with the blanket off it — sun-bleached pine boards laid
  // the short way, knots and all.
  'picnic-planks': {
    base: '#e3cba4', alt: '#d8bc93', line: '#f2e3c6', shade: '#a88a5e', key: 'light'
  },
  // The paper tablecloth from the shop: soft creases, a faint printed dot, and
  // the cheapest floor in the game to read a bug on.
  'picnic-paper': {
    base: '#f4eee0', alt: '#e9e1cd', line: '#ffffff', shade: '#cfc4ab', key: 'light'
  },
  // The lawn the blanket was on, trodden flat and sun-dried — yellow-green on
  // purpose, and a long way from the caterpillar's green.
  'picnic-grass': {
    base: '#bcc47e', alt: '#aab86e', line: '#d5d99e', shade: '#7e8a4c', key: 'light'
  },
  // Patio slabs, pale sandstone, with a sandy joint between them.
  'picnic-patio': {
    base: '#ddd6c8', alt: '#d2cabb', line: '#eae4d8', shade: '#a49b8a', key: 'light'
  },
  // The sandy path down to the table: grit, a few pebbles and a rake's drift.
  'picnic-sand': {
    base: '#e8d6ae', alt: '#dcc79a', line: '#f3e7c8', shade: '#b49a6c', key: 'light'
  },
  // The picnic basket's lid, seen from above: over-under cane.
  'picnic-wicker': {
    base: '#dcbb85', alt: '#c9a46c', line: '#eed6a8', shade: '#a9844f', key: 'light'
  },
  // The board the sandwiches were cut on, still floured — white dust drifted
  // over pale wood, and a couple of knife marks through it.
  'picnic-flour': {
    base: '#ece2cf', alt: '#ded0b6', line: '#ffffff', shade: '#b3a488', key: 'light'
  },
  // Garden decking: grooved slats with a dark gap between them.
  'picnic-decking': {
    base: '#c9c0ac', alt: '#bcb29c', line: '#dbd4c3', shade: '#8e8571', key: 'light'
  },
  // The chequered napkin — the blanket's check again, finer and blue, so the
  // world's last floor rhymes with its first. Blended field, like the gingham.
  'picnic-napkin': {
    base: '#5b7fa8', alt: '#f4f1e6', line: '#ffffff', shade: '#5a7a99',
    field: '#a0b2c4', key: 'light'
  },

  // ═══ World 2 — the backyard ═══════════════════════════════════════════════
  // The overgrown lawn the world shipped with.
  'yard-lawn': { ...worldFloor(2), key: 'light' },
  // Flagstones with moss creeping the joints — the hard surface between the
  // world's two grass levels.
  'yard-flagstone': {
    base: '#b6b9ab', alt: '#a8ac9d', line: '#cdd0c2', shade: '#7c8073', key: 'light'
  },
  // A clover carpet: trefoils packed over short turf, and the odd four-leaf.
  'yard-clover': {
    base: '#5a9c46', alt: '#4b8a3a', line: '#86c470', shade: '#33602a', key: 'light'
  },
  // The pea-gravel path round the side of the house.
  'yard-gravel': {
    base: '#c2bcae', alt: '#b2ab9c', line: '#dcd7cb', shade: '#8a8572', key: 'light'
  },
  // Straw mulch over the vegetable bed: long dry stems, crossed every way.
  'yard-straw': {
    base: '#d8c48a', alt: '#c9b177', line: '#ebdcae', shade: '#9b8654', key: 'light'
  },
  // Sun-bleached brick pavers, laid herringbone.
  'yard-brick': {
    base: '#cbaa8e', alt: '#bb9a7e', line: '#e0c4ac', shade: '#95795f', key: 'light'
  },
  // Artificial turf. Machine-even tufts in ruled rows, which is exactly what
  // makes it read as fake next to the lawn six levels earlier.
  'yard-turf': {
    base: '#57a865', alt: '#499457', line: '#7cc588', shade: '#356b40', key: 'light'
  },
  // A drift of fallen leaves, gone pale and dry.
  'yard-leaves': {
    base: '#c9a96f', alt: '#b8945c', line: '#ddc48e', shade: '#96784a', key: 'light'
  },
  // The shallow edge of the pond: lily pads and ripple rings on bright water.
  'yard-pond': {
    base: '#86bdb8', alt: '#74aba9', line: '#b5ded8', shade: '#5b8a88', key: 'light'
  },
  // The greenhouse roof from inside: whitewashed panes, condensation, a lead
  // grid. The world's last floor and its brightest — a boss reads on it.
  'yard-greenhouse': {
    base: '#cfdcd2', alt: '#c0cec4', line: '#eef4ee', shade: '#94a298', key: 'light'
  },

  // ═══ World 3 — the attic ══════════════════════════════════════════════════
  // The wide floorboards the world shipped with.
  'attic-boards': { ...worldFloor(3), key: 'light' },
  // A dust sheet thrown over whatever is under it: folds, and a grey bloom
  // where the light from the skylight lands.
  'attic-dustsheet': {
    base: '#c3bdb0', alt: '#b3ad9f', line: '#dbd6cb', shade: '#8a847a', key: 'light'
  },
  // The chimney's slate hearth, split into cold grey slabs.
  'attic-slate': {
    base: '#8d9298', alt: '#7e838a', line: '#a8aeb4', shade: '#5b6066', key: 'light'
  },
  // Stacked yellowed newspaper, columns of grey type gone unreadable.
  'attic-newsprint': {
    base: '#d5cdb8', alt: '#c6bda7', line: '#e8e2d2', shade: '#99917e', key: 'light'
  },
  // Loft insulation batts, pink and fibrous, laid between the joists.
  'attic-insulation': {
    base: '#dfb0ab', alt: '#cf9e99', line: '#eec8c4', shade: '#a1756f', key: 'light'
  },
  // Flattened cardboard boxes: flutes, a fold, and a strip of old tape.
  'attic-cardboard': {
    base: '#c7a87c', alt: '#b8986c', line: '#ddc29a', shade: '#977c58', key: 'light'
  },
  // A roll of faded rose wallpaper, unrolled across the boards.
  'attic-wallpaper': {
    base: '#c2a9ae', alt: '#b3989e', line: '#d9c5c8', shade: '#8a7378', key: 'light'
  },
  // A sheet of dull galvanised tin, rivets and a dent in it.
  'attic-tin': {
    base: '#a3a8ab', alt: '#93989b', line: '#c2c7ca', shade: '#6d7275', key: 'light'
  },
  // A moth-eaten wool rug — worn pile, and holes the world's own moths made.
  'attic-rug': {
    base: '#b39c86', alt: '#a28b76', line: '#c9b6a4', shade: '#82705d', key: 'light'
  },
  // Bare plaster over lath, chalky and hairline-cracked. The brightest floor up
  // here, under the world's heaviest ambient wash.
  'attic-plaster': {
    base: '#d2cabb', alt: '#c3bbab', line: '#e8e2d6', shade: '#968f80', key: 'light'
  },

  // ═══ World 4 — the arcade ═════════════════════════════════════════════════
  //
  // All ten are `dark`, and that is the world's whole identity: the floor is the
  // unlit thing and everything on it glows. The bright marks are `structure` —
  // rules, traces, joints, slots — which is both what an arcade floor is made of
  // and what keeps a bright mark from reading as a body.
  //
  // The neon grid the world shipped with.
  'arcade-grid': { ...worldFloor(4), key: 'dark', structure: true },
  // Black-light bowling carpet: navy, with confetti splodges kept deliberately
  // dim. Compact marks, so no `structure` — they live under the mark ceiling.
  'arcade-carpet': {
    base: '#14122b', alt: '#0e0c20', line: '#332e5c', shade: '#070616', key: 'dark'
  },
  // The inside of the machine: a circuit board, traces running pad to pad.
  'arcade-circuit': {
    base: '#0d1a16', alt: '#091310', line: '#2fd08a', shade: '#050b09',
    key: 'dark', structure: true
  },
  // Dark chequered lino, two near-blacks, buffed to a shine.
  'arcade-tile': {
    base: '#16162a', alt: '#0f0f1f', line: '#2f2f50', shade: '#080814', key: 'dark'
  },
  // A cabinet's attract-mode starfield, projected onto the floor.
  'arcade-star': {
    base: '#0b0d1f', alt: '#070917', line: '#252c4e', shade: '#040510', key: 'dark'
  },
  // A steel floor vent: perforated plate, slots running its length.
  'arcade-vent': {
    base: '#14161c', alt: '#0e1014', line: '#7d8a9c', shade: '#07080b',
    key: 'dark', structure: true
  },
  // The dance pad: four lit arrow panels per tile, chevrons the size of a cell.
  'arcade-dance': {
    base: '#121229', alt: '#0c0c1e', line: '#ff40a0', shade: '#06060f',
    key: 'dark', structure: true
  },
  // A low-res pixel mosaic, dark cells with a scanning row lit through them.
  'arcade-pixel': {
    base: '#101a2c', alt: '#0a1220', line: '#3de0ff', shade: '#060a12',
    key: 'dark', structure: true
  },
  // The vinyl down the side of a cabinet, pinstriped with its own decal.
  'arcade-vinyl': {
    base: '#191426', alt: '#120f1c', line: '#8a5cff', shade: '#0a0813',
    key: 'dark', structure: true
  },
  // Spilled tokens on black rubber matting. The last floor in the game, and the
  // only warm one in the arcade — the coins are what the player has been paid.
  'arcade-token': {
    base: '#131217', alt: '#0d0c10', line: '#33302c', shade: '#070609', key: 'dark'
  }
}

/**
 * What each floor IS, in one phrase — the subject a painter is given.
 *
 * ── Why this is data and not a comment ──
 *
 * Every line below was a comment above its palette entry, which was fine while
 * the only reader was a person deciding what to draw. The art pipeline made it
 * a second reader's input: `artSheet.ts` composes a prompt from this phrase and
 * the palette beside it, so a floor whose description and colours disagree
 * produces a painting that fails its own legibility rule. As a `Record<FloorId,
 * string>` the two are edited in one place and a new floor cannot be added
 * without saying what it is.
 *
 * Written as the tail of "a seamless tile of ___ seen from directly above", so
 * they are noun phrases and none of them carries a colour: the colours come
 * from `FLOOR_PALETTE`, which is the thing the legibility test judges. A phrase
 * that names a colour here is a phrase that can contradict the palette.
 */
export const FLOOR_SUBJECT: Readonly<Record<FloorId, string>> = {
  // ── World 1 — the picnic ──
  'picnic-gingham': 'a gingham picnic blanket, a four-by-four check of woven'
    + ' squares with a visible fabric weave and a few tiny stray crumbs',
  'picnic-planks': 'the picnic table with the blanket off it — sun-bleached pine'
    + ' boards laid the short way, knots and all',
  'picnic-paper': 'a paper tablecloth with soft creases and a faint printed dot',
  'picnic-grass': 'lawn trodden flat and sun-dried',
  'picnic-patio': 'sandstone patio slabs with a sandy joint between them',
  'picnic-sand': 'a sandy path — grit, a few pebbles and the drift left by a rake',
  'picnic-wicker': "the picnic basket's lid, over-under cane",
  'picnic-flour': 'a floured chopping board — dust drifted over pale wood with a'
    + ' couple of knife marks through it',
  'picnic-decking': 'garden decking, grooved slats with a gap between them',
  'picnic-napkin': 'a chequered napkin, the blanket’s check again but finer',

  // ── World 2 — the backyard ──
  'yard-lawn': 'mown garden grass, dense short blades leaning in slightly'
    + ' different directions with a few clover leaves and dappled light',
  'yard-flagstone': 'flagstones with moss creeping along the joints',
  'yard-clover': 'a clover carpet, trefoils packed over short turf and the odd'
    + ' four-leaf',
  'yard-gravel': 'a pea-gravel path',
  'yard-straw': 'straw mulch over a vegetable bed, long dry stems crossed every way',
  'yard-brick': 'brick pavers laid herringbone',
  'yard-turf': 'artificial turf, machine-even tufts in ruled rows',
  'yard-leaves': 'a drift of fallen leaves gone dry',
  'yard-pond': 'the shallow edge of a pond, lily pads and ripple rings on water',
  'yard-greenhouse': 'a greenhouse roof seen from inside — whitewashed panes,'
    + ' condensation and a lead grid',

  // ── World 3 — the attic ──
  'attic-boards': 'wide worn attic floorboards running left to right with a seam'
    + ' between them, visible wood grain, small nail heads and a scatter of dust',
  'attic-dustsheet': 'a dust sheet thrown over whatever is under it — folds, and a'
    + ' bloom where the skylight lands',
  'attic-slate': 'a slate hearth split into cold slabs',
  'attic-newsprint': 'stacked yellowed newspaper, columns of type gone unreadable',
  'attic-insulation': 'loft insulation batts, fibrous, laid between the joists',
  'attic-cardboard': 'flattened cardboard boxes — flutes, a fold and a strip of old tape',
  'attic-wallpaper': 'a roll of faded rose wallpaper unrolled across the boards',
  'attic-tin': 'a sheet of dull galvanised tin with rivets and a dent in it',
  'attic-rug': 'a moth-eaten wool rug, worn pile with holes in it',
  'attic-plaster': 'bare plaster over lath, chalky and hairline-cracked',

  // ── World 4 — the arcade ──
  'arcade-grid': 'an arcade floor of dark lino divided by glowing grid lines into'
    + ' four-by-four cells, with faint horizontal scanlines and one soft glow'
    + ' pooling in a cell',
  'arcade-carpet': 'a bowling carpet under ultraviolet light, with dim confetti splodges',
  'arcade-circuit': 'the inside of the machine — a circuit board with traces'
    + ' running pad to pad',
  'arcade-tile': 'chequered lino in two close tones, buffed to a shine',
  'arcade-star': "a cabinet's attract-mode starfield projected down onto the floor",
  'arcade-vent': 'a steel floor vent, perforated plate with slots running its length',
  'arcade-dance': 'a dance pad, four lit arrow panels per tile with chevrons the'
    + ' size of a cell',
  'arcade-pixel': 'a low-res pixel mosaic, dark cells with a scanning row lit'
    + ' through them',
  'arcade-vinyl': 'the vinyl down the side of a cabinet, pinstriped with its own decal',
  'arcade-token': 'spilled tokens on rubber matting'
}

// ─── Which floor a level is on ──────────────────────────────────────────────

/**
 * The floor for a level, 1..40. Pure and total, like `levelSpec`: any number in,
 * a real floor out, and the same floor for everybody on 3-7 with no seed.
 *
 * Levels outside the campaign clamp, which is what keeps a party (`partySpec`
 * borrows the level it follows) and a cutscene on the floor they belong on.
 */
export const floorForLevel = (level: number): FloorId => {
  const world = worldOf(level)
  const ten = FLOORS[world]
  // `indexOf` is 1-based and `LEVELS_PER_WORLD` long; the modulo is belt and
  // braces for a world list that is ever shorter than ten.
  return ten[(indexOf(level) - 1) % ten.length]!
}

/** The world a floor belongs to — the inverse of `FLOORS`, for the ambient wash
 *  and the vignette, which are still per-world (see `floorArt.ts`). */
export const worldOfFloor = (id: FloorId): WorldId => {
  const i = FLOOR_IDS.indexOf(id)
  return (Math.floor(Math.max(0, i) / LEVELS_PER_WORLD) + 1) as WorldId
}

/** True for a world's LEAD floor — the tile it shipped with, and the only one
 *  the art pipeline has a painting of (`public/images/bg/floor-<world>.webp`).
 *  See `floorTile` for why the other thirty-six are procedural only. */
export const isLeadFloor = (id: FloorId): boolean => FLOOR_IDS.indexOf(id) % LEVELS_PER_WORLD === 0

/** What the tile reads as, which is `base` unless the painter blends. */
export const floorField = (id: FloorId): string => {
  const p = FLOOR_PALETTE[id]
  return p.field ?? p.base
}

// ─── Colour maths ───────────────────────────────────────────────────────────
//
// Three small pure functions, here rather than in the test, because they are
// what the numbers above were CHOSEN with — an author picking a new floor's
// colours should be able to run them, and the test should be asserting the same
// arithmetic the author used rather than a second implementation of it.

/** `#rrggbb` → [0-255, 0-255, 0-255]. Throws on anything else: a malformed
 *  colour in the palette is a typo, and a typo that silently became black would
 *  pass every check below. */
export const rgbOf = (hex: string): [number, number, number] => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) throw new Error(`floors: not a #rrggbb colour: ${hex}`)
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const linear = (c: number): number => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export const relLuminance = (hex: string): number => {
  const [r, g, b] = rgbOf(hex)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export const contrastRatio = (a: string, b: string): number => {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * How far apart two colours look, 0 to ~765.
 *
 * The "redmean" weighted RGB distance — a cheap approximation of a perceptual
 * metric that is good enough to answer "is this floor the colour of that bug",
 * and has no dependency, no matrix and no white point to get wrong. Luminance
 * alone cannot answer that question: a mid brown and a mid green are the same
 * luminance and nobody confuses them.
 */
export const colourDistance = (a: string, b: string): number => {
  const [r1, g1, b1] = rgbOf(a)
  const [r2, g2, b2] = rgbOf(b)
  const rm = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
}

// ─── The legibility policy ──────────────────────────────────────────────────
//
// The numbers every floor is held to, stated once here and enforced once in
// `tests/game/floorPalette.test.ts`. They are not round numbers picked by feel:
// each is the tightest value that the four shipped tiles already clear, so the
// policy is "no new floor may be worse than the worst floor the game already
// had" rather than a standard invented after the fact. The margin on each is in
// the test, beside the assertion that holds it.

/** The bugs' outline colour — `INK` in `bugArt.ts`, restated because that one
 *  is private to the drawer. A warm near-black, luminance ≈ 0.015. */
export const BUG_INK = '#2b1b2e'

/**
 * Where a floor's field is allowed to sit, per polarity.
 *
 * The two bands do not meet: everything from 0.05 to 0.11 is the mud where a
 * dark body is neither silhouetted nor lit, and no floor may be there. The
 * lower end of `light` is the attic's own boards (0.118) and the upper end of
 * `dark` is comfortably above the arcade's grid (0.012).
 */
export const LUMA_BAND: Readonly<Record<FloorKey, readonly [number, number]>> = {
  light: [0.11, 0.90],
  dark: [0.002, 0.05]
}

/**
 * How hard the bug's outline has to bite, per polarity.
 *
 * On a `light` floor the ink must SILHOUETTE: at least this much contrast, and
 * the attic's boards at 2.58 are the thinnest the game has ever shipped. On a
 * `dark` floor the ink must DISAPPEAR instead — at most this much — because an
 * outline that is only slightly visible is the mud case wearing a disguise.
 */
export const INK_CONTRAST_MIN = 2.4
export const INK_CONTRAST_MAX = 1.4

/**
 * The ceiling on the tile's own marks.
 *
 * 3.0, which the picnic blanket's vignette shade (2.72) is the closest to. Past
 * it a mark stops being texture and starts being an object the eye stops on —
 * and on a board where the player is hunting small dark blobs, an object the
 * eye stops on is a bug that is not there.
 */
export const MARK_CONTRAST_MAX = 3.0

/** …and the looser ceiling a `structure` line gets. The brightest in the game
 *  is the pixel floor's scan at 11.0, with the neon grid just under it at 10.8.
 *  Bounded rather than unlimited: even a full-tile rule at 21:1 would strobe
 *  against the splats. */
export const STRUCTURE_CONTRAST_MAX = 12

/**
 * How far a floor's field must stay from the bug palette's browns.
 *
 * 72 on `colourDistance`'s scale. The binding case is the attic's own boards
 * against the ant — 79.6, the closest call in the shipped game and the reason
 * an attic full of brown floors was never an option. Everything wooden,
 * wickered, cardboard or strawy in the forty below had to go pale to clear it,
 * which is also why the bugs read on them.
 */
export const MIN_BROWN_DISTANCE = 72

/**
 * The browns in the bug palette — DERIVED, so a re-coloured ant cannot quietly
 * fall out of the rule.
 *
 * Every chassis colour (`body` and `shade`; accents are bright by contract and
 * never the thing that hides) whose hue is in the warm 5°-50° wedge, saturated
 * enough to be a colour rather than a grey, and dark enough to be a bug rather
 * than a highlight. Today that is the ant's two, the centipede's two and the
 * piñata fly's dark gold.
 */
export const BUG_BROWNS: readonly string[] = (() => {
  const out = new Set<string>()
  for (const b of BUGS) {
    for (const hex of [b.body, b.shade]) {
      const [r, g, bl] = rgbOf(hex)
      const max = Math.max(r, g, bl) / 255
      const min = Math.min(r, g, bl) / 255
      const d = max - min
      if (d === 0) continue
      const l = (max + min) / 2
      const s = d / (1 - Math.abs(2 * l - 1))
      let h: number
      if (max === r / 255) h = 60 * (((g - bl) / 255 / d) % 6)
      else if (max === g / 255) h = 60 * ((bl - r) / 255 / d + 2)
      else h = 60 * ((r - g) / 255 / d + 4)
      if (h < 0) h += 360
      if (h >= 5 && h <= 50 && s >= 0.25 && l <= 0.45) out.add(hex)
    }
  }
  return [...out]
})()
