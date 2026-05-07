import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDashboardHoje, useAlertas, useRecentes } from '../src/hooks/useDashboard';
import * as dashboardService from '../src/services/dashboard.service';

jest.mock('@services/dashboard.service', () => ({
  getHoje: jest.fn(),
  getAlertas: jest.fn(),
  getRecentes: jest.fn(),
}));

const mockGetHoje = dashboardService.getHoje as jest.Mock;
const mockGetAlertas = dashboardService.getAlertas as jest.Mock;
const mockGetRecentes = dashboardService.getRecentes as jest.Mock;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useDashboardHoje', () => {
  it('returns isLoading=true then resolves with data', async () => {
    const mockData = {
      metrics: { nrConsultasHoje: 8, nrPacientesAtendidos: 6, nrAlertasAtivos: 3, nrTeleorientacoes: 2 },
      dailySummary: { dsResumo: 'OK', dtUltimaAtualizacao: new Date().toISOString() },
    };
    mockGetHoje.mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboardHoje(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isError).toBe(false);
  });

  it('exposes refetch function', async () => {
    mockGetHoje.mockResolvedValue({
      metrics: { nrConsultasHoje: 8, nrPacientesAtendidos: 6, nrAlertasAtivos: 3, nrTeleorientacoes: 2 },
      dailySummary: { dsResumo: 'OK', dtUltimaAtualizacao: new Date().toISOString() },
    });

    const { result } = renderHook(() => useDashboardHoje(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(typeof result.current.refetch).toBe('function');
    await result.current.refetch();
    expect(mockGetHoje).toHaveBeenCalledTimes(2);
  });
});

describe('useAlertas', () => {
  it('returns data with required alert fields', async () => {
    const mockAlertas = [
      {
        id: 1,
        dsTipoAlerta: 'VACINA_VENCIDA' as const,
        dsMensagem: 'Vacina de Mel venceu',
        idPet: 3,
        nmPet: 'Mel',
        dtCriacao: new Date().toISOString(),
      },
    ];
    mockGetAlertas.mockResolvedValue(mockAlertas);

    const { result } = renderHook(() => useAlertas(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toHaveLength(1);
    const alerta = result.current.data?.[0];
    expect(alerta).toHaveProperty('id');
    expect(alerta).toHaveProperty('dsTipoAlerta');
    expect(alerta).toHaveProperty('dsMensagem');
    expect(alerta).toHaveProperty('dtCriacao');
  });
});

describe('useRecentes', () => {
  it('returns data with valid sgStatus values', async () => {
    const validStatuses = ['AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'];
    const mockRecentes = [
      { id: 101, nmPet: 'Thor', nmTutor: 'Carlos', dtAgendamento: new Date().toISOString(), nmTipoConsulta: 'Retorno', sgStatus: 'AGENDADA' as const },
      { id: 102, nmPet: 'Mel', nmTutor: 'Patrícia', dtAgendamento: new Date().toISOString(), nmTipoConsulta: 'Vacina', sgStatus: 'CONCLUIDA' as const },
    ];
    mockGetRecentes.mockResolvedValue(mockRecentes);

    const { result } = renderHook(() => useRecentes(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.data?.forEach((item) => {
      expect(validStatuses).toContain(item.sgStatus);
    });
  });
});

describe('error handling', () => {
  it('useDashboardHoje sets isError=true and data=undefined on API failure', async () => {
    mockGetHoje.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDashboardHoje(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('useAlertas sets isError=true on API failure', async () => {
    mockGetAlertas.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useAlertas(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe('refetch', () => {
  it('refetch triggers a new service call', async () => {
    mockGetRecentes.mockResolvedValue([]);

    const { result } = renderHook(() => useRecentes(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.refetch();
    expect(mockGetRecentes).toHaveBeenCalledTimes(2);
  });
});
