export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminStatsDto {
  totalUsers: number;
  onlineNow: number;
  activeRooms: number;
  messagesToday: number;
  bannedUsers: number;
  pendingReports: number;
  serverUptime: string;
  signalRConnections: number;
}

export interface OnlineUserLiveDto {
  id: string;
  nickname: string;
  countryCode?: string;
  showFlag: boolean;
  awayMessage?: string;
  badge?: string;
}

export interface ActiveRoomLiveDto {
  id: string;
  name: string;
  memberCount: number;
}

export interface AdminMessageDto {
  id: string;
  content: string;
  roomName: string;
  roomId: string;
  userNickname: string;
  userId: string;
  timestamp: string;
  isDeleted: boolean;
  reportCount: number;
}

export interface AdminLiveDataDto {
  onlineUsers: OnlineUserLiveDto[];
  activeRooms: ActiveRoomLiveDto[];
  recentMessages: AdminMessageDto[];
}

export interface AdminUserDto {
  id: string;
  nickname: string;
  email: string;
  countryCode?: string;
  globalBadge?: string;
  createdAt: string;
  lastSeen: string;
  status?: string;
  isAdmin: boolean;
  isDeactivated: boolean;
  isBanned: boolean;
  banExpiresAt?: string;
  banReason?: string;
  nicknameChangeCount: number;
  isOnline: boolean;
}

export interface AdminRoomDto {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  isLocked: boolean;
  createdByNickname?: string;
  memberCount: number;
  messageCount: number;
  createdAt: string;
}

export interface AdminAuditLogDto {
  id: string;
  adminId: string;
  adminNickname: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetDisplay?: string;
  details?: string;
  timestamp: string;
}

export interface AdminReportDto {
  id: string;
  reportedByNickname: string;
  messageContent?: string;
  messageId?: string;
  reportedUserNickname?: string;
  reportedUserId?: string;
  reason: string;
  details?: string;
  isResolved: boolean;
  createdAt: string;
}

export interface TopRoomDto {
  name: string;
  messageCount: number;
}

export interface AnalyticsDto {
  dailyMessages: number[];
  dailyActiveUsers: number[];
  dailyLabels: string[];
  topRooms: TopRoomDto[];
}

export interface SystemSettingDto {
  key: string;
  value?: string;
}

export interface AdminMessageSearchParams {
  query?: string;
  userId?: string;
  roomId?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
  page: number;
  pageSize: number;
}

export interface AuditLogParams {
  from?: string;
  to?: string;
  action?: string;
  adminId?: string;
  page: number;
  pageSize: number;
}

export type PermissionCategory = 'Messaging' | 'Moderation' | 'Room Management' | 'Identity' | 'Admin';

export interface CommandPermissionDto {
  commandName: string;
  description: string;
  syntax: string;
  category: PermissionCategory;
  examples: string[];
  memberAllowed: boolean;
  operatorAllowed: boolean;
  founderAllowed: boolean;
  adminAllowed: boolean;
  isDangerous: boolean;
  isSystem: boolean;
  isDeprecated: boolean;
}

export interface UpdateCommandPermissionDto {
  memberAllowed: boolean;
  operatorAllowed: boolean;
  founderAllowed: boolean;
  adminAllowed: boolean;
}
