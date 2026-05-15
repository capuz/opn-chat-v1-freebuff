from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routers import admin, auth, private_chat, profile, rooms
from src.core.config import settings


def create_app() -> FastAPI:
    app = FastAPI(title="opn-chat v2", version="2.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    )

    app.include_router(auth.router)
    app.include_router(rooms.router)
    app.include_router(private_chat.router)
    app.include_router(profile.router)
    app.include_router(admin.router)

    @app.get("/health", tags=["health"])
    async def health():
        from datetime import UTC, datetime
        return {"status": "ok", "timestamp": datetime.now(UTC).isoformat()}

    return app


app = create_app()
