from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.db.base import Base


class RoomMemberModel(Base):
    __tablename__ = "room_members"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    room_id: Mapped[UUID] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), primary_key=True)
    role_id: Mapped[str] = mapped_column(String(36), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False)
