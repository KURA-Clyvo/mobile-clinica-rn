import React from 'react';
import { simularFeedback } from './helpers_feedback';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { StyleSheet, TextInput } from 'react-native';
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
// REC-13: exportada como jest.fn() nomeada (não mais inline) para os testes
// abaixo poderem sobrescrever o retorno por caso (idAgendamento presente/
// ausente) via `mockUseLocalSearchParams.mockReturnValue(...)`.
type ConsultaSearchParams = { idPet: string; idAgendamento?: string; nrVersion?: string };
const mockUseLocalSearchParams = jest.fn<ConsultaSearchParams, []>(() => ({ idPet: '1' }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({ back: mockBack, canGoBack: () => true, replace: mockReplace }),
}));

// REC-13: hook de mutação mockado no nível do módulo — mesmo padrão de
// useCheckinAgendamento em AgendaScreen.test.tsx (não exercita a cadeia real
// service/mock aqui, que já é coberta por agenda.service.test.ts,
// useAgenda.test.ts e mock-contract-audit.test.ts).
const mockMutateIniciarAtendimento = jest.fn();
jest.mock('@hooks/useAgenda', () => ({
  useIniciarAtendimento: jest.fn(() => ({ mutate: mockMutateIniciarAtendimento })),
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
  requestRecordingPermissionsAsync: (..._args: unknown[]) =>
    // FM-09: mockRequestRecordingPermissionsAsync (jest.fn(() => ...)) nao tem parametros --
    // TS2556 antes desta correcao ("spread argument must have tuple type"). O mock ignora
    // args de qualquer forma; _args existe so para casar a assinatura real do expo-audio.
    mockRequestRecordingPermissionsAsync(),
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
  // REC-13: default sem idAgendamento (fluxo antigo, pela ficha do
  // paciente) -- cada teste que precisa do fluxo novo sobrescreve.
  mockUseLocalSearchParams.mockReturnValue({ idPet: '1' });
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
  fireEvent.changeText(getByTestId('field-soap-s'), 'Animal ativo');
  fireEvent.press(getByTestId('btn-salvar'));
}

let fb: ReturnType<typeof simularFeedback>;
beforeEach(() => {
  fb = simularFeedback();
});
afterEach(() => fb.dispose());

describe('ConsultaScreen', () => {
  it('shows motivo validation error when motivo is empty', async () => {
    const { getByTestId, getByText } = wrap(<ConsultaScreen />);
    fireEvent.press(getByTestId('btn-salvar'));
    await waitFor(() => {
      expect(getByText('Informe o motivo da consulta')).toBeTruthy();
    });
  });

  // BR-CLI-T08 (C1 medido): a transcricao exige consulta salva, entao a ordem fica; o que sai
  // e a exigencia de SOAP manual ANTES de gravar. Salvar so com o motivo tem de funcionar.
  it('BR-CLI-T08: salva a consulta so com o motivo (sem exigir SOAP manual antes de gravar)', async () => {
    const { getByTestId, queryByText } = wrap(<ConsultaScreen />);
    fireEvent.changeText(getByTestId('field-motivo'), 'Retorno pós-cirurgia');
    fireEvent.press(getByTestId('btn-salvar'));
    await waitFor(() => expect(mockMutateCriarConsulta).toHaveBeenCalledTimes(1));
    expect(queryByText('Preencha ao menos um campo SOAP')).toBeNull();
  });

  it('calls criarConsulta with correct payload on valid submit', async () => {
    const { getByTestId } = wrap(<ConsultaScreen />);
    fireEvent.changeText(getByTestId('field-motivo'), 'Consulta de rotina');
    fireEvent.changeText(getByTestId('field-soap-s'), 'Animal sem queixas');
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

  // LU-10 (N4 do backlog) — o badge deixou de buscar texto sozinho (mock com
  // setTimeout de 500ms). Antes de qualquer transcrição, `soapDraft` está
  // vazio (`{s:'',o:'',a:'',p:''}`, [idPet].tsx:204) — 0 badges, não um
  // preenchimento assíncrono de texto fixo.
  it('LU-10: sem transcrição ainda, nenhum badge da Luna aparece nos campos SOAP', () => {
    const { queryByTestId } = wrap(<ConsultaScreen />);
    expect(queryByTestId('luna-badge-S')).toBeNull();
    expect(queryByTestId('luna-badge-O')).toBeNull();
    expect(queryByTestId('luna-badge-A')).toBeNull();
    expect(queryByTestId('luna-badge-P')).toBeNull();
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
      fb.responder({ confirmar: true });
      const { getByTestId } = await chegarNoCardTranscricao();

      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });
      await act(async () => {});

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

    // ─── LU-10 (ruling do Felipe, 15/09): badge migrou pro CARD SOAP ───────
    //
    // Achado IMPORTANTE da G2 (Frente 5): o badge nos campos PRINCIPAIS
    // preenchia um formulário que nenhum caminho salva depois da consulta
    // criada — só "Confirmar SOAP" salva, e ele envia `soapDraft` (o card).
    // O badge passou a aplicar ao CARD: `draftText` vem de `rascunhoLuna` (o
    // valor ORIGINAL, imutável, da transcrição) e `currentText` vem de
    // `soapDraft` (o que está no card agora, editável). Ele só aparece
    // quando os dois DIVERGEM — sem edição do vet, não há o que restaurar.
    it('LU-10: logo após a transcrição, nenhum badge aparece no card (soapDraft == rascunhoLuna)', async () => {
      mockMutateEnviarTranscricao.mockImplementation(
        (_vars: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
          opts?.onSuccess?.({
            idEventoClinico: 42,
            dsTranscricao: 'paciente com bom estado geral',
            soap: {
              s: 'Subjetivo real da transcrição',
              o: 'Objetivo real da transcrição',
              a: 'Avaliação real da transcrição',
              p: 'Plano real da transcrição',
            },
            stSoapConfirmado: false,
          });
        },
      );
      mockIsRecording = true;
      fb.responder({ confirmar: true });
      const { getByTestId, queryByTestId } = await chegarNoCardTranscricao();

      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });
      await act(async () => {});
      fb.confirmacoes.length = 0;
      fb.responder({ confirmar: false });

      // O card já chegou preenchido com o rascunho — e por isso NENHUM badge
      // aparece: currentText === draftText nos 4 campos.
      expect(getByTestId('field-soap-s').props.value).toBe('Subjetivo real da transcrição');
      expect(queryByTestId('luna-badge-S')).toBeNull();
      expect(queryByTestId('luna-badge-O')).toBeNull();
      expect(queryByTestId('luna-badge-A')).toBeNull();
      expect(queryByTestId('luna-badge-P')).toBeNull();
    });

    it('LU-10: vet edita o card e diverge do rascunho — o badge aparece e, ao tocar, RESTAURA o rascunho real da Luna', async () => {
      mockMutateEnviarTranscricao.mockImplementation(
        (_vars: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
          opts?.onSuccess?.({
            idEventoClinico: 42,
            dsTranscricao: 'paciente com bom estado geral',
            soap: {
              s: 'Subjetivo real da transcrição',
              o: 'Objetivo real da transcrição',
              a: 'Avaliação real da transcrição',
              p: 'Plano real da transcrição',
            },
            stSoapConfirmado: false,
          });
        },
      );
      mockIsRecording = true;
      const { getByTestId, queryByTestId } = await chegarNoCardTranscricao();

      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });

      // O vet edita o card — diverge do rascunho da Luna.
      fireEvent.changeText(getByTestId('field-soap-s'), 'Texto editado pelo vet');
      expect(getByTestId('luna-badge-S')).toBeTruthy();
      // Os outros 3 continuam iguais ao rascunho — badge continua oculto.
      expect(queryByTestId('luna-badge-O')).toBeNull();

      fb.responder({ confirmar: true });
      fireEvent.press(getByTestId('luna-badge-S'));

      // Restaura o rascunho REAL — nunca o texto fixo que
      // `mocks/luna.mock.ts::SOAP_SUGESTOES.S` devolvia antes do LU-10.
      await waitFor(() =>
        expect(getByTestId('field-soap-s').props.value).toBe('Subjetivo real da transcrição'),
      );
      expect(getByTestId('field-soap-s').props.value).not.toBe(
        'Tutor relata apatia há 2 dias e diminuição do apetite.',
      );
    });

    it('LU-10: campo do rascunho vazio/null — nenhum badge para AQUELE campo, mesmo se o vet editar (nada a restaurar)', async () => {
      mockMutateEnviarTranscricao.mockImplementation(
        (_vars: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
          opts?.onSuccess?.({
            idEventoClinico: 42,
            dsTranscricao: 'transcrição parcial',
            // O (objetivo) e A (avaliação) vieram vazios/nulos da transcrição —
            // só S e P têm rascunho de verdade.
            soap: { s: 'Subjetivo captado', o: '', a: null, p: 'Plano captado' },
            stSoapConfirmado: false,
          });
        },
      );
      mockIsRecording = true;
      const { getByTestId, queryByTestId } = await chegarNoCardTranscricao();

      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });

      // Edita os 4 campos do card — diverge de tudo.
      fireEvent.changeText(getByTestId('field-soap-s'), 'S editado');
      fireEvent.changeText(getByTestId('field-soap-o'), 'O digitado do zero');
      fireEvent.changeText(getByTestId('field-soap-a'), 'A digitado do zero');
      fireEvent.changeText(getByTestId('field-soap-p'), 'P editado');

      expect(getByTestId('luna-badge-S')).toBeTruthy();
      expect(getByTestId('luna-badge-P')).toBeTruthy();
      // O e A nunca tiveram rascunho — sem draftText, o badge nunca aparece,
      // não importa o quanto o vet edite.
      expect(queryByTestId('luna-badge-O')).toBeNull();
      expect(queryByTestId('luna-badge-A')).toBeNull();
    });

    it('LU-10: campo editado com texto NÃO-vazio — tocar no badge pede confirmação antes de restaurar', async () => {
      mockMutateEnviarTranscricao.mockImplementation(
        (_vars: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
          opts?.onSuccess?.({
            idEventoClinico: 42,
            dsTranscricao: 'transcrição',
            soap: { s: 'Rascunho real da Luna', o: '', a: '', p: '' },
            stSoapConfirmado: false,
          });
        },
      );
      mockIsRecording = true;
      fb.responder({ confirmar: true });
      const { getByTestId } = await chegarNoCardTranscricao();

      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });
      await act(async () => {});
      fb.confirmacoes.length = 0;
      fb.responder({ confirmar: false });

      // O vet edita o campo do card (diverge do rascunho) com texto próprio.
      fireEvent.changeText(getByTestId('field-soap-s'), 'Já digitado pelo vet');

      fireEvent.press(getByTestId('luna-badge-S'));

      await waitFor(() => expect(fb.confirmacoes).toHaveLength(1));
      expect(fb.confirmacoes[0]).toMatchObject({
        titulo: 'Substituir texto atual?',
        verbo: 'Substituir',
      });
      // Sem confirmar, o texto digitado pelo vet permanece intacto.
      expect(getByTestId('field-soap-s').props.value).toBe('Já digitado pelo vet');
    });

    // Item 4 do brief LU-10 (fecha o IMPORTANTE O↔A da Frente 2, `:93`):
    // mapeamento testado nos 4 campos ao mesmo tempo. Mordida: trocar O↔A no
    // mapeamento do badge do card faz este teste falhar nominalmente
    // (reproduzido manualmente nesta task, ver relatório).
    it('LU-10: mapeamento de letra é correto nos 4 campos do card (fecha o IMPORTANTE O↔A da G2)', async () => {
      mockMutateEnviarTranscricao.mockImplementation(
        (_vars: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
          opts?.onSuccess?.({
            idEventoClinico: 42,
            dsTranscricao: 'transcrição completa',
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

      // Diverge os 4 campos do rascunho para os 4 badges aparecerem.
      fireEvent.changeText(getByTestId('field-soap-s'), 'editado s');
      fireEvent.changeText(getByTestId('field-soap-o'), 'editado o');
      fireEvent.changeText(getByTestId('field-soap-a'), 'editado a');
      fireEvent.changeText(getByTestId('field-soap-p'), 'editado p');

      fb.responder({ confirmar: true });

      fireEvent.press(getByTestId('luna-badge-S'));
      fireEvent.press(getByTestId('luna-badge-O'));
      fireEvent.press(getByTestId('luna-badge-A'));
      fireEvent.press(getByTestId('luna-badge-P'));

      await waitFor(() => expect(getByTestId('field-soap-p').props.value).toBe('draft p'));
      expect(getByTestId('field-soap-s').props.value).toBe('draft s');
      expect(getByTestId('field-soap-o').props.value).toBe('draft o');
      expect(getByTestId('field-soap-a').props.value).toBe('draft a');
      expect(getByTestId('field-soap-p').props.value).toBe('draft p');
    });

    // Item 5 do brief LU-10: o rascunho aplicado pelo badge chega ao que é
    // de fato SALVO ("Confirmar SOAP" envia `soapDraft`, o card). Mordida:
    // se o badge voltasse a chamar `setValue` do formulário (campo
    // principal) em vez de `setSoapDraft`, o dto enviado NÃO teria o texto
    // restaurado — este teste falharia nominalmente.
    it('LU-10: o rascunho aplicado pelo badge chega ao dto que "Confirmar SOAP" envia', async () => {
      mockMutateEnviarTranscricao.mockImplementation(
        (_vars: unknown, opts: { onSuccess?: (r: unknown) => void }) => {
          opts?.onSuccess?.({
            idEventoClinico: 42,
            dsTranscricao: 'transcrição',
            soap: { s: 'Rascunho real da Luna', o: '', a: '', p: '' },
            stSoapConfirmado: false,
          });
        },
      );
      mockIsRecording = true;
      const { getByTestId } = await chegarNoCardTranscricao();

      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });

      fireEvent.changeText(getByTestId('field-soap-s'), 'texto que o vet vai descartar');
      fb.responder({ confirmar: true });
      fireEvent.press(getByTestId('luna-badge-S'));
      await waitFor(() => expect(getByTestId('field-soap-s').props.value).toBe('Rascunho real da Luna'));

      mockMutateConfirmarSoap.mockImplementation(
        (_vars: unknown, opts: { onSuccess?: () => void }) => {
          opts?.onSuccess?.();
        },
      );
      fireEvent.press(getByTestId('btn-confirmar-soap'));

      await waitFor(() => {
        expect(mockMutateConfirmarSoap).toHaveBeenCalledWith(
          { idEventoClinico: 42, dto: { s: 'Rascunho real da Luna', o: '', a: '', p: '' } },
          expect.any(Object),
        );
      });
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

// FT-08, fix wave G2 (G2-1): o header desta tela usa a variante 1080
// (dsFotoUrl, regra A5 — detalhe usa a 1080, lista usa a thumb 256). Antes
// desta fix wave, NENHUM teste deste arquivo passava dsFoto* no mock de
// usePetDetail — trocar por thumb ou remover a foto passava verde (G2, C8/C10,
// `184 passed`, `EXIT=0`, "NINGUÉM" pegava).
describe('ConsultaScreen — avatar com foto real no header (FT-08, fix wave G2)', () => {
  const FOTO_1080 =
    'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/1/uuid_1080.webp?exp=1&sig=a';
  const FOTO_256 =
    'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/1/uuid_256.webp?exp=1&sig=b';

  it('passa a variante 1080 (dsFotoUrl) para o portrait do header — mordida: trocar por dsFotoThumbUrl faz esta asserção falhar', () => {
    mockUsePetDetail.mockReturnValue({
      data: { ...MOCK_PET, dsFotoUrl: FOTO_1080, dsFotoThumbUrl: FOTO_256 },
      isLoading: false,
      isError: false,
    });
    const { getByTestId } = wrap(<ConsultaScreen />);
    const foto = getByTestId('kc-pet-portrait-foto');
    expect(foto.props.source[0].uri).toBe(FOTO_1080);
  });

  it('sem foto, o header continua mostrando a ilustração — mordida: remover a foto sem este teste passa verde', () => {
    mockUsePetDetail.mockReturnValue({ data: MOCK_PET, isLoading: false, isError: false });
    const { queryByTestId } = wrap(<ConsultaScreen />);
    expect(queryByTestId('kc-pet-portrait-foto')).toBeNull();
  });
});

// ─── REC-13: início de atendimento ao montar o prontuário ──────────────────
//
// A linha da agenda "Hoje" abre consulta/[idPet]?idAgendamento=…&nrVersion=…
// (agenda.tsx::handleAbrirProntuario); a ficha do paciente continua abrindo
// só consulta/[idPet] (pacientes/[id].tsx, sem idAgendamento). A tela chama
// `/inicio-atendimento` (via useIniciarAtendimento) UMA vez ao montar SE
// idAgendamento existir; erro nunca bloqueia o formulário.
describe('ConsultaScreen — início de atendimento ao montar (REC-13)', () => {
  it('COM idAgendamento na query: chama iniciarAtendimento exatamente 1 vez ao montar, com idAgendamento e nrVersion', () => {
    mockUseLocalSearchParams.mockReturnValue({ idPet: '1', idAgendamento: '30', nrVersion: '2' });
    wrap(<ConsultaScreen />);

    expect(mockMutateIniciarAtendimento).toHaveBeenCalledTimes(1);
    expect(mockMutateIniciarAtendimento).toHaveBeenCalledWith(
      { idAgendamento: 30, nrVersion: 2 },
      expect.any(Object),
    );
  });

  // MORDIDA (aceite do backlog: "abrir sem idAgendamento não chama nada").
  // Reproduzida manualmente nesta task: comentar a guarda
  // `if (!idAgendamentoNum || ...) return;` em consulta/[idPet].tsx faz este
  // teste falhar (a chamada acontece mesmo sem idAgendamento na query) — ver
  // relatório da task para o registro da mordida.
  it('SEM idAgendamento na query (fluxo antigo, pela ficha do paciente): NÃO chama iniciarAtendimento', () => {
    mockUseLocalSearchParams.mockReturnValue({ idPet: '1' });
    wrap(<ConsultaScreen />);

    expect(mockMutateIniciarAtendimento).not.toHaveBeenCalled();
  });

  it('SEM nrVersion na query (mas COM idAgendamento): chama com nrVersion 0, sem quebrar', () => {
    mockUseLocalSearchParams.mockReturnValue({ idPet: '1', idAgendamento: '30' });
    wrap(<ConsultaScreen />);

    expect(mockMutateIniciarAtendimento).toHaveBeenCalledWith(
      { idAgendamento: 30, nrVersion: 0 },
      expect.any(Object),
    );
  });

  // G2 REC-13 (achado M-2): este teste faz um RE-RENDER (`rerender`), não uma
  // remontagem — quem garante a chamada única aqui é o array de dependências
  // do `useEffect` (`idAgendamentoNum`/`nrVersionNum` não mudam), não o `ref`.
  // O nome antigo citava "StrictMode double-invoke", mas este app NÃO usa
  // `<React.StrictMode>` (`git grep "StrictMode" -- src` só acha texto de
  // comentário) — o `ref` é defesa em profundidade para esse cenário
  // hipotético, não a proteção medida por este teste. Uma REMONTAGEM de
  // verdade (sair da tela e voltar) chama de novo por desenho — quem protege
  // contra duplicar o efeito nesse caso é a idempotência do servidor
  // (AgendaService.cs:472-473, ver comentário em consulta/[idPet].tsx).
  it('re-render da tela com as mesmas props NÃO duplica a chamada (array de dependências do useEffect)', () => {
    mockUseLocalSearchParams.mockReturnValue({ idPet: '1', idAgendamento: '30', nrVersion: '2' });
    const { rerender } = wrap(<ConsultaScreen />);
    expect(mockMutateIniciarAtendimento).toHaveBeenCalledTimes(1);

    rerender(<ConsultaScreen />);
    expect(mockMutateIniciarAtendimento).toHaveBeenCalledTimes(1);
  });

  it('falha (não-409, ex.: 422 de status não elegível) não bloqueia o prontuário: a tela renderiza normalmente, sem aviso', async () => {
    mockUseLocalSearchParams.mockReturnValue({ idPet: '1', idAgendamento: '30', nrVersion: '2' });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockMutateIniciarAtendimento.mockImplementation(
      (_vars: unknown, opts: { onError?: (err: unknown) => void }) => {
        opts?.onError?.(Object.assign(new Error('Etapa não elegível'), { status: 422 }));
      },
    );

    const { getByTestId } = wrap(<ConsultaScreen />);

    // A tela continua utilizável -- formulário renderiza, campos aceitam
    // texto normalmente, nada crashou nem ficou preso.
    expect(getByTestId('btn-salvar')).toBeTruthy();
    fireEvent.changeText(getByTestId('field-motivo'), 'Consulta apesar do erro');
    expect(getByTestId('field-motivo').props.value).toBe('Consulta apesar do erro');
    expect(warnSpy).toHaveBeenCalledWith(
      '[REC-13] Falha ao registrar início de atendimento:',
      expect.any(Object),
    );
    // G0/G2 classificam este caso (422, ex.: reabrir prontuário de
    // agendamento já REALIZADO) como inofensivo -- não precisa de aviso
    // visível, só diagnóstico.
    expect(fb.avisos).toEqual([]);

    warnSpy.mockRestore();
  });

  // G2 REC-13 (achado Important `I-1`): um 409 por `nrVersion` desatualizado
  // (duas recepções/aparelhos tocando o mesmo agendamento) deixava a linha
  // presa em `CHEGOU` na "Hoje", com "esperando há N min" subindo e NENHUM
  // sinal visível (`console.warn` some em build de release). Mesmo padrão já
  // usado NESTE APP para o MESMO 409, na MESMA entidade
  // (agenda.tsx::handleChegou/handleFaltou, `agenda.tsx:747-752/776-781`).
  it('409 por nrVersion desatualizado mostra avisar() (mesmo texto de agenda.tsx::handleChegou/handleFaltou) e não bloqueia o prontuário', () => {
    mockUseLocalSearchParams.mockReturnValue({ idPet: '1', idAgendamento: '30', nrVersion: '2' });
    mockMutateIniciarAtendimento.mockImplementation(
      (_vars: unknown, opts: { onError?: (err: unknown) => void }) => {
        opts?.onError?.(Object.assign(new Error('Conflito'), { status: 409 }));
      },
    );

    const { getByTestId } = wrap(<ConsultaScreen />);

    expect(fb.avisos).toEqual([
      {
        titulo: 'Agendamento desatualizado',
        mensagem:
          'Este agendamento foi alterado por outro processo. A lista foi recarregada — confira o estado atual antes de tentar de novo.',
      },
    ]);
    // Não bloqueia -- o formulário continua usável depois do aviso.
    expect(getByTestId('btn-salvar')).toBeTruthy();

  });
});

// ─── BR-CLI-T08: rascunho SOAP da Luna que parece rascunho (CFMV 1.465/2022) ────────────────
// A prova do rascunho e em MOCK de transcricao (OPENAI_API_KEY vazia na fonte, A12).
describe('ConsultaScreen — rascunho SOAP da Luna (BR-CLI-T08)', () => {
  const SOAP = { s: 'Tutora relata apetite normal', o: 'Abdome sem dor', a: 'Gastroenterite em resolução', p: 'Manter dieta' };

  const RESP = { idEventoClinico: 42, dsTranscricao: 'fala', soap: SOAP, stSoapConfirmado: false };
  // Fila de respostas: cada gravacao consome a proxima (a ultima se repete).
  async function comTranscricao(
    resposta: unknown = RESP,
    substituir = true,
  ) {
    const fila = Array.isArray(resposta) ? [...resposta] : [resposta];
    mockMutateEnviarTranscricao.mockImplementation(
      (_v: unknown, opts: { onSuccess?: (r: unknown) => void }) =>
        opts?.onSuccess?.(fila.length > 1 ? fila.shift() : fila[0]),
    );
    mockIsRecording = true;
    // O vet ja escreveu S antes de gravar (criarConsultaComSucesso): a Luna pergunta antes de trocar.
    fb.responder({ confirmar: substituir });
    const utils = wrap(<ConsultaScreen />);
    criarConsultaComSucesso(utils.getByTestId);
    await waitFor(() => expect(utils.getByTestId('card-transcricao')).toBeTruthy());
    await act(async () => {
      fireEvent.press(utils.getByTestId('btn-gravar'));
    });
    await act(async () => {});
    // I-2 (G2): a evidencia da pergunta de substituir NAO some -- fica em `substituicoes`.
    const substituicoes = fb.confirmacoes.map((c) => c.titulo);
    fb.confirmacoes.length = 0; // so a confirmacao de substituir (S ja escrito) nao conta nos testes abaixo
    return { ...utils, substituicoes };
  }

  it('existe UM unico conjunto S/O/A/P (sem o segundo conjunto do card)', async () => {
    const { UNSAFE_getAllByType, getAllByTestId } = await comTranscricao();
    // S/O/A/P aparecem UMA vez (antes: form + card, mesmos 4 testIDs duplicados)
    expect(getAllByTestId(/^field-soap-/)).toHaveLength(4);
    expect(UNSAFE_getAllByType(TextInput).filter((n: { props: { testID?: string } }) => /^field-soap-/.test(n.props.testID ?? ''))).toHaveLength(4);
  });

  it('cada campo gerado tem o selo "Rascunho da Luna — revise e confirme"', async () => {
    const { getByTestId } = await comTranscricao();
    for (const l of ['S', 'O', 'A', 'P']) {
      expect(getByTestId(`selo-rascunho-${l}`)).toBeTruthy();
    }
    expect(getByTestId('selo-rascunho-S').findAll((n) => n.props.children === 'Rascunho da Luna — revise e confirme').length).toBeGreaterThan(0);
    expect(getByTestId('banner-rascunho')).toBeTruthy();
  });

  it('editar o campo mantem o selo ate confirmar', async () => {
    const { getByTestId } = await comTranscricao();
    fireEvent.changeText(getByTestId('field-soap-s'), 'editado pelo vet');
    expect(getByTestId('selo-rascunho-S')).toBeTruthy();
  });

  it('campo que a Luna deixou vazio nao ganha selo', async () => {
    const { getByTestId, queryByTestId } = await comTranscricao({
      idEventoClinico: 42, dsTranscricao: 'fala', soap: { s: 'so o S', o: null, a: '', p: null }, stSoapConfirmado: false,
    });
    expect(getByTestId('selo-rascunho-S')).toBeTruthy();
    expect(queryByTestId('selo-rascunho-O')).toBeNull();
    expect(queryByTestId('selo-rascunho-A')).toBeNull();
    expect(queryByTestId('selo-rascunho-P')).toBeNull();
  });

  it('Confirmar remove o selo, da toast com o verbo e navega', async () => {
    mockMutateConfirmarSoap.mockImplementation((_v: unknown, opts: { onSuccess?: () => void }) => opts?.onSuccess?.());
    const { getByTestId, queryByTestId } = await comTranscricao();
    fireEvent.press(getByTestId('btn-confirmar-soap'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    for (const l of ['S', 'O', 'A', 'P']) expect(queryByTestId(`selo-rascunho-${l}`)).toBeNull();
    expect(queryByTestId('banner-rascunho')).toBeNull();
    expect(fb.toasts.map((t) => t.texto).join('|')).toMatch(/confirmad/i);
  });

  it('Confirmar com falha NAO remove o selo (nada entrou no prontuario)', async () => {
    mockMutateConfirmarSoap.mockImplementation((_v: unknown, opts: { onError?: (e: unknown) => void }) => opts?.onError?.({ message: 'x' }));
    const { getByTestId } = await comTranscricao();
    fireEvent.press(getByTestId('btn-confirmar-soap'));
    expect(getByTestId('selo-rascunho-S')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('Concluir sem confirmar, com rascunho pendente, pede confirmacao destrutiva; recusar mantem na tela', async () => {
    const { getByTestId } = await comTranscricao();
    fb.responder({ confirmar: false });
    fireEvent.press(getByTestId('btn-concluir-sem-soap'));
    await waitFor(() => expect(fb.confirmacoes).toHaveLength(1));
    expect(fb.confirmacoes[0]).toMatchObject({ destrutivo: true });
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockMutateConfirmarSoap).not.toHaveBeenCalled();
  });

  it('Concluir sem confirmar, aceitando a confirmacao, navega sem chamar confirmarSoap', async () => {
    const { getByTestId } = await comTranscricao();
    fb.responder({ confirmar: true });
    fireEvent.press(getByTestId('btn-concluir-sem-soap'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockMutateConfirmarSoap).not.toHaveBeenCalled();
  });

  it('Descartar rascunho devolve os campos ao que o vet tinha e tira os selos', async () => {
    const { getByTestId, queryByTestId } = await comTranscricao();
    fireEvent.press(getByTestId('btn-descartar-rascunho'));
    expect(queryByTestId('selo-rascunho-S')).toBeNull();
    expect(getByTestId('field-soap-s').props.value).toBe('Animal ativo');
    expect(getByTestId('field-soap-o').props.value).toBe('');
  });

  it('{transcricao:null, soap:null} (A12): aviso de indisponivel, nenhum selo, campos intocados', async () => {
    const { getByTestId, queryByTestId } = await comTranscricao({
      idEventoClinico: 42, dsTranscricao: null, soap: null, stSoapConfirmado: false,
    });
    expect(getByTestId('msg-transcricao-indisponivel')).toBeTruthy();
    expect(queryByTestId('banner-rascunho')).toBeNull();
    for (const l of ['S', 'O', 'A', 'P']) expect(queryByTestId(`selo-rascunho-${l}`)).toBeNull();
    expect(getByTestId('field-soap-s').props.value).toBe('Animal ativo');
  });

  it('M-b: shape REAL do .NET {soap:{s:null,o:null,a:null,p:null}} tambem vira indisponivel, sem selo', async () => {
    const { getByTestId, queryByTestId } = await comTranscricao({
      idEventoClinico: 42, dsTranscricao: null, soap: { s: null, o: null, a: null, p: null }, stSoapConfirmado: false,
    });
    expect(getByTestId('msg-transcricao-indisponivel')).toBeTruthy();
    for (const l of ['S', 'O', 'A', 'P']) expect(queryByTestId(`selo-rascunho-${l}`)).toBeNull();
  });

  it('M-d: Luna transcreveu mas nao montou o rascunho -> mostra a transcricao e nao diz "indisponivel"', async () => {
    const { getByTestId, queryByTestId } = await comTranscricao({
      idEventoClinico: 42, dsTranscricao: 'o tutor falou X', soap: { s: null, o: null, a: null, p: null }, stSoapConfirmado: false,
    });
    expect(getByTestId('text-transcricao').props.children).toBe('o tutor falou X');
    expect(getByTestId('msg-sem-rascunho').props.children).toMatch(/não montou o rascunho/);
    expect(queryByTestId('msg-transcricao-indisponivel')).toBeNull();
    for (const l of ['S', 'O', 'A', 'P']) expect(queryByTestId(`selo-rascunho-${l}`)).toBeNull();
  });

  it('I-3: o toast so promete "SOAP confirmado" (a ficha ainda nao mostra o SOAP)', async () => {
    mockMutateConfirmarSoap.mockImplementation((_v: unknown, opts: { onSuccess?: () => void }) => opts?.onSuccess?.());
    const { getByTestId } = await comTranscricao();
    fireEvent.press(getByTestId('btn-confirmar-soap'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(fb.toasts.map((t) => t.texto)).toEqual(['SOAP confirmado']);
  });

  // ─── I-2 (G2): a pergunta de substituicao protege o texto do vet ───────────────────────────
  it('I-2: S ja escrito pelo vet -> pergunta "Substituir o que voce escreveu?"; "sim" troca por texto da Luna com selo', async () => {
    const { getByTestId, substituicoes } = await comTranscricao(RESP, true);
    expect(substituicoes).toEqual(['Substituir o que você escreveu?']);
    expect(getByTestId('field-soap-s').props.value).toBe(SOAP.s);
    expect(getByTestId('selo-rascunho-S')).toBeTruthy();
  });

  it('I-2: "so nos campos vazios" (nao) deixa S do vet intocado e sem selo; O/A/P entram com selo', async () => {
    const { getByTestId, queryByTestId, substituicoes } = await comTranscricao(RESP, false);
    expect(substituicoes).toEqual(['Substituir o que você escreveu?']);
    expect(getByTestId('field-soap-s').props.value).toBe('Animal ativo');
    expect(queryByTestId('selo-rascunho-S')).toBeNull();
    expect(getByTestId('field-soap-o').props.value).toBe(SOAP.o);
    expect(getByTestId('selo-rascunho-O')).toBeTruthy();
  });

  // ─── I-1 (G2): texto da Luna NUNCA fica num campo sem selo ─────────────────────────────────
  it('I-1/P1: Descartar esquece o rascunho — sem selo, sem faixa e o badge da Luna some (nao reinsere sem selo)', async () => {
    const { getByTestId, queryByTestId } = await comTranscricao();
    fireEvent.press(getByTestId('btn-descartar-rascunho'));
    expect(getByTestId('field-soap-o').props.value).toBe('');
    expect(getByTestId('field-soap-s').props.value).toBe('Animal ativo');
    expect(queryByTestId('luna-badge-O')).toBeNull();
    expect(queryByTestId('luna-badge-S')).toBeNull();
    expect(queryByTestId('banner-rascunho')).toBeNull();
    for (const l of ['S', 'O', 'A', 'P']) expect(queryByTestId(`selo-rascunho-${l}`)).toBeNull();
  });

  it('I-1/P2: depois de "so nos campos vazios", o badge de S reinsere o texto da Luna COM selo', async () => {
    const { getByTestId } = await comTranscricao(RESP, false);
    fb.responder({ confirmar: true });
    await act(async () => { fireEvent.press(getByTestId('luna-badge-S')); });
    await act(async () => {});
    expect(getByTestId('field-soap-s').props.value).toBe(SOAP.s);
    expect(getByTestId('selo-rascunho-S')).toBeTruthy();
  });

  const RESP2 = { idEventoClinico: 42, dsTranscricao: 'f2', soap: { s: null, o: 'O novo', a: null, p: null }, stSoapConfirmado: false };

  it('I-1/P3: 2a gravacao que so gera O NAO tira o selo de S/A/P (texto da 1a, nunca confirmado)', async () => {
    const { getByTestId } = await comTranscricao([RESP, RESP2]);
    await act(async () => { fireEvent.press(getByTestId('btn-gravar')); });
    await act(async () => {});
    expect(getByTestId('field-soap-o').props.value).toBe('O novo');
    for (const l of ['S', 'O', 'A', 'P']) expect(getByTestId(`selo-rascunho-${l}`)).toBeTruthy();
    expect(getByTestId('field-soap-a').props.value).toBe(SOAP.a);
  });

  it('I-1/P4: texto da Luna entrou pelo badge (apos "so vazios") -> "Concluir sem confirmar" pergunta', async () => {
    const { getByTestId } = await comTranscricao(RESP, false);
    fb.responder({ confirmar: true });
    await act(async () => { fireEvent.press(getByTestId('luna-badge-S')); });
    await act(async () => {});
    fb.confirmacoes.length = 0;
    fb.responder({ confirmar: false });
    fireEvent.press(getByTestId('btn-concluir-sem-soap'));
    await act(async () => {});
    expect(fb.confirmacoes).toHaveLength(1);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('I-1/P5: P3 + Descartar volta TODOS os campos ao texto do vet (nada da 1a transcricao sobra sem selo)', async () => {
    const { getByTestId, queryByTestId } = await comTranscricao([RESP, RESP2]);
    await act(async () => { fireEvent.press(getByTestId('btn-gravar')); });
    await act(async () => {});
    fireEvent.press(getByTestId('btn-descartar-rascunho'));
    expect(getByTestId('field-soap-s').props.value).toBe('Animal ativo');
    for (const l of ['o', 'a', 'p']) expect(getByTestId(`field-soap-${l}`).props.value).toBe('');
    for (const l of ['S', 'O', 'A', 'P']) expect(queryByTestId(`selo-rascunho-${l}`)).toBeNull();
  });
});
