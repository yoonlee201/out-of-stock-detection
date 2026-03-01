import ssl
ssl._create_default_https_context = ssl._create_unverified_context

import torch
from ultralytics import YOLO


def train() -> None:
    device = (
        "cuda" if torch.cuda.is_available()
        else "mps" if torch.backends.mps.is_available()
        else "cpu"
    )
    print(f"Training on: {device}")

    model = YOLO("yolov8n.pt")

    model.train(
        data="grocery.yaml",
        epochs=50,
        imgsz=640,
        batch=16,
        workers=0,
        device=device,
        project="runs/train",
        name="grocery_yolo",
        patience=10,
        optimizer="AdamW",
        lr0=0.001,
        augment=True,
    )

    print("Training complete!")
    print("Best weights at: runs/train/grocery_yolo/weights/best.pt")


if __name__ == "__main__":
    train()
