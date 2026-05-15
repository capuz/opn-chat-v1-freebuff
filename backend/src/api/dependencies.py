from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.interfaces.event_publisher import IRealtimeEventPublisher
from src.application.use_cases.auth.jwt_service import JwtService
from src.core.config import settings
from src.infrastructure.db.session import get_async_session
from src.infrastructure.realtime.redis_event_publisher import RedisEventPublisher
from src.infrastructure.repositories.user_repository import UserRepository

_bearer = HTTPBearer()
_jwt = JwtService()


# Module-level singleton. Unlike @lru_cache, this can be replaced (e.g. in tests
# or after a Redis reconnect) by reassigning _event_publisher directly.
_event_publisher: IRealtimeEventPublisher | None = None


def get_event_publisher() -> IRealtimeEventPublisher:
    global _event_publisher
    if _event_publisher is None:
        _event_publisher = RedisEventPublisher(redis_url=settings.REDIS_URL)
    return _event_publisher


async def get_current_user_payload(
    creds: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    try:
        return _jwt.decode_access_token(creds.credentials)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_admin(
    payload: Annotated[dict, Depends(get_current_user_payload)],
) -> dict:
    if not payload.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return payload
