import threading
from contextlib import asynccontextmanager

import asyncpg  # noqa: F401
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from .models import Base
from .settings import settings

thread_local = threading.local()


def create_async_session_maker():
    if not hasattr(thread_local, "async_engine"):
        thread_local.async_engine = create_async_engine(
            settings.async_db_url,
            poolclass=NullPool,
            connect_args={
                "ssl": True,
                "timeout": 120,
                "command_timeout": 120,
            },
        )

        thread_local.session_maker = async_sessionmaker(
            bind=thread_local.async_engine,
            expire_on_commit=False,
            class_=AsyncSession,
        )

    return thread_local.session_maker


@asynccontextmanager
async def get_async_session():
    session_maker = create_async_session_maker()
    async with session_maker() as session:
        yield session


def create_database():
    engine = create_engine(
        settings.db_url,
    )
    Base.metadata.create_all(engine)


create_database()
