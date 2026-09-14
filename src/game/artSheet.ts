import { BUGS, type BugId } from '@/game/bugs'
import { SHOES } from '@/game/shoes'
import { BOSSES, type BossId } from '@/game/bosses'
import { HAZARDS } from '@/game/hazards'
import { WORLDS } from '@/game/stages'
import { ART_FOLDERS, type ArtKind } from '@/game/art'
import { GAME_ICON_NAMES, type GameIconName } from '@/components/icons/iconNames'
import { ART_BRAND, UI_MARK_FOR_GLYPH, artIdForGlyph } from '@/game/artCatalogue'
import { BANNER } from '@/game/uiArt'
import { SHOE_BOX } from '@/game/artBoxes'

/**
 * ─── Art sheet manifest ─────────────────────────────────────────────────────
 *
 * Bug Crunch draws everything procedurally, which is wonderful for payload and
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

/**
 * The no-text rule, and the ONE drawable it cannot apply to.
 *
 * Every painting in this game is forbidden any lettering, because the game
 * typesets every word a player reads over the top in 21 languages. The logo is
 * the exception by definition — it is a wordmark, the word is the drawing, and
 * it is the same word in every locale. Left under the blanket rule its prompt
 * would say "paint the word BUG CRUNCH" and "no text of any kind" in the same
 * breath, and a painter handed a contradiction picks one.
 */
const NO_TEXT_RULE = [
  '· NO TEXT OF ANY KIND anywhere in the image — no captions, no labels, no',
  '  numbers, no watermarks, no logos, no signature, nothing written on a sign, a',
  '  banner or an object. This game ships in 21 languages and every word a player',
  '  reads is typeset by the game over the top, so a painted word is a word that',
  '  is wrong in twenty of them and cannot be fixed without repainting.'
]

const WORDMARK_TEXT_RULE = [
  '· THE ONLY TEXT IS THE ONE WORD THIS IS A DRAWING OF, spelled exactly as the',
  '  prompt spells it, and nothing else — no tagline, no subtitle, no caption, no',
  '  studio name, no signature, no watermark, no second line of any kind. This game',
  '  ships in 21 languages and every other word a player reads is typeset by the',
  '  game over the top; the wordmark is the one thing that is the same in all of',
  '  them.'
]

const GROUND_RULE = [
  '· NOTHING MAY CARRY ITS OWN GROUND. Every one of these composites over a floor',
  '  the game paints: no drop shadow, no contact shadow, no ground plane, no card,',
  '  no vignette, no glow pad and no soft halo behind the subject. The renderer',
  '  draws the shadow. A painted one arrives as a grey smear that follows the',
  '  sprite around and cannot be removed.'
]

const LOOK = [
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
  '  burst into bright cartoon slime; that is as far as it ever goes.'
]

/** The style paragraph pasted into every prompt. `wordmark` swaps the blanket
 *  no-text rule for the one the logo can actually keep. */
export const houseStyle = (wordmark = false): string =>
  [...LOOK, ...(wordmark ? WORDMARK_TEXT_RULE : NO_TEXT_RULE), ...GROUND_RULE].join('\n')

export const HOUSE_STYLE = houseStyle()

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
  sprinter: {
    blurb: 'A sprinter ant from DIRECTLY ABOVE: the SAME three-lobe body as the'
      + ' worker ant — abdomen, waist, round head in a line — but LEANER, with one'
      + ' pale gold chevron (an arrow head pointing to the TOP of the panel) on the'
      + ' abdomen, two long rear legs swept BACK into a wide V that reaches past the'
      + ' abdomen, and two antennae laid FLAT BACK along the body instead of curling'
      + ' up. Big glossy eyes, blush, and a keen "about to bolt" look.',
    colour: 'a bright teal body going deep petrol at the waist, a pale gold chevron'
      + ' and pale gold antenna beads, cream belly highlight.',
    motion: 'A SURGE, not a bob: the whole body shoves forward along its own axis'
      + ' inside the cycle and settles back. The four front legs run in a tripod gait'
      + ' and the two long rear legs kick out and back behind it. The swept antennae'
      + ' never lift.'
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
    motion: 'A HOP cycle seen FROM ABOVE THROUGHOUT, as if you were standing over it'
      + ' looking down while it jumps toward you: it crouches lower and lower through'
      + ' the first panels with the spring legs folding tighter, then in one panel it is'
      + ' stretched and lifted — drawn SMALLER in the panel because it is further from'
      + ' the floor, legs extended — and it settles back down. Only ONE panel is the'
      + ' launch. NOT ONE PANEL IS DRAWN FROM THE SIDE: a jump is normally drawn in'
      + ' profile and that is exactly what must not happen here, because the game spins'
      + ' the whole frame by the heading of the body, and a profile frame arrives as a'
      + ' flea lying on its side in the middle of the cycle.'
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
  /** Where the renderer pins the painting, when `anchor` alone does not say it
   *  (the shoe stands on its toe, not on its middle). */
  anchorNote?: string
  /** What the game paints OVER it — and therefore what must be left out. */
  live?: string
  /** A glow that must stay inside the outline. */
  glow?: boolean
  /** Colourless by contract; the game tints it. */
  greyscale?: boolean
  /** The drawable IS a word — the logo, and only the logo. See `NO_TEXT_RULE`. */
  wordmark?: true
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
  anchorNote?: string
  live?: string
  glow?: boolean
  greyscale?: boolean
  wordmark?: true
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
  anchorNote: o.anchorNote,
  live: o.live,
  glow: o.glow,
  greyscale: o.greyscale,
  wordmark: o.wordmark,
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
    anchorNote: `THE TOE IS THE ANCHOR, and it is the one measurement in this sheet`
      + ` that cannot move: the game stomps on the point ${Math.round(SHOE_BOX.toeFromTop * 100)}%`
      + ' of the way down the panel, on the centre line. The tip of the toe must sit'
      + ' exactly there, and the leg must recede upward out of the top of the frame'
      + ' behind the heel. Move the toe and the stomp circle stops agreeing with the'
      + ' art, everywhere, for every shoe.',
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
const LOGO_STILL: StillSpec = still('ui', 'logo', 'Bug Crunch logo',
  'The word BUG CRUNCH as a chunky hand-drawn cartoon wordmark, painted as if the'
  + ' letters themselves were squeezed out of bright slime: fat rounded letterforms'
  + ' with a heavy warm near-black outline, a glossy highlight along the top of every'
  + ' letter, and a magenta-and-lime splat bursting out from behind the word. Above'
  + ' or beside the word, one cartoon sneaker sole coming down. On a transparent'
  + ' background, centred, with a small even margin.', {
    w: 1024, h: 1024, maxEdge: 512, exact: true, fit: false, wordmark: true,
    target: ART_BRAND.logo,
    extra: [
      { target: 'images/logo/logo_256x256.webp', size: 256 },
      { target: 'images/logo/logo_192x192.png', size: 192 },
      { target: 'images/icons/logo_512x512.png', size: 512 },
      { target: 'images/icons/logo_256x256.webp', size: 256 },
      { target: 'images/icons/logo_192x192.png', size: 192 }
    ]
  })

// ─── The button glyphs ──────────────────────────────────────────
//
// One slot per glyph in the icon set, so EVERY icon the game shows a player can
// be painted — not just the seven marks the HUD draws on a canvas.
//
// Two registers, because a button's glyph is not one kind of thing:
//
//   MARK    the affordances — play, pause, close, the arrows, the cog. These
//           stay FLAT WHITE SILHOUETTES, the same contract the HUD marks keep:
//           they sit on saturated candy plastic at 16–24 px, where an
//           illustration turns to mud and a white shape does not. Painting one
//           buys a better silhouette, never a picture.
//   OBJECT  the nouns — the chest, the coin, the gem, the gift, the skull. These
//           are THINGS in this world and get the full house style: flat
//           saturated colour, the ink contour, one cel shadow, light from the
//           upper left. This is where a painted icon set actually earns itself.
//
// Six glyphs are deliberately absent. `boot`, `flame`, `star`, `clock`, `target`
// and `trophy` already ARE the HUD marks `locker`, `fever`, `star`, `timer`,
// `target` and `trophy`, so one painting serves the canvas and the DOM both
// (`artCatalogue.artIdForGlyph`). Painting them twice would be painting them
// twice.

/** Glyphs that stay a flat white silhouette. Everything else is an object. */
const GLYPH_MARKS = new Set<GameIconName>([
  'play', 'pause', 'replay', 'skip-forward', 'skip-back', 'stop',
  'menu', 'home', 'back', 'forward', 'close', 'check',
  'settings', 'shop', 'info', 'help',
  'music', 'music-off', 'sound', 'sound-off',
  'chart', 'leaderboard', 'share', 'fullscreen',
  'plus', 'minus', 'left', 'right', 'up', 'down',
  // `shield` is a noun, and it is still a MARK, because what decides the
  // register is not what a glyph depicts but how small it is drawn. This one is
  // the pierce stat on a shoe card (`ShoeCard.vue`), in a row beside `right` and
  // `target` at `clamp(0.65rem, 2.6vmin, 0.9rem)` — ten to fourteen pixels, under
  // the band an object survives at all. Painted as one it came back a brown
  // shield that reads as a smudge on the navy card, next to two crisp white
  // marks. A white shape at 12 px is a shield; an illustration at 12 px is mud.
  'shield'
])

/**
 * What each glyph IS, in the words the painting needs.
 *
 * Every line describes the SHAPE THAT IS ALREADY THERE (`iconPaths.ts`), because
 * the silhouette is what the player has learned to press — a repainted glyph
 * that reads as a different object is a button that stopped working.
 */
const GLYPH_BLURB: Partial<Record<GameIconName, string>> = {
  // ── The affordances ──
  play: 'A single right-pointing triangle with softly rounded corners, sitting a'
    + ' hair right of centre so it reads as centred.',
  pause: 'Two upright rounded bars of equal width with an even gap between them.',
  replay: 'A circular arrow: a thick ring open at one point with a solid arrow head'
    + ' on the open end, travelling anti-clockwise. The head sits right of top and'
    + ' points left.',
  'skip-forward': 'A right-pointing triangle with an upright bar hard against its'
    + ' tip — the "next track" mark.',
  'skip-back': 'A left-pointing triangle with an upright bar hard against its tip —'
    + ' the exact mirror of skip-forward.',
  stop: 'A single square with softly rounded corners.',
  menu: 'Three horizontal bars of equal length and weight, evenly spaced.',
  home: 'A house: a broad triangular roof over a squat body, with a doorway notched'
    + ' out of the bottom edge.',
  back: 'A left-pointing arrow — a solid head on a straight shaft.',
  forward: 'A right-pointing arrow — a solid head on a straight shaft.',
  close: 'A bold X of two crossed bars of equal weight, corners rounded.',
  check: 'A bold tick — a short down-stroke and a long up-stroke, rounded ends.',
  settings: 'A gear: a round body with evenly spaced blunt teeth around it and a'
    + ' round bore through the middle.',
  shop: 'A shopping trolley: a slanted basket on two round wheels with a grip'
    + ' rising off its back corner.',
  info: 'A filled disc with a lower-case i cut out of it — a dot over a straight'
    + ' stem.',
  help: 'A filled disc with a question mark cut out of it — a hook, a short'
    + ' descender, and a separate dot below.',
  music: 'Two beamed eighth notes: two round heads with stems rising into one'
    + ' slanted beam.',
  'music-off': 'A single eighth note with a bold X beside it, at the same weight as'
    + ' the note.',
  sound: 'A speaker: a small block with a triangular cone opening to the right, and'
    + ' two curved sound waves beyond it.',
  'sound-off': 'The same speaker with a bold X beside it instead of the waves.',
  chart: 'Three upright bars of increasing height, evenly spaced, standing on a'
    + ' common line.',
  leaderboard: 'A podium of three blocks with the MIDDLE one tallest, standing on a'
    + ' common line.',
  share: 'Three round nodes — one left, two stacked right — joined by two straight'
    + ' connectors.',
  fullscreen: 'Four corner brackets, one in each corner of the frame, opening'
    + ' outward.',
  plus: 'A bold plus of two crossed bars of equal length and weight.',
  minus: 'A single bold horizontal bar.',
  left: 'A single bold chevron pointing left, no shaft.',
  right: 'A single bold chevron pointing right, no shaft.',
  up: 'A single bold chevron pointing up, no shaft.',
  down: 'A single bold chevron pointing down, no shaft.',
  // ── The nouns ──
  chest: 'A cartoon treasure chest seen face-on: a domed banded lid raised a crack'
    + ' over a banded box, a dark gap showing between the two, and a hasp bridging'
    + ' the gap in front. The lid overhangs the box on both sides.',
  anvil: 'A blacksmith’s anvil seen from the side — a wide flat face, a narrowing'
    + ' waist and a broad base — with a chevron rising above it like an upgrade'
    + ' arrow.',
  video: 'A chunky cartoon television: a rounded screen in a body, with one solid'
    + ' play triangle on the screen.',
  movie: 'A film strip lying WIDE across the frame: one rounded slab with six'
    + ' square sprocket holes punched through it, three along the top edge and three'
    + ' along the bottom.',
  ads: 'A megaphone pointing to the upper right with two curved sound waves'
    + ' radiating from its mouth.',
  book: 'A closed hardback book seen face-on, with a spine band down one side and'
    + ' the page block showing along the other.',
  lock: 'A closed padlock: a chunky rounded body with a shackle arching over it and'
    + ' a keyhole cut through the body.',
  unlock: 'The same padlock with the shackle swung OPEN and hooked on one side'
    + ' only.',
  'star-empty': 'A five-point star drawn as a thick rim with the middle cut out —'
    + ' the hollow twin of the solid star, same points, same proportions.',
  coin: 'A fat round gold coin seen face-on: a bevelled rim, a raised inner ring,'
    + ' and a solid core. Chunky and cartoonish, like an arcade token.',
  gem: 'A cut gemstone seen face-on: a flat table on top, angled shoulders and a'
    + ' pointed cut below, with two bright facet highlights.',
  heart: 'One plump cartoon heart with two round lobes and a soft point at the'
    + ' bottom.',
  flask: 'A round-bottomed laboratory flask with a narrow neck and a lip, half'
    + ' filled with liquid and one bubble rising in it.',
  wheel: 'A prize wheel seen face-on: a thick rim, three straight spokes across the'
    + ' full diameter, and a round hub at the centre.',
  gift: 'A wrapped present: a square box crossed by a ribbon band both ways with a'
    + ' bow on top.',
  bug: 'A little bug seen from DIRECTLY ABOVE: a three-lobe body — abdomen, waist,'
    + ' round head — six legs and two antennae. The same creature the game is full'
    + ' of, shrunk to a mark.',
  splat: 'A splat: a round blob of goo with five or six irregular fingers flung out'
    + ' of it and two or three loose droplets beyond them.',
  bolt: 'One lightning bolt — a bold zigzag with a wide shoulder at the top and a'
    + ' sharp point at the bottom.',
  skull: 'A cartoon skull seen face-on: a round cranium, two big round eye sockets,'
    + ' a small nose notch and a short jaw with two or three tooth gaps. Friendly,'
    + ' never gruesome.',
  shield: 'A heater shield: flat across the top, curving down to a point, with one'
    + ' band across its middle.',
  warning: 'A rounded triangle standing on its base with an exclamation mark — a'
    + ' thick bar over a round dot — cut out of the middle.'
}

/** The glyph slots, derived from the icon set so a new glyph is paintable the
 *  day it is added rather than the day somebody remembers this file. */
const GLYPH_STILLS: StillSpec[] = GAME_ICON_NAMES
  .filter((n) => !(n in UI_MARK_FOR_GLYPH))
  .map((n) => {
    const isMark = GLYPH_MARKS.has(n)
    return still('ui', artIdForGlyph(n), `Icon — ${n}`,
      GLYPH_BLURB[n] ?? `The ${n} glyph, repainted in the house style.`, {
        // A button glyph is never drawn above ~64 CSS px, so 256 in and 128 out
        // is already twice what a 2x phone asks for — and there are fifty of
        // them, which is the other half of the reason.
        w: 256, h: 256, maxEdge: 128,
        // Blitted as painted, like the HUD marks it sits beside: a glyph is a
        // silhouette, and normalising one onto the vector reference's solid box
        // would stretch a painting whose margin is part of its balance.
        fit: false,
        ...(isMark
          ? {
            greyscale: true,
            live: 'It is shown WHITE on saturated candy plastic at 16–24 px and it is'
              + ' a BUTTON, so it must read as ONE bold shape: no outline, no shading,'
              + ' no scene around it, and nothing thinner than a tenth of the frame.'
          }
          : {
            live: 'It is shown inside a button at 16–24 px, so keep it to ONE object,'
              + ' centred, with a small even margin and nothing behind it — no plate,'
              + ' no badge, no floor, no sparkle ring.'
          })
      })
  })

// ─── Contact sheets ─────────────────────────────────────────────────────────
//
// The fifty-seven square ui slots again, nine to a sheet instead of one to a
// generation.
//
// The cheap half of the reason is arithmetic: fifty-eight generations is two
// days of the desk's daily cap, and seven is an afternoon. The real half is that
// this is how an icon set has to be made. Painted one per generation, thirty-six
// white silhouettes come back with thirty-six stroke weights, thirty-six corner
// radii and thirty-six ideas about margin — a set that reads as borrowed from
// thirty-six places, which is the one thing an icon set may not do. Painted nine
// to a sheet the painter balances them AGAINST EACH OTHER in a single pass, and
// that balancing IS the job.
//
// The two registers never share a sheet. A flat white mark and a full-colour
// object on one grid are two contradictory instructions about one picture, and
// what comes back is nine half-tinted things that belong to neither.
//
// These do not replace the single-icon sheets: those stay, and are how a cell
// that came back wrong is re-rolled for one generation instead of nine.

/** The square ONE CELL of a contact sheet is authored in. */
const GRID_CELL_PX = 256

/**
 * Cells per contact sheet, and the width of the grid.
 *
 * Three by three, because the grid is the part a model gets wrong. The queue
 * already runs with `--drop-borders` on because Gemini rules a plain eight-panel
 * walk sheet like a comic strip perhaps one time in three; a lattice of nine
 * distinct objects is a stronger invitation to rule it still. Nine is the most
 * that came back clean, and the blast radius of a bad return is nine icons
 * rather than fifty-seven.
 */
const GRID_COLS = 3
const GRID_CELLS = GRID_COLS * GRID_COLS

/**
 * A contact sheet: one painting that becomes N files.
 *
 * The difference from an animated `StillSpec`, whose panels are also a grid, is
 * that those panels are one subject through one loop and compose back into a
 * single strip. These are N DIFFERENT subjects that each go to a file of their
 * own, which is why the index entry carries a target per cell instead of one for
 * the sheet.
 */
export interface GridSpec {
  kind: ArtKind
  id: string
  file: string
  name: string
  cols: number
  rows: number
  /** The square one cell is authored in. */
  cell: number
  /** Output cap for the tall edge of a cut cell. */
  maxEdge: number
  /** Colourless by contract — the whole sheet, or none of it. */
  greyscale: boolean
  /** The stills this sheet paints, in reading order. */
  members: StillSpec[]
  /** What the game draws over every one of them. */
  live: string
}

const chunk = <T>(xs: T[], n: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

/**
 * A leftover of ONE is not a contact sheet.
 *
 * The lattice always divides exactly — a remainder of r is cut as a
 * `min(3, r) x ceil(r / min(3, r))` rectangle, which is exact for every r this
 * ever produces — so a stub is not a correctness problem. It is a pointless one:
 * a 1x1 "grid" is a single icon painted alone, which is what the single-icon
 * sheet in `PROMPTS-STILLS.md` already is, and it would spend a generation to
 * say so twice. Every square slot keeps that sheet whether or not it is also on
 * a grid, so dropping the stub costs nothing but the duplicate.
 */
const GRID_MIN = 2

const gridsOf = (register: 'marks' | 'objects', members: StillSpec[], live: string): GridSpec[] => {
  const parts = chunk(members, GRID_CELLS).filter((p) => p.length >= GRID_MIN)
  return parts.map((cells, i) => {
    const cols = Math.min(GRID_COLS, cells.length)
    return {
      kind: 'ui' as ArtKind,
      id: `${register}-${i + 1}`,
      file: `grid-ui-${register}-${i + 1}`,
      name: `UI ${register} ${i + 1} of ${parts.length}`,
      cols,
      rows: Math.ceil(cells.length / cols),
      cell: GRID_CELL_PX,
      maxEdge: 128,
      greyscale: register === 'marks',
      members: cells,
      live
    }
  })
}

/** Every square ui slot. The ribbon is not one of them — it is a wide banner,
 *  and a 2.3:1 cell on a grid of squares would be painted as a square. */
const SQUARE_UI = [...UI_STILLS.filter((s) => s.id !== 'ribbon'), ...GLYPH_STILLS]

/**
 * The contact sheets, split by the register each slot already declares.
 *
 * `greyscale` is not a second opinion about which register a slot is in — it IS
 * the register, set once where the slot is defined, so a glyph moved between
 * `GLYPH_MARKS` and the objects moves between sheets without anything here
 * needing to know.
 */
export const GRIDS: GridSpec[] = [
  ...gridsOf('marks', SQUARE_UI.filter((s) => s.greyscale),
    'Every one is shown WHITE on saturated candy plastic at 16–24 px and every one'
    + ' is a BUTTON, so each must read as ONE bold shape: no outline, no shading, no'
    + ' scene around it, and nothing thinner than a tenth of its cell.'),
  ...gridsOf('objects', SQUARE_UI.filter((s) => !s.greyscale),
    'Every one is shown inside a button at 16–24 px, so each is ONE object, centred'
    + ' in its cell, with a small even margin and nothing behind it — no plate, no'
    + ' badge, no floor, no sparkle ring.')
]

/**
 * The greeter on the loading screen.
 *
 * The splash is the one screen every player sees before deciding whether to
 * stay, and what is on it is a gag: an ant floats out, shouts BOO, and then
 * cracks up at its own prank (`FLogoProgress.vue`). The mascot is the ant that
 * does it — the creature the player is about to spend the game stomping, which
 * is the whole point of putting it there. Two seconds of sympathy for the cast,
 * bought before the game has started.
 *
 * TOP-DOWN like the rest of the cast, and that is deliberate rather than
 * convenient: the splash animates this one file with CSS — a float, a lunge on
 * the shout, a shoulder-shake on the laugh — and those beats are authored
 * against a creature seen from above. A front-facing character would also stop
 * being the bug on the blanket and start being a logo with a face.
 *
 * Never probed at run time. The splash must be the same picture on every build,
 * including the portal ones that ship with the art layer OFF, so the file is read
 * straight off disk and the target is explicit — the same contract the logo has.
 */
const MASCOT_STILL: StillSpec = still('ui', 'mascot', 'Splash mascot',
  'The game’s greeter: ONE cheerful worker ant seen from DIRECTLY ABOVE, head to'
  + ' the TOP of the panel, WAVING HELLO with both front legs raised and open.'
  + ' Three round lobes in a line — a big soft abdomen at the bottom, a small waist,'
  + ' a friendly round head at the top — four more thin bent legs, two curling'
  + ' antennae with a bead on each tip, two enormous glossy eyes looking straight up'
  + ' out of the panel, a wide open smile and pink blush. It is delighted to see'
  + ' you.', {
    w: 512, h: 512, maxEdge: 512, exact: true, fit: false,
    target: ART_BRAND.mascot,
    authored: 'Head to the TOP of the panel, seen from directly above — the same'
      + ' view every creature in this game is drawn in.',
    live: 'The splash floats it, lunges it at the player, shakes it, and pops a DRAWN'
      + ' speech bubble in beside it — so paint no bubble, no words, no shadow and no'
      + ' ground, and leave a small even margin all round so an antenna is never'
      + ' clipped by the frame.'
  })

export const STILLS: StillSpec[] = [
  ...SHOE_STILLS,
  ...BOSS_STILLS,
  ...PROP_STILLS,
  ...FX_STILLS,
  ...FLOOR_STILLS,
  ...UI_STILLS,
  ...GLYPH_STILLS,
  LOGO_STILL,
  MASCOT_STILL
]

/** Everything the pipeline can produce, as `kind/id` — the id space the Art
 *  Desk searches and `art:status` reports on. */
export const ALL_SHEETS: Array<WalkSpec | StillSpec> = [...WALKS, ...STILLS]

// ─── Prompts ────────────────────────────────────────────────────────────────

const layoutRules = (cols: number, rows: number, frames: number): string[] => [
  `THE GRID — ${cols} columns across, ${rows} row${rows > 1 ? 's' : ''} down,`
  + ` EXACTLY ${frames} panels read left to right along the top row` + (rows > 1 ? ', then the next.' : '.'),
  `· ${frames} and not one more or one fewer. The game cuts the return into`
  + ` ${frames} equal panels by arithmetic, so a sheet with a different count is`
  + ' sliced through the middle of every frame — silently, and it looks like the'
  + ' animation broke rather than like the sheet did.',
  '· DO NOT DRAW THE GRID. There are no panel borders, no outlines around a panel,',
  '  no dividing lines, no gutters, no margins between panels, no drop shadows under',
  '  a panel, no numbers and no labels. The panels TOUCH, edge to edge, and the only',
  '  thing that says where one ends is that the creature in it ends. A sheet ruled',
  '  like a comic strip is refused outright: the game cuts it by arithmetic, so every',
  '  rule line lands INSIDE a frame and every frame of the animation then carries a',
  '  black bar down one side of it.',
  '· Every panel is the SAME SIZE, to the pixel.',
  '· The subject is CENTRED in its panel and the SAME SIZE in every panel. It never',
  '  drifts, never grows, never leaves the panel.',
  '· The background of every panel is FLAT MAGENTA #FF00FF, edge to edge, with',
  '  nothing else on it — no shadow, no floor, no gradient, no vignette. The magenta',
  '  is keyed out to transparency; anything else left on it becomes part of the',
  '  sprite, and a soft shadow fading into the magenta becomes a pink fringe around',
  '  the whole thing that no amount of keying can take off again.'
]

/**
 * Where the bench measured the reference sitting inside its own panel, keyed
 * `kind/id`.
 *
 * Read back out of `art-sheets/sheet-index.json` by `pnpm art:prompts` and
 * folded into the prompt as a SIZE IN FRAME sentence. Without it the only thing
 * telling a painter how big to draw is the attached reference, and an image
 * model reliably answers a small subject on a big field with a big subject on a
 * small field — which the slicer then shrinks back, losing the detail that was
 * the reason to paint it.
 */
export type SheetFits = Record<string, { h: number; w: number; bottom: number; cx: number }>

const pct = (v: number): number => Math.round(v * 100)

/** The SIZE IN FRAME clause, when the bench has measured one. */
const fitLines = (fits: SheetFits | undefined, key: string): string[] => {
  const f = fits?.[key]
  if (!f) return []
  return [
    `THE SIZE IN FRAME: in the reference the subject covers about ${pct(f.h)}% of its`
    + ` panel's height and ${pct(f.w)}% of its width. Paint it at that size. A subject`
    + ' drawn small in a big empty frame is scaled back up by the game and arrives'
    + ' soft; one drawn past the edges is clipped.',
    ''
  ]
}

/**
 * The SHAPE of the answer, stated as a number.
 *
 * An image model defaults to its own favourite aspect — 16:9, or square — and
 * will cheerfully hand back a beautiful landscape painting of a portrait sheet.
 * The slicer then squeezes it into the box the renderer blits, and a trainer
 * painted 1.8:1 arrives 0.5:1: a tall white smear. It happened to the first
 * sneaker, and the attached reference did not prevent it, because the reference
 * is read as a style hint and not as a canvas.
 *
 * So the ratio is spelled out in words, in both directions, every time.
 */
const shapeLines = (w: number, h: number): string[] => {
  const r = w / h
  const shape = r > 1.05 ? 'LANDSCAPE (wider than it is tall)'
    : r < 0.95 ? 'PORTRAIT (TALLER THAN IT IS WIDE)'
    : 'SQUARE'
  const ratio = r >= 1 ? `${(r).toFixed(2)} : 1` : `1 : ${(1 / r).toFixed(2)}`
  return [
    `THE SHAPE OF THE IMAGE: ${shape}, width to height ${ratio}.`,
    '  The same shape as the attached reference, and it is not negotiable. Do NOT',
    '  answer with a 16:9 image, and do NOT answer with a square one unless square',
    '  is what is asked for here. The game cuts the return by proportion, so a',
    '  picture of the right subject in the wrong shape is squeezed into this one and',
    '  arrives stretched.',
    ''
  ]
}

/** Where the renderer pins a painting — the one thing a repaint may not move. */
const anchorLines = (anchor: 'centre' | 'feet', note?: string): string[] => [
  note ?? (anchor === 'feet'
    ? 'THE ANCHOR is the BOTTOM of the subject: the game stands it on the floor at'
    + ' the lowest solid pixel, on the centre line, so nothing may hang below it.'
    : 'THE ANCHOR is the CENTRE of the frame: the game blits the painting from its'
    + ' own middle and turns it about that point, so the subject must sit centred'
    + ' with its weight on the middle of the panel and an even margin around it.'),
  ''
]

/** A ready-to-paste prompt for one walk sheet. */
export const promptForWalk = (w: WalkSpec, fits?: SheetFits): string => [
  `# ${w.id} — ${w.name}  (${w.target})`,
  '',
  'GENERATE A NEW IMAGE. This is not a retouch and not an edit: the attached',
  '  picture is a REFERENCE to draw from, and the answer is a brand-new painting of',
  '  the same subject in the same layout.',
  '',
  ...shapeLines(w.w, w.h),
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
  'THE VIEW: seen from DIRECTLY ABOVE, looking straight down at the floor. Its head',
  '  points to the TOP of every panel and it never turns — the game rotates the whole',
  '  picture to point it wherever it is walking. Do not draw it in profile, do not',
  '  draw it three-quarters on, and do not tilt it.',
  '',
  ...anchorLines('centre'),
  ...fitLines(fits, `${w.kind}/${w.id}`),
  `THE MOVEMENT: ${w.motion}`,
  '· No two panels are the same. A sheet where four panels are identical is a sheet',
  '  the game plays as a creature that freezes four times a second.',
  '',
  ...layoutRules(w.cols, w.rows, w.frames),
  '',
  HOUSE_STYLE
].join('\n')

/** A ready-to-paste prompt for one still. */
export const promptForStill = (s: StillSpec, fits?: SheetFits): string => {
  const n = framesOf(s)
  const lines: string[] = [
    `# ${s.id} — ${s.name}  (${s.target})`,
    '',
    'GENERATE A NEW IMAGE. This is not a retouch and not an edit: the attached',
    '  picture is a REFERENCE to draw from, and the answer is a brand-new painting of',
    '  the same subject at the same size in the same frame.',
    '',
    ...shapeLines(s.w * colsOf(s), s.h * rowsOf(s)),
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
  lines.push(...anchorLines(s.anchor, s.anchorNote))
  if (s.fit !== false) lines.push(...fitLines(fits, `${s.kind}/${s.id}`))
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
      + ' out to transparency; anything else left on it becomes part of the sprite, and'
      + ' a soft shadow fading into the magenta becomes a pink fringe around the whole'
      + ' thing that no amount of keying can take off again.', '')
  } else {
    lines.push('THE IMAGE IS FULLY OPAQUE: it has no transparent parts and no magenta.', '')
  }
  lines.push(houseStyle(s.wordmark))
  return lines.join('\n')
}

/**
 * A ready-to-paste prompt for one contact sheet.
 *
 * It shares almost nothing with `promptForStill`'s multi-panel branch, and that
 * is the point. A walk sheet's rules all say THE SAME CREATURE IN EVERY PANEL;
 * here every rule has to say the opposite — nine different objects, in a stated
 * order, each staying inside its own cell — while keeping the one rule they do
 * share, which is that the grid itself must not be drawn.
 */
export const promptForGrid = (g: GridSpec): string => {
  const n = g.members.length
  const roster = g.members.map((m, i) => [
    `  CELL ${i + 1} — row ${Math.floor(i / g.cols) + 1}, column ${(i % g.cols) + 1}`
    + ` — ${m.name.replace(/^Icon — /, '')}:`,
    `      ${m.blurb}`
  ].join('\n'))
  return [
    `# ${g.id} — ${g.name}  (${n} icons on one sheet)`,
    '',
    'GENERATE A NEW IMAGE. This is not a retouch and not an edit: the attached',
    '  picture is a REFERENCE to draw from, and the answer is a brand-new painting of',
    '  the same icons in the same layout.',
    '',
    ...shapeLines(g.cell * g.cols, g.cell * g.rows),
    `A CONTACT SHEET: ${n} DIFFERENT icons, one per cell, laid out`
    + ` ${g.cols} across and ${g.rows} down.`,
    '  This is NOT an animation and NOT one object seen nine times. Every cell holds a',
    '  different thing, and the order below is not a suggestion — the game cuts the',
    '  sheet by arithmetic and files each cell under the name listed for that',
    '  position, so an icon painted one cell to the left is shipped under the wrong',
    '  name and a button in the game stops meaning what it shows.',
    '',
    'One image comes with this prompt:',
    `  \`art-sheets/${g.file}.png\` — THE LAYOUT: the game's own rough placeholder`,
    '     drawings, each in the cell its repainting must land in. Match the SHAPE, the',
    '     SIZE IN THE CELL and the ORIENTATION of each one; take nothing else — not',
    '     its line weight, its colours or its shading.',
    '',
    `WHAT IS IN EACH CELL, in reading order — left to right along the top row${g.rows > 1 ? ', then the next' : ''}:`,
    '',
    ...roster,
    '',
    'THEY ARE A SET. This is the whole reason they are painted together: one stroke',
    '  weight, one corner radius, one margin and one visual weight across all',
    `  ${n} of them, so that at 20 px in a row of buttons no single icon reads as`,
    '  heavier, larger or from somewhere else. Balance them against each other.',
    '',
    `WHAT THE GAME DRAWS OVER THEM: ${g.live}`,
    '',
    ...(g.greyscale
      ? ['COLOURLESS BY CONTRACT: paint every cell in WHITE and GREY only. The game tints'
        + ' them per use, and any colour painted in here fights that tint.', '']
      : []),
    `THE GRID — ${g.cols} columns across, ${g.rows} row${g.rows > 1 ? 's' : ''} down,`
    + ` EXACTLY ${n} cells.`,
    `· ${n} and not one more or one fewer, and no empty cell. The game cuts the return`,
    `  into ${n} equal cells by arithmetic, so a sheet with a different count is sliced`,
    '  through the middle of every icon.',
    '· DO NOT DRAW THE GRID. There are no cell borders, no outlines around a cell, no',
    '  dividing lines, no gutters, no margins between cells, no drop shadows under a',
    '  cell, no numbers, no captions and no labels. The cells TOUCH, edge to edge, and',
    '  the only thing that says where one ends is that the icon in it ends. A sheet',
    '  ruled like a comic strip is refused outright: the game cuts it by arithmetic,',
    '  so every rule line lands INSIDE a cell and every icon then carries a black bar',
    '  down one side of it.',
    '· Every cell is the SAME SIZE, to the pixel.',
    '· Each icon is CENTRED in its own cell with an even margin, and nothing crosses',
    '  from one cell into its neighbour.',
    '· The background of every cell is FLAT MAGENTA #FF00FF, edge to edge, with',
    '  nothing else on it — no shadow, no floor, no gradient, no vignette. The magenta',
    '  is keyed out to transparency; anything else left on it becomes part of the',
    '  icon, and a soft shadow fading into the magenta becomes a pink fringe that no',
    '  amount of keying can take off again.',
    '',
    HOUSE_STYLE
  ].join('\n')
}

/**
 * Every sheet in the manifest as one flat list: what it is called, what file the
 * bench exports it to, what it turns into, and which document its prompt is in.
 *
 * The shape `tools/art-prompts.mjs` reports paint status from, and the shape the
 * Art Desk searches — neither of them should have to know the difference between
 * a walk and a still to answer "what is left to paint".
 */
export interface SheetRow {
  /** The reference's filename without `.png` — the id everything keys on. */
  stem: string
  title: string
  /** Path under `public/` the sliced result belongs at. A contact sheet writes
   *  many, and this is the first of them — see `targets`. */
  target: string
  /** Every path the sheet writes, when it writes more than one. */
  targets?: string[]
  /** Which PROMPTS document carries its block. */
  doc: string
  what: 'walk' | 'still' | 'grid'
}

export const sheetRows = (): SheetRow[] => [
  ...WALKS.map((w) => ({
    stem: w.file, title: `${w.id} — ${w.name}`, target: w.target,
    doc: 'PROMPTS-WALKS.md', what: 'walk' as const
  })),
  ...STILLS.map((s) => ({
    stem: s.file, title: `${s.id} — ${s.name}`, target: s.target,
    doc: 'PROMPTS-STILLS.md', what: 'still' as const
  })),
  // A contact sheet writes one file per cell. `target` is the first of them,
  // because `SheetRow.target` is what the status documents print and they print
  // one line per sheet; `targets` is the real answer. `chunk` never yields an
  // empty part, so there is always a first.
  ...GRIDS.map((g) => ({
    stem: g.file, title: `${g.id} — ${g.name}`,
    target: g.members[0]!.target, targets: g.members.map((m) => m.target),
    doc: 'PROMPTS-GRIDS.md', what: 'grid' as const
  }))
]

/**
 * One prompt block, in the shape the Art Desk parses.
 *
 *   ## <title>  (<reference>.png → <target>)
 *
 *   ```text
 *   …the prompt…
 *   ```
 *
 * That heading is not decoration: `tools/art-desk/jobs.mjs` reads the reference
 * out of the last parenthesis and the target out of the arrow, and a document
 * that does not carry them is a document the desk finds no jobs in — which is
 * exactly how it read before, silently, with the queue showing nothing to paint.
 */
const promptBlock = (title: string, ref: string, target: string | null, prompt: string): string => [
  `## ${title}  (${ref}.png${target ? ` → ${target}` : ''})`,
  '',
  '```text',
  prompt,
  '```',
  ''
].join('\n')

/**
 * The prompt documents, keyed by filename.
 *
 * Written into `art-sheets/` by `pnpm art:prompts` AND by the bench's own export
 * button, so the text a painter is handed and the text this manifest generates
 * are one thing and cannot drift.
 *
 * `fits` is what the bench measured last time it exported (it lives in
 * `sheet-index.json`); passing it folds a SIZE IN FRAME sentence into every
 * block. It is optional because the first export happens before there is an
 * index to read.
 */
export const promptDocs = (fits?: SheetFits): Record<string, string> => ({
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
    ...WALKS.map((w) => promptBlock(`${w.id} — ${w.name}`, w.file, w.target, promptForWalk(w, fits)))
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
    ...STILLS.map((s) => promptBlock(`${s.id} — ${s.name}`, s.file, s.target, promptForStill(s, fits)))
  ].join('\n'),

  'PROMPTS-GRIDS.md': [
    '# Contact-sheet prompts — nine icons per generation',
    '',
    'Generated from the manifest — do not hand-edit, re-export instead.',
    '',
    'Each of these paints a whole shelf of the icon set in one go, which is both',
    'how the daily cap is survived and how the set comes back looking like a set:',
    'the painter balances nine icons against each other in one pass instead of',
    'nine times against nothing.',
    '',
    'The heading carries NO `→ target`, and that is deliberate. A contact sheet',
    'writes one file per cell, and the cell list lives in `sheet-index.json` where',
    'the slicer and the desk both read it. A single target in the heading would be',
    'a lie that the desk would act on.',
    '',
    'If one cell comes back wrong, do not re-roll the sheet: the single-icon sheet',
    'for that one slot is still in `PROMPTS-STILLS.md`, and re-rolling it costs one',
    'generation instead of nine.',
    '',
    ...GRIDS.map((g) => promptBlock(`${g.id} — ${g.name}`, g.file, null, promptForGrid(g)))
  ].join('\n'),

  'README.md': [
    '# art-sheets',
    '',
    'The round trip that turns Bug Crunch\'s procedural art into painted art.',
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
    `There are ${WALKS.length} walk sheets, ${STILLS.length} stills and`
    + ` ${GRIDS.length} contact sheets — the last of which repaint`
    + ` ${GRIDS.reduce((n, g) => n + g.members.length, 0)} of those stills nine at a`
    + ' time, for the icon set.',
    ''
  ].join('\n')
})
