import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import UsuariosClinicaScreen from '../src/app/(app)/usuarios/index';
import { ROUTES } from '../src/constants/routes';
import type { UsuarioClinicaResponse, VeterinarioResponse } from '../src/types/api';

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactForMock = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      ReactForMock.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockUseUsuariosClinicaReturn = jest.fn();
const mockUseVeterinariosParaSelecaoReturn = jest.fn();
const mockMutateDesativar = jest.fn();
const mockMutateReativar = jest.fn();
const mockMutateCriar = jest.fn();
const mockMutateAtualizar = jest.fn();
const mockMutateTrocarSenha = jest.fn();
jest.mock('@hooks/useUsuariosClinica', () => ({
  // Repassa o argumento (incluirInativos) ao mock -- é o que permite provar
  // a fiação do toggle "Mostrar desativados" (FM-05) sem QueryClientProvider real.
  useUsuariosClinica: (incluirInativos: boolean) => mockUseUsuariosClinicaReturn(incluirInativos),
  useVeterinariosParaSelecao: () => mockUseVeterinariosParaSelecaoReturn(),
  useDesativarUsuarioClinica: () => ({ mutate: mockMutateDesativar, isPending: false }),
  useReativarUsuarioClinica: () => ({ mutate: mockMutateReativar, isPending: false }),
  useCriarUsuarioClinica: () => ({ mutate: mockMutateCriar, isPending: false }),
  useAtualizarUsuarioClinica: () => ({ mutate: mockMutateAtualizar, isPending: false }),
  useTrocarSenhaUsuarioClinica: () => ({ mutate: mockMutateTrocarSenha, isPending: false }),
}));

const REFETCH = jest.fn();

const USUARIO_ATIVO: UsuarioClinicaResponse = {
  id: 1,
  idClinica: 1,
  idVeterinario: 1,
  dsEmail: 'felipe.ferrete@kura.vet',
  tpPerfil: 'GESTOR',
  stAtiva: true,
  dtCriacao: '2026-08-01T10:00:00Z',
  dtAtualizacao: null,
};

const USUARIO_INATIVO: UsuarioClinicaResponse = {
  id: 2,
  idClinica: 1,
  idVeterinario: null,
  dsEmail: 'ex.funcionario@kura.vet',
  tpPerfil: 'VETERINARIO',
  stAtiva: false,
  dtCriacao: '2026-08-01T10:00:00Z',
  dtAtualizacao: null,
};

const VETERINARIO: VeterinarioResponse = {
  id: 1,
  nmVeterinario: 'Dr. Felipe Ferrete',
  nrCRMV: 'SP-12345',
  dsEmail: 'felipe.ferrete@kura.vet',
};

function seedGestor() {
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'felipe.ferrete@kura.vet',
    tpPerfil: 'GESTOR',
    usuario: { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345', dsEmail: 'felipe.ferrete@kura.vet' },
    _hasHydrated: true,
  });
}

function seedVeterinarioPuro() {
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'vet@kura.vet',
    tpPerfil: 'VETERINARIO',
    usuario: { id: 2, nmVeterinario: 'Dr. Vet', nrCRMV: 'SP-1', dsEmail: 'vet@kura.vet' },
    _hasHydrated: true,
  });
}

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseUsuariosClinicaReturn.mockReturnValue({
    data: [USUARIO_ATIVO, USUARIO_INATIVO],
    isLoading: false,
    refetch: REFETCH,
  });
  mockUseVeterinariosParaSelecaoReturn.mockReturnValue({ data: [VETERINARIO], isLoading: false });
});

describe('UsuariosClinicaScreen — guarda de GESTOR', () => {
  it('um VETERINARIO puro é redirecionado e não vê o conteúdo (useRequireGestor)', () => {
    seedVeterinarioPuro();
    const { queryByTestId } = wrap(<UsuariosClinicaScreen />);
    expect(mockReplace).toHaveBeenCalledWith(ROUTES.app.dashboard);
    expect(queryByTestId('usuarios-lista')).toBeNull();
  });

  it('um GESTOR vê a lista normalmente, sem redirecionar', () => {
    seedGestor();
    const { queryByTestId } = wrap(<UsuariosClinicaScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(queryByTestId('usuarios-lista')).toBeTruthy();
  });

  // G2 (fm-02-revisao.md, Important-1): o relatório da FM-02 alegava que ESTE
  // describe já provava "um GESTOR sem ficha também vê a tela normalmente",
  // citando este bloco — mas as 2 acima só cobrem VETERINARIO puro e GESTOR
  // COM ficha (`seedGestor()` sempre popula `usuario`, nunca `null`). A prova
  // real de "GESTOR sem ficha" que existia era só no hook, isolado
  // (`useIsGestor.test.tsx`), nunca nesta tela. O comportamento estava
  // correto (useRequireGestor nunca lê `usuario`) — só a alegação de
  // cobertura estava errada. Este teste fecha a lacuna de verdade, em vez de
  // só corrigir o texto do relatório.
  it('um GESTOR SEM ficha (usuario: null) também vê a lista, sem redirecionar', () => {
    useAuthStore.setState({
      token: 'tok',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      email: 'gestor.sem.ficha@kura.vet',
      tpPerfil: 'GESTOR',
      usuario: null,
      _hasHydrated: true,
    });
    const { queryByTestId } = wrap(<UsuariosClinicaScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(queryByTestId('usuarios-lista')).toBeTruthy();
  });
});

describe('UsuariosClinicaScreen — lista', () => {
  beforeEach(() => seedGestor());

  it('renderiza os 2 usuários com papel/status corretos', () => {
    const { getAllByTestId } = wrap(<UsuariosClinicaScreen />);
    const emails = getAllByTestId('usuario-email').map((n) => n.props.children);
    expect(emails).toEqual(['felipe.ferrete@kura.vet', 'ex.funcionario@kura.vet']);
  });

  // FM-05 (brief §4) — mesma correção da FM-05, aplicada aqui: por padrão
  // o hook é chamado com `false` (backend só devolve ativos); o toggle
  // "Mostrar desativados" alterna o argumento.
  it('por padrão chama useUsuariosClinica(false) e o toggle alterna para true', () => {
    const { getByTestId } = wrap(<UsuariosClinicaScreen />);
    expect(mockUseUsuariosClinicaReturn).toHaveBeenLastCalledWith(false);

    fireEvent.press(getByTestId('toggle-mostrar-desativados'));

    expect(mockUseUsuariosClinicaReturn).toHaveBeenLastCalledWith(true);
  });

  // Fix wave pós-G2 (sessão 9, achado do maestro em re-análise): o backend
  // RECUSA com 422 tanto o PUT quanto o PUT /senha num usuário desativado
  // (UsuarioClinicaService.cs:153,:198 -> GarantirUsuarioAtivo, :288-292,
  // backend-clinica-dotnet@de96c70). A tela oferecia os 2 botões em toda linha,
  // e o modo mock respondia 200 — o 422 só apareceria contra o backend real.
  // A lista tem [ATIVO, INATIVO] nesta ordem, então 1 botão de cada = só a
  // linha ativa os tem.
  it('NÃO oferece "Editar"/"Trocar senha" na linha inativa — o backend recusa as duas com 422', () => {
    const { getAllByTestId } = wrap(<UsuariosClinicaScreen />);
    expect(getAllByTestId('usuario-item')).toHaveLength(2);
    expect(getAllByTestId('btn-editar-usuario')).toHaveLength(1);
    expect(getAllByTestId('btn-trocar-senha')).toHaveLength(1);
    // controle positivo: a linha inativa não ficou sem ação nenhuma — ela
    // oferece "Reativar", que é o próximo passo que o próprio backend manda dar.
    expect(getAllByTestId('btn-reativar-usuario')).toHaveLength(1);
  });

  it('mostra "Desativar" só na linha ativa e "Reativar" só na inativa', () => {
    const { getAllByTestId } = wrap(<UsuariosClinicaScreen />);
    expect(getAllByTestId('btn-desativar-usuario')).toHaveLength(1);
    expect(getAllByTestId('btn-reativar-usuario')).toHaveLength(1);
  });

  it('mostra o estado de carregamento antes dos dados chegarem', () => {
    mockUseUsuariosClinicaReturn.mockReturnValue({ data: undefined, isLoading: true, refetch: REFETCH });
    const { getByTestId, queryByTestId } = wrap(<UsuariosClinicaScreen />);
    expect(getByTestId('usuarios-skeleton')).toBeTruthy();
    expect(queryByTestId('usuarios-lista')).toBeNull();
  });

  it('mostra o estado vazio quando a lista vem vazia', () => {
    mockUseUsuariosClinicaReturn.mockReturnValue({ data: [], isLoading: false, refetch: REFETCH });
    const { getByTestId } = wrap(<UsuariosClinicaScreen />);
    expect(getByTestId('empty-usuarios')).toBeTruthy();
  });

  it('botão voltar chama router.back()', () => {
    const { getByTestId } = wrap(<UsuariosClinicaScreen />);
    fireEvent.press(getByTestId('btn-voltar-usuarios'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('UsuariosClinicaScreen — abrir modais', () => {
  beforeEach(() => seedGestor());

  it('"+ Novo" abre o formulário em modo CRIAÇÃO (sem e-mail pré-preenchido)', () => {
    const { getByTestId } = wrap(<UsuariosClinicaScreen />);
    fireEvent.press(getByTestId('btn-novo-usuario'));
    expect(getByTestId('input-email-usuario').props.value).toBe('');
    // Modo criação tem campo de senha; edição não.
    expect(getByTestId('input-senha-usuario')).toBeTruthy();
  });

  it('"Editar" abre o formulário PRÉ-PREENCHIDO com o e-mail do usuário, sem campo de senha', () => {
    const { getAllByTestId, getByTestId, queryByTestId } = wrap(<UsuariosClinicaScreen />);
    fireEvent.press(getAllByTestId('btn-editar-usuario')[0]!);
    expect(getByTestId('input-email-usuario').props.value).toBe('felipe.ferrete@kura.vet');
    expect(queryByTestId('input-senha-usuario')).toBeNull();
  });

  it('"Trocar senha" abre o modal de senha com o e-mail do usuário', () => {
    const { getAllByTestId, getByTestId } = wrap(<UsuariosClinicaScreen />);
    fireEvent.press(getAllByTestId('btn-trocar-senha')[0]!);
    expect(getByTestId('input-nova-senha')).toBeTruthy();
  });
});

describe('UsuariosClinicaScreen — desativar/reativar', () => {
  beforeEach(() => seedGestor());

  it('"Desativar" pede confirmação e só chama a mutação após confirmar', () => {
    const spyAlert = jest.spyOn(require('react-native').Alert, 'alert');
    const { getAllByTestId } = wrap(<UsuariosClinicaScreen />);
    fireEvent.press(getAllByTestId('btn-desativar-usuario')[0]!);

    expect(spyAlert).toHaveBeenCalledWith(
      'Desativar usuário?',
      expect.stringContaining('felipe.ferrete@kura.vet'),
      expect.any(Array),
    );
    // Ainda não chamou a mutação -- só o Alert de confirmação.
    expect(mockMutateDesativar).not.toHaveBeenCalled();

    const botoes = spyAlert.mock.calls[0]![2] as Array<{ text: string; onPress?: () => void }>;
    const confirmar = botoes.find((b) => b.text === 'Desativar');
    act(() => confirmar?.onPress?.());

    expect(mockMutateDesativar).toHaveBeenCalledWith(1, expect.objectContaining({ onError: expect.any(Function) }));
    spyAlert.mockRestore();
  });

  it('"Reativar" chama a mutação direto, sem confirmação prévia', () => {
    const { getAllByTestId } = wrap(<UsuariosClinicaScreen />);
    fireEvent.press(getAllByTestId('btn-reativar-usuario')[0]!);
    expect(mockMutateReativar).toHaveBeenCalledWith(2, expect.objectContaining({ onError: expect.any(Function) }));
  });

  it('um erro de negócio (422 "clínica sem gestor") aparece via Alert com a mensagem real', async () => {
    const spyAlert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    mockMutateDesativar.mockImplementation((_id, { onError }) => {
      onError({ status: 422, code: 'SEM_GESTOR_ATIVO', message: 'A clínica ficaria sem nenhum gestor ativo.' });
    });

    const { getAllByTestId } = wrap(<UsuariosClinicaScreen />);
    fireEvent.press(getAllByTestId('btn-desativar-usuario')[0]!);
    const botoes = spyAlert.mock.calls[0]![2] as Array<{ text: string; onPress?: () => void }>;
    const confirmar = botoes.find((b) => b.text === 'Desativar');
    act(() => confirmar?.onPress?.());

    await waitFor(() =>
      expect(spyAlert).toHaveBeenCalledWith(
        'Não foi possível concluir',
        'A clínica ficaria sem nenhum gestor ativo.',
      ),
    );
    spyAlert.mockRestore();
  });
});
