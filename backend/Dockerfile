# syntax=docker/dockerfile:1

ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION} AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /usr/src/app

ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    appuser

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    libgl1 && \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
ARG TORCH_VARIANT=cpu
RUN pip install torch torchvision --index-url https://download.pytorch.org/whl/${TORCH_VARIANT}
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install -r requirements.txt

COPY backend/ .
COPY shelf_analyzer/ ./shelf_analyzer/

RUN mkdir -p weights && mkdir -p .cache/huggingface

RUN chown -R appuser /usr/src/app

USER appuser

ENV PYTHONPATH=/usr/src/app

EXPOSE ${BACKEND_PORT}

CMD ["python", "-m", "app.main"]
