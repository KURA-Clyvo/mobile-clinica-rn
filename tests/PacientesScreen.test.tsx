import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../src/theme';
import PacientesScreen from '../src/app/(app)/pacientes/index';
import { layout } from '../src/theme/tokens';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// CQ-15: ScreenContainer usa <SafeAreaView> deste módulo — precisa de um
// mock que devolva um componente de verdade (não só `useSafeAreaInsets`),
// senão o render derruba com "Element type is invalid".
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('@hooks/usePets', () => ({ usePets: jest.fn() }));

import { usePets } from '../src/hooks/usePets';
const mockUsePets = usePets as jest.Mock;

// useWindowDimensions é o que useBreakpoint()/ScreenContainer consomem.
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
  jest.clearAllMocks();
  setViewport(400, 800);
  mockUsePets.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
});

describe('PacientesScreen', () => {
  it('renders the search input', () => {
    const { getByTestId } = wrap(<PacientesScreen />);
    expect(getByTestId('search-input')).toBeTruthy();
  });

  it('renders the FAB', () => {
    const { getByTestId } = wrap(<PacientesScreen />);
    expect(getByTestId('btn-novo-paciente')).toBeTruthy();
  });
});

// CQ-15: prova de mordida — falha contra a tela sem ScreenContainer (o
// testID/estilo 'screen-container-content' não existe hoje), passa depois
// da adoção. Estilo declarado, não px calculado.
describe('PacientesScreen — ScreenContainer adoption (CQ-15)', () => {
  it('respects layout.maxContentWidth at 1440×900 (xl)', () => {
    setViewport(1440, 900);
    const { getByTestId } = wrap(<PacientesScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(layout.maxContentWidth);
  });
});
