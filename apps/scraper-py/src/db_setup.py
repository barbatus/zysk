import subprocess
import sys
import threading
from contextlib import asynccontextmanager

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from .models import Base
from .settings import settings


def install(package):
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])


def dynamically_import_postgres():
    try:
        import psycopg2  # noqa: F401
    except ImportError:
        install("psycopg2-binary")


def clean_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://"):
        dynamically_import_postgres()
    return url


def _make_async_url(url: str) -> str:
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _ensure_async_drivers(url: str):
    if url.startswith("sqlite+aiosqlite://"):
        try:
            import aiosqlite  # noqa: F401
        except ImportError:
            install("aiosqlite")
    elif url.startswith("postgresql+asyncpg://"):
        try:
            import asyncpg  # noqa: F401
        except ImportError:
            install("asyncpg")


_db_url = clean_database_url(settings.database_url)

_async_db_url = _make_async_url(_db_url)

_ensure_async_drivers(_async_db_url)

thread_local = threading.local()


def create_async_session_maker():
    if not hasattr(thread_local, "async_engine"):
        thread_local.async_engine = create_async_engine(
            _async_db_url,
            poolclass=NullPool,
            connect_args={
                "ssl": True,
                "timeout": 120,
                "command_timeout": 120,
            }
            if _async_db_url.startswith("postgresql+")
            else {},
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
        _db_url,
    )
    Base.metadata.create_all(engine)


create_database()
