from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


class MessageReceivedEvent(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    content: str
    type: Literal["normal", "action", "system"] = "normal"
    timestamp: datetime
    reply_to_id: UUID | None = None
    badge: str | None = None

    def to_socket_dict(self) -> dict:
        return self.model_dump(mode="json", exclude_none=True)


class UserOnlineEvent(BaseModel):
    id: UUID
    nickname: str
    country_code: str | None = None
    show_flag: bool = False
    badge: str | None = None

    def to_socket_dict(self) -> dict:
        return self.model_dump(mode="json", exclude_none=True)


class UserOfflineEvent(BaseModel):
    user_id: UUID

    def to_socket_dict(self) -> dict:
        return self.model_dump(mode="json")


class DirectMessageNotificationEvent(BaseModel):
    sender_id: UUID
    sender_nick: str

    def to_socket_dict(self) -> dict:
        return self.model_dump(mode="json")


class RoomBoostedEvent(BaseModel):
    room_id: str
    expires_at: datetime

    def to_socket_dict(self) -> dict:
        return self.model_dump(mode="json")


class KickedFromRoomEvent(BaseModel):
    room_id: str
    by: str

    def to_socket_dict(self) -> dict:
        return self.model_dump(mode="json")


class GlobalAnnouncementEvent(BaseModel):
    message: str
    admin_nickname: str
    timestamp: datetime

    def to_socket_dict(self) -> dict:
        return self.model_dump(mode="json")


class UserAwayUpdatedEvent(BaseModel):
    user_id: UUID
    away_message: str | None = None

    def to_socket_dict(self) -> dict:
        return self.model_dump(mode="json", exclude_none=True)


class UserFlagUpdatedEvent(BaseModel):
    id: UUID
    show_flag: bool
    country_code: str | None = None

    def to_socket_dict(self) -> dict:
        return self.model_dump(mode="json", exclude_none=True)
