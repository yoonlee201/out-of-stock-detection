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
    apt-get install -y postgresql-client curl && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install -r requirements.txt

COPY requirements.yolo.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install -r requirements.yolo.txt

COPY . .

RUN chown -R appuser /usr/src/app

USER appuser

EXPOSE 5000


ENV PYTHONPATH=/usr/src/app

# Default command: start the app
CMD ["python", "-m", "app.main"]
