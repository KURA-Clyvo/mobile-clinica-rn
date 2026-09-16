import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { StyleSheet, Alert } from 'react-native';
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
      const { getByTestId, queryByTestId } = await chegarNoCardTranscricao();

      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });

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

      jest.spyOn(Alert, 'alert').mockImplementationOnce((_title, _msg, buttons) => {
        const substituir = buttons?.find((b) => b.text === 'Substituir');
        substituir?.onPress?.();
      });
      fireEvent.press(getByTestId('luna-badge-S'));

      // Restaura o rascunho REAL — nunca o texto fixo que
      // `mocks/luna.mock.ts::SOAP_SUGESTOES.S` devolvia antes do LU-10.
      expect(getByTestId('field-soap-s').props.value).toBe('Subjetivo real da transcrição');
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
      const { getByTestId } = await chegarNoCardTranscricao();

      await act(async () => {
        fireEvent.press(getByTestId('btn-gravar'));
      });

      // O vet edita o campo do card (diverge do rascunho) com texto próprio.
      fireEvent.changeText(getByTestId('field-soap-s'), 'Já digitado pelo vet');

      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      fireEvent.press(getByTestId('luna-badge-S'));

      expect(alertSpy).toHaveBeenCalledWith(
        'Substituir texto atual?',
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancelar' }),
          expect.objectContaining({ text: 'Substituir' }),
        ]),
      );
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

      jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
        const substituir = buttons?.find((b) => b.text === 'Substituir');
        substituir?.onPress?.();
      });

      fireEvent.press(getByTestId('luna-badge-S'));
      fireEvent.press(getByTestId('luna-badge-O'));
      fireEvent.press(getByTestId('luna-badge-A'));
      fireEvent.press(getByTestId('luna-badge-P'));

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
      jest.spyOn(Alert, 'alert').mockImplementationOnce((_title, _msg, buttons) => {
        const substituir = buttons?.find((b) => b.text === 'Substituir');
        substituir?.onPress?.();
      });
      fireEvent.press(getByTestId('luna-badge-S'));

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
