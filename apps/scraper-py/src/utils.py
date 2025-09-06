import asyncio
from collections.abc import Awaitable, Coroutine, Sequence
from dataclasses import dataclass
from time import monotonic
from typing import Any, TypeVar

from bs4 import BeautifulSoup
from markdownify import markdownify as md


def convert_to_markdown(html: str, remove_ul: bool = True) -> str:
    soup = BeautifulSoup(html, "html.parser")
    tags_to_remove = ["a", "img"] + (["ul", "ol", "li"] if remove_ul else [])
    for element in soup.find_all(tags_to_remove):
        if element.name == "a":
            element.replace_with(element.get_text())
        else:
            element.decompose()
    return md(str(soup))


TaskResultT = TypeVar("TaskResultT")


async def execute_concurrently(
    awaitables: Sequence[Awaitable[TaskResultT]],
    raise_on_error: bool = False,
) -> tuple[dict[int, TaskResultT], dict[int, Exception]]:
    """
    Run a set of awaitables concurrently and return the tuple of results and errors.

    :param awaitables: a sequence of awaitables to run concurrently
    :return: a tuple containing the results and errors
    """
    results: dict[int, TaskResultT] = {}
    errors: dict[int, Exception] = {}
    outcomes = await asyncio.gather(*awaitables, return_exceptions=not raise_on_error)
    for i, outcome in enumerate(outcomes):
        task_name = i
        if isinstance(outcome, Exception):
            errors[task_name] = outcome
        else:
            results[task_name] = outcome

    return results, errors


@dataclass
class GatherStats:
    total_time_sec: float
    success_count: int
    error_count: int

    def __post_init__(self):
        # Round the `total_time_sec` to 2 decimal places on initialization
        self.total_time_sec = round(self.total_time_sec, 2)


async def execute_concurrently_stat(
    coroutines: Sequence[Coroutine[Any, Any, TaskResultT]],
    results_list: bool = False,
    *,
    operation_name: str | None = None,
    raise_on_error: bool = False,
) -> tuple[
    dict[int, TaskResultT] | list[TaskResultT],
    dict[int, Exception],
    GatherStats,
]:
    start_time = monotonic()
    results, errors = await execute_concurrently(
        coroutines,
        raise_on_error=raise_on_error,
    )
    total_time = monotonic() - start_time

    stats = GatherStats(
        total_time_sec=total_time,
        success_count=len(results),
        error_count=len(errors),
    )

    if errors and operation_name:
        for error in errors:
            print(f"Error in {operation_name.lower()}: {errors[error]}")

    if errors and raise_on_error:
        raise next(iter(errors.values()))

    if operation_name:
        print(
            f"{operation_name} stats {stats}",
        )

    return list(results.values()) if results_list is True else results, errors, stats
