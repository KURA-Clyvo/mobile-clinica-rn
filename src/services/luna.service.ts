// TODO: EXPO_PUBLIC_LUNA_BASE_URL ainda não confirmado pelo time Python.
// Em modo mock (EXPO_PUBLIC_USE_MOCKS=true), lunaClient é bypassado normalmente.
// Em produção, definir a URL no .env antes do deploy.
// Esquema de auth da Luna (JWT compartilhado vs API key) também pendente.
import { lunaClient, apiClient } from './api/client';
import type {
  WhatsAppEnvioRequest,
  WhatsAppEnvioResponse,
  LunaHealthResponse,
  TriagensRelatorioQuery,
  TriagensRelatorioResponse,
} from '../types/api';

export async function enviarWhatsApp(req: WhatsAppEnvioRequest): Promise<WhatsAppEnvioResponse> {
  const { data } = await lunaClient.post<WhatsAppEnvioResponse>('/whatsapp/enviar', req);
  return data;
}

export async function getLunaHealth(): Promise<LunaHealthResponse> {
  const { data } = await lunaClient.get<LunaHealthResponse>('/health');
  return data;
}

export async function getRelatorioTriagens(
  query: TriagensRelatorioQuery,
): Promise<TriagensRelatorioResponse> {
  const { data } = await apiClient.get<TriagensRelatorioResponse>(
    '/api/v1/luna/triagens/relatorio',
    { params: query },
  );
  return data;
}
