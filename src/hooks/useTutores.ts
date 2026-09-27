import { useMutation } from '@tanstack/react-query';
import { criarTutor, reemitirConvite } from '@services/tutores.service';
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
