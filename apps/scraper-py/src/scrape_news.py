import json
import os
import re
from collections.abc import Callable
from random import randint
from urllib.parse import urlparse

from botasaurus.browser import Driver, browser
from botasaurus_driver.core.element import Element
from botasaurus_driver.core.tab import Tab
from botasaurus_driver.user_agent import UserAgent
from bs4 import BeautifulSoup
from capsolver_extension_python import Capsolver
from dotenv import load_dotenv
from markdownify import markdownify as md

from .utils import BotDetectedException, ChromeErrorException, get_all_urls, mouse_press_and_hold

load_dotenv()

ACCEPT_RE = re.compile(r"accept\s+all", re.I)
PRESS_AND_HOLD_RE = re.compile(r"Press & Hold", re.I)
CHECK_BOT_RE = re.compile(
    r"(access|bot).+?(denied|blocked|detected)|verification(\s+is\s+|\s+)required", re.I | re.DOTALL
)
CHECK_CAPTCHA_RE = re.compile(r"captcha", re.I)


def convert_to_markdown(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for element in soup.find_all(["a", "ul", "ol", "li", "img"]):
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
    driver.sleep(5)

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
        mouse_press_and_hold(tab, center[0], center[1], hold_time=10)
        driver.sleep(10)

    has_press_and_hold = check_press_and_hold(do_press_and_hold)

    if has_press_and_hold and check_press_and_hold():
        print(f"Press and hold was not successful for {domain}")
        raise BotDetectedException(f"Press and hold was not successful for {domain}")


def check_bot_is_detected(driver: Driver, tab: Tab):
    md = convert_to_markdown(tab.get_content())
    return driver.is_bot_detected() or CHECK_BOT_RE.search(md)


def check_captcha(driver: Driver, tab: Tab, *, domain: str):
    md = convert_to_markdown(tab.get_content())
    return driver.is_bot_detected() or CHECK_CAPTCHA_RE.search(md)


def seekingalpha_login(driver: Driver, tab: Tab, *, domain: str):
    def is_already_logged_in():
        try:
            return tab.select("[data-test-id='account-menu']")
        except Exception:
            return False

    if is_already_logged_in():
        return

    def login_click():
        try:
            tab.find("Sign in").click()
        except Exception:
            tab.find("Login").click()

    try:
        print("Logging in to seekingalpha")
        login_click()
        tab.select("[data-test-id='modal-content'] [type='email']").send_keys(
            "alex.3084969@gmail.com"
        )
        tab.select("[data-test-id='modal-content'] [type='password']").send_keys("alex.3084969")
        tab.select("[data-test-id='modal-content'] [data-test-id='sign-in-button']").click()
        tab.sleep(3)
        print("Successfully logged in to seekingalpha")
    except Exception:
        print("Failed to login to seekingalpha")


domain_handlers = {
    "consent.yahoo.com": [accept_all_cookies],
    "seekingalpha.com": [press_and_hold, seekingalpha_login],
    "investors.com": [press_and_hold],
}


def get_proxy(
    data: dict[str, str],
    retry_attempt: int,
    last_error: Exception | None,
) -> str | None:
    # if last_error and retry_attempt >= 5:
    #     print("Bot detected, using proxy")
    #     return os.getenv("PROXY_URL")
    raw = os.getenv("PROXY_URL")
    try:
        proxy = json.loads(raw)
    except Exception:
        proxy = [raw]

    return "http://alexborod6:1XZuFmgybAb2D5KtmpoR@core-residential.evomi.com:1000"

    return proxy[randint(0, len(proxy) - 1)]


@browser(
    reuse_driver=True,
    max_retry=5,
    block_images=True,
    window_size=(430, 600),
    output=None,
    close_on_crash=True,
    remove_default_browser_check_argument=True,
    raise_exception=True,
    wait_for_complete_page_load=False,
    headless=False,
    extensions=[Capsolver(api_key=os.getenv("CAPSOLVER_API_KEY"))],
    proxy=get_proxy,
    # enable_xvfb_virtual_display=True,
    add_arguments=[
        "--disable-dev-shm-usage",
        "--disable-features=OptimizationGuideModelDownloading,OptimizationHintsFetching,OptimizationTargetPrediction,OptimizationHints",
        # "--disable-background-networking",
        "--no-first-run",
        "--no-default-browser-check",
        # "--disable-gpu",
        "--disable-component-update",
    ],
    tiny_profile=True,
    profile="pickachu",
    user_agent=UserAgent.user_agent_99,
)
def scrape_md2(driver: Driver, data):
    link = data["link"]
    log_md = data.get("log_md", False)

    driver.enable_human_mode()

    # driver.block_urls(
    #     [
    #         "*://*.googleapis.com/*",
    #         "*://*.googleusercontent.com/*",
    #         "*://*.google.com/*",
    #         "*://edgedl.me.gvt1.com/*",
    #         "*://www.googletagmanager.com/*",
    #         "*://*.stripe.com/*",
    #         "*://*.facebook.com/*",
    #         "*://safebrowsing.googleapis.com/*",
    #         "*://clients2.googleusercontent.com/",
    #         "*://optimizationguide-pa.googleapis.com/*",
    #         "*://clientservices.googleapis.com:/*",
    #     ]
    # )

    def get_content(response) -> tuple[str, str]:
        url = response.evaluate("return window.location.href;")
        html = response.get_content()
        return url, html

    response = driver.get(link, bypass_cloudflare=True)
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

    is_bot_detected = check_bot_is_detected(driver, response)
    print(f"Failed to parse {url}" if is_bot_detected else f"Successfully parsed {url}")

    if is_bot_detected or len(markdown) <= 100:
        raise BotDetectedException(url)

    if url.startswith("chrome-error"):
        raise ChromeErrorException(markdown)

    all_urls = get_all_urls(response, url)

    return {
        "url": urlparse(url).geturl(),
        "status": 200,
        "markdown": markdown,
        "urls": list(filter(lambda u: domain in u, all_urls)),
    }
