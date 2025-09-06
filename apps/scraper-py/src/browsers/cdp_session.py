import asyncio
from collections.abc import Callable
from http.client import responses as status_codes
from typing import Optional

import hrequests
from hrequests.browser.browser import ERROR, BrowserEngine, BrowserObjectWrapper
from hrequests.browser.engine import AbstractBrowserClient
from hrequests.client import CaseInsensitiveDict
from hrequests.cookies import RequestsCookieJar, cookiejar_to_list, list_to_cookiejar
from hrequests.exceptions import JavascriptException


class ChromeBrowserClient(AbstractBrowserClient):
    async def _start_context(self, **launch_args):
        """
        Create a new CDP browser context
        """
        try:
            cmd = self.engine.playwright.chromium.connect_over_cdp(**launch_args)
        except TypeError as exc:
            raise TypeError("Unsupported parameters passed to CDP browser.") from exc
        browser = await cmd

        # Add pointer to the objects list to delete on shutdown
        self.main_browser = browser

        return await browser.new_context()


class CDPSession:
    """
    Args:
        session (hrequests.session.TLSSession, optional): Session to use for headers, cookies, etc.
        resp (hrequests.response.Response, optional): Response to update with cookies, headers, etc.
        engine (BrowserEngine, optional): Pass in an existing BrowserEngine instead of creating a new one.
        **kwargs: Additional arguments to pass to connect_over_cdp.

    Attributes:
        url (str): Get the page url
        headers (dict): Get the browser headers (User-Agent)
        content (str): Get the current page content
        cookies (RequestsCookieJar): Get the browser cookies
        status_code (int): Status code of the last response
        reason (Optional[str]): Gets the official W3C name for the status code

    Navigation Methods:
        goto(url): Navigate to a URL.
        awaitSelector(selector, arg): Wait for a selector to exist
        evaluate(script, arg): Evaluate and return a script
        setHeaders(headers): Set the browser headers. Note that this will NOT update the TLSSession headers
        close(): Close the instance
    """

    def __init__(
        self,
        *,
        session: hrequests.session.TLSSession | None = None,
        resp: hrequests.response.Response | None = None,
        endpoint_url: str,
        engine: Optional['BrowserEngine'] = None,
        **launch_options,
    ) -> None:
        # Remember session and resp to clone cookies back to when closing
        self.session: hrequests.session.TLSSession | None = session
        self.resp: hrequests.response.Response | None = resp

        # Set the engine, or create one if not provided
        if engine:
            self.engine = engine
            self.temp_engine = False
        else:
            self.engine = BrowserEngine(browser_type="chrome")
            self.temp_engine = True

        self._headers: dict | None = None
        self.context: BrowserObjectWrapper | None = None

        # Browser config
        self.status_code: int | None
        if self.resp is not None:
            self.status_code = self.resp.status_code
        else:
            self.status_code = None

        # Bool to indicate browser is running
        self._closed: bool = False

        # Launch options
        self.launch_options: dict = launch_options
        self.launch_options['endpoint_url'] = endpoint_url

        # Start the browser
        self.start()

    def start(self) -> None:
        asyncio.run(self.__start())

    async def __start(self) -> None:
        # Build the playwright instance
        self.client = await ChromeBrowserClient(
            engine=self.engine,
            **self.launch_options,
        )
        # Save the context
        self.context = self.client.context
        # Create a new page
        self.page = self.client.new_page()

    def shutdown(self) -> None:
        self._closed = True
        self.client.stop()

        if self.temp_engine:
            self.engine.stop()

    def __enter__(self) -> 'CDPSession':
        return self

    def __exit__(self, *_) -> None:
        self.close()

    """
    Common public functions
    """

    def goto(self, url):
        '''Navigate to a URL'''
        resp = self.page.goto(url)
        self.status_code = resp.status
        return resp

    def awaitSelector(self, selector, *, timeout: float = 30):
        '''
        Wait for a selector to exist

        Parameters:
            selector (str): Selector to wait for
            timeout (float, optional): Timeout in seconds. Defaults to 30.
        '''
        self.page.wait_for_function(
            "selector => !!document.querySelector(selector)",
            arg=selector,
            timeout=int(timeout * 1e3),
        )

    def getContent(self):
        '''Get the page content'''
        return self.page.content()

    def getCookies(self) -> RequestsCookieJar:
        '''Get the page cookies'''
        browser_cookies: list = self.context.cookies()
        return list_to_cookiejar(browser_cookies)

    def evaluate(self, script: str, arg: str | None = None):
        '''
        Evaluate and return javascript

        Parameters:
            script (str): Javascript to evaluate in the page
            arg (str, optional): Argument to pass into the javascript function
        '''
        try:
            return self.page.evaluate(script, arg=arg)
        except ERROR as e:
            raise JavascriptException('Javascript eval exception') from e

    @property
    def url(self) -> str:
        '''Get the page url'''
        return self.page.url

    @url.setter
    def url(self, url: str):
        '''Go to page url'''
        self.goto(url)

    @property
    def headers(self) -> CaseInsensitiveDict:
        '''Get the page headers'''
        if self._headers:
            return CaseInsensitiveDict(self._headers)

        # Extract User-Agent
        ua = self.evaluate('navigator.userAgent')
        return CaseInsensitiveDict({'User-Agent': ua})

    @headers.setter
    def headers(self, headers: dict | CaseInsensitiveDict):
        '''Set headers'''
        self.setHeaders(headers)

    @property
    def content(self) -> str:
        '''Get the page url'''
        return self.getContent()

    @property
    def cookies(self) -> RequestsCookieJar:
        '''Get the context cookies'''
        return self.getCookies()

    @cookies.setter
    def cookies(self, cookiejar: RequestsCookieJar):
        '''Set the context cookies'''
        self.setCookies(cookiejar)

    @property
    def html(self) -> 'hrequests.parser.HTML':
        '''Get the page html as an HTML object'''
        return hrequests.parser.HTML(session=self, url=self.url, html=self.content)

    @property
    def text(self) -> str:
        '''Get the page text'''
        return self.getContent()

    @property
    def find(self) -> Callable:
        return self.html.find

    @property
    def find_all(self) -> Callable:
        return self.html.find_all

    @property
    def reason(self) -> str | None:
        if self.status_code is not None:
            return status_codes[self.status_code]

    def setHeaders(self, headers: dict | CaseInsensitiveDict):
        '''
        Set the browser headers

        Parameters:
            headers (Union[dict, CaseInsensitiveDict]): Headers to set
        '''
        self._headers = {
            **headers,
            # convert lists to comma separated
            **{k: ', '.join(v) for k, v in headers.items() if isinstance(v, list)},
        }
        self.context.set_extra_http_headers(self._headers)

    def loadText(self, text):
        # load content into page
        self.page.set_content(text)
        self.page.wait_for_load_state('domcontentloaded')

    def setCookies(self, cookiejar: RequestsCookieJar):
        # convert cookiejar to list of dicts
        cookie_renders = cookiejar_to_list(cookiejar)
        # set cookies in playwright instance
        self.context.add_cookies(cookie_renders)

    def run(self, fn: Callable, *args, **kwargs):
        """
        Takes an async function and passes it to the engine to execute.
        """

        async def task():
            await fn(self.page._obj._obj, *args, **kwargs)

        return self.engine.execute(task)

    def close(self):
        if self._closed:
            # Browser was closed, nothing to do
            return
        # Context never started #66
        if self.context is None:
            raise RuntimeError('Browser context was not initialized')
        cookiejar = self.getCookies()
        # Update session if provided
        if self.session:
            self.session.cookies = cookiejar
        # Update response
        if self.resp is not None:
            self.resp.cookies = cookiejar
            self.resp.raw = self.page.content()
            self.resp.url = self.page.url
            self.resp.status_code = self.status_code
        # Close browser
        self.shutdown()

    def __del__(self):
        self.close()


def render(
    url: str | None = None,
    *,
    headless: bool = True,
    response: hrequests.response.Response | None = None,
    session: hrequests.session.TLSSession | None = None,
    **kwargs,
):
    assert any(
        (url, session, response is not None)
    ), 'Must provide a url or an existing session, response'

    render_session = CDPSession(
        session=session,
        resp=response,
        headless=headless,
        **kwargs,
    )
    # include headers from session if a TLSSession is provided
    if session and isinstance(session, hrequests.session.TLSSession):
        render_session.headers = session.headers
    # include merged cookies from session or from response
    if req_src := session or response:
        if req_src.cookies is not None:
            render_session.cookies = req_src.cookies
    if url:
        # goto url if url was provided
        render_session.goto(url)
    return render_session
