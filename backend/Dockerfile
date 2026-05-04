# syntax=docker/dockerfile:1

ARG PYTHON_VERSION=3.11-slim
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
    apt-get install -y \
    postgresql-client \
    curl \
    libxcb1 \
    libgl1 \
    libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    python -m pip install -r requirements.txt

COPY . .

RUN chown -R appuser /usr/src/app && \
    mkdir -p /huggingface_cache && \
    chown -R appuser /huggingface_cache

USER appuser

EXPOSE ${BACKEND_PORT}


ENV PYTHONPATH=/usr/src/app

# Default command: start the app
CMD ["python", "-m", "app.main"]
