"""Assemble the JSON payload inlined into the report viewer (index.html)."""
from __future__ import annotations

from typing import Any

from .discovery import (
    ComparisonBundle,
    OrphanRun,
    ScenarioBundle,
    TargetBundle,
    classify_browser_visible,
)


def _stamp_kind_on_browser_visible(
    entries: list[dict[str, Any]] | None,
    *,
    page_url: str | None,
    allowlist: list[str],
    background_paths: list[str],
) -> list[dict[str, Any]]:
    if not entries:
        return []
    out: list[dict[str, Any]] = []
    for e in entries:
        kind = classify_browser_visible(
            e,
            page_url=page_url,
            allowlist=allowlist,
            background_paths=background_paths,
        )
        out.append({**e, "_kind": kind})
    return out


def _emit_target(
    target: TargetBundle,
    *,
    allowlist: list[str],
    background_paths: list[str],
) -> dict[str, Any]:
    browser_ctx = target.get("browserContext") or {}
    page = (browser_ctx.get("page") or None) if isinstance(browser_ctx, dict) else None
    raw_browser = browser_ctx.get("browserVisibleRequests") if isinstance(browser_ctx, dict) else None
    classified = _stamp_kind_on_browser_visible(
        raw_browser,
        page_url=(page or {}).get("url") if page else None,
        allowlist=allowlist,
        background_paths=background_paths,
    )
    return {
        "side": target.get("side"),
        "runId": target.get("runId"),
        "pageContext": page,
        "browserVisibleRequests": classified,
        "exchanges": target.get("exchanges") or [],
    }


def _emit_comparison(
    cb: ComparisonBundle,
    *,
    scenario: dict[str, Any],
) -> dict[str, Any]:
    targets_out: dict[str, Any] = {}
    for side in ("old", "new"):
        t = cb["targets"].get(side)
        if not t:
            continue
        allow = (scenario.get("browserApiAllowlist") or {}).get(side) or []
        background_paths = _scenario_background_paths(cb, side)
        targets_out[side] = _emit_target(t, allowlist=allow, background_paths=background_paths)
    return {
        "comparisonRunId": cb["comparisonRunId"],
        "createdAt": cb.get("createdAt"),
        "issues": cb.get("issues") or [],
        "hasSuggestion": cb.get("suggestion") is not None,
        "targets": targets_out,
        "analysis": cb.get("analysis"),
    }


def _scenario_background_paths(cb: ComparisonBundle, side: str) -> list[str]:
    """Pull background endpoint paths for the given side from suggestion (if any),
    so browser-visible classification can flag the matching browser API as background.
    """
    suggestion = cb.get("suggestion") or {}
    observed = suggestion.get("observed") or {}
    bg = (observed.get("backgroundCandidates") or {}).get("upstream") or {}
    return list(bg.get(side) or [])


def build_report_payload(
    bundles: list[ScenarioBundle],
    orphans: list[OrphanRun],
    *,
    generated_at: str,
    sot_path: str,
) -> dict[str, Any]:
    scenarios_out: list[dict[str, Any]] = []
    for sb in bundles:
        s = sb["scenario"]
        comparisons_out = [
            _emit_comparison(cb, scenario=s)
            for cb in sb["comparisons"]
        ]
        scenarios_out.append({
            "id": s.get("id"),
            "feature": s.get("feature"),
            "description": s.get("description"),
            "type": s.get("type"),
            "page": s.get("page") or {},
            "browserApiAllowlist": s.get("browserApiAllowlist") or {"old": [], "new": []},
            "upstreamApiCandidates": s.get("upstreamApiCandidates") or {"old": [], "new": []},
            "notes": s.get("notes") or [],
            "comparisons": comparisons_out,
        })
    return {
        "generatedAt": generated_at,
        "sotPath": sot_path,
        "scenarios": scenarios_out,
        "orphans": orphans,
    }
