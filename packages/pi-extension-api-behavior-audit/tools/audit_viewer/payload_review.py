"""Assemble the JSON payload inlined into the review viewer (review.html)."""
from __future__ import annotations

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
) -> dict[str, Any]:
    suggestions_out: list[dict[str, Any]] = []
    for sb in bundles:
        scenario = sb["scenario"]
        for cb in sb["comparisons"]:
            suggestion = cb.get("suggestion")
            if not suggestion:
                continue
            observed = suggestion.get("observed") or {}
            suggestions_out.append({
                "scenarioId": suggestion.get("scenarioId"),
                "comparisonRunId": suggestion.get("comparisonRunId"),
                "mode": suggestion.get("mode"),
                "sourceAnalysisPath": suggestion.get("sourceAnalysisPath"),
                "generatedAt": suggestion.get("generatedAt"),
                "notes": suggestion.get("notes") or [],
                "observed": observed,
                "suggestion": suggestion,
                "sotScenario": scenario,
                "analysis": cb.get("analysis"),
                "pageMatchesSot": _page_matches_sot(
                    scenario.get("page"),
                    observed.get("page"),
                ),
            })
    return {
        "generatedAt": generated_at,
        "sotPath": sot_path,
        "suggestions": suggestions_out,
    }
