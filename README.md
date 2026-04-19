# Out-of-Stock Detection

Inventory tracking app with a React dashboard, a Flask backend, and a shelf-analysis pipeline that combines Ultralytics YOLO with Qwen2-VL SKU labeling.

## Docker Quick Start (Recommended)

### Prerequisites

- Docker Desktop running
- `weights/best.pt` YOLO model file in the repo root

### Run

```bash
bash scripts/setup.sh
```

What it does:

1. Prompts for a backend port (default `8000`).
2. Writes `backend/.env` and `frontend/.env` from the example templates.
3. Builds and starts all three services (`backend`, `db`, `frontend`) in detached mode.
4. Waits for the backend to pass its health check.
5. Optionally seeds the database with sample data.
6. Attaches `docker compose watch` for hot-reload on file changes.

Frontend is served at `http://localhost:5173`.

### Useful commands

```bash
# View logs
docker compose -f compose.dev.yml logs -f

# Stop all services
docker compose -f compose.dev.yml down

# Rebuild after dependency changes
docker compose -f compose.dev.yml up --build -d
```

---

## Repository Layout

```text
out-of-stock-detection/
├── backend/                  # Flask API
│   ├── app/
│   ├── db/
│   │   └── init_db.py        # Database init and seed script
│   └── requirements.txt
├── frontend/                 # Vite + React dashboard
├── shelf_analyzer/           # YOLO + Qwen analysis pipeline
├── scripts/
│   ├── setup.sh              # Docker setup script
├── compose.dev.yml
└── weights/
    └── best.pt               # YOLO detector weights
```

## What The App Does

- Shows inventory data in the dashboard.
- Lets you upload a shelf image from the dashboard.
- Runs a trained YOLO detector to find product boxes.
- Uses Qwen2-VL on product crops to label detected SKUs.
- Estimates horizontal gaps as empty shelf spaces.

## Local Quick Start (Without Docker)

### Prerequisites

- Python 3.11
- Node.js 18+ and npm

### 1. Set up the Python virtual environment

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

This creates `backend/.venv` with all Python dependencies installed.

### 2. Set up the frontend

```bash
cd frontend
npm install
```

### 3. Configure the backend environment

Copy the example and fill in any values you need:

```bash
cp env/.env.example.back backend/.env
```

### 4. Run the backend

```bash
cd backend
source .venv/bin/activate
python -m app.main
```

The default backend port is `8000`, controlled by `BACKEND_PORT` in `backend/.env`.

### 5. Initialize the database

```bash
# Tables only
docker exec oos_detection-backend python -m db.init_db

# Tables + sample data
docker exec oos_detection-backend python -m db.init_db --seed
```

### 6. Run the frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

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
