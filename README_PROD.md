# Production Deployment

This guide covers deploying Out-of-Stock Detection to a production server.
The reference architecture uses AWS EC2 (backend) + AWS RDS (PostgreSQL) + Vercel (frontend),
but the steps adapt to any Linux host with Docker and a managed PostgreSQL instance.

---

## Architecture

```
Internet
    │
    ▼
EC2 Instance  ─────────────────────────────────────────
│  docker-compose.yml
│  └── oos_detection-backend  (Flask + YOLO + optional Qwen VL)
│      Port 80 → Flask :5000
│      Volume: ./weights → /usr/src/app/weights
└──────────────────────────────────────────────────────
    │ Private VPC
    ▼
AWS RDS PostgreSQL 16
    (oos_detection database, private subnet)

Vercel (optional)
    └── Static React build → calls backend API over HTTPS
```

**Frontend hosting**: the frontend is a static Vite build that can be served by
Vercel, Netlify, S3+CloudFront, or any CDN. It calls the backend API URL
configured in its environment at build time.

---

## Prerequisites

| Requirement | Minimum | Recommended |
|---|---|---|
| EC2 instance | t3.small, 2 GB RAM | t3.medium, 4 GB RAM |
| RAM for Qwen VL | — | 8–16 GB (or disable Qwen) |
| Docker | Engine 24+ + Compose v2 | Same |
| PostgreSQL | 14+ | RDS 16 Multi-AZ |
| `weights/best.pt` | Required | — |

> **Low-RAM servers (< 4 GB):** set `MAX_SKU_IDENTIFICATIONS=0` to disable Qwen VL.
> YOLO detection and gap analysis remain fully functional.

---

## Environment Variables

Copy [`config/backend.env.example`](config/backend.env.example) to `backend/.env` on the server
and fill in every value marked **required**.

### Full Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `SQLALCHEMY_DATABASE_URI` | **Yes** | — | Full PostgreSQL connection URI |
| `FLASK_ENV` | **Yes** | `development` | Set to `production` |
| `SECRET_KEY` | **Yes** | `dev-secret-key-…` | 64-byte hex random string (see below) |
| `BACKEND_PORT` | No | `5000` | Flask listen port inside the container |
| `FRONTEND_URL` | **Yes** | `http://localhost:5173` | Deployed frontend origin (used for CORS) |
| `SERVER_API_URL` | No | derived | Backend public URL; used in email links |
| `GMAIL_ADDRESS` | No | — | Gmail address for alert emails |
| `GMAIL_PASSWORD` | No | — | Gmail App Password (16 chars) |
| `IPQS_API_KEY` | No | — | NumVerify key for phone carrier lookup |
| `MAX_SKU_IDENTIFICATIONS` | No | `0` | `0` / number / `all` — controls Qwen VL |
| `SKU_IDENTIFICATION_CHUNK_SIZE` | No | `4` | Qwen batch size |
| `HF_HOME` | No | `~/.cache/huggingface` | Override Hugging Face cache location |
| `INVITATION_SECRET_KEY` | No | falls back to `SECRET_KEY` | Separate key for invitation tokens |

Generate a production `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(64))"
```

### Example `backend/.env` for production

```env
FLASK_ENV=production
BACKEND_PORT=5000
FRONTEND_URL=https://your-app.vercel.app
SERVER_API_URL=https://api.yourdomain.com

SQLALCHEMY_DATABASE_URI=postgresql://oos_user:StrongPassword@your-rds-host.rds.amazonaws.com:5432/oos_detection

SECRET_KEY=<64-byte-hex-from-command-above>

GMAIL_ADDRESS=alerts@yourdomain.com
GMAIL_PASSWORD=xxxx xxxx xxxx xxxx

MAX_SKU_IDENTIFICATIONS=0    # raise to "all" if instance has enough RAM
SKU_IDENTIFICATION_CHUNK_SIZE=4
```

---

## Server Setup

```bash
# 1. Install Docker Engine and Compose v2 (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # re-login after this

# 2. Clone the repository
git clone <repo-url>
cd out-of-stock-detection

# 3. Place your YOLO weights
scp /local/path/best.pt ec2-user@<ec2-ip>:~/out-of-stock-detection/weights/best.pt

# 4. Write backend/.env  (copy the example and fill values)
cp config/backend.env.example backend/.env
nano backend/.env   # fill in SQLALCHEMY_DATABASE_URI, SECRET_KEY, etc.
```

---

## Database Initialisation

Run once after the container is up for the first time.
The script is idempotent — re-running never deletes existing data.

```bash
# Create tables only
docker exec oos_detection-backend python -m db.init_db

# Create tables + insert sample data (safe to re-run — skipped if rows exist)
docker exec oos_detection-backend python -m db.init_db --seed
```

If you ever need to start fresh:

```bash
# Drop and recreate the database on RDS, then re-init
docker exec oos_detection-backend python -m db.init_db --seed
```

### Connecting to the production database directly

```bash
docker exec -it oos_detection-backend \
    psql "$SQLALCHEMY_DATABASE_URI"
```

---

## Build and Start

```bash
# First deploy (builds image, starts container)
docker compose up --build -d

# View startup logs
docker compose logs -f

# Verify backend is responding
curl http://localhost/
```

The production `docker-compose.yml` maps **port 80 → Flask :5000**.
Put an HTTPS reverse proxy (ALB or nginx) in front for TLS.

---

## Service Lifecycle

```bash
# Start
docker compose up -d

# Stop (keeps volumes/data)
docker compose down

# Restart
docker compose restart backend

# Rebuild after a code push
git pull
docker compose up --build -d

# View logs (follow)
docker compose logs -f backend

# View last 200 lines
docker compose logs --tail=200 backend
```

---

## Health Check

```bash
curl -sf http://localhost/ && echo "OK" || echo "UNHEALTHY"
```

For automated monitoring, point your uptime tool at `http://<ec2-ip>/`.

---

## HTTPS / TLS

Two recommended approaches:

**Option A — AWS Application Load Balancer**

1. Create an ALB with an ACM certificate.
2. Forward HTTPS (443) → HTTP on EC2 port 80.
3. Update `FRONTEND_URL` to your HTTPS domain.

**Option B — nginx on the same host**

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # Shelf analysis can take minutes — generous timeout:
        proxy_read_timeout 600s;
    }
}
```

---

## Hugging Face Model Cache (Qwen VL)

When `MAX_SKU_IDENTIFICATIONS` is non-zero, the Qwen2-VL model downloads automatically
on the first request. To avoid re-downloading across container restarts, mount a
persistent cache volume:

```yaml
# In docker-compose.yml — add under backend.volumes:
- hf_cache:/root/.cache/huggingface

volumes:
  hf_cache:
```

Or set `HF_HOME` to a host path and bind-mount it.

---

## Frontend Deployment (Vercel)

```bash
cd frontend
npm run build          # outputs to frontend/dist/

# Push dist/ to Vercel, Netlify, or S3
# Set VITE_BACKEND_URL=https://api.yourdomain.com in your hosting env vars
```

`vercel.json` is already present in `frontend/` for Vercel SPA routing.

---

## Scaling Notes

| Scenario | Recommendation |
|---|---|
| > 50 concurrent users | Move to ECS Fargate + RDS Multi-AZ |
| GPU-accelerated Qwen VL | Use a `g4dn.xlarge` EC2 and remove the CPU-only torch install |
| Large image volumes | Mount EFS or S3 for uploaded images instead of ephemeral container FS |
| Zero-downtime deploys | ECS rolling update or blue/green with ALB target groups |

---

## Networking: AWS Security Group Requirements

### EC2 Security Group (backend server)

| Direction | Port | Protocol | Source | Purpose |
|---|---|---|---|---|
| Inbound | 80 | TCP | `0.0.0.0/0` | HTTP from internet (redirect to HTTPS via ALB) |
| Inbound | 443 | TCP | `0.0.0.0/0` | HTTPS from internet (ALB termination) |
| Inbound | 22 | TCP | Your IP only | SSH admin access |
| Outbound | All | All | `0.0.0.0/0` | Allow outbound (model downloads, SMTP) |

> If you use an ALB, restrict inbound 80/443 to the ALB security group ID instead of `0.0.0.0/0`.

### RDS Security Group (PostgreSQL)

**The database must never be "Publicly Accessible"** (disable that checkbox in the RDS console).

| Direction | Port | Protocol | Source | Purpose |
|---|---|---|---|---|
| Inbound | 5432 | TCP | EC2 Security Group ID | Application DB access — EC2 only |
| Inbound | 5432 | TCP | Your IP (optional) | Admin access from your workstation |

No other inbound rules. No outbound rules needed for RDS.

---

## Database Least-Privilege Setup

The application should connect with a **limited user** that can only read/write
application rows — not drop tables, alter schemas, or access system catalogs.

Run [`ops/db_least_privilege.sql`](ops/db_least_privilege.sql) once as the RDS admin after the first `init_db.py` run:

```bash
psql "postgresql://admin:<admin-pw>@<rds-host>:5432/oos_detection" \
     -f ops/db_least_privilege.sql
```

Then update `SQLALCHEMY_DATABASE_URI` to use the `oos_app` user, not the admin account.

---

## Security Checklist

### Before first deploy

- [ ] `SECRET_KEY` is a fresh random value (`python -c "import secrets; print(secrets.token_hex(64))"`)
- [ ] `FLASK_ENV=production` is set
- [ ] `SQLALCHEMY_DATABASE_URI` uses the least-privilege `oos_app` user, not the admin
- [ ] RDS instance has **Publicly Accessible = No**
- [ ] RDS Security Group restricts port 5432 to the EC2 SG only
- [ ] `backend/.env` is **not** committed to git (it is in `.gitignore`)
- [ ] `ops/db_least_privilege.sql` has been run and the `<REPLACE_WITH_STRONG_PASSWORD>` placeholder replaced
- [ ] `FRONTEND_URL` is set to the deployed HTTPS origin (not `localhost`)
- [ ] No `.pem` or private key files are tracked in git (`bash scripts/check_secrets.sh`)

### Production server

- [ ] Flask dev server is **not** used — Gunicorn runs via `docker-compose.yml` CMD
- [ ] HTTPS is terminated at ALB or nginx (never HTTP-only in production)
- [ ] `docker-compose.yml` does not have `DEBUG=true` or `FLASK_DEBUG=1`
- [ ] Docker image is built from a pinned base tag (not `latest`) in production
- [ ] Container runs as non-root `appuser` (already enforced in `backend/Dockerfile`)

### Ongoing hygiene

- [ ] Run `bash scripts/check_secrets.sh` before every commit (or set as a pre-commit hook)
- [ ] Rotate `SECRET_KEY` and `GMAIL_PASSWORD` if either is ever exposed
- [ ] Rotate RDS password on a schedule or after any personnel change
- [ ] Review IAM role attached to EC2 — it should have no permissions beyond CloudWatch logs
- [ ] Keep `requirements.txt` dependencies updated; audit with `pip-audit` periodically

### Set up check_secrets.sh as a git pre-commit hook

```bash
# From repo root:
echo '#!/usr/bin/env bash
bash scripts/check_secrets.sh --staged' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

After this, `git commit` will abort automatically if any secret pattern is detected in staged files.
