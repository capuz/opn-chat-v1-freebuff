from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.application.interfaces.repositories import IUserRepository
from src.domain.entities.user import User
from src.infrastructure.db.models.user_model import UserModel


def _to_entity(m: UserModel) -> User:
    return User(
        id=m.id,
        email=m.email,
        nickname=m.nickname,
        google_id=m.google_id,
        password_hash=m.password_hash,
        avatar_url=m.avatar_url,
        bio=m.bio,
        status=m.status,
        last_seen=m.last_seen,
        created_at=m.created_at,
        updated_at=m.updated_at,
        nickname_changes_today=m.nickname_changes_today,
        nickname_changes_date=m.nickname_changes_date,
        nick_ad_unlocked_until=m.nick_ad_unlocked_until,
        country_code=m.country_code,
        show_flag=m.show_flag,
        global_badge=m.global_badge,
        is_admin=m.is_admin,
        is_deactivated=m.is_deactivated,
        preferred_language=m.preferred_language,
        timezone=m.timezone,
    )


class UserRepository(IUserRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        row = await self._s.get(UserModel, user_id)
        return _to_entity(row) if row else None

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(UserModel).where(UserModel.email == email)
        row = (await self._s.scalars(stmt)).first()
        return _to_entity(row) if row else None

    async def get_by_nickname(self, nickname: str) -> User | None:
        stmt = select(UserModel).where(UserModel.nickname == nickname)
        row = (await self._s.scalars(stmt)).first()
        return _to_entity(row) if row else None

    async def get_by_google_id(self, google_id: str) -> User | None:
        stmt = select(UserModel).where(UserModel.google_id == google_id)
        row = (await self._s.scalars(stmt)).first()
        return _to_entity(row) if row else None

    async def save(self, user: User) -> User:
        model = UserModel(
            id=user.id,
            email=user.email,
            nickname=user.nickname,
            google_id=user.google_id,
            password_hash=user.password_hash,
            avatar_url=user.avatar_url,
            bio=user.bio,
            status=user.status,
            last_seen=user.last_seen,
            created_at=user.created_at,
            updated_at=user.updated_at,
            nickname_changes_today=user.nickname_changes_today,
            nickname_changes_date=user.nickname_changes_date,
            nick_ad_unlocked_until=user.nick_ad_unlocked_until,
            country_code=user.country_code,
            show_flag=user.show_flag,
            global_badge=user.global_badge,
            is_admin=user.is_admin,
            is_deactivated=user.is_deactivated,
            preferred_language=user.preferred_language,
            timezone=user.timezone,
        )
        self._s.add(model)
        await self._s.flush()
        return user

    async def update(self, user: User) -> User:
        row = await self._s.get(UserModel, user.id)
        if row:
            for attr in (
                "nickname", "password_hash", "avatar_url", "bio", "status",
                "last_seen", "updated_at", "nickname_changes_today",
                "nickname_changes_date", "nick_ad_unlocked_until",
                "country_code", "show_flag", "global_badge", "is_admin",
                "is_deactivated", "preferred_language", "timezone",
            ):
                setattr(row, attr, getattr(user, attr))
            await self._s.flush()
        return user

    async def get_many_by_ids(self, user_ids: list[UUID]) -> list[User]:
        if not user_ids:
            return []
        stmt = select(UserModel).where(UserModel.id.in_(user_ids))
        rows = (await self._s.scalars(stmt)).all()
        return [_to_entity(r) for r in rows]
