import { lunaClient, apiClient } from './api/client';
import type {
  WhatsAppEnvioRequest,
  WhatsAppEnvioResponse,
  LunaReadyResponse,
  TriagensRelatorioQuery,
  TriagensRelatorioResponse,
  TriagensRelatorioApiResponse,
  TriagensListaQuery,
  TriagensListaResponse,
  TriagensListaApiResponse,
  TriagemListaItemApi,
  TriagemListaItem,
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
  } catch (err) {
    // LU-09 (precisão do brief): distingue falha REAL de envio (502 — Twilio, ver
    // whatsapp.py:23-25) de rede/Luna fora do ar (status 0, normalizeError em
    // errors.ts) — só porque o `status` HTTP real está disponível aqui depois do
    // interceptor normalizar o erro. Nunca inventa um motivo para status
    // desconhecido (ex.: Error cru de teste, sem `.status`) — cai no genérico.
    const apiErr = err as { status?: number };
    const motivo =
      apiErr?.status === 502
        ? 'A Luna não conseguiu enviar a mensagem agora (falha no envio pelo WhatsApp).'
        : undefined;
    return { status: 'indisponivel', motivo };
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

/**
 * LU-09: traduz um item de fio de GET /api/v1/luna/triagens para o tipo interno.
 * Única tradução real é `dtTriagem`: string ISO com `Z` -> `Date`. `new Date(...)`
 * interpreta um sufixo `Z` sempre como UTC (comportamento padrão do motor JS,
 * independente do fuso local do dispositivo) — é isso que faz o instante bater com o
 * `DT_TRIAGEM` do Oracle (confirmado contra Oracle real na Re-G2 do LU-08, frente
 * 3(c): mesmo instante até o microssegundo, controle SYS_EXTRACT_UTC). Uma string SEM
 * `Z` (ou sem offset) seria lida como HORA LOCAL pelo motor JS — é esse o bug que a
 * mordida deste item prova (ver tests/luna.service.test.ts).
 */
function toTriagemListaItem(raw: TriagemListaItemApi): TriagemListaItem {
  return {
    idTriagem: raw.idTriagem,
    dtTriagem: new Date(raw.dtTriagem),
    urgencia: raw.urgencia,
    sintomas: raw.sintomas,
    score: raw.score,
    regrasVersao: raw.regrasVersao,
    encaminhadoVet: raw.encaminhadoVet,
    tutor: raw.tutor,
    pets: raw.pets,
    trechoMensagem: raw.trechoMensagem,
  };
}

function toTriagensListaResponse(raw: TriagensListaApiResponse): TriagensListaResponse {
  return {
    items: raw.items.map(toTriagemListaItem),
    total: raw.total,
    page: raw.page,
    pageSize: raw.pageSize,
  };
}

/**
 * LU-09: fila de triagens da Luna, GET /api/v1/luna/triagens ([Authorize] JWT de
 * clínica, LunaController.cs:104). Paginado, filtro opcional por urgência e período
 * (máx. 90 dias, mesmo limite do relatório) — urgência fora do enum ALTA/MEDIA/BAIXA
 * devolve lista vazia (declarado na G2 do LU-08), não erro.
 */
export async function getTriagens(query: TriagensListaQuery): Promise<TriagensListaResponse> {
  const { data } = await apiClient.get<TriagensListaApiResponse>('/api/v1/luna/triagens', {
    params: query,
  });
  return toTriagensListaResponse(data);
}
