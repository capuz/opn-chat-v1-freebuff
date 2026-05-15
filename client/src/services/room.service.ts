import type { Message } from '../types/auth';
import { apiService } from './api.service';

const api = apiService.getAxiosInstance();

export interface RoomDto {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  isSystem: boolean;
  isArchived: boolean;
  createdByName?: string;
  memberCount: number;
}

export interface CreateRoomDto {
  name: string;
  description?: string;
  isPrivate: boolean;
  password?: string;
}

export interface RoomMemberDto {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  roleName: string;
  joinedAt: string;
}

export type RoomCreationErrorCode =
  | 'INVALID_NAME'
  | 'NAME_TAKEN'
  | 'DAILY_LIMIT'
  | 'ACTIVE_LIMIT'
  | 'CREATION_DISABLED';

export class RoomCreationError extends Error {
  code: RoomCreationErrorCode;
  constructor(code: RoomCreationErrorCode) {
    super(code);
    this.code = code;
    this.name = 'RoomCreationError';
  }
}

export const roomService = {
  async getPublicRooms(): Promise<RoomDto[]> {
    const response = await api.get<RoomDto[]>('/api/rooms/public');
    return response.data;
  },

  async getRoom(roomId: string): Promise<RoomDto> {
    const response = await api.get<RoomDto>(`/api/rooms/${roomId}`);
    return response.data;
  },

  async createRoom(room: CreateRoomDto): Promise<RoomDto> {
    try {
      const response = await api.post<RoomDto>('/api/rooms', room);
      return response.data;
    } catch (err: any) {
      const code = (err?.response?.data?.detail?.code ?? err?.response?.data?.code) as RoomCreationErrorCode | undefined;
      if (code) throw new RoomCreationError(code);
      throw err;
    }
  },

  async joinRoom(roomId: string, password?: string): Promise<void> {
    await api.post(`/api/rooms/${roomId}/join`, password);
  },

  async leaveRoom(roomId: string): Promise<void> {
    await api.delete(`/api/rooms/${roomId}/leave`);
  },

  async getRoomMembers(roomId: string): Promise<RoomMemberDto[]> {
    const response = await api.get<RoomMemberDto[]>(`/api/rooms/${roomId}/members`);
    return response.data;
  },

  async getRoomMessages(roomId: string, skip = 0, take = 50): Promise<Message[]> {
    const response = await api.get<Message[]>(`/api/rooms/${roomId}/messages`, {
      params: { skip, take }
    });
    return response.data;
  }
};
