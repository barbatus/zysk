from botasaurus.browser import browser, Driver
from botasaurus_driver.core.tab import Tab
from bs4 import BeautifulSoup
from markdownify import markdownify as md
import re
from urllib.parse import urlparse
from chrome_extension_python import Extension as ChromeExtension

from .utils import mouse_press_and_hold

ACCEPT_RE = re.compile(r"accept\s+all", re.I)
PRESS_HOLD_RE = re.compile(r"press.+hold", re.I | re.DOTALL)


def accept_all_cookies(driver: Driver, tab: Tab, *, domain: str):
    buttons = tab.select_all('button, input, a')
    for el in buttons:
        txt = (el.text or el.attrs.get("value") or "").strip()
        if ACCEPT_RE.search(txt):
            print(f"Accepting cookies for {domain}")
            el.click()
            driver.sleep(1)
            break


def press_and_hold(driver: Driver, tab: Tab, *, domain: str):
    for el in tab.select_all("iframe"):
        if "challenge" in (el.attrs.get("title") or ""):
            print(f"Pressing hold for {domain}")
            center = el.parent.get_position().center
            mouse_press_and_hold(tab, center[0] - 20, center[1] - 20)
            driver.sleep(3)


def convert_to_markdown(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for element in soup.find_all(['a', 'ul', 'ol', 'li']):
        if element.name == 'a':
            element.replace_with(element.get_text())
        else:
            element.decompose()
    return md(str(soup))


def random_sleep(driver: Driver, tab: Tab, *, domain: str):
    driver.short_random_sleep()


domain_handlers = {
    "consent.yahoo.com": [accept_all_cookies, random_sleep],
    "seekingalpha.com": [press_and_hold],
    "investors.com": [press_and_hold],
}


@browser(
    reuse_driver=False,
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
    extensions=[
        # Captcha Solver
        ChromeExtension("https://chromewebstore.google.com/detail/buster-captcha-solver-for/mpbjkejclgfgadiemmefgebjfooflfhl")
    ],
)
def scrape_md(driver: Driver, data):
    link = data["link"]

    driver.enable_human_mode()
    driver.short_random_sleep()

    def get_content(response):
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

    markdown = convert_to_markdown(html)

    return {
        "url": url,
        "status": 200,
        "markdown": markdown,
    }
