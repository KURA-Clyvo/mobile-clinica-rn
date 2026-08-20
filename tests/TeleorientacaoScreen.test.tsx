import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Linking, StyleSheet } from 'react-native';
import { ThemeProvider } from '../src/theme';
import TeleorientacaoScreen from '../src/app/(app)/teleorientacao/[idPet]';
import { useAuthStore } from '../src/store/authStore';
import { CFMV_TELEORIENTACAO_BANNER } from '../src/constants/compliance';
import { layout } from '../src/theme/tokens';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({ idPet: '1' } as Record<string, string>));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({ back: mockBack }),
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
jest.mock('@hooks/useTeleconsulta', () => ({ useTeleconsulta: jest.fn() }));

import { usePetDetail } from '../src/hooks/usePetDetail';
import { useTeleconsulta } from '../src/hooks/useTeleconsulta';
const mockUsePetDetail = usePetDetail as jest.Mock;
const mockUseTeleconsulta = useTeleconsulta as jest.Mock;

const IDLE_QUERY = { data: undefined, isLoading: false, error: null };
const IDLE_MUTATION = { data: undefined, isPending: false, error: null, mutate: jest.fn() };

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
  setViewport(400, 800);
  useAuthStore.setState({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), usuario: MOCK_VET });
  mockUsePetDetail.mockReturnValue({ data: MOCK_PET, isLoading: false, isError: false });
  mockUseTeleconsulta.mockReturnValue({ query: IDLE_QUERY, mutation: IDLE_MUTATION });
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

  it('sem idAgendamento (entrada ad-hoc), mostra mensagem para usar a Agenda', () => {
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    expect(getByTestId('msg-sem-agendamento')).toBeTruthy();
  });
});

describe('TeleorientacaoScreen — com idAgendamento (wired ao backend)', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ idPet: '1', idAgendamento: '42' });
  });

  it('mostra botão "Iniciar chamada" quando a sala ainda não foi criada', () => {
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    expect(getByTestId('btn-iniciar-chamada')).toBeTruthy();
  });

  it('pressing "Iniciar chamada" dispara a mutation', () => {
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    fireEvent.press(getByTestId('btn-iniciar-chamada'));
    expect(IDLE_MUTATION.mutate).toHaveBeenCalledTimes(1);
  });

  it('mostra spinner enquanto carrega', () => {
    mockUseTeleconsulta.mockReturnValue({
      query: IDLE_QUERY,
      mutation: { ...IDLE_MUTATION, isPending: true },
    });
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    expect(getByTestId('loading-sala')).toBeTruthy();
  });

  it('mostra "Entrar na sala" quando a sala já foi criada, e abre a URL ao pressionar', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    mockUseTeleconsulta.mockReturnValue({
      query: {
        data: { idAgendamento: 42, dsSalaUrl: 'https://kura.daily.co/room-42', dsProvedorVideo: 'DAILY', dtInicioSessao: null, stFallbackManual: false },
        isLoading: false,
        error: null,
      },
      mutation: IDLE_MUTATION,
    });
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    fireEvent.press(getByTestId('btn-entrar-sala'));
    expect(openURLSpy).toHaveBeenCalledWith('https://kura.daily.co/room-42');
  });

  it('mostra mensagem de fallback manual quando o Daily.co falha', () => {
    mockUseTeleconsulta.mockReturnValue({
      query: IDLE_QUERY,
      mutation: {
        ...IDLE_MUTATION,
        data: { idAgendamento: 42, dsSalaUrl: null, dsProvedorVideo: null, dtInicioSessao: null, stFallbackManual: true },
      },
    });
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    expect(getByTestId('msg-fallback-manual')).toBeTruthy();
  });

  it('mostra mensagem de consentimento ausente em erro 422', () => {
    mockUseTeleconsulta.mockReturnValue({
      query: IDLE_QUERY,
      mutation: { ...IDLE_MUTATION, error: { status: 422, code: 'RegraDeNegocioException', message: 'sem consentimento' } },
    });
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    expect(getByTestId('msg-sem-consentimento')).toBeTruthy();
  });

  it('mostra erro genérico com botão de tentar novamente em outros erros', () => {
    mockUseTeleconsulta.mockReturnValue({
      query: IDLE_QUERY,
      mutation: { ...IDLE_MUTATION, error: { status: 404, code: 'EntidadeNaoEncontradaException', message: 'não encontrado' } },
    });
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    expect(getByTestId('msg-erro-sala')).toBeTruthy();
    fireEvent.press(getByTestId('btn-tentar-novamente'));
    expect(IDLE_MUTATION.mutate).toHaveBeenCalledTimes(1);
  });
});

// CQ-15: prova de mordida — falha contra a tela sem ScreenContainer (o
// testID/estilo 'screen-container-content' não existe hoje), passa depois
// da adoção. Achado de verificação: apesar de o backlog listar esta tela
// como candidata a NÃO migrar ("vídeo em tela cheia"), o vídeo real acontece
// fora do app (`Linking.openURL(sala.dsSalaUrl)`, linha ~148) — o que esta
// tela renderiza é um cartão de status com ícone/texto/botão (`videoArea`,
// já com `marginHorizontal: 16` igual ao banner e às notas), não uma
// superfície de vídeo embutida. Por isso ela segue o mesmo tratamento das
// telas de formulário deste ciclo, não o de exceção documentada.
describe('TeleorientacaoScreen — ScreenContainer adoption (CQ-15)', () => {
  it('respects layout.maxContentWidth at 1440×900 (xl)', () => {
    setViewport(1440, 900);
    const { getByTestId } = wrap(<TeleorientacaoScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(layout.maxContentWidth);
  });
});
