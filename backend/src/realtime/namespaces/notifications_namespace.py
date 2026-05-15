import logging

from src.realtime.auth import validate_jwt_from_environ
from src.realtime.namespaces.base_namespace import BaseNamespace

logger = logging.getLogger(__name__)


class NotificationsNamespace(BaseNamespace):
    async def on_connect(
        self, sid: str, environ: dict, auth: dict | None = None
    ) -> None:
        payload = await validate_jwt_from_environ(environ, auth)
        if not payload:
            raise ConnectionRefusedError("Unauthorized")

        await self.save_session(sid, {
            "user_id": payload["sub"],
            "nickname": payload.get("nickname", ""),
        })
        # Personal room so emit_to_user() can target this connection
        await self.enter_room(sid, f"user-{payload['sub']}")

    async def on_disconnect(self, sid: str) -> None:
        user_id = await self._session_user_id(sid)
        if user_id:
            await self.leave_room(sid, f"user-{user_id}")
