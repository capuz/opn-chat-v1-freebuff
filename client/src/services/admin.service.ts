import { apiService } from './api.service';
import type {
  AdminStatsDto, AdminLiveDataDto, PagedResult, AdminUserDto, AdminRoomDto,
  AdminMessageDto, AdminReportDto, AdminAuditLogDto, AnalyticsDto, SystemSettingDto,
  AdminMessageSearchParams, AuditLogParams, CommandPermissionDto, UpdateCommandPermissionDto,
} from '../types/admin';

const api = apiService.getAxiosInstance();

export const adminService = {
  getStats: () => api.get<AdminStatsDto>('/api/admin/stats').then(r => r.data),
  getLiveData: () => api.get<AdminLiveDataDto>('/api/admin/live').then(r => r.data),

  getUsers: (page: number, pageSize: number, search?: string) =>
    api.get<PagedResult<AdminUserDto>>('/api/admin/users', { params: { page, pageSize, search } }).then(r => r.data),
  banUser: (id: string, dto: { reason: string; expiresAt?: string }) =>
    api.post(`/api/admin/users/${id}/ban`, dto),
  unbanUser: (id: string) => api.post(`/api/admin/users/${id}/unban`),
  kickUser: (id: string) => api.post(`/api/admin/users/${id}/kick`),
  muteUser: (id: string) => api.post(`/api/admin/users/${id}/mute`),
  unmuteUser: (id: string) => api.post(`/api/admin/users/${id}/unmute`),
  forceLogout: (id: string) => api.post(`/api/admin/users/${id}/force-logout`),
  toggleAdmin: (id: string, isAdmin: boolean) => api.post(`/api/admin/users/${id}/toggle-admin`, { isAdmin }),
  resetNicknameChanges: (id: string) => api.post(`/api/admin/users/${id}/reset-nickname-changes`),
  deactivateUser: (id: string) => api.post(`/api/admin/users/${id}/deactivate`),

  getRooms: () => api.get<AdminRoomDto[]>('/api/admin/rooms').then(r => r.data),
  lockRoom: (id: string) => api.post(`/api/admin/rooms/${id}/lock`),
  unlockRoom: (id: string) => api.post(`/api/admin/rooms/${id}/unlock`),
  deleteRoom: (id: string) => api.delete(`/api/admin/rooms/${id}`),
  clearRoomMessages: (id: string) => api.delete(`/api/admin/rooms/${id}/messages`),

  searchMessages: (params: AdminMessageSearchParams) =>
    api.get<PagedResult<AdminMessageDto>>('/api/admin/messages', { params }).then(r => r.data),
  deleteMessage: (id: string) => api.delete(`/api/admin/messages/${id}`),
  bulkDeleteUserMessages: (userId: string) => api.delete(`/api/admin/messages/user/${userId}`),

  getReports: (unresolvedOnly: boolean, page: number, pageSize: number) =>
    api.get<PagedResult<AdminReportDto>>('/api/admin/reports', { params: { unresolvedOnly, page, pageSize } }).then(r => r.data),
  resolveReport: (id: string) => api.post(`/api/admin/reports/${id}/resolve`),

  getAuditLogs: (params: AuditLogParams) =>
    api.get<PagedResult<AdminAuditLogDto>>('/api/admin/auditlogs', { params }).then(r => r.data),

  getAnalytics: () => api.get<AnalyticsDto>('/api/admin/analytics').then(r => r.data),

  getSettings: () => api.get<SystemSettingDto[]>('/api/admin/settings').then(r => r.data),
  updateSettings: (settings: SystemSettingDto[]) => api.put('/api/admin/settings', settings),

  sendAnnouncement: (message: string) => api.post('/api/admin/announce', { message }),

  getCommandPermissions: () =>
    api.get<CommandPermissionDto[]>('/api/admin/command-permissions').then(r => r.data),
  updateCommandPermission: (name: string, dto: UpdateCommandPermissionDto) =>
    api.put(`/api/admin/command-permissions/${name}`, dto),
  resetCommandPermissions: () =>
    api.post('/api/admin/command-permissions/reset'),
};
