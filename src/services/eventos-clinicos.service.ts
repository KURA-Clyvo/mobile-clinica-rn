import { apiClient } from './api/client';
import type {
  ConsultaRequest,
  ConsultaResponse,
  PrescricaoRequest,
  MedicamentosQuery,
  MedicamentoResponse,
  PaginatedResponse,
} from '../types/api';

export async function criarConsulta(req: ConsultaRequest): Promise<ConsultaResponse> {
  const { data } = await apiClient.post<ConsultaResponse>(
    '/api/v1/eventos-clinicos/consultas',
    req,
  );
  return data;
}

export async function criarPrescricao(
  req: PrescricaoRequest,
): Promise<{ idEventoClinico: number; idPrescricao: number }> {
  const { data } = await apiClient.post<{ idEventoClinico: number; idPrescricao: number }>(
    '/api/v1/eventos-clinicos/prescricoes',
    req,
  );
  return data;
}

export async function getMedicamentos(
  query?: MedicamentosQuery,
): Promise<PaginatedResponse<MedicamentoResponse>> {
  const { data } = await apiClient.get<PaginatedResponse<MedicamentoResponse>>(
    '/api/v1/medicamentos',
    { params: query },
  );
  return data;
}
