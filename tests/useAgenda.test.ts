import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAgendaSemana, useAtualizarStatusAgendamento } from '../src/hooks/useAgenda';
import * as agendaService from '../src/services/agenda.service';
import { getMondayOf, addDays, isSameDay, formatDateISO } from '../src/utils/date';

jest.mock('@services/agenda.service', () => ({
  getAgenda: jest.fn(),
  atualizarStatusAgendamento: jest.fn(),
}));

const mockGetAgenda = agendaService.getAgenda as jest.Mock;
const mockAtualizarStatus = agendaService.atualizarStatusAgendamento as jest.Mock;

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
