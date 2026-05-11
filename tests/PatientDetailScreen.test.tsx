import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import PatientDetailScreen from '../src/app/(app)/pacientes/[id]';
import * as Clipboard from 'expo-clipboard';
import type { PetResponse, TimelineEventResponse } from '../src/types/api';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: '1' })),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@hooks/usePetDetail', () => ({ usePetDetail: jest.fn() }));
jest.mock('@hooks/usePetTimeline', () => ({ usePetTimeline: jest.fn() }));

import { useLocalSearchParams } from 'expo-router';
import { usePetDetail } from '../src/hooks/usePetDetail';
import { usePetTimeline } from '../src/hooks/usePetTimeline';

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUsePetDetail = usePetDetail as jest.Mock;
const mockUsePetTimeline = usePetTimeline as jest.Mock;

const MOCK_PET: PetResponse = {
  id: 1,
  nmPet: 'Thor',
  nmEspecie: 'Cão',
  nmRaca: 'Labrador Retriever',
  dtNascimento: '2020-03-15T00:00:00.000Z',
  sgSexo: 'M',
  sgPorte: 'G',
  tutores: [{ id: 10, nmTutor: 'Carlos Mendes', dsTelefone: '11999990001', dsEmail: 'carlos@e.com' }],
};

const MOCK_EVENTS: TimelineEventResponse[] = [
  { idEventoClinico: 1, nmTipo: 'CONSULTA', dtEvento: new Date().toISOString(), dsObservacao: 'Check-up', nmVeterinario: 'Dr. Felipe' },
];

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLocalSearchParams.mockReturnValue({ id: '1' });
  mockUsePetDetail.mockReturnValue({ data: MOCK_PET, isLoading: false, isError: false });
  mockUsePetTimeline.mockReturnValue({ data: MOCK_EVENTS, isLoading: false });
});

describe('PatientDetailScreen', () => {
  it('renders pet name, raca, and especie', () => {
    const { getByText } = wrap(<PatientDetailScreen />);
    expect(getByText('Thor')).toBeTruthy();
    expect(getByText(/Labrador Retriever/)).toBeTruthy();
  });

  it('renders chips for idade, sexo, and porte', () => {
    const { getByText } = wrap(<PatientDetailScreen />);
    expect(getByText('Macho')).toBeTruthy();
    expect(getByText('Grande')).toBeTruthy();
  });

  it('navigates to consulta route on Consulta button tap', () => {
    const { getByTestId } = wrap(<PatientDetailScreen />);
    fireEvent.press(getByTestId('btn-consulta'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/consulta/1');
  });

  it('calls Clipboard.setStringAsync on tutor phone tap', async () => {
    const { getByTestId } = wrap(<PatientDetailScreen />);
    fireEvent.press(getByTestId('copy-phone-10'));
    await waitFor(() => {
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('11999990001');
    });
  });

  it('switches to Vacinas tab on tab press', () => {
    const { getByTestId, getByText } = wrap(<PatientDetailScreen />);
    fireEvent.press(getByTestId('tab-vacinas'));
    expect(getByText('Vacinas em breve')).toBeTruthy();
  });

  it('renders skeleton during loading', () => {
    mockUsePetDetail.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { getByTestId, queryByTestId } = wrap(<PatientDetailScreen />);
    expect(getByTestId('loading-skeleton')).toBeTruthy();
    expect(queryByTestId('pet-detail-scroll')).toBeNull();
  });

  it('shows error state with back button on invalid id', () => {
    mockUsePetDetail.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    const { getByText } = wrap(<PatientDetailScreen />);
    expect(getByText('Paciente não encontrado')).toBeTruthy();
    const backBtn = getByText('Voltar');
    fireEvent.press(backBtn);
    expect(mockBack).toHaveBeenCalled();
  });
});
