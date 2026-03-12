#!/usr/bin/env python3
import json
import math
import sys
from pathlib import Path


def badge_color(percent: float) -> str:
    if percent >= 90:
        return "#4c1"
    if percent >= 80:
        return "#97CA00"
    if percent >= 60:
        return "#dfb317"
    if percent >= 40:
        return "#fe7d37"
    return "#e05d44"


def escape_svg_text(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def text_width(value: str) -> int:
    return max(1, int(math.ceil(len(value) * 7.2 + 10)))


def render_svg(label: str, message: str, color: str) -> str:
    label_width = text_width(label)
    message_width = text_width(message)
    total_width = label_width + message_width
    label_midpoint = label_width / 2
    message_midpoint = label_width + message_width / 2

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="20" role="img" aria-label="{escape_svg_text(label)}: {escape_svg_text(message)}">
  <title>{escape_svg_text(label)}: {escape_svg_text(message)}</title>
  <linearGradient id="smooth" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </linearGradient>
  <clipPath id="round">
    <rect width="{total_width}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#round)">
    <rect width="{label_width}" height="20" fill="#555"/>
    <rect x="{label_width}" width="{message_width}" height="20" fill="{color}"/>
    <rect width="{total_width}" height="20" fill="url(#smooth)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="{label_midpoint}" y="15" fill="#010101" fill-opacity=".3">{escape_svg_text(label)}</text>
    <text x="{label_midpoint}" y="14">{escape_svg_text(label)}</text>
    <text x="{message_midpoint}" y="15" fill="#010101" fill-opacity=".3">{escape_svg_text(message)}</text>
    <text x="{message_midpoint}" y="14">{escape_svg_text(message)}</text>
  </g>
</svg>
"""


def main() -> int:
    if len(sys.argv) not in (6, 7):
        print(
            "usage: write-coverage-badge.py <json-path> [<svg-path>] <label> <percent> <metric> <details>",
            file=sys.stderr,
        )
        return 1

    json_path = Path(sys.argv[1])
    if len(sys.argv) == 7:
        svg_path = Path(sys.argv[2])
        offset = 1
    else:
        svg_path = None
        offset = 0

    label = sys.argv[2 + offset]
    percent = float(sys.argv[3 + offset])
    metric = sys.argv[4 + offset]
    details = sys.argv[5 + offset]

    message = f"{percent:.2f}%"
    color = badge_color(percent)

    json_path.parent.mkdir(parents=True, exist_ok=True)
    if svg_path is not None:
        svg_path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "schemaVersion": 1,
        "label": label,
        "message": message,
        "color": color,
        "metric": metric,
        "percent": round(percent, 2),
        "details": details,
    }

    json_path.write_text(json.dumps(payload, indent=2) + "\n")
    if svg_path is not None:
        svg_path.write_text(render_svg(label, message, color))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
