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

export async function listUsuariosClinica(): Promise<UsuarioClinicaResponse[]> {
  const { data } = await apiClient.get<UsuarioClinicaResponse[]>('/api/v1/usuarios-clinica');
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
