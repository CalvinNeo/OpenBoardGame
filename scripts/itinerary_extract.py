#!/usr/bin/env python3
import argparse
import json
import math
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from typing import List, Tuple, Optional

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
ROW_RATIOS = [0.208, 0.344, 0.479, 0.615, 0.75, 0.885]


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
    return (r > 120 and b > 120 and g < 110) and (r + b) / 2 - g > 25


def ocr_number(patch: Image.Image, invert: bool = False) -> Optional[int]:
    # enlarge and threshold for tesseract
    img = patch.resize((patch.width * 4, patch.height * 4), Image.BICUBIC).convert("L")
    img = ImageOps.autocontrast(img)
    if invert:
        img = ImageOps.invert(img)
    img = img.point(lambda p: 255 if p > 180 else 0)
    with tempfile.TemporaryDirectory() as tmpdir:
        in_path = os.path.join(tmpdir, "in.png")
        out_base = os.path.join(tmpdir, "out")
        img.save(in_path)
        cmd = [
            "tesseract",
            in_path,
            out_base,
            "--psm",
            "8",
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
    digits = re.findall(r"\d+", text)
    if not digits:
        return None
    try:
        return int(digits[0])
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
    num = ocr_number(patch_img)
    if num is None:
        num = ocr_number(patch_img, invert=True)
    return {"type": "swirl", "value": num}


def process_tile(tile_img: Image.Image, centers_x: List[int], centers_y: List[int]) -> Tuple[List[List[Optional[dict]]], dict]:
    tile_arr = np.array(tile_img)
    bg_colors = [sample_column_background(tile_arr, centers_y, x) for x in centers_x]
    grid = []
    for y in centers_y:
        row = []
        for idx, x in enumerate(centers_x):
            cell = classify_cell(tile_arr, x, y, bg_colors[idx])
            row.append(cell)
        grid.append(row)

    # row rewards in right margin
    right_min = centers_x[-1] + 12
    rewards = {}
    centers = detect_reward_centers(tile_arr, right_min)
    for cx, cy in centers:
        # map to nearest row
        row_idx = int(np.argmin([abs(cy - y) for y in centers_y]))
        r = 8
        x0, y0 = max(0, cx - r), max(0, cy - r)
        x1, y1 = min(tile_arr.shape[1], cx + r + 1), min(tile_arr.shape[0], cy + r + 1)
        patch_img = Image.fromarray(tile_arr[y0:y1, x0:x1])
        num = ocr_number(patch_img)
        rewards[str(row_idx)] = num
    return grid, rewards


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", help="path to 4x6 mosaic image")
    parser.add_argument("--rows", type=int, default=4)
    parser.add_argument("--cols", type=int, default=6)
    parser.add_argument("--out", default="designs/itinerary_out")
    parser.add_argument("--save-tiles", action="store_true")
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
    for (r, c), tile in tiles:
        grid, rewards = process_tile(tile, global_x, global_y)
        spec = TileSpec(row=r, col=c, grid=grid, row_rewards=rewards)
        specs.append(spec)
        if args.save_tiles:
            tile_path = os.path.join(args.out, f"tile_{r+1}_{c+1}.png")
            tile.save(tile_path)

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
