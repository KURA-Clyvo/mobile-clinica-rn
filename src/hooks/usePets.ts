import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { criarPet, listPets } from '@services/pets.service';
import type { NovoPetInput } from '../types/api';

export function usePets(filtro?: string) {
  return useQuery({
    queryKey: ['pets', { filtro: filtro ?? '' }],
    queryFn: () => listPets(filtro),
    staleTime: 60_000,
  });
}

/**
 * REC-04 — "o paciente novo aparece na lista sem recarregar": invalida a
 * query key raiz `['pets']`, que casa com TODA variação de `usePets(filtro)`
 * (a queryKey de `usePets` é `['pets', {filtro}]`, e o React Query invalida
 * por PREFIXO — `invalidateQueries({queryKey:['pets']})` alcança qualquer
 * filtro em cache, não só o filtro vazio da tela de pacientes). `retry: 0`
 * mesmo padrão de `useCriarTutor` — um 404 (tutor inexistente)/400
 * (validação) não é transitório.
 */
export function useCriarPet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NovoPetInput) => criarPet(input),
    retry: 0,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pets'] });
    },
  });
}
