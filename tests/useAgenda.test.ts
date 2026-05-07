import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAgendaSemana } from '../src/hooks/useAgenda';
import * as agendaService from '../src/services/agenda.service';
import { getMondayOf, addDays, isSameDay, formatDateISO } from '../src/utils/date';

jest.mock('@services/agenda.service', () => ({
  getAgenda: jest.fn(),
}));

const mockGetAgenda = agendaService.getAgenda as jest.Mock;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
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
