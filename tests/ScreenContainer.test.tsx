import React from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { ScreenContainer } from '../src/components/primitives/ScreenContainer';
import { breakpoints, layout, spacing } from '../src/theme/tokens';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({
      children,
      style,
      edges,
    }: {
      children: React.ReactNode;
      style?: unknown;
      edges?: unknown;
    }) => React.createElement(View, { style, edges, testID: 'mock-safe-area-view' }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// useWindowDimensions é o que useBreakpoint() consome (nunca Dimensions.get(),
// que não re-renderiza em resize de janela na web). Mockamos o módulo interno
// específico (não 'react-native' inteiro — 'react-native/index.js' expõe suas
// exports via getters lazy, e espalhar {...requireActual('react-native')}
// força a avaliação de todos eles, incluindo módulos nativos como DevMenu que
// não existem neste ambiente de teste e derrubam a suíte inteira).
const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

function setViewport(width: number, height: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  setViewport(400, 800);
});

describe('ScreenContainer', () => {
  it('renders children', () => {
    const { getByText } = wrap(
      <ScreenContainer><Text>Hello World</Text></ScreenContainer>,
    );
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('renders ScrollView when scroll=true (default)', () => {
    const { UNSAFE_getByType } = wrap(
      <ScreenContainer><Text>Scrollable</Text></ScreenContainer>,
    );
    expect(UNSAFE_getByType(ScrollView)).toBeTruthy();
  });

  it('does NOT render ScrollView when scroll=false', () => {
    const { UNSAFE_queryByType } = wrap(
      <ScreenContainer scroll={false}><Text>Flat</Text></ScreenContainer>,
    );
    expect(UNSAFE_queryByType(ScrollView)).toBeNull();
  });

  it('passes refreshControl to ScrollView', () => {
    const mockRefreshControl = <Text testID="refresh-control">Refresh</Text>;
    const { getByTestId } = wrap(
      <ScreenContainer refreshControl={mockRefreshControl}>
        <Text>Content</Text>
      </ScreenContainer>,
    );
    expect(getByTestId('refresh-control')).toBeTruthy();
  });

  it('refreshControl is ignored when scroll=false', () => {
    const mockRefreshControl = <Text testID="refresh-ignored">Refresh</Text>;
    const { queryByTestId } = wrap(
      <ScreenContainer scroll={false} refreshControl={mockRefreshControl}>
        <Text>Content</Text>
      </ScreenContainer>,
    );
    expect(queryByTestId('refresh-ignored')).toBeNull();
  });

  it('accepts custom paddingHorizontal', () => {
    expect(() =>
      wrap(
        <ScreenContainer paddingHorizontal={24}><Text>Padded</Text></ScreenContainer>,
      ),
    ).not.toThrow();
  });
});

// CQ-04: prova de mordida — falha contra o ScreenContainer sem limite de
// largura (o `maxWidth` não existe hoje), passa depois da implementação.
describe('ScreenContainer — responsive (CQ-04)', () => {
  const VIEWPORTS = [
    { label: '360×640 (mobile)', width: 360, height: 640, expectedBreakpoint: 'sm' as const },
    { label: '768×1024 (tablet)', width: 768, height: 1024, expectedBreakpoint: 'md' as const },
    { label: '1440×900 (desktop)', width: 1440, height: 900, expectedBreakpoint: 'xl' as const },
  ];

  it.each(VIEWPORTS)(
    'never exceeds layout.maxContentWidth at $label',
    ({ width, height }) => {
      setViewport(width, height);
      const { getByTestId } = wrap(
        <ScreenContainer><Text>Content</Text></ScreenContainer>,
      );
      const inner = getByTestId('screen-container-content');
      const flatStyle = StyleSheet.flatten(inner.props.style) as { maxWidth?: number };
      expect(flatStyle.maxWidth).toBe(layout.maxContentWidth);
      // Sanity: o valor nunca pode ser maior que a própria largura do viewport
      // teórico xl declarado em tokens.ts — se alguém aumentar maxContentWidth
      // acima do breakpoint xl, o conteúdo voltaria a esticar de borda a borda
      // em qualquer monitor plausível.
      expect(flatStyle.maxWidth).toBeLessThanOrEqual(breakpoints.xl);
    },
  );

  it.each(VIEWPORTS)(
    'centers content horizontally at $label',
    ({ width, height }) => {
      setViewport(width, height);
      const { getByTestId } = wrap(
        <ScreenContainer><Text>Content</Text></ScreenContainer>,
      );
      const inner = getByTestId('screen-container-content');
      const flatStyle = StyleSheet.flatten(inner.props.style) as { alignSelf?: string };
      expect(flatStyle.alignSelf).toBe('center');
    },
  );

  it('applies a smaller default paddingHorizontal at 360×640 (sm) than at 1440×900 (xl)', () => {
    setViewport(360, 640);
    const smResult = wrap(<ScreenContainer><Text>Content</Text></ScreenContainer>);
    const smStyle = StyleSheet.flatten(
      smResult.getByTestId('screen-container-content').props.style,
    ) as { paddingHorizontal?: number };
    smResult.unmount();

    setViewport(1440, 900);
    const xlResult = wrap(<ScreenContainer><Text>Content</Text></ScreenContainer>);
    const xlStyle = StyleSheet.flatten(
      xlResult.getByTestId('screen-container-content').props.style,
    ) as { paddingHorizontal?: number };

    expect(smStyle.paddingHorizontal).toBe(spacing[4]);
    expect(xlStyle.paddingHorizontal).toBe(spacing[8]);
    expect(smStyle.paddingHorizontal).toBeLessThan(xlStyle.paddingHorizontal as number);
  });

  it('explicit paddingHorizontal prop still overrides the responsive default at any viewport', () => {
    setViewport(1440, 900);
    const { getByTestId } = wrap(
      <ScreenContainer paddingHorizontal={99}><Text>Content</Text></ScreenContainer>,
    );
    const flatStyle = StyleSheet.flatten(
      getByTestId('screen-container-content').props.style,
    ) as { paddingHorizontal?: number };
    expect(flatStyle.paddingHorizontal).toBe(99);
  });

  it('applies the maxWidth constraint in flat mode (scroll=false) too', () => {
    setViewport(1440, 900);
    const { getByTestId } = wrap(
      <ScreenContainer scroll={false}><Text>Content</Text></ScreenContainer>,
    );
    const flatStyle = StyleSheet.flatten(
      getByTestId('screen-container-content').props.style,
    ) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(layout.maxContentWidth);
  });

  // CQ-15 fix wave (G2 vetor F): a G2 provou por execução que a alegação de
  // "ScreenContainer não expõe um maxWidth customizável" era falsa —
  // sobrescrever via `style` já funcionava no modo flat (capacidade
  // acidental, por ordem de array), só não no modo scroll. A prop
  // `maxWidth` explícita substitui essa capacidade acidental por uma API
  // real, retrocompatível (default = layout.maxContentWidth nos dois modos
  // — as 8 telas que já consomem ScreenContainer sem passar `maxWidth`
  // continuam com o valor de sempre, provado pelas próprias mordidas delas
  // que continuam verdes sem alteração).
  it('explicit maxWidth prop overrides layout.maxContentWidth in scroll mode', () => {
    setViewport(1440, 900);
    const { getByTestId } = wrap(
      <ScreenContainer maxWidth={480}><Text>Content</Text></ScreenContainer>,
    );
    const flatStyle = StyleSheet.flatten(
      getByTestId('screen-container-content').props.style,
    ) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(480);
  });

  it('explicit maxWidth prop overrides layout.maxContentWidth in flat mode too', () => {
    setViewport(1440, 900);
    const { getByTestId } = wrap(
      <ScreenContainer scroll={false} maxWidth={480}><Text>Content</Text></ScreenContainer>,
    );
    const flatStyle = StyleSheet.flatten(
      getByTestId('screen-container-content').props.style,
    ) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(480);
  });

  it('omitting maxWidth keeps the default layout.maxContentWidth (backward compatible)', () => {
    setViewport(1440, 900);
    const { getByTestId } = wrap(
      <ScreenContainer><Text>Content</Text></ScreenContainer>,
    );
    const flatStyle = StyleSheet.flatten(
      getByTestId('screen-container-content').props.style,
    ) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(layout.maxContentWidth);
  });
});

// CQ-15 fix wave (G2 Important #1): `edges` repassado ao SafeAreaView
// interno — omitido = comportamento padrão da lib (todas as bordas),
// preservando as 8 telas que já usam ScreenContainer sem essa prop.
describe('ScreenContainer — edges prop (CQ-15 fix wave)', () => {
  it('does not pass an edges prop to the inner SafeAreaView when omitted (default = all edges)', () => {
    const { getByTestId } = wrap(
      <ScreenContainer><Text>Content</Text></ScreenContainer>,
    );
    expect(getByTestId('mock-safe-area-view').props.edges).toBeUndefined();
  });

  it('forwards an explicit edges array to the inner SafeAreaView', () => {
    const { getByTestId } = wrap(
      <ScreenContainer edges={['bottom', 'left', 'right']}><Text>Content</Text></ScreenContainer>,
    );
    expect(getByTestId('mock-safe-area-view').props.edges).toEqual(['bottom', 'left', 'right']);
  });
});

// CQ-15 fix wave rodada 3 (G2 rodada 2, Important #1): `keyboardShouldPersistTaps`
// repassado ao ScrollView interno — mesmo padrão de `maxWidth`/`edges`, prop
// opcional e aditiva. Omitido = comportamento padrão da lib ('never'),
// preservando os 9 consumidores que não passam essa prop hoje.
describe('ScreenContainer — keyboardShouldPersistTaps prop (CQ-15 fix wave rodada 3)', () => {
  it('does not pass a keyboardShouldPersistTaps prop to the inner ScrollView when omitted', () => {
    const { UNSAFE_getByType } = wrap(
      <ScreenContainer><Text>Content</Text></ScreenContainer>,
    );
    expect(UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBeUndefined();
  });

  it('forwards an explicit keyboardShouldPersistTaps value to the inner ScrollView', () => {
    const { UNSAFE_getByType } = wrap(
      <ScreenContainer keyboardShouldPersistTaps="handled"><Text>Content</Text></ScreenContainer>,
    );
    expect(UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });
});
