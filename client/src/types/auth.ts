export interface UserDto {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string;
  bio?: string;
  status?: string;
  lastSeen?: string;
  countryCode?: string;
  showFlag?: boolean;
  isAdmin?: boolean;
}

/** Minimal user shape stored in auth context (decoded from JWT at login). */
export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string;
  bio?: string;
  status?: string;
  lastSeen?: string;
  countryCode?: string;
  showFlag?: boolean;
  isAdmin?: boolean;
  badge?: string;
}

export type MessageType = 'normal' | 'action' | 'system';

export interface Message {
  id?: string;
  userId: string;
  userName?: string;
  senderNickname?: string;
  content: string;
  timestamp: string;
  replyToId?: string;
  type?: MessageType;
  badge?: string;
  createdAt?: string;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
  user: UserDto;
}

export interface GoogleAuthDto {
  google_token: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}
