import asyncio
from typing import Any

from temporalio import activity
from temporalio.exceptions import ApplicationError

from .task_executor import TaskExecutor


class NonRetryableError(ApplicationError):
    def __init__(self, message: str, *details: Any, type: str | None = None):
        super().__init__(
            message,
            *details,
            type="NonRetryableError",
            non_retryable=True,
        )


executor = TaskExecutor()


@activity.defn(name="run_scraper")
async def run_scraper(task_id: int) -> None:
    try:
        return await executor.process_tasks([task_id])
    except Exception as e:
        raise NonRetryableError(message=str(e))


@activity.defn(name="mark_tasks_as_failed")
async def mark_tasks_as_failed(failed_tasks: list[tuple[int, str]]) -> None:
    coroutines = []
    for task_id, error in failed_tasks:
        coroutines.append(executor.mark_task_as_failure(task_id, error))
    return await asyncio.gather(*coroutines)


scraper_activities = [run_scraper, mark_tasks_as_failed]
