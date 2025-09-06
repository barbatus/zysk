from collections.abc import Callable
from typing import Any

from .scrapers import SCRAPERS_REGISTRY


class Registry:
    def __init__(self) -> None:
        self.scrapers: dict[str, dict[str, Any]] = {}
        for name, fn in SCRAPERS_REGISTRY.items():
            self.scrapers[name] = {
                "name": name,
                "function": fn,
                "scraper_name": name,
            }

    def get_scraping_function(self, scraper_name: str) -> Callable:
        return self.scrapers[scraper_name]["function"]

    def get_scrapers_names(self) -> list[str]:
        return list(self.scrapers.keys())

    def get_scraper(self, scraper_name: str) -> dict[str, Any]:
        return self.scrapers[scraper_name]


REGISTRY = Registry()
