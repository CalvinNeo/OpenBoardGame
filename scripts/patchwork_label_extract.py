from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

import cv2
import numpy as np

ROOT = Path("designs/patchwork")
OUT_DIR = ROOT / "labels"


@dataclass
class LabelResult:
    file: str
    ok: bool
    angle: float
    bbox: Tuple[int, int, int, int]
    area_ratio: float
    size: Tuple[int, int]


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


def compute_low_variance_mask(
    gray: np.ndarray,
    alpha_mask: np.ndarray,
    window: int = 15,
    percentile: float = 5.0,
) -> np.ndarray:
    mean = cv2.blur(gray.astype(np.float32), (window, window))
    mean_sq = cv2.blur((gray.astype(np.float32) ** 2), (window, window))
    var = mean_sq - mean ** 2
    thr = np.percentile(var[alpha_mask], percentile)
    low = (var <= thr) & alpha_mask
    low = cv2.morphologyEx(low.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    return low


def estimate_label_size(paths: List[Path]) -> Tuple[float, float]:
    longs: List[float] = []
    shorts: List[float] = []
    for path in paths:
        img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if img is None:
            continue
        if img.shape[2] == 3:
            alpha = np.full(img.shape[:2], 255, dtype=np.uint8)
            img = np.dstack([img, alpha])
        alpha_mask = img[:, :, 3] > 0
        patch_area = int(alpha_mask.sum())
        gray = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY)
        low_mask = compute_low_variance_mask(gray, alpha_mask)
        num, labels, stats, _ = cv2.connectedComponentsWithStats(low_mask, connectivity=8)
        for i in range(1, num):
            x, y, w, h, area = stats[i]
            if w == 0 or h == 0:
                continue
            bbox_area_ratio = (w * h) / patch_area
            ar = max(w, h) / min(w, h)
            if bbox_area_ratio < 0.008 or bbox_area_ratio > 0.12:
                continue
            if ar < 1.2 or ar > 4.0:
                continue
            roi = img[y : y + h, x : x + w, :3]
            hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
            H, S, V = cv2.split(hsv)
            green_ratio = ((H >= 30) & (H <= 90) & (S > 80) & (V > 60)).mean()
            dark_ratio = (V < 60).mean()
            if green_ratio < 0.001 or dark_ratio < 0.001:
                continue
            longs.append(float(max(w, h)))
            shorts.append(float(min(w, h)))
            break
    if not longs:
        return 142.0, 74.0
    return float(np.median(longs)), float(np.median(shorts))


def pick_label_component(
    img: np.ndarray,
    low_mask: np.ndarray,
    patch_area: int,
    expected_long: float,
    expected_short: float,
) -> Tuple[np.ndarray, Tuple[int, int, int, int], float] | None:
    num, labels, stats, _ = cv2.connectedComponentsWithStats(low_mask, connectivity=8)
    ar_target = expected_long / expected_short
    def consider(require_both: bool) -> Tuple[np.ndarray, Tuple[int, int, int, int], float] | None:
        best = None
        for i in range(1, num):
            x, y, w, h, area = stats[i]
            if w == 0 or h == 0:
                continue
            bbox_area_ratio = (w * h) / patch_area
            long_side = max(w, h)
            short_side = min(w, h)
            ar = long_side / short_side
            if bbox_area_ratio < 0.008 or bbox_area_ratio > 0.2:
                continue
            if ar < 1.2 or ar > 4.0:
                continue
            if long_side < expected_long * 0.6 or long_side > expected_long * 1.6:
                continue
            if short_side < expected_short * 0.6 or short_side > expected_short * 1.6:
                continue
            roi = img[y : y + h, x : x + w, :3]
            hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
            H, S, V = cv2.split(hsv)
            green_ratio = ((H >= 30) & (H <= 90) & (S > 80) & (V > 60)).mean()
            dark_ratio = (V < 60).mean()
            has_green = green_ratio >= 0.001
            has_dark = dark_ratio >= 0.001
            if require_both and not (has_green and has_dark):
                continue
            size_pen = abs(long_side - expected_long) / expected_long + abs(short_side - expected_short) / expected_short
            ar_pen = abs(ar - ar_target) / ar_target
            presence_score = 0.4 if (has_green and has_dark) else (0.2 if (has_green or has_dark) else 0.0)
            score = 2.0 + presence_score + bbox_area_ratio * 1.5 - size_pen * 3.0 - ar_pen * 1.0
            if best is None or score > best[0]:
                comp_mask = (labels == i).astype(np.uint8)
                best = (score, comp_mask, (int(x), int(y), int(w), int(h)), float(bbox_area_ratio))
        if best is None:
            return None
        _, comp_mask, bbox, area_ratio = best
        return comp_mask, bbox, area_ratio

    picked = consider(require_both=True)
    if picked is not None:
        return picked
    return consider(require_both=False)


def order_points(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def rotate_and_crop_label(
    img: np.ndarray,
    rect_center: Tuple[float, float],
    rect_size: Tuple[float, float],
    rect_angle: float,
    expected_long: float,
    expected_short: float,
) -> np.ndarray:
    rect_w, rect_h = rect_size
    angle = rect_angle

    # Rotate to make the long edge horizontal, but never stretch.
    if rect_w < rect_h:
        angle += 90.0
        expected_w = expected_short
        expected_h = expected_long
        rect_w, rect_h = rect_h, rect_w
    else:
        expected_w = expected_long
        expected_h = expected_short

    # Target crop size: at least the detected rect, but biased by expected size.
    # Add extra padding to avoid clipping icons (e.g., hourglass tips).
    pad_scale = 1.35
    target_w = max(rect_w, expected_w * 0.9) * pad_scale
    target_h = max(rect_h, expected_h * 0.9) * pad_scale
    pad_px = max(6, int(0.05 * min(rect_w, rect_h)))
    target_w += pad_px * 2
    target_h += pad_px * 2

    h_img, w_img = img.shape[:2]
    M = cv2.getRotationMatrix2D(rect_center, angle, 1.0)
    rotated = cv2.warpAffine(
        img,
        M,
        (w_img, h_img),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )

    cx, cy = rect_center
    x0 = int(round(cx - target_w / 2))
    x1 = int(round(cx + target_w / 2))
    y0 = int(round(cy - target_h / 2))
    y1 = int(round(cy + target_h / 2))

    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(w_img, x1)
    y1 = min(h_img, y1)

    cropped = rotated[y0:y1, x0:x1]
    return cropped


def rotate_image(img: np.ndarray, angle: float) -> np.ndarray:
    if abs(angle) < 0.01:
        return img
    h, w = img.shape[:2]
    pad = int(0.2 * max(h, w))
    padded = cv2.copyMakeBorder(img, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0))
    ph, pw = padded.shape[:2]
    M = cv2.getRotationMatrix2D((pw / 2, ph / 2), angle, 1.0)
    rotated = cv2.warpAffine(
        padded,
        M,
        (pw, ph),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )
    return alpha_crop(rotated)


def straighten_label(cropped: np.ndarray) -> np.ndarray:
    if cropped.shape[2] == 3:
        alpha = np.full(cropped.shape[:2], 255, dtype=np.uint8)
        cropped = np.dstack([cropped, alpha])
    alpha_mask = cropped[:, :, 3] > 0
    if alpha_mask.sum() == 0:
        return cropped

    gray = cv2.cvtColor(cropped[:, :, :3], cv2.COLOR_BGR2GRAY)
    low_mask = compute_low_variance_mask(gray, alpha_mask, percentile=20.0)
    num, labels, stats, _ = cv2.connectedComponentsWithStats(low_mask.astype(np.uint8), connectivity=8)
    if num <= 1:
        return cropped
    idx = 1 + int(np.argmax(stats[1:, 4]))
    comp = (labels == idx).astype(np.uint8)
    ys, xs = np.where(comp > 0)
    if len(xs) < 20:
        return cropped
    pts = np.column_stack([xs, ys]).astype(np.float32)
    rect = cv2.minAreaRect(pts)
    (_, _), (rw, rh), angle = rect
    if rw == 0 or rh == 0:
        return cropped
    if rw < rh:
        angle += 90.0
        rw, rh = rh, rw
    ar = rw / max(1.0, rh)
    if ar < 1.2:
        return cropped
    if abs(angle) < 3.0:
        return cropped

    h, w = cropped.shape[:2]
    pad = int(0.15 * max(h, w))
    padded = cv2.copyMakeBorder(cropped, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0))
    ph, pw = padded.shape[:2]
    M = cv2.getRotationMatrix2D((pw / 2, ph / 2), angle, 1.0)
    rotated = cv2.warpAffine(
        padded,
        M,
        (pw, ph),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0),
    )
    return alpha_crop(rotated)


def extract_label(
    img: np.ndarray,
    expected_long: float,
    expected_short: float,
    extra_rotate_deg: float = 0.0,
    post_rotate_deg: float = 0.0,
) -> Tuple[np.ndarray, float, Tuple[int, int, int, int], float] | None:
    if img.shape[2] == 3:
        alpha = np.full(img.shape[:2], 255, dtype=np.uint8)
        img = np.dstack([img, alpha])

    alpha_mask = img[:, :, 3] > 0
    patch_area = int(alpha_mask.sum())
    if patch_area == 0:
        return None

    gray = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY)
    picked = None
    for pct in (5.0, 10.0, 15.0, 20.0, 25.0, 30.0, 35.0, 40.0):
        low_mask = compute_low_variance_mask(gray, alpha_mask, percentile=pct)
        picked = pick_label_component(img, low_mask, patch_area, expected_long, expected_short)
        if picked is not None:
            break
    if picked is None:
        return None

    comp_mask, bbox, area_ratio = picked
    comp_mask = (comp_mask * 255).astype(np.uint8)

    contours, _ = cv2.findContours(comp_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    cnt = max(contours, key=cv2.contourArea)
    rect = cv2.minAreaRect(cnt)
    (cx, cy), (w, h), angle = rect
    angle = float(angle) + float(extra_rotate_deg)
    cropped = rotate_and_crop_label(img, (cx, cy), (w, h), angle, expected_long, expected_short)
    cropped = straighten_label(cropped)
    if abs(post_rotate_deg) > 0.01:
        cropped = rotate_image(cropped, post_rotate_deg)
    return cropped, angle, bbox, area_ratio


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results: List[LabelResult] = []
    patch_files = sorted(ROOT.glob("*.png"))
    expected_long, expected_short = estimate_label_size(patch_files)
    # Per-file rotation tweaks (positive = CCW). Clockwise 30° => -30.
    angle_overrides = {
        "httpiimgurcomIIDL8rrpng": 22.5,
        "httpiimgurcomUMKbkEcpng": 22.5,
        "httpiimgurcomouQKJU7png": 0.0,
    }
    post_rotate_overrides = {
        "httpiimgurcomouQKJU7png": 45.0,
    }
    for path in patch_files:
        img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if img is None:
            results.append(LabelResult(path.name, False, 0.0, (0, 0, 0, 0), 0.0, (0, 0)))
            continue

        extra_rotate = angle_overrides.get(path.stem, 0.0)
        post_rotate = post_rotate_overrides.get(path.stem, 0.0)
        extracted = extract_label(
            img,
            expected_long,
            expected_short,
            extra_rotate_deg=extra_rotate,
            post_rotate_deg=post_rotate,
        )
        if extracted is None:
            results.append(LabelResult(path.name, False, 0.0, (0, 0, 0, 0), 0.0, (0, 0)))
            continue

        cropped, angle, bbox, area_ratio = extracted
        out_path = OUT_DIR / f"{path.stem}.png"
        cv2.imwrite(str(out_path), cropped)
        results.append(
            LabelResult(
                file=path.name,
                ok=True,
                angle=float(angle),
                bbox=bbox,
                area_ratio=float(area_ratio),
                size=(int(cropped.shape[1]), int(cropped.shape[0])),
            )
        )

    meta_path = ROOT / "labels.json"
    meta_path.write_text(
        json.dumps([r.__dict__ for r in results], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    html_lines = [
        "<!doctype html>",
        '<html lang="zh">',
        "<head>",
        "  <meta charset=\"utf-8\" />",
        "  <title>Patchwork Label Compare</title>",
        "  <style>",
        "    body { font-family: \"Helvetica Neue\", Arial, sans-serif; margin: 24px; background: #f6f4f0; color: #222; }",
        "    h1 { font-size: 20px; margin-bottom: 16px; }",
        "    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }",
        "    .card { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }",
        "    .title { font-size: 13px; margin-bottom: 8px; word-break: break-all; }",
        "    .meta { color: #666; font-size: 12px; margin-bottom: 8px; }",
        "    .row { display: flex; gap: 8px; }",
        "    .pane { flex: 1; padding: 8px; background: repeating-conic-gradient(#eee 0% 25%, #ddd 0% 50%) 50% / 16px 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; min-height: 160px; }",
        "    .pane img { max-width: 100%; max-height: 200px; object-fit: contain; }",
        "  </style>",
        "</head>",
        "<body>",
        "  <h1>Patchwork 便签条提取对比</h1>",
        "  <div class=\"grid\">",
    ]

    for r in results:
        name = r.file
        html_lines += [
            "    <div class=\"card\">",
            f"      <div class=\"title\">{name}</div>",
            f"      <div class=\"meta\">ok {r.ok} · angle {r.angle:.1f} · area {r.area_ratio:.3f} · size {r.size[0]}x{r.size[1]}</div>",
            "      <div class=\"row\">",
            f"        <div class=\"pane\"><img src=\"{name}\" alt=\"{name}\" /></div>",
            f"        <div class=\"pane\"><img src=\"svg/{Path(name).stem}.svg\" alt=\"{name} svg\" /></div>",
            f"        <div class=\"pane\"><img src=\"labels/{Path(name).stem}.png\" alt=\"{name} label\" /></div>",
            "      </div>",
            "    </div>",
        ]

    html_lines += [
        "  </div>",
        "</body>",
        "</html>",
    ]

    (ROOT / "labels_compare.html").write_text("\n".join(html_lines), encoding="utf-8")


if __name__ == "__main__":
    main()
