import asyncio
import traceback
from collections.abc import Callable
from dataclasses import asdict, is_dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import and_, or_, select, update

from .db_setup import get_async_session
from .models import Task, TaskStatus
from .registry import REGISTRY
from .scrapers import ScraperConfig
from .task_helper import TaskHelper


class TaskExecutor:
    async def process_tasks(self, task_ids: list[int], on_heatbeat: Callable | None = None):
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

        await asyncio.gather(*(self.run_task(task_json, on_heatbeat) for task_json in tasks_json))

    async def run_task(self, task, on_heatbeat: Callable | None):
        task_id = task["id"]
        scraper_name = task["scraper_name"]
        parent_task_id = task["parent_task_id"]
        metadata = {"metadata": task["metadata"]} if task["metadata"] != {} else {}
        task_data = task["data"]

        fn = REGISTRY.get_scraping_function(scraper_name)
        exception_log = None

        try:
            result = await asyncio.to_thread(
                fn,
                config=ScraperConfig(**task_data),
                **metadata,
            )
            if is_dataclass(result):
                result = asdict(result)
            if not isinstance(result, list):
                result = [result]
            await self.mark_task_as_success(
                task_id,
                result,
            )
        except Exception:
            exception_log = traceback.format_exc()
            traceback.print_exc()
            await self.mark_task_as_failure(task_id, exception_log)
        finally:
            if parent_task_id:
                if exception_log:
                    await self.update_parent_task(task_id, [])
                else:
                    await self.update_parent_task(task_id, result)

    async def update_parent_task(self, task_id, result):
        async with get_async_session() as session:
            task_to_update = await session.get(Task, task_id)
            parent_id = task_to_update.parent_task_id
        if parent_id:
            await self.complete_parent_task_if_possible(
                parent_id,
                result,
            )

    async def complete_parent_task_if_possible(self, parent_id, result):
        async with get_async_session() as session:
            parent_task = await TaskHelper.get_task(
                session,
                parent_id,
                [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
            )
            if parent_task:
                await TaskHelper.update_parent_task_results(
                    session,
                    parent_id,
                    result,
                )
                is_done = await TaskHelper.are_all_child_task_done(
                    session,
                    parent_id,
                )
                if is_done:
                    await TaskHelper.update_task(
                        session,
                        parent_id,
                        {
                            "status": TaskStatus.COMPLETED,
                            "finished_at": datetime.now(),
                        },
                    )
                    await session.commit()

    async def mark_task_as_failure(self, task_id, exception_log):
        async with get_async_session() as session:
            await TaskHelper.update_task(
                session,
                task_id,
                {
                    "status": TaskStatus.FAILED,
                    "finished_at": datetime.now(),
                    "result": exception_log,
                },
                [TaskStatus.IN_PROGRESS],
            )
            await session.commit()

    async def mark_task_as_success(self, task_id, result):
        async with get_async_session() as session:
            await TaskHelper.update_task(
                session,
                task_id,
                {
                    "result_count": len(result),
                    "status": TaskStatus.COMPLETED,
                    "finished_at": datetime.now(),
                    "result": result,
                },
                [TaskStatus.IN_PROGRESS],
            )
            await session.commit()
