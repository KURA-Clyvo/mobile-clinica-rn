import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, AUTH_TOKEN_KEY } from './api/client';
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
 * persistido (ver TASK-15).
 */
export async function gerarReceituario(idEventoClinico: number): Promise<DocumentoResponse> {
  const { data } = await apiClient.post<DocumentoResponse>(
    `/api/v1/eventos-clinicos/${idEventoClinico}/receituario`,
  );
  return data;
}

/**
 * Baixa os bytes reais do PDF do receituário (TASK-51,
 * GET .../receituario/{idDocumento}/download) e abre no visualizador/compartilhador
 * nativo do device via expo-sharing.
 *
 * Usa File.downloadFileAsync (expo-file-system) em vez do apiClient (axios) porque a
 * resposta é um binário puro (application/pdf), não JSON — e porque axios não expõe
 * um jeito direto de gravar a resposta em disco no React Native. O Bearer token é
 * anexado manualmente (o download não passa pelo interceptor de auth do apiClient).
 */
export async function baixarEAbrirReceituario(
  idEventoClinico: number,
  documento: DocumentoResponse,
): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  const url = `${baseUrl}/api/v1/eventos-clinicos/${idEventoClinico}/receituario/${documento.id}/download`;
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);

  const destino = new File(Paths.cache, documento.nmArquivo);
  const arquivoBaixado = await File.downloadFileAsync(url, destino, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    // Reemitir a receita para o mesmo evento gera um nmArquivo novo (UUID), mas se o
    // vet tentar baixar de novo o mesmo documento o arquivo local já existe — sem
    // idempotent:true a segunda tentativa falharia com DestinationAlreadyExists.
    idempotent: true,
  });

  const compartilhamentoDisponivel = await Sharing.isAvailableAsync();
  if (compartilhamentoDisponivel) {
    await Sharing.shareAsync(arquivoBaixado.uri, {
      mimeType: documento.dsTipoMime,
      dialogTitle: documento.nmArquivo,
    });
  }
}
