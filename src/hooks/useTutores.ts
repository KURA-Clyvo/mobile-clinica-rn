import { useMutation, useQuery } from '@tanstack/react-query';
import { buscarTutores, criarTutor, reemitirConvite } from '@services/tutores.service';
import type { NovoTutorInput } from '../types/api';

// REC-03 — sem invalidação de cache: não existe lista de tutores em cache
// nesta tela (a lista visível é a de PACIENTES, `usePets`, que não muda com
// o cadastro de um tutor sozinho). `retry: 0` pela mesma razão de
// useUsuariosClinica.ts: um 409 (CPF/e-mail duplicado) não é transitório.
export function useCriarTutor() {
  return useMutation({
    mutationFn: (input: NovoTutorInput) => criarTutor(input),
    retry: 0,
  });
}

export function useReemitirConvite() {
  return useMutation({
    mutationFn: (vars: { idTutor: number; nomeTutor: string; whatsapp: string }) =>
      reemitirConvite(vars.idTutor, vars.nomeTutor, vars.whatsapp),
    retry: 0,
  });
}

// REC-04 — busca de "tutor existente" (pacientes/novo.tsx). Gate de 2+
// caracteres: evita listar TODOS os tutores ativos a cada tecla digitada
// (GET /tutores sem `busca` devolve o store inteiro — ver
// tutores.service.ts::buscarTutores). staleTime baixo: lista de busca não
// é dado que vale a pena manter "fresco" por muito tempo.
export function useBuscarTutores(busca: string) {
  const buscaNormalizada = busca.trim();
  return useQuery({
    queryKey: ['tutores-busca', buscaNormalizada],
    queryFn: () => buscarTutores(buscaNormalizada),
    enabled: buscaNormalizada.length >= 2,
    staleTime: 15_000,
  });
}
