#!/usr/bin/env python3
"""Build the SOT-driven API audit viewers.

Produces two self-contained file:// HTML artifacts:
  - <runs-dir>/index.html   — scenario report
  - <runs-dir>/review.html  — suggestion review

Both inline all required data: scenario dictionary entries, comparison
artifacts, analysis artifacts, suggestion artifacts (review only), and raw
exchange NDJSON for each referenced run (report only).

Usage:
    python3 build-viewer.py
    python3 build-viewer.py --scenario account-activity-basic
    python3 build-viewer.py --sot custom/dictionary.json --runs-dir ./.audit-runs
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from audit_viewer import (  # noqa: E402  (path injection precedes import)
    attach_suggestions,
    build_report_payload,
    build_review_payload,
    discover_scenario_bundles,
    load_suggestion_artifacts,
    render_html,
    write_viewer,
)

DEFAULT_WORKSPACE_ROOT = Path.cwd()
DEFAULT_RUNS_DIR = DEFAULT_WORKSPACE_ROOT / ".pi-api-audit-runs"
DEFAULT_SOT = DEFAULT_RUNS_DIR / "scenarios.local.json"
TOOLS_DIR = Path(__file__).resolve().parent
DEFAULT_REPORT_TEMPLATE = TOOLS_DIR / "viewer-template.html"
DEFAULT_REVIEW_TEMPLATE = TOOLS_DIR / "review-template.html"
DEFAULT_SHARED_JS = TOOLS_DIR / "viewer-shared.js"


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sot", type=Path, default=DEFAULT_SOT)
    parser.add_argument("--runs-dir", type=Path, default=DEFAULT_RUNS_DIR)
    parser.add_argument(
        "--scenario",
        action="append",
        default=None,
        help="scenario id to include (repeatable). when given, all other scenarios are skipped.",
    )
    parser.add_argument("--report-output", type=Path, default=None)
    parser.add_argument("--review-output", type=Path, default=None)
    parser.add_argument("--report-template", type=Path, default=DEFAULT_REPORT_TEMPLATE)
    parser.add_argument("--review-template", type=Path, default=DEFAULT_REVIEW_TEMPLATE)
    parser.add_argument("--shared-js", type=Path, default=DEFAULT_SHARED_JS)
    parser.add_argument(
        "--include",
        action="append",
        default=None,
        help="DEPRECATED: pre-SOT runId filter. Has no effect in the SOT-driven flow.",
    )
    args = parser.parse_args()

    if args.include:
        print(
            f"warn: --include {args.include} is deprecated and ignored. "
            "Use --scenario <id> to filter SOT scenarios.",
            file=sys.stderr,
        )

    scenario_filter = set(args.scenario) if args.scenario else None
    bundles, orphans = discover_scenario_bundles(
        args.sot, args.runs_dir, scenario_filter=scenario_filter,
    )
    suggestions = load_suggestion_artifacts(args.runs_dir)
    attach_suggestions(bundles, suggestions)

    if not bundles:
        if scenario_filter:
            raise SystemExit(f"no scenarios matched --scenario filter: {sorted(scenario_filter)}")
        raise SystemExit(f"no scenarios in SOT: {args.sot}")

    shared_js = args.shared_js.read_text() if args.shared_js.exists() else ""
    if not shared_js:
        print(f"warn: shared JS file not found at {args.shared_js}", file=sys.stderr)

    generated_at = now_iso()
    sot_path_str = str(args.sot)

    # ─── report ─────────────────────────────────────────────────────────────
    report_payload = build_report_payload(
        bundles, orphans,
        generated_at=generated_at, sot_path=sot_path_str,
    )
    report_html = render_html(args.report_template, report_payload, shared_js)
    report_output = args.report_output or (args.runs_dir / "index.html")
    write_viewer(report_output, report_html, label="report")

    n_scen = len(report_payload["scenarios"])
    n_comp = sum(len(s["comparisons"]) for s in report_payload["scenarios"])
    n_orph = len(orphans)
    print(
        f"  report: {n_scen} scenario(s), {n_comp} comparison(s), {n_orph} orphan run(s)"
    )

    # ─── review ─────────────────────────────────────────────────────────────
    review_payload = build_review_payload(
        bundles,
        generated_at=generated_at, sot_path=sot_path_str,
        suggestions=suggestions,
    )
    review_html = render_html(args.review_template, review_payload, shared_js)
    review_output = args.review_output or (args.runs_dir / "review.html")
    write_viewer(review_output, review_html, label="review")
    print(f"  review: {len(review_payload['suggestions'])} suggestion(s)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
