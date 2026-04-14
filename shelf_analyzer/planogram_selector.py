from __future__ import annotations

from typing import Any

from shelf_analyzer.planogram_store import get_planogram_by_id


PLANOGRAM_ID = "cereal_aisle_main"
CEREAL_HINTS = {
    "cereal",
    "family size",
    "chex",
    "rice chex",
    "corn chex",
    "wheat chex",
    "cheerios",
    "oat crunch",
    "maple cheerios",
    "multi grain cheerios",
    "wheaties",
    "crispix",
    "rice krispies",
    "cap'n crunch",
    "capn crunch",
    "life cereal",
    "life",
    "rice squares",
    "toasted o's",
    "general mills",
    "kellogg",
    "kellogg's",
    "quaker",
    "great value",
}


def _normalize(value: Any) -> set[str]:
    if value is None:
        return set()

    if isinstance(value, str):
        lowered = value.lower().strip()
        return {lowered} if lowered else set()

    if isinstance(value, dict):
        tokens: set[str] = set()
        for item in value.values():
            tokens.update(_normalize(item))
        return tokens

    if isinstance(value, (list, tuple, set)):
        tokens: set[str] = set()
        for item in value:
            tokens.update(_normalize(item))
        return tokens

    lowered = str(value).lower().strip()
    return {lowered} if lowered else set()


def _collect_detected_terms(
    scene_classification: Any = None,
    detected_keywords: Any = None,
    detected_brands: Any = None,
    **kwargs: Any,
) -> set[str]:
    terms = set()
    terms.update(_normalize(scene_classification))
    terms.update(_normalize(detected_keywords))
    terms.update(_normalize(detected_brands))

    for key in ("scene_labels", "keywords", "brands", "detections", "classification"):
        if key in kwargs:
            terms.update(_normalize(kwargs[key]))

    expanded_terms = set(terms)
    for term in terms:
        expanded_terms.update(piece for piece in term.replace("/", " ").replace(",", " ").split() if piece)

    return expanded_terms


def auto_select_planogram(
    scene_classification: Any = None,
    detected_keywords: Any = None,
    detected_brands: Any = None,
    **kwargs: Any,
) -> dict:
    planogram = get_planogram_by_id(PLANOGRAM_ID)
    if planogram is None:
        raise LookupError(f"Planogram `{PLANOGRAM_ID}` was not found in PLANOGRAM_DB.")

    detected_terms = _collect_detected_terms(
        scene_classification=scene_classification,
        detected_keywords=detected_keywords,
        detected_brands=detected_brands,
        **kwargs,
    )
    matched_terms = sorted(term for term in detected_terms if term in CEREAL_HINTS)

    confidence = 0.97 if matched_terms else 0.3
    if not matched_terms:
        print("Only one planogram available — defaulting to cereal_aisle_main.")

    return {
        "planogram_id": PLANOGRAM_ID,
        "planogram": planogram,
        "confidence": confidence,
        "matched_terms": matched_terms,
    }
