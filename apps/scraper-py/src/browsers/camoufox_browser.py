import platform
from typing import TypedDict

import hrequests
from hrequests import BrowserEngine, BrowserSession
from hrequests.proxies import evomi

_browser_engine = BrowserEngine()


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
    return BrowserSession(
        engine=_browser_engine,
        session=session,
        mock_human=True,
        headless=headless,
        humanize=True,
        locale=["en-US"],
        enable_cache=True,
        block_images=True,
    )
