from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.interfaces.repositories import IPrivateMessageRepository
from src.domain.entities.private_message import PrivateMessage
from src.infrastructure.db.models.private_message_model import PrivateMessageModel


def _to_entity(m: PrivateMessageModel) -> PrivateMessage:
    return PrivateMessage(
        id=m.id,
        sender_id=m.sender_id,
        receiver_id=m.receiver_id,
        content=m.content,
        timestamp=m.timestamp,
        is_read=m.is_read,
        read_at=m.read_at,
        is_deleted_by_sender=m.is_deleted_by_sender,
        is_deleted_by_receiver=m.is_deleted_by_receiver,
        is_deleted_for_everyone=m.is_deleted_for_everyone,
        deleted_at=m.deleted_at,
    )


class PrivateMessageRepository(IPrivateMessageRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(self, message_id: UUID) -> PrivateMessage | None:
        row = await self._s.get(PrivateMessageModel, message_id)
        return _to_entity(row) if row else None

    async def list_conversation(
        self, user_a: UUID, user_b: UUID, skip: int = 0, take: int = 50
    ) -> list[PrivateMessage]:
        stmt = (
            select(PrivateMessageModel)
            .where(
                or_(
                    and_(
                        PrivateMessageModel.sender_id == user_a,
                        PrivateMessageModel.receiver_id == user_b,
                    ),
                    and_(
                        PrivateMessageModel.sender_id == user_b,
                        PrivateMessageModel.receiver_id == user_a,
                    ),
                )
            )
            .order_by(PrivateMessageModel.timestamp.desc())
            .offset(skip)
            .limit(take)
        )
        rows = (await self._s.scalars(stmt)).all()
        return [_to_entity(r) for r in reversed(rows)]

    async def count_unread(self, receiver_id: UUID) -> int:
        stmt = select(func.count()).where(
            PrivateMessageModel.receiver_id == receiver_id,
            PrivateMessageModel.is_read.is_(False),
            PrivateMessageModel.is_deleted_for_everyone.is_(False),
        )
        return (await self._s.scalar(stmt)) or 0

    async def save(self, message: PrivateMessage) -> PrivateMessage:
        model = PrivateMessageModel(
            id=message.id,
            sender_id=message.sender_id,
            receiver_id=message.receiver_id,
            content=message.content,
            timestamp=message.timestamp,
        )
        self._s.add(model)
        await self._s.flush()
        return message

    async def mark_conversation_read(
        self, receiver_id: UUID, sender_id: UUID, read_at: datetime
    ) -> None:
        stmt = (
            update(PrivateMessageModel)
            .where(
                PrivateMessageModel.receiver_id == receiver_id,
                PrivateMessageModel.sender_id == sender_id,
                PrivateMessageModel.is_read.is_(False),
                PrivateMessageModel.is_deleted_for_everyone.is_(False),
            )
            .values(is_read=True, read_at=read_at)
            .execution_options(synchronize_session="fetch")
        )
        await self._s.execute(stmt)

    async def list_conversations(self, user_id: UUID) -> list[dict]:
        from sqlalchemy import text
        sql = text("""
            WITH last_msgs AS (
                SELECT DISTINCT ON (partner_id)
                    CASE WHEN sender_id = :uid THEN receiver_id ELSE sender_id END AS partner_id,
                    content,
                    timestamp
                FROM private_messages
                WHERE (sender_id = :uid OR receiver_id = :uid)
                  AND is_deleted_for_everyone = false
                ORDER BY partner_id, timestamp DESC
            ),
            unread AS (
                SELECT sender_id AS partner_id, COUNT(*) AS cnt
                FROM private_messages
                WHERE receiver_id = :uid
                  AND is_read = false
                  AND is_deleted_for_everyone = false
                GROUP BY sender_id
            )
            SELECT
                lm.partner_id,
                u.nickname,
                u.avatar_url,
                lm.content,
                lm.timestamp,
                COALESCE(ur.cnt, 0) AS unread_count
            FROM last_msgs lm
            JOIN users u ON u.id = lm.partner_id
            LEFT JOIN unread ur ON ur.partner_id = lm.partner_id
            ORDER BY lm.timestamp DESC
        """)
        rows = (await self._s.execute(sql, {"uid": user_id})).fetchall()
        return [
            {
                "userId": str(r.partner_id),
                "nickname": r.nickname,
                "avatarUrl": r.avatar_url,
                "lastMessage": r.content,
                "lastMessageTime": r.timestamp.isoformat(),
                "unreadCount": int(r.unread_count),
            }
            for r in rows
        ]

    async def update(self, message: PrivateMessage) -> PrivateMessage:
        row = await self._s.get(PrivateMessageModel, message.id)
        if row:
            for attr in (
                "is_read", "read_at", "is_deleted_by_sender",
                "is_deleted_by_receiver", "is_deleted_for_everyone", "deleted_at",
            ):
                setattr(row, attr, getattr(message, attr))
            await self._s.flush()
        return message
