# Out-of-Stock Detection

Inventory tracking app with a React dashboard, a Flask backend, and a shelf-analysis pipeline that combines Ultralytics YOLO with Qwen2-VL SKU labeling.

## Repository Layout

```text
out-of-stock-detection/
├── backend/                  # Flask API
│   ├── app/
│   └── requirements.txt
├── frontend/                 # Vite + React dashboard
├── shelf_analyzer/           # YOLO + Qwen analysis pipeline
├── scripts/
│   └── data.sql              # Optional seed data
├── compose.dev.yml           # Optional Postgres dev stack
└── weights/
    └── best.pt               # YOLO detector weights
```

## What The App Does

- Shows inventory data in the dashboard.
- Lets you upload a shelf image from the dashboard.
- Runs a trained YOLO detector to find product boxes.
- Uses Qwen2-VL on product crops to label detected SKUs.
- Estimates horizontal gaps as empty shelf spaces.

## Prerequisites

- Python 3.11
- Node.js 18+ and npm
- Docker Desktop only if you want the optional Postgres container

## Local Quick Start

### 1. Set up the backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### 2. Set up the frontend

```bash
cd ../frontend
npm install
```

### 3. Run the backend

```bash
cd ../backend
source .venv/bin/activate
python -m app.main
```

The default backend port is `8000`, controlled by `backend/.env`.

### 4. Run the frontend

```bash
cd ../frontend
npm run dev
```

Open `http://localhost:5173`.

## Database

### Default setup: SQLite

The app currently defaults to SQLite:

```env
SQLALCHEMY_DATABASE_URI=sqlite:///oos_detection.db
```

With that setting, no Docker database is required.

### Optional dev setup: Postgres in Docker

If you want to use the Postgres container from `compose.dev.yml`:

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
brew services stop postgresql@15
docker compose -f compose.dev.yml up -d db
docker ps
```

Then set this in `backend/.env`:

```env
SQLALCHEMY_DATABASE_URI=postgresql+psycopg2://oos_detection:oos_detection_dev_password@127.0.0.1:5432/oos_detection
```

To load the seed script:

```bash
docker cp scripts/data.sql pg-oos_detection:/data.sql
docker exec -it pg-oos_detection psql -U oos_detection -d oos_detection -f /data.sql
```

## Shelf Analyzer Notes

The dashboard shelf analyzer is integrated into the existing frontend and backend. The backend route lives in `backend/app/routes/shelf_analysis.py`, and the main pipeline code lives in `shelf_analyzer/`.

Important runtime notes:

- The first request may download the Qwen2-VL model weights.
- CPU-only runs are much slower than GPU runs.
- The frontend timeout is controlled by `VITE_SHELF_ANALYSIS_TIMEOUT_MS` in `frontend/.env`.

Useful environment variables for the analyzer:

- `MAX_SKU_IDENTIFICATIONS=all`
  Run Qwen labeling on every detected product crop.
- `MAX_SKU_IDENTIFICATIONS=20`
  Label only the top 20 detections.
- `SKU_IDENTIFICATION_CHUNK_SIZE=4`
  Process detections in chunks and print progress in the backend logs.

## Standalone Pipeline Test

To run the standalone test pipeline from the repo root:

```bash
python -m shelf_analyzer.test_pipeline
```

What it does:

- Downloads a sample image from Ultralytics.
- Runs YOLO detection.
- Runs Qwen SKU labeling.
- Draws the output image.
- Saves:
  - `/tmp/test_shelf.jpg`
  - `/tmp/test_output.jpg`

## ARC CPU Workflow

This project can be run on Virginia Tech ARC using an Owl CPU interactive job.

### On ARC

```bash
ssh <pid>@owl2.arc.vt.edu
interact -A cp-spring2026-iac --partition=normal_q --cpus-per-task=8 --mem=32G --time=4:00:00

module reset
module load Miniconda3/24.7.1-0
source activate $HOME/.conda/envs/oos_arc

cd ~/out_of_stock_detection
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt

mkdir -p /scratch/$USER/hf_cache /scratch/$USER/pip-cache
export HF_HOME=/scratch/$USER/hf_cache
export HF_HUB_CACHE=$HF_HOME/hub
export HF_DATASETS_CACHE=$HF_HOME/datasets
export PIP_CACHE_DIR=/scratch/$USER/pip-cache

cd backend
export MAX_SKU_IDENTIFICATIONS=all
export SKU_IDENTIFICATION_CHUNK_SIZE=4
python -m app.main
```

### On your Mac

In a second terminal, open the SSH tunnel after checking the ARC compute hostname:

```bash
ssh -N -L 8000:<compute-node>:8000 <pid>@owl2.arc.vt.edu
```

Then run the frontend locally:

```bash
cd frontend
npm run dev
```

## Syncing Files Between ARC And Local

Copy ARC changes back to your local repo:

```bash
cd /path/to/out-of-stock-detection
rsync -avh --progress <pid>@owl2.arc.vt.edu:~/out_of_stock_detection/ ./
```

Copy local changes up to ARC:

```bash
cd /path/to/out-of-stock-detection
rsync -avh --progress ./ stutishah9@owl2.arc.vt.edu:~/out_of_stock_detection
```
