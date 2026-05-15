from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://opn_chat:password@localhost/opn_chat"
    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET: str = "change-this-secret-min-32-chars-long"
    JWT_ISSUER: str = "opn-chat"
    JWT_AUDIENCE: str = "opn-chat-client"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    GOOGLE_CLIENT_ID: str = ""

    CORS_ORIGINS: list[str] = [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:5176",
            "http://localhost:5177",
        ]

    NICK_AD_UNLOCK_HOURS: int = 12
    BOOST_DURATION_MINUTES: int = 20

    SOCKETIO_REDIS_CHANNEL: str = "socketio"

    API_PORT: int = 8000
    REALTIME_PORT: int = 8001


settings = Settings()
