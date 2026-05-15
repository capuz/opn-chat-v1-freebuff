from uuid import uuid4

from src.application.interfaces.repositories import IBanRepository, IUserRepository
from src.application.use_cases.auth.jwt_service import JwtService
from src.application.use_cases.auth.login_use_case import TokenPair
from src.infrastructure.db.models.refresh_token_model import RefreshTokenModel
from src.infrastructure.repositories.refresh_token_repository import RefreshTokenRepository


class InvalidRefreshTokenError(Exception):
    pass


_jwt = JwtService()


class RefreshTokenUseCase:
    def __init__(
        self,
        user_repo: IUserRepository,
        rt_repo: RefreshTokenRepository,
        ban_repo: IBanRepository | None = None,
    ) -> None:
        self._users = user_repo
        self._tokens = rt_repo
        self._bans = ban_repo

    async def execute(self, refresh_token: str) -> TokenPair:
        row = await self._tokens.get_valid(refresh_token)
        if not row:
            raise InvalidRefreshTokenError

        await self._tokens.mark_used(row.id)

        user = await self._users.get_by_id(row.user_id)
        if not user:
            raise InvalidRefreshTokenError
        if user.is_deactivated:
            raise InvalidRefreshTokenError
        if self._bans and await self._bans.get_active_ban(user.id):
            raise InvalidRefreshTokenError

        access = _jwt.create_access_token(user)
        new_refresh = _jwt.create_refresh_token()

        await self._tokens.save(RefreshTokenModel(
            id=uuid4(),
            user_id=user.id,
            token=new_refresh,
            expires_at=_jwt.refresh_token_expires_at(),
        ))

        return TokenPair(access_token=access, refresh_token=new_refresh)
