import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { AuthResponseDto } from '../types/auth';
import { refreshSocketAuth } from './socketio.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5091';

class ApiService {
  private instance: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string | null, error?: unknown) => void> = [];

  constructor() {
    this.instance = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add JWT token
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle 401 and refresh token
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (!this.isRefreshing) {
            this.isRefreshing = true;

            try {
              const refreshToken = localStorage.getItem('refreshToken');
              if (!refreshToken) {
                this.logout();
                return Promise.reject(error);
              }

              // Backend expects snake_case body and returns snake_case response
              const resp = await axios.post(
                `${API_URL}/api/auth/refresh`,
                { refresh_token: refreshToken }
              );

              const { access_token, refresh_token: new_refresh_token } = resp.data;

              localStorage.setItem('accessToken', access_token);
              localStorage.setItem('refreshToken', new_refresh_token);

              refreshSocketAuth(access_token);
              this.onRefreshed(access_token);

              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              return this.instance(originalRequest);
            } catch (refreshError) {
              this.refreshSubscribers.forEach(cb => cb(null, refreshError));
              this.refreshSubscribers = [];
              this.logout();
              return Promise.reject(refreshError);
            } finally {
              this.isRefreshing = false;
            }
          }

          return new Promise((resolve, reject) => {
            this.refreshSubscribers.push((token: string | null, error?: unknown) => {
              if (token === null) {
                reject(error);
              } else {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(this.instance(originalRequest));
              }
            });
          });
        }

        return Promise.reject(error);
      }
    );
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token, undefined));
    this.refreshSubscribers = [];
  }

  public logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  public getAxiosInstance(): AxiosInstance {
    return this.instance;
  }

  public setTokens(authResponse: AuthResponseDto) {
    localStorage.setItem('accessToken', authResponse.accessToken);
    localStorage.setItem('refreshToken', authResponse.refreshToken);
    localStorage.setItem('user', JSON.stringify(authResponse.user));
  }
}

export const apiService = new ApiService();
export const api = apiService.getAxiosInstance();
