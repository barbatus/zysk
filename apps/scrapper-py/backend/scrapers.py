from botasaurus_server.server import Server
from src.scrape_news import scrape_md
from botasaurus import bt

Server.rate_limit["browser"] = min(10, bt.calc_max_parallel_browsers())


def add_scrappers():
    Server.add_scraper(scrape_md)
