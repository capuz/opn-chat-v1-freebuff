import socketio

from src.application.interfaces.event_publisher import IRealtimeEventPublisher
from src.core.config import settings


class RedisEventPublisher(IRealtimeEventPublisher):
    """
    Emits Socket.IO events from the FastAPI process via Redis pub/sub.
    write_only=True: publishes to the channel without hosting a WS server.
    """

    def __init__(self, redis_url: str | None = None) -> None:
        self._mgr = socketio.AsyncRedisManager(
            redis_url or settings.REDIS_URL,
            write_only=True,
            channel=settings.SOCKETIO_REDIS_CHANNEL,
        )

    async def emit_to_room(self, room_id: str, event: str, data: dict) -> None:
        await self._mgr.emit(event, data=data, room=room_id, namespace="/chat")

    async def emit_to_user(self, user_id: str, event: str, data: dict) -> None:
        # Each connected user is automatically added to room "user-{id}"
        await self._mgr.emit(
            event,
            data=data,
            room=f"user-{user_id}",
            namespace="/notifications",
        )

    async def emit_broadcast(
        self, event: str, data: dict, namespace: str = "/chat"
    ) -> None:
        await self._mgr.emit(event, data=data, namespace=namespace)
