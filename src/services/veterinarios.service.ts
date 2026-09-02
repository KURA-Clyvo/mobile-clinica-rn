import { apiClient } from './api/client';
import type { VeterinarioResponse } from '../types/api';

// FM-02 — serviço NOVO, não existia antes desta task. Consumido pela tela
// de usuários da clínica para oferecer um seletor OPCIONAL de `idVeterinario`
// ao criar/editar um UsuarioClinica (ver UsuariosClinicaController, campo
// idVeterinario). Medido pelo maestro: `[Authorize]` simples (qualquer
// usuário autenticado da clínica, não só GESTOR), sem parâmetro de query —
// um `clinicaId` que existia foi removido porque não escopava nada; a
// clínica vem sempre do JWT no backend. `VeterinarioResponse` já existe em
// types/api.ts (usada por LoginResponse/RegisterClinicaResponse) e é o
// mesmo DTO — reaproveitado aqui sem tradução, mesmo padrão de
// pets.service.ts.
export async function listVeterinarios(): Promise<VeterinarioResponse[]> {
  const { data } = await apiClient.get<VeterinarioResponse[]>('/api/v1/veterinarios');
  return data;
}
