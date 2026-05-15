from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID


@dataclass
class Room:
    id: UUID
    name: str
    description: str | None = None
    is_private: bool = False
    password_hash: str | None = None
    is_locked: bool = False
    is_system: bool = False
    is_archived: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    created_by_id: UUID | None = None
    last_activity_at: datetime | None = None
