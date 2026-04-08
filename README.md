# oos_detection

Out-of-stock shelf intelligence project with:
- Frontend (`frontend/`)
- Backend API (`backend/app/`)
- YOLO space-detection pipeline (`backend/space_detection/`)
- Synthetic grocery shelf + planogram dataset generator for SKU-level experiments

## Repository Layout

```text
out-of-stock-shelf-intelligence/
├── frontend/
├── backend/
│   ├── app/
│   ├── space_detection/
│   ├── requirements.txt
│   └── requirements.yolo.txt
├── compose.dev.yml
├── data.sql
└── README.md
```

## Prerequisites

- Docker Desktop
- Node.js 16+ and npm
- Python 3.11 (recommended)
- Hugging Face account + token (for dataset restore)

## Quick Start (Fresh Machine)

1. Clone repo

```bash
git clone https://github.com/yoonlee201/out-of-stock-shelf-intelligence.git
cd out-of-stock-shelf-intelligence
```

2. Set up backend Python environment

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements.yolo.txt
cp ../env/.env.example.back .env
cd ..
```

3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

4. Restore YOLO dataset cache from Hugging Face

```bash
source backend/.venv/bin/activate
cd backend/space_detection
export HF_TOKEN="<your_hf_token>"
python3 dataset_sync.py download \
  --repo-id <your-username>/oos-combined-dataset \
  --destination ./combined_dataset \
  --force
cd ../..
```

5. Start full stack

```bash
docker compose -f compose.dev.yml up --build
```

## Local Development

### Frontend only

```bash
cd frontend
npm run dev
```

Runs on `http://localhost:5173`.

### Backend + frontend + db with Docker

```bash
docker compose -f compose.dev.yml up --build
```

For live updates:

```bash
docker compose -f compose.dev.yml watch backend frontend db
```

### Reload SQL seed data

```bash
docker cp ./data.sql pg-oos_detection:/data.sql
docker exec -it pg-oos_detection psql -U oos_detection -f data.sql
```

## Space Detection Workflow

Use the training commands from `backend/space_detection` with the backend venv activated. The synthetic generator and audit examples below are run from `backend/`.

### Synthetic dataset alternative

If you have not received real shelf images or planograms yet, generate a synthetic dataset with paired:
- shelf images
- exact planograms
- SKU reference images
- YOLO empty-space labels
- per-scene metadata for evaluation

Run this from `backend/`:

```bash
python3.11 -m space_detection.synthetic_planogram_dataset \
  --output-root space_detection/synthetic_dataset \
  --clear-output
```

This creates:
- `space_detection/synthetic_dataset/catalog/sku_catalog.json`
- `space_detection/synthetic_dataset/planograms/*.json`
- `space_detection/synthetic_dataset/metadata/*.json`
- `space_detection/synthetic_dataset/train|valid|test/...`
- `space_detection/synthetic_dataset/data.yaml`

Each slot in the generated planogram is tied to a specific SKU ID such as `SKU_CLOUDNINE_SODA_COLA_1L`, not a broad category like `soda`.

### 1) Restore dataset or use the synthetic dataset

```bash
source ../.venv/bin/activate
export HF_TOKEN="<your_hf_token>"
python3 dataset_sync.py download \
  --repo-id <your-username>/oos-combined-dataset \
  --destination ./combined_dataset \
  --force
```

If you are using the synthetic fallback instead, point downstream commands at `./synthetic_dataset` or `../space_detection/synthetic_dataset` depending on your working directory.

### 2) Audit a synthetic shelf image against its planogram

Run this from `backend/`:

```bash
python3.11 - <<'PY'
from pathlib import Path
from PIL import Image
from space_detection.planogram_analysis import analyze_shelf_image, load_planogram_for_scene

dataset_root = Path("./space_detection/synthetic_dataset")
scene_id = "valid_0001"
planogram = load_planogram_for_scene(scene_id, dataset_root)
image = Image.open(dataset_root / planogram["image_path"]).convert("RGB")
result = analyze_shelf_image(image=image, planogram=planogram, dataset_root=dataset_root)

print(result["summary"])
print(result["missing_items"])
print(result["detected_skus"])
PY
```

The analysis reports:
- empty slots
- missing expected SKUs
- unexpected SKUs in the wrong slot
- SKU identities for detected products

### 3) Train model

Use either the restored dataset or the synthetic dataset root.

```bash
python3 train_pipeline.py \
  --combined-root ./combined_dataset \
  --runs-root ./runs \
  --workers 1 \
  --output-best ./best.pt
```

For the synthetic fallback:

```bash
python3 train_pipeline.py \
  --combined-root ./synthetic_dataset \
  --runs-root ./runs \
  --workers 1 \
  --output-best ./best.pt
```

### 4) Verify best checkpoint copy

```bash
python3 verify_model_hash.py ./best.pt ./runs/emptyspace_p2_finetune/weights/best.pt
```

### 5) Evaluate model

```bash
python3 - <<'PY'
from ultralytics import YOLO
m = YOLO("./best.pt")
metrics = m.val(data="./combined_dataset/data.yaml", split="test", workers=1)
print("mAP50:", metrics.box.map50)
print("mAP50-95:", metrics.box.map)
print("Precision:", metrics.box.mp)
print("Recall:", metrics.box.mr)
PY
```

### 6) Run inference on one image

```bash
python3 predict.py ./combined_dataset/valid/images/ds1_1252.jpg --model ./best.pt --conf 0.25 --output ./output.jpg
```

### Publish dataset updates (maintainers)

```bash
export HF_TOKEN="<your_hf_token>"
python3 dataset_sync.py upload \
  --repo-id <your-username>/oos-combined-dataset \
  --source ./combined_dataset \
  --private
```

### Kaggle alternative (manual)

```bash
kaggle datasets init -p ./combined_dataset
# Edit combined_dataset/dataset-metadata.json
kaggle datasets create -p ./combined_dataset
# For updates:
kaggle datasets version -p ./combined_dataset -m "Update combined dataset"
```

## Git Workflow

### Create feature branch

```bash
git checkout master
git pull origin master
git checkout -b <name>/<feature>
```

### Commit and push

```bash
git status
git add .
git commit -m "<message>"
git push origin <branch-name>
```

### Open PR

1. Open the repository on GitHub.
2. Go to the Pull Requests tab.
3. Click New pull request.
4. Add title/description and submit.

## Notes

- `backend/space_detection/combined_dataset/` is treated as local cache and is not committed.
- `backend/space_detection/synthetic_dataset/` is a local synthetic fallback dataset for planogram and SKU experiments.
- Keep `HF_TOKEN` private. If it leaks, revoke it and create a new one.
