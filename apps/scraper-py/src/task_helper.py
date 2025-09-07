from datetime import datetime

from retrying import retry
from sqlalchemy import delete, func, select, update

from .db_setup import AsyncSession
from .models import Task, TaskStatus


def db_retry(func=None, *, attempts: int = 3, delay: float = 10.0):
    if func is None:
        return lambda f: retry(attempts=attempts, delay=delay)(f)
    return retry(stop_max_attempt_number=attempts, wait_fixed=delay * 1000)(func)


class TaskHelper:
    @staticmethod
    @db_retry
    async def are_all_child_task_done(session: AsyncSession, parent_id: int):
        done_children_count = await TaskHelper.get_done_children_count(
            session,
            parent_id,
        )
        child_count = await TaskHelper.get_all_children_count(
            session,
            parent_id,
        )
        return done_children_count == child_count

    @staticmethod
    @db_retry
    async def get_all_children_count(
        session: AsyncSession,
        parent_id: int,
        except_task_id: int | None = None,
    ):
        query = select(func.count()).select_from(Task).where(Task.parent_task_id == parent_id)
        if except_task_id:
            query = query.where(Task.id != except_task_id)
        return await session.scalar(query)

    @staticmethod
    @db_retry
    async def get_done_children_count(
        session: AsyncSession,
        parent_id: int,
        except_task_id: int | None = None,
    ):
        query = (
            select(func.count())
            .select_from(Task)
            .where(
                Task.parent_task_id == parent_id,
                Task.status.in_(
                    [
                        TaskStatus.COMPLETED,
                        TaskStatus.FAILED,
                        TaskStatus.ABORTED,
                    ]
                ),
            )
        )
        if except_task_id:
            query = query.where(Task.id != except_task_id)
        return await session.scalar(query)

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

    @staticmethod
    @db_retry
    async def update_parent_task_results(session: AsyncSession, parent_id, result):
        from sqlalchemy import text

        await session.execute(
            update(Task)
            .where(Task.id == parent_id)
            .values(
                result_count=Task.result_count + len(result),
                result=text("COALESCE(result, '[]'::json) || :new_result::json"),
            ),
            {"new_result": result},
        )
        await session.commit()
