import { api } from './api.service';
import type { AuthUser } from '../types/auth';

export const authService = {
  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try {
        await api.post('/api/auth/logout', { refresh_token: refreshToken });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('opnchat-monetization');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  },

  getUser(): AuthUser | null {
    const userStr = localStorage.getItem('user');
    return userStr ? (JSON.parse(userStr) as AuthUser) : null;
  },
};
