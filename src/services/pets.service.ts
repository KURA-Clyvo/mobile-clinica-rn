import { apiClient } from './api/client';
import type { PetResponse, TimelineEventResponse } from '../types/api';

export async function listPets(filtro?: string): Promise<PetResponse[]> {
  const { data } = await apiClient.get<PetResponse[]>('/api/v1/pets');
  if (!filtro) return data;
  const f = filtro.toLowerCase();
  return data.filter(
    (pet) =>
      pet.nmPet.toLowerCase().includes(f) ||
      pet.tutores.some((t) => t.nmTutor.toLowerCase().includes(f)),
  );
}

export async function getPetById(id: number): Promise<PetResponse> {
  const { data } = await apiClient.get<PetResponse>(`/api/v1/pets/${id}`);
  return data;
}

export async function getPetTimeline(id: number): Promise<TimelineEventResponse[]> {
  const { data } = await apiClient.get<TimelineEventResponse[]>(`/api/v1/pets/${id}/timeline`);
  return data;
}
