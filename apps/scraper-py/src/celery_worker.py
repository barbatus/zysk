
from celery import Celery

from .settings import settings

celery_app = Celery(
    "worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_always_eager=False,
    task_ignore_result=False,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_soft_time_limit=240,
    task_time_limit=300,
    worker_pool="prefork",
    result_expires=3600,
    worker_max_tasks_per_child=50,
    redis_backend_health_check_interval=60,
    worker_prefetch_multiplier=1,
)
