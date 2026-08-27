#!/usr/bin/env python3
"""
tools/slice-sprites.py — Turn a flat sprite-sheet image into game-ready frames.

The art arrives as a single flattened picture: a grid of poses on white paper,
with captions and rule lines drawn between them. This script cuts that into one
transparent PNG per pose, plus a portrait and a bust for the card art.

    python3 tools/slice-sprites.py

Adding a character means adding an entry to SHEETS below — nothing else here
changes. Run it, check the contact sheet it prints the path to, then copy the
frame table it emits into src/ui/sprites.js.

How it separates art from paper:
  * Poses are found by their saturated pixels (orange gi, blue belt), which the
    grey rules and black captions don't have.
  * Each pose is then grown out from that seed through connected dark pixels,
    which picks up the black hair the seed missed. The threshold sits below the
    rule lines' tone so a foot touching a rule doesn't drag the whole line in.
  * Captions sit close under the first row's boots — close enough that a glyph
    touching an outline lets the fill leak into the text — so each band carries
    a hard vertical clamp cutting between the boots and the caption.
  * The paper is keyed by flooding white inwards from the crop border, so white
    *inside* the character (the undershirt) stays opaque.

Every battle frame is written onto one canvas height, bottom-aligned, so the
character keeps a single scale and stands on a single ground line across poses.
`cx` records the character's torso centre so the renderer can pin it in place.
"""

from PIL import Image
import numpy as np
from collections import deque
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SHEETS = {
    'goku': {
        'sheet': 'art/goku-sheet.jpg',
        'pose':  'art/goku-pose.jpg',
        'out':   'assets/sprites/goku',
        # Vertical clamps per band: (top, bottom). The bottom cuts between the
        # boots and the caption printed under them.
        'clamp': {(90, 279): (30, 254), (379, 492): (330, 500), (617, 724): (565, 732)},
        # name -> (seed x range, band y range)
        'frames': [
            ('guard',         (326, 420),  (90, 279)),
            ('punch',         (480, 573),  (90, 279)),
            ('kick',          (665, 763),  (90, 279)),
            ('charge_a',      (822, 923),  (90, 279)),
            ('charge_b',      (983, 1086), (90, 279)),
            ('release',       (1143, 1239),(90, 279)),
            ('stagger',       (376, 434),  (379, 492)),
            ('knockback',     (571, 667),  (379, 492)),
            ('ground_impact', (801, 879),  (379, 492)),
            ('heavy_stun',    (1007, 1070),(379, 492)),
            ('falling',       (404, 488),  (617, 724)),
            ('crumpled',      (677, 728),  (617, 724)),
            ('ko',            (914, 1034), (617, 724)),
        ],
        'stand_h': 165,     # a standing pose's height, used to scale the main pose to match
        'bust_to': 395,     # crop the portrait to this row for the bust (neck is ~300)

        # Redraws that supersede poses from the main sheet. A separate image
        # can be drawn at any size: `match_frame` names the pose in it that
        # matches a main-sheet frame, `match_h` is that frame's character height
        # on the sheet, and one scale derived from the pair is applied to every
        # frame in the image. `density` stores them at that many times the pixel
        # size. Density is
        # free to vary per frame — the renderer sizes frames by CSS height and
        # anchors them by the `cx` fraction, so only the character's share of
        # the canvas has to be consistent, not the pixel count. Storing a
        # bigger redraw at 2x keeps its detail instead of throwing it away.
        'overrides': [
            {
                'image': 'art/goku-kamehameha.jpg',
                'clamp': (55, 604),
                'match_frame': 'release', 'match_h': 168,
                'density': 2,
                'replaces': ['charge', 'charge_a', 'charge_b'],
                'frames': [
                    ('charge_start', (57, 394),   (188, 587)),
                    ('charge_build', (521, 829),  (188, 587)),
                    ('release',      (964, 1302), (188, 587)),
                ],
            },
            {
                'image': 'art/goku-punch.jpg',
                'clamp': (55, 604),
                # Recoil is the upright guard stance, so it is the pose that
                # lines up with the sheet's own standing frame.
                'match_frame': 'recoil', 'match_h': 165,
                'density': 2,
                'frames': [
                    ('windup', (91, 347),   (188, 584)),
                    ('punch',  (511, 865),  (188, 584)),
                    ('recoil', (1026, 1279),(188, 584)),
                ],
            },
        ],
    },

    'saibaman': {
        'kind': 'checker',
        'sheet': 'art/saibaman-sheet.jpg',
        'pose':  'art/saibaman-pose.jpg',
        'out':   'assets/sprites/saibaman',
        # (label, frame names left-to-right, indices to drop)
        # The first figure on the IDLE band is the style reference, drawn ~13%
        # larger than the animation frames beside it. Keeping it would make the
        # idle loop pulse, so it is dropped rather than rescaled.
        'bands': [
            ('idle',   ['idle', 'idle_b', 'idle_c', 'idle_d'],                     [0]),
            ('walk',   ['walk_a', 'walk_b', 'walk_c', 'walk_d', 'walk_e', 'walk_f'], []),
            ('jump',   ['jump_a', 'jump_b', 'jump_c', 'jump_d', 'jump_e'],         []),
            ('attack', ['atk_a', 'atk_b', 'atk_c', 'atk_d', 'atk_e', 'atk_f'],     []),
            ('hurt',   ['hurt_a', 'hurt_b', 'hurt_c', 'hurt_d'],                   []),
        ],
        'bust_to': 470,
    },
}

PAD = 4
COLORS = 128          # flat cel-shaded art quantises to a small palette losslessly


# ===========================================================================
# CHECKERBOARD SHEETS
#
# A second kind of source art: poses on a transparency checkerboard that has
# been flattened into the JPEG, laid out in labelled bands (IDLE / WALK /
# ATTACK / ...). Nothing about it suits the white-paper path above — the
# background is two greys rather than white, and the layout is regular enough
# that the frames can be found rather than hand-listed.
#
# What separates art from background here:
#   * the checkerboard is pure grey (R==G==B); the character is saturated
#     green, so a saturation key does most of the work in one step
#   * the band CAPTIONS are dark navy text, which a "dark = ink" rule would
#     keep. So components are only kept when they contain enough GREEN pixels,
#     which no glyph does. The captions vanish without a single hand-tuned
#     clamp.
#   * motion arcs (the white slashes on the attack frames) are separate
#     components with barely any green, so they are merged back in by x
#     overlap with the figure they belong to.
#
# Frames are aligned to their BAND's ground line rather than to their own
# bounding box, so an airborne pose stays in the air instead of being dropped
# onto the floor by bottom-alignment.
# ===========================================================================

def _components(fg, green, min_green=40, min_area=300):
    """Connected components of `fg`, keeping only those anchored in green."""
    H, W = fg.shape
    seen = np.zeros((H, W), bool)
    out = []
    for sy in range(H):
        row = fg[sy]
        for sx in range(W):
            if not row[sx] or seen[sy, sx]:
                continue
            q = deque([(sy, sx)]); seen[sy, sx] = True
            pts = []; g = 0
            while q:
                cy, cx = q.popleft()
                pts.append((cy, cx))
                if green[cy, cx]: g += 1
                for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                    ny, nx = cy+dy, cx+dx
                    if 0 <= ny < H and 0 <= nx < W and fg[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
            if g >= min_green and len(pts) >= min_area:
                ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
                out.append({'pts': pts, 'green': g,
                            'box': (min(xs), min(ys), max(xs), max(ys))})
    return out


def _group_figures(comps, gap=12):
    """Merge components that overlap in x — a slash arc belongs to its figure."""
    comps = sorted(comps, key=lambda c: c['box'][0])
    figures = []
    for c in comps:
        x0, y0, x1, y1 = c['box']
        for f in figures:
            fx0, fy0, fx1, fy1 = f['box']
            if x0 <= fx1 + gap and x1 >= fx0 - gap:
                f['box'] = (min(fx0, x0), min(fy0, y0), max(fx1, x1), max(fy1, y1))
                f['pts'].extend(c['pts'])
                break
        else:
            figures.append({'pts': list(c['pts']), 'box': c['box']})
    return sorted(figures, key=lambda f: f['box'][0])


def slice_checker(cfg, out_dir):
    a = np.asarray(Image.open(os.path.join(ROOT, cfg['sheet'])).convert('RGB')).astype(np.int16)
    H, W, _ = a.shape
    sat = a.max(2) - a.min(2)
    lum = a.mean(2)
    fg = (sat > 26) | (lum < 105)
    green = (sat > 40) & (a[:, :, 1] > a[:, :, 0]) & (a[:, :, 1] > a[:, :, 2])

    comps = _components(fg, green)

    # Split into the sheet's horizontal bands by gaps in the row profile.
    rows = np.zeros(H, bool)
    for c in comps:
        _, y0, _, y1 = c['box']
        rows[y0:y1+1] = True
    bands = []
    y = 0
    while y < H:
        if rows[y]:
            y0 = y
            while y < H and rows[y]: y += 1
            bands.append((y0, y - 1))
        else:
            y += 1

    want = cfg['bands']
    if len(bands) != len(want):
        raise SystemExit(f'expected {len(want)} bands, found {len(bands)}: {bands}')

    frames = []          # (name, mask_pts, box, baseline)
    for (by0, by1), (label, names, skip) in zip(bands, want):
        in_band = [c for c in comps if by0 <= c['box'][1] <= by1]
        figs = _group_figures(in_band)
        for i in skip:
            figs[i] = None
        figs = [f for f in figs if f]
        if len(figs) != len(names):
            raise SystemExit(f'band {label}: expected {len(names)} figures, found {len(figs)}')
        baseline = max(f['box'][3] for f in figs)
        for name, f in zip(names, figs):
            frames.append((name, f['pts'], f['box'], baseline))

    # One canvas for every frame, measured from each band's own ground line.
    canvas_h = max(base - box[1] for _, _, box, base in frames) + PAD * 2

    meta = {}
    for name, pts, box, baseline in frames:
        x0, y0, x1, y1 = box
        w, hgt = x1 - x0 + 1, y1 - y0 + 1
        mask = np.zeros((hgt, w), bool)
        for cy, cx in pts:
            mask[cy - y0, cx - x0] = True
        rgb = a[y0:y1+1, x0:x1+1].astype(np.uint8)
        # Soften the JPEG halo: a lit edge pixel fades as it approaches grey.
        alpha = np.where(mask, 255, 0).astype(float)
        edge = mask & ~(np.roll(mask, 1, 0) & np.roll(mask, -1, 0)
                        & np.roll(mask, 1, 1) & np.roll(mask, -1, 1))
        s = (rgb.max(2).astype(int) - rgb.min(2).astype(int))
        alpha[edge] *= np.clip(s[edge] / 22.0, 0.35, 1.0)

        canvas = np.zeros((canvas_h, w + PAD*2, 4), np.uint8)
        # Feet land on the band's ground line, so an airborne pose stays airborne.
        top = canvas_h - PAD - (baseline - y0) - 1
        canvas[top:top+hgt, PAD:PAD+w, :3] = rgb
        canvas[top:top+hgt, PAD:PAD+w, 3] = alpha.astype(np.uint8)
        img = Image.fromarray(canvas, 'RGBA').quantize(colors=COLORS, method=Image.FASTOCTREE)
        img.save(os.path.join(out_dir, f'{name}.png'), optimize=True)

        # cx is the torso centre: the midpoint of the widest green run, which
        # tracks the body rather than an outflung arm or a motion arc.
        gsub = green[y0:y1+1, x0:x1+1]
        colcount = gsub.sum(0)
        heavy = np.where(colcount > colcount.max() * 0.45)[0]
        body_cx = float((heavy.min() + heavy.max()) / 2) if len(heavy) else w / 2
        meta[name] = {'w': int(w + PAD*2), 'h': int(canvas_h),
                      'cx': round((body_cx + PAD) / (w + PAD*2), 4)}
    return meta, canvas_h


def flood(ink, seed_x, band_y, clamp, H, W):
    x0, x1 = seed_x; y0, y1 = band_y
    cy0, cy1 = clamp
    wy0, wy1 = max(0, y0 - 95, cy0), min(H, y1 + 45, cy1)
    wx0, wx1 = max(0, x0 - 55), min(W, x1 + 110)
    sub = ink[wy0:wy1, wx0:wx1]
    seen = np.zeros(sub.shape, bool); q = deque()
    for yy in range(max(0, y0 - wy0), min(sub.shape[0], y1 - wy0)):
        for xx in range(max(0, x0 - wx0), min(sub.shape[1], x1 - wx0)):
            if sub[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True; q.append((yy, xx))
    while q:
        cy, cx = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
            ny, nx = cy+dy, cx+dx
            if 0 <= ny < sub.shape[0] and 0 <= nx < sub.shape[1] and sub[ny,nx] and not seen[ny,nx]:
                seen[ny,nx] = True; q.append((ny,nx))
    full = np.zeros((H, W), bool); full[wy0:wy1, wx0:wx1] = seen
    return full


def key_paper(rgb):
    """Alpha for a crop: flood white in from the border so interior white stays."""
    c = rgb.astype(int); cmn = c.min(2)
    white = cmn > 232
    h, w = white.shape
    bg = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h-1):
            if white[y,x] and not bg[y,x]: bg[y,x]=True; q.append((y,x))
    for y in range(h):
        for x in (0, w-1):
            if white[y,x] and not bg[y,x]: bg[y,x]=True; q.append((y,x))
    while q:
        cy, cx = q.popleft()
        for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny,nx = cy+dy, cx+dx
            if 0<=ny<h and 0<=nx<w and white[ny,nx] and not bg[ny,nx]:
                bg[ny,nx]=True; q.append((ny,nx))
    alpha = np.where(bg, 0, 255).astype(float)
    # Feather the JPEG halo: edge pixels lose alpha as they approach paper white.
    nb = np.zeros((h,w), bool)
    nb[1:,:] |= bg[:-1,:]; nb[:-1,:] |= bg[1:,:]
    nb[:,1:] |= bg[:,:-1]; nb[:,:-1] |= bg[:,1:]
    edge = (~bg) & nb
    alpha[edge] *= (1 - np.clip((cmn - 200)/46.0, 0, 1)[edge])
    return alpha


def slice_sheet(cfg, out_dir):
    a = np.asarray(Image.open(os.path.join(ROOT, cfg['sheet'])).convert('RGB')).astype(int)
    H, W = a.shape[:2]
    mn, mx = a.min(2), a.max(2)
    colored = ((mx - mn) > 45) & (mx > 60)
    # Line art is solid black; the sheet's rules bottom out near 138.
    ink = (mn < 130) | colored

    masks, boxes = {}, {}
    for name, sx, by in cfg['frames']:
        m = flood(ink, sx, by, cfg['clamp'][by], H, W)
        ys, xs = np.where(m)
        masks[name] = m
        boxes[name] = (xs.min(), ys.min(), xs.max()+1, ys.max()+1)

    canvas_h = max(b[3]-b[1] for b in boxes.values()) + PAD*2
    meta = {}
    for name, sx, _ in cfg['frames']:
        x0, y0, x1, y1 = boxes[name]
        rgb = a[y0:y1, x0:x1].astype(np.uint8)
        alpha = np.where(masks[name][y0:y1, x0:x1], key_paper(rgb), 0).astype(np.uint8)
        w, hgt = x1-x0, y1-y0
        canvas = np.zeros((canvas_h, w+PAD*2, 4), np.uint8)
        canvas[canvas_h-PAD-hgt:canvas_h-PAD, PAD:PAD+w, :3] = rgb
        canvas[canvas_h-PAD-hgt:canvas_h-PAD, PAD:PAD+w, 3] = alpha
        img = Image.fromarray(canvas, 'RGBA').quantize(colors=COLORS, method=Image.FASTOCTREE)
        img.save(os.path.join(out_dir, f'{name}.png'), optimize=True)
        meta[name] = {'w': int(w+PAD*2), 'h': int(canvas_h),
                      'cx': round(float(((sx[0]+sx[1])/2 - x0 + PAD) / (w+PAD*2)), 4)}
    return meta, canvas_h


def slice_overrides(cfg, out_dir, canvas_h, meta):
    """Apply redraws from separate images, at their own resolution."""
    for ov in cfg.get('overrides', []):
        path = os.path.join(ROOT, ov['image'])
        if not os.path.exists(path):
            print(f'  override skipped, missing {ov["image"]}')
            continue
        a = np.asarray(Image.open(path).convert('RGB')).astype(int)
        H, W = a.shape[:2]
        mn, mx = a.min(2), a.max(2)
        colored = ((mx - mn) > 45) & (mx > 60)
        ink = (mn < 130) | colored

        density = ov.get('density', 1)
        out_h = canvas_h * density
        pad = PAD * density

        cut = {}
        for name, sx, by in ov['frames']:
            m = flood(ink, sx, by, ov['clamp'], H, W)
            ys, xs = np.where(m)
            cut[name] = (m, xs.min(), ys.min(), xs.max()+1, ys.max()+1, sx)

        # ONE scale for the whole image, taken from the frame whose pose matches
        # a known frame on the main sheet. Scaling each frame to a fixed height
        # independently would only be right if every pose were the same height —
        # in a sequence like wind-up / mid-punch / recoil they are not, and doing
        # so silently resizes the character between frames.
        ref = ov['match_frame']
        _, _, ry0, _, ry1, _ = cut[ref]
        scale = (ov['match_h'] * density) / (ry1 - ry0)

        for name, (m, x0, y0, x1, y1, sx) in cut.items():
            rgb = a[y0:y1, x0:x1].astype(np.uint8)
            alpha = np.where(m[y0:y1, x0:x1], key_paper(rgb), 0).astype(np.uint8)
            src = Image.fromarray(np.dstack([rgb, alpha]), 'RGBA')
            nw, nh = max(1, round((x1-x0)*scale)), max(1, round((y1-y0)*scale))
            src = src.resize((nw, nh), Image.LANCZOS)

            canvas = Image.new('RGBA', (nw + pad*2, out_h), (0,0,0,0))
            canvas.paste(src, (pad, out_h - pad - nh), src)
            canvas.quantize(colors=COLORS, method=Image.FASTOCTREE).save(
                os.path.join(out_dir, f'{name}.png'), optimize=True)

            cx = (((sx[0]+sx[1])/2 - x0) * scale + pad) / (nw + pad*2)
            meta[name] = {'w': int(nw + pad*2), 'h': int(out_h), 'cx': round(float(cx), 4)}

        # A replaced name may also be a new name (a redraw of the same pose),
        # so never drop something this override just wrote.
        written = {f[0] for f in ov['frames']}
        for gone in ov.get('replaces', []):
            if gone in written:
                continue
            meta.pop(gone, None)
            stale = os.path.join(out_dir, f'{gone}.png')
            if os.path.exists(stale):
                os.remove(stale)


def slice_pose(cfg, out_dir, canvas_h, meta):
    a = np.asarray(Image.open(os.path.join(ROOT, cfg['pose'])).convert('RGB')).astype(int)
    alpha = key_paper(a.astype(np.uint8))
    if cfg.get('kind') == 'checker':
        # Same white paper, but this character is green throughout, so keying
        # on saturation as well removes the grey drop shadow the flood leaves
        # behind around the outline.
        sat = a.max(2) - a.min(2)
        alpha = np.where((sat < 18) & (a.min(2) > 205), 0, alpha)
    ys, xs = np.where(alpha > 8)
    x0, x1, y0, y1 = xs.min(), xs.max()+1, ys.min(), ys.max()+1
    rgba = np.dstack([a.astype(np.uint8), alpha.astype(np.uint8)])[y0:y1, x0:x1]
    full = Image.fromarray(rgba, 'RGBA')
    full.quantize(colors=COLORS, method=Image.FASTOCTREE).save(
        os.path.join(out_dir, 'portrait.png'), optimize=True)
    meta['portrait'] = {'w': int(x1-x0), 'h': int(y1-y0), 'cx': 0.5}

    # Battle idle: scaled so this pose stands as tall as the sheet's standing
    # poses. A checker sheet already has real idle frames, so it keeps those.
    if 'stand_h' not in cfg:
        bust_only(full, cfg, out_dir, meta)
        return
    scale = cfg['stand_h'] / (y1-y0)
    nw, nh = max(1, round((x1-x0)*scale)), max(1, round((y1-y0)*scale))
    canvas = Image.new('RGBA', (nw+PAD*2, canvas_h), (0,0,0,0))
    canvas.paste(full.resize((nw, nh), Image.LANCZOS), (PAD, canvas_h-PAD-nh))
    canvas.quantize(colors=COLORS, method=Image.FASTOCTREE).save(
        os.path.join(out_dir, 'idle.png'), optimize=True)
    meta['idle'] = {'w': int(nw+PAD*2), 'h': int(canvas_h), 'cx': 0.5}

    # Bust: head and shoulders on a square, bottom-aligned for the card art.
    bust = full.crop((0, 0, full.width, cfg['bust_to']))
    bx = np.where(np.asarray(bust)[:,:,3] > 8)[1]
    bust = bust.crop((bx.min(), 0, bx.max()+1, cfg['bust_to']))
    side = max(bust.width, bust.height)
    sq = Image.new('RGBA', (side, side), (0,0,0,0))
    sq.paste(bust, ((side-bust.width)//2, side-bust.height), bust)
    sq.quantize(colors=COLORS, method=Image.FASTOCTREE).save(
        os.path.join(out_dir, 'bust.png'), optimize=True)
    meta['bust'] = {'w': int(side), 'h': int(side), 'cx': 0.5}


def bust_only(full, cfg, out_dir, meta):
    """Card art for a character whose battle frames come from the sheet."""
    bust = full.crop((0, 0, full.width, cfg['bust_to']))
    bx = np.where(np.asarray(bust)[:, :, 3] > 8)[1]
    bust = bust.crop((bx.min(), 0, bx.max()+1, cfg['bust_to']))
    side = max(bust.width, bust.height)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(bust, ((side-bust.width)//2, side-bust.height), bust)
    sq.quantize(colors=COLORS, method=Image.FASTOCTREE).save(
        os.path.join(out_dir, 'bust.png'), optimize=True)
    meta['bust'] = {'w': int(side), 'h': int(side), 'cx': 0.5}


def main():
    for hero, cfg in SHEETS.items():
        missing = [p for p in (cfg['sheet'], cfg['pose'])
                   if not os.path.exists(os.path.join(ROOT, p))]
        if missing:
            print(f'{hero}: skipped, source art not in the repo: {", ".join(missing)}')
            continue
        out_dir = os.path.join(ROOT, cfg['out'])
        os.makedirs(out_dir, exist_ok=True)
        if cfg.get('kind') == 'checker':
            meta, canvas_h = slice_checker(cfg, out_dir)
        else:
            meta, canvas_h = slice_sheet(cfg, out_dir)
            slice_overrides(cfg, out_dir, canvas_h, meta)
        slice_pose(cfg, out_dir, canvas_h, meta)
        json.dump(meta, open(os.path.join(out_dir, 'frames.json'), 'w'), indent=2)
        total = sum(os.path.getsize(os.path.join(out_dir, f))
                    for f in os.listdir(out_dir) if f.endswith('.png'))
        print(f'{hero}: {len(meta)} frames, {total/1024:.0f} KB -> {cfg["out"]}')
        print(f'  paste into src/ui/sprites.js:')
        for name, m in meta.items():
            if name in ('portrait', 'bust'):
                continue
            print(f"    {name+':':15s}{{ src: '{cfg['out']}/{name}.png', "
                  f"w: {m['w']}, h: {m['h']}, cx: {m['cx']} }},")


if __name__ == '__main__':
    main()
