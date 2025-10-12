import asyncio
import traceback
from collections.abc import Callable
from dataclasses import asdict
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, bindparam, case, select, update

from .db_setup import get_async_session
from .exceptions import BotDetectedException
from .logging_setup import get_logger
from .models import Task, TaskStatus
from .scrapers import SCRAPERS, ScraperConfig
from .task_helper import db_retry

logger = get_logger(__name__)


class TaskExecutor:
    async def process_tasks(self, task_ids: list[int], on_heartbeat: Callable | None = None):
        tasks_json: list[dict[str, Any]] = []
        async with get_async_session() as session:
            stmt = (
                select(Task)
                .where(Task.id.in_(task_ids))
                .order_by(
                    Task.sort_id.desc(),
                    Task.is_sync.desc(),
                )
            )
            tasks = (await session.scalars(stmt)).all()
            if not tasks:
                return

            valid_scraper_names = SCRAPERS.keys()

            for task in tasks:
                if task.scraper_name not in set(valid_scraper_names):
                    raise Exception(
                        f"Invalid scraper '{task.scraper_name}'. "
                        f"Valid: {', '.join(valid_scraper_names)}"
                    )

            task_ids = [task.id for task in tasks]
            await session.execute(
                update(Task)
                .where(Task.id.in_(task_ids))
                .values(
                    {
                        "status": TaskStatus.IN_PROGRESS,
                        "started_at": datetime.now(),
                    }
                )
            )
            tasks_json = []
            for task in tasks:
                task_dict = {
                    "id": task.id,
                    "status": task.status,
                    "scraper_name": task.scraper_name,
                    "data": task.data,
                    "metadata": task.meta_data,
                }
                tasks_json.append(task_dict)
            await session.commit()

        logger.info("executor.process.start", task_ids=task_ids)
        await asyncio.gather(
            *(self.run_task(task_json, on_heartbeat=on_heartbeat) for task_json in tasks_json)
        )
        logger.info("executor.process.finished", task_count=len(task_ids))

    async def run_task(self, task: dict[str, Any], on_heartbeat: Callable | None):
        task_id = task["id"]
        scraper_name = task["scraper_name"]
        task_data = task["data"]
        task_metadata = task["metadata"]

        fn = SCRAPERS[scraper_name]
        try:
            loop = asyncio.get_running_loop()

            def on_heartbeat_threadsafe():
                if on_heartbeat:
                    loop.call_soon_threadsafe(on_heartbeat)

            logger.info("executor.task.start", task_id=task_id, scraper_name=scraper_name)
            result = await asyncio.to_thread(
                fn,
                config=ScraperConfig(url=task_data["url"], **(task_metadata or {})),
                on_heartbeat=on_heartbeat_threadsafe,
            )
            result_dict = asdict(result)
            stats_dict = result_dict.pop("stats")
            await self.mark_tasks_as_success(
                task_ids=[task_id],
                results=[result_dict],
                stats=[stats_dict],
            )
            logger.info("executor.task.success", task_id=task_id)
        except Exception as ex:
            exception_log = traceback.format_exc()
            logger.exception("executor.task.error", task_id=task_id)
            stats = ex.stats if isinstance(ex, BotDetectedException) else None
            await self.mark_tasks_as_failure([task_id], [exception_log], [stats])

    @db_retry
    async def mark_tasks_as_failure(
        self, task_ids: list[int], exception_logs: list[str], stats: list[dict] | None = None
    ):
        if not task_ids:
            return
        if len(task_ids) != len(exception_logs):
            raise ValueError("task_ids and exception_logs must have the same length")
        async with get_async_session() as session:
            mapping = {
                tid: bindparam(f"result_{tid}", {"error": log}, type_=JSON)
                for tid, log in zip(task_ids, exception_logs, strict=True)
            }
            result_case = case(mapping, value=Task.id, else_=Task.result)
            stats_mapping = {
                tid: bindparam(f"stats_{tid}", stat, type_=JSON)
                for tid, stat in zip(task_ids, stats, strict=True)
            }
            stats_case = case(stats_mapping, value=Task.id, else_=Task.stats)
            await session.execute(
                update(Task)
                .where(Task.id.in_(task_ids))
                .values(
                    {
                        "status": TaskStatus.FAILED,
                        "finished_at": datetime.now(),
                        "stats": stats_case,
                        "result": result_case,
                    }
                )
            )
            await session.commit()

    @db_retry
    async def mark_tasks_as_success(
        self, task_ids: list[int], results: list[list[dict]], stats: list[dict]
    ):
        if not task_ids:
            return
        if len(task_ids) != len(results):
            raise ValueError("task_ids and results must have the same length")
        async with get_async_session() as session:
            result_mapping = {
                tid: bindparam(f"result_{tid}", res, type_=JSON)
                for tid, res, stat in zip(task_ids, results, stats, strict=False)
            }
            stats_mapping = {
                tid: bindparam(f"stats_{tid}", stat, type_=JSON)
                for tid, stat in zip(task_ids, stats, strict=False)
            }
            result_case = case(result_mapping, value=Task.id, else_=Task.result)
            stats_case = case(stats_mapping, value=Task.id, else_=Task.stats)
            await session.execute(
                update(Task)
                .where(
                    Task.id.in_(task_ids),
                    Task.status.in_([TaskStatus.IN_PROGRESS]),
                )
                .values(
                    {
                        "status": TaskStatus.COMPLETED,
                        "finished_at": datetime.now(),
                        "result": result_case,
                        "stats": stats_case,
                    }
                )
            )
            await session.commit()
