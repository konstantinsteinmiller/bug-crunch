import { stageDesigns, arenaKit } from '@/game/foes'
import { THREAT_POOL_FROM_STAGE, minibossKindFor, bossKindFor, SUMMON_DESIGN } from '@/game/threats'
import { OUTFITS } from '@/game/heroSprites'
import { stageHasWeapon, weaponForStage } from '@/game/weapons'
import { allMonsterIds } from '@/game/monsterSprites'
import { ART_CATALOGUE } from '@/game/artCatalogue'
import { artSettled, artOverridesEnabled, spriteFor, type ArtWant } from '@/game/art'
import { getState } from '@/use/useTowerState'
import { STAGE_KEY } from '@/keys'

/**
 * ─── Staged art loading ─────────────────────────────────────────────────────
 *
 * With painted art on, the naive version fetches the whole set at once: every
 * strip, every prop, every round and effect — fifty-odd files, most of them for
 * things a first-time player will not see for ten minutes. A brute debuts on
 * stage 7 and the healer's bolt on stage 4; a first-time player on a phone
 * would pay for both on stage 1.
 *
 * So the set is staged, and the stages are DERIVED from the game's own tables
 * rather than listed: a design's tier is the first stage it can walk on, read
 * off `foeRoster` through `stageDesigns`; a round's tier is the first stage
 * its miniboss or boss kind can be fielded. Balance changes move the art with
 * them, and nothing here goes stale when a stage is retuned.
 *
 *   tier 0 — behind the splash, `fetchPriority: high`. What the player's stage
 *            puts on screen from its first second: the three survivors, the
 *            stage's cast, the road and the props every road has, the effects
 *            every second of play shows.
 *   tier 1 — right after the splash, normal priority, one at a time. The next
 *            stage's newcomers, the threats this stage's elites and boss throw,
 *            the skills.
 *   tier 2 — on an idle slot after tier 1 has settled, `fetchPriority: low`.
 *            Everything else, so nothing a resuming player skipped past is
 *            orphaned.
 *
 * Nothing waits on tiers 1 or 2. A design whose strip has not arrived when it
 * first walks on simply draws its procedural body, exactly as it does with the
 * art switched off.
 */

/**
 * The stage the player is about to play, or 1 for a new player.
 *
 * `ts_stage` is the campaign position — the stage a wipe restarts — and the
 * loader already reads it for the sprite bake, so it is the right key here
 * too: the enemies it names are the ones the first frame will show.
 */
export const resumeStage = (): number => {
  try {
    const raw = Number(getState(STAGE_KEY, 1))
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1
  } catch { return 1 }
}

const uniq = (wants: ArtWant[]): ArtWant[] => {
  const seen = new Set<string>()
  return wants.filter(([k, id]) => {
    const key = `${k}/${id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** The rounds and effects a stage's elite and boss kinds actually throw. */
const threatWants = (stage: number): ArtWant[] => {
  const wants: ArtWant[] = []
  // The meteor's ring is every boss's slam telegraph, and the guard and its
  // crest are every boss's mid-fight shield.
  wants.push(['fx', 'ring-heat'], ['fx', 'guard'], ['fx', 'crest-guard'])
  const boss = bossKindFor(stage)
  if (boss === 'meteor') wants.push(['round', 'meteor'])
  if (boss === 'healer') wants.push(['round', 'bolt-boss'], ['fx', 'ring-heal'])
  if (boss === 'summoner') wants.push(['monster', SUMMON_DESIGN])
  if (stage >= THREAT_POOL_FROM_STAGE) {
    for (const index of [0, 1]) {
      const kind = minibossKindFor(stage, index)
      if (kind === 'roller') wants.push(['round', 'roller'])
      if (kind === 'bomber') wants.push(['round', 'bomb'])
      if (kind === 'gunner') wants.push(['round', 'bolt-gunner'])
    }
  }
  if (arenaKit(stage).barrels > 0) wants.push(['prop', 'barrel'])
  // The weapon puzzle's own box, both states — it is the one beat the player
  // has to NOTICE, so neither state may pop in on the stage that shows it.
  // …and the beat's own furniture: the armour over the box and the two levers
  // that take it off. The lever is the one thing the player has to NOTICE, so
  // nothing here may pop in on the stage that shows it.
  if (stageHasWeapon(stage)) {
    wants.push(['prop', 'weapon-box'], ['prop', 'weapon-box-open'],
      ['prop', 'guard-plate'], ['prop', 'lever-post'], ['prop', 'lever-arm'])
  }
  // The launcher's rocket, on the stages whose box holds it — which is every
  // other puzzle stage, not every other stage. See `weaponForStage`.
  if (stageHasWeapon(stage) && weaponForStage(stage) === 'rocket') wants.push(['round', 'rocket'])
  return wants
}

/**
 * Tier 0: what the splash holds for.
 *
 * A resuming player's first screen is their own stage, not stage 1. Fetching
 * the starting cast for someone on stage 9 means the brutes they are about to
 * meet pop in mid-run, which is the one moment the swap is most visible.
 */
export const criticalArtWants = (): ArtWant[] => {
  const stage = resumeStage()
  return uniq([
    ...OUTFITS.map((o): ArtWant => ['hero', o.id]),
    ...stageDesigns(stage).map((id): ArtWant => ['monster', id]),
    // The horizon, and what every road has on it.
    ['bg', 'ridge-far'], ['bg', 'ridge-near'],
    ['prop', 'crate-damage'], ['prop', 'crate-rate'], ['prop', 'barricade'],
    ['prop', 'boulder-1'], ['prop', 'boulder-2'], ['prop', 'boulder-3'],
    ['prop', 'coin'], ['prop', 'pillar'],
    // Gates: the paying door is on every stage, the trap from stage 2, the
    // bill from stage 3 (see `track.ts`), the multiplier from the first bank
    // that rolls one.
    ['gate', 'frame-add'], ['gate', 'frame-mul'],
    ...(stage >= 2 ? [['gate', 'frame-div'] as ArtWant] : []),
    ...(stage >= 3 ? [['gate', 'frame-sub'] as ArtWant] : []),
    // What every second of play shows.
    ['round', 'tracer'], ['fx', 'muzzle'], ['fx', 'smoke'], ['fx', 'scorch'], ['fx', 'ring-shock'],
    // Elites from stage 2 wear the crown.
    ...(stage >= 2 ? [['ui', 'crown'] as ArtWant] : []),
    // The shop button and the grenade button are on screen from the first
    // second of every run.
    ['ui', 'chest'], ['ui', 'skill-grenade']
  ])
}

/** Tier 1: what this stage's fights throw, and the next stage's newcomers. */
export const earlyArtWants = (): ArtWant[] => {
  const stage = resumeStage()
  const have = new Set(criticalArtWants().map(([k, id]) => `${k}/${id}`))
  return uniq([
    ...threatWants(stage),
    ['round', 'grenade'], ['fx', 'shield'], ['fx', 'crest-shield'],
    // The shield's button once it is bought, and the banner the stage ends on.
    ['ui', 'skill-shield'], ['ui', 'ribbon'],
    ['ui', 'crown'],
    ...stageDesigns(stage + 1).map((id): ArtWant => ['monster', id]),
    ...threatWants(stage + 1)
  ]).filter(([k, id]) => !have.has(`${k}/${id}`))
}

/** Tier 2: every painting the game can ask for, in one low-priority sweep. */
export const allArtWants = (): ArtWant[] => uniq([
  ...OUTFITS.map((o): ArtWant => ['hero', o.id]),
  ...allMonsterIds().map((id): ArtWant => ['monster', id]),
  ...(Object.entries(ART_CATALOGUE) as [Exclude<keyof typeof ART_CATALOGUE, never>, readonly string[]][])
    .flatMap(([kind, ids]) => ids.map((id): ArtWant => [kind, id]))
])

let started = false

/**
 * Tiers 1 and 2. Idempotent; call it once the splash is down.
 *
 * Tier 1 is awaited one file at a time so that a slow connection still gets
 * the next stage's first newcomer before its last — a parallel burst would
 * let the biggest file win. Tier 2 goes out in one low-priority batch on an
 * idle callback, because by then order no longer matters and the browser's
 * own scheduler does a better job of fitting it around play than a chain
 * would.
 */
export const preloadRemainingArt = async (): Promise<void> => {
  if (started || !artOverridesEnabled()) return
  started = true

  for (const [kind, id] of earlyArtWants()) await artSettled(kind, id)

  const late = (): void => {
    for (const [kind, id] of allArtWants()) spriteFor(kind, id, 'low')
  }
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback
  if (typeof idle === 'function') idle(late, { timeout: 8000 })
  else setTimeout(late, 1500)
}

/** Test seam: forget that the tiers have run. */
export const __resetArtPreload = (): void => { started = false }
