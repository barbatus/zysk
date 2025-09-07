from typing import Any

from temporalio import activity
from temporalio.exceptions import ApplicationError

from .exceptions import BotDetectedException
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
        await executor.process_tasks([task_id], on_heartbeat=lambda: activity.heartbeat())
    except Exception as e:
        activity.heartbeat()
        if isinstance(e, BotDetectedException):
            await mark_tasks_as_failed([(task_id, str(e))])
            raise NonRetryableError(message=str(e)) from e
        raise e


@activity.defn(name="mark_tasks_as_failed")
async def mark_tasks_as_failed(failed_tasks: list[tuple[int, str]]) -> None:
    if not failed_tasks:
        return
    task_ids = [task_id for task_id, _ in failed_tasks]
    errors = [error for _, error in failed_tasks]
    await executor.mark_tasks_as_failure(task_ids, errors)
    print(f"Set tasks as failed: {failed_tasks}")


scraper_activities = [run_scraper, mark_tasks_as_failed]
