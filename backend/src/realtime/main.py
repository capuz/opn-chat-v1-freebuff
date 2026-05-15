import uvicorn
import socketio

import src.infrastructure.db.models  # noqa: F401 — registers all SQLAlchemy models in Base.metadata
from src.realtime.server import create_sio_server
from src.realtime.namespaces.chat_namespace import ChatNamespace
from src.realtime.namespaces.presence_namespace import PresenceNamespace
from src.realtime.namespaces.notifications_namespace import NotificationsNamespace
from src.core.config import settings

sio = create_sio_server()

sio.register_namespace(ChatNamespace("/chat"))
sio.register_namespace(PresenceNamespace("/presence"))
sio.register_namespace(NotificationsNamespace("/notifications"))

app = socketio.ASGIApp(sio)

if __name__ == "__main__":
    uvicorn.run(
        "src.realtime.main:app",
        host="0.0.0.0",
        port=settings.REALTIME_PORT,
        workers=1,
        log_level="info",
    )
