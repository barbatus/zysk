import re
from collections.abc import Callable
from urllib.parse import urlparse

from botasaurus.browser import Driver, browser
from botasaurus_driver.core.element import Element
from botasaurus_driver.core.tab import Tab
from bs4 import BeautifulSoup
from capsolver_extension_python import Capsolver
from markdownify import markdownify as md

from .utils import BotDetectedException, ChromeErrorException, get_all_urls, mouse_press_and_hold

ACCEPT_RE = re.compile(r"accept\s+all", re.I)
PRESS_AND_HOLD_RE = re.compile(r"Press & Hold", re.I)
CHECK_BOT_RE = re.compile(
    r"(access|bot).+?(denied|blocked|detected)|verification(\s+is\s+|\s+)required", re.I | re.DOTALL
)
CHECK_CAPTCHA_RE = re.compile(r"captcha", re.I)


def convert_to_markdown(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for element in soup.find_all(["a", "ul", "ol", "li"]):
        if element.name == "a":
            element.replace_with(element.get_text())
        else:
            element.decompose()
    return md(str(soup))


def accept_all_cookies(driver: Driver, tab: Tab, *, domain: str):
    buttons = tab.select_all("button, input, a")
    for el in buttons:
        txt = (el.text or el.attrs.get("value") or "").strip()
        if ACCEPT_RE.search(txt):
            print(f"Accepting cookies for {domain}")
            el.click()
            driver.sleep(3)
            break


def press_and_hold(driver: Driver, tab: Tab, *, domain: str):
    def check_press_and_hold(callback: Callable[[Element], None] | None = None):
        for el in tab.select_all("iframe"):
            if "human verification challenge" in (el.attrs.get("title") or "").casefold():
                if callback:
                    callback(el.parent)
                return True
        return False

    def do_press_and_hold(el: Element):
        print(f"Pressing hold for {domain}")
        center = el.get_position().center
        mouse_press_and_hold(tab, center[0] - 20, center[1] - 20, hold_time=15)
        driver.sleep(5)

    has_press_and_hold = check_press_and_hold(do_press_and_hold)

    if has_press_and_hold and check_press_and_hold():
        print(f"Press and hold was not successful for {domain}")


def check_bot_is_detected(driver: Driver, tab: Tab, *, domain: str):
    md = convert_to_markdown(tab.get_content())
    return driver.is_bot_detected() or CHECK_BOT_RE.search(md)


def check_captcha(driver: Driver, tab: Tab, *, domain: str):
    md = convert_to_markdown(tab.get_content())
    return driver.is_bot_detected() or CHECK_CAPTCHA_RE.search(md)


domain_handlers = {
    "consent.yahoo.com": [accept_all_cookies],
    "seekingalpha.com": [press_and_hold],
    "investors.com": [press_and_hold],
}


def get_proxy(
    data: dict[str, str],
    retry_attempt: int,
    last_error: Exception | None,
) -> str | None:
    if last_error and isinstance(last_error, BotDetectedException) and retry_attempt >= 2:
        print("Bot detected, using proxy")
        return "http://alexborod6:1XZuFmgybAb2D5KtmpoR@core-residential.evomi.com:1000"
    return None


@browser(
    reuse_driver=True,
    max_retry=3,
    block_images_and_css=True,
    window_size=(430, 600),
    parallel=100,
    output=None,
    close_on_crash=True,
    remove_default_browser_check_argument=True,
    raise_exception=True,
    wait_for_complete_page_load=False,
    headless=True,
    extensions=[Capsolver(api_key="CAP-B7692D3299667795364B38F08BFBB815B57B9D50A12CFA349DE226DE17A4F523")],
    proxy=get_proxy,
)
def scrape_md(driver: Driver, data):
    link = data["link"]
    log_md = data.get("log_md", False)

    driver.enable_human_mode()
    driver.short_random_sleep()

    def get_content(response) -> tuple[str, str]:
        url = response.evaluate("return window.location.href;")
        html = response.get_content()
        return url, html

    response = driver.google_get(link, bypass_cloudflare=True, wait=3)
    url, html = get_content(response)
    domain = urlparse(url).netloc.replace("www.", "")
    if domain in domain_handlers:
        for handler in domain_handlers[domain]:
            handler(driver, response, domain=domain)
            url, html = get_content(response)

    if check_captcha(driver, response, domain=domain):
        print(f"Waiting for captcha solver for {domain}")
        driver.sleep(12)

    markdown = convert_to_markdown(html)
    if log_md:
        print(markdown)

    is_bot_detected = check_bot_is_detected(driver, response, domain=domain)
    print(f"Failed to parse {url}" if is_bot_detected else f"Successfully parsed {url}")

    if is_bot_detected or len(markdown) <= 100:
        raise BotDetectedException(url)

    if url.startswith("chrome-error"):
        raise ChromeErrorException(markdown)

    all_urls = get_all_urls(response, url)

    return {
        "url": url,
        "status": 200,
        "markdown": markdown,
        "urls": list(filter(lambda u: domain in u, all_urls)),
    }
