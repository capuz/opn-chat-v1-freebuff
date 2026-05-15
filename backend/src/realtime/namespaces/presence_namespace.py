import logging

from src.infrastructure.redis.client import get_redis_pool
from src.infrastructure.redis.presence_store import RedisPresenceStore
from src.realtime.auth import validate_jwt_from_environ
from src.realtime.namespaces.base_namespace import BaseNamespace

logger = logging.getLogger(__name__)


class PresenceNamespace(BaseNamespace):
    @property
    def _store(self) -> RedisPresenceStore:
        return RedisPresenceStore(get_redis_pool())

    async def on_connect(
        self, sid: str, environ: dict, auth: dict | None = None
    ) -> None:
        payload = await validate_jwt_from_environ(environ, auth)
        if not payload:
            raise ConnectionRefusedError("Unauthorized")

        user_data = {
            "user_id": payload["sub"],
            "nickname": payload.get("nickname", ""),
            "country_code": payload.get("country_code"),
            "show_flag": payload.get("show_flag", False),
            "badge": payload.get("badge"),
            "away_message": None,
        }
        await self.save_session(sid, user_data)
        await self._store.set_online(payload["sub"], user_data)
        await self.enter_room(sid, f"user-{payload['sub']}")

        online = await self._store.get_online_users()
        await self.emit("online_users_list", online, room=sid)
        await self.emit("user_online", user_data, skip_sid=sid)

    async def on_disconnect(self, sid: str) -> None:
        session = await self.get_session(sid)
        if not session:
            return
        user_id = session.get("user_id")
        if user_id:
            await self._store.set_offline(user_id)
            await self.emit("user_offline", {"user_id": user_id})

    async def on_join_presence_room(self, sid: str, room_id: str) -> None:
        async def _inner() -> None:
            await self.enter_room(sid, f"presence-{room_id}")
            online = await self._store.get_online_users()
            await self.emit("online_users_list", online, room=sid)

        await self._handle(sid, _inner, timeout=5.0)

    async def on_leave_presence_room(self, sid: str, room_id: str) -> None:
        await self.leave_room(sid, f"presence-{room_id}")

    async def on_set_away(self, sid: str, message: str) -> None:
        async def _inner() -> None:
            session = await self.get_session(sid)
            user_id = session.get("user_id")
            session["away_message"] = message
            await self.save_session(sid, session)
            await self._store.set_online(user_id, session)
            await self.emit(
                "user_away_updated",
                {"user_id": user_id, "away_message": message},
            )

        await self._handle(sid, _inner, timeout=3.0)

    async def on_clear_away(self, sid: str) -> None:
        async def _inner() -> None:
            session = await self.get_session(sid)
            user_id = session.get("user_id")
            session["away_message"] = None
            await self.save_session(sid, session)
            await self._store.set_online(user_id, session)
            await self.emit(
                "user_away_updated",
                {"user_id": user_id, "away_message": None},
            )

        await self._handle(sid, _inner, timeout=3.0)
