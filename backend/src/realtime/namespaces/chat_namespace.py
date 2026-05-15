import logging

from src.realtime.auth import validate_jwt_from_environ
from src.realtime.namespaces.base_namespace import BaseNamespace

logger = logging.getLogger(__name__)


class ChatNamespace(BaseNamespace):
    async def on_connect(
        self, sid: str, environ: dict, auth: dict | None = None
    ) -> None:
        payload = await validate_jwt_from_environ(environ, auth)
        if not payload:
            raise ConnectionRefusedError("Unauthorized")

        await self.save_session(sid, {
            "user_id": payload["sub"],
            "nickname": payload.get("nickname", ""),
            "is_admin": payload.get("is_admin", False),
            "badge": payload.get("badge"),
        })
        await self.enter_room(sid, f"user-{payload['sub']}")

    async def on_disconnect(self, sid: str) -> None:
        user_id = await self._session_user_id(sid)
        if user_id:
            await self.leave_room(sid, f"user-{user_id}")

    async def on_join_room(self, sid: str, room_id: str) -> None:
        async def _inner() -> None:
            from uuid import UUID
            from src.application.use_cases.chat.join_room_use_case import AlreadyMemberError, JoinRoomUseCase
            from src.infrastructure.db.session import get_async_session
            from src.infrastructure.repositories.room_member_repository import RoomMemberRepository
            from src.infrastructure.repositories.room_repository import RoomRepository

            session = await self.get_session(sid)
            user_id = session["user_id"]

            async with get_async_session() as db:
                try:
                    await JoinRoomUseCase(
                        room_repo=RoomRepository(db),
                        room_member_repo=RoomMemberRepository(db),
                    ).execute(user_id=UUID(user_id), room_id=UUID(room_id))
                except AlreadyMemberError:
                    pass

            await self.enter_room(sid, room_id)
            await self.emit("user_joined", {"user_id": user_id}, room=room_id, skip_sid=sid)

        await self._handle(sid, _inner, timeout=5.0)

    async def on_leave_room(self, sid: str, room_id: str) -> None:
        async def _inner() -> None:
            session = await self.get_session(sid)
            user_id = session["user_id"]
            await self.leave_room(sid, room_id)
            await self.emit("user_left", {"user_id": user_id}, room=room_id)

        await self._handle(sid, _inner, timeout=5.0)

    async def on_send_message(self, sid: str, data: dict) -> None:
        async def _inner() -> None:
            from uuid import UUID

            from src.infrastructure.db.session import get_async_session
            from src.infrastructure.repositories.message_repository import MessageRepository
            from src.infrastructure.repositories.room_member_repository import RoomMemberRepository
            from src.application.use_cases.chat.send_message_use_case import SendMessageUseCase

            session = await self.get_session(sid)
            user_id  = session["user_id"]
            nickname = session["nickname"]
            badge    = session.get("badge")

            async with get_async_session() as db:
                use_case = SendMessageUseCase(
                    message_repo=MessageRepository(db),
                    room_member_repo=RoomMemberRepository(db),
                )
                result = await use_case.execute(
                    user_id=UUID(user_id),
                    room_id=UUID(data["room_id"]),
                    content=data["content"],
                    reply_to_id=UUID(data["reply_to_id"]) if data.get("reply_to_id") else None,
                    message_type=data.get("type", "normal"),
                )

            await self.emit(
                "receive_message",
                {
                    "id": str(result.id),
                    "user_id": user_id,
                    "user_name": nickname,
                    "content": result.content,
                    "type": str(result.type),
                    "timestamp": result.timestamp.isoformat(),
                    "reply_to_id": data.get("reply_to_id"),
                    "badge": badge,
                },
                room=data["room_id"],
            )

        await self._handle(sid, _inner, timeout=8.0)

    async def on_typing_indicator(self, sid: str, room_id: str) -> None:
        async def _inner() -> None:
            user_id = await self._session_user_id(sid)
            await self.emit("user_typing", {"user_id": user_id}, room=room_id, skip_sid=sid)

        await self._handle(sid, _inner, timeout=3.0)

    async def on_kick_user(self, sid: str, data: dict) -> None:
        async def _inner() -> None:
            from uuid import UUID

            from src.infrastructure.db.session import get_async_session
            from src.application.use_cases.admin.kick_user_use_case import KickUserUseCase
            from src.infrastructure.repositories.room_member_repository import RoomMemberRepository

            session = await self.get_session(sid)

            async with get_async_session() as db:
                use_case = KickUserUseCase(room_member_repo=RoomMemberRepository(db))
                await use_case.execute(
                    caller_id=UUID(session["user_id"]),
                    target_user_id=UUID(data["target_user_id"]),
                    room_id=UUID(data["room_id"]),
                    is_admin=session.get("is_admin", False),
                )

            target_sid_room = f"user-{data['target_user_id']}"
            await self.emit(
                "kicked_from_room",
                {"room_id": data["room_id"], "by": session["nickname"]},
                room=target_sid_room,
            )
            await self.emit(
                "user_kicked",
                {"user_id": data["target_user_id"], "by": session["nickname"]},
                room=data["room_id"],
            )

        await self._handle(sid, _inner, timeout=5.0)

    async def on_mute_user(self, sid: str, data: dict) -> None:
        async def _inner() -> None:
            from uuid import UUID

            from src.infrastructure.db.session import get_async_session
            from src.application.use_cases.admin.mute_user_use_case import MuteUserUseCase
            from src.infrastructure.repositories.room_member_repository import RoomMemberRepository

            session = await self.get_session(sid)
            mute: bool = data.get("mute", True)

            async with get_async_session() as db:
                use_case = MuteUserUseCase(room_member_repo=RoomMemberRepository(db))
                await use_case.execute(
                    caller_id=UUID(session["user_id"]),
                    target_user_id=UUID(data["target_user_id"]),
                    room_id=UUID(data["room_id"]),
                    mute=mute,
                    is_admin=session.get("is_admin", False),
                )

            event = "user_muted" if mute else "user_unmuted"
            await self.emit(
                event,
                {"user_id": data["target_user_id"], "by": session["nickname"]},
                room=data["room_id"],
            )

        await self._handle(sid, _inner, timeout=5.0)

    async def on_set_topic(self, sid: str, data: dict) -> None:
        async def _inner() -> None:
            session = await self.get_session(sid)
            await self.emit(
                "topic_changed",
                {"room_id": data["room_id"], "topic": data["topic"], "by": session["nickname"]},
                room=data["room_id"],
            )

        await self._handle(sid, _inner, timeout=5.0)

    async def on_boost_room(self, sid: str, room_id: str) -> None:
        async def _inner() -> None:
            from src.infrastructure.db.session import get_async_session
            from src.infrastructure.redis.client import get_redis_pool
            from src.application.use_cases.chat.boost_room_use_case import BoostRoomUseCase

            session = await self.get_session(sid)

            async with get_async_session() as db:
                use_case = BoostRoomUseCase(redis=get_redis_pool(), db=db)
                result = await use_case.execute(
                    user_id=session["user_id"],
                    room_id=room_id,
                    is_admin=session.get("is_admin", False),
                )

            await self.emit(
                "room_boosted",
                {"room_id": room_id, "expires_at": result.expires_at.isoformat()},
                room=room_id,
            )

        await self._handle(sid, _inner, timeout=5.0)
