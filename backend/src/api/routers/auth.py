from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from src.application.use_cases.auth.google_auth_use_case import GoogleAuthUseCase, InvalidGoogleTokenError
from src.application.use_cases.auth.login_use_case import InvalidCredentialsError, LoginUseCase, TokenPair
from src.application.use_cases.auth.refresh_token_use_case import InvalidRefreshTokenError, RefreshTokenUseCase
from src.application.use_cases.auth.register_use_case import (
    EmailAlreadyExistsError,
    NicknameAlreadyExistsError,
    RegisterUseCase,
)
from src.infrastructure.db.session import get_async_session
from src.infrastructure.repositories.ban_repository import BanRepository
from src.infrastructure.repositories.refresh_token_repository import RefreshTokenRepository
from src.infrastructure.repositories.user_repository import UserRepository

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterBody(BaseModel):
    email: EmailStr
    nickname: str
    password: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class GoogleBody(BaseModel):
    google_token: str


class RefreshBody(BaseModel):
    refresh_token: str


class LogoutBody(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterBody):
    async with get_async_session() as db:
        try:
            user = await RegisterUseCase(UserRepository(db)).execute(
                email=body.email, nickname=body.nickname, password=body.password
            )
        except EmailAlreadyExistsError:
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
        except NicknameAlreadyExistsError:
            raise HTTPException(status.HTTP_409_CONFLICT, "Nickname taken")
        result = await LoginUseCase(UserRepository(db), RefreshTokenRepository(db), BanRepository(db)).execute(
            email=body.email, password=body.password
        )
    return TokenResponse(access_token=result.access_token, refresh_token=result.refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginBody):
    async with get_async_session() as db:
        use_case = LoginUseCase(UserRepository(db), RefreshTokenRepository(db), BanRepository(db))
        try:
            result = await use_case.execute(email=body.email, password=body.password)
        except InvalidCredentialsError:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return TokenResponse(access_token=result.access_token, refresh_token=result.refresh_token)


@router.post("/google", response_model=TokenResponse)
async def google_login(body: GoogleBody):
    async with get_async_session() as db:
        use_case = GoogleAuthUseCase(UserRepository(db), RefreshTokenRepository(db), BanRepository(db))
        try:
            result = await use_case.execute(body.google_token)
        except InvalidGoogleTokenError:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token")
    return TokenResponse(access_token=result.access_token, refresh_token=result.refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshBody):
    async with get_async_session() as db:
        use_case = RefreshTokenUseCase(UserRepository(db), RefreshTokenRepository(db), BanRepository(db))
        try:
            result = await use_case.execute(body.refresh_token)
        except InvalidRefreshTokenError:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    return TokenResponse(access_token=result.access_token, refresh_token=result.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: LogoutBody):
    async with get_async_session() as db:
        repo = RefreshTokenRepository(db)
        rt = await repo.get_valid(body.refresh_token)
        if rt:
            await repo.revoke_all_for_user(rt.user_id)
