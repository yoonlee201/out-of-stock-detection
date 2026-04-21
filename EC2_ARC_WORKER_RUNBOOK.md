# EC2 + ARC Worker Runbook

This is the preferred deployment shape for the shelf analyzer:

- Frontend on Vercel
- Flask API on EC2
- Shelf-analysis worker on ARC GPU
- Shared database between EC2 and ARC

This repo now includes an async shelf-analysis flow:

- `POST /shelf-analysis/jobs`
- `GET /shelf-analysis/jobs/<job_id>`
- ARC worker entrypoint: [scripts/arc_worker.py](/Users/Stuti/out-of-stock-detection/scripts/arc_worker.py)
- ARC Slurm launcher: [scripts/arc_worker.slurm](/Users/Stuti/out-of-stock-detection/scripts/arc_worker.slurm)

## How It Works

1. Frontend uploads a shelf image to the EC2 Flask API.
2. EC2 stores the uploaded image bytes in the shared database as a queued `shelf_analysis_job`.
3. ARC worker polls the database for queued jobs.
4. ARC claims a job, runs the YOLO + Qwen pipeline, and writes the completed result payload back to the database.
5. Frontend polls the API until the job becomes `completed` or `failed`.

This is a DB-backed async MVP. It removes the long-running analysis from the browser request path and lets ARC do the GPU work.

## Required Infrastructure

- Vercel project for the frontend
- EC2 instance for the Flask API
- Shared Postgres database reachable from both EC2 and ARC
- ARC allocation on Falcon or TinkerCliffs for the worker

SQLite is fine for local development, but it is not the right choice for shared EC2 + ARC deployment.

## Backend Environment

Both EC2 and ARC worker need the same `backend/.env` values for the shared database and app config.

Minimum deployment fields:

```env
BACKEND_PORT=8000
SQLALCHEMY_DATABASE_URI=postgresql+psycopg2://<user>:<password>@<host>:5432/<db>
FRONTEND_URL=https://<your-vercel-domain>
```

Also include whatever secrets your backend needs for:

- OpenAI-compatible API access
- Gmail alerts
- invitation/email signing keys

## Frontend Environment

Set this in Vercel:

```env
VITE_BACKEND_URL=https://api.<your-domain>
```

Vercel environment variable docs:

- <https://vercel.com/docs/environment-variables>

## EC2 API Process

The EC2 backend serves login, registration, dashboard data, and shelf-analysis job APIs.

It no longer needs to run GPU inference inline for the preferred architecture.

Typical EC2 startup:

```bash
cd /srv/out-of-stock-detection/backend
python -m app.main
```

Put it behind `nginx`, `systemd`, or your normal EC2 process manager.

## ARC Worker Setup

Copy the repo to ARC:

```bash
cd /path/to/out-of-stock-detection
rsync -avh --progress \
  --exclude '.git/' \
  --exclude '.venv/' \
  --exclude 'backend/.venv/' \
  --exclude 'frontend/node_modules/' \
  --exclude 'frontend/dist/' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '.pytest_cache/' \
  --exclude '.mypy_cache/' \
  --exclude '.DS_Store' \
  ./ stutishah9@falcon1.arc.vt.edu:~/out-of-stock-detection
```

Create the worker env on ARC:

```bash
ssh stutishah9@falcon2.arc.vt.edu
interact -A cp-spring2026-iac -p l40s_normal_q -t 2:00:00 -n 1 --gres=gpu:1 --cpus-per-task=8 --mem=48G

module reset
module load Miniconda3/24.7.1-0
conda create -y -n oos-falcon-l40s python=3.11
source activate $HOME/.conda/envs/oos-falcon-l40s

cd ~/out-of-stock-detection
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
python -m app.main
```

Copy the EC2-compatible `backend/.env` to ARC so the worker points to the same shared database.

## Run the Worker Interactively

From ARC:

```bash
module reset
module load Miniconda3/24.7.1-0
source activate $HOME/.conda/envs/oos-falcon-l40s

export HF_HOME=/scratch/$USER/hf_cache
export HF_HUB_CACHE=$HF_HOME/hub
export HF_DATASETS_CACHE=$HF_HOME/datasets
export TRANSFORMERS_CACHE=$HF_HUB_CACHE

cd ~/out-of-stock-detection
python scripts/arc_worker.py --poll-interval 5
```

## Run the Worker as a Slurm Job

Submit the included worker launcher:

```bash
cd ~/out-of-stock-detection
sbatch \
  --account=<allocation> \
  --export=ALL,PROJECT_DIR=$HOME/out-of-stock-detection,CONDA_ENV=$HOME/.conda/envs/oos-falcon-l40s \
  scripts/arc_worker.slurm
```

Monitor it:

```bash
squeue -u $USER
tail -f oos-arc-worker-<jobid>.out
```

## API Contract

Create a job:

```http
POST /shelf-analysis/jobs
Content-Type: multipart/form-data
```

Response:

```json
{
  "message": "Shelf analysis job created.",
  "job": {
    "job_id": "uuid",
    "status": "queued"
  }
}
```

Poll a job:

```http
GET /shelf-analysis/jobs/<job_id>
```

Completed response includes:

- `status`
- `result.summary`
- `result.compliance_report`
- `result.detections`
- `result.annotated_image`

## Local Development

The old blocking route still exists for compatibility:

```http
POST /shelf-analysis/analyze
```

Use that locally if you want a synchronous single-process flow.

The frontend in this repo now uses the async job endpoints instead.

## Current Limits

- Input images are stored in the database in this MVP.
- This is enough to unblock async EC2 + ARC coordination, but S3 is a better next step for scale.
- Queueing is DB-polled rather than SQS-driven.
- For a production-hardening step, move:
  - input/output binary assets to S3
  - queue dispatch to SQS

## Recommended Next Step

After this MVP is stable:

1. Move uploaded images from DB storage to S3.
2. Replace DB polling with SQS.
3. Put the Flask API on EC2 behind `nginx` + `systemd`.
4. Keep the frontend on Vercel with `VITE_BACKEND_URL` pointed at the EC2 API domain.
