# syntax=docker/dockerfile:1

ARG CUDA_VERSION=12.1.1
FROM docker.io/nvidia/cuda:${CUDA_VERSION}-cudnn8-runtime-ubuntu22.04 AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /usr/src/app

ARG UID=10001
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-dev \
    python3-pip \
    postgresql-client \
    curl \
    libgl1 && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf /usr/bin/python3.11 /usr/bin/python3 && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    ln -sf /usr/bin/pip3 /usr/bin/pip

RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    appuser

COPY backend/requirements.txt .
RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install -r requirements.txt

COPY backend/ .
COPY shelf_analyzer/ ./shelf_analyzer/

RUN mkdir -p weights && mkdir -p .cache/huggingface

RUN chown -R appuser /usr/src/app

USER appuser

ENV PYTHONPATH=/usr/src/app

EXPOSE 5000

CMD ["python", "-m", "app.main"]
