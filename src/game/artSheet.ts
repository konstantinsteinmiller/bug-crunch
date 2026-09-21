import { BUGS, type BugId } from '@/game/bugs'
import { SHOES } from '@/game/shoes'
import { BOSSES, EGG_STAGES, type BossId } from '@/game/bosses'
import { HAZARDS } from '@/game/hazards'
import { WORLDS } from '@/game/stages'
import {
  FLOOR_IDS, FLOOR_PALETTE, FLOOR_SUBJECT, floorField, isLeadFloor, worldOfFloor, type FloorId
} from '@/game/floors'
import { ART_FOLDERS, type ArtKind } from '@/game/art'
import { GAME_ICON_NAMES, type GameIconName } from '@/components/icons/iconNames'
import {
  ART_BRAND, CENTIPEDE_SEGMENT_ART, TINTED_GLYPHS, UI_MARK_FOR_GLYPH, artIdForGlyph
} from '@/game/artCatalogue'
import { BANNER, SPLAT_COLS, SPLAT_ROWS, SPLAT_VARIANTS } from '@/game/uiArt'
import { SHOE_BOX } from '@/game/artBoxes'
import { SCENE_ART_BOX } from '@/game/cutscene'

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
  '  thins where the light hits. It reads as a brush, not as a border — and it is',
  '  FAT: at its heaviest about 2% of the shorter side of the panel, the weight of',
  '  a brush pen and not of a technical pen. Hold the finished picture at thumbnail',
  '  size; if the outline has thinned to a hairline there, it is several times too',
  '  thin and the whole shape will fall apart at the size the game draws it.',
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
  '· ONE small crisp specular glint on every rounded or glazed surface, up at the',
  '  light — the wet shine on a carapace, on glass, on china, on painted metal, on',
  '  a lacquered shell. A hard-edged white shape, not a soft bloom and not a haze',
  '  over the whole body.',
  '· NO gore, NO blood, NO realistic insect photography, NO horror. Squished bugs',
  '  burst into bright cartoon slime; that is as far as it ever goes.'
]

/**
 * The failures, named.
 *
 * `PROMPT-ANATOMY.md` § 8: a prohibition written from what actually came back
 * beats another adjective about what is wanted, and a stated negative example
 * beats a positive instruction. Everything below is a thing a return did.
 *
 * ── Why this block had to be written ──
 *
 * The eleven `scene` stills were painted in one run and every one of them came
 * back as CLIP ART: a pale even hairline where the ink contour should be, one
 * flat fill with no lit side and no shadow side, and no glint anywhere. The
 * plate is a white disc, the book a blue rectangle, the door a brown one. Next
 * to the painted ant walking over them — fat warm ink, cel shadow, wet shine —
 * they are visibly a different game, and the intro cutscene puts all five picnic
 * pieces on screen in the first second a new player ever sees.
 *
 * The prompt that produced them was not the problem in any way the old failure
 * catalogue could see: it is generated from this manifest like every other, and
 * it carried the whole of `LOOK`. The props painted from the SAME generated
 * shape — a magnet, a salt shaker, a treasure chest, all equally faceless, all
 * from equally flat placeholder drawings — came back correct. So the brief was
 * survivable rather than binding, and one drifting session was enough to lose
 * it.
 *
 * What made it survivable is the last bullet here. Most of `LOOK` is about
 * creatures — the eyes, the blush, the slime — so on an object with no face the
 * only clauses left with any grip are "flat, saturated fills" and "no
 * gradients", and read alone those two describe a vector icon exactly. The
 * clause that was missing is the one that says a prop is not an exception.
 */
const AVOID_RULE = [
  'AVOID — this is exactly how earlier returns came back, and every one of them',
  'had to be repainted:',
  '· A THIN, PALE, EVEN HAIRLINE in place of the ink contour — a one-pixel grey',
  '  pencil outline that disappears entirely at the size the game draws this at.',
  '  The contour is FAT, dark and warm, and visibly heavier on the shadow side.',
  '· NO LIGHT ON THE OBJECT AT ALL: one even fill from edge to edge with no lit',
  '  side, no shadow side and no glint. A plate came back as a plain white disc,',
  '  a book as a plain blue rectangle, a door as a plain brown rectangle.',
  '· The CLIP-ART, VECTOR ICON, FLAT-DESIGN, STICKER-PACK or infographic',
  '  register — the look of a stock icon set. This is a PAINTING: brush-inked,',
  '  lit, shaded and glinting, and it has to hold up in the same frame as a',
  '  hand-painted ant walking across it.',
  '· WASHED-OUT, DUSTY or PASTEL colour. Keep the fills as saturated as the',
  '  colours named above — a muted version of the right hue is the wrong hue.',
  '· AN OBJECT WITH NO FACE IS NOT AN EXCEPTION TO ANY OF THIS. Most of the look',
  '  above is written about creatures, so on a plain object it is easy to read',
  '  the flat-fill line as the whole brief and hand back an icon. A plate, a',
  '  book, a door, a crate or a napkin is painted to exactly the same standard as',
  '  a creature is, with the same ink, the same light and the same shine.'
]

/**
 * The style paragraph pasted into every prompt.
 *
 * `wordmark` swaps the blanket no-text rule for the one the logo can actually
 * keep. `ground` drops the no-own-ground rule, and exactly one kind of image is
 * allowed to drop it: a PROMOTION COVER (`promotionSheet.ts`), which is not a
 * sprite the renderer composites over a floor — it IS the floor, the light and
 * the shadow, out to its four edges. Every drawable the game blits keeps the
 * rule, because a painted shadow on one of those arrives as a grey smear that
 * follows the sprite around and cannot be removed.
 */
export const houseStyle = (wordmark = false, ground = true): string =>
  [
    ...LOOK,
    ...(wordmark ? WORDMARK_TEXT_RULE : NO_TEXT_RULE),
    ...(ground ? GROUND_RULE : []),
    '',
    ...AVOID_RULE
  ].join('\n')

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
  // The sprinter says "from DIRECTLY ABOVE" five times over, and that is not
  // belt-and-braces: this is the one design that came back SIDE-ON. Seven of its
  // eight panels were a profile of an ant running to the right, which the game
  // then spins by the body's heading — so a creature that should scuttle across
  // the floor cartwheels around its own middle instead. The blanket `THE VIEW`
  // clause in `promptForWalk` was already there and did not hold, because
  // everything the creature's OWN description asked for — "swept back", "about
  // to bolt", "shoves forward" — is the vocabulary of a running pose, and a
  // running pose is drawn in profile unless something says otherwise in the same
  // breath. So the camera is restated inside the blurb and the motion, every
  // pose is described in terms that only exist from above (legs to the LEFT and
  // to the RIGHT of the body, the gaster at the BOTTOM of the panel), and the
  // side view is refused by name. `robobug` is the template that works.
  // ─── Why this one reads like the worker ant and not like a sprinter ───
  //
  // It came back SIDE-ON twice: panel 1 top-down and panels 2-8 a running
  // profile facing right. The shared `faces: 'top-down'` clause was already in
  // the prompt both times, so more of it was never the fix.
  //
  // Two things were wrong, and the second is the one that bites.
  //
  //   1. SPEED WORDS BUY A RUNNING POSE. "sprinter", "about to bolt", "a
  //      SURGE", "kick out and back", "swept back" are all vocabulary for a
  //      creature drawn from the side, and a walk-cycle sprite sheet is drawn
  //      from the side almost everywhere an image model has ever seen one. The
  //      speed now lives where it cannot be posed: in the LEANER build, the
  //      chevron and the longer rear legs. Nothing here describes going fast.
  //
  //   2. NEGATION STEERS BADLY. The rewrite that failed spent four lines on
  //      "not a side view, not a profile, not three-quarters on" — which is
  //      four more mentions of side views than `ant` and `robobug` contain
  //      between them, and both of those came back correct on the first try.
  //      Every negation is deleted; what is left is anatomy, in the plain
  //      register those two use.
  //
  // If a return is ever side-on again, shorten this further toward `ant` —
  // do not lengthen it.
  sprinter: {
    blurb: 'A lean worker ant seen from DIRECTLY ABOVE: the same three round lobes in'
      + ' a line as the common ant — a slim abdomen at the bottom, a narrow waist in'
      + ' the middle, a round head at the top — but longer and slighter all through,'
      + ' with one pale gold chevron lying flat on the abdomen and pointing up the'
      + ' panel. Six thin bent legs splayed three a side, the back pair longer than'
      + ' the rest, and two curling antennae with a little bead on each tip. Two big'
      + ' glossy eyes on the head looking up the panel, and pink blush. It is alert'
      + ' and cheerful, never fierce.',
    colour: 'a bright teal body going deep petrol at the waist, a pale gold chevron'
      + ' and pale gold antenna beads, cream belly highlight.',
    // Word for word the common ant's gait, and that is the point: the first
    // return with the anatomy fixed still swung its centroid 14.5% of the panel
    // across the cycle (the three sheets that ship sit at 0.2-0.7%), which walks
    // as a creature sliding sideways. "Reaching a little further than the common
    // ant's" and "up and down the PANEL" were the two phrases inviting it — one
    // asks for a bigger leg throw, the other names the panel as something to
    // move along. The leanness carries the character; the gait does not have to.
    motion: 'The six legs swing in a TRIPOD gait — front-left, middle-right and'
      + ' back-left forward together while the other three go back — and the body bobs'
      + ' a hair up and down. The antennae sweep gently side to side. Nothing else'
      + ' moves. The body stays dead centre in its panel in all eight: it never slides'
      + ' left or right, never leans and never tips.'
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
      // The first return painted a different caterpillar in every panel — six,
      // seven, eight beads, bodies bent into an L, and twice a headless chunk
      // standing beside the caterpillar — and the game played it as a creature
      // that changed shape and split in two four times a second. The ripple is
      // the ONLY thing allowed to change.
      + ' It is the SAME caterpillar in all eight panels: the same head and the same'
      + ' four beads behind it, in the same colour order, in ONE STRAIGHT vertical'
      + ' line. Never a bead more or fewer, never a curve or a bend, never a second'
      + ' body or a loose bead standing apart from it.'
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
    // The first painting came back UPSIDE DOWN and shipped that way: fangs at the
    // bottom of the panel under the eyes (a face, composed like a portrait) and a
    // body stub with a gold "crown" at the top — so on the board the centipede
    // walked backwards, glaring at its own tail. "Mandibles at the top" alone did
    // not hold against the pull of a face; the clause below names both ends, says
    // what the bottom edge IS, and names the failure. "Crown" left the colour
    // clause for the same reason: it was painted as one.
    blurb: 'The HEAD SEGMENT ONLY of a centipede, from DIRECTLY ABOVE: one rounded'
      + ' armoured plate, two legs a side, two antennae. THE FRONT IS THE TOP OF THE'
      + ' PANEL: the two antennae AND two short curved mandibles both point UP, out of'
      + ' the top edge of the plate, and the two bright eyes with a slanted brow sit just'
      + ' below them. The BOTTOM edge of the plate is the NECK, where the game joins the'
      + ' body on: plain and rounded, with nothing on it — no mandibles, no fangs, no'
      + ' mouth, no body stub. A head painted the other way up, fangs at the bottom under'
      + ' the eyes, walks BACKWARDS in the game, and that is how the last one came back.'
      + ' It is the head of a long creature whose body is drawn by the game — do NOT'
      + ' paint a body or a tail.',
    colour: 'a hot amber-orange plate with a paler golden highlight at its upper left,'
      + ' dark rust legs and underside, ivory mandibles.',
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
    // Panel by panel, and taken from the drawing (`bugArt.drawMoth`: the wings
    // swing on sin(4πt), TWO beats per loop), because the sentence this replaced
    // — "up at the start, down in the middle, up again at the end" — described
    // ONE beat and contradicted the reference. The return that obeyed neither
    // came back in the order down, down, up, up, down, up, down, down, which
    // plays as a moth that stutters.
    motion: 'TWO slow wing beats in the loop, and each panel says exactly where it is:'
      + ' in panels 2 and 6 both wings are swept furthest BACK, their tips toward the'
      + ' tail; in panels 4 and 8 they stand straight out to the sides at their'
      + ' widest; in panels 1, 3, 5 and 7 they are halfway between. So the loop reads'
      + ' halfway, back, halfway, wide, halfway, back, halfway, wide — the same pose'
      + ' never twice in a row. The antennae flick; the body stays where it is.'
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
  // 224 px a frame, measured rather than guessed.
  //
  // The renderer blits a frame at `size * 2 * pxPerU / BUG_R_FRAC` CSS px times
  // the render DPR (capped at 2), and `pxPerU` is `min(viewport) / 100` — so the
  // number that matters is the SHORT side of the window, and a desktop has a
  // much bigger one than a phone. Measured in a real headless Chrome, biggest
  // body in the cast (the beetle, 4.8 u):
  //
  //   390x844 @3   121 device px   ·  1440x900 @2   279 device px
  //   430x932 @3   133 device px   ·  1920x1080 @2  334 device px
  //
  // So a phone DOWNSCALES the strip at any size worth shipping, and the whole
  // sharpness argument is about desktop, where 160 was a 1.7–2.1x upsample of
  // the largest creature on the board. 224 brings that to 1.2–1.5x and costs
  // 353 kB → 492 kB across the ten strips after `pnpm compress-folder`, which is
  // the budget this was allowed. Going further does not pay: the number that
  // would actually hit 1.0x on a 1080p desktop is ~290 px a frame, i.e. a
  // 2320 px strip per design and roughly 800 kB for the cast.
  //
  // Two things stay soft on a big desktop regardless, and neither is this file's
  // to fix: the procedural bake buckets at 256 px and is baked in CSS px
  // (`bugArt.bucket`), so the DRAWING is upscaled there too, and the reveal
  // card's foe art calls `paintBug` directly rather than blitting a strip.
  maxEdge: 224
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
  /**
   * The panels are DIFFERENT TAKES of the same subject, not one loop of it.
   *
   * Four splats, not four frames of one splat. Everything else about a
   * multi-panel sheet holds — the lattice is the same, the cut is the same
   * arithmetic, the panels compose into the same strip, and the runtime reads
   * them back through `stripFrames` — but the SENTENCE that tells the painter
   * what it is looking at has to be the opposite one, or nine tenths of the
   * prompt is asking for an animation.
   */
  variants?: true
  /**
   * The panels are ONE subject at successive moments of ONE change, in order —
   * the boss eggs' crack stages. Neither a loop (the game never plays panel 4
   * back into panel 1) nor a set of variants (it is the same egg in all four):
   * the game picks the panel from how far the egg's clock has run. Cut, composed
   * and read back exactly as a variation sheet is; only the prompt's sentence
   * about what it is looking at differs, and a stage sheet is told its panels
   * are a sequence.
   */
  stages?: true
  /**
   * One line per panel, saying what THAT panel is. (A stage sheet's roster too.)
   *
   * Asking for variety in the abstract does not produce it. The first splat
   * sheet carried "a different outline, a different number of fingers thrown at
   * different angles" and came back as four round domes with five fingers each,
   * scoring 0.95–0.97 on a coverage similarity check — four chances spent
   * painting one picture. A contact sheet gets variety because every cell is
   * SPELLED OUT (`promptForGrid`'s roster); a variation sheet needs the same
   * thing for the same reason, and this is it.
   */
  variantBlurbs?: readonly string[]
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
  variants?: true
  stages?: true
  variantBlurbs?: readonly string[]
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
  cycle: o.cycle,
  variants: o.variants,
  stages: o.stages,
  variantBlurbs: o.variantBlurbs
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

/**
 * ─── The centipede's tail ───────────────────────────────────────────────────
 *
 * The walk strip is the HEAD ONLY — its own prompt says "do NOT paint a body or a
 * tail" — because the tail is six segments the game chains along the head's path
 * one at a time (`bugArt.paintSegment`). So once the head was painted, the tail
 * was the last inked creature part on the board: a painted head towing six
 * drawn blobs.
 *
 * One segment, as an eight-panel strip of its leg stroke. The game plays it
 * behind the head with a lag per segment, which is what makes the tail ripple,
 * and turns each one along the path — so it is authored head-end UP like every
 * creature here. The colour clause is the PAINTED head's, sampled off
 * `images/bugs/centipede.webp`, not the drawing's browner palette: the segment has
 * to read as the same animal as the painting it follows, and the drawing it
 * replaces is the thing that did not.
 */
const BUG_PART_STILLS: StillSpec[] = [
  still('bug', CENTIPEDE_SEGMENT_ART, 'Centipede — tail segment',
    'ONE BODY SEGMENT of a cartoon centipede, from DIRECTLY ABOVE, the head end'
    + ' toward the TOP of the panel: a single rounded armoured plate, a little wider'
    + ' than it is long, with ONE short jointed leg sticking out of each side. The'
    + ' plate is hot amber-orange — bright orange (#f09020) where the light hits at its'
    + ' upper left, deeper orange (#d06010) across the middle, dark rust (#7a2e0c) in'
    + ' the shadow at its lower right — with a thick warm near-black ink contour; the'
    + ' legs are dark rust with the same ink. The same armour as the painted centipede'
    + ' head it follows. NOTHING else: no head, no eyes, no antennae, no mandibles, no'
    + ' neighbouring segments, no tail tip, no ground.', {
      w: 320, h: 320, frames: 8, cols: 4, rows: 2,
      // The segment is blitted into `2 · SEGMENT_ART_BOX · r` = 7.9 u of a 3.3 u
      // centipede, three quarters of the head frame's 10.6 u — so three quarters
      // of the walk strips' 224 px a frame.
      maxEdge: 168,
      anchor: 'centre',
      authored: 'Head end to the TOP of the panel. The game turns every segment to'
        + ' follow the path the head took, so it must be drawn straight up.',
      cycle: 'ONE full stride of the two legs over the eight panels, and nothing else'
        + ' moves. Both legs swing TOGETHER, mirror images of each other, like a pair of'
        + ' oars: panel 1 both legs straight out to the sides, panels 2 and 3 both'
        + ' swinging forward toward the head end, panel 3 the furthest forward, back'
        + ' through straight out at panel 5, panel 7 the furthest back toward the tail'
        + ' end, and panel 8 on the way back to panel 1. The plate itself never moves,'
        + ' turns, grows or changes colour.',
      live: 'The game chains six of these behind the painted head, each turned to'
        + ' follow the head\'s path and a step behind the one in front of it in the'
        + ' stride — so paint ONE segment on its own, with no shadow and no floor.'
    })
]

/**
 * ─── The brood: every boss fight's eggs ─────────────────────────────────────
 *
 * See "The brood" in `bosses.ts`. Two looks — the ant egg four bosses bring, and
 * Roach Prime's capsule — and each is TWO drawables:
 *
 *   a STAGE sheet   four panels, whole → hairline → cracked → splitting, which
 *                   the game picks between by how far the egg's clock has run
 *                   (`propArt.eggStage`). Painted as stages rather than as one
 *                   egg with drawn cracks on top because the old `pod` still was
 *                   exactly that, and with the art layer on its cracks were
 *                   never drawn: a painted egg that did not crack was an egg
 *                   that gave no warning. 2 × 2 so the sheet is square, which
 *                   every image tool offers.
 *   a SHELL still   the empty halves a hatch leaves stamped on the floor.
 *
 * `fit: false` on the stage sheets for the splat's reason: the bench measures
 * panel 0 (a whole egg), and the last panel's lifted cap makes the union of the
 * returned panels systematically taller — normalising onto panel 0 would shrink
 * all four. The size is in the words instead, and the panel box is
 * `propArt.EGG_ART_BOX` on both sides of the round trip.
 *
 * The capsule earns its own sheets: it is the final boss's, the arcade world is
 * steel and neon where a cream egg reads as a stray from world 1, and its
 * cutscene already shows a production line of pods. The rocking, the pop, the
 * hatch burst and the ants coming out are the game's, so none of them is
 * painted.
 */
const EGG_STAGE_LIVE = 'The game rocks it from side to side as its clock runs out, and pops or'
  + ' hatches it with a burst of its own, so paint no motion lines, no burst, no'
  + ' shadow and no floor.'

/**
 * The clause both stage sheets carry, and the reason it is in the BLURB rather
 * than trusted to the style block's "no halo": the first two rolls of the egg
 * were told its inside was LIGHT that "spills out", and then that the light
 * "stays inside the outline" — and both came back with a soft yellow-pink bloom
 * spreading past the shell over the magenta, which keys to a pink smear. Light
 * is the word that paints a bloom. Paint is the word that does not.
 */
const BROOD_NO_GLOW = (colour: string, what: string): string =>
  `NOTHING IN THIS SHEET GLOWS: the ${colour} parts are FLAT ${colour} PAINT with a`
  + ' crisp ink edge, never light — no bloom, no halo, no soft haze, and not one pixel'
  + ` of ${colour} or pink tint outside the ${what}'s ink line. A glow painted over the`
  + ` background cannot be cut away and arrives in the game as a pink smear around the ${what}.`

const BROOD_STILLS: StillSpec[] = [
  still('prop', 'egg', 'Boss egg — hatch stages',
    'A big cartoon ANT EGG seen from DIRECTLY ABOVE, standing on end: a smooth pale'
    + ' cream oval, a little wider at the bottom, with a few faint tan speckles, one soft'
    + ' cel shadow along its lower right, and one small white sheen at its upper left.'
    + ' The shell is solid and opaque: no patch, stain, yolk or shape showing through it.'
    + ' The SAME egg in all four panels, at four moments of getting ready to hatch, and'
    + ' it stays cute in all of them — a present about to open, never something broken'
    + ' or gross. In every panel it covers about three quarters of the panel\'s height'
    + ' and three fifths of its width, dead centre. ' + BROOD_NO_GLOW('golden-yellow', 'egg'), {
      fit: false, frames: EGG_STAGES, cols: 2, rows: 2, stages: true,
      cycle: 'Only the cracks and the golden inside change. The egg does not move,'
        + ' turn, grow or change colour between panels except where a panel below'
        + ' says so: the four panels are one egg seen four times as it gets ready.',
      variantBlurbs: [
        'WHOLE. The egg smooth and unbroken — no crack anywhere.',
        'A HAIRLINE. One thin dark zigzag crack running from the top of the egg a third'
          + ' of the way down it. Otherwise the same egg as panel 1.',
        'CRACKED. That crack is longer and forks, a second crack comes in from the left'
          + ' side, and one small chip of shell is missing near the top, the hole showing'
          + ' the flat golden-yellow inside with an ink edge round it.',
        'SPLITTING. The egg has split along a zigzag line across its middle: the top'
          + ' half is lifted a little and tipped, the bottom half is a cup, and the gap'
          + ' between them is a band of flat golden-yellow with an ink line along both'
          + ' broken rims, with two tiny, cute ant antennae with a round bead on each tip'
          + ' poking up out of it. The yellow stays exactly inside the gap. The two halves'
          + ' are still the same cream shell.'
      ],
      live: EGG_STAGE_LIVE
    }),
  still('prop', 'egg-shell', 'Boss egg — empty shell',
    'The EMPTY SHELL of a hatched cartoon ant egg lying on the floor, seen from'
    + ' DIRECTLY ABOVE: two broken halves with zigzag rims lying a little apart — a'
    + ' bigger cup at the lower left showing its pale inside, a smaller cap at the'
    + ' upper right tipped over — and three tiny chips of shell nearby. Pale cream'
    + ' shell with a slightly darker, warmer inside. Clean and empty: nothing inside'
    + ' it, no goo, no creature.', {
      live: 'The game stamps it flat on the floor where an egg hatched, under the bugs,'
        + ' the shoe and every effect, so paint only the shell pieces — no shadow and'
        + ' no floor.'
    }),
  still('prop', 'egg-capsule', 'Robot egg capsule — hatch stages',
    'A cartoon ROBOT EGG CAPSULE seen from DIRECTLY ABOVE, standing on end: a rounded'
    + ' metal pill of brushed pale steel, lit from the upper left and shading to slate'
    + ' blue on the right, with a dark band around its middle holding a thin bright'
    + ' CYAN line, two small dark rivets above the band and two below it, and a round'
    + ' porthole window near the top in cyan. A toy out of an arcade machine — shiny,'
    + ' chunky and friendly, never a weapon or a bomb. The SAME capsule in all four'
    + ' panels, at four moments of opening. In every panel it covers about three'
    + ' quarters of the panel\'s height and half its width, dead centre. '
    + BROOD_NO_GLOW('cyan', 'capsule'), {
      fit: false, frames: EGG_STAGES, cols: 2, rows: 2, stages: true,
      cycle: 'Only the cyan parts, the bolts and the seam change. The capsule does not'
        + ' move, turn, grow or change colour between panels except where a panel below'
        + ' says so: the four panels are one capsule seen four times as it gets ready to'
        + ' open.',
      variantBlurbs: [
        'CLOSED. Sealed shut, the band\'s line and the porthole a soft pale cyan.',
        'HUMMING. The same capsule with one thin panel line across its lower half, and'
          + ' the band\'s line and the porthole a brighter cyan.',
        'RATTLING. Two small bolts have popped half out of their holes, two tiny solid'
          + ' white-yellow spark marks fly off the side of the band, and the cyan is'
          + ' brighter still.',
        'OPENING. The capsule has split along its middle band: the top half is lifted a'
          + ' little and tipped, the gap between the halves is a band of flat bright cyan'
          + ' with an ink line along both rims, and two tiny, cute ant antennae with a'
          + ' round bead on each tip poke up out of it. The cyan stays exactly inside the'
          + ' gap.'
      ],
      live: EGG_STAGE_LIVE
    }),
  still('prop', 'egg-capsule-shell', 'Robot egg capsule — empty halves',
    'The EMPTY HALVES of an opened cartoon robot egg capsule lying on the floor, seen'
    + ' from DIRECTLY ABOVE: two brushed-steel cups with smooth rims and dark'
    + ' navy insides, a thin cyan light strip running straight across each dark inside,'
    + ' lying a little apart — a bigger one at the lower left, a smaller one at the upper'
    + ' right tipped over — and three tiny triangular chips of steel nearby. Clean and'
    + ' empty: nothing inside. NO SHADOW OF ANY KIND: the first return laid a darker'
    + ' magenta shadow under each cup, and a shadow tinted into the background cannot be'
    + ' keyed — it arrives as a purple smear on the floor. The magenta touching the metal'
    + ' is the same flat #FF00FF as the corners of the image.', {
      live: 'The game stamps it flat on the floor where a capsule opened, under the'
        + ' bugs, the shoe and every effect, so paint only the metal pieces — no'
        + ' shadow, no glow pad and no floor.'
    })
]

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
    + ' each with a soft crust edge and a paler crumb face.',
  shoebox: 'A shoebox wrapped as a present, seen from DIRECTLY ABOVE: a candy-pink lid'
    + ' a little wider than the box, a bright yellow ribbon crossing it both ways and a'
    + ' fat yellow bow tied in the middle. It looks like a gift with something exciting'
    + ' inside — a toy, not a parcel.'
}

const PROP_STILLS: StillSpec[] = [
  // Every floor object but the SLICK lane: it is a strip as long as the board it
  // is spilt across, and a square painting stretched down a lane is a smear —
  // `paintHazard` never probes for one.
  ...HAZARDS.filter((h) => h.id !== 'slick').map((h) => still('prop', h.id, `Prop — ${h.id}`, HAZARD_BLURB[h.id] ?? '', {
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
    + ' token.', { maxEdge: 128, extra: [{ target: 'images/props/coin_128x128.webp', size: 128 }] }),
  ...BROOD_STILLS
]

/**
 * ─── The splat decals ───────────────────────────────────────────────────────
 *
 * The mark a squish leaves on the floor, and the one drawable whose painting
 * can never be shipped in a colour: `stampSplat` is handed the BUG'S OWN goo, so
 * the ant's magenta, the sprinter's teal and the stinkbug's violet all have to
 * come off the same file. `greyscale: true` is that contract — the painter sends
 * shape and shading, the game sends the colour (`uiArt.splatSprite`).
 *
 * TWO sheets and not one, and not three. `JUICE_STYLE`'s rule is that a style
 * changes the picture and the sound, never a number, so the paintings split
 * exactly where the pictures already split and nowhere else: `ooze` and
 * `bubble` share the goo sheet because they already share `paintSplat`'s puddle
 * (soap is that same mark at the spec's own 0.12 alpha), and `confetti` gets its
 * own because it already branches to chips. One sheet would put a wet puddle
 * under the accessibility style whose whole point is that nothing bursts wetly.
 *
 * FOUR panels each, and they are VARIATIONS rather than a loop — see
 * `SPLAT_VARIANTS` for why four. They are cut and composed exactly as a walk
 * cycle is and read back with the same `stripFrames`; only the prompt's own
 * sentence about what it is looking at differs.
 *
 * `fit: false` for a reason worth stating, because these are solid paint and
 * every other `fit: false` here is a glow. The bench measures the fit on PANEL
 * ZERO and the slicer compares it against the union of every returned panel's
 * box — which on a variation sheet is systematically larger than any one
 * panel, by however much the variants differ. Normalising onto it would shrink
 * every set of splats in proportion to how well the painter varied them. The
 * size goes in the words instead.
 */
const SPLAT_STILLS: StillSpec[] = [
  still('fx', 'splat', 'Splat decal — goo',
    'A splash of thick cartoon slime lying flat on the floor, seen from DIRECTLY'
    + ' ABOVE: a rounded puddle with a glossy domed middle, five or six fat tapering'
    + ' fingers flung out of it, and two or three loose round droplets settled beyond'
    + ' their tips. The middle is the darkest tone, a bright wet highlight runs along'
    + ' the upper-left rim, and every edge is smooth, rounded and fluid — the shape a'
    + ' dropped scoop of jelly makes. It NEARLY FILLS its panel: the puddle spans about'
    + ' the middle half of it and the fingertips reach close to the edges.', {
      greyscale: true, fit: false,
      frames: SPLAT_VARIANTS, cols: SPLAT_COLS, rows: SPLAT_ROWS, variants: true,
      cycle: 'Every panel is a DIFFERENT splash — a different outline, a different'
        + ' body, a different number of fingers and a different scatter of droplets.'
        + ' Four separate marks of the same goo, listed one by one below, and each'
        + ' one has to be recognisable as the one described.',
      variantBlurbs: [
        'A ROUND one. A single fat circular puddle with SIX short stubby fingers'
          + ' spaced evenly all the way round it, like a splash seen straight down,'
          + ' and three small droplets close in.',
        'A LONG one. The puddle is stretched into an oval running from the lower'
          + ' left to the upper right, with TWO long thin fingers trailing off the'
          + ' lower-left end and a line of four droplets continuing past them — a'
          + ' splash thrown by something moving.',
        'A LOPSIDED one. A big rounded puddle with all THREE of its fingers thrown'
          + ' out to one side in a fan, the opposite side smooth and bare, and five'
          + ' droplets scattered wide on the finger side only.',
        'A BURST one. TWO puddles of different sizes joined by a narrow neck of'
          + ' goo, with EIGHT thin spiky fingers of different lengths radiating from'
          + ' both of them and six small droplets flung far out all round.'
      ],
      live: 'The game tints each one to the colour of the creature it came out of and'
        + ' stamps it flat on the floor, under the bugs, the shoe, the burst and the'
        + ' shockwave ring — so a panel is only the mark that is left behind.'
    }),
  still('fx', 'splat-confetti', 'Splat decal — confetti',
    'A scatter of paper party confetti lying flat on the floor, seen from DIRECTLY'
    + ' ABOVE: about twenty small paper chips — rectangles and rounded discs, some'
    + ' flat, some bent or curled along a fold — thrown out from a common middle and'
    + ' come to rest. Each chip has a crisp ink edge, a flat face and one soft fold'
    + ' shadow. The scatter NEARLY FILLS its panel — densest across the middle,'
    + ' thinning towards the edges — and it is loose litter rather than a heap, with'
    + ' floor showing between the chips everywhere.', {
      greyscale: true, fit: false,
      frames: SPLAT_VARIANTS, cols: SPLAT_COLS, rows: SPLAT_ROWS, variants: true,
      cycle: 'Every panel is a DIFFERENT scatter: the chips come to rest in different'
        + ' places, at different angles and in different sizes. Four separate'
        + ' handfuls, each one its own arrangement.',
      live: 'The game tints each one to the colour of the creature it came out of and'
        + ' stamps it flat on the floor, under the bugs, the shoe and the burst — so a'
        + ' panel is only the litter that is left behind.'
    })
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
  // The ONLY consumer of this painting is the dust a stomp throws up
  // (`useBugCrunchArt`'s `stomp` case, the one `shape: 3` emitter in the game),
  // so it is written as that and not as generic smoke. A charged stomp now
  // throws twenty-two of these out fast on a high drag and drops four fat slow
  // ones on the impact, which is a different job from a drifting cloud: the
  // edge has to stay legible when the sprite is small and moving, and the
  // middle has to stack without turning into a grey disc.
  still('fx', 'smoke', 'Dust puff',
    'One puff of floor dust seen from DIRECTLY ABOVE, the kind a heavy boot'
    + ' throws up as it lands: a rounded billowy cloud of three or four soft'
    + ' lobes, THICKEST and brightest just off its middle and thinning to nothing'
    + ' at its edges, with a few specks of grit flung clear of the main body. Lit'
    + ' from the upper left, so the lobes on that side are pale and the ones away'
    + ' from it are a soft mid grey. Grey and WHITE only, no colour anywhere. It'
    + ' is dry dust — loose, airy and soft-edged, with no hard outline around it.',
    { greyscale: true, fit: false }),
  // The other tinted particle, and the loudest one: `useVfx`'s shape 4, thrown
  // by every squish, every popped egg and — forty at a time — by a boss going
  // down. Its box is 2:1 because the drawable IS a teardrop lying along +x, and
  // the runtime rotates it to the droplet's own velocity and stretches it with
  // the droplet's own speed. Painted head-at-the-right for that reason, and said
  // so in as many words, because a model handed "a droplet" with no direction
  // returns one falling downward and every drop in the game would fly sideways.
  still('fx', 'goo-drop', 'Goo droplet',
    'ONE fat droplet of thick cartoon slime in flight, seen from DIRECTLY ABOVE,'
    + ' lying on its side so that it flies to the RIGHT: a fat rounded head at the'
    + ' RIGHT-HAND end, its widest point about a third of the way in, tapering back'
    + ' to a long thin pointed tail that reaches the LEFT edge of the frame. One'
    + ' small bright specular highlight sits on the upper LEFT of the head. The body'
    + ' is smooth, glossy and fluid, mid grey shading to pale at the rim, with soft'
    + ' rounded edges and no hard outline. Grey and WHITE only, no colour anywhere.'
    + ' It fills the frame end to end with a small margin, and there is nothing else'
    + ' in the frame — no second droplet, no splash, no floor.',
    { greyscale: true, fit: false,
      // 2:1, and the runtime's bake is 192x96 — the same ratio, so a return that
      // obeys the frame lands on the drawn droplet without being squashed.
      w: STILL_PX, h: STILL_PX / 2, maxEdge: 192,
      authored: 'flying to the RIGHT — the head at +x, the tail at −x',
      live: 'The game tints it to the colour of the creature it came out of, turns it'
        + ' to whichever way the droplet is flying and stretches it along that line'
        + ' with the droplet\'s own speed — so the tail must be the LEFT end and the'
        + ' head the RIGHT one, or every drop in the game flies backwards.' }),
  ...SPLAT_STILLS
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

/** What every floor tile is told, lead or not. */
const FLOOR_LIVE = 'The game stamps bright splats, shadows and props over this, so keep it'
  + ' MID-TONE and quiet — texture, not objects. Nothing here may read as a thing'
  + ' the player could stomp.'

/**
 * ─── The other thirty-six floors ────────────────────────────────────────────
 *
 * Every level has its own surface (`FLOORS` in `floors.ts` — ten per world),
 * and until now only the four a world SHIPS with had a painting. The other
 * thirty-six drew themselves, which was a deliberate stop rather than a
 * decision: `floorTile` hung the world's lead painting on all ten of its levels
 * once, which put the gingham blanket back on every picnic level, and the fix
 * was to stop probing rather than to paint the rest.
 *
 * ── The colour clause is DERIVED, and that is the whole point ──
 *
 * `floors.ts` holds all forty to three legibility rules — a floor commits to a
 * polarity and its field sits in that polarity's band, its own marks stay
 * quieter than a body, and it is not the colour of the thing walking on it —
 * and `tests/game/floorPalette.test.ts` enforces them on all forty.
 *
 * It enforces them on the PALETTE. A painted tile replaces `paintFloorTile`
 * outright, so a painting is the one way into this game's floors that those
 * fifteen cases cannot see. A brief that merely described the surface in words
 * would be free to come back a shade that eats the bugs, and nothing would say
 * so until a player on a phone in sunlight could not find an ant.
 *
 * So the prompt is not written per floor — it is COMPOSED from the floor's own
 * palette, and the numbers in it are the same numbers the test reads. A floor
 * whose palette changes gets a new prompt for free, and a prompt can never
 * contradict the contract because it has no independent copy of it.
 *
 * `tools/check-floor-art.mjs` closes the other half: it measures what actually
 * came back against those same rules.
 */
const floorColourClause = (id: FloorId): string => {
  const p = FLOOR_PALETTE[id]
  const field = floorField(id)
  const dark = p.key === 'dark'
  return `COLOUR — this is binding, and it is what the tile is graded on.`
    + ` The overall surface must read as ${field}`
    + ` (${dark ? 'a DARK floor: everything on it is lit, and the surface is the unlit thing'
      : 'a LIGHT floor: bodies are read on it as dark silhouettes'}).`
    + ` Its two field tones are ${p.base} and ${p.alt}.`
    + ` The brightest mark may go to ${p.line} and the darkest to ${p.shade}, and no further.`
    + (p.structure === true
      ? ` The bright ${p.line} may be STRUCTURE only — a rule, a grid, a joint, a trace that`
        + ' crosses the whole tile edge to edge. It may never be a compact bright blob:'
        + ' a blob the size of a bug is read as a bug.'
      : ` Keep every mark COMPACT and quiet — no mark may be brighter or darker than the`
        + ' field by more than a whisker, because a bug is about a twentieth of this tile'
        + ' across and anything with that much contrast at that size is read as one.')
}

/** The four a world ships with, painted first and unchanged since. */
const LEAD_FLOOR_STILLS: StillSpec[] = ([1, 2, 3, 4] as const).map((w) =>
  still('bg', `floor-${w}`, `Floor — ${WORLDS[w].theme}`, FLOOR_BLURB[w]!, {
    w: 512, h: 512, maxEdge: 512, exact: true,
    bg: 'opaque', tile: 'xy', fill: true, fit: false,
    live: FLOOR_LIVE
  }))

/**
 * …and the thirty-six level floors.
 *
 * `maxEdge` is 256 where the leads are 512, and that is a measurement rather
 * than a saving: every consumer in the game reaches a floor through
 * `floorTile()`, which draws it into a `FLOOR_TILE_PX` (256) canvas and makes
 * the repeating pattern from that. A 512 painting has half its pixels thrown
 * away on the way in, at four times the bytes. (The four leads are left at 512
 * so their shipped files and receipts stay exactly as they are; re-cutting them
 * at 256 is a free ~100 kB whenever someone wants it.)
 */
const LEVEL_FLOOR_STILLS: StillSpec[] = FLOOR_IDS
  .filter((id) => !isLeadFloor(id))
  .map((id) => still('bg', id, `Floor — ${WORLDS[worldOfFloor(id)].theme} — ${id}`,
    `A seamless tile of ${FLOOR_SUBJECT[id]}, seen from DIRECTLY ABOVE.`
      + ` ${floorColourClause(id)}`, {
      w: 512, h: 512, maxEdge: 256, exact: true,
      bg: 'opaque', tile: 'xy', fill: true, fit: false,
      live: FLOOR_LIVE
    }))

const FLOOR_STILLS: StillSpec[] = [...LEAD_FLOOR_STILLS, ...LEVEL_FLOOR_STILLS]

/**
 * The HUD's own art.
 *
 * ── Why most of these are 128 and three of them are not ──
 *
 * A mark's `maxEdge` is not a quality dial, it is the answer to one question:
 * how many DEVICE pixels does the biggest box this drawable is ever rendered
 * into actually ask for? Measured in a real headless Chrome with the art layer
 * on, at dpr 2 (the desktop/tablet target) and dpr 3 (a phone):
 *
 *   locker / fever / timer / target   ≤ 36 css px — a HUD button glyph, a vial
 *                                     cap, an objective row. 0.3–0.6x at 128:
 *                                     already a DOWNSCALE, and 256 would be
 *                                     four times the bytes for nothing.
 *   star / icon-star-empty            53 css px in `StarRow`'s middle socket
 *                                     (158–174 device px) → 1.23–1.36x at 128,
 *                                     and it is the headline of the result
 *                                     screen. 256 makes it 0.62–0.68x.
 *   star / trophy / icon-chest        `RewardRevealModal` draws the glyph at
 *                                     72% of `clamp(6rem, 34vmin, 12rem)` —
 *                                     96–138 css px, 276–316 device px →
 *                                     2.2–2.5x at 128, which is the softness
 *                                     the reveal screen was reported for.
 *                                     256 brings it to 1.08–1.23x.
 *   chest                             40–54 css px on the HUD, and its alpha is
 *                                     ALSO the CSS mask the cooldown drain is
 *                                     cut with (`TreasureChest.vue`
 *                                     `.chest__shade`), so a 128 px alpha is a
 *                                     128 px mask edge on a 142 device-px box.
 *
 * 256 is also the pipeline's own ceiling for a still: `slice-sheets.mjs`
 * defaults to `--size 256` and takes the LOWER of that and `maxEdge`, so a
 * number above 256 here is a wish, not a size, unless the sheet is `exact` or
 * somebody remembers to pass `--size`. (That is why `ribbon` is 597x256 on disk
 * and not 1344x576, and the bosses are 256 and not 512.)
 */
const UI_STILLS: StillSpec[] = [
  still('ui', 'ribbon', 'Result banner',
    'A wide award plaque seen flat-on: a deep plum-black iron plate with softly'
    + ' rounded corners, a polished gold rail running the full length of the top edge'
    + ' and another along the bottom edge, and a heavy gold end-cap wrapping each short'
    + ' end with one round gold rivet set in its middle. The MIDDLE of the plate is a'
    + ' plain unbroken dark band.', {
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
    { maxEdge: 256, greyscale: true, fit: false }),
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
    { maxEdge: 256, greyscale: true, fit: false }),

  /**
   * The idle chest on the HUD (`TreasureChest.vue`).
   *
   * NOT `icon-chest`. That one is a 16–24 px button glyph in the icon set; this
   * is the object itself, the thing a player taps every few minutes, drawn at
   * 40–54 css px with a lid, a clasp and a keyhole in it. The component draws it
   * as an inline SVG today and swaps to this painting the moment it exists, so
   * the blurb below describes THAT DRAWING — the honey-wood chest in this game's
   * palette — and not the dark-iron dungeon chest `images/ui/chest.webp` held in
   * the project this was forked from.
   *
   * `fit: false`, and the alpha is load-bearing: the cooldown drain is a second
   * element masked with `mask-image: url(<this file>)` at `mask-size: contain`,
   * so the painting's own transparency IS the shutter's outline. A return with a
   * painted-in card, plate or vignette behind the chest does not look slightly
   * wrong — it makes the drain a rectangle over the whole box.
   */
  still('ui', 'chest', 'Treasure chest',
    'A cartoon treasure chest seen FLAT-ON from the front, filling the frame with a'
    + ' small even margin, cut out on a transparent background. A domed lid arching'
    + ' across the top half, a lip band running the full width where the lid meets the'
    + ' box, and a squat rounded body under it with ONE horizontal plank seam low'
    + ' across its front. Dead centre on the lip, a butter-gold clasp plate with a'
    + ' round keyhole and a short tapering slot under it, drawn in the same near-black'
    + ' ink as the outline. The wood is warm honey — a pale cream-gold where the light'
    + ' catches the lid\'s top-left shoulder, deepening to amber at the bottom — and'
    + ' the cel shadow is a drawn shape down the RIGHT side of both the lid and the'
    + ' body. NO grey, NO black, NO iron bands, NO rivets, NO studs, NO hinges and NO'
    + ' padlock: this is a present, not a strongbox. The lid is CLOSED and nothing'
    + ' spills out of it — no coins, no gems, no light shaft. Fat even ink and'
    + ' generous corner radii throughout; anything finer than a fortieth of the frame'
    + ' disappears at the size this is shown.',
    {
      maxEdge: 256,
      fit: false,
      live: 'The game masks a dark cooldown veil to this painting\'s OWN ALPHA and'
        + ' slides it up from the bottom, so the transparency has to be the chest\'s'
        + ' silhouette exactly: no card, no plate, no badge, no floor, no glow pad and'
        + ' no soft halo behind it. The game adds the bob, the gold aura and the'
        + ' sparkles itself.'
    })
]

/**
 * The logo.
 *
 * Never probed at run time — the PWA manifest and every portal read it at fixed
 * sizes from `images/logo/`, so its targets are explicit and its `maxEdge` is
 * `exact`.
 */
/**
 * ─── A measured limit of this slot ──────────────────────────────────────────
 *
 * The splat comes back DARK. Two rolls, the second with the pink stated as
 * emphatically as the prompt language allows ("BRIGHT HOT PINK — the pink of
 * bubblegum or a highlighter pen, fully saturated and LIGHTER than the gold
 * letters in front of it"), and both returned a deep maroon-wine burst rather
 * than the reference's #ff3f86. The second was darker than the first, and
 * tighter in the frame as well, so the FIRST roll is the one that ships.
 *
 * It costs something real: on the splash the logo sits on a dark plum ground,
 * where a maroon splat has far less separation than the drawn version's pink
 * had. The gold lettering carries it, and the lime rim is what keeps the burst
 * legible at all.
 *
 * Do not spend another generation on the wording — that has been tried twice.
 * If the brighter splat matters more than the painting does, the drawn lockup
 * is one command away and is not worse, only flatter:
 *   node scripts/make-brand.mjs --force --only images/logo/logo_,images/icons
 */
const LOGO_STILL: StillSpec = still('ui', 'logo', 'Bug Crunch logo',
  'The wordmark BUG CRUNCH on TWO LINES, BUG above CRUNCH, both lines the same'
  + ' width so the pair reads as one square slab. Fat rounded cartoon letterforms'
  + ' in warm gold, lit from the upper left, each letter carrying a heavy warm'
  + ' near-black contour and a cream gloss along its top edge, standing on a solid'
  + ' near-black extrusion a little below and right. Behind the words, a splat'
  + ' bursting outward in BRIGHT HOT PINK — the pink of bubblegum or a highlighter pen, fully saturated and LIGHTER than the gold letters in front of it — with'
  + ' vivid lime green under-spatter showing at its points, and a few flung pink'
  + ' and lime droplets around it. Coming down from the TOP,'
  + ' overlapping the splat and the top of the word, one chunky cartoon sneaker'
  + ' sole seen from below — gold, with three rounded lime tread bars across it'
  + ' and the same near-black contour. Centred, filling the frame with a small'
  + ' even margin.', {
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

/**
 * The MARK — the lockup with the words taken out.
 *
 * A separate slot rather than a resize of the logo, and the reason is measured:
 * the lockup is a two-line wordmark, and at 16 px on a tab strip two lines of
 * type average into a smudge. So the small slots get an object instead — the
 * same sole on the same splat, alone on its own ink tile, which still reads as
 * a gold thing on pink when it is sixteen pixels across. See the contact sheet
 * in `tests/ui/brandLockup.test.ts` and the header of `scripts/make-brand.mjs`.
 *
 * `bg: 'opaque'` because this one is NOT a cut-out: the tile is the mark. It is
 * what lets the favicon sit on a light tab strip and a dark one without a halo,
 * and what iOS composites its home-screen icon from.
 */
const MARK_STILL: StillSpec = still('ui', 'mark', 'Bug Crunch mark',
  'A square app icon, filled edge to edge, with generously rounded corners.'
  + ' The ground is a deep near-black plum tile. Standing on it, filling most of'
  + ' the square: one chunky cartoon sneaker sole seen from below — warm gold, lit'
  + ' from the upper left, with three rounded lime green tread bars across it, a'
  + ' heavy warm near-black contour and a cream gloss along its top edge. Behind'
  + ' the sole, a hot pink splat bursting outward with lime green under-spatter'
  + ' showing at its points. No letters, no words, nothing written anywhere. One'
  + ' bold object on a tile, readable at the size of a thumbnail.', {
    w: 1024, h: 1024, maxEdge: 512, exact: true, fit: false, fill: true,
    bg: 'opaque',
    target: 'images/logo/mark_512x512.png',
    extra: [
      { target: 'images/logo/mark_192x192.png', size: 192 },
      { target: 'images/logo/mark_180x180.png', size: 180 },
      { target: 'images/logo/mark_32x32.png', size: 32 }
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

/**
 * Glyphs that stay a flat white silhouette. Everything else is an object.
 *
 * `TINTED_GLYPHS`, not a second list beside it: the set that decides which
 * prompts ask for a silhouette is the set the renderer masks and colours, or a
 * mark gets painted flat white and then shown untinted (a grey star where a gold
 * one was earned). The reasoning for each entry is in `artCatalogue.ts`.
 *
 * The six that are also HUD marks are in that set too and simply never reach
 * here — `GLYPH_STILLS` filters them out above, because their painting is the
 * HUD mark's own.
 *
 * ── The one exception, and why it is allowed to stand ──
 *
 * `star-empty` is masked by the renderer but stays an OBJECT here. It is the
 * one mark where the two concerns `greyscale` bundles together — "the game
 * colours it" and "which contact sheet it is painted on" — genuinely disagree,
 * and where the second one has a price. It is already painted, as a warm gold
 * outline star, and masking uses only alpha, so that painting is correct as it
 * stands and nothing is waiting on a repaint. Moving it to the marks register
 * would re-pack BOTH lattices: four painted contact sheets flagged for a
 * repaint, and `objects-3` orphaned outright — real churn in the painter's
 * workflow, to change the wording of a prompt for a mark that does not need
 * repainting. A hollow outline is the one shape whose colour cannot matter once
 * it is masked, which is why the exception is safe here and nowhere else.
 */
const GLYPH_MARKS: ReadonlySet<GameIconName> =
  new Set([...TINTED_GLYPHS].filter((n) => n !== 'star-empty'))

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

/**
 * The two glyphs that are not only a button.
 *
 * A glyph slot is 128 because a glyph is drawn at 16–24 css px on a button and
 * there are fifty of them. These two are also shown as PICTURES: the result
 * screen's star sockets carry `star-empty` at 53 css px, and
 * `RewardRevealModal` draws `star`, `trophy` and `chest` at 72% of a box that
 * reaches 12rem — 276–316 device px, where 128 is a 2.2–2.5x upsample and looks
 * exactly as soft as it is. Measured, not guessed; see the note on `UI_STILLS`.
 */
const BIG_GLYPHS: Partial<Record<GameIconName, number>> = {
  'star-empty': 256,
  chest: 256
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
        // them, which is the other half of the reason. The two that are also
        // shown as pictures are the exception above.
        w: 256, h: 256, maxEdge: BIG_GLYPHS[n] ?? 128,
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
// that came back wrong is re-rolled for one generation instead of nine. Which of
// the two a slot's file is actually cut from is `UI_CUT_FROM`, below the grids.

/** The square ONE CELL of a contact sheet is authored in. */
const GRID_CELL_PX = 256

/**
 * Cells per contact sheet, and the width of the grid.
 *
 * Three by three, because the grid is the part a model gets wrong. The queue
 * paints rules out (`--drop-borders-if-ruled`) because Gemini ruled a plain eight-panel
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
      // The sheet is cut at whatever its BIGGEST member asks for, not at the
      // glyph default.
      //
      // A contact sheet is a second ROUTE to the same targets, never a second
      // contract about them: cut at a flat 128 it would quietly write a smaller
      // file than the manifest asks for, so a grid re-roll would undo the star
      // and the chest every time somebody re-rolled the sheet they happen to sit
      // on — the kind of regression that shows up as "the art went soft again"
      // months later with nothing in the diff to point at. `edgeCap` in the
      // slicer is per SHEET and cannot be per cell, so one big member lifts its
      // whole lattice; that is a few kB on eight glyphs that did not need it,
      // against a silent downgrade of the two that did.
      maxEdge: Math.max(128, ...cells.map((c) => c.maxEdge)),
      greyscale: register === 'marks',
      members: cells,
      live
    }
  })
}

/**
 * Every square ui slot that belongs on a contact sheet.
 *
 * Two are kept off it. The RIBBON because it is a 2.3:1 banner and a wide cell
 * on a lattice of squares comes back a square. The CHEST because a contact sheet
 * is nine things painted to one instruction — "each is ONE object, centred, at
 * 16–24 px, nothing behind it" — and the chest is none of that: it is the only
 * ui slot whose alpha is used as a CSS mask, it is shown at twice a glyph's size
 * and it is cut at twice a glyph's resolution. Painted in a cell it would come
 * back balanced against eight button icons, which is the wrong thing for it to
 * be balanced against.
 *
 * Keeping it off also leaves the existing lattice alone: `chest` is the only
 * full-colour entry in `UI_STILLS`, so putting it on the objects register would
 * insert a cell at position one and shift every painted object glyph by one
 * file.
 */
const OFF_THE_GRIDS = new Set(['ribbon', 'chest'])
// Filtered AFTER the concat, not inside the first half: `icon-star-empty` is a
// GLYPH still, and a filter that only ran over `UI_STILLS` silently did nothing
// for it.
const SQUARE_UI = [...UI_STILLS, ...GLYPH_STILLS].filter((s) => !OFF_THE_GRIDS.has(s.id))

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
 * ─── A slot painted twice: which painting it is cut from ────────────────────
 *
 * Every slot on a contact sheet keeps its single-icon sheet as well (above), so
 * each of them has TWO paintings aimed at one file: a cell of a grid, and a still
 * of its own. Nothing said which one the file is cut from, so it was whichever
 * the slicer happened to cut LAST. A full run cuts `grid-*` before `still-*`, so
 * there the stills won; the desk slices one painting at a time, so there it was
 * whatever it touched last. That is how `grid-ui-objects-2` ships — its painting
 * was re-sliced after its nine stills — while the next full re-slice would have
 * swapped all nine for the stills' entirely different designs (a cyan gem for
 * the ruby, a green splat for the orange, a red-and-yellow gift for the dusty
 * one), with nothing in any diff to say so.
 *
 * So the choice is written down, per slot, and every tool reads the same answer:
 * `cutSources()` below, written beside the prompts as `art-sheets/cut-from.json`
 * by `promptDocs`, which the slicer cuts by, and `PAINT-STATUS.md` and the Art
 * Desk report by — a sheet whose every file is cut from another painting is
 * SUPERSEDED, never "to paint", so the desk's queue does not repaint art nobody
 * will ship.
 *
 * WHY A TABLE, AND NOT A RULE
 *
 *   · "Newest painting wins" does not reproduce what ships. The objects-2
 *     painting is OLDER than its nine stills (11:50 on the 14th, against 19:19 to
 *     21:55); it ships because it was re-SLICED last, and "last sliced wins" is
 *     the bug, not a rule.
 *   · Retiring the losing painting only postpones the race to the next re-roll of
 *     it, and a painting parked in `retired/` reads as "repaint" to the status
 *     tools — the desk would queue fifteen repaints of art nobody wants.
 *   · Which of two paintings ships is a question only the person who painted them
 *     can answer. The slicer already refuses to guess between two returns that
 *     name one sheet; this is the same refusal one level up, and a table in the
 *     manifest is where the answer is written.
 *
 * MEASURED, NOT ASSUMED. Each value below reproduces the file that shipped on
 * 2026-09-18: that file's pristine original (`public-backup/`) is pixel-identical
 * to a fresh cut of the painting named here, and nowhere near a cut of the other.
 * The grids came out all-or-nothing — objects-2 from the grid, everything else
 * from the stills that were painted one at a time after their grids.
 *
 * TO SWITCH A SLOT — the one-generation re-roll `PROMPTS-GRIDS.md` recommends for
 * a single bad cell — set it here, run `pnpm art:prompts`, and slice the painting
 * that now owns it. A slot on a grid that is missing here fails
 * `artManifest.test.ts`, and the slicer refuses to cut it from either painting.
 */
export type CutFrom = 'grid' | 'still'

export const UI_CUT_FROM: Readonly<Record<string, CutFrom>> = {
  // grid-ui-marks-1
  locker: 'still', fever: 'still', star: 'still', timer: 'still', target: 'still',
  trophy: 'still', 'icon-play': 'still', 'icon-pause': 'still',
  'icon-replay': 'still',
  // grid-ui-marks-2
  'icon-skip-forward': 'still', 'icon-skip-back': 'still', 'icon-stop': 'still',
  'icon-menu': 'still', 'icon-home': 'still', 'icon-back': 'still',
  'icon-forward': 'still', 'icon-close': 'still', 'icon-check': 'still',
  // grid-ui-marks-3
  'icon-settings': 'still', 'icon-shop': 'still', 'icon-info': 'still',
  'icon-help': 'still', 'icon-music': 'still', 'icon-music-off': 'still',
  'icon-sound': 'still', 'icon-sound-off': 'still', 'icon-chart': 'still',
  // grid-ui-marks-4
  'icon-leaderboard': 'still', 'icon-plus': 'still', 'icon-minus': 'still',
  'icon-left': 'still', 'icon-right': 'still', 'icon-up': 'still',
  'icon-down': 'still', 'icon-fullscreen': 'still', 'icon-share': 'still',
  // grid-ui-objects-1
  'icon-chest': 'still', 'icon-anvil': 'still', 'icon-video': 'still',
  'icon-movie': 'still', 'icon-ads': 'still', 'icon-book': 'still',
  'icon-lock': 'still', 'icon-unlock': 'still', 'icon-star-empty': 'still',
  // grid-ui-objects-2 — the nine that ship from the grid painting. Their stills
  // are complete, DIFFERENT designs (a cyan gem, not the ruby): cut both side by
  // side with `pnpm slice-sheets <both> --ignore-cut-from --out <scratch>` and
  // look before switching any of them.
  'icon-coin': 'grid', 'icon-gem': 'grid', 'icon-heart': 'grid',
  'icon-flask': 'grid', 'icon-wheel': 'grid', 'icon-gift': 'grid',
  'icon-bug': 'grid', 'icon-splat': 'grid', 'icon-bolt': 'grid',
  // grid-ui-objects-3
  'icon-skull': 'still', 'icon-warning': 'still'
}

/** A file more than one sheet paints, and the one painting it is cut from. */
export interface CutSource {
  /** The stem (`grid-ui-objects-2`, `still-ui-icon-gem`) the file is cut from,
   *  or null when nothing settles it — the slicer then refuses it outright. */
  from: string | null
  /** Every sheet that paints it, the one it is cut from included. */
  sheets: string[]
}

/**
 * Every file painted by more than one sheet, keyed by target, with the sheet it
 * is cut from. Derived from the lattices rather than typed out, so a glyph added
 * to the icon set lands here the day it lands on a grid — unsettled, until
 * `UI_CUT_FROM` says which painting it ships from.
 */
export const cutSources = (): Record<string, CutSource> => {
  const by = new Map<string, string[]>()
  const add = (target: string, stem: string): void => {
    const got = by.get(target) ?? []
    if (!got.includes(stem)) by.set(target, [...got, stem])
  }
  for (const w of WALKS) add(w.target, w.file)
  for (const s of STILLS) add(s.target, s.file)
  for (const g of GRIDS) for (const m of g.members) add(m.target, g.file)
  const out: Record<string, CutSource> = {}
  for (const [target, sheets] of [...by].sort(([a], [b]) => a.localeCompare(b))) {
    if (sheets.length < 2) continue
    const still = STILLS.find((s) => s.target === target)
    const grid = GRIDS.find((g) => g.members.some((m) => m.target === target))
    const pick = still ? UI_CUT_FROM[still.id] : undefined
    // Only the one shape this table can settle: exactly a grid cell and its own
    // still. Anything else painted twice is unsettled until someone decides.
    const settled = sheets.length === 2 && still && grid
      ? (pick === 'grid' ? grid.file : pick === 'still' ? still.file : null)
      : null
    out[target] = { from: settled, sheets }
  }
  return out
}

/**
 * The greeter on the loading screen.
 *
 * The splash is the one screen every player sees before deciding whether to
 * stay, and what is on it is a gag: the game's own stomp ring closes round an
 * ant, the sneaker slams down, and the ant is already out from under it,
 * taunting the shoe (`FLogoProgress.vue`). The mascot is the ant it happens to —
 * the creature the player is about to spend the game stomping, and the crumb
 * thief cutscene 01 opens on. A cheeky rival, set up before the game has
 * started.
 *
 * TOP-DOWN like the rest of the cast, and that is deliberate rather than
 * convenient: the splash animates this one file with CSS, under the game's own
 * ring, shadow and shoe — a float, a tremble as the ring closes, a sideways
 * scramble out from under the sole, a shoulder-shake on the taunt — and a stomp
 * only reads from above. A front-facing character would also stop being the bug
 * on the blanket and start being a logo with a face.
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
    live: 'The splash floats it, shakes it as a drawn stomp ring and shadow close round'
      + ' it, darts it sideways out from under a shoe, and pops a DRAWN speech bubble'
      + ' in beside it — so paint no bubble, no words, no shadow and no ground, and'
      + ' leave a small even margin all round so an antenna is never clipped by the'
      + ' frame.'
  })

/**
 * ─── The cutscenes' set dressing ────────────────────────────────────────────
 *
 * Everything the cutscenes draw that is not a creature, a boss, a hazard or a
 * floor: the picnic, the attic, the arcade, and 1-10's nursery. Each panel is
 * the shape of the box `cutscene.SCENE_ART_BOX` blits it into — the reference
 * is drawn by `cutsceneArt.paintSceneRef` into exactly that box — so a return
 * lands at the size and on the spot the drawing had.
 *
 * Every blurb names what the game draws ON TOP, because in these scenes a lot
 * is: the sandwich is a separate painting laid on the plate, the door's daylight
 * and the cabinet's attract screen and the machines' chevrons glow on a dial,
 * and every shadow is the renderer's.
 */
const scenePanel = (id: string, long = 512): { w: number; h: number } => {
  const b = SCENE_ART_BOX[id]!
  const k = long / (2 * Math.max(b.hw, b.hh))
  return { w: Math.round(2 * b.hw * k), h: Math.round(2 * b.hh * k) }
}

/** The shadow clause every placed piece shares. */
const SCENE_SHADOW = 'The game draws its soft shadow on the floor under it, so paint no shadow and no floor.'

const SCENE_STILLS: StillSpec[] = [
  still('scene', 'plate', 'Scene — picnic plate',
    'An EMPTY round white china dinner plate (#fbf6ee) seen from DIRECTLY ABOVE: a'
    + ' perfect circle with a fat warm-ink rim, a raised lip and a faint thin inner'
    + ' ring where the flat middle begins, and a small soft highlight on the lip at'
    + ' the upper left. Nothing on it at all — no food, no crumbs, no cutlery, no'
    + ' pattern.', {
      ...scenePanel('plate'), maxEdge: 512,
      live: 'The game lays the SANDWICH on it as a separate picture and eats it off'
        + ' the plate over the course of a scene, so the plate must be empty. '
        + SCENE_SHADOW
    }),
  still('scene', 'sandwich', 'Scene — the sandwich',
    'The sandwich the whole war is about: ONE round sandwich cut in half, seen from'
    + ' DIRECTLY ABOVE, the two HALVES tilted apart from each other in a shallow V —'
    + ' each a fat rounded wedge of golden crust (#f0c987) around a soft pale bread'
    + ' face (#fbe6bd), with a frilly bright-green lettuce edge (#7fbf5a) peeking out'
    + ' along its cut side. Cartoon picnic lunch, soft and appetising, the halves'
    + ' side by side and not touching. Just the two halves — no plate, no crumbs. BOTH'
    + ' HALVES WHOLE: no bite out of either, no missing corner, no teeth marks — the'
    + ' scene opens on an untouched lunch and the game does the eating.', {
      ...scenePanel('sandwich'), maxEdge: 512,
      live: 'The game puts it on a plate or across the backs of four ants carrying'
        + ' it, and SHRINKS it as it is carried off or eaten, so paint it whole and'
        + ' evenly lit. ' + SCENE_SHADOW
    }),
  still('scene', 'glass', 'Scene — lemonade glass',
    'A glass of lemonade seen from DIRECTLY ABOVE, looking straight down into it: a'
    + ' round clear glass rim, pale blue-white and slightly see-through, around a disc'
    + ' of bright yellow lemonade (#ffd95e), with one pale lemon slice (#fff3b0,'
    + ' showing its segments) floating at the lower right and a small white glint on'
    + ' the rim at the upper left. A perfect circle. No straw, no ice cubes.', {
      ...scenePanel('glass'),
      live: SCENE_SHADOW
    }),
  still('scene', 'book', 'Scene — paperback',
    'A paperback book lying FACE DOWN on a picnic blanket, seen from DIRECTLY ABOVE,'
    + ' upright in the panel with its long edges running top to bottom: a soft blue'
    + ' (#4a7fb5) back cover with gently rounded corners, a little curled and'
    + ' sun-softened, and the cream (#f3e7cf) edge of the page block showing as a'
    + ' narrow strip down the RIGHT-hand side. A plain back cover — no title, no'
    + ' lettering, no barcode, no picture.', {
      ...scenePanel('book'), maxEdge: 384,
      authored: 'Straight up in the panel; the game lays it on the blanket at a slant.',
      live: 'Ants crawl out from UNDER it, and the game turns it to its angle. '
        + SCENE_SHADOW
    }),
  still('scene', 'crumb', 'Scene — one crumb',
    'ONE single bread crumb seen from DIRECTLY ABOVE, filling the frame: a small'
    + ' rounded golden (#e8c98a) nugget, a little wider than it is tall and tipped'
    + ' slightly, with a soft darker crust edge, a paler face, one tiny highlight at'
    + ' the upper left and a warm ink contour.', {
      ...scenePanel('crumb'), maxEdge: 128,
      live: 'An ant carries it ahead of its head, and the game scales it up for the'
        + ' big piece a beetle hauls — so paint one crumb and nothing else.'
    }),
  still('scene', 'attic-box', 'Scene — attic box',
    'A taped-shut cardboard storage box seen from DIRECTLY ABOVE, a little wider than'
    + ' it is tall: warm brown corrugated cardboard (#b98b55) with softly rounded'
    + ' corners and a slightly dusty top, the seam between its two top flaps running'
    + ' straight up and down through the middle from one edge of the lid to the other,'
    + ' and one strip of pale packing tape (#e8d6b2) running straight across the middle,'
    + ' side to side, over the seam. No labels, no writing, no letters, no stickers, no'
    + ' arrows — the first return wrote the words for its own directions around the box,'
    + ' and every letter on it is a letter the game cannot remove.', {
      ...scenePanel('attic-box'), maxEdge: 384,
      authored: 'Square to the panel; the game turns each box to its own angle and'
        + ' stretches this one painting to four slightly different box sizes.',
      live: SCENE_SHADOW
    }),
  still('scene', 'door', 'Scene — door edge (tile)',
    'One repeating section of the lower edge of a closed wooden interior door, seen'
    + ' flat as the game shows it, filling the frame: very dark chocolate-brown wood'
    + ' (#3a2a1e) everywhere, one recessed rectangular panel (#4e3a28) centred in the'
    + ' upper two-thirds with a dark inset line round it and a faint warm bevel'
    + ' highlight just inside that, a thin dark rail groove running the full width'
    + ' below the panel, and the door\'s bottom edge as a fat warm-ink line along the'
    + ' very bottom of the frame. The top strip above the panel is plain door wood.'
    + ' Faint wood grain at most. No handle, no hinges, no keyhole, no light.'
    // The first return lit it like a portrait — a bright orange corner at the
    // upper left fading to dark at the right — which no tile survives: laid side
    // by side, every seam is a step from dark to bright.
    + ' EVENLY LIT, edge to edge: no light gradient across the wood, no bright corner,'
    + ' no vignette. The left edge, the right edge and the whole top strip are the same'
    + ' flat dark #3a2a1e, so the tiles meet without a seam and the top of the tile'
    + ' meets the plain door colour the game fills in above it. The house rule about a'
    + ' key light from the upper left applies only to the small bevel on the panel.', {
      ...scenePanel('door'), maxEdge: 512, bg: 'opaque', fill: true, tile: 'x',
      authored: 'Laid side by side along the whole width of the door; the game fills'
        + ' everything above the tiles with the same plain wood colour.',
      anchorNote: 'THE TILE IS THE FRAME: there is no margin and no subject to centre.'
        + ' The door\'s bottom-edge line runs along the very BOTTOM of the frame and the'
        + ' panel sits centred left to right, so that tiles laid side by side put one'
        + ' panel in the middle of each and the edge line runs unbroken along the bottom.',
      live: 'The game draws the bright strip of daylight leaking out from UNDER the'
        + ' door, below this tile, and fills the rest of the door above it with plain'
        + ' #3a2a1e — so paint no light, no glow and no floor, and keep the top edge'
        + ' plain wood that meets that colour.'
    }),
  still('scene', 'cabinet', 'Scene — arcade cabinet',
    'The FRONT FACE of a retro arcade cabinet seen straight on and filling the frame:'
    + ' a deep navy (#141833) body with softly rounded corners, a glowing cyan'
    + ' (#3de0ff) neon edge all the way round with a thin hot-pink (#ff4f7a) neon line'
    + ' just inside it; near the top a wide marquee panel of dark purple (#231041)'
    + ' framed in pink neon, with two horizontal neon light bars across it (cyan above,'
    + ' pink below) standing in for a logo; and below that one big rounded-rectangle'
    + ' screen framed in cyan, its glass almost black (#080b18) and empty. No'
    + ' joystick, no buttons, no coin slot, no logo, no letters, no words. Every neon line is a'
    + ' crisp bright tube whose glow stays INSIDE the cabinet\'s outline — no halo or'
    + ' bloom out onto the background.'
    // Measured off the reference. The first return was a whole cabinet in
    // silhouette — head, angled sides, a control shelf — with a small screen in
    // its upper half, and the game draws the attract picture and the roach's
    // walk onto the rectangles below, wherever the painting put its own.
    + ' IT IS A FLAT UPRIGHT RECTANGLE, not a cabinet silhouette: straight sides, no'
    + ' angled head, no control-panel shelf, no stand. The game draws onto two exact'
    + ' places on it, so they are not a composition choice: the marquee panel spans'
    + ' from 7% to 27% of the way down the face and from 7% to 92% across; the screen'
    + ' spans from 32% to 93% of the way down and from 7% to 92% across — by far the'
    + ' biggest thing on the face, filling nearly all of its lower two thirds. Below'
    + ' the screen there is only a THIN strip of navy, no wider than the strip down each'
    + ' side of it — the second return stopped its screen three quarters of the way'
    + ' down and the picture the game plays ran on over the body under it. The whole face is in'
    + ' the image: the cyan outline runs round all four sides, the bottom one included.', {
      ...scenePanel('cabinet'), maxEdge: 512,
      live: 'The game runs the attract-mode picture ON the screen (a glowing grid and'
        + ' two chevrons), lays scanlines and a glint over the glass, and blows the'
        + ' screen out to white as the camera goes through it — so leave the screen'
        + ' dark and empty and paint no scanlines, no glare and no picture.'
    }),
  still('scene', 'hopper', 'Scene — conveyor machine',
    'A chunky arcade-factory machine seen from DIRECTLY ABOVE, a little taller than'
    + ' it is wide: a dark navy steel box (#1b2046) with rounded corners and a glowing'
    + ' cyan (#3de0ff) neon outline, a couple of panel seams and rivets, and on its'
    + ' right-hand side a dark intake slot (#070918), the height of a conveyor belt and'
    + ' rimmed in hot-pink neon, where the belt runs into the machine. The lid is'
    + ' otherwise plain: no letters, no numbers, no warning signs. A FLAT PLAN VIEW,'
    + ' straight down onto the lid: no side faces, no depth, no bevelled edges showing'
    + ' underneath, no perspective — the first return was a three-quarter box whose'
    + ' sides pushed the lid off-centre. The slot is set INTO the right-hand edge of the'
    + ' box, inside its outline, and nothing sticks out past it. The neon is a crisp bright tube whose glow stays INSIDE the'
    + ' machine\'s outline — no halo or bloom out onto the background.', {
      ...scenePanel('hopper'),
      authored: 'The slot on the RIGHT. The game mirrors the whole machine for the'
        + ' other end of the line, so nothing may be drawn that only reads one way'
        + ' round.',
      live: 'The game draws a glowing arrow on the lid, a small status light in one'
        + ' corner and the soft shadow under it, and a belt of robots runs into the'
        + ' slot — so paint no arrows, no lights, no belt, no shadow and no floor.'
    }),
  still('scene', 'nest', 'Scene — napkin nest',
    'A little ant nursery made from a crumpled white paper napkin, seen from DIRECTLY'
    + ' ABOVE: a soft squarish cream-white (#f6efe2) napkin pushed into a shallow'
    + ' bowl, its edges crinkled and folded over in a few soft pleats, one faded blue'
    + ' picnic stripe along the lower hem, and a hollow in the middle shaded warm'
    + ' beige (#e4d6bf). Cosy and home-made, like something built out of picnic'
    + ' litter. Nothing in the hollow, and nothing written anywhere on it.', {
      ...scenePanel('nest'), maxEdge: 384,
      live: 'The game sets the Goliath Queen\'s clutch of eggs in the hollow and makes'
        + ' them wobble, and her nurses crawl over it — so paint the nest EMPTY, with'
        + ' no eggs, no ants and no crumbs. ' + SCENE_SHADOW
    }),
  still('scene', 'puff', 'Scene — puff of steam',
    'ONE small round cartoon puff of steam seen from above: a fat white cloud of four'
    + ' bubbly overlapping lobes with a single warm-ink contour round the OUTSIDE only,'
    + ' and a soft pale lilac-grey shade low on its right side. The steam a grumpy'
    + ' cartoon character huffs out when it is cross — cute and bouncy, not smoke,'
    + ' not a speech bubble, nothing written in it.', {
      ...scenePanel('puff'), maxEdge: 128,
      live: 'The game pops these out beside the Queen\'s head in pairs, grows them,'
        + ' drifts them apart and fades them — so paint ONE puff, fully opaque.'
    })
]

export const STILLS: StillSpec[] = [
  ...SHOE_STILLS,
  ...BOSS_STILLS,
  ...BUG_PART_STILLS,
  ...PROP_STILLS,
  ...FX_STILLS,
  ...FLOOR_STILLS,
  ...UI_STILLS,
  ...GLYPH_STILLS,
  LOGO_STILL,
  MARK_STILL,
  MASCOT_STILL,
  ...SCENE_STILLS
]

/** Everything the pipeline can produce, as `kind/id` — the id space the Art
 *  Desk searches and `art:status` reports on. */
export const ALL_SHEETS: Array<WalkSpec | StillSpec> = [...WALKS, ...STILLS]

// ─── Prompts ────────────────────────────────────────────────────────────────

/**
 * ─── One continuous ground: the rule a ruled return is thrown away for ─────
 *
 * Every multi-panel sheet is cut by arithmetic, so a line painted between two
 * panels is not a help to the cut — it lands INSIDE a sprite and stays there.
 * Six returns came back ruled anyway, each with "DO NOT DRAW THE GRID" in its
 * prompt: the beetle and the robobug with black rules round every panel like a
 * comic strip, the moth with a thin purple line between every pair, and the
 * three 2x2 stills — the splat, the confetti, the egg — with a WHITE cross
 * splitting the sheet into four. The slicer refuses all six; the Art Desk had
 * only let them through because it paints rules out on every slice.
 *
 * The rule was in each of those prompts, and it lost for four reasons
 * `PROMPT-ANATOMY.md` names, every one visible in the prompt that produced them:
 *
 *   · IT SAT IN THE MIDDLE. The top said "A SPRITE SHEET: 8 panels" and nothing
 *     about the ground; the rule came after the subject, the colour, the view,
 *     the anchor and the movement; the last thing read was a list of STYLE
 *     failures. §1/§10/§11: what decides whether a return is usable at all is
 *     stated first, and checked again last.
 *   · IT NAMED ONE COLOUR. "every frame then carries a black bar" — so the
 *     painter kept to the letter of it and ruled in WHITE, or in a darker
 *     MAGENTA. §9: "in any colour, magenta included".
 *   · IT DESCRIBED THE GROUND PER PANEL. "The background of every panel is
 *     flat magenta, edge to edge" describes eight tiles with a ground each, and
 *     a white gutter between two tiles satisfies it word for word. The ground is
 *     ONE field that the drawings stand on.
 *   · ITS HEADING WAS "THE GRID". A heading that names a grid reads as a grid to
 *     be drawn.
 *
 * Hoisted into named constants that the walk, the multi-panel still and the
 * contact-sheet builders all use (§8: diff the builders — "the weakest builder is
 * the one that produces the bad batch"), because the contact-sheet builder had
 * grown its own copy of the rule and the three had already begun to drift.
 */

/** A sheet's shape in words, both directions — `shapeLines` and the check reuse it. */
const shapeOf = (w: number, h: number): { shape: string; ratio: string } => {
  const r = w / h
  return {
    shape: r > 1.05 ? 'LANDSCAPE (wider than it is tall)'
      : r < 0.95 ? 'PORTRAIT (TALLER THAN IT IS WIDE)'
        : 'SQUARE',
    ratio: r >= 1 ? `${(r).toFixed(2)} : 1` : `1 : ${(1 / r).toFixed(2)}`
  }
}

/**
 * The ground rule, stated right after the deliverable's shape — before the
 * subject, which is where §2 puts the one exclusion a return is thrown away for.
 * `unit` is what the sheet is divided into (`panel`, `cell`) and `what` the
 * things standing on it.
 */
const continuousGround = (n: number, unit: string, what: string): string[] => [
  'ONE CONTINUOUS MAGENTA GROUND — read this before the subject. It decides',
  '  whether the sheet can be used at all, and more returns have been thrown away',
  '  for it than for anything else.',
  '· The whole image is ONE unbroken field of flat magenta #FF00FF, corner to',
  `  corner, with the ${n} ${what} standing on it.`,
  `  No ${unit} borders, no dividers, no frames, no boxes, no grid lines, no`,
  '  gutters and no gaps between them — in ANY colour: not black, not white, not',
  '  grey, and not a darker or lighter shade of magenta either.',
  `· A "${unit}" below means only WHERE a drawing sits on that ground: an invisible`,
  '  square the game measures by arithmetic. It is never drawn. The only thing',
  `  that shows where one ${unit} ends is that the drawing in it ends.`,
  '· Earlier returns came back ruled — black rules round every panel like a comic',
  '  strip, a white cross splitting a sheet into four, a thin purple line between',
  '  every pair of moths — and every one of them was thrown away whole. The game',
  `  cuts along the ${unit} lines, so a rule lands INSIDE a sprite and stays in it`,
  '  forever.',
  ''
]

/**
 * The same rule again as the LAST thing read (§11: a closing count-and-check beats
 * the same facts stated once at the top). It repeats the deliverable's shape too
 * (§1: "stated first and repeated last").
 */
const sheetCheck = (
  n: number, cols: number, rows: number, unit: string, what: string, w: number, h: number
): string[] => {
  const { shape, ratio } = shapeOf(w, h)
  return [
    '',
    'BEFORE YOU CALL IT FINISHED, count and check:',
    `· ${n} ${what}, ${cols} across and ${rows} down — not one more, not one fewer.`,
    `· The image is ${shape}, width to height ${ratio}.`,
    `· Run your eye along every line where two ${unit}s meet, across and down: it is`,
    '  flat magenta the whole way. No line, no bar, no frame, no white or grey gap,',
    '  no darker or lighter magenta. If you can SEE where one ' + unit + ' ends and the',
    '  next begins, the sheet cannot be used.',
    '· Every pixel that is not a drawing is vivid #FF00FF — hold it against a pure',
    '  magenta swatch, not against your memory of one.'
  ]
}

const layoutRules = (cols: number, rows: number, frames: number): string[] => [
  `WHERE THE PANELS SIT — ${cols} across, ${rows} down,`
  + ` EXACTLY ${frames} panels read left to right along the top row` + (rows > 1 ? ', then the next.' : '.'),
  `· ${frames} and not one more or one fewer. The game cuts the return into`
  + ` ${frames} equal panels by arithmetic, so a sheet with a different count is`
  + ' sliced through the middle of every frame — silently, and it looks like the'
  + ' animation broke rather than like the sheet did.',
  '· DO NOT DRAW THE PANELS. There are no panel borders, no outlines around a',
  '  panel, no dividing lines, no gutters, no margins between panels, no drop',
  '  shadows under a panel, no numbers and no labels — in any colour, magenta',
  '  included. The panels TOUCH, edge to edge, and the only thing that says where',
  '  one ends is that the drawing in it ends. A sheet ruled like a comic strip is',
  '  refused outright: the game cuts it by arithmetic, so every rule line lands',
  '  INSIDE a frame and every frame of the animation then carries a bar down one',
  '  side of it.',
  '· Every panel is the SAME SIZE, to the pixel.',
  '· The subject is CENTRED in its panel and the SAME SIZE in every panel. It never',
  '  drifts, never grows, never leaves the panel.',
  '· The ground under every drawing is that ONE field of FLAT MAGENTA #FF00FF: it',
  '  runs straight on from one panel into the next with no seam, no line and no',
  '  change of shade where two panels meet, and nothing else is on it — no shadow,',
  '  no floor, no gradient, no vignette. The magenta is keyed out to transparency;',
  '  anything else left on it becomes part of the sprite, and a soft shadow fading',
  '  into the magenta becomes a pink fringe around the whole thing that no amount',
  '  of keying can take off again.'
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

/**
 * The SIZE IN FRAME clause, when the bench has measured one.
 *
 * `multi` is a sheet of several panels. There a subject that reaches its panel's
 * edge is one whose neighbour reaches the same edge from the other side — the
 * moth's wings run the full width of their panel, so in the reference every wing
 * tip meets the next moth's. "The panels touch, and the only thing that says
 * where one ends is that the creature in it ends" cannot hold for two creatures
 * that meet, and the return separated them the way a painter separates panels:
 * a line between every pair. So such a sheet is told what to do at that edge.
 */
const fitLines = (fits: SheetFits | undefined, key: string, multi = false): string[] => {
  const f = fits?.[key]
  if (!f) return []
  const wide = f.w >= 0.95
  const tall = f.h >= 0.95
  return [
    `THE SIZE IN FRAME: in the reference the subject covers about ${pct(f.h)}% of its`
    + ` panel's height and ${pct(f.w)}% of its width. Paint it at that size. A subject`
    + ' drawn small in a big empty frame is scaled back up by the game and arrives'
    + ' soft; one drawn past the edges is clipped.'
    + (multi && (wide || tall)
      ? ` At its ${wide ? 'widest' : 'tallest'} it reaches the ${wide ? 'left and right' : 'top and bottom'}`
        + ' edges of its panel, so where two panels meet the two drawings all but touch.'
        + ' Keep a hair of flat magenta between them, and NEVER a line, a bar or a frame'
        + ' to keep them apart — the game finds the panels by arithmetic, not by'
        + ' looking for a border.'
      : ''),
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
  const { shape, ratio } = shapeOf(w, h)
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
  ...continuousGround(w.frames, 'panel', 'drawings of the one creature'),
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
  ...fitLines(fits, `${w.kind}/${w.id}`, true),
  `THE MOVEMENT: ${w.motion}`,
  '· No two panels are the same. A sheet where four panels are identical is a sheet',
  '  the game plays as a creature that freezes four times a second.',
  '',
  ...layoutRules(w.cols, w.rows, w.frames),
  '',
  HOUSE_STYLE,
  ...sheetCheck(w.frames, w.cols, w.rows, 'panel', 'drawings of ONE creature', w.w, w.h)
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
    // A variation sheet and an animation sheet share every rule below and
    // disagree about only this line — and it is the line that decides what comes
    // back. Told it is a loop, a painter hands over four near-identical panels
    // with a wobble; told it is four different marks, it varies them.
    n > 1
      ? (s.variants
        ? `A VARIATION SHEET: ${n} DIFFERENT versions of the same kind of mark, one`
          + ' per panel. This is NOT an animation and NOT one object seen four times:'
          + ' the game picks ONE panel per use, so four panels that resemble each other'
          + ' are four chances to paint the same picture.'
        : s.stages
          ? `A STAGE SHEET: ${n} panels of ONE object at ${n} moments of ONE change, in`
            + ' order. This is NOT a loop and NOT different objects: the game shows panel'
            + ` 1 first and panel ${n} last and never goes back, so every panel is the same`
            + ' object, a step further along than the panel before it.'
          : `A SPRITE SHEET: ${n} panels of ONE object through ONE loop of its own movement.`)
      : 'A SINGLE OBJECT, alone in the frame.',
    'One image comes with this prompt:',
    `  \`art-sheets/${s.file}.png\` — THE LAYOUT: the game's own rough placeholder`,
    '     drawing, at exactly the size and position the painting must land at. Match',
    '     its SHAPE, its SIZE IN THE FRAME and its ORIENTATION; take nothing else —',
    '     not its line weight, its colours, its shading or its style. It is a flat',
    '     stand-in for a painting that does not exist yet, and a repaint that keeps',
    '     its flatness has repainted the stand-in.',
    '',
    // Only a sheet of panels has lines between panels to rule.
    ...(n > 1 ? continuousGround(n, 'panel', 'drawings') : []),
    `WHAT IT IS: ${s.blurb}`,
    ''
  ]
  if (s.authored) lines.push(`ORIENTATION: ${s.authored}`, '')
  lines.push(...anchorLines(s.anchor, s.anchorNote))
  if (s.fit !== false) lines.push(...fitLines(fits, `${s.kind}/${s.id}`, n > 1))
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
  if (n > 1 && s.cycle) {
    const label = s.variants ? 'WHAT DIFFERS BETWEEN THE PANELS'
      : s.stages ? 'WHAT CHANGES FROM PANEL TO PANEL' : 'THE MOVEMENT'
    lines.push(`${label}: ${s.cycle}`, '')
  }
  if (n > 1 && (s.variants || s.stages) && s.variantBlurbs?.length) {
    lines.push(
      `WHAT IS IN EACH PANEL, in reading order — left to right along the top row${rowsOf(s) > 1 ? ', then the next' : ''}:`,
      '',
      ...s.variantBlurbs.map((b, i) =>
        `  PANEL ${i + 1} — row ${Math.floor(i / colsOf(s)) + 1}, column ${(i % colsOf(s)) + 1}: ${b}`),
      ''
    )
  }
  if (n > 1) lines.push(...layoutRules(colsOf(s), rowsOf(s), n), '')
  else if (s.bg === 'magenta') {
    lines.push('THE BACKGROUND is FLAT MAGENTA #FF00FF, edge to edge, with nothing else'
      + ' on it — no shadow, no floor, no gradient, no vignette. The magenta is keyed'
      + ' out to transparency; anything else left on it becomes part of the sprite, and'
      + ' a soft shadow fading into the magenta becomes a pink fringe around the whole'
      + ' thing that no amount of keying can take off again.'
      // A wide return (the sandwich, 1.59 : 1) came back matted: the magenta
      // stopped short of the image's edge inside a white border, which is not
      // magenta, is not keyed, and was cut into the sprite as a grey rule.
      + ' The magenta runs all the way to the four edges of the IMAGE ITSELF: no white'
      + ' or coloured border, frame, matte or letterbox strip around the picture.', '')
  } else {
    lines.push('THE IMAGE IS FULLY OPAQUE: it has no transparent parts and no magenta.', '')
  }
  lines.push(houseStyle(s.wordmark))
  if (n > 1) lines.push(...sheetCheck(n, colsOf(s), rowsOf(s), 'panel', 'drawings', s.w * colsOf(s), s.h * rowsOf(s)))
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
    ...continuousGround(n, 'cell', 'icons'),
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
    `WHERE THE CELLS SIT — ${g.cols} across, ${g.rows} down,`
    + ` EXACTLY ${n} cells.`,
    `· ${n} and not one more or one fewer, and no empty cell. The game cuts the return`,
    `  into ${n} equal cells by arithmetic, so a sheet with a different count is sliced`,
    '  through the middle of every icon.',
    '· DO NOT DRAW THE CELLS. There are no cell borders, no outlines around a cell,',
    '  no dividing lines, no gutters, no margins between cells, no drop shadows under',
    '  a cell, no numbers, no captions and no labels — in any colour, magenta',
    '  included. The cells TOUCH, edge to edge, and the only thing that says where',
    '  one ends is that the icon in it ends. A sheet ruled like a comic strip is',
    '  refused outright: the game cuts it by arithmetic, so every rule line lands',
    '  INSIDE a cell and every icon then carries a bar down one side of it.',
    '· Every cell is the SAME SIZE, to the pixel.',
    '· Each icon is CENTRED in its own cell with an even margin, and nothing crosses',
    '  from one cell into its neighbour.',
    '· The ground under every icon is that ONE field of FLAT MAGENTA #FF00FF: it runs',
    '  straight on from one cell into the next with no seam, no line and no change of',
    '  shade where two cells meet, and nothing else is on it — no shadow, no floor, no',
    '  gradient, no vignette. The magenta is keyed out to transparency; anything else',
    '  left on it becomes part of the icon, and a soft shadow fading into the magenta',
    '  becomes a pink fringe that no amount of keying can take off again.',
    '',
    HOUSE_STYLE,
    ...sheetCheck(n, g.cols, g.rows, 'cell', 'DIFFERENT icons', g.cell * g.cols, g.cell * g.rows)
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
    'generation instead of nine. Then set that slot to `\'still\'` in `UI_CUT_FROM`',
    '(`src/game/artSheet.ts`) and run `pnpm art:prompts`: every slot on a grid is',
    'painted twice, and `cut-from.json` — not whichever was sliced last — decides',
    'which painting its file is cut from.',
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
    'One side step does not go through any of that, because none of it is a',
    'drawable:',
    '',
    '```',
    'pnpm art:promotion   # the store-page art — cover images at nine sizes in',
    '                     # jpg + webp, the logo at three, and a favicon.ico,',
    '                     # painted from the game\'s own cast and compressed into',
    '                     # src/assets/promotion/',
    '```',
    '',
    'Its plates, prompts and masters live in `promotion/` one folder down, where',
    'the Art Desk and the slicer cannot see them — a cover is not a sprite and',
    '`pnpm slice-sheets` would refuse every one. See `src/game/promotionSheet.ts`.',
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
    '',
    'Every file that two sheets paint is cut from exactly one of them, and',
    '`cut-from.json` (written from `UI_CUT_FROM` in `src/game/artSheet.ts`) says',
    'which — never the order the slicer happened to run in.',
    ''
  ].join('\n'),

  // Not a prompt, but written by the same two routes for the same reason: the
  // slicer and the Art Desk read files, not the manifest, and this is the one
  // answer they have to agree on with `PAINT-STATUS.md`. See `UI_CUT_FROM`.
  'cut-from.json': `${JSON.stringify({
    note: 'Generated from UI_CUT_FROM in src/game/artSheet.ts by pnpm art:prompts — do not hand-edit.'
      + ' Every file more than one sheet paints, and the one painting it is cut from.'
      + ' `from: null` is unsettled: the slicer refuses to cut that file from anything.',
    targets: cutSources()
  }, null, 2)}\n`
})
