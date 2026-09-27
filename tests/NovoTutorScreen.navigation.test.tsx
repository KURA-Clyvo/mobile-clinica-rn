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
import { Text, Pressable, Alert } from 'react-native';
import { renderRouter, screen, act, fireEvent, waitFor } from 'expo-router/testing-library';
import { Drawer } from 'expo-router/drawer';
import { router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import NovoTutorScreen from '../src/app/(app)/tutores/novo';
import { __resetTutoresParaTeste } from '../src/mocks/tutores.mock';

// G2b (m8) — mock PARCIAL de tutores.service.ts: delega pra implementação REAL
// (`jest.requireActual`, cadeia real de mock por baixo) SEMPRE, exceto quando
// `mockSegurar` está ligado — aí a promise de `criarTutor` fica "em voo" até o
// teste mandar resolver (`mockDeferred.resolve()`), simulando rede lenta. Não
// afeta os outros describes deste arquivo (`mockSegurar` nasce `false`).
let mockDeferred: { resolve: () => void } | null = null;
let mockSegurar = false;
jest.mock('../src/services/tutores.service', () => {
  const actual = jest.requireActual('../src/services/tutores.service');
  return {
    ...actual,
    criarTutor: (input: unknown) => {
      if (!mockSegurar) return actual.criarTutor(input);
      return new Promise((resolve) => {
        mockDeferred = {
          resolve: () =>
            resolve(
              actual.criarTutor(input).then((r: unknown) => {
                (globalThis as { mockDone?: boolean }).mockDone = true;
                return r;
              }),
            ),
        };
      });
    },
  };
});

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

beforeEach(() => {
  __resetTutoresParaTeste();
  mockSegurar = false;
  mockDeferred = null;
  (globalThis as { mockDone?: boolean }).mockDone = false;
});

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

// G2b (m8, Minor — resto do C-1 por corrida): o `useFocusEffect` só limpa o estado NO MOMENTO
// do blur — se a mutação de `criarTutor` ainda está EM VOO quando o operador sai pela sidebar
// (não pelo botão "Voltar" da própria tela) e a resposta chega DEPOIS, com a tela já fora de
// foco, o `onSuccess` antigo chamava `setConvite(resultado)` incondicionalmente e reabria o
// QR/token na reentrada. Base: sonda `g2bprobe-nav.test.tsx` do revisor (S4/S5, colada em
// `g2b-rec03.md`), adaptada e mantida aqui como teste PERMANENTE.
function montarComAgenda() {
  process.env.EXPO_PUBLIC_USE_MOCKS = 'true';
  return renderRouter(
    {
      _layout: Layout,
      'pacientes/index': Pacientes,
      'tutores/novo': NovoTutorScreen,
      dashboard: () => <Text>D</Text>,
      agenda: () => <Text testID="agenda">A</Text>,
    },
    { initialUrl: '/pacientes' },
  );
}

async function preencherESalvar(cpf = '98765432100') {
  fireEvent.changeText(screen.getByTestId('input-nome-tutor'), 'Ana Beatriz');
  fireEvent.changeText(screen.getByTestId('input-cpf-tutor'), cpf);
  fireEvent.changeText(screen.getByTestId('input-email-tutor'), 'ana@example.com');
  fireEvent.changeText(screen.getByTestId('input-telefone-tutor'), '11987654321');
  fireEvent.press(screen.getByTestId('checkbox-aviso-privacidade'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('btn-salvar-tutor'));
  });
}

describe('NovoTutorScreen — mordida m8 (Minor, G2b): sucesso fora de foco não repõe o convite', () => {
  it('mutação em voo -> sai pelo menu (sem "Voltar") -> resposta chega com a tela oculta -> reentra: SEM QR', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    montarComAgenda();
    fireEvent.press(screen.getByTestId('novo'));

    mockSegurar = true;
    await preencherESalvar();
    // A mutação está presa em `mockDeferred` — nada respondeu ainda.
    expect(mockDeferred).not.toBeNull();

    // Sai pela SIDEBAR (não pelo botão "Voltar" da própria tela) — mesma ação que o item do
    // NavDrawer dispara (`router.navigate`, não `router.push`/`back`).
    act(() => {
      router.navigate('/agenda');
    });

    // AGORA a resposta chega, com a tela de "Novo tutor" fora de foco.
    await act(async () => {
      mockDeferred?.resolve();
    });
    await waitFor(() => expect((globalThis as { mockDone?: boolean }).mockDone).toBe(true));
    // Drena a fila de microtasks do onSuccess (setState fora de act do RN não tem outro sinal).
    await act(async () => {
      for (let i = 0; i < 50; i++) await Promise.resolve();
    });

    // Reentra em "Novo tutor" — MORDIDA: sem a checagem de foco no onSuccess, o convite do
    // tutor que acabou de ser salvo reaparece aqui (QR do tutor "fantasma").
    act(() => {
      router.navigate('/pacientes');
    });
    fireEvent.press(screen.getByTestId('novo'));
    await act(async () => {
      for (let i = 0; i < 50; i++) await Promise.resolve();
    });

    expect(screen.queryByTestId('convite-qrcode')).toBeNull();
    expect(screen.getByTestId('input-nome-tutor')).toBeTruthy();
  });

  it('CONTROLE POSITIVO — a mesma mutação em voo, resolvida SEM sair da tela, mostra o QR normalmente', async () => {
    montarComAgenda();
    fireEvent.press(screen.getByTestId('novo'));

    mockSegurar = true;
    await preencherESalvar();
    mockSegurar = false;

    await act(async () => {
      mockDeferred?.resolve();
    });
    await waitFor(() => expect((globalThis as { mockDone?: boolean }).mockDone).toBe(true));
    await act(async () => {
      for (let i = 0; i < 50; i++) await Promise.resolve();
    });

    // Prova que o instrumento ENXERGA o onSuccess chegando: sem sair da tela, o QR aparece.
    expect(screen.queryByTestId('convite-qrcode')).toBeTruthy();
  });
});
