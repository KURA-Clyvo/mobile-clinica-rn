import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  criarConsulta,
  criarPrescricao,
  getMedicamentos,
} from '@services/eventos-clinicos.service';
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

export function useMedicamentos(busca?: string) {
  const query: MedicamentosQuery = { busca, pageSize: 20 };
  return useQuery({
    queryKey: ['medicamentos', busca ?? ''],
    queryFn: () => getMedicamentos(query),
    staleTime: 300_000,
    enabled: true,
  });
}
