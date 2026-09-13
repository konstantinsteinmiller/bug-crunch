import { BUGS, type BugId } from '@/game/bugs'
import { SHOES } from '@/game/shoes'
import { BOSSES, type BossId } from '@/game/bosses'
import { HAZARDS } from '@/game/hazards'
import { WORLDS } from '@/game/stages'
import { ART_FOLDERS, type ArtKind } from '@/game/art'
import { BANNER } from '@/game/uiArt'
import { SHOE_BOX } from '@/game/artBoxes'

/**
 * ─── Art sheet manifest ─────────────────────────────────────────────────────
 *
 * Splatix draws everything procedurally, which is wonderful for payload and
 * useless for one specific job: handing the art to somebody — or something —
 * that paints. There is no folder of PNGs to send. This module describes the
 * REFERENCE SHEETS that bake the whole cast out of the renderer, so the art can
 * leave, be repainted in a hand-drawn cozy-cute hand, and come back in as
 * drop-ins.
 *
 * Two shapes of sheet:
 *
 *   WALKS   a grid of panels showing one creature through one locomotion
 *           cycle. Each panel is the bake's own frame box scaled up, so a
 *           painted strip drops straight back in with the body on the same
 *           centre and nothing downstream has to be told where it is.
 *   STILLS  one object per image. A still is a one-frame walk to the slicer,
 *           which is what gives every prop, shoe and effect the same fit step
 *           the creatures get: the return is measured against the reference and
 *           normalised onto it, so a crumb pile painted with a polite margin
 *           still fills its box in play.
 *
 * THE BOX IS THE CONTRACT. Every still is drawn by the renderer's OWN painter
 * into exactly the rectangle the renderer blits the painting back into. Get the
 * bench and the runtime out of step and every painted part is the wrong size,
 * everywhere, invisibly — so the bench never carries a size of its own; it reads
 * the same constants the painters do.
 *
 * Nothing here imports a canvas. The manifest says WHAT goes on each sheet and
 * WHERE the result belongs; `ArtSheets.vue` knows how to paint it. It must stay
 * loadable under plain Node — `pnpm art:prompts` renders these prompts without
 * a browser.
 */

// ─── The house style ────────────────────────────────────────────────────────
//
// One paragraph, pasted into every prompt. It is the single most load-bearing
// text in the pipeline: a set of returns that each look lovely and share no
// style is worse than no paintings at all, because the game then looks like a
// collage. Stated as CONCRETE marks a painter can check off rather than as
// adjectives, for the reason every clause in this file is: "cute" is not an
// instruction and "a warm near-black outline that thickens on the shadow side"
// is.

export const HOUSE_STYLE = [
  'THE LOOK — every panel, without exception:',
  '· Hand-drawn 2D cartoon in a cozy, cute, modern anime register — the look of a',
  '  gentle picture-book game for children, NOT a gritty or realistic one.',
  '· A warm near-black ink contour (#2b1b2e, never pure black) around every shape,',
  '  drawn with a slightly uneven pressure so it thickens on the shadow side and',
  '  thins where the light hits. It reads as a brush, not as a border.',
  '· Flat, saturated fills with ONE soft cel shadow and ONE soft top-light per',
  '  shape. No gradients running the whole body, no photographic texture, no',
  '  airbrush, no lens flare.',
  '· Big glossy eyes with TWO white highlights — a large one at ten o\'clock and a',
  '  small one at four. Round pupils. Soft pink blush ovals on the cheeks of any',
  '  creature that has cheeks.',
  '· Rounded silhouettes. The only sharp angles anywhere in this game belong to',
  '  things that are meant to hurt (a caterpillar\'s spikes, a robot\'s chassis) and',
  '  they should read as the exception.',
  '· Key light from the UPPER LEFT, always, on every drawable.',
  '· NO gore, NO blood, NO realistic insect photography, NO horror. Squished bugs',
  '  burst into bright cartoon slime; that is as far as it ever goes.',
  '· No text, no captions, no watermarks, no logos, no signature anywhere in the',
  '  image.'
].join('\n')

// ─── Walk cycles ────────────────────────────────────────────────────────────

/** Panels per sheet. Eight reads as a gait; sixteen is twice the drift. */
export const WALK_FRAMES = 8

/** Grid, chosen so the sheet lands on a clean ratio every tool offers. */
export const WALK_COLS = 4
export const WALK_ROWS = WALK_FRAMES / WALK_COLS

/**
 * One panel, px. A bug's frame box is SQUARE (the renderer spins it about its
 * centre), so a panel is 320 x 320 and the sheet 4 x 320 by 2 x 320 = 1280 x 640,
 * exactly 2:1.
 */
export const WALK_PANEL = 320

export interface WalkSpec {
  kind: 'bug'
  /** The DESIGN id — `images/bugs/<id>.webp` is where it lands. */
  id: string
  file: string
  target: string
  name: string
  /** What it is, in one paragraph a painter can follow. */
  blurb: string
  /** The hue identity, as a sentence. */
  colour: string
  /** Which way the design is authored. Every bug in this game is drawn from
   *  DIRECTLY ABOVE with its head pointing to the TOP of the panel; the game
   *  rotates the whole frame by the body's heading. */
  faces: 'top-down'
  /** What changes between panels — the gait, stated per creature. */
  motion: string
  cols: number
  rows: number
  frames: number
  panelW: number
  panelH: number
  w: number
  h: number
  /** Output cap for one frame's tall edge, px. */
  maxEdge: number
}

/**
 * The cast, in the words a painter needs.
 *
 * Every entry keeps its SILHOUETTE — the shape the player has learned to read at
 * 30 px is the whole of the creature's identity in play — and describes the
 * drawing the code is already making, not a different creature that happens to
 * have the same name.
 */
const CAST: Record<BugId, { blurb: string; colour: string; motion: string }> = {
  ant: {
    blurb: 'A worker ant seen from DIRECTLY ABOVE: three round lobes in a line — a'
      + ' big soft abdomen at the bottom, a small waist in the middle, a friendly round'
      + ' head at the top — six thin bent legs splayed three a side, and two curling'
      + ' antennae with a little bead on each tip. Two big glossy eyes on the head'
      + ' looking up the panel, and pink blush. It is cheerful and completely harmless.',
    colour: 'a warm chestnut-brown body going darker at the waist, a cream belly'
      + ' highlight, cream antenna beads.',
    motion: 'The six legs swing in a TRIPOD gait — front-left, middle-right and'
      + ' back-left forward together while the other three go back — and the body bobs'
      + ' a hair up and down. The antennae sweep gently side to side. Nothing else moves.'
  },
  beetle: {
    blurb: 'A rhinoceros beetle from DIRECTLY ABOVE: one big glossy domed shell'
      + ' filling most of the panel with a seam straight down the middle and two pale'
      + ' spots either side of it, six short sturdy legs, a small head tucked under the'
      + ' shell\'s front edge with a single curved horn pointing up the panel. Two small'
      + ' cross eyes with a slanted brow over each — it is grumpy, not frightening.',
    colour: 'a deep emerald-green shell with a lighter mint crown where the light'
      + ' hits, a near-black underside, an ivory horn, pale mint spots.',
    motion: 'It CRAWLS: short, heavy, slow leg swings in a tripod gait and almost no'
      + ' body movement at all. The shell never changes shape.'
  },
  flea: {
    blurb: 'A cartoon flea from DIRECTLY ABOVE: a small teardrop body pointing up the'
      + ' panel, a little round head at the top, two enormous folded spring legs'
      + ' trailing down and out behind it, four small legs at the front, two short'
      + ' antennae. Huge round eyes and a nervous, coiled look — it is about to jump.',
    colour: 'a dusk-purple body going lavender where the light hits, a near-black'
      + ' seat, pale blue-white highlights, cool blue blush.',
    motion: 'A HOP cycle: it crouches lower and lower through the first panels with'
      + ' the spring legs folding tighter, then in one panel it is stretched and lifted'
      + ' — smaller against the panel, legs extended — and it settles back down. Only'
      + ' ONE panel is the launch.'
  },
  caterpillar: {
    blurb: 'A woolly-bear caterpillar from DIRECTLY ABOVE: five round beads in a'
      + ' vertical row, the head bead at the top with two big eyes and a cross little'
      + ' brow, and stubby black SPIKES in threes sticking out of both sides of the'
      + ' second and fourth beads. The spikes are the one sharp thing on it and they'
      + ' must read as a warning.',
    colour: 'alternating lime-green and darker moss beads, a golden-yellow head bead,'
      + ' near-black spikes, pink blush on the head.',
    motion: 'A RIPPLE travels down the body from head to tail: each bead swells a'
      + ' little and shrinks again, one after the other, so the hump moves along it.'
      + ' The beads never separate.'
  },
  stinkbug: {
    blurb: 'A shield bug from DIRECTLY ABOVE: a blunt five-sided shield-shaped back'
      + ' filling the panel, six legs, two antennae, and two small round vent nubs at'
      + ' the BOTTOM edge of the shield — the part the smell comes out of. Two big'
      + ' glossy eyes near the top of the shield, and a faintly embarrassed expression.',
    colour: 'a dusty plum-purple shield going darker toward the bottom, lilac'
      + ' highlights, pale violet vent nubs, violet blush.',
    motion: 'A slow WANDER: the legs swing in a tripod gait and the whole body rocks'
      + ' very slightly left and right. The antennae sweep.'
  },
  centipede: {
    blurb: 'The HEAD SEGMENT ONLY of a centipede, from DIRECTLY ABOVE: one rounded'
      + ' armoured plate with two curved mandibles at the top of the panel, two legs a'
      + ' side, two antennae. Two bright eyes with a slanted brow. It is the head of a'
      + ' long creature whose body is drawn by the game — do NOT paint a body or a tail.',
    colour: 'a hot amber-orange plate with a pale gold crown, a dark rust underside,'
      + ' ivory mandibles.',
    motion: 'A fast scuttle: the four legs blur through a tripod gait and the head'
      + ' rocks a few degrees left and right. The mandibles open and close once.'
  },
  pinatafly: {
    blurb: 'A party piñata fly from DIRECTLY ABOVE: a plump striped body pointing up'
      + ' the panel, two big round compound eyes wrapping the head, and two translucent'
      + ' wings spread either side. The body is painted in four bright horizontal'
      + ' stripes like crepe paper on a piñata. It is delighted with itself.',
    colour: 'a golden-yellow body with stripes of hot pink, sky blue, mint green and'
      + ' lilac; bright red compound eyes; pearly translucent wings.',
    motion: 'The WINGS beat fast — several full up-and-down beats across the eight'
      + ' panels, so consecutive panels show clearly different wing positions — while'
      + ' the body only bobs. Everything else is still.'
  },
  moth: {
    blurb: 'A cozy attic moth from DIRECTLY ABOVE with its wings SPREAD: two big'
      + ' scalloped wings either side of a small furry body, each wing carrying one'
      + ' round eyespot, a fuzzy collar of short fur around the shoulders, two feathery'
      + ' antennae, two small sleepy eyes. Soft and dusty, never sinister.',
    colour: 'pale dove-grey and cream wings with a soft lavender wash at the edges,'
      + ' warm grey-brown body, cream eyespot rings with a soft dark centre.',
    motion: 'The wings beat SLOWLY — up at the start, down in the middle, up again'
      + ' at the end — and the antennae flick. The body drifts a hair up and down.'
  },
  robobug: {
    blurb: 'A toy robot beetle from DIRECTLY ABOVE: a hard-edged hexagonal chassis of'
      + ' riveted metal panels, a rectangular armour plate bolted across the middle'
      + ' with three ridge lines in it, six jointed mechanical legs, two little aerials'
      + ' with beads, and ONE round glowing cyclops sensor at the top instead of eyes.'
      + ' It is a friendly arcade robot, not a threat.',
    colour: 'slate blue-grey panels with a brushed steel plate, warm bolt heads, and'
      + ' a bright cyan sensor whose glow spills a little onto the plate around it.',
    motion: 'The legs step in a tripod gait, the sensor PULSES brighter and dimmer'
      + ' across the cycle, and the aerial beads wobble. The chassis is rigid.'
  }
}

const walkOf = (spec: (typeof BUGS)[number]): WalkSpec => ({
  kind: 'bug',
  id: spec.id,
  file: `walk-${spec.id}`,
  target: `${ART_FOLDERS.bug}/${spec.id}.webp`,
  name: spec.id,
  blurb: CAST[spec.id].blurb,
  colour: CAST[spec.id].colour,
  motion: CAST[spec.id].motion,
  faces: 'top-down',
  cols: WALK_COLS,
  rows: WALK_ROWS,
  frames: WALK_FRAMES,
  panelW: WALK_PANEL,
  panelH: WALK_PANEL,
  w: WALK_COLS * WALK_PANEL,
  h: WALK_ROWS * WALK_PANEL,
  // 160 px a frame is twice what the biggest body needs on a 4K screen, and
  // past that the strip is the heaviest thing the game downloads.
  maxEdge: 160
})

export const WALKS: WalkSpec[] = BUGS.map(walkOf)

// ─── Stills ─────────────────────────────────────────────────────────────────

export interface StillSpec {
  /** Runtime folder — and the probe kind. */
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
  /** Output cap for the tall edge, px. */
  maxEdge: number
  /** `maxEdge` is the size, not a cap — something outside the renderer reads
   *  the file at exactly that size (the PWA manifest reads the logo at 512). */
  exact?: true
  /** How the return is registered onto the reference. */
  anchor: 'centre' | 'feet'
  /**
   * `false` for a subject the slicer must NOT fit onto the reference.
   *
   * The fit measures SOLID pixels, and a drawn effect is mostly glow: a
   * shockwave ring's solid core is a fraction of its visible disc. A painting —
   * opaque strokes, all of it solid — fitted onto that box comes back a
   * fraction of the size it was painted at. These are placed by the prompt's own
   * words instead ("fills the frame edge to edge") and blitted as they arrive.
   */
  fit?: false
  /** What the empty part of the frame must be. */
  bg: 'magenta' | 'opaque'
  /** Must it join to itself across an edge? */
  tile?: 'x' | 'xy'
  /** The subject fills its frame edge to edge (a floor tile, a conveyor). */
  fill?: boolean
  /** Which way it is authored, when the game turns it. */
  authored?: string
  /** What the game paints OVER it — and therefore what must be left out. */
  live?: string
  /** A glow that must stay inside the outline. */
  glow?: boolean
  /** Colourless by contract; the game tints it. */
  greyscale?: boolean
  /** Panels of one loop, when the subject moves under its own power. */
  frames?: number
  cols?: number
  rows?: number
  /** What changes between those panels. */
  cycle?: string
}

export const framesOf = (s: StillSpec): number => s.frames ?? 1
export const colsOf = (s: StillSpec): number => s.cols ?? 1
export const rowsOf = (s: StillSpec): number => s.rows ?? 1

/** The square every ordinary still is authored in. 512 is enough detail for a
 *  prop that fills a 200 px circle on a 4K screen and small enough that a
 *  painter's return is one generation rather than a tiled upscale. */
const STILL_PX = 512

interface StillOpts {
  w?: number
  h?: number
  maxEdge?: number
  exact?: true
  anchor?: 'centre' | 'feet'
  fit?: false
  bg?: 'magenta' | 'opaque'
  tile?: 'x' | 'xy'
  fill?: boolean
  authored?: string
  live?: string
  glow?: boolean
  greyscale?: boolean
  frames?: number
  cols?: number
  rows?: number
  cycle?: string
  target?: string
  extra?: { target: string; size: number }[]
}

const still = (
  kind: ArtKind, id: string, name: string, blurb: string, o: StillOpts = {}
): StillSpec => ({
  kind,
  id,
  file: `still-${kind}-${id}`,
  target: o.target ?? `${ART_FOLDERS[kind]}/${id}.webp`,
  extra: o.extra,
  name,
  blurb,
  w: o.w ?? STILL_PX,
  h: o.h ?? STILL_PX,
  maxEdge: o.maxEdge ?? 256,
  exact: o.exact,
  anchor: o.anchor ?? 'centre',
  fit: o.fit,
  bg: o.bg ?? 'magenta',
  tile: o.tile,
  fill: o.fill,
  authored: o.authored,
  live: o.live,
  glow: o.glow,
  greyscale: o.greyscale,
  frames: o.frames,
  cols: o.cols,
  rows: o.rows,
  cycle: o.cycle
})

/** The shoes. Portrait panels — the leg needs headroom the shoe body does not. */
const SHOE_BLURB: Record<string, string> = {
  sneaker: 'A classic white canvas trainer seen from DIRECTLY ABOVE, toe pointing to'
    + ' the TOP of the panel, with a bare lower leg and ankle rising out of the top of'
    + ' the frame and a coloured sock cuff where they meet. Three lace rungs across the'
    + ' tongue and one bold curved stripe sweeping along the side.',
  steelBoot: 'A heavy tan leather work boot seen from DIRECTLY ABOVE, toe pointing to'
    + ' the TOP of the panel, with a polished STEEL TOE CAP covering the front third,'
    + ' four chunky lace rungs, a thick dark cuff, and a leg rising out of the top of'
    + ' the frame. Solid, heavy and obviously the hardest thing in the game.',
  bunnySlipper: 'A fluffy pink bunny slipper seen from DIRECTLY ABOVE, toe to the TOP'
    + ' of the panel, with two long soft ears laid back along its sides, a little face'
    + ' on the toe (two dot eyes, a pink nose, a small smile), a round white pompom'
    + ' tail at the heel, and a leg in a white cuff rising out of the top of frame.',
  rollerSkate: 'A hot-pink roller skate seen from DIRECTLY ABOVE, toe to the TOP of'
    + ' the panel, sitting on a dark chassis plate with FOUR wheels poking out beyond'
    + ' its sides — two at the front, two at the back — a gold star on the toe, and a'
    + ' leg in a bright cuff rising out of the top of frame.',
  cleatBoot: 'A teal football boot seen from DIRECTLY ABOVE, toe to the TOP of the'
    + ' panel, with SIX pale conical studs arranged across its sole — one at the toe,'
    + ' two at the ball, two at the arch, one at the heel — a dark cuff, and a leg'
    + ' rising out of the top of frame. The studs are the point of it.',
  electricSock: 'A thick blue-and-white hooped athletic sock worn with no shoe at'
    + ' all, seen from DIRECTLY ABOVE, toe to the TOP of the panel, with a bright'
    + ' yellow lightning bolt across the middle of the foot and a faint electric glow'
    + ' along the hoops. The leg rises out of the top of frame in the same sock.'
}

const SHOE_STILLS: StillSpec[] = SHOES.map((s) => still('shoe', s.id, `Shoe — ${s.id}`,
  SHOE_BLURB[s.id] ?? '', {
    w: Math.round(STILL_PX * (SHOE_BOX.w / SHOE_BOX.h)),
    h: STILL_PX,
    anchor: 'centre',
    maxEdge: 320,
    authored: 'Toe to the TOP of the panel. The game rotates the whole picture to'
      + ' point wherever the foot is travelling, so it must be drawn straight up.',
    live: 'The game draws a soft shadow ellipse and a bright hit-ring on the floor'
      + ' UNDER the shoe, so do not paint a shadow, a ring or any floor at all.'
  }))

/** The bosses. One still each, big, because the game never animates the body —
 *  the script does. */
const BOSS_BLURB: Record<BossId, string> = {
  queenAnt: 'The GOLIATH QUEEN ANT, from DIRECTLY ABOVE, head to the TOP of the'
    + ' panel: the same three-lobe worker ant the game is full of, but enormous — a'
    + ' huge round abdomen, a broad thorax, a regal head — with a small five-point gold'
    + ' CROWN sitting on her head. Long curling antennae, six heavy legs. Imperious and'
    + ' unimpressed, with big lidded eyes, but still cute.',
  beetleKing: 'The THORNBACK BEETLE KING, from DIRECTLY ABOVE, head to the TOP: the'
    + ' emerald rhinoceros beetle at four times the size, its shell crusted with heavy'
    + ' ridged plates and a row of blunt thorns down the seam, a huge ivory horn, and a'
    + ' small five-point gold crown on its head. Six thick armoured legs.',
  matriarch: 'The CENTIPEDE MATRIARCH\'s HEAD ONLY, from DIRECTLY ABOVE, pointing to'
    + ' the TOP of the panel: a huge armoured amber head plate with two great curved'
    + ' mandibles, long antennae, fierce but cartoonish eyes, and a small five-point'
    + ' gold crown. Do NOT paint a body or a tail — the game draws those.',
  roachPrime: 'MECHA ROACH PRIME, from DIRECTLY ABOVE, head to the TOP: a big'
    + ' armoured robot beetle of riveted slate panels and brushed steel plating with a'
    + ' single enormous glowing cyan sensor eye, two aerials, six heavy mechanical'
    + ' legs, and a small five-point crown of hot-pink neon. An arcade boss robot.'
}

const BOSS_STILLS: StillSpec[] = (Object.keys(BOSSES) as BossId[]).map((id) =>
  still('boss', id, `Boss — ${id}`, BOSS_BLURB[id], {
    w: 768, h: 768, maxEdge: 512, anchor: 'centre',
    authored: 'Head to the TOP of the panel; the game rotates the whole picture.',
    live: 'The game paints a health bar, a phase tell and a shadow around it, so'
      + ' leave the floor empty and do not paint any UI.'
  }))

/** The floor props. */
const HAZARD_BLURB: Record<string, string> = {
  honey: 'A puddle of golden honey seen from DIRECTLY ABOVE: an irregular glossy'
    + ' blob with a thick rounded rim, two soft white specular highlights, and a few'
    + ' small round air bubbles trapped in it. It looks delicious and extremely sticky.',
  magnet: 'A classic red horseshoe magnet seen from DIRECTLY ABOVE, its two arms'
    + ' pointing to the BOTTOM of the panel, with pale steel tips on both ends and a'
    + ' glossy red body. A toy magnet from a cartoon, not an industrial one.',
  salt: 'A ceramic salt shaker standing upright, seen from DIRECTLY ABOVE and'
    + ' slightly in front: a pale rounded body with a silver perforated cap at the TOP'
    + ' of the panel showing three small holes. Homely and kitchen-shaped.',
  sweeper: 'A wide mechanical sweeper bar lying HORIZONTALLY across the panel, seen'
    + ' from directly above: a rounded metal bar the full width of the frame with'
    + ' yellow-and-grey hazard chevrons along it and a row of small pale blades along'
    + ' its top edge. It must read as a machine that is about to move.',
  cobweb: 'A round cobweb seen from DIRECTLY ABOVE: nine radiating threads and four'
    + ' sagging concentric rings of pale silk, with three or four tiny dew drops'
    + ' catching the light. Delicate, silvery, and clearly sticky.',
  conveyor: 'A section of arcade conveyor belt seen from DIRECTLY ABOVE, running'
    + ' LEFT to RIGHT across the panel and filling it edge to edge: dark rubber slats,'
    + ' two glowing cyan rails along the top and bottom edges, and pale chevrons'
    + ' pointing to the RIGHT along the middle.',
  crumbs: 'A scattered pile of bread and biscuit crumbs seen from DIRECTLY ABOVE:'
    + ' eleven or so little golden rounded chunks of different sizes, loosely grouped,'
    + ' each with a soft crust edge and a paler crumb face.'
}

const PROP_STILLS: StillSpec[] = [
  ...HAZARDS.map((h) => still('prop', h.id, `Prop — ${h.id}`, HAZARD_BLURB[h.id] ?? '', {
    ...(h.id === 'conveyor' || h.id === 'sweeper'
      ? {
        fill: true,
        tile: 'x' as const,
        authored: 'Drawn running LEFT to RIGHT; the game rotates it to whatever'
          + ' angle the level puts it at.'
      }
      : {}),
    live: h.stompable
      ? 'The game may draw a burst over it when it is triggered, so paint it INTACT.'
      : undefined
  })),
  still('prop', 'pod', 'Boss egg pod',
    'A boss egg pod seen from DIRECTLY ABOVE: a smooth cream-and-gold oval egg with a'
    + ' faint warm glow showing through its shell from inside, standing on end. No'
    + ' cracks — the game draws those as it hatches.', {
      live: 'The game draws widening cracks and a brightening inner glow over it as'
        + ' the pod hatches, so paint it whole and evenly lit.'
    }),
  still('prop', 'coin', 'Coin',
    'A fat round gold coin seen face-on: a bevelled rim, a raised inner ring, a warm'
    + ' specular highlight at the upper left. Chunky and cartoonish, like an arcade'
    + ' token.', { maxEdge: 128, extra: [{ target: 'images/props/coin_128x128.webp', size: 128 }] })
]

/** The effects. Every one of these is placed by its own words rather than
 *  fitted, because a glow has no solid box to measure. */
const FX_STILLS: StillSpec[] = [
  still('fx', 'ring-stomp', 'Ring — quick stomp',
    'A thin white shockwave ring seen from DIRECTLY ABOVE, perfectly circular,'
    + ' brightest on its own edge and fading to nothing inward and outward. It fills'
    + ' the frame edge to edge with a small margin. Nothing inside the ring.',
    { fit: false, glow: true, greyscale: true, fill: true }),
  still('fx', 'ring-slam', 'Ring — heavy slam',
    'A THICK shockwave ring seen from DIRECTLY ABOVE, perfectly circular, with a'
    + ' ragged outer edge and a hot white core, fading inward. It fills the frame edge'
    + ' to edge with a small margin. Nothing inside the ring.',
    { fit: false, glow: true, greyscale: true, fill: true }),
  still('fx', 'ring-fever', 'Ring — Splat Fever',
    'A huge golden shockwave ring seen from DIRECTLY ABOVE with soft radiating spokes'
    + ' of light along its inside edge, filling the frame edge to edge. Celebratory and'
    + ' warm, like a firework going off flat on the floor.',
    { fit: false, glow: true, fill: true }),
  still('fx', 'burst', 'Comic burst',
    'A jagged comic-book starburst — eleven irregular points, flat colour, a heavy'
    + ' near-black ink outline — filling the frame. The kind of shape a cartoon puts'
    + ' behind a shouted word. Solid, with nothing drawn inside it.',
    { fit: false, greyscale: true, fill: true,
      live: 'The game writes a word over the middle of it, so keep the centre plain.' }),
  still('fx', 'haze', 'Stink haze',
    'A soft round cloud of purple gas seen from DIRECTLY ABOVE: three overlapping'
    + ' billows, densest in the middle, feathering away to nothing at the edges. Comic'
    + ' and stylised, never photographic smoke.',
    { fit: false, glow: true }),
  still('fx', 'salt-cloud', 'Salt burst',
    'A ring of scattered white salt grains flying outward, seen from DIRECTLY ABOVE:'
    + ' dozens of tiny square-ish specks, denser near the ring and sparse beyond it.'
    + ' The middle of the frame is empty.',
    { fit: false, greyscale: true, fill: true }),
  still('fx', 'spark', 'Ricochet spark',
    'A small four-point star of bright white-yellow light with two thin streaks'
    + ' crossing it — the spark a boot throws off armour. Flat cartoon light, not a'
    + ' lens flare.',
    { fit: false, glow: true, maxEdge: 128 }),
  still('fx', 'scorch', 'Scorch mark',
    'An irregular dark scorch stain seen from DIRECTLY ABOVE, densest at the middle'
    + ' and ragged at its edges, as if something very heavy landed there. Flat, matte,'
    + ' no glow.',
    { greyscale: true, fit: false }),
  still('fx', 'smoke', 'Dust puff',
    'One soft round dust puff seen from DIRECTLY ABOVE: a billowy cauliflower cloud'
    + ' with rounded lobes, lit from the upper left, fading at the edges. Grey and'
    + ' WHITE only.',
    { greyscale: true, fit: false })
]

/** The floors. One tile per world, and every one of them must tile. */
const FLOOR_BLURB: Record<number, string> = {
  1: 'A seamless tile of a red-and-cream gingham picnic blanket seen from DIRECTLY'
    + ' ABOVE: a four-by-four check of woven squares with a visible fabric weave, and a'
    + ' few tiny stray crumbs scattered on it.',
  2: 'A seamless tile of mown garden grass seen from DIRECTLY ABOVE: dense short'
    + ' blades leaning in slightly different directions, a few clover leaves, dappled'
    + ' light. Fresh and green.',
  3: 'A seamless tile of dusty attic floorboards seen from DIRECTLY ABOVE: two wide'
    + ' worn planks running left to right with a dark seam between them, visible wood'
    + ' grain, four small nail heads, and a scatter of pale dust.',
  4: 'A seamless tile of a neon arcade floor seen from DIRECTLY ABOVE: near-black'
    + ' lino divided by glowing cyan grid lines into four-by-four cells, with faint'
    + ' horizontal scanlines and one soft magenta glow pooling in a cell.'
}

const FLOOR_STILLS: StillSpec[] = ([1, 2, 3, 4] as const).map((w) =>
  still('bg', `floor-${w}`, `Floor — ${WORLDS[w].theme}`, FLOOR_BLURB[w]!, {
    w: 512, h: 512, maxEdge: 512, exact: true,
    bg: 'opaque', tile: 'xy', fill: true, fit: false,
    live: 'The game stamps bright splats, shadows and props over this, so keep it'
      + ' MID-TONE and quiet — texture, not objects. Nothing here may read as a thing'
      + ' the player could stomp.'
  }))

/** The HUD's own art. */
const UI_STILLS: StillSpec[] = [
  still('ui', 'ribbon', 'Result banner',
    'A wide cartoon ribbon banner seen flat-on, in picnic red and cream, with'
    + ' swallow-tailed notches cut into both ends, a gold bind running along the top'
    + ' and bottom edges, one round gold button at each notch and a small cream stitch'
    + ' at each corner. The MIDDLE of the banner is a plain unbroken red band.', {
      w: BANNER.w, h: BANNER.h, maxEdge: 576, fit: false, anchor: 'centre',
      live: 'The game writes the result title across the middle and STRETCHES the'
        + ' middle band to fit it, so the middle must stay plain and every piece of'
        + ' detail must sit inside the outer 17% of each end.'
    }),
  still('ui', 'locker', 'Locker mark',
    'A single white boot silhouette on a transparent background, seen in profile,'
    + ' facing right, with a cuff and two lace rungs. A flat solid shape with no'
    + ' outline and no shading — an icon, not an illustration.',
    { maxEdge: 128, greyscale: true, fit: false }),
  still('ui', 'fever', 'Fever mark',
    'A single white flame silhouette on a transparent background: one bold teardrop'
    + ' tongue with a smaller lick beside it. A flat solid shape with no outline and no'
    + ' shading.', { maxEdge: 128, greyscale: true, fit: false }),
  still('ui', 'star', 'Star mark',
    'A single white five-point star on a transparent background, points sharp, flat'
    + ' and solid, no outline and no shading.',
    { maxEdge: 128, greyscale: true, fit: false }),
  still('ui', 'timer', 'Timer mark',
    'A single white clock silhouette on a transparent background: a ring with a gap'
    + ' at its top right and two hands. Flat and solid, no shading.',
    { maxEdge: 128, greyscale: true, fit: false }),
  still('ui', 'target', 'Accuracy mark',
    'A single white crosshair on a transparent background: a ring, four ticks and a'
    + ' solid centre pip. Flat and solid, no shading.',
    { maxEdge: 128, greyscale: true, fit: false }),
  still('ui', 'trophy', 'Leaderboard mark',
    'A single white trophy cup silhouette on a transparent background: a bowl, two'
    + ' handles, a stem and a base. Flat and solid, no shading.',
    { maxEdge: 128, greyscale: true, fit: false })
]

/**
 * The logo.
 *
 * Never probed at run time — the PWA manifest and every portal read it at fixed
 * sizes from `images/logo/`, so its targets are explicit and its `maxEdge` is
 * `exact`.
 */
const LOGO_STILL: StillSpec = still('ui', 'logo', 'Splatix logo',
  'The word SPLATIX as a chunky hand-drawn cartoon wordmark, painted as if the'
  + ' letters themselves were squeezed out of bright slime: fat rounded letterforms'
  + ' with a heavy warm near-black outline, a glossy highlight along the top of every'
  + ' letter, and a magenta-and-lime splat bursting out from behind the word. Above'
  + ' or beside the word, one cartoon sneaker sole coming down. On a transparent'
  + ' background, centred, with a small even margin.', {
    w: 1024, h: 1024, maxEdge: 512, exact: true, fit: false,
    target: 'images/logo/logo_512x512.png',
    extra: [
      { target: 'images/logo/logo_256x256.webp', size: 256 },
      { target: 'images/logo/logo_192x192.png', size: 192 },
      { target: 'images/icons/logo_512x512.png', size: 512 },
      { target: 'images/icons/logo_256x256.webp', size: 256 },
      { target: 'images/icons/logo_192x192.png', size: 192 }
    ]
  })

export const STILLS: StillSpec[] = [
  ...SHOE_STILLS,
  ...BOSS_STILLS,
  ...PROP_STILLS,
  ...FX_STILLS,
  ...FLOOR_STILLS,
  ...UI_STILLS,
  LOGO_STILL
]

/** Everything the pipeline can produce, as `kind/id` — the id space the Art
 *  Desk searches and `art:status` reports on. */
export const ALL_SHEETS: Array<WalkSpec | StillSpec> = [...WALKS, ...STILLS]

// ─── Prompts ────────────────────────────────────────────────────────────────

const layoutRules = (cols: number, rows: number, frames: number): string[] => [
  `THE GRID — ${cols} columns across, ${rows} row${rows > 1 ? 's' : ''} down,`
  + ` ${frames} panels read left to right along the top row` + (rows > 1 ? ', then the next.' : '.'),
  '· Every panel is the SAME SIZE and the panels touch — no gutters, no borders, no',
  '  frames drawn around them, no numbers, no labels.',
  '· The subject is CENTRED in its panel and the SAME SIZE in every panel. It never',
  '  drifts, never grows, never leaves the panel.',
  '· The background of every panel is FLAT MAGENTA #FF00FF, edge to edge, with',
  '  nothing else on it — no shadow, no floor, no gradient, no vignette. The magenta',
  '  is keyed out; anything else on it becomes part of the sprite.'
]

/** A ready-to-paste prompt for one walk sheet. */
export const promptForWalk = (w: WalkSpec): string => [
  `# ${w.id} — ${w.name}  (${w.target})`,
  '',
  `A SPRITE SHEET: ${w.frames} panels of ONE creature through ONE loop of its own`,
  'movement. One image comes with this prompt:',
  `  \`art-sheets/${w.file}.png\` — THE LAYOUT: the game's own rough placeholder`,
  '     drawing. FOLLOW ITS SHAPE AND ITS POSES — where the body, legs, antennae and',
  '     eyes are in each panel, and how big the creature is in its panel — and take',
  '     nothing else from it: not its line weight, its colours, its shading or its',
  '     style. It is a flat stand-in for a painting that does not exist yet.',
  '',
  `WHAT IT IS: ${w.blurb}`,
  '',
  `COLOUR: ${w.colour}`,
  '',
  `THE VIEW: seen from DIRECTLY ABOVE, looking straight down at the floor. Its head`,
  '  points to the TOP of every panel and it never turns — the game rotates the whole',
  '  picture to point it wherever it is walking. Do not draw it in profile, do not',
  '  draw it three-quarters on, and do not tilt it.',
  '',
  `THE MOVEMENT: ${w.motion}`,
  '· No two panels are the same. A sheet where four panels are identical is a sheet',
  '  the game plays as a creature that freezes four times a second.',
  '',
  ...layoutRules(w.cols, w.rows, w.frames),
  '',
  HOUSE_STYLE
].join('\n')

/** A ready-to-paste prompt for one still. */
export const promptForStill = (s: StillSpec): string => {
  const n = framesOf(s)
  const lines: string[] = [
    `# ${s.id} — ${s.name}  (${s.target})`,
    '',
    n > 1
      ? `A SPRITE SHEET: ${n} panels of ONE object through ONE loop of its own movement.`
      : 'A SINGLE OBJECT, alone in the frame.',
    'One image comes with this prompt:',
    `  \`art-sheets/${s.file}.png\` — THE LAYOUT: the game's own rough placeholder`,
    '     drawing, at exactly the size and position the painting must land at. Match',
    '     its SHAPE, its SIZE IN THE FRAME and its ORIENTATION; take nothing else.',
    '',
    `WHAT IT IS: ${s.blurb}`,
    ''
  ]
  if (s.authored) lines.push(`ORIENTATION: ${s.authored}`, '')
  if (s.live) lines.push(`WHAT THE GAME DRAWS OVER IT: ${s.live}`, '')
  if (s.tile) {
    lines.push(
      s.tile === 'xy'
        ? 'IT MUST TILE IN BOTH DIRECTIONS: every mark that runs off the left edge'
        + ' continues at exactly the same height on the right, and every mark that runs'
        + ' off the top continues at exactly the same place on the bottom. Laid out four'
        + ' by four it must show no seam anywhere.'
        : 'IT MUST TILE LEFT TO RIGHT: every mark that runs off the left edge continues'
        + ' at exactly the same height on the right. Laid end to end it must show no'
        + ' seam.',
      ''
    )
  }
  if (s.fill) {
    lines.push('IT FILLS THE FRAME edge to edge. No margin, no border, no background'
      + ' showing around it.', '')
  }
  if (s.greyscale) {
    lines.push('COLOURLESS BY CONTRACT: paint it in WHITE and GREY only. The game tints'
      + ' it per use, and any colour painted in here fights that tint.', '')
  }
  if (s.glow) {
    lines.push('THE GLOW STAYS INSIDE THE FRAME: it may fade to nothing at the edges,'
      + ' but nothing may be clipped off by them.', '')
  }
  if (n > 1 && s.cycle) lines.push(`THE MOVEMENT: ${s.cycle}`, '')
  if (n > 1) lines.push(...layoutRules(colsOf(s), rowsOf(s), n), '')
  else if (s.bg === 'magenta') {
    lines.push('THE BACKGROUND is FLAT MAGENTA #FF00FF, edge to edge, with nothing else'
      + ' on it — no shadow, no floor, no gradient, no vignette. The magenta is keyed'
      + ' out; anything else on it becomes part of the sprite.', '')
  } else {
    lines.push('THE IMAGE IS FULLY OPAQUE: it has no transparent parts and no magenta.', '')
  }
  lines.push(HOUSE_STYLE)
  return lines.join('\n')
}

/**
 * The prompt documents, keyed by filename.
 *
 * Written into `art-sheets/` by `pnpm art:prompts`, so the text a painter is
 * handed and the text this manifest generates are one thing and cannot drift.
 */
export const promptDocs = (): Record<string, string> => ({
  'PROMPTS-WALKS.md': [
    '# Walk-cycle prompts — one design per generation',
    '',
    'Generated from the manifest — do not hand-edit, re-export instead.',
    '',
    'Attach `art-sheets/walk-<id>.png` and paste the matching block beside it.',
    'Each is a grid of panels showing ONE creature through ONE cycle, and the',
    'whole job is that it comes back as one creature and not eight.',
    '',
    'Drop results in `art-sheets/painted/`, keeping the `walk-<id>` in the name,',
    'then run `pnpm slice-sheets`. The slicer cuts the grid by proportion, so an',
    'off-size return is fine as long as the panels are where the grid says.',
    '',
    ...WALKS.map((w) => ['---', '', '```', promptForWalk(w), '```', ''].join('\n'))
  ].join('\n'),

  'PROMPTS-STILLS.md': [
    '# Still prompts — one object per generation',
    '',
    'Generated from the manifest — do not hand-edit, re-export instead.',
    '',
    'Attach `art-sheets/still-<kind>-<id>.png` and paste the matching block.',
    'Every still is registered onto its reference by the slicer, so an object',
    'painted with a polite margin still fills its box in play — EXCEPT the ones',
    'marked as effects, which are blitted as they arrive.',
    '',
    ...STILLS.map((s) => ['---', '', '```', promptForStill(s), '```', ''].join('\n'))
  ].join('\n'),

  'README.md': [
    '# art-sheets',
    '',
    'The round trip that turns Splatix\'s procedural art into painted art.',
    '',
    '```',
    'pnpm art:export      # bake every reference sheet out of the game into this folder',
    'pnpm art:prompts     # (re)write PROMPTS-WALKS.md and PROMPTS-STILLS.md',
    'pnpm art:desk        # the local bench: find a sheet, copy its prompt, file a return',
    'pnpm slice-sheets    # cut painted/ back into public/images/**',
    'pnpm art:status      # what is painted, what is stale, what is still drawn',
    'pnpm compress-folder public/images   # shrink what came back',
    '```',
    '',
    'Turn the painted layer on for one device with `?art=on` in the URL; `?art=off`',
    'puts it back. The build default is `VITE_ENABLE_ART_OVERRIDES` and it ships OFF',
    'until the set is complete, because a portal QA console reports every missing',
    'probe as a broken resource.',
    '',
    `There are ${WALKS.length} walk sheets and ${STILLS.length} stills.`,
    ''
  ].join('\n')
})
