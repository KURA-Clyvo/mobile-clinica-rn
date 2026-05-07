import { apiClient } from './api/client';
import type { LoginRequest, LoginResponse, RegisterClinicaRequest, RegisterClinicaResponse } from '../types/api';

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', data);
  return response.data;
}

export async function logout(): Promise<void> {
  // Session cleanup is handled by useAuthStore.clearSession()
}

export async function registerClinica(data: RegisterClinicaRequest): Promise<RegisterClinicaResponse> {
  const response = await apiClient.post<RegisterClinicaResponse>('/auth/register', data);
  return response.data;
}
