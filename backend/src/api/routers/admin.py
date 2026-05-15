import json
import time
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import delete, func, or_, select, update

from src.api.dependencies import get_current_admin, get_event_publisher
from src.application.interfaces.event_publisher import IRealtimeEventPublisher
from src.infrastructure.db.models.ban_model import BanModel
from src.infrastructure.db.models.message_model import MessageModel
from src.infrastructure.db.models.room_member_model import RoomMemberModel
from src.infrastructure.db.models.room_model import RoomModel
from src.infrastructure.db.models.user_model import UserModel
from src.infrastructure.db.session import get_async_session
from src.infrastructure.redis.client import get_redis_pool
from src.infrastructure.redis.presence_store import RedisPresenceStore
from src.infrastructure.repositories.refresh_token_repository import RefreshTokenRepository
from src.infrastructure.repositories.room_repository import RoomRepository

router = APIRouter(prefix="/api/admin", tags=["admin"])

_START_TIME = time.time()
_SETTINGS_KEY = "admin:settings"


# ── Request bodies ─────────────────────────────────────────────────────────────

class BanBody(BaseModel):
    reason: str
    expiresAt: str | None = None

class AnnouncementBody(BaseModel):
    message: str

class ToggleAdminBody(BaseModel):
    is_admin: bool

class SettingDto(BaseModel):
    key: str
    value: str | None = None


# ── Stats ──────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(payload: Annotated[dict, Depends(get_current_admin)]):
    store = RedisPresenceStore(get_redis_pool())
    online_raw = await store.get_online_users()
    online_count = len(online_raw)

    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)

    async with get_async_session() as db:
        total_users = (await db.scalar(
            select(func.count(UserModel.id))
        )) or 0
        active_rooms = (await db.scalar(
            select(func.count()).select_from(
                select(RoomMemberModel.room_id).distinct()
                .join(RoomModel, RoomModel.id == RoomMemberModel.room_id)
                .where(RoomModel.is_archived.is_(False))
                .subquery()
            )
        )) or 0
        messages_today = (await db.scalar(
            select(func.count(MessageModel.id))
            .where(MessageModel.timestamp >= today_start, MessageModel.is_deleted.is_(False))
        )) or 0
        banned_users = (await db.scalar(
            select(func.count()).select_from(
                select(BanModel.user_id).distinct()
                .where(BanModel.is_active.is_(True))
                .subquery()
            )
        )) or 0

    uptime_secs = int(time.time() - _START_TIME)
    h, rem = divmod(uptime_secs, 3600)
    m, s   = divmod(rem, 60)
    uptime = f"{h}h {m}m {s}s"

    return {
        "totalUsers": total_users,
        "onlineNow": online_count,
        "activeRooms": active_rooms,
        "messagesToday": messages_today,
        "bannedUsers": banned_users,
        "pendingReports": 0,
        "serverUptime": uptime,
        "signalRConnections": online_count,
    }


# ── Live feed ──────────────────────────────────────────────────────────────────

@router.get("/live")
async def get_live_data(payload: Annotated[dict, Depends(get_current_admin)]):
    store = RedisPresenceStore(get_redis_pool())
    online_raw = await store.get_online_users()

    online_users = [
        {
            "id": u.get("user_id", ""),
            "nickname": u.get("nickname", ""),
            "countryCode": u.get("country_code"),
            "showFlag": u.get("show_flag", False),
            "awayMessage": u.get("away_message"),
            "badge": u.get("badge"),
        }
        for u in online_raw
    ]

    async with get_async_session() as db:
        rooms_stmt = (
            select(RoomModel.id, RoomModel.name, RoomMemberModel.user_id)
            .join(RoomMemberModel, RoomMemberModel.room_id == RoomModel.id)
            .where(RoomModel.is_archived.is_(False))
        )
        rows = (await db.execute(rooms_stmt)).all()
        room_map: dict[str, dict] = {}
        for room_id, name, _ in rows:
            key = str(room_id)
            if key not in room_map:
                room_map[key] = {"id": key, "name": name, "memberCount": 0}
            room_map[key]["memberCount"] += 1

        msg_stmt = (
            select(
                MessageModel.id,
                MessageModel.content,
                MessageModel.is_deleted,
                MessageModel.timestamp,
                UserModel.nickname,
                RoomModel.name.label("room_name"),
            )
            .join(UserModel, UserModel.id == MessageModel.user_id, isouter=True)
            .join(RoomModel, RoomModel.id == MessageModel.room_id, isouter=True)
            .order_by(MessageModel.timestamp.desc())
            .limit(20)
        )
        msg_rows = (await db.execute(msg_stmt)).all()
        recent_messages = [
            {
                "id": str(r.id),
                "content": r.content,
                "isDeleted": r.is_deleted,
                "timestamp": r.timestamp.isoformat(),
                "userId": "",
                "userNickname": r.nickname or "unknown",
                "roomId": "",
                "roomName": r.room_name or "—",
                "reportCount": 0,
            }
            for r in msg_rows
        ]

    return {
        "onlineUsers": online_users,
        "activeRooms": list(room_map.values()),
        "recentMessages": recent_messages,
    }


# ── Users ──────────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    payload: Annotated[dict, Depends(get_current_admin)],
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    search: str | None = None,
):
    store = RedisPresenceStore(get_redis_pool())
    online_raw = await store.get_online_users()
    online_ids = {u["user_id"] for u in online_raw}

    async with get_async_session() as db:
        filters = []
        if search:
            pattern = f"%{search}%"
            filters.append(or_(UserModel.nickname.ilike(pattern), UserModel.email.ilike(pattern)))

        total = (await db.scalar(
            select(func.count(UserModel.id)).where(*filters)
        )) or 0
        users = (await db.scalars(
            select(UserModel).where(*filters)
            .order_by(UserModel.created_at.desc())
            .offset((page - 1) * pageSize)
            .limit(pageSize)
        )).all()

        user_ids = [u.id for u in users]
        active_bans: dict[UUID, BanModel] = {}
        if user_ids:
            ban_rows = (await db.scalars(
                select(BanModel)
                .where(BanModel.user_id.in_(user_ids), BanModel.is_active.is_(True))
            )).all()
            for b in ban_rows:
                active_bans[b.user_id] = b

    items = [
        {
            "id": str(u.id),
            "nickname": u.nickname,
            "email": u.email,
            "countryCode": u.country_code,
            "globalBadge": u.global_badge,
            "createdAt": u.created_at.isoformat(),
            "lastSeen": u.last_seen.isoformat(),
            "status": u.status,
            "isAdmin": u.is_admin,
            "isDeactivated": u.is_deactivated,
            "isBanned": u.id in active_bans,
            "banExpiresAt": active_bans[u.id].expires_at.isoformat() if u.id in active_bans and active_bans[u.id].expires_at else None,
            "banReason": active_bans[u.id].reason if u.id in active_bans else None,
            "nicknameChangeCount": u.nickname_changes_today,
            "isOnline": str(u.id) in online_ids,
        }
        for u in users
    ]
    return {"items": items, "total": total, "page": page, "pageSize": pageSize}


@router.post("/users/{user_id}/ban", status_code=status.HTTP_204_NO_CONTENT)
async def ban_user(
    user_id: UUID,
    body: BanBody,
    payload: Annotated[dict, Depends(get_current_admin)],
):
    async with get_async_session() as db:
        ban = BanModel(
            id=uuid4(),
            user_id=user_id,
            banned_by_id=UUID(payload["sub"]),
            reason=body.reason,
            expires_at=datetime.fromisoformat(body.expiresAt) if body.expiresAt else None,
        )
        db.add(ban)


@router.post("/users/{user_id}/unban", status_code=status.HTTP_204_NO_CONTENT)
async def unban_user(
    user_id: UUID,
    payload: Annotated[dict, Depends(get_current_admin)],
):
    async with get_async_session() as db:
        await db.execute(
            update(BanModel).where(BanModel.user_id == user_id, BanModel.is_active.is_(True))
            .values(is_active=False)
        )


@router.post("/users/{user_id}/kick", status_code=status.HTTP_204_NO_CONTENT)
async def kick_user(
    user_id: UUID,
    payload: Annotated[dict, Depends(get_current_admin)],
    publisher: Annotated[IRealtimeEventPublisher, Depends(get_event_publisher)],
):
    async with get_async_session() as db:
        await RefreshTokenRepository(db).revoke_all_for_user(user_id)
    await publisher.emit_to_user(str(user_id), "kicked", {})


@router.post("/users/{user_id}/mute", status_code=status.HTTP_204_NO_CONTENT)
async def mute_user(
    user_id: UUID,
    payload: Annotated[dict, Depends(get_current_admin)],
):
    async with get_async_session() as db:
        await db.execute(
            update(RoomMemberModel).where(RoomMemberModel.user_id == user_id).values(is_muted=True)
        )


@router.post("/users/{user_id}/unmute", status_code=status.HTTP_204_NO_CONTENT)
async def unmute_user(
    user_id: UUID,
    payload: Annotated[dict, Depends(get_current_admin)],
):
    async with get_async_session() as db:
        await db.execute(
            update(RoomMemberModel).where(RoomMemberModel.user_id == user_id).values(is_muted=False)
        )


@router.post("/users/{user_id}/force-logout", status_code=status.HTTP_204_NO_CONTENT)
async def force_logout(
    user_id: UUID,
    payload: Annotated[dict, Depends(get_current_admin)],
    publisher: Annotated[IRealtimeEventPublisher, Depends(get_event_publisher)],
):
    async with get_async_session() as db:
        await RefreshTokenRepository(db).revoke_all_for_user(user_id)
    await publisher.emit_to_user(str(user_id), "kicked", {})


@router.post("/users/{user_id}/toggle-admin", status_code=status.HTTP_204_NO_CONTENT)
async def toggle_admin(
    user_id: UUID,
    body: ToggleAdminBody,
    payload: Annotated[dict, Depends(get_current_admin)],
):
    if str(user_id) == payload["sub"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot modify own admin status")
    async with get_async_session() as db:
        row = await db.get(UserModel, user_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        row.is_admin = body.is_admin


@router.post("/users/{user_id}/reset-nickname-changes", status_code=status.HTTP_204_NO_CONTENT)
async def reset_nickname_changes(
    user_id: UUID,
    payload: Annotated[dict, Depends(get_current_admin)],
):
    async with get_async_session() as db:
        await db.execute(
            update(UserModel).where(UserModel.id == user_id)
            .values(nickname_changes_today=0)
        )


@router.post("/users/{user_id}/deactivate", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: UUID,
    payload: Annotated[dict, Depends(get_current_admin)],
):
    async with get_async_session() as db:
        row = await db.get(UserModel, user_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        row.is_deactivated = not row.is_deactivated


# ── Rooms ──────────────────────────────────────────────────────────────────────

@router.get("/rooms")
async def list_rooms(payload: Annotated[dict, Depends(get_current_admin)]):
    async with get_async_session() as db:
        rooms = (await db.scalars(select(RoomModel).order_by(RoomModel.created_at.desc()))).all()
        room_ids = [r.id for r in rooms]

        member_counts: dict[UUID, int] = {}
        msg_counts: dict[UUID, int] = {}
        creator_nicks: dict[UUID, str] = {}

        if room_ids:
            mc_rows = (await db.execute(
                select(RoomMemberModel.room_id, func.count().label("cnt"))
                .where(RoomMemberModel.room_id.in_(room_ids))
                .group_by(RoomMemberModel.room_id)
            )).all()
            member_counts = {r.room_id: r.cnt for r in mc_rows}

            msg_rows = (await db.execute(
                select(MessageModel.room_id, func.count().label("cnt"))
                .where(MessageModel.room_id.in_(room_ids), MessageModel.is_deleted.is_(False))
                .group_by(MessageModel.room_id)
            )).all()
            msg_counts = {r.room_id: r.cnt for r in msg_rows}

            creator_ids = [r.created_by_id for r in rooms if r.created_by_id]
            if creator_ids:
                creator_rows = (await db.scalars(select(UserModel).where(UserModel.id.in_(creator_ids)))).all()
                creator_nicks = {u.id: u.nickname for u in creator_rows}

    return [
        {
            "id": str(r.id),
            "name": r.name,
            "description": r.description,
            "isPrivate": r.is_private,
            "isLocked": r.is_locked,
            "createdByNickname": creator_nicks.get(r.created_by_id) if r.created_by_id else None,
            "memberCount": member_counts.get(r.id, 0),
            "messageCount": msg_counts.get(r.id, 0),
            "createdAt": r.created_at.isoformat(),
        }
        for r in rooms
    ]


@router.post("/rooms/{room_id}/lock", status_code=status.HTTP_204_NO_CONTENT)
async def lock_room(room_id: UUID, payload: Annotated[dict, Depends(get_current_admin)]):
    async with get_async_session() as db:
        await db.execute(update(RoomModel).where(RoomModel.id == room_id).values(is_locked=True))


@router.post("/rooms/{room_id}/unlock", status_code=status.HTTP_204_NO_CONTENT)
async def unlock_room(room_id: UUID, payload: Annotated[dict, Depends(get_current_admin)]):
    async with get_async_session() as db:
        await db.execute(update(RoomModel).where(RoomModel.id == room_id).values(is_locked=False))


@router.delete("/rooms/{room_id}/messages", status_code=status.HTTP_204_NO_CONTENT)
async def clear_room_messages(room_id: UUID, payload: Annotated[dict, Depends(get_current_admin)]):
    async with get_async_session() as db:
        await db.execute(
            update(MessageModel).where(MessageModel.room_id == room_id).values(is_deleted=True)
        )


@router.delete("/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(room_id: UUID, payload: Annotated[dict, Depends(get_current_admin)]):
    async with get_async_session() as db:
        room = await RoomRepository(db).get_by_id(room_id)
        if not room:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        if room.is_system:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot delete system rooms")
        await RoomRepository(db).delete(room_id)


# ── Messages ───────────────────────────────────────────────────────────────────

@router.get("/messages")
async def search_messages(
    payload: Annotated[dict, Depends(get_current_admin)],
    query: str | None = None,
    userId: str | None = None,
    roomId: str | None = None,
    includeDeleted: bool = False,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    async with get_async_session() as db:
        msg_filters = []
        if not includeDeleted:
            msg_filters.append(MessageModel.is_deleted.is_(False))
        if query:
            msg_filters.append(MessageModel.content.ilike(f"%{query}%"))
        if userId:
            try:
                msg_filters.append(MessageModel.user_id == UUID(userId))
            except ValueError:
                pass
        if roomId:
            try:
                msg_filters.append(MessageModel.room_id == UUID(roomId))
            except ValueError:
                pass

        total = (await db.scalar(
            select(func.count(MessageModel.id)).where(*msg_filters)
        )) or 0

        stmt = (
            select(
                MessageModel.id,
                MessageModel.content,
                MessageModel.is_deleted,
                MessageModel.timestamp,
                MessageModel.user_id,
                UserModel.nickname,
                MessageModel.room_id,
                RoomModel.name.label("room_name"),
            )
            .join(UserModel, UserModel.id == MessageModel.user_id, isouter=True)
            .join(RoomModel, RoomModel.id == MessageModel.room_id, isouter=True)
            .where(*msg_filters)
            .order_by(MessageModel.timestamp.desc())
            .offset((page - 1) * pageSize)
            .limit(pageSize)
        )
        rows = (await db.execute(stmt)).all()

    items = [
        {
            "id": str(r.id),
            "content": r.content,
            "isDeleted": r.is_deleted,
            "timestamp": r.timestamp.isoformat(),
            "userId": str(r.user_id),
            "userNickname": r.nickname or "unknown",
            "roomId": str(r.room_id),
            "roomName": r.room_name or "—",
            "reportCount": 0,
        }
        for r in rows
    ]
    return {"items": items, "total": total, "page": page, "pageSize": pageSize}


@router.delete("/messages/user/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_user_messages(user_id: UUID, payload: Annotated[dict, Depends(get_current_admin)]):
    async with get_async_session() as db:
        await db.execute(
            update(MessageModel).where(MessageModel.user_id == user_id).values(is_deleted=True)
        )


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(message_id: UUID, payload: Annotated[dict, Depends(get_current_admin)]):
    async with get_async_session() as db:
        row = await db.get(MessageModel, message_id)
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        row.is_deleted = True


# ── Reports (stub — no DB table yet) ──────────────────────────────────────────

@router.get("/reports")
async def get_reports(
    payload: Annotated[dict, Depends(get_current_admin)],
    unresolvedOnly: bool = True,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    return {"items": [], "total": 0, "page": page, "pageSize": pageSize}


@router.post("/reports/{report_id}/resolve", status_code=status.HTTP_204_NO_CONTENT)
async def resolve_report(report_id: UUID, payload: Annotated[dict, Depends(get_current_admin)]):
    pass


# ── Audit logs (stub — no DB table yet) ───────────────────────────────────────

@router.get("/auditlogs")
async def get_audit_logs(
    payload: Annotated[dict, Depends(get_current_admin)],
    page: int = Query(1, ge=1),
    pageSize: int = Query(30, ge=1, le=100),
):
    return {"items": [], "total": 0, "page": page, "pageSize": pageSize}


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics")
async def get_analytics(payload: Annotated[dict, Depends(get_current_admin)]):
    today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    labels, daily_messages, daily_users = [], [], []

    async with get_async_session() as db:
        for i in range(6, -1, -1):
            day_start = today - timedelta(days=i)
            day_end   = day_start + timedelta(days=1)
            labels.append(day_start.strftime("%d/%m"))

            msg_count = (await db.scalar(
                select(func.count()).select_from(MessageModel)
                .where(MessageModel.timestamp >= day_start, MessageModel.timestamp < day_end, MessageModel.is_deleted.is_(False))
            )) or 0
            daily_messages.append(msg_count)

            user_count = (await db.scalar(
                select(func.count(func.distinct(MessageModel.user_id))).select_from(MessageModel)
                .where(MessageModel.timestamp >= day_start, MessageModel.timestamp < day_end)
            )) or 0
            daily_users.append(user_count)

        top_rooms_rows = (await db.execute(
            select(RoomModel.name, func.count(MessageModel.id).label("cnt"))
            .join(MessageModel, MessageModel.room_id == RoomModel.id)
            .where(MessageModel.is_deleted.is_(False))
            .group_by(RoomModel.name)
            .order_by(func.count(MessageModel.id).desc())
            .limit(5)
        )).all()
        top_rooms = [{"name": r.name, "messageCount": r.cnt} for r in top_rooms_rows]

    return {
        "dailyMessages": daily_messages,
        "dailyActiveUsers": daily_users,
        "dailyLabels": labels,
        "topRooms": top_rooms,
    }


# ── Settings (Redis-backed) ────────────────────────────────────────────────────

_DEFAULT_SETTINGS = {
    "MaxNicknameChanges": "1",
    "AllowPrivateChats": "true",
    "AllowRoomCreation": "true",
    "SpamThreshold": "30",
    "GlobalAnnouncementBanner": "",
    "MaintenanceMode": "false",
}


@router.get("/settings")
async def get_settings(payload: Annotated[dict, Depends(get_current_admin)]):
    redis = get_redis_pool()
    raw = await redis.get(_SETTINGS_KEY)
    stored: dict = json.loads(raw) if raw else {}
    merged = {**_DEFAULT_SETTINGS, **stored}
    return [{"key": k, "value": v} for k, v in merged.items()]


@router.put("/settings", status_code=status.HTTP_204_NO_CONTENT)
async def update_settings(
    body: list[SettingDto],
    payload: Annotated[dict, Depends(get_current_admin)],
):
    redis = get_redis_pool()
    data = {s.key: (s.value or "") for s in body}
    await redis.set(_SETTINGS_KEY, json.dumps(data))


# ── Command permissions (stub — no DB table yet) ───────────────────────────────

@router.get("/command-permissions")
async def get_command_permissions(payload: Annotated[dict, Depends(get_current_admin)]):
    return []


@router.put("/command-permissions/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def update_command_permission(name: str, payload: Annotated[dict, Depends(get_current_admin)]):
    pass


@router.post("/command-permissions/reset", status_code=status.HTTP_204_NO_CONTENT)
async def reset_command_permissions(payload: Annotated[dict, Depends(get_current_admin)]):
    pass


# ── Announce ───────────────────────────────────────────────────────────────────

@router.post("/announce", status_code=status.HTTP_204_NO_CONTENT)
async def announce(
    body: AnnouncementBody,
    payload: Annotated[dict, Depends(get_current_admin)],
    publisher: Annotated[IRealtimeEventPublisher, Depends(get_event_publisher)],
):
    await publisher.emit_broadcast(
        "global_announcement",
        {
            "message": body.message,
            "admin_nickname": payload.get("nickname", "admin"),
            "timestamp": datetime.now(UTC).isoformat(),
        },
        namespace="/notifications",
    )
