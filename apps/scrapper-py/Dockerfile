# syntax=docker/dockerfile:1.6
# ./Dockerfile

FROM python:3.11-slim AS builder
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

FROM python:3.11-slim AS runtime
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

ARG TARGETARCH

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates gnupg wget xdg-utils curl \
      # common runtime libs Chrome needs
      libnss3 libxss1 libasound2 libgbm1 fonts-liberation libu2f-udev \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    if [ "${TARGETARCH:-amd64}" = "amd64" ]; then \
        apt-get update; \
        mkdir -p /etc/apt/keyrings; \
        wget -qO- https://dl.google.com/linux/linux_signing_key.pub \
          | gpg --dearmor -o /etc/apt/keyrings/google-linux.gpg; \
        echo 'deb [arch=amd64 signed-by=/etc/apt/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main' \
          > /etc/apt/sources.list.d/google-chrome.list; \
        apt-get update && apt-get install -y --no-install-recommends google-chrome-stable \
          && rm -rf /var/lib/apt/lists/*; \
    else \
        # arm64 path: use Debian Chromium and expose it as "google-chrome"
        apt-get update && apt-get install -y --no-install-recommends chromium \
          && rm -rf /var/lib/apt/lists/* \
          && ln -sf /usr/bin/chromium /usr/bin/google-chrome; \
    fi

WORKDIR /app

# Bring in the venv from the builder
COPY --from=builder /opt/venv /opt/venv

COPY . .

CMD ["python", "run.py", "backend"]
