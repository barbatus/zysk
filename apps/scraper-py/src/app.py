import uvicorn

from .fastapi_app import app as fastapi_app


def run_server() -> None:
    uvicorn.run(fastapi_app, host="0.0.0.0", port=8000, log_level="info")
