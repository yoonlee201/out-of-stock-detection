from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run inference on one image or a folder with the trained best.pt model."
    )
    parser.add_argument(
        "input_path",
        help="Image path or folder path.",
    )
    parser.add_argument(
        "--model",
        default="best.pt",
        help="Path to model weights.",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Confidence threshold.",
    )
    parser.add_argument(
        "--save",
        action="store_true",
        help="Save Ultralytics default prediction outputs.",
    )
    parser.add_argument(
        "--show",
        action="store_true",
        help="Display predictions in a window.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional output image path for single-image inference.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    model = YOLO(args.model)
    results = model(args.input_path, conf=args.conf, save=args.save)

    if args.show:
        for result in results:
            result.show()

    if args.output:
        if len(results) != 1:
            raise SystemExit("--output supports single-image inference only.")

        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        results[0].save(filename=str(output_path))
        print(f"Saved output image to {output_path}")

    print(f"Processed {len(results)} image(s)")


if __name__ == "__main__":
    main()
