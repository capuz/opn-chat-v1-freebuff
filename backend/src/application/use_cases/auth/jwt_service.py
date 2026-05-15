import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from jose import jwt

from src.core.config import settings
from src.domain.entities.user import User


class JwtService:
    def create_access_token(self, user: User) -> str:
        now = datetime.now(UTC)
        claims = {
            "sub": str(user.id),
            "nickname": user.nickname,
            "is_admin": user.is_admin,
            "badge": user.global_badge,
            "country_code": user.country_code,
            "show_flag": user.show_flag,
            "iat": now,
            "exp": now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
        }
        return jwt.encode(claims, settings.JWT_SECRET, algorithm="HS256")

    def create_refresh_token(self) -> str:
        return secrets.token_urlsafe(64)

    def decode_access_token(self, token: str) -> dict:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )

    def refresh_token_expires_at(self) -> datetime:
        return datetime.now(UTC) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
