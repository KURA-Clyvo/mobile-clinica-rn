import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import ReceituarioScreen from '../src/app/(app)/receituario/[idPet]';
import { useAuthStore } from '../src/store/authStore';

const mockBack = jest.fn();
const mockMutate = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ idPet: '1' })),
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@hooks/usePetDetail', () => ({ usePetDetail: jest.fn() }));

jest.mock('@hooks/useEventosClinicos', () => ({
  useCriarPrescricao: jest.fn(),
  useMedicamentos: jest.fn(),
}));

jest.mock('@components/domain/WhatsAppModal', () => ({
  WhatsAppModal: ({ visible }: { visible: boolean }) => {
    const R = require('react');
    const { View } = require('react-native');
    return visible ? R.createElement(View, { testID: 'whatsapp-modal' }) : null;
  },
}));

import { usePetDetail } from '../src/hooks/usePetDetail';
import { useCriarPrescricao, useMedicamentos } from '../src/hooks/useEventosClinicos';

const mockUsePetDetail = usePetDetail as jest.Mock;
const mockUseCriarPrescricao = useCriarPrescricao as jest.Mock;
const mockUseMedicamentos = useMedicamentos as jest.Mock;

const MOCK_VET = {
  id: 1,
  nmVeterinario: 'Dr. Felipe',
  nrCRMV: 'SP-12345',
  dsEmail: 'f@k.com',
};

const MOCK_PET = {
  id: 1,
  nmPet: 'Thor',
  nmEspecie: 'Cão',
  nmRaca: 'Labrador',
  dtNascimento: '2020-01-01T00:00:00.000Z',
  sgSexo: 'M',
  sgPorte: 'G',
  tutores: [{ id: 10, nmTutor: 'Carlos', dsTelefone: '11999990001', dsEmail: 'c@e.com' }],
};

const MOCK_MEDS = {
  items: [
    {
      id: 1,
      nmMedicamento: 'Amoxicilina 250mg',
      dsPrincipioAtivo: 'Amoxicilina',
      dsConcentracao: '250mg/5mL',
      dsApresentacao: 'Suspensão',
    },
    {
      id: 2,
      nmMedicamento: 'Metronidazol 400mg',
      dsPrincipioAtivo: 'Metronidazol',
      dsConcentracao: '400mg',
      dsApresentacao: 'Comprimido',
    },
  ],
  page: 1,
  pageSize: 20,
  totalItems: 2,
  totalPages: 1,
};

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    usuario: MOCK_VET,
  });
  mockUsePetDetail.mockReturnValue({ data: MOCK_PET });
  mockUseCriarPrescricao.mockReturnValue({ mutate: mockMutate, isPending: false });
  mockUseMedicamentos.mockReturnValue({ data: MOCK_MEDS });
});

describe('ReceituarioScreen', () => {
  it('shows validation error when submitting without medication', async () => {
    const { getByTestId, getByText } = wrap(<ReceituarioScreen />);
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(
      () => {
        expect(getByText('Selecione um medicamento')).toBeTruthy();
      },
      { timeout: 8000 },
    );
  }, 12000);

  it('shows validation error when posologia is empty after medication selected', async () => {
    const { getByTestId, getByText } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => {
      expect(getByText('Descreva a posologia')).toBeTruthy();
    });
  });

  it('shows filtered medications list when searching "amox"', () => {
    const { getByTestId, getByText, queryByText } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    expect(getByText('Amoxicilina 250mg')).toBeTruthy();
    expect(queryByText('Metronidazol 400mg')).toBeNull();
  });

  it('shows chip with medication name after selection and hides list', () => {
    const { getByTestId, getByText, queryByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    expect(getByText('Amoxicilina 250mg')).toBeTruthy();
    expect(queryByTestId('search-med')).toBeNull();
  });

  it('calls criarPrescricao with correct payload on valid submit', async () => {
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          idPet: 1,
          idVeterinario: 1,
          idMedicamento: 1,
          dsPosologia: '1 comprimido a cada 12h',
          nrDuracaoDias: 7,
        }),
        expect.any(Object),
      );
    });
  });

  it('shows success modal on successful prescription creation', async () => {
    mockMutate.mockImplementation((_req: unknown, { onSuccess }: { onSuccess: () => void }) =>
      onSuccess(),
    );
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => {
      expect(getByTestId('success-modal')).toBeTruthy();
    });
  });

  it('opens WhatsApp modal when pressing "Enviar via WhatsApp"', async () => {
    mockMutate.mockImplementation((_req: unknown, { onSuccess }: { onSuccess: () => void }) =>
      onSuccess(),
    );
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => getByTestId('btn-whatsapp'));
    fireEvent.press(getByTestId('btn-whatsapp'));
    await waitFor(() => {
      expect(getByTestId('whatsapp-modal')).toBeTruthy();
    });
  });

  it('calls router.back() when pressing "Voltar ao paciente"', async () => {
    mockMutate.mockImplementation((_req: unknown, { onSuccess }: { onSuccess: () => void }) =>
      onSuccess(),
    );
    const { getByTestId } = wrap(<ReceituarioScreen />);
    fireEvent.changeText(getByTestId('search-med'), 'amox');
    fireEvent.press(getByTestId('med-item-1'));
    fireEvent.changeText(getByTestId('field-posologia'), '1 comprimido a cada 12h');
    fireEvent.changeText(getByTestId('field-duracao'), '7');
    fireEvent.press(getByTestId('btn-emitir'));
    await waitFor(() => getByTestId('btn-voltar'));
    fireEvent.press(getByTestId('btn-voltar'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
