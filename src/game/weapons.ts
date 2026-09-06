import { CRATE_R, LANE_HALF, SHOOTERS, stageSpeed } from '@/game/survival'

/**
 * ─── Weapon upgrades — the puzzle prize ─────────────────────────────────────
 *
 * One optional, self-contained beat per stage that pays out a WEAPON for the
 * rest of that stage. It is the only thing in the game that is not on the way:
 * everything else the road offers — crates, banks, coins — is collected by
 * steering slightly better than you were already steering. This has to be
 * NOTICED first.
 *
 * The shape, in order down the road:
 *
 *      ▲ stone                                            (one shoulder)
 *      lever ◄──
 *                 ▲ stone                                 (the other, 3 units on)
 *                 ──► lever
 *
 *                            ▓▓▓▓  ← armour, 12 units on
 *                            [W]     the box behind it
 *
 * Break the stone, shoot the lever, twice. Both levers and the armour comes off
 * before the crowd arrives. One, or neither, and the box goes past behind a
 * wall nobody has the road left to chew through. That is the whole mechanic,
 * and it is deliberately a test of ATTENTION rather than of DPS: the levers are
 * cheap to break and expensive to find, sitting out at the rails where nothing
 * else in the game ever asks the player to point.
 *
 * The stones are the answer to the beat's one measured flaw — the sweep was
 * free. A crowd steering anywhere near a lever's column deleted it in passing,
 * so "did you notice" quietly became "did you drift", and a puzzle that solves
 * itself on a stray round is not a puzzle. A stone in front of each post means
 * the round has to be SPENT there: point at the lever, hold it, and be pointing
 * long enough to matter. See `LEVER_STONE_HP_MUL` for why it is not more than
 * that.
 *
 * Three rules keep it a gift rather than a tax:
 *
 *   1. IT IS NEVER IN THE WAY. The box and its armour sit on one shoulder, and
 *      `WEAPON_FREE_LANE` guarantees the remaining road is wider than a crowd
 *      at full size. A player who ignores the whole beat pays nothing.
 *   2. IT NEVER OUTLIVES THE STAGE. The weapon is cleared by `startStage`, so
 *      it is a reward for reading THIS road, not a permanent power spike that
 *      makes the next one trivial. See `activeWeapon` in `useSurvivalGame`.
 *   3. THE TWO PRIZES ARE DIFFERENT SHAPES, not different sizes. See below.
 *
 * ─── The two weapons ────────────────────────────────────────────────────────
 *
 * They are priced to roughly the same single-target DPS multiplier and to very
 * different feels, so "which stage am I on" is a change of plan rather than a
 * change of number:
 *
 *   GATLING — `streams` unchanged, fire rate x2.2, damage x2. A hose. Best
 *             against the one thing in the game with a health bar long enough
 *             to matter (a boss, an elite), and the safe pick when the crowd is
 *             small, because every round still has to hit something.
 *   ROCKET  — a HANDFUL of streams, fire rate x0.6, damage x5.5, and a blast.
 *             Fewer, far heavier rounds. Worse into a single body, and the only
 *             thing in the player's hands that answers a pack of twelve at once.
 *
 * The DPS identity that makes this tunable: total damage per second is
 * `squad x damage x fireRate x rateMul x damageMul`, and `streams` cancels out
 * of it entirely (a stream fires `fireRate` times a second and each round
 * carries `squad x damage / streams`). So `streams` is a pure FEEL dial — it
 * decides how many, how fat and how far apart the rounds are — and the balance
 * lives in the two multipliers alone.
 */

export type WeaponId = 'rocket' | 'gatling'

export interface WeaponDef {
  id: WeaponId
  /**
   * Muzzles firing at once, overriding `SHOOTERS`. `0` means "use `SHOOTERS`".
   *
   * Cancels out of the DPS product (see the header), so it costs nothing to
   * set: it exists to make a rocket a FAT round rather than fourteen thin ones
   * arriving together, which is the difference between a launcher and a shotgun.
   */
  streams: number
  /**
   * …and one more muzzle per this many survivors, up to `streamsMax`. `0`
   * disables the scaling and pins the weapon at `streams`.
   *
   * ─── Why the launcher had to grow with the crowd ────────────────────────
   *
   * It shipped at a flat ONE stream, and that is DPS-correct and feels wrong:
   * a squad of four and a squad of four hundred both fired a single rocket at a
   * time, so the weapon looked identical at every point on the curve while the
   * number behind it grew by two orders of magnitude. Player-reported, in as
   * many words: *"only fires one round no matter the size of the squad"*.
   *
   * Scaling alone did not fix it, and the second report says why: *"the rocket
   * launcher is still only firing 1 bullet"*. `streamsPer` was 12 off a base of
   * ONE, so every squad under a dozen — which is most of a stage's opening, and
   * every run that is going badly — still watched a single round leave. The
   * base is now the floor of the salvo (see `WEAPONS.rocket`), so the smallest
   * crowd that can hold a launcher still fires a volley with it.
   *
   * Because `streams` cancels out of the DPS product, this is a pure feel dial
   * — five launchers each carry a fifth of what one carried, arrive five times
   * as often, and the stage takes exactly as long to clear. What changes is
   * that the crowd you built is visible in the thing it is firing.
   *
   * Capped, and capped low. The whole read of the launcher is that it is NOT
   * the hose beside it; at fourteen streams it would be a slower gatling with a
   * blast, and the two weapons would stop being a choice.
   */
  streamsPer: number
  streamsMax: number
  /**
   * Fire every stream in ONE salvo instead of round-robin down the cadence.
   *
   * The difference is entirely in what the player sees, and it is the whole
   * point. Spread out, five launchers at 0.6x rate are five lonely rounds a
   * second leaving from five places — which is exactly the picture the flat
   * single stream drew, only faster, and it is why the second report landed
   * after the first fix. Fired together, the same five rounds are a SALVO: the
   * front rank lights up at once, five trails fan out to five different bodies,
   * and the pause afterwards is the reload rather than the weapon.
   *
   * It is free in DPS terms. `stepShooting` divides the cadence by the salvo
   * size and multiplies the rounds per trigger by it, so the shot budget over
   * any stretch of road is identical — see the identity in the header.
   *
   * Off for the gatling, and that is not an oversight. Fourteen tracers
   * arriving on one frame and nothing on the next thirteen is a strobe, not a
   * hose, and the gatling's entire read is the hose.
   */
  volley: boolean
  /** Multiplier on `runFireRate`. */
  rateMul: number
  /** Multiplier on the damage each round carries. */
  damageMul: number
  /** Blast radius in world units, or 0 for a round that only hits what it
   *  touches. */
  splashR: number
  /**
   * Rounds STEER to a target instead of going straight up the road.
   *
   * The squad's own gun, and the gatling, fire forward and only forward: the
   * whole game is "point the crowd at the thing", and a rifle that aimed itself
   * would delete the verb. The launcher is the exception on purpose, and it is
   * what makes it a different weapon rather than a bigger one — it converts the
   * player's job from AIMING to POSITIONING, which is exactly the trade its slow
   * cadence already implies. A weapon that fires once a second and misses
   * because the pack drifted two units left is not a reward, it is a downgrade.
   *
   * See `aimTarget` for what it picks and what it refuses to shoot at.
   */
  homing: boolean
}

/**
 * Blast damage as a share of the round's own.
 *
 * Everything OTHER than the body the rocket actually hit takes this fraction —
 * the direct hit is always paid in full. Without the split a rocket in a pack of
 * twelve deals twelve times its face value, which is not a weapon, it is a
 * different game; with it, the rocket is worth about four bodies' worth against
 * a crowd and exactly one against a boss, which is the trade the two weapons are
 * supposed to be asking about.
 */
export const ROCKET_SPLASH_SHARE = 0.6

/**
 * How far the blast reaches, world units.
 *
 * A shade under a boulder's width and well under the lane's, so a rocket is an
 * answer to a CLUMP rather than to a row: the pincer and the swarm wall spread
 * their bodies wider than this on purpose, and a weapon that erased either of
 * them in one round would delete the two hazards the mid-game is built out of.
 */
export const ROCKET_SPLASH_R = 2.3

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  gatling: {
    id: 'gatling',
    // Unchanged: the gatling's whole read is that the SAME fourteen muzzles are
    // going much faster. Cutting the stream count would have made it quieter on
    // screen while the numbers got louder, which is the wrong way round.
    streams: 0,
    streamsPer: 0,
    streamsMax: 0,
    rateMul: 2.2,
    damageMul: 2,
    splashR: 0,
    // Straight up the road, like the gun it replaces. The gatling's whole read
    // is VOLUME — where you point it is still the entire skill.
    homing: false,
    volley: false
  },
  rocket: {
    id: 'rocket',
    // THREE launchers minimum, five at a crowd worth the name — and all of them
    // going at once. The floor is the fix for "it still only fires one bullet":
    // a salvo is the smallest thing that reads as a launcher, so the weapon may
    // never be handed over firing less than one. See `streamsPer` and `volley`.
    streams: 3,
    streamsPer: 24,
    streamsMax: 5,
    rateMul: 0.6,
    damageMul: 5.5,
    splashR: ROCKET_SPLASH_R,
    homing: true,
    volley: true
  }
}

/** Single-target DPS multiplier, for the shop readout and the balance tests.
 *  `streams` is absent on purpose — see the header. */
export const weaponDpsMul = (id: WeaponId): number =>
  WEAPONS[id].rateMul * WEAPONS[id].damageMul

/**
 * How many muzzles this weapon fields for a crowd of `alive`.
 *
 * The one place the stream count is decided, because it has to be the same
 * number in two calculations that must not disagree: the shot budget and the
 * damage each round carries (`squad x damage / streams`). Split them and the
 * weapon quietly gains or loses DPS with the size of the crowd.
 */
export const weaponStreams = (id: WeaponId | null, alive: number): number => {
  if (!id) return SHOOTERS
  const def = WEAPONS[id]
  if (def.streamsPer <= 0) return def.streams > 0 ? def.streams : SHOOTERS
  // `streams` is the FLOOR of the salvo, not its first step: the growth is a
  // bonus on top of a weapon that already reads as a launcher at any crowd
  // size. Clamped both ways so `streamsMax` below `streams` cannot quietly
  // invert the two.
  const grown = def.streams + Math.floor(alive / def.streamsPer)
  return Math.max(1, Math.min(Math.max(def.streams, def.streamsMax), grown))
}

/**
 * The first stage that carries a puzzle.
 *
 * Stages 1-5 are the tutorial: one control, one gate, two crate colours, an
 * elite and the first walls that actually kill. A player still learning that a
 * box CAN be shot has no attention spare for a box that cannot be, and an
 * unclaimed prize on one of the first roads they ever run reads as a bug rather
 * than as a miss.
 *
 * It may not fall below 4 whatever else changes: `HARD_OBSTACLE_FROM_STAGE` is
 * 4, and stages under it carry **no scenery that can kill** — every wall and
 * boulder is filtered out of the finished track. The armour over the box is a
 * wall, and the stone over each lever is one too. Opening the beat below that
 * line would either put the first lethal-looking thing in the game inside a
 * bonus nobody asked for, or ship the box with no armour at all, which is the
 * puzzle with the puzzle taken out.
 *
 * It is 6 rather than 4 because of `WEAPON_EVERY` below: the beat stopped being
 * every-stage furniture, so the one that opens the run has to land on a road
 * the player can already drive.
 */
export const WEAPON_STAGE = 6

/**
 * …and one every this many stages after it.
 *
 * A weapon on EVERY stage is not a prize, it is the ordinary state of the game
 * with a two-lever entry fee. The whole read of the beat — "this road has
 * something on it" — needs roads that do not, and a stage the player runs on
 * the squad's own gun is what makes the next one's launcher feel handed over.
 *
 * Two rather than three so the alternation still gives each weapon a turn
 * inside any stretch of road a player remembers, and so the shop's two damage
 * tracks (`weaponPowerMul`) both stay live purchases.
 */
export const WEAPON_EVERY = 2

/** Does this stage's road carry a puzzle at all? The one answer, so the track
 *  generator, the art preloader and the tests cannot drift apart. */
export const stageHasWeapon = (stage: number): boolean =>
  stage >= WEAPON_STAGE && (stage - WEAPON_STAGE) % WEAPON_EVERY === 0

/**
 * Which weapon this stage's box holds.
 *
 * Alternates across the stages that HAVE a box — not across every stage, which
 * is the bug the every-other-stage cadence would otherwise walk into: `stage %
 * 2` and a puzzle every second stage agree forever, and the campaign would ship
 * with the gatling never once appearing in a box.
 *
 * The gatling goes first. It is the weapon that changes nothing about how the
 * player aims, so the first prize teaches "the box pays out" without also
 * teaching a new verb; the launcher lands on stage 8, by which point there is a
 * crowd big enough for a salvo to look like one.
 *
 * A pure function of the stage number for the same reason everything else in
 * `track.ts` is: a stage has to be LEARNABLE. A player who lost stage 12 to a
 * swarm should know before they press retry that stage 12's prize is the
 * rocket, and plan the sweep for it.
 */
export const weaponForStage = (stage: number): WeaponId =>
  Math.floor((stage - WEAPON_STAGE) / WEAPON_EVERY) % 2 === 0 ? 'gatling' : 'rocket'

// ─── The furniture ──────────────────────────────────────────────────────────

/**
 * How far out the levers sit, world x.
 *
 * Practically ON the rails. Nothing else in the game lives this far off the
 * centre line — `CRATE_DETOUR_X` is 2.45 and a gate leaf tops out at 3.5 — so
 * the position itself is the tell: a player who has learned the road knows that
 * a thing at 3.4 is not part of the ordinary vocabulary.
 */
export const LEVER_X = 3.4

/**
 * Half-extent of a lever post, world units.
 *
 * It has no contact rule at all — the crowd runs straight through one it failed
 * to shoot — so this is purely how big the thing is to SEE and to hit, and both
 * of those want it generous. It was 0.42, which is smaller than a supply crate,
 * and on a desktop viewport (where the lane letterboxes to a narrow strip) the
 * post came out about forty pixels tall out at the rail, in the darkest part of
 * the road. A prop the player is supposed to notice from ten units out cannot be
 * the smallest thing on screen.
 *
 * Bigger also means a wider hitbox, which is the right direction: this beat
 * charges attention, not precision, and a lever that punishes a slightly loose
 * line is charging the wrong thing.
 */
export const LEVER_R = 0.58

/**
 * How far up the road the SECOND lever sits from the first.
 *
 * The two are staggered rather than paired across one line, and this is the
 * number that makes the puzzle possible at all. The guns reach `BULLET_RANGE`
 * (10.8 units) and the crowd closes at ~5.5 u/s, so a lever is shootable for
 * about two seconds — and crossing the lane at `STEER_SPRING` takes most of
 * one. Two levers on the same line is therefore a coin flip on whether the
 * second one is still in range when the crowd finishes its sweep; staggered,
 * the second lever's window OPENS as the first one's closes, and the beat reads
 * as "left, now right" instead of "pick one".
 */
export const LEVER_STAGGER = 3.2

/**
 * Distance from the FIRST lever to the box.
 *
 * This is the number the beat's fairness is priced on, and the worst case is
 * the one to size it against: a player who pulls the second lever at the LAST
 * possible instant — with the crowd level with the post — has
 * `WEAPON_BOX_AHEAD - LEVER_STAGGER - WEAPON_GUARD_LEAD` units of road left
 * before the armour. At the 7.4 u/s speed ceiling that has to stay comfortably
 * over a second, and at 12 it was exactly 1.000 s, which is a coincidence and
 * not a margin. `weaponReactionS` is the assertion; `trackShape` holds it.
 *
 * Short enough, still, that the two halves of the beat are on screen together
 * at least once — which is what makes the causal link ("I shot those, THAT
 * opened") readable the first time it happens.
 */
export const WEAPON_BOX_AHEAD = 14

/** Half-extent of the prize box. Bigger than a supply crate: it is the one
 *  pickup on the road that is worth a detour on its own. */
export const WEAPON_BOX_R = CRATE_R * 1.45

/** How far in front of the box the armour stands. */
export const WEAPON_GUARD_LEAD = 1.4

/**
 * Where the box parks, world x, as a distance from the centre line.
 *
 * On a SHOULDER, never in the middle, and that is a safety rule rather than a
 * layout preference. The armour is lethal on contact like every other wall, and
 * a lethal wall on the centre line is the one obstacle a player cannot ignore —
 * they would be paying for a beat they chose not to play. Out here it leaves
 * `WEAPON_FREE_LANE` of open road on the other side, which is more than a crowd
 * at full size needs.
 */
export const WEAPON_BOX_X = 2.6

/** Half-width of the armour, centred on the box. */
export const WEAPON_GUARD_HALF_W = 1.2

/**
 * Clear road left beside the armour, world units.
 *
 * Asserted in `weaponPuzzle.test.ts` against `MIN_RUN_GAP`: a crowd at full
 * size has to fit past this beat without losing anybody, or the "free to
 * ignore" promise above is a lie. The armour's inner edge is at
 * `WEAPON_BOX_X - WEAPON_GUARD_HALF_W` = 1.4, and the road from the far rail to
 * that edge is `4.5 + 1.4` = 5.9 against a 4.9 requirement.
 */
export const WEAPON_FREE_LANE = LANE_HALF + (WEAPON_BOX_X - WEAPON_GUARD_HALF_W)

/**
 * HP of one lever.
 *
 * Deliberately trivial, and deliberately NOT scaled by the difficulty knobs the
 * way a crate is. The puzzle charges attention; charging DPS as well would mean
 * a run that is already losing — small crowd, low damage, exactly the run a free
 * weapon exists to rescue — is the one run that cannot afford the rescue.
 * A third of a supply crate, which a squad of three breaks in about a second.
 */
export const leverHp = (stage: number): number =>
  Math.max(3, Math.round(4 + Math.min(stage, 20) * 0.45))

/**
 * ─── The stone over a lever ─────────────────────────────────────────────────
 *
 * One destructible boulder parked in front of each post, in the same column,
 * and the ONE thing between the player and a lever that is otherwise free.
 *
 * It exists because the levers were, in play, hit by accident: they sit at
 * |x| = 3.4 with a 0.58 hitbox and no cover, the crowd fires fourteen scattered
 * streams up the road, and any line that came within a unit of the rail solved
 * half the puzzle without the player ever looking at it. That is the mechanic
 * paying out for something it did not ask for.
 *
 * What the stone must NOT become is a second health check. Everything about its
 * numbers is chosen against that:
 *
 *   • it is DESTRUCTIBLE, unlike every other boulder in the game. The renderer
 *     prints its remaining health on it for exactly that reason — the game's
 *     own vocabulary says a rock is the thing fire cannot answer, so a stone
 *     the player is required to shoot has to carry the "shoot me" mark a
 *     barricade carries or it reads as a wall around the prize.
 *   • it is HARMLESS on contact, like the armour and unlike a wall — see
 *     `Guard`. It is furniture bolted to an optional bonus, on a shoulder the
 *     beat is inviting the crowd onto.
 *   • it is ONE stone, not a row. The player has to spend fire in one place,
 *     which is the cost the puzzle was missing; they do not have to win a
 *     second fight to get to the first one.
 */

/**
 * Its health, as a share of the stage's ordinary wall.
 *
 * A barricade is the game's yardstick for "a solid thing you may shoot down",
 * so the stone is priced against that and deliberately UNDER it: a lever's
 * cover should cost less than the walls the stage is actually charging for.
 * At 0.7 the strong crowds that were already soloing the armour barely notice
 * it, and the weak ones — the runs a free weapon exists to rescue — spend most
 * of a lever's two-second window on it, which is the attention the beat is
 * supposed to be charging.
 */
export const LEVER_STONE_HP_MUL = 0.7

/**
 * How far in FRONT of its lever the stone sits, world units.
 *
 * Far enough that the two are separate targets — a stone overlapping the post
 * would make the pair one silhouette and the beat unreadable — and short
 * enough to stay well inside `WEAPON_LANE_CLEAR`, the stretch the generator
 * guarantees is free of other scenery. It is also the free head start: the
 * stone enters the gun's reach this many units before the lever would have,
 * so shooting it does not come out of the lever's own window.
 */
export const LEVER_STONE_LEAD = 2.2

/**
 * Width of the stone, world units.
 *
 * Wider than the lever's hittable span (`LEVER_R + BULLET_R`, about 1.3 across)
 * so it genuinely covers the column rather than leaving a rim of it exposed —
 * that rim is precisely the accident the stone is here to stop. Not much wider:
 * cover that reaches past its post starts eating the rounds aimed at the road
 * beside it.
 */
export const LEVER_STONE_W = 1.6

/** Half-depth of a stone, world units. A boulder's own, so the two read as the
 *  same kind of object — one of which happens to be breakable. */
export const STONE_H = 1.15

/**
 * One stone over one lever.
 *
 * Its own type rather than a `Rock` with health bolted on, for the reason
 * `Guard` is not a `Barricade`: `getRocks()` means "the boulders this stage
 * laid out" to the funnel, the crowd's avoidance and the balance harness, and
 * every one of those would start answering a slightly different question if a
 * destructible, harmless, puzzle-owned body appeared in the set.
 */
export interface Stone {
  id: number
  /** The puzzle it belongs to — see `WeaponBox.puzzleId`. */
  puzzleId: number
  x: number
  y: number
  w: number
  hp: number
  maxHp: number
  flash: number
  dead: boolean
  /** Fixed per-body tilt and silhouette seed, exactly as a boulder's. */
  spin: number
  seed: number
}

/**
 * HP of the prize box.
 *
 * Chunky — around three supply crates. Once the armour is off, the box is still
 * something the player has to STAND ON and shoot, which is the beat that makes
 * the reward feel taken rather than driven over, and it is the reason the
 * shoulder detour costs something.
 */
export const weaponBoxHp = (stage: number): number =>
  Math.round(22 + Math.min(stage, 25) * 4 + Math.max(0, stage - 25) * 1.6)

/**
 * HP of one armour block. Six barricades' worth, and that multiple is the
 * point.
 *
 * Not invulnerable, on purpose — it is an ordinary wall with an extraordinary
 * amount of health, and `stepWeaponBoxes` opens the box whenever nothing is
 * covering it any more, however that came about. A player with a monstrous
 * crowd who wants to brute-force the lid instead of reading the road is welcome
 * to try, and the arithmetic says what it costs: the armour comes into range
 * ~10.8 units out, which is under two seconds of fire, against twenty walls'
 * worth of health across the two plates. A run that can do that in the time
 * available has earned the box by any measure that matters.
 *
 * It was 6, and 6 was measurably too cheap: a stage-8 crowd of eighty at four
 * damage tore both plates off inside the window, which made the levers optional
 * on exactly the runs that least needed the help — and made the outcome of the
 * beat depend on how the fire happened to scatter, which is the one thing a
 * puzzle may not do. At 10 the levers are the cheaper answer on every run the
 * campaign actually produces.
 */
export const WEAPON_GUARD_HP_MUL = 10

/**
 * Seconds of road between the last lever and the armour, at this stage's speed.
 *
 * Not read by anything that runs — it exists so `trackShape.test.ts` can assert
 * that the reaction window never collapses as `stageSpeed` climbs. At stage 1
 * speed it is 1.6 s and at the 7.4 u/s ceiling it is 1.2 s, which is the floor
 * the beat is designed against.
 */
export const weaponReactionS = (stage: number): number =>
  (WEAPON_BOX_AHEAD - LEVER_STAGGER - WEAPON_GUARD_LEAD) / stageSpeed(stage)

// ─── The live objects ───────────────────────────────────────────────────────

/**
 * One lever post.
 *
 * No contact rule and no `w` — it is the only solid-looking prop in the game
 * that is not solid. A crowd that runs over an unshot lever passes straight
 * through it and loses nobody, which is the honest reading of "you missed
 * this": the puzzle's punishment is the prize you do not get, and stacking a
 * death on top of that would turn a bonus into a hazard.
 */
export interface Lever {
  id: number
  /** The puzzle this lever belongs to — see `WeaponBox.puzzleId`. */
  puzzleId: number
  x: number
  y: number
  hp: number
  maxHp: number
  /** Shot through. Terminal: a pulled lever is never un-pulled. */
  pulled: boolean
  /** Hit flash, 0..1, ticked down by the sim so the renderer needs no clock. */
  flash: number
  /** Seconds since it was pulled, for the renderer's throw animation. */
  pulledFor: number
}

/**
 * One armour plate over a weapon box.
 *
 * ─── Why this is NOT a `Barricade` ──────────────────────────────────────────
 *
 * It looks like one — a slab with health, sitting across the road, deleted by
 * enough fire — and it was one, briefly. Two things made that wrong, and both
 * of them were invisible until something else in the game tripped over it:
 *
 *   1. IT MUST NOT KILL. Every wall in this game erases whoever runs into it,
 *      and the difficulty curve is tuned around how many of them a stage puts
 *      out. This beat adds two more, on every stage from 4, that the curve
 *      never budgeted for — and it adds them to a BONUS the player did not ask
 *      for. The game's own rule for props attached to a reward is the supply
 *      crate's: a reward that punishes the approach as hard as a wall teaches
 *      players to stop approaching rewards. So a plate grinds like a crate.
 *      (Measured before the split: two existing balance tests died on it, both
 *      because a crowd steering an ordinary line was deleted by armour that had
 *      no business being lethal.)
 *   2. IT MUST NOT BE COUNTED AS ONE. `getBarricades()` means "the walls this
 *      stage laid out" to a dozen call sites — the renderer, the crowd's
 *      obstacle avoidance, `deathBreakdown`, the balance harness. Quietly
 *      widening that set to include a puzzle's furniture makes every one of
 *      those answer a slightly different question than it used to.
 *
 * What it keeps from a wall: it is solid to rounds, it has real health, and the
 * crowd routes around it. What it does not keep is the teeth.
 */
export interface Guard {
  id: number
  /** The puzzle that owns it — all of them go at once. */
  puzzleId: number
  x: number
  y: number
  w: number
  hp: number
  maxHp: number
  flash: number
  dead: boolean
}

/** Half-depth of an armour plate, world units. Deeper than a barricade so the
 *  lid reads as a slab rather than as a fence. */
export const GUARD_H = 1.1

/**
 * The prize.
 *
 * `locked` is the whole state machine: it flips to false the moment every lever
 * of the same `puzzleId` is pulled, and that one write is what deletes the
 * armour, opens the box's health to fire and changes its read on screen.
 */
export interface WeaponBox {
  id: number
  puzzleId: number
  weapon: WeaponId
  x: number
  y: number
  hp: number
  maxHp: number
  /** Armour still on. A locked box refuses damage outright rather than merely
   *  being hidden behind the wall — a round that squeaked past the armour's
   *  edge should not quietly solve the puzzle. */
  locked: boolean
  /**
   * How many levers this puzzle has, and how many are down.
   *
   * On the BOX rather than counted out of the live lever array, and that is a
   * correctness rule rather than a convenience. Levers are culled once the crowd
   * is past them, and the two are staggered — so a player who shoots only the
   * SECOND lever leaves the first behind them unpulled, it gets culled, and a
   * count derived from what is still in the array would then read "none left to
   * pull" and open the box for free. A tally that only ever moves when a lever
   * actually goes over cannot be fooled by the cleanup.
   */
  leversTotal: number
  leversPulled: number
  /** Seconds since it unlocked, for the renderer's reveal. */
  openFor: number
  dead: boolean
  spin: number
}
