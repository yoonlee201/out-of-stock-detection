# Out-of-Stock Detection

Inventory tracking app with a React dashboard, a Flask backend, and a shelf-analysis pipeline that combines Ultralytics YOLO with Qwen2-VL SKU labeling.

---

## Repository Layout

```
out-of-stock-detection/
├── backend/                  # Flask REST API
│   ├── app/                  # Routes, services, models, settings
│   ├── db/
│   │   └── init_db.py        # Table creation + optional sample-data seed
│   ├── agent/                # Optional LLM agent helpers
│   └── requirements.txt
├── frontend/                 # Vite + React + TypeScript dashboard
├── shelf_analyzer/           # YOLO + Qwen2-VL analysis pipeline
├── config/                   # Environment templates (copy → backend/.env etc.)
│   ├── backend.env.example
│   └── frontend.env.example
├── scripts/
│   ├── setup.sh              # Local dev bootstrap (see below)
│   └── database.sh           # Legacy DB helper
├── docs/
│   └── train/                # YOLO training run artifacts (curves, confusion matrix)
├── weights/
│   └── best.pt               # Trained YOLO detector weights (required)
├── compose.dev.yml           # Local dev: backend + postgres + frontend
└── docker-compose.yml        # Production: backend only (external RDS)
```

---

## Local Development

### What runs locally

| Component | Always runs | Notes |
|---|---|---|
| Flask backend | Yes | REST API, auth, alerts |
| PostgreSQL (Docker) | Yes (Docker mode) | `postgres:16-alpine` in compose.dev.yml |
| React + Vite dev server | Yes | Hot-reload via Docker watch or npm |
| YOLO detector | Yes | Uses `weights/best.pt`; CPU inference |
| Gap detection | Yes | Pure Python, no extra models |
| **Qwen2-VL SKU labeling** | **Optional** | Disabled in `--lite` mode (see below) |

### Core vs optional components

**Core (always included):**
- Product inventory dashboard (CRUD, alerts, reorders)
- Shelf image upload → YOLO product detection → gap analysis
- User auth with email verification and role-based access
- Email and SMS alerting (requires Gmail App Password — see `config/backend.env.example`)

**Optional — omitted with `--lite`:**
- **Qwen2-VL SKU labeling**: downloads 4–14 GB on first use; needs 4–16 GB RAM.
  Without it, detected products are listed as unlabeled boxes; gap locations still report correctly.

### Prerequisites

**Docker mode (recommended)**
- Docker Desktop (Mac/Windows) or Docker Engine + Compose v2 (Linux)
- `weights/best.pt` in the repo root

**No-Docker mode** (`--lite --no-docker`)
- Python 3.11
- Node.js 18+ and npm
- `weights/best.pt` in the repo root

### Step-by-step: full setup (Docker, standard hardware)

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd out-of-stock-detection

# 2. Add your YOLO weights
cp /path/to/best.pt weights/best.pt

# 3. Run the bootstrap script
bash scripts/setup.sh
```

The script:
1. Prompts for a backend port (default `8000`).
2. Writes `backend/.env` and `frontend/.env` from `config/*.env.example`.
3. Builds and starts `backend`, `db`, and `frontend` via Docker Compose.
4. Waits for the backend health check to pass.
5. Optionally seeds the database with sample data.
6. Attaches `docker compose watch` for hot-reload.

Frontend: **http://localhost:5173** · Backend: **http://localhost:8000**

---

### Step-by-step: lite setup (low-power hardware / slow network)

Use `--lite` to skip the Qwen2-VL download. Shelf analysis runs YOLO + gap detection only.

```bash
bash scripts/setup.sh --lite
```

Docker is still required for `--lite`. The only difference is `MAX_SKU_IDENTIFICATIONS=0`
is written to `backend/.env`, so Qwen never loads.

---

### Step-by-step: no-Docker setup (SQLite, no containers)

For machines where Docker isn't available. Uses SQLite instead of PostgreSQL.

```bash
bash scripts/setup.sh --no-docker
```

This automatically:
- Creates `backend/.venv` with all Python dependencies (PyTorch CPU-only).
- Sets `SQLALCHEMY_DATABASE_URI=sqlite:///oos_detection.db`.
- Initialises the SQLite database.
- Installs frontend npm packages.
- Starts the Flask server in the background and Vite dev server in the foreground.

> Email and SMS alerting still work in no-Docker mode; add your Gmail credentials
> to `backend/.env` after setup.

---

### Useful commands (Docker mode)

```bash
# View all service logs
docker compose -f compose.dev.yml logs -f

# View backend logs only
docker compose -f compose.dev.yml logs -f backend

# Stop all services
docker compose -f compose.dev.yml down

# Rebuild after dependency changes
docker compose -f compose.dev.yml up --build -d

# Re-seed the database (safe — skips if rows exist)
docker exec oos_detection-backend python -m db.init_db --seed

# Open a psql session
docker exec -it pg-oos_detection psql -U oos_detection -d oos_detection
```

---

### Environment variables quick reference

All variables are documented in [`config/backend.env.example`](config/backend.env.example) and [`config/frontend.env.example`](config/frontend.env.example).

Key toggles:

| Variable | Effect |
|---|---|
| `MAX_SKU_IDENTIFICATIONS=0` | Disable Qwen VL (lite mode) |
| `MAX_SKU_IDENTIFICATIONS=all` | Label every detected crop |
| `SQLALCHEMY_DATABASE_URI` | Swap between SQLite and PostgreSQL |
| `FLASK_ENV=production` | Enables production hardening |

---

## What the App Does

- Shows inventory data in the dashboard (products, suppliers, alerts, reorders).
- Lets you upload a shelf image from the dashboard.
- Runs a trained YOLO detector to find product boxes and locate gaps.
- Optionally uses Qwen2-VL on product crops to label detected SKUs.
- Sends email/SMS alerts on low-stock or out-of-stock events.

---

## Shelf Analyzer Notes

The backend route is at [`backend/app/routes/shelf_analysis.py`](backend/app/routes/shelf_analysis.py); the pipeline lives in [`shelf_analyzer/`](shelf_analyzer/).

Runtime notes:

- First request with Qwen enabled downloads the model weights (4–14 GB, once only).
- CPU inference is 10–50× slower than GPU — expect 1–5 min per image with Qwen.
- The frontend timeout is controlled by `VITE_SHELF_ANALYSIS_TIMEOUT_MS` in `frontend/.env`.

Useful env tuning:

```bash
MAX_SKU_IDENTIFICATIONS=all    # label every crop (most thorough)
MAX_SKU_IDENTIFICATIONS=5      # label only top 5 (faster)
MAX_SKU_IDENTIFICATIONS=0      # YOLO + gaps only (fastest, no download)
SKU_IDENTIFICATION_CHUNK_SIZE=4  # process in batches; shows progress in logs
```

### Standalone pipeline test

```bash
python -m shelf_analyzer.test_pipeline
```

Downloads a sample image, runs YOLO + Qwen, and writes output to `/tmp/test_output.jpg`.

---

## ARC CPU Workflow (Virginia Tech)

```bash
ssh <pid>@owl2.arc.vt.edu
interact -A cp-spring2026-iac --partition=normal_q --cpus-per-task=8 --mem=32G --time=4:00:00

module reset
module load Miniconda3/24.7.1-0
source activate $HOME/.conda/envs/oos_arc

cd ~/out_of_stock_detection
pip install --upgrade pip
pip install -r backend/requirements.txt

mkdir -p /scratch/$USER/hf_cache /scratch/$USER/pip-cache
export HF_HOME=/scratch/$USER/hf_cache
export HF_HUB_CACHE=$HF_HOME/hub
export MAX_SKU_IDENTIFICATIONS=all
export SKU_IDENTIFICATION_CHUNK_SIZE=4

cd backend && python -m app.main
```

Open a tunnel from your local machine:

```bash
ssh -N -L 8000:<compute-node>:8000 <pid>@owl2.arc.vt.edu
```

Then start the frontend locally:

```bash
cd frontend && npm run dev
```

### Syncing files

```bash
# ARC → local
rsync -avh --progress <pid>@owl2.arc.vt.edu:~/out_of_stock_detection/ ./

# local → ARC
rsync -avh --progress ./ <pid>@owl2.arc.vt.edu:~/out_of_stock_detection
```

---

## Production

See [README_PROD.md](README_PROD.md) for the full production deployment guide.
