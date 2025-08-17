#!/bin/bash

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <git_hash>"
    echo "Example: $0 b846b27b6f8cafe23138310b5272863c942dc400"
    exit 1
fi

HASH=$1
echo "Using new git hash: $HASH"

echo "Extracting current hash from pyproject.toml..."
CURRENT_HASH=$(grep -o 'botasaurus.*@[a-f0-9]\{40\}' pyproject.toml | head -1 | grep -o '[a-f0-9]\{40\}')

echo "Current hash: $CURRENT_HASH"

echo "Updating pyproject.toml with new hash..."
sed -i '' "s|botasaurus = { git = \"https://github.com/barbatus/botasaurus.git@[^\"]*\"|botasaurus = { git = \"https://github.com/barbatus/botasaurus.git@$HASH\"|g" pyproject.toml
sed -i '' "s|botasaurus-server = { git = \"https://github.com/barbatus/botasaurus.git@[^\"]*\"|botasaurus-server = { git = \"https://github.com/barbatus/botasaurus.git@$HASH\"|g" pyproject.toml

echo "Updating poetry.lock with new hash..."
sed -i '' "s|resolved_reference = \"$CURRENT_HASH\"|resolved_reference = \"$HASH\"|g" poetry.lock

echo "Updating poetry lock file..."
poetry lock

echo "Installing dependencies..."
poetry install --no-root

echo "Starting minikube with 8GB memory and 6 CPUs..."
minikube start --memory=8g --cpus=6

echo "Building Docker image for ARM64 platform..."
docker rmi octopus:dev 2>/dev/null || true
docker buildx build --platform linux/arm64 --no-cache -t octopus:dev1 .

echo "Cleaning up Docker system in minikube..."
minikube ssh -- docker system prune -af

echo "Loading Docker image into minikube..."
minikube image load octopus:dev1

echo "Create configmap from .env file..."
kubectl create configmap app-config -n app \
  --from-env-file=.env \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Set env vars from configmap..."
kubectl set env -n app deployment/celery-worker --from=configmap/app-config
kubectl set env -n app deployment/api --from=configmap/app-config

echo "Applying local overlay..."
kubectl apply -k k8s/overlays/local

echo "Deleting all pods in app namespace..."
kubectl -n app rollout restart deploy/celery-worker deploy/api

echo "Waiting 30 seconds for pods to terminate..."
sleep 30

echo "Port-forwarding API service..."
kubectl -n app port-forward svc/api 8000:80
