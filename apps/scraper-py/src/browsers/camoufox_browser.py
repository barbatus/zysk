import platform
from typing import TypedDict

import hrequests
from hrequests import BrowserEngine, BrowserSession
from hrequests.proxies import evomi

_browser_engine = BrowserEngine()


class CamoufoxSession(BrowserSession):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def goto(self, url, *, timeout: float = 180_000, wait_until: str = "domcontentloaded"):
        resp = self.page.goto(url, timeout=timeout, wait_until=wait_until)
        self.status_code = resp.status
        return resp


class ProxyAuth(TypedDict):
    username: str
    key: str


def get_camoufox_session(*, proxy_auth: ProxyAuth | None = None) -> BrowserSession:
    session = hrequests.firefox.Session(
        timeout=30,
        proxy=evomi.ResidentialProxy(
            username=proxy_auth["username"],
            key=proxy_auth["key"],
        )
        if proxy_auth
        else None,
    )
    headless = "virtual" if platform.system() == "Linux" else False
    return CamoufoxSession(
        engine=_browser_engine,
        session=session,
        mock_human=True,
        headless=headless,
        humanize=True,
        locale=["en-US"],
        enable_cache=True,
        block_images=True,
    )
