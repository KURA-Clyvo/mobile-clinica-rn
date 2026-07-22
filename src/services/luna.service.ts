import { lunaClient, apiClient } from './api/client';
import type {
  WhatsAppEnvioRequest,
  WhatsAppEnvioResponse,
  LunaHealthResponse,
  TriagensRelatorioQuery,
  TriagensRelatorioResponse,
} from '../types/api';

export type LunaStatus = 'enviado' | 'indisponivel' | 'erro';

export interface EnvioResult {
  status: LunaStatus;
  sid?: string;
  motivo?: string;
}

/**
 * Envia mensagem WhatsApp via Luna.
 * Retorna estado degradado ('indisponivel') se a Luna estiver offline ou timeout —
 * nunca lança exceção para não derrubar a UI.
 * Autenticação: header X-API-Key injetado pelo lunaClient (EXPO_PUBLIC_LUNA_API_KEY).
 */
export async function enviarWhatsApp(req: WhatsAppEnvioRequest): Promise<EnvioResult> {
  try {
    await lunaClient.post<WhatsAppEnvioResponse>('/whatsapp/enviar', req);
    return { status: 'enviado' };
  } catch {
    return { status: 'indisponivel' };
  }
}

/**
 * Verifica saúde da Luna.
 * Retorna estado degradado se a Luna estiver offline — nunca lança.
 */
export async function getLunaHealth(): Promise<LunaHealthResponse | { status: 'indisponivel' }> {
  try {
    const { data } = await lunaClient.get<LunaHealthResponse>('/health');
    return data;
  } catch {
    return { status: 'indisponivel' };
  }
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
