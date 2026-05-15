import type { PrivateMessage, SendPrivateMessageDto, Conversation } from '../types/privateMessage';
import { apiService } from './api.service';

const api = apiService.getAxiosInstance();

export const privateChatService = {
  async sendMessage(receiverId: string, content: string): Promise<PrivateMessage> {
    const response = await api.post<PrivateMessage>('/api/privatechat/send', {
      receiver_id: receiverId,
      content,
    } as SendPrivateMessageDto);
    return response.data;
  },

  async getConversation(userId: string, skip = 0, take = 50): Promise<PrivateMessage[]> {
    const response = await api.get<PrivateMessage[]>(`/api/privatechat/conversation/${userId}`, {
      params: { skip, take }
    });
    return response.data;
  },

  async getRecentConversations(): Promise<Conversation[]> {
    const response = await api.get<Conversation[]>('/api/privatechat/conversations');
    return response.data;
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get<{ count: number }>('/api/privatechat/unread-count');
    return response.data.count;
  },

  async markAsRead(messageId: string): Promise<void> {
    await api.post(`/api/privatechat/mark-read/${messageId}`);
  },

  async deleteMessage(messageId: string, forEveryone: boolean): Promise<void> {
    await api.delete(`/api/privatechat/${messageId}`, { params: { forEveryone } });
  },

  async markConversationAsRead(partnerId: string): Promise<void> {
    await api.post(`/api/privatechat/mark-conversation-read/${partnerId}`);
  }
};
