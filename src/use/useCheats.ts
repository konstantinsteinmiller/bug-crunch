import { onMounted, onUnmounted, ref } from 'vue'
import { addCoins } from '@/use/useSplatProgress'
import { toggleDebug } from '@/use/useMatch'

// `cheat` stays a top-level localStorage flag — it's an explicit dev toggle
// that gates the whole keyboard-shortcut module, so we don't want it living
// inside the gameplay save blob (where a cloud restore could re-enable
// cheats on a clean device).
const storedCheat = localStorage.getItem('cheat') || 'false'
const isCheat = ref<boolean>(JSON.parse(storedCheat))

// ─── Always-on key-sequence cheat: type "cmarc" to flip debug mode. ──────
//
// Sits OUTSIDE the `useCheats` factory so it works even when the regular
// cheat module is gated off — flipping `isDebug` is itself the entry point
// to dev tooling (editor button, perf meter, etc.).
//
// Exported + idempotent so a boot-time caller (App.vue setup) can guarantee
// it installs at app start. The old module-level `installDebugUnlock()` call
// only ran when this file's side-effects were retained — but App.vue's bare
// `import useCheats` is tree-shaken in production (the default export is never
// called there), and the only other importer is the LAZY game scene, so on a
// built bundle the sequence listener wasn't attached until the player was
// already in-game (and never at all if they typed it on the menu). Calling
// the exported initialiser from executed setup code can't be tree-shaken.
let debugUnlockInstalled = false
export const installDebugUnlock = (): void => {
  if (typeof window === 'undefined' || debugUnlockInstalled) return
  debugUnlockInstalled = true
  const target = 'cmarc'
  let buf = ''
  const isTypingTarget = (el: EventTarget | null): boolean => {
    if (!(el instanceof HTMLElement)) return false
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    return el.isContentEditable
  }
  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) { buf = ''; return }
    const k = e.key.toLowerCase()
    // Non-character keys (Shift, Tab, arrow keys) don't reset the buffer
    // outright — they just don't extend it — so the cheat survives a stray
    // modifier press. Anything else of length 1 gets appended.
    if (k.length !== 1) return
    buf = (buf + k).slice(-target.length)
    if (buf === target) {
      buf = ''
      toggleDebug()
    }
  })
}
// Best-effort module-level install for dev (vite serve keeps side-effects);
// App.vue also calls installDebugUnlock() in setup so production builds — where
// this bare side-effect can be tree-shaken — still attach the listener at boot.
installDebugUnlock()

const useCheats = () => {
  if (!isCheat.value) return {}


  // Dev shortcuts — the four things a reviewer needs to see the whole game in a
  // minute: money for the Locker, the Fever they would otherwise have to earn,
  // and either end of a level.
  //
  //   Ctrl+Alt+Shift+K   +3000 coins
  //   Ctrl+Alt+Shift+F   Splat Fever, now
  //   Ctrl+Alt+Shift+N   clear this level
  //   Ctrl+Alt+Shift+R   fail this level
  //   Ctrl+Alt+Shift+<n> jump to level n — type the digits, e.g. 1 then 5 for
  //                      level 15 (see the buffer below).
  //
  // The simulation is reached through a DYNAMIC import, never a static one.
  // `useCheats` is called from `App.vue`, which is on the eager boot path — a
  // static import would drag the whole game model (the level generator, the
  // bestiary, the sprite bakers) into the entry chunk and delay first paint for
  // every player, to serve a dev-only feature that 99.99% of them never
  // trigger. Fetching it on the keypress costs a few ms exactly once, for the
  // developer.
  const withGame = (fn: (game: typeof import('@/use/useBugCrunchGame')) => void): void => {
    void import('@/use/useBugCrunchGame').then(fn).catch((e) => {
      console.warn('[CHEAT] could not load the game module', e)
    })
  }

  /**
   * Hand the live simulation to the console as `window.__run`.
   *
   * Reaching the sim from devtools with a bare `import('@/use/useBugCrunchGame')`
   * does NOT work during development: Vite serves an HMR-updated module under a
   * versioned URL, so the import resolves to a second, inert copy of the
   * singleton and every mutation lands on an object nothing is rendering. The
   * only reliable handle is one the running app publishes itself.
   *
   * Dev-only, and only after the cheat sequence has been typed.
   */
  const publishDebugHandle = (): void => {
    if (typeof window === 'undefined') return
    void import('@/use/useBugCrunchGame').then((game) => {
      ;(window as unknown as Record<string, unknown>).__run = game
      console.warn('[CHEAT] window.__run is live (inspect / drive the running sim).')
    })
  }
  publishDebugHandle()

  const cheatsMap: Record<string, () => void> = {
    'ctrl+shift+alt+k': () => {
      addCoins(3000)
      console.warn('[CHEAT] +3000 coins.')
    },
    'ctrl+shift+alt+f': () => withGame((game) => {
      game.tryFever()
      console.warn('[CHEAT] Splat Fever.')
    }),
    'ctrl+shift+alt+n': () => withGame((game) => {
      game.endLevel(true)
      console.warn('[CHEAT] Level cleared.')
    }),
    'ctrl+shift+alt+r': () => withGame((game) => {
      game.endLevel(false)
      console.warn('[CHEAT] Level failed.')
    })
  }

  const heldKeys = new Set<string>()
  const MODIFIER_KEYS = new Set(['control', 'shift', 'alt', 'meta'])

  const normalizeKey = (e: KeyboardEvent): string | null => {
    const codeMatch = e.code.match(/^Digit(\d)$/)
    if (codeMatch) return codeMatch[1]!
    const k = e.key.toLowerCase()
    return MODIFIER_KEYS.has(k) ? null : k
  }

  const buildShortcut = (e: KeyboardEvent): string => {
    const parts: string[] = []
    if (e.ctrlKey || e.metaKey) parts.push('ctrl')
    if (e.shiftKey) parts.push('shift')
    if (e.altKey) parts.push('alt')
    const sorted = [...heldKeys].sort()
    parts.push(...sorted)
    return parts.join('+')
  }

  // ─── Level jump: Ctrl+Alt+Shift and then the number ──────────────────────
  //
  // Type the digits while the three modifiers are held: `Ctrl+Alt+Shift` then
  // `1`, `5` lands on level 15. Released or left alone for a moment, it jumps.
  //
  // Deliberately a TYPED BUFFER rather than another entry in `cheatsMap`. The
  // shortcut builder sorts the keys it is holding, so a simultaneous
  // `Ctrl+Alt+Shift+1+5` and `…+5+1` are the same string — level 51 would be
  // unreachable, and holding two digits down at once to ask for a two-digit
  // number is a strange thing to make anyone do. A buffer reads digits in the
  // order they were pressed, so any level is reachable, including three-digit
  // ones, which are simply clamped onto the campaign.
  const STAGE_COMMIT_MS = 700
  let stageBuffer = ''
  let stageTimer: ReturnType<typeof setTimeout> | null = null

  const cancelStageTimer = (): void => {
    if (stageTimer === null) return
    clearTimeout(stageTimer)
    stageTimer = null
  }

  const commitStageJump = (): void => {
    cancelStageTimer()
    const typed = stageBuffer
    stageBuffer = ''
    if (typed === '') return

    const target = Number.parseInt(typed, 10)
    if (!Number.isFinite(target) || target < 1) return

    void import('@/use/useSplatProgress').then((prog) => {
      prog.setLevel(target)
      console.warn(`[CHEAT] Jumped to level ${target}. Reload or finish the level.`)
    })
  }

  /** All three modifiers down — the gesture that arms the digit buffer. */
  const stageJumpArmed = (e: KeyboardEvent): boolean =>
    (e.ctrlKey || e.metaKey) && e.altKey && e.shiftKey

  const handleKeyDown = (e: KeyboardEvent) => {
    const key = normalizeKey(e)

    // Digits under the full modifier set feed the level buffer and go no
    // further — they must not also be matched as a `cheatsMap` shortcut.
    if (key !== null && stageJumpArmed(e) && /^[0-9]$/.test(key)) {
      e.preventDefault()
      // Cap the length so a leaned-on key cannot build a number that overflows
      // into nonsense; four digits is well past the end of any real run.
      if (stageBuffer.length < 4) stageBuffer += key
      cancelStageTimer()
      stageTimer = setTimeout(commitStageJump, STAGE_COMMIT_MS)
      return
    }

    if (key) heldKeys.add(key)
    const shortcut = buildShortcut(e)
    if (cheatsMap[shortcut]) {
      e.preventDefault()
      cheatsMap[shortcut]!()
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    const key = normalizeKey(e)
    if (key) heldKeys.delete(key)

    // Letting go of the gesture commits immediately, so the jump feels like the
    // release of a chord rather than a wait. The timer above is the fallback for
    // someone who types the number and keeps holding the keys.
    const k = e.key.toLowerCase()
    if (stageBuffer !== '' && (k === 'control' || k === 'meta' || k === 'alt' || k === 'shift')) {
      commitStageJump()
    }
  }

  const handleBlur = () => {
    heldKeys.clear()
    // A half-typed number must not fire when the window comes back.
    cancelStageTimer()
    stageBuffer = ''
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown, { passive: false })
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
  })

  onUnmounted(() => {
    cancelStageTimer()
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', handleBlur)
  })

  return { isCheat }
}

export default useCheats
