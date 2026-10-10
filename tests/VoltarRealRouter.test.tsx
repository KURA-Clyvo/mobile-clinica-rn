// BR-CLI-T05 fix wave (G2 I-1) — o Voltar das telas de ação com o ROTEADOR REAL (`expo-router/testing-library`) e o
// `AppLayout` REAL (Drawer incluído). NENHUM `useRouter`/`canGoBack` mockado: o teste anterior (`SaidaPorRota`) mockava
// `canGoBack: () => false` e provava a função, não o comportamento — no Drawer `firstRoute` (padrão) o Voltar caía
// SEMPRE na Hoje. Aqui a prova é a trajetória: lista → ficha → consulta → Voltar ⇒ ficha; URL direta ⇒ tela-pai.
// Prova complementar em navegador real: `scripts/shots/br-cli-t05-fixwave-voltar.mjs` (workspace).
import React from 'react';
import { Text, Pressable } from 'react-native';
import { renderRouter, screen, fireEvent, waitFor, act } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import AppLayout from '../src/app/(app)/_layout';

jest.mock('react-native-drawer-layout', () => {
  const actual = jest.requireActual('react-native-drawer-layout');
  return {
    ...actual,
    Drawer: ({ children }: { children: React.ReactNode }) => children,
    useDrawerProgress: () => ({ value: 0 }),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      R.createElement(View, { style }, children),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 400, height: 800 }),
    SafeAreaInsetsContext: R.createContext({ top: 0, right: 0, bottom: 0, left: 0 }),
    SafeAreaFrameContext: R.createContext({ x: 0, y: 0, width: 400, height: 800 }),
    initialWindowMetrics: {
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      frame: { x: 0, y: 0, width: 400, height: 800 },
    },
  };
});

// O NavDrawer (conteúdo do menu) não monta: o container visual do Drawer está stubado acima.
jest.mock('@components/layout/NavDrawer', () => ({ NavDrawer: () => null }));

const qc = new QueryClient();

function Layout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <AppLayout />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

const Tela = (nome: string) =>
  function T() {
    return <Text testID={`tela-${nome}`}>{nome}</Text>;
  };

function Lista() {
  return (
    <Pressable testID="abrir-ficha" onPress={() => router.push('/pacientes/7')}>
      <Text>lista</Text>
    </Pressable>
  );
}
function Ficha() {
  return (
    <Pressable testID="abrir-consulta" onPress={() => router.push('/consulta/7')}>
      <Text testID="tela-ficha">ficha</Text>
    </Pressable>
  );
}
function Agenda() {
  return (
    <Pressable testID="abrir-prontuario" onPress={() => router.push('/consulta/7')}>
      <Text testID="tela-agenda">agenda</Text>
    </Pressable>
  );
}

const ROTAS = {
  '(app)/_layout': Layout,
  '(app)/dashboard': Tela('dashboard'),
  '(app)/agenda': Agenda,
  '(app)/luna': Tela('luna'),
  '(app)/settings': Tela('settings'),
  '(app)/pacientes/index': Lista,
  '(app)/pacientes/[id]': Ficha,
  '(app)/consulta/[idPet]': Tela('consulta'),
  '(app)/receituario/[idPet]': Tela('receituario'),
  '(app)/teleorientacao/[idPet]': Tela('teleorientacao'),
};

// `Drawer` mantém as telas visitadas montadas (há 2 Voltar no DOM): o visível é o último.
const voltar = () => {
  const todos = screen.getAllByTestId('app-header-back');
  fireEvent.press(todos[todos.length - 1]!);
};

beforeEach(() => {
  useAuthStore.setState({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
});
afterEach(() => qc.clear());

describe('Voltar com roteador real', () => {
  it.each([
    ['/pacientes/7', '/pacientes'],
    ['/consulta/7', '/pacientes/7'],
    ['/receituario/7', '/pacientes/7'],
    ['/teleorientacao/7', '/pacientes/7'],
  ])('(a) URL direta %s ⇒ Voltar vai para a tela-pai %s', async (url, pai) => {
    const r = renderRouter(ROTAS, { initialUrl: url });
    await waitFor(() => expect(screen.getAllByTestId('app-header-back').length).toBeGreaterThan(0));
    voltar();
    await waitFor(() => expect(r).toHavePathname(pai));
  });

  it('(b) lista → ficha → consulta → Voltar ⇒ ficha; Voltar ⇒ lista', async () => {
    const r = renderRouter(ROTAS, { initialUrl: '/pacientes' });
    fireEvent.press(await screen.findByTestId('abrir-ficha'));
    await waitFor(() => expect(r).toHavePathname('/pacientes/7'));
    fireEvent.press(screen.getByTestId('abrir-consulta'));
    await waitFor(() => expect(r).toHavePathname('/consulta/7'));
    voltar();
    await waitFor(() => expect(r).toHavePathname('/pacientes/7'));
    voltar();
    await waitFor(() => expect(r).toHavePathname('/pacientes'));
  });

  it('(c) agenda → consulta → Voltar ⇒ agenda', async () => {
    const r = renderRouter(ROTAS, { initialUrl: '/agenda' });
    fireEvent.press(await screen.findByTestId('abrir-prontuario'));
    await waitFor(() => expect(r).toHavePathname('/consulta/7'));
    voltar();
    await waitFor(() => expect(r).toHavePathname('/agenda'));
  });
});
