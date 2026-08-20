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

// CQ-07: mock do módulo interno específico (nunca 'react-native' inteiro —
// ver tests/ScreenContainer.test.tsx, que documenta por que espalhar
// requireActual('react-native') derruba a suíte). LunaScreen não consome
// useBreakpoint hoje (a responsividade do reportHeader é resolvida por CSS
// flexWrap, não por branch em JS) — o mock existe só para os 3 testes de
// viewport abaixo poderem renderizar sob uma largura simulada e provar que o
// estilo resolvido não muda no sentido errado entre elas.
const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

function setViewport(width: number, height: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

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

function mergedStyle(el: { props: { style: unknown } }) {
  const styleArr = Array.isArray(el.props.style)
    ? el.props.style.filter(Boolean)
    : [el.props.style];
  return Object.assign({}, ...styleArr);
}

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
  setViewport(400, 800);
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

  it('shows "Offline" status and hides sub-services when Luna is indisponível (getLunaHealth never rejects)', () => {
    mockUseLunaHealth.mockReturnValue({ data: { status: 'indisponivel' } });
    const { getByTestId, queryByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('status-text').props.children).toBe('Offline');
    expect(queryByTestId('sub-services')).toBeNull();
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

  // CQ-07 (Bloco 0 §2, B0.5): G4r exige os 3 viewports por teste automatizado,
  // nunca captura de tela. O RN test renderer não computa layout Yoga real
  // (sem measurement nativo neste ambiente jest-expo), então o que estas 3
  // asserções provam é que o ESTILO que habilita o wrap (flexWrap: 'wrap' +
  // flexShrink no título) está presente e não é acidentalmente sobrescrito em
  // nenhuma das 3 larguras — é essa propriedade CSS, resolvida pelo motor de
  // layout real do dispositivo/navegador, que faz o header quebrar quando
  // necessário e ficar lado a lado quando sobra espaço; não há branch em JS
  // por breakpoint neste componente (ver comentário em luna.tsx).
  describe.each([
    [360, 640],
    [768, 1024],
    [1440, 900],
  ])('report header wrap at %ix%i (CQ-07)', (width, height) => {
    beforeEach(() => setViewport(width, height));

    it('reportHeader resolves flexWrap and reportTitle resolves flexShrink', () => {
      const { getByTestId, getByText } = wrap(<LunaScreen />);
      const header = mergedStyle(getByTestId('report-header'));
      const title = mergedStyle(getByText('Relatório de Triagens'));
      expect(header.flexWrap).toBe('wrap');
      expect(title.flexShrink).toBe(1);
    });

    it('periodRow gap comes from the spacing scale, not the old literal 6', () => {
      const { getByTestId } = wrap(<LunaScreen />);
      const periodRow = mergedStyle(getByTestId('period-row'));
      expect(periodRow.gap).toBeGreaterThan(6);
    });
  });
});
