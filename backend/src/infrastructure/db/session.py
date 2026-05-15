from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.core.config import settings

_engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
_factory = async_sessionmaker(_engine, expire_on_commit=False)


@asynccontextmanager
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with _factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
