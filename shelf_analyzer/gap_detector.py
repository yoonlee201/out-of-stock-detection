from __future__ import annotations


def detect_empty_spaces(boxes, img_shape):
    """Find horizontal shelf gaps from detected item boxes.

    Args:
        boxes: Iterable of item boxes in [x1, y1, x2, y2] format.
        img_shape: Image shape as (height, width) or (height, width, channels).

    Returns:
        List of [x1, y1, x2, y2] coordinates for each detected empty gap.
    """

    if not boxes:
        return []

    image_height, image_width = img_shape[:2]

    normalized_boxes = []
    for box in boxes:
        if len(box) != 4:
            continue

        x1, y1, x2, y2 = [int(round(value)) for value in box]
        if x2 <= x1 or y2 <= y1:
            continue

        normalized_boxes.append(
            {
                "coords": [x1, y1, x2, y2],
                "centroid_y": (y1 + y2) / 2,
                "width": x2 - x1,
            }
        )

    if not normalized_boxes:
        return []

    rows = []
    row_tolerance = 30

    for box in sorted(normalized_boxes, key=lambda item: item["centroid_y"]):
        for row in rows:
            if abs(box["centroid_y"] - row["centroid_y"]) <= row_tolerance:
                row["boxes"].append(box)
                row["centroid_y"] = sum(item["centroid_y"] for item in row["boxes"]) / len(row["boxes"])
                break
        else:
            rows.append({"centroid_y": box["centroid_y"], "boxes": [box]})

    gaps = []

    for row in rows:
        row_boxes = sorted(row["boxes"], key=lambda item: item["coords"][0])
        if len(row_boxes) < 2:
            continue

        average_width = sum(item["width"] for item in row_boxes) / len(row_boxes)
        min_gap_width = average_width * 0.8

        row_top = max(0, min(item["coords"][1] for item in row_boxes))
        row_bottom = min(image_height, max(item["coords"][3] for item in row_boxes))

        for left_box, right_box in zip(row_boxes, row_boxes[1:]):
            gap_x1 = left_box["coords"][2]
            gap_x2 = right_box["coords"][0]
            gap_width = gap_x2 - gap_x1

            if gap_width > min_gap_width:
                gaps.append([gap_x1, row_top, gap_x2, row_bottom])

    return gaps
