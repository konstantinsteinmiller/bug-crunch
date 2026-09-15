import { ART_BRAND } from '@/game/artCatalogue'
import { ART_FOLDERS } from '@/game/art'
import { houseStyle } from '@/game/artSheet'

/**
 * ─── Promotion manifest — the art that goes OUTSIDE the game ────────────────
 *
 * A side step of the art pipeline (`tools/art-promotion.mjs`, `pnpm
 * art:promotion`), and a side step on purpose: nothing here is a drawable. The
 * renderer never probes for any of it, the slicer never cuts it, `spriteFor`
 * has never heard of it. These are the images a PORTAL asks for — the cover
 * tile on CrazyGames' grid, Poki's landscape hero, GamePix's 512x384 thumb, the
 * favicon on a browser tab — and they live in `src/assets/promotion/` where a
 * submission picks them up, not in `public/` where a build would ship them to
 * every player who never looks at them.
 *
 * It is the SAME round trip as every other sheet, which is the whole reason it
 * is worth writing down rather than hand-painting nine JPEGs:
 *
 *   plate (the game's own painted cast, composited at the target aspect)
 *         → painter (the Art Desk's Gemini window, one generation per aspect)
 *         → master in `art-sheets/promotion/painted/`
 *         → every deliverable size cut from its OWN family's master
 *         → jpg + webp, compressed by `scripts/compress-images.mjs`
 *
 * THREE RULES THIS FILE EXISTS TO HOLD:
 *
 * 1. NO TEXT, NO UI, NO LOGO in a cover. Every portal typesets the game's name
 *    over the art itself, in its own type, at its own size; a painted title is
 *    a second title crossing theirs, and the one thing that gets a cover
 *    rejected before anybody judges the art. The logo is a SEPARATE deliverable
 *    in this same folder, which is how a store page gets both without either
 *    one being baked into the other.
 *
 * 2. A DELIVERABLE IS ONLY EVER CUT FROM ITS OWN ASPECT. 1080x1920 is not a
 *    1920x1080 rotated and it is not a centre crop of one: the shoe that
 *    entered from the top right of a landscape frame is off the edge of a
 *    portrait one, and the bug the whole image was pointing at is gone. So an
 *    aspect FAMILY is painted once and every size in it is a resize, never a
 *    reframe. Six families, nine sizes, eighteen files.
 *
 * 3. THE PLATE IS THE FALLBACK. A cover with no painting is still written —
 *    from the plate, which is a real composition of the game's real painted
 *    cast. That is the same contract a missing sprite has (the drawing keeps
 *    drawing), and it means `src/assets/promotion/` is never half a folder:
 *    a submission always has every size, and painting upgrades them in place.
 *
 * Loadable under plain Node (`tools/ts-resolve.mjs`) like `artSheet.ts`, and
 * for the same reason: `pnpm art:promotion` renders these prompts and builds
 * these plates without a browser.
 */

// ─── Shapes ─────────────────────────────────────────────────────────────────

export interface CoverSize {
  w: number
  h: number
}

/**
 * One sprite laid onto a plate.
 *
 * `size` is a fraction of the plate's SHORT side rather than its width, so the
 * same cast lands at the same physical size whether the plate is lying down or
 * standing up. Keyed to the long side instead, a bug that reads well in 16:9
 * becomes a speck in 9:16.
 */
export interface PlateLayer {
  /** Path under `public/` — a painted sprite the game already ships. */
  src: string
  /** Centre of the layer, as a fraction of the plate. */
  cx: number
  cy: number
  /** Width, as a fraction of the plate's short side. */
  size: number
  /** Degrees clockwise. A bug's strip is drawn walking UP the panel, so this is
   *  also which way it is running. */
  rotate?: number
  /** 0..1. Used for the splats, which are a stain and not an object. */
  opacity?: number
  /** Frames in a horizontal strip (a walk is 8, a splat is 4). Default 1. */
  frames?: number
  /** Which frame to take. Default 0. */
  frame?: number
}

export interface CoverAspect {
  /** `16x9` — the id everything keys on, and the plate's filename. */
  id: string
  label: string
  /** The plate handed to the painter. Its shape is what makes the return come
   *  back at this aspect: an image model follows the reference it is given far
   *  more reliably than it follows a ratio written in words. */
  plate: CoverSize
  /** Every deliverable cut from this family's master. */
  sizes: CoverSize[]
  /** Which of the three compositions the plate is built from. */
  shape: 'landscape' | 'portrait' | 'square'
  /** Why this aspect exists, in the prompt's own words. */
  shot: string[]
}

// ─── The cast on a plate ────────────────────────────────────────────────────
//
// Built from `public/images/**` — the sprites the game actually ships, already
// painted, already keyed, already the thing a player has been looking at. That
// is the skill's "a reference that is an inherited bitmap restyles the thing
// you inherited", used the one way it is right: the SUBJECT is not changing.
// The cover is this cast, and handing the painter a photograph of the cast is
// the difference between a cover of Bug Crunch and a cover of some other
// stomping game with different bugs in it.

/** The floor every cover stands on. World 1 — red-and-cream gingham is the
 *  warmest, most saturated ground in the game, and a cover is judged as a
 *  colour before it is judged as a picture. */
export const COVER_FLOOR = `${ART_FOLDERS.bg}/floor-1.webp`

/** The hero — the bug under the sole. The beetle has the biggest, roundest
 *  body in the cast, which is what survives being seen 250 px wide. */
const HERO = `${ART_FOLDERS.bug}/beetle.webp`
/** The sole coming down. The sneaker is the starter shoe and the object the
 *  wordmark is already built out of (`artSheet.ts` LOGO_STILL), so the cover,
 *  the logo and the favicon are all the same shoe. */
const SOLE = `${ART_FOLDERS.shoe}/sneaker.webp`
const SPLAT = `${ART_FOLDERS.fx}/splat.webp`
const BURST = `${ART_FOLDERS.fx}/burst.webp`

const bug = (id: string, cx: number, cy: number, size: number, rotate = 0, frame = 0): PlateLayer =>
  ({ src: `${ART_FOLDERS.bug}/${id}.webp`, cx, cy, size, rotate, frames: 8, frame })

const splat = (cx: number, cy: number, size: number, opacity: number, frame = 0): PlateLayer =>
  ({ src: SPLAT, cx, cy, size, opacity, frames: 4, frame })

/** The one bug the whole image points at. Its own helper rather than another
 *  `bug(...)` call, so changing who the hero is stays one edit. */
const hero = (cx: number, cy: number, size: number, rotate: number): PlateLayer =>
  ({ src: HERO, cx, cy, size, rotate, frames: 8, frame: 0 })

/**
 * LANDSCAPE — 16:9, 4:3, 3:2.
 *
 * The sole comes in from the upper right and the hero sits left of centre, so
 * the diagonal between them runs against the reading direction and holds the
 * eye inside the frame instead of walking it off the right edge.
 */
const LANDSCAPE: PlateLayer[] = [
  splat(0.17, 0.52, 0.20, 0.55, 1),
  splat(0.80, 0.78, 0.17, 0.45, 2),
  bug('ant', 0.13, 0.28, 0.13, 152),
  bug('stinkbug', 0.88, 0.24, 0.13, 118),
  bug('moth', 0.72, 0.86, 0.15, -156),
  bug('flea', 0.24, 0.84, 0.11, -34),
  bug('sprinter', 0.90, 0.58, 0.12, 96),
  splat(0.40, 0.62, 0.36, 0.9),
  { src: BURST, cx: 0.42, cy: 0.60, size: 0.46, opacity: 0.5 },
  hero(0.40, 0.61, 0.34, -14),
  { src: SOLE, cx: 0.63, cy: 0.29, size: 0.50, rotate: 22 }
]

/**
 * PORTRAIT — 9:16, 2:3.
 *
 * The sole drops straight down the frame and the hero is directly under it. A
 * portrait tile is read top to bottom, so the whole image is one vertical
 * gesture rather than a diagonal.
 */
const PORTRAIT: PlateLayer[] = [
  splat(0.22, 0.30, 0.22, 0.5, 1),
  splat(0.78, 0.82, 0.20, 0.45, 2),
  bug('ant', 0.16, 0.16, 0.14, 160),
  bug('stinkbug', 0.84, 0.22, 0.14, 128),
  bug('sprinter', 0.14, 0.84, 0.13, -48),
  bug('moth', 0.82, 0.90, 0.16, -150),
  bug('flea', 0.30, 0.94, 0.12, -22),
  splat(0.47, 0.70, 0.46, 0.9),
  { src: BURST, cx: 0.48, cy: 0.68, size: 0.58, opacity: 0.5 },
  hero(0.46, 0.69, 0.42, -8),
  { src: SOLE, cx: 0.53, cy: 0.29, size: 0.64, rotate: 6 }
]

/** SQUARE — 1:1. The landscape diagonal, pulled in tight. */
const SQUARE: PlateLayer[] = [
  splat(0.18, 0.44, 0.22, 0.5, 1),
  splat(0.82, 0.80, 0.19, 0.45, 2),
  bug('ant', 0.14, 0.20, 0.14, 156),
  bug('stinkbug', 0.86, 0.20, 0.14, 122),
  bug('moth', 0.78, 0.88, 0.16, -152),
  bug('flea', 0.20, 0.86, 0.12, -30),
  splat(0.41, 0.64, 0.42, 0.9),
  { src: BURST, cx: 0.43, cy: 0.62, size: 0.52, opacity: 0.5 },
  hero(0.41, 0.63, 0.38, -14),
  { src: SOLE, cx: 0.63, cy: 0.28, size: 0.56, rotate: 20 }
]

export const PLATE_LAYERS: Record<CoverAspect['shape'], PlateLayer[]> = {
  landscape: LANDSCAPE,
  portrait: PORTRAIT,
  square: SQUARE
}

/**
 * Where the eye is meant to land, as a fraction of the plate — the hero bug's
 * own centre in each layout.
 *
 * The plate builder pools a warm glow here and darkens the corners away from
 * it, so the plate arrives at the painter already saying which part of it is
 * the picture. Written down rather than derived from the beetle's layer,
 * because the day somebody re-poses the cast the focus is a decision and not a
 * side effect of whichever bug happens to be called the hero.
 */
export const PLATE_FOCUS: Record<CoverAspect['shape'], { x: number; y: number }> = {
  landscape: { x: 0.42, y: 0.58 },
  portrait: { x: 0.47, y: 0.64 },
  square: { x: 0.43, y: 0.60 }
}

// ─── The six families ───────────────────────────────────────────────────────
//
// PLATE SIZES ARE NOT ARBITRARY. Each one is either the family's largest
// deliverable or an exact integer multiple of it, so the cut from master to
// deliverable is a clean downscale and never a resample onto a half pixel:
//
//   4:3   1024x768  = 2 x 512x384
//   3:2   1024x680  = 2 x 512x340   (512x340 is 1.506:1, not a true 3:2 — the
//                                    plate matches the DELIVERABLE, not the name)
//   1:1   1024x1024 covers 800, 628, 600 and 512
//   2:3   1024x1536 covers 800x1200
//
// and the two big ones are their deliverable exactly. Nothing is upscaled from
// a plate; whatever the painter returns is, because the free Gemini app hands
// back about 1.1 megapixels whatever it is asked for. A 1376x768 return
// carried to 1920x1080 is a 1.4x lanczos upscale, which a cover survives and a
// sprite would not.

export const COVER_ASPECTS: CoverAspect[] = [
  {
    id: '16x9',
    label: '16:9 landscape',
    plate: { w: 1920, h: 1080 },
    sizes: [{ w: 1920, h: 1080 }],
    shape: 'landscape',
    shot: [
      'A WIDE LANDSCAPE SHOT. This is the big hero image on a game page — the one',
      'that runs full width above the fold — so it has room for the swarm and it',
      'must use it: the floor stretches to both edges and there are bugs scattering',
      'all the way out to the corners.'
    ]
  },
  {
    id: '9x16',
    label: '9:16 portrait',
    plate: { w: 1080, h: 1920 },
    sizes: [{ w: 1080, h: 1920 }],
    shape: 'portrait',
    shot: [
      'A TALL PORTRAIT SHOT, the shape of a phone held upright. Build it as ONE',
      'vertical gesture read from top to bottom: the sole fills the upper third and',
      'comes STRAIGHT DOWN the frame, the bug it is about to land on is in the lower',
      'middle looking up at it, and the gap between them is the whole story. Do not',
      'lay the landscape composition on its side — nothing important may sit in the',
      'left or right margin of a frame this narrow.'
    ]
  },
  {
    id: '2x3',
    label: '2:3 portrait',
    plate: { w: 1024, h: 1536 },
    sizes: [{ w: 800, h: 1200 }],
    shape: 'portrait',
    shot: [
      'A PORTRAIT POSTER, a little wider than a phone screen. Same vertical gesture',
      'as the tall one — sole above, bug below, looking up — but with enough width',
      'to show two or three more bugs breaking away to the sides.'
    ]
  },
  {
    id: '1x1',
    label: '1:1 square',
    plate: { w: 1024, h: 1024 },
    sizes: [
      { w: 800, h: 800 },
      { w: 628, h: 628 },
      { w: 600, h: 600 },
      { w: 512, h: 512 }
    ],
    shape: 'square',
    shot: [
      'A SQUARE TILE. This is the one that sits in a grid of forty other squares and',
      'has to win, and it is shown as small as 250 pixels across. Crop in HARDER than',
      'the wide shot: the sole and the bug under it together fill most of the square,',
      'the supporting bugs are few and large, and there is no empty floor anywhere.'
    ]
  },
  {
    id: '4x3',
    label: '4:3 landscape',
    plate: { w: 1024, h: 768 },
    sizes: [{ w: 512, h: 384 }],
    shape: 'landscape',
    shot: [
      'A SLIGHTLY BOXY LANDSCAPE THUMBNAIL, shown small — 512 pixels wide at most.',
      'Fewer things, each one bigger. The sole and the hero bug carry the whole',
      'image; three supporting bugs is plenty and six is mud at this size.'
    ]
  },
  {
    id: '3x2',
    label: '3:2 landscape',
    plate: { w: 1024, h: 680 },
    sizes: [{ w: 512, h: 340 }],
    shape: 'landscape',
    shot: [
      'A WIDE LANDSCAPE THUMBNAIL, shown small — 512 pixels wide at most, and short.',
      'Keep the sole and the hero bug on one horizontal band through the middle of',
      'the frame: the top and bottom edges of a strip this shallow are the first',
      'thing a portal crops.'
    ]
  }
]

/** Every deliverable cover, flat, with the family it is cut from. */
export const coverDeliverables = (): Array<{ aspect: CoverAspect; size: CoverSize }> =>
  COVER_ASPECTS.flatMap((aspect) => aspect.sizes.map((size) => ({ aspect, size })))

/** jpg for the portals that still ask for one, webp for everything modern.
 *  Both, every size, because a submission form is not a place to discover that
 *  the one you have is the one it will not take. */
export const COVER_FORMATS = ['jpg', 'webp'] as const
export type CoverFormat = (typeof COVER_FORMATS)[number]

/** `cover-1920x1080.jpg` — the size is in the name because the thing on the
 *  other end of this folder is a file picker in a submission form. */
export const coverFile = (size: CoverSize, format: CoverFormat | string): string =>
  `cover-${size.w}x${size.h}.${format}`

/** The plate a family is painted from, and the stem its master is filed under. */
export const plateStem = (aspect: CoverAspect): string => `cover-${aspect.id}`

// ─── The brand files ────────────────────────────────────────────────────────
//
// NOT REPAINTED HERE, and that is the point. The game already has a wordmark
// and a mark — painted through this same pipeline (`artSheet.ts` LOGO_STILL and
// MARK_STILL), or drawn by `scripts/make-brand.mjs` until they are — and a
// store page whose logo is a SECOND generation of the logo is a store page
// showing a game that does not exist. So these are resizes of the shipped
// brand master, and if the master is repainted they change with it.
//
// THE FAVICON COMES FROM THE MARK, not the wordmark, for the reason
// `make-brand.mjs` sets out at length: the lockup is two lines of type, and two
// lines of type average into a smudge on a tab strip. The mark is one gold sole
// on one pink splat on one ink tile, and it still reads as that at 16 px.

export interface BrandDeliverable {
  /** Filename in `src/assets/promotion/`. */
  file: string
  /** Path under `public/` to take it from, best first. */
  from: string[]
  size: number
  format: 'png' | 'webp' | 'ico'
  what: string
}

export const BRAND_DELIVERABLES: BrandDeliverable[] = [
  {
    file: 'logo_512x512.png',
    from: [ART_BRAND.logo],
    size: 512,
    format: 'png',
    what: 'the wordmark at full size — the one a store page shows'
  },
  {
    file: 'logo_256x256.webp',
    from: ['images/logo/logo_256x256.webp', ART_BRAND.logo],
    size: 256,
    format: 'webp',
    what: 'the wordmark for anywhere that takes webp'
  },
  {
    file: 'logo_192x192.png',
    from: ['images/logo/logo_192x192.png', ART_BRAND.logo],
    size: 192,
    format: 'png',
    what: 'the wordmark at PWA icon size'
  },
  {
    file: 'favicon.ico',
    from: ['images/logo/mark_512x512.png', ART_BRAND.logo],
    size: 128,
    format: 'ico',
    what: 'the tab icon — the MARK, because the wordmark is a smudge this small'
  }
]

// ─── The prompt ─────────────────────────────────────────────────────────────

const DELIVERABLE = (a: CoverAspect): string[] => [
  'WHAT COMES BACK',
  `ONE finished piece of cover art, ${a.plate.w} x ${a.plate.h} pixels, exactly`,
  `${a.label}, filled edge to edge. One single image and nothing else — not a`,
  'sheet of options, not a grid, not two versions side by side, not a mock-up of a',
  'store page or a phone, not a poster with a border or a mount around it. The',
  'painting runs all the way to all four edges.'
]

/**
 * The exclusions.
 *
 * First block after the deliverable, and stated as a rule about the IMAGE
 * rather than a list of things to avoid, because "no UI" reads as a style note
 * and "there is no interface in this world" reads as a fact about the picture.
 */
const EXCLUSIONS = [
  'WHAT IS NOT IN IT',
  '· NO TEXT ANYWHERE. No title, no game name, no tagline, no caption, no number,',
  '  no word on a sign or a banner, no signature, no watermark, no studio mark, no',
  '  age rating. Every portal typesets the game\'s name over this art in its own',
  '  type at its own size, and a painted title crosses theirs — it is the single',
  '  most common reason a cover is sent back before anybody has looked at the art.',
  '· NO LOGO and no wordmark. The logo is a separate file delivered beside this',
  '  one, which is how a store page gets both without either being baked into the',
  '  other.',
  '· NO USER INTERFACE of any kind: no buttons, no score, no coin counter, no',
  '  timer, no health bar, no combo meter, no crosshair, no tutorial hand, no',
  '  arrows, no HUD panel, no phone or browser frame around the art.',
  '· No border, no frame, no rounded corners, no drop shadow around the image',
  '  itself, no letterboxing, no bars. The art IS the whole rectangle.'
]

/**
 * The CTR block.
 *
 * This is the part of the prompt the request was actually about, and it is
 * written as marks a painter can check off rather than as "make it eye
 * catching", for the same reason every clause in `artSheet.ts` is: an adjective
 * is not an instruction. Every line is a property of a thumbnail that survives
 * being 250 px wide in a grid of forty others, which is the only place this
 * image is ever seen before somebody decides whether to click it.
 */
const CLICKABLE = [
  'WHAT MAKES IT CLICKABLE — this is the whole job',
  'This image is seen about 250 pixels wide, for a fifth of a second, in a grid of',
  'forty other games. Everything below is about winning THAT look, not about being',
  'a nice illustration at full size.',
  '· ONE subject, enormous. The sole and the bug beneath it together fill at least',
  '  half the frame. A busy scene of a dozen equal bugs reads as noise and is',
  '  skipped; one huge shoe about to land is read instantly.',
  '· THE FACE IS THE HOOK. The bug under the sole is in close-up with a huge comic',
  '  reaction — eyes enormous and round, pupils tiny, mouth open, both arms thrown',
  '  up, one bead of sweat flying off. Funny panic, never fear and never horror.',
  '  That face is the first thing a player sees and the reason they click.',
  '· THE MOMENT IS THE ONE BEFORE. The sole has NOT landed. It hangs a hand\'s',
  '  breadth above the bug with its shadow already pooled underneath, motion lines',
  '  streaming off its heel. A stomp already finished has no tension left in it.',
  '· MAXIMUM CONTRAST WHERE THE EYE LANDS. The warm gold sole and its lime tread',
  '  bars sit directly against the hot pink splat and the bug\'s dark chestnut',
  '  shell, so the brightest, most saturated meeting of colours in the whole image',
  '  happens exactly at the focal point and nowhere else.',
  '· EVERYTHING POINTS AT IT. Radial speed streaks behind the sole, the bodies of',
  '  the scattering bugs leaning away from it, the splatter flung outward from it —',
  '  every line in the picture leads back to the moment of impact.',
  '· THREE PLANES OF DEPTH. One or two bugs large, sharp and cropped by the frame',
  '  in the foreground; the sole and the hero bug crisp in the middle; a softer,',
  '  slightly out-of-focus scatter of bugs behind. Flat art with no depth reads as',
  '  a sticker.',
  '· A QUIET EDGE AND A BRIGHT CENTRE. The floor darkens and desaturates a little',
  '  toward the corners and there is a warm glow pooled behind the hero, so the',
  '  centre of the image is the brightest part of it.',
  '· NOTHING IMPORTANT IN THE OUTER EIGHTH of the frame, on any side. Portals crop',
  '  this image to shapes nobody warned us about, and the thing that gets cut is',
  '  whatever was nearest the edge.'
]

/** What the plate is, and what the painter is allowed to change about it. */
const READ_THE_PLATE = [
  'READ THE ATTACHED PLATE',
  'The attached image is a BLOCKING PLATE, not a painting to copy. Every creature,',
  'shoe and splat in it is the game\'s own artwork, dropped in at the size and the',
  'place it belongs. Take from it, exactly:',
  '· WHO IS IN IT. These specific creatures, with these silhouettes, these colours',
  '  and these numbers of legs. A player has spent an hour looking at them; a cover',
  '  showing different insects is a cover of a different game.',
  '· WHERE THINGS ARE. The shoe, the hero bug and the scattering bugs stay roughly',
  '  where the plate puts them, at roughly the size the plate gives them.',
  '· WHAT THE FLOOR IS. The red-and-cream gingham picnic blanket, in that colour.',
  'Change everything else. The plate is stiff, evenly lit, flatly stacked and has',
  'no atmosphere in it at all — that is what you are being asked to fix. Repose the',
  'creatures, give them faces and reactions, throw real light and real shadow',
  'across the floor, add the dust, the streaks, the flying crumbs and the depth.'
]

const CAMERA = [
  'THE CAMERA',
  'A steep, almost overhead view looking DOWN at the floor — the angle the game is',
  'played at — tipped just far enough forward that the sole is seen coming toward',
  'the camera and has real volume and real height above the ground. Not a flat',
  'top-down diagram and not an eye-level side view.'
]

const PALETTE = [
  'COLOUR',
  'The game\'s own palette, and no other: warm gold and cream for the shoe, lime',
  'green for its tread bars and the under-spatter, hot bubblegum pink for the',
  'splats, warm chestnut brown and cream for the bugs, red-and-cream gingham for',
  'the floor, and a warm near-black (#2b1b2e) for every contour. Saturated and',
  'sunny throughout. No teal-and-orange grade, no desaturated wash, no neon',
  'cyberpunk, no dark or moody version of this.'
]

/** A ready-to-paste prompt for one cover aspect. */
export const promptForCover = (a: CoverAspect): string => [
  ...DELIVERABLE(a),
  '',
  ...EXCLUSIONS,
  '',
  'WHAT IT IS',
  'Cover art for Bug Crunch, a cheerful arcade game about stomping cartoon bugs',
  'off a picnic blanket before they eat it. The picture is the most exciting',
  'half-second the game has: a giant cartoon sneaker sole hanging in the air above',
  'a floor swarming with bugs, an instant before it comes down, with the bugs',
  'breaking in every direction and one of them frozen underneath it.',
  '',
  ...a.shot,
  '',
  ...READ_THE_PLATE,
  '',
  ...CLICKABLE,
  '',
  ...CAMERA,
  '',
  ...PALETTE,
  '',
  // The ground rule is dropped here and nowhere else — see `houseStyle`. A
  // cover that carried no shadow would be a cast of sprites floating over a
  // texture, which is exactly what the plate already looks like.
  houseStyle(false, false),
  '',
  'CHECK BEFORE YOU ANSWER',
  '· Is there a single letter, digit or logo anywhere in the image? There must not',
  '  be one.',
  '· Is there a button, a bar, a counter or a frame anywhere? There must not be.',
  '· Does the painting reach all four edges with no border and no bars?',
  '· Is the bug under the sole the biggest, brightest, most readable thing in it?',
  '· Would you know what this game is about from a 250-pixel-wide copy?',
  '',
  'OUTPUT',
  `One image, ${a.plate.w} x ${a.plate.h} pixels, aspect ratio exactly ${a.label},`,
  'PNG if you can, JPEG otherwise. No text, no logo, no interface, no border.'
].join('\n')

/**
 * `art-sheets/promotion/PROMPTS-PROMOTION.md`.
 *
 * NOT in `art-sheets/` itself, and the folder is load-bearing: the Art Desk
 * scans `art-sheets/PROMPTS-*.md` and turns every block it finds into a job
 * whose return it drops in `art-sheets/painted/` and hands to
 * `tools/slice-sheets.mjs`. The slicer knows nothing about covers and would
 * refuse all six, leaving six paintings in the folder it reads. One directory
 * down, the desk never sees them, and `pnpm art:promotion` is the only thing
 * that paints and files them — which is what "an additional side step" means in
 * practice.
 *
 * The block shape is still the pipeline's (`## <title>  (<reference>.png)`), so
 * the document is readable by the same eyes and pasteable by the same hands,
 * and a markdown preview gives every prompt its own copy button.
 */
export const promotionPromptDoc = (): string => [
  '# Promotion prompts — one cover per generation',
  '',
  'Generated from `src/game/promotionSheet.ts` — do not hand-edit, re-run',
  '`pnpm art:promotion --plates` instead.',
  '',
  'These are the images that go on a STORE PAGE, not into the game. Attach the',
  'plate named in the heading and paste the block beside it; drop the return in',
  '`art-sheets/promotion/painted/` under the same stem and run `pnpm',
  'art:promotion`, which cuts every deliverable size out of it and compresses',
  'them into `src/assets/promotion/`.',
  '',
  '`pnpm art:promotion` on its own does all of that including the painting — it',
  'drives the same signed-in Gemini window the Art Desk uses. This document is',
  'the hand route for when that window is not available, and the record of what',
  'the automated one sends.',
  '',
  'Every one of them is painted without text, without a logo and without any',
  'interface. That is not a style choice: a portal typesets the game\'s name over',
  'the art itself, and the logo ships as its own file in the same folder.',
  '',
  ...COVER_ASPECTS.map((a) => [
    `## ${a.id} — ${a.label}  (${plateStem(a)}.png)`,
    '',
    `Cuts ${a.sizes.map((s) => `${s.w}x${s.h}`).join(', ')} in`,
    `${COVER_FORMATS.join(' and ')}.`,
    '',
    '```text',
    promptForCover(a),
    '```',
    ''
  ].join('\n'))
].join('\n')

/** One row per aspect, for the status report — the same shape `sheetRows()`
 *  gives the rest of the pipeline. */
export const promotionRows = (): Array<{
  stem: string
  title: string
  targets: string[]
}> => COVER_ASPECTS.map((a) => ({
  stem: plateStem(a),
  title: `${a.id} — ${a.label}`,
  targets: a.sizes.flatMap((s) => COVER_FORMATS.map((f) => coverFile(s, f)))
}))
