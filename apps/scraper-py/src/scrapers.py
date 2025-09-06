from dataclasses import dataclass
from urllib.parse import urlparse

from .browsers import get_session
from .exceptions import BotDetectedException
from .scrape_helpers import check_bot_is_detected, domain_handlers
from .utils import convert_to_markdown


@dataclass
class ScrapeResult:
    url: str
    markdown: str


@dataclass
class ScraperConfig:
    url: str
    max_retry: int = 5
    use_proxy: bool = False
    use_cdp: bool = False
    remove_ul: bool = True


def scrape_md(*, config: ScraperConfig, retry_attempt: int = 0) -> ScrapeResult:
    try:
        domain = urlparse(config.url).netloc.replace("www.", "")
        page = get_session(use_proxy=config.use_proxy, use_cdp=config.use_cdp)
        page.goto(config.url)
        page.awaitSelector("body")
        url = page.evaluate("window.location.href;")

        if domain in domain_handlers:
            for handler in domain_handlers[domain]:
                handler(page, domain=domain)
            url = page.evaluate("window.location.href;")

        markdown = convert_to_markdown(page.content, remove_ul=config.remove_ul)
        if check_bot_is_detected(page) or len(markdown) <= 100:
            raise BotDetectedException(config.url)

        page.close()

        return ScrapeResult(
            url=url,
            markdown=markdown,
        )

    except Exception as e:
        if retry_attempt >= config.max_retry:
            raise e

        print(f"Failed to scrape with error: {e}, retrying...")

        is_bot_detected = isinstance(e, BotDetectedException)
        use_proxy = is_bot_detected

        use_cdp = config.use_proxy and is_bot_detected

        page.close()

        return scrape_md(
            config=ScraperConfig(
                url=config.url,
                use_proxy=use_proxy,
                use_cdp=use_cdp,
            ),
            retry_attempt=retry_attempt + 1,
        )


SCRAPERS_REGISTRY = {
    "scrape_md": scrape_md,
}
