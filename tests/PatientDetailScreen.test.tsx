import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../src/theme';
import PatientDetailScreen from '../src/app/(app)/pacientes/[id]';
import * as Clipboard from 'expo-clipboard';
import type { PetResponse, TimelineEventResponse } from '../src/types/api';
import { layout } from '../src/theme/tokens';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ id: '1' })),
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

// CQ-15: ScreenContainer usa <SafeAreaView> deste módulo — o mock antigo só
// tinha `useSafeAreaInsets`, o que derrubaria o render com "Element type is
// invalid" assim que a tela passasse a importar ScreenContainer.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

// useWindowDimensions é o que useBreakpoint()/ScreenContainer consomem.
const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

function setViewport(width: number, height: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

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
  setViewport(400, 800);
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
    // URL canônica sem o segmento de grupo `(app)` — CQ-03 (dev VsClaude,
    // KURA_BACKLOG_CLINICA_1). Trava de propósito, não afrouxar.
    expect(mockPush).toHaveBeenCalledWith('/consulta/1');
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

// CQ-15: prova de mordida — falha contra a tela sem ScreenContainer (o
// testID/estilo 'screen-container-content' não existe hoje), passa depois
// da adoção. Estilo declarado, não px calculado.
describe('PatientDetailScreen — ScreenContainer adoption (CQ-15)', () => {
  it('respects layout.maxContentWidth at 1440×900 (xl)', () => {
    setViewport(1440, 900);
    const { getByTestId } = wrap(<PatientDetailScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(layout.maxContentWidth);
  });
});
