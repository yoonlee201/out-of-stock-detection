import ssl
ssl._create_default_https_context = ssl._create_unverified_context

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from pathlib import Path
import os

from grocery_classifier import build_model, TRAIN_TRANSFORMS, EVAL_TRANSFORMS, NUM_CLASSES

# ── Paths ──────────────────────────────────────────────────────────────────────
IS_DOCKER    = os.path.exists("/.dockerenv")
DATASET_ROOT = Path("/data/GroceryStoreDataset/dataset") if IS_DOCKER else Path("../../GroceryStoreDataset/dataset")
TRAIN_TXT    = DATASET_ROOT / "train.txt"
VAL_TXT      = DATASET_ROOT / "val.txt"
MODEL_SAVE   = Path("/app/models/classifier_best.pt") if IS_DOCKER else Path("./models/classifier_best.pt")
MODEL_SAVE.parent.mkdir(parents=True, exist_ok=True)
DATALOADER_WORKERS = int(os.getenv("DATALOADER_WORKERS", "0"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "8"))
EPOCHS = int(os.getenv("EPOCHS", "30"))

# ── Dataset ────────────────────────────────────────────────────────────────────
class GroceryDataset(Dataset):
    def __init__(self, txt_file, dataset_root, transform):
        self.dataset_root = Path(dataset_root)
        self.transform    = transform
        self.samples      = []
        self.missing_paths = 0

        with open(txt_file) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                # Format: path/to/image.jpg, fine_label, coarse_label
                parts = line.split(", ")
                if len(parts) < 2:
                    continue
                relative_path = Path(parts[0])
                img_path = self.dataset_root / relative_path
                fine_label = int(parts[1])   # 0-80, this is what we train on
                if not img_path.exists():
                    self.missing_paths += 1
                    continue
                self.samples.append((img_path, fine_label))

        if self.missing_paths:
            print(f"[WARN] Skipped {self.missing_paths} missing files listed in {txt_file}")

        if not self.samples:
            raise RuntimeError(
                f"No valid samples found in {txt_file}. "
                f"Check that dataset is mounted at {self.dataset_root} and txt paths are correct."
            )

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        img = Image.open(img_path).convert("RGB")
        img = self.transform(img)
        return img, label


# ── Training ───────────────────────────────────────────────────────────────────
def train():
    device = torch.device(
        "cuda" if torch.cuda.is_available()
        else "mps" if torch.backends.mps.is_available()
        else "cpu"
    )
    print(f"Training on: {device}")
    print(f"DataLoader workers: {DATALOADER_WORKERS} | Batch size: {BATCH_SIZE} | Epochs: {EPOCHS}")

    train_ds = GroceryDataset(TRAIN_TXT, DATASET_ROOT, TRAIN_TRANSFORMS)
    val_ds   = GroceryDataset(VAL_TXT,   DATASET_ROOT, EVAL_TRANSFORMS)

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,  num_workers=DATALOADER_WORKERS)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False, num_workers=DATALOADER_WORKERS)

    model = build_model(num_classes=NUM_CLASSES, freeze_backbone=False)
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=10, gamma=0.5)

    best_val_acc = 0.0
    for epoch in range(EPOCHS):
        # ── Train ──
        model.train()
        total_loss, correct, total = 0, 0, 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            outputs = model(imgs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            correct    += (outputs.argmax(1) == labels).sum().item()
            total      += labels.size(0)

        train_acc = correct / total * 100

        # ── Validate ──
        model.eval()
        val_correct, val_total = 0, 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                outputs = model(imgs)
                val_correct += (outputs.argmax(1) == labels).sum().item()
                val_total   += labels.size(0)

        val_acc = val_correct / val_total * 100
        scheduler.step()

        print(f"Epoch {epoch+1}/{EPOCHS} | "
              f"Loss: {total_loss/len(train_loader):.3f} | "
              f"Train Acc: {train_acc:.1f}% | "
              f"Val Acc: {val_acc:.1f}%")

        # Save the best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), MODEL_SAVE)
            print(f"  ✓ Saved best model (val_acc={val_acc:.1f}%)")

    print(f"\nTraining complete. Best val accuracy: {best_val_acc:.1f}%")
    print(f"Model saved to: {MODEL_SAVE}")


if __name__ == "__main__":
    train()