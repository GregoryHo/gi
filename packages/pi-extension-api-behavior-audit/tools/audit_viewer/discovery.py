"""SOT-driven discovery of scenarios, comparisons, analyses, suggestions, and raw runs.

Layered model:
    ScenarioBundle = one entry from default.scenarios.json + its evidence comparisons
    ComparisonBundle = one comparison artifact + optional analysis/suggestion + targets
    TargetBundle = one side (old|new) within a comparison + its raw run on disk

Missing artifacts populate `issues[]` and leave the corresponding field as None
rather than raising — viewers render placeholders.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Iterable, Literal, Optional, TypedDict
from urllib.parse import urlparse


# ─── types ──────────────────────────────────────────────────────────────────


class TargetBundle(TypedDict, total=False):
    side: Literal["old", "new"]
    runId: str
    manifestPath: str
    manifest: Optional[dict[str, Any]]
    exchanges: Optional[list[dict[str, Any]]]
    browserContext: Optional[dict[str, Any]]


class ComparisonBundle(TypedDict, total=False):
    comparisonRunId: str
    createdAt: Optional[str]
    comparison: Optional[dict[str, Any]]
    analysis: Optional[dict[str, Any]]
    suggestion: Optional[dict[str, Any]]
    suggestionPath: Optional[str]
    targets: dict[str, TargetBundle]  # keyed by "old" | "new"
    issues: list[str]


class ScenarioBundle(TypedDict):
    scenario: dict[str, Any]
    comparisons: list[ComparisonBundle]


class OrphanRun(TypedDict, total=False):
    runId: str
    manifestPath: str
    layer: Optional[str]
    scenarios: list[str]
    side: Optional[str]


# ─── loaders ────────────────────────────────────────────────────────────────


def load_scenario_dictionary(sot_path: Path) -> dict[str, Any]:
    if not sot_path.exists():
        raise SystemExit(f"scenario dictionary not found: {sot_path}")
    return json.loads(sot_path.read_text())


def _read_json(path: Path) -> Optional[dict[str, Any]]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as e:
        print(f"warn: malformed JSON in {path}: {e}", file=sys.stderr)
        return None


def load_comparison_artifact(runs_dir: Path, comparison_run_id: str) -> tuple[Optional[dict[str, Any]], Path]:
    path = runs_dir / "comparisons" / f"{comparison_run_id}.json"
    return _read_json(path), path


def load_analysis_artifact(runs_dir: Path, comparison_run_id: str) -> tuple[Optional[dict[str, Any]], Path]:
    path = runs_dir / "analysis" / f"{comparison_run_id}.json"
    return _read_json(path), path


def load_suggestion_artifacts(runs_dir: Path) -> dict[str, tuple[dict[str, Any], Path]]:
    """Load all suggestion artifacts under candidates/.

    Returns: dict keyed by (scenarioId, comparisonRunId) → (suggestion, path).
    Skips archive/ recursively. We require both `scenarioId` and `comparisonRunId`
    fields to be present; otherwise the suggestion is reported and skipped.
    """
    out: dict[str, tuple[dict[str, Any], Path]] = {}
    cand_dir = runs_dir / "candidates"
    if not cand_dir.exists():
        return out
    for p in sorted(cand_dir.glob("*.json")):
        data = _read_json(p)
        if not data:
            continue
        scenario_id = data.get("scenarioId")
        comparison_run_id = data.get("comparisonRunId")
        if not (scenario_id and comparison_run_id):
            print(f"warn: suggestion {p} missing scenarioId/comparisonRunId", file=sys.stderr)
            continue
        key = _suggestion_key(scenario_id, comparison_run_id)
        out[key] = (data, p)
    return out


def _suggestion_key(scenario_id: str, comparison_run_id: str) -> str:
    return f"{scenario_id}::{comparison_run_id}"


def load_raw_run(runs_dir: Path, run_id: str) -> tuple[Optional[dict[str, Any]], Optional[list[dict[str, Any]]], Path]:
    """Return (manifest, exchanges, manifest_path). Either field may be None."""
    run_dir = runs_dir / run_id
    manifest_path = run_dir / "manifest.json"
    exchanges_path = run_dir / "exchanges.ndjson"
    manifest = _read_json(manifest_path)
    exchanges: Optional[list[dict[str, Any]]] = None
    if exchanges_path.exists():
        exchanges = []
        for line in exchanges_path.read_text().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                exchanges.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"warn: malformed exchange line in {exchanges_path}: {e}", file=sys.stderr)
    return manifest, exchanges, manifest_path


# ─── normalization ──────────────────────────────────────────────────────────


def normalize_exchanges(
    exchanges: list[dict[str, Any]],
    *,
    manifest: dict[str, Any] | None,
    layer_default: str | None = None,
) -> list[dict[str, Any]]:
    """Stamp side on each exchange and rewrite proxy-localhost URLs to real targets.

    Mirrors the rewrite logic from the original build-viewer.py so timeline lanes
    show the upstream URL the proxy forwarded to, not the local listenUrl. The
    original URL is preserved on `request.originalUrl` for forensic traceability.
    """
    if not exchanges:
        return []
    layer = (manifest or {}).get("layer") or layer_default
    rp = ((manifest or {}).get("recordingProxy") or {})
    manifest_side = rp.get("side")
    listen_url = rp.get("listenUrl") or ""
    target_url = rp.get("targetBaseUrl") or ""
    out: list[dict[str, Any]] = []
    for ex in exchanges:
        ex = dict(ex)
        if "side" not in ex and manifest_side:
            ex["side"] = manifest_side
        req = dict(ex.get("request") or {})
        url = req.get("url") or ""
        if layer == "upstream" and listen_url and url.startswith(listen_url):
            req["originalUrl"] = url
            req["url"] = target_url + url[len(listen_url):]
            ex["request"] = req
        out.append(ex)
    return out


# ─── classification (browser-visible entry kinds) ───────────────────────────


def _path_of(url: str) -> str:
    try:
        return urlparse(url).path or ""
    except Exception:
        return ""


def _host_of(url: str) -> str:
    try:
        return urlparse(url).netloc or ""
    except Exception:
        return ""


def classify_browser_visible(
    entry: dict[str, Any],
    *,
    page_url: Optional[str],
    allowlist: Iterable[str],
    background_paths: Iterable[str],
) -> str:
    """Return one of: in-allowlist | background | third-party | unlisted.

    Substring containment is used for allowlist matching because the recorded
    `path` field often retains the query string (per the existing schema), and
    allowlist entries are bare paths.
    """
    entry_url = entry.get("url") or ""
    entry_path_full = entry.get("path") or _path_of(entry_url)
    entry_pathname = _path_of(entry_url) if entry_url else entry_path_full.split("?", 1)[0]
    entry_host = _host_of(entry_url)
    page_host = _host_of(page_url) if page_url else ""

    if page_host and entry_host and entry_host != page_host:
        return "third-party"
    for allow in allowlist:
        if allow and (allow == entry_pathname or allow in entry_path_full):
            return "in-allowlist"
    for bg in background_paths:
        if bg and (bg == entry_pathname or bg in entry_path_full):
            return "background"
    return "unlisted"


# ─── orchestrating walk ─────────────────────────────────────────────────────


def discover_scenario_bundles(
    sot_path: Path,
    runs_dir: Path,
    scenario_filter: Optional[set[str]] = None,
) -> tuple[list[ScenarioBundle], list[OrphanRun]]:
    """Walk SOT scenarios and resolve all their evidence comparisons.

    Returns (bundles, orphans). Bundles preserve SOT scenario order.
    """
    sot = load_scenario_dictionary(sot_path)
    scenarios = sot.get("scenarios") or []
    if scenario_filter is not None:
        scenarios = [s for s in scenarios if s.get("id") in scenario_filter]

    referenced_run_ids: set[str] = set()
    bundles: list[ScenarioBundle] = []
    for scenario in scenarios:
        scenario_bundle: ScenarioBundle = {"scenario": scenario, "comparisons": []}
        evidence = (scenario.get("evidence") or {}).get("comparisons") or []
        for ev in evidence:
            crid = ev.get("comparisonRunId")
            if not crid:
                continue
            comparison, comparison_path = load_comparison_artifact(runs_dir, crid)
            analysis, analysis_path = load_analysis_artifact(runs_dir, crid)
            issues: list[str] = []
            if comparison is None:
                issues.append(f"comparison artifact not found at {comparison_path.relative_to(runs_dir.parent) if comparison_path.is_absolute() else comparison_path}")
            if analysis is None:
                issues.append(f"analysis artifact not found at {analysis_path.relative_to(runs_dir.parent) if analysis_path.is_absolute() else analysis_path}")

            targets: dict[str, TargetBundle] = {}
            # Prefer the comparison artifact's own targets (authoritative on runIds + browserContext).
            comparison_targets = (comparison or {}).get("targets") or {}
            if not comparison_targets:
                # Fall back to the SOT evidence target hints.
                ev_targets = ev.get("targets") or {}
                for side in ("old", "new"):
                    if ev_targets.get(side):
                        comparison_targets[side] = {
                            "targetId": side,
                            "side": side,
                            "runId": ev_targets[side],
                            "manifestPath": f".pi-api-audit-runs/{ev_targets[side]}/manifest.json",
                        }

            for target_key, target in comparison_targets.items():
                side = target.get("side", target_key)
                run_id = target.get("runId")
                if not run_id:
                    issues.append(f"target {target_key} missing runId")
                    continue
                referenced_run_ids.add(run_id)
                manifest, exchanges, manifest_path = load_raw_run(runs_dir, run_id)
                if manifest is None:
                    issues.append(f"raw run manifest not found for {run_id}")
                normalized = normalize_exchanges(
                    exchanges or [],
                    manifest=manifest,
                    layer_default=(manifest or {}).get("layer"),
                )
                target_bundle: TargetBundle = {
                    "side": side,
                    "runId": run_id,
                    "manifestPath": str(target.get("manifestPath") or manifest_path),
                    "manifest": manifest,
                    "exchanges": normalized if exchanges is not None else None,
                    "browserContext": target.get("browserContext"),
                }
                targets[side] = target_bundle

            comparison_bundle: ComparisonBundle = {
                "comparisonRunId": crid,
                "createdAt": (comparison or {}).get("createdAt"),
                "comparison": comparison,
                "analysis": analysis,
                "suggestion": None,
                "suggestionPath": None,
                "targets": targets,
                "issues": issues,
            }
            scenario_bundle["comparisons"].append(comparison_bundle)
        bundles.append(scenario_bundle)

    orphans = _collect_orphan_runs(runs_dir, referenced_run_ids)
    return bundles, orphans


def attach_suggestions(
    bundles: list[ScenarioBundle],
    suggestions: dict[str, tuple[dict[str, Any], Path]],
) -> None:
    for sb in bundles:
        scenario_id = sb["scenario"].get("id", "")
        for cb in sb["comparisons"]:
            key = _suggestion_key(scenario_id, cb["comparisonRunId"])
            hit = suggestions.get(key)
            if hit:
                suggestion, path = hit
                cb["suggestion"] = suggestion
                cb["suggestionPath"] = str(path)


def _collect_orphan_runs(runs_dir: Path, referenced: set[str]) -> list[OrphanRun]:
    if not runs_dir.exists():
        return []
    out: list[OrphanRun] = []
    archive_root = (runs_dir / "archive").resolve()
    for p in sorted(runs_dir.iterdir()):
        if not p.is_dir():
            continue
        if p.name in {"comparisons", "analysis", "candidates", "archive", "config", "config.local"}:
            continue
        if p.name in referenced:
            continue
        manifest_path = p / "manifest.json"
        if not manifest_path.exists():
            continue
        try:
            resolved = p.resolve()
            if archive_root.exists() and str(resolved).startswith(str(archive_root)):
                continue
        except Exception:
            pass
        m = _read_json(manifest_path) or {}
        rp = (m.get("recordingProxy") or {})
        out.append({
            "runId": p.name,
            "manifestPath": str(manifest_path),
            "layer": m.get("layer"),
            "scenarios": list(m.get("scenarios") or []),
            "side": rp.get("side"),
        })
    return out
