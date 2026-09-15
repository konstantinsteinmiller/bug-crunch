/**
 * ─── Staged art loading ─────────────────────────────────────────────────────
 *
 * With painted overrides ON, the whole set is a few megabytes. Fetching all of
 * it before the first frame would trade the game's one genuine advantage — it
 * is playable the instant the JS parses — for art nobody has looked at yet.
 *
 * So it arrives in three tiers:
 *
 *   TIER 0  what the FIRST SCREEN needs: this level's bug cast, the equipped
 *           shoe, this world's floor, the effects a stomp fires, and the HUD's
 *           own marks. The splash HOLDS for these (bounded — see `useAssets`),
 *           because the whole point of painted art is the first impression and
 *           the first impression was the version without it.
 *   TIER 1  the rest of what this LEVEL can produce: its hazards, its boss, and
 *           the piñata fly's coin. Started as soon as the game is on screen.
 *   TIER 2  everything else — the other worlds' floors, the other bosses, every
 *           shoe the player does not have on, the whole bestiary. Started after
 *           the page's own `load`, at low priority, so it never competes with
 *           anything the player is waiting for.
 *
 * A miss at any tier is free: the renderer keeps drawing.
 */

import { BUG_IDS, type BugId } from '@/game/bugs'
import { SHOE_IDS, STARTER_SHOE, isShoeId, type ShoeId } from '@/game/shoes'
import { BOSS_IDS } from '@/game/bosses'
import { levelSpec, clampLevel, worldOf, WORLD_COUNT } from '@/game/stages'
import { ART_CATALOGUE, UI_GLYPH_ART_IDS, UI_HUD_MARKS } from '@/game/artCatalogue'
import { artSettled, artOverridesEnabled, type ArtWant } from '@/game/art'
import { getState } from '@/use/useBugCrunchState'
import { LEVEL_KEY, SHOE_KEY } from '@/keys'

/** The level this boot will open on, read straight from the persisted blob.
 *  The loader runs before the game module graph is imported, so reaching for the
 *  simulation here would invert that order. */
const bootLevel = (): number => clampLevel(Number(getState(LEVEL_KEY, 1)))

/** The shoe the player has on, on the same terms. */
const bootShoe = (): ShoeId => {
  const raw = getState<unknown>(SHOE_KEY)
  return isShoeId(raw) ? raw : STARTER_SHOE
}

/**
 * The effects a single stomp can fire — wanted before the first stomp, which
 * on this game is roughly two seconds after the splash clears.
 *
 * The two splat sheets are in here for a reason the others are not: the decal is
 * stamped ONCE into the persistent floor layer and then never redrawn. Every
 * other effect on this list is re-emitted continuously, so a painting that
 * arrives late simply starts being used on the next ring. A splat that arrives
 * late leaves the drawn version burned into the floor for the rest of the level,
 * next to painted ones — so this is the one tier-0 entry where a miss is
 * permanent rather than momentary.
 */
const STOMP_FX: readonly string[] = [
  'ring-stomp', 'ring-slam', 'burst', 'spark', 'smoke', 'splat', 'splat-confetti'
]

/**
 * TIER 0 — what the first screen needs.
 *
 * Deliberately NOT the whole cast: a fresh player's level 1-1 has one bug design
 * on it. Gating the splash on nine designs, six shoes and four floors would be
 * most of a megabyte behind a network nobody here controls.
 */
export const criticalArtWants = (): ArtWant[] => {
  if (!artOverridesEnabled()) return []
  const level = bootLevel()
  const spec = levelSpec(level)
  const wants: ArtWant[] = []
  for (const r of spec.roster) wants.push(['bug', r.id])
  wants.push(['shoe', bootShoe()])
  wants.push(['bg', `floor-${worldOf(level)}`])
  for (const id of STOMP_FX) wants.push(['fx', id])
  // The HUD's own marks only. The glyph slots (`icon-*`) outnumber them five to
  // one, sit on buttons rather than on the field, and every one of them has a
  // vector path underneath it that is already in the bundle — holding the splash
  // for fifty button icons would spend the whole tier-0 budget on the part of the
  // screen a player is least likely to be looking at. They ride tier 2.
  for (const id of UI_HUD_MARKS) wants.push(['ui', id])
  return wants
}

/** TIER 1 — the rest of what THIS level can put on screen. */
const levelArtWants = (): ArtWant[] => {
  const spec = levelSpec(bootLevel())
  const wants: ArtWant[] = []
  for (const id of spec.hazards) wants.push(['prop', id])
  if (spec.boss) {
    wants.push(['boss', spec.boss])
    wants.push(['prop', 'pod'])
  }
  wants.push(['prop', 'coin'])
  for (const id of ART_CATALOGUE.fx) wants.push(['fx', id])
  return wants
}

/** TIER 2 — everything else, eventually. */
const remainingArtWants = (): ArtWant[] => {
  const wants: ArtWant[] = []
  for (const id of BUG_IDS) wants.push(['bug', id as BugId])
  for (const id of SHOE_IDS) wants.push(['shoe', id])
  for (const id of BOSS_IDS) wants.push(['boss', id])
  for (const id of ART_CATALOGUE.prop) wants.push(['prop', id])
  for (let w = 1; w <= WORLD_COUNT; w++) wants.push(['bg', `floor-${w}`])
  // The button glyphs, last of everything: a painted glyph that arrives after
  // the vector one has been on screen for a second is a button that got nicer,
  // not a glitch — which is the opposite of a bug design popping in mid-walk.
  for (const id of UI_GLYPH_ART_IDS) wants.push(['ui', id])
  return wants
}

/** Drop anything already asked for, so a tier never re-requests a tier above
 *  it. Probes are idempotent, but the bookkeeping is cheaper than the promise. */
const dedupe = (wants: ArtWant[], seen: Set<string>): ArtWant[] => {
  const out: ArtWant[] = []
  for (const w of wants) {
    const key = `${w[0]}/${w[1]}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(w)
  }
  return out
}

let startedRemaining = false

/**
 * Start tiers 1 and 2 and resolve when tier 2 has settled.
 *
 * Awaited by `useAssets`' background warm-up, which holds the SFX decode queue
 * behind it: an SFX that has not decoded costs a frame of latency the first time
 * it fires, while a bug strip that has not arrived is a drawn bug for as long as
 * it takes — and the drawn bug is fine. Art first, then sound.
 *
 * With overrides off it returns immediately and requests nothing.
 */
export const preloadRemainingArt = async (): Promise<void> => {
  if (!artOverridesEnabled() || startedRemaining) return
  startedRemaining = true

  const seen = new Set<string>()
  for (const w of criticalArtWants()) seen.add(`${w[0]}/${w[1]}`)

  // Tier 1 goes out at HIGH priority: the player is in the level these belong
  // to, and a hazard that pops in halfway through it is the glitch this whole
  // module exists to avoid.
  const tier1 = dedupe(levelArtWants(), seen)
  await Promise.allSettled(
    tier1.map(([k, id]) => artSettled(k, id, 'high')).filter(Boolean) as Promise<void>[]
  )

  // Tier 2 waits for the page's own load before it starts — otherwise it is
  // competing with the bundle, the fonts and tier 1 for the same connection.
  await pageLoaded()

  const tier2 = dedupe(remainingArtWants(), seen)
  await Promise.allSettled(
    tier2.map(([k, id]) => artSettled(k, id, 'low')).filter(Boolean) as Promise<void>[]
  )
}

const pageLoaded = (): Promise<void> => {
  if (typeof document === 'undefined') return Promise.resolve()
  if (document.readyState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve) => {
    window.addEventListener('load', () => resolve(), { once: true })
    // A page that never fires `load` (a stalled third-party script on a portal)
    // must not strand the whole tier behind it.
    setTimeout(resolve, 6000)
  })
}

/**
 * Warm the art for the level the player is ABOUT to start.
 *
 * Called from the result screen, while the player is reading their stars: by the
 * time they press the forward button, the next level's new designs have landed.
 * A level that introduces a tier — the beetle on 1-4, the centipede on 3-1 — is
 * exactly where a pop-in is most visible, and this is the whole fix.
 */
export const warmNextLevelArt = (nextLevel: number): void => {
  if (!artOverridesEnabled()) return
  const spec = levelSpec(nextLevel)
  for (const r of spec.roster) artSettled('bug', r.id, 'high')
  artSettled('bg', `floor-${worldOf(nextLevel)}`, 'high')
  for (const id of spec.hazards) artSettled('prop', id, 'low')
  if (spec.boss) artSettled('boss', spec.boss, 'high')
}

/**
 * Every painting the game can ever ask for, as one want list.
 *
 * The three tiers above exist to keep a PLAYER's first screen cheap; this one
 * exists for the opposite reason. `tools/preview-video` records the real
 * renderer, and a painting that decodes mid-take drops the sprite bakes made
 * from the drawing and re-bakes from the paint — so the clip swaps its art
 * halfway through. The recorder holds until every probe here has settled, which
 * is a cost nothing on the player path would ever pay.
 *
 * Not gated on `artOverridesEnabled()`: the caller decides, and the recorder
 * wants to know the difference between "overrides are off" and "nothing
 * matched".
 */
export const allArtWants = (): ArtWant[] => {
  const wants: ArtWant[] = []
  for (const id of BUG_IDS) wants.push(['bug', id as BugId])
  for (const id of SHOE_IDS) wants.push(['shoe', id])
  for (const id of BOSS_IDS) wants.push(['boss', id])
  for (const id of ART_CATALOGUE.prop) wants.push(['prop', id])
  for (const id of ART_CATALOGUE.fx) wants.push(['fx', id])
  for (const id of ART_CATALOGUE.ui) wants.push(['ui', id])
  for (let w = 1; w <= WORLD_COUNT; w++) wants.push(['bg', `floor-${w}`])
  return wants
}

/** Test seam. */
export const __resetArtPreload = (): void => { startedRemaining = false }
