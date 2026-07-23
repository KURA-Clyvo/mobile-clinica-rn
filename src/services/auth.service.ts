import { apiClient } from './api/client';
import type {
  LoginRequest,
  LoginResponse,
  RegisterClinicaRequest,
  RegisterClinicaResponse,
} from '../types/api';

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const { data: response } = await apiClient.post<LoginResponse>('/api/v1/auth/login', data);
  return response;
}

// Não há endpoint de logout na API real — sessão é apenas limpa localmente.
export async function logout(): Promise<void> {}

export async function registerClinica(
  data: RegisterClinicaRequest,
): Promise<RegisterClinicaResponse> {
  const { data: response } = await apiClient.post<RegisterClinicaResponse>(
    '/api/v1/auth/register-clinica',
    data,
  );
  return response;
}
