## Running locally

`python run.py backend` for API
`python run.py worker`  for Celery worker

## Running via k8s

To run locally, `./k8s_local.sh <commit_sha>`.
Make sure that environment vars are set appropriately.
For example, Redis URL is `host.docker.internal:6379`.

To deploy to GKE zysk-dev cluster, `./k8s_gke.sh`.

### The script contains the following steps:
1. Start minikube: `minikube start --memory=8g --cpus=6`.
2. Build docker image locally: `docker buildx build --platform linux/arm64 --no-cache -t octopus:dev .`.
3. Load docker image: `minikube image load octopus:dev`.
4. Roll/restart out deployment: `kubectl -n app rollout restart deploy/celery-worker deploy/api`.

**Caveats:**
- Make sure `host.docker.internal` is set to 127.0.0.1 in your /etc/hosts file.
- Before each re-build, delete old image in the local docker registry and minikube: `minikube ssh -- docker system prune -af`.
- Make sure to update poetry `pyproject.toml` and `poetry.lock` file with latest commit hashes  of `botasaurus` and `botasaurus-server` (which are installed from GH repo).
- To make sure a new version restarts quicker, pods can deleted: `kubectl delete pods --all -n app`.

### Using Pods
Expose API 8000 port: `kubectl -n app port-forward svc/api 8000:80`.
Checking current Pods: `kubectl -n app get pods -o wide`.

### Diagnostics
Add metrics plugins: `minikube addons enable metrics-server`.
Running diagnostics: `minikube addons enable dashboard && minikube dashboard --url`.
Celery Web UI: `celery --broker=redis://host.docker.internal:6379/0 flower .`
Checking pod logs: `POD=... && kubectl -n app logs "$POD" --tail=200`.
Checking pod k8s events `kubectl -n app describe pod "$POD" | sed -n '/Events/,$p'`.

### Scaling
Pods are scaled horizontally via KEDA autoscaler for Celery and Redis based on
https://github.com/klippa-app/keda-celery-scaler.
Some useful commands:
- Describe: `kubectl -n app get scaledobject`, `kubectl -n app describe scaledobject celery-worker | sed -n '/Conditions/,$p'`.
- Current config: `kubectl -n app get deploy celery-worker -o yaml`.
- Restart: `kubectl -n keda rollout restart deploy/keda-operator`.
- Check if KEDA HPA is created `kubectl -n app get hpa`.


### Environment Variables

If .env got cached locally in the container, change the environment variables by setting explicitly:
- kubectl set env -n app deployment/<deploy-name> FOO=bar
- kubectl -n app rollout restart deploy/celery-worker deploy/api

Check current env vars: `kubectl exec -n app <pod-name> -- printenv`
