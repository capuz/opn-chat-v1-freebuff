from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID

from src.domain.value_objects.role import RoleId


@dataclass
class RoomMember:
    user_id: UUID
    room_id: UUID
    role_id: RoleId
    joined_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    is_muted: bool = False
