import { io, Socket } from 'socket.io-client';

const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || 'http://localhost:8001';

// Namespaces — mirrors of the three Socket.IO namespaces in the Python backend
export type Namespace = 'chat' | 'presence' | 'notifications';

const sockets = new Map<Namespace, Socket>();

const getToken = (): string => localStorage.getItem('accessToken') ?? '';

export const getSocket = (ns: Namespace): Socket => {
  const existing = sockets.get(ns);
  if (existing?.connected) return existing;

  // Disconnect stale socket before recreating
  existing?.disconnect();

  const socket = io(`${REALTIME_URL}/${ns}`, {
    auth: { token: getToken() },         // JWT via handshake (replaces accessTokenFactory)
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling'], // WebSocket first, polling as fallback
    withCredentials: false,
  });

  socket.on('connect', () => {
    console.log(`[socket.io] connected /${ns} sid=${socket.id}`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket.io] disconnected /${ns} reason=${reason}`);
  });

  socket.on('reconnect_attempt', (attempt) => {
    // Refresh token before each reconnect attempt so the new auth reaches the server
    socket.auth = { token: getToken() };
    console.log(`[socket.io] reconnect attempt ${attempt} /${ns}`);
  });

  socket.on('reconnect', () => {
    console.log(`[socket.io] reconnected /${ns}`);
  });

  socket.on('reconnect_failed', () => {
    console.error(`[socket.io] reconnect failed /${ns}`);
  });

  sockets.set(ns, socket);
  return socket;
};

export const disconnectSocket = (ns: Namespace): void => {
  const socket = sockets.get(ns);
  if (socket) {
    socket.disconnect();
    sockets.delete(ns);
    console.log(`[socket.io] manually disconnected /${ns}`);
  }
};

export const disconnectAll = (): void => {
  for (const ns of sockets.keys()) {
    disconnectSocket(ns);
  }
};

/** Update the JWT on all active sockets after a token rotation. */
export const refreshSocketAuth = (newToken: string): void => {
  for (const socket of sockets.values()) {
    socket.auth = { token: newToken };
  }
};
