#!/usr/bin/env bash
# =============================================================================
# setup.sh — Local development bootstrap for Out-of-Stock Detection
#
# USAGE
#   bash scripts/setup.sh [OPTIONS]
#
# OPTIONS
#   --lite        Lightweight mode: YOLO detection + gap analysis only.
#                 Disables Qwen VL SKU labeling — no multi-GB model download.
#                 Recommended for machines with < 8 GB RAM or slow networks.
#
#   --no-docker   Raw local mode: no Docker required.
#                 Uses Python venv + SQLite + npm dev server.
#                 Skips Qwen VL automatically (same as --lite).
#
#   --seed        Auto-seed the database with sample data (skips the prompt).
#
#   --help, -h    Show this help and exit.
#
# REQUIREMENTS (Docker mode, default)
#   - Docker Desktop (or Docker Engine + Compose v2)
#   - weights/best.pt (trained YOLO model file)
#
# REQUIREMENTS (--no-docker mode)
#   - Python 3.11
#   - Node.js 18+ and npm
#   - weights/best.pt (trained YOLO model file)
# =============================================================================
set -euo pipefail

# ── Parse arguments ───────────────────────────────────────────────────────────
LITE=false
NO_DOCKER=false
AUTO_SEED=false

for arg in "$@"; do
    case "$arg" in
        --lite)      LITE=true ;;
        --no-docker) NO_DOCKER=true; LITE=true ;;
        --seed)      AUTO_SEED=true ;;
        --help|-h)
            sed -n '/^# USAGE/,/^# ====/p' "$0" | grep -v '^# ====' | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *) echo "Unknown argument: $arg  (try --help)"; exit 1 ;;
    esac
done

# ── Colour helpers ────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
    BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
else
    BOLD=''; GREEN=''; YELLOW=''; RESET=''
fi
info()    { echo -e "${GREEN}▶${RESET} $*"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $*"; }
section() { echo -e "\n${BOLD}$*${RESET}"; }

# ── Sanity checks ─────────────────────────────────────────────────────────────
section "Checking prerequisites…"

if [ ! -f weights/best.pt ]; then
    warn "weights/best.pt not found — YOLO detection will fail until you add it."
    warn "Continuing setup anyway."
fi

if [ "$NO_DOCKER" = "false" ]; then
    if ! docker info > /dev/null 2>&1; then
        echo "Error: Docker is not running. Start Docker Desktop and try again."
        echo "  Or run with --no-docker for a Docker-free local setup."
        exit 1
    fi
fi

# ── Determine backend port ────────────────────────────────────────────────────
section "Configuring environment…"

if [ -f backend/.env ] && grep -q "^BACKEND_PORT=" backend/.env; then
    PORT=$(grep "^BACKEND_PORT=" backend/.env | cut -d= -f2)
    info "Existing backend/.env found (port ${PORT}). Skipping env generation."
    info "Delete backend/.env to reconfigure."
else
    if [ "$NO_DOCKER" = "true" ]; then
        PORT=8000
        info "No-Docker mode — using default port ${PORT}."
    else
        read -rp "Enter backend port (default: 8000): " _PORT
        PORT=${_PORT:-8000}
    fi
fi

# ── Write backend/.env ────────────────────────────────────────────────────────
if [ ! -f backend/.env ]; then
    MAX_SKU=0   # default: Qwen disabled
    if [ "$LITE" = "false" ]; then
        MAX_SKU=all
    fi

    if [ "$NO_DOCKER" = "true" ]; then
        DB_URI="sqlite:///oos_detection.db"
    else
        DB_URI="postgresql://oos_detection:oos_detection_dev_password@db:5432/oos_detection"
    fi

    # Build backend/.env from template, substituting key values
    {
        echo "BACKEND_PORT=${PORT}"
        echo "SQLALCHEMY_DATABASE_URI=${DB_URI}"
        echo "MAX_SKU_IDENTIFICATIONS=${MAX_SKU}"
        # Preserve every other line from the template (skip lines we already set)
        grep -v "^BACKEND_PORT=" config/backend.env.example \
          | grep -v "^SQLALCHEMY_DATABASE_URI=" \
          | grep -v "^MAX_SKU_IDENTIFICATIONS=" \
          | grep -v "^# Option [ABC]" \
          | grep -v "^# SQLALCHEMY_DATABASE_URI="
    } > backend/.env

    info "backend/.env written (port=${PORT}, db=$([ "$NO_DOCKER" = "true" ] && echo SQLite || echo PostgreSQL), qwen=$([ "$LITE" = "true" ] && echo disabled || echo enabled))."
else
    # Env exists — apply --lite override if requested
    if [ "$LITE" = "true" ]; then
        current_max=$(grep "^MAX_SKU_IDENTIFICATIONS=" backend/.env | cut -d= -f2 || echo "0")
        if [ "$current_max" != "0" ]; then
            if [[ "$(uname)" == "Darwin" ]]; then
                sed -i '' 's/^MAX_SKU_IDENTIFICATIONS=.*/MAX_SKU_IDENTIFICATIONS=0/' backend/.env
            else
                sed -i 's/^MAX_SKU_IDENTIFICATIONS=.*/MAX_SKU_IDENTIFICATIONS=0/' backend/.env
            fi
            info "[--lite] Set MAX_SKU_IDENTIFICATIONS=0 in existing backend/.env."
        fi
    fi
fi

# Keep root .env in sync (docker compose uses ${BACKEND_PORT} variable)
echo "BACKEND_PORT=${PORT}" > .env

# ── Write frontend/.env ───────────────────────────────────────────────────────
if [ ! -f frontend/.env ] || ! grep -q "^VITE_BACKEND_URL=" frontend/.env; then
    echo "VITE_BACKEND_URL=http://localhost:${PORT}" > frontend/.env
    info "frontend/.env written."
else
    info "Existing frontend/.env found. Skipping."
fi

# =============================================================================
# BRANCH A — Docker Compose (default)
# =============================================================================
if [ "$NO_DOCKER" = "false" ]; then

    section "Starting Docker services…"
    docker compose -f compose.dev.yml down 2>/dev/null || true
    if ! docker compose -f compose.dev.yml up --build -d; then
        echo "Error: docker compose failed. Review the output above."
        exit 1
    fi

    section "Waiting for backend health check…"
    READY=false
    for i in $(seq 1 30); do
        if docker exec oos_detection-backend \
               curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1; then
            READY=true
            break
        fi
        if [ "$i" -eq 30 ]; then break; fi
        sleep 2
    done

    if [ "$READY" = "false" ]; then
        echo "Error: backend did not pass health check within 60 s."
        echo "  Logs: docker compose -f compose.dev.yml logs backend"
        exit 1
    fi
    info "Backend is ready."

    section "Initialising database…"
    if [ "$AUTO_SEED" = "true" ]; then
        SEED_CHOICE="y"
    else
        read -rp "Seed the database with sample data? [y/N]: " SEED_CHOICE
    fi

    if [[ "$SEED_CHOICE" =~ ^[Yy]$ ]]; then
        docker exec oos_detection-backend python -m db.init_db --seed
    else
        docker exec oos_detection-backend python -m db.init_db
    fi

    # ── Print summary ─────────────────────────────────────────────────────────
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  Out-of-Stock Detection — dev stack is live          ║"
    echo "║                                                      ║"
    printf "║  Frontend  →  http://localhost:%-22s║\n" "5173"
    printf "║  Backend   →  http://localhost:%-22s║\n" "${PORT}"
    if [ "$LITE" = "true" ]; then
    echo "║  Mode      →  Lite  (YOLO + gaps; Qwen VL off)       ║"
    else
    echo "║  Mode      →  Full  (YOLO + gaps + Qwen VL)          ║"
    fi
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""
    info "Starting watch mode for hot-reload (Ctrl+C to stop)…"
    docker compose -f compose.dev.yml watch --no-up

# =============================================================================
# BRANCH B — No Docker (Python venv + SQLite + npm)
# =============================================================================
else

    section "Setting up Python virtual environment…"
    if [ ! -d backend/.venv ]; then
        python3.11 -m venv backend/.venv
        info "Created backend/.venv"
    else
        info "backend/.venv already exists — skipping creation."
    fi

    # shellcheck disable=SC1091
    source backend/.venv/bin/activate

    info "Installing Python dependencies…"
    pip install --upgrade pip --quiet
    # PyTorch CPU-only (much smaller than the full package)
    pip install torch torchvision \
        --index-url https://download.pytorch.org/whl/cpu --quiet
    pip install -r backend/requirements.txt --quiet
    info "Python dependencies installed."

    section "Initialising SQLite database…"
    (
        cd backend
        export PYTHONPATH="$(pwd)"
        if [ "$AUTO_SEED" = "true" ]; then
            python -m db.init_db --seed
        else
            read -rp "Seed the database with sample data? [y/N]: " SEED_CHOICE
            if [[ "$SEED_CHOICE" =~ ^[Yy]$ ]]; then
                python -m db.init_db --seed
            else
                python -m db.init_db
            fi
        fi
    )
    info "Database ready (SQLite: backend/oos_detection.db)."

    section "Installing frontend dependencies…"
    (cd frontend && npm install --silent)
    info "npm install complete."

    # ── Print summary and start both servers ──────────────────────────────────
    echo ""
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  Out-of-Stock Detection — no-Docker local setup      ║"
    echo "║                                                      ║"
    printf "║  Frontend  →  http://localhost:%-22s║\n" "5173 (starting below)"
    printf "║  Backend   →  http://localhost:%-22s║\n" "${PORT}"
    echo "║  Database  →  SQLite (backend/oos_detection.db)      ║"
    echo "║  Mode      →  Lite  (YOLO + gaps; Qwen VL off)       ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo ""
    warn "Starting backend in background, then frontend in foreground."
    warn "Ctrl+C stops the frontend; backend PID is saved to .backend.pid"

    # Start backend
    (
        source backend/.venv/bin/activate
        cd backend
        export PYTHONPATH="$(pwd)"
        python -m app.main &
        echo $! > ../.backend.pid
    )

    # Give Flask a moment to bind
    sleep 2

    # Start frontend in foreground
    (cd frontend && npm run dev)
fi
