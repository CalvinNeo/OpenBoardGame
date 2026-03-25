from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

import numpy as np
from PIL import Image

ROOT = Path("designs/patchwork")
OUT_DIR = ROOT / "svg"


@dataclass
class GridResult:
    rows: int
    cols: int
    filled: np.ndarray
    iou: float
    cell_size: float


def load_alpha_mask(path: Path, alpha_thresh: int = 128) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
    im = Image.open(path).convert("RGBA")
    alpha = np.array(im.split()[-1])
    mask = alpha >= alpha_thresh
    ys, xs = np.where(mask)
    if len(xs) == 0:
        raise ValueError(f"No opaque pixels found in {path}")
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    return mask[y0:y1, x0:x1], (x0, y0, x1, y1)


def estimate_base_cell_size(paths: List[Path], max_rc: int = 7) -> float:
    dims: List[float] = []
    for path in paths:
        mask, _ = load_alpha_mask(path)
        h, w = mask.shape
        dims.extend([float(w), float(h)])

    candidates: List[float] = []
    for d in dims:
        for k in range(1, max_rc + 1):
            candidates.append(d / k)

    # Use a simple histogram to find the densest bin around the true cell size.
    bins: dict[int, int] = {}
    for c in candidates:
        key = int(round(c))
        bins[key] = bins.get(key, 0) + 1

    # Prefer bins in a reasonable range to avoid large-multiple artifacts.
    sorted_bins = sorted(
        ((count, key) for key, count in bins.items() if 120 <= key <= 200),
        reverse=True,
    )
    if not sorted_bins:
        sorted_bins = sorted(((count, key) for key, count in bins.items()), reverse=True)

    _, best_key = sorted_bins[0]
    near = [c for c in candidates if abs(c - best_key) <= 2]
    return float(sum(near) / len(near)) if near else float(best_key)


def pick_grid(
    mask: np.ndarray,
    base_cell_size: float | None = None,
    max_rc: int = 8,
    square_tol: float = 0.2,
    fill_thresh: float = 0.5,
    size_weight: float = 0.2,
) -> GridResult:
    h, w = mask.shape
    best: GridResult | None = None
    best_score = -1.0

    for rows in range(1, max_rc + 1):
        for cols in range(1, max_rc + 1):
            cell_h = h / rows
            cell_w = w / cols
            if abs(cell_w - cell_h) / max(cell_w, cell_h) > square_tol:
                continue

            filled = np.zeros((rows, cols), dtype=bool)
            for r in range(rows):
                for c in range(cols):
                    y0 = int(round(r * cell_h))
                    y1 = int(round((r + 1) * cell_h))
                    x0 = int(round(c * cell_w))
                    x1 = int(round((c + 1) * cell_w))
                    if y1 <= y0 or x1 <= x0:
                        continue
                    cell = mask[y0:y1, x0:x1]
                    if cell.mean() >= fill_thresh:
                        filled[r, c] = True

            recon = np.zeros_like(mask)
            for r in range(rows):
                for c in range(cols):
                    if not filled[r, c]:
                        continue
                    y0 = int(round(r * cell_h))
                    y1 = int(round((r + 1) * cell_h))
                    x0 = int(round(c * cell_w))
                    x1 = int(round((c + 1) * cell_w))
                    recon[y0:y1, x0:x1] = True

            inter = np.logical_and(recon, mask).sum()
            union = np.logical_or(recon, mask).sum()
            iou = float(inter / union) if union else 0.0
            penalty = 0.002 * (rows * cols)
            size_penalty = 0.0
            if base_cell_size:
                size_penalty = abs(((cell_w + cell_h) / 2) - base_cell_size) / base_cell_size
            score = iou - penalty - (size_weight * size_penalty)
            if score > best_score:
                best_score = score
                best = GridResult(
                    rows=rows,
                    cols=cols,
                    filled=filled,
                    iou=iou,
                    cell_size=(cell_w + cell_h) / 2,
                )

    if best is None:
        raise ValueError("No grid candidates produced")
    return best


def grid_to_svg(
    filled: np.ndarray,
    cell_px: int = 80,
    stroke: str = "#222",
    fill: str = "#4b4b4b",
) -> str:
    rows, cols = filled.shape
    width = cols * cell_px
    height = rows * cell_px
    rects: List[str] = []
    for r in range(rows):
        for c in range(cols):
            if not filled[r, c]:
                continue
            x = c * cell_px
            y = r * cell_px
            rects.append(
                f'<rect x="{x}" y="{y}" width="{cell_px}" height="{cell_px}" '
                f'fill="{fill}" stroke="{stroke}" stroke-width="2" />'
            )
    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="none" />',
        *rects,
        '</svg>',
    ]
    return "\n".join(svg)


def write_time_svg(path: Path, out_path: Path) -> None:
    im = Image.open(path)
    width, height = im.size
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">\n'
        f'  <image href="../{path.name}" x="0" y="0" width="{width}" height="{height}" />\n'
        '</svg>\n'
    )
    out_path.write_text(svg, encoding="utf-8")


def build_html(results: List[dict], time_path: Path | None) -> str:
    html_lines = [
        "<!doctype html>",
        '<html lang="zh">',
        "<head>",
        "  <meta charset=\"utf-8\" />",
        "  <title>Patchwork SVG Compare</title>",
        "  <style>",
        "    body { font-family: \"Helvetica Neue\", Arial, sans-serif; margin: 24px; background: #f6f4f0; color: #222; }",
        "    h1 { font-size: 20px; margin-bottom: 16px; }",
        "    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }",
        "    .card { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }",
        "    .title { font-size: 13px; margin-bottom: 8px; word-break: break-all; }",
        "    .meta { color: #666; font-size: 12px; margin-bottom: 8px; }",
        "    .row { display: flex; gap: 8px; }",
        "    .pane { flex: 1; padding: 8px; background: repeating-conic-gradient(#eee 0% 25%, #ddd 0% 50%) 50% / 16px 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; min-height: 220px; }",
        "    .pane img { max-width: 100%; max-height: 220px; object-fit: contain; }",
        "    .time { margin-bottom: 24px; }",
        "  </style>",
        "</head>",
        "<body>",
        "  <h1>Patchwork 解析对比</h1>",
    ]

    if time_path is not None:
        html_lines += [
            "  <div class=\"card time\">",
            "    <div class=\"title\">time.jpg（时间轨道）</div>",
            "    <div class=\"row\">",
            "      <div class=\"pane\"><img src=\"time.jpg\" alt=\"time track\" /></div>",
            "      <div class=\"pane\"><img src=\"svg/time.svg\" alt=\"time track svg\" /></div>",
            "    </div>",
            "  </div>",
        ]

    html_lines.append("  <div class=\"grid\">")
    for item in results:
        name = item["file"]
        rows = item["rows"]
        cols = item["cols"]
        cells = item["cells"]
        iou = item["iou"]
        html_lines += [
            "    <div class=\"card\">",
            f"      <div class=\"title\">{name}</div>",
            f"      <div class=\"meta\">grid {rows} x {cols} · cells {cells} · iou {iou}</div>",
            "      <div class=\"row\">",
            f"        <div class=\"pane\"><img src=\"{name}\" alt=\"{name}\" /></div>",
            f"        <div class=\"pane\"><img src=\"svg/{Path(name).stem}.svg\" alt=\"{name} svg\" /></div>",
            "      </div>",
            "    </div>",
        ]

    html_lines += [
        "  </div>",
        "</body>",
        "</html>",
    ]
    return "\n".join(html_lines)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    patch_files = sorted(ROOT.glob("*.png"))
    base_cell_size = estimate_base_cell_size(patch_files)
    results: List[dict] = []

    for path in patch_files:
        mask, bbox = load_alpha_mask(path)
        grid = pick_grid(mask, base_cell_size=base_cell_size)
        svg = grid_to_svg(grid.filled)
        out_path = OUT_DIR / f"{path.stem}.svg"
        out_path.write_text(svg, encoding="utf-8")
        results.append(
            {
                "file": path.name,
                "rows": grid.rows,
                "cols": grid.cols,
                "cells": int(grid.filled.sum()),
                "iou": round(grid.iou, 4),
                "bbox": list(bbox),
            }
        )

    time_path = ROOT / "time.jpg"
    if time_path.exists():
        write_time_svg(time_path, OUT_DIR / "time.svg")
        time_ref: Path | None = time_path
    else:
        time_ref = None

    (ROOT / "patches.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (ROOT / "compare.html").write_text(build_html(results, time_ref), encoding="utf-8")


if __name__ == "__main__":
    main()
