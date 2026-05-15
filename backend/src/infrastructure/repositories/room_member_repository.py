from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.interfaces.repositories import IRoomMemberRepository
from src.domain.entities.room_member import RoomMember
from src.domain.value_objects.role import RoleId
from src.infrastructure.db.models.room_member_model import RoomMemberModel


def _to_entity(m: RoomMemberModel) -> RoomMember:
    return RoomMember(
        user_id=m.user_id,
        room_id=m.room_id,
        role_id=RoleId(m.role_id),
        joined_at=m.joined_at,
        is_muted=m.is_muted,
    )


class RoomMemberRepository(IRoomMemberRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get(self, user_id: UUID, room_id: UUID) -> RoomMember | None:
        row = await self._s.get(RoomMemberModel, (user_id, room_id))
        return _to_entity(row) if row else None

    async def list_by_room(self, room_id: UUID) -> list[RoomMember]:
        stmt = select(RoomMemberModel).where(RoomMemberModel.room_id == room_id)
        rows = (await self._s.scalars(stmt)).all()
        return [_to_entity(r) for r in rows]

    async def save(self, member: RoomMember) -> RoomMember:
        model = RoomMemberModel(
            user_id=member.user_id,
            room_id=member.room_id,
            role_id=str(member.role_id.value),
            joined_at=member.joined_at,
            is_muted=member.is_muted,
        )
        self._s.add(model)
        await self._s.flush()
        return member

    async def update(self, member: RoomMember) -> RoomMember:
        row = await self._s.get(RoomMemberModel, (member.user_id, member.room_id))
        if row:
            row.role_id = str(member.role_id.value)
            row.is_muted = member.is_muted
            await self._s.flush()
        return member

    async def delete(self, user_id: UUID, room_id: UUID) -> None:
        row = await self._s.get(RoomMemberModel, (user_id, room_id))
        if row:
            await self._s.delete(row)
            await self._s.flush()
