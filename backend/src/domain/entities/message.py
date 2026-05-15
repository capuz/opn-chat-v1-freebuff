from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID

from src.domain.value_objects.message_type import MessageType


@dataclass
class Message:
    id: UUID
    room_id: UUID
    user_id: UUID
    content: str
    type: MessageType = MessageType.NORMAL
    reply_to_id: UUID | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    is_edited: bool = False
    is_deleted: bool = False
