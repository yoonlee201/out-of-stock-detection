from __future__ import annotations

from pathlib import Path
from shutil import copy2

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = PROJECT_ROOT / "runs" / "detect"
TRAIN_NAME = "train"
BEST_WEIGHTS_SOURCE = RUNS_DIR / TRAIN_NAME / "weights" / "best.pt"
BEST_WEIGHTS_DEST = PROJECT_ROOT / "weights" / "best.pt"


def train_detector() -> Path:
    model = YOLO("yolo11n.pt")
    model.train(
        data="SKU-110K.yaml",
        epochs=50,
        imgsz=640,
        batch=16,
        project=str(RUNS_DIR),
        name=TRAIN_NAME,
        exist_ok=True,
    )

    if not BEST_WEIGHTS_SOURCE.exists():
        raise FileNotFoundError(f"Training finished, but no weights were found at {BEST_WEIGHTS_SOURCE}")

    BEST_WEIGHTS_DEST.parent.mkdir(parents=True, exist_ok=True)
    copy2(BEST_WEIGHTS_SOURCE, BEST_WEIGHTS_DEST)
    print(f"Best weights saved to: {BEST_WEIGHTS_DEST}")
    return BEST_WEIGHTS_DEST


if __name__ == "__main__":
    train_detector()
