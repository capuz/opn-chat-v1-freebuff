# opn-chat-v1-freebuff — CogniLayer Auto-Memory
# MAX 30 LINES — index only, details → memory_search

## Stack
- Frontend: React 19 + Vite 8 + TailwindCSS 4 + TypeScript 6 | deploy: Vercel
- Backend API: FastAPI + Python 3.12 + SQLAlchemy asyncio + asyncpg | deploy: Fly.io `opn-chat-api`
- Realtime: python-socketio (ASGI) + uvicorn | deploy: Fly.io `opn-chat-realtime`
- DB: Neon PostgreSQL (pooler, US West) | Cache/Presence: Redis (Fly.io)
- Auth: Google OAuth2 popup → ID token → backend JWT (access+refresh)

## Routes (client)
`/login` → `LoginPage` | `/chat` → `ChatPage` (protected) | `/dashboard` → `DashboardPage` (protected)
`/admin` → `AdminDashboardPage` (admin-only) | `/auth/google/callback` → `GoogleCallbackPage`

## Key API Endpoints
- `POST /api/auth/google` — Google ID token → JWT pair
- `POST /api/auth/login|register|refresh|logout`
- `GET /api/rooms/public` | `POST /api/rooms/` | `POST /api/rooms/{id}/join`
- `GET /api/rooms/{id}/messages?skip&take`
- `GET|PUT /api/admin/stats|users|rooms|messages|settings|analytics` (admin JWT required)
- `GET /health`

## Realtime (Socket.IO namespaces)
- `/chat` — join_room, leave_room, send_message, typing_indicator, kick/mute/boost
- `/presence` — online status tracking via Redis
- `/notifications` — global announcements

## DB Schema (tables)
users, rooms, room_members, messages, private_messages, bans, refresh_tokens
Seed: rooms general/random/help (system=true, fixed UUIDs)

## Deploy Commands
- Frontend: `npm run dev` (port 5173) | `npm run build`
- Backend local: docker-compose up (API port 5091, Realtime 8001)
- Migrations: `alembic upgrade head` (runs auto on Fly.io deploy via release_command)
- Fly: `fly secrets set KEY=val -a opn-chat-api|opn-chat-realtime`

## Gotchas → /recall gotchas
- `channel_binding=require` breaks asyncpg — use `?ssl=require` only
- FastAPI errors return `{"detail":"..."}` not `{"message":"..."}` — fixed in LoginPage.tsx:176
- `GOOGLE_CLIENT_ID` must be set as Fly.io secret (was empty → Google auth failed)
- AdminRoute is UI-only; real enforcement is server-side JWT claim
- Never `taskkill /IM node.exe` — kills Claude Code CLI too
