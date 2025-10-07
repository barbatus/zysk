from temporalio import common
from temporalio.client import Client

from .logging_setup import get_logger
from .settings import settings

workflow_retry_policy = common.RetryPolicy(
    maximum_attempts=1,
    non_retryable_error_types=["NonRetryableError"],
)


logger = get_logger(__name__)


async def get_temporal_client():
    t = settings.temporal
    logger.info(
        "temporal.client.connect",
        url=t.url,
        namespace=t.namespace,
        tls=t.tls,
        has_api_key=bool(t.api_key),
    )
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
    run = await client.start_workflow(
        "runScrapeTasks",
        id=uuid4().hex,
        task_queue="scraper-tasks",
        args=[task_ids],
        retry_policy=workflow_retry_policy,
    )
    logger.info(
        "temporal.workflow.started", workflow_id=run.id, run_id=run.run_id, task_count=len(task_ids)
    )
    return run
