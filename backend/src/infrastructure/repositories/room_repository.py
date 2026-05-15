from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.interfaces.repositories import IRoomRepository
from src.domain.entities.room import Room
from src.infrastructure.db.models.room_member_model import RoomMemberModel
from src.infrastructure.db.models.room_model import RoomModel


def _to_entity(m: RoomModel) -> Room:
    return Room(
        id=m.id,
        name=m.name,
        description=m.description,
        is_private=m.is_private,
        password_hash=m.password_hash,
        is_locked=m.is_locked,
        is_system=m.is_system,
        is_archived=m.is_archived,
        created_at=m.created_at,
        created_by_id=m.created_by_id,
        last_activity_at=m.last_activity_at,
    )


class RoomRepository(IRoomRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(self, room_id: UUID) -> Room | None:
        row = await self._s.get(RoomModel, room_id)
        return _to_entity(row) if row else None

    async def get_by_name(self, name: str) -> Room | None:
        stmt = select(RoomModel).where(RoomModel.name == name)
        row = (await self._s.scalars(stmt)).first()
        return _to_entity(row) if row else None

    async def list_public(self) -> list[Room]:
        stmt = select(RoomModel).where(
            RoomModel.is_private.is_(False),
            RoomModel.is_archived.is_(False),
        )
        rows = (await self._s.scalars(stmt)).all()
        return [_to_entity(r) for r in rows]

    async def count_active_by_user(self, user_id: UUID) -> int:
        stmt = (
            select(func.count())
            .select_from(RoomModel)
            .join(RoomMemberModel, RoomMemberModel.room_id == RoomModel.id)
            .where(
                RoomMemberModel.user_id == user_id,
                RoomModel.is_archived.is_(False),
            )
        )
        return (await self._s.scalar(stmt)) or 0

    async def count_created_last_24h(self, user_id: UUID) -> int:
        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        stmt = (
            select(func.count())
            .select_from(RoomModel)
            .where(
                RoomModel.created_by_id == user_id,
                RoomModel.created_at >= today_start,
            )
        )
        return (await self._s.scalar(stmt)) or 0

    async def save(self, room: Room) -> Room:
        model = RoomModel(
            id=room.id,
            name=room.name,
            description=room.description,
            is_private=room.is_private,
            password_hash=room.password_hash,
            is_locked=room.is_locked,
            is_system=room.is_system,
            is_archived=room.is_archived,
            created_at=room.created_at,
            created_by_id=room.created_by_id,
            last_activity_at=room.last_activity_at,
        )
        self._s.add(model)
        await self._s.flush()
        return room

    async def update(self, room: Room) -> Room:
        row = await self._s.get(RoomModel, room.id)
        if row:
            row.name = room.name
            row.description = room.description
            row.is_private = room.is_private
            row.is_locked = room.is_locked
            row.is_archived = room.is_archived
            row.last_activity_at = room.last_activity_at
            await self._s.flush()
        return room

    async def delete(self, room_id: UUID) -> None:
        row = await self._s.get(RoomModel, room_id)
        if row:
            await self._s.delete(row)
            await self._s.flush()
