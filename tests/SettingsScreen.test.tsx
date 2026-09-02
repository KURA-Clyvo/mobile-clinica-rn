import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockClearSession = jest.fn();
const mockToggleTheme = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: { children: unknown; style: unknown }) => {
    const { View } = require('react-native');
    const R = require('react');
    return R.createElement(View, { style }, children);
  },
}));

jest.mock('@store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@services/queryClient', () => ({
  queryClient: { clear: jest.fn() },
}));

jest.mock('@theme/index', () => ({
  ...jest.requireActual('@theme/index'),
  useTheme: jest.fn(),
}));

import { useAuthStore } from '../src/store/authStore';
import { useTheme } from '../src/theme';
import { queryClient } from '../src/services/queryClient';
import SettingsScreen from '../src/app/(app)/settings';
// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — store REAL, não mockado (só
// `@store/authStore` é mockado neste arquivo): o botão "Rever primeiros
// passos" chama `useOnboardingStore((s) => s.reopen)` de verdade.
import { useOnboardingStore } from '../src/store/onboardingStore';

const mockUseAuthStore = useAuthStore as jest.Mock;
const mockUseTheme = useTheme as jest.Mock;
const mockQueryClientClear = queryClient.clear as jest.Mock;

const MOCK_VET = {
  id: 1,
  nmVeterinario: 'Dr. Felipe Souza',
  nrCRMV: 'SP-12345',
  dsEmail: 'felipe@kura.vet',
  dsTelefone: '11999990001',
};

function wrap(ui: React.ReactElement) {
  return render(ui);
}

// FM-01 — forma unica de montar o estado do store para esta tela. Os 3 campos
// de identidade sao INDEPENDENTES entre si, e e por isso que eles precisam ser
// parametrizaveis: um GESTOR sem ficha tem `email`/`tpPerfil` e NAO tem
// `usuario`, e essa combinacao nao ocorre subindo o app (o registro de clinica
// cria o gestor COM vinculo) -- so existe construida.
function sessaoDe(over: Record<string, unknown>) {
  return {
    email: 'felipe@kura.vet',
    tpPerfil: 'VETERINARIO',
    usuario: MOCK_VET,
    clearSession: mockClearSession,
    ...over,
  };
}

function comSessao(over: Record<string, unknown>) {
  mockUseAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
    selector(sessaoDe(over)),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  const { lightColors, spacing, radius, fontSize, fonts } = jest.requireActual(
    '../src/theme/tokens',
  );
  mockUseTheme.mockReturnValue({
    colors: lightColors,
    isDark: false,
    toggleTheme: mockToggleTheme,
    spacing,
    radius,
    fontSize,
    fonts,
  });
  // FM-01 fix wave pos-G2 — `email` e `tpPerfil` entram aqui por NECESSIDADE:
  // a secao "Time" e o campo "E-mail" passaram a ler do store esses campos, e
  // sem eles o `selector` devolvia `undefined`. Era exatamente essa lacuna que
  // deixava a regressao passar despercebida (ver `sessaoDe` abaixo).
  mockUseAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
    selector(sessaoDe({})),
  );
  mockClearSession.mockResolvedValue(undefined);
  mockQueryClientClear.mockClear();
});

describe('SettingsScreen', () => {
  it('displays vet name and CRMV from authStore', () => {
    const { getByTestId } = wrap(<SettingsScreen />);
    expect(getByTestId('vet-name').props.children).toBe('Dr. Felipe Souza');
    expect(getByTestId('vet-crmv').props.children).toBe('SP-12345');
  });

  it('calls toggleTheme when pressing dark mode switch', () => {
    const { getByTestId } = wrap(<SettingsScreen />);
    fireEvent(getByTestId('switch-dark-mode'), 'valueChange', true);
    expect(mockToggleTheme).toHaveBeenCalledWith(true);
  });

  it('dark mode switch has value matching isDark', () => {
    const { getByTestId } = wrap(<SettingsScreen />);
    expect(getByTestId('switch-dark-mode').props.value).toBe(false);
  });

  it('pressing "Sair da conta" shows confirmation Alert', () => {
    const spyAlert = jest.spyOn(require('react-native'), 'Alert', 'get').mockReturnValue({
      alert: jest.fn(),
    });
    const { getByTestId } = wrap(<SettingsScreen />);
    fireEvent.press(getByTestId('btn-sair'));
    expect(spyAlert.mock.results[0].value.alert).toHaveBeenCalledWith(
      'Sair?',
      'Sua sessão será encerrada.',
      expect.any(Array),
    );
    spyAlert.mockRestore();
  });

  it('confirms logout: calls clearSession, queryClient.clear() and navigates to /login', async () => {
    let logoutCallback: (() => void) | undefined;
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(
      (_title: unknown, _msg: unknown, buttons: Array<{ text: string; onPress?: () => void }>) => {
        const sairBtn = buttons.find((b) => b.text === 'Sair');
        logoutCallback = sairBtn?.onPress;
      },
    );
    const { getByTestId } = wrap(<SettingsScreen />);
    fireEvent.press(getByTestId('btn-sair'));
    await waitFor(() => expect(logoutCallback).toBeDefined());
    await logoutCallback!();
    expect(mockClearSession).toHaveBeenCalled();
    expect(mockQueryClientClear).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('cancels logout: does not navigate', () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = wrap(<SettingsScreen />);
    fireEvent.press(getByTestId('btn-sair'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // CQ-13 (item 4) — "Rever primeiros passos" volta a MOSTRAR o card
  // (dismissed:false) E preserva os passos já concluídos (não reseta
  // `completedSteps` — critério do backlog: "quem quer rever, acha em
  // Configurações", nunca perde o que já fez).
  it('pressing "Rever primeiros passos" un-dismisses onboarding and preserves completed steps', () => {
    useOnboardingStore.setState({
      completedSteps: ['agenda', 'luna'],
      dismissed: true,
      _hasHydrated: true,
    });
    const { getByTestId } = wrap(<SettingsScreen />);
    fireEvent.press(getByTestId('btn-rever-onboarding'));

    const state = useOnboardingStore.getState();
    expect(state.dismissed).toBe(false);
    expect(state.completedSteps).toEqual(['agenda', 'luna']);
  });
});

// ─── FM-01, fix wave pós-G2 ────────────────────────────────────────────────
//
// 🔴 ACHADO `Important` DA REVISÃO G2, reproduzido pelo maestro antes de
// aceito: mutar o gate da seção "Time" de `{email && …}` de volta para
// `{usuario && …}` — o bug que a FM-01 corrigiu — deixava a suíte INTEIRA
// verde: 56/56 suites, 740/740 testes, `EXIT=0`.
//
// Ou seja: o sítio foi corrigido e a correção **não era carga**. O próprio
// relatório da FM-01 declarou isso como dívida no §11.4 ("cobertura indireta,
// sem mordida própria") — a revisão provou por medição, e esta fix wave paga.
//
// ⚠️ Por que a seção "Time" importa: gerenciar a equipe da clínica é
// literalmente função de GESTOR, e o gate antigo (`usuario`, a FICHA de
// veterinário) fazia justamente o gestor SEM ficha ser quem MAIS perdia
// acesso a ela.
describe('SettingsScreen — identidade sem ficha de veterinário (FM-01)', () => {
  it('GESTOR sem ficha: a seção "Time" continua visível', () => {
    comSessao({ email: 'gestor@kura.vet', tpPerfil: 'GESTOR', usuario: null });
    const { getByTestId } = wrap(<SettingsScreen />);

    expect(getByTestId('btn-convidar')).toBeTruthy();
  });

  it('GESTOR sem ficha: "Nome" mostra o papel em vez de travessão', () => {
    comSessao({ email: 'gestor@kura.vet', tpPerfil: 'GESTOR', usuario: null });
    const { getByTestId } = wrap(<SettingsScreen />);

    // Antes da FM-01 era `usuario?.nmVeterinario ?? '—'`: o perfil inteiro do
    // gestor virava uma coluna de travessões.
    expect(getByTestId('vet-name').props.children).toBe('Gestor');
  });

  it('GESTOR sem ficha: "E-mail" cai para o e-mail do store, não para travessão', () => {
    comSessao({ email: 'gestor@kura.vet', tpPerfil: 'GESTOR', usuario: null });
    const { getByTestId } = wrap(<SettingsScreen />);

    expect(getByTestId('vet-email').props.children).toBe('gestor@kura.vet');
  });

  it('o campo "Perfil" existe e mostra o papel', () => {
    comSessao({ tpPerfil: 'VETERINARIO' });
    const { getByTestId } = wrap(<SettingsScreen />);

    expect(getByTestId('vet-perfil').props.children).toBe('Veterinário');
  });

  // Controle negativo: sem sessão nenhuma, a seção "Time" NÃO renderiza. Sem
  // isto, o primeiro teste seria compatível com "a seção sempre aparece" — e
  // a mutação `{email && …}` → `{true && …}` passaria despercebida.
  it('CONTROLE — sem sessão, a seção "Time" não renderiza', () => {
    comSessao({ email: null, tpPerfil: null, usuario: null });
    const { queryByTestId } = wrap(<SettingsScreen />);

    expect(queryByTestId('btn-convidar')).toBeNull();
  });
});

// ─── FM-03: a seção "Time" passou a ser gate de PAPEL, não de sessão ───────
//
// Histórico da linha, porque ela mudou três vezes e cada mudança teve razão:
//   antes da FM-01: `{usuario && …}`  — qualquer um COM ficha de veterinário
//   FM-01:          `{email && …}`    — qualquer um logado (provisório: o
//                                       papel ainda não existia no app)
//   FM-03:          `{isGestor && …}` — só GESTOR (o gate real)
//
// 🔴 A `FM-03` REMOVEU a seção de um veterinário puro — que é o login mais
// comum deste app — e **nenhum teste afirmava isso**. O teste de gestor abaixo
// (herdado da FM-01) sozinho é compatível com "a seção aparece para todo
// mundo"; é este par que prova que o gate é de PAPEL.
describe('SettingsScreen — a seção "Time" é só do GESTOR (FM-03)', () => {
  it('VETERINÁRIO puro NÃO vê a seção "Time"', () => {
    comSessao({ tpPerfil: 'VETERINARIO', usuario: MOCK_VET });
    const { queryByTestId } = wrap(<SettingsScreen />);

    expect(queryByTestId('btn-convidar')).toBeNull();
  });

  // ⚠️ O caso que desmascara um gate que tivesse colapsado as duas perguntas
  // do app ("tenho ficha?" × "meu papel deixa ver?"): este usuário responde
  // SIM às duas, e é o ÚNICO que ocorre subindo o app de verdade
  // (RegisterClinicaAsync cria o gestor COM vínculo). Um gate escrito como
  // `usuario !== null` passaria aqui e no teste do veterinário FALHARIA —
  // mas quem só testasse este caso não veria diferença nenhuma.
  it('GESTOR COM ficha vê a seção "Time" — o caso de demonstração', () => {
    comSessao({ tpPerfil: 'GESTOR', usuario: MOCK_VET });
    const { getByTestId } = wrap(<SettingsScreen />);

    expect(getByTestId('btn-convidar')).toBeTruthy();
  });
});
