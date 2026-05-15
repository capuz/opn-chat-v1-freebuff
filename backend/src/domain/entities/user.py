from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from uuid import UUID


@dataclass
class User:
    id: UUID
    email: str
    nickname: str
    google_id: str | None = None
    password_hash: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    status: str | None = None
    last_seen: datetime = field(default_factory=lambda: datetime.now(UTC))
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime | None = None
    nickname_changes_today: int = 0
    nickname_changes_date: date | None = None
    nick_ad_unlocked_until: datetime | None = None
    country_code: str | None = None
    show_flag: bool = False
    global_badge: str | None = None
    is_admin: bool = False
    is_deactivated: bool = False
    preferred_language: str = "auto"
    timezone: str | None = None
