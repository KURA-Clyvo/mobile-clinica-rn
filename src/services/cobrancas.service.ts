import { apiClient } from './api/client';
import type { CobrancaCreateRequest, CobrancaResponse } from '../types/api';

// FM-06 -- service NOVO, 1:1 com CobrancasController (backend-clinica-dotnet
// @ 94f558d). Só o POST: os 2 GET daquele controller são
// `[Authorize(Policy = SomenteGestor)]` (brief §3.2, medido na fonte) e
// esta task NÃO constrói leitura na tela do veterinário -- um VETERINARIO
// puro (papel que a FM-02 passou a criar) receberia 403 ao tentar listar
// as cobranças do próprio atendimento que acabou de lançar. A confirmação
// pós-lançamento é LOCAL, com o próprio CobrancaResponseDto que este POST
// devolve -- ver LancarCobrancaCard.tsx. Se um dia a listagem entrar em
// escopo (tela do GESTOR), é service novo, não extensão deste.
export async function lancarCobranca(
  idEventoClinico: number,
  req: CobrancaCreateRequest,
): Promise<CobrancaResponse> {
  const { data } = await apiClient.post<CobrancaResponse>(
    `/api/v1/eventos-clinicos/${idEventoClinico}/cobrancas`,
    req,
  );
  return data;
}
