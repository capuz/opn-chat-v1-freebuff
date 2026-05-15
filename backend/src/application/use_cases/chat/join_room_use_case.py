from datetime import UTC, datetime
from uuid import UUID

from src.application.interfaces.repositories import IRoomMemberRepository, IRoomRepository
from src.domain.entities.room_member import RoomMember
from src.domain.value_objects.role import RoleId


class RoomNotFoundError(Exception):
    pass


class RoomLockedError(Exception):
    pass


class AlreadyMemberError(Exception):
    pass


class JoinRoomUseCase:
    def __init__(
        self,
        room_repo: IRoomRepository,
        room_member_repo: IRoomMemberRepository,
    ) -> None:
        self._rooms = room_repo
        self._members = room_member_repo

    async def execute(
        self,
        user_id: UUID,
        room_id: UUID,
        password: str | None = None,
    ) -> RoomMember:
        room = await self._rooms.get_by_id(room_id)
        if room is None:
            raise RoomNotFoundError(str(room_id))
        if room.is_locked:
            raise RoomLockedError(room.name)

        existing = await self._members.get(user_id, room_id)
        if existing is not None:
            raise AlreadyMemberError("Already a member")

        member = RoomMember(
            user_id=user_id,
            room_id=room_id,
            role_id=RoleId.MEMBER,
            joined_at=datetime.now(UTC),
        )
        return await self._members.save(member)
