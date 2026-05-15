export interface PrivateMessage {
  id: string;
  sender_id?: string;
  receiver_id?: string;
  content: string;
  timestamp: string;
  is_read: boolean;
  is_deleted_for_everyone?: boolean;
}

export interface SendPrivateMessageDto {
  receiver_id: string;
  content: string;
}

export interface Conversation {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}
