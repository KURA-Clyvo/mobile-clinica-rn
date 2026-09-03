import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listServicosPreco,
  criarServicoPreco,
  atualizarServicoPreco,
  desativarServicoPreco,
  reativarServicoPreco,
} from '@services/servicos-preco.service';
import type { ServicoPrecoCreateRequest, ServicoPrecoUpdateRequest } from '../types/api';

// FM-05 — mesmo padrão de useUsuariosClinica.ts: `retry: 0` em toda mutação
// (um 422 de regra de negócio -- nome em uso, serviço desativado -- não é
// transitório, retentar não muda o resultado).
//
// `incluirInativos` entra na `queryKey` pelo MESMO motivo do FM-02 (brief
// §4): sem isso, o toggle "Mostrar desativados" devolveria o cache da
// OUTRA variante e não faria nada. As mutações invalidam só
// `['servicos-preco']` (sem o 2º elemento) -- invalidateQueries casa por
// PREFIXO, invalidando as DUAS variantes de uma vez.
export function useServicosPreco(incluirInativos = false) {
  return useQuery({
    queryKey: ['servicos-preco', incluirInativos],
    queryFn: () => listServicosPreco(incluirInativos),
    staleTime: 30_000,
  });
}

export function useCriarServicoPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ServicoPrecoCreateRequest) => criarServicoPreco(req),
    retry: 0,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servicos-preco'] });
    },
  });
}

export function useAtualizarServicoPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; req: ServicoPrecoUpdateRequest }) =>
      atualizarServicoPreco(vars.id, vars.req),
    retry: 0,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servicos-preco'] });
    },
  });
}

// Desativação/reativação: NÃO usar "excluir" nem "apagar" em texto de UI
// que consuma este hook -- é soft delete (ver servicos-preco.service.ts).
export function useDesativarServicoPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => desativarServicoPreco(id),
    retry: 0,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servicos-preco'] });
    },
  });
}

export function useReativarServicoPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => reativarServicoPreco(id),
    retry: 0,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['servicos-preco'] });
    },
  });
}
