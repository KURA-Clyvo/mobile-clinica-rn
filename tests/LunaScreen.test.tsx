import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import LunaScreen from '../src/app/(app)/luna';
import { formatDateISO, subDays } from '../src/utils/date';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: { children: unknown; style: unknown }) => {
    const { View } = require('react-native');
    const R = require('react');
    return R.createElement(View, { style }, children);
  },
}));

jest.mock('@hooks/useLuna', () => ({
  useLunaHealth: jest.fn(),
  useRelatorioTriagens: jest.fn(),
}));

jest.mock('@hooks/useDashboard', () => ({
  useAlertas: jest.fn(),
}));

import { useLunaHealth, useRelatorioTriagens } from '../src/hooks/useLuna';
import { useAlertas } from '../src/hooks/useDashboard';

const mockUseLunaHealth = useLunaHealth as jest.Mock;
const mockUseRelatorioTriagens = useRelatorioTriagens as jest.Mock;
const mockUseAlertas = useAlertas as jest.Mock;
const mockInvalidateQueries = jest.fn();

const MOCK_HEALTH_UP = {
  sgStatus: 'UP' as const,
  dtUltimaVerificacao: new Date().toISOString(),
  servicos: {
    twilio: 'UP' as const,
    oracle: 'UP' as const,
    visaoComputacional: 'UP' as const,
  },
};

const MOCK_RELATORIO = {
  nrTotalTriagens: 142,
  distribuicaoUrgencia: { BAIXO: 68, MEDIO: 45, ALTO: 22, CRITICO: 7 },
  nrEncaminhadasParaVet: 29,
};

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.invalidateQueries = mockInvalidateQueries;
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInvalidateQueries.mockResolvedValue(undefined);
  mockUseLunaHealth.mockReturnValue({ data: MOCK_HEALTH_UP });
  mockUseRelatorioTriagens.mockReturnValue({ data: MOCK_RELATORIO, isLoading: false });
  mockUseAlertas.mockReturnValue({ data: [] });
});

describe('LunaScreen', () => {
  it('shows "Online" status when health.sgStatus = "UP"', () => {
    const { getByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('status-text').props.children).toBe('Online');
  });

  it('shows "Offline" status when health.sgStatus = "DOWN"', () => {
    mockUseLunaHealth.mockReturnValue({
      data: {
        sgStatus: 'DOWN',
        dtUltimaVerificacao: new Date().toISOString(),
        servicos: {
          twilio: 'DOWN' as const,
          oracle: 'DOWN' as const,
          visaoComputacional: 'DOWN' as const,
        },
      },
    });
    const { getByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('status-text').props.children).toBe('Offline');
  });

  it('shows 3 sub-service cards (twilio, oracle, visão)', () => {
    const { getByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('svc-twilio')).toBeTruthy();
    expect(getByTestId('svc-oracle')).toBeTruthy();
    expect(getByTestId('svc-visaoComputacional')).toBeTruthy();
  });

  it('changes period query when pressing "30 dias" chip', () => {
    const { getByTestId } = wrap(<LunaScreen />);
    fireEvent.press(getByTestId('chip-periodo-30'));
    const expectedDate = formatDateISO(subDays(new Date(), 30));
    const calls = mockUseRelatorioTriagens.mock.calls;
    const lastCall = calls[calls.length - 1][0] as { dataInicio: string };
    expect(lastCall.dataInicio).toBe(expectedDate);
  });

  it('displays nrTotalTriagens correctly', () => {
    const { getByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('total-triagens').props.children).toBe('Total de triagens: 142');
  });

  it('shows 4 urgency distribution rows', () => {
    const { getByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('urg-row-BAIXO')).toBeTruthy();
    expect(getByTestId('urg-row-MEDIO')).toBeTruthy();
    expect(getByTestId('urg-row-ALTO')).toBeTruthy();
    expect(getByTestId('urg-row-CRITICO')).toBeTruthy();
  });

  it('invalidates luna queries on pull-to-refresh', async () => {
    const { UNSAFE_getByType } = wrap(<LunaScreen />);
    const scrollView = UNSAFE_getByType(ScrollView);
    await act(async () => {
      await scrollView.props.refreshControl.props.onRefresh();
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['luna'] });
  });
});
