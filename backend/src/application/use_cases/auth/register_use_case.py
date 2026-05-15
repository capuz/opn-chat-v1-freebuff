from uuid import uuid4

from src.application.interfaces.repositories import IUserRepository
from src.application.use_cases.auth.password_service import PasswordService
from src.domain.entities.user import User


class EmailAlreadyExistsError(Exception):
    pass


class NicknameAlreadyExistsError(Exception):
    pass


_pwd = PasswordService()


class RegisterUseCase:
    def __init__(self, user_repo: IUserRepository) -> None:
        self._users = user_repo

    async def execute(self, email: str, nickname: str, password: str) -> User:
        if await self._users.get_by_email(email):
            raise EmailAlreadyExistsError(email)
        if await self._users.get_by_nickname(nickname):
            raise NicknameAlreadyExistsError(nickname)

        user = User(
            id=uuid4(),
            email=email,
            nickname=nickname.strip(),
            password_hash=_pwd.hash(password),
        )
        return await self._users.save(user)
