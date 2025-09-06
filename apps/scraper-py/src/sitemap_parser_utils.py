from datetime import datetime
from gzip import decompress
from typing import TypedDict
from urllib.parse import unquote_plus, urlparse

from bs4 import BeautifulSoup

from .links import extract_link_upto_nth_segment


class GunzipException(Exception):
    pass


def gunzip(data):
    if data is None:
        raise GunzipException("response data is None. Expected gzipped data as bytes.")
    if not isinstance(data, bytes):
        raise GunzipException("Invalid data type. Expected gzipped data as bytes.")
    if len(data) == 0:
        raise GunzipException("response data is empty. Gzipped data cannot be empty.")
    try:
        gunzipped_data = decompress(data)
    except Exception as ex:
        raise GunzipException(f"Decompression failed. Error during gunzipping: {ex}")
    if gunzipped_data is None:
        raise GunzipException("Decompression resulted in None.")
    if not isinstance(gunzipped_data, bytes):
        raise GunzipException("Decompression resulted in non-bytes data.")
    gunzipped_data = gunzipped_data.decode("utf-8-sig", errors="replace")
    assert isinstance(gunzipped_data, str)
    return gunzipped_data


def isgzip(url, response):
    uri = urlparse(url)
    url_path = unquote_plus(uri.path)
    content_type = response.headers.get("content-type") or ""
    if url_path.lower().endswith(".gz") or "gzip" in content_type.lower():
        return True
    else:
        return False


def fix_gzip_response(url, response):
    if response.status_code == 404:
        if url.endswith("robots.txt"):
            print("robots.txt not found (404) at the following URL: " + response.url)
        else:
            print("Sitemap not found (404) at the following URL: " + response.url)
        return None
    response.raise_for_status()
    if isgzip(url, response):
        return gunzip(response.content)
    else:
        return response.text


def fix_bad_sitemap_response(s, char="<"):
    if not s:
        return s
    char_index = s.find(char)
    if char_index == -1:
        return s
    return s[char_index:]


class SitemapUrl(TypedDict):
    loc: str
    lastmod: datetime | None


def extract_sitemaps(content) -> list[SitemapUrl]:
    root = BeautifulSoup(content, "lxml-xml")
    locs = []
    for sm in root.select("sitemap"):
        loc = sm.select_one("loc")
        lastmod = sm.select_one("lastmod")
        if loc is not None:
            locs.append(
                {
                    "loc": loc.text.strip(),
                    "lastmod": (datetime.fromisoformat(lastmod.text.strip()) if lastmod else None),
                }
            )
    return locs


def split_into_links_and_sitemaps(content) -> tuple[list[SitemapUrl], list[SitemapUrl]]:
    root = BeautifulSoup(content, "lxml-xml")

    def parse_links(elem_name: str):
        links: list[SitemapUrl] = []
        for entry in root.select(elem_name):
            loc = entry.select_one("loc")
            lastmod = entry.select_one("lastmod")
            if loc is not None:
                links.append(
                    {
                        "loc": loc.text.strip(),
                        "lastmod": (
                            datetime.fromisoformat(lastmod.text.strip()) if lastmod else None
                        ),
                    }
                )
        return links

    return parse_links("url"), parse_links("sitemap")


def clean_robots_txt_url(url):
    return extract_link_upto_nth_segment(0, url) + "robots.txt"


def clean_sitemap_url(url):
    return extract_link_upto_nth_segment(0, url) + "sitemap.xml"


def is_empty_path(url):
    return not urlparse(url).path.strip("/")


def wrap_in_sitemap(urls: list[str], *, level: int = 0):
    return [{"url": url, "type": "sitemap", "level": level} for url in urls]
