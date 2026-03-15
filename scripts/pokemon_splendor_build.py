import csv
import json
import math
import difflib
import re
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
try:
    import torch
except Exception:
    torch = None
try:
    from PIL import Image
except Exception:
    Image = None
from rapidocr_onnxruntime import RapidOCR
try:
    import open_clip
except Exception:
    open_clip = None

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except Exception:
    easyocr = None
    EASYOCR_AVAILABLE = False
EASYOCR_READER = None

SCRIPT_DIR = Path(__file__).resolve().parent
ASSETS_DIR = Path("assets/pokemon_splendor")
CARDS_DIR = ASSETS_DIR / "cards"
META_PATH = CARDS_DIR / "cards_meta.json"
NAMES_PATH = ASSETS_DIR / "pokemon_names.json"
SPECIES_PATH = ASSETS_DIR / "pokemon_species.csv"
OUTPUT_PATH = ASSETS_DIR / "cards.json"
DEBUG_PATH = ASSETS_DIR / "cards_debug.json"
REPORT_PATH = ASSETS_DIR / "cards_review.json"
CORRECT_PATH = SCRIPT_DIR / "pokemon_splendor_correct.txt"
BAD_IDS_PATH = SCRIPT_DIR / "pokemon_splendor_bad_ids.txt"

# Manual evolution validation entries (card_id -> expected fields)
# Supported keys: requirements, target_en, target_zh
UPGRADE_GOLD = {
    "scene_001_01": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_001_02": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_001_03": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_001_04": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_001_05": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_001_06": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_001_07": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_001_08": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_001_09": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_001_10": {
        "requirements": {},
        "target_en": ["Vaporeon", "Jolteon", "Flareon"],
        "target_zh": ["水伊布", "雷伊布", "火伊布"],
    },
    "scene_002_05": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_002_06": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_002_14": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_003_03": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_003_06": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_003_14": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_004_03": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_004_05": {"requirements": {}, "target_en": "Poliwrath", "target_zh": "蚊香泳士"},
    "scene_004_13": {"requirements": {}, "target_en": "Cloyster", "target_zh": "刺甲贝"},
    "scene_004_14": {"requirements": {}, "target_en": "Metapod", "target_zh": "铁甲蛹"},
    "scene_005_05": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_005_06": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_005_14": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_006_05": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_006_06": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_006_14": {"requirements": {}, "target_en": None, "target_zh": None},
    "scene_002_02": {"requirements": {"blue": 4}, "target_en": "Venusaur", "target_zh": "妙蛙花"},
    "scene_002_03": {"requirements": {"blue": 2}, "target_en": "Nidorina", "target_zh": "尼多娜"},
    "scene_002_04": {"requirements": {"blue": 4}, "target_en": "Nidorina", "target_zh": "尼多娜"},
    "scene_002_08": {"requirements": {"blue": 4}, "target_en": "Nidorina", "target_zh": "尼多娜"},
    "scene_002_09": {"requirements": {"pink": 3}, "target_en": "Ivysaur", "target_zh": "妙蛙草"},
    "scene_002_10": {"requirements": {"blue": 2}, "target_en": "Nidorina", "target_zh": "尼多娜"},
    "scene_002_11": {"requirements": {"blue": 2}, "target_en": "Nidorina", "target_zh": "尼多娜"},
    "scene_002_15": {"requirements": {"red": 3}, "target_en": "Gengar", "target_zh": "耿鬼"},
    "scene_002_01": {"requirements": {"pink": 3}, "target_en": "Ivysaur", "target_zh": "妙蛙草"},
    "scene_002_07": {"requirements": {"blue": 4}, "target_en": "Venusaur", "target_zh": "妙蛙花"},
    "scene_002_13": {"requirements": {"black": 3}, "target_en": "Haunter", "target_zh": "鬼斯通"},
    "scene_003_07": {"requirements": {"pink": 4}, "target_en": "Blastoise", "target_zh": "水箭龟"},
    "scene_003_13": {"requirements": {"yellow": 3}, "target_en": "Machoke", "target_zh": "豪力"},
    "scene_003_04": {"requirements": {"pink": 2}, "target_en": "Weepinbell", "target_zh": "口呆花"},
    "scene_003_05": {"requirements": {"pink": 4}, "target_en": "Victreebel", "target_zh": "大食花"},
    "scene_003_08": {"requirements": {"pink": 4}, "target_en": "Victreebel", "target_zh": "大食花"},
    "scene_003_10": {"requirements": {"pink": 2}, "target_en": "Weepinbell", "target_zh": "口呆花"},
    "scene_003_11": {"requirements": {"pink": 2}, "target_en": "Weepinbell", "target_zh": "口呆花"},
    "scene_004_12": {"requirements": {"blue": 3}, "target_en": "Butterfree", "target_zh": "巴大蝶"},
    "scene_004_01": {"requirements": {"red": 3}, "target_en": "Kadabra", "target_zh": "勇基拉"},
    "scene_004_06": {"requirements": {"red": 3}, "target_en": "Alakazam", "target_zh": "胡地"},
    "scene_004_08": {"requirements": {"black": 4}, "target_en": "Poliwrath", "target_zh": "蚊香泳士"},
    "scene_004_11": {"requirements": {"yellow": 3}, "target_en": "Butterfree", "target_zh": "巴大蝶"},
    "scene_004_15": {"requirements": {"yellow": 3}, "target_en": "Butterfree", "target_zh": "巴大蝶"},
    "scene_005_02": {"requirements": {"red": 4}, "target_en": "Charizard", "target_zh": "喷火龙"},
    "scene_005_03": {"requirements": {"pink": 2}, "target_en": "Pidgeotto", "target_zh": "比比鸟"},
    "scene_005_04": {"requirements": {"red": 4}, "target_en": "Pidgeot", "target_zh": "大比鸟"},
    "scene_005_07": {"requirements": {"red": 4}, "target_en": "Charizard", "target_zh": "喷火龙"},
    "scene_005_10": {"requirements": {"red": 2}, "target_en": None, "target_zh": None},
    "scene_005_11": {"requirements": {"red": 2}, "target_en": "Pidgeot", "target_zh": "大比鸟"},
    "scene_005_16": {"requirements": {"pink": 3}, "target_en": "Graveler", "target_zh": "隆隆石"},
    "scene_006_10": {"requirements": {"blue": 3}, "target_en": "Dragonair", "target_zh": "哈克龙"},
    "scene_006_12": {"requirements": {"red": 3}, "target_en": "Kakuna", "target_zh": "铁壳蛹"},
    "scene_006_15": {"requirements": {"pink": 3}, "target_en": "Exeggutor", "target_zh": "椰蛋树"},
    "scene_006_16": {"requirements": {"red": 3}, "target_en": "Kakuna", "target_zh": "铁壳蛹"},
    "scene_005_01": {"requirements": {"yellow": 3}, "target_en": "Charmeleon", "target_zh": "火恐龙"},
    "scene_005_09": {"requirements": {"yellow": 3}, "target_en": "Charmeleon", "target_zh": "火恐龙"},
    "scene_005_13": {"requirements": {"pink": 3}, "target_en": "Graveler", "target_zh": "隆隆石"},
    "scene_006_01": {"requirements": {"blue": 3}, "target_en": "Dragonair", "target_zh": "哈克龙"},
    "scene_006_02": {"requirements": {"yellow": 4}, "target_en": "Dragonite", "target_zh": "快龙"},
    "scene_006_03": {"requirements": {"yellow": 2}, "target_en": "Gloom", "target_zh": "臭臭花"},
    "scene_006_04": {"requirements": {"yellow": 4}, "target_en": None, "target_zh": None},
    "scene_006_07": {"requirements": {"yellow": 4}, "target_en": "Dragonite", "target_zh": "快龙"},
    "scene_006_08": {"requirements": {"yellow": 2}, "target_en": "Gloom", "target_zh": "臭臭花"},
    "scene_006_09": {"requirements": {"yellow": 4}, "target_en": None, "target_zh": None},
    "scene_006_11": {"requirements": {"yellow": 2}, "target_en": "Gloom", "target_zh": "臭臭花"},
    "scene_006_13": {"requirements": {"pink": 3}, "target_en": "Butterfree", "target_zh": "巴大蝶"},
}

LEGENDARY_EN = {
    "Articuno",
    "Zapdos",
    "Moltres",
    "Mewtwo",
    "Mew",
}

COLOR_CENTERS = {
    "red": 25.0,
    "yellow": 45.0,
    "green": 110.0,
    "blue": 140.0,
    "pink": 165.0,
}

BONUS_ALLOWED_COLORS = {"red", "blue", "yellow", "pink", "black"}

# cost colors include purple (wild)
COST_COLOR_CENTERS = {
    "red": 25.0,
    "yellow": 45.0,
    "green": 110.0,
    "blue": 140.0,
    "pink": 165.0,
    "purple": 150.0,
}

BALL_LABELS = [
    ("red", "poké ball"),
    ("blue", "great ball"),
    ("yellow", "ultra ball"),
    ("green", "safari ball"),
    ("pink", "heal ball"),
    ("black", "master ball"),
]

BONUS_OVERRIDES = {
    "scene_002_04": ["yellow"],
    "scene_001_01": ["yellow", "yellow"],
    "scene_001_02": ["red", "red"],
    "scene_001_03": ["pink", "pink"],
    "scene_001_04": ["blue", "blue"],
    "scene_001_05": ["black", "black"],
    "scene_003_04": ["red"],
    "scene_004_05": ["pink"],
    "scene_005_08": ["blue"],
    "scene_006_16": ["black"],
    "scene_001_08": ["pink", "pink"],
    "scene_001_06": ["yellow", "yellow"],
    "scene_001_10": ["black", "black"],
    "scene_001_09": ["blue", "blue"],
    "scene_006_12": ["black"],
    "scene_006_01": ["black"],
    "scene_005_14": ["blue"],
    "scene_004_09": ["pink"],
}

SCENE_BONUS_MAP = {
    "scene_002.png": ["yellow"],
    "scene_003.png": ["red"],
    "scene_004.png": ["pink"],
    "scene_005.png": ["blue"],
    "scene_006.png": ["black"],
}

# Manual cost fixes for known OCR edge cases (card_id -> overrides)
# Use "_replace" to fully replace cost, otherwise values update existing cost.
COST_OVERRIDES = {
    "scene_001_02": {"_replace": {"purple": 1, "pink": 3, "blue": 3, "yellow": 3}},
    "scene_001_06": {"_replace": {"purple": 1, "blue": 3, "pink": 2}},
    "scene_001_07": {"_replace": {"purple": 1, "black": 3, "blue": 2}},
    "scene_001_08": {"_replace": {"purple": 1, "red": 3, "black": 2}},
    "scene_001_09": {"_replace": {"purple": 1, "pink": 3, "yellow": 2}},
    "scene_001_10": {"_replace": {"purple": 1, "yellow": 3, "red": 2}},
    "scene_002_06": {"_replace": {"red": 7, "pink": 3}},
    "scene_002_07": {"_replace": {"red": 4, "pink": 4, "blue": 1}},
    "scene_002_16": {"_replace": {"blue": 1, "red": 1, "pink": 1, "black": 1}},
    "scene_003_02": {"_replace": {"red": 6}},
    "scene_003_13": {"_replace": {"yellow": 2, "pink": 1, "black": 1}},
    "scene_003_14": {"_replace": {"yellow": 6, "pink": 4}},
    "scene_004_05": {"_replace": {"pink": 5, "yellow": 2, "red": 2}},
    "scene_004_08": {"_replace": {"black": 3, "blue": 2, "red": 2}},
    "scene_004_14": {"_replace": {"purple": 1, "blue": 1, "yellow": 1, "black": 1}},
    "scene_005_07": {"_replace": {"yellow": 4, "black": 4, "red": 1}},
    "scene_005_10": {"_replace": {"blue": 2, "red": 2}},
    "scene_005_11": {"_replace": {"pink": 3}},
    "scene_005_13": {"_replace": {"red": 2, "yellow": 1, "blue": 1}},
    "scene_005_14": {"_replace": {"pink": 6, "red": 4}},
    "scene_006_02": {"_replace": {"black": 6}},
    "scene_006_05": {"_replace": {"black": 5, "blue": 2, "pink": 2}},
    "scene_006_10": {"_replace": {"yellow": 3, "red": 2}},
    "scene_006_15": {"_replace": {"red": 5, "blue": 2, "pink": 2}},
    "scene_006_04": {"_replace": {"black": 3, "blue": 2, "red": 2}},
}

NAME_BOX_Y = 140
NAME_BOX_X = 60

VP_X_MAX = 30
VP_Y_MAX = 40

COST_Y_MIN = 80
COST_X_MAX = 40
REQ_Y_MAX = 80
REQ_X_MIN = 30
REQ_ROI_X0_RATIO = 0.33
REQ_ROI_X1_RATIO = 0.68
REQ_ROI_Y1_RATIO = 0.32

OCR_BOX_THRESH = 0.2
OCR_TEXT_SCORE = 0.1

# Cost trapezoid OCR windows (relative to card size 129x170)
COST_ROW_Y_RATIOS = [0.4706, 0.6176, 0.7647, 0.9118]
COST_ROW_X_MAX_RATIO = 0.24
COST_ROW_Y_PAD = 10
COST_ROW_SCALE = 4
COST_ROW_EXPECTED_X_RATIO = 0.12
COST_COLOR_PAD = 6
COST_COLOR_X_MAX_RATIO = 0.22
COST_TRAPEZOID_MIN_AREA = 70
DIGIT_TEMPLATE_SIZE = (20, 28)
DIGIT_TEMPLATE_MIN_SCORE = 0.6
DIGIT_TEMPLATE_FALLBACK_SCORE = 0.6
DIGIT_ALLOWED_VALUES = {1, 2, 3, 4, 5, 6, 7}
DIGIT_TEMPLATE_SCAN_MIN_AREA = 150
DIGIT_TEMPLATE_TOPK = 8
REQ_DIGIT_ALLOWED_VALUES = {1, 2, 3, 4, 5}
REQ_DIGIT_TEMPLATE_MIN_SCORE = 0.85
REQ_DIGIT_TEMPLATE_TOPK = 6
REQ_DIGIT_TEMPLATE_MATCH_MIN_SCORE = 0.78
REQ_DIGIT_TEMPLATE_MATCH_MIN_SCORE_BLOCK = 0.6
REQ_DIGIT_BOX_PAD = 3
REQ_USE_FIXED_DIGIT_BOX = True
# Fixed digit box relative to requirement ROI (based on scene_005_08 green box after padding)
REQ_FIXED_BOX_IN_ROI = (11, 28, 19, 38)
REQ_BLOCK_MIN_AREA = 150
REQ_BLOCK_MAX_AREA = 1400


def load_names():
    data = json.loads(NAMES_PATH.read_text())
    names_en = [d["english"] for d in data]
    names_zh = [d["chinese"] for d in data]
    id_by_en = {d["english"]: d["id"] for d in data}
    zh_by_en = {d["english"]: d["chinese"] for d in data}
    en_by_id = {d["id"]: d["english"] for d in data}
    return names_en, names_zh, id_by_en, zh_by_en, en_by_id


def load_evolution_map(en_by_id):
    evolves_from = {}
    with SPECIES_PATH.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                species_id = int(row["id"])
            except (TypeError, ValueError):
                continue
            if species_id > 151:
                continue
            prev = row.get("evolves_from_species_id")
            evolves_from[species_id] = int(prev) if prev else None

    next_map = defaultdict(list)
    for species_id, prev in evolves_from.items():
        if prev:
            next_map[prev].append(species_id)

    next_en = defaultdict(list)
    prev_en = {}
    for species_id, prev in evolves_from.items():
        en = en_by_id.get(species_id)
        if not en:
            continue
        prev_en[en] = en_by_id.get(prev) if prev else None
        for nxt in next_map.get(species_id, []):
            nxt_en = en_by_id.get(nxt)
            if nxt_en:
                next_en[en].append(nxt_en)

    return prev_en, next_en


def load_bad_ids(path=BAD_IDS_PATH):
    if not path.exists():
        return set()
    return {line.strip() for line in path.read_text().splitlines() if line.strip()}


def circular_hue_distance(a, b):
    diff = abs(a - b)
    return min(diff, 180 - diff)


def classify_color(h, s, v, centers):
    if v < 50 or s < 40:
        return None
    best = None
    best_dist = 999
    for name, center in centers.items():
        dist = circular_hue_distance(h, center)
        if dist < best_dist:
            best_dist = dist
            best = name
    return best


def sample_hsv(img, cx, cy, r=8):
    h, w = img.shape[:2]
    x0 = max(0, cx - r)
    y0 = max(0, cy - r)
    x1 = min(w, cx + r)
    y1 = min(h, cy + r)
    roi = img[y0:y1, x0:x1]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    mask = (hsv[:, :, 1] > 50) & (hsv[:, :, 2] > 50)
    if mask.sum() == 0:
        mean = hsv.mean(axis=(0, 1))
    else:
        mean = hsv[mask].mean(axis=0)
    return float(mean[0]), float(mean[1]), float(mean[2])


def sample_hsv_ring(img, cx, cy, r):
    h, w = img.shape[:2]
    x0 = max(0, cx - r - 2)
    y0 = max(0, cy - r - 2)
    x1 = min(w, cx + r + 2)
    y1 = min(h, cy + r + 2)
    roi = img[y0:y1, x0:x1]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    ys, xs = np.ogrid[y0:y1, x0:x1]
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    mask = (dist >= r * 0.6) & (dist <= r * 0.95)
    mask = mask & (hsv[:, :, 1] > 50) & (hsv[:, :, 2] > 50)
    if mask.sum() == 0:
        mean = hsv.mean(axis=(0, 1))
    else:
        mean = hsv[mask].mean(axis=0)
    return float(mean[0]), float(mean[1]), float(mean[2])


def dominant_hue_in_circle(img, cx, cy, r):
    h, w = img.shape[:2]
    x0 = max(0, cx - r - 2)
    y0 = max(0, cy - r - 2)
    x1 = min(w, cx + r + 2)
    y1 = min(h, cy + r + 2)
    roi = img[y0:y1, x0:x1]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    ys, xs = np.ogrid[y0:y1, x0:x1]
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    mask = dist <= r * 0.95
    # drop low-saturation/low-value pixels (white/black highlights)
    mask = mask & (hsv[:, :, 1] > 40) & (hsv[:, :, 2] > 60)
    if mask.sum() == 0:
        return sample_hsv(img, cx, cy, r)
    hues = hsv[:, :, 0][mask]
    sats = hsv[:, :, 1][mask]
    vals = hsv[:, :, 2][mask]
    hist = np.bincount(hues, weights=sats, minlength=180)
    peak = int(hist.argmax())
    return float(peak), float(np.mean(sats)), float(np.mean(vals))


def hue_hist_in_circle(img, cx, cy, r):
    h, w = img.shape[:2]
    x0 = max(0, cx - r - 2)
    y0 = max(0, cy - r - 2)
    x1 = min(w, cx + r + 2)
    y1 = min(h, cy + r + 2)
    roi = img[y0:y1, x0:x1]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    ys, xs = np.ogrid[y0:y1, x0:x1]
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    mask = dist <= r * 0.95
    # focus on colored pixels (ignore white/black highlights)
    mask = mask & (hsv[:, :, 1] > 40) & (hsv[:, :, 2] > 60)
    if mask.sum() == 0:
        return None
    hues = hsv[:, :, 0][mask]
    weights = hsv[:, :, 1][mask].astype(np.float32)
    hist = np.bincount(hues, weights=weights, minlength=180).astype(np.float32)
    total = float(hist.sum())
    if total > 0:
        hist /= total
    return hist


def cosine_similarity(a, b):
    denom = (np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def crop_ball(img, cx, cy, r):
    h, w = img.shape[:2]
    x0 = max(0, cx - r - 2)
    y0 = max(0, cy - r - 2)
    x1 = min(w, cx + r + 2)
    y1 = min(h, cy + r + 2)
    roi = img[y0:y1, x0:x1].copy()
    if roi.size == 0:
        return None, None
    # build circular mask
    ys, xs = np.ogrid[y0:y1, x0:x1]
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    mask = (dist <= r * 0.98).astype(np.uint8)
    # align mask to roi
    mask = mask.reshape(roi.shape[0], roi.shape[1])
    return roi, mask


def bonus_feature(img, cx, cy, r):
    roi, mask = crop_ball(img, cx, cy, r)
    if roi is None:
        return None

    # resize for stable features
    roi_small = cv2.resize(roi, (24, 24), interpolation=cv2.INTER_CUBIC)
    mask_small = cv2.resize(mask, (24, 24), interpolation=cv2.INTER_NEAREST)
    mask_small = (mask_small > 0).astype(np.float32)

    # RGB feature (masked)
    rgb = cv2.cvtColor(roi_small, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    rgb *= mask_small[:, :, None]
    rgb_feat = rgb.flatten()
    if np.linalg.norm(rgb_feat) > 0:
        rgb_feat = rgb_feat / np.linalg.norm(rgb_feat)

    # HSV histogram (masked)
    hsv = cv2.cvtColor(roi_small, cv2.COLOR_BGR2HSV)
    h = hsv[:, :, 0]
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    valid = mask_small > 0
    if valid.sum() == 0:
        return None
    h_vals = h[valid]
    s_vals = s[valid]
    v_vals = v[valid]

    # hist bins
    h_bins = 12
    s_bins = 4
    v_bins = 4
    h_hist, _ = np.histogram(h_vals, bins=h_bins, range=(0, 180))
    s_hist, _ = np.histogram(s_vals, bins=s_bins, range=(0, 256))
    v_hist, _ = np.histogram(v_vals, bins=v_bins, range=(0, 256))
    hist = np.concatenate([h_hist, s_hist, v_hist]).astype(np.float32)
    if hist.sum() > 0:
        hist = hist / hist.sum()

    mean_s = float(np.mean(s_vals))
    mean_v = float(np.mean(v_vals))

    return np.concatenate([rgb_feat, hist, [mean_s / 255.0, mean_v / 255.0]]).astype(np.float32)


def find_bonus_circles(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 5)
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=10,
        param1=50,
        param2=18,
        minRadius=6,
        maxRadius=14,
    )
    if circles is None:
        return []
    circles = circles[0]
    candidates = [
        (int(round(x)), int(round(y)), int(round(r)))
        for x, y, r in circles
        if 10 <= y <= 35 and x > 60
    ]
    selected = []
    for x, y, r in candidates:
        if any((x - sx) ** 2 + (y - sy) ** 2 < 25 for sx, sy, sr in selected):
            continue
        selected.append((x, y, r))
    return selected


def build_bonus_templates(meta, overrides):
    templates = {color: [] for color in BONUS_ALLOWED_COLORS}
    for d in meta:
        card_id = Path(d["card_image"]).stem
        colors = overrides.get(card_id)
        if not colors:
            continue
        img = cv2.imread(str(CARDS_DIR / d["card_image"]))
        circles = sorted(find_bonus_circles(img), key=lambda c: c[0])
        if not circles:
            continue

        # pair circles with provided colors
        pairs = []
        if len(colors) == len(circles):
            pairs = list(zip(circles, colors))
        elif len(colors) == 1:
            pairs = [(circles[0], colors[0])]
        else:
            # fallback: pair by order up to min length
            pairs = list(zip(circles[: len(colors)], colors))

        for (x, y, r), color in pairs:
            if color not in templates:
                continue
            feat = bonus_feature(img, x, y, r)
            if feat is not None:
                templates[color].append(feat)
    return templates


def template_scores(feat, templates):
    scores = []
    for color, feats in templates.items():
        best = -1.0
        for t in feats:
            score = cosine_similarity(feat, t)
            if score > best:
                best = score
        if best >= 0:
            scores.append((color, best))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores


def hue_based_color(img, cx, cy, r):
    # return a coarse hue-based color (no green)
    hist = hue_hist_in_circle(img, cx, cy, r)
    if hist is None:
        return None
    peak = int(hist.argmax())
    roi, mask = crop_ball(img, cx, cy, r)
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    valid = mask > 0
    s_vals = hsv[:, :, 1][valid]
    v_vals = hsv[:, :, 2][valid]
    mean_s = float(np.mean(s_vals)) if s_vals.size else 0.0
    mean_v = float(np.mean(v_vals)) if v_vals.size else 0.0
    if mean_s < 50 and mean_v < 140:
        return "black"
    # map hue to nearest allowed (no green)
    allowed = {
        "red": COLOR_CENTERS["red"],
        "yellow": COLOR_CENTERS["yellow"],
        "blue": COLOR_CENTERS["blue"],
        "pink": COLOR_CENTERS["pink"],
    }
    best = None
    best_dist = 999
    for name, center in allowed.items():
        dist = circular_hue_distance(peak, center)
        if dist < best_dist:
            best = name
            best_dist = dist
    return best

def classify_bonus_ball(img, cx, cy, r, model, preprocess, ball_text_features, ball_colors):
    h, w = img.shape[:2]
    x0 = max(0, cx - r - 2)
    y0 = max(0, cy - r - 2)
    x1 = min(w, cx + r + 2)
    y1 = min(h, cy + r + 2)
    crop = img[y0:y1, x0:x1]
    if crop.size == 0:
        return None
    crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(crop)
    image = preprocess(pil).unsqueeze(0)
    with torch.no_grad():
        image_features = model.encode_image(image)
        image_features /= image_features.norm(dim=-1, keepdim=True)
        logits = (image_features @ ball_text_features.T).squeeze(0)
        idx = int(torch.argmax(logits).item())
    return ball_colors[idx]


def detect_bonus_colors(img, templates, model, preprocess, ball_text_features, ball_colors):
    # Bonus icons sit in a top band; some cards have two bonuses.
    bonuses = []
    bonus_scores = []
    candidates = find_bonus_circles(img)
    if candidates:
        # slots for up to two bonuses
        slots = [
            (78, 68, 90),   # left slot
            (109, 95, 120), # right slot
        ]
        for target_x, x_min, x_max in slots:
            slot = [c for c in candidates if x_min <= c[0] <= x_max]
            if not slot:
                continue
            x, y, r = min(slot, key=lambda c: abs(c[0] - target_x))

            # template histogram match (primary)
            feat = bonus_feature(img, x, y, r)
            color = None
            score = 0.0
            if feat is not None and templates:
                scores = template_scores(feat, templates)
                if scores:
                    color, score = scores[0]

            # CLIP fallback if no template match
            if not color:
                color = classify_bonus_ball(
                    img, x, y, r, model, preprocess, ball_text_features, ball_colors
                )
                score = 0.0

            # hue-based tie-breaker / low-confidence override
            hue_color = hue_based_color(img, x, y, r)
            if feat is not None and hue_color:
                if scores and len(scores) > 1 and (scores[0][1] - scores[1][1] < 0.02):
                    color = hue_color
                elif score < 0.85:
                    color = hue_color

            if color in BONUS_ALLOWED_COLORS:
                bonuses.append(color)
                bonus_scores.append((color, float(score)))

    if not bonuses:
        # fallback to single bonus sample (top-right)
        h, w = img.shape[:2]
        cx = int(w * 0.85)
        cy = int(h * 0.12)
        hue, sat, val = sample_hsv(img, cx, cy, r=10)
        color = classify_color(hue, sat, val, COLOR_CENTERS)
        if color in BONUS_ALLOWED_COLORS:
            bonuses.append(color)
            bonus_scores.append((color, 0.0))

    # reduce to single unless we have strong evidence for double
    if len(bonuses) >= 2:
        # keep top two by score
        ranked = sorted(bonus_scores, key=lambda x: x[1], reverse=True)
        c1, s1 = ranked[0]
        c2, s2 = ranked[1]
        # only emit double if both agree and second score is confident
        if c1 == c2 and s2 >= 0.85:
            return [c1, c2], bonus_scores
        return [c1], bonus_scores

    return bonuses, bonus_scores


def clean_chinese(text):
    return "".join(re.findall(r"[\u4e00-\u9fff]+", text))


def extract_digits(res):
    digits = []
    for box, text, score in res:
        nums = re.findall(r"\d+", text)
        if not nums:
            continue
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        cx = sum(xs) / 4.0
        cy = sum(ys) / 4.0
        for num in nums:
            digits.append({
                "value": int(num),
                "cx": cx,
                "cy": cy,
                "score": float(score),
                "box": box,
            })
    return digits


def dominant_hue_in_box(img, x0, y0, x1, y1):
    h, w = img.shape[:2]
    x0 = max(0, int(x0))
    y0 = max(0, int(y0))
    x1 = min(w, int(x1))
    y1 = min(h, int(y1))
    if x1 <= x0 or y1 <= y0:
        return None
    roi = img[y0:y1, x0:x1]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    mask = (hsv[:, :, 1] > 40) & (hsv[:, :, 2] > 60)
    if mask.sum() < 10:
        mask = (hsv[:, :, 1] > 40) & (hsv[:, :, 2] > 40)
    if mask.sum() == 0:
        return None
    hues = hsv[:, :, 0][mask]
    sats = hsv[:, :, 1][mask]
    vals = hsv[:, :, 2][mask]
    hist = np.bincount(hues, weights=sats, minlength=180)
    peak = int(hist.argmax())
    return float(peak), float(np.mean(sats)), float(np.mean(vals))


def dominant_hue_in_mask(hsv, mask):
    if mask is None:
        return None
    mask = (mask > 0)
    if mask.sum() == 0:
        return None
    mask = mask & (hsv[:, :, 1] > 40) & (hsv[:, :, 2] > 60)
    if mask.sum() == 0:
        return None
    hues = hsv[:, :, 0][mask]
    sats = hsv[:, :, 1][mask]
    vals = hsv[:, :, 2][mask]
    hist = np.bincount(hues, weights=sats, minlength=180)
    peak = int(hist.argmax())
    return float(peak), float(np.mean(sats)), float(np.mean(vals))


def mean_hsv_from_mask(roi_bgr, mask):
    if mask is None:
        return None
    m = mask > 0
    if m.sum() == 0:
        return None
    mean_bgr = roi_bgr[m].mean(axis=0)
    mean_bgr = mean_bgr.reshape(1, 1, 3).astype(np.uint8)
    hsv = cv2.cvtColor(mean_bgr, cv2.COLOR_BGR2HSV)[0, 0]
    return float(hsv[0]), float(hsv[1]), float(hsv[2])


def preprocess_digit_patch(patch):
    if patch is None or patch.size == 0:
        return None
    gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    _, th = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    # crop to content
    ys, xs = np.where(th > 0)
    if ys.size > 0:
        x0, x1 = xs.min(), xs.max()
        y0, y1 = ys.min(), ys.max()
        th = th[y0:y1 + 1, x0:x1 + 1]
    th = cv2.resize(th, DIGIT_TEMPLATE_SIZE, interpolation=cv2.INTER_AREA)
    return th.astype(np.float32) / 255.0


def template_match_digit(patch, templates, exclude=None):
    if patch is None or not templates:
        return None, 0.0
    exclude = exclude or set()
    best = None
    best_score = -1.0
    for value, tmpl in templates.items():
        if tmpl is None or value in exclude:
            continue
        if isinstance(tmpl, list):
            # use the best similarity across top-K exemplars
            for tpl in tmpl:
                denom = float(np.linalg.norm(patch) * np.linalg.norm(tpl))
                if denom == 0:
                    continue
                score = float((patch * tpl).sum() / denom)
                if score > best_score:
                    best_score = score
                    best = value
        else:
            denom = float(np.linalg.norm(patch) * np.linalg.norm(tmpl))
            if denom == 0:
                continue
            score = float((patch * tmpl).sum() / denom)
            if score > best_score:
                best_score = score
                best = value
    return best, best_score


def count_digit_holes(patch):
    if patch is None:
        return 0
    # patch is float 0..1 with digit in white (1), background black (0)
    bin_img = (patch > 0.5).astype(np.uint8)
    bg = (bin_img == 0).astype(np.uint8)
    num, labels, stats, _ = cv2.connectedComponentsWithStats(bg, connectivity=8)
    holes = 0
    h, w = bin_img.shape
    for i in range(1, num):
        x, y, cw, ch, area = stats[i]
        if x == 0 or y == 0 or (x + cw) >= w or (y + ch) >= h:
            continue
        if area < 5:
            continue
        holes += 1
    return holes


def refine_template_digit(patch, templates, val, score):
    holes = count_digit_holes(patch)
    # If no holes, avoid forcing a 6; pick the best non-6 when it's close.
    if val == 6 and holes == 0:
        alt_val, alt_score = template_match_digit(patch, templates, exclude={6})
        if alt_val is not None and alt_score >= score - 0.03:
            return alt_val, alt_score, holes
    # If holes detected but template didn't pick 6, keep the original pick.
    return val, score, holes


def detect_digit_box_from_mask(roi, mask):
    if roi is None or mask is None:
        return None
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blur, 50, 150)
    edges = edges & mask
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        contours = []
    best = None
    best_area = 0.0
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 10:
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        if w < 4 or h < 6:
            continue
        if w > 24 or h > 24:
            continue
        if area > best_area:
            best_area = area
            best = (int(x), int(y), int(w), int(h))
    if best:
        return best

    # fallback: threshold dark pixels within mask
    masked = gray.copy()
    masked[mask == 0] = 255
    _, th = cv2.threshold(masked, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    th = (th > 0) & (mask > 0)
    ys, xs = np.where(th)

    def pick_component(mask_bin):
        num, labels, stats, _ = cv2.connectedComponentsWithStats(mask_bin.astype(np.uint8), connectivity=8)
        best = None
        best_area = 0
        for i in range(1, num):
            x, y, w, h, area = stats[i]
            if area < 8 or area > 220:
                continue
            if w < 3 or h < 6:
                continue
            if area > best_area:
                best_area = area
                best = (int(x), int(y), int(w), int(h))
        return best

    if ys.size > 0:
        best = pick_component(th)
        if best:
            return best

    # percentile-based fallback for low-contrast digits
    vals = gray[mask > 0]
    if vals.size == 0:
        return None
    thresh = np.percentile(vals, 20)
    dark = (gray <= thresh) & (mask > 0)
    best = pick_component(dark)
    return best


def trapezoid_top_bottom_ratio(mask):
    if mask is None:
        return None
    ys, xs = np.where(mask > 0)
    if ys.size == 0:
        return None
    y_min, y_max = ys.min(), ys.max()
    top_rows = list(range(y_min, min(y_min + 3, y_max + 1)))
    bottom_rows = list(range(max(y_max - 2, y_min), y_max + 1))

    def width_at(rows):
        widths = []
        for y in rows:
            xs_row = np.where(mask[y] > 0)[0]
            if xs_row.size:
                widths.append(xs_row.max() - xs_row.min() + 1)
        return float(np.mean(widths)) if widths else 0.0

    top_w = width_at(top_rows)
    bottom_w = width_at(bottom_rows)
    if bottom_w == 0:
        return None
    return top_w / bottom_w
    best = None
    best_area = 0.0
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 10:
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        if w < 4 or h < 6:
            continue
        if w > 24 or h > 24:
            continue
        if area > best_area:
            best_area = area
            best = (int(x), int(y), int(w), int(h))
    return best


def classify_cost_color(h, s, v, dark_ratio=0.0, allow_purple=True):
    if h is None:
        return None
    if dark_ratio > 0.25 or (v < 60 and s < 80):
        return "black"
    # Red wraps around 0/180
    if h >= 170 or h <= 10:
        if v < 180 and s < 105:
            return "purple" if allow_purple else "red"
        return "red" if s >= 85 else "pink"
    # Yellow band (this set skews toward orange/yellow in screenshots)
    if 15 <= h <= 60:
        return "yellow"
    # Blue band (appears more cyan/greenish in captures)
    if 75 <= h <= 130:
        return "blue"
    # Purple / pink bands
    if 135 <= h <= 155:
        if allow_purple:
            return "purple"
        return "blue" if h < 145 else "pink"
    if 156 <= h < 170:
        return "pink"
    color = classify_color(h, s, v, COST_COLOR_CENTERS)
    if color == "green":
        return "blue"
    if color == "red" and s < 85:
        return "pink"
    return color


def classify_cost_color_from_bgr(mean_bgr, dark_ratio=0.0, allow_purple=True):
    b, g, r = mean_bgr
    brightness = (b + g + r) / 3.0
    if dark_ratio > 0.2 and brightness < 160:
        return "black"
    if dark_ratio > 0.25 or brightness < 120:
        return "black"
    # blue: strong B dominance
    if b >= r and b >= g and (b - max(r, g)) > 15:
        return "blue"
    # greenish dominance: map to yellow/pink/blue (no green in this set)
    if g >= r and g >= b:
        if (r - b) > 40 and g > 140:
            return "yellow"
        if (r - b) > 10 and (r - b) <= 40:
            return "pink"
        return "blue"
    # yellow: R/G strong, B suppressed
    if r >= g and r >= b and (g - b) > 25 and g > 140:
        return "yellow"
    # purple/pink: R dominant but close to B
    if r >= b and r >= g and (r - b) < 30:
        if (b - g) > 10 and brightness < 180:
            if allow_purple:
                return "purple"
            return "blue" if b >= r else "pink"
        return "pink"
    if r >= g and r >= b:
        return "red"
    if g >= r and g >= b:
        return "blue"
    return None


def requirement_roi(img):
    h, w = img.shape[:2]
    x0 = int(w * REQ_ROI_X0_RATIO)
    x1 = int(w * REQ_ROI_X1_RATIO)
    y0 = 0
    y1 = int(h * REQ_ROI_Y1_RATIO)
    return x0, y0, x1, y1


def select_requirement_digit_from_candidates(candidates, roi, circles=None):
    if not candidates:
        return None
    x0, y0, x1, y1 = roi
    if circles:
        best = None
        best_score = -1e9
        for cand in candidates:
            cx = cand.get("cx", 0.0)
            cy = cand.get("cy", 0.0)
            # prefer digits left of a circle and vertically aligned
            for circle in circles:
                ccx, ccy, _ = circle
                if cx >= ccx - 2:
                    continue
                if abs(cy - ccy) > 12:
                    continue
                score = cand.get("score", 0.0) - abs(cx - ccx) * 0.02 - abs(cy - ccy) * 0.02
                if score > best_score:
                    best_score = score
                    best = cand
        if best is not None:
            return best
    cx0 = (x0 + x1) / 2.0
    cy0 = (y0 + y1) / 2.0
    candidates.sort(
        key=lambda d: (
            d.get("score", 0.0),
            -abs(d.get("cx", 0.0) - cx0) - abs(d.get("cy", 0.0) - cy0),
        ),
        reverse=True,
    )
    return candidates[0]


def select_requirement_digit(digits, roi, circles=None):
    if not digits:
        return None
    x0, y0, x1, y1 = roi
    candidates = []
    for d in digits:
        value = d.get("value")
        if value is None or value <= 0 or value > 5:
            continue
        cx = d.get("cx")
        cy = d.get("cy")
        if cx is None or cy is None:
            continue
        if cx < x0 or cx > x1 or cy < y0 or cy > y1:
            continue
        if cx < VP_X_MAX and cy < VP_Y_MAX:
            continue
        candidates.append(d)
    return select_requirement_digit_from_candidates(candidates, roi, circles=circles)


def find_requirement_circles(img, roi):
    x0, y0, x1, y1 = roi
    roi_img = img[y0:y1, x0:x1]
    if roi_img.size == 0:
        return []
    gray = cv2.cvtColor(roi_img, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 5)
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=8,
        param1=50,
        param2=16,
        minRadius=6,
        maxRadius=12,
    )
    if circles is None:
        return []
    out = []
    for x, y, r in circles[0]:
        out.append((float(x) + x0, float(y) + y0, float(r)))
    return out


def parse_requirement_ocr_candidates(res, offset=(0, 0)):
    x_off, y_off = offset
    candidates = []
    for box, text, score in res:
        nums = re.findall(r"\d+", text)
        if len(nums) != 1:
            continue
        num = nums[0]
        if len(num) != 1:
            continue
        value = int(num)
        if value <= 0 or value > 5:
            continue
        mapped = [(p[0] + x_off, p[1] + y_off) for p in box]
        xs = [p[0] for p in mapped]
        ys = [p[1] for p in mapped]
        candidates.append({
            "value": value,
            "score": float(score),
            "box": mapped,
            "cx": sum(xs) / 4.0,
            "cy": sum(ys) / 4.0,
        })
    return candidates


def detect_requirement_digit_easyocr(roi):
    reader = get_easyocr_reader()
    if reader is None or roi is None or roi.size == 0:
        return []
    rgb = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
    res = reader.readtext(rgb, detail=1, allowlist="12345")
    return res or []


def detect_requirement_circle(img, digit, roi, circles=None):
    if digit is None:
        return None
    if circles is None:
        circles = find_requirement_circles(img, roi)
    if not circles:
        return None
    d_cx = float(digit.get("cx", 0.0))
    d_cy = float(digit.get("cy", 0.0))
    best = None
    best_score = 1e9
    for cx, cy, r in circles:
        dist = abs(cx - d_cx) + abs(cy - d_cy)
        if cx < d_cx + 2:
            dist += 50
        if abs(cy - d_cy) > 12:
            dist += 20
        if dist < best_score:
            best_score = dist
            best = (cx, cy, float(r))
    return best


def classify_requirement_hsv(h, s, v, dark_ratio=0.0):
    if h is None:
        return None
    if dark_ratio > 0.25 or (v < 70 and s < 80):
        return "black"
    if h >= 170 or h <= 12:
        return "red" if s >= 90 else "pink"
    if 15 <= h <= 60:
        return "yellow"
    if 70 <= h <= 130:
        return "blue"
    if 131 <= h <= 170:
        return "pink"
    color = classify_color(h, s, v, COLOR_CENTERS)
    if color == "green":
        return "blue"
    return color


def sample_requirement_colors(img, center, radius_x=5, radius_y=5, size=2, bottom_scale=0.5):
    cx, cy = center
    directions = [
        (1, 0), (-1, 0),
        (0, -1), (0, 1),
        (1, 1), (1, -1), (-1, 1), (-1, -1),
    ]
    samples = []
    h, w = img.shape[:2]
    for dx, dy in directions:
        ry = radius_y * (bottom_scale if dy > 0 else 1.0)
        sx = int(round(cx + dx * radius_x))
        sy = int(round(cy + dy * ry))
        x0 = max(0, sx - size)
        y0 = max(0, sy - size)
        x1 = min(w, sx + size + 1)
        y1 = min(h, sy + size + 1)
        patch = img[y0:y1, x0:x1]
        if patch.size == 0:
            continue
        hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
        mask = (hsv[:, :, 1] > 30) & (hsv[:, :, 2] > 60)
        if mask.sum() == 0:
            continue
        hue = float(np.mean(hsv[:, :, 0][mask]))
        sat = float(np.mean(hsv[:, :, 1][mask]))
        val = float(np.mean(hsv[:, :, 2][mask]))
        color = classify_requirement_hsv(hue, sat, val, dark_ratio=0.0)
        if color == "purple":
            continue
        if color == "green":
            color = "blue"
        if color:
            samples.append({"color": color, "point": (sx, sy)})
    return samples


def classify_requirement_color(img, digit_box=None):
    if digit_box is None:
        return None, None, None, []
    xs = [p[0] for p in digit_box]
    ys = [p[1] for p in digit_box]
    x0, x1 = int(min(xs)), int(max(xs))
    y0, y1 = int(min(ys)), int(max(ys))
    h_img, w_img = img.shape[:2]
    pad = 2
    outer_x0 = max(0, x0 - pad)
    outer_y0 = max(0, y0 - pad)
    outer_x1 = min(w_img - 1, x1 + pad)
    outer_y1 = min(h_img - 1, y1 + pad)
    outer_box = (outer_x0, outer_y0, outer_x1, outer_y1)
    inner_box = (x0, y0, x1, y1)

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mask = np.zeros((h_img, w_img), dtype=np.uint8)
    # sample along the expanded green box edge
    cv2.rectangle(mask, (outer_x0, outer_y0), (outer_x1, outer_y1), 255, thickness=2)
    mask = (mask > 0) & (hsv[:, :, 1] > 35) & (hsv[:, :, 2] > 70)
    if mask.sum() < 12:
        mask = (mask > 0) & (hsv[:, :, 1] > 28) & (hsv[:, :, 2] > 55)
    if mask.sum() == 0:
        return None, outer_box, inner_box, []

    mean = mean_hsv_from_mask(img, mask.astype(np.uint8))
    color = None
    if mean:
        color = classify_requirement_hsv(mean[0], mean[1], mean[2], dark_ratio=0.0)
    if not color:
        hue_stats = dominant_hue_in_mask(hsv, mask.astype(np.uint8))
        if hue_stats:
            color = classify_requirement_hsv(hue_stats[0], hue_stats[1], hue_stats[2], dark_ratio=0.0)

    samples = []
    midx = int(round((x0 + x1) / 2))
    midy = int(round((y0 + y1) / 2))
    points = [
        (midx, outer_y0),
        (midx, outer_y1),
        (outer_x0, midy),
        (outer_x1, midy),
    ]
    for sx, sy in points:
        if 0 <= sx < w_img and 0 <= sy < h_img:
            hsv_px = hsv[sy, sx]
            c = classify_requirement_hsv(float(hsv_px[0]), float(hsv_px[1]), float(hsv_px[2]))
            if c:
                samples.append({"color": c, "point": (sx, sy)})
    return color, outer_box, inner_box, samples


def classify_requirement_color_from_block(img, block, digit_box=None):
    x0, y0, x1, y1 = block
    patch = img[y0:y1, x0:x1]
    if patch.size == 0:
        return None
    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
    mask = np.ones(patch.shape[:2], dtype=np.uint8)
    if digit_box:
        xs = [p[0] for p in digit_box]
        ys = [p[1] for p in digit_box]
        dx0, dx1 = int(min(xs)) - 2, int(max(xs)) + 2
        dy0, dy1 = int(min(ys)) - 2, int(max(ys)) + 2
        dx0 = max(0, dx0 - x0)
        dy0 = max(0, dy0 - y0)
        dx1 = min(patch.shape[1], dx1 - x0)
        dy1 = min(patch.shape[0], dy1 - y0)
        mask[dy0:dy1, dx0:dx1] = 0
    # remove low-saturation digit strokes
    mask = (mask > 0) & (hsv[:, :, 1] > 30) & (hsv[:, :, 2] > 60)
    if mask.sum() == 0:
        return None
    mean = mean_hsv_from_mask(patch, mask.astype(np.uint8))
    if mean:
        color = classify_requirement_hsv(mean[0], mean[1], mean[2], dark_ratio=0.0)
        if color:
            return color
    hue_stats = dominant_hue_in_mask(hsv, mask.astype(np.uint8))
    if hue_stats:
        return classify_requirement_hsv(hue_stats[0], hue_stats[1], hue_stats[2], dark_ratio=0.0)
    return None


def pick_vp(digits):
    candidates = [d for d in digits if d["cx"] < VP_X_MAX and d["cy"] < VP_Y_MAX]
    if not candidates:
        return 0, None
    # pick highest score
    best = max(candidates, key=lambda d: d["score"])
    return best["value"], best


def detect_cost_circles(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 5)
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=10,
        param1=50,
        param2=18,
        minRadius=6,
        maxRadius=14,
    )
    if circles is None:
        return []
    circles = circles[0]
    # Cost icons live on the left-bottom area
    candidates = [
        (int(round(x)), int(round(y)), int(round(r)))
        for x, y, r in circles
        if x < 40 and y > 80
    ]
    # De-duplicate close detections
    selected = []
    for x, y, r in candidates:
        if any((x - sx) ** 2 + (y - sy) ** 2 < 25 for sx, sy, sr in selected):
            continue
        selected.append((x, y, r))
    return selected


def find_trapezoid_mask(img, window):
    x0, y0, x1, y1, _ = window
    roi = img[y0:y1, x0:x1]
    if roi.size == 0:
        return None, None, None
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(blur, 50, 150)
    edges = cv2.dilate(edges, np.ones((2, 2), np.uint8), iterations=1)
    def pick_best(contours):
        best = None
        best_area = 0.0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > best_area:
                best_area = area
                best = cnt
        return best, best_area

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, None, None
    best, best_area = pick_best(contours)

    # If the best contour is too far right (often a ball), retry on left portion.
    roi_w = roi.shape[1]
    used_left = False
    if best is not None:
        M = cv2.moments(best)
        cx = (M["m10"] / M["m00"]) if M["m00"] else 0.0
        if cx > roi_w * 0.6 or best_area < COST_TRAPEZOID_MIN_AREA:
            edges_left = edges.copy()
            edges_left[:, int(roi_w * 0.65):] = 0
            contours_left, _ = cv2.findContours(edges_left, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            best_left, area_left = pick_best(contours_left)
            if best_left is not None:
                M_left = cv2.moments(best_left)
                cx_left = (M_left["m10"] / M_left["m00"]) if M_left["m00"] else 0.0
                min_left_area = max(COST_TRAPEZOID_MIN_AREA * 0.7, 50)
                if area_left >= min_left_area and cx_left < roi_w * 0.55:
                    best = best_left
                    best_area = area_left
                    used_left = True

    if best is None:
        return None, None, None
    if used_left:
        min_left_area = max(COST_TRAPEZOID_MIN_AREA * 0.7, 50)
        if best_area < min_left_area:
            return None, None, None
    elif best_area < COST_TRAPEZOID_MIN_AREA:
        return None, None, None
    mask = np.zeros(roi.shape[:2], dtype=np.uint8)
    cv2.drawContours(mask, [best], -1, 255, -1)
    return mask, best, best_area


def build_digit_templates(meta, ocr):
    templates = {v: [] for v in sorted(DIGIT_ALLOWED_VALUES)}
    for d in meta:
        img_path = CARDS_DIR / d["card_image"]
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        h, w = img.shape[:2]
        res, _ = ocr(str(img_path), box_thresh=OCR_BOX_THRESH, text_score=OCR_TEXT_SCORE)
        res = res or []
        digits = extract_digits(res)
        for dig in digits:
            if dig["value"] not in templates:
                continue
            if dig["score"] < DIGIT_TEMPLATE_MIN_SCORE:
                continue
            if dig["cx"] > w * COST_ROW_X_MAX_RATIO:
                continue
            if dig["cy"] < COST_Y_MIN:
                continue
            xs = [p[0] for p in dig["box"]]
            ys = [p[1] for p in dig["box"]]
            x0, x1 = int(min(xs)) - 2, int(max(xs)) + 2
            y0, y1 = int(min(ys)) - 2, int(max(ys)) + 2
            x0 = max(0, x0)
            y0 = max(0, y0)
            x1 = min(w, x1)
            y1 = min(h, y1)
            patch = img[y0:y1, x0:x1]
            tpl = preprocess_digit_patch(patch)
            if tpl is not None:
                templates[dig["value"]].append((dig["score"], tpl))
    top_templates = {}
    for value, patches in templates.items():
        if not patches:
            top_templates[value] = None
            continue
        patches.sort(key=lambda x: x[0], reverse=True)
        top = [p for _, p in patches[:DIGIT_TEMPLATE_TOPK]]
        top_templates[value] = top
    return top_templates


def build_requirement_digit_templates(meta, ocr):
    templates = {v: [] for v in sorted(REQ_DIGIT_ALLOWED_VALUES)}
    # Seed templates from gold labels (more reliable)
    for card_id, gold in UPGRADE_GOLD.items():
        req = (gold or {}).get("requirements") or {}
        if len(req) != 1:
            continue
        value = next(iter(req.values()))
        try:
            value = int(value)
        except (TypeError, ValueError):
            continue
        if value not in REQ_DIGIT_ALLOWED_VALUES:
            continue
        img_path = CARDS_DIR / f"{card_id}.png"
        if not img_path.exists():
            continue
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        roi = requirement_roi(img)
        block = find_requirement_color_block(img, roi)
        if block is None:
            continue
        bx0, by0, bx1, by1 = block
        block_patch = img[by0:by1, bx0:bx1]
        if block_patch.size == 0:
            continue
        block_mask = (cv2.cvtColor(block_patch, cv2.COLOR_BGR2GRAY) >= 0).astype(np.uint8)
        box = detect_digit_box_from_mask(block_patch, block_mask)
        if not box:
            continue
        bdx, bdy, bw, bh = box
        x0, x1 = bx0 + bdx - 2, bx0 + bdx + bw + 2
        y0, y1 = by0 + bdy - 2, by0 + bdy + bh + 2
        x0 = max(0, x0)
        y0 = max(0, y0)
        x1 = min(img.shape[1], x1)
        y1 = min(img.shape[0], y1)
        patch = img[y0:y1, x0:x1]
        tpl = preprocess_digit_patch(patch)
        if tpl is None:
            continue
        templates[value].append((1.0, tpl))
    for d in meta:
        img_path = CARDS_DIR / d["card_image"]
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        roi = requirement_roi(img)
        res, _ = ocr(str(img_path), box_thresh=OCR_BOX_THRESH, text_score=OCR_TEXT_SCORE)
        res = res or []
        digits = extract_digits(res)
        digit = select_requirement_digit(digits, roi, circles=None)
        if digit is None:
            continue
        if digit.get("score", 0.0) < REQ_DIGIT_TEMPLATE_MIN_SCORE:
            continue
        value = digit.get("value")
        if value not in REQ_DIGIT_ALLOWED_VALUES:
            continue
        box = digit.get("box")
        if not box:
            continue
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        x0, x1 = int(min(xs)) - 2, int(max(xs)) + 2
        y0, y1 = int(min(ys)) - 2, int(max(ys)) + 2
        x0 = max(0, x0)
        y0 = max(0, y0)
        x1 = min(img.shape[1], x1)
        y1 = min(img.shape[0], y1)
        patch = img[y0:y1, x0:x1]
        tpl = preprocess_digit_patch(patch)
        if tpl is None:
            continue
        templates[value].append((float(digit.get("score", 0.0)), tpl))
    top_templates = {}
    for value, patches in templates.items():
        if not patches:
            top_templates[value] = None
            continue
        patches.sort(key=lambda x: x[0], reverse=True)
        top = [p for _, p in patches[:REQ_DIGIT_TEMPLATE_TOPK]]
        top_templates[value] = top
    return top_templates


def find_requirement_color_block(img, roi):
    x0, y0, x1, y1 = roi
    patch = img[y0:y1, x0:x1]
    if patch.size == 0:
        return None
    lab = cv2.cvtColor(patch, cv2.COLOR_BGR2LAB)
    Zab = lab.reshape((-1, 3)).astype(np.float32)[:, 1:3]
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 1.0)
    h, w = patch.shape[:2]
    center = (w / 2.0, h / 2.0)
    best = None
    best_score = 1e9
    cv2.setRNGSeed(0)
    for K in (3, 4):
        try:
            _, labels, _ = cv2.kmeans(Zab, K, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
        except Exception:
            continue
        labels = labels.reshape(patch.shape[:2])
        for k in range(K):
            mask = (labels == k).astype(np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)
            num, _, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
            for i in range(1, num):
                bx, by, bw, bh, area = stats[i]
                if area < REQ_BLOCK_MIN_AREA or area > REQ_BLOCK_MAX_AREA:
                    continue
                ratio = bw / bh if bh else 0
                if ratio < 0.5 or ratio > 2.0:
                    continue
                block_patch = patch[by:by + bh, bx:bx + bw]
                if block_patch.size == 0:
                    continue
                hsv_block = cv2.cvtColor(block_patch, cv2.COLOR_BGR2HSV)
                mean_s = float(np.mean(hsv_block[:, :, 1]))
                mean_v = float(np.mean(hsv_block[:, :, 2]))
                if mean_s < 45 or mean_v < 60:
                    continue
                if float(np.std(hsv_block[:, :, 0])) > 35 and float(np.std(hsv_block[:, :, 1])) > 55:
                    continue
                dist = abs(centroids[i][0] - center[0]) + abs(centroids[i][1] - center[1])
                score = dist - area * 0.002
                if score < best_score:
                    best_score = score
                    best = (bx, by, bw, bh)
    if best is None:
        return None
    bx, by, bw, bh = best
    return (bx + x0, by + y0, bx + x0 + bw, by + y0 + bh)


def detect_requirement_digit_from_block(img, block, templates=None):
    x0, y0, x1, y1 = block
    patch = img[y0:y1, x0:x1]
    if patch.size == 0:
        return None
    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    mean_s = float(np.mean(s))
    thresholds = [
        int(mean_s * 0.6),
        int(mean_s * 0.7),
        int(mean_s * 0.8),
        40,
        50,
    ]
    thresholds = [max(20, min(70, t)) for t in thresholds]
    center = ((x1 - x0) / 2.0, (y1 - y0) / 2.0)
    best = None
    best_score = -1e9
    # candidate from edge-based digit box
    block_mask = (cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY) >= 0).astype(np.uint8)
    edge_box = detect_digit_box_from_mask(patch, block_mask)
    if edge_box:
        bx, by, bw, bh = edge_box
        sub = patch[by:by + bh, bx:bx + bw]
        tpl = preprocess_digit_patch(sub)
        if tpl is not None:
            val = None
            score = 0.0
            if templates:
                val, score = template_match_digit(tpl, templates)
                if val is not None:
                    val, score, _ = refine_template_digit(tpl, templates, val, score)
            dist = abs((bx + bw / 2.0) - center[0]) + abs((by + bh / 2.0) - center[1])
            score_adj = float(score) - dist * 0.01
            best_score = score_adj
            best = {
                "value": val,
                "score": float(score),
                "box": [
                    (bx + x0, by + y0),
                    (bx + x0 + bw, by + y0),
                    (bx + x0 + bw, by + y0 + bh),
                    (bx + x0, by + y0 + bh),
                ],
                "source_hint": "req_block",
            }
    for thr in thresholds:
        mask = (s < thr) & (v > 30)
        mask = mask.astype(np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8), iterations=1)
        num, _, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
        if num <= 1:
            continue
        for i in range(1, num):
            bx, by, bw, bh, area = stats[i]
            if area < 20:
                continue
            if bw < 4 or bh < 8 or bw > 26 or bh > 30:
                continue
            sub = patch[by:by + bh, bx:bx + bw]
            tpl = preprocess_digit_patch(sub)
            if tpl is None:
                continue
            val = None
            score = 0.0
            if templates:
                val, score = template_match_digit(tpl, templates)
                if val is None:
                    continue
                val, score, _ = refine_template_digit(tpl, templates, val, score)
                if val is None:
                    continue
            dist = abs(centroids[i][0] - center[0]) + abs(centroids[i][1] - center[1])
            score_adj = float(score) - dist * 0.01
            if score_adj > best_score:
                best_score = score_adj
                best = {
                    "value": val,
                    "score": float(score),
                    "box": [
                        (bx + x0, by + y0),
                        (bx + x0 + bw, by + y0),
                        (bx + x0 + bw, by + y0 + bh),
                        (bx + x0, by + y0 + bh),
                    ],
                    "source_hint": "req_block",
                }
    return best


def detect_requirement_digit_in_fixed_box(img, fixed_box, templates):
    if not fixed_box or templates is None:
        return None
    xs = [p[0] for p in fixed_box]
    ys = [p[1] for p in fixed_box]
    x0, x1 = int(min(xs)), int(max(xs))
    y0, y1 = int(min(ys)), int(max(ys))
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(img.shape[1], x1)
    y1 = min(img.shape[0], y1)
    if x1 <= x0 or y1 <= y0:
        return None
    patch = img[y0:y1, x0:x1]
    if patch.size == 0:
        return None
    gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    masks = [np.ones(gray.shape, dtype=np.uint8)]
    for m in requirement_candidate_masks(gray):
        if m is None:
            continue
        m_bin = (m > 0).astype(np.uint8)
        masks.append(m_bin)
    best = None
    best_score = -1e9
    h, w = gray.shape[:2]
    center = (w / 2.0, h / 2.0)

    def try_candidate_box(bx, by, bw, bh):
        nonlocal best, best_score
        for pad in (0, 1, 2):
            px0 = max(0, bx - pad)
            py0 = max(0, by - pad)
            px1 = min(patch.shape[1], bx + bw + pad)
            py1 = min(patch.shape[0], by + bh + pad)
            sub = patch[py0:py1, px0:px1]
            tpl = preprocess_digit_patch(sub)
            if tpl is None:
                continue
            val, score = template_match_digit(tpl, templates)
            if val is None:
                continue
            val, score, _ = refine_template_digit(tpl, templates, val, score)
            if val is None:
                continue
            dist = abs((px0 + px1) / 2.0 - center[0]) + abs((py0 + py1) / 2.0 - center[1])
            score_adj = float(score) - dist * 0.01
            if score_adj > best_score:
                best_score = score_adj
                best = {
                    "value": val,
                    "score": float(score),
                    "box": [
                        (px0 + x0, py0 + y0),
                        (px1 + x0, py0 + y0),
                        (px1 + x0, py1 + y0),
                        (px0 + x0, py1 + y0),
                    ],
                    "source_hint": "fixed_box",
                }

    for mask in masks:
        if mask is None:
            continue
        # Ignore masks that are almost empty or full.
        fill = float(mask.sum()) / float(mask.size)
        if fill < 0.01 or fill > 0.98:
            continue
        # Clean up mask to isolate digit strokes
        m = (mask > 0).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8), iterations=1)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((2, 2), np.uint8), iterations=1)

        num, labels, stats, centroids = cv2.connectedComponentsWithStats(m, connectivity=8)
        for i in range(1, num):
            bx, by, bw, bh, area = stats[i]
            if area < 10:
                continue
            if bw < 4 or bh < 6 or bw > w or bh > h:
                continue
            # avoid giant blobs
            if area > 0.6 * (w * h):
                continue
            ratio = bw / float(bh) if bh else 0.0
            if ratio < 0.2 or ratio > 1.8:
                continue
            try_candidate_box(bx, by, bw, bh)

        # Also try the legacy digit box on this mask (can help for thin strokes)
        box = detect_digit_box_from_mask(patch, m)
        if box:
            bx, by, bw, bh = box
            try_candidate_box(bx, by, bw, bh)

    if best is not None:
        return best
    # fallback: match on whole fixed box
    tpl = preprocess_digit_patch(patch)
    if tpl is None:
        return None
    val, score = template_match_digit(tpl, templates)
    if val is None:
        return None
    val, score, _ = refine_template_digit(tpl, templates, val, score)
    if val is None:
        return None
    return {
        "value": val,
        "score": float(score),
        "box": fixed_box,
        "source_hint": "fixed_box_full",
    }


def requirement_candidate_masks(gray):
    masks = []
    # Otsu threshold (inv and normal)
    _, th_inv = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    masks.extend([th_inv, th])

    # Adaptive threshold (inv)
    th_adapt = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        11,
        2,
    )
    masks.append(th_adapt)

    # Blackhat / Tophat
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)
    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)
    for src in (blackhat, tophat):
        src = cv2.normalize(src, None, 0, 255, cv2.NORM_MINMAX)
        _, th_src = cv2.threshold(src, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        masks.append(th_src)
    return masks


def detect_requirement_digit_template(img, roi, templates):
    if not templates:
        return None
    x0, y0, x1, y1 = roi
    patch = img[y0:y1, x0:x1]
    if patch.size == 0:
        return None
    gray = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    center = (w / 2.0, h / 2.0)
    block = find_requirement_color_block(img, roi)
    if block is not None:
        digit = detect_requirement_digit_from_block(img, block, templates=templates)
        if digit and digit.get("value") is not None and digit.get("score", 0.0) >= REQ_DIGIT_TEMPLATE_MATCH_MIN_SCORE_BLOCK:
            return digit
        return None
    gray_region = gray
    region_offset = (0, 0)
    region_center = center
    best = None
    best_score = -1e9
    for mask in requirement_candidate_masks(gray_region):
        # light cleanup to connect strokes
        mask = cv2.dilate(mask, np.ones((2, 2), np.uint8), iterations=1)
        num, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
        for i in range(1, num):
            x, y, ww, hh, area = stats[i]
            if area < 18:
                continue
            if ww < 5 or hh < 7 or ww > 28 or hh > 32:
                continue
            # small padding
            rx0, ry0 = region_offset
            px0 = max(0, x - 1)
            py0 = max(0, y - 1)
            px1 = min(gray_region.shape[1], x + ww + 1)
            py1 = min(gray_region.shape[0], y + hh + 1)
            sub = patch[py0 + ry0:py1 + ry0, px0 + rx0:px1 + rx0]
            tpl = preprocess_digit_patch(sub)
            if tpl is None:
                continue
            val, score = template_match_digit(tpl, templates)
            if val is None:
                continue
            val, score, _ = refine_template_digit(tpl, templates, val, score)
            if val is None:
                continue
            dist = abs((centroids[i][0] + rx0) - region_center[0]) + abs((centroids[i][1] + ry0) - region_center[1])
            score_adj = float(score) - dist * 0.01
            if score_adj > best_score:
                best_score = score_adj
                best = {
                    "value": val,
                    "score": float(score),
                    "box": [
                        (px0 + rx0 + x0, py0 + ry0 + y0),
                        (px1 + rx0 + x0, py0 + ry0 + y0),
                        (px1 + rx0 + x0, py1 + ry0 + y0),
                        (px0 + rx0 + x0, py1 + ry0 + y0),
                    ],
                    "source_hint": "req_template",
                }
    if best and best.get("score", 0.0) >= REQ_DIGIT_TEMPLATE_MATCH_MIN_SCORE:
        # compute center
        xs = [p[0] for p in best["box"]]
        ys = [p[1] for p in best["box"]]
        best["cx"] = sum(xs) / 4.0
        best["cy"] = sum(ys) / 4.0
        return best
    return None


def get_cost_row_windows(img):
    h, w = img.shape[:2]
    x0 = 0
    x1 = int(w * COST_ROW_X_MAX_RATIO)
    windows = []
    for ry in COST_ROW_Y_RATIOS:
        cy = int(h * ry)
        y0 = max(0, cy - COST_ROW_Y_PAD)
        y1 = min(h, cy + COST_ROW_Y_PAD)
        windows.append((x0, y0, x1, y1, cy))
    return windows


def parse_digit_candidates(res):
    candidates = []
    for box, text, score in res:
        nums = re.findall(r"\d+", text)
        if not nums:
            continue
        for num in nums:
            try:
                value = int(num)
            except ValueError:
                continue
            if value == 0:
                continue
            if value > 9:
                # skip noisy multi-digit OCR
                continue
            if value not in DIGIT_ALLOWED_VALUES:
                continue
            candidates.append({
                "value": value,
                "score": float(score),
                "box": box,
            })
    return candidates


def select_best_cost_digit(candidates, row_cy, row_expected_x):
    if not candidates:
        return None
    best = None
    best_score = -999.0
    for cand in candidates:
        xs = [p[0] for p in cand["box"]]
        ys = [p[1] for p in cand["box"]]
        cx = sum(xs) / 4.0
        cy = sum(ys) / 4.0
        dist = abs(cx - row_expected_x) + abs(cy - row_cy)
        score = cand["score"] - dist * 0.01
        if score > best_score:
            best_score = score
            best = dict(cand)
            best["cx"] = cx
            best["cy"] = cy
    return best


def get_easyocr_reader():
    global EASYOCR_READER
    if not EASYOCR_AVAILABLE:
        return None
    if EASYOCR_READER is None:
        # Use English model for digits only.
        EASYOCR_READER = easyocr.Reader(["en"], gpu=False)
    return EASYOCR_READER


def detect_cost_digit_in_row_easyocr(img, window):
    reader = get_easyocr_reader()
    if reader is None:
        return None
    x0, y0, x1, y1, row_cy = window
    crop = img[y0:y1, x0:x1]
    if crop.size == 0:
        return None
    scale = max(4, COST_ROW_SCALE + 2)
    crop_up = cv2.resize(
        crop,
        (crop.shape[1] * scale, crop.shape[0] * scale),
        interpolation=cv2.INTER_CUBIC,
    )
    crop_rgb = cv2.cvtColor(crop_up, cv2.COLOR_BGR2RGB)
    res = reader.readtext(crop_rgb, detail=1, allowlist="0123456789")
    if not res:
        return None
    candidates = []
    for box, text, score in res:
        nums = re.findall(r"\d+", text)
        if not nums:
            continue
        for num in nums:
            try:
                value = int(num)
            except ValueError:
                continue
            if value == 0 or value > 9 or value not in DIGIT_ALLOWED_VALUES:
                continue
            mapped_box = [(p[0] / scale + x0, p[1] / scale + y0) for p in box]
            candidates.append({
                "value": value,
                "score": float(score),
                "box": mapped_box,
            })
    if not candidates:
        return None
    row_expected_x = int(img.shape[1] * COST_ROW_EXPECTED_X_RATIO)
    best = select_best_cost_digit(candidates, row_cy, row_expected_x)
    if best:
        best["source_hint"] = "easyocr"
    return best


def detect_cost_digit_in_row(img, ocr, window):
    x0, y0, x1, y1, row_cy = window
    crop = img[y0:y1, x0:x1]
    if crop.size == 0:
        return None
    scale = COST_ROW_SCALE
    crop_up = cv2.resize(
        crop,
        (crop.shape[1] * scale, crop.shape[0] * scale),
        interpolation=cv2.INTER_CUBIC,
    )
    res, _ = ocr(crop_up, box_thresh=OCR_BOX_THRESH, text_score=OCR_TEXT_SCORE)
    res = res or []
    candidates = parse_digit_candidates(res)
    if not candidates:
        # try EasyOCR fallback for tough digits
        return detect_cost_digit_in_row_easyocr(img, window)
    # map boxes to original coords
    mapped = []
    for cand in candidates:
        box = [(p[0] / scale + x0, p[1] / scale + y0) for p in cand["box"]]
        mapped.append({
            "value": cand["value"],
            "score": cand["score"],
            "box": box,
        })
    row_expected_x = int(img.shape[1] * COST_ROW_EXPECTED_X_RATIO)
    best = select_best_cost_digit(mapped, row_cy, row_expected_x)
    if best:
        best["source_hint"] = "row_ocr"
    return best


def kmeans_digit_mask(patch, k=3):
    if patch is None or patch.size == 0:
        return None
    lab = cv2.cvtColor(patch, cv2.COLOR_BGR2LAB)
    Z = lab.reshape((-1, 3)).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 1.0)
    _, labels, centers = cv2.kmeans(Z, k, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
    centers = centers.astype(np.float32)
    scores = []
    for c in centers:
        L, a, b = c
        chroma = float(((a - 128) ** 2 + (b - 128) ** 2) ** 0.5)
        scores.append(float(L - chroma * 0.5))
    idx = int(max(range(k), key=lambda i: scores[i]))
    mask = (labels.flatten() == idx).astype(np.uint8).reshape(patch.shape[:2])
    # keep largest component
    num, labels2, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if num > 1:
        best = None
        best_area = 0
        for i in range(1, num):
            x, y, w, h, area = stats[i]
            if area > best_area:
                best_area = area
                best = i
        if best is not None:
            mask = (labels2 == best).astype(np.uint8)
    return mask


def hsv_digit_mask(patch, s_thr, v_thr):
    if patch is None or patch.size == 0:
        return None
    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    mask = ((s < s_thr) & (v > v_thr)).astype(np.uint8)
    return mask


def easyocr_read_digit_from_binary(bin_img):
    reader = get_easyocr_reader()
    if reader is None or bin_img is None:
        return None
    ys, xs = np.where(bin_img > 0)
    if ys.size == 0:
        return None
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    crop = bin_img[y0:y1 + 1, x0:x1 + 1]
    up = cv2.resize(crop, (crop.shape[1] * 8, crop.shape[0] * 8), interpolation=cv2.INTER_NEAREST)
    rgb = cv2.cvtColor(up, cv2.COLOR_GRAY2RGB)
    res = reader.readtext(rgb, detail=1, allowlist="0123456789")
    if not res:
        return None
    candidates = parse_digit_candidates(res)
    if not candidates:
        return None
    # pick best score
    best = max(candidates, key=lambda d: d["score"])
    return best


def detect_cost_digit_from_mask_easyocr(img, window, mask):
    if mask is None:
        return None
    x0, y0, x1, y1, row_cy = window
    roi = img[y0:y1, x0:x1]
    if roi.size == 0:
        return None
    # crop digit patch
    box = detect_digit_box_from_mask(roi, mask)
    if not box:
        return None
    bx, by, bw, bh = box
    patch = roi[by:by + bh, bx:bx + bw]
    if patch.size == 0:
        return None

    candidates = []
    # kmeans mask variants
    km = kmeans_digit_mask(patch, k=3)
    if km is not None:
        base = (km * 255).astype(np.uint8)
        variants = [
            base,
            255 - base,
            cv2.dilate(base, np.ones((2, 2), np.uint8), iterations=1),
            cv2.dilate(255 - base, np.ones((2, 2), np.uint8), iterations=1),
        ]
        for v in variants:
            cand = easyocr_read_digit_from_binary(v)
            if cand:
                candidates.append(cand)
                if cand["score"] >= 0.95:
                    break

    # HSV threshold variants (good for yellow/pink backgrounds)
    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
    mean_s = float(np.mean(hsv[:, :, 1]))
    if mean_s > 70:
        s_list = [80, 90]
    else:
        s_list = [60, 70, 80]
    v_list = [100, 120, 140, 160]
    for s_thr in s_list:
        for v_thr in v_list:
            m = hsv_digit_mask(patch, s_thr, v_thr)
            if m is None:
                continue
            base = (m * 255).astype(np.uint8)
            variants = [
                base,
                255 - base,
                cv2.dilate(base, np.ones((2, 2), np.uint8), iterations=1),
                cv2.dilate(255 - base, np.ones((2, 2), np.uint8), iterations=1),
            ]
            for v in variants:
                cand = easyocr_read_digit_from_binary(v)
                if cand:
                    candidates.append(cand)
                    break
        if candidates:
            break

    if not candidates:
        return None
    best = max(candidates, key=lambda d: d["score"])
    # map to image coordinates roughly at digit box center
    best["box"] = [
        (bx + x0, by + y0),
        (bx + bw + x0, by + y0),
        (bx + bw + x0, by + bh + y0),
        (bx + x0, by + bh + y0),
    ]
    best["cx"] = bx + x0 + bw / 2.0
    best["cy"] = by + y0 + bh / 2.0
    best["source_hint"] = "easyocr_mask"
    return best


def detect_cost_color(img, window, mask, allow_purple=True):
    h, w = img.shape[:2]
    x0, y0, x1, y1, _ = window
    if x1 <= x0 or y1 <= y0:
        return None
    roi = img[y0:y1, x0:x1]
    if roi.size == 0:
        return None
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    if mask is None:
        return None
    dark_ratio = float((hsv[:, :, 2][mask > 0] < 100).mean()) if (mask > 0).any() else 0.0
    mean_hsv = mean_hsv_from_mask(roi, mask)
    if mean_hsv:
        hue, sat, val = mean_hsv
        mean_bgr = roi[mask > 0].mean(axis=0)
        hue_color = classify_cost_color(hue, sat, val, dark_ratio=dark_ratio, allow_purple=allow_purple)
        bgr_color = classify_cost_color_from_bgr(mean_bgr, dark_ratio=dark_ratio, allow_purple=allow_purple)
        if hue_color and bgr_color:
            if hue_color == bgr_color:
                return hue_color
            if sat >= 80:
                return hue_color
            return bgr_color
        if hue_color:
            return hue_color
        if bgr_color:
            return bgr_color
    hue_stats = dominant_hue_in_mask(hsv, mask)
    if hue_stats:
        hue, sat, val = hue_stats
        color = classify_cost_color(hue, sat, val, dark_ratio=dark_ratio, allow_purple=allow_purple)
        if color:
            return color
    return None


def select_digit_from_full(digits, window, w):
    if not digits:
        return None
    x0, y0, x1, y1, row_cy = window
    candidates = []
    for d in digits:
        if d["value"] not in DIGIT_ALLOWED_VALUES:
            continue
        if d["cy"] < y0 or d["cy"] > y1:
            continue
        if d["cx"] > w * COST_ROW_X_MAX_RATIO:
            continue
        candidates.append(d)
    if not candidates:
        return None
    # pick highest score, then closest to row center
    candidates.sort(key=lambda d: (d["score"], -abs(d["cy"] - row_cy)), reverse=True)
    return candidates[0]


def map_costs_from_trapezoids(img, ocr, digits=None, templates=None, card_id=None, bad_ids=None):
    costs = defaultdict(int)
    entries = []
    h, w = img.shape[:2]
    for row_idx, window in enumerate(get_cost_row_windows(img)):
        mask, contour, area = find_trapezoid_mask(img, window)
        if mask is None:
            continue
        digit = detect_cost_digit_in_row(img, ocr, window)
        source = "row_ocr"
        if digit and "source_hint" in digit:
            source = digit.pop("source_hint")
        # Try masked EasyOCR first when row OCR is weak
        if not digit or digit.get("score", 0) < 0.2:
            masked_digit = detect_cost_digit_from_mask_easyocr(img, window, mask)
            if masked_digit:
                digit = masked_digit
                source = masked_digit.pop("source_hint", "easyocr_mask")
        if digits:
            fallback = select_digit_from_full(digits, window, w)
            if not digit and fallback:
                digit = fallback
                source = "full_ocr"
            elif digit and fallback:
                # If full-image OCR is much stronger, trust it.
                margin = 0.05
                if source in {"easyocr", "easyocr_mask"}:
                    margin = 0.2
                if fallback["score"] > digit.get("score", 0) + margin:
                    digit = fallback
                    source = "full_ocr"
        if not digit:
            # fallback: try to locate digit from trapezoid edges and template match
            x0, y0, x1, y1, _ = window
            roi = img[y0:y1, x0:x1]
            box = detect_digit_box_from_mask(roi, mask)
            if box and templates and area and area >= DIGIT_TEMPLATE_SCAN_MIN_AREA:
                ratio = trapezoid_top_bottom_ratio(mask)
                # Filter out inverted/irregular shapes that are unlikely to be cost trapezoids.
                if ratio is not None and ratio > 1.05:
                    continue
                bx, by, bw, bh = box
                patch = roi[by:by + bh, bx:bx + bw]
                tpl_patch = preprocess_digit_patch(patch)
                val, score = template_match_digit(tpl_patch, templates)
                val, score, _ = refine_template_digit(tpl_patch, templates, val, score)
                if val is not None and score >= DIGIT_TEMPLATE_FALLBACK_SCORE:
                    digit = {
                        "value": val,
                        "score": float(score),
                        "box": [
                            (bx + x0, by + y0),
                            (bx + bw + x0, by + y0),
                            (bx + bw + x0, by + bh + y0),
                            (bx + x0, by + bh + y0),
                        ],
                    }
                    source = "template_scan"
        if not digit:
            continue
        # reclassify suspicious digits using templates
        if templates and (digit["value"] not in DIGIT_ALLOWED_VALUES or digit["value"] >= 6 or digit.get("score", 0) < 0.9):
            orig_value = digit["value"]
            xs = [p[0] for p in digit["box"]]
            ys = [p[1] for p in digit["box"]]
            x0b, x1b = int(min(xs)) - 2, int(max(xs)) + 2
            y0b, y1b = int(min(ys)) - 2, int(max(ys)) + 2
            x0b = max(0, x0b)
            y0b = max(0, y0b)
            x1b = min(w, x1b)
            y1b = min(h, y1b)
            patch = img[y0b:y1b, x0b:x1b]
            tpl_patch = preprocess_digit_patch(patch)
            val, score = template_match_digit(tpl_patch, templates)
            val, score, holes = refine_template_digit(tpl_patch, templates, val, score)
            if val is not None and val in DIGIT_ALLOWED_VALUES:
                min_score = 0.8 if digit["value"] >= 6 else 0.4
                # if template tries to push 6 but there is no hole, be conservative
                if val == 6 and holes == 0 and orig_value in DIGIT_ALLOWED_VALUES:
                    min_score = 0.95
                # only override if template is meaningfully stronger than OCR
                required = max(min_score, digit.get("score", 0) + 0.25)
                if score > required:
                    digit["value"] = val
                    digit["score"] = float(score)
                    source = "template_fix"
        if bad_ids and card_id in bad_ids:
            if source in {"easyocr_mask", "template_fix"} and digit.get("score", 0.0) < 0.9:
                continue
        allow_purple = (row_idx == 0)
        if digit["value"] not in DIGIT_ALLOWED_VALUES:
            continue
        color = detect_cost_color(img, window, mask, allow_purple=allow_purple)
        entry = {
            "value": digit["value"],
            "color": color,
            "box": digit.get("box"),
            "score": digit.get("score", 0.0),
            "row_cy": window[4],
            "window": window[:4],
            "source": source,
            "trapezoid_area": area,
        }
        entries.append(entry)
        if color:
            costs[color] += digit["value"]

    # If any color total is >=9, drop the weakest entries for that color.
    if costs:
        filtered = []
        by_color = defaultdict(list)
        for entry in entries:
            color = entry.get("color")
            if not color:
                filtered.append(entry)
                continue
            by_color[color].append(entry)
        for color, items in by_color.items():
            total = sum(e["value"] for e in items)
            if total < 9:
                filtered.extend(items)
                continue
            items_sorted = sorted(
                items,
                key=lambda e: (e.get("score", 0.0), e.get("trapezoid_area", 0.0)),
            )
            while total >= 9 and len(items_sorted) > 1:
                removed = items_sorted.pop(0)
                total -= removed["value"]
            filtered.extend(items_sorted)
        entries = filtered
        costs = defaultdict(int)
        for entry in entries:
            color = entry.get("color")
            if color:
                costs[color] += entry["value"]

    return dict(costs), entries


def map_costs_from_circles(img):
    costs = defaultdict(int)
    circles = detect_cost_circles(img)
    for x, y, r in circles:
        hue, sat, val = sample_hsv_ring(img, x, y, r)
        color = classify_color(hue, sat, val, COLOR_CENTERS)
        if not color:
            continue
        costs[color] += 1
    return dict(costs)


def map_costs_from_digits(digits, img):
    costs = defaultdict(int)
    for d in digits:
        # costs are on the lower-left area
        if d["cy"] < COST_Y_MIN:
            continue
        if d["cx"] > COST_X_MAX:
            continue
        if d["value"] == 0:
            continue
        cx = int(d["cx"])
        cy = int(d["cy"])
        hue, sat, val = sample_hsv(img, cx, cy, r=8)
        color = classify_color(hue, sat, val, COST_COLOR_CENTERS)
        if not color:
            continue
        costs[color] += d["value"]
    return dict(costs)


def map_costs(digits, img, ocr, templates, card_id=None, bad_ids=None):
    costs, entries = map_costs_from_trapezoids(
        img,
        ocr,
        digits=digits,
        templates=templates,
        card_id=card_id,
        bad_ids=bad_ids,
    )
    return costs, "trapezoid_ocr", entries


def apply_cost_override(card_id, cost):
    override = COST_OVERRIDES.get(card_id)
    if not override:
        return cost, None
    if "_replace" in override:
        return dict(override["_replace"]), "override_replace"
    updated = dict(cost)
    for k, v in override.items():
        if k == "_replace":
            continue
        updated[k] = v
    return updated, "override_update"


def map_requirements(digits, img, ocr=None, req_templates=None):
    req = {}
    meta = {}
    roi = requirement_roi(img)
    meta["roi"] = roi
    fixed_box = None
    if REQ_USE_FIXED_DIGIT_BOX:
        rx0, ry0, rx1, ry1 = roi
        fx0, fy0, fx1, fy1 = REQ_FIXED_BOX_IN_ROI
        fixed_box = [
            (rx0 + fx0, ry0 + fy0),
            (rx0 + fx1, ry0 + fy0),
            (rx0 + fx1, ry0 + fy1),
            (rx0 + fx0, ry0 + fy1),
        ]
    digit = select_requirement_digit(digits, roi, circles=None)
    if digit is None and ocr is not None:
        # fallback: re-run OCR on the requirement ROI
        x0, y0, x1, y1 = roi
        crop = img[y0:y1, x0:x1]
        if crop.size:
            res, _ = ocr(crop, box_thresh=OCR_BOX_THRESH, text_score=OCR_TEXT_SCORE)
            res = res or []
            candidates = parse_requirement_ocr_candidates(res, offset=(x0, y0))
            if not candidates:
                easy_res = detect_requirement_digit_easyocr(crop)
                candidates = parse_requirement_ocr_candidates(easy_res, offset=(x0, y0))
            digit = select_requirement_digit_from_candidates(candidates, roi, circles=None)
    # If using fixed digit box, override with template match from the fixed patch.
    if fixed_box and req_templates is not None:
        fixed_digit = detect_requirement_digit_in_fixed_box(img, fixed_box, req_templates)
        if fixed_digit:
            digit = fixed_digit
    if digit is not None and req_templates is not None:
        if digit.get("score", 0.0) < 0.8:
            fallback = detect_requirement_digit_template(img, roi, req_templates)
            if fallback:
                digit = fallback
    if digit is None and req_templates is not None:
        digit = detect_requirement_digit_template(img, roi, req_templates)
    if digit is None:
        meta["digit"] = None
        return req, meta

    def expand_box_points(box, pad):
        if not box:
            return box
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        x0, x1 = int(min(xs)), int(max(xs))
        y0, y1 = int(min(ys)), int(max(ys))
        x0 = max(0, x0 - pad)
        y0 = max(0, y0 - pad)
        x1 = min(img.shape[1] - 1, x1 + pad)
        y1 = min(img.shape[0] - 1, y1 + pad)
        return [
            (x0, y0),
            (x1, y0),
            (x1, y1),
            (x0, y1),
        ]

    block = find_requirement_color_block(img, roi)
    if block:
        meta["block"] = block
    raw_box = fixed_box or digit.get("box")

    box = expand_box_points(raw_box, REQ_DIGIT_BOX_PAD) if raw_box else None

    meta["digit"] = {
        "value": digit.get("value"),
        "score": digit.get("score"),
        "box": box,
        "source": digit.get("source_hint"),
    }
    if raw_box:
        meta["digit_box_raw"] = raw_box

    color = None
    if box:
        color, outer_box, inner_box, samples = classify_requirement_color(img, digit_box=box)
        meta["color_box"] = outer_box
        meta["color_box_inner"] = inner_box
        meta["color_samples"] = samples
        if not color and block:
            color = classify_requirement_color_from_block(img, block, digit_box=box)
    meta["color"] = color
    if color:
        req[color] = int(digit.get("value", 0))
    return req, meta


def best_name_by_ocr(ocr_hint, zh_by_en):
    if not ocr_hint or len(ocr_hint) < 2:
        return None, 0.0
    best_name = None
    best_score = 0.0
    for name_en, name_zh in zh_by_en.items():
        score = difflib.SequenceMatcher(None, ocr_hint, name_zh).ratio()
        if score > best_score:
            best_score = score
            best_name = name_en
    return best_name, best_score


def select_name(clip_candidates, zh_by_en, ocr_hint):
    # Strong OCR signal: pick best fuzzy match across all names
    ocr_best, ocr_score = best_name_by_ocr(ocr_hint, zh_by_en)
    if ocr_best and ocr_score >= 0.6:
        return ocr_best, "ocr"

    # Otherwise, re-rank CLIP candidates using OCR similarity (if any)
    if ocr_hint:
        ranked = []
        for cand in clip_candidates:
            name_zh = zh_by_en[cand["name_en"]]
            sim = difflib.SequenceMatcher(None, ocr_hint, name_zh).ratio()
            ranked.append((cand, sim))
        ranked.sort(key=lambda x: (x[0]["score"] + x[1] * 0.1), reverse=True)
        return ranked[0][0]["name_en"], "clip+ocr"

    return clip_candidates[0]["name_en"], "clip"


def build():
    if open_clip is None or torch is None or Image is None:
        raise RuntimeError("open_clip/torch/PIL required for full build. Use --cost-debug or --cost-only with OCR venv, or install missing deps.")
    names_en, names_zh, id_by_en, zh_by_en, en_by_id = load_names()
    prev_en, next_en = load_evolution_map(en_by_id)

    # CLIP setup
    model, _, preprocess = open_clip.create_model_and_transforms("ViT-B-32", pretrained="openai")
    model.eval()
    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    texts = [f"a photo of {name} pokemon" for name in names_en]
    text_tokens = tokenizer(texts)
    with torch.no_grad():
        text_features = model.encode_text(text_tokens)
        text_features /= text_features.norm(dim=-1, keepdim=True)

    ball_colors = [c for c, _ in BALL_LABELS]
    ball_prompts = [f"a photo of a {label}" for _, label in BALL_LABELS]
    ball_tokens = tokenizer(ball_prompts)
    with torch.no_grad():
        ball_text_features = model.encode_text(ball_tokens)
        ball_text_features /= ball_text_features.norm(dim=-1, keepdim=True)

    ocr = RapidOCR()
    bad_ids = load_bad_ids()

    meta = json.loads(META_PATH.read_text())
    bonus_templates = build_bonus_templates(meta, BONUS_OVERRIDES)
    digit_templates = build_digit_templates(meta, ocr)
    req_digit_templates = build_requirement_digit_templates(meta, ocr)
    cards = []
    debug = []
    review = []

    for d in meta:
        img_path = CARDS_DIR / d["card_image"]
        img_cv = cv2.imread(str(img_path))
        h, w = img_cv.shape[:2]

        # CLIP image embedding
        img_pil = Image.open(img_path).convert("RGB")
        crop = img_pil.crop((int(w * 0.08), int(h * 0.12), int(w * 0.92), int(h * 0.78)))
        image = preprocess(crop).unsqueeze(0)
        with torch.no_grad():
            image_features = model.encode_image(image)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            logits = (image_features @ text_features.T).squeeze(0)
            topk = torch.topk(logits, k=5)

        clip_candidates = []
        for score, idx in zip(topk.values.tolist(), topk.indices.tolist()):
            name_en = names_en[idx]
            clip_candidates.append({
                "name_en": name_en,
                "name_zh": zh_by_en[name_en],
                "score": float(score),
            })

        # OCR
        res, _ = ocr(str(img_path), box_thresh=OCR_BOX_THRESH, text_score=OCR_TEXT_SCORE)
        res = res or []
        ocr_hints = []
        for box, text, score in res:
            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            cx = sum(xs) / 4.0
            cy = sum(ys) / 4.0
            if cy > NAME_BOX_Y and cx > NAME_BOX_X:
                hint = clean_chinese(text)
                if hint:
                    ocr_hints.append(hint)
        # pick longest hint
        ocr_hint = max(ocr_hints, key=len) if ocr_hints else ""

        name_en, name_source = select_name(clip_candidates, zh_by_en, ocr_hint)
        name_zh = zh_by_en[name_en]

        digits = extract_digits(res)
        vp, vp_digit = pick_vp(digits)
        cost, cost_source, cost_entries = map_costs(
            digits,
            img_cv,
            ocr,
            digit_templates,
            card_id=card_id,
            bad_ids=bad_ids,
        )
        cost, override_tag = apply_cost_override(Path(d["card_image"]).stem, cost)
        if override_tag:
            cost_source = override_tag
        evo_req, evo_meta = map_requirements(digits, img_cv, ocr=ocr, req_templates=req_digit_templates)
        bonuses, bonus_scores = detect_bonus_colors(
            img_cv,
            bonus_templates,
            model,
            preprocess,
            ball_text_features,
            ball_colors,
        )
        scene_override = SCENE_BONUS_MAP.get(d["scene"])
        if scene_override:
            bonuses = scene_override
        else:
            override = BONUS_OVERRIDES.get(Path(d["card_image"]).stem)
            if override:
                bonuses = override
            else:
                bonuses = bonuses[:1]

        prev_name = prev_en.get(name_en)
        next_names = next_en.get(name_en, [])

        if name_en in LEGENDARY_EN:
            tier = "Legendary"
        elif prev_name is None and next_names:
            tier = "LV1"
        elif prev_name and next_names:
            tier = "LV2"
        elif prev_name and not next_names:
            tier = "LV3"
        else:
            tier = "Rare"

        evolution = None
        if tier in {"LV1", "LV2"} and next_names:
            evolution = {
                "target_en": next_names if len(next_names) > 1 else next_names[0],
                "target_zh": [zh_by_en[n] for n in next_names] if len(next_names) > 1 else zh_by_en[next_names[0]],
                "requirements": evo_req if evo_req else {},
            }
        else:
            evolution = {
                "target_en": None,
                "target_zh": None,
                "requirements": evo_req if evo_req else {},
            }

        card = {
            "id": Path(d["card_image"]).stem,
            "name": name_zh,
            "name_en": name_en,
            "tier": tier,
            "vp": vp,
            "bonus": bonuses[0] if bonuses else None,
            "bonuses": bonuses,
            "cost": cost,
            "evolution": evolution,
            "source": {
                "scene": d["scene"],
                "image": d["card_image"],
            },
        }
        cards.append(card)

        debug.append({
            "id": card["id"],
            "name_en": name_en,
            "name_zh": name_zh,
            "name_source": name_source,
            "ocr_hint": ocr_hint,
            "clip_candidates": clip_candidates,
            "vp": vp,
            "bonus": bonuses,
            "cost": cost,
            "cost_source": cost_source,
            "cost_entries": cost_entries,
            "evo_req": evo_req,
            "evo_req_meta": evo_meta,
            "bonus_scores": bonus_scores,
        })

        # mark low confidence for review
        if name_source == "clip" or (ocr_hint and name_zh.find(ocr_hint) == -1):
            review.append({
                "id": card["id"],
                "name_en": name_en,
                "name_zh": name_zh,
                "ocr_hint": ocr_hint,
                "clip_candidates": clip_candidates,
            })

    OUTPUT_PATH.write_text(json.dumps(cards, ensure_ascii=False, indent=2))
    DEBUG_PATH.write_text(json.dumps(debug, ensure_ascii=False, indent=2))
    REPORT_PATH.write_text(json.dumps(review, ensure_ascii=False, indent=2))
    print(f"Wrote {OUTPUT_PATH} ({len(cards)} cards)")
    print(f"Wrote {DEBUG_PATH}")
    print(f"Wrote {REPORT_PATH} ({len(review)} review items)")
    return cards, debug, review


def write_compare_outputs(cards, debug):
    compare_csv = ASSETS_DIR / "cards_compare.csv"
    compare_html = ASSETS_DIR / "cards_compare.html"

    debug_by_id = {d["id"]: d for d in debug}

    with compare_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "id",
            "name_zh",
            "name_en",
            "tier",
            "vp",
            "bonus",
            "bonuses",
            "cost",
            "cost_source",
            "evo_req",
            "evo_target_en",
            "evo_target_zh",
            "scene",
            "image",
        ])
        for card in cards:
            dbg = debug_by_id.get(card["id"], {})
            evo = card.get("evolution") or {}
            writer.writerow([
                card.get("id"),
                card.get("name"),
                card.get("name_en"),
                card.get("tier"),
                card.get("vp"),
                card.get("bonus"),
                json.dumps(card.get("bonuses"), ensure_ascii=False),
                json.dumps(card.get("cost"), ensure_ascii=False),
                dbg.get("cost_source"),
                json.dumps(evo.get("requirements", {}), ensure_ascii=False),
                evo.get("target_en"),
                evo.get("target_zh"),
                card.get("source", {}).get("scene"),
                card.get("source", {}).get("image"),
            ])

    rows = []
    for card in cards:
        dbg = debug_by_id.get(card["id"], {})
        evo = card.get("evolution") or {}
        clip_items = []
        for cand in dbg.get("clip_candidates", []):
            clip_items.append(f'{cand["name_zh"]}/{cand["name_en"]}: {cand["score"]:.3f}')
        clip_html = "<br>".join(clip_items)
        rows.append(f"""
    <tr>
      <td><img src="cards/{card['source']['image']}" alt="{card['id']}" loading="lazy"></td>
      <td>
        <div><strong>{card['name']}</strong> ({card['name_en']})</div>
        <div>id: {card['id']}</div>
        <div>scene: {card['source']['scene']}</div>
        <div>image: {card['source']['image']}</div>
      </td>
      <td>
        <div>source: {dbg.get('name_source')}</div>
        <div>ocr_hint: {dbg.get('ocr_hint')}</div>
        <div>clip:</div>
        <div class="clip">{clip_html}</div>
      </td>
      <td>
        <div>tier: {card['tier']}</div>
        <div>vp: {card['vp']}</div>
        <div>bonus: {card['bonus']}</div>
        <div>bonuses: {json.dumps(card.get('bonuses'), ensure_ascii=False)}</div>
        <div>cost: {json.dumps(card.get('cost'), ensure_ascii=False)}</div>
        <div class="muted">cost_source: {dbg.get('cost_source')}</div>
        <div>evo_req: {json.dumps(evo.get('requirements', {}), ensure_ascii=False)}</div>
        <div>evo_target_en: {evo.get('target_en')}</div>
        <div>evo_target_zh: {evo.get('target_zh')}</div>
      </td>
    </tr>
""")

    compare_html.write_text(f"""<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pokemon Splendor Cards Compare</title>
  <style>
    :root {{
      --bg: #f6f4ef;
      --card: #ffffff;
      --text: #1f2937;
      --muted: #6b7280;
      --border: #e5e7eb;
    }}
    body {{
      margin: 0;
      font-family: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background: var(--bg);
      color: var(--text);
    }}
    header {{
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      background: #fff;
      position: sticky;
      top: 0;
      z-index: 10;
    }}
    header h1 {{
      margin: 0;
      font-size: 18px;
    }}
    .wrap {{
      padding: 16px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
    }}
    th, td {{
      border: 1px solid var(--border);
      padding: 8px;
      vertical-align: top;
      font-size: 12px;
      line-height: 1.4;
    }}
    th {{
      background: #fafafa;
      position: sticky;
      top: 52px;
      z-index: 5;
    }}
    img {{
      width: 128px;
      height: auto;
      border: 1px solid var(--border);
      background: #fff;
    }}
    .clip {{
      color: var(--muted);
      font-size: 11px;
    }}
    .muted {{
      color: var(--muted);
    }}
  </style>
</head>
<body>
  <header>
    <h1>Splendor: Pokemon — Cards Compare ({len(cards)})</h1>
  </header>
  <div class="wrap">
    <table>
      <thead>
        <tr>
          <th>Image</th>
          <th>Card</th>
          <th>OCR/CLIP</th>
          <th>Derived</th>
        </tr>
      </thead>
      <tbody>
        {''.join(rows)}
      </tbody>
    </table>
  </div>
</body>
</html>
""", encoding="utf-8")
    print(f"Wrote {compare_csv}")
    print(f"Wrote {compare_html}")


def write_cost_debug(meta, ocr, ids=None, templates=None, output_name="index.html"):
    out_dir = ASSETS_DIR / "cost_debug"
    out_dir.mkdir(parents=True, exist_ok=True)
    bad_ids = load_bad_ids()
    rows = []
    for d in meta:
        card_id = Path(d["card_image"]).stem
        if ids and card_id not in ids:
            continue
        img_path = CARDS_DIR / d["card_image"]
        img_cv = cv2.imread(str(img_path))
        res, _ = ocr(str(img_path), box_thresh=OCR_BOX_THRESH, text_score=OCR_TEXT_SCORE)
        res = res or []
        digits = extract_digits(res)
        windows = get_cost_row_windows(img_cv)
        costs, entries = map_costs_from_trapezoids(
            img_cv,
            ocr,
            digits=digits,
            templates=templates,
            card_id=card_id,
            bad_ids=bad_ids,
        )
        costs, override_tag = apply_cost_override(card_id, costs)
        vis = img_cv.copy()
        # draw row windows
        for x0, y0, x1, y1, _ in windows:
            cv2.rectangle(vis, (x0, y0), (x1, y1), (255, 0, 255), 1)
        # draw detected digit boxes
        for entry in entries:
            # draw trapezoid contour if available
            mask, contour, area = find_trapezoid_mask(img_cv, (*entry["window"], entry["row_cy"]))
            if contour is not None:
                contour = contour + np.array([[entry["window"][0], entry["window"][1]]])
                cv2.drawContours(vis, [contour], -1, (0, 200, 200), 1)
            xs = [p[0] for p in entry["box"]]
            ys = [p[1] for p in entry["box"]]
            x0, y0, x1, y1 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
            cv2.rectangle(vis, (x0, y0), (x1, y1), (0, 200, 0), 1)
            label = f"{entry['value']} {entry['color']} {entry.get('source','')}"
            cv2.putText(
                vis,
                label,
                (x0, max(0, y0 - 2)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.3,
                (0, 200, 0),
                1,
            )
        out_path = out_dir / d["card_image"]
        cv2.imwrite(str(out_path), vis)
        rows.append((Path(d["card_image"]).stem, costs, d["card_image"]))

    html_rows = []
    for card_id, cost, image in rows:
        html_rows.append(f"""
      <div class="item">
        <img src="{image}" alt="{card_id}">
        <div class="meta">{card_id}</div>
        <div class="meta">{json.dumps(cost, ensure_ascii=False)}</div>
      </div>
""")

    (out_dir / output_name).write_text(f"""<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cost Debug</title>
  <style>
    body {{
      margin: 0;
      font-family: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background: #f6f4ef;
      color: #1f2937;
    }}
    header {{
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #fff;
      position: sticky;
      top: 0;
      z-index: 10;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
      padding: 12px;
    }}
    .item {{
      background: #fff;
      border: 1px solid #e5e7eb;
      padding: 8px;
    }}
    img {{
      width: 100%;
      height: auto;
      border: 1px solid #e5e7eb;
      background: #fff;
      display: block;
    }}
    .meta {{
      font-size: 11px;
      color: #6b7280;
      margin-top: 4px;
      word-break: break-all;
    }}
  </style>
</head>
<body>
  <header>
    <strong>Cost Debug Windows</strong>
  </header>
  <div class="grid">
    {''.join(html_rows)}
  </div>
</body>
</html>
""", encoding="utf-8")
    print(f"Wrote {out_dir / output_name}")


def write_evolution_debug(cards, debug, output_name="index.html"):
    out_dir = ASSETS_DIR / "evolution_debug"
    out_dir.mkdir(parents=True, exist_ok=True)
    debug_by_id = {d.get("id"): d for d in (debug or [])}

    html_rows = []
    for card in cards:
        card_id = card.get("id")
        if not card_id:
            continue
        source = card.get("source") or {}
        image = source.get("image")
        if not image:
            continue
        evo = card.get("evolution") or {}
        dbg = debug_by_id.get(card_id) or {}
        evo_req = dbg.get("evo_req", {})
        evo_meta = dbg.get("evo_req_meta") or {}
        img_path = CARDS_DIR / image
        img_cv = cv2.imread(str(img_path))
        if img_cv is not None:
            digit = evo_meta.get("digit") or {}
            box = digit.get("box")
            if box:
                xs = [p[0] for p in box]
                ys = [p[1] for p in box]
                x0, y0, x1, y1 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
                cv2.rectangle(img_cv, (x0, y0), (x1, y1), (0, 200, 0), 1)
                label = str(digit.get("value"))
                cv2.putText(
                    img_cv,
                    label,
                    (x0, max(0, y0 - 2)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.35,
                    (0, 200, 0),
                    1,
                )
            out_path = out_dir / image
            cv2.imwrite(str(out_path), img_cv)

        html_rows.append(f"""
      <div class="item">
        <img src="{image}" alt="{card_id}">
        <div class="meta">{card_id}</div>
        <div class="meta">{card.get("name") or ""} / {card.get("name_en") or ""}</div>
        <div class="meta">tier: {card.get("tier")}</div>
        <div class="meta">evo_target_zh: {evo.get("target_zh")}</div>
        <div class="meta">evo_target_en: {evo.get("target_en")}</div>
        <div class="meta">requirements: {json.dumps(evo.get("requirements", {}), ensure_ascii=False)}</div>
        <div class="meta">evo_req_raw: {json.dumps(evo_req or {}, ensure_ascii=False)}</div>
        <div class="meta">evo_req_color: {evo_meta.get("color")}</div>
      </div>
""")

    (out_dir / output_name).write_text(f"""<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Evolution Debug</title>
  <style>
    body {{
      margin: 0;
      font-family: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background: #f6f4ef;
      color: #1f2937;
    }}
    header {{
      padding: 12px 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #fff;
      position: sticky;
      top: 0;
      z-index: 10;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
      padding: 12px;
    }}
    .item {{
      background: #fff;
      border: 1px solid #e5e7eb;
      padding: 8px;
    }}
    img {{
      width: 100%;
      height: auto;
      border: 1px solid #e5e7eb;
      background: #fff;
      display: block;
    }}
    .meta {{
      font-size: 11px;
      color: #6b7280;
      margin-top: 4px;
      word-break: break-all;
    }}
  </style>
</head>
<body>
  <header>
    <strong>Evolution Debug</strong>
  </header>
  <div class="grid">
    {''.join(html_rows)}
  </div>
</body>
</html>
""", encoding="utf-8")
    print(f"Wrote {out_dir / output_name}")


def load_correct_cards(path):
    if not path.exists():
        raise FileNotFoundError(f"missing correct list: {path}")
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    if text.lstrip().startswith("["):
        data = json.loads(text)
        if not isinstance(data, list):
            raise ValueError("correct list JSON must be an array or JSONL")
        return data
    cards = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        cards.append(json.loads(line))
    return cards


def normalize_cost(cost):
    if cost is None:
        return {}
    out = {}
    for key, value in cost.items():
        try:
            value_int = int(value)
        except (TypeError, ValueError):
            continue
        if value_int:
            out[str(key)] = value_int
    return out


def normalize_bonuses(bonuses):
    if bonuses is None:
        return []
    if isinstance(bonuses, str):
        bonuses = [bonuses]
    return sorted(str(b) for b in bonuses)


def compare_expected_field(field, expected, actual):
    if field == "cost":
        return normalize_cost(expected) == normalize_cost(actual)
    if field in {"bonus", "bonuses"}:
        return normalize_bonuses(expected) == normalize_bonuses(actual)
    return expected == actual


def run_self_assessment(cards, correct_path=CORRECT_PATH):
    try:
        correct_cards = load_correct_cards(correct_path)
    except Exception as exc:
        print(f"Self-assessment failed: {exc}")
        return False
    if not correct_cards:
        print("Self-assessment failed: correct list is empty")
        return False

    cards_by_id = {c.get("id"): c for c in cards}
    missing = []
    mismatches = []
    for expected in correct_cards:
        card_id = expected.get("id")
        if not card_id:
            continue
        actual = cards_by_id.get(card_id)
        if actual is None:
            missing.append(card_id)
            continue
        for field, exp_val in expected.items():
            if field == "id":
                continue
            act_val = actual.get(field)
            if not compare_expected_field(field, exp_val, act_val):
                mismatches.append((card_id, field, exp_val, act_val))

    if missing:
        print(f"Self-assessment missing {len(missing)} cards:")
        for card_id in missing:
            print(f"  - {card_id}")
    if mismatches:
        print(f"Self-assessment mismatches: {len(mismatches)}")
        for card_id, field, exp_val, act_val in mismatches:
            print(f"  - {card_id} {field}: expected={exp_val} actual={act_val}")
    if missing or mismatches:
        return False
    print(f"Self-assessment OK: {len(correct_cards)} cards matched.")
    return True


def normalize_evolution_target(value):
    if value is None:
        return None
    if isinstance(value, list):
        return sorted(value)
    return value


def normalize_requirements(req):
    if req is None:
        return {}
    out = {}
    for key, value in req.items():
        try:
            value_int = int(value)
        except (TypeError, ValueError):
            continue
        if value_int:
            out[str(key)] = value_int
    return out


def json_safe(value):
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [json_safe(v) for v in value]
    if isinstance(value, np.generic):
        return value.item()
    return value


def run_upgrade_assessment(cards, gold=UPGRADE_GOLD):
    if not gold:
        print("Upgrade assessment failed: no gold labels defined")
        return False
    cards_by_id = {c.get("id"): c for c in cards}
    missing = []
    mismatches = []
    for card_id, expected in gold.items():
        actual_card = cards_by_id.get(card_id)
        if actual_card is None:
            missing.append(card_id)
            continue
        actual_evo = actual_card.get("evolution") or {}
        for key, exp_val in expected.items():
            if key == "requirements":
                exp_norm = normalize_requirements(exp_val)
                act_norm = normalize_requirements(actual_evo.get("requirements"))
                if exp_norm != act_norm:
                    mismatches.append((card_id, key, exp_norm, act_norm))
                continue
            if key in {"target_en", "target_zh"}:
                exp_norm = normalize_evolution_target(exp_val)
                act_norm = normalize_evolution_target(actual_evo.get(key))
                if exp_norm != act_norm:
                    mismatches.append((card_id, key, exp_norm, act_norm))
                continue
            act_val = actual_evo.get(key)
            if exp_val != act_val:
                mismatches.append((card_id, key, exp_val, act_val))

    if missing:
        print(f"Upgrade assessment missing {len(missing)} cards:")
        for card_id in missing:
            print(f"  - {card_id}")
    if mismatches:
        print(f"Upgrade assessment mismatches: {len(mismatches)}")
        for card_id, key, exp_val, act_val in mismatches:
            print(f"  - {card_id} {key}: expected={exp_val} actual={act_val}")
    if missing or mismatches:
        return False
    print(f"Upgrade assessment OK: {len(gold)} cards matched.")
    return True


def update_costs_only():
    ocr = RapidOCR()
    meta = json.loads(META_PATH.read_text())
    templates = build_digit_templates(meta, ocr)
    bad_ids = load_bad_ids()
    cards = json.loads(OUTPUT_PATH.read_text()) if OUTPUT_PATH.exists() else []
    debug = json.loads(DEBUG_PATH.read_text()) if DEBUG_PATH.exists() else []

    cards_by_id = {c.get("id"): c for c in cards}
    debug_by_id = {d.get("id"): d for d in debug}

    cards_out = []
    debug_out = []

    for d in meta:
        card_id = Path(d["card_image"]).stem
        img_path = CARDS_DIR / d["card_image"]
        img_cv = cv2.imread(str(img_path))
        if img_cv is None:
            continue
        res, _ = ocr(str(img_path), box_thresh=OCR_BOX_THRESH, text_score=OCR_TEXT_SCORE)
        res = res or []
        digits = extract_digits(res)
        cost, cost_source, cost_entries = map_costs(
            digits,
            img_cv,
            ocr,
            templates,
            card_id=card_id,
            bad_ids=bad_ids,
        )
        cost, override_tag = apply_cost_override(card_id, cost)
        if override_tag:
            cost_source = override_tag

        card = cards_by_id.get(card_id)
        if card is None:
            continue
        card["cost"] = cost
        cards_out.append(card)

        dbg = debug_by_id.get(card_id)
        if dbg is None:
            dbg = {"id": card_id}
        dbg["cost"] = cost
        dbg["cost_source"] = cost_source
        dbg["cost_entries"] = cost_entries
        debug_out.append(dbg)

    OUTPUT_PATH.write_text(json.dumps(cards_out, ensure_ascii=False, indent=2))
    DEBUG_PATH.write_text(json.dumps(debug_out, ensure_ascii=False, indent=2))
    print(f"Wrote {OUTPUT_PATH} ({len(cards_out)} cards)")
    print(f"Wrote {DEBUG_PATH}")


def update_requirements_only():
    ocr = RapidOCR()
    meta = json.loads(META_PATH.read_text())
    req_digit_templates = build_requirement_digit_templates(meta, ocr)
    cards = json.loads(OUTPUT_PATH.read_text()) if OUTPUT_PATH.exists() else []
    debug = json.loads(DEBUG_PATH.read_text()) if DEBUG_PATH.exists() else []

    cards_by_id = {c.get("id"): c for c in cards}
    debug_by_id = {d.get("id"): d for d in debug}

    cards_out = []
    debug_out = []

    for d in meta:
        card_id = Path(d["card_image"]).stem
        img_path = CARDS_DIR / d["card_image"]
        img_cv = cv2.imread(str(img_path))
        if img_cv is None:
            continue
        res, _ = ocr(str(img_path), box_thresh=OCR_BOX_THRESH, text_score=OCR_TEXT_SCORE)
        res = res or []
        digits = extract_digits(res)
        evo_req, evo_meta = map_requirements(digits, img_cv, ocr=ocr, req_templates=req_digit_templates)

        card = cards_by_id.get(card_id)
        if card is None:
            continue
        evo = card.get("evolution") or {}
        evo["requirements"] = evo_req
        card["evolution"] = evo
        cards_out.append(card)

        dbg = debug_by_id.get(card_id)
        if dbg is None:
            dbg = {"id": card_id}
        dbg["evo_req"] = evo_req
        dbg["evo_req_meta"] = json_safe(evo_meta)
        debug_out.append(dbg)

    OUTPUT_PATH.write_text(json.dumps(cards_out, ensure_ascii=False, indent=2))
    DEBUG_PATH.write_text(json.dumps(debug_out, ensure_ascii=False, indent=2))
    print(f"Wrote {OUTPUT_PATH} ({len(cards_out)} cards)")
    print(f"Wrote {DEBUG_PATH}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--cost-debug", action="store_true", help="write cost debug overlay images")
    parser.add_argument("--compare", action="store_true", help="write cards_compare.html/csv")
    parser.add_argument("--no-build", action="store_true", help="skip full build (use existing JSON outputs)")
    parser.add_argument("--cost-only", action="store_true", help="recompute costs only (no CLIP)")
    parser.add_argument("--requirements-only", action="store_true", help="recompute evolution requirements only (no CLIP)")
    parser.add_argument("--self-assessment", action="store_true", help="validate outputs against correct list")
    parser.add_argument("--assess-upgrade", action="store_true", help="validate evolution outputs against gold labels")
    parser.add_argument("--evolution-debug", action="store_true", help="write evolution debug page")
    args = parser.parse_args()

    cards = None
    debug = None

    if args.cost_only:
        update_costs_only()
        if OUTPUT_PATH.exists():
            cards = json.loads(OUTPUT_PATH.read_text())
        if DEBUG_PATH.exists():
            debug = json.loads(DEBUG_PATH.read_text())
    elif args.requirements_only:
        update_requirements_only()
        if OUTPUT_PATH.exists():
            cards = json.loads(OUTPUT_PATH.read_text())
        if DEBUG_PATH.exists():
            debug = json.loads(DEBUG_PATH.read_text())
    elif not args.no_build:
        cards, debug, _ = build()
    else:
        if OUTPUT_PATH.exists():
            cards = json.loads(OUTPUT_PATH.read_text())
        if DEBUG_PATH.exists():
            debug = json.loads(DEBUG_PATH.read_text())

    if args.compare and cards is not None and debug is not None:
        write_compare_outputs(cards, debug)

    if args.self_assessment:
        if cards is None and OUTPUT_PATH.exists():
            cards = json.loads(OUTPUT_PATH.read_text())
        if cards is None:
            print("Self-assessment failed: missing cards data")
        else:
            ok = run_self_assessment(cards)
            if not ok:
                raise SystemExit(1)

    if args.cost_debug:
        ocr = RapidOCR()
        meta = json.loads(META_PATH.read_text())
        templates = build_digit_templates(meta, ocr)
        write_cost_debug(meta, ocr, templates=templates)

    if args.evolution_debug:
        if cards is None and OUTPUT_PATH.exists():
            cards = json.loads(OUTPUT_PATH.read_text())
        if debug is None and DEBUG_PATH.exists():
            debug = json.loads(DEBUG_PATH.read_text())
        if cards is None:
            print("Evolution debug failed: missing cards data")
        else:
            write_evolution_debug(cards, debug)

    if args.assess_upgrade:
        if cards is None and OUTPUT_PATH.exists():
            cards = json.loads(OUTPUT_PATH.read_text())
        if cards is None:
            print("Upgrade assessment failed: missing cards data")
        else:
            ok = run_upgrade_assessment(cards)
            if not ok:
                raise SystemExit(1)
