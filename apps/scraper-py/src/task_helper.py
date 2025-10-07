from datetime import datetime

from retrying import retry
from sqlalchemy import delete, select, update

from .db_setup import AsyncSession
from .models import Task, TaskStatus


def db_retry(func=None, *, attempts: int = 3, delay: float = 10.0):
    if func is None:
        return lambda f: retry(attempts=attempts, delay=delay)(f)
    return retry(stop_max_attempt_number=attempts, wait_fixed=delay * 1000)(func)


class TaskHelper:
    @staticmethod
    @retry(attempts=3, delay=1)
    async def get_task(
        session: AsyncSession,
        task_id: int,
        in_status: list[TaskStatus] | None = None,
    ) -> Task | None:
        if in_status:
            return (
                (
                    await session.execute(
                        select(Task).where(
                            Task.id == task_id,
                            Task.status.in_(in_status),
                        ),
                    )
                )
                .scalars()
                .first()
            )
        else:
            return await session.get(Task, task_id)

    @staticmethod
    @db_retry
    async def get_tasks_with_entities(
        session: AsyncSession,
        task_ids: list[int],
        entities,
    ) -> list[Task]:
        result = await session.execute(
            select(*entities).where(Task.id.in_(task_ids)),
        )
        return result.all()

    @staticmethod
    @db_retry
    async def update_task(
        session: AsyncSession,
        task_id: int,
        data: dict,
        in_status: list[TaskStatus] | None = None,
    ):
        query = update(Task).where(Task.id == task_id)
        if in_status:
            query = query.where(Task.status.in_(in_status))
        query = query.values(**data)
        return await session.execute(query)

    @staticmethod
    async def abort_task(session: AsyncSession, task_id: int):
        query = (
            update(Task)
            .where(
                Task.id == task_id,
                Task.finished_at.is_(None),
            )
            .values({"finished_at": datetime.now()})
        )
        await session.execute(query)
        return TaskHelper.update_task(
            session,
            task_id,
            {
                "status": TaskStatus.ABORTED,
            },
        )

    @staticmethod
    @db_retry
    async def delete_task(session: AsyncSession, task_id: int):
        await session.execute(
            delete(Task).where(Task.id == task_id),
        )
