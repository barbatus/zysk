#!/bin/bash
set -euo pipefail

# Deploy agentic worker to GKE

trap 'echo "❌ Error on line $LINENO"; exit 1' ERR

# Change to the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}"

AR_LOC="${AR_LOC:-europe-central2}"
PROJECT_ID="${PROJECT_ID:-zysk-dev}"
AR_REPO="${AR_REPO:-app-images}"
IMAGE_NAME="${IMAGE_NAME:-agentic}"
CLUSTER="${CLUSTER:-zysk-dev}"
REGION="${REGION:-europe-central2}"
NAMESPACE="${NAMESPACE:-agentic}"
TAG="${TAG:-$(date +%Y%m%d-%H%M%S)}"
PLATFORM="${PLATFORM:-linux/amd64}"
MODE="${MODE:-build}" # values: build | config-only

usage() {
  cat <<EOF
Usage: $0 [--build | --config-only]

  --build           Build a new image and deploy (default)
  --config-only     Skip image build; apply configuration changes and deploy
  -h, --help        Show this help

Environment overrides are also supported: MODE=build|config-only
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      MODE="build"; shift ;;
    --config-only|--no-build)
      MODE="config-only"; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown argument: $1"; usage; exit 1 ;;
  esac
done

IMAGE="${AR_LOC}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${IMAGE_NAME}:${TAG}"
IMAGE_TO_INJECT=""

echo "🛠️ Mode: ${MODE}"

if [[ "$MODE" == "build" ]]; then
  echo "🔐 Configuring Docker auth for Artifact Registry..."
  gcloud auth configure-docker "${AR_LOC}-docker.pkg.dev" --quiet

  echo "🏗️  Building Docker image..."
  if [[ -n "$PLATFORM" ]]; then
    echo "Building with platform $PLATFORM"
    docker buildx build --platform "$PLATFORM" -t "${IMAGE_NAME}:${TAG}" -f Dockerfile --load ../../
  else
    docker build -t "${IMAGE_NAME}:${TAG}" -f Dockerfile ../../
  fi

  echo "🏷️  Tagging & 📤 pushing to Artifact Registry: ${IMAGE}"
  docker tag "${IMAGE_NAME}:${TAG}" "${IMAGE}"
  docker push "${IMAGE}"

  IMAGE_TO_INJECT="$IMAGE"
else
  echo "Skipping image build; applying configuration only."
  echo "🔎 Resolving latest image tag from Artifact Registry..."
  IMAGE_PATH="${AR_LOC}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${IMAGE_NAME}"
  # Prefer timestamped tags (YYYYMMDD-HHMMSS); fallback to 'latest' if present
  LATEST_TAG=$(gcloud artifacts docker tags list "$IMAGE_PATH" --format="value(TAG)" 2>/dev/null | grep -E '^[0-9]{8}-[0-9]{6}$' | sort | tail -n 1 || true)
  if [[ -z "${LATEST_TAG:-}" ]]; then
    LATEST_TAG=$(gcloud artifacts docker tags list "$IMAGE_PATH" --format="value(TAG)" 2>/dev/null | grep -x "latest" | tail -n 1 || true)
  fi
  if [[ -n "${LATEST_TAG:-}" ]]; then
    IMAGE_TO_INJECT="${IMAGE_PATH}:${LATEST_TAG}"
    echo "Using latest image: ${IMAGE_TO_INJECT}"
  else
    echo "No suitable tag found for ${IMAGE_PATH}."
  fi
fi

echo "🔧 Getting GKE credentials..."
gcloud container clusters get-credentials "${CLUSTER}" --region "${REGION}" --project "${PROJECT_ID}"

echo "📦 Ensuring namespace exists: ${NAMESPACE}"
kubectl get ns "${NAMESPACE}" >/dev/null 2>&1 || kubectl create ns "${NAMESPACE}"

echo "📝 Create configmap from .env file..."
kubectl create configmap agentic-config -n ${NAMESPACE} \
  --from-env-file=.env \
  --dry-run=client -o yaml | kubectl apply -f -

RENDERED_MANIFEST="$(mktemp)"
cleanup() { rm -f "$RENDERED_MANIFEST" "${RENDERED_MANIFEST}.bak"; }
trap cleanup EXIT

echo "🧩 Rendering kustomize overlay: k8s/overlays/gke"
kubectl kustomize k8s/overlays/gke > "$RENDERED_MANIFEST"

# Replace placeholder tokens if your overlay uses them
if [[ -n "$IMAGE_TO_INJECT" ]]; then
  sed -i.bak "s|IMAGE_PLACEHOLDER|${IMAGE_TO_INJECT}|g" "$RENDERED_MANIFEST" || true
fi
sed -i.bak "s|NAMESPACE_PLACEHOLDER|${NAMESPACE}|g" "$RENDERED_MANIFEST" || true

# In config-only mode, fail if IMAGE_PLACEHOLDER is still present
if [[ "$MODE" == "config-only" ]] && grep -q "IMAGE_PLACEHOLDER" "$RENDERED_MANIFEST"; then
  echo "Error: IMAGE_PLACEHOLDER found in rendered manifest but no image resolved. Run with --build or ensure your overlay pins an image tag."
  exit 1
fi

echo "🚀 Applying manifest..."
kubectl apply -n "${NAMESPACE}" -f "$RENDERED_MANIFEST"

echo "⚙️  Set env vars from configmap..."
kubectl set env -n ${NAMESPACE} deployment/agentic-worker --from=configmap/agentic-config

echo "🔄 Restarting deployment to pick up new config..."
kubectl -n ${NAMESPACE} rollout restart deploy/agentic-worker

echo "✅ Deployment completed successfully!"
echo "📸 Image deployed: ${IMAGE_TO_INJECT:-(unchanged)}"
echo "Check status with: kubectl get pods -n ${NAMESPACE}"
