from botasaurus.browser import cdp
from botasaurus_driver.core.tab import Tab


def mouse_press_and_hold(
    tab: Tab,
    x: int,
    y: int,
    *,
    button: str = "left",
    buttons: int | None = 1,
    modifiers: int | None = 0,
    hold_time: int | None = 10,
):
    tab.send(
        cdp.input_.dispatch_mouse_event(
            "mousePressed",
            x=x,
            y=y,
            modifiers=modifiers,
            button=cdp.input_.MouseButton(button),
            buttons=buttons,
            click_count=1,
        )
    )
    tab.sleep(hold_time)
    tab.send(
        cdp.input_.dispatch_mouse_event(
            "mouseReleased",
            x=x,
            y=y,
            modifiers=modifiers,
            button=cdp.input_.MouseButton(button),
            buttons=buttons,
            click_count=1,
        )
    )


def get_all_urls(tab: Tab, url: str) -> list[str]:
    import urllib.parse

    res = []
    all_assets = tab.query_selector_all(selector="a")
    parsed_url = urllib.parse.urlparse(url)
    path = parsed_url.path
    domain = parsed_url.netloc
    for asset in all_assets:
        for k, v in asset.attrs.items():
            if k in ("src", "href"):
                if domain not in v:
                    continue
                if "#" in v:
                    continue
                if not any([_ in v for _ in ("http", "//", "/")]):
                    continue
                abs_url = urllib.parse.urljoin(path, v)
                if not abs_url.startswith(("http", "//", "ws")):
                    continue
                res.append(abs_url)
                break
    return res


class ScaperException(Exception):
    def __init__(self, msg: str = None) -> None:
        super().__init__()
        self.msg = msg

    def __str__(self) -> str:
        exception_msg = f"{self.msg}"
        return exception_msg


class BotDetectedException(ScaperException):
    def __init__(self, url: str) -> None:
        super().__init__(f"Bot detected on {url}")
