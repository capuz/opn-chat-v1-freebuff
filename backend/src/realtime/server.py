import logging

import socketio

from src.core.config import settings

logger = logging.getLogger(__name__)


def create_sio_server() -> socketio.AsyncServer:
    try:
        mgr: socketio.AsyncRedisManager | None = socketio.AsyncRedisManager(
            settings.REDIS_URL,
            channel=settings.SOCKETIO_REDIS_CHANNEL,
        )
    except Exception:
        logger.warning("Redis unavailable — falling back to in-process message queue")
        mgr = None

    kwargs = dict(
        async_mode="asgi",
        cors_allowed_origins=settings.CORS_ORIGINS,
        logger=True,
        engineio_logger=False,
        ping_timeout=60,
        ping_interval=25,
    )
    if mgr is not None:
        kwargs["client_manager"] = mgr

    return socketio.AsyncServer(**kwargs)
