import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useUsuariosClinica,
  useVeterinariosParaSelecao,
  useCriarUsuarioClinica,
  useAtualizarUsuarioClinica,
  useDesativarUsuarioClinica,
  useReativarUsuarioClinica,
  useTrocarSenhaUsuarioClinica,
} from '../src/hooks/useUsuariosClinica';
import * as usuariosService from '../src/services/usuarios-clinica.service';
import * as veterinariosService from '../src/services/veterinarios.service';
import type { UsuarioClinicaResponse } from '../src/types/api';

jest.mock('@services/usuarios-clinica.service', () => ({
  listUsuariosClinica: jest.fn(),
  criarUsuarioClinica: jest.fn(),
  atualizarUsuarioClinica: jest.fn(),
  desativarUsuarioClinica: jest.fn(),
  reativarUsuarioClinica: jest.fn(),
  trocarSenhaUsuarioClinica: jest.fn(),
}));

jest.mock('@services/veterinarios.service', () => ({
  listVeterinarios: jest.fn(),
}));

const mockList = usuariosService.listUsuariosClinica as jest.Mock;
const mockCriar = usuariosService.criarUsuarioClinica as jest.Mock;
const mockAtualizar = usuariosService.atualizarUsuarioClinica as jest.Mock;
const mockDesativar = usuariosService.desativarUsuarioClinica as jest.Mock;
const mockReativar = usuariosService.reativarUsuarioClinica as jest.Mock;
const mockTrocarSenha = usuariosService.trocarSenhaUsuarioClinica as jest.Mock;
const mockListVet = veterinariosService.listVeterinarios as jest.Mock;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const usuario: UsuarioClinicaResponse = {
  id: 3,
  idClinica: 1,
  idVeterinario: null,
  dsEmail: 'novo@kura.vet',
  tpPerfil: 'VETERINARIO',
  stAtiva: true,
  dtCriacao: '2026-09-01T10:00:00Z',
  dtAtualizacao: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useUsuariosClinica', () => {
  it('carrega a lista de usuários da clínica', async () => {
    mockList.mockResolvedValue([usuario]);
    const { result } = renderHook(() => useUsuariosClinica(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([usuario]);
  });
});

describe('useVeterinariosParaSelecao', () => {
  it('carrega a lista de fichas de veterinário para o seletor', async () => {
    mockListVet.mockResolvedValue([{ id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-1', dsEmail: 'f@kura.vet' }]);
    const { result } = renderHook(() => useVeterinariosParaSelecao(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
  });
});

describe('useCriarUsuarioClinica', () => {
  it('invalida a lista de usuários da clínica após criar', async () => {
    mockCriar.mockResolvedValue(usuario);
    const { result } = renderHook(
      () => ({ criar: useCriarUsuarioClinica(), lista: useUsuariosClinica() }),
      { wrapper: makeWrapper() },
    );
    mockList.mockResolvedValue([]);
    await waitFor(() => expect(result.current.lista.isLoading).toBe(false));

    mockList.mockResolvedValue([usuario]);
    await act(async () => {
      await result.current.criar.mutateAsync({
        dsEmail: 'novo@kura.vet',
        dsSenha: 'senha123',
        tpPerfil: 'VETERINARIO',
      });
    });

    await waitFor(() => expect(result.current.lista.data).toEqual([usuario]));
  });

  it('propaga o erro de negócio (422) sem engolir a mensagem', async () => {
    mockCriar.mockRejectedValue({ status: 422, code: 'EMAIL_EM_USO', message: 'Este e-mail já está em uso nesta clínica.' });
    const { result } = renderHook(() => useCriarUsuarioClinica(), { wrapper: makeWrapper() });

    await act(async () => {
      try {
        await result.current.mutateAsync({ dsEmail: 'dup@kura.vet', dsSenha: 'senha123', tpPerfil: 'GESTOR' });
      } catch {
        // esperado
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { message?: string })?.message).toBe(
      'Este e-mail já está em uso nesta clínica.',
    );
  });
});

describe('useAtualizarUsuarioClinica', () => {
  it('chama o service com id e corpo separados', async () => {
    mockAtualizar.mockResolvedValue(usuario);
    const { result } = renderHook(() => useAtualizarUsuarioClinica(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({
        id: 3,
        req: { dsEmail: 'novo@kura.vet', tpPerfil: 'VETERINARIO', idVeterinario: null },
      });
    });
    expect(mockAtualizar).toHaveBeenCalledWith(3, {
      dsEmail: 'novo@kura.vet',
      tpPerfil: 'VETERINARIO',
      idVeterinario: null,
    });
  });
});

describe('useDesativarUsuarioClinica / useReativarUsuarioClinica', () => {
  it('desativar chama o service com o id', async () => {
    mockDesativar.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDesativarUsuarioClinica(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync(3);
    });
    expect(mockDesativar).toHaveBeenCalledWith(3);
  });

  it('reativar chama o service com o id', async () => {
    mockReativar.mockResolvedValue({ ...usuario, stAtiva: true });
    const { result } = renderHook(() => useReativarUsuarioClinica(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync(3);
    });
    expect(mockReativar).toHaveBeenCalledWith(3);
  });
});

describe('useTrocarSenhaUsuarioClinica', () => {
  it('chama o service com id e corpo separados', async () => {
    mockTrocarSenha.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTrocarSenhaUsuarioClinica(), { wrapper: makeWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ id: 3, req: { dsSenha: 'novaSenha123' } });
    });
    expect(mockTrocarSenha).toHaveBeenCalledWith(3, { dsSenha: 'novaSenha123' });
  });
});
