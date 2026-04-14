from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path


PLANOGRAMS_DIR = Path(__file__).resolve().parent / "data" / "planograms"


def _load_planogram(planogram_path: Path) -> dict:
    with planogram_path.open("r", encoding="utf-8") as handle:
        planogram = json.load(handle)

    rows = planogram.get("rows", [])
    flattened_slots = [slot for row in rows for slot in row.get("slots", [])]
    planogram["id"] = str(planogram.get("id") or planogram_path.stem)
    planogram["slots"] = flattened_slots
    return planogram


PLANOGRAM_DB = {
    planogram["id"]: planogram
    for planogram in (
        _load_planogram(planogram_path)
        for planogram_path in sorted(PLANOGRAMS_DIR.glob("*.json"))
    )
}


def get_all_planograms() -> list[dict]:
    return [deepcopy(planogram) for planogram in PLANOGRAM_DB.values()]


def get_planogram_by_id(planogram_id: str) -> dict | None:
    planogram = PLANOGRAM_DB.get(planogram_id)
    return deepcopy(planogram) if planogram is not None else None
