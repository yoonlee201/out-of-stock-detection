from __future__ import annotations

from typing import Any


def _safe_int(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None

    return parsed if parsed > 0 else None


def _slot_key(detection: dict[str, Any]) -> tuple[Any, Any, Any]:
    return (
        detection.get("row"),
        detection.get("position"),
        detection.get("slot_id"),
    )


def build_compliance_report(
    detections: list[dict[str, Any]],
    total_planogram_rows: int | None = None,
) -> dict[str, Any]:
    slot_detections = [
        detection
        for detection in detections
        if detection.get("type") in {"product", "empty_space"}
    ]
    visible_rows = sorted(
        {
            row_number
            for row_number in (_safe_int(detection.get("row")) for detection in slot_detections)
            if row_number is not None
        }
    )

    not_visible_rows_from_notes = sorted(
        {
            row_number
            for detection in detections
            if detection.get("type") == "compliance_note"
            for row_number in (
                _safe_int(value)
                for value in (detection.get("row_not_visible") or [])
            )
            if row_number is not None
        }
    )

    all_known_rows = set(visible_rows) | set(not_visible_rows_from_notes)
    if total_planogram_rows is None:
        total_row_count = max(all_known_rows, default=0)
    else:
        total_row_count = max(int(total_planogram_rows), max(all_known_rows, default=0))

    inferred_not_visible_rows = {
        row_number
        for row_number in range(1, total_row_count + 1)
        if row_number not in visible_rows
    }
    not_visible_rows = sorted(set(not_visible_rows_from_notes) | inferred_not_visible_rows)

    visible_row_set = set(visible_rows)
    visible_slot_detections = [
        detection
        for detection in slot_detections
        if _safe_int(detection.get("row")) in visible_row_set
    ]

    unique_visible_slots: dict[tuple[Any, Any, Any], dict[str, Any]] = {}
    for detection in visible_slot_detections:
        unique_visible_slots[_slot_key(detection)] = detection

    visible_slot_count = len(unique_visible_slots)
    correct_slot_count = sum(
        1
        for detection in unique_visible_slots.values()
        if detection.get("audit_status") == "correct"
    )
    compliance_score = (
        round((correct_slot_count / visible_slot_count) * 100)
        if visible_slot_count > 0
        else 0
    )

    visibility_note = (
        f"{len(visible_rows)} of {total_row_count} planogram rows visible in this image. "
        "Compliance score calculated on visible rows only."
    )

    return {
        "visible_rows": visible_rows,
        "not_visible_rows": not_visible_rows,
        "visibility_note": visibility_note,
        "visible_slot_count": visible_slot_count,
        "correct_slot_count": correct_slot_count,
        "compliance_score": compliance_score,
        "total_planogram_rows": total_row_count,
    }
