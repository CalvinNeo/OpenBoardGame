#!/usr/bin/env python3
import argparse
import json
import math
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict

import numpy as np
from PIL import Image, ImageOps


@dataclass
class TileSpec:
    row: int
    col: int
    grid: List[List[Optional[dict]]]
    row_rewards: dict


COLOR_COLUMNS = ["red", "blue", "yellow", "green"]
# Layout ratios derived from the task8 mosaic (tile size 153x192)
COL_RATIOS = [0.111, 0.32, 0.523, 0.725]
ROW_RATIOS = [0.208, 0.344, 0.479, 0.615, 0.765, 0.91]


def luminance(arr: np.ndarray) -> np.ndarray:
    return 0.2126 * arr[:, :, 0] + 0.7152 * arr[:, :, 1] + 0.0722 * arr[:, :, 2]


def smooth_1d(arr: np.ndarray, k: int = 7) -> np.ndarray:
    if k <= 1:
        return arr
    kernel = np.ones(k) / k
    return np.convolve(arr, kernel, mode="same")


def find_peaks_1d(arr: np.ndarray, min_rel: float = 0.15) -> List[int]:
    if arr.size == 0:
        return []
    maxv = float(np.max(arr))
    if maxv <= 0:
        return []
    thresh = maxv * min_rel
    peaks = []
    for i in range(1, len(arr) - 1):
        if arr[i] >= arr[i - 1] and arr[i] >= arr[i + 1] and arr[i] >= thresh:
            peaks.append(i)
    return peaks


def cluster_positions(values: List[int], dist: int = 8) -> List[int]:
    if not values:
        return []
    values = sorted(values)
    clusters = [[values[0]]]
    for v in values[1:]:
        if v - clusters[-1][-1] <= dist:
            clusters[-1].append(v)
        else:
            clusters.append([v])
    centers = [int(round(np.median(c))) for c in clusters]
    return centers


def compute_centers(tile_arr: np.ndarray, dark_thresh: float = 60.0) -> Tuple[List[int], List[int]]:
    h, w, _ = tile_arr.shape
    lum = luminance(tile_arr)
    dark = lum < dark_thresh
    # ignore top icons and bottom padding
    top_cut = max(0, int(h * 0.12))
    bottom_cut = max(0, int(h * 0.05))
    dark[:top_cut, :] = False
    if bottom_cut > 0:
        dark[h - bottom_cut :, :] = False

    counts_x = dark.sum(axis=0)
    peaks_x = find_peaks_1d(smooth_1d(counts_x, 7), min_rel=0.18)
    centers_x = cluster_positions(peaks_x, dist=8)

    # use narrow vertical bands around column centers to find row peaks
    band = np.zeros_like(dark, dtype=bool)
    for x in centers_x:
        x0 = max(0, x - 5)
        x1 = min(w, x + 6)
        band[:, x0:x1] |= dark[:, x0:x1]
    counts_y = band.sum(axis=1)
    peaks_y = find_peaks_1d(smooth_1d(counts_y, 7), min_rel=0.12)
    centers_y = cluster_positions(peaks_y, dist=8)
    return centers_x, centers_y


def nearest_centers(global_centers: List[int], count: int) -> List[int]:
    if len(global_centers) == count:
        return global_centers
    if len(global_centers) > count:
        # keep evenly spaced centers
        idxs = np.linspace(0, len(global_centers) - 1, count).round().astype(int)
        return [global_centers[i] for i in idxs]
    # fallback: interpolate within tile height
    if count == 4:
        return global_centers
    return global_centers


def sample_column_background(tile_arr: np.ndarray, centers_y: List[int], x: int) -> np.ndarray:
    h, w, _ = tile_arr.shape
    mids = []
    for i in range(len(centers_y) - 1):
        mids.append((centers_y[i] + centers_y[i + 1]) // 2)
    mids = [max(2, min(h - 3, y)) for y in mids]
    if not mids:
        mids = [h // 2]
    samples = []
    for y in mids:
        patch = tile_arr[y - 2 : y + 3, max(0, x - 1) : min(w, x + 2)]
        samples.append(patch.reshape(-1, 3))
    stacked = np.concatenate(samples, axis=0)
    return stacked.mean(axis=0)


def is_gem(color: np.ndarray) -> bool:
    r, g, b = color
    # gem is a deep purple/magenta center (red dominant, blue present, low green)
    return r > 140 and b > 70 and g < 90 and (r - g) > 50


def run_tesseract_text(img: Image.Image, psm: str) -> Optional[str]:
    with tempfile.TemporaryDirectory() as tmpdir:
        in_path = os.path.join(tmpdir, "in.png")
        out_base = os.path.join(tmpdir, "out")
        img.save(in_path)
        cmd = [
            "tesseract",
            in_path,
            out_base,
            "--psm",
            psm,
            "-c",
            "tessedit_char_whitelist=0123456789",
        ]
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            return None
        out_path = out_base + ".txt"
        if not os.path.exists(out_path):
            return None
        text = open(out_path, "r", encoding="utf-8").read().strip()
    return text


def ocr_number(patch: Image.Image, allow_multi: bool = False) -> Optional[int]:
    gray = patch.convert("L")
    gray = ImageOps.autocontrast(gray)
    text = run_tesseract_text(gray, "10")
    if not text:
        return None
    digits = re.findall(r"\d+", text)
    if not digits:
        return None
    if allow_multi and len(digits[0]) >= 2:
        try:
            return int(digits[0])
        except Exception:
            return None
    try:
        return int(digits[0][0])
    except Exception:
        return None


def detect_reward_centers(tile_arr: np.ndarray, x_min: int) -> List[Tuple[int, int]]:
    # detect teal reward circles in right margin
    r = tile_arr[:, :, 0]
    g = tile_arr[:, :, 1]
    b = tile_arr[:, :, 2]
    mask = (g > 110) & (b > 90) & (r < 140)
    ys, xs = np.where(mask)
    points = [(int(x), int(y)) for x, y in zip(xs, ys) if x >= x_min]
    if not points:
        return []
    points.sort(key=lambda p: p[1])
    clusters = []
    for x, y in points:
        if not clusters or y - clusters[-1][-1][1] > 4:
            clusters.append([(x, y)])
        else:
            clusters[-1].append((x, y))
    centers = []
    for cl in clusters:
        if len(cl) < 12:
            continue
        xs = [p[0] for p in cl]
        ys = [p[1] for p in cl]
        centers.append((int(round(sum(xs) / len(xs))), int(round(sum(ys) / len(ys)))))
    return centers


def render_svg(spec: TileSpec, out_path: str, tile_w: int, tile_h: int, centers_x: List[int], centers_y: List[int]) -> None:
    margin_right = 36
    svg_w = tile_w + margin_right
    svg_h = tile_h
    icon_colors = ["#b0473f", "#2f5578", "#b1874d", "#3c6a3f"]
    band_colors = ["#b0473f", "#2f5578", "#b1874d", "#3c6a3f"]

    band_w = int(round((centers_x[1] - centers_x[0]) * 0.8))
    band_y = max(0, centers_y[0] - 20)
    band_h = min(tile_h - band_y, centers_y[-1] + 20 - band_y)
    band_rx = max(4, band_w // 2)

    reward_x = tile_w + margin_right // 2

    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_w}" height="{svg_h}" viewBox="0 0 {svg_w} {svg_h}">')
    lines.append(f'  <rect width="{svg_w}" height="{svg_h}" fill="#f3e6d4"/>')

    # Top icons
    for i, x in enumerate(centers_x):
        lines.append(f'  <circle cx="{x}" cy="12" r="7" fill="{icon_colors[i]}"/>')

    # Column bands
    for i, x in enumerate(centers_x):
        x0 = int(round(x - band_w / 2))
        lines.append(f'  <rect x="{x0}" y="{band_y}" width="{band_w}" height="{band_h}" rx="{band_rx}" fill="{band_colors[i]}"/>')

    # Row lines and rewards
    for row_idx_str, value in spec.row_rewards.items():
        row_idx = int(row_idx_str)
        row = spec.grid[row_idx]
        present = [i for i, cell in enumerate(row) if cell is not None]
        if len(present) >= 2:
            x1 = centers_x[present[0]]
            x2 = centers_x[present[-1]]
            y = centers_y[row_idx]
            lines.append(f'  <line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="#9b7b54" stroke-width="3" stroke-linecap="round"/>')

        y = centers_y[row_idx]
        lines.append(f'  <circle cx="{reward_x}" cy="{y}" r="12" fill="#4aa7b2"/>')
        if value is not None:
            lines.append(f'  <text x="{reward_x}" y="{y}" font-size="10" text-anchor="middle" dominant-baseline="middle" fill="#fff">{value}</text>')

    # Cells
    for row_idx, row in enumerate(spec.grid):
        y = centers_y[row_idx]
        for col_idx, cell in enumerate(row):
            if cell is None:
                continue
            x = centers_x[col_idx]
            lines.append(f'  <circle cx="{x}" cy="{y}" r="12" fill="#1b0f0a" stroke="#c2a980" stroke-width="3"/>')
            if cell["type"] == "swirl":
                lines.append(f'  <circle cx="{x}" cy="{y}" r="8.5" fill="#4aa7b2"/>')
                lines.append(f'  <path d="M {x-5} {y+1} A 4.5 4.5 0 1 1 {x+3.5} {y-3}" fill="none" stroke="#bfe7ea" stroke-width="1.6"/>')
                if cell.get("value") is not None:
                    lines.append(f'  <text x="{x}" y="{y}" font-size="10" text-anchor="middle" dominant-baseline="middle" fill="#fff">{cell["value"]}</text>')
            elif cell["type"] == "gem":
                lines.append(f'  <circle cx="{x}" cy="{y}" r="8.5" fill="#8a3d8f"/>')
                lines.append(f'  <polygon points="{x},{y-6} {x+6},{y} {x},{y+6} {x-6},{y}" fill="#d98bd0"/>')

    lines.append("</svg>")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def ring_dark_count(tile_arr: np.ndarray, center_x: int, center_y: int) -> int:
    h, w, _ = tile_arr.shape
    r1, r2 = 5, 8
    if center_x - r2 < 0 or center_y - r2 < 0 or center_x + r2 >= w or center_y + r2 >= h:
        return 0
    patch = tile_arr[center_y - r2 : center_y + r2 + 1, center_x - r2 : center_x + r2 + 1]
    lum = luminance(patch)
    dark = lum < 40
    count = 0
    for dy in range(-r2, r2 + 1):
        for dx in range(-r2, r2 + 1):
            d = math.hypot(dx, dy)
            if r1 <= d <= r2 and dark[dy + r2, dx + r2]:
                count += 1
    return count


def refine_row_centers(tile_arr: np.ndarray, centers_x: List[int], approx_y: List[int]) -> List[int]:
    h, _, _ = tile_arr.shape
    refined = []
    for y0 in approx_y:
        y0 = max(8, min(h - 9, y0))
        candidates = []
        for x in centers_x:
            best_y = y0
            best_score = -1
            for y in range(y0 - 6, y0 + 7):
                if y < 8 or y > h - 9:
                    continue
                score = ring_dark_count(tile_arr, x, y)
                if score > best_score:
                    best_score = score
                    best_y = y
            candidates.append((best_score, best_y))
        ys = [y for score, y in candidates if score >= 10]
        if ys:
            refined.append(int(round(np.median(ys))))
        else:
            refined.append(y0)
    return refined


def classify_cell(tile_arr: np.ndarray, center_x: int, center_y: int, bg_color: np.ndarray) -> Optional[dict]:
    h, w, _ = tile_arr.shape
    if center_x < 2 or center_y < 2 or center_x >= w - 2 or center_y >= h - 2:
        return None
    ring_count = ring_dark_count(tile_arr, center_x, center_y)
    # very low ring score means no circle
    if ring_count < 12:
        return None
    patch = tile_arr[center_y - 2 : center_y + 3, center_x - 2 : center_x + 3]
    mean = patch.reshape(-1, 3).mean(axis=0)
    lum = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]
    if lum < 60:
        return {"type": "empty"}
    if is_gem(mean):
        return {"type": "gem"}
    # swirl with number: try OCR, with a fallback inverted pass for light digits
    r = 8
    x0, y0 = max(0, center_x - r), max(0, center_y - r)
    x1, y1 = min(w, center_x + r + 1), min(h, center_y + r + 1)
    patch_img = Image.fromarray(tile_arr[y0:y1, x0:x1])
    num = ocr_swirl_number_at(tile_arr, center_x, center_y)
    if num is not None and num >= 10:
        num = None
    return {"type": "swirl", "value": num}


def extract_swirl_patch(tile_arr: np.ndarray, center_x: int, center_y: int, r: int = 9) -> Image.Image:
    h, w, _ = tile_arr.shape
    x0, y0 = max(0, center_x - r), max(0, center_y - r)
    x1, y1 = min(w, center_x + r + 1), min(h, center_y + r + 1)
    return Image.fromarray(tile_arr[y0:y1, x0:x1])


def digit_mask(patch_img: Image.Image) -> np.ndarray:
    img = patch_img.resize((24, 24), Image.BICUBIC).convert("L")
    arr = np.array(img)
    thr = np.percentile(arr, 85)
    mask = (arr > thr).astype(np.float32)
    return mask.flatten()


def cluster_masks(masks: List[np.ndarray], threshold: float = 0.12) -> Tuple[List[int], List[np.ndarray]]:
    assignments: List[int] = []
    centroids: List[np.ndarray] = []
    counts: List[int] = []
    for m in masks:
        if not centroids:
            centroids.append(m.copy())
            counts.append(1)
            assignments.append(0)
            continue
        dists = [float(np.mean((m - c) ** 2)) for c in centroids]
        best_idx = int(np.argmin(dists))
        if dists[best_idx] <= threshold:
            assignments.append(best_idx)
            counts[best_idx] += 1
            centroids[best_idx] = centroids[best_idx] + (m - centroids[best_idx]) / counts[best_idx]
        else:
            centroids.append(m.copy())
            counts.append(1)
            assignments.append(len(centroids) - 1)
    return assignments, centroids


def export_cluster_samples(
    out_dir: str,
    swirl_patches: List[Tuple[int, int, Image.Image, Optional[int], int, int]],
    assignments: List[int],
) -> str:
    cluster_dir = os.path.join(out_dir, "digit_clusters")
    os.makedirs(cluster_dir, exist_ok=True)
    labels_path = os.path.join(cluster_dir, "cluster_labels.json")
    label_template: Dict[str, Optional[int]] = {}
    seen = set()
    for idx, cluster_id in enumerate(assignments):
        if cluster_id in seen:
            continue
        seen.add(cluster_id)
        _, _, patch, _, _, _ = swirl_patches[idx]
        patch.save(os.path.join(cluster_dir, f"cluster_{cluster_id}.png"))
        label_template[str(cluster_id)] = None
    if not os.path.exists(labels_path):
        with open(labels_path, "w", encoding="utf-8") as f:
            json.dump(label_template, f, ensure_ascii=False, indent=2)
    return labels_path


def ocr_swirl_candidates(patch: Image.Image) -> Dict[int, int]:
    counts: Dict[int, int] = {}
    for scale in (4, 6):
        base = patch.resize((patch.width * scale, patch.height * scale), Image.BICUBIC).convert("L")
        base_auto = ImageOps.autocontrast(base)
        # grayscale OCR (good for 5/6)
        text = run_tesseract_text(base_auto, "10")
        if text:
            digits = re.findall(r"\d", text)
            if digits:
                d = int(digits[0])
                counts[d] = counts.get(d, 0) + 1
        # binarized OCR (good for 2/3)
        for thr in (150, 170):
            bin_img = base_auto.point(lambda v: 255 if v > thr else 0)
            text = run_tesseract_text(bin_img, "8")
            if text:
                digits = re.findall(r"\d", text)
                if digits:
                    d = int(digits[0])
                    counts[d] = counts.get(d, 0) + 1
    return counts


def ocr_swirl_number_at(tile_arr: np.ndarray, center_x: int, center_y: int) -> Optional[int]:
    total: Dict[int, int] = {}
    for dy in (-3, -2, -1, 0, 1, 2, 3):
        patch = extract_swirl_patch(tile_arr, center_x, center_y + dy)
        counts = ocr_swirl_candidates(patch)
        for d, c in counts.items():
            total[d] = total.get(d, 0) + c
    if not total:
        return None
    best, count = max(total.items(), key=lambda kv: kv[1])
    if count < 2:
        return None
    return best


def ocr_reward_number(patch: Image.Image) -> Optional[int]:
    base = patch.resize((patch.width * 6, patch.height * 6), Image.BICUBIC).convert("L")
    base = ImageOps.autocontrast(base)
    text = run_tesseract_text(base, "7")
    if not text:
        return None
    digits = re.findall(r"\d+", text)
    if not digits:
        return None
    try:
        return int(digits[0])
    except Exception:
        return None


def process_tile(
    tile_img: Image.Image,
    centers_x: List[int],
    centers_y: List[int],
    swirl_patches: List[Tuple[int, int, Image.Image, Optional[int]]],
) -> Tuple[List[List[Optional[dict]]], dict]:
    tile_arr = np.array(tile_img)
    bg_colors = [sample_column_background(tile_arr, centers_y, x) for x in centers_x]
    grid = []
    for row_idx, y in enumerate(centers_y):
        row = []
        for col_idx, x in enumerate(centers_x):
            cell = classify_cell(tile_arr, x, y, bg_colors[col_idx])
            row.append(cell)
            if cell is not None and cell["type"] == "swirl":
                patch = extract_swirl_patch(tile_arr, x, y)
                swirl_patches.append((row_idx, col_idx, patch, cell.get("value")))
        grid.append(row)

    # row rewards in right margin
    right_min = centers_x[-1] + 12
    rewards = {}
    centers = detect_reward_centers(tile_arr, right_min)
    for cx, cy in centers:
        if cy < centers_y[1] - 6:
            continue
        # map to nearest row
        row_idx = int(np.argmin([abs(cy - y) for y in centers_y]))
        r = 8
        x0, y0 = max(0, cx - r), max(0, cy - r)
        x1, y1 = min(tile_arr.shape[1], cx + r + 1), min(tile_arr.shape[0], cy + r + 1)
        patch_img = Image.fromarray(tile_arr[y0:y1, x0:x1])
        num = ocr_reward_number(patch_img)
        rewards[str(row_idx)] = num
    return grid, rewards


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", help="path to 4x6 mosaic image")
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--cols", type=int, default=6)
    parser.add_argument("--out", default="designs/itinerary_out")
    parser.add_argument("--save-tiles", action="store_true")
    parser.add_argument("--labels", default=None, help="path to cluster_labels.json for digit mapping")
    args = parser.parse_args()

    img = Image.open(args.image).convert("RGB")
    W, H = img.size
    xs = [round(i * W / args.cols) for i in range(args.cols + 1)]
    ys = [round(i * H / args.rows) for i in range(args.rows + 1)]

    os.makedirs(args.out, exist_ok=True)

    tiles = []
    for r in range(args.rows):
        for c in range(args.cols):
            tile = img.crop((xs[c], ys[r], xs[c + 1], ys[r + 1]))
            tiles.append(((r, c), tile))

    # fixed layout based on ratios
    tile_w, tile_h = tiles[0][1].size
    global_x = [int(round(tile_w * r)) for r in COL_RATIOS]
    global_y = [int(round(tile_h * r)) for r in ROW_RATIOS]

    specs = []
    swirl_patches: List[Tuple[int, int, Image.Image, Optional[int], int, int]] = []
    for (r, c), tile in tiles:
        tile_arr = np.array(tile)
        tile_centers_y = refine_row_centers(tile_arr, global_x, global_y)
        tile_swirl_patches: List[Tuple[int, int, Image.Image, Optional[int]]] = []
        grid, rewards = process_tile(tile, global_x, tile_centers_y, tile_swirl_patches)
        spec = TileSpec(row=r, col=c, grid=grid, row_rewards=rewards)
        specs.append(spec)
        if args.save_tiles:
            tile_path = os.path.join(args.out, f"tile_{r+1}_{c+1}.png")
            tile.save(tile_path)
        svg_path = os.path.join(args.out, f"tile_{r+1}_{c+1}.svg")
        render_svg(spec, svg_path, tile_w, tile_h, global_x, tile_centers_y)
        for row_idx, col_idx, patch, value in tile_swirl_patches:
            swirl_patches.append((row_idx, col_idx, patch, value, r, c))

    # Export digit clusters for optional manual labeling
    if swirl_patches:
        masks = [digit_mask(patch) for _, _, patch, _, _, _ in swirl_patches]
        assignments, _ = cluster_masks(masks, threshold=0.12)
        labels_path = export_cluster_samples(args.out, swirl_patches, assignments)

        # Apply label map if provided
        label_file = args.labels or labels_path
        if os.path.exists(label_file):
            try:
                label_map = json.load(open(label_file, "r", encoding="utf-8"))
            except Exception:
                label_map = {}
        else:
            label_map = {}

        # If label map contains digits, override OCR results for those clusters
        for idx, cluster_id in enumerate(assignments):
            label = label_map.get(str(cluster_id))
            if label is None:
                continue
            row_idx, col_idx, _, _, r, c = swirl_patches[idx]
            for spec in specs:
                if spec.row == r and spec.col == c:
                    cell = spec.grid[row_idx][col_idx]
                    if cell is not None and cell["type"] == "swirl":
                        cell["value"] = int(label)
                    break

    # write json
    out_json = os.path.join(args.out, "itineraries.json")
    data = {
        "rows": args.rows,
        "cols": args.cols,
        "grid_rows": len(global_y),
        "grid_cols": len(global_x),
        "centers_x": global_x,
        "centers_y": global_y,
        "tiles": [
            {
                "row": s.row,
                "col": s.col,
                "grid": s.grid,
                "row_rewards": s.row_rewards,
            }
            for s in specs
        ],
    }
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"wrote {out_json}")


if __name__ == "__main__":
    main()
