# Shelf Analyzer

## Project Overview

This project performs two-stage shelf analysis using YOLO + Qwen-VL. YOLO handles object localization on the shelf, and Qwen-VL is used to identify the specific product details from each detected crop.

## Setup

```bash
pip install -r requirements.txt
```

## Training

```bash
python train.py
```

Note: training downloads the SKU-110K dataset, which is about 13.6GB.

## Run Dashboard

```bash
streamlit run dashboard.py
```

## How it works

- YOLO detects item locations on the shelf.
- Gap analysis finds empty spaces between products.
- Qwen-VL identifies each product from its crop.

## GPU note

- Use `Qwen2-VL-2B-Instruct` for systems under 16GB VRAM.
- Use `Qwen2-VL-7B-Instruct` for systems with 16GB+ VRAM.
