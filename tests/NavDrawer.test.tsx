import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { ThemeProvider } from '../src/theme';
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

const ROUTE_NAMES = ['dashboard', 'agenda', 'pacientes', 'luna', 'settings'] as const;

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
