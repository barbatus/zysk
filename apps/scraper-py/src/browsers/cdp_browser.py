
import hrequests
from hrequests import BrowserEngine

from .cdp_session import CDPSession

_browser_engine = BrowserEngine(browser_type="chrome")


def get_cdp_session(*, endpoint_url: str) -> CDPSession:
    session = hrequests.chrome.Session(
        timeout=30,
    )
    return CDPSession(
        engine=_browser_engine,
        session=session,
        endpoint_url=endpoint_url,
    )
