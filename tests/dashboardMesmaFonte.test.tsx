import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import RNRefreshControl from 'react-native/Libraries/Components/RefreshControl/RefreshControl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import DashboardScreen from '../src/app/(app)/dashboard';
import AgendaScreen from '../src/app/(app)/agenda';
import { DIA_DO_PRINT, ag } from './helpers_proximos';
import { formatDateISO } from '../src/utils/date';

// BR-CLI-T06 -- CADEIA REAL (sem mockar os hooks): dashboard e Hoje usam a MESMA queryKey
// ['agenda','hoje',data] (useAgendaHoje), entao 2 telas = 1 chamada de rede, e invalidar ['agenda']
// atualiza as duas. So o service (rede) e mockado.

jest.mock('@services/agenda.service', () => ({
  ...jest.requireActual('@services/agenda.service'),
  getAgenda: jest.fn(),
}));
jest.mock('@services/dashboard.service', () => ({
  ...jest.requireActual('@services/dashboard.service'),
  getHoje: jest.fn(),
  getAlertas: jest.fn(),
}));
jest.mock('@hooks/useFinanceiro', () => ({
  useResumoFinanceiro: () => ({ data: undefined, isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock('@utils/agora', () => ({ agora: () => new Date(2026, 9, 9, 12, 0, 0) }));
jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      ReactLocal.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock('expo-router', () => {
  const ReactForMock = require('react');
  return {
    useRouter: () => ({ push: jest.fn() }),
    useLocalSearchParams: () => ({ modo: 'hoje' }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactForMock.useEffect(() => cb(), []);
    },
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});

import { getAgenda } from '../src/services/agenda.service';
import { getHoje, getAlertas } from '../src/services/dashboard.service';

const mockGetAgenda = getAgenda as jest.Mock;

const hojeISO = formatDateISO(new Date());
const chamadasDeHoje = () =>
  mockGetAgenda.mock.calls.filter(([q]) => q.dataInicio === hojeISO && q.dataFim === hojeISO);

const aLimpar: Array<() => void> = [];
afterEach(() => {
  // Sem isto o gc do QueryClient e os ticks de 30 s seguram o processo aberto (jest sozinho nao sai).
  aLimpar.splice(0).forEach((fn) => fn());
});

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <DashboardScreen />
        <AgendaScreen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  aLimpar.push(() => {
    ui.unmount();
    client.clear();
  });
  return { client, ...ui };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    token: 't',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'a@b.c',
    tpPerfil: 'VETERINARIO',
    usuario: { id: 1, nmVeterinario: 'Dra. Ana', nrCRMV: 'SP-1', dsEmail: 'a@b.c' },
  });
  mockGetAgenda.mockResolvedValue(DIA_DO_PRINT);
  (getHoje as jest.Mock).mockResolvedValue({
    metrics: { nrConsultasHoje: 1, nrPacientesAtendidos: 1, nrAlertasAtivos: 0, nrTeleorientacoes: 0 },
    dailySummary: { dsResumo: '', dtUltimaAtualizacao: '' },
  });
  (getAlertas as jest.Mock).mockResolvedValue([]);
});

describe('dashboard e Hoje compartilham a mesma query (BR-CLI-T06)', () => {
  it('renderizar as duas telas faz UMA chamada a getAgenda do dia', async () => {
    const { getByTestId } = montar();
    await waitFor(() => expect(getByTestId('proximo-pet')).toBeTruthy());
    expect(chamadasDeHoje()).toHaveLength(1);
  });

  it('a queryKey e ["agenda","hoje",data] (a mesma da Hoje)', async () => {
    const { client, getByTestId } = montar();
    await waitFor(() => expect(getByTestId('proximo-pet')).toBeTruthy());
    expect(client.getQueryData(['agenda', 'hoje', hojeISO])).toEqual(DIA_DO_PRINT);
    // e nenhuma chave "dashboard/recentes" foi criada
    expect(client.getQueryCache().findAll({ queryKey: ['dashboard', 'recentes'] })).toHaveLength(0);
  });

  it('invalidar ["agenda"] (o que Chegou/Faltou fazem) atualiza as DUAS telas', async () => {
    const { client, getByTestId, getAllByTestId } = montar();
    await waitFor(() => expect(getByTestId('proximo-pet')).toBeTruthy());
    // Thor (o proximo) vira EM_ATENDIMENTO: ninguem mais espera e a Nala (11:50) esta atrasada sem check-in
    // (B-17: nunca destaque), entao o proximo passa a ser a Simba (12:30, o primeiro horario futuro).
    mockGetAgenda.mockResolvedValue(
      DIA_DO_PRINT.map((a) => (a.pet.nmPet === 'Thor' ? ag(a.id, 'Thor', 11, 45, 'EM_ATENDIMENTO') : a)),
    );
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['agenda'] });
    });
    await waitFor(() => expect(getByTestId('proximo-pet').props.children).toBe('Simba'));
    // a Hoje (cartoes) tambem viu o dado novo: so uma etapa "Em atendimento" a menos no destaque
    expect(getAllByTestId('agenda-hoje-card').length).toBe(DIA_DO_PRINT.length);
    expect(chamadasDeHoje()).toHaveLength(2); // 1 inicial + 1 do invalidate, nunca 2 por tela
  });

  it('o pull-to-refresh do dashboard recarrega a agenda do dia', async () => {
    const { UNSAFE_getAllByType, getByTestId } = montar();
    await waitFor(() => expect(getByTestId('proximo-pet')).toBeTruthy());
    const antes = chamadasDeHoje().length;
    // 2 RefreshControl na arvore (dashboard e Hoje): o do dashboard e o primeiro (greeting-block esta nele).
    const controles = UNSAFE_getAllByType(RNRefreshControl as unknown as React.ComponentType<any>);
    await act(async () => {
      await controles[0]!.props.onRefresh();
    });
    expect(chamadasDeHoje().length).toBeGreaterThan(antes);
  });
});
