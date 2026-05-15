from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import or_, select, update

from src.application.interfaces.repositories import IBanRepository
from src.domain.entities.ban import Ban
from src.infrastructure.db.models.ban_model import BanModel


def _to_entity(row: BanModel) -> Ban:
    return Ban(
        id=row.id,
        user_id=row.user_id,
        banned_by_id=row.banned_by_id,
        reason=row.reason,
        banned_at=row.banned_at,
        expires_at=row.expires_at,
        is_active=row.is_active,
    )


class BanRepository(IBanRepository):
    def __init__(self, session) -> None:
        self._s = session

    async def get_active_ban(self, user_id: UUID) -> Ban | None:
        now = datetime.now(UTC)
        result = await self._s.execute(
            select(BanModel)
            .where(
                BanModel.user_id == user_id,
                BanModel.is_active == True,
                or_(BanModel.expires_at.is_(None), BanModel.expires_at > now),
            )
            .limit(1)
        )
        row = result.scalar_one_or_none()
        return _to_entity(row) if row else None

    async def list_active_by_user(self, user_id: UUID) -> list[Ban]:
        now = datetime.now(UTC)
        result = await self._s.execute(
            select(BanModel).where(
                BanModel.user_id == user_id,
                BanModel.is_active == True,
                or_(BanModel.expires_at.is_(None), BanModel.expires_at > now),
            )
        )
        return [_to_entity(r) for r in result.scalars().all()]

    async def save(self, ban: Ban) -> Ban:
        row = BanModel(
            id=ban.id,
            user_id=ban.user_id,
            banned_by_id=ban.banned_by_id,
            reason=ban.reason,
            expires_at=ban.expires_at,
            is_active=ban.is_active,
        )
        self._s.add(row)
        await self._s.flush()
        return ban

    async def deactivate_all(self, user_id: UUID) -> None:
        await self._s.execute(
            update(BanModel).where(BanModel.user_id == user_id).values(is_active=False)
        )
        await self._s.flush()
