import { apiClient } from './api/client';
import type { DashboardHojeResponse, AlertaResponse, RecentAppointmentResponse } from '../types/api';

export async function getHoje(): Promise<DashboardHojeResponse> {
  const response = await apiClient.get<DashboardHojeResponse>('/dashboard/hoje');
  return response.data;
}

export async function getAlertas(): Promise<AlertaResponse[]> {
  const response = await apiClient.get<AlertaResponse[]>('/dashboard/alertas');
  return response.data;
}

export async function getRecentes(): Promise<RecentAppointmentResponse[]> {
  const response = await apiClient.get<RecentAppointmentResponse[]>('/dashboard/recentes');
  return response.data;
}
