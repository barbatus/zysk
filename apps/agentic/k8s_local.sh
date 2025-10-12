#!/bin/bash
set -e

# Build and deploy agentic worker locally

echo "Building Docker image..."
docker build -t agentic:dev .

# Use .env.local for local development, fallback to .env if not exists
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "Warning: .env.local not found, using .env"
  ENV_FILE=".env"
fi

echo "Create configmap from $ENV_FILE file..."
kubectl create configmap agentic-config -n agentic \
  --from-env-file=$ENV_FILE \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Applying Kubernetes manifests..."
kubectl apply -k k8s/overlays/local/

echo "Set env vars from configmap..."
kubectl set env -n agentic deployment/agentic-worker --from=configmap/agentic-config

echo "Restarting deployment to pick up new config..."
kubectl -n agentic rollout restart deploy/agentic-worker

echo "Deployment complete!"
echo "Check status with: kubectl get pods -n agentic"