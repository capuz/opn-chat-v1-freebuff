import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.routers import admin, auth, private_chat, profile, rooms
from src.api.routers import settings as settings_router
from src.core.config import settings

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="opn-chat v2", version="2.0.0")

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("Unhandled exception: %s\n%s", exc, traceback.format_exc())
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

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
    app.include_router(settings_router.router)

    @app.get("/health", tags=["health"])
    async def health():
        from datetime import UTC, datetime
        return {"status": "ok", "timestamp": datetime.now(UTC).isoformat()}

    return app


app = create_app()
