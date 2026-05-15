import json
import time

import redis.asyncio as aioredis

from src.application.interfaces.presence_tracker import IPresenceTracker

_ONLINE_HASH = "presence:online_users"
_EXPIRY_ZSET = "presence:expiry"
_HEARTBEAT_TTL = 90  # seconds — clients send heartbeat every 30s


class RedisPresenceStore(IPresenceTracker):
    def __init__(self, redis: aioredis.Redis) -> None:
        self._r = redis

    async def set_online(self, user_id: str, data: dict) -> None:
        async with self._r.pipeline(transaction=True) as pipe:
            pipe.hset(_ONLINE_HASH, user_id, json.dumps(data))
            pipe.zadd(_EXPIRY_ZSET, {user_id: time.time() + _HEARTBEAT_TTL})
            await pipe.execute()

    async def set_offline(self, user_id: str) -> None:
        async with self._r.pipeline(transaction=True) as pipe:
            pipe.hdel(_ONLINE_HASH, user_id)
            pipe.zrem(_EXPIRY_ZSET, user_id)
            await pipe.execute()

    async def get_online_users(self, limit: int = 100) -> list[dict]:
        _, data = await self._r.hscan(_ONLINE_HASH, cursor=0, count=limit)
        return [json.loads(v) for v in list(data.values())[:limit]]

    async def is_online(self, user_id: str) -> bool:
        return bool(await self._r.hexists(_ONLINE_HASH, user_id))

    async def update_heartbeat(self, user_id: str) -> None:
        await self._r.zadd(_EXPIRY_ZSET, {user_id: time.time() + _HEARTBEAT_TTL})

    async def evict_expired(self) -> int:
        """Remove users whose heartbeat TTL has passed. Called by background task."""
        expired_ids = await self._r.zrangebyscore(_EXPIRY_ZSET, "-inf", time.time())
        if not expired_ids:
            return 0
        async with self._r.pipeline(transaction=True) as pipe:
            pipe.hdel(_ONLINE_HASH, *expired_ids)
            pipe.zrem(_EXPIRY_ZSET, *expired_ids)
            await pipe.execute()
        return len(expired_ids)
