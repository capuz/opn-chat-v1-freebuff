from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.interfaces.repositories import IMessageRepository
from src.domain.entities.message import Message
from src.domain.value_objects.message_type import MessageType
from src.infrastructure.db.models.message_model import MessageModel


def _to_entity(m: MessageModel) -> Message:
    return Message(
        id=m.id,
        room_id=m.room_id,
        user_id=m.user_id,
        content=m.content,
        type=MessageType(m.type),
        reply_to_id=m.reply_to_id,
        timestamp=m.timestamp,
        is_edited=m.is_edited,
        is_deleted=m.is_deleted,
    )


class MessageRepository(IMessageRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(self, message_id: UUID) -> Message | None:
        row = await self._s.get(MessageModel, message_id)
        return _to_entity(row) if row and not row.is_deleted else None

    async def list_by_room(
        self, room_id: UUID, skip: int = 0, take: int = 50
    ) -> list[Message]:
        stmt = (
            select(MessageModel)
            .where(MessageModel.room_id == room_id, MessageModel.is_deleted.is_(False))
            .order_by(MessageModel.timestamp.desc())
            .offset(skip)
            .limit(take)
        )
        rows = (await self._s.scalars(stmt)).all()
        return [_to_entity(r) for r in reversed(rows)]

    async def save(self, message: Message) -> Message:
        model = MessageModel(
            id=message.id,
            room_id=message.room_id,
            user_id=message.user_id,
            content=message.content,
            type=str(message.type),
            reply_to_id=message.reply_to_id,
            timestamp=message.timestamp,
        )
        self._s.add(model)
        await self._s.flush()
        return message

    async def soft_delete(self, message_id: UUID) -> None:
        row = await self._s.get(MessageModel, message_id)
        if row:
            row.is_deleted = True
            await self._s.flush()
