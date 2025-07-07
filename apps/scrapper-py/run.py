# ruff: noqa: I001
# import order is important here
from backend.scrapers import add_scrappers
from botasaurus_server.run import run

if __name__ == "__main__":
    add_scrappers()
    run()
