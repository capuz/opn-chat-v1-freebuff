import pytest
from src.infrastructure.redis.presence_store import RedisPresenceStore


@pytest.fixture
def store(fake_redis):
    return RedisPresenceStore(fake_redis)


@pytest.mark.asyncio
async def test_set_online_makes_user_visible(store):
    await store.set_online("u1", {"id": "u1", "nickname": "Alice"})
    assert await store.is_online("u1")


@pytest.mark.asyncio
async def test_set_offline_removes_user(store):
    await store.set_online("u1", {"id": "u1", "nickname": "Alice"})
    await store.set_offline("u1")
    assert not await store.is_online("u1")


@pytest.mark.asyncio
async def test_get_online_users_returns_all(store):
    await store.set_online("u1", {"id": "u1", "nickname": "Alice"})
    await store.set_online("u2", {"id": "u2", "nickname": "Bob"})
    users = await store.get_online_users()
    ids = {u["id"] for u in users}
    assert ids == {"u1", "u2"}


@pytest.mark.asyncio
async def test_offline_user_not_in_list(store):
    await store.set_online("u1", {"id": "u1", "nickname": "Alice"})
    await store.set_online("u2", {"id": "u2", "nickname": "Bob"})
    await store.set_offline("u1")
    users = await store.get_online_users()
    assert all(u["id"] != "u1" for u in users)


@pytest.mark.asyncio
async def test_evict_expired_removes_stale_entries(store, fake_redis):
    import time
    # Manually insert an expired entry
    import json
    await fake_redis.hset("presence:online_users", "stale", json.dumps({"id": "stale"}))
    await fake_redis.zadd("presence:expiry", {"stale": time.time() - 1})

    removed = await store.evict_expired()
    assert removed == 1
    assert not await store.is_online("stale")
