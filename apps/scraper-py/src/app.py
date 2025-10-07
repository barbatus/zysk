import uvicorn

from .fastapi_app import app as fastapi_app
from .logging_setup import setup_logging


def run_server() -> None:
    setup_logging()
    uvicorn.run(fastapi_app, host="0.0.0.0", port=8000, log_level="info")
