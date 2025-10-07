class ScaperException(Exception):
    def __init__(self, msg: str = None) -> None:
        super().__init__()
        self.msg = msg

    def __str__(self) -> str:
        exception_msg = f"{self.msg}"
        return exception_msg


class BotDetectedException(ScaperException):
    def __init__(self, url: str, reason: str) -> None:
        super().__init__(f"Bot detected on {url}: {reason}")


class NotLoggedInException(ScaperException):
    def __init__(self, url: str) -> None:
        super().__init__(f"Bot is not logged in on {url}")


class ChromeErrorException(ScaperException):
    def __init__(self, message: str) -> None:
        super().__init__(message)


class CssSelectorNotFoundException(ScaperException):
    def __init__(self, url: str, css_selector: str) -> None:
        super().__init__(f"Selector {css_selector} not found on {url}")
