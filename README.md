# oos_detection

Project Structure

Your folder structure should look like this:

```
[your folder]/
│
├── frontend/  
│   ├── src/
│   │   └── main.tsx
│   │   └── Routers.tsx
│   ├── public/
│   ├── package.json
│   ├── ...
│   └── vite.config.js
│
├── backend/
│   ├── venv/
│   ├── app.py
│   ├── requirements.txt
└── README.md 
```

---

## Github Setup

### Clone the Repository

```
git clone https://github.com/yoonlee201/out-of-stock-shelf-intelligence.git
```

### Create a New Branch

Always create a new branch before making changes.

```
git pull origin master
git checkout -b <branch-name>
```

Examples:

```
git checkout -b yoonje/add-login
git checkout -b yoonje/navbar-responsive
```

### Make Changes & Commit

After editing files, check what’s changed:

```
git status
```

Add your changes:

```
git add .
```

Then commit them with a clear message:

```
git commit -m "Add login page component"
```

### Push to GitHub

Push your branch to the remote repository:

```
git push origin <branch-name>
```

💡 Example:

```
git push origin feature/add-login
```

### Pull Latest Changes

Before pushing or merging, always pull updates from main to avoid conflicts:

```
git checkout master
git pull origin master
```

Then switch back to your branch and merge the latest main updates:

```
git checkout <branch-name>
git merge master
```

or

```
git checkout <branch-name>
git pull master
```

If there are conflicts, fix them manually, then commit again:

```
git add .
git commit -m "Resolve merge conflicts"
```

### Open a Pull Request (PR)

Once your feature is ready:

```
1.	Go to your repository on GitHub
2.	Click "Pull Request" Tab & "New pull request"
3.	Add a title and description for your changes
4.	Submit the pull request
```

### Common Commands Reference

```
Action	Command
Clone repo	git clone <url>
Create new branch	git checkout -b <branch>
Switch branch	git checkout <branch>
Add files	git add .
Commit changes	git commit -m "message"
Push branch	git push origin <branch>
Pull latest main	git pull origin main
Merge main into branch	git merge main
Delete branch (local)	git branch -d <branch>
Delete branch (remote)	git push origin --delete <branch>
```

### Summary

#### Clone project

```
git clone https://github.com/yoonlee201/out-of-stock-shelf-intelligence.git
```

#### Create feature branch

```
git checkout -b <name>/<feature>
```

#### Make changes, then:

```
git add .
git commit -m "<message>"
```

#### Push branch

```
git push origin <branch_name>
```

---

## Front End

### Prerequisites

Before starting, ensure you have the following installed:
	-	Node.js (version 16+ recommended)
	-	npm (comes with Node.js)

Check versions:

```
node -v
npm -v
```

### Run Locally

1. Run Each App

```
cd frontend
npm run dev
```

Runs on: http://localhost:5173

2. Updating Dependencies

```
npm install <package-name>
```

### Deleting and Reinstalling Dependencies

If you need a clean reinstall:

```
rm -rf node_modules package-lock.json
npm install
```

---

## Backend Setup Guide

This guide explains how to set up and run the backend environment using Python and a virtual environment.

### Install Docker

Install docker from this link: https://www.docker.com/101-tutorial/

If completed, turn on you docker everytime you want to run your backend locally

#### Initial setup (only once)

**For Windows PowerShell:**

```powershell
cd backend
New-Item -ItemType File -Name ".env" -Force
Set-Content -Path ".env" -Value "SQLALCHEMY_DATABASE_URI=postgresql://oos_detection:oos_detection_dev_password@db:5432/oos_detection"
cd ..
```

**For Unix/Linux/Mac:**

```bash
cd backend
touch .env
echo SQLALCHEMY_DATABASE_URI=postgresql://oos_detection:oos_detection_dev_password@db:5432/oos_detection > .env
cd ..
```

### Run Docker

#### for changes to just the py files

```
docker compose -f compose.dev.yml up --build
```

#### For live updates

```
docker compose -f compose.dev.yml watch backend frontend db
```

### for changes to the sql

```
docker cp ./data.sql pg-oos_detection:/data.sql
docker exec -it pg-oos_detection psql -U oos_detection -f data.sql 
```

## YOLOv8 Setup

1) YOLO-only dependencies are in:

- `backend/requirements.yolo.txt`

2) Create and activate a virtual environment, then install dependencies:

**macOS / Linux**

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements.yolo.txt
```

**Windows (PowerShell)**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements.yolo.txt
```

3) Quick verify YOLO + OpenCV install:

```bash
python -c "from ultralytics import YOLO; import cv2; YOLO('yolov8n.pt'); print('YOLOv8 + OpenCV ready')"
```

If you use Docker for backend, rebuild the backend image so the new dependency is installed:

```bash
docker compose -f compose.dev.yml up --build backend
```

## Space Detection

Quick start for `backend/space_detection`:

```bash
cd backend/space_detection
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install ultralytics roboflow matplotlib pillow pyyaml
export ROBOFLOW_API_KEY="<your_key>"
```

Train:

```bash
python3 train_pipeline.py \
  --download-location ./downloads \
  --combined-root ./combined_dataset \
  --runs-root ./runs \
  --workers 1 \
  --output-best ./best.pt
```

Post-training checks:

```bash
python3 verify_model_hash.py ./best.pt ./runs/emptyspace_p2_finetune/weights/best.pt
```

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

Inference:

```bash
python3 predict.py ./combined_dataset/valid/images/ds1_1252.jpg --model ./best.pt --conf 0.25 --output ./output.jpg
```
