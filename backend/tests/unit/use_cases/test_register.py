from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from src.application.use_cases.auth.register_use_case import (
    RegisterUseCase,
    EmailAlreadyExistsError,
    NicknameAlreadyExistsError,
)
from src.domain.entities.user import User


def _make_user_repo(email_exists=False, nick_exists=False):
    repo = AsyncMock()
    repo.get_by_email = AsyncMock(
        return_value=User(id=uuid4(), email="x@x.com", nickname="x") if email_exists else None
    )
    repo.get_by_nickname = AsyncMock(
        return_value=User(id=uuid4(), email="y@y.com", nickname="taken") if nick_exists else None
    )
    repo.save = AsyncMock(side_effect=lambda u: u)
    return repo


@pytest.mark.asyncio
async def test_register_creates_user():
    repo = _make_user_repo()
    use_case = RegisterUseCase(repo)
    user = await use_case.execute(email="a@b.com", nickname="Alice", password="secure123")

    assert user.email == "a@b.com"
    assert user.nickname == "Alice"
    assert user.password_hash is not None
    assert user.password_hash != "secure123"
    repo.save.assert_awaited_once()


@pytest.mark.asyncio
async def test_register_duplicate_email_raises():
    repo = _make_user_repo(email_exists=True)
    use_case = RegisterUseCase(repo)

    with pytest.raises(EmailAlreadyExistsError):
        await use_case.execute(email="x@x.com", nickname="Alice", password="pass")


@pytest.mark.asyncio
async def test_register_duplicate_nickname_raises():
    repo = _make_user_repo(nick_exists=True)
    use_case = RegisterUseCase(repo)

    with pytest.raises(NicknameAlreadyExistsError):
        await use_case.execute(email="new@b.com", nickname="taken", password="pass")
