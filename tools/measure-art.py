#!/usr/bin/env python3
"""
Registration check: does a painted return sit where the drawing it replaces sat?

    python measure-art.py fixtures                    # sliced vs reference, all
    python measure-art.py fixtures --scale frost=1.5   # apply the runtime knobs
    python measure-art.py strips public/images/monsters  # per-frame coverage

The point of this file is that "does the art look right" is answerable by
arithmetic, and the arithmetic finds things the eye does not. Every registration
bug in the reference project was visible here first:

  * a hull sitting 18% of a frame above its own waterline (anchor was 'centre'
    when it should have been 'feet')
  * a cannon 1.65x too wide (the fit matched height only, and the painting was
    a longer, slimmer barrel)
  * two walk frames eaten to 1% coverage by a flood fill
  * an archer fixture that was silently a picture of a stone parapet

Requires Pillow. No other dependency.
"""
import argparse
import glob
import os
import statistics
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('needs Pillow:  pip install pillow')


# The alpha above which a pixel counts as the subject. Deliberately high: a
# soft glow is light, not extent, and letting a halo into the bounding box is
# how a fitted crystal ends up a quarter of the size it should be.
SOLID = 140
# Anything at or under this is background for coverage counting.
PRESENT = 16


def bbox(path, alpha=SOLID, magenta_is_bg=True):
    """(w, h, cx, cy) of the drawn content as fractions of the image, or None."""
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    px = im.load()
    mnx, mny, mxx, mxy = W, H, -1, -1
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a <= alpha:
                continue
            # A reference sheet is flooded with chroma-key magenta rather than
            # transparency, so both forms of "background" are handled here.
            if magenta_is_bg and r > 240 and g < 40 and b > 240:
                continue
            if x < mnx: mnx = x
            if x > mxx: mxx = x
            if y < mny: mny = y
            if y > mxy: mxy = y
    if mxx < 0:
        return None
    return ((mxx - mnx + 1) / W, (mxy - mny + 1) / H,
            ((mnx + mxx + 1) / 2) / W, ((mny + mxy + 1) / 2) / H)


def cmd_pairs(args):
    """Compare each sliced sprite against the reference sheet it was cut from."""
    scales = dict(kv.split('=') for kv in args.scale)
    rows = []
    for out in sorted(glob.glob(os.path.join(args.out_dir, '*.webp'))):
        ident = os.path.basename(out)[:-5]
        ref = os.path.join(args.ref_dir, f'{args.ref_prefix}{ident}.png')
        if not os.path.exists(ref):
            rows.append((ident, None, None, 'no reference'))
            continue
        r, p = bbox(ref), bbox(out)
        if not r or not p:
            rows.append((ident, None, None, 'empty'))
            continue
        k = float(scales.get(ident, 1))
        pw, ph, pcx, pcy = p[0] * k, p[1] * k, p[2], p[3]
        worst = max(pw / r[0], ph / r[1])
        off = max(abs(pcx - r[2]), abs(pcy - r[3]))
        note = ''
        if worst > 1.15: note = 'OVERSIZE'
        elif worst < 0.80: note = 'undersize'
        if off > 0.05: note = (note + ' OFF-CENTRE').strip()
        rows.append((ident, (r, (pw, ph, pcx, pcy)), worst, note))

    print(f'{"":<12} {"drawn w/h":>12}  {"painted w/h":>12}  {"centre":>13}  '
          f'{"size":>6}  note')
    for ident, pair, worst, note in rows:
        if not pair:
            print(f'{ident:<12} {"":>12}  {"":>12}  {"":>13}  {"":>6}  {note}')
            continue
        r, p = pair
        print(f'{ident:<12} {r[0]:>5.2f} {r[1]:>6.2f}  {p[0]:>5.2f} {p[1]:>6.2f}  '
              f'{p[2]:>6.2f},{p[3]:>5.2f}  {worst:>5.2f}x  {note}')
    bad = [r for r in rows if r[3]]
    print(f'\n{len(rows) - len(bad)}/{len(rows)} within tolerance'
          + (f' — check: {", ".join(r[0] for r in bad)}' if bad else ''))


def cmd_strips(args):
    """Per-frame coverage of an animation strip. Finds frames eaten by the key."""
    for f in sorted(glob.glob(os.path.join(args.dir, '*.webp'))):
        im = Image.open(f).convert('RGBA')
        W, H = im.size
        px = im.load()
        # A frame is not necessarily square: the monster frame is 156 x 176,
        # so the count is read against the panel's own aspect.
        n = args.frames or (round(W / (H * args.aspect)) if W > H * args.aspect * 1.5 else 1)
        fw = W // n
        cov = [sum(1 for y in range(0, H, 2) for x in range(i * fw, (i + 1) * fw, 2)
                   if px[x, y][3] > PRESENT) for i in range(n)]
        med = statistics.median(cov) or 1
        weak = [i for i, c in enumerate(cov) if c < med * 0.45]
        flag = f'  <-- FRAMES {weak} EATEN' if weak else ''
        print(f'{os.path.basename(f):<28} {W}x{H} n={n} '
              f'weakest {min(cov) / med:.0%} of median{flag}')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)

    p = sub.add_parser('pairs', help='sliced sprites vs their reference sheets')
    p.add_argument('out_dir', help='e.g. public/images/fixtures')
    p.add_argument('--ref-dir', default='art-sheets')
    p.add_argument('--ref-prefix', default='fixture-')
    p.add_argument('--scale', nargs='*', default=[],
                   help='runtime blit multipliers, e.g. frost=1.5 tesla=1.12')
    p.set_defaults(func=cmd_pairs)

    p = sub.add_parser('strips', help='per-frame coverage of animation strips')
    p.add_argument('dir', help='e.g. public/images/monsters')
    p.add_argument('--frames', type=int, default=0, help='override frame count')
    p.add_argument('--aspect', type=float, default=1.0,
                   help='one frame\'s width:height (monsters are 156/176 = 0.886)')
    p.set_defaults(func=cmd_strips)

    args = ap.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
