jest.mock('@services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  lunaClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../src/services/api/client';
import {
  listUsuariosClinica,
  getUsuarioClinica,
  criarUsuarioClinica,
  atualizarUsuarioClinica,
  desativarUsuarioClinica,
  reativarUsuarioClinica,
  trocarSenhaUsuarioClinica,
} from '../src/services/usuarios-clinica.service';
import type { UsuarioClinicaResponse } from '../src/types/api';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockPut = apiClient.put as jest.Mock;
const mockDelete = apiClient.delete as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

const usuario: UsuarioClinicaResponse = {
  id: 1,
  idClinica: 1,
  idVeterinario: null,
  dsEmail: 'novo@kura.vet',
  tpPerfil: 'VETERINARIO',
  stAtiva: true,
  dtCriacao: '2026-09-01T10:00:00Z',
  dtAtualizacao: null,
};

describe('usuarios-clinica.service', () => {
  it('listUsuariosClinica chama GET /api/v1/usuarios-clinica', async () => {
    mockGet.mockResolvedValue({ data: [usuario] });
    const result = await listUsuariosClinica();
    expect(mockGet).toHaveBeenCalledWith('/api/v1/usuarios-clinica');
    expect(result).toEqual([usuario]);
  });

  it('getUsuarioClinica chama GET /api/v1/usuarios-clinica/{id}', async () => {
    mockGet.mockResolvedValue({ data: usuario });
    const result = await getUsuarioClinica(1);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/usuarios-clinica/1');
    expect(result).toEqual(usuario);
  });

  it('criarUsuarioClinica chama POST com o corpo exato do DTO real (sem idVeterinario)', async () => {
    mockPost.mockResolvedValue({ data: usuario });
    const result = await criarUsuarioClinica({
      dsEmail: 'novo@kura.vet',
      dsSenha: 'senha123',
      tpPerfil: 'VETERINARIO',
      // idVeterinario OMITIDO -- a mordida obrigatória do brief: VETERINARIO
      // sem ficha vinculada.
    });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/usuarios-clinica', {
      dsEmail: 'novo@kura.vet',
      dsSenha: 'senha123',
      tpPerfil: 'VETERINARIO',
    });
    expect(result.idVeterinario).toBeNull();
  });

  it('atualizarUsuarioClinica chama PUT sem campo de senha no corpo', async () => {
    mockPut.mockResolvedValue({ data: usuario });
    await atualizarUsuarioClinica(1, {
      dsEmail: 'novo@kura.vet',
      tpPerfil: 'VETERINARIO',
      idVeterinario: null,
    });
    expect(mockPut).toHaveBeenCalledWith('/api/v1/usuarios-clinica/1', {
      dsEmail: 'novo@kura.vet',
      tpPerfil: 'VETERINARIO',
      idVeterinario: null,
    });
    const bodyEnviado = mockPut.mock.calls[0][1] as Record<string, unknown>;
    expect(bodyEnviado).not.toHaveProperty('dsSenha');
  });

  it('desativarUsuarioClinica chama DELETE e não devolve corpo (204)', async () => {
    mockDelete.mockResolvedValue({ data: undefined });
    const result = await desativarUsuarioClinica(1);
    expect(mockDelete).toHaveBeenCalledWith('/api/v1/usuarios-clinica/1');
    expect(result).toBeUndefined();
  });

  it('reativarUsuarioClinica chama POST /{id}/reativacao sem corpo', async () => {
    mockPost.mockResolvedValue({ data: { ...usuario, stAtiva: true } });
    const result = await reativarUsuarioClinica(1);
    expect(mockPost).toHaveBeenCalledWith('/api/v1/usuarios-clinica/1/reativacao');
    expect(result.stAtiva).toBe(true);
  });

  it('trocarSenhaUsuarioClinica chama PUT /{id}/senha e não devolve corpo (204)', async () => {
    mockPut.mockResolvedValue({ data: undefined });
    const result = await trocarSenhaUsuarioClinica(1, { dsSenha: 'novaSenha123' });
    expect(mockPut).toHaveBeenCalledWith('/api/v1/usuarios-clinica/1/senha', {
      dsSenha: 'novaSenha123',
    });
    expect(result).toBeUndefined();
  });
});
