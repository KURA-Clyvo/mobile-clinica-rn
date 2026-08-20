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
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
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
});
