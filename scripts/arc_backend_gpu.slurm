#!/bin/bash
# Submit with:
#   sbatch \
#     --account=<your_allocation> \
#     --export=ALL,PROJECT_DIR=/projects/<project>/out-of-stock-detection,CONDA_ENV=/home/<pid>/.conda/envs/oos-falcon-l40s \
#     scripts/arc_backend_gpu.slurm
#
# Resource overrides should be passed directly to sbatch, for example:
#   sbatch --account=<your_allocation> --partition=a100_normal_q --qos=tc_a100_normal_base --gres=gpu:1 --cpus-per-task=8 --mem=48G --time=08:00:00 ...
#
# Optional exported variables:
#   BACKEND_PORT=8000
#   HF_CACHE_ROOT=/scratch/$USER/hf_cache

#SBATCH --job-name=oos-backend-gpu
#SBATCH --partition=l40s_normal_q
#SBATCH --qos=fal_l40s_normal_base
#SBATCH --gres=gpu:1
#SBATCH --cpus-per-task=8
#SBATCH --mem=48G
#SBATCH --time=08:00:00
#SBATCH --output=%x-%j.out

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/out-of-stock-detection}"
CONDA_ENV="${CONDA_ENV:-$HOME/.conda/envs/oos-falcon-l40s}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
HF_CACHE_ROOT="${HF_CACHE_ROOT:-/scratch/$USER/hf_cache}"

echo "Starting out-of-stock-detection backend on ARC GPU"
echo "Job ID: ${SLURM_JOB_ID:-unknown}"
echo "Node: $(hostname)"
echo "Partition: ${SLURM_JOB_PARTITION:-unknown}"
echo "Project dir: ${PROJECT_DIR}"
echo "Conda env: ${CONDA_ENV}"
echo "Backend port: ${BACKEND_PORT}"
echo "HF cache root: ${HF_CACHE_ROOT}"

module reset
module load Miniconda3/24.7.1-0
source activate "${CONDA_ENV}"

mkdir -p "${HF_CACHE_ROOT}" "${HF_CACHE_ROOT}/hub" "${HF_CACHE_ROOT}/datasets"

export HF_HOME="${HF_CACHE_ROOT}"
export HF_HUB_CACHE="${HF_HOME}/hub"
export HF_DATASETS_CACHE="${HF_HOME}/datasets"
export TRANSFORMERS_CACHE="${HF_HUB_CACHE}"
export PYTHONUNBUFFERED=1

cd "${PROJECT_DIR}/backend"

if [ ! -f ".env" ]; then
    echo "Missing ${PROJECT_DIR}/backend/.env"
    echo "Create it on ARC before running this job."
    exit 1
fi

python - <<'PY'
import torch
print("torch.cuda.is_available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("torch.cuda.device_count:", torch.cuda.device_count())
    print("torch.cuda.current_device:", torch.cuda.current_device())
    print("torch.cuda.get_device_name:", torch.cuda.get_device_name(0))
PY

echo
echo "Backend startup command:"
echo "  cd ${PROJECT_DIR}/backend && python -m app.main"
echo
echo "After the job starts, use squeue to find the compute node and open an SSH tunnel from your laptop."
echo

python -m app.main
