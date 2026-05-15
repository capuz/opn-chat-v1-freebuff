from uuid import uuid4

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from src.application.interfaces.repositories import IBanRepository, IUserRepository
from src.application.use_cases.auth.jwt_service import JwtService
from src.application.use_cases.auth.login_use_case import TokenPair
from src.core.config import settings
from src.domain.entities.user import User
from src.infrastructure.db.models.refresh_token_model import RefreshTokenModel
from src.infrastructure.repositories.refresh_token_repository import RefreshTokenRepository


class InvalidGoogleTokenError(Exception):
    pass


_jwt = JwtService()


class GoogleAuthUseCase:
    def __init__(
        self,
        user_repo: IUserRepository,
        rt_repo: RefreshTokenRepository,
        ban_repo: IBanRepository | None = None,
    ) -> None:
        self._users = user_repo
        self._tokens = rt_repo
        self._bans = ban_repo

    async def _unique_nickname(self, base: str) -> str:
        """Return `base` if available, otherwise `base_2`, `base_3`, … """
        import re
        candidate = re.sub(r"[^a-zA-Z0-9_\-]", "_", base)
        if not await self._users.get_by_nickname(candidate):
            return candidate
        for suffix in range(2, 9999):
            attempt = f"{candidate}_{suffix}"
            if not await self._users.get_by_nickname(attempt):
                return attempt
        return f"{candidate}_{uuid4().hex[:6]}"

    async def execute(self, google_token: str) -> TokenPair:
        try:
            info = id_token.verify_oauth2_token(
                google_token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
                clock_skew_in_seconds=120,
            )
        except Exception as exc:
            raise InvalidGoogleTokenError from exc

        google_id = info["sub"]
        email = info["email"]

        user = await self._users.get_by_google_id(google_id)
        if not user:
            user = await self._users.get_by_email(email)

        if user and user.is_deactivated:
            raise InvalidGoogleTokenError
        if user and self._bans and await self._bans.get_active_ban(user.id):
            raise InvalidGoogleTokenError

        if not user:
            # Use email prefix as initial nickname — Google's real name is external
            # identity and must NOT bleed into the app's nickname space.
            # The user can change it via PUT /api/profile/nickname after login.
            base = email.split("@")[0][:28].strip() or "user"
            nickname = await self._unique_nickname(base)
            user = User(
                id=uuid4(),
                email=email,
                nickname=nickname,
                google_id=google_id,
                avatar_url=info.get("picture"),
            )
            user = await self._users.save(user)
        elif not user.google_id:
            user.google_id = google_id
            user = await self._users.update(user)

        access = _jwt.create_access_token(user)
        refresh = _jwt.create_refresh_token()

        await self._tokens.save(RefreshTokenModel(
            id=uuid4(),
            user_id=user.id,
            token=refresh,
            expires_at=_jwt.refresh_token_expires_at(),
        ))

        return TokenPair(access_token=access, refresh_token=refresh)
