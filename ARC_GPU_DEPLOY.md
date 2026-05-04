# ARC GPU Backend Runbook

This project can run the Flask backend on a Virginia Tech ARC GPU node while you keep the frontend local on your laptop.

Recommended starting target:

- `Falcon` with `l40s_normal_q`

Good alternatives:

- `Falcon` with `a30_normal_q`
- `TinkerCliffs` with `a100_normal_q`

Use this when Qwen inference is too heavy for EC2 CPU deployment and you want CUDA-backed inference on ARC.

## Architecture

- Backend: runs on an ARC GPU compute node under Slurm.
- Frontend: runs locally with `npm run dev`, or stays on your existing web host.
- Access pattern: tunnel `localhost:8000` on your laptop to the ARC compute node running the backend.

This is a scheduled HPC workflow, not a permanent internet-facing production deployment. ARC GPU jobs have wall-time limits and queue delays.

## 1. Preconditions

You need:

- An ARC account
- Access to an allocation
- VPN or on-campus network access
- This repo copied to ARC

Useful ARC docs:

- Falcon GPU partitions and QoS: <https://docs.arc.vt.edu/resources/compute/02falcon.html>
- TinkerCliffs GPU partitions and QoS: <https://www.docs.arc.vt.edu/resources/compute/00tinkercliffs.html>
- GPU inventory: <https://www.docs.arc.vt.edu/resources/gpu.html>
- Interactive jobs: <https://www.docs.arc.vt.edu/usage/00faq.html>
- Conda on ARC: <https://docs.arc.vt.edu/software/conda.html>
- Hugging Face on ARC: <https://docs.arc.vt.edu/software/huggingface.html>
- Storage guidance: <https://www.docs.arc.vt.edu/resources/storage.html>

## 2. Copy the Repo to ARC

From your laptop:

```bash
cd /Users/Stuti/out-of-stock-detection
rsync -avh --progress ./ <pid>@falcon1.arc.vt.edu:~/out-of-stock-detection
```

If you prefer project storage on ARC, move it later under `/projects/<project>/out-of-stock-detection`.

## 3. Create the GPU Python Environment on ARC

Build the environment on the same kind of GPU partition you plan to use. Start with Falcon L40S:

```bash
ssh <pid>@falcon1.arc.vt.edu
interact -A <allocation> -p l40s_normal_q -t 2:00:00 -n 1 --gres=gpu:1 --cpus-per-task=8 --mem=48G
```

Then on the allocated compute node:

```bash
module reset
module load Miniconda3/24.7.1-0

conda create -y -n oos-falcon-l40s python=3.11
source activate $HOME/.conda/envs/oos-falcon-l40s

cd ~/out-of-stock-detection
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

Verify CUDA-backed PyTorch:

```bash
python - <<'PY'
import torch
print("torch:", torch.__version__)
print("cuda build:", torch.version.cuda)
print("cuda available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("gpu:", torch.cuda.get_device_name(0))
PY
```

If you want to use TinkerCliffs A100 instead, build the environment there instead:

```bash
ssh <pid>@tinkercliffs1.arc.vt.edu
interact -A <allocation> -p a100_normal_q -t 2:00:00 -n 1 --gres=gpu:1 --cpus-per-task=8 --mem=48G
```

## 4. Configure Hugging Face Cache on ARC

Do not let large model downloads fill your home directory. Use `/scratch`:

```bash
mkdir -p /scratch/$USER/hf_cache/{hub,datasets}
```

The Slurm script in [scripts/arc_backend_gpu.slurm](/Users/Stuti/out-of-stock-detection/scripts/arc_backend_gpu.slurm) exports:

- `HF_HOME`
- `HF_HUB_CACHE`
- `HF_DATASETS_CACHE`
- `TRANSFORMERS_CACHE`

all under `/scratch/$USER/hf_cache` by default.

## 5. Create `backend/.env` on ARC

The backend expects `backend/.env`. Start from your current local values, but create the file on ARC explicitly instead of committing secrets.

Minimum required fields:

```env
BACKEND_PORT=8000
SQLALCHEMY_DATABASE_URI=sqlite:///oos_detection.db
FRONTEND_URL=http://localhost:5173
```

Also include whatever secrets your current backend uses in practice:

- OpenAI-compatible API base and key
- Gmail alert credentials if you need alerts
- Any other app-specific settings

On ARC:

```bash
cd ~/out-of-stock-detection/backend
cp .env .env.arc.backup 2>/dev/null || true
```

If you are copying your local `.env` up to ARC, do it carefully and keep it out of git.

## 6. Submit the Backend as a GPU Job

The repo now includes a reusable Slurm script:

- [scripts/arc_backend_gpu.slurm](/Users/Stuti/out-of-stock-detection/scripts/arc_backend_gpu.slurm)

Example for Falcon L40S from the repo root on ARC:

```bash
cd ~/out-of-stock-detection

sbatch \
  --account=<allocation> \
  --export=ALL,PROJECT_DIR=$HOME/out-of-stock-detection,CONDA_ENV=$HOME/.conda/envs/oos-falcon-l40s \
  scripts/arc_backend_gpu.slurm
```

If your repo lives under project storage:

```bash
sbatch \
  --account=<allocation> \
  --export=ALL,PROJECT_DIR=/projects/<project>/out-of-stock-detection,CONDA_ENV=$HOME/.conda/envs/oos-falcon-l40s \
  scripts/arc_backend_gpu.slurm
```

Useful overrides:

```bash
sbatch \
  --account=<allocation> \
  --partition=a30_normal_q \
  --qos=fal_a30_normal_base \
  --export=ALL,PROJECT_DIR=$HOME/out-of-stock-detection,CONDA_ENV=$HOME/.conda/envs/oos-falcon-l40s \
  scripts/arc_backend_gpu.slurm
```

For TinkerCliffs A100:

```bash
sbatch \
  --account=<allocation> \
  --partition=a100_normal_q \
  --qos=tc_a100_normal_base \
  --export=ALL,PROJECT_DIR=$HOME/out-of-stock-detection,CONDA_ENV=$HOME/.conda/envs/oos-a100 \
  scripts/arc_backend_gpu.slurm
```

## 7. Monitor the Job

After submission:

```bash
squeue -u $USER
```

Inspect the job output:

```bash
tail -f oos-backend-gpu-<jobid>.out
```

Find the assigned compute node:

```bash
squeue -j <jobid> -o "%.18i %.20N %.10T"
```

You need the node name from that command for SSH tunneling.

## 8. Tunnel the Backend Port to Your Laptop

From your laptop, after the job is running and you know the compute node:

```bash
ssh -N -L 8000:<compute-node>:8000 <pid>@falcon1.arc.vt.edu
```

Examples:

```bash
ssh -N -L 8000:fc-gpu012:8000 <pid>@falcon1.arc.vt.edu
ssh -N -L 8000:tc-gpu003:8000 <pid>@tinkercliffs1.arc.vt.edu
```

Keep that SSH tunnel terminal open while you use the app.

## 9. Run the Frontend Locally

On your laptop:

```bash
cd /Users/Stuti/out-of-stock-detection/frontend
npm install
npm run dev
```

Make sure the frontend points to the tunneled backend:

```env
VITE_BACKEND_URL=http://localhost:8000
```

Then open:

```text
http://localhost:5173
```

## 10. One-Off Interactive Run Instead of `sbatch`

For debugging, you can run the backend directly in an interactive GPU session.

On ARC:

```bash
ssh <pid>@falcon1.arc.vt.edu
interact -A <allocation> -p l40s_normal_q -t 4:00:00 -n 1 --gres=gpu:1 --cpus-per-task=8 --mem=48G

module reset
module load Miniconda3/24.7.1-0
source activate $HOME/.conda/envs/oos-falcon-l40s

export HF_HOME=/scratch/$USER/hf_cache
export HF_HUB_CACHE=$HF_HOME/hub
export HF_DATASETS_CACHE=$HF_HOME/datasets
export TRANSFORMERS_CACHE=$HF_HUB_CACHE

cd ~/out-of-stock-detection/backend
python -m app.main
```

Then tunnel exactly the same way from your laptop:

```bash
ssh -N -L 8000:<compute-node>:8000 <pid>@falcon1.arc.vt.edu
```

## 11. Recommended First Test

Before involving the frontend, validate the backend and GPU setup first:

```bash
curl http://localhost:8000/
```

Expected response:

```json
{"message":"Welcome to the User API"}
```

Then upload one shelf image through the frontend and watch the backend log in the ARC job output.

## 12. Operational Notes

- ARC is not a permanent public app host. Jobs stop when wall time expires or when you cancel them.
- Interactive sessions should not be left idle.
- `/scratch` data is temporary and subject to cleanup.
- Keep the frontend local or on a normal web host; use ARC for GPU inference.
- If you need a more production-like architecture, keep the web app on EC2/Vercel and offload only shelf-analysis jobs to ARC.

## 13. Suggested Defaults for This Project

Start with this combination:

- Cluster: Falcon
- Partition: `l40s_normal_q`
- QoS: `fal_l40s_normal_base`
- Resources: `--gres=gpu:1 --cpus-per-task=8 --mem=48G`

If queue times are poor, try:

- `a30_normal_q`

If you need more GPU memory headroom, try:

- `a100_normal_q` on TinkerCliffs

## 14. Quick Command Summary

Create env:

```bash
ssh <pid>@falcon1.arc.vt.edu
interact -A <allocation> -p l40s_normal_q -t 2:00:00 -n 1 --gres=gpu:1 --cpus-per-task=8 --mem=48G
module reset
module load Miniconda3/24.7.1-0
conda create -y -n oos-falcon-l40s python=3.11
source activate $HOME/.conda/envs/oos-falcon-l40s
cd ~/out-of-stock-detection
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
```

Submit backend:

```bash
cd ~/out-of-stock-detection
sbatch \
  --account=<allocation> \
  --export=ALL,PROJECT_DIR=$HOME/out-of-stock-detection,CONDA_ENV=$HOME/.conda/envs/oos-falcon-l40s \
  scripts/arc_backend_gpu.slurm
```

Find node:

```bash
squeue -j <jobid> -o "%.18i %.20N %.10T"
```

Tunnel from laptop:

```bash
ssh -N -L 8000:<compute-node>:8000 <pid>@falcon1.arc.vt.edu
```

Run frontend locally:

```bash
cd /Users/Stuti/out-of-stock-detection/frontend
npm run dev
```
