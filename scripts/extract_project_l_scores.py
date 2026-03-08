from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextContainer
from PIL import Image

PDF_PATH = Path("assets/project_l/project_l_puzzle_list.pdf")
IMG_PATH = Path("assets/project_l/project_l_puzzle_list.png")
JSON_PATH = Path("assets/project_l/project_l_puzzles_base.json")

# Large rendered PNG; disable decompression bomb limit.
Image.MAX_IMAGE_PIXELS = None

# Tuned offsets (in image pixels) from card id text position
OFFSET_X = 65
OFFSET_Y = 20
ROI_SIZE = 185

# Calibrated with user-verified cards.
KNOWN_POINTS = {
    1: 2,
    2: 2,
    3: 2,
    4: 2,
    5: 2,
    6: 2,
    7: 2,
    8: 2,
    9: 1,
    20: 1,
    22: 0,  # blank
    33: 5,
    38: 4,
    45: 3,
}


def load_card_positions():
    page = next(extract_pages(str(PDF_PATH)))
    card_positions: dict[int, tuple[float, float, float, float]] = {}
    for el in page:
        if not isinstance(el, LTTextContainer):
            continue
        text = el.get_text().strip()
        if not text.isdigit():
            continue
        cid = int(text)
        if not (1 <= cid <= 52):
            continue
        x0, y0, x1, y1 = el.bbox
        height = round(y1 - y0, 1)
        # Card id labels in left 8-column grid
        if height == 16.0 and x0 < 1800:
            if cid not in card_positions:
                card_positions[cid] = (x0, y0, x1, y1)
    if len(card_positions) != 52:
        raise RuntimeError(f"Expected 52 card labels, got {len(card_positions)}")
    return card_positions, page.bbox[2], page.bbox[3]


def extract_digit_masks(arr: np.ndarray, card_positions, page_w: float, page_h: float):
    img_h, img_w = arr.shape
    scale_x = img_w / page_w
    scale_y = img_h / page_h

    masks = []
    ids = []

    for cid in sorted(card_positions):
        x0, y0, x1, y1 = card_positions[cid]
        px = int(x0 * scale_x)
        py = int((page_h - y1) * scale_y)

        left = px + OFFSET_X
        top = py + OFFSET_Y
        right = left + ROI_SIZE
        bottom = top + ROI_SIZE
        if left < 0 or top < 0 or right > img_w or bottom > img_h:
            raise RuntimeError(f"ROI out of bounds for card {cid}")

        roi = arr[top:bottom, left:right]
        mask = roi != 32  # digit pixels differ from dark background

        # Largest connected component
        h, w = mask.shape
        visited = np.zeros_like(mask, dtype=bool)
        best = None
        for y in range(h):
            for x in range(w):
                if mask[y, x] and not visited[y, x]:
                    stack = [(y, x)]
                    visited[y, x] = True
                    minx = maxx = x
                    miny = maxy = y
                    count = 0
                    while stack:
                        cy, cx = stack.pop()
                        count += 1
                        if cx < minx:
                            minx = cx
                        if cx > maxx:
                            maxx = cx
                        if cy < miny:
                            miny = cy
                        if cy > maxy:
                            maxy = cy
                        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not visited[ny, nx]:
                                visited[ny, nx] = True
                                stack.append((ny, nx))
                    if count < 50:
                        continue
                    if best is None or count > best[0]:
                        best = (count, minx, miny, maxx, maxy)
        if best is None:
            raise RuntimeError(f"No digit component found for card {cid}")
        _, minx, miny, maxx, maxy = best
        digit_mask = mask[miny : maxy + 1, minx : maxx + 1]

        # Normalize to 28x28
        img_mask = Image.fromarray((digit_mask * 255).astype("uint8"))
        img_mask = img_mask.resize((28, 28), resample=Image.NEAREST)
        norm = (np.array(img_mask) > 0).astype(np.float32)
        masks.append(norm)
        ids.append(cid)

    return np.array(masks), ids


def build_prototypes(masks: np.ndarray, ids: list[int]):
    # Use known cards as prototypes for 1-NN classification.
    prototypes: list[tuple[np.ndarray, int]] = []
    for cid, digit in KNOWN_POINTS.items():
        if cid not in ids:
            raise RuntimeError(f"Known card {cid} not in extracted ids")
        idx = ids.index(cid)
        prototypes.append((masks[idx], digit))
    return prototypes


def main():
    card_positions, page_w, page_h = load_card_positions()
    img = Image.open(IMG_PATH).convert("L")
    arr = np.array(img)

    masks, ids = extract_digit_masks(arr, card_positions, page_w, page_h)
    prototypes = build_prototypes(masks, ids)

    points_by_id: dict[int, int] = {}
    for idx, cid in enumerate(ids):
        mask = masks[idx]
        best_digit = None
        best_dist = None
        for proto_mask, digit in prototypes:
            dist = float(((mask - proto_mask) ** 2).sum())
            if best_dist is None or dist < best_dist:
                best_dist = dist
                best_digit = digit
        points_by_id[cid] = int(best_digit)

    data = json.loads(JSON_PATH.read_text())
    for item in data:
        cid = item["id"]
        item["points"] = points_by_id[cid]

    JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

    # Print a small summary
    counts = {}
    for v in points_by_id.values():
        counts[v] = counts.get(v, 0) + 1
    print("points counts", dict(sorted(counts.items())))


if __name__ == "__main__":
    main()
