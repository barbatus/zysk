import asyncio
import math
from datetime import datetime

from .links import (
    _Base,
    apply_filters_maps_sorts_randomize,
    extract_link_upto_nth_segment,
)
from .requests.request import Request
from .sitemap_parser_utils import (
    SitemapUrl,
    clean_robots_txt_url,
    clean_sitemap_url,
    extract_sitemaps,
    fix_bad_sitemap_response,
    fix_gzip_response,
    is_empty_path,
    split_into_links_and_sitemaps,
    wrap_in_sitemap,
)


async def fetch_content(req: Request, url: str, max_retries: int = 3):
    """Fetch content from a URL, handling gzip if necessary."""
    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(req.get, url, timeout=300)
            return fix_gzip_response(url, response)
        except Exception:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(5 * math.pow(2, attempt))


def flatten(lst):
    """Flatten a nested list."""
    result = []
    for item in lst:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result


def parse_sitemaps_from_robots_txt(base_url, content):
    """Extract sitemap URLs from robots.txt content."""
    sitemaps = []
    lines = content.split("\n")
    for line in lines:
        line = line.strip()
        if line.lower().startswith("sitemap:"):
            sitemap_url = line[8:].strip()
            if sitemap_url:
                sitemaps.append(sitemap_url)
    return sitemaps


class Sitemap(_Base):
    def __init__(self, urls: str | list[str], proxy=None):
        super().__init__()
        self.proxy = proxy
        self.urls = urls if isinstance(urls, list) else [urls]

    async def links(
        self,
        since: datetime | None = None,
        to: datetime | None = None,
    ) -> list[str]:
        request_options = self._create_request_options()

        urls = await self._get_urls(request_options, self.urls)
        urls = [
            url["loc"]
            for url in urls
            if (
                (since and url["lastmod"] and url["lastmod"] >= since or not since)
                and (to and url["lastmod"] and url["lastmod"] <= to or not to)
            )
        ]
        result = apply_filters_maps_sorts_randomize(
            urls,
            self._filters.get(0, []),
            self._extractors,
            self._sort_links,
            self._randomize_links,
        )
        return result

    async def sitemaps(self) -> "Sitemap":
        request_options = self._create_request_options()

        self.urls = await self._get_sitemaps_from_robots(request_options, self.urls)
        self.urls = await self._get_sitemaps_urls(request_options, self.urls)

        return self

    def _create_request_options(self):
        options = {
            "proxy": self.proxy,
        }
        return options

    async def _get_sitemaps_urls(self, request_options, urls):
        visited = set()

        async def sitemap_func(req, data):
            nonlocal visited

            url = data.get("url")
            if url in visited:
                return []

            visited.add(url)
            print(f"Visiting sitemap {url}")
            content = fix_bad_sitemap_response(await fetch_content(req, url))
            if not content:
                return []

            urls = extract_sitemaps(content)
            level = data.get("level", 0)
            result = apply_filters_maps_sorts_randomize(
                [url["loc"] for url in urls],
                self._filters.get(level, []),
            )
            child_sitemaps = await asyncio.gather(
                *[sitemap_func(req, data) for data in wrap_in_sitemap(result, level=level + 1)]
            )
            return ([url] + flatten(child_sitemaps)) if result else [url]

        req = Request(**request_options)
        result = await asyncio.gather(
            *[sitemap_func(req, data) for data in wrap_in_sitemap(urls, level=1)]
        )
        return flatten(result)

    async def _get_sitemaps_from_robots(self, request_options, urls):
        visited: set[str] = set()

        async def sitemap_func(req, url):
            nonlocal visited

            if url in visited:
                return []

            visited.add(url)
            content = fix_bad_sitemap_response(await fetch_content(req, url))

            if not content:
                return []

            result = parse_sitemaps_from_robots_txt(extract_link_upto_nth_segment(0, url), content)
            if not result:
                sm_url = clean_sitemap_url(url)
                content = await fetch_content(req, sm_url)
                return [sm_url] if content else []

            result = apply_filters_maps_sorts_randomize(
                result,
                self._filters.get(0, []),
            )
            return result

        result: list[str] = []
        req = Request(**request_options)

        tasks = []
        for url in urls:
            if is_empty_path(url):
                tasks.append(sitemap_func(req, clean_robots_txt_url(url)))
            else:
                result.append(url)

        if tasks:
            gathered_results = await asyncio.gather(*tasks)
            result.extend(flatten(gathered_results))

        return result

    async def _get_urls(self, request_options, urls) -> list[SitemapUrl]:
        visited = set()

        async def sitemap_func(req, url):
            nonlocal visited

            if url in visited:
                return []

            visited.add(url)
            print(f"Extracting links from {url}")
            content = fix_bad_sitemap_response(await fetch_content(req, url))

            links, locs = split_into_links_and_sitemaps(content)

            return links

        req = Request(**request_options)
        result = await asyncio.gather(*[sitemap_func(req, url) for url in urls])
        return flatten(result)
