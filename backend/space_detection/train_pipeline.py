from __future__ import annotations

import argparse
from pathlib import Path

from pipeline_utils import (
    check_cuda,
    copy_file,
    evaluate_model,
    file_md5,
    show_samples,
    train_two_phase,
    visualize_predictions,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train/evaluate space-detection using a restored combined dataset."
    )
    parser.add_argument(
        "--combined-root",
        default="combined_dataset",
        help="Existing merged dataset folder (must contain data.yaml).",
    )
    parser.add_argument(
        "--runs-root",
        default="runs",
        help="Output folder for YOLO training runs.",
    )
    parser.add_argument(
        "--base-model",
        default="yolov8m.pt",
        help="Base model checkpoint for phase 1 training.",
    )
    parser.add_argument("--phase1-epochs", type=int, default=40)
    parser.add_argument("--phase2-epochs", type=int, default=30)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Dataloader workers per train/val loader. Keep at 1 on constrained hosts.",
    )
    parser.add_argument("--preview-train", type=int, default=8)
    parser.add_argument("--preview-valid", type=int, default=4)
    parser.add_argument("--prediction-count", type=int, default=8)
    parser.add_argument("--prediction-conf", type=float, default=0.25)
    parser.add_argument(
        "--output-best",
        default="best.pt",
        help="Path where final phase-2 best model is copied.",
    )
    return parser.parse_args()


def resolve_data_yaml(combined_root: Path) -> Path:
    """Return data.yaml path and fail with actionable guidance if missing."""
    data_yaml_path = combined_root / "data.yaml"
    if not data_yaml_path.exists():
        raise SystemExit(
            "Missing dataset at "
            f"{data_yaml_path}. Restore it first with:\n"
            "python3 dataset_sync.py download "
            "--repo-id <your-username>/oos-combined-dataset "
            f"--destination {combined_root} --force"
        )
    return data_yaml_path


def main() -> None:
    args = parse_args()

    check_cuda()

    combined_root = Path(args.combined_root)
    runs_root = Path(args.runs_root)
    data_yaml_path = resolve_data_yaml(combined_root=combined_root)

    if args.preview_train > 0:
        show_samples(
            combined_root=combined_root,
            split="train",
            n=args.preview_train,
            output_path=runs_root / "sample_train.png",
        )
    if args.preview_valid > 0:
        show_samples(
            combined_root=combined_root,
            split="valid",
            n=args.preview_valid,
            output_path=runs_root / "sample_valid.png",
        )

    best_phase2_path = train_two_phase(
        data_yaml_path=data_yaml_path,
        runs_root=runs_root,
        base_model=args.base_model,
        phase1_epochs=args.phase1_epochs,
        phase2_epochs=args.phase2_epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        workers=args.workers,
    )

    visualize_predictions(
        model_path=best_phase2_path,
        image_glob=str(combined_root / "valid" / "images" / "*.*"),
        n=args.prediction_count,
        conf=args.prediction_conf,
        output_path=runs_root / "prediction_preview.png",
    )

    evaluate_model(model_path=best_phase2_path, data_yaml_path=data_yaml_path)

    output_best = copy_file(best_phase2_path, args.output_best)
    print(f"Copied final model to: {output_best}")
    print(f"Size: {output_best.stat().st_size / 1e6:.1f} MB")

    src_hash = file_md5(best_phase2_path)
    dst_hash = file_md5(output_best)
    print(f"source md5: {src_hash}")
    print(f"output md5: {dst_hash}")
    print(f"hashes match: {src_hash == dst_hash}")


if __name__ == "__main__":
    main()
