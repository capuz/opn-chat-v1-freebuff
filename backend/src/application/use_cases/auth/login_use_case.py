from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from src.application.interfaces.repositories import IBanRepository, IUserRepository
from src.application.use_cases.auth.jwt_service import JwtService
from src.application.use_cases.auth.password_service import PasswordService
from src.core.config import settings
from src.infrastructure.db.models.refresh_token_model import RefreshTokenModel
from src.infrastructure.repositories.refresh_token_repository import RefreshTokenRepository


class InvalidCredentialsError(Exception):
    pass


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


_pwd = PasswordService()
_jwt = JwtService()


class LoginUseCase:
    def __init__(
        self,
        user_repo: IUserRepository,
        rt_repo: RefreshTokenRepository,
        ban_repo: IBanRepository | None = None,
    ) -> None:
        self._users = user_repo
        self._tokens = rt_repo
        self._bans = ban_repo

    async def execute(self, email: str, password: str) -> TokenPair:
        user = await self._users.get_by_email(email)
        if not user or not user.password_hash:
            raise InvalidCredentialsError
        if not _pwd.verify(password, user.password_hash):
            raise InvalidCredentialsError
        if user.is_deactivated:
            raise InvalidCredentialsError
        if self._bans and await self._bans.get_active_ban(user.id):
            raise InvalidCredentialsError

        access = _jwt.create_access_token(user)
        refresh = _jwt.create_refresh_token()

        await self._tokens.save(RefreshTokenModel(
            id=uuid4(),
            user_id=user.id,
            token=refresh,
            expires_at=_jwt.refresh_token_expires_at(),
        ))

        return TokenPair(access_token=access, refresh_token=refresh)
