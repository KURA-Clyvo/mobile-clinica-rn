// FM-02 — MORDIDA OBRIGATÓRIA do brief: a FM-01 tratou o app inteiro para um
// GESTOR sem ficha de veterinário, mas nenhum login de demonstração produz
// esse estado (AuthService.RegisterClinicaAsync sempre cria o gestor COM
// vínculo). O caso real que ninguém nunca exercitou é o OUTRO: um
// VETERINARIO sem ficha, e esta task é a ÚNICA que consegue criar esse
// estado de verdade — pela PRÓPRIA TELA (UsuarioClinicaFormModal), pela
// cadeia REAL de mock (service -> apiClient -> mock-adapter ->
// usuarios-clinica.mock.ts), sem jest.mock de nenhum dos 3.
//
// auth.mock.ts::login é FIXO (sempre devolve o mesmo VETERINARIO com
// ficha completa, ver comentário daquele arquivo) — não reproduz um login
// como o usuário recém-criado. "Deslogar, logar como ele" é simulado
// semeando o authStore diretamente com o papel/e-mail do usuário criado e
// `usuario: null` (sem ficha) — MESMO padrão que tests/useIsGestor.test.tsx
// já usa para o caso "GESTOR sem ficha", que também não ocorre via login
// mock.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { UsuarioClinicaFormModal } from '../src/components/domain/UsuarioClinicaFormModal';
import SettingsScreen from '../src/app/(app)/settings';
import { listUsuariosClinica } from '../src/services/usuarios-clinica.service';
import { __resetStoreParaTeste } from '../src/mocks/usuarios-clinica.mock';

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@services/queryClient', () => ({ queryClient: { clear: jest.fn() } }));

// Ambas as telas renderizadas neste arquivo passam por `SafeAreaView`
// (ScreenContainer) ou `useSafeAreaInsets` direto (UsuarioClinicaFormModal)
// — mesmo mock completo do módulo usado em touchTargetRegistry.tsx.
jest.mock('react-native-safe-area-context', () => {
  const ReactForMock = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      ReactForMock.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

const originalUseMocks = process.env.EXPO_PUBLIC_USE_MOCKS;

beforeEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = 'true';
  __resetStoreParaTeste();
  useAuthStore.setState({
    token: 'tok-gestor',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'felipe.ferrete@kura.vet',
    tpPerfil: 'GESTOR',
    usuario: { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345', dsEmail: 'felipe.ferrete@kura.vet' },
    _hasHydrated: true,
  });
});

afterEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = originalUseMocks;
  jest.clearAllMocks();
});

describe('FM-02 — mordida obrigatória: VETERINARIO sem ficha', () => {
  it(
    'cria um VETERINARIO sem idVeterinario pela própria tela (cadeia real de mock), ' +
      'e o app não quebra ao "logar" como ele — a seção Time some, ele não é GESTOR',
    async () => {
      // ── 1) Criar pela PRÓPRIA TELA, sem tocar em "Ficha de veterinário" ──
      // (o default já é null — a mordida é justamente NÃO selecionar nada) ──
      const onClose = jest.fn();
      const { getByTestId } = wrap(
        <UsuarioClinicaFormModal visible onClose={onClose} usuario={null} veterinarios={[]} />,
      );

      fireEvent.changeText(getByTestId('input-email-usuario'), 'novo.vet@kura.vet');
      fireEvent.changeText(getByTestId('input-senha-usuario'), 'senha123');
      fireEvent.press(getByTestId('chip-papel-veterinario'));

      await act(async () => {
        fireEvent.press(getByTestId('btn-salvar-usuario'));
      });

      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

      // ── 2) Confirma PELA FONTE (mesma cadeia real, GET) que o backend viu ──
      // exatamente o que a mordida exige: VETERINARIO, idVeterinario null.
      const lista = await listUsuariosClinica();
      const criado = lista.find((u) => u.dsEmail === 'novo.vet@kura.vet');
      expect(criado).toBeDefined();
      expect(criado?.tpPerfil).toBe('VETERINARIO');
      expect(criado?.idVeterinario).toBeNull();
      expect(criado?.stAtiva).toBe(true);

      // ── 3) "Deslogar, logar como ele" — seed direto (ver cabeçalho do ──
      // arquivo: login mock é fixo, não reproduz isto) ──
      useAuthStore.setState({
        token: 'tok-vet-sem-ficha',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        email: criado!.dsEmail,
        tpPerfil: criado!.tpPerfil,
        usuario: null, // SEM ficha — exatamente o estado que a FM-01 tratou e ninguém produzia
        _hasHydrated: true,
      });

      // ── 4) O app NÃO QUEBRA (render() lança se algo estourar durante o ──
      // ciclo de render) e a seção "Time" SOME — ele não é GESTOR. ──
      const { getByTestId: getByTestIdSettings, queryByTestId } = wrap(<SettingsScreen />);

      // Prova de "não quebra": a tela renderiza normalmente, inclusive o
      // campo Perfil (que precisa degradar sem `usuario` — padrão da FM-01,
      // perfilLabel(tpPerfil) no lugar de usuario.nmVeterinario).
      expect(getByTestIdSettings('vet-perfil').props.children).toBe('Veterinário');
      expect(getByTestIdSettings('vet-email').props.children).toBe('novo.vet@kura.vet');

      // A seção Time não existe na árvore — não aparece desabilitada, SOME
      // (recomendação do backlog, §E27, já provada pela FM-03 e reconfirmada
      // aqui contra um usuário criado de verdade por esta task).
      expect(queryByTestId('btn-convidar')).toBeNull();
    },
  );
});
