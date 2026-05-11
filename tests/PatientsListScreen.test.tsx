import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import PacientesScreen from '../src/app/(app)/pacientes/index';
import type { PetResponse } from '../src/types/api';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@hooks/usePets', () => ({
  usePets: jest.fn(),
}));

import { usePets } from '../src/hooks/usePets';
const mockUsePets = usePets as jest.Mock;

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
    expect(mockPush).toHaveBeenCalledWith('/(app)/pacientes/1');
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
});
