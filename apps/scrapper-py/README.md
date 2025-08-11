## Testing k8s locally

### Build and run locally
1. Start minikube: `minikube start --memory=8000 --cpus=4`.
2. Build docker image locally: `docker buildx build --platform linux/arm64 --no-cache -t fastapi-celery:dev .`.
3. Load docker image: `minikube image load fastapi-celery:dev`.
4. Roll/restart out deployment: `kubectl -n app rollout restart deploy/celery-worker deploy/api`.

**Caveats:**
- Make sure `host.docker.internal` is set to 127.0.0.1 in your /etc/hosts file.
- Before each re-build, delete old image in the local docker registry and minikube: `minikube ssh -- docker system prune -af`.
- Make sure to update poetry `pyproject.toml` and `poetry.lock` file with latest commit hashes  of `botasaurus` and `botasaurus-server` (which are installed from GH repo).
- To make sure a new version restarts quicker, one can delete pods: `kubectl delete pods --all -n app`.

### Using Pods
Expose API 8000 port: `kubectl -n app port-forward svc/api 8000:80`.
Checking current Pods: `kubectl -n app get pods -o wide`.

### Diagnostics
Add metrics plugins: `minikube addons enable metrics-server`.
Running diagnostics: `minikube addons enable dashboard && minikube dashboard --url`.
Celery Web UI: `celery --broker=redis://host.docker.internal:6379/0 flower.`
Checking pod logs: `POD=... && kubectl -n app logs "$POD" --tail=200`.


To run locally, do the usual:
1. Clone Starter Template
```
git clone https://github.com/omkarcloud/botasaurus-starter my-botasaurus-project
cd my-botasaurus-project
```

2. Install the dependencies. It's worth mentioning that the installation will take a few minutes.
```
python -m pip install -r requirements.txt
python run.py install
```

3. Run Scraper
```
python main.py
```

4. Run Scraper via UI Dashboard
```
python run.py
```

For more information read Botasaurus Documentation at [https://www.omkar.cloud/botasaurus/](https://www.omkar.cloud/botasaurus/)
