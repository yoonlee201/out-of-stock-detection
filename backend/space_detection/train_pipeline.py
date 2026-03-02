from __future__ import annotations

import argparse
import os
from pathlib import Path

from pipeline_utils import (
    check_cuda,
    combine_datasets,
    copy_file,
    download_datasets,
    evaluate_model,
    file_md5,
    print_versions_for_specs,
    sanity_check_datasets,
    show_samples,
    train_two_phase,
    visualize_predictions,
    write_data_yaml,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the full space-detection workflow."
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("ROBOFLOW_API_KEY"),
        help="Roboflow API key. Defaults to ROBOFLOW_API_KEY env var.",
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip Roboflow download step and use --dataset-path inputs.",
    )
    parser.add_argument(
        "--list-versions",
        action="store_true",
        help="List available versions for configured Roboflow projects and exit.",
    )
    parser.add_argument(
        "--skip-sanity-check",
        action="store_true",
        help="Skip dataset sanity checks (data.yaml + label file checks).",
    )
    parser.add_argument(
        "--dataset-path",
        action="append",
        default=[],
        help="Path to an existing Roboflow YOLO dataset (repeatable).",
    )
    parser.add_argument(
        "--download-location",
        default=None,
        help="Optional directory where Roboflow datasets are downloaded.",
    )
    parser.add_argument(
        "--combined-root",
        default="combined_dataset",
        help="Output folder for merged dataset.",
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


def main() -> None:
    args = parse_args()

    if args.list_versions:
        if not args.api_key:
            raise SystemExit(
                "Missing Roboflow API key. Set ROBOFLOW_API_KEY or pass --api-key."
            )
        print_versions_for_specs(api_key=args.api_key)
        return

    check_cuda()

    dataset_paths = [Path(path) for path in args.dataset_path]
    if not dataset_paths and not args.skip_download:
        if not args.api_key:
            raise SystemExit(
                "Missing Roboflow API key. Set ROBOFLOW_API_KEY or pass --api-key."
            )
        dataset_paths = [
            Path(path)
            for path in download_datasets(
                api_key=args.api_key,
                download_location=args.download_location,
            )
        ]

    if not dataset_paths:
        raise SystemExit(
            "No datasets available. Provide --dataset-path or run without --skip-download."
        )

    # Remove duplicates while preserving order.
    dataset_paths = list(dict.fromkeys(dataset_paths))

    if not args.skip_sanity_check:
        summaries = sanity_check_datasets(dataset_paths)
        unusable = [
            summary
            for summary in summaries
            if not summary.get("usable_for_empty_space_merge", False)
        ]
        if unusable:
            print("\nWarning: one or more datasets may be unusable for merge/remap:")
            for summary in unusable:
                print(f"  - {summary['dataset_root']}")
            print("You can still continue, or replace those datasets.")

    combined_root = Path(args.combined_root)
    runs_root = Path(args.runs_root)

    counts = combine_datasets(dataset_paths=dataset_paths, combined_root=combined_root)
    if counts.get("train_images", 0) == 0:
        raise SystemExit(
            "Merged dataset has 0 training images. Check download paths and dataset extraction."
        )

    data_yaml_path = write_data_yaml(combined_root=combined_root)

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
