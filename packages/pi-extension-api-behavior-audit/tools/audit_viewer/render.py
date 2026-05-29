"""Render a viewer HTML by inlining the payload and the shared JS helpers."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

PAYLOAD_MARKER = "/*__AUDIT_PAYLOAD__*/null"
SHARED_HELPERS_MARKER = "/*__SHARED_HELPERS__*/"


def render_html(template_path: Path, payload: dict[str, Any], shared_js: str) -> str:
    template = template_path.read_text()
    if PAYLOAD_MARKER not in template:
        raise SystemExit(f"template missing payload marker: {template_path}")
    if SHARED_HELPERS_MARKER not in template:
        raise SystemExit(f"template missing shared helpers marker: {template_path}")
    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    payload_json = payload_json.replace("</", "<\\/")  # premature </script> guard
    html = template.replace(PAYLOAD_MARKER, payload_json)
    html = html.replace(SHARED_HELPERS_MARKER, shared_js)
    return html


def write_viewer(output_path: Path, html: str, *, label: str = "viewer") -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html)
    size_kib = output_path.stat().st_size / 1024
    print(f"wrote {label}: {output_path} ({size_kib:.1f} KiB)")
