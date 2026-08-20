import React from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import PacientesScreen from '../src/app/(app)/pacientes/index';
import type { PetResponse } from '../src/types/api';
import { layout } from '../src/theme/tokens';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@hooks/usePets', () => ({
  usePets: jest.fn(),
}));

import { usePets } from '../src/hooks/usePets';
const mockUsePets = usePets as jest.Mock;

// CQ-15: useWindowDimensions é o que useBreakpoint()/ScreenContainer
// consomem. Este arquivo não mockava react-native-safe-area-context — o
// mock padrão do preset jest-expo já resolve SafeAreaView de verdade, então
// nenhuma mudança foi necessária ali.
const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

function setViewport(width: number, height: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

const MOCK_REFETCH = jest.fn().mockResolvedValue(undefined);

const MOCK_PETS: PetResponse[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  nmPet: i === 0 ? 'Luna' : `Pet${i + 1}`,
  nmEspecie: 'Cão',
  nmRaca: 'Labrador',
  dtNascimento: '2020-01-01T00:00:00.000Z',
  sgSexo: 'M' as const,
  sgPorte: 'G' as const,
  tutores: [{ id: 100 + i, nmTutor: `Tutor${i + 1}`, dsTelefone: '11999990000', dsEmail: `t${i}@e.com` }],
}));

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePets.mockReturnValue({ data: MOCK_PETS, isLoading: false, refetch: MOCK_REFETCH });
  setViewport(400, 800);
});

describe('PatientsListScreen', () => {
  it('renders FlatList with 12 items', () => {
    const { getAllByRole } = wrap(<PacientesScreen />);
    const items = getAllByRole('button').filter(
      (el) => el.props.accessibilityRole === 'button',
    );
    expect(items.length).toBeGreaterThanOrEqual(12);
  });

  it('tapping a pet navigates to correct route', () => {
    const { getAllByRole } = wrap(<PacientesScreen />);
    const items = getAllByRole('button').filter(
      (el) => el.props.accessibilityRole === 'button',
    );
    fireEvent.press(items[0]!);
    // URL canônica sem o segmento de grupo `(app)` — CQ-03 (dev VsClaude,
    // KURA_BACKLOG_CLINICA_1). Trava de propósito, não afrouxar.
    expect(mockPush).toHaveBeenCalledWith('/pacientes/1');
  });

  it('shows "Nenhum paciente encontrado" when list is empty with active search', async () => {
    jest.useFakeTimers();
    mockUsePets.mockReturnValue({ data: [], isLoading: false, refetch: MOCK_REFETCH });
    const { getByTestId, getByText } = wrap(<PacientesScreen />);

    fireEvent.changeText(getByTestId('search-input'), 'xyzxyz');
    act(() => jest.advanceTimersByTime(300));

    await waitFor(() => {
      expect(getByText('Nenhum paciente encontrado')).toBeTruthy();
    });
    jest.useRealTimers();
  });

  it('shows "Nenhum paciente cadastrado" when no filter and no pets', () => {
    mockUsePets.mockReturnValue({ data: [], isLoading: false, refetch: MOCK_REFETCH });
    const { getByText } = wrap(<PacientesScreen />);
    expect(getByText('Nenhum paciente cadastrado')).toBeTruthy();
  });

  it('debounce: updates filtro after 300ms on search input', async () => {
    jest.useFakeTimers();
    const { getByTestId } = wrap(<PacientesScreen />);
    const input = getByTestId('search-input');

    fireEvent.changeText(input, 'luna');
    expect(mockUsePets).toHaveBeenLastCalledWith(undefined);

    act(() => jest.advanceTimersByTime(300));
    await waitFor(() => {
      expect(mockUsePets).toHaveBeenCalledWith('luna');
    });

    jest.useRealTimers();
  });

  it('tapping "+ Novo" communicates unavailability instead of a silent no-op', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId } = wrap(<PacientesScreen />);
    fireEvent.press(getByTestId('btn-novo-paciente'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Cadastro de paciente',
      'Funcionalidade em breve — ainda não é possível cadastrar um novo paciente por aqui.',
    );
    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('"+ Novo" CTA exposes an accessible label explaining unavailability', () => {
    const { getByTestId } = wrap(<PacientesScreen />);
    const cta = getByTestId('btn-novo-paciente');
    expect(cta.props.accessibilityRole).toBe('button');
    expect(cta.props.accessibilityLabel).toBe('Novo paciente — funcionalidade em breve');
  });
});

// CQ-15: prova de mordida — falha contra a tela sem ScreenContainer (o
// testID/estilo 'screen-container-content' não existe hoje), passa depois
// da adoção. Estilo declarado, não px calculado.
describe('PatientsListScreen — ScreenContainer adoption (CQ-15)', () => {
  it('respects layout.maxContentWidth at 1440×900 (xl)', () => {
    setViewport(1440, 900);
    const { getByTestId } = wrap(<PacientesScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(layout.maxContentWidth);
  });

  // CQ-15 fix wave (G2 Important #6/vetor I.1): mordida — a G2 reproduziu que
  // remover `scroll={false}` (a decisão que protege a virtualização da
  // FlatList de ser aninhada num ScrollView) deixava a suíte inteira verde,
  // sem sequer o aviso "VirtualizedLists should never be nested". A FlatList
  // já virtualiza sozinha (`getItemLayout`/`removeClippedSubviews`); se
  // `scroll={false}` sumir, o ScreenContainer volta ao modo scroll padrão e
  // passa a envolver a FlatList num ScrollView — nested VirtualizedLists.
  it('does not nest the virtualized FlatList inside a ScrollView (scroll={false})', () => {
    const { UNSAFE_queryAllByType } = wrap(<PacientesScreen />);
    // FlatList é construída sobre VirtualizedList, que já renderiza o
    // próprio ScrollView internamente — por isso a asserção não é "zero
    // ScrollView na árvore", é "só o ScrollView interno da própria
    // FlatList", nunca um segundo envolvendo tudo (o que aconteceria se
    // `scroll={false}` sumisse e o ScreenContainer voltasse ao modo scroll
    // padrão, disparando "VirtualizedLists should never be nested").
    expect(UNSAFE_queryAllByType(ScrollView).length).toBe(1);
  });
});
