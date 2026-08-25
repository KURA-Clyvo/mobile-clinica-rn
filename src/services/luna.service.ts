import { lunaClient, apiClient } from './api/client';
import type {
  WhatsAppEnvioRequest,
  WhatsAppEnvioResponse,
  LunaReadyResponse,
  TriagensRelatorioQuery,
  TriagensRelatorioResponse,
  TriagensRelatorioApiResponse,
} from '../types/api';

export type LunaStatus = 'enviado' | 'indisponivel' | 'erro';

export interface EnvioResult {
  status: LunaStatus;
  sid?: string;
  motivo?: string;
}

/**
 * Resultado de getLunaHealth().
 * - `{status:'indisponivel'}`: falha de rede/timeout genuína (Luna fora do ar), ou
 *   qualquer status HTTP que não seja 200/503 — o catch trata isso, nunca lança.
 * - `LunaReadyResponse & {httpStatus}`: GET /ready respondeu com corpo válido.
 *   `httpStatus` carrega 200 (tudo ok) ou 503 (algo degradado, CQ-09) para quem
 *   consome não precisar reimplementar essa leitura.
 */
export type LunaHealthResult =
  | (LunaReadyResponse & { httpStatus: 200 | 503 })
  | { status: 'indisponivel' };

/**
 * Envia mensagem WhatsApp via Luna.
 * Retorna estado degradado ('indisponivel') se a Luna estiver offline ou timeout —
 * nunca lança exceção para não derrubar a UI.
 * Autenticação: header X-API-Key injetado pelo lunaClient (EXPO_PUBLIC_LUNA_API_KEY).
 */
export async function enviarWhatsApp(req: WhatsAppEnvioRequest): Promise<EnvioResult> {
  try {
    const { data } = await lunaClient.post<WhatsAppEnvioResponse>('/whatsapp/enviar', req);
    return { status: 'enviado', sid: data.sid ?? undefined };
  } catch {
    return { status: 'indisponivel' };
  }
}

/**
 * Verifica prontidão da Luna via GET /ready.
 *
 * CQ-09 (ledger): GET /health só devolve {status:'ok'} — é liveness simples, não
 * informa oracle/kura_api nem reflete degradação parcial. GET /ready é quem carrega
 * esse detalhe, e é o que os cards de sub-serviço da tela precisam consumir.
 *
 * ARMADILHA (já documentada no ledger, confirmada aqui): /ready devolve HTTP 503
 * quando algo está degradado, com um corpo JSON ainda válido — isso NÃO é falha de
 * rede. `validateStatus` abaixo aceita 200 e 503 só nesta chamada (o comportamento
 * default do client em api/client.ts não muda) para que o 503 não caia no catch
 * genérico e vire um {status:'indisponivel'} mentiroso — antes dessa distinção, um
 * estado "degradado" real ficava indistinguível de "Luna fora do ar" (pior que o card
 * antigo: nem aparecia na tela nem no teste). Qualquer outro status (4xx/5xx≠503) ou
 * falha de rede/timeout genuína ainda cai no catch e devolve {status:'indisponivel'}
 * — contrato preservado para esse caso.
 */
export async function getLunaHealth(): Promise<LunaHealthResult> {
  try {
    const { data, status } = await lunaClient.get<LunaReadyResponse>('/ready', {
      validateStatus: (s) => s === 200 || s === 503,
    });
    return { ...data, httpStatus: status as 200 | 503 };
  } catch {
    return { status: 'indisponivel' };
  }
}

// CQ-09: o .NET emite ALTA/MEDIA/BAIXA (feminino, concordando com "urgência"); o tipo
// interno usa ALTO/MEDIO/BAIXO (masculino, herdado da versão pré-CQ-09 da tela). Só o
// tradutor abaixo conhece os dois vocabulários.
const URG_MAP: Record<string, keyof TriagensRelatorioResponse['distribuicaoUrgencia']> = {
  ALTA: 'ALTO',
  MEDIA: 'MEDIO',
  BAIXA: 'BAIXO',
};

/**
 * Traduz o shape de fio de GET /api/v1/luna/triagens/relatorio (.NET —
 * totalTriagens/porUrgencia/encaminhadasParaVet, urgência ALTA/MEDIA/BAIXA) para o
 * tipo interno TriagensRelatorioResponse consumido por luna.tsx. Chaves de
 * `porUrgencia` que a API real não deveria emitir (ex. um eventual 'CRITICA') são
 * ignoradas — não quebram o parse, só não contam para nenhum nível conhecido.
 */
function toTriagensRelatorioResponse(
  raw: TriagensRelatorioApiResponse,
): TriagensRelatorioResponse {
  const distribuicaoUrgencia = { BAIXO: 0, MEDIO: 0, ALTO: 0 };
  for (const [chave, valor] of Object.entries(raw.porUrgencia ?? {})) {
    const alvo = URG_MAP[chave];
    if (alvo) distribuicaoUrgencia[alvo] = valor;
  }
  return {
    nrTotalTriagens: raw.totalTriagens,
    distribuicaoUrgencia,
    nrEncaminhadasParaVet: raw.encaminhadasParaVet,
  };
}

export async function getRelatorioTriagens(
  query: TriagensRelatorioQuery,
): Promise<TriagensRelatorioResponse> {
  const { data } = await apiClient.get<TriagensRelatorioApiResponse>(
    '/api/v1/luna/triagens/relatorio',
    { params: query },
  );
  return toTriagensRelatorioResponse(data);
}
