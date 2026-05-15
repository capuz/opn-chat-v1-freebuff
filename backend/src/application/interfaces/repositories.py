from abc import ABC, abstractmethod
from datetime import datetime
from uuid import UUID

from src.domain.entities.ban import Ban
from src.domain.entities.message import Message
from src.domain.entities.private_message import PrivateMessage
from src.domain.entities.room import Room
from src.domain.entities.room_member import RoomMember
from src.domain.entities.user import User
from src.domain.value_objects.role import RoleId


class IUserRepository(ABC):
    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> User | None: ...

    @abstractmethod
    async def get_by_email(self, email: str) -> User | None: ...

    @abstractmethod
    async def get_by_nickname(self, nickname: str) -> User | None: ...

    @abstractmethod
    async def get_by_google_id(self, google_id: str) -> User | None: ...

    @abstractmethod
    async def save(self, user: User) -> User: ...

    @abstractmethod
    async def update(self, user: User) -> User: ...


class IRoomRepository(ABC):
    @abstractmethod
    async def get_by_id(self, room_id: UUID) -> Room | None: ...

    @abstractmethod
    async def get_by_name(self, name: str) -> Room | None: ...

    @abstractmethod
    async def list_public(self) -> list[Room]: ...

    @abstractmethod
    async def count_active_by_user(self, user_id: UUID) -> int: ...

    @abstractmethod
    async def count_created_last_24h(self, user_id: UUID) -> int: ...

    @abstractmethod
    async def save(self, room: Room) -> Room: ...

    @abstractmethod
    async def update(self, room: Room) -> Room: ...

    @abstractmethod
    async def delete(self, room_id: UUID) -> None: ...


class IRoomMemberRepository(ABC):
    @abstractmethod
    async def get(self, user_id: UUID, room_id: UUID) -> RoomMember | None: ...

    @abstractmethod
    async def list_by_room(self, room_id: UUID) -> list[RoomMember]: ...

    @abstractmethod
    async def save(self, member: RoomMember) -> RoomMember: ...

    @abstractmethod
    async def update(self, member: RoomMember) -> RoomMember: ...

    @abstractmethod
    async def delete(self, user_id: UUID, room_id: UUID) -> None: ...


class IMessageRepository(ABC):
    @abstractmethod
    async def get_by_id(self, message_id: UUID) -> Message | None: ...

    @abstractmethod
    async def list_by_room(
        self, room_id: UUID, skip: int = 0, take: int = 50
    ) -> list[Message]: ...

    @abstractmethod
    async def save(self, message: Message) -> Message: ...

    @abstractmethod
    async def soft_delete(self, message_id: UUID) -> None: ...


class IPrivateMessageRepository(ABC):
    @abstractmethod
    async def get_by_id(self, message_id: UUID) -> PrivateMessage | None: ...

    @abstractmethod
    async def list_conversation(
        self, user_a: UUID, user_b: UUID, skip: int = 0, take: int = 50
    ) -> list[PrivateMessage]: ...

    @abstractmethod
    async def count_unread(self, receiver_id: UUID) -> int: ...

    @abstractmethod
    async def save(self, message: PrivateMessage) -> PrivateMessage: ...

    @abstractmethod
    async def update(self, message: PrivateMessage) -> PrivateMessage: ...


class IBanRepository(ABC):
    @abstractmethod
    async def get_active_ban(self, user_id: UUID) -> Ban | None: ...

    @abstractmethod
    async def list_active_by_user(self, user_id: UUID) -> list[Ban]: ...

    @abstractmethod
    async def save(self, ban: Ban) -> Ban: ...

    @abstractmethod
    async def deactivate_all(self, user_id: UUID) -> None: ...
