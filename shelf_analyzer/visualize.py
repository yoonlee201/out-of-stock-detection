from __future__ import annotations

from collections import Counter, defaultdict
from statistics import median
from typing import Any

from PIL import Image, ImageDraw, ImageFont


MAX_MISSING_ROW_RATIO = 0.7
PLANOGRAM_CELL_WIDTH = 140
PLANOGRAM_CELL_HEIGHT = 84
PLANOGRAM_MARGIN = 28
PLANOGRAM_ROW_LABEL_WIDTH = 72
PLANOGRAM_TITLE_HEIGHT = 74


def _draw_dashed_rect(draw, box, color, width=2, dash=10):
    x1, y1, x2, y2 = [int(value) for value in box]

    for start_x in range(x1, x2, dash * 2):
        end_x = min(start_x + dash, x2)
        draw.line([(start_x, y1), (end_x, y1)], fill=color, width=width)
        draw.line([(start_x, y2), (end_x, y2)], fill=color, width=width)

    for start_y in range(y1, y2, dash * 2):
        end_y = min(start_y + dash, y2)
        draw.line([(x1, start_y), (x1, end_y)], fill=color, width=width)
        draw.line([(x2, start_y), (x2, end_y)], fill=color, width=width)


def _format_label(sku: dict) -> str:
    brand = str(sku.get("brand", "")).strip() if sku else ""
    product_name = str(sku.get("product_name", "")).strip() if sku else ""
    label = " ".join(part for part in [brand, product_name] if part).strip() or "Unknown"

    if len(label) > 30:
        return f"{label[:27]}..."
    return label


def _format_audit_label(detection: dict) -> str:
    marker = str(detection.get("issue_marker") or "").strip()
    status = str(detection.get("audit_status", "")).lower()
    actual = _format_label(detection.get("sku") or {})
    expected = _format_label(detection.get("expected_sku") or {})

    if status == "missing":
        label = f"{marker} {expected}".strip() if marker else f"MISSING: {expected}"
    elif status == "misplaced":
        label = f"{marker} {actual} -> {expected}".strip() if marker else f"WRONG: {actual} -> {expected}"
    elif status == "unverified":
        label = f"{marker} CHECK {actual}".strip() if marker else f"CHECK: {actual}"
    else:
        label = f"{marker} {actual}".strip() if marker else actual

    if len(label) > 42:
        return f"{label[:39]}..."
    return label


def _safe_row_number(value: Any) -> int | None:
    try:
        row_number = int(value)
    except (TypeError, ValueError):
        return None

    return row_number if row_number > 0 else None


def _normalize_bbox(value: Any) -> list[int] | None:
    if not value or len(value) != 4:
        return None

    x1, y1, x2, y2 = [int(value_item) for value_item in value]
    if x2 <= x1 or y2 <= y1:
        return None

    return [x1, y1, x2, y2]


def _overlay_bbox(detection: dict[str, Any]) -> list[int] | None:
    if detection.get("audit_status") == "missing":
        gap_bbox = _normalize_bbox(detection.get("gap_bbox"))
        if gap_bbox is not None:
            return gap_bbox

    return _normalize_bbox(detection.get("bbox"))


def _text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> tuple[int, int, int]:
    text_box = draw.textbbox((0, 0), text, font=font)
    return text_box[2] - text_box[0], text_box[3] - text_box[1], text_box[1]


def _draw_label_chip(
    draw: ImageDraw.ImageDraw,
    text: str,
    anchor_x: int,
    anchor_y: int,
    fill_color: tuple[int, int, int],
    text_color: tuple[int, int, int],
    font: ImageFont.ImageFont,
    image_width: int,
):
    text_width, text_height, text_top = _text_size(draw, text, font)
    chip_padding_x = 8
    chip_padding_y = 4
    chip_width = text_width + chip_padding_x * 2
    chip_height = text_height + chip_padding_y * 2

    chip_x1 = max(0, min(anchor_x, max(0, image_width - chip_width)))
    chip_y1 = max(0, anchor_y)
    chip_x2 = chip_x1 + chip_width
    chip_y2 = chip_y1 + chip_height

    draw.rectangle([chip_x1, chip_y1, chip_x2, chip_y2], fill=fill_color)
    draw.text(
        (chip_x1 + chip_padding_x, chip_y1 + chip_padding_y - text_top),
        text,
        font=font,
        fill=text_color,
    )


def _draw_box_label(
    draw: ImageDraw.ImageDraw,
    box: list[int],
    text: str,
    fill_color: tuple[int, int, int],
    font: ImageFont.ImageFont,
    image_width: int,
):
    x1, y1, _, _ = [int(value) for value in box]
    chip_y1 = y1 - 28
    if chip_y1 < 0:
        chip_y1 = y1 + 4

    _draw_label_chip(
        draw=draw,
        text=text,
        anchor_x=x1,
        anchor_y=chip_y1,
        fill_color=fill_color,
        text_color=(255, 255, 255),
        font=font,
        image_width=image_width,
    )


def _row_anchor_y(detections: list[dict[str, Any]]) -> int:
    y_values: list[int] = []
    for detection in detections:
        bbox = detection.get("bbox")
        if bbox and len(bbox) == 4:
            y_values.append(int(bbox[1]))

    return min(y_values) if y_values else 0


def _build_real_row_bands(detections: list[dict[str, Any]]) -> dict[int, tuple[int, int]]:
    product_rows: dict[int, list[dict[str, Any]]] = defaultdict(list)
    product_heights: list[int] = []

    for detection in detections:
        if detection.get("type") != "product":
            continue

        row_number = _safe_row_number(detection.get("row"))
        bbox = detection.get("bbox")
        if row_number is None or not bbox or len(bbox) != 4:
            continue

        product_rows[row_number].append(detection)
        product_heights.append(max(1, int(bbox[3]) - int(bbox[1])))

    if not product_rows:
        return {}

    median_height = int(median(product_heights)) if product_heights else 0
    padding = max(12, int(round(median_height * 0.18))) if median_height > 0 else 18
    row_bands: dict[int, tuple[int, int]] = {}

    for row_number, row_detections in product_rows.items():
        tops = [int(item["bbox"][1]) for item in row_detections if item.get("bbox")]
        bottoms = [int(item["bbox"][3]) for item in row_detections if item.get("bbox")]
        if not tops or not bottoms:
            continue

        row_bands[row_number] = (
            max(0, min(tops) - padding),
            max(bottoms) + padding,
        )

    return row_bands


def _group_detections_by_row(detections: list[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
    grouped: dict[int, list[dict[str, Any]]] = defaultdict(list)

    for detection in detections:
        row_number = _safe_row_number(detection.get("row"))
        if row_number is None:
            continue
        grouped[row_number].append(detection)

    return grouped


def _missing_row_policies(
    detections: list[dict[str, Any]],
) -> tuple[dict[int, dict[str, Any]], dict[int, tuple[int, int]]]:
    grouped_rows = _group_detections_by_row(detections)
    real_row_bands = _build_real_row_bands(detections)
    policies: dict[int, dict[str, Any]] = {}

    for row_number, row_detections in grouped_rows.items():
        missing_detections = [item for item in row_detections if item.get("audit_status") == "missing"]
        if not missing_detections:
            continue

        unique_positions = {
            int(item.get("position"))
            for item in row_detections
            if item.get("position") is not None
        }
        total_slots = max(1, len(unique_positions))
        missing_slots = {
            int(item.get("position"))
            for item in missing_detections
            if item.get("position") is not None
        }
        missing_ratio = len(missing_slots) / total_slots if total_slots else 1.0

        if row_number not in real_row_bands:
            policies[row_number] = {
                "mode": "not_visible",
                "count": len(missing_detections),
                "message": f"Row {row_number}: {len(missing_detections)} items not visible in frame",
                "anchor_y": _row_anchor_y(missing_detections),
            }
            continue

        if missing_ratio > MAX_MISSING_ROW_RATIO:
            row_top, _ = real_row_bands[row_number]
            policies[row_number] = {
                "mode": "density_warning",
                "message": f"Row {row_number}: \u26a0 Row may be out of frame or fully empty",
                "anchor_y": row_top,
            }

    return policies, real_row_bands


def _missing_box_within_real_row(
    detection: dict[str, Any],
    row_band: tuple[int, int] | None,
) -> bool:
    bbox = _overlay_bbox(detection)
    if bbox is None or row_band is None:
        return False

    _, y1, _, y2 = bbox
    row_top, row_bottom = row_band
    box_center_y = (y1 + y2) / 2
    return row_top <= box_center_y <= row_bottom


def _marker_sort_key(marker: str) -> tuple[str, int]:
    prefix = "".join(character for character in marker if character.isalpha())
    numeric_part = "".join(character for character in marker if character.isdigit())
    try:
        numeric_value = int(numeric_part)
    except ValueError:
        numeric_value = 0
    return prefix, numeric_value


def _format_missing_group_label(group_detections: list[dict[str, Any]]) -> str:
    markers = sorted(
        [str(item.get("issue_marker") or "").strip() for item in group_detections if item.get("issue_marker")],
        key=_marker_sort_key,
    )
    if not markers:
        marker_label = "MISSING"
    elif len(markers) == 1:
        marker_label = markers[0]
    else:
        marker_label = f"{markers[0]}-{markers[-1]}"

    label_counts: Counter[str] = Counter()
    for detection in group_detections:
        expected_label = _format_label(detection.get("expected_sku") or {})
        if expected_label and expected_label != "Unknown":
            label_counts[expected_label] += 1

    if not label_counts:
        return marker_label

    if len(label_counts) == 1:
        label, count = next(iter(label_counts.items()))
        text = f"{marker_label} {label}"
        if count > 1:
            text = f"{text} x{count}"
        return text if len(text) <= 42 else f"{text[:39]}..."

    total_count = sum(label_counts.values())
    details = ", ".join(
        f"{label} x{count}" if count > 1 else label
        for label, count in label_counts.items()
    )
    text = f"{marker_label} {details}" if len(details) <= 24 else f"{marker_label} Missing {total_count} items"
    return text if len(text) <= 42 else f"{text[:39]}..."


def _collect_row_note_messages(
    detections: list[dict[str, Any]],
    row_policies: dict[int, dict[str, Any]],
    suppressed_missing_counts: dict[int, int],
) -> dict[int, dict[str, Any]]:
    note_policies = dict(row_policies)

    for row_number, suppressed_count in suppressed_missing_counts.items():
        if suppressed_count <= 0 or row_number in note_policies:
            continue

        row_missing_detections = [
            detection
            for detection in detections
            if detection.get("audit_status") == "missing" and _safe_row_number(detection.get("row")) == row_number
        ]
        note_policies[row_number] = {
            "mode": "not_visible",
            "count": suppressed_count,
            "message": f"Row {row_number}: {suppressed_count} items not visible in frame",
            "anchor_y": _row_anchor_y(row_missing_detections),
        }

    return note_policies


def _brand_fill_color(brand: str) -> tuple[int, int, int]:
    normalized = brand.strip().lower()
    if "general mills" in normalized:
        return (219, 234, 254)
    if "kellogg" in normalized:
        return (254, 226, 226)
    if "quaker" in normalized:
        return (254, 249, 195)
    if "great value" in normalized:
        return (220, 252, 231)
    return (241, 245, 249)


def _wrap_text(text: str, max_chars: int = 18) -> list[str]:
    words = [word for word in text.split() if word]
    if not words:
        return [""]

    lines: list[str] = []
    current_line = words[0]
    for word in words[1:]:
        candidate = f"{current_line} {word}"
        if len(candidate) <= max_chars:
            current_line = candidate
        else:
            lines.append(current_line)
            current_line = word
    lines.append(current_line)
    return lines[:3]


def draw_raw_detection_annotations(image: Image.Image, detections: list[dict[str, Any]]) -> Image.Image:
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)

    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 13)
    except OSError:
        font = ImageFont.load_default()

    image_width = annotated.width
    box_color = (37, 99, 235)

    for index, detection in enumerate(detections, start=1):
        bbox = detection.get("bbox")
        if not bbox or len(bbox) != 4:
            continue

        x1, y1, x2, y2 = [int(value) for value in bbox]
        draw.rectangle([x1, y1, x2, y2], outline=box_color, width=3)

        sku = detection.get("sku") or {}
        label_core = _format_label(sku)
        try:
            confidence = float(sku.get("confidence", 0))
        except (TypeError, ValueError):
            confidence = 0.0
        label_text = f"D{index}: {label_core} {confidence:.2f}"
        if len(label_text) > 46:
            label_text = f"{label_text[:43]}..."

        _draw_box_label(
            draw=draw,
            box=bbox,
            text=label_text,
            fill_color=box_color,
            font=font,
            image_width=image_width,
        )

    return annotated


def draw_empty_space_annotations(image: Image.Image, empty_spaces: list[dict[str, Any]]) -> Image.Image:
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)

    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 13)
    except OSError:
        font = ImageFont.load_default()

    image_width = annotated.width
    box_color = (220, 38, 38)

    for index, gap in enumerate(empty_spaces, start=1):
        bbox = gap.get("bbox")
        if not bbox or len(bbox) != 4:
            continue

        _draw_dashed_rect(draw, bbox, color=box_color, width=3, dash=10)
        gap_type = str(gap.get("gap_type") or "full").lower()
        label_text = f"G{index}: {'partial' if gap_type == 'partial' else 'empty'}"
        _draw_box_label(
            draw=draw,
            box=bbox,
            text=label_text,
            fill_color=box_color,
            font=font,
            image_width=image_width,
        )

    return annotated


def draw_planogram_preview(planogram: dict[str, Any]) -> Image.Image:
    rows = sorted(planogram.get("rows", []), key=lambda row: row.get("row", 0))
    max_positions = max((len(row.get("slots", [])) for row in rows), default=1)
    image_width = (PLANOGRAM_MARGIN * 2) + PLANOGRAM_ROW_LABEL_WIDTH + (PLANOGRAM_CELL_WIDTH * max_positions)
    image_height = (PLANOGRAM_MARGIN * 2) + PLANOGRAM_TITLE_HEIGHT + (PLANOGRAM_CELL_HEIGHT * max(1, len(rows)))

    image = Image.new("RGB", (image_width, image_height), (248, 250, 252))
    draw = ImageDraw.Draw(image)

    try:
        title_font = ImageFont.truetype("DejaVuSans-Bold.ttf", 24)
        row_font = ImageFont.truetype("DejaVuSans-Bold.ttf", 16)
        cell_font = ImageFont.truetype("DejaVuSans-Bold.ttf", 12)
        small_font = ImageFont.truetype("DejaVuSans-Bold.ttf", 11)
    except OSError:
        title_font = ImageFont.load_default()
        row_font = ImageFont.load_default()
        cell_font = ImageFont.load_default()
        small_font = ImageFont.load_default()

    title = str(planogram.get("name") or "Planogram")
    subtitle = f"ID: {planogram.get('id', 'unknown')} · Rows: {planogram.get('total_rows', len(rows))}"
    draw.text((PLANOGRAM_MARGIN, PLANOGRAM_MARGIN - 4), title, font=title_font, fill=(15, 23, 42))
    draw.text((PLANOGRAM_MARGIN, PLANOGRAM_MARGIN + 28), subtitle, font=small_font, fill=(71, 85, 105))

    grid_top = PLANOGRAM_MARGIN + PLANOGRAM_TITLE_HEIGHT
    for row_index, row in enumerate(rows):
        row_number = int(row.get("row", row_index + 1))
        row_y1 = grid_top + (row_index * PLANOGRAM_CELL_HEIGHT)
        row_y2 = row_y1 + PLANOGRAM_CELL_HEIGHT

        draw.text(
            (PLANOGRAM_MARGIN, row_y1 + 28),
            f"Row {row_number}",
            font=row_font,
            fill=(30, 41, 59),
        )

        for slot in sorted(row.get("slots", []), key=lambda value: value.get("position", 0)):
            position = int(slot.get("position", 1))
            cell_x1 = PLANOGRAM_MARGIN + PLANOGRAM_ROW_LABEL_WIDTH + ((position - 1) * PLANOGRAM_CELL_WIDTH)
            cell_x2 = cell_x1 + PLANOGRAM_CELL_WIDTH - 8
            cell_y1 = row_y1 + 6
            cell_y2 = row_y2 - 6

            fill = _brand_fill_color(str(slot.get("brand", "")))
            draw.rounded_rectangle(
                [cell_x1, cell_y1, cell_x2, cell_y2],
                radius=10,
                fill=fill,
                outline=(148, 163, 184),
                width=1,
            )

            draw.text((cell_x1 + 10, cell_y1 + 8), f"P{position}", font=small_font, fill=(71, 85, 105))

            brand = str(slot.get("brand", "")).strip()
            product = str(slot.get("product", "")).strip()
            variant = str(slot.get("variant", "")).strip()
            lines = _wrap_text(f"{brand} {product}".strip(), max_chars=16)
            if variant:
                lines.extend(_wrap_text(variant, max_chars=16))

            text_y = cell_y1 + 24
            for line in lines[:3]:
                draw.text((cell_x1 + 10, text_y), line, font=cell_font, fill=(15, 23, 42))
                text_y += 14

    return image


def draw_planogram_annotations(image: Image.Image, detections: list[dict[str, Any]]) -> Image.Image:
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)

    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 14)
        note_font = ImageFont.truetype("DejaVuSans-Bold.ttf", 12)
    except OSError:
        font = ImageFont.load_default()
        note_font = ImageFont.load_default()

    green = (34, 197, 94)
    red = (220, 38, 38)
    amber = (217, 119, 6)
    white = (255, 255, 255)
    grey_fill = (100, 116, 139)

    image_width = annotated.width
    row_policies, real_row_bands = _missing_row_policies(detections)
    suppressed_missing_counts: dict[int, int] = defaultdict(int)
    missing_groups: dict[tuple[int | None, tuple[int, int, int, int]], list[dict[str, Any]]] = defaultdict(list)

    for detection in detections:
        bbox = _overlay_bbox(detection)
        if bbox is None:
            continue

        x1, y1, x2, y2 = bbox
        detection_type = detection.get("type")
        audit_status = detection.get("audit_status")

        if audit_status not in {"missing", "misplaced"}:
            continue

        row_number = _safe_row_number(detection.get("row"))
        if audit_status == "missing" and row_number is not None:
            row_policy = row_policies.get(row_number)
            row_band = real_row_bands.get(row_number)
            if row_policy is not None:
                continue
            if not _missing_box_within_real_row(detection, row_band):
                suppressed_missing_counts[row_number] += 1
                continue
            missing_groups[(row_number, tuple(bbox))].append(detection)
            continue

        label_text = _format_audit_label(detection)

        if audit_status == "misplaced":
            box_color = amber
            draw.rectangle([x1, y1, x2, y2], outline=box_color, width=3)
        else:
            box_color = green
            draw.rectangle([x1, y1, x2, y2], outline=box_color, width=2)

        _draw_box_label(
            draw=draw,
            box=bbox,
            text=label_text,
            fill_color=box_color,
            font=font,
            image_width=image_width,
        )

    for (_, bbox_tuple), grouped_missing_detections in sorted(
        missing_groups.items(),
        key=lambda item: (item[0][0] if item[0][0] is not None else 0, item[0][1][1], item[0][1][0]),
    ):
        bbox = list(bbox_tuple)
        _draw_dashed_rect(draw, bbox, color=red, width=2, dash=10)
        _draw_box_label(
            draw=draw,
            box=bbox,
            text=_format_missing_group_label(grouped_missing_detections),
            fill_color=red,
            font=font,
            image_width=image_width,
        )

    row_note_policies = _collect_row_note_messages(
        detections=detections,
        row_policies=row_policies,
        suppressed_missing_counts=suppressed_missing_counts,
    )

    for row_number, row_policy in sorted(row_note_policies.items()):
        anchor_y = int(row_policy.get("anchor_y", 0))
        _draw_label_chip(
            draw=draw,
            text=str(row_policy.get("message", "")),
            anchor_x=8,
            anchor_y=max(4, anchor_y + 4),
            fill_color=grey_fill,
            text_color=white,
            font=note_font,
            image_width=image_width,
        )

    return annotated


def draw_annotations(image: Image.Image, detections: list) -> Image.Image:
    return draw_planogram_annotations(image, detections)
