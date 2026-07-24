import { apiClient } from './api/client';

// Espelha Kura.Application/DTOs/Teleconsulta/TeleconsultaResponseDto.cs (backend-clinica-dotnet).
export interface TeleconsultaResponse {
  idAgendamento: number;
  dsSalaUrl: string | null;
  dsProvedorVideo: string | null;
  dtInicioSessao: string | null;
  stFallbackManual: boolean;
}

export async function criarOuObterSala(idAgendamento: number): Promise<TeleconsultaResponse> {
  const response = await apiClient.post<TeleconsultaResponse>(
    `/api/v1/teleconsulta/${idAgendamento}/sala`,
  );
  return response.data;
}

export async function obterSala(idAgendamento: number): Promise<TeleconsultaResponse> {
  const response = await apiClient.get<TeleconsultaResponse>(
    `/api/v1/teleconsulta/${idAgendamento}/sala`,
  );
  return response.data;
}
