import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import ServicosPrecoScreen from '../src/app/(app)/servicos-preco/index';
import { ROUTES } from '../src/constants/routes';
import type { ServicoPrecoResponse } from '../src/types/api';

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

const mockUseServicosPrecoReturn = jest.fn();
const mockMutateDesativar = jest.fn();
const mockMutateReativar = jest.fn();
const mockMutateCriar = jest.fn();
const mockMutateAtualizar = jest.fn();
jest.mock('@hooks/useServicosPreco', () => ({
  // Repassa o argumento (incluirInativos) ao mock -- é o que permite provar
  // a fiação do toggle sem precisar de QueryClientProvider real.
  useServicosPreco: (incluirInativos: boolean) => mockUseServicosPrecoReturn(incluirInativos),
  useDesativarServicoPreco: () => ({ mutate: mockMutateDesativar, isPending: false }),
  useReativarServicoPreco: () => ({ mutate: mockMutateReativar, isPending: false }),
  useCriarServicoPreco: () => ({ mutate: mockMutateCriar, isPending: false }),
  useAtualizarServicoPreco: () => ({ mutate: mockMutateAtualizar, isPending: false }),
}));

const REFETCH = jest.fn();

const SERVICO_ATIVO: ServicoPrecoResponse = {
  id: 1,
  idClinica: 1,
  nmServico: 'Consulta de rotina',
  vlPreco: 150,
  stAtiva: true,
  dtCriacao: '2026-08-01T10:00:00Z',
  dtAtualizacao: null,
};

const SERVICO_INATIVO: ServicoPrecoResponse = {
  id: 2,
  idClinica: 1,
  nmServico: 'Banho e tosa (descontinuado)',
  vlPreco: 60,
  stAtiva: false,
  dtCriacao: '2026-08-01T10:00:00Z',
  dtAtualizacao: null,
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
  mockUseServicosPrecoReturn.mockReturnValue({
    data: [SERVICO_ATIVO],
    isLoading: false,
    refetch: REFETCH,
  });
});

describe('ServicosPrecoScreen — guarda de GESTOR', () => {
  it('um VETERINARIO puro é redirecionado e não vê o conteúdo (useRequireGestor)', () => {
    seedVeterinarioPuro();
    const { queryByTestId } = wrap(<ServicosPrecoScreen />);
    expect(mockReplace).toHaveBeenCalledWith(ROUTES.app.dashboard);
    expect(queryByTestId('servicos-preco-lista')).toBeNull();
  });

  it('um GESTOR vê a lista normalmente, sem redirecionar', () => {
    seedGestor();
    const { queryByTestId } = wrap(<ServicosPrecoScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(queryByTestId('servicos-preco-lista')).toBeTruthy();
  });
});

describe('ServicosPrecoScreen — lista', () => {
  beforeEach(() => seedGestor());

  it('por padrão chama useServicosPreco(false) -- lista nasce só com ativos', () => {
    wrap(<ServicosPrecoScreen />);
    expect(mockUseServicosPrecoReturn).toHaveBeenCalledWith(false);
  });

  it('renderiza o serviço ativo com nome e preço formatado em BRL', () => {
    const { getAllByTestId } = wrap(<ServicosPrecoScreen />);
    const nomes = getAllByTestId('servico-nome').map((n) => n.props.children);
    expect(nomes).toEqual(['Consulta de rotina']);
    const precos = getAllByTestId('servico-preco').map((n) => n.props.children);
    expect(precos[0]).toMatch(/^R\$\s*150,00$/);
  });

  it('o toggle "Mostrar desativados" alterna o argumento passado ao hook', () => {
    const { getByTestId } = wrap(<ServicosPrecoScreen />);
    expect(mockUseServicosPrecoReturn).toHaveBeenLastCalledWith(false);

    fireEvent.press(getByTestId('toggle-mostrar-desativados'));

    expect(mockUseServicosPrecoReturn).toHaveBeenLastCalledWith(true);
  });

  it('NÃO oferece "Editar" na linha inativa -- o backend recusa com 422 (GarantirServicoAtivo)', () => {
    mockUseServicosPrecoReturn.mockReturnValue({
      data: [SERVICO_ATIVO, SERVICO_INATIVO],
      isLoading: false,
      refetch: REFETCH,
    });
    const { getAllByTestId } = wrap(<ServicosPrecoScreen />);
    expect(getAllByTestId('servico-item')).toHaveLength(2);
    expect(getAllByTestId('btn-editar-servico')).toHaveLength(1);
    // controle positivo: a linha inativa não fica sem ação nenhuma -- ela
    // oferece "Reativar".
    expect(getAllByTestId('btn-reativar-servico')).toHaveLength(1);
  });

  it('mostra "Desativar" só na linha ativa e "Reativar" só na inativa', () => {
    mockUseServicosPrecoReturn.mockReturnValue({
      data: [SERVICO_ATIVO, SERVICO_INATIVO],
      isLoading: false,
      refetch: REFETCH,
    });
    const { getAllByTestId } = wrap(<ServicosPrecoScreen />);
    expect(getAllByTestId('btn-desativar-servico')).toHaveLength(1);
    expect(getAllByTestId('btn-reativar-servico')).toHaveLength(1);
  });

  it('mostra o estado de carregamento antes dos dados chegarem', () => {
    mockUseServicosPrecoReturn.mockReturnValue({ data: undefined, isLoading: true, refetch: REFETCH });
    const { getByTestId, queryByTestId } = wrap(<ServicosPrecoScreen />);
    expect(getByTestId('servicos-preco-skeleton')).toBeTruthy();
    expect(queryByTestId('servicos-preco-lista')).toBeNull();
  });

  it('mostra o estado vazio quando a lista vem vazia', () => {
    mockUseServicosPrecoReturn.mockReturnValue({ data: [], isLoading: false, refetch: REFETCH });
    const { getByTestId } = wrap(<ServicosPrecoScreen />);
    expect(getByTestId('empty-servicos-preco')).toBeTruthy();
  });

  it('botão voltar chama router.back()', () => {
    const { getByTestId } = wrap(<ServicosPrecoScreen />);
    fireEvent.press(getByTestId('btn-voltar-servicos'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('ServicosPrecoScreen — abrir modal', () => {
  beforeEach(() => seedGestor());

  it('"+ Novo" abre o formulário em modo CRIAÇÃO (sem nome pré-preenchido)', () => {
    const { getByTestId } = wrap(<ServicosPrecoScreen />);
    fireEvent.press(getByTestId('btn-novo-servico'));
    expect(getByTestId('input-nome-servico').props.value).toBe('');
  });

  it('"Editar" abre o formulário PRÉ-PREENCHIDO com o nome/preço do serviço', () => {
    const { getAllByTestId, getByTestId } = wrap(<ServicosPrecoScreen />);
    fireEvent.press(getAllByTestId('btn-editar-servico')[0]!);
    expect(getByTestId('input-nome-servico').props.value).toBe('Consulta de rotina');
    expect(getByTestId('input-preco-servico').props.value).toBe('150');
  });
});

describe('ServicosPrecoScreen — desativar/reativar', () => {
  beforeEach(() => seedGestor());

  it('"Desativar" pede confirmação e só chama a mutação após confirmar', () => {
    const spyAlert = jest.spyOn(require('react-native').Alert, 'alert');
    const { getAllByTestId } = wrap(<ServicosPrecoScreen />);
    fireEvent.press(getAllByTestId('btn-desativar-servico')[0]!);

    expect(spyAlert).toHaveBeenCalledWith(
      'Desativar serviço?',
      expect.stringContaining('Consulta de rotina'),
      expect.any(Array),
    );
    expect(mockMutateDesativar).not.toHaveBeenCalled();

    const botoes = spyAlert.mock.calls[0]![2] as Array<{ text: string; onPress?: () => void }>;
    const confirmar = botoes.find((b) => b.text === 'Desativar');
    act(() => confirmar?.onPress?.());

    expect(mockMutateDesativar).toHaveBeenCalledWith(1, expect.objectContaining({ onError: expect.any(Function) }));
    spyAlert.mockRestore();
  });

  it('"Reativar" chama a mutação direto, sem confirmação prévia', () => {
    mockUseServicosPrecoReturn.mockReturnValue({
      data: [SERVICO_ATIVO, SERVICO_INATIVO],
      isLoading: false,
      refetch: REFETCH,
    });
    const { getAllByTestId } = wrap(<ServicosPrecoScreen />);
    fireEvent.press(getAllByTestId('btn-reativar-servico')[0]!);
    expect(mockMutateReativar).toHaveBeenCalledWith(2, expect.objectContaining({ onError: expect.any(Function) }));
  });

  it('um erro de negócio (422 SERVICO_DESATIVADO) aparece via Alert com a mensagem real', async () => {
    const spyAlert = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    mockMutateDesativar.mockImplementation((_id, { onError }) => {
      onError({ status: 422, code: 'NOME_EM_USO', message: 'Já existe um serviço ATIVO com este nome nesta clínica.' });
    });

    const { getAllByTestId } = wrap(<ServicosPrecoScreen />);
    fireEvent.press(getAllByTestId('btn-desativar-servico')[0]!);
    const botoes = spyAlert.mock.calls[0]![2] as Array<{ text: string; onPress?: () => void }>;
    const confirmar = botoes.find((b) => b.text === 'Desativar');
    act(() => confirmar?.onPress?.());

    await waitFor(() =>
      expect(spyAlert).toHaveBeenCalledWith(
        'Não foi possível concluir',
        'Já existe um serviço ATIVO com este nome nesta clínica.',
      ),
    );
    spyAlert.mockRestore();
  });
});
