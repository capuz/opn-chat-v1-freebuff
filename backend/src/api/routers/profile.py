from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from src.api.dependencies import get_current_user_payload, get_event_publisher
from src.application.interfaces.event_publisher import IRealtimeEventPublisher
from src.core.config import settings
from src.infrastructure.db.session import get_async_session
from src.infrastructure.repositories.user_repository import UserRepository

router = APIRouter(prefix="/api/profile", tags=["profile"])


class NicknameBody(BaseModel):
    nickname: str


class FlagBody(BaseModel):
    show_flag: bool
    country_code: str | None = None


class PreferencesBody(BaseModel):
    preferred_language: str | None = None
    timezone: str | None = None


class BadgeBody(BaseModel):
    user_id: UUID
    badge: str | None = None


@router.get("/me")
async def get_me(payload: Annotated[dict, Depends(get_current_user_payload)]):
    async with get_async_session() as db:
        user = await UserRepository(db).get_by_id(UUID(payload["sub"]))
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return {
        "id": str(user.id), "email": user.email, "nickname": user.nickname,
        "avatar_url": user.avatar_url, "bio": user.bio, "global_badge": user.global_badge,
        "is_admin": user.is_admin, "country_code": user.country_code,
        "show_flag": user.show_flag, "preferred_language": user.preferred_language,
    }


@router.put("/nickname")
async def change_nickname(
    body: NicknameBody,
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    new_nick = body.nickname.strip()
    if not (2 <= len(new_nick) <= 30):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nickname must be 2-30 chars")

    async with get_async_session() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(UUID(payload["sub"]))
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND)

        today = datetime.now(UTC).date()
        used_today = user.nickname_changes_today if user.nickname_changes_date == today else 0
        limit = 2 if (user.nick_ad_unlocked_until and user.nick_ad_unlocked_until > datetime.now(UTC)) else 1

        if used_today >= limit:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "DAILY_LIMIT")

        if await repo.get_by_nickname(new_nick) and new_nick != user.nickname:
            raise HTTPException(status.HTTP_409_CONFLICT, "Nickname taken")

        user.nickname = new_nick
        user.nickname_changes_today = used_today + 1
        user.nickname_changes_date = today
        await repo.update(user)

    return {"changesLeft": limit - (used_today + 1)}


@router.post("/nick-ad-unlock", status_code=status.HTTP_204_NO_CONTENT)
async def nick_ad_unlock(payload: Annotated[dict, Depends(get_current_user_payload)]):
    async with get_async_session() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(UUID(payload["sub"]))
        if user:
            from datetime import timedelta
            user.nick_ad_unlocked_until = datetime.now(UTC) + timedelta(hours=settings.NICK_AD_UNLOCK_HOURS)
            await repo.update(user)


@router.put("/flag", status_code=status.HTTP_204_NO_CONTENT)
async def update_flag(
    body: FlagBody,
    payload: Annotated[dict, Depends(get_current_user_payload)],
    publisher: Annotated[IRealtimeEventPublisher, Depends(get_event_publisher)],
):
    if body.show_flag and (not body.country_code or len(body.country_code.strip()) != 2):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Valid 2-letter country_code required")

    async with get_async_session() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(UUID(payload["sub"]))
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND)

        if body.show_flag:
            user.country_code = body.country_code.strip().upper()
            user.show_flag = True
        else:
            user.country_code = None
            user.show_flag = False

        await repo.update(user)

    await publisher.emit_broadcast(
        "user_flag_updated",
        {"id": payload["sub"], "show_flag": user.show_flag, "country_code": user.country_code},
        namespace="/presence",
    )


@router.put("/preferences", status_code=status.HTTP_204_NO_CONTENT)
async def update_preferences(
    body: PreferencesBody,
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    async with get_async_session() as db:
        repo = UserRepository(db)
        user = await repo.get_by_id(UUID(payload["sub"]))
        if not user:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        if body.preferred_language is not None:
            user.preferred_language = body.preferred_language
        if body.timezone is not None:
            user.timezone = body.timezone
        await repo.update(user)


@router.put("/admin/badge", status_code=status.HTTP_204_NO_CONTENT)
async def assign_badge(
    body: BadgeBody,
    payload: Annotated[dict, Depends(get_current_user_payload)],
):
    if not payload.get("is_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin required")
    if body.badge not in ("founder", "moderator", None):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid badge")

    async with get_async_session() as db:
        repo = UserRepository(db)
        target = await repo.get_by_id(body.user_id)
        if not target:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        target.global_badge = body.badge
        await repo.update(target)
