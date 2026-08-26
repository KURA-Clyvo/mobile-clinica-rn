// CQ-05 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — shell adaptativo: sidebar
// permanente em tela larga.
//
// Objetivo do backlog, literal: abaixo de `md` o drawer overlay continua
// sendo o padrão certo; em desktop (`>= lg`) o drawer deve virar sidebar
// PERMANENTE, porque a navegação primária (5 itens) cabe na tela sem
// precisar esconder atrás de um toque. `AppHeader` esconde o botão de menu
// quando a sidebar é permanente (botão que abre o que já está aberto é
// ruído).
//
// PROVA DE MORDIDA: contra o `_layout.tsx` de `main` (`a6a7af4`, o layout é
// incondicional — nunca lê breakpoint nenhum), TODOS os testes abaixo que
// esperam `drawerType: 'permanent'` em >=1024px e ausência do botão de menu
// falham, porque a implementação atual sempre passa `screenOptions={{
// headerShown: false }}` (sem `drawerType`, então o Drawer usa o default de
// plataforma — `front` em qualquer largura) e `AppHeader` sempre renderiza o
// botão `app-header-menu`, incondicionalmente.
//
// COMO É MEDIDO (regra v11/v12 deste ciclo): `react-test-renderer` não
// computa layout Yoga (não dá pra medir px calculado), mas `toJSON()` ecoa
// o `style`/prop declarado. Duas camadas de prova:
//
//   1) `resolveDrawerType` — a função pura exportada de `_layout.tsx` que
//      decide o breakpoint — testada direto, sem precisar montar árvore
//      nenhuma. É aqui que a mutação dirigida ao critério ('lg' -> 'xl'/'md')
//      é mais precisa: cobre TODA a fronteira (768/1023/1024/1280/1440),
//      não só os 3 viewports do G4r.
//   2) Render do `AppLayout` inteiro, com `expo-router/drawer` mockado (o
//      `<Drawer>` real precisa do contexto de roteamento do expo-router, que
//      não existe fora do app rodando de verdade — confirmado por spike:
//      montar `<Drawer>` real neste ambiente de teste lança "No filename
//      found. This is likely a bug in expo-router." antes mesmo de
//      qualquer asserção rodar). O mock captura o `screenOptions` passado
//      ao `<Drawer>` (para inspecionar `drawerType`) e renderiza a saída de
//      `options.header({ navigation })` de cada `<Drawer.Screen>` declarado,
//      permitindo consultar a árvore real do `AppHeader` (incl.
//      `queryAllByTestId('app-header-menu')`) nos 3 viewports exigidos pelo
//      G4r: 360 (mobile), 768 (tablet retrato — o caso "não é óbvio" que o
//      brief marca como decisão de produto, não de implementação; aqui
//      exercitamos literalmente o que o backlog manda hoje, `>= lg`) e 1440
//      (desktop).
import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { useOnboardingStore } from '../src/store/onboardingStore';
import { breakpoints } from '../src/theme/tokens';
import type { BreakpointKey } from '../src/theme/tokens';

const mockPush = jest.fn();
// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1): `_layout.tsx` passou a usar
// `usePathname()` (item 2, rastreio de visita de rota do checklist de
// ativação) — sem este mock, `usePathname` seria `undefined` no módulo
// mockado abaixo e a chamada em `_layout.tsx` lançaria "is not a function"
// antes de qualquer asserção deste arquivo rodar. `jest.fn()` (não uma seta
// fixa) porque a describe nova no fim deste arquivo ("rastreio de
// onboarding") precisa trocar o valor por teste; os describes PRÉ-EXISTENTES
// acima não dependem do pathname — o default '/dashboard' preserva o
// comportamento anterior deles.
const mockUsePathname = jest.fn(() => '/dashboard');
jest.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockUsePathname(),
}));

// Captura o `screenOptions` recebido pelo `<Drawer>` real (não dá pra montar
// o `<Drawer>` de verdade neste ambiente — ver comentário de topo) e
// renderiza a saída de `options.header({ navigation })` de cada
// `<Drawer.Screen>` para inspeção via testing-library, exatamente como o
// `expo-router/drawer` real faria para a tela ativa (aqui, todas de uma vez —
// suficiente para contar botões de menu por viewport).
const mockScreenOptionsSpy = jest.fn();
jest.mock('expo-router/drawer', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  const Drawer = ({ children, screenOptions }: { children: React.ReactNode; screenOptions: unknown }) => {
    mockScreenOptionsSpy(screenOptions);
    return ReactLocal.createElement(View, { testID: 'mock-drawer' }, children);
  };
  Drawer.Screen = ({
    name,
    options,
  }: {
    name: string;
    options?: { header?: (props: { navigation: { toggleDrawer: () => void } }) => React.ReactNode };
  }) => {
    const navigation = { toggleDrawer: jest.fn() };
    const header = options?.header ? options.header({ navigation }) : null;
    return ReactLocal.createElement(View, { testID: `mock-drawer-screen-${name}` }, header);
  };
  return { Drawer };
});

// Mesmo padrão de tests/useBreakpoint.test.ts e tests/DashboardScreen.test.tsx:
// mockar o módulo interno que useWindowDimensions() consome, não
// 'react-native' inteiro.
const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));
function setViewport(width: number, height: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

// Import DEPOIS dos jest.mock acima (hoisted de qualquer forma pelo babel,
// mas mantido nesta ordem por clareza de leitura).
import AppLayout, { resolveDrawerType } from '../src/app/(app)/_layout';

const MOCK_VET = {
  id: 1,
  nmVeterinario: 'Dr. Felipe Ferrete',
  nrCRMV: 'SP-12345',
  dsEmail: 'felipe@kuraclinica.com.br',
};

beforeEach(() => {
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    usuario: MOCK_VET,
  });
  jest.clearAllMocks();
  setViewport(400, 800);
  // `clearAllMocks()` limpa histórico de chamada, NÃO desfaz um
  // `.mockReturnValue()` anterior — reafirma o default aqui pra nenhum
  // teste da describe nova (CQ-13, "rastreio de onboarding", fim do
  // arquivo) vazar pathname pros describes pré-existentes acima.
  mockUsePathname.mockReturnValue('/dashboard');
});

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function isAtLeastForWidth(width: number) {
  return (key: BreakpointKey) => width >= breakpoints[key];
}

describe('resolveDrawerType — critério de breakpoint (mutação dirigida)', () => {
  // Cobre TODA a fronteira, não só os 3 viewports do G4r — é o que permite
  // pegar tanto 'lg' -> 'md' (fronteira 768/1023) quanto 'lg' -> 'xl'
  // (fronteira 1024/1280, abaixo de 1440) com precisão.
  const CASES: { label: string; width: number; expected: 'permanent' | 'front' }[] = [
    { label: '360 (sm, mobile)', width: 360, expected: 'front' },
    { label: '768 (md, tablet retrato — fronteira, decisão de produto)', width: 768, expected: 'front' },
    { label: '1023 (md, 1px abaixo de lg)', width: 1023, expected: 'front' },
    { label: '1024 (lg, fronteira exata)', width: 1024, expected: 'permanent' },
    { label: '1280 (lg, notebook real)', width: 1280, expected: 'permanent' },
    { label: '1440 (xl, desktop)', width: 1440, expected: 'permanent' },
  ];

  it.each(CASES)('resolve para $expected em $label', ({ width, expected }) => {
    expect(resolveDrawerType(isAtLeastForWidth(width))).toBe(expected);
  });
});

describe('AppLayout — sidebar adaptativa (G4r, 3 viewports)', () => {
  const VIEWPORTS: {
    label: string;
    width: number;
    height: number;
    expectedDrawerType: 'permanent' | 'front';
    expectMenuButton: boolean;
  }[] = [
    { label: '360×640 (mobile)', width: 360, height: 640, expectedDrawerType: 'front', expectMenuButton: true },
    {
      label: '768×1024 (tablet retrato, intermediário)',
      width: 768,
      height: 1024,
      expectedDrawerType: 'front',
      expectMenuButton: true,
    },
    { label: '1440×900 (desktop)', width: 1440, height: 900, expectedDrawerType: 'permanent', expectMenuButton: false },
  ];

  it.each(VIEWPORTS)(
    'drawerType=$expectedDrawerType e botão de menu presente=$expectMenuButton em $label',
    ({ width, height, expectedDrawerType, expectMenuButton }) => {
      setViewport(width, height);
      const { queryAllByTestId } = wrap(<AppLayout />);

      expect(mockScreenOptionsSpy).toHaveBeenCalled();
      const lastScreenOptions = mockScreenOptionsSpy.mock.calls.at(-1)?.[0];
      expect(lastScreenOptions).toMatchObject({ drawerType: expectedDrawerType });

      const menuButtons = queryAllByTestId('app-header-menu');
      if (expectMenuButton) {
        // As 5 telas declaradas em _layout.tsx renderizam o header, todas de
        // uma vez neste mock (o Drawer real só ativa uma por vez) — o que
        // importa aqui é que NENHUM header esconde o botão quando deveria
        // aparecer.
        expect(menuButtons.length).toBe(5);
      } else {
        expect(menuButtons.length).toBe(0);
      }
    },
  );

  it('não muda a quantidade de headers renderizados entre viewports (drawerType não derruba tela)', () => {
    setViewport(1440, 900);
    const { queryAllByTestId: queryDesktop } = wrap(<AppLayout />);
    const desktopHeaders = queryDesktop('app-header-search').length;

    setViewport(360, 640);
    const { queryAllByTestId: queryMobile } = wrap(<AppLayout />);
    const mobileHeaders = queryMobile('app-header-search').length;

    expect(desktopHeaders).toBe(5);
    expect(mobileHeaders).toBe(5);
  });
});

describe('AppLayout — alcançabilidade de rotas fora do drawer', () => {
  // As 4 rotas citadas pelo critério de aceite (`consulta/[idPet]`,
  // `pacientes/[id]`, `receituario/[idPet]`, `teleorientacao/[idPet]`) NÃO
  // são declaradas como `<Drawer.Screen>` em _layout.tsx (só dashboard,
  // agenda, pacientes, luna, settings são) — são arquivos-irmãos dentro do
  // MESMO grupo `(app)/`, alcançados por `router.push` de dentro de outras
  // telas (ver src/constants/routes.ts: `pacienteDetalhe`, `consulta`,
  // `teleorientacao`, `receituario`), não pelo drawer.
  //
  // `drawerType` é propriedade PURAMENTE apresentacional do navigator
  // (@react-navigation/drawer, node_modules/@react-navigation/drawer/lib/
  // typescript/src/types.d.ts:108-117: "It determines how the drawer looks
  // and animates" — front/back/slide/permanent) — não é uma allowlist de
  // telas, não remove nem "desregistra" rota nenhuma do navigator. Nosso
  // diff desta task só escreve em `screenOptions.drawerType` (default do
  // navigator inteiro) e não toca em nenhum arquivo de rota, `router.push`
  // ou `ROUTES.app`, então a superfície que poderia derrubar essas 4 rotas
  // simplesmente não foi tocada.
  //
  // Limite desta verificação, declarado (ver task-CQ-05-report.md): montar o
  // `<Drawer>` REAL deste projeto neste ambiente de teste não é viável (ver
  // spike no comentário de topo — falta contexto de roteamento do
  // expo-router fora do app rodando de verdade), então esta suíte prova (a)
  // por leitura de fonte que as 4 rotas existem como arquivo dentro do mesmo
  // grupo, (b) por leitura da definição de tipo do pacote que `drawerType`
  // é presentational-only, e (c) que o diff desta task não toca nada além de
  // `screenOptions`/`AppHeader`. Comportamento real do Drawer.Navigator em
  // runtime (app rodando/web) não foi exercitado por este teste.
  it('as 4 rotas fora do drawer existem como arquivo dentro do grupo (app)/, não como Drawer.Screen', () => {
    const fs = require('fs');
    const path = require('path');
    const appDir = path.join(__dirname, '..', 'src', 'app', '(app)');

    const arquivosEsperados = [
      'consulta/[idPet].tsx',
      'pacientes/[id].tsx',
      'receituario/[idPet].tsx',
      'teleorientacao/[idPet].tsx',
    ];

    arquivosEsperados.forEach((rel) => {
      const p = path.join(appDir, rel);
      expect(fs.existsSync(p)).toBe(true);
    });
  });

  it('drawerType é propriedade presentational do @react-navigation/drawer, não uma allowlist de telas', () => {
    const fs = require('fs');
    const path = require('path');
    // .d.ts não é resolvível via `require.resolve` (não é módulo executável) —
    // caminho montado direto a partir de node_modules, mesma técnica usada
    // acima para os arquivos de rota.
    const typesPath = path.join(
      __dirname,
      '..',
      'node_modules',
      '@react-navigation',
      'drawer',
      'lib',
      'typescript',
      'src',
      'types.d.ts',
    );
    expect(fs.existsSync(typesPath)).toBe(true);
    const texto = fs.readFileSync(typesPath, 'utf-8');

    expect(texto).toMatch(/drawerType\?:\s*'front'\s*\|\s*'back'\s*\|\s*'slide'\s*\|\s*'permanent'/);
    expect(texto).toMatch(/how the drawer looks and animates/);
  });
});

// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1), item 2 — "como um passo é
// marcado como concluído": AUTOMÁTICO, ao visitar a rota, observado num
// ÚNICO PONTO (`usePathname()` em `_layout.tsx`). Critério de aceite
// literal do gate: "visitar uma rota marca o passo correspondente".
describe('AppLayout — rastreio de visita de rota do onboarding (CQ-13, item 2)', () => {
  beforeEach(() => {
    useOnboardingStore.setState({ completedSteps: [], dismissed: false, _hasHydrated: true });
  });

  it.each([
    ['/agenda', 'agenda'],
    ['/pacientes', 'pacientes'],
    ['/luna', 'luna'],
    ['/settings', 'settings'],
  ])('visitar %s marca o passo "%s" como concluído', (pathname, expectedStep) => {
    mockUsePathname.mockReturnValue(pathname);
    wrap(<AppLayout />);
    expect(useOnboardingStore.getState().completedSteps).toContain(expectedStep);
  });

  it('visitar uma rota fora dos 4 passos (ex.: /dashboard) não marca passo nenhum', () => {
    mockUsePathname.mockReturnValue('/dashboard');
    wrap(<AppLayout />);
    expect(useOnboardingStore.getState().completedSteps).toEqual([]);
  });

  it('remontar na mesma rota não duplica o passo na lista (markStepCompleted é idempotente)', () => {
    mockUsePathname.mockReturnValue('/luna');
    const { unmount } = wrap(<AppLayout />);
    unmount();
    wrap(<AppLayout />);
    expect(useOnboardingStore.getState().completedSteps).toEqual(['luna']);
  });
});
