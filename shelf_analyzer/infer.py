from __future__ import annotations

import os
from pathlib import Path
import sys
from typing import Any

from PIL import Image
import torch
from ultralytics import YOLO

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shelf_analyzer.gap_detector import detect_empty_spaces
from shelf_analyzer.image_preprocessor import preprocess_shelf_image
from shelf_analyzer.planogram_selector import auto_select_planogram
from shelf_analyzer.planogram_matcher import audit_planogram
from shelf_analyzer.sku_identifier import identify_sku


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "weights" / "best.pt"
_YOLO_MODEL = None
MAX_SKU_IDENTIFICATIONS_CPU = 6
MAX_SKU_IDENTIFICATIONS_GPU = 16
MIN_CROP_WIDTH = 24
MIN_CROP_HEIGHT = 24
SKU_IDENTIFICATION_CHUNK_SIZE_CPU = 4
SKU_IDENTIFICATION_CHUNK_SIZE_GPU = 8


def _unknown_sku() -> dict[str, Any]:
    return {
        "brand": "unknown",
        "product_name": "unknown",
        "variant": "unknown",
        "size": "unknown",
        "confidence": 0,
        "visibility": "partial",
    }


def load_yolo_model():
    global _YOLO_MODEL

    if _YOLO_MODEL is None:
        _YOLO_MODEL = YOLO(MODEL_PATH)

    return _YOLO_MODEL


def set_yolo_model(model) -> None:
    global _YOLO_MODEL
    _YOLO_MODEL = model


def _env_int(name: str) -> tuple[bool, int | None]:
    raw_value = os.getenv(name)
    if raw_value is None:
        return False, None

    value = raw_value.strip().lower()
    if value in {"all", "none", "unlimited", "0", "-1"}:
        return True, None

    try:
        parsed = int(value)
    except ValueError:
        return False, None

    return True, None if parsed <= 0 else parsed


def _max_sku_identifications() -> int:
    has_override, override = _env_int("MAX_SKU_IDENTIFICATIONS")
    if has_override:
        return override

    return MAX_SKU_IDENTIFICATIONS_GPU if torch.cuda.is_available() else MAX_SKU_IDENTIFICATIONS_CPU


def _sku_identification_chunk_size() -> int:
    has_override, override = _env_int("SKU_IDENTIFICATION_CHUNK_SIZE")
    if has_override and override is not None:
        return max(1, override)

    return SKU_IDENTIFICATION_CHUNK_SIZE_GPU if torch.cuda.is_available() else SKU_IDENTIFICATION_CHUNK_SIZE_CPU


def _build_outputs(
    product_candidates: list[dict[str, Any]],
    sku_results: dict[int, dict[str, Any]],
) -> list[dict[str, Any]]:
    return [
        {
            "bbox": candidate["bbox"],
            "type": "product",
            "sku": sku_results[index],
        }
        for index, candidate in enumerate(product_candidates)
    ]


def _collect_planogram_signals(outputs: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    detected_keywords: list[str] = []
    detected_brands: list[str] = []

    for output in outputs:
        sku = output.get("sku") or {}
        if sku.get("brand") and sku.get("brand") != "unknown":
            detected_brands.append(str(sku["brand"]))
        if sku.get("product_name") and sku.get("product_name") != "unknown":
            detected_keywords.append(str(sku["product_name"]))
        if sku.get("variant") and sku.get("variant") != "unknown":
            detected_keywords.append(str(sku["variant"]))

    return detected_keywords, detected_brands


def _run_planogram_audit(
    *,
    processed_image_path: str,
    image_size: tuple[int, int],
    empty_spaces: list[dict[str, Any]] | list[list[int]],
    outputs: list[dict[str, Any]],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    detected_keywords, detected_brands = _collect_planogram_signals(outputs)
    selected = auto_select_planogram(
        detected_keywords=detected_keywords,
        detected_brands=detected_brands,
    )
    audit_results = audit_planogram(
        image_path=processed_image_path,
        image_size=image_size,
        planogram=selected["planogram"],
        product_detections=outputs,
        empty_gap_boxes=empty_spaces,
    )
    return selected, audit_results


def analyze_shelf_debug(image_path: str) -> dict[str, Any]:
    processed_image_path = preprocess_shelf_image(image_path)
    model = load_yolo_model()
    image = Image.open(processed_image_path).convert("RGB")
    image_width, image_height = image.size
    results = model(processed_image_path, conf=0.25)

    product_boxes: list[list[int]] = []
    product_candidates: list[dict[str, Any]] = []

    if results:
        for result in results:
            if result.boxes is None:
                continue

            raw_boxes = result.boxes.xyxy.tolist()
            raw_scores = result.boxes.conf.tolist() if result.boxes.conf is not None else [1.0] * len(raw_boxes)

            for raw_box, raw_score in zip(raw_boxes, raw_scores):
                x1, y1, x2, y2 = [int(round(value)) for value in raw_box]
                x1 = max(0, min(x1, image_width))
                y1 = max(0, min(y1, image_height))
                x2 = max(0, min(x2, image_width))
                y2 = max(0, min(y2, image_height))

                if x2 <= x1 or y2 <= y1:
                    continue

                bbox = [x1, y1, x2, y2]
                product_boxes.append(bbox)
                product_candidates.append(
                    {
                        "bbox": bbox,
                        "confidence": float(raw_score),
                        "area": (x2 - x1) * (y2 - y1),
                        "should_identify": (x2 - x1) >= MIN_CROP_WIDTH and (y2 - y1) >= MIN_CROP_HEIGHT,
                    }
                )

    empty_spaces = detect_empty_spaces(
        product_boxes,
        (image_height, image_width),
        image_path=processed_image_path,
    )

    ranked_indices = sorted(
        [
            index
            for index, candidate in enumerate(product_candidates)
            if candidate["should_identify"]
        ],
        key=lambda index: (
            product_candidates[index]["confidence"],
            product_candidates[index]["area"],
        ),
        reverse=True,
    )
    max_identifications = _max_sku_identifications()
    identified_indices = (
        set(ranked_indices)
        if max_identifications is None
        else set(ranked_indices[:max_identifications])
    )

    sku_results: dict[int, dict[str, Any]] = {index: _unknown_sku() for index in range(len(product_candidates))}
    indices_to_identify = sorted(identified_indices)
    chunk_size = _sku_identification_chunk_size()

    if indices_to_identify:
        total_to_identify = len(indices_to_identify)
        for chunk_start in range(0, total_to_identify, chunk_size):
            chunk = indices_to_identify[chunk_start : chunk_start + chunk_size]
            print(
                f"Identifying SKUs for detections {chunk_start + 1}-"
                f"{chunk_start + len(chunk)} of {total_to_identify}..."
            )
            for index in chunk:
                x1, y1, x2, y2 = product_candidates[index]["bbox"]
                crop = image.crop((x1, y1, x2, y2))
                sku_results[index] = identify_sku(crop)

    outputs = _build_outputs(product_candidates, sku_results)
    selected, audit_results = _run_planogram_audit(
        processed_image_path=processed_image_path,
        image_size=(image_width, image_height),
        empty_spaces=empty_spaces,
        outputs=outputs,
    )

    bbox_to_index = {tuple(candidate["bbox"]): index for index, candidate in enumerate(product_candidates)}
    retry_indices: set[int] = set()
    for detection in audit_results:
        if detection.get("type") != "product":
            continue
        if detection.get("detection_quality") != "merged_box":
            continue

        sku = detection.get("sku") or {}
        try:
            confidence = float(sku.get("confidence", 0))
        except (TypeError, ValueError):
            confidence = 0.0

        if confidence >= 0.3:
            continue

        bbox = detection.get("bbox")
        if not bbox:
            continue

        index = bbox_to_index.get(tuple(bbox))
        if index is not None:
            retry_indices.add(index)

    if not retry_indices:
        return {
            "processed_image_path": processed_image_path,
            "raw_detections": outputs,
            "raw_empty_spaces": empty_spaces,
            "selected_planogram": selected,
            "audit_results": audit_results,
        }

    for index in sorted(retry_indices):
        x1, y1, x2, y2 = product_candidates[index]["bbox"]
        crop = image.crop((x1, y1, x2, y2))
        sku_results[index] = identify_sku(crop, merged_box=True)

    outputs = _build_outputs(product_candidates, sku_results)
    selected, audit_results = _run_planogram_audit(
        processed_image_path=processed_image_path,
        image_size=(image_width, image_height),
        empty_spaces=empty_spaces,
        outputs=outputs,
    )
    return {
        "processed_image_path": processed_image_path,
        "raw_detections": outputs,
        "raw_empty_spaces": empty_spaces,
        "selected_planogram": selected,
        "audit_results": audit_results,
    }


def analyze_shelf_image(image_path: str) -> list[dict[str, Any]]:
    return analyze_shelf_debug(image_path)["audit_results"]


def analyze_shelf_auto(image_path: str) -> list[dict[str, Any]]:
    return analyze_shelf_image(image_path)
