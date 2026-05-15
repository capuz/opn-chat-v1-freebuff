from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings


class BoostAlreadyActiveError(Exception):
    pass


@dataclass
class BoostResult:
    room_id: str
    expires_at: datetime


class BoostRoomUseCase:
    def __init__(self, redis: aioredis.Redis, db: AsyncSession) -> None:
        self._redis = redis
        self._db = db

    async def execute(
        self, user_id: str, room_id: str, is_admin: bool = False
    ) -> BoostResult:
        key = f"boost:{room_id}"
        existing = await self._redis.exists(key)

        if existing and not is_admin:
            raise BoostAlreadyActiveError("A boost is already active for this room")

        duration = timedelta(minutes=settings.BOOST_DURATION_MINUTES)
        expires_at = datetime.now(UTC) + duration

        await self._redis.hset(key, mapping={
            "user_id": user_id,
            "expires_at": expires_at.isoformat(),
        })
        await self._redis.expire(key, int(duration.total_seconds()))

        return BoostResult(room_id=room_id, expires_at=expires_at)
