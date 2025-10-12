.PHONY: start dev kill lint mypy ruff format

dev:
	@echo "Starting backend and worker..."
	@if [ ! -f .env.local ]; then \
		echo "Warning: .env.local file not found. Creating from .env.example if available..."; \
	fi
	@echo "Starting backend and worker in foreground..."
	@echo "Press Ctrl+C to stop both processes"
	@trap 'kill 0' SIGINT SIGTERM; \
	poetry run python run.py backend & \
	BACKEND_PID=$$!; \
	poetry run python run.py worker & \
	WORKER_PID=$$!; \
	wait $$BACKEND_PID $$WORKER_PID

kill:
	@echo "Killing backend and worker..."
	- pkill -f "[r]un.py backend" 2>/dev/null || true
	- pkill -f "[r]un.py worker" 2>/dev/null || true
	@echo "Ensuring all worker processes are terminated..."
	- PIDS=$$(pgrep -f "run.py worker"); if [ -n "$$PIDS" ]; then kill $$PIDS 2>/dev/null || true; sleep 1; fi
	- PIDS=$$(pgrep -f "run.py worker"); if [ -n "$$PIDS" ]; then kill -9 $$PIDS 2>/dev/null || true; fi
	@echo "Freeing port 8000 if occupied..."
	- lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@echo "Done."

lint:
	@echo "Running linters..."
	poetry run ruff check src/
	poetry run mypy src/

mypy:
	@echo "Running mypy type checker..."
	poetry run mypy src/

ruff:
	@echo "Running ruff linter..."
	poetry run ruff check src/

format:
	@echo "Formatting code with ruff..."
	poetry run ruff format src/
	poetry run ruff check --fix src/
