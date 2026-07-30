import { apiClient } from './api/client';
import type {
  ConsultaRequest,
  ConsultaResponse,
  PrescricaoRequest,
  MedicamentosQuery,
  MedicamentoResponse,
  PaginatedResponse,
} from '../types/api';

export async function criarConsulta(req: ConsultaRequest): Promise<ConsultaResponse> {
  const { data } = await apiClient.post<ConsultaResponse>(
    '/api/v1/eventos-clinicos/consultas',
    req,
  );
  return data;
}

export async function criarPrescricao(
  req: PrescricaoRequest,
): Promise<{ idEventoClinico: number; idPrescricao: number }> {
  const { data } = await apiClient.post<{ idEventoClinico: number; idPrescricao: number }>(
    '/api/v1/eventos-clinicos/prescricoes',
    req,
  );
  return data;
}

export async function getMedicamentos(
  query?: MedicamentosQuery,
): Promise<PaginatedResponse<MedicamentoResponse>> {
  const { data } = await apiClient.get<PaginatedResponse<MedicamentoResponse>>(
    '/api/v1/medicamentos',
    { params: query },
  );
  return data;
}

// Espelha Kura.Application/DTOs/Transcricao/*.cs (backend-clinica-dotnet, TASK-13).
export interface SoapDraft {
  s: string | null;
  o: string | null;
  a: string | null;
  p: string | null;
}

export interface EventoClinicoSoapResponse {
  idEventoClinico: number;
  dsTranscricao: string | null;
  soap: SoapDraft;
  stSoapConfirmado: boolean;
}

/**
 * Envia o áudio da consulta para transcrição (Whisper via Luna) e recebe um
 * draft SOAP. Se a Luna estiver indisponível, transcricao/soap voltam nulos —
 * o vet edita manualmente (sem 500 fatal, ver TASK-13).
 */
export async function enviarTranscricao(
  idEventoClinico: number,
  audioUri: string,
  mimeType: string,
): Promise<EventoClinicoSoapResponse> {
  const extensao = mimeType.includes('wav') ? 'wav' : mimeType.includes('mp3') ? 'mp3' : 'm4a';
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    name: `consulta-${idEventoClinico}.${extensao}`,
    type: mimeType,
  } as unknown as Blob);

  const { data } = await apiClient.post<EventoClinicoSoapResponse>(
    `/api/v1/eventos-clinicos/${idEventoClinico}/transcricao`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

/**
 * Confirmação explícita do vet do texto SOAP (revisado/editado). Só esta
 * chamada marca stSoapConfirmado=true — nunca acontece automaticamente.
 */
export async function confirmarSoap(
  idEventoClinico: number,
  dto: SoapDraft,
): Promise<EventoClinicoSoapResponse> {
  const { data } = await apiClient.put<EventoClinicoSoapResponse>(
    `/api/v1/eventos-clinicos/${idEventoClinico}/soap`,
    dto,
  );
  return data;
}

// Espelha Kura.Application/DTOs/Documento/DocumentoResponseDto.cs (backend-clinica-dotnet, TASK-15).
export interface DocumentoResponse {
  id: number;
  idEventoClinico: number;
  nmArquivo: string;
  dsTipoMime: string;
  dsCaminho: string;
  nrTamanhoBytes: number;
}

/**
 * Gera o PDF do receituário de uma prescrição já criada (CRMV, pet,
 * medicamento/posologia/duração e data) e retorna os metadados do Documento
 * persistido (ver TASK-15). Não existe endpoint de download dos bytes ainda —
 * o PDF fica em storage no servidor.
 */
export async function gerarReceituario(idEventoClinico: number): Promise<DocumentoResponse> {
  const { data } = await apiClient.post<DocumentoResponse>(
    `/api/v1/eventos-clinicos/${idEventoClinico}/receituario`,
  );
  return data;
}
