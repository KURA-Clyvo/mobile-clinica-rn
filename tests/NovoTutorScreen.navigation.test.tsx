// REC-03 — G2 fix wave 1 (Critical C-1): o Drawer (`(app)/_layout.tsx`) NÃO desmonta a tela ao
// perder o foco (react-navigation v7 removeu `unmountOnBlur`) — sem o fix (`useFocusEffect` que
// zera `convite`+form no blur, `novo.tsx`), "Voltar" deixava a tela de convite MONTADA com o
// token do tutor anterior, e reentrar em "Novo tutor" reabria aquele QR em vez do formulário
// vazio — impedindo o 2º cadastro da sessão (o fluxo central do estande).
//
// Teste com o ROTEADOR REAL do expo-router (`expo-router/testing-library`, NÃO mocka
// `expo-router` — é exatamente o que faltava nos testes anteriores desta task, G2 `g2-rec03.md`
// §F4) e a TELA REAL (`NovoTutorScreen`), cadeia real de mock (service -> apiClient ->
// mock-adapter -> `tutores.mock.ts`). Base: sonda `g2probe-rec03d.test.tsx` do revisor
// (colada em `g2-rec03.md`), adaptada e mantida aqui como teste PERMANENTE da suíte (não uma
// sonda descartável).
import React from 'react';
import { Text, Pressable } from 'react-native';
import { renderRouter, screen, act, fireEvent, waitFor } from 'expo-router/testing-library';
import { Drawer } from 'expo-router/drawer';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import NovoTutorScreen from '../src/app/(app)/tutores/novo';

// O mock do container VISUAL do Drawer é necessário porque o preset do Reanimated 4 deste
// projeto não expõe `useSharedValue` no ambiente de teste (sem isto: `TypeError: useSharedValue
// is not a function`). O stub NÃO toca `DrawerView.tsx` — que é quem decide montar/desmontar as
// telas (`state.routes.map` + `loaded`) — é exatamente esse mecanismo que este teste exercita.
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

const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

function Layout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <Drawer screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function Pacientes() {
  return (
    <Pressable testID="novo" onPress={() => router.push('/tutores/novo')}>
      <Text>PAC</Text>
    </Pressable>
  );
}

const originalUseMocks = process.env.EXPO_PUBLIC_USE_MOCKS;

afterEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = originalUseMocks;
  jest.clearAllMocks();
  qc.clear();
});

describe('NovoTutorScreen — mordida C-1 (Critical, G2): "Voltar" + reentrar não reabre o tutor anterior', () => {
  it('cadastra -> QR -> Voltar -> reentra em "Novo tutor" => formulário VAZIO, sem QR anterior', async () => {
    process.env.EXPO_PUBLIC_USE_MOCKS = 'true';

    // `getPathname()` (e as demais leituras de rota) vivem no RESULTADO de
    // `renderRouter`, não no `screen` avulso (que é só o `screen` puro do
    // @testing-library/react-native, sem esses métodos — `tsc --noEmit` pega
    // isso mesmo funcionando em runtime sem type-check).
    const routerResult = renderRouter(
      {
        _layout: Layout,
        'pacientes/index': Pacientes,
        'tutores/novo': NovoTutorScreen,
        dashboard: () => <Text>D</Text>,
      },
      { initialUrl: '/pacientes' },
    );

    // 1) entra no formulário
    fireEvent.press(screen.getByTestId('novo'));
    expect(screen.getByTestId('input-nome-tutor')).toBeTruthy();

    // 2) cadastra um tutor de verdade (cadeia real de mock)
    fireEvent.changeText(screen.getByTestId('input-nome-tutor'), 'Ana Beatriz');
    fireEvent.changeText(screen.getByTestId('input-cpf-tutor'), '98765432100');
    fireEvent.changeText(screen.getByTestId('input-email-tutor'), 'ana@example.com');
    fireEvent.changeText(screen.getByTestId('input-telefone-tutor'), '11987654321');
    fireEvent.press(screen.getByTestId('checkbox-aviso-privacidade'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-salvar-tutor'));
    });
    await waitFor(() => expect(screen.getByTestId('convite-qrcode')).toBeTruthy());

    // 3) "Voltar" — m3: vai pra /pacientes explicitamente (não mais /dashboard, que era o
    // backBehavior default do Drawer antes desta fix wave).
    fireEvent.press(screen.getByTestId('btn-voltar-pacientes'));
    expect(routerResult.getPathname()).toBe('/pacientes');

    // 4) reentra em "Novo tutor" — MORDIDA: sem o fix (useFocusEffect zerando convite+form no
    // blur), isto reabriria o QR/token do tutor ANTERIOR em vez de um formulário vazio.
    fireEvent.press(screen.getByTestId('novo'));
    await waitFor(() => expect(screen.queryByTestId('input-nome-tutor')).toBeTruthy());
    expect(screen.queryByTestId('convite-qrcode')).toBeNull();
    expect(screen.getByTestId('input-nome-tutor').props.value).toBe('');
    expect(screen.getByTestId('input-cpf-tutor').props.value).toBe('');
  });
});
