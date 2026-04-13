from __future__ import annotations

from pathlib import Path
import sys
from urllib.request import urlretrieve

from PIL import Image

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shelf_analyzer.infer import analyze_shelf_image
from shelf_analyzer.visualize import draw_annotations


SAMPLE_IMAGE_URL = "https://ultralytics.com/images/bus.jpg"
INPUT_PATH = Path("/tmp/test_shelf.jpg")
OUTPUT_PATH = Path("/tmp/test_output.jpg")


def main() -> None:
    INPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    urlretrieve(SAMPLE_IMAGE_URL, INPUT_PATH)

    detections = analyze_shelf_image(str(INPUT_PATH))
    print(f"Number of detections: {len(detections)}")

    image = Image.open(INPUT_PATH).convert("RGB")
    annotated = draw_annotations(image, detections)
    annotated.save(OUTPUT_PATH, format="JPEG", quality=95)
    print(f"Annotated image saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
