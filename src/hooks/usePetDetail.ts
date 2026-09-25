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
 *
 * `larguraOriginal` (fix wave G2, m-4): largura da foto ANTES do reencode,
 * repassada direto para `gerarVariantesFoto` — evita ampliar fotos menores
 * que os alvos 256/1080. Opcional: sem ela, o comportamento é o mesmo de
 * antes desta fix wave.
 *
 * Cobertura de integração (fix wave G2, I-1 — `tests/useUploadFotoPet.
 * test.ts`): é NESTA função, e só nela, que a regra A4 (nunca subir o
 * arquivo cru do picker) se realiza — `gerarVariantesFoto` e `uploadFoto`
 * são testados isolados em `fotoPet.test.ts`/`pets.service.test.ts`, mas
 * nenhum dos dois prova que UM chama o OUTRO com os argumentos certos.
 */
export function useUploadFotoPet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { idPet: number; uriOriginal: string; larguraOriginal?: number }) => {
      const variantes = await gerarVariantesFoto(vars.uriOriginal, vars.idPet, vars.larguraOriginal);
      return uploadFoto(vars.idPet, variantes.thumb, variantes.media);
    },
    retry: 0,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['pets', vars.idPet] });
    },
  });
}
