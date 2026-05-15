// Re-exported for backwards compatibility during the migration.
// New code should import from socketio.service directly.
export { getSocket as getSignalRConnection, disconnectSocket as stopConnection } from './socketio.service';
export type { Namespace } from './socketio.service';
