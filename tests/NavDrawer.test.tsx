import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { render, within } from '@testing-library/react-native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { ThemeProvider, lightColors } from '../src/theme';
import { NavDrawer } from '../src/components/layout/NavDrawer';
import { useAuthStore } from '../src/store/authStore';

// Mock mínimo de `expo-router`: o `Link` real depende de contexto de
// navegação que este teste não monta. O mock aqui NÃO simula navegação —
// só torna o `href` passado pra `<Link asChild>` observável, clonando o
// filho com um prop extra (`accessibilityHint`). Isso é o que permite provar
// a mordida: contra o NavDrawer ANTIGO (sem `<Link>`), esse mock nunca é
// exercitado e o prop nunca aparece; contra o NavDrawer NOVO, aparece com o
// href correto.
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ReactForMock = require('react');
  return {
    Link: ({
      href,
      asChild,
      children,
    }: {
      href: string;
      asChild?: boolean;
      children: React.ReactNode;
    }) => {
      if (asChild && ReactForMock.isValidElement(children)) {
        return ReactForMock.cloneElement(children, {
          accessibilityHint: `href:${href}`,
        });
      }
      return ReactForMock.createElement(ReactForMock.Fragment, null, children);
    },
  };
});

// Fix wave pós-G2 da CQ-05 (dev VsClaude, KURA_BACKLOG_CLINICA_1), item 1:
// "pacientes/index" é o nome REAL registrado pelo expo-router para esta tela
// (confirmado por `getMockConfig('src/app')`, ver
// `discoverRealAppRouteNames.ts`), não "pacientes" — o arquivo de rota vive
// em `src/app/(app)/pacientes/index.tsx`, sem `_layout.tsx` dentro da pasta.
// Usar o nome real aqui é o que prova a mordida: contra `NavDrawer.tsx`
// ANTES do fix (`isActive = activeRouteName === item.name`, sem
// `routeName`), o item "Pacientes" nunca receberia `isActive=true` neste
// teste, porque `state.routes[].name` real nunca é "pacientes".
const ROUTE_NAMES = ['dashboard', 'agenda', 'pacientes/index', 'luna', 'settings'] as const;

function makeDrawerState(index: number): DrawerContentComponentProps['state'] {
  return {
    index,
    routes: ROUTE_NAMES.map((name) => ({ key: name, name })),
  } as unknown as DrawerContentComponentProps['state'];
}

const navigationMock = {
  navigate: jest.fn(),
  toggleDrawer: jest.fn(),
} as unknown as DrawerContentComponentProps['navigation'];

function wrap(index: number) {
  return render(
    <ThemeProvider>
      <NavDrawer
        state={makeDrawerState(index)}
        navigation={navigationMock}
        descriptors={{} as DrawerContentComponentProps['descriptors']}
      />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ token: null, expiresAt: null, usuario: null });
});

describe('NavDrawer — navegação tipada via <Link> (CQ-03)', () => {
  it.each([
    ['dashboard', '/dashboard'],
    ['agenda', '/agenda'],
    ['pacientes', '/pacientes'],
    ['luna', '/luna'],
    ['settings', '/settings'],
  ])('item "%s" está envolvido por <Link href="%s" asChild>', (name, expectedHref) => {
    const { getByTestId } = wrap(0);
    const item = getByTestId(`nav-item-${name}`);
    // Contra o código antigo (TouchableOpacity + navigation.navigate(item.name),
    // sem <Link>), este prop nunca é setado — a asserção falha com `undefined`.
    // Contra o código novo, o mock de Link acima injeta o href real.
    expect(item.props.accessibilityHint).toBe(`href:${expectedHref}`);
  });

  it('mantém o realce do item ativo (backgroundColor) baseado em state.routes[index].name, não no href', () => {
    // pacientes é o índice 2 em ROUTE_NAMES
    const { getByTestId } = wrap(2);

    const active = getByTestId('nav-item-pacientes');
    const inactive = getByTestId('nav-item-dashboard');

    // StyleSheet.flatten resolve arrays (inclusive aninhados, como o wrapper
    // de opacidade que TouchableOpacity injeta) num único objeto — mais
    // robusto do que inspecionar a forma bruta do array de estilo, que muda
    // conforme o componente por baixo (TouchableOpacity × Pressable).
    const activeFlat = StyleSheet.flatten(active.props.style);
    const inactiveFlat = StyleSheet.flatten(inactive.props.style);

    // O item ativo recebe navItemActive (backgroundColor definido); o
    // inativo não — essa distinção não pode colapsar com a troca de
    // TouchableOpacity por Pressable+Link (M2).
    expect(activeFlat.backgroundColor).toBeTruthy();
    expect(inactiveFlat.backgroundColor).toBeFalsy();
    expect(activeFlat.backgroundColor).not.toBe(inactiveFlat.backgroundColor);
  });

  it('troca de item ativo quando o índice do estado muda', () => {
    const { getByTestId: getByTestIdIdx0 } = wrap(0); // dashboard é o ativo
    const dashboardWhenActive = StyleSheet.flatten(
      getByTestIdIdx0('nav-item-dashboard').props.style,
    );
    const settingsWhenInactive = StyleSheet.flatten(
      getByTestIdIdx0('nav-item-settings').props.style,
    );
    expect(dashboardWhenActive.backgroundColor).toBeTruthy();
    expect(settingsWhenInactive.backgroundColor).toBeFalsy();

    const { getByTestId: getByTestIdIdx4 } = wrap(4); // settings é o ativo agora
    const dashboardWhenInactive = StyleSheet.flatten(
      getByTestIdIdx4('nav-item-dashboard').props.style,
    );
    const settingsWhenActive = StyleSheet.flatten(getByTestIdIdx4('nav-item-settings').props.style);
    expect(dashboardWhenInactive.backgroundColor).toBeFalsy();
    expect(settingsWhenActive.backgroundColor).toBeTruthy();
  });
});

describe('NavDrawer — marca canônica em knockout (CQ-12)', () => {
  it('renderiza o KuraMark (aria-label "Kura mark") no header, não o ícone de pata antigo', () => {
    const { getAllByTestId } = wrap(0);
    // `react-native-svg` é mockado (jest.config.js) e tanto `KuraMark`
    // quanto o antigo `KCIcon name="paw"` renderizam um elemento com
    // testID "Svg" — o `aria-label="Kura mark"` (só o KuraMark declara) é
    // o que distingue os dois de verdade. Contra o NavDrawer ANTES do fix
    // (`<KCIcon name="paw" .../>`, sem `aria-label`), nenhum "Svg" carrega
    // esse label e este `find` devolve `undefined`.
    const svgs = getAllByTestId('Svg');
    const mark = svgs.find((svg) => svg.props['aria-label'] === 'Kura mark');
    expect(mark).toBeDefined();
  });

  it('usa colors.textOnPrimary (knockout) para o KuraMark do header, não colors.primary', () => {
    const { getAllByTestId } = wrap(0);
    const svgs = getAllByTestId('Svg');
    const mark = svgs.find((svg) => svg.props['aria-label'] === 'Kura mark');
    if (!mark) throw new Error('KuraMark não encontrado no header');

    // O fundo do header é colors.primary (ocean) — ver `styles.header` em
    // NavDrawer.tsx, `borderBottomColor: colors.primarySoft` no mesmo tom.
    // Mark sobre fundo da mesma cor violaria contraste mínimo 4.5:1 (ruling
    // D-3). `lightColors.textOnPrimary` e `lightColors.primary` têm valores
    // diferentes no tema claro, então mutar o `color` passado ao KuraMark de
    // volta para `colors.primary` faz esta asserção falhar (v12).
    expect(lightColors.textOnPrimary).not.toBe(lightColors.primary);
    const circles = within(mark).getAllByTestId('Circle');
    expect(circles).toHaveLength(3);
    circles.forEach((circle) => {
      expect(circle.props.fill).toBe(lightColors.textOnPrimary);
    });
  });

  it('preserva a proporção 5:6 do KuraMark no header (width 32 → height 38.4)', () => {
    const { getAllByTestId } = wrap(0);
    const svgs = getAllByTestId('Svg');
    const mark = svgs.find((svg) => svg.props['aria-label'] === 'Kura mark');
    expect(mark?.props.width).toBe(32);
    expect(mark?.props.height).toBeCloseTo(32 * (48 / 40));
  });
});

// CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — fix wave 2a, Achado 4 da
// revisão G2: o role "menu" do `ScrollView`/"menuitem" de cada item nunca
// tinham asserção — reproduzido pela G2: remover `accessibilityRole="menu"`
// do `NavDrawer` passava 38/38, e o `menuitem` dos itens também nunca foi
// checado. O role foi adicionado pela própria CQ-08 (item 2 do Escopo 3,
// achado parqueado da G2 da CQ-03) e só tinha sido verificado à mão.
//
// `getByRole`/`getAllByRole` do RNTL não reconhecem 'menu'/'menuitem' como
// role consultável (medido: `getByRole('menu')` lança "no elements found",
// mesmo com o elemento presente na árvore) — por isso a leitura é direto na
// prop `accessibilityRole` do elemento (mesmo padrão já usado por este
// arquivo para `backgroundColor`, linha ~106).
describe('NavDrawer — role de menu/menuitem (CQ-08, achado 4 da G2)', () => {
  it('o contêiner de navegação (ScrollView) carrega accessibilityRole="menu"', () => {
    const { UNSAFE_getByType } = wrap(0);
    expect(UNSAFE_getByType(ScrollView).props.accessibilityRole).toBe('menu');
  });

  it.each(ROUTE_NAMES.map((name) => name.replace('/index', '')))(
    'o item de navegação "%s" carrega accessibilityRole="menuitem"',
    (name) => {
      const { getByTestId } = wrap(0);
      expect(getByTestId(`nav-item-${name}`).props.accessibilityRole).toBe('menuitem');
    },
  );
});

// ─── FM-01 — identidade no rodapé, com e sem ficha de veterinário ──────────
//
// 🔴 O sítio mais grave dos 7 da varredura. Antes desta task o rodapé inteiro
// — nome, CRMV **e o botão de sair** — só renderizava quando `usuario` (a
// FICHA de veterinário) existia. Um GESTOR sem vínculo, que é um login
// perfeitamente legítimo desde a FD-03, ficava:
//
//   1. sem o próprio nome em lugar NENHUM do app, e
//   2. **sem jeito de sair pelo drawer.**
//
// ⚠️ Este estado NÃO ocorre subindo o app: `RegisterClinicaAsync:296-308`
// cria o gestor COM vínculo, então o login de demonstração sempre traz
// `usuario` preenchido. Só existe construído — e é por isso que precisa de
// teste, não de inspeção visual.
describe('NavDrawer — identidade do rodapé (FM-01)', () => {
  const SESSAO_BASE = {
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  };

  it('COM ficha: mostra o nome e o CRMV do veterinário', () => {
    useAuthStore.setState({
      ...SESSAO_BASE,
      email: 'felipe@kuraclinica.com.br',
      tpPerfil: 'VETERINARIO',
      usuario: {
        id: 1,
        nmVeterinario: 'Dr. Felipe Ferrete',
        nrCRMV: 'SP-12345',
        dsEmail: 'felipe@kuraclinica.com.br',
      },
    });
    const { getByTestId } = wrap(0);

    expect(getByTestId('nav-drawer-user-primary').props.children).toBe('Dr. Felipe Ferrete');
    expect(getByTestId('nav-drawer-user-secondary').props.children).toBe('SP-12345');
  });

  it('SEM ficha (GESTOR): degrada para e-mail + papel, em vez de sumir', () => {
    useAuthStore.setState({
      ...SESSAO_BASE,
      email: 'gestor@kuraclinica.com.br',
      tpPerfil: 'GESTOR',
      usuario: null,
    });
    const { getByTestId } = wrap(0);

    expect(getByTestId('nav-drawer-user-primary').props.children).toBe('gestor@kuraclinica.com.br');
    expect(getByTestId('nav-drawer-user-secondary').props.children).toBe('Gestor');
  });

  // 🔴 A mordida que mais importa das três: sem ficha, o gestor precisa
  // conseguir SAIR. O gate antigo (`{usuario && ...}`) levava o botão de
  // logout junto com o bloco de identidade.
  it('SEM ficha (GESTOR): o botão de sair continua existindo', () => {
    useAuthStore.setState({
      ...SESSAO_BASE,
      email: 'gestor@kuraclinica.com.br',
      tpPerfil: 'GESTOR',
      usuario: null,
    });
    const { getByTestId } = wrap(0);

    expect(getByTestId('nav-drawer-logout')).toBeTruthy();
  });

  // Controle negativo: sem sessão nenhuma o rodapé NÃO aparece. Sem isto,
  // os três acima seriam compatíveis com "o rodapé sempre renderiza".
  it('CONTROLE — sem sessão, o rodapé não renderiza', () => {
    useAuthStore.setState({
      token: null,
      expiresAt: null,
      email: null,
      tpPerfil: null,
      usuario: null,
    });
    const { queryByTestId } = wrap(0);

    expect(queryByTestId('nav-drawer-logout')).toBeNull();
    expect(queryByTestId('nav-drawer-user-primary')).toBeNull();
  });
});
