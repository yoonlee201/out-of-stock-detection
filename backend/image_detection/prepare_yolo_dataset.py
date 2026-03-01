import ssl
ssl._create_default_https_context = ssl._create_unverified_context

import os
import shutil
from pathlib import Path

IS_DOCKER = os.path.exists("/.dockerenv")
DATASET_ROOT = Path("/data/GroceryStoreDataset/dataset") if IS_DOCKER else Path("../../GroceryStoreDataset/dataset")
YOLO_OUT = Path("/data/yolo_grocery") if IS_DOCKER else Path("../../yolo_grocery")


def convert_split(txt_file: Path, split_name: str) -> None:
    images_out = YOLO_OUT / "images" / split_name
    labels_out = YOLO_OUT / "labels" / split_name
    images_out.mkdir(parents=True, exist_ok=True)
    labels_out.mkdir(parents=True, exist_ok=True)

    with open(txt_file, "r", encoding="utf-8") as file:
        lines = [line.strip() for line in file if line.strip()]

    processed = 0
    for line in lines:
        parts = line.split(", ")
        if len(parts) < 2:
            continue

        rel_path = Path(parts[0])
        class_id = int(parts[1])
        src_image = DATASET_ROOT / rel_path

        if not src_image.exists():
            continue

        dst_image = images_out / src_image.name
        shutil.copy2(src_image, dst_image)

        label_file = labels_out / f"{src_image.stem}.txt"
        with open(label_file, "w", encoding="utf-8") as lf:
            lf.write(f"{class_id} 0.5 0.5 1.0 1.0\n")

        processed += 1

    print(f"  {split_name}: {processed} images processed")


if __name__ == "__main__":
    print("Converting GroceryStoreDataset to YOLO format...")
    for split in ["train", "val", "test"]:
        txt = DATASET_ROOT / f"{split}.txt"
        if txt.exists():
            convert_split(txt, split)
        else:
            print(f"  [SKIP] {txt} not found")

    print(f"Done! Output at: {YOLO_OUT}")
