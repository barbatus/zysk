import logging
import os
import sys
from typing import Any

import structlog


def _get_renderer() -> structlog.types.Processor:
    log_format = os.getenv("LOG_FORMAT", "json").lower()
    if log_format in {"console", "pretty"}:
        return structlog.dev.ConsoleRenderer(colors=True)
    return structlog.processors.JSONRenderer()


def setup_logging(level: int | str | None = None) -> None:
    if isinstance(level, str):
        level = getattr(logging, level.upper(), logging.INFO)
    if level is None:
        level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)

    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)

    # Configure standard library logging to pass messages through structlog
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
        force=True,
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            timestamper,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            _get_renderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.BoundLogger:
    return structlog.get_logger(name) if name else structlog.get_logger()


def bind_temporal_activity_context(
    logger: structlog.BoundLogger | None = None, **extra: Any
) -> structlog.BoundLogger:
    try:
        from temporalio import activity

        info = activity.info()
        base = logger or get_logger(__name__)
        return base.bind(
            workflow_id=info.workflow_id,
            run_id=info.workflow_run_id,
            workflow_type=getattr(info, "workflow_type", None),
            activity_id=info.activity_id,
            activity_type=getattr(info, "activity_type", None),
            **extra,
        )
    except Exception:
        # If called outside of an activity, just return a logger bound with extras
        base = logger or get_logger(__name__)
        return base.bind(**extra)
