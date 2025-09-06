from random import shuffle
from urllib.parse import urlparse, urlunparse


def extract_link_upto_nth_segment(n, url):
    parsed_url = urlparse(url)
    path_segments = parsed_url.path.strip("/").split("/")[:n]
    new_path = "/".join(path_segments)
    if not new_path:
        new_path = "/"
    if parsed_url.path.endswith("/"):
        new_path = new_path.rstrip("/") + "/"
    return urlunparse((parsed_url.scheme, parsed_url.netloc, new_path, "", "", ""))


def _wrap_filter(func):
    def wrapper(*args, **kwargs):
        f = func(*args, **kwargs)
        return {
            "function_name": func.__name__,
            "arguments": [args, kwargs],
            "function": f,
        }

    return wrapper


class Filters:
    @staticmethod
    @_wrap_filter
    def has_exactly_n_segments(n):
        def f(url):
            path = urlparse(url).path.strip("/")
            segments = path.split("/") if path else []
            return len(segments) == n

        return f

    @staticmethod
    def has_exactly_1_segment():
        return Filters.has_exactly_n_segments(1)

    @staticmethod
    @_wrap_filter
    def has_at_least_n_segments(n):
        def f(url):
            path = urlparse(url).path.strip("/")
            segments = path.split("/") if path else []
            return len(segments) >= n

        return f

    @staticmethod
    @_wrap_filter
    def nth_segment_equals(n: int, value: str | list[str]):
        def f(url):
            path = urlparse(url).path.strip("/")
            segments = path.split("/") if path else []
            if 0 <= n < len(segments):
                if isinstance(value, list):
                    return segments[n] in value
                return segments[n] == value
            return False

        return f

    @staticmethod
    def first_segment_equals(value: str | list[str]):
        return Filters.nth_segment_equals(0, value)

    @staticmethod
    @_wrap_filter
    def last_segment_equals(value: str | list[str]):
        def f(url):
            path = urlparse(url).path.strip("/")
            segments = path.split("/") if path else []
            if isinstance(value, list):
                return segments[-1] in value if segments else False
            return segments[-1] == value if segments else False

        return f


def apply_filters_maps_sorts_randomize(
    urls: list[str],
    filters,
    extractors=None,
    sort_links: bool = False,
    randomize_links: bool = False,
):
    filtered_urls = []
    for url in urls:
        passes = True
        for filter_info in filters:
            if not filter_info["function"](url):
                passes = False
                break
        if passes:
            filtered_urls.append(url)

    transformed = []
    for url in filtered_urls:
        u = url
        for map_info in extractors or [{"function": lambda x: x}]:
            u = map_info["function"](u)
        transformed.append(u)

    all_urls = list(set(transformed))

    if sort_links:
        all_urls.sort()
    elif randomize_links:
        shuffle(all_urls)
    return all_urls


class _Base:
    def __init__(self):
        self._filters = {}
        self._extractors = []
        self._sort_links = False
        self._randomize_links = False

    def filter(self, *filter_funcs, **kwargs):
        level = kwargs.get("level", 0)
        for func in filter_funcs:
            if callable(func):
                raise Exception(
                    "Kindly check the filter '"
                    + func.__name__
                    + "' and see if you forgot to call it."
                )
        self._filters[level] = filter_funcs[:]
        return self

    def extract(self, *extractor_funcs):
        for func in extractor_funcs:
            if callable(func):
                raise Exception(
                    "Kindly check the extractor '"
                    + func.__name__
                    + "' and see if you forgot to call it."
                )
        self._extractors = extractor_funcs[:]
        return self

    def sort(self):
        self._sort_links = True
        self._randomize_links = False
        return self

    def randomize(self):
        self._randomize_links = True
        self._sort_links = False
        return self
