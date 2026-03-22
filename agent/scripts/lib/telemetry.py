#!/usr/bin/env python3
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import yaml

MEASURED_TASKS = {
    "refine-plan",
    "plan-item",
    "implement-item",
    "review-item",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_ts(value: str) -> Optional[datetime]:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def read_plan_id(plan_file: Path) -> str:
    data = load_yaml(plan_file)
    plan_id = data.get("id")
    if isinstance(plan_id, str) and plan_id:
        return plan_id
    return "pb-unknown"


def default_doc(plan_id: str) -> dict[str, Any]:
    return {
        "version": 1,
        "source_of_truth": "execution_telemetry",
        "plan_id": plan_id,
        "summary": {
            "started_at": None,
            "last_updated_at": None,
            "duration_seconds": 0,
            "task_runs_total": 0,
            "items_total": 0,
            "items_done": 0,
            "items_returned_at_least_once": 0,
            "rework_cycles_total": 0,
            "rework_cycles_avg_per_item": 0.0,
            "findings_total_item_review": 0,
            "findings_total_finalize": 0,
            "findings_total_extended_review": 0,
            "first_pass_accept_rate": 0.0,
            "context_files_loaded_total": 0,
            "context_bytes_loaded_total": 0,
            "outlier_item_by_duration": None,
            "outlier_item_by_rework": None,
            "outlier_item_by_findings": None,
            "item_quality_distribution": {
                "good": 0,
                "ok": 0,
                "poor": 0,
            },
        },
        "details": {
            "events": [],
        },
    }


def ensure_doc(path: Path, plan_id: str) -> dict[str, Any]:
    data = load_yaml(path)
    if data.get("source_of_truth") != "execution_telemetry":
        return default_doc(plan_id)
    if data.get("version") != 1:
        return default_doc(plan_id)
    if data.get("plan_id") != plan_id:
        return default_doc(plan_id)
    details = data.get("details")
    if not isinstance(details, dict) or not isinstance(details.get("events"), list):
        return default_doc(plan_id)
    return data


def to_item_id(value: Any) -> Optional[str]:
    if not isinstance(value, str) or not value:
        return None
    return value


def recompute_summary(doc: dict[str, Any]) -> None:
    events = (doc.get("details") or {}).get("events") or []
    parsed_events: list[tuple[dict[str, Any], datetime]] = []
    for event in events:
        if not isinstance(event, dict):
            continue
        ts = parse_ts(event.get("at", ""))
        if ts is None:
            continue
        parsed_events.append((event, ts))

    parsed_events.sort(key=lambda item: item[1])

    summary = doc.setdefault("summary", {})
    if not parsed_events:
        summary.update(default_doc(doc.get("plan_id", "pb-unknown"))["summary"])
        return

    first_ts = parsed_events[0][1]
    last_ts = parsed_events[-1][1]
    task_run_starts = [
        (e, ts)
        for e, ts in parsed_events
        if e.get("event_type") in {"task_run", "task_run_started"}
        and str(e.get("task") or "") in MEASURED_TASKS
    ]
    # Compute active execution duration using only the latest completed window for each
    # (task, item_id). This keeps retry attempts from inflating duration after failures.
    open_starts: dict[tuple[str, str], list[datetime]] = defaultdict(list)
    open_starts_by_task_without_item: dict[str, list[datetime]] = defaultdict(list)
    latest_completed_by_key: dict[tuple[str, str], tuple[datetime, datetime, str]] = {}

    for event, ts in parsed_events:
        task = str(event.get("task") or "")
        if task not in MEASURED_TASKS:
            continue
        event_type = event.get("event_type")
        item_id = str(event.get("item_id") or "")
        key = (task, item_id)

        if event_type in {"task_run", "task_run_started"}:
            open_starts[key].append(ts)
            if not item_id:
                open_starts_by_task_without_item[task].append(ts)
            continue

        if event_type != "task_run_finished":
            continue

        starts = open_starts.get(key) or []
        if starts:
            start_ts = starts.pop()
        else:
            # Backward-compatible fallback: older task bootstrap events may have
            # missing item_id for started events while finish events include it.
            task_starts = open_starts_by_task_without_item.get(task) or []
            if not task_starts:
                continue
            start_ts = task_starts.pop()
        if ts < start_ts:
            continue
        latest_completed_by_key[key] = (start_ts, ts, item_id)

    active_duration_total = 0
    active_duration_by_item: dict[str, int] = defaultdict(int)
    for _, (start_ts, finish_ts, item_id) in latest_completed_by_key.items():
        delta = int((finish_ts - start_ts).total_seconds())
        if delta < 0:
            continue
        active_duration_total += delta
        if item_id:
            active_duration_by_item[item_id] += delta

    context_files_total = 0
    context_bytes_total = 0
    for event, _ in task_run_starts:
        context_files_total += int(event.get("context_files") or 0)
        context_bytes_total += int(event.get("context_bytes") or 0)

    item_ids: set[str] = set()
    for event, _ in parsed_events:
        item_id = to_item_id(event.get("item_id"))
        if item_id:
            item_ids.add(item_id)

    review_events = [e for e, _ in parsed_events if e.get("event_type") == "review_outcome"]

    returns_by_item: dict[str, int] = defaultdict(int)
    accepts_by_item: dict[str, int] = defaultdict(int)
    findings_by_item: dict[str, int] = defaultdict(int)

    findings_total_item_review = 0
    for event in review_events:
        item_id = to_item_id(event.get("item_id"))
        if not item_id:
            continue
        outcome = event.get("outcome")
        findings = int(event.get("findings_count") or 0)
        findings_total_item_review += findings
        findings_by_item[item_id] += findings
        if outcome == "return":
            returns_by_item[item_id] += 1
        elif outcome == "accept":
            accepts_by_item[item_id] += 1

    finalize_events = [e for e, _ in parsed_events if e.get("event_type") == "finalize_outcome"]
    findings_total_finalize = sum(int(e.get("findings_count") or 0) for e in finalize_events)

    extended_events = [e for e, _ in parsed_events if e.get("event_type") == "extended_review_outcome"]
    findings_total_extended = sum(int(e.get("findings_count") or 0) for e in extended_events)

    items_done = len([item_id for item_id, cnt in accepts_by_item.items() if cnt > 0])
    items_returned = len([item_id for item_id, cnt in returns_by_item.items() if cnt > 0])
    rework_total = sum(returns_by_item.values())
    items_total = len(item_ids)

    rework_avg = round((rework_total / items_total), 4) if items_total > 0 else 0.0

    first_pass_accept_count = len(
        [item_id for item_id, cnt in accepts_by_item.items() if cnt > 0 and returns_by_item.get(item_id, 0) == 0]
    )
    first_pass_rate = round((first_pass_accept_count / items_done), 4) if items_done > 0 else 0.0

    item_first_last: dict[str, tuple[datetime, datetime]] = {}
    for event, ts in parsed_events:
        item_id = to_item_id(event.get("item_id"))
        if not item_id:
            continue
        if item_id not in item_first_last:
            item_first_last[item_id] = (ts, ts)
        else:
            first, _ = item_first_last[item_id]
            item_first_last[item_id] = (first, ts)

    outlier_duration = None
    if active_duration_by_item:
        winner = max(active_duration_by_item.items(), key=lambda row: row[1])
        outlier_duration = {"item_id": winner[0], "duration_seconds": winner[1]}
    elif item_first_last:
        # Backward-compatible fallback for older telemetry without finish events.
        winner = max(
            (
                (item_id, int((last - first).total_seconds()))
                for item_id, (first, last) in item_first_last.items()
            ),
            key=lambda row: row[1],
        )
        outlier_duration = {"item_id": winner[0], "duration_seconds": winner[1]}

    outlier_rework = None
    if returns_by_item:
        winner = max(returns_by_item.items(), key=lambda row: row[1])
        outlier_rework = {"item_id": winner[0], "return_count": winner[1]}

    outlier_findings = None
    if findings_by_item:
        winner = max(findings_by_item.items(), key=lambda row: row[1])
        outlier_findings = {"item_id": winner[0], "findings_count": winner[1]}

    quality = {"good": 0, "ok": 0, "poor": 0}
    for item_id in sorted(item_ids):
        return_count = returns_by_item.get(item_id, 0)
        findings_count = findings_by_item.get(item_id, 0)
        if return_count == 0 and findings_count <= 1:
            quality["good"] += 1
        elif return_count <= 1 and findings_count <= 3:
            quality["ok"] += 1
        else:
            quality["poor"] += 1

    summary.update(
        {
            "started_at": first_ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "last_updated_at": last_ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "duration_seconds": max(active_duration_total, 0),
            "task_runs_total": len(task_run_starts),
            "items_total": items_total,
            "items_done": items_done,
            "items_returned_at_least_once": items_returned,
            "rework_cycles_total": rework_total,
            "rework_cycles_avg_per_item": rework_avg,
            "findings_total_item_review": findings_total_item_review,
            "findings_total_finalize": findings_total_finalize,
            "findings_total_extended_review": findings_total_extended,
            "first_pass_accept_rate": first_pass_rate,
            "context_files_loaded_total": context_files_total,
            "context_bytes_loaded_total": context_bytes_total,
            "outlier_item_by_duration": outlier_duration,
            "outlier_item_by_rework": outlier_rework,
            "outlier_item_by_findings": outlier_findings,
            "item_quality_distribution": quality,
        }
    )


def write_doc(path: Path, doc: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(doc, sort_keys=False), encoding="utf-8")


def append_event(doc: dict[str, Any], event: dict[str, Any]) -> None:
    details = doc.setdefault("details", {})
    events = details.setdefault("events", [])
    events.append(event)


def cmd_reset(args: argparse.Namespace) -> int:
    doc = default_doc(args.plan_id)
    write_doc(args.telemetry_file, doc)
    return 0


def cmd_record_task_run(args: argparse.Namespace) -> int:
    plan_id = read_plan_id(args.plan_file)
    doc = ensure_doc(args.telemetry_file, plan_id)
    event = {
        "at": utc_now(),
        "task": args.task,
        "event_type": "task_run_started",
        "item_id": args.item_id,
        "context_files": max(args.context_files, 0),
        "context_bytes": max(args.context_bytes, 0),
    }
    append_event(doc, event)
    recompute_summary(doc)
    write_doc(args.telemetry_file, doc)
    return 0


def cmd_record_event(args: argparse.Namespace) -> int:
    plan_id = read_plan_id(args.plan_file)
    doc = ensure_doc(args.telemetry_file, plan_id)
    event = {
        "at": utc_now(),
        "task": args.task,
        "event_type": args.event_type,
        "item_id": args.item_id,
        "outcome": args.outcome,
        "findings_count": args.findings_count,
        "created_open_items": args.created_open_items,
        "selected_mode": args.selected_mode,
        "from_status": args.from_status,
        "to_status": args.to_status,
    }
    clean_event = {k: v for k, v in event.items() if v is not None}
    append_event(doc, clean_event)
    recompute_summary(doc)
    write_doc(args.telemetry_file, doc)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Telemetry helper for agent execution tasks")
    parser.add_argument("--telemetry-file", type=Path, required=True)
    parser.add_argument("--plan-file", type=Path, required=False)

    sub = parser.add_subparsers(dest="command", required=True)

    reset_cmd = sub.add_parser("reset")
    reset_cmd.add_argument("--plan-id", required=True)
    reset_cmd.set_defaults(func=cmd_reset)

    task_cmd = sub.add_parser("record-task-run")
    task_cmd.add_argument("--task", required=True)
    task_cmd.add_argument("--item-id")
    task_cmd.add_argument("--context-files", type=int, default=0)
    task_cmd.add_argument("--context-bytes", type=int, default=0)
    task_cmd.set_defaults(func=cmd_record_task_run)

    event_cmd = sub.add_parser("record-event")
    event_cmd.add_argument("--task", required=True)
    event_cmd.add_argument("--event-type", required=True)
    event_cmd.add_argument("--item-id")
    event_cmd.add_argument("--outcome")
    event_cmd.add_argument("--findings-count", type=int)
    event_cmd.add_argument("--created-open-items", type=int)
    event_cmd.add_argument("--selected-mode")
    event_cmd.add_argument("--from-status")
    event_cmd.add_argument("--to-status")
    event_cmd.set_defaults(func=cmd_record_event)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.command != "reset" and args.plan_file is None:
        parser.error("--plan-file is required for this command")

    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
