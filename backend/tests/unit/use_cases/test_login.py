from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from src.application.use_cases.auth.login_use_case import LoginUseCase, InvalidCredentialsError
from src.domain.entities.user import User


def _hashed(plain: str) -> str:
    from src.application.use_cases.auth.password_service import PasswordService
    return PasswordService().hash(plain)


def _make_user(password: str) -> User:
    return User(id=uuid4(), email="a@b.com", nickname="Alice", password_hash=_hashed(password))


@pytest.mark.asyncio
async def test_login_valid_credentials_returns_tokens():
    repo = AsyncMock()
    repo.get_by_email = AsyncMock(return_value=_make_user("secret"))
    rt_repo = AsyncMock()
    rt_repo.save = AsyncMock()

    with patch("src.application.use_cases.auth.login_use_case._jwt") as mock_jwt:
        mock_jwt.create_access_token.return_value = "access-tok"
        mock_jwt.create_refresh_token.return_value = "refresh-tok"
        mock_jwt.refresh_token_expires_at.return_value = None

        use_case = LoginUseCase(repo, rt_repo)
        result = await use_case.execute(email="a@b.com", password="secret")

    assert result.access_token == "access-tok"
    assert result.refresh_token == "refresh-tok"


@pytest.mark.asyncio
async def test_login_wrong_password_raises():
    repo = AsyncMock()
    repo.get_by_email = AsyncMock(return_value=_make_user("correct"))
    rt_repo = AsyncMock()

    use_case = LoginUseCase(repo, rt_repo)

    with pytest.raises(InvalidCredentialsError):
        await use_case.execute(email="a@b.com", password="wrong")


@pytest.mark.asyncio
async def test_login_unknown_email_raises():
    repo = AsyncMock()
    repo.get_by_email = AsyncMock(return_value=None)
    rt_repo = AsyncMock()

    use_case = LoginUseCase(repo, rt_repo)

    with pytest.raises(InvalidCredentialsError):
        await use_case.execute(email="nope@x.com", password="pass")
