# syntax=docker/dockerfile:1.6
# ./Dockerfile

FROM python:3.13-slim AS builder
ARG POETRY_VERSION=2.1.1
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Build deps for compiling wheels (if needed by your deps)
RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --upgrade pip \
 && pip install "poetry==${POETRY_VERSION}"
RUN poetry self add poetry-plugin-export

WORKDIR /app

# Copy lockfiles first for better Docker layer caching
COPY pyproject.toml poetry.lock .

# Export only the "main" dependencies (no dev/test) to a requirements file
# If you use extras or groups, see notes below.
RUN poetry export --no-cache --without-hashes --format=requirements.txt -o /tmp/requirements.txt --only main

# Create a lightweight virtualenv and install deps there
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

FROM python:3.13-slim AS runtime
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates tzdata \
      libgtk-3-0 libx11-xcb1 libasound2 \
      fonts-liberation fonts-noto-color-emoji \
      xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Bring in the venv from the builder
COPY --from=builder /opt/venv /opt/venv

COPY . .

CMD ["python", "run.py", "backend"]
