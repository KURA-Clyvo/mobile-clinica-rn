import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listUsuariosClinica,
  criarUsuarioClinica,
  atualizarUsuarioClinica,
  desativarUsuarioClinica,
  reativarUsuarioClinica,
  trocarSenhaUsuarioClinica,
} from '@services/usuarios-clinica.service';
import { listVeterinarios } from '@services/veterinarios.service';
import type {
  UsuarioClinicaCreateRequest,
  UsuarioClinicaUpdateRequest,
  UsuarioClinicaSenhaUpdateRequest,
} from '../types/api';

// FM-02 — `retry: 0` em toda mutação: um 422 de regra de negócio (e-mail em
// uso, clínica sem gestor) não é transitório, retentar não muda o
// resultado — mesmo raciocínio das mutações de agenda/eventos clínicos já
// existentes neste app.

export function useUsuariosClinica() {
  return useQuery({
    queryKey: ['usuarios-clinica'],
    queryFn: listUsuariosClinica,
    staleTime: 30_000,
  });
}

export function useVeterinariosParaSelecao() {
  return useQuery({
    queryKey: ['veterinarios'],
    queryFn: listVeterinarios,
    staleTime: 300_000,
  });
}

export function useCriarUsuarioClinica() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: UsuarioClinicaCreateRequest) => criarUsuarioClinica(req),
    retry: 0,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios-clinica'] });
    },
  });
}

export function useAtualizarUsuarioClinica() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; req: UsuarioClinicaUpdateRequest }) =>
      atualizarUsuarioClinica(vars.id, vars.req),
    retry: 0,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios-clinica'] });
    },
  });
}

// Desativação/reativação: NÃO usar "excluir" nem "apagar" em texto de UI
// que consuma este hook -- é soft delete (ver usuarios-clinica.service.ts).
export function useDesativarUsuarioClinica() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desativarUsuarioClinica(id),
    retry: 0,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios-clinica'] });
    },
  });
}

export function useReativarUsuarioClinica() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => reativarUsuarioClinica(id),
    retry: 0,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios-clinica'] });
    },
  });
}

export function useTrocarSenhaUsuarioClinica() {
  return useMutation({
    mutationFn: (vars: { id: number; req: UsuarioClinicaSenhaUpdateRequest }) =>
      trocarSenhaUsuarioClinica(vars.id, vars.req),
    retry: 0,
  });
}
