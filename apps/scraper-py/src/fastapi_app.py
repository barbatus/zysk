from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from .links import Filters
from .routes_db_logic import (
    OK_MESSAGE,
    execute_async_tasks,
    execute_get_task_results,
    execute_get_tasks,
    get_task_from_db,
    perform_get_tasks_results,
    perform_patch_task,
)
from .sitemap import Sitemap


class TaskData(BaseModel):
    url: str


class TaskRequest(BaseModel):
    scraper_name: str
    data: TaskData


class TaskResponse(BaseModel):
    id: int
    status: str
    scraper_name: str
    is_sync: bool
    parent_task_id: int | None
    duration: int | None
    started_at: str | None
    finished_at: str | None
    data: dict[str, Any]
    metadata: dict[str, Any]
    cached_key: str
    result: Any | None
    result_count: int
    created_at: str
    updated_at: str


app = FastAPI(title="Botasaurus API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def jsonify(data: Any) -> JSONResponse:
    return JSONResponse(content=data)


@app.get("/", include_in_schema=False)
def home() -> RedirectResponse:
    return RedirectResponse(url="/api")


@app.get("/api", response_model=dict[str, str])
def api_root() -> dict[str, str]:
    return JSONResponse(content=OK_MESSAGE)


@app.post("/api/tasks/create-task-async", response_model=TaskResponse | list[TaskResponse])
async def create_task_async(task_request: TaskRequest | list[TaskRequest]):
    json_data = (
        [req.model_dump() for req in task_request]
        if isinstance(task_request, list)
        else [task_request.model_dump()]
    )
    result = await execute_async_tasks(json_data)
    return result


@app.get("/api/tasks")
async def get_tasks(
    page: int = Query(1, ge=1),
    per_page: int | None = Query(None, ge=1),
    with_results: bool = Query(True),
):
    query_dict = {
        "page": str(page),
        "per_page": str(per_page) if per_page else None,
        "with_results": "true" if with_results else "false",
    }
    result = await execute_get_tasks(query_dict)
    return result


@app.get("/api/tasks/{task_id}")
async def get_task(task_id: int):
    return await get_task_from_db(task_id)


@app.post("/api/tasks/{task_id}/results")
async def get_task_results(task_id: int, request: Request):
    json_data = await request.json()
    result = await execute_get_task_results(task_id, json_data)
    return jsonify(result)


@app.patch("/api/tasks/{task_id}/abort")
async def abort_single_task(task_id: int):
    await perform_patch_task("abort", task_id)
    return JSONResponse(content=OK_MESSAGE)


@app.post("/api/tasks/results")
async def get_ui_tasks_results(request: Request):
    json_data = await request.json()
    task_ids = json_data["task_ids"]
    results = await perform_get_tasks_results(task_ids)
    return jsonify(results)


@app.delete("/api/tasks/{task_id}")
async def delete_single_task(task_id: int):
    await perform_patch_task("delete", task_id)
    return JSONResponse(content=OK_MESSAGE)


class SitemapFilter(BaseModel):
    segment: str
    isFirst: bool
    level: int


class LinkFilter(BaseModel):
    segment: str
    isFirst: bool


class Filter(BaseModel):
    sitemaps: list[SitemapFilter] = Field(default_factory=list)
    links: list[LinkFilter] = Field(default_factory=list)


class SitemapRequest(BaseModel):
    domain: str
    filters: list[Filter] = Field(default_factory=list)
    since: datetime | None = Field(default=None, alias="from")
    to: datetime | None = Field(default=None, alias="to")


@app.post("/api/sitemaps/links", response_model=list[str])
async def get_sitemap_links(body: SitemapRequest) -> list[str]:
    domain = body.domain
    since = body.since
    to = body.to

    result: list[str] = []

    for filter in body.filters:
        sitemap_filters = filter.sitemaps
        link_filters = filter.links

        def convert_filters(filters: list[SitemapFilter | LinkFilter], level: int):
            return (
                Filters.first_segment_equals(filter.segment)
                if filter.isFirst
                else Filters.last_segment_equals(filter.segment)
                for filter in filters
                if isinstance(filter, LinkFilter) or filter.level == level
            )

        sitemaps_first_level = convert_filters(sitemap_filters, 0)
        sitemaps_second_level = convert_filters(sitemap_filters, 1)
        links_first_level = convert_filters(link_filters, 0)

        sitemaps = await (
            Sitemap(
                domain,
                proxy=None,
            )
            .filter(*sitemaps_first_level, level=0)
            .filter(*sitemaps_second_level, level=1)
            .sitemaps()
        )
        sitemap_links = await sitemaps.filter(*links_first_level, level=0).links(since=since, to=to)
        result.extend(sitemap_links)

    return jsonify(result)
