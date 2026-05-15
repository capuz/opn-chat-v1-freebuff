from jose import JWTError, jwt

from src.core.config import settings


async def validate_jwt_from_environ(
    environ: dict, auth: dict | None
) -> dict | None:
    """
    Validates JWT from Socket.IO handshake auth dict only.
    Query string fallback removed: tokens in query strings are logged by
    proxies and visible in browser history.
    """
    token: str | None = None

    if auth and isinstance(auth, dict):
        token = auth.get("token")

    if not token:
        return None

    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )
    except JWTError:
        return None
