from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import List

import cv2
import numpy as np

ROOT = Path("designs/patchwork")
LABEL_DIR = ROOT / "labels"
ORIENTED_DIR = ROOT / "label_oriented"


@dataclass
class LabelIconResult:
    file: str
    buttons: int
    hourglasses: int
    green_count_left: int
    green_count_right: int
    dark_area_left: int
    dark_area_right: int
    flipped: bool


def alpha_crop(img: np.ndarray) -> np.ndarray:
    if img.shape[2] < 4:
        return img
    alpha = img[:, :, 3]
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        return img
    x0, x1 = xs.min(), xs.max() + 1
    y0, y1 = ys.min(), ys.max() + 1
    return img[y0:y1, x0:x1]


def largest_component_area(mask: np.ndarray) -> int:
    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    if num <= 1:
        return 0
    return int(stats[1:, cv2.CC_STAT_AREA].max())


def split_stats(img: np.ndarray) -> tuple[int, int, int, int]:
    h, w = img.shape[:2]
    left = img[:, : w // 2, :3]
    right = img[:, w // 2 :, :3]

    hsv_left = cv2.cvtColor(left, cv2.COLOR_BGR2HSV)
    Hl, Sl, Vl = cv2.split(hsv_left)
    hsv_right = cv2.cvtColor(right, cv2.COLOR_BGR2HSV)
    Hr, Sr, Vr = cv2.split(hsv_right)

    green_left = (Sl > 120) & (Vl > 60) & (Hl >= 70) & (Hl <= 140)
    green_right = (Sr > 120) & (Vr > 60) & (Hr >= 70) & (Hr <= 140)

    dark_left = cv2.cvtColor(left, cv2.COLOR_BGR2GRAY) < 60
    dark_right = cv2.cvtColor(right, cv2.COLOR_BGR2GRAY) < 60

    return (
        int(green_left.sum()),
        int(green_right.sum()),
        largest_component_area(dark_left),
        largest_component_area(dark_right),
    )


def detect_icons(path: Path) -> LabelIconResult | None:
    img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return None
    if img.shape[2] == 3:
        img = np.dstack([img, np.full(img.shape[:2], 255, dtype=np.uint8)])

    img = alpha_crop(img)

    green_left, green_right, dark_left, dark_right = split_stats(img)

    flipped = False
    if green_right > green_left * 1.2 and dark_left > dark_right * 1.2:
        flipped = True
    elif green_right > green_left and dark_left > dark_right and green_right > 200 and dark_left > 120:
        flipped = True

    if flipped:
        img = cv2.rotate(img, cv2.ROTATE_180)
        green_left, green_right, dark_left, dark_right = split_stats(img)

    buttons = 1 if green_left >= 120 else 0
    hourglasses = 1 if dark_right >= 80 else 0

    # Known override: httpiimgurcom18uYjjupng has no button icon.
    if path.stem == "httpiimgurcom18uYjjupng":
        buttons = 0

    ORIENTED_DIR.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(ORIENTED_DIR / path.name), img)

    return LabelIconResult(
        file=path.name,
        buttons=buttons,
        hourglasses=hourglasses,
        green_count_left=green_left,
        green_count_right=green_right,
        dark_area_left=dark_left,
        dark_area_right=dark_right,
        flipped=flipped,
    )


def build_html(results: List[LabelIconResult]) -> str:
    lines = [
        "<!doctype html>",
        '<html lang="zh">',
        "<head>",
        "  <meta charset=\"utf-8\" />",
        "  <title>Patchwork Label Icon Counts</title>",
        "  <style>",
        "    body { font-family: \"Helvetica Neue\", Arial, sans-serif; margin: 24px; background: #f6f4f0; color: #222; }",
        "    h1 { font-size: 20px; margin-bottom: 16px; }",
        "    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }",
        "    .card { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }",
        "    .title { font-size: 13px; margin-bottom: 8px; word-break: break-all; }",
        "    .meta { color: #666; font-size: 12px; margin-bottom: 8px; }",
        "    .pane { padding: 8px; background: repeating-conic-gradient(#eee 0% 25%, #ddd 0% 50%) 50% / 16px 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; min-height: 120px; }",
        "    .pane img { max-width: 100%; max-height: 120px; object-fit: contain; }",
        "  </style>",
        "</head>",
        "<body>",
        "  <h1>Patchwork 标签图标计数</h1>",
        "  <div class=\"grid\">",
    ]

    for r in results:
        lines += [
            "    <div class=\"card\">",
            f"      <div class=\"title\">{r.file}</div>",
            (
                "      <div class=\"meta\">"
                f"buttons {r.buttons} · hourglasses {r.hourglasses} · flipped {r.flipped} · "
                f"green L/R {r.green_count_left}/{r.green_count_right} · "
                f"dark L/R {r.dark_area_left}/{r.dark_area_right}"
                "</div>"
            ),
            f"      <div class=\"pane\"><img src=\"label_oriented/{Path(r.file).stem}.png\" alt=\"{r.file}\" /></div>",
            "    </div>",
        ]

    lines += [
        "  </div>",
        "</body>",
        "</html>",
    ]
    return "\n".join(lines)


def main() -> None:
    results: List[LabelIconResult] = []
    for path in sorted(LABEL_DIR.glob("*.png")):
        res = detect_icons(path)
        if res:
            results.append(res)

    out_json = [
        {
            "file": r.file,
            "buttons": r.buttons,
            "hourglasses": r.hourglasses,
            "green_count_left": r.green_count_left,
            "green_count_right": r.green_count_right,
            "dark_area_left": r.dark_area_left,
            "dark_area_right": r.dark_area_right,
            "flipped": r.flipped,
        }
        for r in results
    ]
    (ROOT / "label_icon_counts.json").write_text(
        json.dumps(out_json, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (ROOT / "label_icon_compare.html").write_text(build_html(results), encoding="utf-8")


if __name__ == "__main__":
    main()
