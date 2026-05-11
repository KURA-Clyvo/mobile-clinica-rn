import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import ConsultaScreen from '../src/app/(app)/consulta/[idPet]';
import { useAuthStore } from '../src/store/authStore';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ idPet: '1' })),
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@hooks/usePetDetail', () => ({ usePetDetail: jest.fn() }));
jest.mock('@hooks/useEventosClinicos', () => ({
  useCriarConsulta: jest.fn(),
  useCriarPrescricao: jest.fn(),
  useMedicamentos: jest.fn(),
}));

import { usePetDetail } from '../src/hooks/usePetDetail';
import { useCriarConsulta } from '../src/hooks/useEventosClinicos';

const mockUsePetDetail = usePetDetail as jest.Mock;
const mockUseCriarConsulta = useCriarConsulta as jest.Mock;

const MOCK_VET = { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345', dsEmail: 'f@k.com' };
const MOCK_PET = {
  id: 1, nmPet: 'Thor', nmEspecie: 'Cão', nmRaca: 'Labrador',
  dtNascimento: '2020-01-01T00:00:00.000Z', sgSexo: 'M', sgPorte: 'G', tutores: [],
};

const mockMutate = jest.fn();

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(ThemeProvider, null,
      React.createElement(QueryClientProvider, { client: qc }, children));
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), usuario: MOCK_VET });
  mockUsePetDetail.mockReturnValue({ data: MOCK_PET, isLoading: false, isError: false });
  mockUseCriarConsulta.mockReturnValue({ mutate: mockMutate, isPending: false });
});

function wrap(ui: React.ReactElement) {
  return render(ui, { wrapper: makeWrapper() });
}

describe('ConsultaScreen', () => {
  it('shows motivo validation error when motivo is empty', async () => {
    const { getByTestId, getByText } = wrap(<ConsultaScreen />);
    fireEvent.press(getByTestId('btn-salvar'));
    await waitFor(() => {
      expect(getByText('Informe o motivo da consulta')).toBeTruthy();
    });
  });

  it('shows SOAP validation error when no SOAP field filled', async () => {
    const { getByTestId, findByText } = wrap(<ConsultaScreen />);
    fireEvent.changeText(getByTestId('field-motivo'), 'Retorno pós-cirurgia');
    fireEvent.press(getByTestId('btn-salvar'));
    expect(await findByText('Preencha ao menos um campo SOAP')).toBeTruthy();
  });

  it('calls criarConsulta with correct payload on valid submit', async () => {
    const { getByTestId } = wrap(<ConsultaScreen />);
    fireEvent.changeText(getByTestId('field-motivo'), 'Consulta de rotina');
    fireEvent.changeText(getByTestId('field-dsAnamnese'), 'Animal sem queixas');
    fireEvent.press(getByTestId('btn-salvar'));
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          idPet: 1,
          idVeterinario: 1,
          dsMotivo: 'Consulta de rotina',
          dsAnamnese: 'Animal sem queixas',
        }),
        expect.any(Object),
      );
    });
  });

  it('calls router.back on success', async () => {
    mockMutate.mockImplementation((_req: unknown, opts: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });
    const { getByTestId } = wrap(<ConsultaScreen />);
    fireEvent.changeText(getByTestId('field-motivo'), 'Consulta de rotina');
    fireEvent.changeText(getByTestId('field-dsAnamnese'), 'Animal ativo');
    fireEvent.press(getByTestId('btn-salvar'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('LunaSuggestionBadge tap fills SOAP field when empty', async () => {
    const { getByTestId } = wrap(<ConsultaScreen />);
    await act(async () => {
      fireEvent.press(getByTestId('luna-badge-S'));
    });
    await waitFor(() => {
      const input = getByTestId('field-dsAnamnese');
      expect(input.props.value).toBeTruthy();
    }, { timeout: 1500 });
  });
});
