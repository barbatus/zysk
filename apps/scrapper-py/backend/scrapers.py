import os

from botasaurus import bt
from botasaurus_server.server import Server
from dotenv import load_dotenv

from src.scrape_news import scrape_md

load_dotenv()

Server.rate_limit["browser"] = bt.calc_max_parallel_browsers()
Server.cache = True
Server.set_database_url(
    os.getenv("POSTGRES_URL"),
    {
        "pool_size": 0,
        "max_overflow": 0,
        "pool_pre_ping": True,
    },
)
Server.set_proxy_url(os.getenv("PROXY_URL"))


def add_scrappers():
    Server.add_scraper(scrape_md)
