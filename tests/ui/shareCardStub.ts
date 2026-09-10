/**
 * ─── A canvas that can be read back ─────────────────────────────────────────
 *
 * jsdom has no 2D context at all — `getContext('2d')` is a "not implemented"
 * stub — so the share card cannot be rendered under test and its pixels cannot
 * be inspected. What CAN be pinned is the sequence of drawing calls, which is
 * where every contract this feature has actually lives: that the numeral is the
 * spec's stage, that the captions are the spec's translated strings and not
 * English baked into the renderer, that the crowd is capped, and that two
 * renders of one run produce the same picture.
 *
 * So: a recording context behind a `Proxy`, deliberately permissive. The card
 * draws through `paintRidge`, `paintLaneTile`, `blitBanner` and the whole
 * ink-art vocabulary underneath them, and a hand-written stub that has to list
 * every method those touch is a stub that breaks every time somebody adds a
 * `quadraticCurveTo`. The proxy answers anything, records the call, and returns
 * the one shape each family of methods is expected to return.
 */

export interface CanvasOp { m: string; a: unknown[] }

export interface StubCanvas {
  width: number
  height: number
  ops: CanvasOp[]
  getContext(): unknown
  toBlob(cb: (b: Blob | null) => void, type?: string, q?: number): void
}

const gradient = { addColorStop: (): void => {} }

const recorder = (): { ctx: CanvasRenderingContext2D; ops: CanvasOp[] } => {
  const ops: CanvasOp[] = []
  const state: Record<string, unknown> = {}
  const ctx = new Proxy(state, {
    get(t, prop) {
      if (typeof prop !== 'string') return undefined
      if (prop in t) return t[prop]
      if (prop === 'canvas') return { width: 1080, height: 1080 }
      return (...a: unknown[]) => {
        ops.push({ m: prop, a })
        // `measureText` has to answer with a width or every layout that
        // centres on it divides by undefined and draws at NaN.
        if (prop === 'measureText') return { width: String(a[0] ?? '').length * 10 }
        if (prop === 'createPattern') return { pattern: true }
        if (prop.startsWith('create')) return gradient
        if (prop === 'getImageData') return { data: new Uint8ClampedArray(4) }
        return undefined
      }
    },
    set(t, prop, value) {
      if (typeof prop === 'string') {
        t[prop] = value
        ops.push({ m: `set:${prop}`, a: [value] })
      }
      return true
    }
  }) as unknown as CanvasRenderingContext2D
  return { ctx, ops }
}

/**
 * Swap `document.createElement('canvas')` for the recorder, leaving every
 * other tag alone — the download fallback builds a real `<a>` and has to keep
 * getting one.
 *
 * @returns the canvases handed out, in creation order. The card's own is the
 *   FIRST: `drawShareCard` allocates it before anything it paints with does.
 */
export const stubCanvases = (): { made: StubCanvas[]; restore: () => void } => {
  const real = document.createElement.bind(document)
  const made: StubCanvas[] = []
  document.createElement = ((tag: string, ...rest: unknown[]) => {
    if (String(tag).toLowerCase() !== 'canvas') {
      return (real as (t: string, ...r: unknown[]) => HTMLElement)(tag, ...rest)
    }
    const rec = recorder()
    const canvas: StubCanvas = {
      width: 0,
      height: 0,
      ops: rec.ops,
      getContext: () => rec.ctx,
      toBlob: (cb, type) => cb(new Blob([new Uint8Array(8)], { type: type ?? 'image/png' }))
    }
    made.push(canvas)
    return canvas as unknown as HTMLElement
  }) as typeof document.createElement
  return { made, restore: () => { document.createElement = real } }
}

/** Every call of one method, in order. */
export const callsOf = (ops: CanvasOp[], method: string): unknown[][] =>
  ops.filter((o) => o.m === method).map((o) => o.a)

/** Every string the card printed, in order. */
export const textsOf = (ops: CanvasOp[]): string[] =>
  ops.filter((o) => o.m === 'fillText').map((o) => String(o.a[0]))

/** A comparable fingerprint of a whole render — method names and their
 *  arguments, with objects flattened. Two identical fingerprints are two
 *  identical pictures. */
export const fingerprint = (ops: CanvasOp[]): string =>
  ops.map((o) => `${o.m}(${o.a.map((v) => (typeof v === 'number' ? v.toFixed(4) : String(v))).join('|')})`).join('\n')
