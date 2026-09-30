import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAgendaSemana,
  useAtualizarStatusAgendamento,
  useAgendaHoje,
  useCheckinAgendamento,
  useIniciarAtendimento,
} from '../src/hooks/useAgenda';
import * as agendaService from '../src/services/agenda.service';
import { getMondayOf, addDays, formatDateISO } from '../src/utils/date';

jest.mock('@services/agenda.service', () => ({
  getAgenda: jest.fn(),
  atualizarStatusAgendamento: jest.fn(),
  checkinAgendamento: jest.fn(),
  iniciarAtendimento: jest.fn(),
}));

const mockGetAgenda = agendaService.getAgenda as jest.Mock;
const mockAtualizarStatus = agendaService.atualizarStatusAgendamento as jest.Mock;
const mockCheckin = agendaService.checkinAgendamento as jest.Mock;
const mockIniciarAtendimento = agendaService.iniciarAtendimento as jest.Mock;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

// FM-04, fix wave pós-G2 — o `makeWrapper` acima esconde o QueryClient, e é
// exatamente por isso que `useAtualizarStatusAgendamento` ficou sem cobertura
// de execução real: os 3 arquivos que o importam mockam o hook INTEIRO. A
// revisão G2 provou o buraco trocando `onSettled` por `onSuccess` — a suíte
// inteira continuou 714/714. Este helper devolve o cliente junto, para os
// testes abaixo afirmarem sobre a invalidação de verdade.
function makeWrapperComCliente() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

const MOCK_APPOINTMENT = {
  id: 1,
  dtInicio: new Date().toISOString(),
  nrDuracaoMinutos: 30,
  sgStatus: 'AGENDADA' as const,
  pet: { id: 1, nmPet: 'Thor', nmEspecie: 'Cão', nmRaca: 'Labrador' },
  tutor: { id: 1, nmTutor: 'Carlos Mendes', dsTelefone: '11987654321' },
  veterinario: { id: 1, nmVeterinario: 'Dr. Felipe Ferrete', nrCRMV: 'SP-12345' },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAgendaSemana', () => {
  it('returns isLoading=true then resolves with data', async () => {
    mockGetAgenda.mockResolvedValue([MOCK_APPOINTMENT]);

    const { result } = renderHook(() => useAgendaSemana(new Date()), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.isError).toBe(false);
  });

  it('semanaStart is always a Monday', async () => {
    mockGetAgenda.mockResolvedValue([]);
    const today = new Date();

    const { result } = renderHook(() => useAgendaSemana(today), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.semanaStart.getDay()).toBe(1);
  });

  it('semanaEnd is 6 days after semanaStart', async () => {
    mockGetAgenda.mockResolvedValue([]);
    const today = new Date();

    const { result } = renderHook(() => useAgendaSemana(today), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const { semanaStart, semanaEnd } = result.current;
    const diff = Math.floor((semanaEnd.getTime() - semanaStart.getTime()) / (1000 * 60 * 60 * 24));
    expect(diff).toBe(6);
  });

  it('calls getAgenda with correct dataInicio and dataFim strings', async () => {
    mockGetAgenda.mockResolvedValue([]);
    const today = new Date();
    const monday = getMondayOf(today);
    const expectedStart = formatDateISO(monday);
    const expectedEnd = formatDateISO(addDays(monday, 6));

    const { result } = renderHook(() => useAgendaSemana(today), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetAgenda).toHaveBeenCalledWith({
      dataInicio: expectedStart,
      dataFim: expectedEnd,
    });
  });

  it('sets isError=true on API failure', async () => {
    mockGetAgenda.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAgendaSemana(new Date()), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('refetch triggers a new service call', async () => {
    mockGetAgenda.mockResolvedValue([]);

    const { result } = renderHook(() => useAgendaSemana(new Date()), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.refetch();
    expect(mockGetAgenda).toHaveBeenCalledTimes(2);
  });
});

// ─── FM-04, fix wave pós-G2: useAtualizarStatusAgendamento ─────────────────
//
// Achado Important da revisão G2, reproduzido pelo maestro antes de aceito:
// trocar `onSettled` por `onSuccess` em useAgenda.ts deixava a suíte inteira
// verde (714/714). Ou seja, o mecanismo que evita o LOOP de 409 estava escrito
// e comentado, mas nunca exercitado — "check que nunca executou não é
// cobertura, é intenção".
//
// 🔴 O teste que importa é o do CAMINHO DE ERRO. O de sucesso passa com
// `onSuccess` também, então sozinho ele não tem poder nenhum contra a mutação.
describe('useAtualizarStatusAgendamento', () => {
  const VARS = {
    idAgendamento: 7,
    dsStatus: 'NAO_COMPARECEU' as const,
    nrVersion: 3,
  };

  it('invalida a agenda no SUCESSO', async () => {
    mockAtualizarStatus.mockResolvedValue({ ...MOCK_APPOINTMENT, sgStatus: 'NAO_COMPARECEU' });
    const { qc, wrapper } = makeWrapperComCliente();
    const spy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useAtualizarStatusAgendamento(), { wrapper });
    result.current.mutate(VARS);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['agenda'] });
  });

  // 🔴 ESTE é o que mata a mutação `onSettled` -> `onSuccess`.
  it('invalida a agenda TAMBÉM no 409 — senão o próximo toque repete o nrVersion velho', async () => {
    mockAtualizarStatus.mockRejectedValue(
      Object.assign(new Error('Conflito de concorrência'), { status: 409 }),
    );
    const { qc, wrapper } = makeWrapperComCliente();
    const spy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useAtualizarStatusAgendamento(), { wrapper });
    result.current.mutate(VARS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['agenda'] });
  });

  // A invalidação é por PREFIXO (React Query), não pela chave exata da semana
  // corrente. Afirmado no comentário do hook; aqui é medido contra cache real,
  // com duas semanas distintas já cacheadas.
  it('invalida QUALQUER semana cacheada, não só a corrente', async () => {
    mockAtualizarStatus.mockResolvedValue(MOCK_APPOINTMENT);
    const { qc, wrapper } = makeWrapperComCliente();

    qc.setQueryData(['agenda', '2026-01-05'], [MOCK_APPOINTMENT]);
    qc.setQueryData(['agenda', '2026-01-12'], [MOCK_APPOINTMENT]);
    // Controle positivo: as duas nascem FRESCAS. Sem esta linha, um `true` no
    // final seria indistinguível de "já estavam stale desde sempre".
    expect(qc.getQueryState(['agenda', '2026-01-05'])?.isInvalidated).toBe(false);
    expect(qc.getQueryState(['agenda', '2026-01-12'])?.isInvalidated).toBe(false);

    const { result } = renderHook(() => useAtualizarStatusAgendamento(), { wrapper });
    result.current.mutate(VARS);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(qc.getQueryState(['agenda', '2026-01-05'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['agenda', '2026-01-12'])?.isInvalidated).toBe(true);
  });

  it('encaminha o corpo exato do PATCH ao service', async () => {
    mockAtualizarStatus.mockResolvedValue(MOCK_APPOINTMENT);
    const { wrapper } = makeWrapperComCliente();

    const { result } = renderHook(() => useAtualizarStatusAgendamento(), { wrapper });
    result.current.mutate({ ...VARS, dsObservacao: 'tutor avisou por telefone' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAtualizarStatus).toHaveBeenCalledWith(7, {
      dsStatus: 'NAO_COMPARECEU',
      nrVersion: 3,
      dsObservacao: 'tutor avisou por telefone',
    });
  });
});

// ─── REC-12: useAgendaHoje ──────────────────────────────────────────────────
//
// m-1 (g2-rec08.md): "um cliente que mande toISOString() (ou offset -03:00)
// depois das 21h BRT cai no dia seguinte". A regra do brief da REC-12 é
// explícita: dataInicio/dataFim da agenda "Hoje" TÊM que vir de
// `formatDateISO` (getters LOCAIS: getFullYear/getMonth/getDate), nunca de
// `toISOString()` (sempre UTC). O teste abaixo prova isso por MORDIDA REAL,
// não por leitura de código: escolhe um instante em que o dia civil LOCAL e o
// dia civil UTC DIVERGEM DE VERDADE nesta máquina (medido em runtime via
// `getTimezoneOffset()`, não hardcoded "BRT" — o `jest.config.js` seta
// `TZ=America/Sao_Paulo`, mas o `CLAUDE.md` deste projeto documenta que o
// Node NO WINDOWS ignora nomes IANA em `TZ`, então o offset real de quem
// rodar este teste pode não ser -03:00) e confirma que `getAgenda` recebe a
// data LOCAL, não a UTC divergente.
describe('useAgendaHoje (REC-12)', () => {
  const MOCK_HOJE = { ...MOCK_APPOINTMENT, dsEtapaRecepcao: 'AGENDADO' as const };

  it('chama getAgenda com dataInicio === dataFim === formatDateISO(new Date()) — nunca toISOString()', async () => {
    // Constrói um instante onde o dia LOCAL e o dia UTC divergem de verdade,
    // qualquer que seja o offset real desta execução (positivo, negativo, ou
    // — só neste caso raro — não há divergência possível, e o teste avisa em
    // vez de fingir ter provado algo).
    const offsetMin = new Date().getTimezoneOffset(); // UTC - local, em minutos
    if (offsetMin === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[useAgendaHoje] offset local é 0 (UTC) nesta execução — não há como forçar ' +
          'divergência dia local != dia UTC; o teste de horário-limite não pôde medir nada aqui.',
      );
      return;
    }
    const hoje = new Date();
    // offset > 0 (local ATRÁS de UTC, ex.: BRT): 23:30 local vira o dia SEGUINTE em UTC.
    // offset < 0 (local À FRENTE de UTC, ex.: JST): 00:30 local vira o dia ANTERIOR em UTC.
    const instanteLimite =
      offsetMin > 0
        ? new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 30, 0)
        : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 30, 0);

    // Controle positivo: confirma que a divergência é REAL antes de confiar
    // no resto do teste — sem isto, um "passou" seria indistinguível de
    // "nunca havia risco de errar".
    const diaLocal = formatDateISO(instanteLimite);
    const diaUtc = instanteLimite.toISOString().slice(0, 10);
    expect(diaLocal).not.toBe(diaUtc);

    jest.useFakeTimers().setSystemTime(instanteLimite);
    try {
      mockGetAgenda.mockResolvedValue([MOCK_HOJE]);
      const { result } = renderHook(() => useAgendaHoje(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // MORDIDA: se a implementação usasse `new Date().toISOString().slice(0,10)`
      // em vez de `formatDateISO(new Date())`, esta asserção falharia — ela
      // receberia `diaUtc`, não `diaLocal`.
      expect(mockGetAgenda).toHaveBeenCalledWith({ dataInicio: diaLocal, dataFim: diaLocal });
      expect(result.current.dataHoje).toBe(diaLocal);
    } finally {
      jest.useRealTimers();
    }
  });

  it('devolve os agendamentos de hoje depois de carregar', async () => {
    mockGetAgenda.mockResolvedValue([MOCK_HOJE]);
    const { result } = renderHook(() => useAgendaHoje(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.isError).toBe(false);
  });

  it('refetch chama getAgenda de novo', async () => {
    mockGetAgenda.mockResolvedValue([]);
    const { result } = renderHook(() => useAgendaHoje(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.refetch();
    expect(mockGetAgenda).toHaveBeenCalledTimes(2);
  });

  // Fix wave G2 (I-1): a tela "Hoje" fica aberta o dia todo — sem
  // `refetchInterval`, check-in feito em OUTRO aparelho só aparece quando
  // alguém puxar a lista manualmente. Prova por COMPORTAMENTO (a query
  // refaz sozinha), não por leitura de opção passada ao `useQuery`.
  it('refaz a busca sozinha depois de 60s, sem chamar refetch() manualmente', async () => {
    jest.useFakeTimers();
    try {
      mockGetAgenda.mockResolvedValue([]);
      const { result } = renderHook(() => useAgendaHoje(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockGetAgenda).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });

      // MORDIDA: sem `refetchInterval: 60_000` em useAgendaHoje, esta
      // chamada nunca chegaria a 2 — ficaria travada em 1 até um refetch()
      // manual (pull-to-refresh).
      await waitFor(() => expect(mockGetAgenda).toHaveBeenCalledTimes(2));
    } finally {
      jest.useRealTimers();
    }
  });
});

// ─── REC-12: useCheckinAgendamento ──────────────────────────────────────────
describe('useCheckinAgendamento', () => {
  const VARS = { idAgendamento: 18, nrVersion: 2 };

  it('encaminha idAgendamento e nrVersion ao service', async () => {
    mockCheckin.mockResolvedValue({ ...MOCK_APPOINTMENT, dsEtapaRecepcao: 'CHEGOU' });
    const { wrapper } = makeWrapperComCliente();

    const { result } = renderHook(() => useCheckinAgendamento(), { wrapper });
    result.current.mutate(VARS);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCheckin).toHaveBeenCalledWith(18, { nrVersion: 2 });
  });

  it('invalida a agenda (prefixo compartilhado com useAgendaHoje) no SUCESSO', async () => {
    mockCheckin.mockResolvedValue(MOCK_APPOINTMENT);
    const { qc, wrapper } = makeWrapperComCliente();
    // Query key REAL de useAgendaHoje — prova que o prefixo compartilhado
    // ('agenda') de fato invalida a visão "Hoje", não só a Semana.
    qc.setQueryData(['agenda', 'hoje', '2026-09-28'], [MOCK_APPOINTMENT]);
    expect(qc.getQueryState(['agenda', 'hoje', '2026-09-28'])?.isInvalidated).toBe(false);

    const { result } = renderHook(() => useCheckinAgendamento(), { wrapper });
    result.current.mutate(VARS);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryState(['agenda', 'hoje', '2026-09-28'])?.isInvalidated).toBe(true);
  });

  // 🔴 Mesma classe de mordida que já provou o bug real de useAtualizarStatusAgendamento
  // (onSettled -> onSuccess): sem isto, um 409 deixaria a linha presa num
  // nrVersion velho até o usuário sair e voltar da tela.
  it('invalida a agenda TAMBÉM no 409 (versão desatualizada)', async () => {
    mockCheckin.mockRejectedValue(Object.assign(new Error('Conflito'), { status: 409 }));
    const { qc, wrapper } = makeWrapperComCliente();
    const spy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCheckinAgendamento(), { wrapper });
    result.current.mutate(VARS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['agenda'] });
  });
});

// ─── REC-13: useIniciarAtendimento ──────────────────────────────────────────
describe('useIniciarAtendimento', () => {
  const VARS = { idAgendamento: 18, nrVersion: 2 };

  it('encaminha idAgendamento e nrVersion ao service', async () => {
    mockIniciarAtendimento.mockResolvedValue({ ...MOCK_APPOINTMENT, dsEtapaRecepcao: 'EM_ATENDIMENTO' });
    const { wrapper } = makeWrapperComCliente();

    const { result } = renderHook(() => useIniciarAtendimento(), { wrapper });
    result.current.mutate(VARS);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockIniciarAtendimento).toHaveBeenCalledWith(18, { nrVersion: 2 });
  });

  it('invalida a agenda (prefixo compartilhado com useAgendaHoje) no SUCESSO', async () => {
    mockIniciarAtendimento.mockResolvedValue(MOCK_APPOINTMENT);
    const { qc, wrapper } = makeWrapperComCliente();
    qc.setQueryData(['agenda', 'hoje', '2026-09-28'], [MOCK_APPOINTMENT]);
    expect(qc.getQueryState(['agenda', 'hoje', '2026-09-28'])?.isInvalidated).toBe(false);

    const { result } = renderHook(() => useIniciarAtendimento(), { wrapper });
    result.current.mutate(VARS);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryState(['agenda', 'hoje', '2026-09-28'])?.isInvalidated).toBe(true);
  });

  // Mesma classe de mordida de useCheckinAgendamento/useAtualizarStatusAgendamento
  // acima: sem isto, um erro (ex.: 409/422 — que a tela trata como aviso
  // não-bloqueante, ConsultaScreen.test.tsx) deixaria a linha presa num
  // estado divergente até o usuário sair e voltar da tela.
  it('invalida a agenda TAMBÉM no erro', async () => {
    mockIniciarAtendimento.mockRejectedValue(Object.assign(new Error('Conflito'), { status: 409 }));
    const { qc, wrapper } = makeWrapperComCliente();
    const spy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useIniciarAtendimento(), { wrapper });
    result.current.mutate(VARS);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['agenda'] });
  });
});
