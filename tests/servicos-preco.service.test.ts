jest.mock('@services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  lunaClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../src/services/api/client';
import {
  listServicosPreco,
  getServicoPreco,
  criarServicoPreco,
  atualizarServicoPreco,
  reativarServicoPreco,
  desativarServicoPreco,
} from '../src/services/servicos-preco.service';
import type { ServicoPrecoResponse } from '../src/types/api';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockPut = apiClient.put as jest.Mock;
const mockDelete = apiClient.delete as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

const servico: ServicoPrecoResponse = {
  id: 1,
  idClinica: 1,
  nmServico: 'Consulta de rotina',
  vlPreco: 150,
  stAtiva: true,
  dtCriacao: '2026-09-01T10:00:00Z',
  dtAtualizacao: null,
};

describe('servicos-preco.service', () => {
  it('listServicosPreco SEM argumento chama GET sem params (default backend: só ativos)', async () => {
    mockGet.mockResolvedValue({ data: [servico] });
    const result = await listServicosPreco();
    expect(mockGet).toHaveBeenCalledWith('/api/v1/servicos-preco', undefined);
    expect(result).toEqual([servico]);
  });

  it('listServicosPreco(false) explícito também OMITE params -- equivalente ao default', async () => {
    mockGet.mockResolvedValue({ data: [] });
    await listServicosPreco(false);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/servicos-preco', undefined);
  });

  // Mordida do achado §1.6 do brief: o binder do backend é `bool` NÃO
  // anulável -- `incluirInativos=1` recusa com 400. Mandar por PARAMS
  // (nunca concatenar na URL) garante que o axios serializa como o
  // literal `true`/`false`, não `1`/`0`.
  it('listServicosPreco(true) chama GET com params incluirInativos:true (booleano, não 1)', async () => {
    mockGet.mockResolvedValue({ data: [servico, { ...servico, id: 2, stAtiva: false }] });
    const result = await listServicosPreco(true);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/servicos-preco', {
      params: { incluirInativos: true },
    });
    expect(typeof mockGet.mock.calls[0]![1]!.params.incluirInativos).toBe('boolean');
    expect(result).toHaveLength(2);
  });

  it('getServicoPreco chama GET /api/v1/servicos-preco/{id}', async () => {
    mockGet.mockResolvedValue({ data: servico });
    const result = await getServicoPreco(1);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/servicos-preco/1');
    expect(result).toEqual(servico);
  });

  it('criarServicoPreco chama POST com o corpo exato (nmServico, vlPreco)', async () => {
    mockPost.mockResolvedValue({ data: servico });
    const result = await criarServicoPreco({ nmServico: 'Consulta de rotina', vlPreco: 150 });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/servicos-preco', {
      nmServico: 'Consulta de rotina',
      vlPreco: 150,
    });
    expect(result).toEqual(servico);
  });

  it('atualizarServicoPreco chama PUT com o corpo exato, sem campo de status', async () => {
    mockPut.mockResolvedValue({ data: { ...servico, vlPreco: 180 } });
    await atualizarServicoPreco(1, { nmServico: 'Consulta de rotina', vlPreco: 180 });
    expect(mockPut).toHaveBeenCalledWith('/api/v1/servicos-preco/1', {
      nmServico: 'Consulta de rotina',
      vlPreco: 180,
    });
    const bodyEnviado = mockPut.mock.calls[0][1] as Record<string, unknown>;
    expect(bodyEnviado).not.toHaveProperty('stAtiva');
  });

  it('reativarServicoPreco chama POST /{id}/reativacao sem corpo', async () => {
    mockPost.mockResolvedValue({ data: { ...servico, stAtiva: true } });
    const result = await reativarServicoPreco(1);
    expect(mockPost).toHaveBeenCalledWith('/api/v1/servicos-preco/1/reativacao');
    expect(result.stAtiva).toBe(true);
  });

  it('desativarServicoPreco chama DELETE e não devolve corpo (204)', async () => {
    mockDelete.mockResolvedValue({ data: undefined });
    const result = await desativarServicoPreco(1);
    expect(mockDelete).toHaveBeenCalledWith('/api/v1/servicos-preco/1');
    expect(result).toBeUndefined();
  });
});
