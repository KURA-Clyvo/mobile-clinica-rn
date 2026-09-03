import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useServicosPreco,
  useCriarServicoPreco,
  useAtualizarServicoPreco,
  useDesativarServicoPreco,
  useReativarServicoPreco,
} from '../src/hooks/useServicosPreco';
import * as servicosPrecoService from '../src/services/servicos-preco.service';
import type { ServicoPrecoResponse } from '../src/types/api';

jest.mock('@services/servicos-preco.service', () => ({
  listServicosPreco: jest.fn(),
  criarServicoPreco: jest.fn(),
  atualizarServicoPreco: jest.fn(),
  desativarServicoPreco: jest.fn(),
  reativarServicoPreco: jest.fn(),
}));

const mockList = servicosPrecoService.listServicosPreco as jest.Mock;
const mockCriar = servicosPrecoService.criarServicoPreco as jest.Mock;
const mockAtualizar = servicosPrecoService.atualizarServicoPreco as jest.Mock;
const mockDesativar = servicosPrecoService.desativarServicoPreco as jest.Mock;
const mockReativar = servicosPrecoService.reativarServicoPreco as jest.Mock;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const servico: ServicoPrecoResponse = {
  id: 3,
  idClinica: 1,
  nmServico: 'Consulta de rotina',
  vlPreco: 150,
  stAtiva: true,
  dtCriacao: '2026-09-01T10:00:00Z',
  dtAtualizacao: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useServicosPreco', () => {
  it('carrega a lista (default: sem incluirInativos)', async () => {
    mockList.mockResolvedValue([servico]);
    const { result } = renderHook(() => useServicosPreco(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([servico]);
    expect(mockList).toHaveBeenCalledWith(false);
  });

  it('passa incluirInativos:true ao service quando pedido', async () => {
    mockList.mockResolvedValue([servico]);
    const { result } = renderHook(() => useServicosPreco(true), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockList).toHaveBeenCalledWith(true);
  });

  it('incluirInativos:false e :true usam CACHES SEPARADOS (queryKey inclui o flag)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);

    mockList.mockResolvedValueOnce([servico]);
    const somenteAtivos = renderHook(() => useServicosPreco(false), { wrapper });
    await waitFor(() => expect(somenteAtivos.result.current.isLoading).toBe(false));
    expect(somenteAtivos.result.current.data).toEqual([servico]);

    const inativo = { ...servico, id: 9, stAtiva: false };
    mockList.mockResolvedValueOnce([servico, inativo]);
    const comInativos = renderHook(() => useServicosPreco(true), { wrapper });
    await waitFor(() => expect(comInativos.result.current.isLoading).toBe(false));
    expect(comInativos.result.current.data).toEqual([servico, inativo]);
    expect(mockList).toHaveBeenCalledTimes(2);
  });
});

describe('useCriarServicoPreco', () => {
  it('invalida a lista de serviços após criar', async () => {
    mockCriar.mockResolvedValue(servico);
    const { result } = renderHook(
      () => ({ criar: useCriarServicoPreco(), lista: useServicosPreco() }),
      { wrapper: makeWrapper() },
    );
    mockList.mockResolvedValue([]);
    await waitFor(() => expect(result.current.lista.isLoading).toBe(false));

    mockList.mockResolvedValue([servico]);
    await act(async () => {
      await result.current.criar.mutateAsync({ nmServico: 'Consulta de rotina', vlPreco: 150 });
    });

    await waitFor(() => expect(result.current.lista.data).toEqual([servico]));
  });

  it('propaga o erro de negócio (422 NOME_EM_USO) sem engolir a mensagem', async () => {
    mockCriar.mockRejectedValue({
      status: 422,
      code: 'NOME_EM_USO',
      message: 'Já existe um serviço ATIVO com este nome nesta clínica.',
    });
    const { result } = renderHook(() => useCriarServicoPreco(), { wrapper: makeWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync({ nmServico: 'Consulta de rotina', vlPreco: 150 });
      } catch {
        // esperado
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { message?: string })?.message).toBe(
      'Já existe um serviço ATIVO com este nome nesta clínica.',
    );
  });
});

describe('useAtualizarServicoPreco', () => {
  it('chama o service com id e corpo separados', async () => {
    mockAtualizar.mockResolvedValue(servico);
    const { result } = renderHook(() => useAtualizarServicoPreco(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 3, req: { nmServico: 'Consulta de rotina', vlPreco: 180 } });
    });
    expect(mockAtualizar).toHaveBeenCalledWith(3, { nmServico: 'Consulta de rotina', vlPreco: 180 });
  });
});

describe('useDesativarServicoPreco / useReativarServicoPreco', () => {
  it('desativar chama o service com o id', async () => {
    mockDesativar.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDesativarServicoPreco(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync(3);
    });
    expect(mockDesativar).toHaveBeenCalledWith(3);
  });

  it('reativar chama o service com o id', async () => {
    mockReativar.mockResolvedValue({ ...servico, stAtiva: true });
    const { result } = renderHook(() => useReativarServicoPreco(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync(3);
    });
    expect(mockReativar).toHaveBeenCalledWith(3);
  });
});
