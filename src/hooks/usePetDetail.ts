import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPetById, uploadFoto } from '@services/pets.service';
import { gerarVariantesFoto } from '@utils/fotoPet';

export function usePetDetail(id: number | null) {
  return useQuery({
    queryKey: ['pets', id],
    queryFn: () => getPetById(id!),
    enabled: id !== null && id > 0,
    staleTime: 120_000,
  });
}

/**
 * FT-07: recebe a URI CRUA do picker (`uriOriginal`) e faz as 2 etapas do
 * fluxo — gerar as variantes manipuladas (`utils/fotoPet.ts::
 * gerarVariantesFoto`, nunca envia o arquivo original) e subir
 * (`pets.service.ts::uploadFoto`) — invalidando o cache do pet
 * (`['pets', id]`) ao terminar. A exibição da URL nova
 * (`dsFotoUrl`/`dsFotoThumbUrl`) é a FT-08, mas sem invalidar aqui a
 * próxima tela continuaria servindo o `staleTime` antigo (120s) de
 * `usePetDetail`.
 */
export function useUploadFotoPet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { idPet: number; uriOriginal: string }) => {
      const variantes = await gerarVariantesFoto(vars.uriOriginal, vars.idPet);
      return uploadFoto(vars.idPet, variantes.thumb, variantes.media);
    },
    retry: 0,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['pets', vars.idPet] });
    },
  });
}
