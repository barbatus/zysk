## Running locally

`python run.py backend` for API
`python run.py worker`  for Worker

## Running via k8s

### Local Setup

Make sure that environment vars are appropriate for the localhost and
context is set to minikube (`kubectl config use-context minikube`).
Redis URL and Temporal hosts are set to `host.docker.internal`.

To run locally, `./k8s_local.sh`.

### The script contains the following steps:
1. Start minikube: `minikube start --memory=8g --cpus=6`.
2. Build docker image locally: `docker buildx build --platform linux/arm64 --no-cache -t octopus:dev .`.
3. Load docker image: `minikube image load octopus:dev`.
4. Roll/restart out deployment: `kubectl -n app rollout restart deploy/worker deploy/api`.

**Caveats:**
- Make sure `host.docker.internal` is set to 127.0.0.1 in your /etc/hosts file.
- Before each re-build, delete old image in the local docker registry and minikube: `minikube ssh -- docker system prune -af`.
- Make sure to update poetry `pyproject.toml` and `poetry.lock` file with latest commit hashes  of `botasaurus` and `botasaurus-server`
  (which are installed from GH repo).
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
https://github.com/klippa-app/keda-celery-scaler and Temporal via https://keda.sh/docs/2.17/scalers/temporal.
Some useful commands:
- Describe: `kubectl -n app get scaledobject`, `kubectl -n app describe scaledobject worker | sed -n '/Conditions/,$p'`.
- Current config: `kubectl -n app get deploy worker -o yaml`.
- Restart: `kubectl -n keda rollout restart deploy/keda-operator`.
- Check if KEDA HPA is created `kubectl -n app get hpa`.
- Checking autoscaler logs: `kubectl -n app logs -f <POD>  -c keda-autoscaler`

### Env
Env variables are applied via a config map `app-config`, which is created from `.env` file.
If you've removed a variable from `.env` file, make sure to do in the deployments:
`kubectl -n app get deploy -o name | xargs -I{} kubectl -n app set env {} <name>-`.

### Other useful commands
- Checking if API running: `curl -v http://34.118.104.61:80`.
- Delete POD competely: `kubectl delete deploy <pod-name> -n app`.

### Environment Variables

If `.env` got cached locally in the container, change the environment variables by setting explicitly:
- `kubectl set env -n app deployment/<deploy-name> FOO=bar`
- `kubectl -n app rollout restart deploy/worker deploy/api`

Check current env vars: `kubectl exec -n app <pod-name> -- printenv`.

### GKE Setup

To deploy to GKE `zysk-dev` cluster: `./k8s_gke.sh`.
