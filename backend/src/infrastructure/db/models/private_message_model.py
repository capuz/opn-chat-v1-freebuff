from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.db.base import Base


class PrivateMessageModel(Base):
    __tablename__ = "private_messages"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    sender_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    receiver_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    content: Mapped[str] = mapped_column(String(2000), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_deleted_by_sender: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted_by_receiver: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted_for_everyone: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
