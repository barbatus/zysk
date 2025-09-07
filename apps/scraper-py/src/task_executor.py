import asyncio
import traceback
from collections.abc import Callable
from dataclasses import asdict, is_dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, and_, bindparam, case, or_, select, update

from .db_setup import get_async_session
from .models import Task, TaskStatus
from .registry import REGISTRY
from .scrapers import ScraperConfig
from .task_helper import db_retry


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

            valid_scraper_names = REGISTRY.get_scrapers_names()
            valid_scraper_names_set = set(valid_scraper_names)

            for task in tasks:
                if task.scraper_name not in valid_scraper_names_set:
                    raise Exception(
                        f"Invalid scraper '{task.scraper_name}'. "
                        f"Valid: {', '.join(valid_scraper_names)}"
                    )

            task_ids = [task.id for task in tasks]
            parent_ids = list({task.parent_task_id for task in tasks if task.parent_task_id})
            await session.execute(
                update(Task)
                .where(
                    or_(
                        Task.id.in_(task_ids),
                        and_(
                            Task.id.in_(parent_ids),
                            Task.started_at.is_(None),
                        ),
                    ),
                )
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
                    "is_sync": task.is_sync,
                    "parent_task_id": task.parent_task_id,
                    "data": task.data,
                    "metadata": task.meta_data,
                }
                tasks_json.append(task_dict)
            await session.commit()

        await asyncio.gather(
            *(self.run_task(task_json, on_heartbeat=on_heartbeat) for task_json in tasks_json)
        )

    async def run_task(self, task, on_heartbeat: Callable | None):
        task_id = task["id"]
        scraper_name = task["scraper_name"]
        task_data = task["data"]

        fn = REGISTRY.get_scraping_function(scraper_name)
        exception_log = None

        try:
            loop = asyncio.get_running_loop()

            def on_heartbeat_threadsafe():
                if on_heartbeat:
                    loop.call_soon_threadsafe(on_heartbeat)

            result = await asyncio.to_thread(
                fn,
                config=ScraperConfig(**task_data),
                on_heartbeat=on_heartbeat_threadsafe,
            )
            if is_dataclass(result):
                result = asdict(result)
            if not isinstance(result, list):
                result = [result]
            await self.mark_tasks_as_success(
                [task_id],
                [result],
            )
        except Exception:
            exception_log = traceback.format_exc()
            traceback.print_exc()
            await self.mark_tasks_as_failure([task_id], [exception_log])

    @db_retry
    async def mark_tasks_as_failure(self, task_ids: list[int], exception_logs: list[str]):
        if not task_ids:
            return
        if len(task_ids) != len(exception_logs):
            raise ValueError("task_ids and exception_logs must have the same length")
        async with get_async_session() as session:
            mapping = {
                tid: bindparam(f"result_{tid}", {"error": log}, type_=JSON)
                for tid, log in zip(task_ids, exception_logs, strict=False)
            }
            result_case = case(mapping, value=Task.id, else_=Task.result)
            await session.execute(
                update(Task)
                .where(Task.id.in_(task_ids))
                .values(
                    {
                        "status": TaskStatus.FAILED,
                        "finished_at": datetime.now(),
                        "result": result_case,
                    }
                )
            )
            await session.commit()

    @db_retry
    async def mark_tasks_as_success(self, task_ids: list[int], results: list[list[Any]]):
        if not task_ids:
            return
        if len(task_ids) != len(results):
            raise ValueError("task_ids and results must have the same length")
        async with get_async_session() as session:
            result_mapping = {
                tid: bindparam(f"result_{tid}", res, type_=JSON)
                for tid, res in zip(task_ids, results, strict=False)
            }
            count_mapping = {tid: len(res) for tid, res in zip(task_ids, results, strict=False)}
            result_case = case(result_mapping, value=Task.id, else_=Task.result)
            result_count_case = case(count_mapping, value=Task.id, else_=Task.result_count)
            await session.execute(
                update(Task)
                .where(
                    Task.id.in_(task_ids),
                    Task.status.in_([TaskStatus.IN_PROGRESS]),
                )
                .values(
                    {
                        "result_count": result_count_case,
                        "status": TaskStatus.COMPLETED,
                        "finished_at": datetime.now(),
                        "result": result_case,
                    }
                )
            )
            await session.commit()
