from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np
import easyocr

ROOT = Path("designs/patchwork")
LABEL_DIR = ROOT / "labels"
OUT_DIR = ROOT / "label_number_overlays"
ORIENTED_DIR = ROOT / "label_oriented_numbers"
NO_GREEN_FILES = {"httpiimgurcom18uYjjupng.png"}
_EASYOCR_READER = None
MANUAL_TEXT_OVERRIDES: dict[str, Tuple[Optional[str], Optional[str]]] = {
    "httpiimgurcomCC1QpAGpng.png": ("10", "5"),
    "httpiimgurcomElvuLC3png.png": ("8", "6"),
    "httpiimgurcomHVBlm5Opng.png": ("7", "4"),
    "httpiimgurcomIIDL8rrpng.png": ("2", "2"),
    "httpiimgurcomQtKsMcIpng.png": ("1", "5"),
    "httpiimgurcomRHjKwinpng.png": ("2", "2"),
    "httpiimgurcomUMKbkEcpng.png": ("2", "1"),
    "httpiimgurcomVLc46Lbpng.png": ("3", "6"),
    "httpiimgurcomWG7sSzapng.png": ("3", "4"),
    "httpiimgurcomaxouC8Xpng.png": ("7", "6"),
    "httpiimgurcomouQKJU7png.png": ("2", "2"),
    "httpsiimgurcom5tbFwQqpng.png": ("1", "3"),
    "httpsiimgurcomAV6kzAXpng.png": ("4", "6"),
    "httpsiimgurcomAi2wJ0Fpng.png": ("10", "3"),
    "httpsiimgurcomGPKVcnCpng.png": ("3", "3"),
    "httpsiimgurcomKPyUXxWpng.png": ("7", "1"),
    "httpsiimgurcomO5xpl33png.png": ("2", "3"),
    "httpsiimgurcomPNMOl9Jpng.png": ("10", "4"),
    "httpsiimgurcomehVRfsPpng.png": ("6", "5"),
}


@dataclass
class Box:
    x: int
    y: int
    w: int
    h: int

    @property
    def cx(self) -> float:
        return self.x + self.w / 2

    @property
    def cy(self) -> float:
        return self.y + self.h / 2


@dataclass
class NumberBoxResult:
    file: str
    flipped: bool
    green_box: Optional[Box]
    black_box: Optional[Box]
    green_text: str
    black_text: str


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


def green_mask(img: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    mask = (s > 70) & (v > 50) & (h >= 50) & (h <= 150)
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    return mask


def dark_mask(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY)
    thr = min(85, int(np.percentile(gray, 25)))
    mask = gray < thr
    hsv = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    greenish = (s > 70) & (v > 50) & (h >= 50) & (h <= 150)
    mask = mask & (~greenish)
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    return mask


def orientation_flip_needed(img: np.ndarray) -> bool:
    h, w = img.shape[:2]
    gmask = green_mask(img)
    dmask = dark_mask(img)

    def centroid_x(mask: np.ndarray) -> Optional[float]:
        ys, xs = np.where(mask > 0)
        if len(xs) < 50:
            return None
        return float(xs.mean())

    gcx = centroid_x(gmask)
    dcx = centroid_x(dmask)
    if gcx is not None and dcx is not None:
        return gcx > dcx
    if gcx is not None:
        return gcx > w * 0.5
    if dcx is not None:
        return dcx < w * 0.5
    return False


def find_components(mask: np.ndarray, min_area: int) -> List[Box]:
    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    boxes: List[Box] = []
    for i in range(1, num):
        x, y, w, h, area = stats[i]
        if area < min_area:
            continue
        boxes.append(Box(int(x), int(y), int(w), int(h)))
    return boxes


def vertical_overlap(a: Box, b: Box) -> float:
    y0 = max(a.y, b.y)
    y1 = min(a.y + a.h, b.y + b.h)
    overlap = max(0, y1 - y0)
    return overlap / max(1, min(a.h, b.h))


def cluster_boxes(boxes: List[Box]) -> List[Box]:
    if not boxes:
        return []
    boxes = sorted(boxes, key=lambda b: b.x)
    clusters: List[Box] = []
    for box in boxes:
        if not clusters:
            clusters.append(Box(box.x, box.y, box.w, box.h))
            continue
        last = clusters[-1]
        gap = box.x - (last.x + last.w)
        overlap = vertical_overlap(last, box)
        gap_thr = 0.6 * max(last.h, box.h)
        if gap <= gap_thr and overlap >= 0.25:
            x0 = min(last.x, box.x)
            y0 = min(last.y, box.y)
            x1 = max(last.x + last.w, box.x + box.w)
            y1 = max(last.y + last.h, box.y + box.h)
            clusters[-1] = Box(x0, y0, x1 - x0, y1 - y0)
        else:
            clusters.append(Box(box.x, box.y, box.w, box.h))
    return clusters


def score_pair(g: Box, b: Box, h: int, w: int) -> float:
    y_align = abs(g.cy - b.cy) / max(1.0, h)
    h_ratio = abs(g.h - b.h) / max(g.h, b.h)
    size_pen = 0.0
    for box in (g, b):
        rel_h = box.h / max(1.0, h)
        size_pen += abs(rel_h - 0.18) * 4.0
        if rel_h < 0.1:
            size_pen += (0.1 - rel_h) * 4.0
        if rel_h > 0.25:
            size_pen += (rel_h - 0.25) * 8.0

    g_pos_pen = max(0.0, g.cx / max(1.0, w * 0.5))
    b_pos_pen = max(0.0, (b.cx - w * 0.5) / max(1.0, w * 0.5))

    return y_align * 6.0 + h_ratio * 4.0 + size_pen * 2.0 + g_pos_pen * 1.0 + b_pos_pen * 1.0


def pick_best_pair(greens: List[Box], blacks: List[Box], h: int, w: int) -> Tuple[Optional[Box], Optional[Box]]:
    if not greens and not blacks:
        return None, None
    if not greens:
        return None, min(blacks, key=lambda b: b.y)
    if not blacks:
        return min(greens, key=lambda b: b.y), None

    best = None
    for g in greens:
        for b in blacks:
            score = score_pair(g, b, h, w)
            if best is None or score < best[0]:
                best = (score, g, b)
    if best is None:
        return greens[0], blacks[0]
    return best[1], best[2]


def _merge_vertical_pairs(boxes: List[Box], h: int, w: int) -> List[Box]:
    merged: List[Box] = []
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a = boxes[i]
            b = boxes[j]
            if a.cy > b.cy:
                a, b = b, a
            x_overlap = max(0, min(a.x + a.w, b.x + b.w) - max(a.x, b.x))
            if x_overlap / max(1.0, min(a.w, b.w)) < 0.4:
                continue
            gap = b.y - (a.y + a.h)
            if gap < 0.02 * h or gap > 0.35 * h:
                continue
            x0 = min(a.x, b.x)
            y0 = min(a.y, b.y)
            x1 = max(a.x + a.w, b.x + b.w)
            y1 = max(a.y + a.h, b.y + b.h)
            box = Box(x0, y0, x1 - x0, y1 - y0)
            rel_h = box.h / max(1.0, h)
            rel_w = box.w / max(1.0, w)
            aspect = box.w / max(1.0, box.h)
            if rel_h < 0.2 or rel_h > 0.6:
                continue
            if rel_w < 0.02 or rel_w > 0.4:
                continue
            if aspect < 0.25 or aspect > 1.5:
                continue
            merged.append(box)
    return merged


def _filter_candidates(mask: np.ndarray, h: int, w: int, margin_x: int, margin_y: int) -> List[Box]:
    boxes = find_components(mask, min_area=20)
    filtered: List[Box] = []
    small_for_vertical: List[Box] = []
    for box in boxes:
        if box.x < margin_x or box.y < margin_y:
            continue
        if (box.x + box.w) > (w - margin_x):
            continue
        if (box.y + box.h) > (h - margin_y):
            continue
        rel_h = box.h / max(1.0, h)
        rel_w = box.w / max(1.0, w)
        if rel_w < 0.02 or rel_w > 0.4:
            continue
        aspect = box.w / max(1.0, box.h)
        if aspect < 0.25 or aspect > 2.5:
            continue
        if 0.04 <= rel_h <= 0.25:
            small_for_vertical.append(box)
        if 0.1 <= rel_h <= 0.4:
            filtered.append(box)

    if not filtered and not small_for_vertical:
        return []

    small: List[Box] = []
    large: List[Box] = []
    for box in filtered:
        rel_h = box.h / max(1.0, h)
        if rel_h < 0.12:
            small.append(box)
        else:
            large.append(box)

    clustered_small = cluster_boxes(small) if small else []
    merged_vertical = _merge_vertical_pairs(small_for_vertical, h, w) if small_for_vertical else []
    return large + clustered_small + merged_vertical


def _pick_best_single(cands: List[Box], h: int, w: int) -> Optional[Box]:
    if not cands:
        return None
    best = None
    for box in cands:
        rel_h = box.h / max(1.0, h)
        score = abs(rel_h - 0.18)
        edge_pen = 0.0
        if box.x < 0.02 * w:
            edge_pen += 0.2
        if (box.x + box.w) > 0.98 * w:
            edge_pen += 0.2
        score += edge_pen
        if best is None or score < best[0]:
            best = (score, box)
    return best[1]


def detect_number_boxes(img: np.ndarray) -> Tuple[Optional[Box], Optional[Box]]:
    h, w = img.shape[:2]
    margin_y = max(2, int(round(0.05 * h)))
    margin_x = max(2, int(round(0.03 * w)))
    half = w * 0.5

    gmask = green_mask(img)
    dmask = dark_mask(img)
    for mask in (gmask, dmask):
        mask[:margin_y, :] = 0
        mask[h - margin_y :, :] = 0
        mask[:, :margin_x] = 0
        mask[:, w - margin_x :] = 0

    g_candidates = _filter_candidates(gmask, h, w, margin_x, margin_y)
    d_candidates = _filter_candidates(dmask, h, w, margin_x, margin_y)

    g_left_boxes = [b for b in g_candidates if b.cx < half * 0.9]
    d_right_boxes = [b for b in d_candidates if b.cx >= half]

    # prefer the left-most cluster within each half (number should be left of icon)
    g_left_boxes = [b for b in g_left_boxes if b.cx < half * 0.6]
    d_right_boxes = [b for b in d_right_boxes if b.x < (w - half) * 0.6 + half]

    if g_left_boxes and d_right_boxes:
        green_box, black_box = pick_best_pair(g_left_boxes, d_right_boxes, h, w)
        return green_box, black_box

    if g_left_boxes and not d_right_boxes:
        return _pick_best_single(g_left_boxes, h, w), None
    if d_right_boxes and not g_left_boxes:
        return None, _pick_best_single(d_right_boxes, h, w)

    return None, None


def crop_with_pad(img: np.ndarray, box: Box, pad: int = 4) -> np.ndarray:
    h, w = img.shape[:2]
    x0 = max(0, box.x - pad)
    y0 = max(0, box.y - pad)
    x1 = min(w, box.x + box.w + pad)
    y1 = min(h, box.y + box.h + pad)
    return img[y0:y1, x0:x1]


def label_bounds(img: np.ndarray) -> Tuple[int, int, int, int]:
    if img.shape[2] >= 4:
        mask = img[:, :, 3] > 0
    else:
        mask = np.any(img[:, :, :3] > 0, axis=2)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return 0, 0, img.shape[1], img.shape[0]
    x0 = int(xs.min())
    x1 = int(xs.max()) + 1
    y0 = int(ys.min())
    y1 = int(ys.max()) + 1
    return x0, y0, x1 - x0, y1 - y0


def template_number_box(img: np.ndarray, side: str) -> Box:
    x0, y0, w, h = label_bounds(img)
    if side == "green":
        rel_x, rel_y, rel_w, rel_h = 0.18, 0.31, 0.13, 0.30
    else:
        rel_x, rel_y, rel_w, rel_h = 0.73, 0.29, 0.12, 0.31
    bx = x0 + int(round(w * rel_x))
    by = y0 + int(round(h * rel_y))
    bw = max(14, int(round(w * rel_w)))
    bh = max(20, int(round(h * rel_h)))
    return Box(bx, by, bw, bh)


def suspicious_box(img: np.ndarray, box: Box, side: str) -> bool:
    x0, _, w, h = label_bounds(img)
    rel_h = box.h / max(1.0, h)
    rel_w = box.w / max(1.0, w)
    if rel_h < 0.12 or rel_h > 0.5:
        return True
    if rel_w < 0.04 or rel_w > 0.25:
        return True
    mid_x = x0 + w * 0.5
    if side == "green" and box.cx > mid_x:
        return True
    if side == "black" and box.cx < mid_x:
        return True
    return False


def get_easyocr_reader() -> easyocr.Reader:
    global _EASYOCR_READER
    if _EASYOCR_READER is None:
        _EASYOCR_READER = easyocr.Reader(["en"], gpu=False, verbose=False)
    return _EASYOCR_READER


def easyocr_digits(img: np.ndarray) -> List[Tuple[str, float]]:
    reader = get_easyocr_reader()
    if img.ndim == 2:
        rgb = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    else:
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = reader.readtext(rgb, detail=1, allowlist="0123456789", paragraph=False)
    texts: List[Tuple[str, float]] = []
    for _, text, conf in results:
        if not text:
            continue
        digits = "".join([ch for ch in text if ch.isdigit()])
        if digits:
            texts.append((digits, float(conf)))
    return texts


def parse_digit(text: str) -> Optional[int]:
    digits = "".join([ch for ch in text if ch.isdigit()])
    if not digits:
        return None
    if digits == "10":
        return 10
    if len(digits) == 1:
        return int(digits)
    return None


def parse_single_digit(text: str) -> Optional[int]:
    digits = "".join([ch for ch in text if ch.isdigit()])
    if len(digits) != 1:
        return None
    return int(digits)


def parse_rotated_ten(text: str) -> Optional[int]:
    digits = "".join([ch for ch in text if ch.isdigit()])
    if digits in {"10", "01"}:
        return 10
    return None


def _detect_vertical_10_projection(mask: np.ndarray) -> bool:
    h, w = mask.shape[:2]
    rows = np.where(mask.sum(axis=1) > 0)[0]
    if len(rows) < 4:
        return False
    groups = []
    start = rows[0]
    prev = rows[0]
    for r in rows[1:]:
        if r == prev + 1:
            prev = r
            continue
        groups.append((start, prev))
        start = r
        prev = r
    groups.append((start, prev))
    if len(groups) < 2:
        return False
    # Take top and bottom groups
    top = groups[0]
    bottom = groups[-1]
    def bbox_for(group: Tuple[int, int]) -> Tuple[int, int, int, int, int]:
        y0, y1 = group
        ys, xs = np.where(mask[y0 : y1 + 1, :] > 0)
        if len(xs) == 0:
            return (0, 0, 0, 0, 0)
        x0 = xs.min()
        x1 = xs.max()
        return (x0, y0, x1 - x0 + 1, y1 - y0 + 1, len(xs))

    x0, y0, w0, h0, _ = bbox_for(top)
    x1, y1, w1, h1, _ = bbox_for(bottom)
    if w0 == 0 or w1 == 0:
        return False
    x_overlap = max(0, min(x0 + w0, x1 + w1) - max(x0, x1))
    if x_overlap / max(1, min(w0, w1)) < 0.2:
        return False
    if abs((x0 + w0 / 2) - (x1 + w1 / 2)) > 0.3 * w:
        return False
    span = (y1 + h1) - y0
    if span < 0.55 * h:
        return False
    if w0 / max(1.0, h0) < 0.5:
        return False
    if h1 / max(1.0, w1) < 1.0:
        return False
    return True


def detect_vertical_10(bin_img: np.ndarray) -> bool:
    h, w = bin_img.shape[:2]
    if h == 0 or w == 0:
        return False
    mask = (bin_img > 0).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    comps = []
    min_area = max(6, int(0.002 * h * w))
    for i in range(1, num):
        x, y, bw, bh, area = stats[i]
        if area < min_area or bw == 0 or bh == 0:
            continue
        comps.append((x, y, bw, bh, area))
    if len(comps) < 2:
        return _detect_vertical_10_projection(mask)

    for i in range(len(comps)):
        for j in range(i + 1, len(comps)):
            a = comps[i]
            b = comps[j]
            if a[1] <= b[1]:
                top, bottom = a, b
            else:
                top, bottom = b, a
            x0, y0, w0, h0, _ = top
            x1, y1, w1, h1, _ = bottom
            x_overlap = max(0, min(x0 + w0, x1 + w1) - max(x0, x1))
            if x_overlap / max(1, min(w0, w1)) < 0.2:
                continue
            if abs((x0 + w0 / 2) - (x1 + w1 / 2)) > 0.3 * w:
                continue
            gap = y1 - (y0 + h0)
            if gap < -0.1 * h or gap > 0.5 * h:
                continue
            span = (y1 + h1) - y0
            if span < 0.55 * h:
                continue
            if w0 / max(1.0, h0) < 0.5:
                continue
            if h1 / max(1.0, w1) < 1.0:
                continue
            if (y0 + h0) > 0.7 * h:
                continue
            if y1 < 0.3 * h:
                continue
            return True
    return _detect_vertical_10_projection(mask)


def ocr_digit(crop: np.ndarray, mask_kind: str = "auto") -> str:
    if mask_kind == "green":
        digit_mask = green_mask(crop)
    elif mask_kind == "dark":
        digit_mask = dark_mask(crop)
    else:
        digit_mask = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        _, digit_mask = cv2.threshold(digit_mask, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    kernels = [
        cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)),
    ]
    preps: List[np.ndarray] = []
    for k in kernels:
        blackhat = cv2.morphologyEx(enhanced, cv2.MORPH_BLACKHAT, k)
        _, bin1 = cv2.threshold(blackhat, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        preps.append(bin1)
    bin2 = cv2.adaptiveThreshold(
        enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 3
    )
    preps.append(bin2)
    _, bin3 = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    preps.append(bin3)

    single_candidates: List[int] = []
    ten_votes = 0
    candidate_imgs = [enhanced] + preps
    for img in candidate_imgs:
        for scale in (1, 2, 3):
            if scale == 1:
                scaled = img
            else:
                scaled = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
            for text, conf in easyocr_digits(scaled):
                if conf < 0.15:
                    continue
                value = parse_single_digit(text)
                if value is not None:
                    single_candidates.append(value)
                if conf >= 0.7 and parse_digit(text) == 10:
                    ten_votes += 1
    for angle in (90, 270):
        rotated_crop = (
            cv2.rotate(crop, cv2.ROTATE_90_CLOCKWISE)
            if angle == 90
            else cv2.rotate(crop, cv2.ROTATE_90_COUNTERCLOCKWISE)
        )
        for text, conf in easyocr_digits(rotated_crop):
            if conf < 0.2:
                continue
            if parse_rotated_ten(text) == 10:
                ten_votes += 1
    if ten_votes >= 2:
        return "10"
    if single_candidates:
        best = max(set(single_candidates), key=single_candidates.count)
        return str(best)
    if ten_votes >= 1 and detect_vertical_10(digit_mask):
        return "10"
    if detect_vertical_10(digit_mask):
        return "10"
    return ""


def encode_png_base64(img: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        return ""
    return base64.b64encode(buf.tobytes()).decode("ascii")


def write_overlay(
    path: Path,
    img: np.ndarray,
    green_box: Optional[Box],
    black_box: Optional[Box],
    green_text: str,
    black_text: str,
) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    height, width = img.shape[:2]
    data_uri = encode_png_base64(img)
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'  <image href="data:image/png;base64,{data_uri}" x="0" y="0" width="{width}" height="{height}" />',
    ]
    if green_box:
        lines.append(
            f'  <rect x="{green_box.x}" y="{green_box.y}" width="{green_box.w}" height="{green_box.h}" '
            f'stroke="#00a651" stroke-width="3" fill="none" />'
        )
        if green_text:
            tx = green_box.x
            ty = max(14, green_box.y - 4)
            lines.append(
                f'  <text x="{tx}" y="{ty}" font-size="14" font-family="Arial" fill="#00a651">{green_text}</text>'
            )
    if black_box:
        lines.append(
            f'  <rect x="{black_box.x}" y="{black_box.y}" width="{black_box.w}" height="{black_box.h}" '
            f'stroke="#ff3b30" stroke-width="3" fill="none" />'
        )
        if black_text:
            tx = black_box.x
            ty = max(14, black_box.y - 4)
            lines.append(
                f'  <text x="{tx}" y="{ty}" font-size="14" font-family="Arial" fill="#ff3b30">{black_text}</text>'
            )
    lines.append("</svg>")
    (OUT_DIR / f"{path.stem}.svg").write_text("\n".join(lines), encoding="utf-8")


def build_html(results: List[NumberBoxResult]) -> str:
    lines = [
        "<!doctype html>",
        '<html lang="zh">',
        "<head>",
        "  <meta charset=\"utf-8\" />",
        "  <title>Patchwork Label Number Boxes</title>",
        "  <style>",
        "    body { font-family: \"Helvetica Neue\", Arial, sans-serif; margin: 24px; background: #f6f4f0; color: #222; }",
        "    h1 { font-size: 20px; margin-bottom: 16px; }",
        "    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }",
        "    .card { background: #fff; border-radius: 12px; padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }",
        "    .title { font-size: 13px; margin-bottom: 8px; word-break: break-all; }",
        "    .meta { color: #666; font-size: 12px; margin-bottom: 8px; }",
        "    .pane { padding: 8px; background: repeating-conic-gradient(#eee 0% 25%, #ddd 0% 50%) 50% / 16px 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; min-height: 120px; }",
        "    .pane img { max-width: 100%; max-height: 160px; object-fit: contain; }",
        "  </style>",
        "</head>",
        "<body>",
        "  <h1>Patchwork 标签数字框定位</h1>",
        "  <div class=\"grid\">",
    ]

    for r in results:
        lines += [
            "    <div class=\"card\">",
            f"      <div class=\"title\">{r.file}</div>",
            f"      <div class=\"meta\">flipped {r.flipped} · green {r.green_text or '?'} · black {r.black_text or '?'}</div>",
            f"      <div class=\"pane\"><img src=\"label_number_overlays/{Path(r.file).stem}.svg\" alt=\"{r.file}\" /></div>",
            "    </div>",
        ]

    lines += [
        "  </div>",
        "</body>",
        "</html>",
    ]
    return "\n".join(lines)


def apply_text_override(
    file_name: str,
    green_text: str,
    black_text: str,
) -> Tuple[str, str]:
    override = MANUAL_TEXT_OVERRIDES.get(file_name)
    if override is None:
        return green_text, black_text
    green_override, black_override = override
    if green_override is not None:
        green_text = green_override
    if black_override is not None:
        black_text = black_override
    return green_text, black_text


def main() -> None:
    results: List[NumberBoxResult] = []
    ORIENTED_DIR.mkdir(parents=True, exist_ok=True)

    for path in sorted(LABEL_DIR.glob("*.png")):
        if path.name.startswith("_review_"):
            continue
        img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if img is None:
            continue
        if img.shape[2] == 3:
            img = np.dstack([img, np.full(img.shape[:2], 255, dtype=np.uint8)])
        img = alpha_crop(img)

        flipped = False
        if orientation_flip_needed(img):
            img = cv2.rotate(img, cv2.ROTATE_180)
            flipped = True

        cv2.imwrite(str(ORIENTED_DIR / path.name), img)

        green_box, black_box = detect_number_boxes(img)
        if green_box is None or suspicious_box(img, green_box, "green"):
            green_box = template_number_box(img, "green")
        if black_box is None or suspicious_box(img, black_box, "black"):
            black_box = template_number_box(img, "black")
        if path.name in NO_GREEN_FILES:
            green_box = None

        green_text = ""
        if green_box is not None:
            crop = crop_with_pad(img, green_box, pad=4)
            green_text = ocr_digit(crop[:, :, :3], mask_kind="green")

        black_text = ""
        if black_box is not None:
            crop = crop_with_pad(img, black_box, pad=4)
            black_text = ocr_digit(crop[:, :, :3], mask_kind="dark")

        green_text, black_text = apply_text_override(path.name, green_text, black_text)

        write_overlay(path, img, green_box, black_box, green_text, black_text)

        results.append(
            NumberBoxResult(
                file=path.name,
                flipped=flipped,
                green_box=green_box,
                black_box=black_box,
                green_text=green_text,
                black_text=black_text,
            )
        )

    out_json = [
        {
            "file": r.file,
            "flipped": r.flipped,
            "green_box": None if r.green_box is None else r.green_box.__dict__,
            "black_box": None if r.black_box is None else r.black_box.__dict__,
            "green_text": r.green_text,
            "black_text": r.black_text,
        }
        for r in results
    ]
    (ROOT / "label_number_boxes.json").write_text(
        json.dumps(out_json, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (ROOT / "label_number_compare.html").write_text(build_html(results), encoding="utf-8")


if __name__ == "__main__":
    main()
