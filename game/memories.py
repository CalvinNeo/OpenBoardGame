import html
import json
import time
from typing import Iterable, List, Optional, Sequence, Tuple

BASE_STYLE = """
* {
  box-sizing: border-box;
}
body {
  margin: 24px;
  font-family: Arial, sans-serif;
  color: #111827;
  background: #ffffff;
}
h1 {
  margin: 0 0 6px 0;
}
h2 {
  margin: 24px 0 8px 0;
}
h3 {
  margin: 16px 0 6px 0;
}
.meta {
  color: #4b5563;
  font-size: 0.95em;
  margin-bottom: 4px;
}
.section {
  margin-top: 20px;
}
.card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
  background: #f9fafb;
}
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  background: #e0f2fe;
  color: #075985;
  margin-left: 6px;
}
.muted {
  color: #6b7280;
}
.small {
  font-size: 0.9em;
  color: #4b5563;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin-top: 8px;
}
th,
td {
  border: 1px solid #e5e7eb;
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f3f4f6;
}
pre {
  background: #f3f4f6;
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
  white-space: pre-wrap;
}
.mem-image {
  max-width: 360px;
  height: auto;
  border: 1px solid #e5e7eb;
  background: #ffffff;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.matrix-cell {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 6px;
  text-align: center;
  background: #ffffff;
}
.matrix-cell img {
  width: 100%;
  height: auto;
  display: block;
}
.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
details {
  margin-top: 6px;
}
"""


def esc(value: object, default: str = "") -> str:
    if value is None:
        return default
    return html.escape(str(value))


def format_bool(value: object) -> str:
    return "Yes" if bool(value) else "No"


def format_timestamp(value: object) -> str:
    try:
        ts = float(value)
    except (TypeError, ValueError):
        return "-"
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts))


def render_table(headers: Sequence[str], rows: List[List[str]], empty_message: str = "No data") -> str:
    if not rows:
        return f'<div class="muted">{esc(empty_message, empty_message)}</div>'
    header_html = "".join(f"<th>{esc(header, '-')}</th>" for header in headers)
    body_html = "".join(
        "<tr>" + "".join(f"<td>{cell}</td>" for cell in row) + "</tr>" for row in rows
    )
    return f"<table><thead><tr>{header_html}</tr></thead><tbody>{body_html}</tbody></table>"


def render_kv_table(pairs: Iterable[Tuple[str, str]], empty_message: str = "No data") -> str:
    rows = list(pairs)
    if not rows:
        return f'<div class="muted">{esc(empty_message, empty_message)}</div>'
    body_html = "".join(
        f"<tr><th>{esc(label, '-')}</th><td>{value}</td></tr>" for label, value in rows
    )
    return f"<table><tbody>{body_html}</tbody></table>"


def render_image(src: Optional[str], alt: str = "", class_name: str = "mem-image") -> str:
    if not src:
        return '<div class="muted">No image</div>'
    return f'<img class="{esc(class_name, class_name)}" src="{esc(src)}" alt="{esc(alt)}" />'


def render_json(data: object, indent: int = 2) -> str:
    try:
        payload = json.dumps(data, ensure_ascii=False, indent=indent)
    except (TypeError, ValueError):
        payload = str(data)
    return f"<pre>{esc(payload, payload)}</pre>"


def section(title: str, body: str) -> str:
    return f"<div class=\"section\"><h2>{esc(title, title)}</h2>{body}</div>"


def build_html_document(title: str, body: str, extra_style: str = "", extra_script: str = "") -> str:
    style = BASE_STYLE + ("\n" + extra_style if extra_style else "")
    script_block = f"<script>{extra_script}</script>" if extra_script else ""
    return (
        "<!DOCTYPE html>\n"
        "<html lang=\"en\">\n"
        "<head>\n"
        "  <meta charset=\"UTF-8\" />\n"
        "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n"
        f"  <title>{esc(title, title)}</title>\n"
        f"  <style>{style}</style>\n"
        "</head>\n"
        "<body>\n"
        f"{body}\n"
        f"{script_block}\n"
        "</body>\n"
        "</html>"
    )
