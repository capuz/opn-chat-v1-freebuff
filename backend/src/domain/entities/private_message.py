from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID


@dataclass
class PrivateMessage:
    id: UUID
    sender_id: UUID
    receiver_id: UUID
    content: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    is_read: bool = False
    read_at: datetime | None = None
    is_deleted_by_sender: bool = False
    is_deleted_by_receiver: bool = False
    is_deleted_for_everyone: bool = False
    deleted_at: datetime | None = None
