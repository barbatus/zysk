import os

from botasaurus import bt
from botasaurus_server.server import Server
from dotenv import load_dotenv

from src.scrape_news import scrape_md

load_dotenv()

Server.rate_limit["browser"] = bt.calc_max_parallel_browsers() * 1.5
Server.cache = True
Server.set_database_url(os.getenv("POSTGRES_URL"))
Server.database_options = {"pool_size": 200, "max_overflow": -1, "pool_timeout": 60}


def add_scrappers():
    Server.add_scraper(scrape_md)
