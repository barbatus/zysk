#!/bin/bash

set -e

echo "Updating poetry lock file..."
poetry lock

echo "Installing dependencies..."
poetry install --no-root

echo "Starting minikube with 8GB memory and 6 CPUs..."
minikube start --memory=8g --cpus=6

echo "Building Docker image for ARM64 platform..."
docker rmi octopus:dev 2>/dev/null || true
docker buildx build --platform linux/arm64 --no-cache -t octopus:dev .

echo "Cleaning up Docker system in minikube..."
minikube ssh -- docker system prune -af

echo "Loading Docker image into minikube..."
minikube image load octopus:dev

echo "Create configmap from .env file..."
kubectl create configmap app-config -n app \
  --from-env-file=.env \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Applying local overlay..."
kubectl apply -k k8s/overlays/local

echo "Set env vars from configmap..."
kubectl set env -n app deployment/worker --from=configmap/app-config
kubectl set env -n app deployment/api --from=configmap/app-config

echo "Deleting all pods in app namespace..."
kubectl -n app rollout restart deploy/worker deploy/api

echo "Waiting 30 seconds for pods to terminate..."
sleep 30

echo "Port-forwarding API service..."
kubectl -n app port-forward svc/api 8000:80
