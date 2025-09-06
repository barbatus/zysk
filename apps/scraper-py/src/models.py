from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class TaskStatus:
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"


def isoformat(obj):
    return obj.isoformat() if obj else None


def serialize_task(obj, with_result):
    return {
        "id": obj.id,
        "status": obj.status,
        "scraper_name": obj.scraper_name,
        "is_sync": obj.is_sync,
        "parent_task_id": obj.parent_task_id,
        "duration": None,
        "started_at": isoformat(obj.started_at),
        "finished_at": isoformat(obj.finished_at),
        "data": obj.data,
        "metadata": obj.meta_data,
        "cached_key": obj.cached_key,
        "result": obj.result if with_result else None,
        "result_count": obj.result_count,
        "created_at": isoformat(obj.created_at),
        "updated_at": isoformat(obj.updated_at),
    }


def serialize_ui_output_task(obj, _):
    return {
        "id": obj.id,
        "status": obj.status,
        "result_count": obj.result_count,
        "started_at": isoformat(obj.started_at),
        "finished_at": isoformat(obj.finished_at),
    }


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    status = Column(String, index=True)

    sort_id = Column(Integer, index=True)

    scraper_name = Column(String, index=True)
    is_sync = Column(Boolean, index=True)

    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)

    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    data = Column(JSON)
    meta_data = Column(JSON)
    result_count = Column(Integer, default=0)

    result = Column(JSON, nullable=True)
    cached_key = Column(String, nullable=True, index=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def to_json(self, with_result=True):
        return serialize_task(self, with_result)
