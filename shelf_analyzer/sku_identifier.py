from __future__ import annotations

import json
import os
import re
import threading

import torch
from PIL import Image
from transformers import AutoProcessor

try:
    from transformers import Qwen2VLForConditionalGeneration as QwenModelClass
except ImportError:
    try:
        from transformers import AutoModelForImageTextToText as QwenModelClass
    except ImportError:
        QwenModelClass = None


MODEL_ID = "Qwen/Qwen2-VL-2B-Instruct"
BASE_PROMPT = (
    "You are a retail shelf auditor. This is a cropped image of a cereal box from a grocery store shelf. "
    "The box may be partially visible, angled, or partially occluded by neighboring boxes.\n"
    "Identify the product as best you can from visible text, colors, and logos.\n"
    "Return ONLY a JSON with keys:\n"
    "- brand (str): e.g. General Mills, Kellogg's, Quaker, Great Value\n"
    "- product_name (str): e.g. Chex, Cheerios, Rice Krispies, Life, Cap'n Crunch\n"
    "- variant (str): e.g. Honey Nut, Cinnamon, Oat Crunch, Original, Maple\n"
    "- size (str): e.g. Family Size, Giant Size, Regular\n"
    "- confidence (float 0-1): how certain you are\n"
    "- visibility (str): full | partial | side_only\n"
    "If the crop is too small or unclear to identify, return confidence below 0.3."
)

_PROCESSOR = None
_MODEL = None
_LOAD_LOCK = threading.Lock()


def _fallback_response() -> dict:
    return {
        "brand": "unknown",
        "product_name": "unknown",
        "variant": "unknown",
        "size": "unknown",
        "confidence": 0,
        "visibility": "partial",
    }


def _model_load_kwargs() -> dict:
    if torch.cuda.is_available():
        return {
            "torch_dtype": torch.float16,
            "device_map": "cuda",
        }

    return {
        "torch_dtype": torch.bfloat16,
        "device_map": "cpu",
    }


def load_qwen_resources():
    global _PROCESSOR, _MODEL

    if _PROCESSOR is not None and _MODEL is not None:
        return _PROCESSOR, _MODEL

    if QwenModelClass is None:
        raise ImportError(
            "This transformers version does not support Qwen2-VL. "
            "Please install a newer version, for example: pip install 'transformers>=4.45.0'"
        )

    with _LOAD_LOCK:
        if _PROCESSOR is None or _MODEL is None:
            os.environ.setdefault("HF_HUB_ETAG_TIMEOUT", "60")
            os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "120")

            _PROCESSOR = AutoProcessor.from_pretrained(MODEL_ID, use_fast=True)
            _MODEL = QwenModelClass.from_pretrained(
                MODEL_ID,
                **_model_load_kwargs(),
            )

    return _PROCESSOR, _MODEL


def set_qwen_resources(processor, model) -> None:
    global _PROCESSOR, _MODEL
    _PROCESSOR = processor
    _MODEL = model


def _build_prompt(crop: Image.Image) -> str:
    width, height = crop.size
    prompt_lines = [BASE_PROMPT]
    if height > 0 and width < 0.4 * height:
        prompt_lines.append("Note: this may be a partial/side view of a box.")
    return "\n".join(prompt_lines)


def _parse_response(response_text: str) -> dict:
    cleaned_text = response_text

    if cleaned_text.startswith("```"):
        cleaned_text = re.sub(r"^```(?:json)?\s*", "", cleaned_text)
        cleaned_text = re.sub(r"\s*```$", "", cleaned_text)

    json_match = re.search(r"\{.*\}", cleaned_text, re.DOTALL)
    if json_match:
        cleaned_text = json_match.group(0)

    parsed = json.loads(cleaned_text)
    visibility = str(parsed.get("visibility", "partial")).strip().lower()
    if visibility not in {"full", "partial", "side_only"}:
        visibility = "partial"

    try:
        confidence = float(parsed.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0.0

    return {
        "brand": parsed.get("brand", "unknown"),
        "product_name": parsed.get("product_name", "unknown"),
        "variant": parsed.get("variant", "unknown"),
        "size": parsed.get("size", "unknown"),
        "confidence": confidence,
        "visibility": visibility,
    }


def _run_identification(image: Image.Image) -> dict:
    processor, model = load_qwen_resources()
    image = image.convert("RGB")
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": _build_prompt(image)},
            ],
        }
    ]

    inputs = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
    )
    inputs = inputs.to(model.device)

    with torch.no_grad():
        generated_ids = model.generate(**inputs, max_new_tokens=128)

    input_length = inputs.input_ids.shape[1]
    response_text = processor.batch_decode(
        generated_ids[:, input_length:],
        skip_special_tokens=True,
    )[0].strip()

    try:
        return _parse_response(response_text)
    except Exception:
        return _fallback_response()


def _split_merged_crop(crop: Image.Image) -> list[Image.Image]:
    width, height = crop.size
    if width < 2:
        return [crop]

    mid_x = max(1, width // 2)
    left_half = crop.crop((0, 0, mid_x, height))
    right_half = crop.crop((mid_x, 0, width, height))
    return [left_half, right_half]


def identify_sku(crop: Image.Image, merged_box: bool = False) -> dict:
    primary_result = _run_identification(crop)
    if not merged_box:
        return primary_result

    try:
        confidence = float(primary_result.get("confidence", 0))
    except (TypeError, ValueError):
        confidence = 0.0

    if confidence >= 0.3:
        return primary_result

    retry_results = [_run_identification(split_crop) for split_crop in _split_merged_crop(crop)]
    if not retry_results:
        return primary_result

    best_retry = max(
        retry_results,
        key=lambda result: float(result.get("confidence", 0) or 0),
    )
    return best_retry if float(best_retry.get("confidence", 0) or 0) > confidence else primary_result
