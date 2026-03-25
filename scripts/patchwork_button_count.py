from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import numpy as np

ROOT = Path("designs/patchwork")
OVERLAY_DIR = ROOT / "button_overlays"


@dataclass
class ButtonInfo:
    x: float
    y: float
    r: float
    support: float


@dataclass
class ButtonResult:
    file: str
    count: int
    buttons: List[ButtonInfo]


def load_label_map() -> Dict[str, dict]:
    labels_path = ROOT / "labels.json"
    if not labels_path.exists():
        return {}
    labels = json.loads(labels_path.read_text())
    return {Path(r["file"]).stem: r for r in labels}


def detect_buttons(path: Path, label_map: Dict[str, dict]) -> List[ButtonInfo]:
    img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return []
    if img.shape[2] == 3:
        img = np.dstack([img, np.full(img.shape[:2], 255, dtype=np.uint8)])

    alpha = img[:, :, 3]
    mask = (alpha > 0).astype(np.uint8)

    label = label_map.get(path.stem)
    if label and label.get("ok"):
        x, y, w, h = label["bbox"]
        x0 = max(0, x - 12)
        y0 = max(0, y - 12)
        x1 = min(img.shape[1], x + w + 12)
        y1 = min(img.shape[0], y + h + 12)
        mask[y0:y1, x0:x1] = 0

    gray = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 5)
    gray = cv2.bitwise_and(gray, gray, mask=mask)

    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=60,
        param1=120,
        param2=30,
        minRadius=40,
        maxRadius=75,
    )
    if circles is None:
        return []

    circles = np.squeeze(circles)
    if circles.ndim == 1:
        circles = circles[None, :]

    edges = cv2.Canny(gray, 80, 160)
    kept: List[ButtonInfo] = []
    for x, y, r in circles:
        x = float(x)
        y = float(y)
        r = float(r)
        pts = 0
        hits = 0
        for a in range(0, 360, 10):
            rad = np.deg2rad(a)
            cx = int(round(x + r * np.cos(rad)))
            cy = int(round(y + r * np.sin(rad)))
            if 0 <= cx < edges.shape[1] and 0 <= cy < edges.shape[0]:
                pts += 1
                if edges[cy, cx] > 0:
                    hits += 1
        support = hits / pts if pts else 0.0
        if 45 <= r <= 65 and support >= 0.35:
            kept.append(ButtonInfo(x=x, y=y, r=r, support=support))

    # Non-maximum suppression to avoid duplicates
    kept.sort(key=lambda b: -b.support)
    final: List[ButtonInfo] = []
    for b in kept:
        if all((b.x - f.x) ** 2 + (b.y - f.y) ** 2 >= (0.6 * max(b.r, f.r)) ** 2 for f in final):
            final.append(b)
    return final[:4]


def write_overlay(path: Path, buttons: List[ButtonInfo]) -> None:
    img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return
    height, width = img.shape[:2]
    svg_lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'  <image href="../{path.name}" x="0" y="0" width="{width}" height="{height}" />',
    ]
    for b in buttons:
        svg_lines.append(
            f'  <circle cx="{b.x:.1f}" cy="{b.y:.1f}" r="{b.r:.1f}" fill="none" stroke="#ff3b30" stroke-width="4" />'
        )
    svg_lines.append(
        f'  <text x="12" y="32" font-size="28" font-family="Arial" fill="#ff3b30">count: {len(buttons)}</text>'
    )
    svg_lines.append("</svg>")
    out_path = OVERLAY_DIR / f"{path.stem}.svg"
    out_path.write_text("\n".join(svg_lines), encoding="utf-8")


def build_html(results: List[ButtonResult]) -> str:
    html_lines = [
        "<!doctype html>",
        '<html lang="zh">',
        "<head>",
        "  <meta charset=\"utf-8\" />",
        "  <title>Patchwork Button Counts</title>",
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
        "  </style>",
        "</head>",
        "<body>",
        "  <h1>Patchwork 大实心纽扣计数</h1>",
        "  <div class=\"grid\">",
    ]

    for r in results:
        html_lines += [
            "    <div class=\"card\">",
            f"      <div class=\"title\">{r.file}</div>",
            f"      <div class=\"meta\">count {r.count}</div>",
            "      <div class=\"row\">",
            f"        <div class=\"pane\"><img src=\"{r.file}\" alt=\"{r.file}\" /></div>",
            f"        <div class=\"pane\"><img src=\"button_overlays/{Path(r.file).stem}.svg\" alt=\"{r.file} overlay\" /></div>",
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
    OVERLAY_DIR.mkdir(parents=True, exist_ok=True)
    label_map = load_label_map()
    results: List[ButtonResult] = []
    for path in sorted(ROOT.glob("*.png")):
        buttons = detect_buttons(path, label_map)
        write_overlay(path, buttons)
        results.append(
            ButtonResult(
                file=path.name,
                count=len(buttons),
                buttons=buttons,
            )
        )

    out_json = [
        {
            "file": r.file,
            "count": r.count,
            "buttons": [b.__dict__ for b in r.buttons],
        }
        for r in results
    ]
    (ROOT / "button_counts.json").write_text(
        json.dumps(out_json, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (ROOT / "button_compare.html").write_text(build_html(results), encoding="utf-8")


if __name__ == "__main__":
    main()
