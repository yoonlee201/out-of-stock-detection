from __future__ import annotations

from itertools import combinations
import math
from statistics import median

import cv2
import numpy as np
from sklearn.cluster import KMeans


HORIZONTAL_ANGLE_LIMIT_DEGREES = 5.0
MIN_LINE_WIDTH_FRACTION = 0.4
MIN_VERTICAL_LINE_SPACING = 80
BOX_BOTTOM_GROUP_TOLERANCE_RATIO = 0.4
BOX_ANCHOR_ALIGNMENT_TOLERANCE = 36


def _normalize_boxes(boxes) -> list[dict]:
    normalized_boxes: list[dict] = []

    for box in boxes:
        if len(box) != 4:
            continue

        x1, y1, x2, y2 = [int(round(value)) for value in box]
        if x2 <= x1 or y2 <= y1:
            continue

        normalized_boxes.append(
            {
                "bbox": [x1, y1, x2, y2],
                "bottom_y": y2,
                "centroid_x": (x1 + x2) / 2,
                "width": x2 - x1,
                "height": y2 - y1,
            }
        )

    return normalized_boxes


def _load_grayscale_image(image_path: str) -> tuple[np.ndarray, int, int]:
    grayscale = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if grayscale is None:
        raise FileNotFoundError(f"Could not read image from `{image_path}`.")

    image_height, image_width = grayscale.shape[:2]
    return grayscale, image_height, image_width


def _detect_horizontal_shelf_lines(image_path: str) -> tuple[list[dict], int]:
    grayscale, image_height, image_width = _load_grayscale_image(image_path)
    blurred = cv2.GaussianBlur(grayscale, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    minimum_line_length = int(round(image_width * MIN_LINE_WIDTH_FRACTION))

    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=100,
        minLineLength=minimum_line_length,
        maxLineGap=20,
    )

    if lines is None:
        return [], image_height

    candidates: list[dict] = []
    for raw_line in lines[:, 0, :]:
        x1, y1, x2, y2 = [int(value) for value in raw_line]
        dx = x2 - x1
        dy = y2 - y1
        angle = abs(math.degrees(math.atan2(dy, dx)))
        angle = min(angle, abs(180 - angle))
        span_width = abs(dx)
        line_length = math.hypot(dx, dy)

        if angle >= HORIZONTAL_ANGLE_LIMIT_DEGREES:
            continue
        if span_width < minimum_line_length:
            continue

        candidates.append(
            {
                "y": int(round((y1 + y2) / 2)),
                "length": float(line_length),
            }
        )

    selected: list[dict] = []
    for candidate in sorted(candidates, key=lambda item: item["length"], reverse=True):
        nearest_index = next(
            (index for index, existing in enumerate(selected) if abs(candidate["y"] - existing["y"]) < MIN_VERTICAL_LINE_SPACING),
            None,
        )

        if nearest_index is None:
            selected.append(candidate)
        elif candidate["length"] > selected[nearest_index]["length"]:
            selected[nearest_index] = candidate

    selected.sort(key=lambda item: item["y"])
    return selected, image_height


def _detect_box_bottom_anchors(boxes) -> tuple[list[int], float]:
    normalized_boxes = _normalize_boxes(boxes)
    if not normalized_boxes:
        return [], 0.0

    median_box_height = float(median(box["height"] for box in normalized_boxes))
    grouping_tolerance = max(24, int(round(median_box_height * BOX_BOTTOM_GROUP_TOLERANCE_RATIO)))
    sorted_bottoms = sorted(box["bottom_y"] for box in normalized_boxes)

    groups: list[list[int]] = []
    for bottom_y in sorted_bottoms:
        if not groups or abs(bottom_y - groups[-1][-1]) > grouping_tolerance:
            groups.append([bottom_y])
        else:
            groups[-1].append(bottom_y)

    anchors = [int(round(sum(group) / len(group))) for group in groups]
    return anchors, median_box_height


def _augment_lines_with_box_anchors(lines: list[dict], bottom_anchors: list[int]) -> list[dict]:
    if not lines:
        return [{"y": anchor, "length": 0.0, "synthetic": True} for anchor in bottom_anchors]

    mean_line_length = sum(line["length"] for line in lines) / len(lines)
    augmented_lines = list(lines)

    for anchor in bottom_anchors:
        if any(abs(anchor - line["y"]) <= BOX_ANCHOR_ALIGNMENT_TOLERANCE for line in augmented_lines):
            continue

        augmented_lines.append(
            {
                "y": int(anchor),
                "length": float(mean_line_length * 0.85),
                "synthetic": True,
            }
        )

    augmented_lines.sort(key=lambda item: item["y"])
    return augmented_lines


def _line_subset_score(
    line_subset: list[dict],
    image_height: int,
    n_rows_hint: int,
    bottom_anchors: list[int],
) -> float:
    if not line_subset:
        return float("-inf")

    vertical_span = line_subset[-1]["y"] - line_subset[0]["y"]
    length_sum = sum(item["length"] for item in line_subset)
    real_line_bonus = sum(40.0 for item in line_subset if not item.get("synthetic"))
    expected_spacing = image_height / max(n_rows_hint, 1)

    spacing_penalty = 0.0
    if len(line_subset) > 1:
        for left, right in zip(line_subset, line_subset[1:]):
            spacing_penalty += abs((right["y"] - left["y"]) - expected_spacing)

    anchor_penalty = 0.0
    for anchor in bottom_anchors:
        anchor_penalty += min(abs(anchor - line["y"]) for line in line_subset)

    return (vertical_span * 6.0) + length_sum + real_line_bonus - (spacing_penalty * 2.5) - (anchor_penalty * 5.0)


def _select_line_subset(
    lines: list[dict],
    n_rows_hint: int,
    image_height: int,
    bottom_anchors: list[int] | None = None,
) -> list[dict]:
    target_line_count = max(1, n_rows_hint - 1)
    bottom_anchors = bottom_anchors or []

    if n_rows_hint <= 1 or len(lines) <= target_line_count:
        return list(lines)

    best_subset: list[dict] | None = None
    best_score: float | None = None

    for combo in combinations(lines, target_line_count):
        sorted_combo = sorted(combo, key=lambda item: item["y"])
        score = _line_subset_score(sorted_combo, image_height, n_rows_hint, bottom_anchors)
        if best_score is None or score > best_score:
            best_score = score
            best_subset = list(sorted_combo)

    return best_subset or list(lines[:target_line_count])


def _expand_bands_to_hint(row_bands: list[tuple[int, int]], n_rows_hint: int, image_height: int) -> list[tuple[int, int]]:
    bands = list(row_bands)
    if not bands:
        return []

    while len(bands) < n_rows_hint:
        widest_index = max(range(len(bands)), key=lambda index: bands[index][1] - bands[index][0])
        top, bottom = bands[widest_index]
        if bottom - top <= 2:
            break

        mid = int(round((top + bottom) / 2))
        bands[widest_index : widest_index + 1] = [(top, mid), (mid, bottom)]

    if len(bands) > n_rows_hint > 0:
        bands = bands[:n_rows_hint]

    normalized_bands = []
    for top, bottom in bands:
        normalized_bands.append((max(0, int(top)), min(image_height, int(bottom))))

    return normalized_bands


def _row_bands_from_lines(lines: list[dict], image_height: int, n_rows_hint: int) -> list[tuple[int, int]]:
    if not lines:
        return []

    selected_lines = _select_line_subset(lines, n_rows_hint, image_height)
    boundaries = [0] + [int(item["y"]) for item in selected_lines] + [image_height]
    row_bands = [(boundaries[index], boundaries[index + 1]) for index in range(len(boundaries) - 1)]
    row_bands = [(top, bottom) for top, bottom in row_bands if bottom > top]
    return _expand_bands_to_hint(row_bands, n_rows_hint, image_height)


def _row_bands_from_kmeans(boxes, image_height: int, n_rows_hint: int) -> list[tuple[int, int]]:
    normalized_boxes = _normalize_boxes(boxes)
    if not normalized_boxes:
        if n_rows_hint <= 0:
            return []
        step = image_height / n_rows_hint
        return [
            (int(round(index * step)), int(round((index + 1) * step)))
            for index in range(n_rows_hint)
        ]

    cluster_count = min(max(1, n_rows_hint), len(normalized_boxes))
    bottom_edges = np.array([[box["bottom_y"]] for box in normalized_boxes], dtype=np.float32)
    kmeans = KMeans(n_clusters=cluster_count, n_init=10, random_state=0)
    kmeans.fit(bottom_edges)

    centers = sorted(float(center[0]) for center in kmeans.cluster_centers_)
    boundaries = [0]
    for left_center, right_center in zip(centers, centers[1:]):
        boundaries.append(int(round((left_center + right_center) / 2)))
    boundaries.append(image_height)

    row_bands = [(boundaries[index], boundaries[index + 1]) for index in range(len(boundaries) - 1)]
    row_bands = [(top, bottom) for top, bottom in row_bands if bottom > top]
    return _expand_bands_to_hint(row_bands, n_rows_hint, image_height)


def _line_bands_are_plausible(row_bands: list[tuple[int, int]], boxes, bottom_anchors: list[int], median_box_height: float) -> bool:
    normalized_boxes = _normalize_boxes(boxes)
    if not normalized_boxes or not row_bands or not bottom_anchors:
        return True

    grouped_rows = assign_boxes_to_row_bands([box["bbox"] for box in normalized_boxes], row_bands)
    occupied_row_count = sum(1 for row in grouped_rows if row)
    if occupied_row_count < len(bottom_anchors):
        return False

    spread_limit = max(24.0, median_box_height * 0.9)
    for row in grouped_rows:
        if len(row) < 2:
            continue
        row_bottoms = [item["bottom_y"] for item in row]
        if max(row_bottoms) - min(row_bottoms) > spread_limit:
            return False

    return True


def infer_visible_row_count(image_path: str, boxes=None) -> int:
    detected_lines, image_height = _detect_horizontal_shelf_lines(image_path)
    bottom_anchors, _ = _detect_box_bottom_anchors(boxes or [])

    if bottom_anchors:
        return max(1, len(bottom_anchors))

    if len(detected_lines) >= 2:
        return max(1, len(detected_lines) + 1)

    normalized_boxes = _normalize_boxes(boxes or [])
    if normalized_boxes:
        cluster_count = min(4, len(normalized_boxes))
        if cluster_count > 0:
            fallback_bands = _row_bands_from_kmeans(
                [box["bbox"] for box in normalized_boxes],
                image_height,
                cluster_count,
            )
            return max(1, len(fallback_bands))

    return 1


def detect_shelf_rows(image_path: str, n_rows_hint: int, boxes=None) -> list[tuple[int, int]]:
    """Detect row bands from physical shelf divider lines with a KMeans fallback."""

    from shelf_analyzer.image_preprocessor import filter_real_rows

    detected_lines, image_height = _detect_horizontal_shelf_lines(image_path)
    bottom_anchors, median_box_height = _detect_box_bottom_anchors(boxes or [])
    if len(detected_lines) >= 2:
        candidate_lines = _augment_lines_with_box_anchors(detected_lines, bottom_anchors)
        selected_lines = _select_line_subset(
            candidate_lines,
            n_rows_hint,
            image_height,
            bottom_anchors=bottom_anchors,
        )
        row_bands = _row_bands_from_lines(selected_lines, image_height, n_rows_hint)
        if _line_bands_are_plausible(row_bands, boxes or [], bottom_anchors, median_box_height):
            return filter_real_rows(image_path, row_bands, boxes=boxes or [])

    fallback_bands = _row_bands_from_kmeans(boxes or [], image_height, n_rows_hint)
    return filter_real_rows(image_path, fallback_bands, boxes=boxes or [])


def get_row_detection_method(image_path: str, n_rows_hint: int | None = None, boxes=None) -> str:
    detected_lines, image_height = _detect_horizontal_shelf_lines(image_path)
    bottom_anchors, median_box_height = _detect_box_bottom_anchors(boxes or [])

    if len(detected_lines) >= 2 and n_rows_hint:
        candidate_lines = _augment_lines_with_box_anchors(detected_lines, bottom_anchors)
        selected_lines = _select_line_subset(
            candidate_lines,
            n_rows_hint,
            image_height,
            bottom_anchors=bottom_anchors,
        )
        row_bands = _row_bands_from_lines(selected_lines, image_height, n_rows_hint)
        if _line_bands_are_plausible(row_bands, boxes or [], bottom_anchors, median_box_height):
            return "shelf lines (HoughLinesP)"

    if len(detected_lines) >= 2 and not n_rows_hint:
        return "shelf lines (HoughLinesP)"

    return "K-means fallback"


def _row_index_for_bottom_edge(bottom_y: int, row_bands: list[tuple[int, int]]) -> int | None:
    if not row_bands:
        return None

    assigned_row_index = next(
        (
            index
            for index, (row_top, row_bottom) in enumerate(row_bands)
            if row_top <= bottom_y <= row_bottom
        ),
        None,
    )
    if assigned_row_index is not None:
        return assigned_row_index

    return min(
        range(len(row_bands)),
        key=lambda index: min(
            abs(bottom_y - row_bands[index][0]),
            abs(bottom_y - row_bands[index][1]),
        ),
    )


def assign_entries_to_row_bands(entries, row_bands: list[tuple[int, int]]) -> list[list[dict]]:
    grouped_rows = [[] for _ in row_bands]
    if not row_bands:
        return grouped_rows

    for entry in entries:
        bbox = entry.get("bbox")
        if not bbox or len(bbox) != 4:
            continue

        bottom_y = int(round(entry.get("bottom_y", bbox[3])))
        assigned_row_index = _row_index_for_bottom_edge(bottom_y, row_bands)
        if assigned_row_index is None:
            continue

        grouped_rows[assigned_row_index].append(entry)

    for row in grouped_rows:
        row.sort(key=lambda item: item["bbox"][0])

    return grouped_rows


def assign_boxes_to_row_bands(boxes, row_bands: list[tuple[int, int]]) -> list[list[dict]]:
    return assign_entries_to_row_bands(_normalize_boxes(boxes), row_bands)


def _row_content_vertical_bounds(
    row_boxes: list[dict],
    row_band: tuple[int, int],
) -> tuple[int, int]:
    row_top, row_bottom = row_band
    if not row_boxes:
        return row_top, row_bottom

    top_candidates = [int(item["bbox"][1]) for item in row_boxes]
    bottom_candidates = [int(item["bbox"][3]) for item in row_boxes]

    median_top = int(round(median(top_candidates)))
    median_bottom = int(round(median(bottom_candidates)))

    content_top = max(row_top, median_top)
    content_bottom = min(row_bottom, median_bottom)

    if content_bottom <= content_top:
        content_top = max(row_top, min(top_candidates))
        content_bottom = min(row_bottom, max(bottom_candidates))

    return content_top, content_bottom


def _local_gap_vertical_bounds(
    row_content_top: int,
    row_content_bottom: int,
    left_box: dict | None = None,
    right_box: dict | None = None,
) -> tuple[int, int]:
    top_candidates = [row_content_top]
    bottom_candidates = [row_content_bottom]

    for neighbor in (left_box, right_box):
        if neighbor is None:
            continue
        top_candidates.append(int(neighbor["bbox"][1]))
        bottom_candidates.append(int(neighbor["bbox"][3]))

    gap_top = int(round(median(top_candidates)))
    gap_bottom = int(round(median(bottom_candidates)))
    if gap_bottom <= gap_top:
        gap_top = row_content_top
        gap_bottom = row_content_bottom

    return gap_top, gap_bottom


def detect_empty_spaces(boxes, img_shape, image_path: str | None = None, n_rows_hint: int | None = None):
    """Find horizontal shelf gaps from detected item boxes."""

    if not boxes:
        return []

    image_height, image_width = img_shape[:2]
    normalized_boxes = _normalize_boxes(boxes)
    if not normalized_boxes:
        return []

    if image_path:
        resolved_row_hint = n_rows_hint or infer_visible_row_count(image_path, boxes=boxes)
        row_bands = detect_shelf_rows(image_path, resolved_row_hint, boxes=boxes)
    else:
        row_bands = _row_bands_from_kmeans(boxes, image_height, n_rows_hint or 1)

    grouped_rows = assign_boxes_to_row_bands(boxes, row_bands)
    gaps = []

    for row_band, row_boxes in zip(row_bands, grouped_rows):
        if not row_boxes:
            continue

        median_box_width = float(median(item["width"] for item in row_boxes))
        full_gap_threshold = median_box_width * 0.7
        partial_gap_threshold = median_box_width * 0.3
        row_content_top, row_content_bottom = _row_content_vertical_bounds(row_boxes, row_band)

        for left_box, right_box in zip(row_boxes, row_boxes[1:]):
            gap_x1 = left_box["bbox"][2]
            gap_x2 = right_box["bbox"][0]
            gap_width = gap_x2 - gap_x1

            if gap_width >= full_gap_threshold:
                gap_type = "full"
            elif gap_width >= partial_gap_threshold:
                gap_type = "partial"
            else:
                continue

            gap_top, gap_bottom = _local_gap_vertical_bounds(
                row_content_top,
                row_content_bottom,
                left_box=left_box,
                right_box=right_box,
            )
            gaps.append(
                {
                    "bbox": [gap_x1, gap_top, gap_x2, gap_bottom],
                    "gap_type": gap_type,
                }
            )

        leftmost_box = min(row_boxes, key=lambda item: item["bbox"][0])
        left_gap_x2 = leftmost_box["bbox"][0]
        left_gap_top, left_gap_bottom = _local_gap_vertical_bounds(
            row_content_top,
            row_content_bottom,
            right_box=leftmost_box,
        )
        if left_gap_x2 >= full_gap_threshold:
            gaps.append(
                {
                    "bbox": [0, left_gap_top, left_gap_x2, left_gap_bottom],
                    "gap_type": "full",
                }
            )
        elif left_gap_x2 >= partial_gap_threshold:
            gaps.append(
                {
                    "bbox": [0, left_gap_top, left_gap_x2, left_gap_bottom],
                    "gap_type": "partial",
                }
            )

        rightmost_box = max(row_boxes, key=lambda item: item["bbox"][2])
        right_gap_x1 = rightmost_box["bbox"][2]
        right_gap_width = image_width - right_gap_x1
        right_gap_top, right_gap_bottom = _local_gap_vertical_bounds(
            row_content_top,
            row_content_bottom,
            left_box=rightmost_box,
        )
        if right_gap_width > median_box_width * 1.5:
            gaps.append(
                {
                    "bbox": [right_gap_x1, right_gap_top, image_width, right_gap_bottom],
                    "gap_type": "full",
                }
            )

    return gaps
