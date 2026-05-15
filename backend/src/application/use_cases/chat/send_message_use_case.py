from datetime import UTC, datetime
from uuid import UUID, uuid4

from src.application.interfaces.repositories import IMessageRepository, IRoomMemberRepository
from src.domain.entities.message import Message
from src.domain.value_objects.message_type import MessageType

MAX_CONTENT_LENGTH = 2000


class MutedError(Exception):
    pass


class MessageTooLongError(Exception):
    pass


class SendMessageUseCase:
    def __init__(
        self,
        message_repo: IMessageRepository,
        room_member_repo: IRoomMemberRepository,
    ) -> None:
        self._messages = message_repo
        self._members = room_member_repo

    async def execute(
        self,
        user_id: UUID,
        room_id: UUID,
        content: str,
        reply_to_id: UUID | None = None,
        message_type: str = "normal",
    ) -> Message:
        if len(content) > MAX_CONTENT_LENGTH:
            raise MessageTooLongError(f"Max {MAX_CONTENT_LENGTH} chars")

        member = await self._members.get(user_id, room_id)
        if member is None:
            raise PermissionError("Not a member of this room")
        if member.is_muted:
            raise MutedError("You are muted in this room")

        message = Message(
            id=uuid4(),
            room_id=room_id,
            user_id=user_id,
            content=content,
            type=MessageType(message_type),
            reply_to_id=reply_to_id,
            timestamp=datetime.now(UTC),
        )
        return await self._messages.save(message)
