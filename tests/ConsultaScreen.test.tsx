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

const mockPrepareToRecordAsync = jest.fn();
const mockRecord = jest.fn();
const mockStop = jest.fn();
let mockRecorderUri: string | null = 'file://mock-audio.m4a';
let mockIsRecording = false;
const mockRequestRecordingPermissionsAsync = jest.fn(() => Promise.resolve({ granted: true }));

jest.mock('expo-audio', () => ({
  useAudioRecorder: jest.fn(() => ({
    prepareToRecordAsync: mockPrepareToRecordAsync,
    record: mockRecord,
    stop: mockStop,
    get uri() {
      return mockRecorderUri;
    },
  })),
  useAudioRecorderState: jest.fn(() => ({ isRecording: mockIsRecording })),
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: (...args: unknown[]) =>
    mockRequestRecordingPermissionsAsync(...args),
}));

jest.mock('@hooks/usePetDetail', () => ({ usePetDetail: jest.fn() }));
jest.mock('@hooks/useEventosClinicos', () => ({
  useCriarConsulta: jest.fn(),
  useCriarPrescricao: jest.fn(),
  useMedicamentos: jest.fn(),
  useEnviarTranscricao: jest.fn(),
  useConfirmarSoap: jest.fn(),
}));

import { usePetDetail } from '../src/hooks/usePetDetail';
import {
  useCriarConsulta,
  useEnviarTranscricao,
  useConfirmarSoap,
} from '../src/hooks/useEventosClinicos';

const mockUsePetDetail = usePetDetail as jest.Mock;
const mockUseCriarConsulta = useCriarConsulta as jest.Mock;
const mockUseEnviarTranscricao = useEnviarTranscricao as jest.Mock;
const mockUseConfirmarSoap = useConfirmarSoap as jest.Mock;

const MOCK_VET = { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345', dsEmail: 'f@k.com' };
const MOCK_PET = {
  id: 1, nmPet: 'Thor', nmEspecie: 'Cão', nmRaca: 'Labrador',
  dtNascimento: '2020-01-01T00:00:00.000Z', sgSexo: 'M', sgPorte: 'G', tutores: [],
};

const mockMutateCriarConsulta = jest.fn();
const mockMutateEnviarTranscricao = jest.fn();
const mockMutateConfirmarSoap = jest.fn();

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(ThemeProvider, null,
      React.createElement(QueryClientProvider, { client: qc }, children));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorderUri = 'file://mock-audio.m4a';
  mockIsRecording = false;
  useAuthStore.setState({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), usuario: MOCK_VET });
  mockUsePetDetail.mockReturnValue({ data: MOCK_PET, isLoading: false, isError: false });
  mockUseCriarConsulta.mockReturnValue({ mutate: mockMutateCriarConsulta, isPending: false });
  mockUseEnviarTranscricao.mockReturnValue({ mutate: mockMutateEnviarTranscricao, isPending: false });
  mockUseConfirmarSoap.mockReturnValue({ mutate: mockMutateConfirmarSoap, isPending: false });
});

function wrap(ui: React.ReactElement) {
  return render(ui, { wrapper: makeWrapper() });
}

function criarConsultaComSucesso(getByTestId: ReturnType<typeof wrap>['getByTestId']) {
  mockMutateCriarConsulta.mockImplementation(
    (_req: unknown, opts: { onSuccess?: (r: { idEventoClinico: number; idConsulta: number }) => void }) => {
      opts?.onSuccess?.({ idEventoClinico: 42, idConsulta: 99 });
    },
  );
  fireEvent.changeText(getByTestId('field-motivo'), 'Consulta de rotina');
  fireEvent.changeText(getByTestId('field-dsAnamnese'), 'Animal ativo');
  fireEvent.press(getByTestId('btn-salvar'));
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
      expect(mockMutateCriarConsulta).toHaveBeenCalledWith(
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

  it('on success, reveals the audio transcription card instead of navigating back', async () => {
    const { getByTestId, queryByTestId } = wrap(<ConsultaScreen />);
    criarConsultaComSucesso(getByTestId);
    await waitFor(() => expect(getByTestId('card-transcricao')).toBeTruthy());
    expect(mockBack).not.toHaveBeenCalled();
    expect(queryByTestId('btn-salvar')).toBeNull();
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

  describe('transcrição por áudio (após consulta criada)', () => {
    async function chegarNoCardTranscricao() {
      const utils = wrap(<ConsultaScreen />);
      criarConsultaComSucesso(utils.getByTestId);
      await waitFor(() => expect(utils.getByTestId('card-transcricao')).toBeTruthy());
      return utils;
    }

    it('pressing "Gravar áudio da consulta" solicita permissão e inicia a gravação', async () => {
      const { getByTestId } = await chegarNoCardTranscricao();
      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });
      expect(mockRequestRecordingPermissionsAsync).toHaveBeenCalled();
      expect(mockPrepareToRecordAsync).toHaveBeenCalled();
      expect(mockRecord).toHaveBeenCalled();
    });

    it('does not start recording when microphone permission is denied', async () => {
      mockRequestRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false });
      const { getByTestId } = await chegarNoCardTranscricao();
      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });
      expect(mockRecord).not.toHaveBeenCalled();
    });

    it('pressing again while recording stops and uploads, filling the SOAP draft on success', async () => {
      mockMutateEnviarTranscricao.mockImplementation(
        (_vars: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
          opts?.onSuccess?.({
            idEventoClinico: 42,
            dsTranscricao: 'paciente com bom estado geral',
            soap: { s: 'draft s', o: 'draft o', a: 'draft a', p: 'draft p' },
            stSoapConfirmado: false,
          });
        },
      );
      mockIsRecording = true;
      const { getByTestId } = await chegarNoCardTranscricao();

      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });

      expect(mockStop).toHaveBeenCalled();
      expect(mockMutateEnviarTranscricao).toHaveBeenCalledWith(
        { idEventoClinico: 42, audioUri: 'file://mock-audio.m4a', mimeType: 'audio/m4a' },
        expect.any(Object),
      );
      expect(getByTestId('text-transcricao').props.children).toBe('paciente com bom estado geral');
      expect(getByTestId('field-soap-s').props.value).toBe('draft s');
      expect(getByTestId('field-soap-o').props.value).toBe('draft o');
      expect(getByTestId('field-soap-a').props.value).toBe('draft a');
      expect(getByTestId('field-soap-p').props.value).toBe('draft p');
    });

    it('falha de transcrição (Luna indisponível) mostra aviso e mantém campos editáveis manualmente, sem crash', async () => {
      mockMutateEnviarTranscricao.mockImplementation(
        (_vars: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
          opts?.onSuccess?.({
            idEventoClinico: 42,
            dsTranscricao: null,
            soap: { s: null, o: null, a: null, p: null },
            stSoapConfirmado: false,
          });
        },
      );
      mockIsRecording = true;
      const { getByTestId } = await chegarNoCardTranscricao();

      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });

      expect(getByTestId('msg-transcricao-indisponivel')).toBeTruthy();

      fireEvent.changeText(getByTestId('field-soap-s'), 'Digitado manualmente pelo vet');
      expect(getByTestId('field-soap-s').props.value).toBe('Digitado manualmente pelo vet');
    });

    it('pressing "Confirmar SOAP" calls confirmarSoap with the current draft and navigates back on success', async () => {
      mockMutateConfirmarSoap.mockImplementation(
        (_vars: unknown, opts: { onSuccess?: () => void }) => {
          opts?.onSuccess?.();
        },
      );
      const { getByTestId } = await chegarNoCardTranscricao();

      fireEvent.changeText(getByTestId('field-soap-s'), 'Subjetivo final');
      fireEvent.press(getByTestId('btn-confirmar-soap'));

      await waitFor(() => {
        expect(mockMutateConfirmarSoap).toHaveBeenCalledWith(
          { idEventoClinico: 42, dto: { s: 'Subjetivo final', o: '', a: '', p: '' } },
          expect.any(Object),
        );
      });
      await waitFor(() => expect(mockBack).toHaveBeenCalled());
    });

    it('pressing "Concluir sem confirmar SOAP" navigates back without calling confirmarSoap', async () => {
      const { getByTestId } = await chegarNoCardTranscricao();
      fireEvent.press(getByTestId('btn-concluir-sem-soap'));
      expect(mockMutateConfirmarSoap).not.toHaveBeenCalled();
      expect(mockBack).toHaveBeenCalled();
    });
  });
});
