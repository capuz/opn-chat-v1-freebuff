from abc import ABC, abstractmethod


class IRealtimeEventPublisher(ABC):
    @abstractmethod
    async def emit_to_room(self, room_id: str, event: str, data: dict) -> None: ...

    @abstractmethod
    async def emit_to_user(self, user_id: str, event: str, data: dict) -> None: ...

    @abstractmethod
    async def emit_broadcast(
        self, event: str, data: dict, namespace: str = "/chat"
    ) -> None: ...
