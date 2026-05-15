import re
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from src.api.dependencies import get_current_user_payload
from src.application.use_cases.chat.join_room_use_case import (
    AlreadyMemberError,
    JoinRoomUseCase,
    RoomLockedError,
    RoomNotFoundError,
)
from src.domain.entities.room import Room
from src.domain.entities.room_member import RoomMember
from src.domain.value_objects.role import RoleId
from src.infrastructure.db.session import get_async_session
from src.infrastructure.repositories.message_repository import MessageRepository
from src.infrastructure.repositories.room_member_repository import RoomMemberRepository
from src.infrastructure.repositories.room_repository import RoomRepository
from src.infrastructure.repositories.user_repository import UserRepository

router = APIRouter(prefix="/api/rooms", tags=["rooms"])

_ROOM_NAME_RE = re.compile(r"^[a-z0-9\-_]{3,30}$")
_RESERVED = {"admin", "system", "support", "general", "random", "help"}


class CreateRoomBody(BaseModel):
    name: str
    description: str | None = None
    is_private: bool = False
    password: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not _ROOM_NAME_RE.match(v):
            raise ValueError("Room name must match ^[a-z0-9\\-_]{3,30}$ (no '#' prefix)")
        if v.lower() in _RESERVED:
            raise ValueError(f"{v} is reserved")
        return v


class JoinRoomBody(BaseModel):
    password: str | None = None


class RoomOut(BaseModel):
    id: UUID
    name: str
    description: str | None
    is_private: bool
    is_locked: bool
    member_count: int = 0


class MessageOut(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str | None = None
    content: str
    type: str
    timestamp: str
    reply_to_id: UUID | None = None


@router.get("/public", response_model=list[RoomOut])
async def list_public_rooms(
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    async with get_async_session() as db:
        rooms = await RoomRepository(db).list_public()
    return [RoomOut(id=r.id, name=r.name, description=r.description,
                    is_private=r.is_private, is_locked=r.is_locked) for r in rooms]


@router.get("/{room_id}", response_model=RoomOut)
async def get_room(
    room_id: UUID,
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    async with get_async_session() as db:
        room = await RoomRepository(db).get_by_id(room_id)
    if not room:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return RoomOut(id=room.id, name=room.name, description=room.description,
                   is_private=room.is_private, is_locked=room.is_locked)


@router.post("/", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
async def create_room(
    body: CreateRoomBody,
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    user_id = UUID(payload["sub"])
    async with get_async_session() as db:
        repo = RoomRepository(db)
        if await repo.get_by_name(body.name):
            raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": "NAME_TAKEN"})
        if await repo.count_created_last_24h(user_id) >= 1:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail={"code": "DAILY_LIMIT", "max": 1})

        room = Room(id=uuid4(), name=body.name, description=body.description,
                    is_private=body.is_private, created_by_id=user_id)
        if body.password:
            from src.application.use_cases.auth.password_service import PasswordService
            room.password_hash = PasswordService().hash(body.password)

        await repo.save(room)
        member = RoomMember(user_id=user_id, room_id=room.id, role_id=RoleId.OWNER)
        await RoomMemberRepository(db).save(member)

    return RoomOut(id=room.id, name=room.name, description=room.description,
                   is_private=room.is_private, is_locked=room.is_locked)


@router.post("/{room_id}/join", status_code=status.HTTP_204_NO_CONTENT)
async def join_room(
    room_id: UUID,
    body: JoinRoomBody,
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    async with get_async_session() as db:
        use_case = JoinRoomUseCase(RoomRepository(db), RoomMemberRepository(db))
        try:
            await use_case.execute(user_id=UUID(payload["sub"]), room_id=room_id)
        except RoomNotFoundError:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        except RoomLockedError:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Room is locked")
        except AlreadyMemberError:
            pass  # idempotent


@router.delete("/{room_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_room(
    room_id: UUID,
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    async with get_async_session() as db:
        await RoomMemberRepository(db).delete(UUID(payload["sub"]), room_id)


@router.get("/{room_id}/members")
async def get_members(
    room_id: UUID,
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    async with get_async_session() as db:
        members = await RoomMemberRepository(db).list_by_room(room_id)
    return [{"user_id": str(m.user_id), "role": str(m.role_id), "is_muted": m.is_muted}
            for m in members]


@router.get("/{room_id}/messages", response_model=list[MessageOut])
async def get_messages(
    room_id: UUID,
    skip: int = 0,
    take: int = 50,
    payload: Annotated[dict, Depends(get_current_user_payload)] = None,
):
    async with get_async_session() as db:
        messages = await MessageRepository(db).list_by_room(room_id, skip=skip, take=take)
        unique_ids = list({m.user_id for m in messages})
        users = await UserRepository(db).get_many_by_ids(unique_ids) if unique_ids else []
        nick_map: dict[UUID, str] = {u.id: u.nickname for u in users}
    return [MessageOut(id=m.id, user_id=m.user_id, user_name=nick_map.get(m.user_id),
                       content=m.content, type=str(m.type),
                       timestamp=m.timestamp.isoformat(), reply_to_id=m.reply_to_id)
            for m in messages]
