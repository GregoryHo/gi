"""Internal builder for the SOT-driven API audit viewers (report + review)."""

from .discovery import (
    ComparisonBundle,
    OrphanRun,
    ScenarioBundle,
    TargetBundle,
    attach_suggestions,
    classify_browser_visible,
    discover_scenario_bundles,
    load_scenario_dictionary,
    load_suggestion_artifacts,
    normalize_exchanges,
)
from .payload_report import build_report_payload
from .payload_review import build_review_payload
from .render import (
    PAYLOAD_MARKER,
    SHARED_HELPERS_MARKER,
    render_html,
    write_viewer,
)

__all__ = [
    "ComparisonBundle",
    "OrphanRun",
    "PAYLOAD_MARKER",
    "SHARED_HELPERS_MARKER",
    "ScenarioBundle",
    "TargetBundle",
    "attach_suggestions",
    "build_report_payload",
    "build_review_payload",
    "classify_browser_visible",
    "discover_scenario_bundles",
    "load_scenario_dictionary",
    "load_suggestion_artifacts",
    "normalize_exchanges",
    "render_html",
    "write_viewer",
]
