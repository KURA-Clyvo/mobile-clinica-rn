import { apiClient } from './api/client';
import type {
  UsuarioClinicaResponse,
  UsuarioClinicaCreateRequest,
  UsuarioClinicaUpdateRequest,
  UsuarioClinicaSenhaUpdateRequest,
} from '../types/api';

// FM-02 — service NOVO, 1:1 com UsuariosClinicaController (7 rotas,
// backend-clinica-dotnet @ de96c70, todas [Authorize(Policy = SomenteGestor)]
// no controller — o backend já barra quem não é GESTOR, esta camada não
// duplica a checagem). Sem tradução de shape: UsuarioClinicaResponse já é o
// DTO real (mesmo padrão de pets.service.ts) — DIFERENTE de
// dashboard.service.ts, que combina/renomeia campos de vários DTOs.

// FM-05 (brief §4, ruling D-14 do Felipe: "corrige a FM-05 e a FM-02 de uma
// vez") — FD-16 acrescentou `incluirInativos` (default `false`) também em
// UsuariosClinicaController.cs:66 (mesmo padrão de ServicosPrecoController,
// ver servicos-preco.service.ts). Mesma decisão declarada sobre `params`:
// OMITIDO quando `false` (mais perto do default real do backend); o mock
// trata ausência e `false` explícito como equivalentes.
export async function listUsuariosClinica(
  incluirInativos = false,
): Promise<UsuarioClinicaResponse[]> {
  const { data } = await apiClient.get<UsuarioClinicaResponse[]>(
    '/api/v1/usuarios-clinica',
    incluirInativos ? { params: { incluirInativos: true } } : undefined,
  );
  return data;
}

export async function getUsuarioClinica(id: number): Promise<UsuarioClinicaResponse> {
  const { data } = await apiClient.get<UsuarioClinicaResponse>(`/api/v1/usuarios-clinica/${id}`);
  return data;
}

export async function criarUsuarioClinica(
  req: UsuarioClinicaCreateRequest,
): Promise<UsuarioClinicaResponse> {
  const { data } = await apiClient.post<UsuarioClinicaResponse>('/api/v1/usuarios-clinica', req);
  return data;
}

export async function atualizarUsuarioClinica(
  id: number,
  req: UsuarioClinicaUpdateRequest,
): Promise<UsuarioClinicaResponse> {
  const { data } = await apiClient.put<UsuarioClinicaResponse>(
    `/api/v1/usuarios-clinica/${id}`,
    req,
  );
  return data;
}

// 204, sem corpo — a UI/textos SEMPRE dizem "desativar", nunca "excluir":
// é soft delete (StAtiva -> 'N'), não exclusão física. Ver UsuarioClinica no
// backend, mesma convenção de soft delete das demais entidades do domínio.
export async function desativarUsuarioClinica(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/usuarios-clinica/${id}`);
}

export async function reativarUsuarioClinica(id: number): Promise<UsuarioClinicaResponse> {
  const { data } = await apiClient.post<UsuarioClinicaResponse>(
    `/api/v1/usuarios-clinica/${id}/reativacao`,
  );
  return data;
}

// 204, sem corpo.
export async function trocarSenhaUsuarioClinica(
  id: number,
  req: UsuarioClinicaSenhaUpdateRequest,
): Promise<void> {
  await apiClient.put(`/api/v1/usuarios-clinica/${id}/senha`, req);
}
