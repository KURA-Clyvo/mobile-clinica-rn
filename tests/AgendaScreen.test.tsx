import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import AgendaScreen from '../src/app/(app)/agenda';
import { getMondayOf, addDays } from '../src/utils/date';

jest.mock('@hooks/useAgenda', () => ({
  useAgendaSemana: jest.fn(),
}));

import { useAgendaSemana } from '../src/hooks/useAgenda';
const mockUseAgendaSemana = useAgendaSemana as jest.Mock;

const REFETCH = jest.fn().mockResolvedValue(undefined);

const TODAY_9AM = (() => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
})();

const TOMORROW_10AM = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
})();

const MOCK_APPOINTMENT_TODAY = {
  id: 1,
  dtInicio: TODAY_9AM.toISOString(),
  nrDuracaoMinutos: 30,
  sgStatus: 'AGENDADA' as const,
  pet: { id: 1, nmPet: 'Thor', nmEspecie: 'Cão', nmRaca: 'Labrador' },
  tutor: { id: 1, nmTutor: 'Carlos Mendes', dsTelefone: '11987654321' },
  veterinario: { id: 1, nmVeterinario: 'Dr. Felipe Ferrete', nrCRMV: 'SP-12345' },
};

const MOCK_APPOINTMENT_TOMORROW = {
  id: 2,
  dtInicio: TOMORROW_10AM.toISOString(),
  nrDuracaoMinutos: 45,
  sgStatus: 'AGENDADA' as const,
  pet: { id: 2, nmPet: 'Mel', nmEspecie: 'Cão', nmRaca: 'Poodle' },
  tutor: { id: 2, nmTutor: 'Patrícia Souza', dsTelefone: '11976543210' },
  veterinario: { id: 1, nmVeterinario: 'Dr. Felipe Ferrete', nrCRMV: 'SP-12345' },
};

function makeDefaultHookReturn(data: unknown[], isLoading = false) {
  const semanaStart = getMondayOf(new Date());
  const semanaEnd = addDays(semanaStart, 6);
  return {
    data,
    isLoading,
    isError: false,
    refetch: REFETCH,
    semanaStart,
    semanaEnd,
  };
}

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  REFETCH.mockResolvedValue(undefined);
});

describe('AgendaScreen — loading state', () => {
  it('shows skeleton placeholders while loading', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([], true));
    const { getAllByTestId } = wrap(<AgendaScreen />);
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });
});

describe('AgendaScreen — loaded state', () => {
  it('shows appointments for selected day (today)', () => {
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([MOCK_APPOINTMENT_TODAY, MOCK_APPOINTMENT_TOMORROW]),
    );
    const { getByText } = wrap(<AgendaScreen />);
    expect(getByText('Thor')).toBeTruthy();
  });

  it('does not show appointments from other days on today tab', () => {
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([MOCK_APPOINTMENT_TODAY, MOCK_APPOINTMENT_TOMORROW]),
    );
    const { queryByText } = wrap(<AgendaScreen />);
    // Mel is tomorrow — not shown on today's tab
    expect(queryByText('Mel')).toBeNull();
  });

  it('shows week range in header', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByTestId } = wrap(<AgendaScreen />);
    expect(getByTestId('week-range')).toBeTruthy();
    expect(getByTestId('week-range').props.children).toBeTruthy();
  });

  it('renders 7 day tabs', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getAllByTestId } = wrap(<AgendaScreen />);
    const tabs = [];
    for (let i = 0; i < 7; i++) {
      const tab = getAllByTestId(`day-tab-${i}`);
      if (tab.length > 0) tabs.push(tab[0]);
    }
    expect(tabs).toHaveLength(7);
  });

  it('shows appointment details: pet species, tutor name', () => {
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([MOCK_APPOINTMENT_TODAY]),
    );
    const { getByText } = wrap(<AgendaScreen />);
    expect(getByText(/Carlos Mendes/)).toBeTruthy();
    expect(getByText(/Cão/)).toBeTruthy();
  });
});

describe('AgendaScreen — empty state', () => {
  it('shows empty state when no appointments for selected day', () => {
    // Only tomorrow's appointment — today should show empty state
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([MOCK_APPOINTMENT_TOMORROW]),
    );
    const { getByTestId } = wrap(<AgendaScreen />);
    expect(getByTestId('empty-agenda')).toBeTruthy();
  });

  it('empty state text is correct', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByText } = wrap(<AgendaScreen />);
    expect(getByText('Nenhuma consulta neste dia')).toBeTruthy();
  });
});

describe('AgendaScreen — week navigation', () => {
  it('renders prev and next week buttons', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByTestId } = wrap(<AgendaScreen />);
    expect(getByTestId('btn-prev-week')).toBeTruthy();
    expect(getByTestId('btn-next-week')).toBeTruthy();
  });

  it('pressing next week triggers hook with next week base', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-next-week'));
    // Hook is called again with a new semanaBase
    expect(mockUseAgendaSemana).toHaveBeenCalledTimes(2);
  });

  it('pressing prev week triggers hook with prev week base', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-prev-week'));
    expect(mockUseAgendaSemana).toHaveBeenCalledTimes(2);
  });
});
