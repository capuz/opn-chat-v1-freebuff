from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.db.base import Base


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    nickname: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    bio: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str | None] = mapped_column(String(100))
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    nickname_changes_today: Mapped[int] = mapped_column(default=0)
    nickname_changes_date: Mapped[date | None] = mapped_column(Date)
    nick_ad_unlocked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    country_code: Mapped[str | None] = mapped_column(String(2))
    show_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    global_badge: Mapped[str | None] = mapped_column(String(20))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deactivated: Mapped[bool] = mapped_column(Boolean, default=False)
    preferred_language: Mapped[str] = mapped_column(String(10), default="auto")
    timezone: Mapped[str | None] = mapped_column(String(50))
