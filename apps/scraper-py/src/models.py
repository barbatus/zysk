from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
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


def serialize_task(task: "Task"):
    return {
        "id": task.id,
        "status": task.status,
        "scraper_name": task.scraper_name,
        "is_sync": task.is_sync,
        "started_at": isoformat(task.started_at),
        "finished_at": isoformat(task.finished_at),
        "data": task.data,
        "metadata": task.meta_data,
        "cached_key": task.cached_key,
        "result": task.result,
        "created_at": isoformat(task.created_at),
        "updated_at": isoformat(task.updated_at),
    }


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    status = Column(String, index=True)

    sort_id = Column(Integer, index=True)

    scraper_name = Column(String, index=True)
    is_sync = Column(Boolean, index=True)

    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    data = Column(JSON)
    meta_data = Column(JSON)

    result = Column(JSON, nullable=True)
    stats = Column(JSON, nullable=True)
    cached_key = Column(String, nullable=True, index=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def to_json(self):
        return serialize_task(self)
