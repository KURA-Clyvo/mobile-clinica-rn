// FM-07 (ciclo FIN) — MORDIDA OBRIGATÓRIA do brief (§1): "Escreva um teste que monte o
// dashboard como VETERINARIO e prove que a chamada NÃO acontece."
//
// Diferente de tests/DashboardScreen.test.tsx (que mocka `@hooks/useFinanceiro` e testa só o
// COMPONENTE), este arquivo exercita a cadeia REAL e completa: service -> apiClient real ->
// mock-adapter -> financeiro.mock.ts (EXPO_PUBLIC_USE_MOCKS=true), SEM jest.mock de nenhum
// desses módulos — mesma disciplina de tests/fm02-mordida-veterinario-sem-ficha.test.tsx e
// tests/mock-contract-audit.test.ts. Um teste que mockasse o hook nunca poderia provar isto:
// provaria só que o COMPONENTE decide certo dado um resultado, não que o HOOK de fato evita a
// requisição.
//
// A prova é por SPY em `apiClient.get` (o método real da instância axios exportada por
// services/api/client.ts) — `jest.spyOn` preserva o comportamento original (a chamada
// continua indo para o mock-adapter normalmente), só registra SE e COM QUE URL foi chamado.
// Não é possível espionar os módulos `*.mock.ts` diretamente: `ROUTES` (mock-adapter.ts)
// dereferencia `financeiroMock.resumo` UMA VEZ, na construção do array, no module-load —
// `jest.spyOn` chamado depois disso (de dentro de um teste) não alcançaria essa referência já
// capturada. `apiClient.get` não tem esse problema: é um método de uma instância de objeto
// (a mesma para todo o app), resolvido em CADA chamada.
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { apiClient } from '../src/services/api/client';
import DashboardScreen from '../src/app/(app)/dashboard';

// useBreakpoint() consome useWindowDimensions -- mesmo mock do arquivo irmão
// (DashboardScreen.test.tsx), só para a árvore renderizar de forma determinística.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 400, height: 800, scale: 1, fontScale: 1 }),
}));

const MOCK_VET = {
  id: 1,
  nmVeterinario: 'Dr. Felipe Ferrete',
  nrCRMV: 'SP-12345',
  dsEmail: 'felipe@kuraclinica.com.br',
};

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

const originalUseMocks = process.env.EXPO_PUBLIC_USE_MOCKS;

beforeEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = 'true';
});

afterEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = originalUseMocks;
  jest.restoreAllMocks();
});

function urlsChamadas(spy: jest.SpyInstance): string[] {
  return spy.mock.calls.map((call) => call[0] as string);
}

describe('FM-07 — mordida obrigatória: VETERINARIO não dispara a chamada de financeiro/resumo', () => {
  it('VETERINARIO: apiClient.get NUNCA é chamado com /financeiro/resumo (cadeia real, sem mock do hook/service)', async () => {
    useAuthStore.setState({
      token: 'tok-vet',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      email: 'felipe@kuraclinica.com.br',
      tpPerfil: 'VETERINARIO',
      usuario: MOCK_VET,
      _hasHydrated: true,
    });

    const getSpy = jest.spyOn(apiClient, 'get');

    // `wrap()` (render()) já embrulha a montagem em `act` internamente -- o `act` extra é só
    // para dar tempo aos efeitos ASSÍNCRONOS de montagem (React Query dispara queryFn no
    // mount) e à latência simulada do mock-adapter (300ms) resolverem, se algo tivesse
    // disparado. Chamar `render()` DENTRO de um `act(async () => {...})` externo causa
    // "Can't access .root on unmounted test renderer" nesta versão de RNTL/react-test-
    // renderer -- medido, não hipotético.
    wrap(<DashboardScreen />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });

    const chamadas = urlsChamadas(getSpy);
    expect(chamadas.some((url) => url.includes('/financeiro/resumo'))).toBe(false);

    // Controle positivo do PRÓPRIO teste: outras chamadas do dashboard (hoje/alertas/
    // recentes) TÊM que ter disparado -- se elas também não dispararam, o teste não provou
    // nada (o componente pode simplesmente não ter montado/efeitos não terem rodado).
    expect(chamadas.some((url) => url.includes('/dashboard/hoje'))).toBe(true);
  });

  it('CONTROLE POSITIVO: GESTOR (mesma árvore, mesma cadeia) CHAMA /financeiro/resumo -- prova que o instrumento (o spy) enxergaria a chamada se ela existisse', async () => {
    useAuthStore.setState({
      token: 'tok-gestor',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      email: 'gestora@kuraclinica.com.br',
      tpPerfil: 'GESTOR',
      usuario: MOCK_VET,
      _hasHydrated: true,
    });

    const getSpy = jest.spyOn(apiClient, 'get');

    wrap(<DashboardScreen />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });

    const chamadas = urlsChamadas(getSpy);
    expect(chamadas.some((url) => url.includes('/financeiro/resumo'))).toBe(true);
  });
});
