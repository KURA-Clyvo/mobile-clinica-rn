import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../src/theme';
import PatientDetailScreen from '../src/app/(app)/pacientes/[id]';
import { useAuthStore } from '../src/store/authStore';
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
// CQ-15 fix wave (G2 Important #1): `edges` é repassado pra dentro da View
// mockada (via testID fixo) pra poder ser inspecionado pelas mordidas
// abaixo; `insets.top` deixou de ser 0 (valor que mascararia a soma
// `insets.top + 16` restaurada no header) — 44 é um valor de notch real
// plausível (iPhone com Dynamic Island), só pra tornar a soma observável.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({
      children,
      style,
      edges,
    }: {
      children: React.ReactNode;
      style?: unknown;
      edges?: unknown;
    }) => React.createElement(View, { style, edges, testID: 'mock-safe-area-view' }, children),
    useSafeAreaInsets: () => ({ top: 44, bottom: 0, left: 0, right: 0 }),
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

// FM-01 — a tela passou a depender do store de auth: "Consulta" e
// "Receituário" gravam `idVeterinario: usuario.id`, então sem FICHA de
// veterinário essas ações somem (recomendação do backlog: sumir, não
// desabilitar sem explicação — item desabilitado mudo é a classe E27).
// Antes desta task o teste não semeava sessão nenhuma e passava; hoje a
// ausência de sessão é um estado com significado, e precisa ser dita.
const MOCK_VET_LOGADO = {
  id: 7,
  nmVeterinario: 'Dra. Ana Souza',
  nrCRMV: 'SP-99999',
  dsEmail: 'ana@kuraclinica.com.br',
};

function logarComoVeterinario() {
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: MOCK_VET_LOGADO.dsEmail,
    tpPerfil: 'VETERINARIO',
    usuario: MOCK_VET_LOGADO,
  });
}

function logarComoGestorSemFicha() {
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'gestor@kuraclinica.com.br',
    tpPerfil: 'GESTOR',
    usuario: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  logarComoVeterinario();
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

  // 🔴 FM-01 — o par positivo/negativo. O teste acima prova que o veterinário
  // VÊ a ação; sem este, "o botão existe" seria indistinguível de "o botão
  // existe para todo mundo", e o esconder-para-gestor não estaria provado.
  it('GESTOR sem ficha: ações clínicas somem, e o resto da tela continua de pé', () => {
    logarComoGestorSemFicha();
    const { queryByTestId, getByTestId } = wrap(<PatientDetailScreen />);

    // Somem: as duas gravam `idVeterinario: usuario.id`, que não existe.
    expect(queryByTestId('btn-consulta')).toBeNull();
    expect(queryByTestId('btn-rx')).toBeNull();

    // ⚠️ Continua: "Teleorient." NÃO depende de `usuario.id` — só exibe o
    // nome do vet no banner CFMV, que já é condicional. Escondê-la também
    // seria esconder mais do que o necessário, e a tela do paciente é
    // legítima para um gestor consultar.
    expect(getByTestId('btn-tele')).toBeTruthy();
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
    const { getByTestId, queryByText } = wrap(<PatientDetailScreen />);
    expect(getByTestId('loading-skeleton')).toBeTruthy();
    // CQ-15 fix wave (G2 Important #4): a asserção antiga
    // (`queryByTestId('pet-detail-scroll')`) virou tautologia — a migração
    // removeu esse testID do ScrollView do ramo de sucesso, então a query
    // já era `null` para sempre, independentemente do código (decaimento
    // silencioso introduzido pela própria task). Substituída por uma
    // asserção que prova o que se queria provar de fato: o conteúdo do
    // ramo de sucesso (nome do pet) não aparece junto com o skeleton.
    expect(queryByText(MOCK_PET.nmPet)).toBeNull();
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

  // CQ-15 fix wave (G2 Important #6/Minor #6): mordida — a G2 reproduziu que
  // remover `paddingHorizontal={0}` das ramificações de loading/sucesso
  // deixava a suíte inteira verde (a mordida só travava `maxWidth`). O
  // `header` é uma faixa colorida de borda a borda; um respiro do container
  // por cima a encolheria pra um cartão flutuante.
  it('applies paddingHorizontal:0 in the loading branch (full-bleed header)', () => {
    mockUsePetDetail.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { getByTestId } = wrap(<PatientDetailScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { paddingHorizontal?: number };
    expect(flatStyle.paddingHorizontal).toBe(0);
  });

  it('applies paddingHorizontal:0 in the success branch (full-bleed header)', () => {
    const { getByTestId } = wrap(<PatientDetailScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { paddingHorizontal?: number };
    expect(flatStyle.paddingHorizontal).toBe(0);
  });

  // CQ-15 fix wave (G2 Important #1): a faixa colorida do header parava de
  // cobrir a status bar porque o SafeAreaView do ScreenContainer pintava o
  // inset do topo com colors.bg. Fix: excluir 'top' de `edges` e voltar a
  // somar `insets.top` manualmente no header.
  it('excludes the top edge from the inner SafeAreaView so the header paints under the status bar', () => {
    const { getByTestId } = wrap(<PatientDetailScreen />);
    const safeArea = getByTestId('mock-safe-area-view');
    expect(safeArea.props.edges).toEqual(['bottom', 'left', 'right']);
  });

  it('restores insets.top manually in the header padding when top edge is excluded', () => {
    const { getByTestId } = wrap(<PatientDetailScreen />);
    const header = getByTestId('pet-header');
    const flatStyle = StyleSheet.flatten(header.props.style) as { paddingTop?: number };
    // mock de useSafeAreaInsets devolve top: 44 — ver o mock no topo do arquivo.
    expect(flatStyle.paddingTop).toBe(44 + 16);
  });

  it('also excludes the top edge in the loading branch', () => {
    mockUsePetDetail.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { getByTestId } = wrap(<PatientDetailScreen />);
    const safeArea = getByTestId('mock-safe-area-view');
    expect(safeArea.props.edges).toEqual(['bottom', 'left', 'right']);
    const header = getByTestId('loading-skeleton');
    const flatStyle = StyleSheet.flatten(header.props.style) as { paddingTop?: number };
    expect(flatStyle.paddingTop).toBe(44 + 16);
  });

  // CQ-15 fix wave rodada 3 (G2 rodada 2, Minor #3): a G2 reproduziu que
  // remover `justifyContent:'center'` do ramo de erro deixava a suíte
  // inteira verde — sem ele o cartão de erro fica colado no topo em vez de
  // centralizado verticalmente na tela (scroll={false}, flex:1).
  it('centers the error card vertically in the error branch', () => {
    mockUsePetDetail.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    const { getByTestId } = wrap(<PatientDetailScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { justifyContent?: string };
    expect(flatStyle.justifyContent).toBe('center');
  });
});
