import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  criarConsulta,
  criarPrescricao,
  getMedicamentos,
  enviarTranscricao,
  confirmarSoap,
  gerarReceituario,
  baixarEAbrirReceituario,
} from '@services/eventos-clinicos.service';
import type { SoapDraft, DocumentoResponse } from '@services/eventos-clinicos.service';
import { enviarWhatsApp } from '@services/luna.service';
import type { ConsultaRequest, PrescricaoRequest, MedicamentosQuery, WhatsAppEnvioRequest } from '../types/api';

export function useCriarConsulta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ConsultaRequest) => criarConsulta(req),
    retry: 0,
    onSuccess: (_data, req) => {
      qc.invalidateQueries({ queryKey: ['pets', req.idPet, 'timeline'] });
    },
  });
}

export function useCriarPrescricao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: PrescricaoRequest) => criarPrescricao(req),
    retry: 0,
    onSuccess: (_data, req) => {
      qc.invalidateQueries({ queryKey: ['pets', req.idPet, 'timeline'] });
    },
  });
}

export function useEnviarWhatsApp() {
  return useMutation({
    mutationFn: (req: WhatsAppEnvioRequest) => enviarWhatsApp(req),
    retry: 0,
  });
}

export function useEnviarTranscricao() {
  return useMutation({
    mutationFn: (vars: { idEventoClinico: number; audioUri: string; mimeType: string }) =>
      enviarTranscricao(vars.idEventoClinico, vars.audioUri, vars.mimeType),
    retry: 0,
  });
}

export function useConfirmarSoap() {
  return useMutation({
    mutationFn: (vars: { idEventoClinico: number; dto: SoapDraft }) =>
      confirmarSoap(vars.idEventoClinico, vars.dto),
    retry: 0,
  });
}

export function useGerarReceituario() {
  return useMutation({
    mutationFn: (idEventoClinico: number) => gerarReceituario(idEventoClinico),
    retry: 0,
  });
}

/**
 * Baixa os bytes do PDF já gerado e abre no visualizador/compartilhador nativo
 * (TASK-51) — substitui o modal de metadados por um preview real do arquivo.
 */
export function useBaixarReceituario() {
  return useMutation({
    mutationFn: (vars: { idEventoClinico: number; documento: DocumentoResponse }) =>
      baixarEAbrirReceituario(vars.idEventoClinico, vars.documento),
    retry: 0,
  });
}

export function useMedicamentos(busca?: string) {
  const query: MedicamentosQuery = { busca, pageSize: 20 };
  return useQuery({
    queryKey: ['medicamentos', busca ?? ''],
    queryFn: () => getMedicamentos(query),
    staleTime: 300_000,
    enabled: true,
  });
}
