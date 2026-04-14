from __future__ import annotations

import re
from collections import Counter
from statistics import median
from typing import Any

from shelf_analyzer.gap_detector import assign_entries_to_row_bands, detect_shelf_rows


STOPWORDS = {"family", "size", "original"}
MERGED_BOX_WIDTH_MULTIPLIER = 2.5
MIN_BOX_WIDTH_RATIO = 0.35
TALL_BOX_RATIO = 1.4
TALL_SIZE_RATIO = 1.5
SMALL_SIZE_RATIO = 0.6
BOUNDARY_ZONE_RATIO = 0.15
BOUNDARY_MATCH_THRESHOLD = 0.5
MISPLACED_CONFIDENCE_THRESHOLD = 0.9
MISPLACED_MATCH_SCORE_THRESHOLD = 0.3
ROW_SKIP_PLANOGRAM_PENALTY = 6.0
ROW_SKIP_DETECTED_PENALTY = 18.0
SLOT_SKIP_PRODUCT_PENALTY = 0.55
SLOT_MISSING_NO_GAP_PENALTY = 1.8
SLOT_MISSING_PARTIAL_GAP_REWARD = 0.8
SLOT_MISSING_FULL_GAP_REWARD = 1.5
SLOT_POSITION_JUMP_PENALTY = 1.35
SLOT_DISTANCE_PENALTY = 0.9


def _normalize_words(*parts: str) -> set[str]:
    words: set[str] = set()
    for part in parts:
        if not part:
            continue
        words.update(re.findall(r"[a-z0-9]+", str(part).lower()))
    return words


def _normalize_phrase(value: str) -> str:
    words = sorted(_normalize_words(value))
    return " ".join(words).strip()


def _slot_to_sku(slot: dict[str, Any]) -> dict[str, Any]:
    return {
        "brand": slot.get("brand", "unknown"),
        "product_name": slot.get("product", "unknown"),
        "variant": slot.get("variant", "unknown"),
        "size": slot.get("size", "unknown"),
        "confidence": 1.0,
    }


def _best_matching_slot_in_row(
    actual_sku: dict[str, Any] | None,
    expected_slots: list[dict[str, Any]],
) -> tuple[int | None, float]:
    best_index = None
    best_score = 0.0

    for slot_index, expected_slot in enumerate(expected_slots):
        score = _sku_expected_match_score(actual_sku, expected_slot)
        if score > best_score:
            best_index = slot_index
            best_score = score

    return best_index, best_score


def _is_unknown_sku(sku: dict[str, Any] | None) -> bool:
    if not sku:
        return True

    product_name = str(sku.get("product_name", "")).strip().lower()
    brand = str(sku.get("brand", "")).strip().lower()
    return product_name in {"", "unknown"} or brand in {"", "unknown"}


def _sku_expected_match_score(actual_sku: dict[str, Any] | None, expected_slot: dict[str, Any]) -> float:
    if _is_unknown_sku(actual_sku):
        return 0.0

    actual_words = _normalize_words(
        actual_sku.get("brand", ""),
        actual_sku.get("product_name", ""),
        actual_sku.get("variant", ""),
        actual_sku.get("size", ""),
    )
    expected_words = _normalize_words(
        expected_slot.get("brand", ""),
        expected_slot.get("product", ""),
        expected_slot.get("variant", ""),
        expected_slot.get("size", ""),
    )

    brand_words = _normalize_words(expected_slot.get("brand", ""))
    product_words = _normalize_words(expected_slot.get("product", ""))
    variant_words = _normalize_words(expected_slot.get("variant", "")) - STOPWORDS
    size_words = _normalize_words(expected_slot.get("size", "")) - STOPWORDS

    weighted_score = 0.0
    total_weight = 0.0

    if brand_words:
        total_weight += 0.35
        weighted_score += 0.35 * (len(brand_words & actual_words) / len(brand_words))

    if product_words:
        total_weight += 0.4
        weighted_score += 0.4 * (len(product_words & actual_words) / len(product_words))

    if variant_words:
        total_weight += 0.2
        weighted_score += 0.2 * (len(variant_words & actual_words) / len(variant_words))

    if size_words:
        total_weight += 0.05
        weighted_score += 0.05 * (len(size_words & actual_words) / len(size_words))

    if total_weight == 0:
        meaningful_expected = expected_words - STOPWORDS
        if not meaningful_expected:
            return 0.0
        return len(meaningful_expected & actual_words) / len(meaningful_expected)

    return weighted_score / total_weight


def _sku_matches_expected(actual_sku: dict[str, Any] | None, expected_slot: dict[str, Any]) -> bool:
    return _sku_expected_match_score(actual_sku, expected_slot) >= BOUNDARY_MATCH_THRESHOLD


def _sku_confidence(actual_sku: dict[str, Any] | None) -> float:
    if not actual_sku:
        return 0.0

    try:
        return float(actual_sku.get("confidence", 0) or 0)
    except (TypeError, ValueError):
        return 0.0


def _sku_visibility(actual_sku: dict[str, Any] | None) -> str:
    if not actual_sku:
        return "partial"

    visibility = str(actual_sku.get("visibility", "partial")).strip().lower()
    return visibility if visibility in {"full", "partial", "side_only"} else "partial"


def _with_geometry(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for entry in entries:
        bbox = entry.get("bbox")
        if not bbox or len(bbox) != 4:
            continue

        x1, y1, x2, y2 = [int(round(value)) for value in bbox]
        if x2 <= x1 or y2 <= y1:
            continue

        normalized.append(
            {
                **entry,
                "bbox": [x1, y1, x2, y2],
                "centroid_x": (x1 + x2) / 2,
                "bottom_y": y2,
                "width": x2 - x1,
                "height": y2 - y1,
            }
        )

    return normalized


def _apply_box_height_normalization(entries: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], float]:
    if not entries:
        return [], 1.0

    median_box_height = float(median(entry["height"] for entry in entries))
    if median_box_height <= 0:
        median_box_height = 1.0

    normalized_entries: list[dict[str, Any]] = []
    for entry in entries:
        height = float(entry["height"])
        if height > median_box_height * TALL_SIZE_RATIO:
            size_class = "tall"
        elif height < median_box_height * SMALL_SIZE_RATIO:
            size_class = "small"
        else:
            size_class = "normal"

        normalized_entries.append(
            {
                **entry,
                "tall_box": height > median_box_height * TALL_BOX_RATIO,
                "size_class": size_class,
            }
        )

    return normalized_entries, median_box_height


def _build_slot_layout(
    expected_slots: list[dict[str, Any]],
    shelf_left: int,
    shelf_right: int,
    row_top: int,
    row_bottom: int,
) -> list[dict[str, Any]]:
    if not expected_slots or shelf_right <= shelf_left or row_bottom <= row_top:
        return []

    row_pixel_width = shelf_right - shelf_left
    total_weight = sum(max(1, int(slot.get("facing_count") or 1)) for slot in expected_slots)
    if total_weight <= 0:
        return []

    slot_layout: list[dict[str, Any]] = []
    cursor = float(shelf_left)

    for index, slot in enumerate(expected_slots):
        facing_count = max(1, int(slot.get("facing_count") or 1))
        slot_pixel_width = row_pixel_width * (facing_count / total_weight)
        next_cursor = float(shelf_right) if index == len(expected_slots) - 1 else cursor + slot_pixel_width

        x1 = int(round(cursor))
        x2 = int(round(next_cursor))
        slot_width = max(1, x2 - x1)
        expected_facing_width = max(1.0, slot_width / facing_count)

        slot_layout.append(
            {
                "slot_index": index,
                "slot": slot,
                "bbox": [x1, row_top, x2, row_bottom],
                "facing_count": facing_count,
                "slot_pixel_width": slot_width,
                "expected_facing_width": expected_facing_width,
                "min_box_width": max(1, int(round(expected_facing_width * MIN_BOX_WIDTH_RATIO))),
                "max_box_width": max(1, int(round(expected_facing_width * MERGED_BOX_WIDTH_MULTIPLIER))),
            }
        )
        cursor = next_cursor

    return slot_layout


def _slot_index_for_centroid(centroid_x: float, slot_layout: list[dict[str, Any]]) -> int | None:
    if not slot_layout:
        return None

    for slot_meta in slot_layout[:-1]:
        x1, _, x2, _ = slot_meta["bbox"]
        if x1 <= centroid_x < x2:
            return int(slot_meta["slot_index"])

    last_slot = slot_layout[-1]
    last_x1, _, last_x2, _ = last_slot["bbox"]
    if last_x1 <= centroid_x <= last_x2:
        return int(last_slot["slot_index"])

    return min(
        range(len(slot_layout)),
        key=lambda index: abs((((slot_layout[index]["bbox"][0] + slot_layout[index]["bbox"][2]) / 2)) - centroid_x),
    )


def _boundary_neighbor_slots(product: dict[str, Any], slot_layout: list[dict[str, Any]]) -> tuple[int, int] | None:
    if len(slot_layout) < 2:
        return None

    centroid_x = float(product["centroid_x"])
    closest_boundary: tuple[float, int, int] | None = None

    for left_slot, right_slot in zip(slot_layout, slot_layout[1:]):
        boundary_x = float(left_slot["bbox"][2])
        boundary_zone = min(
            float(left_slot["slot_pixel_width"]),
            float(right_slot["slot_pixel_width"]),
        ) * BOUNDARY_ZONE_RATIO

        distance = abs(centroid_x - boundary_x)
        if distance > boundary_zone:
            continue

        if closest_boundary is None or distance < closest_boundary[0]:
            closest_boundary = (
                distance,
                int(left_slot["slot_index"]),
                int(right_slot["slot_index"]),
            )

    if closest_boundary is None:
        return None

    return closest_boundary[1], closest_boundary[2]


def _resolve_slot_assignment(
    product: dict[str, Any],
    primary_slot_index: int,
    slot_layout: list[dict[str, Any]],
) -> tuple[int, str]:
    boundary_neighbor_indices = _boundary_neighbor_slots(product, slot_layout)
    if boundary_neighbor_indices is None:
        return primary_slot_index, "position"

    left_slot_index, right_slot_index = boundary_neighbor_indices
    left_score = _sku_expected_match_score(product.get("sku"), slot_layout[left_slot_index]["slot"])
    right_score = _sku_expected_match_score(product.get("sku"), slot_layout[right_slot_index]["slot"])

    if max(left_score, right_score) >= BOUNDARY_MATCH_THRESHOLD:
        resolved_slot_index = left_slot_index if left_score >= right_score else right_slot_index
        if resolved_slot_index == primary_slot_index:
            return resolved_slot_index, "boundary_resolved"
        return resolved_slot_index, "content"

    return primary_slot_index, "position"


def _slot_overlap_width(item_bbox: list[int], slot_bbox: list[int]) -> int:
    return max(0, min(item_bbox[2], slot_bbox[2]) - max(item_bbox[0], slot_bbox[0]))


def _position_alignment_score(product: dict[str, Any], slot_meta: dict[str, Any]) -> float:
    slot_x1, _, slot_x2, _ = slot_meta["bbox"]
    slot_center = (slot_x1 + slot_x2) / 2
    slot_width = max(1.0, float(slot_meta["slot_pixel_width"]))
    distance = abs(float(product["centroid_x"]) - slot_center)
    return max(0.0, 1.0 - (distance / (slot_width * 1.4)))


def _slot_missing_score(slot_gaps: list[dict[str, Any]]) -> float:
    if any(gap.get("gap_type") == "full" for gap in slot_gaps):
        return SLOT_MISSING_FULL_GAP_REWARD
    if any(gap.get("gap_type") == "partial" for gap in slot_gaps):
        return SLOT_MISSING_PARTIAL_GAP_REWARD
    return -SLOT_MISSING_NO_GAP_PENALTY


def _slot_alignment_score(
    product: dict[str, Any],
    slot_meta: dict[str, Any],
    slot_layout: list[dict[str, Any]],
) -> float:
    match_score = _sku_expected_match_score(product.get("sku"), slot_meta["slot"])
    position_score = _position_alignment_score(product, slot_meta)
    confidence = _sku_confidence(product.get("sku"))
    assigned_slot_index = int(slot_meta["slot_index"])
    primary_slot_index = _slot_index_for_centroid(product["centroid_x"], slot_layout)
    boundary_neighbors = _boundary_neighbor_slots(product, slot_layout)

    geometric_penalty = 0.0
    if primary_slot_index is not None and assigned_slot_index != primary_slot_index:
        distance = abs(assigned_slot_index - primary_slot_index)
        allowed_neighbors = set(boundary_neighbors or ())
        if assigned_slot_index not in allowed_neighbors:
            geometric_penalty += SLOT_POSITION_JUMP_PENALTY
        geometric_penalty += max(0, distance - 1) * SLOT_DISTANCE_PENALTY

    if _is_unknown_sku(product.get("sku")):
        return (position_score * 0.65) - geometric_penalty

    confidence_boost = min(0.25, confidence * 0.25)
    return (match_score * 1.65) + (position_score * 0.75) + confidence_boost - geometric_penalty


def _assignment_method_for_slot(
    product: dict[str, Any],
    assigned_slot_index: int,
    slot_layout: list[dict[str, Any]],
) -> str:
    primary_slot_index = _slot_index_for_centroid(product["centroid_x"], slot_layout)
    if primary_slot_index is None:
        return "position"

    slot_meta = slot_layout[assigned_slot_index]
    match_score = _sku_expected_match_score(product.get("sku"), slot_meta["slot"])
    if assigned_slot_index != primary_slot_index and match_score >= BOUNDARY_MATCH_THRESHOLD:
        return "boundary_resolved"
    if match_score >= BOUNDARY_MATCH_THRESHOLD:
        return "content"
    return "position"


def _covered_slot_indices(
    item: dict[str, Any],
    primary_slot_index: int,
    slot_layout: list[dict[str, Any]],
    detected_facings: int,
) -> list[int]:
    covered_indices = [primary_slot_index]
    if detected_facings <= 1 or len(slot_layout) <= 1:
        return covered_indices

    neighbor_indices = [
        index
        for index in (primary_slot_index - 1, primary_slot_index + 1)
        if 0 <= index < len(slot_layout)
    ]
    if not neighbor_indices:
        return covered_indices

    best_neighbor_index = max(
        neighbor_indices,
        key=lambda index: _slot_overlap_width(item["bbox"], slot_layout[index]["bbox"]),
    )
    if _slot_overlap_width(item["bbox"], slot_layout[best_neighbor_index]["bbox"]) > 0:
        covered_indices.append(best_neighbor_index)

    return sorted(set(covered_indices))


def _assign_products_to_slots(
    row_products: list[dict[str, Any]],
    slot_layout: list[dict[str, Any]],
    gaps_by_slot: dict[int, list[dict[str, Any]]] | None = None,
) -> dict[int, list[dict[str, Any]]]:
    assignments: dict[int, list[dict[str, Any]]] = {slot_meta["slot_index"]: [] for slot_meta in slot_layout}
    if not slot_layout:
        return assignments

    gaps_by_slot = gaps_by_slot or {}
    sorted_products = sorted(row_products, key=lambda item: item["bbox"][0])
    product_count = len(sorted_products)
    slot_count = len(slot_layout)

    negative_infinity = float("-inf")
    dp = [[negative_infinity for _ in range(slot_count + 1)] for _ in range(product_count + 1)]
    backtrack: dict[tuple[int, int], tuple[str, int, int]] = {}
    dp[0][0] = 0.0

    for slot_index in range(1, slot_count + 1):
        dp[0][slot_index] = dp[0][slot_index - 1] + _slot_missing_score(gaps_by_slot.get(slot_index - 1, []))
        backtrack[(0, slot_index)] = ("skip_slot", 0, slot_index - 1)

    for product_index in range(1, product_count + 1):
        dp[product_index][0] = dp[product_index - 1][0] - SLOT_SKIP_PRODUCT_PENALTY
        backtrack[(product_index, 0)] = ("skip_product", product_index - 1, 0)

    for product_index in range(1, product_count + 1):
        for slot_index in range(1, slot_count + 1):
            best_score = negative_infinity
            best_move: tuple[str, int, int] | None = None

            match_score = dp[product_index - 1][slot_index - 1] + _slot_alignment_score(
                sorted_products[product_index - 1],
                slot_layout[slot_index - 1],
                slot_layout,
            )
            if match_score > best_score:
                best_score = match_score
                best_move = ("match", product_index - 1, slot_index - 1)

            skip_slot_score = dp[product_index][slot_index - 1] + _slot_missing_score(gaps_by_slot.get(slot_index - 1, []))
            if skip_slot_score > best_score:
                best_score = skip_slot_score
                best_move = ("skip_slot", product_index, slot_index - 1)

            skip_product_score = dp[product_index - 1][slot_index] - SLOT_SKIP_PRODUCT_PENALTY
            if skip_product_score > best_score:
                best_score = skip_product_score
                best_move = ("skip_product", product_index - 1, slot_index)

            dp[product_index][slot_index] = best_score
            if best_move is not None:
                backtrack[(product_index, slot_index)] = best_move

    matched_product_to_slot: dict[int, int] = {}
    matched_product_indices: set[int] = set()
    product_index = product_count
    slot_index = slot_count
    while product_index > 0 or slot_index > 0:
        move = backtrack.get((product_index, slot_index))
        if move is None:
            break

        action, previous_product_index, previous_slot_index = move
        if action == "match":
            matched_product_to_slot[product_index - 1] = slot_index - 1
            matched_product_indices.add(product_index - 1)

        product_index, slot_index = previous_product_index, previous_slot_index

    def add_assignment(product: dict[str, Any], slot_index: int) -> None:
        slot_meta = slot_layout[slot_index]
        detection_quality = None
        detected_facings = 1
        if product["width"] > slot_meta["max_box_width"]:
            detection_quality = "merged_box"
            detected_facings = 2

        assignment_method = _assignment_method_for_slot(product, slot_index, slot_layout)
        annotated_product = {
            **product,
            "assigned_slot_index": slot_index,
            "expected_facing_width": slot_meta["expected_facing_width"],
            "detected_facings": detected_facings,
            "detection_quality": detection_quality,
            "assignment_method": assignment_method,
        }

        for covered_slot_index in _covered_slot_indices(
            annotated_product,
            slot_index,
            slot_layout,
            detected_facings,
        ):
            assignments.setdefault(covered_slot_index, []).append(annotated_product)

    for matched_product_index, matched_slot_index in sorted(matched_product_to_slot.items()):
        add_assignment(sorted_products[matched_product_index], matched_slot_index)

    for unmatched_product_index, product in enumerate(sorted_products):
        if unmatched_product_index in matched_product_indices:
            continue

        primary_slot_index = _slot_index_for_centroid(product["centroid_x"], slot_layout)
        if primary_slot_index is None:
            continue

        add_assignment(product, primary_slot_index)

    return assignments


def _assign_gaps_to_slots(
    row_gaps: list[dict[str, Any]],
    slot_layout: list[dict[str, Any]],
) -> dict[int, list[dict[str, Any]]]:
    assignments: dict[int, list[dict[str, Any]]] = {slot_meta["slot_index"]: [] for slot_meta in slot_layout}
    if not slot_layout:
        return assignments

    for gap in row_gaps:
        overlapping_slot_indices = [
            slot_meta["slot_index"]
            for slot_meta in slot_layout
            if _slot_overlap_width(gap["bbox"], slot_meta["bbox"]) > 0
        ]

        if overlapping_slot_indices:
            for slot_index in overlapping_slot_indices:
                assignments.setdefault(slot_index, []).append(gap)
            continue

        slot_index = _slot_index_for_centroid(gap["centroid_x"], slot_layout)
        if slot_index is not None:
            assignments.setdefault(slot_index, []).append(gap)

    return assignments


def _select_best_product_for_slot(
    expected_slot: dict[str, Any],
    slot_box: list[int],
    slot_products: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if not slot_products:
        return None

    slot_center = (slot_box[0] + slot_box[2]) / 2
    ranked_products = sorted(
        slot_products,
        key=lambda item: (
            0 if _sku_matches_expected(item.get("sku"), expected_slot) else 1,
            abs(item["centroid_x"] - slot_center),
            -float(item.get("detected_facings", 1)),
            item["bbox"][0],
        ),
    )
    return ranked_products[0]


def _best_gap_for_slot(slot_box: list[int], row_gaps: list[dict[str, Any]]) -> dict[str, Any] | None:
    best_gap: dict[str, Any] | None = None
    best_overlap = 0
    slot_x1, _, slot_x2, _ = slot_box

    for gap in row_gaps:
        gap_x1, gap_y1, gap_x2, gap_y2 = gap["bbox"]
        overlap = max(0, min(slot_x2, gap_x2) - max(slot_x1, gap_x1))
        if overlap > best_overlap:
            best_overlap = overlap
            best_gap = gap

    return best_gap if best_overlap > 0 else None


def _normalize_gap_entries(empty_gap_boxes) -> list[dict[str, Any]]:
    normalized_gap_entries: list[dict[str, Any]] = []

    for gap in empty_gap_boxes:
        if isinstance(gap, dict):
            bbox = gap.get("bbox")
            if bbox and len(bbox) == 4:
                normalized_gap_entries.append(
                    {
                        "bbox": bbox,
                        "gap_type": gap.get("gap_type", "full"),
                    }
                )
            continue

        if isinstance(gap, (list, tuple)) and len(gap) == 4:
            normalized_gap_entries.append({"bbox": list(gap), "gap_type": "full"})

    return _with_geometry(normalized_gap_entries)


def _estimate_global_shelf_span(
    products: list[dict[str, Any]],
    gaps: list[dict[str, Any]],
    image_width: int,
) -> tuple[int, int]:
    entries = [*products, *gaps]
    if not entries:
        return 0, image_width

    min_x = min(item["bbox"][0] for item in entries)
    max_x = max(item["bbox"][2] for item in entries)
    average_width = sum(item["width"] for item in entries) / len(entries)
    x_padding = max(10, int(round(average_width * 0.18)))
    return max(0, min_x - x_padding), min(image_width, max_x + x_padding)


def _estimate_row_shelf_span(
    row_products: list[dict[str, Any]],
    row_gaps: list[dict[str, Any]],
    image_width: int,
    default_left: int,
    default_right: int,
) -> tuple[int, int]:
    entries = [*row_products, *row_gaps]
    if not entries:
        return default_left, default_right

    min_x = min(item["bbox"][0] for item in entries)
    max_x = max(item["bbox"][2] for item in entries)
    typical_width = float(median(item["width"] for item in entries))
    padding = max(8, int(round(typical_width * 0.2)))

    row_left = max(0, min_x - padding)
    row_right = min(image_width, max_x + padding)

    if any(item["bbox"][0] <= padding * 2 for item in entries):
        row_left = 0
    if any((image_width - item["bbox"][2]) <= padding * 2 for item in entries):
        row_right = image_width

    if (row_right - row_left) >= image_width * 0.82:
        return 0, image_width

    return row_left, row_right


def _build_detected_row_profile(row_products: list[dict[str, Any]]) -> dict[str, Any]:
    brand_counts: Counter[str] = Counter()
    product_counts: Counter[str] = Counter()
    token_counts: Counter[str] = Counter()

    for product in row_products:
        sku = product.get("sku") or {}
        if _is_unknown_sku(sku):
            continue

        confidence = float(sku.get("confidence", 0) or 0)
        weight = max(0.2, confidence)

        normalized_brand = _normalize_phrase(str(sku.get("brand", "")))
        normalized_product = _normalize_phrase(str(sku.get("product_name", "")))

        if normalized_brand:
            brand_counts[normalized_brand] += weight
        if normalized_product:
            product_counts[normalized_product] += weight

        for token in _normalize_words(
            sku.get("brand", ""),
            sku.get("product_name", ""),
            sku.get("variant", ""),
        ) - STOPWORDS:
            token_counts[token] += weight

    dominant_brand = brand_counts.most_common(1)[0][0] if brand_counts else ""
    dominant_product = product_counts.most_common(1)[0][0] if product_counts else ""

    return {
        "brand_counts": brand_counts,
        "product_counts": product_counts,
        "token_counts": token_counts,
        "dominant_brand": dominant_brand,
        "dominant_product": dominant_product,
    }


def _build_planogram_row_profile(expected_row: dict[str, Any]) -> dict[str, Any]:
    brand_counts: Counter[str] = Counter()
    product_counts: Counter[str] = Counter()
    token_counts: Counter[str] = Counter()

    for slot in expected_row.get("slots", []):
        weight = max(1, int(slot.get("facing_count") or 1))
        normalized_brand = _normalize_phrase(str(slot.get("brand", "")))
        normalized_product = _normalize_phrase(str(slot.get("product", "")))

        if normalized_brand:
            brand_counts[normalized_brand] += weight
        if normalized_product:
            product_counts[normalized_product] += weight

        for token in _normalize_words(
            slot.get("brand", ""),
            slot.get("product", ""),
            slot.get("variant", ""),
        ) - STOPWORDS:
            token_counts[token] += weight

    dominant_brand = brand_counts.most_common(1)[0][0] if brand_counts else ""
    dominant_product = product_counts.most_common(1)[0][0] if product_counts else ""

    return {
        "brand_counts": brand_counts,
        "product_counts": product_counts,
        "token_counts": token_counts,
        "dominant_brand": dominant_brand,
        "dominant_product": dominant_product,
    }


def _row_match_score(
    detected_row_products: list[dict[str, Any]],
    expected_row: dict[str, Any],
) -> float:
    detected_profile = _build_detected_row_profile(detected_row_products)
    expected_profile = _build_planogram_row_profile(expected_row)

    brand_score = sum(
        min(weight, expected_profile["brand_counts"].get(brand, 0))
        for brand, weight in detected_profile["brand_counts"].items()
    )
    product_score = sum(
        min(weight, expected_profile["product_counts"].get(product, 0))
        for product, weight in detected_profile["product_counts"].items()
    )
    token_score = sum(
        min(weight, expected_profile["token_counts"].get(token, 0))
        for token, weight in detected_profile["token_counts"].items()
    )

    dominant_bonus = 0.0
    if detected_profile["dominant_brand"] and detected_profile["dominant_brand"] in expected_profile["brand_counts"]:
        dominant_bonus += 4.0
    if detected_profile["dominant_product"] and detected_profile["dominant_product"] in expected_profile["product_counts"]:
        dominant_bonus += 6.0

    return (brand_score * 3.0) + (product_score * 4.0) + token_score + dominant_bonus


def _row_order_bonus(
    detected_row_index: int,
    expected_row_index: int,
    detected_row_count: int,
    planogram_row_count: int,
) -> float:
    if detected_row_count <= 1 or planogram_row_count <= 1:
        return 8.0

    detected_norm = detected_row_index / max(1, detected_row_count - 1)
    expected_norm = expected_row_index / max(1, planogram_row_count - 1)
    distance = abs(detected_norm - expected_norm)
    return max(0.0, 8.0 * (1.0 - distance))


def _match_detected_rows_to_planogram_rows(
    product_rows_by_band: list[list[dict[str, Any]]],
    expected_rows: list[dict[str, Any]],
) -> tuple[dict[int, int], list[int]]:
    detected_row_count = len(product_rows_by_band)
    planogram_row_count = len(expected_rows)
    if detected_row_count == 0 or planogram_row_count == 0:
        return {}, list(range(planogram_row_count))

    if detected_row_count == planogram_row_count:
        direct_assignments = {index: index for index in range(detected_row_count)}
        return direct_assignments, []

    score_matrix: list[list[float]] = []
    for detected_row_index, detected_row_products in enumerate(product_rows_by_band):
        score_matrix.append(
            [
                _row_match_score(detected_row_products, expected_row)
                + _row_order_bonus(
                    detected_row_index,
                    expected_row_index,
                    detected_row_count,
                    planogram_row_count,
                )
                for expected_row_index, expected_row in enumerate(expected_rows)
            ]
        )

    negative_infinity = float("-inf")
    dp = [
        [negative_infinity for _ in range(planogram_row_count + 1)]
        for _ in range(detected_row_count + 1)
    ]
    backtrack: dict[tuple[int, int], tuple[str, int, int]] = {}
    dp[0][0] = 0.0

    for expected_count in range(1, planogram_row_count + 1):
        dp[0][expected_count] = dp[0][expected_count - 1] - ROW_SKIP_PLANOGRAM_PENALTY
        backtrack[(0, expected_count)] = ("skip_planogram", 0, expected_count - 1)

    for detected_count in range(1, detected_row_count + 1):
        dp[detected_count][0] = dp[detected_count - 1][0] - ROW_SKIP_DETECTED_PENALTY
        backtrack[(detected_count, 0)] = ("skip_detected", detected_count - 1, 0)

    for detected_count in range(1, detected_row_count + 1):
        for expected_count in range(1, planogram_row_count + 1):
            best_score = negative_infinity
            best_move: tuple[str, int, int] | None = None

            match_score = dp[detected_count - 1][expected_count - 1] + score_matrix[detected_count - 1][expected_count - 1]
            if match_score > best_score:
                best_score = match_score
                best_move = ("match", detected_count - 1, expected_count - 1)

            skip_planogram_score = dp[detected_count][expected_count - 1] - ROW_SKIP_PLANOGRAM_PENALTY
            if skip_planogram_score > best_score:
                best_score = skip_planogram_score
                best_move = ("skip_planogram", detected_count, expected_count - 1)

            skip_detected_score = dp[detected_count - 1][expected_count] - ROW_SKIP_DETECTED_PENALTY
            if skip_detected_score > best_score:
                best_score = skip_detected_score
                best_move = ("skip_detected", detected_count - 1, expected_count)

            dp[detected_count][expected_count] = best_score
            if best_move is not None:
                backtrack[(detected_count, expected_count)] = best_move

    assignments: dict[int, int] = {}
    detected_count = detected_row_count
    expected_count = planogram_row_count
    while detected_count > 0 or expected_count > 0:
        move = backtrack.get((detected_count, expected_count))
        if move is None:
            break

        action, previous_detected_count, previous_expected_count = move
        if action == "match":
            assignments[detected_count - 1] = expected_count - 1

        detected_count, expected_count = previous_detected_count, previous_expected_count

    visible_planogram_rows = set(assignments.values())
    invisible_planogram_rows = [
        index for index in range(planogram_row_count) if index not in visible_planogram_rows
    ]
    return dict(sorted(assignments.items())), invisible_planogram_rows


def audit_planogram(
    image_path: str,
    image_size: tuple[int, int],
    planogram: dict[str, Any],
    product_detections: list[dict[str, Any]],
    empty_gap_boxes: list[list[int]],
) -> list[dict[str, Any]]:
    image_width, _ = image_size
    normalized_products, median_box_height = _apply_box_height_normalization(_with_geometry(product_detections))
    normalized_gaps = _normalize_gap_entries(empty_gap_boxes)
    expected_rows = sorted(planogram.get("rows", []), key=lambda row: row.get("row", 0))
    n_rows_hint = int(planogram.get("total_rows") or len(expected_rows) or 1)
    row_bands = detect_shelf_rows(
        image_path=image_path,
        n_rows_hint=n_rows_hint,
        boxes=[item["bbox"] for item in normalized_products],
    )
    product_rows_by_band = assign_entries_to_row_bands(normalized_products, row_bands)
    gap_rows_by_band = assign_entries_to_row_bands(normalized_gaps, row_bands)
    row_assignments, invisible_planogram_row_indices = _match_detected_rows_to_planogram_rows(
        product_rows_by_band,
        expected_rows,
    )

    shelf_left, shelf_right = _estimate_global_shelf_span(normalized_products, normalized_gaps, image_width)
    audit_results: list[dict[str, Any]] = []
    if invisible_planogram_row_indices:
        invisible_row_numbers = [
            str(expected_rows[row_index].get("row", row_index + 1))
            for row_index in invisible_planogram_row_indices
        ]
        audit_results.append(
            {
                "type": "compliance_note",
                "audit_status": "row_not_visible",
                "note": f"Rows {', '.join(invisible_row_numbers)} not visible in this image",
                "row_not_visible": [
                    expected_rows[row_index].get("row", row_index + 1)
                    for row_index in invisible_planogram_row_indices
                ],
            }
        )

    for detected_row_index, expected_row_index in sorted(row_assignments.items()):
        expected_row = expected_rows[expected_row_index]
        expected_slots = sorted(expected_row.get("slots", []), key=lambda slot: slot.get("position", 0))
        if not expected_slots:
            continue

        if detected_row_index < len(row_bands):
            row_top, row_bottom = row_bands[detected_row_index]
        else:
            fallback_step = max(1, int(round(image_size[1] / max(n_rows_hint, 1))))
            row_top = detected_row_index * fallback_step
            row_bottom = row_top + fallback_step

        row_products = product_rows_by_band[detected_row_index] if detected_row_index < len(product_rows_by_band) else []
        row_gaps = gap_rows_by_band[detected_row_index] if detected_row_index < len(gap_rows_by_band) else []
        row_left, row_right = _estimate_row_shelf_span(
            row_products=row_products,
            row_gaps=row_gaps,
            image_width=image_width,
            default_left=shelf_left,
            default_right=shelf_right,
        )
        slot_layout = _build_slot_layout(
            expected_slots=expected_slots,
            shelf_left=row_left,
            shelf_right=row_right,
            row_top=row_top,
            row_bottom=row_bottom,
        )
        gaps_by_slot = _assign_gaps_to_slots(row_gaps, slot_layout)
        products_by_slot = _assign_products_to_slots(row_products, slot_layout, gaps_by_slot=gaps_by_slot)

        for slot_index, expected_slot in enumerate(expected_slots):
            expected_sku = _slot_to_sku(expected_slot)
            slot_meta = slot_layout[slot_index] if slot_index < len(slot_layout) else None
            slot_box = slot_meta["bbox"] if slot_meta else None
            slot_products = products_by_slot.get(slot_index, [])
            slot_gaps = gaps_by_slot.get(slot_index, [])
            assigned_product = _select_best_product_for_slot(
                expected_slot,
                slot_box or [0, 0, 0, 0],
                slot_products,
            )

            if assigned_product is None:
                fallback_box = slot_box or [0, 0, 0, 0]
                best_gap = slot_gaps[0] if slot_gaps else _best_gap_for_slot(fallback_box, row_gaps)
                if best_gap is None:
                    continue

                has_slot_box = bool(
                    fallback_box
                    and len(fallback_box) == 4
                    and fallback_box[2] > fallback_box[0]
                    and fallback_box[3] > fallback_box[1]
                )
                if has_slot_box and best_gap is not None:
                    gap_x1, gap_y1, gap_x2, gap_y2 = [int(value) for value in best_gap["bbox"]]
                    slot_x1, slot_y1, slot_x2, slot_y2 = [int(value) for value in fallback_box]
                    bbox = [
                        slot_x1,
                        max(slot_y1, gap_y1),
                        slot_x2,
                        min(slot_y2, gap_y2),
                    ]
                    if bbox[3] <= bbox[1]:
                        bbox = [
                            slot_x1,
                            gap_y1,
                            slot_x2,
                            gap_y2,
                        ]
                else:
                    bbox = fallback_box if has_slot_box else (best_gap["bbox"] if best_gap is not None else fallback_box)
                audit_results.append(
                    {
                        "bbox": bbox,
                        "gap_bbox": best_gap["bbox"] if best_gap is not None else None,
                        "type": "empty_space",
                        "sku": None,
                        "expected_sku": expected_sku,
                        "audit_status": "missing",
                        "gap_type": best_gap.get("gap_type") if best_gap else "inferred_slot",
                        "slot_id": expected_slot.get("slot_id"),
                        "row": expected_slot.get("row"),
                        "position": expected_slot.get("position"),
                    }
                )
                continue

            actual_sku = assigned_product.get("sku")
            match_score = _sku_expected_match_score(actual_sku, expected_slot)
            sku_confidence = _sku_confidence(actual_sku)
            sku_visibility = _sku_visibility(actual_sku)
            best_slot_index, best_slot_score = _best_matching_slot_in_row(actual_sku, expected_slots)

            if _is_unknown_sku(actual_sku):
                audit_status = "unverified"
            elif match_score >= BOUNDARY_MATCH_THRESHOLD:
                audit_status = "correct"
            elif (
                best_slot_index is not None
                and best_slot_index != slot_index
                and best_slot_score >= BOUNDARY_MATCH_THRESHOLD
                and sku_confidence >= 0.45
            ):
                audit_status = "misplaced"
            elif sku_confidence < MISPLACED_CONFIDENCE_THRESHOLD or sku_visibility != "full" or match_score > MISPLACED_MATCH_SCORE_THRESHOLD:
                audit_status = "unverified"
            else:
                audit_status = "misplaced"

            audit_results.append(
                {
                    "bbox": assigned_product["bbox"],
                    "type": "product",
                    "sku": actual_sku,
                    "expected_sku": expected_sku,
                    "audit_status": audit_status,
                    "match_score": round(match_score, 3),
                    "best_row_slot_index": best_slot_index + 1 if best_slot_index is not None else None,
                    "best_row_slot_score": round(best_slot_score, 3),
                    "detection_quality": assigned_product.get("detection_quality"),
                    "assignment_method": assigned_product.get("assignment_method", "position"),
                    "detected_facings": assigned_product.get("detected_facings", 1),
                    "expected_facings": expected_slot.get("facing_count", 1),
                    "tall_box": assigned_product.get("tall_box", False),
                    "size_class": assigned_product.get("size_class", "normal"),
                    "median_box_height": median_box_height,
                    "slot_id": expected_slot.get("slot_id"),
                    "row": expected_slot.get("row"),
                    "position": expected_slot.get("position"),
                }
            )

    return audit_results
