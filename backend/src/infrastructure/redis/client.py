from functools import lru_cache

import redis.asyncio as aioredis

from src.core.config import settings


@lru_cache(maxsize=1)
def get_redis_pool() -> aioredis.Redis:
    return aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
