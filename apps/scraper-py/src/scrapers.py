from collections.abc import Callable
from dataclasses import dataclass
from time import monotonic
from urllib.parse import urlparse

from hrequests import BrowserSession
from pydantic import BaseModel, Field, field_validator

from .browsers import get_session
from .exceptions import BotDetectedException, CssSelectorNotFoundException
from .scrape_helpers import check_bot_is_detected, domain_handlers
from .utils import convert_to_markdown


@dataclass
class ScrapeResult:
    url: str
    markdown: str


class ScraperSettings(BaseModel):
    selectors: dict[str, str] | None = None

    def get_css_selector(self, url: str) -> str | None:
        path = urlparse(url).path.lstrip("/").split("/", 1)
        return self.selectors.get(path[0], None) if self.selectors else None


class ScraperConfig(BaseModel):
    url: str
    max_retry: int = 5
    use_proxy: bool = False
    use_cdp: bool = False
    remove_ul: bool = True
    settings: ScraperSettings = Field(default_factory=ScraperSettings)

    @field_validator("settings", mode="before")
    @classmethod
    def _default_settings_when_none(cls, v):
        if v is None:
            return ScraperSettings()
        return v


def parse_domain(url: str) -> str:
    domain = urlparse(url).netloc.replace("www.", "")
    return domain


def search_settings(domain: str, settings: dict[str, ScraperSettings]) -> ScraperSettings | None:
    for key in settings:
        if domain in key:
            return settings[key]
    return None


def scrape_md(
    *, config: ScraperConfig, retry_attempt: int = 0, on_heartbeat: Callable | None = lambda: None
) -> ScrapeResult:
    page: BrowserSession = None
    try:
        if on_heartbeat:
            on_heartbeat()

        print(f"Scraping {config.url}")
        now = monotonic()

        page = get_session(use_proxy=config.use_proxy, use_cdp=config.use_cdp)

        page.goto(config.url, wait_until="domcontentloaded")
        url = page.evaluate("window.location.href;")

        if on_heartbeat:
            on_heartbeat()

        domain = parse_domain(url)
        if domain in domain_handlers:
            for handler in domain_handlers[domain]:
                handler(page, domain=domain)
            url = page.evaluate("window.location.href;")

        if on_heartbeat:
            on_heartbeat()

        css_selector = config.settings.get_css_selector(url)

        markdown = convert_to_markdown(
            page.content, remove_ul=config.remove_ul, css_selector=css_selector
        )

        if len(markdown) < 100 or check_bot_is_detected(page):
            page.close()
            raise BotDetectedException(config.url)

        if not markdown and css_selector:
            page.close()
            raise CssSelectorNotFoundException("No markdown found")

        page.close()

        print(f"{url} is scraped successfully in {round(monotonic() - now, 2)} seconds")

        return ScrapeResult(
            url=url,
            markdown=markdown,
        )

    except Exception as e:
        if retry_attempt >= config.max_retry:
            raise e

        print(f"Failed to scrape with error: {e}, retrying...")

        is_bot_detected = isinstance(e, BotDetectedException)
        is_css_selector_not_found = config.settings.selectors and isinstance(
            e, CssSelectorNotFoundException
        )
        use_proxy = is_bot_detected

        use_cdp = config.use_cdp or (retry_attempt >= 3 and config.use_proxy and is_bot_detected)

        # Prepare updated config for the retry attempt
        if is_css_selector_not_found:
            new_settings = config.settings.model_copy(update={"selectors": None})
        else:
            new_settings = config.settings

        new_config = config.model_copy(
            update={
                "use_proxy": use_proxy,
                "use_cdp": use_cdp,
                "settings": new_settings,
            }
        )
        return scrape_md(
            config=new_config,
            retry_attempt=retry_attempt + 1,
            on_heartbeat=on_heartbeat,
        )


SCRAPERS_REGISTRY = {
    "scrape_md": scrape_md,
}
