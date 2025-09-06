from temporalio import common
from temporalio.client import Client

from .settings import settings

workflow_retry_policy = common.RetryPolicy(
    maximum_attempts=1,
    non_retryable_error_types=["NonRetryableError"],
)


async def get_temporal_client():
    print(settings.temporal)
    t = settings.temporal
    client = await Client.connect(
        t.url,
        api_key=t.api_key,
        namespace=t.namespace,
        tls=t.tls,
    )
    return client


async def run_scrape_workflow(task_ids: list[int]) -> None:
    from uuid import uuid4

    client = await get_temporal_client()
    return await client.start_workflow(
        "runScrapeTasks",
        id=uuid4().hex,
        task_queue="scraper-tasks",
        args=[task_ids],
        retry_policy=workflow_retry_policy,
    )
