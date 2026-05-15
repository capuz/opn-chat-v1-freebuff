from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.infrastructure.db.models.refresh_token_model import RefreshTokenModel


class RefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_valid(self, token: str) -> RefreshTokenModel | None:
        from datetime import UTC, datetime
        stmt = select(RefreshTokenModel).where(
            RefreshTokenModel.token == token,
            RefreshTokenModel.is_used.is_(False),
            RefreshTokenModel.is_revoked.is_(False),
            RefreshTokenModel.expires_at > datetime.now(UTC),
        )
        return (await self._s.scalars(stmt)).first()

    async def save(self, model: RefreshTokenModel) -> None:
        self._s.add(model)
        await self._s.flush()

    async def mark_used(self, token_id: UUID) -> None:
        await self._s.execute(
            update(RefreshTokenModel)
            .where(RefreshTokenModel.id == token_id)
            .values(is_used=True)
        )

    async def revoke_all_for_user(self, user_id: UUID) -> None:
        await self._s.execute(
            update(RefreshTokenModel)
            .where(RefreshTokenModel.user_id == user_id)
            .values(is_revoked=True)
        )
