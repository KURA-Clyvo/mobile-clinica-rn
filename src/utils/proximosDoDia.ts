import type { AgendamentoResponse } from '../types/api';
import { minutosEsperando } from '@utils/etapaRecepcao';

// BR-CLI-T06 -- "qual e o proximo?" a partir da MESMA agenda do dia que a Hoje usa
// (`useAgendaHoje`, queryKey ['agenda','hoje',data]). Funcao PURA, relogio injetavel (`agora`).
//
// A etapa vem PRONTA do servidor (`dsEtapaRecepcao`, A-3): aqui so se classifica por ela, nunca se
// recalcula a partir de status + timestamps (mesma regra de utils/etapaRecepcao.ts).
// `agora` e o relogio do DISPOSITIVO (mesma aproximacao ja aceita por `podeMarcarFalta`/
// `minutosEsperando`; o servidor usa IRelogioClinica). Aparelho fora do fuso de SP erra "agora".

/** Etapas em que o atendimento ainda vai acontecer ou esta acontecendo. */
export const ETAPAS_ATIVAS = ['AGENDADO', 'CONFIRMADO', 'CHEGOU', 'EM_ATENDIMENTO'] as const;
const ETAPAS_COM_ATRASO = ['AGENDADO', 'CONFIRMADO'];

export function etapaAtiva(etapa: string): boolean {
  return (ETAPAS_ATIVAS as readonly string[]).includes(etapa);
}

function tempo(a: AgendamentoResponse): number {
  return new Date(a.dtInicio).getTime();
}

/** Copia ordenada por horario crescente (estavel: empate mantem a ordem original). */
export function ordenarPorHorario(lista: readonly AgendamentoResponse[]): AgendamentoResponse[] {
  return lista
    .map((a, i) => ({ a, i }))
    .sort((x, y) => tempo(x.a) - tempo(y.a) || x.i - y.i)
    .map((x) => x.a);
}

/**
 * Minutos de atraso de quem ainda nao chegou (AGENDADO/CONFIRMADO com horario ja passado).
 * `null` quando nao ha atraso a mostrar (horario no futuro, menos de 1 min, ou ja chegou).
 */
export function minutosDeAtraso(a: AgendamentoResponse, agora: Date): number | null {
  if (!ETAPAS_COM_ATRASO.includes(a.dsEtapaRecepcao)) return null;
  const min = Math.floor((agora.getTime() - tempo(a)) / 60000);
  return min >= 1 ? min : null;
}

/** Minutos de espera de quem esta na etapa CHEGOU (a partir de `dtCheckin`), senao `null`. */
export function minutosDeEspera(a: AgendamentoResponse, agora: Date): number | null {
  return a.dsEtapaRecepcao === 'CHEGOU' && a.dtCheckin ? minutosEsperando(a.dtCheckin, agora) : null;
}

/**
 * Posicao da marca "agora" numa lista JA ORDENADA: o numero de itens com horario <= agora, ou seja,
 * a marca fica entre o ultimo item que ja passou e o primeiro que ainda vem. `0` = antes de tudo
 * (todos no futuro), `length` = depois de tudo (todos no passado); lista vazia => `null` (sem marca).
 */
export function indiceMarcaAgora(ordenada: readonly AgendamentoResponse[], agora: Date): number | null {
  if (ordenada.length === 0) return null;
  const t = agora.getTime();
  return ordenada.filter((a) => tempo(a) <= t).length;
}

export interface DiaOrganizado {
  /** Quem esta com o veterinario agora (faixa "Em atendimento"), por horario. */
  emAtendimento: AgendamentoResponse[];
  /** Destaque (regra B-17, ver `escolherProximo`); `null` quando ninguem espera e nada vem pela frente. */
  proximo: AgendamentoResponse | null;
  /** Demais ativos que ainda vao acontecer, por horario (atrasados incluidos). */
  seguintes: AgendamentoResponse[];
  /** Onde cai a marca "agora" dentro de `seguintes` (ver `indiceMarcaAgora`). */
  marcaAgora: number | null;
  /** Finalizados + cancelados + nao compareceu (so viram numero, nunca linha). */
  encerrados: number;
  total: number;
}

function instanteCheckin(a: AgendamentoResponse): number {
  return a.dtCheckin ? new Date(a.dtCheckin).getTime() : tempo(a);
}

/**
 * Regra B-17 do destaque, sobre quem NAO esta em atendimento (D1): (1) quem Chegou e espera -- o de
 * check-in mais antigo; (2) senao o primeiro horario futuro (>= agora) ainda nao atendido;
 * (3) AGENDADO/CONFIRMADO com horario passado e sem check-in NUNCA e destaque (fica na lista com
 * "N min de atraso"). Unica fonte da regra para o dashboard e para a Hoje.
 */
function escolherProximo(
  aguardando: readonly AgendamentoResponse[],
  agora: Date,
): AgendamentoResponse | null {
  const chegaram = aguardando.filter((a) => a.dsEtapaRecepcao === 'CHEGOU');
  if (chegaram.length > 0) {
    return chegaram.reduce((m, a) => (instanteCheckin(a) < instanteCheckin(m) ? a : m));
  }
  const t = agora.getTime();
  return aguardando.find((a) => tempo(a) >= t) ?? null;
}

export function organizarDia(lista: readonly AgendamentoResponse[], agora: Date): DiaOrganizado {
  const ordenada = ordenarPorHorario(lista);
  const ativos = ordenada.filter((a) => etapaAtiva(a.dsEtapaRecepcao));
  const emAtendimento = ativos.filter((a) => a.dsEtapaRecepcao === 'EM_ATENDIMENTO');
  const aguardando = ativos.filter((a) => a.dsEtapaRecepcao !== 'EM_ATENDIMENTO');
  const proximo = escolherProximo(aguardando, agora);
  const seguintes = aguardando.filter((a) => a !== proximo);
  return {
    emAtendimento,
    proximo,
    seguintes,
    marcaAgora: indiceMarcaAgora(seguintes, agora),
    encerrados: ordenada.length - ativos.length,
    total: ordenada.length,
  };
}
