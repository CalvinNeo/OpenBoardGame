import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = REPO_ROOT / "assets" / "skye" / "tile_manifest_draft.json"
OUTPUT_PATH = REPO_ROOT / "assets" / "skye" / "tile_review.html"

GROUP_TITLES = {
    "general": "General",
    "ship": "Ship",
    "lighthouse": "Lighthouse",
    "broch": "Broch",
    "broch_pair": "Broch Pair",
}


def _html_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    grouped = {group: [] for group in GROUP_TITLES}
    for entry in manifest:
        grouped.setdefault(entry["group"], []).append(entry)

    parts = [
        "<!doctype html>",
        "<html lang='en'>",
        "<head>",
        "  <meta charset='utf-8'>",
        "  <meta name='viewport' content='width=device-width, initial-scale=1'>",
        "  <title>Skye Tile Review</title>",
        "  <style>",
        "    :root {",
        "      --bg: #f4efe4;",
        "      --ink: #1f1b17;",
        "      --muted: #675f57;",
        "      --card: #fffbf5;",
        "      --line: #d8cbb4;",
        "      --accent: #2f5d50;",
        "    }",
        "    * { box-sizing: border-box; }",
        "    body {",
        "      margin: 0;",
        "      font-family: Georgia, 'Times New Roman', serif;",
        "      color: var(--ink);",
        "      background: linear-gradient(180deg, #f6f1e8 0%, #eadfc9 100%);",
        "    }",
        "    header {",
        "      position: sticky;",
        "      top: 0;",
        "      z-index: 10;",
        "      padding: 20px 24px 16px;",
        "      background: rgba(250, 244, 234, 0.92);",
        "      backdrop-filter: blur(10px);",
        "      border-bottom: 1px solid var(--line);",
        "    }",
        "    h1, h2, h3, p { margin: 0; }",
        "    header h1 { font-size: 28px; }",
        "    header p { margin-top: 6px; color: var(--muted); max-width: 900px; line-height: 1.45; }",
        "    main { padding: 24px; }",
        "    section + section { margin-top: 44px; }",
        "    .group-head { margin-bottom: 18px; }",
        "    .group-head h2 { font-size: 24px; color: var(--accent); }",
        "    .group-head p { margin-top: 4px; color: var(--muted); }",
        "    .grid {",
        "      display: grid;",
        "      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));",
        "      gap: 16px;",
        "    }",
        "    .card {",
        "      background: var(--card);",
        "      border: 1px solid var(--line);",
        "      border-radius: 14px;",
        "      padding: 12px;",
        "      box-shadow: 0 10px 30px rgba(68, 52, 31, 0.08);",
        "    }",
        "    .tile-wrap {",
        "      aspect-ratio: 1 / 1;",
        "      display: grid;",
        "      place-items: center;",
        "      background: #efe6d6;",
        "      border-radius: 10px;",
        "      overflow: hidden;",
        "    }",
        "    .tile-wrap img { width: 100%; height: 100%; object-fit: contain; image-rendering: auto; }",
        "    .meta { margin-top: 10px; display: grid; gap: 6px; }",
        "    .tile-no { font-size: 13px; color: var(--muted); }",
        "    .tile-id { font-size: 15px; line-height: 1.35; word-break: break-word; }",
        "    .filename { font-size: 12px; line-height: 1.35; color: var(--muted); word-break: break-word; }",
        "    .parts { font-size: 12px; color: var(--accent); }",
        "  </style>",
        "</head>",
        "<body>",
        "  <header>",
        "    <h1>Isle of Skye Tile Review</h1>",
        "    <p>This page is for visual audit only. It renders the curated tile inventory with filenames and inferred code parts so the current parsing mistakes can be checked against the actual artwork.</p>",
        "  </header>",
        "  <main>",
    ]

    for group in ("general", "ship", "lighthouse", "broch", "broch_pair"):
        entries = grouped.get(group, [])
        if not entries:
            continue
        entries = sorted(entries, key=lambda item: item["tile_no"])
        parts.append("    <section>")
        parts.append("      <div class='group-head'>")
        parts.append(f"        <h2>{_html_escape(GROUP_TITLES.get(group, group.title()))}</h2>")
        parts.append(f"        <p>{len(entries)} tiles</p>")
        parts.append("      </div>")
        parts.append("      <div class='grid'>")
        for entry in entries:
            image_path = _html_escape(entry["curated_path"])
            tile_id = _html_escape(entry["tile_id"])
            safe_filename = _html_escape(entry["safe_filename"])
            code_parts = ", ".join(str(value) for value in entry.get("inferred_code_parts", []))
            parts.extend(
                [
                    "        <article class='card'>",
                    "          <div class='tile-wrap'>",
                    f"            <img src='{image_path}' alt='{tile_id}'>",
                    "          </div>",
                    "          <div class='meta'>",
                    f"            <div class='tile-no'>Tile #{entry['tile_no']}</div>",
                    f"            <div class='tile-id'>{tile_id}</div>",
                    f"            <div class='filename'>{safe_filename}</div>",
                    f"            <div class='parts'>code parts: [{_html_escape(code_parts)}]</div>",
                    "          </div>",
                    "        </article>",
                ]
            )
        parts.append("      </div>")
        parts.append("    </section>")

    parts.extend(
        [
            "  </main>",
            "</body>",
            "</html>",
        ]
    )

    OUTPUT_PATH.write_text("\n".join(parts) + "\n", encoding="utf-8")
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()
