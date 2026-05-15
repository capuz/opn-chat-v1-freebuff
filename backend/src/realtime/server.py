import socketio

from src.core.config import settings


def create_sio_server() -> socketio.AsyncServer:
    mgr = socketio.AsyncRedisManager(
        settings.REDIS_URL,
        channel=settings.SOCKETIO_REDIS_CHANNEL,
    )
    return socketio.AsyncServer(
        async_mode="asgi",
        client_manager=mgr,
        cors_allowed_origins=settings.CORS_ORIGINS,
        logger=True,
        engineio_logger=False,
        ping_timeout=60,
        ping_interval=25,
    )
