import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.fixture
def mock_manager():
    mgr = MagicMock()
    mgr.emit = AsyncMock()
    return mgr


@pytest.fixture
def publisher(mock_manager):
    with patch("src.infrastructure.realtime.redis_event_publisher.socketio.AsyncRedisManager", return_value=mock_manager):
        from src.infrastructure.realtime.redis_event_publisher import RedisEventPublisher
        return RedisEventPublisher(redis_url="redis://localhost/0"), mock_manager


@pytest.mark.asyncio
async def test_emit_to_room_uses_chat_namespace(publisher):
    pub, mgr = publisher
    await pub.emit_to_room("room-1", "receive_message", {"content": "hi"})
    mgr.emit.assert_awaited_once_with(
        "receive_message",
        data={"content": "hi"},
        room="room-1",
        namespace="/chat",
    )


@pytest.mark.asyncio
async def test_emit_to_user_prefixes_user_room(publisher):
    pub, mgr = publisher
    await pub.emit_to_user("user-abc", "new_direct_message", {"sender_id": "x"})
    mgr.emit.assert_awaited_once_with(
        "new_direct_message",
        data={"sender_id": "x"},
        room="user-user-abc",
        namespace="/notifications",
    )


@pytest.mark.asyncio
async def test_emit_broadcast_defaults_to_chat_namespace(publisher):
    pub, mgr = publisher
    await pub.emit_broadcast("announcement_banner_updated", {"message": "hello"})
    mgr.emit.assert_awaited_once_with(
        "announcement_banner_updated",
        data={"message": "hello"},
        namespace="/chat",
    )


@pytest.mark.asyncio
async def test_emit_broadcast_respects_custom_namespace(publisher):
    pub, mgr = publisher
    await pub.emit_broadcast("global_announcement", {"message": "hey"}, namespace="/notifications")
    mgr.emit.assert_awaited_once_with(
        "global_announcement",
        data={"message": "hey"},
        namespace="/notifications",
    )
