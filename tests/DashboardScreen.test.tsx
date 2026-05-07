import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
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

function noop() {}
const REFETCH = jest.fn().mockResolvedValue(undefined);

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  useAuthStore.setState({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), usuario: MOCK_VET });
  jest.clearAllMocks();
  REFETCH.mockResolvedValue(undefined);
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
