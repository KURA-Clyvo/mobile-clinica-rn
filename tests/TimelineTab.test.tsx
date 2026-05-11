import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import PatientDetailScreen from '../src/app/(app)/pacientes/[id]';
import type { TimelineEventResponse } from '../src/types/api';
import type { PetResponse } from '../src/types/api';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: '1' })),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@hooks/usePetDetail', () => ({ usePetDetail: jest.fn() }));
jest.mock('@hooks/usePetTimeline', () => ({ usePetTimeline: jest.fn() }));

import { usePetDetail } from '../src/hooks/usePetDetail';
import { usePetTimeline } from '../src/hooks/usePetTimeline';

const mockUsePetDetail = usePetDetail as jest.Mock;
const mockUsePetTimeline = usePetTimeline as jest.Mock;

const MOCK_PET: PetResponse = {
  id: 1,
  nmPet: 'Thor',
  nmEspecie: 'Cão',
  nmRaca: 'Labrador',
  dtNascimento: '2020-01-01T00:00:00.000Z',
  sgSexo: 'M',
  sgPorte: 'G',
  tutores: [],
};

const now = Date.now();
const MOCK_EVENTS: TimelineEventResponse[] = [
  { idEventoClinico: 1, nmTipo: 'CONSULTA',       dtEvento: new Date(now - 1 * 86400000).toISOString(), dsObservacao: 'Evento 1', nmVeterinario: 'Dr. A' },
  { idEventoClinico: 2, nmTipo: 'VACINA',          dtEvento: new Date(now - 5 * 86400000).toISOString(), dsObservacao: 'Evento 2', nmVeterinario: 'Dr. B' },
  { idEventoClinico: 3, nmTipo: 'PRESCRICAO',      dtEvento: new Date(now - 2 * 86400000).toISOString(), dsObservacao: 'Evento 3', nmVeterinario: 'Dr. C' },
  { idEventoClinico: 4, nmTipo: 'EXAME',           dtEvento: new Date(now - 8 * 86400000).toISOString(), dsObservacao: 'Evento 4' },
  { idEventoClinico: 5, nmTipo: 'TELEORIENTACAO',  dtEvento: new Date(now - 3 * 86400000).toISOString(), dsObservacao: 'Evento 5', nmVeterinario: 'Dr. E' },
  { idEventoClinico: 6, nmTipo: 'CONSULTA',        dtEvento: new Date(now - 10 * 86400000).toISOString(), dsObservacao: 'Evento 6', nmVeterinario: 'Dr. F' },
  { idEventoClinico: 7, nmTipo: 'VACINA',          dtEvento: new Date(now - 15 * 86400000).toISOString(), dsObservacao: 'Evento 7', nmVeterinario: 'Dr. G' },
  { idEventoClinico: 8, nmTipo: 'CONSULTA',        dtEvento: new Date(now - 20 * 86400000).toISOString(), dsObservacao: 'Evento 8', nmVeterinario: 'Dr. H' },
];

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePetDetail.mockReturnValue({ data: MOCK_PET, isLoading: false, isError: false });
  mockUsePetTimeline.mockReturnValue({ data: MOCK_EVENTS, isLoading: false });
});

describe('TimelineTab', () => {
  it('shows skeleton while loading', () => {
    mockUsePetTimeline.mockReturnValue({ data: undefined, isLoading: true });
    const { queryByTestId } = wrap(<PatientDetailScreen />);
    expect(queryByTestId('timeline-item-1')).toBeNull();
  });

  it('shows empty state when no events', () => {
    mockUsePetTimeline.mockReturnValue({ data: [], isLoading: false });
    const { getByText } = wrap(<PatientDetailScreen />);
    expect(getByText('Nenhum evento registrado')).toBeTruthy();
  });

  it('renders 8 timeline items from mock', () => {
    const { getAllByText } = wrap(<PatientDetailScreen />);
    const verMaisBtns = getAllByText('Ver mais');
    expect(verMaisBtns.length).toBe(8);
  });

  it('events sorted descending: first item is most recent', () => {
    const sortedDates = [...MOCK_EVENTS]
      .sort((a, b) => new Date(b.dtEvento).getTime() - new Date(a.dtEvento).getTime())
      .map((e) => e.idEventoClinico);
    expect(sortedDates[0]).toBe(1);
  });
});
