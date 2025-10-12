from collections.abc import Callable
from dataclasses import dataclass
from time import monotonic
from urllib.parse import urlparse

from hrequests import BrowserSession
from pydantic import BaseModel, Field, field_validator

from .browsers import get_session
from .exceptions import BotDetectedException, CssSelectorNotFoundException
from .logging_setup import get_logger
from .scrape_helpers import (
    ScrapeStats,
    check_bot_is_detected,
    check_press_and_hold,
    domain_handlers,
)
from .utils import convert_to_markdown


@dataclass
class ScrapeResult:
    url: str
    markdown: str

    stats: ScrapeStats


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


logger = get_logger(__name__)


def scrape_md(
    *,
    config: ScraperConfig,
    retry_attempt: int = 0,
    on_heartbeat: Callable | None = lambda: None,
    start_time: float | None = None,
) -> ScrapeResult:
    page: BrowserSession = None
    try:
        if on_heartbeat:
            on_heartbeat()

        logger.info("scrape.start", url=config.url, retry_attempt=retry_attempt)
        start_time = start_time or monotonic()

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

        duration = round(monotonic() - start_time, 2)
        stats = ScrapeStats(
            duration_sec=duration,
            proxy_used=config.use_proxy,
            cdp_used=config.use_cdp,
            attempts=retry_attempt,
        )

        if len(markdown) < 100:
            raise BotDetectedException(config.url, "No markdown found", stats)

        if bot_detected := check_bot_is_detected(page):
            raise BotDetectedException(config.url, f"Bot detected on page: {bot_detected}", stats)

        if check_press_and_hold(page):
            raise BotDetectedException(config.url, "Press and hold detected on page", stats)

        if not markdown and css_selector:
            raise CssSelectorNotFoundException("No markdown found")

        page.close()

        logger.info("scrape.success", url=url, duration_sec=duration)

        return ScrapeResult(
            url=url,
            markdown=markdown,
            stats=ScrapeStats(
                duration_sec=duration,
                proxy_used=config.use_proxy,
                cdp_used=config.use_cdp,
                attempts=retry_attempt,
            ),
        )

    except Exception as e:
        if page:
            page.close()

        if on_heartbeat:
            on_heartbeat()

        if retry_attempt >= config.max_retry:
            logger.exception(
                "scrape.error", url=config.url, retry_attempt=retry_attempt, error=str(e)
            )
            raise e

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
        logger.warning(
            "scrape.retry",
            url=config.url,
            retry_attempt=retry_attempt + 1,
            error=str(e),
        )
        return scrape_md(
            config=new_config,
            retry_attempt=retry_attempt + 1,
            on_heartbeat=on_heartbeat,
            start_time=start_time,
        )


SCRAPERS = {
    "scrape_md": scrape_md,
}
