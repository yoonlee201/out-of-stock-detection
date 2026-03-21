from __future__ import annotations

import glob
import hashlib
import random
import shutil
from pathlib import Path

import matplotlib.patches as patches
import matplotlib.pyplot as plt
import torch
from PIL import Image
from ultralytics import YOLO


def check_cuda() -> None:
    """Print available CUDA device details."""
    is_available = torch.cuda.is_available()
    print(f"CUDA available: {is_available}")
    if is_available:
        print(f"CUDA device: {torch.cuda.get_device_name(0)}")


def show_samples(
    combined_root: str | Path,
    split: str = "train",
    n: int = 8,
    output_path: str | Path | None = None,
) -> None:
    """Render sample images with annotation boxes."""
    if n <= 0:
        return

    combined_root = Path(combined_root)
    img_dir = combined_root / split / "images"
    lbl_dir = combined_root / split / "labels"

    image_paths = sorted(img_dir.glob("*.*"))
    if not image_paths:
        print(f"No images found in {img_dir}")
        return

    sample_count = min(n, len(image_paths))
    samples = random.sample(image_paths, sample_count)

    cols = 4
    rows = (sample_count + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(20, 5 * rows))
    axes = axes.flatten() if hasattr(axes, "flatten") else [axes]

    for i, img_path in enumerate(samples):
        image = Image.open(img_path)
        axes[i].imshow(image)

        label_path = lbl_dir / f"{img_path.stem}.txt"
        if label_path.exists():
            width, height = image.size
            for line in label_path.read_text(encoding="utf-8").splitlines():
                parts = line.strip().split()
                if len(parts) >= 5:
                    cx, cy, bw, bh = map(float, parts[1:5])
                    x1 = (cx - bw / 2) * width
                    y1 = (cy - bh / 2) * height
                    rect = patches.Rectangle(
                        (x1, y1),
                        bw * width,
                        bh * height,
                        linewidth=2,
                        edgecolor="red",
                        facecolor="none",
                    )
                    axes[i].add_patch(rect)

        axes[i].set_title(img_path.name[:20], fontsize=10)
        axes[i].axis("off")

    for j in range(sample_count, len(axes)):
        axes[j].axis("off")

    plt.suptitle(
        f"Sample {split} images with bounding boxes (red = empty_space)", fontsize=14
    )
    plt.tight_layout()

    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(output_path, bbox_inches="tight", dpi=160)
        print(f"Saved sample plot to {output_path}")
    else:
        plt.show()

    plt.close(fig)


def train_two_phase(
    data_yaml_path: str | Path,
    runs_root: str | Path = "runs",
    base_model: str = "yolov8m.pt",
    phase1_name: str = "emptyspace_p1_freeze10",
    phase2_name: str = "emptyspace_p2_finetune",
    phase1_epochs: int = 40,
    phase2_epochs: int = 30,
    imgsz: int = 640,
    batch: int = 16,
    workers: int = 1,
) -> Path:
    """Train using a two-phase strategy."""
    data_yaml_path = Path(data_yaml_path)
    runs_root = Path(runs_root)
    runs_root.mkdir(parents=True, exist_ok=True)

    model = YOLO(base_model)
    model.train(
        data=str(data_yaml_path.resolve()),
        epochs=phase1_epochs,
        imgsz=imgsz,
        batch=batch,
        workers=workers,
        freeze=10,
        augment=True,
        mosaic=1.0,
        mixup=0.2,
        name=phase1_name,
        project=str(runs_root.resolve()),
    )

    phase1_best = runs_root / phase1_name / "weights" / "best.pt"
    if not phase1_best.exists():
        raise FileNotFoundError(f"Phase 1 best weights not found: {phase1_best}")

    model2 = YOLO(str(phase1_best))
    model2.train(
        data=str(data_yaml_path.resolve()),
        epochs=phase2_epochs,
        imgsz=imgsz,
        batch=batch,
        workers=workers,
        freeze=0,
        lr0=0.001,
        augment=False,
        mosaic=0.0,
        name=phase2_name,
        project=str(runs_root.resolve()),
    )

    phase2_best = runs_root / phase2_name / "weights" / "best.pt"
    if not phase2_best.exists():
        raise FileNotFoundError(f"Phase 2 best weights not found: {phase2_best}")

    return phase2_best


def visualize_predictions(
    model_path: str | Path,
    image_glob: str,
    n: int = 8,
    conf: float = 0.25,
    output_path: str | Path | None = None,
) -> None:
    """Plot predictions over random images."""
    image_paths = glob.glob(image_glob)
    if not image_paths:
        print(f"No images matched pattern: {image_glob}")
        return

    sample_count = min(n, len(image_paths))
    samples = random.sample(image_paths, sample_count)

    model = YOLO(str(model_path))
    cols = 4
    rows = (sample_count + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(20, 5 * rows))
    axes = axes.flatten() if hasattr(axes, "flatten") else [axes]

    for i, img_path in enumerate(samples):
        result = model(img_path, conf=conf)[0]
        image = Image.open(img_path)
        axes[i].imshow(image)

        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
            box_conf = float(box.conf[0].cpu().numpy())
            rect = plt.Rectangle(
                (x1, y1),
                x2 - x1,
                y2 - y1,
                linewidth=2,
                edgecolor="lime",
                facecolor="none",
            )
            axes[i].add_patch(rect)
            axes[i].text(
                x1,
                max(0, y1 - 5),
                f"{box_conf:.2f}",
                color="lime",
                fontsize=10,
                bbox={"boxstyle": "round,pad=0.2", "facecolor": "black", "alpha": 0.7},
            )

        axes[i].set_title(f"{len(result.boxes)} detections", fontsize=10)
        axes[i].axis("off")

    for j in range(sample_count, len(axes)):
        axes[j].axis("off")

    plt.suptitle("Model Predictions (green = predicted empty_space)", fontsize=14)
    plt.tight_layout()

    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        plt.savefig(output_path, bbox_inches="tight", dpi=160)
        print(f"Saved prediction plot to {output_path}")
    else:
        plt.show()

    plt.close(fig)


def evaluate_model(model_path: str | Path, data_yaml_path: str | Path) -> dict[str, float]:
    """Run official Ultralytics validation and return core metrics."""
    model = YOLO(str(model_path))
    metrics = model.val(data=str(Path(data_yaml_path).resolve()))
    summary = {
        "mAP50": float(metrics.box.map50),
        "mAP50_95": float(metrics.box.map),
        "precision": float(metrics.box.mp),
        "recall": float(metrics.box.mr),
    }

    for key, value in summary.items():
        print(f"{key}: {value:.4f}")

    return summary


def copy_file(src: str | Path, dst: str | Path) -> Path:
    """Copy a file to destination path and return destination."""
    src = Path(src)
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return dst


def file_md5(path: str | Path) -> str:
    """Compute md5 hash using chunked reads for large model files."""
    digest = hashlib.md5()
    with Path(path).open("rb") as input_file:
        while True:
            chunk = input_file.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()
