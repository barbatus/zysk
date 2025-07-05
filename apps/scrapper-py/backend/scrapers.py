from botasaurus import bt
from botasaurus_server.server import Server

from src.scrape_news import scrape_md

Server.rate_limit["browser"] = bt.calc_max_parallel_browsers()


def add_scrappers():
    Server.add_scraper(scrape_md)
