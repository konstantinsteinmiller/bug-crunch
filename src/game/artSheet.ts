import { MONSTERS } from '@/game/monsters'
import { OUTFITS } from '@/game/heroSprites'
import { MONSTER_FRAME_H } from '@/game/monsterSprites'
import { HERO_PX } from '@/game/heroSprites'
import { ART_FOLDERS, type ArtKind } from '@/game/art'
import { ART_CATALOGUE } from '@/game/artCatalogue'
import { GATE_FRAME, ROCKET_BOX } from '@/use/useSurvivalArt'
import { BANNER } from '@/game/uiArt'

/**
 * ─── Art sheet manifest ─────────────────────────────────────────────────────
 *
 * Survivalist draws everything procedurally, which is wonderful for payload and
 * useless for one specific job: handing the art to somebody — or something —
 * that paints. There is no folder of PNGs to send. This module describes the
 * REFERENCE SHEETS that bake the whole cast out of the renderer, so the art can
 * leave, be repainted in a dark-fantasy hand, and come back in as drop-ins.
 *
 * Two shapes of sheet:
 *
 *   WALKS   a grid of panels showing one creature through one locomotion
 *           cycle. Each panel is the bake's own frame box scaled up, so a
 *           painted strip drops straight back in with the feet on the same
 *           line and nothing downstream has to be told where they are.
 *   STILLS  one object per image. A still is a one-frame walk to the slicer,
 *           which is what gives every prop, round and effect the same fit
 *           step the creatures get: the return is measured against the
 *           reference and normalised onto it, so a crate painted with a
 *           polite margin still fills its box in play.
 *
 * THE BOX IS THE CONTRACT. Every still is drawn by the renderer's OWN painter
 * (`useSurvivalArt`) into exactly the rectangle the renderer blits the
 * painting back into. Get the bench and the runtime out of step and every
 * painted part is the wrong size, everywhere, invisibly — so the bench never
 * carries a size of its own; it reads the same constants the painters do.
 *
 * Nothing here imports a canvas. The manifest says WHAT goes on each sheet and
 * WHERE the result belongs; `ArtSheets.vue` knows how to paint it.
 */

// ─── Walk cycles ────────────────────────────────────────────────────────────

/** Panels per sheet. Eight reads as a walk; sixteen is twice the drift. */
export const WALK_FRAMES = 8

/** Grid, chosen so the sheet lands on a clean ratio that every tool offers. */
export const WALK_COLS = 4
export const WALK_ROWS = WALK_FRAMES / WALK_COLS

/**
 * One panel, px. A panel is the bake's own frame box scaled up, so its shape
 * is the frame's: a monster's frame is 156 x 176 and its panel 320 x 360 —
 * 4 x 320 by 2 x 360 is 1280 x 720, exactly 16:9 (the 0.3% the two ratios
 * differ by is far inside what the strip counter tolerates). A survivor's
 * frame is square and its panel 320 x 320, for a 2:1 sheet.
 */
export const WALK_PANEL_W = 320
export const MONSTER_PANEL_H = 360
export const HERO_PANEL_H = 320

export interface WalkSpec {
  kind: 'monster' | 'hero'
  /** The DESIGN or OUTFIT id — `images/<kind>s/<id>.webp` is where it lands. */
  id: string
  file: string
  target: string
  name: string
  /** What it is, in the dark-fantasy register: the prompt's `WHAT IT IS`. */
  blurb: string
  /** The hue identity, as a sentence a painter can follow. */
  colour: string
  /** Which way the design is authored. Left-facers are NOT flipped for export:
   *  the strip has to match the bake it replaces, and the battlefield does its
   *  own mirroring by travel direction. Survivors are seen from behind. */
  faces: 'left' | 'right' | 'front' | 'back'
  cols: number
  rows: number
  frames: number
  panelW: number
  panelH: number
  w: number
  h: number
  /** Output cap for one frame's tall edge, px. The bake's own frame is the
   *  floor of what is worth shipping; more than twice it is payload. */
  maxEdge: number
}

/**
 * The cast, restyled.
 *
 * Every entry keeps its SILHOUETTE — the shape the player has learned to read
 * at 40 px is the whole of the character's identity in play — and pushes the
 * rendering into the grim register: cracked hide, bone, rust, ember light.
 * The bench's taglines ("cute-evil imp") describe the drawing; these describe
 * the painting the drawing is asking for.
 */
const DARK_CAST: Record<string, { blurb: string; colour: string }> = {
  grumpling: {
    blurb: 'A gremlin-imp: a skull-sized head on a runt body, all underbite and needle teeth, torn bat-ears with one drooping lower than the other, oversized clawed feet, a pale sunken belly. It shuffles, permanently unimpressed. Menacing, not cute — a thing that bites ankles.',
    colour: 'mossy sick green hide going grey at the joints, a bone-pale belly, two small ember-coal eyes.'
  },
  bonecap: {
    blurb: 'Fungal undead: a hunched human skeleton whose skull is swallowed by a great pale toadstool cap with gills underneath, spore-light glowing in the empty sockets and between the ribs, mycelium threading the yellowed bone, one arm longer than the other.',
    colour: 'bone ivory, a cap of bruised grey-cream with dark spots, the light a poison green.'
  },
  snaggletusk: {
    blurb: 'A boar-beast, side on: low, heavy and forward — a hulking bristled boar with one great cracked tusk and a broken stump where the other was, scarred hide, a ridge of black bristles, small furious eyes, hooves that gouge. Built to hit a wall and keep going.',
    colour: 'ash-brown hide, black bristles, a dirty ivory tusk, ember eyes.'
  },
  wispling: {
    blurb: 'A lantern ghost: a tattered floating shroud with no body inside it, a cold flame burning where a face should be, two hollow eyes that never blink together, rags trailing that never touch the ground. Sinister, not endearing.',
    colour: 'a faded grey-teal linen shroud, the flame cold blue-white, nothing warm anywhere on it.'
  },
  marrowknight: {
    blurb: 'An armoured skeleton knight, front on: dented black-iron plate over yellowed bone, a horned great-helm with cold light in the visor slit, a notched greatsword held low, a rotting tabard over the cuirass. It waits rather than lurches — the one that outranks the rest.',
    colour: 'blackened iron, bone, a tabard in dried-blood red gone brown, the visor light cold blue.'
  },
  nibbler: {
    blurb: 'A bat-imp: mostly ears and mouth — two huge ragged ears, one torn, a gaping needle-toothed maw, small red eyes, leathery wings folded round it like a cloak, hooked feet.',
    colour: 'dusk-purple hide going black at the ears, wing membrane a bruised plum, ivory teeth, ember-red eyes.'
  },
  cinderhound: {
    blurb: 'A burning hound, side on: all legs and ribs — a starved skeletal dog with embers glowing between its ribs, fire licking off its spine, a long muzzle of black teeth, hide cracked with heat lines, a tail that is a wisp of smoke. The fast one, and it is starving.',
    colour: 'ash grey and charcoal, the cracks and ribs ember orange, white-hot eyes.'
  },
  blorp: {
    blurb: 'A swamp ooze: a heaving mound of murky slime with a bone and a skull suspended inside it, a wide toothless grin that is not friendly, two mismatched bubble eyes, dripping at the edges.',
    colour: 'bog green shading to black, a sick yellow-green highlight on the wet crest, the bones inside bone-white.'
  },
  thornwick: {
    blurb: 'A bramble treant: a slow, patient tree-thing made entirely of black thorns and dead wood, a hollow face split into the trunk with a pale witch-light burning inside it, roots for feet, bramble-whips for arms, a crown of bare branches.',
    colour: 'dead bark black-brown, near-black thorns, the light in the face a pale sick green-white, a few dead leaves in rust.'
  },
  rattlejack: {
    blurb: 'A scrap skeleton: a jittering human skeleton in stolen scraps of armour, a dented iron cooking pot worn as a helm, a rusted cleaver, bones tied together with wire, one socket lit. No plan whatsoever.',
    colour: 'yellowed bone, rust-brown iron, a tatter of faded red cloth, the lit socket ember-red.'
  },
  dustmoth: {
    blurb: 'A crypt moth, front on, wings spread: a great dusty moth with tattered wing edges and two staring eyespots on the forewings, a furred thorax, dangling hooked legs, feathery antennae. Sinister — the eyespots are watching.',
    colour: 'dust grey and dead-leaf brown, the eyespots ringed in bone and bruise-purple, a faint cold shimmer on the wing scales.'
  },
  skewer: {
    blurb: 'A wyrmling, side on: a small fast serpentine dragon that is almost entirely the pointy end — a spear-pointed head, a long neck, small ragged bat wings, a whipping tail.',
    colour: 'slate green scales going black along the spine, a dull bone belly, a hot yellow slit of an eye.'
  },
  gloomcrow: {
    blurb: 'A bone crow, front on, wings out: a large carrion crow with a bare skull for a head, tattered feathers, a lit socket, a stolen gold trinket clutched in its beak.',
    colour: 'feathers near-black with a cold blue sheen, a bone-white skull, ember-red sockets, the trinket tarnished gold — the only bright thing on it.'
  }
}

/** The survivor, three outfits. One drawing; only the cloth changes. */
const SURVIVOR_BLURB = 'A lone survivor seen from DIRECTLY BEHIND, running away from the viewer up the road: a hooded figure in a ragged coat with the hood up, a battered leather pack with a bedroll lashed across the top, a short black-iron hand-cannon held forward in both hands so only the stock and a hint of barrel show above one shoulder, heavy boots. Head down, leaning into the run, the hood\'s tie-tails streaming behind. The tails are the one part that reads at 16 px — keep them. It RUNS: one leg straight and planted, the other folded up behind with the sole of its boot showing, exactly as each panel of the reference has it.'

/**
 * What each panel of the survivor's sheet IS.
 *
 * Stated per panel because the first returns held one pose for two panels and
 * jumped to the next — the reference of the time had the same near-duplicates
 * (a side-view stride turned round), and a painter copies what it is shown.
 * The order is the bench's own sampling: `paintSurvivorFrame` takes the middle
 * of each panel's slice of the stride, with the legs half a cycle apart and a
 * run's short stance, which puts these eight moments on these eight panels.
 */
const HERO_PANELS = [
  'left foot planted well forward, that leg straight; the right leg folding up behind, its boot three quarters of the way to the seat',
  'left foot planted under the hips; the right boot at the TOP of its swing, folded tight, its SOLE turned to the viewer',
  'left foot planted behind, pushing off; the right leg unfolding, its boot coming down and forward',
  'FLIGHT — both feet off the ground: the left boot just leaving the road behind, the right boot about to land in front',
  'right foot planted well forward, that leg straight; the left leg folding up behind, its boot three quarters of the way to the seat',
  'right foot planted under the hips; the left boot at the TOP of its swing, folded tight, its SOLE turned to the viewer',
  'right foot planted behind, pushing off; the left leg unfolding, its boot coming down and forward',
  'FLIGHT — both feet off the ground: the right boot just leaving the road behind, the left boot about to land in front'
]

const heroPanelScript = (): string[] => [
  '',
  'READ THE PANELS — it is a RUN, and the legs are the whole animation.',
  'Top row left to right is panels 1 to 4, bottom row 5 to 8. In every panel',
  'the body, pack, hood, arms and gun are IDENTICAL; only the legs change, and',
  'they change exactly as the reference draws them:',
  ...HERO_PANELS.map((p, i) => `· panel ${i + 1}: ${p}.`),
  '· The legs stay UNDER the hips and never splay out sideways into a V, never',
  '  cross, never skate. The stride runs INTO the screen, so a foot goes UP',
  '  (folding behind, sole showing) or DOWN (planted) — not left or right.',
  '· No two panels are the same pose. Panels 1-4 and 5-8 are the two halves of',
  '  one stride with the other leg leading.',
  '· The camera is square behind the back: the pack faces the viewer flat-on,',
  '  both shoulders show equally, and the face never shows. Do not turn the',
  '  figure three-quarters on to show the gun.'
]

const OUTFIT_COLOUR: Record<string, string> = {
  teal: 'a muted teal wool coat, slate trousers, an oiled brown pack, a bone-cream hood — the coat\'s teal is its identity in the crowd.',
  amber: 'a tarnished amber-brown leather coat, charcoal trousers, a dark pack, a grey-linen hood — the amber is its identity in the crowd.',
  violet: 'a dusk-violet cloak-coat, slate trousers, a brown pack, a pale blue-grey hood — the violet is its identity in the crowd.'
}

const walkOf = (
  kind: 'monster' | 'hero', id: string, name: string, blurb: string, colour: string,
  faces: WalkSpec['faces'], panelH: number, frameH: number
): WalkSpec => ({
  kind,
  id,
  file: `walk-${kind === 'hero' ? 'hero-' : ''}${id}`,
  target: `${ART_FOLDERS[kind]}/${id}.webp`,
  name,
  blurb,
  colour,
  faces,
  cols: WALK_COLS,
  rows: WALK_ROWS,
  frames: WALK_FRAMES,
  panelW: WALK_PANEL_W,
  panelH,
  w: WALK_COLS * WALK_PANEL_W,
  h: WALK_ROWS * panelH,
  // Twice the bake's frame: a boss is the same design at 2.5x, and past that
  // the strip is the heaviest thing the game downloads.
  maxEdge: frameH * 2
})

export const MONSTER_WALKS: WalkSpec[] = MONSTERS.map((m) => {
  const dark = DARK_CAST[m.id]
  return walkOf('monster', m.id, m.name,
    dark?.blurb ?? m.tagline, dark?.colour ?? '', m.faces, MONSTER_PANEL_H, MONSTER_FRAME_H)
})

export const HERO_WALKS: WalkSpec[] = OUTFITS.map((o) =>
  walkOf('hero', o.id, `Survivor (${o.id})`, SURVIVOR_BLURB,
    OUTFIT_COLOUR[o.id] ?? '', 'back', HERO_PANEL_H, HERO_PX))

export const WALKS: WalkSpec[] = [...MONSTER_WALKS, ...HERO_WALKS]

// ─── Stills ─────────────────────────────────────────────────────────────────

/** Edge of a square still's reference, px. */
export const STILL_SIZE = 512

export interface StillSpec {
  /** Runtime folder — and, for the cast's fixtures, the probe kind. */
  kind: ArtKind
  id: string
  file: string
  /** Path under `public/` the sliced result belongs at. */
  target: string
  /** Resized copies of the same return, for assets that ship at two sizes. */
  extra?: { target: string; size: number }[]
  name: string
  /** The prompt's `WHAT IT IS`. */
  blurb: string
  w: number
  h: number
  /** Output cap for the tall edge, px. The slicer writes every frame at most
   *  256 px tall by default; this can only lower that — unless `exact`. */
  maxEdge: number
  /**
   * `maxEdge` is the size, not a cap: the file is read at exactly that size by
   * something outside the renderer (the PWA manifest reads the logo at 512),
   * so the slicer's 256 default and even a `--size` do not apply to it.
   */
  exact?: true
  /** How the return is registered onto the reference: by its middle, or by
   *  its bottom edge (a thing whose ground line must not move). */
  anchor: 'centre' | 'feet'
  /**
   * `false` for a subject the slicer must NOT fit onto the reference.
   *
   * The fit measures SOLID pixels, and a drawn effect is mostly glow: the
   * muzzle flash's solid core is a third of its visible disc, a bolt's is its
   * dark heart. A painting — opaque strokes, all of it solid — fitted onto
   * that box comes back a third of the size it was painted at. These are
   * placed by the prompt's own words instead ("fills the frame", "the head
   * at 0.7 of the width") and blitted as they arrive.
   */
  fit?: false
  /** What the empty part of the frame must be. */
  bg: 'magenta' | 'opaque' | 'magenta-sky'
  /** Must it join to itself across an edge? */
  tile?: 'x' | 'xy'
  /** The subject fills its frame edge to edge (a crate, a tile). */
  fill?: boolean
  /** Which way it is authored, when the game turns it. */
  authored?: string
  /** What the game paints OVER it — and therefore what must be left out. */
  live?: string
  /** A glow that must stay inside the outline. */
  glow?: boolean
  /** Colourless by contract; the game tints it. */
  greyscale?: boolean
  /**
   * ─── An ANIMATED still ──────────────────────────────────────────────────
   *
   * Panels of one loop, when the subject moves under its own power. Absent, or
   * 1, is an ordinary still.
   *
   * A projectile is the case this exists for. A boss's meteor is a rock inside
   * a fire, and a fire is not a shape — it is a shape changing. Painted as one
   * panel it comes back beautiful and DEAD, because the renderer's only job
   * with a still is to translate it down the road; a player watching it called
   * that exactly what it is: lifeless. The fix is not a live glow drawn around
   * the painting — that is two fires burning at different rates on one rock —
   * it is to paint the fire moving, and the only way to ask a painter for that
   * is to hand them the loop.
   *
   * Everything downstream already handles it. The slicer cuts any grid into one
   * horizontal strip; `spriteStrip.ts` reads the panel count off the returned
   * file rather than from a declaration here, so a design that will not hold
   * for eight panels can come back as four with no code change; and
   * `PaintOpts.cycle` means the drawn fallback and the painted strip play from
   * the same clock, so the drop-in never changes the animation's speed.
   *
   * The grid is the walk's — 4 x 2 — because the walk prompt's panel-count
   * discipline was expensive to arrive at and an image model that has been
   * taught "two rows of four" for one sheet should not be asked for a different
   * shape on the next.
   */
  frames?: number
  cols?: number
  rows?: number
  /** What moves between the panels, and what must NOT. The prompt's
   *  `READ THE PANELS`; only meaningful when `frames > 1`. */
  cycle?: string
  /**
   * What each panel IS, one line per frame.
   *
   * The same medicine `HERO_PANELS` is: a painter copies what it is shown, and
   * shown a grid it will happily paint one picture per ROW and repeat it four
   * times. The survivor's stride came back that way three times running until
   * every panel was named, and the roller came back that way twice — a sheet
   * with one ring arrangement across the top row and a second across the
   * bottom, which is two states rather than eight steps.
   *
   * So a cycle whose motion is MECHANICAL — a measurable displacement per
   * frame, rather than free-form flicker — names its panels. Fire does not
   * need this; a turning object does.
   */
  panels?: readonly string[]
}

/** Panels of one loop for an animated still, and the grid they sit in. */
export const CYCLE_FRAMES = 8
export const CYCLE_COLS = 4
export const CYCLE_ROWS = CYCLE_FRAMES / CYCLE_COLS

/** Frames of a spec's loop — 1 for an ordinary still. */
export const framesOf = (s: StillSpec): number => s.frames ?? 1
export const colsOf = (s: StillSpec): number => s.cols ?? 1
export const rowsOf = (s: StillSpec): number => s.rows ?? 1

/** The animation grid, for a subject whose motion has to be painted in. */
const CYCLE = { frames: CYCLE_FRAMES, cols: CYCLE_COLS, rows: CYCLE_ROWS } as const

/**
 * The roller's eight steps, as fractions of ONE RING GAP.
 *
 * Generated rather than typed so the arithmetic cannot drift from
 * `CYCLE_FRAMES`, and stated as a measurement because that is the only kind of
 * instruction a painter cannot satisfy with "roughly the same but dirtier".
 * Panel k is the surface displaced by (k−1)/8 of the gap between two rings —
 * an eighth of a quarter-turn each, which is what the game plays back.
 */
const ROLLER_PANELS: readonly string[] = Array.from({ length: CYCLE_FRAMES }, (_, i) => {
  const nth = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][i]
  if (i === 0) {
    return 'the starting arrangement — one band lies straight across the ball\'s'
      + ' widest point (its horizontal middle). Every other panel is measured'
      + ' from this one'
  }
  const eighths = `${i}/${CYCLE_FRAMES}`
  const step = `every band has slid DOWN by ${eighths} of the gap between two bands`
  if (i * 2 === CYCLE_FRAMES) {
    return `${step} — HALF a gap. This is the panel least like panel 1 and it has`
      + ' to look it: the ball\'s widest point now falls in BARE IRON, exactly'
      + ' midway between two bands, where panel 1 had a band sitting on it'
  }
  if (i === CYCLE_FRAMES - 1) {
    return `${step}. One more step of the same size brings the NEXT band onto the`
      + ' widest point, which is panel 1 again — that is how the loop closes.'
      + ' This panel is the one just before that'
  }
  return `${step} — the ${nth} of eight even steps, so the band that was on the`
    + ' widest point is now a little below it'
})

const still = (
  kind: ArtKind, id: string, name: string, blurb: string,
  o: Partial<StillSpec> = {}
): StillSpec => ({
  kind,
  id,
  file: `still-${kind}-${id}`,
  target: `${ART_FOLDERS[kind]}/${id}.webp`,
  name,
  blurb,
  w: STILL_SIZE,
  h: STILL_SIZE,
  maxEdge: 256,
  anchor: 'centre',
  bg: 'magenta',
  ...o
})

const GATE_BLURB = 'A gate FRAME for a magical doorway, seen straight on: two THIN, tall posts, one at each side of the frame, joined by a thin lintel or arch across the top; the whole MIDDLE IS OPEN — flat magenta — because the game paints the glowing curtain, the flowing chevrons and the number plate inside the opening. The posts stand on the road; leave a little magenta under and over them exactly as the reference does.'

/**
 * How wide the reference draws a gate post, in world units.
 *
 * As wide as the game can tolerate: it grows OUTWARD from the door's edge, and
 * a two-leaf bank's inner posts meet at the divider pillar, which hides 0.25
 * units either side of the shared edge. So 0.25 out plus the drawn post's 0.09
 * in. The painting is registered onto this band; in play the drawn post keeps
 * its own 0.18.
 */
export const GATE_REF_POST_W = 0.34

/**
 * The gate frame's geometry, as fractions of the panel.
 *
 * The first returns came back with posts a THIRD of the frame wide — a pair
 * of slabs per side, a pillar the width of a tower — and two re-rolls with
 * the width stated as a fraction changed nothing: an image model does not
 * measure. So the reference now draws the posts at the widest the game can
 * take (`GATE_REF_POST_W`), which is what a painter actually copies, and the
 * slicer re-composes whatever comes back onto this band (`tools/slice-sheets`).
 * Derived from `GATE_FRAME` so nothing here can drift from the cut.
 */
export const GATE_POST = (() => {
  const { w, h, ppu, cap, refHalfW } = GATE_FRAME
  const edge = w / 2 - refHalfW * ppu
  const outer = (edge - (GATE_REF_POST_W - 0.09) * ppu) / w
  const inner = (edge + 0.09 * ppu) / w
  return {
    width: inner - outer,
    outer,
    inner,
    doorway: 1 - 2 * inner,
    /** Where the nine-slice cuts, as a fraction of the width. */
    cut: cap / w,
    /** The posts' foot, as a fraction of the height. */
    bottom: (h / 2 + (0.75 + 0.12) * ppu) / h,
    /** How much of the doorway span, from the top, is kept as the lintel. */
    lintel: 0.4
  }
})()

const pct = (v: number): string => `${Math.round(v * 100)}%`

export const STILLS: StillSpec[] = [
  // ── Props ──
  still('prop', 'crate-damage', 'Supply crate (damage)',
    'A supply crate: a square iron-banded strongbox of dark oak planks with riveted black-iron corners and a faint sickly-GREEN painted seal or band on its face. Square and flat-on.',
    { fill: true, live: 'The game paints a green chevron badge, a glowing rim and an HP number over the middle of the face, so keep the CENTRE plain and readable and put the detail at the edges.' }),
  still('prop', 'crate-rate', 'Supply crate (rate)',
    'A supply crate: a square iron-banded strongbox of dark oak planks with riveted black-iron corners and a cold BLUE painted seal or band on its face. Square and flat-on. Its sibling is the same crate banded green, and the two must be tellable apart by the colour of the band alone.',
    { fill: true, live: 'The game paints a blue bolt badge, a glowing rim and an HP number over the middle of the face, so keep the CENTRE plain and readable and put the detail at the edges.' }),
  still('prop', 'barricade', 'Barricade block',
    'A barricade block: a rough wall of mortared dark stone with bone and rusted iron scraps set into it, seen flat-on. Fully opaque, edge to edge.',
    { fill: true, tile: 'x', bg: 'opaque', live: 'The game paints hazard chevrons, a damage bar and an HP number over it, so keep it mid-tone and quiet — texture, not objects.' }),
  still('prop', 'boulder-1', 'Boulder (1 of 3)',
    'An unbreakable boulder: one heavy irregular lump of dark grey rock, squat and wide, cracked, with a lit crown edge upper-left and deep shadow lower-right. NO metal, NO number, NO glow, nothing that could be read as a meter — the absence of a number IS the mechanic. Fills most of the frame.',
    { fill: true }),
  still('prop', 'boulder-2', 'Boulder (2 of 3)',
    'An unbreakable boulder: one heavy irregular lump of dark grey rock, taller than it is wide with a split down one side, cracked, with a lit crown edge upper-left and deep shadow lower-right. NO metal, NO number, NO glow, nothing that could be read as a meter. Fills most of the frame.',
    { fill: true }),
  still('prop', 'boulder-3', 'Boulder (3 of 3)',
    'An unbreakable boulder: one heavy irregular lump of dark grey rock, rounded with a flat top, cracked, with a lit crown edge upper-left and deep shadow lower-right. NO metal, NO number, NO glow, nothing that could be read as a meter. Fills most of the frame.',
    { fill: true }),
  still('prop', 'barrel', 'Powder keg',
    'A powder keg: a dark riveted black-iron drum standing upright, four fifths as wide as it is tall, with two dull dried-blood-red bands and a crude skull-and-fuse stencil on its face. Intact state only. Centred, the drum filling the frame\'s full height.',
    { live: 'The game paints the damage cracks and the lit strobe over it, so paint it whole and unlit.' }),
  still('prop', 'pillar', 'Divider pillar',
    'A divider pillar: a tall iron post with heavy steel caps top and bottom, its body striped in diagonal black and dull-yellow hazard chevrons, scarred and rusted, seen straight on. Upright, filling the frame\'s full height, the caps a little wider than the shaft.',
    { w: 288, h: 640, maxEdge: 640, fill: true, live: 'NO lamp on top and NO glow — the beacon and the red warning are painted live.' }),
  still('prop', 'coin', 'Coin',
    'A coin pickup: a face-on tarnished gold coin with a grim skull or sigil embossed and a worn, notched edge. It must be round and face-on — the game spins it by squashing it sideways. Fills the frame.',
    { maxEdge: 128, fill: true }),
  // The weapon puzzle's prize, in its two states. Two paintings rather than
  // one recoloured: the whole beat rests on a player reading, from the far end
  // of the road, whether the box is still shut behind its armour or already a
  // pickup, so the states are allowed to look like different objects. See
  // `paintWeaponBoxBody`.
  still('prop', 'weapon-box', 'Weapon case (shut)',
    'A weapon case, shut and dead: a square armoured strongbox of cold grey gun-steel, flat-on, its face a heavy riveted plate recessed inside a thick bevelled frame, with dark sealed seams and scuffed dull-blue paint. NOTHING glows, nothing is warm — it is inert metal, and that is the read. Square and flat-on, filling the frame.',
    { fill: true, live: 'The game paints the weapon glyph and a heavy cross-brace over the middle of the face, so keep the CENTRE plain, flat and mid-tone and put the detail — rivets, bevels, scuffs — around the edges.' }),
  still('prop', 'weapon-box-open', 'Weapon case (open)',
    'The same square armoured strongbox, now UNSEALED and lit from within: the dark steel is banded and edged in hot brass and worn gold, its seams cracked open with warm amber light spilling out, the recessed face plate glowing a rich lamp-gold. Read as a PRIZE across a whole screen — warm, bright, obviously changed from the cold shut one. Square and flat-on, filling the frame.',
    { fill: true, live: 'The game paints the weapon glyph in near-black over the middle of the face, plus damage cracks, a pulsing halo and an expanding ring, so keep the CENTRE plain, bright and readable and put the detail around the edges.' }),

  // …and the two things standing between the crowd and it. The armour is one
  // plate of a pair; the lever is two pieces because half of it swings.
  still('prop', 'guard-plate', 'Weapon-case armour plate',
    'A bolted-on armour plate: a slab of riveted grey-blue battleship steel seen flat-on, its face crossed by two rows of heavy dome rivets, scuffed and streaked with rust runs from the rivet heads. Two of these stand EDGE TO EDGE over the case they protect, so the left and right edges are clean vertical panel edges — a plate, not a crate. Square-ish and flat-on, filling the frame.',
    { fill: true, live: 'The game darkens and reddens the whole plate as it is shot and flashes it white on every hit, so paint it INTACT and evenly lit — no cracks, no holes, no damage of its own.' }),
  still('prop', 'lever-post', 'Lever housing',
    'The housing of a road-side lever: a low, wide iron footing bolted flat to the ground, seen straight on — a squat rusted-steel box with a heavy bevelled lid, four corner bolts and a dark slot across its top where the arm comes out. Low and wide, twice as wide as it is tall, filling the frame.',
    { w: 512, h: 256, fill: true, live: 'The ARM is a separate painting that swings out of the slot, so paint the housing alone — no arm, no handle, nothing standing up out of it.' }),
  still('prop', 'lever-arm', 'Lever arm',
    'The arm of a road-side lever, standing straight UP: a stout iron rod with a wrapped grip, rising from the bottom edge of the frame, and at its top an EMPTY round socket — an open iron ring or claw with nothing in it. The socket must be a hole, not a ball: the game lights a glowing orb inside it. Centred, the rod filling the frame\'s full height, the socket at the very top.',
    { w: 288, h: 512, anchor: 'feet', authored: 'standing UP: the pivot at the bottom edge, the socket at the top. The game swings it over as the lever is pulled', live: 'The knob is painted live INSIDE the socket — red while the lever is live, green once it is pulled — so leave the socket open and unlit.' }),
  // ── Gates ──
  // `fit: false` on every gate: the slicer RE-COMPOSES a gate return onto the
  // reference's post band and stands it on the ground line, which is the
  // whole registration. Running the fit on top of that was wrong in a way
  // that showed: painted posts are taller than the drawn ones, so the fit
  // shrank the frame about its centre and slid both posts into the doorway.
  still('gate', 'frame-add', 'Gate frame — the door that pays',
    `${GATE_BLURB} THIS ONE is the door that PAYS: clean cold-iron posts lit with pale cyan runes, a faint cold light on the metal, intact. Cold cyan is its identity — nothing warm on it.`,
    { w: GATE_FRAME.w, h: GATE_FRAME.h, maxEdge: GATE_FRAME.h, fit: false }),
  still('gate', 'frame-sub', 'Gate frame — the door that bills',
    `${GATE_BLURB} THIS ONE is the door that BILLS: scorched iron posts with an amber-brown, sooty, dried-blood cast, dull embers in the cracks, intact but ugly.`,
    { w: GATE_FRAME.w, h: GATE_FRAME.h, maxEdge: GATE_FRAME.h, fit: false }),
  still('gate', 'frame-mul', 'Gate frame — the multiplier',
    `${GATE_BLURB} THIS ONE is the MULTIPLIER: posts of dark violet-black iron with deep purple runes — deep VIOLET, never pink and never magenta, because magenta is the background key and would be cut away with the sky.`,
    { w: GATE_FRAME.w, h: GATE_FRAME.h, maxEdge: GATE_FRAME.h, fit: false }),
  still('gate', 'frame-div', 'Gate frame — the trap',
    `${GATE_BLURB} THIS ONE is the TRAP: rusted red-black iron posts, each still ONE pillar of the reference's width, with the top of the post cracked off jagged and a snapped stub above the break, dirty and scorched — a frame that has already failed somebody. Broken means the TOP is broken; the post itself stays a pillar, not a heap of rubble, not a wall.`,
    { w: GATE_FRAME.w, h: GATE_FRAME.h, maxEdge: GATE_FRAME.h, fit: false }),

  // ── Rounds ──
  still('round', 'tracer', 'The crowd\'s round',
    'The crowd\'s round: a short vertical streak of hot lead — a bright white-gold core with a thin ember-orange glow tail below it. It is one of a hundred on screen, so it is a streak, not an object. The streak spans the full height of the frame and about a quarter of its width, centred.',
    { maxEdge: 128, fit: false, authored: 'pointing UP: it flies up the screen, so the bright head is at the TOP and the tail trails DOWN', glow: true }),
  still('round', 'bolt-gunner', 'The gunner\'s round',
    'The gunner\'s round: a fat slow orb of cold cyan witchfire around a dark iron core, with a streaming tail of fading cyan witchfire behind it. Small in its frame — the tail is longer than the head is wide.',
    {
      ...CYCLE, fit: false, glow: true,
      authored: 'pointing RIGHT: the head sits at 0.7 of the width with the tail trailing off to the LEFT. The game turns it to its heading.',
      cycle: 'The IRON CORE and the orb around it do not move, change size or change place between panels — they are the same round, and the game measures its kill against that head. What animates is the WITCHFIRE: the tail licks and gutters, its tongues lengthening and shortening and curling off the axis, and loose sparks drift back down it. Panel 8 must lead back into panel 1.'
    }),
  still('round', 'bolt-boss', 'The healer\'s bolt',
    'The healer\'s bolt: a sickly green orb of necrotic light with a pale core and a trail of guttering green flame behind it. Small in its frame.',
    {
      ...CYCLE, fit: false, glow: true,
      authored: 'pointing RIGHT: the head sits at 0.7 of the width with the tail trailing off to the LEFT. The game turns it to its heading.',
      cycle: 'The ORB and its pale core keep the same size and the same place in every panel — that head is the part that hits. What animates is the necrotic fire around and behind it: the halo breathes in and out, the trail writhes and splits, and flecks of green rot peel off it and fall behind. Panel 8 must lead back into panel 1.'
    }),
  still('round', 'roller', 'The rolling boulder',
    'The rolling boulder: a huge iron-banded stone sphere studded with rusted spikes, dark, with a rim light along its lower edge, seen face-on as it rolls straight at the viewer. The SPHERE is a full circle about three quarters of the frame across, centred — in the reference it spans from 12% to 88% of the width — and the spikes reach out from it into the margin around it, never crossing the frame edge. The sphere is what kills; keep it that size. Its ironwork reads as FOUR evenly spaced bands stacked down its face — flattened ellipses, widest across the middle of the ball and tighter toward its top and bottom edges, studded with rivets. Four bands across the face, evenly spaced, all the way from the top edge to the bottom: not one equator, not a cross, not a cage.',
    {
      ...CYCLE, fit: false, panels: ROLLER_PANELS,
      live: 'Nothing is painted over it any more. The game used to scroll its own bands across the ball to fake the roll; these eight frames ARE the roll, so paint the ironwork and let it turn.',
      cycle: [
        'IT ROLLS, TOWARD THE VIEWER — this is the one sheet in the set where the',
        'object itself moves, and that movement is the whole animation.',
        '',
        'THREE returns have now come back without it. The first was the same ball',
        'copied eight times with sparks added. The second was TWO arrangements,',
        'one repeated across the top row and the other across the bottom, which',
        'plays as a thing that snaps between two poses. The third is the one to',
        'study, because it looked closest and was still not a roll: the bands',
        'slid down the face as four stripes of the SAME WIDTH, evenly spaced,',
        'like a pattern scrolling behind a porthole. Nothing narrowed, nothing',
        'crowded, and the studs never moved at all.',
        '',
        'That is the whole difference, so it is worth stating as geometry rather',
        'than as a feeling. These bands are HOOPS AROUND A SPHERE, not stripes',
        'on a disc, and a hoop on a sphere does two things a stripe never does:',
        '',
        '  · IT NARROWS. A band crossing the widest part of the ball spans',
        '    almost the full width of it. The same band, three quarters of the',
        '    way to the top edge, spans barely half that — and as it reaches the',
        '    edge it shrinks to nothing and is gone. Look at the reference: no',
        '    two bands in a panel are the same width.',
        '  · THEY CROWD. Because they are evenly spaced around the BALL and not',
        '    down the picture, the gaps between them look widest across the',
        '    middle and squeeze together toward the top and bottom edges. Two',
        '    bands near the top edge sit almost on top of each other.',
        '',
        'Get those two right and the ball turns whether or not anything else is',
        'perfect. Get them wrong and no amount of sparks will save it.',
        '',
        'The ball stays exactly the same size and exactly in the same place. What',
        'moves is its SURFACE: the bands, their rivets and any scars or pitting',
        'travel DOWNWARD together across the face — in at the top edge, down over',
        'the middle, out at the bottom — as if the ball were turning toward you.',
        'The rivets ride their band, so they spread apart as the band widens over',
        'the middle and close up again as it narrows toward an edge.',
        '',
        'Across the eight panels the surface travels DOWN by exactly ONE BAND',
        'GAP, in eight even steps of an eighth of a gap each. By panel 8 the',
        'band that started on the ball\'s widest point has moved almost all the',
        'way to where the band below it began, so the next step lands the',
        'following band exactly where the first one started — and that is panel 1',
        'again. The loop closes with no jump. Do not paint a whole revolution.',
        '',
        'The RING OF SPIKES around the outline is the one thing that does NOT',
        'travel. A ball rolling straight at you keeps its silhouette: the spikes',
        'stand out from the edge in the same places in all eight panels, exactly',
        'as the reference draws them. Do not slide them around the rim — that',
        'reads as a ball spinning on the spot rather than rolling at the viewer.',
        'The roll is carried entirely by the face.',
        '',
        'Under it all, sparks struck off the spikes where they bite the road and',
        'a low scorch of dust around the base. Those are the only things that may',
        'vary freely between panels — everything else has to line up.'
      ].join('\n')
    }),
  still('round', 'meteor', 'The boss\'s rock',
    'The boss\'s falling rock: a jagged black stone wrapped in orange fire, a white-hot core around the stone, and a flame tail streaming UPWARD from it — it falls down the screen. The stone sits in the LOWER part of the frame with the tail reaching the top.',
    {
      ...CYCLE, anchor: 'feet', fit: false, glow: true,
      authored: 'falling: the stone low in the frame, the tail rising to the top edge',
      cycle: 'The STONE keeps the same size and very nearly the same place in every panel — it may rock a few degrees, no more, because the game moves it down the screen itself. Everything else BURNS: the flame tail whips and forks, its tongues climbing and falling back, the white-hot shell around the stone flares and dims, and embers tear off the tail and stream away above it. This is the panel the whole sheet is for — the fire must be visibly a different fire in every one of the eight. Panel 8 must lead back into panel 1.'
    }),
  still('round', 'bomb', 'The bomber\'s charge',
    'The bomber\'s charge: a black iron bomb with a lit fuse and a tight ember glow around it. Centred, about half the frame across.',
    {
      ...CYCLE, fit: false, glow: true,
      live: 'The spark walking down the fuse is painted live, so no spark.',
      cycle: 'The IRON BOMB does not move or change size between panels. What animates is the fire: the ember glow around the casing swells and shrinks, and the fuse burns with a flame that licks and flares. It is a fuse burning down, so the fire is a little angrier by panel 8 than at panel 1 — but panel 8 must still lead back into panel 1.'
    }),
  still('round', 'grenade', 'The player\'s grenade',
    'The player\'s grenade: a small iron-grey sphere with a band across its middle, centred, filling most of the frame.',
    { maxEdge: 128, authored: 'level: it tumbles in flight and the game turns it' }),
  // The box is `ROCKET_BOX` in units of the shell's radius, at 80 px per
  // unit: 288 x 512, which is 9:16.
  still('round', 'rocket', 'The launcher\'s rocket',
    'The launcher\'s rocket in flight, nose up: a fat black-iron shell with a blunt warhead, a band of rust round its middle, two or three swept fins at its tail, and a hot exhaust plume streaming DOWN from it — a white-gold core inside ember-orange flame that frays into smoke. The SHELL sits in the upper part of the frame with its nose a little below the top edge and is about half the frame\'s width; the PLUME runs from the fins down to the bottom edge and may be as wide as the frame. It is the heaviest thing the player fires, so it must read as iron, not as a spark.',
    {
      w: ROCKET_BOX.w * 80, h: ROCKET_BOX.h * 80, maxEdge: 256, fit: false, glow: true,
      authored: 'pointing UP: it flies up the screen nose first, so the warhead is at the TOP and the plume trails DOWN. The game turns it to its heading',
      live: 'The blast when it lands is painted live, so no explosion, no smoke ring, just the shell in flight.'
    }),

  // ── Effects ──
  still('fx', 'muzzle', 'Muzzle flash',
    'A muzzle flash: a hot white-gold burst, spiky, TIGHT, with an ember-orange fringe. It is drawn additively over the road, so dark pixels add nothing and the shape has to carry itself in light alone. Centred, filling most of the frame — but every spike stays inside the frame edge, nothing touches it.',
    { maxEdge: 128, fit: false, glow: true }),
  still('fx', 'smoke', 'Smoke puff',
    'A smoke puff: a soft round cloud, densest in the middle, fading to nothing at its edge. Centred, filling the frame.',
    { maxEdge: 192, fit: false, greyscale: true }),
  still('fx', 'scorch', 'Scorch mark',
    'A scorch mark on the road: a soft black-charcoal burn, an ellipse wider than it is tall, darkest in the middle, fading out to nothing at its edge. Charcoal only — no colour, no embers.',
    { w: 512, h: 282, maxEdge: 144, fit: false }),
  still('fx', 'ring-shock', 'Shockwave ring',
    'A shockwave ring: a thin bright white-blue ring, a full circle seen from above, with a hard inner edge and a soft outer glow. TRANSPARENT INSIDE — the ring is stretched flat over the road. The ring itself spans about 89% of the frame, exactly as the reference has it; the glow outside it stays inside the frame edge.',
    { glow: true }),
  still('fx', 'ring-heat', 'Slam telegraph ring',
    'A slam telegraph ring: a thin ember-orange ring, a full circle, hard edge inside, soft heat outside, TRANSPARENT INSIDE. The ring itself spans about 89% of the frame, exactly as the reference has it — it marks the radius the hit lands in, so it must not grow or shrink — and the heat outside it stays inside the frame edge.',
    { glow: true }),
  still('fx', 'ring-heal', 'Heal ring',
    'A heal ring: a thin sickly green ring, a full circle, TRANSPARENT INSIDE. Green is a colour the game uses nowhere else, so it must be unmistakably green. The ring itself spans about 89% of the frame, exactly as the reference has it; any glow outside it stays inside the frame edge.',
    { glow: true }),
  still('fx', 'shield', 'Shield dome',
    'The player\'s shield dome: a translucent cold-blue energy bubble, a full circle seen face-on, with a bright rim, a faint honeycomb texture across the surface and a specular sweep upper-left. The INTERIOR stays mostly transparent — it is stretched over the crowd and the crowd must stay readable through it. The rim spans about 89% of the frame, exactly as the reference has it; its glow outside stays inside the frame edge.',
    { glow: true }),
  still('fx', 'guard', 'Boss guard barrier',
    'The boss\'s guard barrier: a point-up HEXAGON of ember-orange energy, a translucent fill with a hot rim. The hexagon spans about 89% of the frame, exactly as the reference has it; the rim\'s glow outside it stays inside the frame edge.',
    { glow: true }),
  still('fx', 'crest-shield', 'Shield crest',
    'A heater shield crest — flat top, straight shoulders, tapering to a rounded point — in cold blue with a heavy near-black rim, a chief band across the top and a centre rib. Heraldry read at 20 px. Fills the frame.',
    { maxEdge: 128, fill: true }),
  still('fx', 'crest-guard', 'Guard crest',
    'A heater shield crest — flat top, straight shoulders, tapering to a rounded point — in ember-orange and tarnished gold with a heavy dark rim, a chief band across the top and a centre rib: the boss\'s own. Fills the frame.',
    { maxEdge: 128, fill: true }),

  // ── Backdrop ──
  //
  // No road tile. It was painted, and it was worse than the drawing: cobbles
  // big enough to read at all read as OBJECTS under the crowd, which is the one
  // thing the ground must never do. The procedural gravel stays.
  still('bg', 'ridge-far', 'Far ridge',
    'A far parallax ridge: jagged dead peaks with a broken tower or two and a gallows on the skyline. The SKY above the ridge line is solid magenta; everything below the ridge line is SOLID BLACK silhouette — the game tints it per stage, so no colour, no shading, no lights. The ridge line runs at about 40% down the frame.',
    { w: 1536, h: 384, maxEdge: 384, tile: 'x', bg: 'magenta-sky' }),
  still('bg', 'ridge-near', 'Near ridge',
    'A near parallax ridge, lower and closer than the far one: a dune of ruined walls, leaning grave-posts and bare trees. The SKY above the ridge line is solid magenta; everything below it is SOLID BLACK silhouette — the game tints it per stage, so no colour, no shading, no lights. The ridge line runs at about 40% down the frame.',
    { w: 1536, h: 384, maxEdge: 384, tile: 'x', bg: 'magenta-sky' }),

  // ── Marks and the logo ──
  still('ui', 'crown', 'Elite crown',
    'The elite\'s crown: a small three-pointed crown of tarnished gold with a heavy dark rim, its base flat at the bottom of the frame. Read at 20 px — bold shape, no fine detail. Fills the frame.',
    { maxEdge: 128, fill: true }),
  // The banner is nine-sliced by CSS: the outer `BANNER.cap` of the width at
  // each end is kept at true size and the middle is stretched to the title.
  // The prompt states the fraction, and the slicer fits the return onto the
  // reference's plate (it is solid, so the fit is safe), which is what keeps a
  // painted end piece under the CSS cut.
  still('ui', 'ribbon', 'Result banner',
    `The result screen\'s title banner: a long horizontal plate of blackened iron with a swallow-tailed notch cut into each end, bound along its top and bottom edges with a thin line of tarnished gold, a round iron-gold boss beside each notch and a small rivet in each corner. The plate spans the FULL WIDTH and nearly the full height of the frame, exactly as the reference does. All the detail lives in the two END PIECES — the outer ${pct(BANNER.cap)} of the width at each side — because the game keeps those at true size and STRETCHES THE MIDDLE sideways to fit the words: the middle ${pct(1 - 2 * BANNER.cap)} is a plain, flat, dark band with nothing on it but the two gold lines running straight through.`,
    {
      // The cap is on the tall edge, the width here; the plate is 40 px tall
      // on screen and never more than 100 at any DPR.
      w: BANNER.w, h: BANNER.h, maxEdge: BANNER.h,
      live: 'The title is printed in white across the middle band, so the middle stays plain, flat and dark — no emblem, no rune, no glint, no lettering.'
    }),
  still('ui', 'chest', 'The idle treasure chest',
    'The HUD\'s treasure chest: a squat iron-banded strongbox of dark oak seen straight on and a little from above, its domed lid raised a crack so a cold gold light leaks from the gap, a skull-faced iron hasp on the front, riveted black-iron bands and corners. A thing you would loot. Bold shape, no fine detail — it is read at 24 px beside the coin badge — and the same silhouette as the reference: a wide lid over a box, the lid overhanging.',
    { maxEdge: 128 }),
  // The shop's own mark, and NOT the chest: they sit on screen at the same
  // time now — the chest fills with time on the wallet column, the forge opens
  // the upgrade shop from the bottom bar — and two controls that do different
  // things may not be the same drawing.
  still('ui', 'forge', 'The upgrade forge',
    'The upgrade shop button\'s mark: a squat blackened-iron anvil, its horn to the LEFT and its foot splayed, standing under a bold upward chevron of hot molten gold, with two or three sparks flying off it. The anvil\'s face glows orange where the chevron rises off it. Bold shape, no fine detail — it is read at 24 px on a button — and the same layout as the reference: the chevron in the top half, the anvil in the bottom half, both centred and filling the frame.',
    { maxEdge: 128 }),
  still('ui', 'skill-grenade', 'The grenade skill',
    'The grenade skill\'s button icon: a round black-iron bomb with a short fuse curling from its top and a spark on the fuse\'s end — the one the player throws. Bold and simple, read at 24 px on a round button; the same silhouette as the reference, a ball with the fuse to the upper right.',
    { maxEdge: 128 }),
  still('ui', 'skill-shield', 'The shield skill',
    'The shield skill\'s button icon: a heater shield of cold steel with a heavy near-black rim and a raised iron boss, a cold blue witch-light glowing in its centre band — the same cold blue as the dome it raises over the crowd. Bold and simple, read at 24 px on a round button; the same silhouette as the reference.',
    { maxEdge: 128 }),
  // The weapon choice. Two cards, seen ONCE, at about a hundred pixels each:
  // the one screen in the game that is allowed a little more detail than a
  // button icon, because it is a prize being presented rather than a control
  // being found. Both are the weapon alone — the plate, the halo and the
  // ribbon are the DOM's — held at the same angle so the pair reads as a set.
  still('ui', 'weapon-card-rocket', 'The launcher card',
    'The stage-3 weapon choice\'s ROCKET LAUNCHER card: a shoulder-fired launcher of blackened iron and dark scorched wood seen three-quarters from the front-left, its muzzle pointing to the upper right, a fat finned rocket seated in the tube with its warhead just showing, a strap and two rivet bands along the barrel, and a hot ember-orange glow inside the mouth of the tube as if a shot is a heartbeat away. Weight and menace: this is the heavy option. Bold silhouette read at 100 px, the same layout as the reference — the weapon diagonal across the frame, filling about nine tenths of it.',
    { maxEdge: 256 }),
  still('ui', 'weapon-card-gatling', 'The gatling card',
    'The stage-3 weapon choice\'s GATLING GUN card: a six-barrelled rotary gun of gunmetal and brass seen three-quarters from the front-left, barrels pointing to the upper right and mid-spin, a cold soul-blue glow between the barrels and a spray of brass casings falling from the breech. Speed and volume: this is the fast option, so everything about it should look like it is already moving. Bold silhouette read at 100 px, the same layout as the reference — the weapon diagonal across the frame, filling about nine tenths of it.',
    { maxEdge: 256 }),
  still('ui', 'logo', 'Title logo',
    'The game\'s title logo: the single word SURVIVALIST in carved bone-and-black-iron dark-fantasy lettering, cracked and chipped, a faint ember glow at the edges. Spelled exactly S-U-R-V-I-V-A-L-I-S-T, in one line, readable at 192 px. Centred, filling about nine tenths of the width.',
    {
      // The file IS the PWA's 512 icon, so 512 is exact rather than a cap the
      // slicer's 256 default may lower.
      w: 1024, h: 1024, maxEdge: 512, exact: true,
      target: 'images/logo/logo_512x512.png',
      extra: [
        { target: 'images/logo/logo_192x192.png', size: 192 },
        { target: 'images/logo/logo_256x256.webp', size: 256 }
      ]
    })
]

// ─── Prompts ────────────────────────────────────────────────────────────────

/**
 * The style lock, in the dark-fantasy register.
 *
 * Written the way the reference project's was: prohibitions from what an
 * image model actually returns beat adjectives about what is wanted. The
 * AVOID list is the cozy-storybook look this cast was drawn in and must leave,
 * the glossy mobile look every model reaches for, and the two ways a "dark"
 * brief goes wrong — photoreal fur and a sepia filter over everything.
 */
const STYLE_HEAD = [
  'STYLE — grim painted dark fantasy, like a plate from a gothic illustrated',
  'bestiary or the key art of a dungeon crawler. Match this in every panel:',
  '· INK FIRST. Heavy hand-drawn contour lines in near-black ink, jagged and',
  '  confident, thick on the shadow side and thin on the lit side, with',
  '  dry-brush breaks. The drawing must look DRAWN — scratchy linework showing',
  '  through the paint.',
  '· PAINTED, NOT RENDERED. Flat blocks of gouache-like paint inside the lines',
  '  with visible brushwork, rough cel-style shadow shapes and a little grain.',
  '  No airbrush, no smooth 3D shading, no plastic gloss.',
  '· DESATURATED, LOW-KEY colour: bone, ash grey, dried blood, rust, bruise',
  '  purple, swamp green, cold slate — with ONE hot accent per subject (ember',
  '  orange, sickly witch-green, cold soul-blue, tarnished gold). Deep shadows',
  '  that fall to black.',
  '· HIGH CONTRAST and cold. The light comes from the UPPER LEFT. Chiaroscuro:',
  '  most of every form in shadow, one edge picked out.',
  '· Gothic, grotesque, worn: cracked bone, rusted iron, torn cloth, wet stone,',
  '  candle-soot. Everything has been through something.',
  '· Menacing rather than cute — but the SILHOUETTE stays readable at 40 px, so',
  '  keep the big shapes simple and put the detail inside them.',
  '',
  'AVOID — this is exactly how earlier attempts went wrong:',
  '· NO cute, cozy, storybook, chibi or plush look. No rounded friendly faces,',
  '  no button eyes, no smiles.',
  '· NO candy-bright, saturated, neon or pastel colour. If it looks cheerful,',
  '  it is wrong.',
  '· NO glossy, plasticky, airbrushed mobile-game rendering. No smooth 3D',
  '  volume, no bevelled edges, no lens flares, no rim-lit chrome.',
  '· NO photorealism and no hyper-detailed fur or scales — this is paint, and it',
  '  is read at thumbnail size.',
  '· NO warm paper, parchment or sepia wash over the whole image. Warmth is an',
  '  accent, not a filter, and the ground is not part of the painting.'
]

const STYLE_TAIL = [
  '· Keep the subject the same subject and silhouette it already has. This is a',
  '  restyle, not a redesign.'
]

/** For a thing that floats in its frame: a creature, a round, an effect. */
export const STYLE_PART = [
  ...STYLE_HEAD,
  '· NO frames, borders, cards, vignettes, matting or paper background behind',
  '  the drawing. Nothing but flat magenta behind it, right up to its outline.',
  ...STYLE_TAIL
].join('\n')

/** For a thing that IS its frame: a crate, a tile, a wall. */
export const STYLE_FILL = [
  ...STYLE_HEAD,
  '· NO frames, borders, cards, vignettes, matting or paper background inside',
  '  the frame. The object itself fills the frame edge to edge, corner to',
  '  corner, and its outer edge is the frame\'s edge.',
  ...STYLE_TAIL
].join('\n')

/**
 * The background clause, stated FIRST.
 *
 * Buried at the bottom under the style it lost every time in the reference
 * project: one return came back on cream parchment, one with the transparency
 * checkerboard painted in as literal pixels, and one with the subject on a
 * card floating in the magenta. Models weight what they read first, and this
 * matters more than any of the styling, because a background that cannot be
 * removed is welded into the sprite forever.
 *
 * The last bullet is not optional. A "muted, low-key" style brief plus a
 * magenta ground produced DUSTY PINK on three consecutive returns — the model
 * applied the palette instruction to the whole image.
 */
export const BACKGROUND_RULE = [
  'BACKGROUND — read this before anything else. It matters more than the style.',
  'Fill every pixel that is not the object itself with solid, flat, pure magenta',
  '#FF00FF. Treat it as a green-screen: one flat chroma-key colour, edge to edge.',
  '· EXACTLY #FF00FF — red 255, green 0, blue 255. Not pink, not rose, not dusty',
  '  pink, not mauve, not a soft or tinted version of it. Only the true colour can',
  '  be cut away cleanly; a near miss has to be flood-filled instead, and a flood',
  '  fill eats any pale paint it can reach.',
  '· NOT transparent. Transparency gets exported as a grey-and-white CHECKERBOARD',
  '  and then baked into the artwork as though the squares were paint.',
  '· NOT white, cream, black, parchment, paper, or any tinted or textured ground.',
  '· The object must NOT sit on a card, panel, sheet, badge, frame or rectangle of',
  '  any kind. The magenta must touch the outline of the object on every side.',
  '· No drop shadow onto the background, and no vignette.',
  '· The object itself must contain no magenta or hot pink.',
  '· The dark, desaturated palette above is for the OBJECT. The ground is not',
  '  part of the painting and is not toned down with it: it stays a vivid,',
  '  eye-hurting #FF00FF however dark everything else is. Dusty rose, pale pink',
  '  and mauve are the failure this whole clause is about.'
].join('\n')

const GLOW_RULE = [
  'KEEP ANY GLOW TIGHT. A halo, aura or bloom spreading out into the background',
  'is measured as part of the object when the return is fitted back onto the',
  'reference — a wide aura therefore comes back as a tiny object inside a huge',
  'smear. It also cannot be keyed: soft light over magenta turns pink rather',
  'than transparent. Any glow belongs inside the shape\'s own outline, or within',
  'a hair of it.'
].join('\n')

const facing = (f: WalkSpec['faces']): string =>
  f === 'front' ? 'the viewer'
    : f === 'back' ? 'AWAY from the viewer — it is seen from behind'
      : f.toUpperCase()

/**
 * A ready-to-paste prompt for one walk cycle.
 *
 * Almost all of this is about ONE failure: an image model handed eight panels
 * of the same character will happily return eight different characters. So the
 * consistency clause is stated before the style, in the same position and for
 * the same reason `BACKGROUND_RULE` is — it is the thing that makes the result
 * usable or useless, and models weight what they read first.
 */
export const promptForWalk = (w: WalkSpec): string => {
  const hero = w.kind === 'hero'
  const IT = hero ? 'survivor' : 'creature'
  const ITS = hero ? 'survivors' : 'creatures'
  const CYCLE = hero ? 'RUN CYCLE' : 'WALK CYCLE'
  const MOMENT = hero
    ? 'the SAME survivor at a different moment of ONE running stride'
    : 'the SAME creature at a different moment of one step'
  const RATIO = w.w * 9 === w.h * 16 ? '16:9' : w.w === w.h * 2 ? '2:1' : `${w.w}:${w.h}`
  const SHAPE = RATIO === '2:1' ? 'twice as wide as it is tall' : 'landscape, 16:9'

  return [
    `# ${w.id} — ${w.name}  (${w.target})`,
    '',
    'WHAT COMES BACK IS A SPRITE SHEET, NOT A PORTRAIT.',
    `Repaint a ${CYCLE}. The attached sheet is ${w.cols} columns x ${w.rows} rows`,
    `= EXACTLY ${w.frames} panels, read left to right along the top row and then the`,
    `bottom row. Every panel is ${MOMENT}.`,
    '',
    `· ${w.frames} panels. Not 1, not ${w.cols}, not ${w.frames + 4}, not ${w.frames * 2},`
    + ` not ${w.frames * 3}. Exactly ${w.rows} rows of ${w.cols} — do not add a row.`,
    '· ONE big painting of the character filling the canvas is the wrong answer',
    '  however well it is painted, and so is a square canvas.',
    `· The panels are TALLER than the ${IT} on purpose. A low, wide ${IT} leaves`,
    '  empty magenta above itself in every panel, and that space is NOT room for',
    `  another row: ${w.rows} rows of ${w.cols}, with air above each ${IT}, is the whole`,
    `  sheet. A ${w.rows * 2}-row return cannot be cut — that is what came back last time.`,
    '',
    'ONE CHARACTER — read this before anything else.',
    `All ${w.frames} panels must show the same individual:`,
    'identical colours, identical clothing and gear, identical proportions,',
    'identical silhouette, identical markings, identical number of limbs and',
    'horns. Only the POSE changes, and it changes exactly as the reference',
    'shows — same limb positions, same body lean, same head angle.',
    `· ONE colour scheme in every panel. A ${IT} that is grey in one panel and`,
    `  brown in another is not one ${IT} animated, it is several ${ITS} side by`,
    '  side, and the result is unusable.',
    '· Do not redesign it. Do not add or remove parts between panels.',
    '· Do not turn it to face a different direction in any panel.',
    `· Do not re-scale it: the ${IT} must be the same size in every panel, and the`,
    '  same size it is in the reference. Do not move it around inside its panel.',
    `· It faces ${facing(w.faces)} in the reference. Keep that direction in all`
    + ` ${w.frames} panels.`,
    ...(hero ? heroPanelScript() : []),
    '',
    `WHAT IT IS: ${w.name} — ${w.blurb}`,
    ...(w.colour
      ? ['', 'Colour identity (keep the HUE — this is how the player tells it from the',
        `rest of the cast — but grim, desaturated and low-key, never vivid): ${w.colour}`]
      : []),
    '',
    STYLE_PART,
    '',
    'LAYOUT — the grid is a cutting guide, and it is cut blindly.',
    `Each panel is exactly 1/${w.cols} of the width and 1/${w.rows} of the height.`,
    `A ${IT} does NOT fill its panel — it is centred in it, at the size the`,
    'reference draws it, with clear magenta all round.',
    'Never let a limb, tail, weapon or shadow cross into a neighbouring panel.',
    'Do not add, drop, merge or reorder panels.',
    'Do NOT draw the panel edges. No boxes, borders, gutters, guides, rules or',
    'numbers — in ANY colour, magenta included. The magenta is the empty space the',
    `${ITS} sit in, not a grid to draw with: the space BETWEEN two panels is the`,
    `same flat background as the space around each ${IT}, and nothing marks the`,
    'join. The panels are found by measuring, so a drawn line is not a help, it is',
    'a mark that ends up welded into the sprite.',
    '',
    BACKGROUND_RULE,
    '',
    'The feet land on the same line in every panel — the same height from the',
    'bottom of the panel as in the reference. If the feet drift up or down',
    `between panels the ${IT} bobs when it ${hero ? 'runs' : 'walks'}.`,
    '· The reference draws a soft contact shadow under the feet. Keep one, the',
    '  same size in every panel, and keep it tight to the feet.',
    '',
    'BEFORE YOU CALL IT FINISHED, count and check:',
    `· ${w.cols} panels across, ${w.rows} down, ${w.frames} in all — and empty magenta`,
    `  above every ${IT}, with no extra row squeezed into it.`,
    `· The canvas is ${SHAPE}.`,
    `· Every panel holds the same ${IT}, at the same size, in the same colours,`,
    `  facing ${facing(w.faces)}.`,
    '· Every pixel that is not the character is flat, vivid #FF00FF — hold it',
    '  against a pure magenta swatch, not against your memory of one.',
    '',
    `OUTPUT: one image, ${w.w} x ${w.h} pixels (${RATIO}, landscape). If your tool has`,
    `an aspect-ratio control, set it to ${RATIO} — a square return crushes the grid`,
    'and cannot be cut. No labels, captions, numbers or watermarks.'
  ].join('\n')
}

/** The SHEET's pixels — a still is one panel, a cycle is its whole grid. */
export const sheetW = (s: StillSpec): number => s.w * colsOf(s)
export const sheetH = (s: StillSpec): number => s.h * rowsOf(s)

const ratioOf = (w: number, h: number): string =>
  w === h ? 'square (1:1)'
    : w * 9 === h * 21 ? 'landscape, 21:9'
      : w * 9 === h * 16 ? 'landscape, 16:9'
        : w === h * 2 ? 'landscape, 2:1'
          : w * 16 === h * 9 ? 'portrait, 9:16'
            : w > h ? `landscape, ${(w / h).toFixed(2)}:1`
              : `portrait, 1:${(h / w).toFixed(2)}`

const shapeOf = (s: StillSpec): string => ratioOf(sheetW(s), sheetH(s))

/** A ready-to-paste prompt for one still. No grid clause — there is no grid. */
/**
 * The panel-count block for an ANIMATED still.
 *
 * Lifted, deliberately, from `promptForWalk` — the same counting, the same
 * refusals, the same "do not add a row". That discipline was arrived at the
 * expensive way (returns came back as one panel, as a doubled grid, as a
 * contact sheet with captions) and an image model that has been taught one
 * sheet shape for the cast should not be handed a different one for a rock.
 *
 * The one thing it says that a walk's does not: WHAT IS ALLOWED TO MOVE. A
 * creature's whole body moves through a stride, but a projectile is a solid
 * object inside an effect, and only the effect may change. A meteor whose stone
 * grows, shrinks or wanders between panels is a rock that pulses when it falls
 * — and the head of a round is what the game measures its kill against, so a
 * head that moves in the art is a hitbox that lies.
 */
const cyclePrompt = (s: StillSpec): string[] => {
  const n = framesOf(s)
  const cols = colsOf(s)
  const rows = rowsOf(s)
  return [
    '',
    `READ THE PANELS. This is not one picture — it is ${n} frames of ONE LOOP.`,
    `The attached sheet is ${cols} columns x ${rows} rows = EXACTLY ${n} panels, read left`,
    'to right along the top row and then the row below.',
    '',
    `· ${n} panels. Not 1, not ${cols}, not ${n + 4}, not ${n * 2}. Exactly ${rows} rows of`,
    `  ${cols} — do not add a row, do not append the cycle again underneath.`,
    '· Repaint EVERY panel. A sheet where one panel is painted and the rest are',
    '  copies of it is the failure this whole sheet exists to avoid.',
    `· THE ${rows} ROWS ARE NOT ${rows} STATES. The top row is panels 1-${cols} and the row`,
    `  below is ${cols + 1}-${n}, of ONE continuous march. A sheet with one arrangement`,
    `  repeated across the top row and a second repeated across the bottom is`,
    '  what came back last time — it is two pictures, not eight, and it plays as',
    '  a thing that snaps between two poses.',
    `· All ${n} panels are DIFFERENT from each other, and each differs from the one`,
    '  beside it by the SAME small step. Even spacing is the animation; a sheet',
    '  that holds still and then jumps reads as dropped frames.',
    '· Each panel is exactly 1/' + String(cols) + ' of the width and 1/' + String(rows) + ' of the height,',
    '  on an exact grid with no gutters. The cut is done by arithmetic.',
    '',
    `WHAT MOVES: ${s.cycle ?? 'the effect around the subject, and only that.'}`,
    ...(s.panels && s.panels.length === n
      ? ['',
        'PANEL BY PANEL — measure each one against panel 1, not against its',
        'neighbour, or the error accumulates and the loop will not close:',
        ...s.panels.map((line, i) => `· panel ${i + 1}: ${line}.`)]
      : []),
    '',
    'IT MUST LOOP. The game plays these end to end, forever, several times a',
    `second: after panel ${n} it goes straight back to panel 1. So panel ${n} has to`,
    'flow into panel 1 as smoothly as panel 1 flows into panel 2. Do not build a',
    'sequence that starts small and ends big — that pops once per loop, and at',
    'this speed a pop reads as a dropped frame.',
    '',
    'The SUBJECT keeps the same size, the same colours and the same place in the',
    'panel throughout — it is one object seen at eight moments, not eight',
    'objects. Only what is written under WHAT MOVES may change.',
    '',
    'EVERY PANEL IS ITS OWN PICTURE. Flame, sparks and glow stay inside the',
    'panel they belong to — nothing reaches across a panel edge into its',
    'neighbour, and the magenta between panels stays flat magenta. The sheet is',
    'cut on an exact grid, so anything that crosses a boundary is sliced in half',
    'and arrives in the game as a stray smear on the frame next door.'
  ]
}

export const promptForStill = (s: StillSpec): string => {
  const fill = !!s.fill
  const sky = s.bg === 'magenta-sky'
  const opaque = s.bg === 'opaque'
  const cycle = framesOf(s) > 1
  return [
    `# ${s.id} — ${s.name}  (${s.target})`,
    '',
    cycle
      ? `Repaint an ${framesOf(s)}-frame ANIMATION LOOP of one game sprite, as a single`
        + `
${shapeOf(s)} sheet of ${colsOf(s)} x ${rowsOf(s)} panels.`
      : `Paint ONE game sprite in a single ${shapeOf(s)} image.`,
    'The attached reference is exactly what to paint, at exactly the size and',
    'position it is drawn at. Match both.',
    '',
    `WHAT IT IS: ${s.blurb}`,
    ...(cycle ? cyclePrompt(s) : []),
    ...(s.live ? ['', `LEAVE OUT WHAT THE GAME PAINTS LIVE. ${s.live}`] : []),
    ...(s.kind === 'gate'
      ? ['',
        'THE POSTS — measure them against the FRAME, not against your idea of a gate.',
        `In the reference each post is a pillar ${pct(GATE_POST.width)} of the frame wide, its outer`,
        `face ${pct(GATE_POST.outer)} in from the frame's edge and its inner face ${pct(GATE_POST.inner)} in.`,
        'That is as wide as a post can be. Paint it EXACTLY that wide — the width the',
        'reference draws it, not wider, not a pair, not a wall. The DOORWAY between',
        `the two inner faces is ${pct(GATE_POST.doorway)} of the width and it is EMPTY from the lintel`,
        'to the ground: nothing stands in it, nothing leans into it, no rubble, no',
        'floor, no shadow.',
        '· Exactly TWO posts: one at the left edge, one at the right. Not a pair per',
        '  side, not a slab beside a pillar, not a wall.',
        '· A post wider than the reference is squeezed thinner by the slicer until it',
        '  fits — the painting survives, squashed. The last three returns had posts',
        '  three times the reference width, and every one of them came back as a',
        '  squeezed sliver.',
        '· Bulk goes UP — a taller cap, a finial, a heavier lintel — never sideways.',
        '· The lintel or arch across the top is thin and can be stretched; nothing',
        '  else spans the doorway. Anything painted below the lintel between the',
        '  posts is thrown away.']
      : []),
    ...(s.authored
      ? cycle
        // A cycle sheet is asked for motion by definition, so the "at rest"
        // clause would contradict `WHAT MOVES` two paragraphs above it. What
        // survives is the ORIENTATION, which the game still turns.
        ? ['', `ORIENTATION, in every panel: ${s.authored}. No motion blur and no speed`,
          'lines — the movement is in the difference between the panels, and the',
          'game turns and travels the sprite itself.']
        : ['', `DRAW IT AT REST, ${s.authored}. Do not add motion blur, speed lines or`,
          'a second copy of it: the game turns and moves it out of this one picture.']
      : []),
    ...(s.greyscale
      ? ['', 'GREYSCALE ONLY. Paint it in white through grey with alpha — no colour',
        'at all. The game tints it per emitter (dust, soot, blood), and any colour',
        'painted in here fights every one of those tints.']
      : []),
    ...(s.glow ? ['', GLOW_RULE] : []),
    '',
    fill ? STYLE_FILL : STYLE_PART,
    '',
    cycle
      ? 'SIZE AND PLACEMENT (this is per PANEL) — this is the part that goes wrong.'
      : 'SIZE AND PLACEMENT — this is the part that goes wrong.',
    fill
      ? 'The subject fills its frame edge to edge, exactly as the reference does.\nDo not shrink it onto a card or leave a polite margin.'
      : 'Do not enlarge it to fill the frame. The reference leaves air around the\nsubject and that air is not waste — it is where the things drawn live around\nit go. Keep the subject the same fraction of the frame that the reference\nhas it, in the same place.',
    ...(s.anchor === 'feet'
      ? ['· Its bottom edge must land at the same height from the bottom of the',
        '  frame as the reference has it — the game registers the return by it.']
      : []),
    '· Do not rotate it or change the viewing angle.',
    '· No cast shadow on the ground. The game draws its own.',
    '',
    opaque
      ? 'BACKGROUND: none. This image is FULLY OPAQUE from edge to edge — no\ntransparency, no checkerboard, no magenta anywhere.'
      : sky
        ? [
          'BACKGROUND — read this before anything else.',
          'Everything ABOVE the ridge line is sky, and it must be solid, flat, pure',
          'magenta #FF00FF — a green-screen colour, keyed out automatically. NOT',
          'transparent: transparency gets exported as a grey-and-white CHECKERBOARD',
          'and then baked in as though the squares were paint. NOT white, NOT pale',
          'blue, NOT a gradient or haze. BELOW the ridge line the artwork is fully',
          'opaque black, right down to the bottom edge — do not fade it out.'
        ].join('\n')
        : BACKGROUND_RULE,
    ...(s.tile === 'x'
      ? ['', 'SEAMLESSLY TILEABLE, HORIZONTALLY. This image is repeated end to end, so',
        'the right edge must join the left edge with no visible seam, no matching',
        'feature straddling the join, and no vignette or fade at either side. It',
        'does NOT need to tile vertically.']
      : s.tile === 'xy'
        ? ['', 'SEAMLESSLY TILEABLE ON BOTH AXES. This image is repeated across the road',
          'in every direction, so the right edge must join the left and the bottom',
          'edge must join the top with no visible seam, no feature straddling a join,',
          'and no vignette or fade anywhere. Keep it even: one bright stone in the',
          'middle becomes a polka-dot pattern across the whole road.']
        : []),
    ...(s.kind === 'gate'
      ? ['',
        'BEFORE YOU CALL IT FINISHED, count and check:',
        `· Two posts, one per side, each ${pct(GATE_POST.width)} of the frame wide — the width the`,
        `  reference draws them — with the doorway ${pct(GATE_POST.doorway)} of the width between them.`,
        '· The doorway between them is empty magenta from the lintel down to the',
        '  ground.',
        '· No shadow on the ground, no ground at all — the posts stand on magenta.']
      : []),
    ...(cycle
      ? ['',
        'BEFORE YOU CALL IT FINISHED, count and check:',
        `· ${colsOf(s)} panels across, ${rowsOf(s)} down, ${framesOf(s)} in all — no extra row.`,
        `· No two of the ${framesOf(s)} panels are identical. In particular the ${colsOf(s)} panels of a`,
        '  row are 4 different moments, not one moment repeated across the row.',
        '· Every panel holds the same object at the same size, in the same place,',
        '  in the same colours.',
        `· Panel ${framesOf(s)} leads back into panel 1.`,
        '· Every pixel that is not the sprite is flat, vivid #FF00FF.']
      : []),
    '',
    'OUTPUT — read this twice, it is where every previous attempt failed:',
    `· ONE image, exactly ${sheetW(s)} x ${sheetH(s)} pixels — ${shapeOf(s)}.`,
    '  If your tool has an aspect-ratio control, set it to match. Returns have',
    '  come back at the tool\'s default ratio before, which overrides this line —',
    '  the setting wins, so change the setting.',
    cycle
      ? `· ONE object, painted ${framesOf(s)} times as ${framesOf(s)} moments of one loop. Not `
        + 'variants,\n  not a comparison, not a turnaround, not a before-and-after pair.'
      : '· ONE object. Not two, not a comparison, not variants side by side, not a\n  before-and-after pair.',
    '· No frame, border, card, label, caption, arrow, annotation or drop shadow.'
  ].join('\n')
}

// ─── Consistency with the runtime catalogue ─────────────────────────────────

/** Every still id the manifest paints for a kind, in manifest order. */
export const stillIds = (kind: ArtKind): string[] =>
  STILLS.filter((s) => s.kind === kind).map((s) => s.id)


/** Ids the runtime probes that the manifest does not paint, and vice versa. */
export const catalogueDrift = (): { unpainted: string[]; unprobed: string[] } => {
  const unpainted: string[] = []
  const unprobed: string[] = []
  for (const [kind, ids] of Object.entries(ART_CATALOGUE)) {
    const painted = new Set(stillIds(kind as ArtKind))
    for (const id of ids) if (!painted.has(id)) unpainted.push(`${kind}/${id}`)
    for (const id of painted) {
      // The logo is painted but never probed; see `artCatalogue`.
      if (!ids.includes(id) && !(kind === 'ui' && id === 'logo')) unprobed.push(`${kind}/${id}`)
    }
  }
  return { unpainted, unprobed }
}
