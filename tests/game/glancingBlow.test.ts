// ─── A clip is not a crash ──────────────────────────────────────────────────
//
// Reported as the most frustrating way to lose a run: sweeping sideways across
// a crate or a boulder and having it delete the squad. The thumb travelled a few
// pixels too far, and there was no way to read that it was about to happen.
//
// Contact is now resolved on the SHALLOWER axis, which is the same thing as
// asking how the survivor got there:
//
//   deeper in X than in Y → they drove into its face. Running into a wall, and
//     it costs, because going through an obstacle has to be the expensive answer.
//   deeper in Y than in X → they are level with it and only just inside its
//     edge. That is clipping a corner while steering, and it costs nothing: the
//     survivor slides around and carries on.

import { describe, expect, it } from 'vitest'
import { BARRICADE_W, UNIT_R } from '@/game/survival'

const STEP_MS = 16

const fresh = async () => {
  localStorage.clear()
  const { __resetTowerState } = await import('@/use/useTowerState')
  __resetTowerState()
  return import('@/use/useSurvivalGame')
}

/**
 * Drive one ISOLATED barricade block two different ways and report the cost.
 *
 * Isolated matters, and it is the whole reason this hunts for a block rather
 * than naming one. Stage 4's wall is a PAIR: aiming at the outer edge of one
 * puts the crowd squarely into the face of the other, so "clipping an edge"
 * measures a head-on collision with its neighbour and the test learns nothing.
 * A block with clear road beside it is the only shape that can answer the
 * question.
 *
 * The block is pinned unbreakable for the whole approach, which is what makes
 * this a test of the contact rule rather than of how fast a squad demolishes
 * things. Only losses booked while the crowd is level with it are counted, so
 * nothing else on the road can be mistaken for it.
 *
 * @param aim `face` steers at the block's centre; `edge` rides alongside and
 *   crosses only its outer edge once level with it.
 */
const driveInto = async (aim: 'face' | 'edge') => {
  const game = await fresh()
  // The opening three stages carry no barricades at all now — a beginner cannot
  // lose a run to scenery they have not been taught to read (see
  // `earlyObstacleKeep`) — so this starts where hard obstacles are introduced.
  game.startStage(4)
  game.debugAddUnits(70)

  let picked: number | null = null
  let lost = 0
  let contactFrames = 0

  for (let i = 0; i < 9000; i++) {
    const a = game.anchor()
    const blocks = game.getBarricades().filter((b) => !b.dead && b.y > a.y - 2)
    // Clear road on at least one side, wider than the crowd that has to fit
    // through it.
    const room = game.crowdRadius() + BARRICADE_W
    const block = blocks.find((b) => blocks.every(
      (o) => o === b || Math.abs(o.y - b.y) > 2 || b.x - o.x > room
    ))

    if (block) {
      block.hp = 1e9
      block.maxHp = 1e9
      if (picked === null) picked = block.x
      const gap = block.y - a.y
      game.steerTo(
        aim === 'face'
          ? block.x
          // The crowd's near edge inside the block's edge, its body outside.
          : block.x - (BARRICADE_W / 2 + game.crowdRadius())
      )
      if (Math.abs(gap) < 2.5) {
        contactFrames++
        const before = game.deathBreakdown().barricade
        game.step(STEP_MS)
        lost += game.deathBreakdown().barricade - before
        if (game.phase.value !== 'run') break
        continue
      }
      if (gap < -3) break
    }
    game.step(STEP_MS)
    if (game.phase.value !== 'run') break
  }

  return { found: picked !== null, contactFrames, lost, squad: game.squadCount.value }
}

describe('sweeping into an obstacle from the side', () => {
  it('costs nothing, where driving into its face costs plenty', async () => {
    const face = await driveInto('face')
    const edge = await driveInto('edge')

    expect(face.found && edge.found, 'no isolated barricade on stage 4').toBe(true)
    expect(face.contactFrames, 'the face run never reached the block').toBeGreaterThan(5)
    expect(edge.contactFrames, 'the edge run never reached the block').toBeGreaterThan(5)

    // THE claim, in the terms the player experiences it. Measured before this
    // change the two were the same event; measured after, driving into the face
    // cost 30 survivors and ENDED the run, while clipping the edge cost 2 and
    // the squad carried on and grew to 61.
    //
    // Not asserted as exactly zero. The formation is a spring, so a couple of
    // survivors on the inside shoulder genuinely end up inside the block rather
    // than beside it, and pinning that to zero would buy a flaky suite in
    // exchange for a claim nobody makes. A scratch is not the complaint; losing
    // the run to a thumb-twitch was.
    // As a SHARE of the crowd, not a headcount. The absolute number scales with
    // squad size — the formation is a spring, so a wider crowd puts more
    // survivors on the inside shoulder — and a bound of "three bodies" only ever
    // meant anything for the squad size it was measured at.
    expect(edge.lost / (edge.squad + edge.lost), 'a glancing clip cost more than a scratch')
      .toBeLessThan(0.15)
    expect(edge.squad, 'the run did not survive a glancing clip').toBeGreaterThan(0)

    // …and the other half, so an obstacle that quietly stopped mattering at all
    // fails this just as loudly as the frustration it replaced.
    expect(face.lost, 'driving into a barricade stopped costing anything')
      .toBeGreaterThan(edge.lost * 3)
  })

  it('carries the squad past the obstacle rather than stopping it', async () => {
    const edge = await driveInto('edge')
    expect(edge.squad, 'the squad did not survive its own steering').toBeGreaterThan(0)
  })
})
