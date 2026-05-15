import pytest
import fakeredis.aioredis as fakeredis


@pytest.fixture
def fake_redis():
    return fakeredis.FakeRedis(decode_responses=True)
