import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ThemeProvider } from '../src/theme';
import TeleorientacaoScreen from '../src/app/(app)/teleorientacao/[idPet]';
import { useAuthStore } from '../src/store/authStore';
import { CFMV_TELEORIENTACAO_BANNER } from '../src/constants/compliance';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ idPet: '1' })),
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@hooks/usePetDetail', () => ({ usePetDetail: jest.fn() }));

import { usePetDetail } from '../src/hooks/usePetDetail';
const mockUsePetDetail = usePetDetail as jest.Mock;

const MOCK_VET = { id: 1, nmVeterinario: 'Dr. Felipe Ferrete', nrCRMV: 'SP-12345', dsEmail: 'f@k.com' };
const MOCK_PET = {
  id: 1, nmPet: 'Thor', nmEspecie: 'Cão', nmRaca: 'Labrador',
  dtNascimento: '2020-01-01T00:00:00.000Z', sgSexo: 'M', sgPorte: 'G',
  tutores: [{ id: 10, nmTutor: 'Carlos Mendes', dsTelefone: '11999990001', dsEmail: 'c@e.com' }],
};

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), usuario: MOCK_VET });
  mockUsePetDetail.mockReturnValue({ data: MOCK_PET, isLoading: false, isError: false });
});

describe('TeleorientacaoScreen', () => {
  it('renders CFMV banner with exact titulo', () => {
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    const titulo = getByTestId('cfmv-titulo');
    expect(titulo.props.children).toBe(CFMV_TELEORIENTACAO_BANNER.titulo);
  });

  it('renders all 4 ressalvas', () => {
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    CFMV_TELEORIENTACAO_BANNER.ressalvas.forEach((_, i) => {
      expect(getByTestId(`cfmv-ressalva-${i}`)).toBeTruthy();
    });
  });

  it('renders identificacaoVet with vet name and CRMV from authStore', () => {
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    const ident = getByTestId('cfmv-ident');
    expect(ident.props.children).toBe(
      CFMV_TELEORIENTACAO_BANNER.identificacaoVet('Dr. Felipe Ferrete', 'SP-12345'),
    );
  });

  it('banner corpo text is exact string from compliance.ts', () => {
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    const corpo = getByTestId('cfmv-corpo');
    expect(corpo.props.children).toBe(CFMV_TELEORIENTACAO_BANNER.corpo);
  });

  it('pressing Encerrar shows Alert with confirmation', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    fireEvent.press(getByTestId('btn-encerrar'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Encerrar sessão?',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancelar' }),
        expect.objectContaining({ text: 'Encerrar' }),
      ]),
    );
  });

  it('confirming Encerrar calls router.back()', async () => {
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_title, _msg, buttons) => {
      const encerrar = buttons?.find((b) => b.text === 'Encerrar');
      encerrar?.onPress?.();
    });
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    fireEvent.press(getByTestId('btn-encerrar'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });
});
