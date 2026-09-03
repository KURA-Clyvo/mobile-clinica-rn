import { apiClient } from './api/client';
import type {
  ServicoPrecoResponse,
  ServicoPrecoCreateRequest,
  ServicoPrecoUpdateRequest,
} from '../types/api';

// FM-05 — service NOVO, 1:1 com ServicosPrecoController (6 rotas,
// backend-clinica-dotnet @ 94f558d): as 4 de escrita (POST, PUT, POST
// /reativacao, DELETE) são `[Authorize(Policy = SomenteGestor)]` — o
// backend já barra quem não é GESTOR, esta camada não duplica a checagem.
// Sem tradução de shape: ServicoPrecoResponse já é o DTO real (mesmo
// padrão de usuarios-clinica.service.ts/pets.service.ts).

// FD-16 — `incluirInativos` (default `false`, igual ao comportamento do
// backend antes daquela migration) traz também os desativados.
//
// 🔴 DECISÃO DECLARADA (brief §3.2/§3.7): quando `false`, o `params` é
// OMITIDO em vez de mandar `{ incluirInativos: false }` explícito — mais
// próximo do default real do backend (`[FromQuery] bool incluirInativos =
// false`, ServicosPrecoController.cs:109), e evita depender de o mock ler
// um valor que nem precisaria existir na chamada. O mock trata AUSÊNCIA de
// `config.params` e `incluirInativos: false` explícito como EQUIVALENTES
// (ver servicos-preco.mock.ts::lerIncluirInativos) — os dois são válidos
// pelo contrato do backend (o model binder de `bool` aceita `true`/`false`
// e usa o default quando o parâmetro não vem na query string).
//
// ⚠️ NUNCA concatenar `?incluirInativos=true` na URL — as entradas de
// `ROUTES` em mock-adapter.ts são regex ANCORADAS EM `$`, e o axios não põe
// `params` na string de `config.url`. Concatenar faz o `$` parar de casar e
// o mock NUNCA disparar, em silêncio (ver comentário completo em
// mock-adapter.ts).
export async function listServicosPreco(
  incluirInativos = false,
): Promise<ServicoPrecoResponse[]> {
  const { data } = await apiClient.get<ServicoPrecoResponse[]>(
    '/api/v1/servicos-preco',
    incluirInativos ? { params: { incluirInativos: true } } : undefined,
  );
  return data;
}

// GET /{id} -- devolve o serviço mesmo DESATIVADO (ServicoPrecoRepository.cs:32-35,
// BuscarPorIdNaClinicaAsync não filtra StAtiva -- só a LISTA filtra).
export async function getServicoPreco(id: number): Promise<ServicoPrecoResponse> {
  const { data } = await apiClient.get<ServicoPrecoResponse>(`/api/v1/servicos-preco/${id}`);
  return data;
}

export async function criarServicoPreco(
  req: ServicoPrecoCreateRequest,
): Promise<ServicoPrecoResponse> {
  const { data } = await apiClient.post<ServicoPrecoResponse>('/api/v1/servicos-preco', req);
  return data;
}

export async function atualizarServicoPreco(
  id: number,
  req: ServicoPrecoUpdateRequest,
): Promise<ServicoPrecoResponse> {
  const { data } = await apiClient.put<ServicoPrecoResponse>(
    `/api/v1/servicos-preco/${id}`,
    req,
  );
  return data;
}

export async function reativarServicoPreco(id: number): Promise<ServicoPrecoResponse> {
  const { data } = await apiClient.post<ServicoPrecoResponse>(
    `/api/v1/servicos-preco/${id}/reativacao`,
  );
  return data;
}

// 204, sem corpo -- SEMPRE "desativar" na UI, nunca "excluir"/"apagar": é
// soft delete (StAtiva -> false), não exclusão física.
export async function desativarServicoPreco(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/servicos-preco/${id}`);
}
