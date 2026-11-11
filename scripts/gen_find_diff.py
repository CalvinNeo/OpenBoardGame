#!/usr/bin/env python3
"""Asset pipeline for the Spot the Difference game (game id: find_diff).

The pipeline turns each scene in find_diff_scenes.py into one playable level:

  base     generate the photorealistic base photo (image A)
  propose  ask the vision model for candidate objects with rough boxes
  build    cut each object out, apply five masked edits, emit image B plus the
           exact ground-truth boxes
  verify   re-check every finished level and report anything suspicious

Only four edit kinds are used - flip, recolor, scale and duplicate - because all
four composite cleanly through an object alpha mask and need no background
inpainting. That keeps image B pixel-identical to image A everywhere outside the
five edited objects, which is what makes the ground truth exact.

Usage:
  python3 scripts/gen_find_diff.py base
  python3 scripts/gen_find_diff.py propose
  python3 scripts/gen_find_diff.py build [--only ID] [--force]
  python3 scripts/gen_find_diff.py verify
  python3 scripts/gen_find_diff.py all
"""

import argparse
import json
import subprocess
import sys
import time
from collections import deque
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / ".find_diff"
WORK_DIR = OUT_DIR / "work"
MASK_DIR = WORK_DIR / "mask"
MANIFEST = OUT_DIR / "manifest.json"

sys.path.insert(0, str(ROOT / "scripts"))
from find_diff_scenes import SCENES, build_prompt  # noqa: E402

FINAL_SIZE = (1600, 1200)
DIFFS_PER_LEVEL = 5
JPEG_QUALITY = 92

# Selection limits, expressed as a fraction of the whole frame.
MIN_OBJ_AREA = 0.004
MAX_OBJ_AREA = 0.085
MIN_SEPARATION = 0.105
MIN_DIFF_PIXELS = 0.0007
MAX_DIFF_PIXELS = 0.055
MIN_VISIBLE_DIFF = 20.0


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def run_json(cmd: List[str]) -> Dict:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"command failed: {' '.join(cmd[:3])}...\n{proc.stdout}\n{proc.stderr}")
    return json.loads(proc.stdout)


def connector_call(tool: str, args: Dict) -> Dict:
    return run_json([
        "mcode-tools", "connector", "call", tool, "--args", json.dumps(args, ensure_ascii=False),
    ])


def upload(path: Path) -> str:
    return run_json(["mcode-tools", "upload_temp_url", str(path)])["temp_url"]


def download(node_id: str, dest: Path) -> None:
    url = run_json(["mcode-tools", "get_asset_url", node_id])["download_url"]
    subprocess.run(["curl", "-sL", url, "-o", str(dest)], check=True)


# --------------------------------------------------------------------------
# image helpers
# --------------------------------------------------------------------------

def to_array(img: Image.Image) -> np.ndarray:
    return np.asarray(img.convert("RGB")).astype(np.float32)


def edge_energy(gray: np.ndarray) -> np.ndarray:
    gx = np.zeros_like(gray)
    gy = np.zeros_like(gray)
    gx[:, 1:-1] = gray[:, 2:] - gray[:, :-2]
    gy[1:-1, :] = gray[2:, :] - gray[:-2, :]
    return np.sqrt(gx * gx + gy * gy)


def label_components(mask: np.ndarray) -> Tuple[np.ndarray, int]:
    """8-connected labelling, returns (labels, count)."""
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    count = 0
    for y in range(h):
        row = mask[y]
        if not row.any():
            continue
        for x in np.nonzero(row)[0]:
            if labels[y, x]:
                continue
            count += 1
            q = deque([(y, x)])
            labels[y, x] = count
            while q:
                cy, cx = q.popleft()
                for ny in (cy - 1, cy, cy + 1):
                    if ny < 0 or ny >= h:
                        continue
                    for nx in (cx - 1, cx, cx + 1):
                        if nx < 0 or nx >= w:
                            continue
                        if mask[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = count
                            q.append((ny, nx))
    return labels, count


def erode(mask: np.ndarray, radius: int) -> np.ndarray:
    out = mask.copy()
    h, w = mask.shape
    for dy in range(-radius, radius + 1):
        ys = slice(max(0, dy), h + min(0, dy))
        yt = slice(max(0, -dy), h + min(0, -dy))
        for dx in range(-radius, radius + 1):
            xs = slice(max(0, dx), w + min(0, dx))
            xt = slice(max(0, -dx), w + min(0, -dx))
            out[ys, xs] &= mask[yt, xt]
    return out


def bbox_of(mask: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    ys, xs = np.nonzero(mask)
    if not len(ys):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def rgb_to_hsv(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    diff = mx - mn
    hue = np.zeros_like(mx)
    safe = diff > 1e-6
    with np.errstate(invalid="ignore", divide="ignore"):
        hr = np.where(safe & (mx == r), ((g - b) / np.maximum(diff, 1e-6)) % 6, 0)
        hg = np.where(safe & (mx == g), ((b - r) / np.maximum(diff, 1e-6)) + 2, 0)
        hb = np.where(safe & (mx == b), ((r - g) / np.maximum(diff, 1e-6)) + 4, 0)
    hue = np.where(safe, (hr + hg + hb) / 6.0 % 1.0, 0.0)
    sat = np.where(mx > 1e-6, diff / np.maximum(mx, 1e-6), 0.0)
    return np.stack([hue, sat, mx], axis=-1)


def hsv_to_rgb(hsv: np.ndarray) -> np.ndarray:
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    i = np.floor(h * 6.0).astype(np.int32) % 6
    f = h * 6.0 - np.floor(h * 6.0)
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    out = np.zeros(hsv.shape, np.float32)
    for idx, (r, g, b) in enumerate([
        (v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q),
    ]):
        sel = i == idx
        out[..., 0] = np.where(sel, r, out[..., 0])
        out[..., 1] = np.where(sel, g, out[..., 1])
        out[..., 2] = np.where(sel, b, out[..., 2])
    return np.clip(out, 0, 1) * 255.0


# --------------------------------------------------------------------------
# stage: base
# --------------------------------------------------------------------------

def stage_base(only: Optional[str] = None, force: bool = False) -> None:
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    scenes = [s for s in SCENES if not only or s["id"] == only]
    for scene in scenes:
        dest = WORK_DIR / f"{scene['id']}_base.png"
        if dest.exists() and not force:
            log(f"base {scene['id']}: cached")
            continue
        log(f"base {scene['id']}: generating")
        res = connector_call("connector__matrix__generate_image", {
            "requests": [{
                "prompt": build_prompt(scene),
                "aspect_ratio": "4:3",
                "area": "2K",
                "output_format": "png",
                "output_file": f"{scene['id']}_base",
            }]
        })
        items = res.get("success_items") or []
        if not items:
            raise RuntimeError(f"base {scene['id']} failed: {res}")
        download(items[0]["node_id"], dest)
        log(f"base {scene['id']}: {Image.open(dest).size}")


# --------------------------------------------------------------------------
# stage: propose
# --------------------------------------------------------------------------

PROPOSE_PROMPT = (
    "List the distinct, clearly separated physical objects in this photo that would work well as "
    "'spot the difference' targets. For each, give a rough bounding box in normalized coordinates "
    "0-1000 (x0,y0 top-left, x1,y1 bottom-right) that fully contains the object with a little margin. "
    "Return ONLY a JSON array, no prose, with fields: name (short english), box [x0,y0,x1,y1], "
    "and note (one of: colorable, duplicable, flippable, scalable). "
    "Give 14 items, ordered by how visually distinct and well separated the object is."
)


def parse_proposals(text: str) -> List[Dict]:
    start = text.find("[")
    end = text.rfind("]")
    if start < 0 or end < 0:
        return []
    try:
        raw = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return []
    out = []
    for item in raw:
        box = item.get("box")
        if not (isinstance(box, list) and len(box) == 4):
            continue
        try:
            x0, y0, x1, y1 = [float(v) for v in box]
        except (TypeError, ValueError):
            continue
        if x1 <= x0 or y1 <= y0:
            continue
        out.append({
            "name": str(item.get("name", "object"))[:40],
            "box": [x0 / 1000.0, y0 / 1000.0, x1 / 1000.0, y1 / 1000.0],
            "note": str(item.get("note", ""))[:20],
        })
    return out


def stage_propose(only: Optional[str] = None, force: bool = False) -> None:
    MASK_DIR.mkdir(parents=True, exist_ok=True)
    scenes = [s for s in SCENES if not only or s["id"] == only]
    for scene in scenes:
        dest = WORK_DIR / f"{scene['id']}_objects.json"
        base = WORK_DIR / f"{scene['id']}_base.png"
        if not base.exists():
            log(f"propose {scene['id']}: no base, skip")
            continue
        if dest.exists() and not force:
            log(f"propose {scene['id']}: cached")
            continue
        log(f"propose {scene['id']}: asking vision")
        url = upload(base)
        res = connector_call("connector__matrix__describe_images", {
            "image_info": [{"url": url, "prompt": PROPOSE_PROMPT}]
        })
        text = ""
        for item in res.get("results", []):
            if item.get("success"):
                text = item.get("description", "")
                break
        items = parse_proposals(text)
        if len(items) < 6:
            raise RuntimeError(f"propose {scene['id']}: only {len(items)} usable boxes")
        dest.write_text(json.dumps(items, ensure_ascii=False, indent=2))
        log(f"propose {scene['id']}: {len(items)} candidates")


# --------------------------------------------------------------------------
# stage: build
# --------------------------------------------------------------------------

RECOLOR_HUES = [0.02, 0.12, 0.33, 0.58, 0.75]


def expand_box(box_norm: List[float], w: int, h: int, margin: float = 0.18) -> Tuple[int, int, int, int]:
    x0, y0, x1, y1 = box_norm
    px0, py0, px1, py1 = x0 * w, y0 * h, x1 * w, y1 * h
    bw, bh = px1 - px0, py1 - py0
    px0 -= bw * margin
    px1 += bw * margin
    py0 -= bh * margin
    py1 += bh * margin
    px0 = max(0, int(round(px0)))
    py0 = max(0, int(round(py0)))
    px1 = min(w, int(round(px1)))
    py1 = min(h, int(round(py1)))
    return px0, py0, px1, py1


def extract_mask(scene_id: str, idx: int, base: Image.Image, box_norm: List[float]):
    """Cut one object out of the base photo, retrying with a roomier crop when the
    vision box was too tight. Returns (rgba, alpha, box) or None."""
    w, h = base.size
    # The cutout model happily returns a whole cluster of touching objects, so the
    # alpha gets clipped back to the box the vision model gave for this one object.
    clip = expand_box(box_norm, w, h, 0.03)
    for margin in (0.18, 0.34, 0.5):
        box = expand_box(box_norm, w, h, margin)
        got = _extract_mask_once(scene_id, idx, base, box, clip)
        if got:
            return got[0], got[1], box
    return None


def _extract_mask_once(scene_id: str, idx: int, base: Image.Image, box, clip=None):
    crop = base.crop(box)
    tag = f"{scene_id}_{idx}_{box[0]}_{box[1]}_{box[2]}_{box[3]}"
    src = MASK_DIR / f"{tag}_src.png"
    cut_path = MASK_DIR / f"{tag}_cut.png"
    if not cut_path.exists():
        crop.save(src)
        url = upload(src)
        res = connector_call("connector__matrix__remove_image_background", {"image_url": url})
        node_id = res.get("node_id")
        if not node_id:
            return None
        download(node_id, cut_path)
    cut = Image.open(cut_path).convert("RGBA")
    if cut.size != crop.size:
        cut = cut.resize(crop.size, Image.LANCZOS)
    arr = np.asarray(cut).astype(np.float32)
    alpha = arr[:, :, 3] / 255.0
    if clip is not None:
        region = np.zeros(alpha.shape, bool)
        region[max(0, clip[1] - box[1]):max(0, clip[3] - box[1]),
               max(0, clip[0] - box[0]):max(0, clip[2] - box[0])] = True
        alpha = np.where(region, alpha, 0.0)
        arr[:, :, 3] = alpha * 255.0
    solid = alpha > 0.5
    if solid.mean() < 0.05 or solid.mean() > 0.86:
        log(f"  mask {tag}: coverage {solid.mean():.2f} out of range")
        return None
    labels, count = label_components(solid)
    if count == 0:
        log(f"  mask {tag}: empty")
        return None
    sizes = np.array([int((labels == i).sum()) for i in range(1, count + 1)])
    best = int(sizes.argmax()) + 1
    if sizes[best - 1] < 0.5 * sizes.sum():
        log(f"  mask {tag}: {count} parts, dominant {sizes[best - 1] / sizes.sum():.2f}")
        return None
    keep = labels == best
    bb = bbox_of(keep)
    if bb is None:
        log(f"  mask {tag}: no bbox")
        return None
    ch, cw = keep.shape
    touching = sum([bb[0] <= 1, bb[1] <= 1, bb[2] >= cw - 1, bb[3] >= ch - 1])
    if touching >= 2:
        log(f"  mask {tag}: clipped by crop on {touching} sides")
        return None
    bw = bb[2] - bb[0]
    bh = bb[3] - bb[1]
    fill = float(keep.sum()) / float(max(1, bw * bh))
    if fill < 0.34:
        log(f"  mask {tag}: sprawling cutout, fill {fill:.2f}")
        return None
    radius = max(2, int(round(0.05 * min(bw, bh))))
    core = erode(keep, radius)
    if core.sum() > 200:
        core_labels, core_count = label_components(core)
        core_sizes = np.array([int((core_labels == i).sum()) for i in range(1, core_count + 1)])
        if core_sizes.max() < 0.72 * core_sizes.sum():
            log(f"  mask {tag}: splits into {core_count} parts when eroded")
            return None
    alpha = np.where(keep, alpha, 0.0)
    rgba = arr.copy()
    rgba[:, :, 3] = alpha * 255.0
    return Image.fromarray(rgba.astype(np.uint8), "RGBA"), alpha


def object_stats(rgba: Image.Image, alpha: np.ndarray) -> Dict[str, float]:
    arr = np.asarray(rgba).astype(np.float32)
    rgb = arr[:, :, :3] / 255.0
    sel = alpha > 0.5
    hsv = rgb_to_hsv(rgb)
    sat = float(hsv[:, :, 1][sel].mean()) if sel.any() else 0.0
    mirrored = rgb[:, ::-1, :]
    mirrored_sel = sel[:, ::-1]
    both = sel & mirrored_sel
    if both.sum() > 40:
        asym = float(np.abs(rgb - mirrored)[both].mean() * 255.0)
    else:
        asym = 0.0
    return {"sat": sat, "asym": asym}


def circular_hue(hsv: np.ndarray, sel: np.ndarray) -> float:
    if not sel.any():
        return 0.0
    ang = hsv[:, :, 0][sel] * 2 * np.pi
    wgt = hsv[:, :, 1][sel]
    x = float((np.cos(ang) * wgt).sum())
    y = float((np.sin(ang) * wgt).sum())
    if abs(x) < 1e-6 and abs(y) < 1e-6:
        return 0.0
    return (np.arctan2(y, x) / (2 * np.pi)) % 1.0


def hue_gap(a: float, b: float) -> float:
    return min(abs(a - b), 1 - abs(a - b))


def recolor_patch(rgba: Image.Image, alpha: np.ndarray, used_hues: List[float]) -> Tuple[Image.Image, float]:
    arr = np.asarray(rgba).astype(np.float32)
    rgb = arr[:, :, :3] / 255.0
    hsv = rgb_to_hsv(rgb)
    sel = alpha > 0.5
    cur = circular_hue(hsv, sel)
    fresh = [h for h in RECOLOR_HUES if all(hue_gap(h, u) > 0.12 for u in used_hues)]
    pool = fresh or RECOLOR_HUES
    target = max(pool, key=lambda h: hue_gap(h, cur))
    new = hsv.copy()
    new[:, :, 0] = target
    new[:, :, 1] = np.clip(hsv[:, :, 1] * 1.45 + 0.32, 0.4, 0.95)
    out = hsv_to_rgb(new)
    arr[:, :, :3] = np.where(sel[:, :, None], out, arr[:, :, :3])
    return Image.fromarray(arr.astype(np.uint8), "RGBA"), target


def find_duplicate_spot(
    base_arr: np.ndarray,
    edges: np.ndarray,
    obj_box: Tuple[int, int, int, int],
    alpha_local: np.ndarray,
    occupied: List[Tuple[int, int, int, int]],
) -> Optional[Tuple[int, int]]:
    h, w = base_arr.shape[:2]
    x0, y0, x1, y1 = obj_box
    ow, oh = x1 - x0, y1 - y0
    inside = alpha_local > 0.5
    if inside.shape != (oh, ow):
        return None
    bg = base_arr[y0:y1, x0:x1][~inside]
    if bg.size < 30:
        return None
    src_mean = bg.mean(axis=0)
    src_edge = float(edges[y0:y1, x0:x1][~inside].mean())
    best = None
    best_score = 1e9
    for gap in (1.15, 1.35, 1.6):
        for dx, dy in ((ow * gap, 0), (-ow * gap, 0), (0, oh * gap), (0, -oh * gap),
                       (ow * gap, oh * gap), (-ow * gap, oh * gap)):
            nx0 = int(round(x0 + dx))
            ny0 = int(round(y0 + dy))
            nx1, ny1 = nx0 + ow, ny0 + oh
            if nx0 < 8 or ny0 < 8 or nx1 > w - 8 or ny1 > h - 8:
                continue
            rect = (nx0, ny0, nx1, ny1)
            if any(overlaps(rect, o, pad=14) for o in occupied):
                continue
            if overlaps(rect, obj_box, pad=6):
                continue
            tgt = base_arr[ny0:ny1, nx0:nx1, :]
            tgt_edge = float(edges[ny0:ny1, nx0:nx1].mean())
            if tgt_edge > src_edge * 1.25 + 4:
                continue
            dist = float(np.linalg.norm(tgt.reshape(-1, 3).mean(axis=0) - src_mean))
            score = dist + max(0.0, tgt_edge - src_edge) * 2.5
            if score < best_score:
                best_score = score
                best = (nx0, ny0)
    if best is None or best_score > 55:
        return None
    return best


def overlaps(a: Tuple[int, int, int, int], b: Tuple[int, int, int, int], pad: int = 0) -> bool:
    return not (
        a[2] + pad <= b[0] or b[2] + pad <= a[0] or a[3] + pad <= b[1] or b[3] + pad <= a[1]
    )


def place(base: Image.Image, patch: Image.Image, pos: Tuple[int, int]) -> Tuple[Image.Image, np.ndarray]:
    """Alpha-composite patch at pos; returns new image and the placed alpha footprint."""
    out = base.copy()
    out.paste(patch, pos, patch)
    a = np.asarray(patch)[:, :, 3].astype(np.float32) / 255.0
    return out, a


def measure(before: np.ndarray, after: np.ndarray, footprint: np.ndarray, pos: Tuple[int, int]) -> Dict:
    h, w = before.shape[:2]
    x, y = pos
    ph, pw = footprint.shape
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(w, x + pw), min(h, y + ph)
    if x1 <= x0 or y1 <= y0:
        return {"area": 0, "mean": 0.0}
    sub_a = before[y0:y1, x0:x1]
    sub_b = after[y0:y1, x0:x1]
    fp = footprint[y0 - y:y1 - y, x0 - x:x1 - x]
    sel = fp > 0.35
    if not sel.any():
        return {"area": 0, "mean": 0.0}
    diff = np.abs(sub_a - sub_b).max(axis=2)
    changed = sel & (diff > 8)
    return {
        "area": int(changed.sum()),
        "mean": float(diff[sel].mean()),
        "box": (x0, y0, x1, y1),
    }


def build_level(scene: Dict[str, str], force: bool = False) -> Optional[Dict]:
    scene_id = scene["id"]
    base_path = WORK_DIR / f"{scene_id}_base.png"
    obj_path = WORK_DIR / f"{scene_id}_objects.json"
    if not base_path.exists() or not obj_path.exists():
        log(f"build {scene_id}: missing base or proposals")
        return None
    base = Image.open(base_path).convert("RGB")
    w, h = base.size
    base_arr = to_array(base)
    edges = edge_energy(base_arr.mean(axis=2))
    proposals = json.loads(obj_path.read_text())

    ranked = []
    for p in proposals:
        x0, y0, x1, y1 = p["box"]
        area = (x1 - x0) * (y1 - y0)
        if area < MIN_OBJ_AREA or area > MAX_OBJ_AREA:
            continue
        ranked.append((abs(area - 0.02), p))
    ranked.sort(key=lambda t: t[0])
    ranked = [p for _, p in ranked][:12]
    if len(ranked) < DIFFS_PER_LEVEL:
        log(f"build {scene_id}: only {len(ranked)} size-valid candidates")
        return None

    candidates = []
    for i, prop in enumerate(ranked):
        got = extract_mask(scene_id, i, base, prop["box"])
        if not got:
            continue
        rgba, alpha, box = got
        bb = bbox_of(alpha > 0.5)
        if bb is None:
            continue
        obj_box = (box[0] + bb[0], box[1] + bb[1], box[0] + bb[2], box[1] + bb[3])
        frac = (obj_box[2] - obj_box[0]) * (obj_box[3] - obj_box[1]) / float(w * h)
        if frac < MIN_OBJ_AREA * 0.6 or frac > MAX_OBJ_AREA:
            continue
        stats = object_stats(rgba, alpha)
        alpha_local = alpha[bb[1]:bb[3], bb[0]:bb[2]]
        rgba_local = rgba.crop(bb)
        candidates.append({
            "name": prop["name"],
            "note": prop["note"],
            "box": obj_box,
            "rgba": rgba_local,
            "alpha": alpha_local,
            "stats": stats,
        })
        if len(candidates) >= 9:
            break
    if len(candidates) < DIFFS_PER_LEVEL:
        log(f"build {scene_id}: only {len(candidates)} usable cutouts")
        return None

    # choose five well separated objects
    chosen: List[Dict] = []
    for cand in sorted(candidates, key=lambda c: abs(
        (c["box"][2] - c["box"][0]) * (c["box"][3] - c["box"][1]) / float(w * h) - 0.018
    )):
        if any(overlaps(cand["box"], c["box"], pad=int(0.010 * w)) for c in chosen):
            continue
        cx = (cand["box"][0] + cand["box"][2]) / 2.0
        cy = (cand["box"][1] + cand["box"][3]) / 2.0
        too_close = False
        for c in chosen:
            ox = (c["box"][0] + c["box"][2]) / 2.0
            oy = (c["box"][1] + c["box"][3]) / 2.0
            if ((cx - ox) ** 2 + (cy - oy) ** 2) ** 0.5 < MIN_SEPARATION * w:
                too_close = True
                break
        if too_close:
            continue
        chosen.append(cand)
        if len(chosen) == DIFFS_PER_LEVEL:
            break
    if len(chosen) < DIFFS_PER_LEVEL:
        log(f"build {scene_id}: could not separate {DIFFS_PER_LEVEL} objects")
        return None

    slot_ops = ["duplicate", "recolor", "flip", "scale", "recolor"]
    fallbacks = {
        "duplicate": ["scale", "recolor", "flip"],
        "recolor": ["flip", "scale", "duplicate"],
        "flip": ["recolor", "scale", "duplicate"],
        "scale": ["recolor", "flip", "duplicate"],
    }

    result = base.copy()
    occupied = [c["box"] for c in chosen]
    diffs: List[Dict] = []
    used_ops: List[str] = []
    used_hues: List[float] = []

    for slot, cand in enumerate(chosen):
        wanted = [slot_ops[slot]] + fallbacks[slot_ops[slot]]
        if used_ops.count("recolor") >= 2 and "recolor" in wanted:
            wanted = [op for op in wanted if op != "recolor"] + ["recolor"]
        if cand["note"] == "duplicable" and "duplicate" not in wanted:
            wanted = ["duplicate"] + wanted
        placed = None
        for op in wanted:
            attempt = try_op(op, cand, base, result, base_arr, edges, occupied, w, h, used_hues)
            if attempt:
                placed = attempt
                break
        if not placed:
            log(f"build {scene_id}: no valid op for {cand['name']}")
            return None
        placed_box = placed[4]
        if len(placed) > 5:
            used_hues.append(placed[5])
        result, footprint, pos, kind = placed[0], placed[1], placed[2], placed[3]
        occupied.append(placed_box)
        stats = measure(base_arr, to_array(result), footprint, pos)
        if stats["area"] < MIN_DIFF_PIXELS * w * h or stats["mean"] < MIN_VISIBLE_DIFF:
            log(f"build {scene_id}: {cand['name']} {kind} too subtle "
                f"(area={stats['area']} mean={stats['mean']:.1f})")
            return None
        bx0, by0, bx1, by1 = stats["box"]
        diffs.append({
            "name": cand["name"],
            "kind": kind,
            "box": [
                round(bx0 / w, 5), round(by0 / h, 5), round(bx1 / w, 5), round(by1 / h, 5),
            ],
        })
        used_ops.append(kind)
        log(f"build {scene_id}: {cand['name']} -> {kind} area={stats['area']} mean={stats['mean']:.1f}")

    a_img = base.resize(FINAL_SIZE, Image.LANCZOS)
    b_img = result.resize(FINAL_SIZE, Image.LANCZOS)
    a_img.save(OUT_DIR / f"{scene_id}_a.jpg", quality=JPEG_QUALITY, subsampling=0)
    b_img.save(OUT_DIR / f"{scene_id}_b.jpg", quality=JPEG_QUALITY, subsampling=0)
    preview = Image.new("RGB", (FINAL_SIZE[0], FINAL_SIZE[1] * 2 + 8), (18, 18, 18))
    preview.paste(a_img, (0, 0))
    preview.paste(b_img, (0, FINAL_SIZE[1] + 8))
    preview.resize((FINAL_SIZE[0] // 2, (FINAL_SIZE[1] * 2 + 8) // 2), Image.LANCZOS).save(
        WORK_DIR / f"{scene_id}_preview.jpg", quality=88
    )
    return {
        "id": scene_id,
        "title": scene["title"],
        "a": f"{scene_id}_a.jpg",
        "b": f"{scene_id}_b.jpg",
        "diffs": diffs,
        "ops": used_ops,
    }


def try_op(op, cand, base, current, base_arr, edges, occupied, w, h, used_hues):
    rgba = cand["rgba"]
    alpha = cand["alpha"]
    box = cand["box"]
    ow, oh = box[2] - box[0], box[3] - box[1]

    if op == "flip":
        if cand["stats"]["asym"] < 16:
            return None
        patch = rgba.transpose(Image.FLIP_LEFT_RIGHT)
        pos = (box[0], box[1])
        out, fp = place(current, patch, pos)
        return out, fp, pos, "flip", box

    if op == "recolor":
        patch, hue = recolor_patch(rgba, alpha, used_hues)
        pos = (box[0], box[1])
        out, fp = place(current, patch, pos)
        return out, fp, pos, "recolor", box, hue

    if op == "scale":
        factor = 1.24
        nw, nh = int(ow * factor), int(oh * factor)
        if nw < 8 or nh < 8:
            return None
        patch = rgba.resize((nw, nh), Image.LANCZOS)
        cx = (box[0] + box[2]) / 2.0
        cy = (box[1] + box[3]) / 2.0
        pos = (int(round(cx - nw / 2)), int(round(cy - nh / 2)))
        if pos[0] < 0 or pos[1] < 0 or pos[0] + nw > w or pos[1] + nh > h:
            return None
        new_box = (pos[0], pos[1], pos[0] + nw, pos[1] + nh)
        if any(overlaps(new_box, o, pad=6) for o in occupied if o != box):
            return None
        out, fp = place(current, patch, pos)
        return out, fp, pos, "scale", new_box

    if op == "duplicate":
        spot = find_duplicate_spot(base_arr, edges, box, alpha, occupied)
        if not spot:
            return None
        pos = spot
        new_box = (pos[0], pos[1], pos[0] + ow, pos[1] + oh)
        out, fp = place(current, rgba, pos)
        return out, fp, pos, "duplicate", new_box

    return None


def load_manifest() -> Dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"version": 1, "size": list(FINAL_SIZE), "levels": []}


def save_manifest(data: Dict) -> None:
    data["levels"].sort(key=lambda lv: [s["id"] for s in SCENES].index(lv["id"]))
    MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def stage_build(only: Optional[str] = None, force: bool = False) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    done = {lv["id"] for lv in manifest["levels"]}
    scenes = [s for s in SCENES if not only or s["id"] == only]
    for scene in scenes:
        if scene["id"] in done and not force:
            log(f"build {scene['id']}: already in manifest")
            continue
        try:
            level = build_level(scene, force=force)
        except Exception as exc:  # keep going, report at the end
            log(f"build {scene['id']}: FAILED {exc}")
            continue
        if not level:
            continue
        manifest["levels"] = [lv for lv in manifest["levels"] if lv["id"] != scene["id"]]
        manifest["levels"].append(level)
        save_manifest(manifest)
        log(f"build {scene['id']}: OK ({len(level['diffs'])} diffs, ops={level['ops']})")
    log(f"manifest now has {len(manifest['levels'])} levels")


# --------------------------------------------------------------------------
# stage: verify
# --------------------------------------------------------------------------

def stage_verify() -> None:
    manifest = load_manifest()
    levels = manifest.get("levels", [])
    log(f"verifying {len(levels)} levels")
    bad = 0
    for lv in levels:
        a_path = OUT_DIR / lv["a"]
        b_path = OUT_DIR / lv["b"]
        problems = []
        if not a_path.exists() or not b_path.exists():
            problems.append("missing image file")
        else:
            a = to_array(Image.open(a_path))
            b = to_array(Image.open(b_path))
            if a.shape != b.shape:
                problems.append(f"size mismatch {a.shape} vs {b.shape}")
            else:
                diff = np.abs(a - b).max(axis=2)
                mask = diff > 26
                labels, count = label_components(mask)
                sizes = np.array([int((labels == i).sum()) for i in range(1, count + 1)])
                thresh = MIN_DIFF_PIXELS * a.shape[0] * a.shape[1]
                big = int((sizes > thresh).sum()) if count else 0
                if big != len(lv["diffs"]):
                    problems.append(f"{big} visible regions, expected {len(lv['diffs'])}")
                for d in lv["diffs"]:
                    x0, y0, x1, y1 = d["box"]
                    sub = mask[int(y0 * a.shape[0]):int(y1 * a.shape[0]),
                               int(x0 * a.shape[1]):int(x1 * a.shape[1])]
                    if sub.size == 0 or sub.mean() < 0.05:
                        problems.append(f"diff {d['name']} barely changed")
        if problems:
            bad += 1
            log(f"  FAIL {lv['id']}: {'; '.join(problems)}")
        else:
            log(f"  ok   {lv['id']} ({len(lv['diffs'])} diffs, ops={lv.get('ops')})")
    log(f"verify done: {len(levels) - bad} ok, {bad} bad")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["base", "propose", "build", "verify", "all"])
    ap.add_argument("--only", default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    MASK_DIR.mkdir(parents=True, exist_ok=True)
    if args.stage in ("base", "all"):
        stage_base(args.only, args.force)
    if args.stage in ("propose", "all"):
        stage_propose(args.only, args.force)
    if args.stage in ("build", "all"):
        stage_build(args.only, args.force)
    if args.stage in ("verify", "all"):
        stage_verify()


if __name__ == "__main__":
    main()
