import React from 'react';
import { render, waitFor, within } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import DashboardScreen from '../src/app/(app)/dashboard';

jest.mock('@hooks/useDashboard', () => ({
  useDashboardHoje: jest.fn(),
  useAlertas: jest.fn(),
  useRecentes: jest.fn(),
}));

import { useDashboardHoje, useAlertas, useRecentes } from '../src/hooks/useDashboard';

const mockUseDashboardHoje = useDashboardHoje as jest.Mock;
const mockUseAlertas = useAlertas as jest.Mock;
const mockUseRecentes = useRecentes as jest.Mock;

// useWindowDimensions é o que useBreakpoint() consome (nunca Dimensions.get(),
// que não re-renderiza em resize de janela na web). Mesmo padrão de
// ScreenContainer.test.tsx/LunaScreen.test.tsx (CQ-04): mockamos o módulo
// interno específico, não 'react-native' inteiro.
const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

function setViewport(width: number, height: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

const MOCK_VET = {
  id: 1,
  nmVeterinario: 'Dr. Felipe Ferrete',
  nrCRMV: 'SP-12345',
  dsEmail: 'felipe@kuraclinica.com.br',
};

const MOCK_HOJE = {
  metrics: { nrConsultasHoje: 8, nrPacientesAtendidos: 6, nrAlertasAtivos: 3, nrTeleorientacoes: 2 },
  dailySummary: { dsResumo: 'OK', dtUltimaAtualizacao: new Date().toISOString() },
};

const MOCK_ALERTA = {
  id: 1,
  dsTipoAlerta: 'VACINA_VENCIDA' as const,
  dsMensagem: 'Vacina de Mel venceu há 5 dias',
  idPet: 3,
  nmPet: 'Mel',
  dtCriacao: new Date().toISOString(),
};

const MOCK_RECENTE = {
  id: 101,
  nmPet: 'Thor',
  nmTutor: 'Carlos Mendes',
  dtAgendamento: new Date().toISOString(),
  nmTipoConsulta: 'Consulta de Retorno',
  sgStatus: 'AGENDADA' as const,
};

// 3 itens — o suficiente para exercitar agrupamento em pares (2 colunas) com
// resto ímpar, sem depender de um número "redondo" de itens.
const MOCK_RECENTES_3 = [
  MOCK_RECENTE,
  { ...MOCK_RECENTE, id: 102, nmPet: 'Nina' },
  { ...MOCK_RECENTE, id: 103, nmPet: 'Bento' },
];

const MOCK_ALERTAS_3 = [
  MOCK_ALERTA,
  { ...MOCK_ALERTA, id: 2, nmPet: 'Nina' },
  { ...MOCK_ALERTA, id: 3, nmPet: 'Bento' },
];

function noop() {}
const REFETCH = jest.fn().mockResolvedValue(undefined);

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  useAuthStore.setState({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), usuario: MOCK_VET });
  jest.clearAllMocks();
  REFETCH.mockResolvedValue(undefined);
  setViewport(400, 800);
});

describe('DashboardScreen — loading state', () => {
  it('shows skeleton placeholders while all data is loading', () => {
    mockUseDashboardHoje.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });
    mockUseAlertas.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });
    mockUseRecentes.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });

    const { getAllByTestId } = wrap(<DashboardScreen />);
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('shows metrics-skeleton when hoje is loading', () => {
    mockUseDashboardHoje.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });
    mockUseAlertas.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
    mockUseRecentes.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });

    const { getByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('metrics-skeleton')).toBeTruthy();
  });
});

describe('DashboardScreen — loaded state', () => {
  beforeEach(() => {
    mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
    mockUseAlertas.mockReturnValue({ data: [MOCK_ALERTA], isLoading: false, isError: false, refetch: REFETCH });
    mockUseRecentes.mockReturnValue({ data: [MOCK_RECENTE], isLoading: false, isError: false, refetch: REFETCH });
  });

  it('shows greeting with user first name', () => {
    const { getByTestId } = wrap(<DashboardScreen />);
    const greetingText = getByTestId('greeting-block').findAll(() => true);
    // greeting block renders a Text with the vet's first name
    const { getAllByText } = wrap(<DashboardScreen />);
    // The greeting text includes "Dr." as first name
    expect(getAllByText(/Dr\./)).toBeTruthy();
  });

  it('renders metrics grid with correct values', () => {
    const { getAllByTestId } = wrap(<DashboardScreen />);
    const values = getAllByTestId('metric-value').map((el) => el.props.children);
    expect(values).toContain(8);
    expect(values).toContain(6);
    expect(values).toContain(3);
    expect(values).toContain(2);
  });

  it('shows metrics grid, not skeleton, when loaded', () => {
    const { getByTestId, queryByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('metrics-grid')).toBeTruthy();
    expect(queryByTestId('metrics-skeleton')).toBeNull();
  });

  it('renders appointment row when recentes has data', () => {
    const { getByText } = wrap(<DashboardScreen />);
    expect(getByText('Thor')).toBeTruthy();
  });

  it('renders alert card when alertas has data', () => {
    const { getByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('alert-message')).toBeTruthy();
  });
});

describe('DashboardScreen — empty states', () => {
  beforeEach(() => {
    mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
    mockUseAlertas.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
    mockUseRecentes.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
  });

  it('shows empty state for appointments when list is empty', () => {
    const { getByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('empty-appointments')).toBeTruthy();
  });

  it('shows empty state for alerts when list is empty', () => {
    const { getByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('empty-alerts')).toBeTruthy();
  });
});

// CQ-06: prova de mordida — falha contra o dashboard.tsx atual (grid fixo em
// 2×2, `metricsRow` sempre com `flexDirection: 'row'` e sempre 2 filhos por
// linha). Passa depois da implementação, que agrupa os `MetricCard` por
// linha conforme a contagem de colunas derivada do breakpoint (branch em JS,
// não CSS — `react-test-renderer` deste projeto não computa layout Yoga,
// então só uma árvore que muda de fato entre viewports prova o
// comportamento; ver brief da task).
describe('DashboardScreen — responsive grid (CQ-06)', () => {
  const METRIC_VIEWPORTS = [
    { label: '360×640 (sm) — 1 coluna', width: 360, height: 640, expectedColumns: 1, expectedRows: 4 },
    { label: '768×1024 (md) — 2 colunas', width: 768, height: 1024, expectedColumns: 2, expectedRows: 2 },
    { label: '1440×900 (xl) — 4 colunas', width: 1440, height: 900, expectedColumns: 4, expectedRows: 1 },
  ];

  describe('loaded metrics grid', () => {
    beforeEach(() => {
      mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
      mockUseAlertas.mockReturnValue({ data: MOCK_ALERTAS_3, isLoading: false, isError: false, refetch: REFETCH });
      mockUseRecentes.mockReturnValue({ data: MOCK_RECENTES_3, isLoading: false, isError: false, refetch: REFETCH });
    });

    it.each(METRIC_VIEWPORTS)(
      'lays out $expectedRows row(s) of $expectedColumns MetricCard(s) at $label',
      ({ width, height, expectedColumns, expectedRows }) => {
        setViewport(width, height);
        const { getAllByTestId } = wrap(<DashboardScreen />);

        const rows = getAllByTestId('metrics-row');
        expect(rows).toHaveLength(expectedRows);

        for (const row of rows) {
          expect(within(row).getAllByTestId('metric-value')).toHaveLength(expectedColumns);
        }

        // Sanity: as 4 métricas continuam todas presentes, só a forma da
        // árvore muda — nenhum dado se perde ao trocar de coluna.
        expect(getAllByTestId('metric-value')).toHaveLength(4);
      },
    );
  });

  describe('metrics skeleton grid follows the same breakpoint', () => {
    beforeEach(() => {
      mockUseDashboardHoje.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });
      mockUseAlertas.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
      mockUseRecentes.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
    });

    it.each(METRIC_VIEWPORTS)(
      'lays out $expectedRows skeleton row(s) of $expectedColumns card(s) at $label',
      ({ width, height, expectedColumns, expectedRows }) => {
        setViewport(width, height);
        const { getAllByTestId } = wrap(<DashboardScreen />);

        const rows = getAllByTestId('metrics-skeleton-row');
        expect(rows).toHaveLength(expectedRows);

        for (const row of rows) {
          expect(within(row).getAllByTestId('skeleton')).toHaveLength(expectedColumns);
        }
      },
    );
  });

  describe('appointments and alerts lists — 2 columns at >= lg', () => {
    beforeEach(() => {
      mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
      mockUseAlertas.mockReturnValue({ data: MOCK_ALERTAS_3, isLoading: false, isError: false, refetch: REFETCH });
      mockUseRecentes.mockReturnValue({ data: MOCK_RECENTES_3, isLoading: false, isError: false, refetch: REFETCH });
    });

    it('stacks 1 item per row below lg (768×1024, md)', () => {
      setViewport(768, 1024);
      const { getAllByTestId } = wrap(<DashboardScreen />);

      const appointmentRows = getAllByTestId('appointments-row');
      const alertRows = getAllByTestId('alerts-row');
      expect(appointmentRows).toHaveLength(3);
      expect(alertRows).toHaveLength(3);
      for (const row of appointmentRows) {
        expect(within(row).getAllByTestId('appointments-item')).toHaveLength(1);
      }
      for (const row of alertRows) {
        expect(within(row).getAllByTestId('alerts-item')).toHaveLength(1);
      }
    });

    it('groups 2 items per row at >= lg (1440×900, xl)', () => {
      setViewport(1440, 900);
      const { getAllByTestId } = wrap(<DashboardScreen />);

      // 3 itens em pares de 2 => 2 linhas (2 + 1)
      const appointmentRows = getAllByTestId('appointments-row');
      const alertRows = getAllByTestId('alerts-row');
      expect(appointmentRows).toHaveLength(2);
      expect(alertRows).toHaveLength(2);
      expect(within(appointmentRows[0]).getAllByTestId('appointments-item')).toHaveLength(2);
      expect(within(appointmentRows[1]).getAllByTestId('appointments-item')).toHaveLength(1);
      expect(within(alertRows[0]).getAllByTestId('alerts-item')).toHaveLength(2);
      expect(within(alertRows[1]).getAllByTestId('alerts-item')).toHaveLength(1);

      // Sanity: todos os itens continuam presentes.
      expect(getAllByTestId('appointments-item')).toHaveLength(3);
      expect(getAllByTestId('alerts-item')).toHaveLength(3);
    });
  });
});
