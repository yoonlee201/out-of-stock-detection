from __future__ import annotations

from PIL import Image, ImageDraw, ImageFont


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


def draw_annotations(image: Image.Image, detections: list) -> Image.Image:
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)

    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 14)
    except OSError:
        font = ImageFont.load_default()

    green = (34, 197, 94)
    red = (220, 38, 38)
    white = (255, 255, 255)

    for detection in detections:
        bbox = detection.get("bbox")
        if not bbox or len(bbox) != 4:
            continue

        x1, y1, x2, y2 = [int(value) for value in bbox]
        detection_type = detection.get("type")

        if detection_type == "empty_space":
            label_text = "EMPTY"
            box_color = red
            _draw_dashed_rect(draw, [x1, y1, x2, y2], color=box_color, width=2, dash=10)
        else:
            label_text = _format_label(detection.get("sku") or {})
            box_color = green
            draw.rectangle([x1, y1, x2, y2], outline=box_color, width=2)

        text_box = draw.textbbox((0, 0), label_text, font=font)
        text_width = text_box[2] - text_box[0]
        text_height = text_box[3] - text_box[1]
        chip_padding_x = 8
        chip_padding_y = 4
        chip_width = text_width + chip_padding_x * 2
        chip_height = text_height + chip_padding_y * 2

        chip_x1 = x1
        chip_y1 = y1 - chip_height - 4
        if chip_y1 < 0:
            chip_y1 = y1 + 4

        chip_x2 = chip_x1 + chip_width
        chip_y2 = chip_y1 + chip_height

        draw.rectangle([chip_x1, chip_y1, chip_x2, chip_y2], fill=box_color)
        draw.text(
            (chip_x1 + chip_padding_x, chip_y1 + chip_padding_y - text_box[1]),
            label_text,
            font=font,
            fill=white,
        )

    return annotated
