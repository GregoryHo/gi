"""Assemble the JSON payload inlined into the review viewer (review.html)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .discovery import ScenarioBundle


def _page_matches_sot(scenario_page: dict[str, Any] | None, observed_page: dict[str, Any] | None) -> dict[str, bool]:
    sp = scenario_page or {}
    op = observed_page or {}
    return {
        "old": bool(sp.get("oldPath")) and sp.get("oldPath") == op.get("oldPath"),
        "new": bool(sp.get("newPath")) and sp.get("newPath") == op.get("newPath"),
    }


def build_review_payload(
    bundles: list[ScenarioBundle],
    *,
    generated_at: str,
    sot_path: str,
    suggestions: dict[str, tuple[dict[str, Any], Path]] | None = None,
) -> dict[str, Any]:
    suggestions_out: list[dict[str, Any]] = []
    emitted_keys: set[str] = set()
    scenarios_by_id = {str(sb["scenario"].get("id")): sb["scenario"] for sb in bundles}

    for sb in bundles:
        scenario = sb["scenario"]
        for cb in sb["comparisons"]:
            suggestion = cb.get("suggestion")
            if not suggestion:
                continue
            emitted_keys.add(_suggestion_key(suggestion))
            suggestions_out.append(_emit_review_suggestion(
                suggestion,
                scenario=scenario,
                analysis=cb.get("analysis"),
            ))

    for suggestion, _path in (suggestions or {}).values():
        key = _suggestion_key(suggestion)
        if key in emitted_keys:
            continue
        scenario = scenarios_by_id.get(str(suggestion.get("scenarioId")), {})
        suggestions_out.append(_emit_review_suggestion(
            suggestion,
            scenario=scenario,
            analysis=_load_source_analysis(suggestion),
        ))

    return {
        "generatedAt": generated_at,
        "sotPath": sot_path,
        "suggestions": suggestions_out,
    }


def _emit_review_suggestion(
    suggestion: dict[str, Any],
    *,
    scenario: dict[str, Any],
    analysis: dict[str, Any] | None,
) -> dict[str, Any]:
    observed = suggestion.get("observed") or {}
    return {
        "scenarioId": suggestion.get("scenarioId"),
        "comparisonRunId": suggestion.get("comparisonRunId"),
        "mode": suggestion.get("mode"),
        "sourceAnalysisPath": suggestion.get("sourceAnalysisPath"),
        "generatedAt": suggestion.get("generatedAt"),
        "notes": suggestion.get("notes") or [],
        "observed": observed,
        "suggestion": suggestion,
        "sotScenario": scenario,
        "analysis": analysis,
        "pageMatchesSot": _page_matches_sot(
            scenario.get("page"),
            observed.get("page"),
        ),
    }


def _suggestion_key(suggestion: dict[str, Any]) -> str:
    return f"{suggestion.get('scenarioId')}::{suggestion.get('comparisonRunId')}"


def _load_source_analysis(suggestion: dict[str, Any]) -> dict[str, Any] | None:
    source = suggestion.get("sourceAnalysisPath")
    if not source:
        return None
    try:
        path = Path(source)
        if not path.exists():
            return None
        return json.loads(path.read_text())
    except Exception:
        return None
