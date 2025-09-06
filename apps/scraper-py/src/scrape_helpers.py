import re
import time
from dataclasses import dataclass

from dotenv import load_dotenv
from hrequests.browser import BrowserSession

from .utils import convert_to_markdown

load_dotenv()

ACCEPT_RE = re.compile(r"accept\s+all", re.I)
PRESS_AND_HOLD_RE = re.compile(r"Press & Hold", re.I)
CHECK_BOT_RE = re.compile(
    (
        r"(access|bot).+?(denied|blocked|detected)"
        r"|verification(\s+is\s+|\s+)required"
    ),
    re.I | re.DOTALL,
)
CHECK_CAPTCHA_RE = re.compile(r"captcha", re.I)


@dataclass
class ScraperConfig:
    link: str
    use_wss: bool = False


def accept_all_cookies(page: BrowserSession, *, domain: str):
    buttons = page.find_all("button, input, a")
    print("accepting cookies")
    for el in buttons:
        txt = (el.text or el.attrs.get("value") or "").strip()
        if ACCEPT_RE.search(txt):
            print(f"Accepting cookies for {domain}")
            el.click()
            time.sleep(3)
            break


def check_press_and_hold(page: BrowserSession):
    for el in page.find_all("iframe"):
        if "human verification challenge" in (el.attrs.get("title") or "").casefold():
            return el.parent
    return None


def check_bot_is_detected(page: BrowserSession):
    md = convert_to_markdown(page.content)
    return CHECK_BOT_RE.search(md) or check_press_and_hold(page)


def check_captcha(page: BrowserSession, *, domain: str):
    md = convert_to_markdown(page.getContent())
    return CHECK_CAPTCHA_RE.search(md)


domain_handlers = {
    "finance.yahoo.com": [accept_all_cookies],
}
