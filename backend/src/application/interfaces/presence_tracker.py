from abc import ABC, abstractmethod


class IPresenceTracker(ABC):
    @abstractmethod
    async def set_online(self, user_id: str, data: dict) -> None: ...

    @abstractmethod
    async def set_offline(self, user_id: str) -> None: ...

    @abstractmethod
    async def get_online_users(self, limit: int = 100) -> list[dict]: ...

    @abstractmethod
    async def is_online(self, user_id: str) -> bool: ...

    @abstractmethod
    async def update_heartbeat(self, user_id: str) -> None: ...
