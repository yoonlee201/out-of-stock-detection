from __future__ import annotations

import glob
import hashlib
import random
import re
import shutil
from pathlib import Path
from typing import Any, Iterable, Sequence

import matplotlib.patches as patches
import matplotlib.pyplot as plt
import requests
import torch
import yaml
from PIL import Image
from roboflow import Roboflow
from ultralytics import YOLO

DATASET_SPECS = [
    {
        "workspace": "dsjourney",
        "project": "empty-spaces-detection-in-shelf-data",
        "version": 4,
    },
    {
        "workspace": "admath-dl2", 
        "project": "empty-shelves-pelqt", 
        "version": 3,
    },
    {
        "workspace": "fyp-ormnr",
        "project": "supermarket-empty-shelf-detector",
        "version": 1,
    },
    {
        "workspace": "fyp-ormnr",
        "project": "on-shelf-stock-availability-ox04t",
        "version": 1,
    },
    # {
    #     "workspace": "aneesh-obmai", 
    #     "project": "empty-space-brfvt", 
    #     "version": 1,
    # },
    # {
    #     "workspace": "galaya-8gvu7", 
    #     "project": "empty-space-detection-9amtl", 
    #     "version": 8,
    # },
    {
        "workspace": "crosswalk-cfzzv",
        "project": "empty-space-detection-mart-shelf",
        "version": 1,
    },
    {
        "workspace": "final-project-object-detection-for-instore-inventory-management",
        "project": "empty-spaces-in-a-supermarket-hanger-1upsp",
        "version": 1,
    },
]

SPLITS = ("train", "valid", "test")


def check_cuda() -> None:
    """Print available CUDA device details."""
    is_available = torch.cuda.is_available()
    print(f"CUDA available: {is_available}")
    if is_available:
        print(f"CUDA device: {torch.cuda.get_device_name(0)}")


def print_versions(
    api_key: str,
    workspace: str,
    project: str,
    rf: Roboflow | None = None,
) -> list[dict[str, Any]]:
    """Print all available versions for one Roboflow project."""
    roboflow_client = rf or Roboflow(api_key=api_key)
    try:
        proj = roboflow_client.workspace(workspace).project(project)
        info = proj.get_version_information()
    except requests.exceptions.ConnectionError:
        print(f"\nVersions for {workspace}/{project}: unavailable (network/DNS error).")
        return []
    except Exception as exc:
        print(f"\nVersions for {workspace}/{project}: unavailable ({exc.__class__.__name__}).")
        return []

    print(f"\nVersions for {workspace}/{project}:")
    for version in info:
        version_id = version.get("id") or version.get("version")
        created = version.get("created") or version.get("created_at")
        images = version.get("images")
        name = version.get("name")
        print(f"  v{version_id}: {created}  images={images}  name={name}")

    return info


def print_versions_for_specs(
    api_key: str,
    dataset_specs: Sequence[dict] = DATASET_SPECS,
) -> None:
    """Print available versions for every configured dataset project."""
    rf = Roboflow(api_key=api_key)
    unavailable: list[str] = []
    for spec in dataset_specs:
        info = print_versions(
            api_key=api_key,
            workspace=spec["workspace"],
            project=spec["project"],
            rf=rf,
        )
        if not info:
            unavailable.append(f"{spec['workspace']}/{spec['project']}")

    if unavailable:
        print("\nCompleted with warnings. Could not fetch:")
        for item in unavailable:
            print(f"  - {item}")


def sanity_check_dataset(dataset_root: str | Path) -> dict[str, Any]:
    """
    Sanity-check one downloaded dataset folder.

    Checks:
    - data.yaml exists and contains nc/names.
    - YOLO label files exist.
    - Label files are not all empty.
    """
    dataset_root = Path(dataset_root)
    data_yaml_path = dataset_root / "data.yaml"
    result: dict[str, Any] = {
        "dataset_root": str(dataset_root),
        "data_yaml_exists": data_yaml_path.exists(),
        "nc": None,
        "names": None,
        "total_label_files": 0,
        "non_empty_label_files": 0,
        "empty_label_files": 0,
        "usable_for_empty_space_merge": False,
    }

    if data_yaml_path.exists():
        with data_yaml_path.open("r", encoding="utf-8") as yaml_file:
            data_yaml = yaml.safe_load(yaml_file) or {}
        result["nc"] = data_yaml.get("nc")
        result["names"] = data_yaml.get("names")

    label_files: list[Path] = []
    for split in SPLITS:
        label_files.extend((dataset_root / split / "labels").glob("*.txt"))

    total_label_files = len(label_files)
    non_empty_label_files = 0
    for label_file in label_files:
        if label_file.stat().st_size > 0:
            non_empty_label_files += 1

    result["total_label_files"] = total_label_files
    result["non_empty_label_files"] = non_empty_label_files
    result["empty_label_files"] = total_label_files - non_empty_label_files
    result["usable_for_empty_space_merge"] = bool(
        result["data_yaml_exists"] and total_label_files > 0 and non_empty_label_files > 0
    )

    print(f"\nSanity check: {dataset_root}")
    print(f"  data.yaml: {'yes' if result['data_yaml_exists'] else 'no'}")
    print(f"  nc: {result['nc']}")
    print(f"  names: {result['names']}")
    print(
        "  labels: "
        f"total={result['total_label_files']}, "
        f"non_empty={result['non_empty_label_files']}, "
        f"empty={result['empty_label_files']}"
    )
    print(
        "  usable_for_empty_space_merge: "
        f"{'yes' if result['usable_for_empty_space_merge'] else 'no'}"
    )

    if result["data_yaml_exists"]:
        names = result["names"]
        nc = result["nc"]
        if isinstance(names, list) and isinstance(nc, int) and len(names) != nc:
            print("  warning: data.yaml has inconsistent nc vs names length.")
    else:
        print("  warning: missing data.yaml.")

    if total_label_files == 0:
        print("  warning: no label files found under train/valid/test labels folders.")
    elif non_empty_label_files == 0:
        print("  warning: all label files are empty.")

    return result


def sanity_check_datasets(dataset_paths: Iterable[str | Path]) -> list[dict[str, Any]]:
    """Run sanity checks for multiple dataset folders."""
    return [sanity_check_dataset(path) for path in dataset_paths]


def _slugify(text: str) -> str:
    """Convert text into a filesystem-safe slug."""
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", text).strip("-").lower()


def _is_dataset_root(path: Path) -> bool:
    """Return True if the path looks like a YOLO dataset root."""
    return (
        path.is_dir()
        and (path / "data.yaml").exists()
        and any((path / split / "images").exists() for split in SPLITS)
    )


def _resolve_dataset_root(
    reported_location: str | Path,
    download_base: Path | None = None,
) -> Path:
    """
    Resolve the actual dataset root.

    Roboflow may report `dataset.location` as the parent download directory
    when `location=` is used. This resolver finds the real extracted folder.
    """
    reported = Path(reported_location).resolve()
    if _is_dataset_root(reported):
        return reported

    search_roots: list[Path] = [reported]
    if download_base is not None and download_base.resolve() not in search_roots:
        search_roots.append(download_base.resolve())

    for root in search_roots:
        if not root.exists():
            continue
        for candidate_yaml in root.rglob("data.yaml"):
            candidate = candidate_yaml.parent
            if _is_dataset_root(candidate):
                return candidate

    return reported


def download_datasets(
    api_key: str,
    dataset_specs: Sequence[dict] = DATASET_SPECS,
    model_format: str = "yolov8",
    download_location: str | Path | None = None,
) -> list[str]:
    """Download all configured Roboflow datasets."""
    rf = Roboflow(api_key=api_key)
    downloaded_paths: list[str] = []

    location_root: Path | None = None
    if download_location:
        location_root = Path(download_location).resolve()
        location_root.mkdir(parents=True, exist_ok=True)

    for idx, spec in enumerate(dataset_specs, start=1):
        workspace = spec["workspace"]
        project_slug = spec["project"]
        version_num = spec["version"]

        print(
            f"Downloading dataset {idx}/{len(dataset_specs)}: "
            f"{workspace}/{project_slug} v{version_num}"
        )

        project = rf.workspace(workspace).project(project_slug)
        version = project.version(version_num)

        # Download exactly like the original working flow, then place datasets
        # into download_location if requested.
        dataset = version.download(model_format)
        resolved_path = _resolve_dataset_root(dataset.location)

        final_path = resolved_path
        if location_root is not None:
            final_path = (
                location_root
                / f"{_slugify(workspace)}__{_slugify(project_slug)}__v{version_num}"
            )
            if final_path.exists():
                shutil.rmtree(final_path)
            shutil.copytree(resolved_path, final_path)

        downloaded_paths.append(str(final_path))
        print(f"  saved at: {final_path}")

    return downloaded_paths


def remap_labels(label_path: str | Path, output_path: str | Path) -> None:
    """Remap labels to one class and normalize segment labels into boxes."""
    label_path = Path(label_path)
    output_path = Path(output_path)

    lines = label_path.read_text(encoding="utf-8").splitlines()
    deduped_lines: set[str] = set()

    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, value))

    with output_path.open("w", encoding="utf-8") as out_file:
        for line in lines:
            parts = line.strip().split()
            if len(parts) < 5:
                continue

            yolo_box: tuple[float, float, float, float] | None = None

            # Detection box format: class cx cy w h
            if len(parts) == 5:
                try:
                    cx, cy, bw, bh = map(float, parts[1:5])
                    yolo_box = (_clamp(cx), _clamp(cy), _clamp(bw), _clamp(bh))
                except ValueError:
                    yolo_box = None
            # Segmentation polygon format: class x1 y1 x2 y2 ... -> convert to bbox
            elif (len(parts) - 1) % 2 == 0:
                try:
                    coords = list(map(float, parts[1:]))
                    xs = coords[0::2]
                    ys = coords[1::2]
                    if xs and ys:
                        x_min, x_max = _clamp(min(xs)), _clamp(max(xs))
                        y_min, y_max = _clamp(min(ys)), _clamp(max(ys))
                        bw = max(0.0, x_max - x_min)
                        bh = max(0.0, y_max - y_min)
                        cx = _clamp((x_min + x_max) / 2.0)
                        cy = _clamp((y_min + y_max) / 2.0)
                        yolo_box = (cx, cy, bw, bh)
                except ValueError:
                    yolo_box = None

            if yolo_box is None:
                continue

            cx, cy, bw, bh = yolo_box
            out_line = f"0 {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}"
            if out_line in deduped_lines:
                continue
            deduped_lines.add(out_line)
            out_file.write(out_line + "\n")


def combine_datasets(
    dataset_paths: Iterable[str | Path],
    combined_root: str | Path = "combined_dataset",
) -> dict[str, int]:
    """Merge all datasets into one YOLO dataset with a unified class map."""
    combined_root = Path(combined_root)

    for split in SPLITS:
        (combined_root / split / "images").mkdir(parents=True, exist_ok=True)
        (combined_root / split / "labels").mkdir(parents=True, exist_ok=True)

    img_counter = 0
    dataset_paths = [Path(path) for path in dataset_paths]

    for ds_idx, ds_path in enumerate(dataset_paths):
        print(f"\nProcessing dataset {ds_idx + 1}: {ds_path}")

        for split in SPLITS:
            img_dir = ds_path / split / "images"
            lbl_dir = ds_path / split / "labels"

            if not img_dir.exists():
                print(f"  skipping {split} (images folder not found)")
                continue

            images = sorted(img_dir.glob("*.*"))
            print(f"  {split}: {len(images)} images")

            for img_path in images:
                new_name = f"ds{ds_idx}_{img_counter}"
                img_counter += 1

                out_img = combined_root / split / "images" / f"{new_name}{img_path.suffix}"
                shutil.copy2(img_path, out_img)

                label_src = lbl_dir / f"{img_path.stem}.txt"
                label_out = combined_root / split / "labels" / f"{new_name}.txt"

                if label_src.exists():
                    remap_labels(label_src, label_out)
                else:
                    label_out.touch()

    counts: dict[str, int] = {}
    for split in SPLITS:
        image_count = len(list((combined_root / split / "images").glob("*")))
        label_count = len(list((combined_root / split / "labels").glob("*")))
        print(f"{split}: {image_count} images, {label_count} labels")
        counts[f"{split}_images"] = image_count
        counts[f"{split}_labels"] = label_count

    return counts


def write_data_yaml(
    combined_root: str | Path = "combined_dataset",
    class_name: str = "empty_space",
) -> Path:
    """Create YOLO data.yaml for the merged dataset."""
    combined_root = Path(combined_root)
    data = {
        "path": str(combined_root.resolve()),
        "train": "train/images",
        "val": "valid/images",
        "test": "test/images",
        "nc": 1,
        "names": [class_name],
    }

    data_yaml_path = combined_root / "data.yaml"
    data_yaml_path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    print(f"data.yaml written to {data_yaml_path}")
    return data_yaml_path


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
