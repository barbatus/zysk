from botasaurus_server.run import run

from backend.scrapers import add_scrappers

if __name__ == "__main__":
    add_scrappers()
    run()
