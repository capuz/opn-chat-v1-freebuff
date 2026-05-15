from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID


@dataclass
class Ban:
    id: UUID
    user_id: UUID
    banned_by_id: UUID
    reason: str
    banned_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime | None = None
    is_active: bool = True

    def is_currently_active(self) -> bool:
        if not self.is_active:
            return False
        if self.expires_at is None:
            return True
        return self.expires_at > datetime.now(UTC)
