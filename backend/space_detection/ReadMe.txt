Space Detection

Quick start

1) Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

2) Install dependencies
pip install -U pip
pip install ultralytics roboflow matplotlib pillow pyyaml

3) Set Roboflow API key
export ROBOFLOW_API_KEY="<your_key>"

4) Train
python3 train_pipeline.py \
  --download-location ./downloads \
  --combined-root ./combined_dataset \
  --runs-root ./runs \
  --workers 1 \
  --output-best ./best.pt

5) Post-training checks
python3 verify_model_hash.py ./best.pt ./runs/emptyspace_p2_finetune/weights/best.pt

python3 - <<'PY'
from ultralytics import YOLO
m = YOLO("./best.pt")
metrics = m.val(data="./combined_dataset/data.yaml", split="test")
print("mAP50:", metrics.box.map50)
print("mAP50-95:", metrics.box.map)
print("Precision:", metrics.box.mp)
print("Recall:", metrics.box.mr)
PY

6) Run inference
python3 predict.py shelf_photo.jpg --model ./best.pt --conf 0.25 --output output.jpg
