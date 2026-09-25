import { Platform } from 'react-native';
import { apiClient } from './api/client';
import type { PetFotoResponse, PetResponse, TimelineEventResponse } from '../types/api';
import type { FotoVarianteGerada } from '../utils/fotoPet';

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

/**
 * Anexa uma variante já MANIPULADA (nunca o arquivo cru do picker — FT-07,
 * aceite 2) numa parte do multipart. Na web, `variante.uri` é uma blob: URL
 * (saída do canvas do expo-image-manipulator) — precisa virar `Blob` de
 * verdade antes de entrar no FormData, porque o polyfill de FormData do
 * browser não aceita `{uri,name,type}` como no nativo. No nativo,
 * `{uri,name,type}` é o formato que a camada de rede (OkHttp/NSURLSession)
 * espera — mesmo padrão já usado por `enviarTranscricao`
 * (eventos-clinicos.service.ts:70-74).
 */
async function anexarParteFoto(
  formData: FormData,
  campo: 'thumb' | 'media',
  variante: FotoVarianteGerada,
): Promise<void> {
  if (Platform.OS === 'web') {
    const resposta = await fetch(variante.uri);
    const blob = await resposta.blob();
    formData.append(campo, blob, variante.fileName);
    return;
  }
  formData.append(campo, {
    uri: variante.uri,
    name: variante.fileName,
    type: variante.mimeType,
  } as unknown as Blob);
}

/**
 * Sobe a foto do pet (FT-07/FT-03: `POST /api/v1/pets/{id}/foto`, multipart
 * com EXATAMENTE 2 partes, `thumb` e `media` — o backend detecta o formato
 * pelos magic bytes e devolve 400 se as 2 partes não baterem o MESMO
 * formato). `thumb`/`media` já chegam aqui MANIPULADOS
 * (`utils/fotoPet.ts::gerarVariantesFoto`), nunca o arquivo original do
 * picker.
 *
 * Não fixa `Content-Type` manualmente: em ambos os ambientes (axios no
 * nativo via OkHttp/NSURLSession, e o `fetch`/`XMLHttpRequest` real do
 * browser na web) é a própria camada de rede que calcula o boundary do
 * multipart quando o corpo é `FormData` — forçar o header apaga esse
 * boundary e quebra o parsing do lado do servidor (ver brief FT-07 e
 * `KURA_BACKLOG_FOTO_PET.md`).
 */
export async function uploadFoto(
  idPet: number,
  thumb: FotoVarianteGerada,
  media: FotoVarianteGerada,
): Promise<PetFotoResponse> {
  const formData = new FormData();
  await anexarParteFoto(formData, 'thumb', thumb);
  await anexarParteFoto(formData, 'media', media);

  const { data } = await apiClient.post<PetFotoResponse>(
    `/api/v1/pets/${idPet}/foto`,
    formData,
  );
  return data;
}
