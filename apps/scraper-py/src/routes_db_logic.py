import asyncio
import json
from datetime import UTC, datetime
from hashlib import sha256
from time import sleep
from typing import Any

from sqlalchemy import select

from .db_setup import AsyncSessionMaker, Session
from .models import (
    Task,
    TaskStatus,
    isoformat,
    serialize_task,
)
from .registry import REGISTRY
from .settings import settings
from .task_helper import TaskHelper
from .temporal_client import run_scrape_workflow
from .validation import (
    create_task_not_found_error,
    serialize,
    validate_scraper_name,
)


def extract_task_data(json_data):
    """Extract task data from JSON - validation is done by FastAPI"""
    scraper_name = json_data.get("scraper_name")
    data = json_data.get("data", {})
    metadata = {}
    validate_scraper_name(scraper_name)  # Still validate scraper exists
    return scraper_name, data, metadata


async def perform_create_tasks(tasks) -> list[str]:
    async with AsyncSessionMaker() as session:
        session.add_all(tasks)
        await session.commit()
        return serialize(tasks)


def is_task_done(task_id):
    with Session() as session:
        x = TaskHelper.is_task_completed_or_failed(session, task_id)
    return x


def create_task_query(ets, session):
    return session.query(Task).with_entities(*ets)


def queryTasks(ets, with_results, page=None, per_page=None, serializer=serialize_task):
    with Session() as session:
        tasks_query = create_task_query(ets, session)
        total_count = tasks_query.count()

        if per_page is None:
            per_page = 1 if total_count == 0 else total_count
            page = 1
        else:
            per_page = int(per_page)

        total_pages = max((total_count + per_page - 1) // per_page, 1)
        page = int(page)
        page = max(min(page, total_pages), 1)
        tasks_query = create_task_query(ets, session).order_by(Task.sort_id.desc())
        if per_page is not None:
            per_page = int(per_page)
            start = (page - 1) * per_page
            tasks_query = tasks_query.limit(per_page).offset(start)
        tasks = tasks_query.all()
        current_page = page if page is not None else 1
        next_page = current_page + 1 if (current_page * per_page) < total_count else None
        previous_page = current_page - 1 if current_page > 1 else None
        return {
            "count": total_count,
            "total_pages": total_pages,
            "next": next_page,
            "previous": previous_page,
            "results": [serializer(task, with_results) for task in tasks],
        }


async def get_task_from_db(task_id):
    async with AsyncSessionMaker() as session:
        task = await TaskHelper.get_task(session, task_id)
        if task:
            return serialize(task)
        else:
            raise create_task_not_found_error(task_id)


OK_MESSAGE = {"message": "OK"}


async def create_async_task(validated_data) -> Task:
    scraper_name, data, metadata = validated_data
    tasks = await create_tasks(REGISTRY.get_scraper(scraper_name), data, metadata, False)
    return tasks[0]


async def execute_async_task(json_data):
    result = await create_async_task(extract_task_data(json_data))
    if result["status"] != TaskStatus.COMPLETED:
        await run_scrape_workflow([result["id"]])
    return result


async def execute_async_tasks(json_data):
    validated_data_items = [extract_task_data(item) for item in json_data]
    tasks = [
        await create_async_task(validated_data_item) for validated_data_item in validated_data_items
    ]
    await run_scrape_workflow(
        [task["id"] for task in tasks if task["status"] != TaskStatus.COMPLETED]
    )
    return tasks


async def create_tasks(scraper, data, metadata, is_sync):
    scraper_name = scraper["scraper_name"]

    all_task_sort_id = int(datetime.now(UTC).timestamp())
    tasks_data = [data]

    def create_task(task_data, cached_key: str, sort_id: int):
        return Task(
            status=TaskStatus.PENDING,
            scraper_name=scraper_name,
            is_sync=is_sync,
            parent_task_id=None,
            data=task_data,
            meta_data=metadata,
            sort_id=sort_id,
            cached_key=cached_key,
        )

    def create_cache_key(scraper_name: str, data: dict) -> str:
        return scraper_name + "-" + sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

    async def create_cached_tasks():
        ls: dict[str, Any] = []
        cache_keys: list[str] = []
        for t in tasks_data:
            key = create_cache_key(scraper_name, t)
            ls.append({"key": key, "task_data": t})
            cache_keys.append(key)
        cache_map: dict[str, Any] = {}
        async with AsyncSessionMaker() as session:
            query = select(Task).where(
                Task.cached_key.in_(cache_keys),
                Task.status.in_([TaskStatus.COMPLETED, TaskStatus.PENDING]),
            )
            result = (await session.scalars(query)).all()
            cache_map = {row.cached_key: row for row in result}
        tasks: list[Task] = []
        cached_tasks: list[Task] = []
        for idx, item in enumerate(ls):
            cached_task = cache_map.get(item["key"])
            if cached_task:
                sort_id = all_task_sort_id - (idx + 1)
                cached_tasks.append(cached_task)
            else:
                sort_id = all_task_sort_id - (idx + 1)
                tasks.append(create_task(item["task_data"], item["key"], sort_id))
        return tasks, cached_tasks

    if settings.cache_enabled:
        tasks, cached_tasks = await create_cached_tasks()
        tasks = (await perform_create_tasks(tasks) if tasks else []) + [
            serialize(cached_task) for cached_task in cached_tasks
        ]
    else:
        tasks, cached_tasks = [], []
        for idx, task_data in enumerate(tasks_data):
            sort_id = all_task_sort_id - (idx + 1)
            tasks.append(create_task(task_data, "", sort_id))
        tasks = await perform_create_tasks(tasks)

    if cached_tasks:
        print(f"{len(cached_tasks)} out of {len(tasks)} results are from cache")
    return tasks


def execute_sync_task(json_data):
    scraper_name, data, metadata = extract_task_data(json_data)
    tasks = asyncio.get_event_loop().run_until_complete(
        create_tasks(REGISTRY.get_scraper(scraper_name), data, metadata, True)
    )
    for task in tasks:
        task_id = task["id"]
        while True:
            if is_task_done(task_id):
                break
            sleep(0.1)
    return asyncio.get_event_loop().run_until_complete(get_task_from_db(tasks[0]["id"]))


def execute_sync_tasks(json_data):
    validated_data_items = [extract_task_data(item) for item in json_data]
    task_groups = []
    for validated_data_item in validated_data_items:
        scraper_name, data, metadata = validated_data_item
        tasks = asyncio.get_event_loop().run_until_complete(
            create_tasks(REGISTRY.get_scraper(scraper_name), data, metadata, True)
        )
        task_groups.append(tasks)
    for group in task_groups:
        for task in group:
            task_id = task["id"]
            while True:
                if is_task_done(task_id):
                    break
                sleep(0.1)
    results = []
    for group in task_groups:
        results.append(
            asyncio.get_event_loop().run_until_complete(get_task_from_db(group[0]["id"]))
        )
    return results


def get_ets(with_results):
    return [
        Task.id,
        Task.status,
        Task.scraper_name,
        Task.result_count,
        Task.is_sync,
        Task.parent_task_id,
        Task.data,
        Task.meta_data,
        Task.finished_at,
        Task.started_at,
        Task.created_at,
        Task.updated_at,
    ]


def create_page_url(page, per_page, with_results):
    query_params = {}
    if page:
        query_params["page"] = page
    if per_page is not None:
        query_params["per_page"] = per_page
    if not with_results:
        query_params["with_results"] = False
    if query_params != {}:
        return query_params


def execute_get_tasks(query_params):
    with_results = query_params.get("with_results", "true").lower() == "true"
    page = query_params.get("page")
    per_page = query_params.get("per_page")

    page = int(page) if page is not None else 1
    per_page = int(per_page) if per_page is not None else None

    return queryTasks(get_ets(with_results), with_results, page, per_page)


async def perform_get_task_results(task_id):
    async with AsyncSessionMaker() as session:
        tasks = await TaskHelper.get_tasks_with_entities(
            session,
            [task_id],
            [Task.scraper_name, Task.result_count, Task.data],
        )
        task = tasks[0] if tasks else None
        if not task:
            raise create_task_not_found_error(task_id)
    return task.scraper_name, task.data, task.result_count


async def execute_get_task_results(task_id):
    scraper_name, task_data, result_count = await perform_get_task_results(task_id)
    validate_scraper_name(scraper_name)
    return {
        "count": result_count,
        "total_pages": 1,
        "next": None,
        "previous": None,
        "results": task_data,
    }


async def perform_get_tasks_results(task_ids):
    async with AsyncSessionMaker() as session:
        tasks = await TaskHelper.get_tasks_with_entities(
            session,
            task_ids,
            [
                Task.id,
                Task.scraper_name,
                Task.result_count,
                Task.data,
                Task.updated_at,
                Task.status,
                Task.result,
            ],
        )
        return [
            {
                "scraper_name": task.scraper_name,
                "task_data": task.data,
                "result_count": task.result_count,
                "task_id": task.id,
                "status": task.status,
                "updated_at": isoformat(task.updated_at),
                "results": task.result,
            }
            for task in tasks
        ]


async def perform_patch_task(action, task_id):
    async with AsyncSessionMaker() as session:
        query = select(
            Task.id,
            Task.parent_task_id,
            Task.scraper_name,
        ).where(Task.id == task_id)
        result = await session.execute(query)
        task = result.first()
    if task:
        task = task[0:3]
        if action == "delete":
            async with AsyncSessionMaker() as session:
                await TaskHelper.delete_task(session, task[0])
                await session.commit()
        elif action == "abort":
            async with AsyncSessionMaker() as session:
                await TaskHelper.abort_task(session, task[0])
                await session.commit()
