import ssl
ssl._create_default_https_context = ssl._create_unverified_context

import io
import os
import base64
import torch
from PIL import Image, ImageDraw
from pathlib import Path
from ultralytics import YOLO

IS_DOCKER = os.path.exists("/.dockerenv")
# DEVICE = (
#     "cuda" if torch.cuda.is_available()
#     else "mps" if torch.backends.mps.is_available()
#     else "cpu"
# )
DEVICE = "cpu"

TRAINED_WEIGHTS = "runs/train/grocery_yolo/weights/best.pt"
MODEL_PATH = TRAINED_WEIGHTS if Path(TRAINED_WEIGHTS).exists() else "yolov8n.pt"
print(f"Loading YOLO from: {MODEL_PATH}")

model = YOLO(MODEL_PATH)

BOX_COLORS = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
]


def draw_boxes(pil_image: Image.Image, detections: list) -> str:
    draw = ImageDraw.Draw(pil_image)

    for det in detections:
        x1, y1, x2, y2 = det["box"]
        label = det["product"]
        conf = det["confidence"]
        color = BOX_COLORS[hash(label) % len(BOX_COLORS)]

        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)

        text = f"{label} {conf:.0%}"
        text_bbox = draw.textbbox((x1, y1), text)
        draw.rectangle(
            [text_bbox[0] - 2, text_bbox[1] - 2, text_bbox[2] + 2, text_bbox[3] + 2],
            fill=color,
        )
        draw.text((x1, y1), text, fill="white")

    buffer = io.BytesIO()
    pil_image.save(buffer, format="JPEG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def detect(image_input, conf_threshold: float = 0.25) -> dict:
    if isinstance(image_input, str):
        pil_image = Image.open(image_input).convert("RGB")
    else:
        pil_image = image_input.convert("RGB")

    results = model(pil_image, conf=conf_threshold, device=DEVICE)[0]

    detections = []

    for box in results.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        class_id = int(box.cls[0].item())
        confidence = round(float(box.conf[0].item()), 3)
        label = model.names[class_id]

        detections.append({
            "box":        [x1, y1, x2, y2],
            "product":    label,
            "confidence": confidence,
        })

    annotated_image = draw_boxes(pil_image, detections)

    return {
        "detections": detections,
        "annotated_image": annotated_image,
        "count": len(detections),
    }


if __name__ == "__main__":
    import sys
    img = sys.argv[1] if len(sys.argv) > 1 else "test_image.jpg"
    result = detect(img)
    print(f"Found {result['count']} products:")
    for detection in result["detections"]:
        print(f"  {detection['product']} ({detection['confidence']:.0%}) at {detection['box']}")

    with open("output.jpg", "wb") as file:
        file.write(base64.b64decode(result["annotated_image"]))
    print("Annotated image saved to output.jpg")