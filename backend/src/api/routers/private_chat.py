from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from src.api.dependencies import get_current_user_payload, get_event_publisher
from src.application.interfaces.event_publisher import IRealtimeEventPublisher
from src.domain.entities.private_message import PrivateMessage
from src.infrastructure.db.session import get_async_session
from src.infrastructure.repositories.private_message_repository import PrivateMessageRepository

router = APIRouter(prefix="/api/privatechat", tags=["private-chat"])

_DELETE_WINDOW_SECONDS = 900  # 15 minutes


class SendBody(BaseModel):
    receiver_id: UUID
    content: str


class MessageOut(BaseModel):
    id: UUID
    sender_id: UUID
    receiver_id: UUID
    content: str
    timestamp: str
    is_read: bool


def _visible_content(msg: PrivateMessage, viewer_id: UUID) -> str:
    if msg.is_deleted_for_everyone:
        return ""
    if viewer_id == msg.sender_id and msg.is_deleted_by_sender:
        return ""
    if viewer_id == msg.receiver_id and msg.is_deleted_by_receiver:
        return ""
    return msg.content


class ConversationOut(BaseModel):
    userId: str
    nickname: str
    avatarUrl: str | None
    lastMessage: str
    lastMessageTime: str
    unreadCount: int


@router.get("/conversations", response_model=list[ConversationOut])
async def get_conversations(
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    user_id = UUID(payload["sub"])
    async with get_async_session() as db:
        rows = await PrivateMessageRepository(db).list_conversations(user_id)
    return rows


@router.post("/send", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(
    body: SendBody,
    payload: Annotated[dict, Depends(get_current_user_payload)],
    publisher: Annotated[IRealtimeEventPublisher, Depends(get_event_publisher)],
):
    sender_id = UUID(payload["sub"])
    msg = PrivateMessage(
        id=uuid4(),
        sender_id=sender_id,
        receiver_id=body.receiver_id,
        content=body.content,
    )
    async with get_async_session() as db:
        msg = await PrivateMessageRepository(db).save(msg)

    await publisher.emit_to_user(
        str(body.receiver_id),
        "new_direct_message",
        {"sender_id": str(sender_id), "sender_nick": payload.get("nickname", "")},
    )
    return MessageOut(id=msg.id, sender_id=msg.sender_id, receiver_id=msg.receiver_id,
                      content=msg.content, timestamp=msg.timestamp.isoformat(), is_read=msg.is_read)


@router.get("/conversation/{other_user_id}", response_model=list[MessageOut])
async def get_conversation(
    other_user_id: UUID,
    skip: int = 0,
    take: int = 50,
    payload: Annotated[dict, Depends(get_current_user_payload)] = None,
):
    viewer_id = UUID(payload["sub"])
    async with get_async_session() as db:
        messages = await PrivateMessageRepository(db).list_conversation(
            viewer_id, other_user_id, skip=skip, take=take
        )
    return [
        MessageOut(
            id=m.id, sender_id=m.sender_id, receiver_id=m.receiver_id,
            content=_visible_content(m, viewer_id),
            timestamp=m.timestamp.isoformat(), is_read=m.is_read,
        )
        for m in messages
    ]


@router.get("/unread-count")
async def unread_count(payload: Annotated[dict, Depends(get_current_user_payload)]):
    async with get_async_session() as db:
        count = await PrivateMessageRepository(db).count_unread(UUID(payload["sub"]))
    return {"count": count}


@router.post("/mark-read/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    message_id: UUID,
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    async with get_async_session() as db:
        repo = PrivateMessageRepository(db)
        msg = await repo.get_by_id(message_id)
        if msg and msg.receiver_id == UUID(payload["sub"]):
            msg.is_read = True
            msg.read_at = datetime.now(UTC)
            await repo.update(msg)


@router.post("/mark-conversation-read/{other_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def mark_conversation_read(
    other_user_id: UUID,
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    viewer_id = UUID(payload["sub"])
    async with get_async_session() as db:
        await PrivateMessageRepository(db).mark_conversation_read(
            receiver_id=viewer_id,
            sender_id=other_user_id,
            read_at=datetime.now(UTC),
        )


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: UUID,
    for_everyone: bool = False,
    payload: Annotated[dict, Depends(get_current_user_payload)] = None,
    publisher: Annotated[IRealtimeEventPublisher, Depends(get_event_publisher)] = None,
):
    user_id = UUID(payload["sub"])
    async with get_async_session() as db:
        repo = PrivateMessageRepository(db)
        msg = await repo.get_by_id(message_id)
        if not msg:
            raise HTTPException(status.HTTP_404_NOT_FOUND)

        if for_everyone:
            if msg.sender_id != user_id:
                raise HTTPException(status.HTTP_403_FORBIDDEN)
            window = (datetime.now(UTC) - msg.timestamp).total_seconds()
            if window > _DELETE_WINDOW_SECONDS:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "15-minute window expired")
            msg.is_deleted_for_everyone = True
            msg.deleted_at = datetime.now(UTC)
            await repo.update(msg)
            await publisher.emit_to_user(
                str(msg.receiver_id), "private_message_deleted", {"message_id": str(message_id)}
            )
        else:
            if msg.sender_id == user_id:
                msg.is_deleted_by_sender = True
            elif msg.receiver_id == user_id:
                msg.is_deleted_by_receiver = True
            else:
                raise HTTPException(status.HTTP_403_FORBIDDEN)
            await repo.update(msg)
