import json

from fastapi import APIRouter

from src.infrastructure.redis.client import get_redis_pool

router = APIRouter(prefix="/api/settings", tags=["settings"])

_SETTINGS_KEY = "admin:settings"


@router.get("/announcement")
async def get_announcement():
    redis = get_redis_pool()
    raw = await redis.get(_SETTINGS_KEY)
    stored: dict = json.loads(raw) if raw else {}
    return {"message": stored.get("GlobalAnnouncementBanner", "")}
