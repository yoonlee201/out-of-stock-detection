from __future__ import annotations

import base64
import io
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont


DEFAULT_SYNTHETIC_DATASET_ROOT = Path(__file__).resolve().parent / "synthetic_dataset"


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


def _encode_image_to_data_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=92)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def _encode_png_path_to_data_url(image_path: Path) -> str:
    encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _normalize_path(path_value: str | Path, dataset_root: Path) -> Path:
    raw_path = Path(path_value)
    if raw_path.is_absolute():
        return raw_path
    return dataset_root / raw_path


def resolve_dataset_root(dataset_root: str | Path | None = None) -> Path:
    candidate = Path(dataset_root) if dataset_root else DEFAULT_SYNTHETIC_DATASET_ROOT
    return candidate.resolve()


def load_planogram_for_scene(scene_id: str, dataset_root: str | Path | None = None) -> dict[str, Any]:
    resolved_root = resolve_dataset_root(dataset_root)
    planogram_path = resolved_root / "planograms" / f"{scene_id}.json"
    if not planogram_path.exists():
        raise FileNotFoundError(f"Planogram not found for scene `{scene_id}` at {planogram_path}")
    return json.loads(planogram_path.read_text(encoding="utf-8"))


def load_scene_metadata(scene_id: str, dataset_root: str | Path | None = None) -> dict[str, Any]:
    resolved_root = resolve_dataset_root(dataset_root)
    metadata_path = resolved_root / "metadata" / f"{scene_id}.json"
    if not metadata_path.exists():
        raise FileNotFoundError(f"Scene metadata not found for scene `{scene_id}` at {metadata_path}")
    return json.loads(metadata_path.read_text(encoding="utf-8"))


def load_catalog(planogram: dict[str, Any], dataset_root: str | Path | None = None) -> dict[str, dict[str, Any]]:
    resolved_root = resolve_dataset_root(dataset_root)
    catalog_path = planogram.get("catalog_path")
    if not isinstance(catalog_path, str) or not catalog_path.strip():
        raise ValueError("Planogram is missing `catalog_path`.")

    catalog_file = _normalize_path(catalog_path, dataset_root=resolved_root)
    if not catalog_file.exists():
        raise FileNotFoundError(f"Catalog file not found at {catalog_file}")

    payload = json.loads(catalog_file.read_text(encoding="utf-8"))
    skus = payload.get("skus")
    if not isinstance(skus, list):
        raise ValueError("Catalog file is missing a `skus` array.")

    catalog: dict[str, dict[str, Any]] = {}
    for sku in skus:
        sku_id = sku.get("sku_id")
        if isinstance(sku_id, str) and sku_id:
            catalog[sku_id] = sku
    if not catalog:
        raise ValueError("Catalog file does not contain any usable SKU records.")
    return catalog


def _slot_bbox(slot: dict[str, Any]) -> tuple[int, int, int, int]:
    bbox = slot.get("bbox")
    if not isinstance(bbox, dict):
        raise ValueError(f"Slot {slot.get('slot_id', '<unknown>')} is missing bbox metadata.")

    keys = ("x1", "y1", "x2", "y2")
    if any(key not in bbox for key in keys):
        raise ValueError(f"Slot {slot.get('slot_id', '<unknown>')} has an invalid bbox payload.")

    return tuple(int(bbox[key]) for key in keys)


def _crop_slot(image: Image.Image, slot: dict[str, Any]) -> Image.Image:
    return image.crop(_slot_bbox(slot))


def _background_rgb(slot: dict[str, Any]) -> np.ndarray:
    value = slot.get("background_rgb")
    if not isinstance(value, list) or len(value) != 3:
        raise ValueError(f"Slot {slot.get('slot_id', '<unknown>')} is missing `background_rgb`.")
    return np.asarray(value, dtype=np.float32)


def _foreground_mask(array: np.ndarray, background_rgb: np.ndarray, threshold: float = 21.0) -> np.ndarray:
    diff = np.abs(array.astype(np.float32) - background_rgb.reshape(1, 1, 3)).mean(axis=2)
    return diff > threshold


def _slot_occupancy(slot_image: Image.Image, slot: dict[str, Any]) -> tuple[bool, float]:
    array = np.asarray(slot_image.convert("RGB"), dtype=np.float32)
    background_rgb = _background_rgb(slot)
    mask = _foreground_mask(array, background_rgb)
    foreground_ratio = float(mask.mean())
    edge_energy = float(
        (
            np.abs(np.diff(array, axis=0)).mean()
            + np.abs(np.diff(array, axis=1)).mean()
        )
        / 2
    )
    occupancy_score = min(1.0, foreground_ratio * 3.3 + edge_energy / 92.0)
    is_empty = foreground_ratio < 0.11 and edge_energy < 17.0
    return is_empty, round(occupancy_score, 4)


def _estimate_package_type(slot_image: Image.Image, slot: dict[str, Any]) -> str | None:
    array = np.asarray(slot_image.convert("RGB"), dtype=np.float32)
    background_rgb = _background_rgb(slot)
    mask = _foreground_mask(array, background_rgb)
    coords = np.argwhere(mask)
    if coords.size == 0:
        return None

    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0) + 1
    width = max(1, x_max - x_min)
    height = max(1, y_max - y_min)
    aspect_ratio = width / height

    if aspect_ratio < 0.48:
        return "bottle"
    return None


def _extract_feature(slot_image: Image.Image, slot: dict[str, Any]) -> np.ndarray:
    array = np.asarray(slot_image.convert("RGB"), dtype=np.float32)
    background_rgb = _background_rgb(slot)
    mask = _foreground_mask(array, background_rgb)

    foreground = array.copy()
    foreground[~mask] = 245
    resized = Image.fromarray(foreground.astype(np.uint8)).resize((48, 72), Image.Resampling.BILINEAR)
    resized_array = np.asarray(resized, dtype=np.float32)

    histogram_parts: list[np.ndarray] = []
    for channel in range(3):
        histogram, _ = np.histogram(resized_array[:, :, channel], bins=12, range=(0, 255), density=True)
        histogram_parts.append(histogram.astype(np.float32))

    feature = np.concatenate([resized_array.reshape(-1) / 255.0, np.concatenate(histogram_parts) * 2.0])
    feature -= feature.mean()
    norm = np.linalg.norm(feature)
    if norm == 0:
        return feature
    return feature / norm


def _render_reference_slot(slot: dict[str, Any], sku_record: dict[str, Any], dataset_root: Path) -> Image.Image:
    x1, y1, x2, y2 = _slot_bbox(slot)
    slot_width = max(1, x2 - x1)
    slot_height = max(1, y2 - y1)
    background_rgb = tuple(int(value) for value in _background_rgb(slot).tolist())
    canvas = Image.new("RGB", (slot_width, slot_height), background_rgb)

    image_path = sku_record.get("image_path")
    if not isinstance(image_path, str) or not image_path:
        raise ValueError(f"SKU {sku_record.get('sku_id', '<unknown>')} is missing image_path.")

    reference = Image.open(_normalize_path(image_path, dataset_root=dataset_root)).convert("RGBA")
    package_type = str(sku_record.get("package_type", "box"))
    scale = 0.76 if package_type == "bottle" else 0.86

    target_width = max(28, int(slot_width * scale))
    target_height = max(40, int(slot_height * scale))
    fitted = reference.copy()
    fitted.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)

    paste_x = (slot_width - fitted.width) // 2
    paste_y = slot_height - fitted.height
    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba.alpha_composite(fitted, (paste_x, paste_y))
    return canvas_rgba.convert("RGB")


def _match_slot_to_catalog(
    slot_image: Image.Image,
    slot: dict[str, Any],
    catalog: dict[str, dict[str, Any]],
    dataset_root: Path,
) -> tuple[str | None, float, list[dict[str, Any]], dict[str, float]]:
    slot_feature = _extract_feature(slot_image, slot=slot)
    if float(np.linalg.norm(slot_feature)) == 0.0:
        return None, 0.0, [], {}

    scores: list[tuple[str, float]] = []
    for sku_id, sku_record in catalog.items():
        reference_slot = _render_reference_slot(slot=slot, sku_record=sku_record, dataset_root=dataset_root)
        reference_feature = _extract_feature(reference_slot, slot=slot)
        score = float(np.dot(slot_feature, reference_feature))
        scores.append((sku_id, score))

    scores.sort(key=lambda item: item[1], reverse=True)
    normalized_scores = {
        sku_id: round((score + 1.0) / 2.0, 4)
        for sku_id, score in scores
    }
    top_matches = [
        {
            "sku_id": sku_id,
            "display_name": catalog[sku_id].get("display_name", sku_id),
            "score": normalized_scores[sku_id],
        }
        for sku_id, score in scores[:3]
    ]
    best_sku, best_score = scores[0]
    return best_sku, normalized_scores[best_sku], top_matches, normalized_scores


def _slot_code(slot_id: str | None) -> str:
    if not slot_id:
        return "?"
    match = re.search(r"shelf_(\d+)_slot_(\d+)", slot_id)
    if not match:
        return slot_id
    shelf_number, slot_number = match.groups()
    return f"{shelf_number}-{slot_number}"


def _status_badge(status: str) -> str:
    labels = {
        "present": "Matched",
        "empty": "Empty",
        "unexpected_sku": "Wrong SKU",
    }
    return labels.get(status, "Wrong SKU")


def _classify_slot_status(
    expected_sku: str,
    detected_sku: str | None,
    confidence: float,
    top_matches: list[dict[str, Any]],
    score_by_sku: dict[str, float],
) -> tuple[str, float, float]:
    if not detected_sku:
        return "unexpected_sku", 0.0, 0.0

    expected_score = score_by_sku.get(expected_sku, 0.0)
    second_score = top_matches[1]["score"] if len(top_matches) > 1 else 0.0
    match_margin = round(max(0.0, confidence - second_score), 4)

    if detected_sku == expected_sku:
        return "present", expected_score, match_margin

    return "unexpected_sku", expected_score, match_margin


def _annotate_analysis(image: Image.Image, slots: list[dict[str, Any]]) -> Image.Image:
    annotated = image.convert("RGB").copy()
    draw = ImageDraw.Draw(annotated)
    slot_font = _load_font(14, bold=True)
    issue_font = _load_font(13, bold=True)
    color_map = {
        "present": (36, 127, 62),
        "empty": (196, 54, 54),
        "unexpected_sku": (202, 120, 24),
    }

    for slot in slots:
        x1, y1, x2, y2 = _slot_bbox(slot)
        status = str(slot.get("status", "unexpected_sku"))
        color = color_map.get(status, color_map["unexpected_sku"])
        draw.rounded_rectangle((x1, y1, x2, y2), radius=8, outline=color, width=4)
        slot_text = f"Slot {_slot_code(slot.get('slot_id'))}"
        slot_box = draw.textbbox((0, 0), slot_text, font=slot_font)
        slot_width = slot_box[2] - slot_box[0]
        slot_height = slot_box[3] - slot_box[1]
        slot_badge = (x1 + 8, y1 + 8, x1 + slot_width + 18, y1 + slot_height + 14)
        draw.rounded_rectangle(slot_badge, radius=7, fill=(28, 28, 28))
        draw.text((slot_badge[0] + 5, slot_badge[1] + 2), slot_text, fill="white", font=slot_font)

        if status != "present":
            issue_text = _status_badge(status)
            issue_box = draw.textbbox((0, 0), issue_text, font=issue_font)
            issue_width = issue_box[2] - issue_box[0]
            issue_height = issue_box[3] - issue_box[1]
            issue_badge = (
                x2 - issue_width - 18,
                y1 + 8,
                x2 - 8,
                y1 + issue_height + 14,
            )
            draw.rounded_rectangle(issue_badge, radius=7, fill=color)
            draw.text((issue_badge[0] + 5, issue_badge[1] + 2), issue_text, fill="white", font=issue_font)

    return annotated


def analyze_shelf_image(
    image: Image.Image,
    planogram: dict[str, Any],
    dataset_root: str | Path | None = None,
) -> dict[str, Any]:
    resolved_root = resolve_dataset_root(dataset_root)
    catalog = load_catalog(planogram=planogram, dataset_root=resolved_root)
    candidate_ids = planogram.get("scene_catalog")
    if isinstance(candidate_ids, list):
        filtered_catalog = {
            sku_id: catalog[sku_id]
            for sku_id in candidate_ids
            if isinstance(sku_id, str) and sku_id in catalog
        }
        if filtered_catalog:
            catalog = filtered_catalog
    slots = planogram.get("slots")
    if not isinstance(slots, list) or not slots:
        raise ValueError("Planogram does not contain any slots to analyze.")

    rgb_image = image.convert("RGB")
    slot_results: list[dict[str, Any]] = []
    missing_items: list[dict[str, Any]] = []
    detected_counter: Counter[str] = Counter()

    for slot in slots:
        if not isinstance(slot, dict):
            continue

        slot_image = _crop_slot(rgb_image, slot)
        observed_slot_image = _encode_image_to_data_url(slot_image)
        is_empty, occupancy_score = _slot_occupancy(slot_image, slot=slot)
        expected_sku = str(slot.get("expected_sku", ""))
        expected_record = catalog.get(expected_sku, {})
        detected_sku: str | None = None
        confidence = 0.0
        top_matches: list[dict[str, Any]] = []
        score_by_sku: dict[str, float] = {}
        expected_match_score = 0.0
        match_margin = 0.0

        if is_empty:
            status = "empty"
        else:
            candidate_catalog = catalog
            estimated_package_type = _estimate_package_type(slot_image, slot=slot)
            if estimated_package_type:
                filtered_candidates = {
                    sku_id: sku_record
                    for sku_id, sku_record in catalog.items()
                    if sku_record.get("package_type") == estimated_package_type
                }
                if filtered_candidates:
                    candidate_catalog = filtered_candidates

            detected_sku, confidence, top_matches, score_by_sku = _match_slot_to_catalog(
                slot_image=slot_image,
                slot=slot,
                catalog=candidate_catalog,
                dataset_root=resolved_root,
            )
            status, expected_match_score, match_margin = _classify_slot_status(
                expected_sku=expected_sku,
                detected_sku=detected_sku,
                confidence=confidence,
                top_matches=top_matches,
                score_by_sku=score_by_sku,
            )
            if detected_sku and status in {"present", "unexpected_sku"}:
                detected_counter[detected_sku] += 1

        slot_result = {
            "slot_id": slot.get("slot_id"),
            "shelf_id": slot.get("shelf_id"),
            "bbox": slot.get("bbox"),
            "expected_sku": expected_sku,
            "expected_display_name": expected_record.get("display_name", expected_sku),
            "expected_reference_image": _encode_png_path_to_data_url(
                _normalize_path(expected_record["image_path"], dataset_root=resolved_root)
            )
            if isinstance(expected_record.get("image_path"), str) and expected_record.get("image_path")
            else "",
            "detected_sku": detected_sku,
            "detected_display_name": catalog.get(detected_sku, {}).get("display_name", detected_sku) if detected_sku else None,
            "status": status,
            "confidence": round(confidence, 4),
            "expected_match_score": round(expected_match_score, 4),
            "match_margin": round(match_margin, 4),
            "occupancy_score": occupancy_score,
            "observed_slot_image": observed_slot_image,
            "top_matches": top_matches,
        }
        slot_results.append(slot_result)

        if status in {"empty", "unexpected_sku"}:
            image_path = expected_record.get("image_path")
            reference_image = ""
            if isinstance(image_path, str) and image_path:
                reference_image = _encode_png_path_to_data_url(_normalize_path(image_path, dataset_root=resolved_root))

            missing_items.append(
                {
                    "slot_id": slot.get("slot_id"),
                    "expected_sku": expected_sku,
                    "expected_display_name": expected_record.get("display_name", expected_sku),
                    "observed_sku": detected_sku,
                    "observed_display_name": catalog.get(detected_sku, {}).get("display_name", detected_sku) if detected_sku else None,
                    "reason": "empty_slot" if status == "empty" else "wrong_sku_in_slot",
                    "reference_image": reference_image,
                    "observed_slot_image": observed_slot_image,
                }
            )

    summary = {
        "slot_count": len(slot_results),
        "correct_sku_count": sum(1 for slot in slot_results if slot["status"] == "present"),
        "empty_slot_count": sum(1 for slot in slot_results if slot["status"] == "empty"),
        "missing_sku_count": len(missing_items),
        "unexpected_sku_count": sum(1 for slot in slot_results if slot["status"] == "unexpected_sku"),
        "uncertain_slot_count": 0,
    }

    detected_skus = [
        {
            "sku_id": sku_id,
            "display_name": catalog.get(sku_id, {}).get("display_name", sku_id),
            "count": count,
        }
        for sku_id, count in detected_counter.most_common()
    ]

    annotated_image = _annotate_analysis(rgb_image, slots=slot_results)
    return {
        "planogram_id": planogram.get("scene_id"),
        "image": {"width": rgb_image.width, "height": rgb_image.height},
        "summary": summary,
        "detected_skus": detected_skus,
        "missing_items": missing_items,
        "slots": slot_results,
        "annotated_image": _encode_image_to_data_url(annotated_image),
        "notes": (
            "This analysis is deterministic and calibrated to the synthetic dataset format. "
            "It identifies exact SKU IDs per slot instead of broad categories."
        ),
    }
