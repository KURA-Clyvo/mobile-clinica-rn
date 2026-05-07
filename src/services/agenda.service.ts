import { apiClient } from './api/client';
import type { AgendaQuery, AgendamentoResponse } from '../types/api';

export async function getAgenda(query: AgendaQuery): Promise<AgendamentoResponse[]> {
  const response = await apiClient.get<AgendamentoResponse[]>('/agenda', { params: query });
  return response.data;
}
