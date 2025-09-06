from hrequests import BrowserSession

from ..settings import settings
from .camoufox_browser import ProxyAuth, get_camoufox_session
from .cdp_browser import get_cdp_session


def get_session(use_proxy: bool = False, use_cdp: bool = False) -> BrowserSession:
    if use_cdp:
        print("Using CDP session")
        return get_cdp_session(endpoint_url=settings.cdp_url)
    else:
        print(f"Using Camoufox session {'with proxy' if use_proxy else 'without proxy'}")
        return get_camoufox_session(proxy_auth=ProxyAuth(
            username="alexborod6",
            key="1XZuFmgybAb2D5KtmpoR",
        ) if use_proxy else None)
