import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import ConsultaScreen from '../src/app/(app)/consulta/[idPet]';
import { useAuthStore } from '../src/store/authStore';
import { layout } from '../src/theme/tokens';

const mockBack = jest.fn();
// FM-01: `replace` entra no mock porque a tela passou a redirecionar quem nao
// tem ficha de veterinario. Sem ele, `router.replace` seria `undefined` e a
// guarda quebraria -- e o teste falharia por um motivo diferente do real.
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ idPet: '1' })),
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
}));

// CQ-15: ScreenContainer usa <SafeAreaView> deste módulo — o mock antigo só
// tinha `useSafeAreaInsets`, então importar ScreenContainer aqui derrubaria o
// render com "Element type is invalid" antes mesmo de chegar ao teste.
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
  setViewport(400, 800);
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

// CQ-15: prova de mordida — falha contra a tela sem ScreenContainer (o
// testID/estilo 'screen-container-content' não existe hoje), passa depois da
// adoção. Estilo declarado, não px calculado (react-test-renderer não
// computa layout Yoga).
describe('ConsultaScreen — ScreenContainer adoption (CQ-15)', () => {
  it('respects layout.maxContentWidth at 1440×900 (xl)', () => {
    setViewport(1440, 900);
    const { getByTestId } = wrap(<ConsultaScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(layout.maxContentWidth);
  });

  // CQ-15 fix wave rodada 3 (G2 rodada 2, Minor #3): a G2 reproduziu que
  // remover `paddingHorizontal={0}` deixava a suíte inteira verde — o header
  // do pet, o form e o rodapé já controlam seu próprio respiro horizontal.
  it('applies paddingHorizontal:0 (header/form/footer control their own horizontal padding)', () => {
    const { getByTestId } = wrap(<ConsultaScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { paddingHorizontal?: number };
    expect(flatStyle.paddingHorizontal).toBe(0);
  });
});

// ─── FM-01, fix wave pós-G2: a guarda de papel ─────────────────────────────
//
// 🔴 ACHADO `Important` DA REVISÃO G2: o brief da FM-01 exigia teste do
// redirect e **não havia nenhum**. A revisão escreveu um descartável e mediu
// que, sem guarda de RENDER, o formulário clínico inteiro renderizava antes
// de o `useEffect` disparar o `router.replace` — um GESTOR sem ficha chegando
// por URL direta (a plataforma alvo é web) via, por um quadro, um formulário
// que ele não pode submeter.
//
// ⛔ Isto NÃO resolve o `E27` (telas sem saída visível), que continua decisão
// aberta do Felipe — nada de header, seta de voltar ou `_layout.tsx`. A
// guarda existe para **não piorar** o E27: esconder a ação em
// `pacientes/[id].tsx` não impede chegar aqui por link.
describe('ConsultaScreen — guarda de ficha de veterinário (FM-01)', () => {
  it('SEM ficha: redireciona para a ficha do pet', () => {
    useAuthStore.setState({
      token: 'tok',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      email: 'gestor@kura.vet',
      tpPerfil: 'GESTOR',
      usuario: null,
    });

    wrap(<ConsultaScreen />);

    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/pacientes/1');
  });

  // 🔴 A metade que a revisão mediu e que só a guarda de RENDER resolve: não
  // basta redirecionar, o formulário não pode PISCAR no caminho.
  it('SEM ficha: o formulário não chega a renderizar (sem flash)', () => {
    useAuthStore.setState({
      token: 'tok',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      email: 'gestor@kura.vet',
      tpPerfil: 'GESTOR',
      usuario: null,
    });

    const { queryByTestId } = wrap(<ConsultaScreen />);

    // `btn-salvar` é o CTA do formulário. Se ele existe na árvore, o
    // formulário renderizou — que é exatamente o quadro intermediário que a
    // guarda elimina.
    expect(queryByTestId('btn-salvar')).toBeNull();
  });

  // Controle positivo: COM ficha, nada disso acontece. Sem este caso, os dois
  // acima seriam compatíveis com "a tela nunca renderiza" e com "a tela sempre
  // redireciona".
  it('CONTROLE — COM ficha: renderiza o formulário e NÃO redireciona', () => {
    const { getByTestId } = wrap(<ConsultaScreen />);

    expect(getByTestId('btn-salvar')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
