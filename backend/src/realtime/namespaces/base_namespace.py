import asyncio
import logging
from collections.abc import Callable
from typing import Any

import socketio

logger = logging.getLogger(__name__)

_DEFAULT_TIMEOUT = 10.0


class BaseNamespace(socketio.AsyncNamespace):
    def __init__(self, namespace: str) -> None:
        super().__init__(namespace)

    async def _handle(
        self,
        sid: str,
        coro_factory: Callable[[], Any],
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> Any:
        """Wraps a handler coroutine with timeout and uniform error reporting."""
        try:
            return await asyncio.wait_for(coro_factory(), timeout=timeout)
        except asyncio.TimeoutError:
            logger.error("Handler timeout ns=%s sid=%s", self.namespace, sid)
            await self.emit("server_error", {"code": "TIMEOUT"}, room=sid)
        except Exception as exc:
            logger.exception("Handler error ns=%s sid=%s", self.namespace, sid)
            await self.emit("server_error", {"code": "INTERNAL", "message": str(exc)}, room=sid)
        return None

    async def _session_user_id(self, sid: str) -> str | None:
        session = await self.get_session(sid)
        return session.get("user_id") if session else None
