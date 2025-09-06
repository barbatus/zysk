import asyncio
import sys

from src.app import run_server
from src.temporal_worker import run_worker as run_temporal_worker


def run():
    main_arg = sys.argv[1] if len(sys.argv) >= 2 else "backend"

    if main_arg == "backend":
        run_server()
    elif main_arg == "worker":
        asyncio.run(run_temporal_worker())
    else:
        print(f"Invalid argument: {main_arg}")
        sys.exit(1)


if __name__ == "__main__":
    run()
