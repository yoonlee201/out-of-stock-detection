from __future__ import annotations

import json
import re

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
PROMPT = (
    "You are a retail product expert. Identify the product brand, name, variant, and size. "
    "Return only a JSON with keys: brand, product_name, variant, size, confidence (0 to 1). "
    "If unidentifiable set confidence below 0.4."
)

_PROCESSOR = None
_MODEL = None


def _fallback_response() -> dict:
    return {
        "brand": "unknown",
        "product_name": "unknown",
        "variant": "unknown",
        "size": "unknown",
        "confidence": 0,
    }


def _model_load_kwargs() -> dict:
    if torch.cuda.is_available():
        return {
            "torch_dtype": torch.float16,
            "device_map": "auto",
        }

    return {
        "torch_dtype": torch.float32,
        "device_map": "cpu",
    }


def load_qwen_resources():
    global _PROCESSOR, _MODEL

    if QwenModelClass is None:
        raise ImportError(
            "This transformers version does not support Qwen2-VL. "
            "Please install a newer version, for example: pip install 'transformers>=4.45.0'"
        )

    if _PROCESSOR is None or _MODEL is None:
        _PROCESSOR = AutoProcessor.from_pretrained(MODEL_ID)
        _MODEL = QwenModelClass.from_pretrained(
            MODEL_ID,
            **_model_load_kwargs(),
        )

    return _PROCESSOR, _MODEL


def set_qwen_resources(processor, model) -> None:
    global _PROCESSOR, _MODEL
    _PROCESSOR = processor
    _MODEL = model


def identify_sku(crop: Image.Image) -> dict:
    processor, model = load_qwen_resources()
    image = crop.convert("RGB")
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": PROMPT},
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
        cleaned_text = response_text

        if cleaned_text.startswith("```"):
            cleaned_text = re.sub(r"^```(?:json)?\s*", "", cleaned_text)
            cleaned_text = re.sub(r"\s*```$", "", cleaned_text)

        json_match = re.search(r"\{.*\}", cleaned_text, re.DOTALL)
        if json_match:
            cleaned_text = json_match.group(0)

        parsed = json.loads(cleaned_text)
        return {
            "brand": parsed.get("brand", "unknown"),
            "product_name": parsed.get("product_name", "unknown"),
            "variant": parsed.get("variant", "unknown"),
            "size": parsed.get("size", "unknown"),
            "confidence": parsed.get("confidence", 0),
        }
    except Exception:
        return _fallback_response()
