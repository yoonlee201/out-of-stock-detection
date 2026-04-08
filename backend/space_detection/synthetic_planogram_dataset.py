from __future__ import annotations

import argparse
import json
import math
import random
import shutil
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


@dataclass(frozen=True)
class SKUDefinition:
    sku_id: str
    brand: str
    product_name: str
    size_label: str
    package_type: str
    base_color: str
    accent_color: str
    band_color: str
    pattern: str


DEFAULT_SKUS: list[SKUDefinition] = [
    SKUDefinition("SKU_AURORA_OATS_HONEY_18OZ", "Aurora", "Honey Oats", "18 oz", "box", "#E7B13A", "#FFF3BF", "#714D00", "bands"),
    SKUDefinition("SKU_AURORA_OATS_BERRY_18OZ", "Aurora", "Berry Oats", "18 oz", "box", "#C94F7C", "#FAD4E0", "#5B1730", "dots"),
    SKUDefinition("SKU_BLUEHARBOR_PASTA_PENNE_16OZ", "BlueHarbor", "Penne Pasta", "16 oz", "box", "#2B6CB0", "#D7ECFF", "#0D2C4F", "window"),
    SKUDefinition("SKU_BLUEHARBOR_PASTA_FUSILLI_16OZ", "BlueHarbor", "Fusilli Pasta", "16 oz", "box", "#0F8C8C", "#D4FAF4", "#004B4B", "window"),
    SKUDefinition("SKU_CEDARRIDGE_COFFEE_DARK_12OZ", "CedarRidge", "Dark Roast", "12 oz", "bag", "#4A312C", "#E7D2C9", "#1E0F0C", "diagonal"),
    SKUDefinition("SKU_CEDARRIDGE_COFFEE_MEDIUM_12OZ", "CedarRidge", "Medium Roast", "12 oz", "bag", "#7B5B43", "#F3E2C9", "#2E1D10", "diagonal"),
    SKUDefinition("SKU_CLOUDNINE_SODA_COLA_1L", "CloudNine", "Classic Cola", "1 L", "bottle", "#A32525", "#FFD8D8", "#4C0909", "wave"),
    SKUDefinition("SKU_CLOUDNINE_SODA_LEMON_1L", "CloudNine", "Lemon Fizz", "1 L", "bottle", "#D8BE21", "#FFF8C7", "#615100", "wave"),
    SKUDefinition("SKU_FIELDDAY_CRACKERS_SEASALT_9OZ", "FieldDay", "Sea Salt Crisps", "9 oz", "box", "#8A9C2A", "#F0F8CF", "#344200", "bands"),
    SKUDefinition("SKU_FIELDDAY_CRACKERS_CHEDDAR_9OZ", "FieldDay", "Cheddar Crisps", "9 oz", "box", "#E08924", "#FDE1BF", "#6C3100", "bands"),
    SKUDefinition("SKU_HILLSIDE_GRANOLA_MAPLE_11OZ", "Hillside", "Maple Granola", "11 oz", "bag", "#B16E2C", "#FFE0B8", "#5B3107", "dots"),
    SKUDefinition("SKU_HILLSIDE_GRANOLA_APPLE_11OZ", "Hillside", "Apple Granola", "11 oz", "bag", "#6B9B4A", "#E0F5D2", "#23420D", "dots"),
]

DEFAULT_SPLIT_COUNTS = {"train": 36, "valid": 8, "test": 8}
CANVAS_WIDTH = 1440
CANVAS_HEIGHT = 900
ROWS = 3
COLS = 6
SLOT_GAP = 22
SHELF_MARGIN_X = 92
SHELF_BOARD_HEIGHT = 18
SLOT_HEIGHT = 176
ASSET_ROOT = Path(__file__).resolve().parent / "assets"
SHELF_BACKGROUND_DIR = ASSET_ROOT / "shelf_backgrounds"
SKU_PHOTO_DIR = ASSET_ROOT / "sku_photos"


def _load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def _lighten(color: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(min(255, int(channel + (255 - channel) * amount)) for channel in color)


def _darken(color: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(max(0, int(channel * (1 - amount))) for channel in color)


def _blend(color_a: tuple[int, int, int], color_b: tuple[int, int, int], ratio: float) -> tuple[int, int, int]:
    return tuple(
        int(color_a[index] * (1 - ratio) + color_b[index] * ratio)
        for index in range(3)
    )


def _alpha_fill(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return color[0], color[1], color[2], alpha


def _add_noise_overlay(image: Image.Image, rng: random.Random, opacity: int = 18, blur_radius: float = 0.6) -> None:
    noise = Image.effect_noise(image.size, rng.uniform(8, 16)).convert("L")
    if blur_radius > 0:
        noise = noise.filter(ImageFilter.GaussianBlur(radius=blur_radius))

    grain = ImageOps.colorize(noise, black=(112, 112, 112), white=(152, 152, 152)).convert("RGBA")
    alpha = noise.point(lambda value: int(opacity * value / 255))
    grain.putalpha(alpha)
    image.alpha_composite(grain)


def _add_vignette(image: Image.Image, rng: random.Random) -> None:
    width, height = image.size
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    base_margin = int(min(width, height) * 0.1)

    for index in range(10):
        inset = int(index * base_margin / 10)
        alpha = int(10 + index * rng.uniform(3.0, 5.5))
        draw.rounded_rectangle(
            (inset, inset, width - inset, height - inset),
            radius=max(24, int(min(width, height) * 0.03)),
            outline=(26, 24, 22, alpha),
            width=max(12, base_margin // 5),
        )

    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=42))
    image.alpha_composite(overlay)


def _draw_soft_shadow(
    image: Image.Image,
    box: tuple[int, int, int, int],
    color: tuple[int, int, int] = (40, 34, 28),
    alpha: int = 42,
    blur_radius: float = 12,
    offset: tuple[int, int] = (0, 10),
    radius: int = 18,
) -> None:
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    x1, y1, x2, y2 = box
    dx, dy = offset
    shadow_draw.rounded_rectangle(
        (x1 + dx, y1 + dy, x2 + dx, y2 + dy),
        radius=radius,
        fill=_alpha_fill(color, alpha),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    image.alpha_composite(shadow)


def _wrap_text(text: str, max_chars: int) -> list[str]:
    words = text.split()
    if not words:
        return [text]

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _draw_pattern(draw: ImageDraw.ImageDraw, area: tuple[int, int, int, int], sku: SKUDefinition) -> None:
    x1, y1, x2, y2 = area
    accent = _hex_to_rgb(sku.accent_color)
    band = _hex_to_rgb(sku.band_color)

    if sku.pattern == "bands":
        stripe_height = max(14, (y2 - y1) // 7)
        for index, top in enumerate(range(y1, y2, stripe_height)):
            if index % 2 == 0:
                draw.rectangle((x1, top, x2, min(y2, top + stripe_height // 2)), fill=accent)
    elif sku.pattern == "dots":
        radius = max(6, (x2 - x1) // 18)
        for row in range(y1 + radius, y2, radius * 3):
            for col in range(x1 + radius, x2, radius * 3):
                draw.ellipse((col - radius, row - radius, col + radius, row + radius), fill=accent)
    elif sku.pattern == "diagonal":
        step = max(18, (x2 - x1) // 8)
        for offset in range(-step * 2, (x2 - x1) + step * 2, step):
            draw.line((x1 + offset, y2, x1 + offset + step * 2, y1), fill=accent, width=8)
    elif sku.pattern == "wave":
        amplitude = max(8, (y2 - y1) // 12)
        mid = (y1 + y2) // 2
        points: list[tuple[int, int]] = []
        for x in range(x1, x2 + 1, 14):
            offset = math.sin((x - x1) / 34) * amplitude
            points.append((x, int(mid + offset)))
        draw.line(points, fill=accent, width=16)
        draw.line([(x, y + 32) for x, y in points], fill=band, width=10)
    elif sku.pattern == "window":
        window_margin_x = max(20, (x2 - x1) // 5)
        window_margin_y = max(18, (y2 - y1) // 8)
        draw.rounded_rectangle(
            (x1 + window_margin_x, y1 + window_margin_y, x2 - window_margin_x, y2 - window_margin_y),
            radius=16,
            fill=_lighten(accent, 0.18),
            outline=band,
            width=5,
        )
        noodle_color = _darken(accent, 0.15)
        for offset in range(0, max(12, (x2 - x1) // 9) * 5, max(12, (x2 - x1) // 9)):
            draw.arc(
                (
                    x1 + window_margin_x + offset,
                    y1 + window_margin_y + 14,
                    x1 + window_margin_x + offset + 54,
                    y2 - window_margin_y + 4,
                ),
                start=90,
                end=270,
                fill=noodle_color,
                width=4,
            )


def render_sku_reference(sku: SKUDefinition, output_path: Path) -> None:
    custom_photo = None
    for extension in (".png", ".jpg", ".jpeg", ".webp"):
        candidate = SKU_PHOTO_DIR / f"{sku.sku_id}{extension}"
        if candidate.exists():
            custom_photo = candidate
            break

    if custom_photo is not None:
        width, height = 320, 440
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        product = Image.open(custom_photo).convert("RGBA")
        bbox = product.getbbox()
        if bbox:
            product = product.crop(bbox)
        product.thumbnail((260, 390), Image.Resampling.LANCZOS)

        shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        paste_x = (width - product.width) // 2
        paste_y = height - product.height - 18
        shadow_draw.rounded_rectangle(
            (paste_x + 8, paste_y + 12, paste_x + product.width - 4, paste_y + product.height + 6),
            radius=18,
            fill=(0, 0, 0, 26),
        )
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=12))
        canvas.alpha_composite(shadow)
        canvas.alpha_composite(product, (paste_x, paste_y))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(output_path)
        return

    width, height = 320, 440
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    base = _hex_to_rgb(sku.base_color)
    accent = _hex_to_rgb(sku.accent_color)
    band = _hex_to_rgb(sku.band_color)
    border = _darken(base, 0.22)

    body_box = (34, 20, width - 34, height - 18)

    if sku.package_type == "bottle":
        draw.rounded_rectangle((74, 58, width - 74, height - 18), radius=28, fill=base, outline=border, width=6)
        draw.rounded_rectangle((112, 18, width - 112, 88), radius=12, fill=band, outline=border, width=4)
        label_box = (78, 118, width - 78, height - 70)
        draw.rounded_rectangle(label_box, radius=24, fill=accent, outline=band, width=5)
        _draw_pattern(draw, (label_box[0] + 12, label_box[1] + 24, label_box[2] - 12, label_box[1] + 110), sku)
    else:
        radius = 26 if sku.package_type == "bag" else 16
        draw.rounded_rectangle(body_box, radius=radius, fill=base, outline=border, width=6)
        draw.rectangle((body_box[0], body_box[1], body_box[2], body_box[1] + 72), fill=band)
        pattern_area = (body_box[0] + 12, body_box[1] + 92, body_box[2] - 12, body_box[1] + 196)
        _draw_pattern(draw, pattern_area, sku)

    shading = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shading)

    if sku.package_type == "bottle":
        shade_draw.rounded_rectangle((92, 72, 122, height - 40), radius=18, fill=(255, 255, 255, 56))
        shade_draw.rounded_rectangle((width - 118, 80, width - 88, height - 48), radius=18, fill=(0, 0, 0, 24))
        shade_draw.ellipse((88, 70, width - 88, 118), fill=(255, 255, 255, 26))
    else:
        shade_draw.rounded_rectangle((body_box[0] + 12, body_box[1] + 18, body_box[0] + 40, body_box[3] - 22), radius=14, fill=(255, 255, 255, 42))
        shade_draw.rounded_rectangle((body_box[2] - 34, body_box[1] + 16, body_box[2] - 12, body_box[3] - 18), radius=12, fill=(0, 0, 0, 18))
        shade_draw.rectangle((body_box[0] + 10, body_box[3] - 34, body_box[2] - 10, body_box[3] - 12), fill=(0, 0, 0, 16))

        if sku.package_type == "bag":
            wrinkle_color = (255, 255, 255, 24)
            for offset in range(0, 4):
                start_x = body_box[0] + 30 + offset * 46
                shade_draw.line(
                    (start_x, body_box[1] + 90, start_x - 18, body_box[3] - 48),
                    fill=wrinkle_color,
                    width=4,
                )
                shade_draw.line(
                    (start_x + 28, body_box[1] + 96, start_x + 10, body_box[3] - 56),
                    fill=(0, 0, 0, 14),
                    width=3,
                )

    shading = shading.filter(ImageFilter.GaussianBlur(radius=3.2))
    canvas.alpha_composite(shading)

    brand_font = _load_font(28, bold=True)
    name_font = _load_font(30, bold=True)
    meta_font = _load_font(20)
    small_font = _load_font(16)

    draw.text((width // 2, 56), sku.brand.upper(), font=brand_font, fill="white", anchor="mm")

    name_lines = _wrap_text(sku.product_name.upper(), max_chars=13)
    text_start_y = 250 if sku.package_type == "bottle" else 238
    for index, line in enumerate(name_lines):
        draw.text((width // 2, text_start_y + index * 34), line, font=name_font, fill=band, anchor="mm")

    draw.text((width // 2, height - 82), sku.size_label.upper(), font=meta_font, fill=border, anchor="mm")
    draw.text((width // 2, height - 54), f"SKU {sku.sku_id[-8:]}", font=small_font, fill=border, anchor="mm")

    barcode_left = width // 2 - 46
    for index in range(11):
        bar_x = barcode_left + index * 8
        bar_width = 2 if index % 2 == 0 else 4
        draw.rectangle((bar_x, height - 38, bar_x + bar_width, height - 18), fill=border)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path)


def _draw_wall_background(image: Image.Image, rng: random.Random) -> None:
    width, height = image.size
    background_candidates = [
        path
        for extension in ("*.png", "*.jpg", "*.jpeg", "*.webp")
        for path in SHELF_BACKGROUND_DIR.glob(extension)
    ]
    if background_candidates:
        background_path = rng.choice(background_candidates)
        background = Image.open(background_path).convert("RGB")
        fitted = ImageOps.fit(background, (width, height), method=Image.Resampling.LANCZOS)
        fitted = ImageEnhance.Brightness(fitted).enhance(rng.uniform(0.88, 0.98))
        fitted = ImageEnhance.Contrast(fitted).enhance(rng.uniform(0.94, 1.05))
        fitted_rgba = fitted.convert("RGBA")
        if rng.random() < 0.6:
            fitted_rgba = fitted_rgba.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.2, 1.0)))
        image.alpha_composite(fitted_rgba)
        overlay = Image.new("RGBA", image.size, (248, 244, 236, rng.randint(54, 90)))
        image.alpha_composite(overlay)
        _add_noise_overlay(image, rng, opacity=8, blur_radius=0.7)
        return

    base_color = rng.choice(
        [
            (243, 239, 233),
            (238, 240, 245),
            (247, 244, 238),
            (234, 239, 232),
        ]
    )
    target_color = _darken(base_color, 0.09)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        blend = y / max(height - 1, 1)
        line_color = tuple(
            int(base_color[index] * (1 - blend) + target_color[index] * blend)
            for index in range(3)
        )
        draw.line((0, y, width, y), fill=line_color)

    texture = Image.new("RGBA", image.size, (0, 0, 0, 0))
    texture_draw = ImageDraw.Draw(texture)

    for _ in range(rng.randint(6, 10)):
        band_y = rng.randint(0, height - 1)
        band_height = rng.randint(20, 46)
        band_color = _blend(base_color, target_color, rng.uniform(0.2, 0.75))
        texture_draw.rectangle(
            (0, band_y, width, min(height, band_y + band_height)),
            fill=_alpha_fill(band_color, rng.randint(8, 18)),
        )

    for _ in range(rng.randint(4, 7)):
        seam_x = rng.randint(120, width - 120)
        texture_draw.line(
            (seam_x, 0, seam_x, height),
            fill=(255, 255, 255, rng.randint(10, 20)),
            width=rng.randint(1, 2),
        )

    texture = texture.filter(ImageFilter.GaussianBlur(radius=10))
    image.alpha_composite(texture)
    _add_noise_overlay(image, rng, opacity=12, blur_radius=0.9)


def _build_row_expected_layout(available_skus: list[str], cols: int, rng: random.Random) -> list[str]:
    expected: list[str] = []
    last_sku = ""
    while len(expected) < cols:
        remaining = cols - len(expected)
        run_length = rng.choice([1, 1, 2, 2, 3])
        run_length = min(run_length, remaining)
        candidates = [sku_id for sku_id in available_skus if sku_id != last_sku] or available_skus
        sku_id = rng.choice(candidates)
        expected.extend([sku_id] * run_length)
        last_sku = sku_id
    return expected


def _fit_reference_to_slot(reference: Image.Image, slot_width: int, slot_height: int, scale: float) -> Image.Image:
    target_width = max(24, int(slot_width * scale))
    target_height = max(36, int(slot_height * scale))
    fitted = reference.copy()
    fitted.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)
    return fitted


def _composite_product(
    canvas: Image.Image,
    slot_box: tuple[int, int, int, int],
    reference_image: Image.Image,
    rng: random.Random,
) -> None:
    x1, y1, x2, y2 = slot_box
    slot_width = max(1, x2 - x1)
    slot_height = max(1, y2 - y1)
    scaled = _fit_reference_to_slot(reference_image, slot_width, slot_height, scale=rng.uniform(0.78, 0.92))
    angle = rng.uniform(-3.5, 3.5)
    scaled = scaled.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)

    if rng.random() < 0.55:
        scaled = ImageEnhance.Color(scaled).enhance(rng.uniform(0.92, 1.08))
    if rng.random() < 0.55:
        scaled = ImageEnhance.Brightness(scaled).enhance(rng.uniform(0.95, 1.05))

    paste_x = x1 + (slot_width - scaled.width) // 2 + rng.randint(-6, 6)
    paste_y = y2 - scaled.height + rng.randint(-4, 4)

    shadow_box = (
        max(x1 + 14, paste_x + 8),
        y2 - 34,
        min(x2 - 10, paste_x + scaled.width - 8),
        y2 - 8,
    )
    _draw_soft_shadow(
        canvas,
        shadow_box,
        color=(58, 49, 38),
        alpha=rng.randint(22, 34),
        blur_radius=rng.uniform(8.0, 12.0),
        offset=(0, 7),
        radius=10,
    )

    if rng.random() < 0.35:
        _draw_soft_shadow(
            canvas,
            (paste_x + 10, paste_y + 14, paste_x + scaled.width - 12, paste_y + scaled.height - 4),
            color=(48, 40, 32),
            alpha=rng.randint(10, 18),
            blur_radius=rng.uniform(10.0, 16.0),
            offset=(rng.randint(-2, 2), rng.randint(2, 7)),
            radius=18,
        )

    canvas.alpha_composite(scaled, (paste_x, paste_y))


def _bbox_to_dict(box: tuple[int, int, int, int]) -> dict[str, int]:
    x1, y1, x2, y2 = box
    return {
        "x1": x1,
        "y1": y1,
        "x2": x2,
        "y2": y2,
        "width": x2 - x1,
        "height": y2 - y1,
    }


def _to_yolo_bbox(box: tuple[int, int, int, int], image_width: int, image_height: int) -> tuple[float, float, float, float]:
    x1, y1, x2, y2 = box
    cx = ((x1 + x2) / 2) / image_width
    cy = ((y1 + y2) / 2) / image_height
    width = (x2 - x1) / image_width
    height = (y2 - y1) / image_height
    return cx, cy, width, height


def _write_empty_space_labels(empty_slots: list[tuple[int, int, int, int]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not empty_slots:
        output_path.write_text("", encoding="utf-8")
        return

    lines: list[str] = []
    for box in empty_slots:
        cx, cy, width, height = _to_yolo_bbox(box, image_width=CANVAS_WIDTH, image_height=CANVAS_HEIGHT)
        lines.append(f"0 {cx:.6f} {cy:.6f} {width:.6f} {height:.6f}")

    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _apply_camera_finish(image: Image.Image, rng: random.Random) -> Image.Image:
    finished = image.convert("RGB")
    finished = ImageEnhance.Color(finished).enhance(rng.uniform(0.96, 1.08))
    finished = ImageEnhance.Contrast(finished).enhance(rng.uniform(0.98, 1.12))
    finished = ImageEnhance.Brightness(finished).enhance(rng.uniform(0.98, 1.03))

    if rng.random() < 0.7:
        finished = ImageEnhance.Sharpness(finished).enhance(rng.uniform(1.05, 1.22))
    if rng.random() < 0.5:
        finished = finished.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.1, 0.35)))

    finished_rgba = finished.convert("RGBA")
    _add_noise_overlay(finished_rgba, rng, opacity=10, blur_radius=0.2)
    _add_vignette(finished_rgba, rng)
    return finished_rgba.convert("RGB")


def _render_scene(
    split: str,
    scene_index: int,
    dataset_root: Path,
    catalog: list[SKUDefinition],
    catalog_image_map: dict[str, Path],
    rng: random.Random,
) -> dict[str, Any]:
    scene_id = f"{split}_{scene_index:04d}"
    canvas = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), (255, 255, 255, 255))
    _draw_wall_background(canvas, rng)
    draw = ImageDraw.Draw(canvas)

    slot_width = (CANVAS_WIDTH - (SHELF_MARGIN_X * 2) - (SLOT_GAP * (COLS - 1))) // COLS
    shelf_tops = [94, 348, 602]

    scene_catalog = rng.sample(catalog, k=min(len(catalog), 8))
    scene_catalog_ids = [sku.sku_id for sku in scene_catalog]

    planogram_slots: list[dict[str, Any]] = []
    metadata_slots: list[dict[str, Any]] = []
    empty_boxes: list[tuple[int, int, int, int]] = []

    for shelf_index, shelf_top in enumerate(shelf_tops, start=1):
        shelf_id = f"shelf_{shelf_index}"
        shelf_box = (SHELF_MARGIN_X - 18, shelf_top - 26, CANVAS_WIDTH - SHELF_MARGIN_X + 18, shelf_top + SLOT_HEIGHT + 38)
        shelf_color = rng.choice([(229, 217, 201), (219, 211, 193), (227, 220, 210)])
        slot_background = _lighten(shelf_color, 0.14)

        _draw_soft_shadow(
            canvas,
            shelf_box,
            color=(74, 63, 50),
            alpha=26,
            blur_radius=20,
            offset=(0, 18),
            radius=22,
        )
        draw.rounded_rectangle(shelf_box, radius=18, fill=_lighten(shelf_color, 0.26))
        draw.rectangle(
            (shelf_box[0], shelf_top + SLOT_HEIGHT + 6, shelf_box[2], shelf_top + SLOT_HEIGHT + 6 + SHELF_BOARD_HEIGHT),
            fill=shelf_color,
        )
        draw.rectangle(
            (shelf_box[0], shelf_top + SLOT_HEIGHT + 6 + SHELF_BOARD_HEIGHT, shelf_box[2], shelf_top + SLOT_HEIGHT + 24 + SHELF_BOARD_HEIGHT),
            fill=_darken(shelf_color, 0.12),
        )

        shelf_overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        shelf_overlay_draw = ImageDraw.Draw(shelf_overlay)
        shelf_overlay_draw.rounded_rectangle(
            (shelf_box[0] + 4, shelf_box[1] + 4, shelf_box[2] - 4, shelf_box[1] + 58),
            radius=18,
            fill=(255, 255, 255, 18),
        )
        shelf_overlay_draw.rectangle(
            (shelf_box[0], shelf_top + SLOT_HEIGHT + 2, shelf_box[2], shelf_top + SLOT_HEIGHT + 14),
            fill=(255, 255, 255, 12),
        )
        shelf_overlay_draw.rectangle(
            (shelf_box[0], shelf_top + SLOT_HEIGHT + 22, shelf_box[2], shelf_top + SLOT_HEIGHT + 40),
            fill=(0, 0, 0, 12),
        )

        for _ in range(rng.randint(9, 14)):
            grain_y = rng.randint(shelf_top + SLOT_HEIGHT + 8, shelf_top + SLOT_HEIGHT + 22)
            start_x = shelf_box[0] + rng.randint(0, 60)
            end_x = shelf_box[2] - rng.randint(0, 60)
            grain_color = _alpha_fill(_darken(shelf_color, rng.uniform(0.08, 0.18)), rng.randint(18, 28))
            shelf_overlay_draw.line((start_x, grain_y, end_x, grain_y + rng.randint(-2, 2)), fill=grain_color, width=1)

        shelf_overlay = shelf_overlay.filter(ImageFilter.GaussianBlur(radius=1.2))
        canvas.alpha_composite(shelf_overlay)

        row_layout = _build_row_expected_layout(scene_catalog_ids, cols=COLS, rng=rng)

        for column_index in range(COLS):
            x1 = SHELF_MARGIN_X + column_index * (slot_width + SLOT_GAP)
            y1 = shelf_top
            x2 = x1 + slot_width
            y2 = y1 + SLOT_HEIGHT
            slot_box = (x1, y1, x2, y2)
            draw.rounded_rectangle(slot_box, radius=10, fill=slot_background)

            slot_overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
            slot_overlay_draw = ImageDraw.Draw(slot_overlay)
            slot_overlay_draw.rounded_rectangle(
                (x1 + 2, y1 + 2, x2 - 2, y1 + 42),
                radius=10,
                fill=(255, 255, 255, 16),
            )
            slot_overlay_draw.rounded_rectangle(
                (x1 + 1, y1 + 1, x2 - 1, y2 - 1),
                radius=10,
                outline=(255, 255, 255, 8),
                width=2,
            )
            slot_overlay_draw.line((x1 + 8, y2 - 36, x2 - 8, y2 - 36), fill=(0, 0, 0, 12), width=2)
            slot_overlay = slot_overlay.filter(ImageFilter.GaussianBlur(radius=0.8))
            canvas.alpha_composite(slot_overlay)

            price_tag_height = 22
            draw.rounded_rectangle(
                (x1 + 10, y2 - price_tag_height, x2 - 10, y2 - 4),
                radius=7,
                fill=(251, 251, 251),
                outline=_darken(slot_background, 0.22),
            )
            for mark_index in range(6):
                mark_x = x2 - 38 + mark_index * 4
                draw.line((mark_x, y2 - 21, mark_x, y2 - 10), fill=(168, 168, 168), width=1)
            price_font = _load_font(14, bold=True)
            draw.text(
                (x1 + 18, y2 - 14),
                f"${rng.uniform(2.39, 7.99):.2f}",
                fill=(72, 72, 72),
                anchor="lm",
                font=price_font,
            )

            expected_sku = row_layout[column_index]
            placement_roll = rng.random()
            actual_sku = expected_sku
            status = "present"

            if placement_roll < 0.18:
                actual_sku = None
                status = "empty"
                empty_boxes.append(slot_box)
            elif placement_roll < 0.26:
                alternatives = [sku_id for sku_id in scene_catalog_ids if sku_id != expected_sku]
                actual_sku = rng.choice(alternatives)
                status = "misplaced"

            if actual_sku:
                reference_image = Image.open(catalog_image_map[actual_sku]).convert("RGBA")
                _composite_product(canvas, slot_box, reference_image, rng)

            slot_id = f"{shelf_id}_slot_{column_index + 1}"
            planogram_slots.append(
                {
                    "slot_id": slot_id,
                    "shelf_id": shelf_id,
                    "bbox": _bbox_to_dict(slot_box),
                    "expected_sku": expected_sku,
                    "background_rgb": list(slot_background),
                }
            )
            metadata_slots.append(
                {
                    "slot_id": slot_id,
                    "expected_sku": expected_sku,
                    "actual_sku": actual_sku,
                    "status": status,
                }
            )

    if rng.random() < 0.45:
        canvas = canvas.filter(ImageFilter.GaussianBlur(radius=rng.uniform(0.0, 0.25)))

    output_image = _apply_camera_finish(canvas, rng)
    image_relative_path = Path(split) / "images" / f"{scene_id}.png"
    image_path = dataset_root / image_relative_path
    image_path.parent.mkdir(parents=True, exist_ok=True)
    output_image.save(image_path)

    label_relative_path = Path(split) / "labels" / f"{scene_id}.txt"
    _write_empty_space_labels(empty_slots=empty_boxes, output_path=dataset_root / label_relative_path)

    planogram = {
        "scene_id": scene_id,
        "split": split,
        "image_path": image_relative_path.as_posix(),
        "catalog_path": "catalog/sku_catalog.json",
        "scene_catalog": scene_catalog_ids,
        "image_size": {"width": CANVAS_WIDTH, "height": CANVAS_HEIGHT},
        "slots": planogram_slots,
    }
    planogram_path = dataset_root / "planograms" / f"{scene_id}.json"
    planogram_path.parent.mkdir(parents=True, exist_ok=True)
    planogram_path.write_text(json.dumps(planogram, indent=2), encoding="utf-8")

    metadata = {
        "scene_id": scene_id,
        "split": split,
        "image_path": image_relative_path.as_posix(),
        "planogram_path": Path("planograms") / f"{scene_id}.json",
        "summary": {
            "slot_count": len(metadata_slots),
            "empty_count": sum(1 for slot in metadata_slots if slot["status"] == "empty"),
            "misplaced_count": sum(1 for slot in metadata_slots if slot["status"] == "misplaced"),
        },
        "slots": metadata_slots,
    }
    metadata_path = dataset_root / "metadata" / f"{scene_id}.json"
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(
        json.dumps(
            {
                **metadata,
                "planogram_path": metadata["planogram_path"].as_posix(),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    return metadata


def _write_catalog(dataset_root: Path, skus: list[SKUDefinition]) -> dict[str, Path]:
    catalog_root = dataset_root / "catalog"
    image_root = catalog_root / "sku_images"
    image_root.mkdir(parents=True, exist_ok=True)

    catalog_entries: list[dict[str, Any]] = []
    image_map: dict[str, Path] = {}

    for sku in skus:
        relative_path = Path("catalog") / "sku_images" / f"{sku.sku_id}.png"
        output_path = dataset_root / relative_path
        render_sku_reference(sku, output_path)
        image_map[sku.sku_id] = output_path
        catalog_entries.append(
            {
                **asdict(sku),
                "display_name": f"{sku.brand} {sku.product_name} {sku.size_label}",
                "image_path": relative_path.as_posix(),
            }
        )

    catalog_payload = {
        "dataset_name": "synthetic_grocery_planograms",
        "sku_count": len(catalog_entries),
        "skus": catalog_entries,
    }
    (catalog_root / "sku_catalog.json").write_text(json.dumps(catalog_payload, indent=2), encoding="utf-8")
    return image_map


def _write_data_yaml(dataset_root: Path) -> None:
    data_yaml = "\n".join(
        [
            f"path: {dataset_root.resolve()}",
            "train: train/images",
            "val: valid/images",
            "test: test/images",
            "names:",
            "  0: empty_space",
            "",
        ]
    )
    (dataset_root / "data.yaml").write_text(data_yaml, encoding="utf-8")


def generate_dataset(
    output_root: str | Path,
    split_counts: dict[str, int] | None = None,
    seed: int = 7,
    clear_output: bool = False,
) -> Path:
    dataset_root = Path(output_root)
    if clear_output and dataset_root.exists():
        shutil.rmtree(dataset_root)
    dataset_root.mkdir(parents=True, exist_ok=True)

    split_counts = split_counts or DEFAULT_SPLIT_COUNTS
    rng = random.Random(seed)

    image_map = _write_catalog(dataset_root=dataset_root, skus=DEFAULT_SKUS)
    all_metadata: list[dict[str, Any]] = []

    for split, count in split_counts.items():
        for index in range(count):
            all_metadata.append(
                _render_scene(
                    split=split,
                    scene_index=index + 1,
                    dataset_root=dataset_root,
                    catalog=DEFAULT_SKUS,
                    catalog_image_map=image_map,
                    rng=rng,
                )
            )

    _write_data_yaml(dataset_root)

    manifest = {
        "dataset_root": str(dataset_root.resolve()),
        "seed": seed,
        "splits": split_counts,
        "scene_count": len(all_metadata),
        "example_scene_ids": [scene["scene_id"] for scene in all_metadata[:5]],
    }
    (dataset_root / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return dataset_root


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a synthetic grocery shelf dataset with planograms and empty-space labels."
    )
    parser.add_argument(
        "--output-root",
        default="space_detection/synthetic_dataset",
        help="Dataset destination folder.",
    )
    parser.add_argument("--train-count", type=int, default=DEFAULT_SPLIT_COUNTS["train"])
    parser.add_argument("--valid-count", type=int, default=DEFAULT_SPLIT_COUNTS["valid"])
    parser.add_argument("--test-count", type=int, default=DEFAULT_SPLIT_COUNTS["test"])
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument(
        "--clear-output",
        action="store_true",
        help="Delete the output folder before generating files.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_root = generate_dataset(
        output_root=args.output_root,
        split_counts={
            "train": args.train_count,
            "valid": args.valid_count,
            "test": args.test_count,
        },
        seed=args.seed,
        clear_output=args.clear_output,
    )
    print(f"Synthetic dataset created at: {output_root.resolve()}")
    print("Includes:")
    print("- catalog/sku_catalog.json with specific SKU identities")
    print("- planograms/*.json with expected slot assignments")
    print("- metadata/*.json with actual occupancy ground truth")
    print("- train/valid/test images and YOLO empty-space labels")


if __name__ == "__main__":
    main()
