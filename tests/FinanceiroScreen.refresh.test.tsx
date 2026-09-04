// FM-08 (ciclo FIN) — fix wave, item I-1 da G2. MORDIDA OBRIGATÓRIA: prova que
// `RefreshControl.refreshing` de fato GIRA durante um refetch, na cadeia REAL de
// react-query (sem jest.mock de `@hooks/useFinanceiro`). Um teste que mockasse o hook (como
// `tests/FinanceiroScreen.test.tsx`) só prova o COMPONENTE dado um `isLoading`/`isFetching`
// literal de fixture — nunca prova o que o `@tanstack/react-query` de fato entrega durante
// um refetch verdadeiro. Mesma disciplina de
// tests/fm07-veterinario-sem-chamada-financeiro.test.tsx.
//
// Fonte da sonda: G2 da FM-08 (`.superpowers/sdd/KURA_BACKLOG_FIN/fm-08-revisao.md`, PROBE
// A), convertida de sonda temporária em teste permanente — com asserts no lugar de `log`.
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import FinanceiroScreen from '../src/app/(app)/financeiro/index';

const RNRefreshControl =
  require('react-native/Libraries/Components/RefreshControl/RefreshControl').default;

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}));
jest.mock('react-native-safe-area-context', () => {
  const ReactForMock = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      ReactForMock.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

let QC: QueryClient;
function wrap(ui: React.ReactElement) {
  QC = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={QC}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

const USUARIO = { id: 1, nmVeterinario: 'Dr. F', nrCRMV: 'SP-1', dsEmail: 'f@k.com' };
function seedGestor() {
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'f@k.com',
    tpPerfil: 'GESTOR',
    usuario: USUARIO,
    _hasHydrated: true,
  });
}

const orig = process.env.EXPO_PUBLIC_USE_MOCKS;
beforeEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = 'true';
  jest.clearAllMocks();
});
afterEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = orig;
  jest.restoreAllMocks();
});

describe('FinanceiroScreen — RefreshControl.refreshing durante refetch (cadeia REAL de react-query)', () => {
  it('gira DURANTE o refetch, não só na primeira carga', async () => {
    seedGestor();
    const r = wrap(<FinanceiroScreen />);
    await act(async () => {
      await new Promise((res) => setTimeout(res, 900));
    });
    expect(r.queryByTestId('financeiro-painel-row')).toBeTruthy();
    // Depois da carga inicial bem-sucedida, `refreshing` some (nada em voo).
    expect(r.UNSAFE_getByType(RNRefreshControl).props.refreshing).toBe(false);

    let durante: unknown = 'NAO_MEDIDO';
    let duranteIsFetching: unknown = 'NAO_MEDIDO';
    await act(async () => {
      const p = r.UNSAFE_getByType(RNRefreshControl).props.onRefresh();
      // MOCK_LATENCY_MS = 300 (mock-adapter.ts:105) -> 120ms cai DENTRO do fetch.
      await new Promise((res) => setTimeout(res, 120));
      durante = r.UNSAFE_getByType(RNRefreshControl).props.refreshing;
      // CONTROLE POSITIVO: prova que HAVIA fetch em voo neste instante — sem isso, um
      // `refreshing=false` aqui seria indistinguível de "o fetch já tinha acabado".
      duranteIsFetching = QC.isFetching();
      await p;
      // O `notifyManager` do react-query agenda a re-notificação de `isFetching -> false`
      // por `setTimeout(fn, 0)` (macrotask), não por microtask -- `await p` sozinho não é
      // suficiente para o re-render já ter acontecido. Uma volta extra do timer, ainda
      // dentro do mesmo `act`, garante que o efeito seja capturado.
      await new Promise((res) => setTimeout(res, 0));
    });

    expect(duranteIsFetching).toBe(1);
    expect(durante).toBe(true);
    expect(r.UNSAFE_getByType(RNRefreshControl).props.refreshing).toBe(false);
  });

  it('CONTROLE DO INSTRUMENTO: na primeira carga (isPending=true), refreshing É true', async () => {
    // Sem este controle, um `false` no teste acima seria indistinguível de "a sonda não sabe
    // ler a prop" — aqui provamos que o mesmo instrumento ENXERGA um `true` quando ele existe.
    seedGestor();
    const r = wrap(<FinanceiroScreen />);
    let primeiraCarga: unknown = 'NAO_MEDIDO';
    await act(async () => {
      await new Promise((res) => setTimeout(res, 120));
      primeiraCarga = r.UNSAFE_getByType(RNRefreshControl).props.refreshing;
      await new Promise((res) => setTimeout(res, 900));
    });
    expect(primeiraCarga).toBe(true);
  });
});
