import type { InternalAxiosRequestConfig } from 'axios';
import type { TeleconsultaResponse } from '../services/teleconsulta.service';

// TASK-71 (FIX_6): rota ausente do mock-adapter — `criarOuObterSala`/`obterSala`
// (teleconsulta.service.ts:12,19) batem no MESMO endpoint (`POST`/`GET`
// `/api/v1/teleconsulta/{idAgendamento}/sala`), sem mock nenhum antes desta task.
// Sem `try/catch` na tela (`src/app/(app)/teleorientacao/[idPet].tsx`), era a rota
// de maior risco das 3 do backlog — a única que quebrava visivelmente em modo mock.
//
// Regra de ouro v5 (o mock alimenta o service ANTES da camada anti-corrupção): aqui
// não há camada anti-corrupção nenhuma — `teleconsulta.service.ts` é pass-through
// puro (`return response.data`, sem mapper), e `TeleconsultaResponse` já É o shape
// de entrada. Conferido campo a campo contra o DTO real do .NET
// (`backend-clinica-dotnet/src/Kura.Application/DTOs/Teleconsulta/
// TeleconsultaResponseDto.cs:3-10`):
//   IdAgendamento(long) / DsSalaUrl(string?) / DsProvedorVideo(string?) /
//   DtInicioSessao(DateTime?) / StFallbackManual(bool)
// — serializados em camelCase (padrão do System.Text.Json em ASP.NET Core, sem
// policy customizada no projeto), batendo exatamente com os 5 campos de
// `TeleconsultaResponse`. Rota exposta pelo controller real:
// `backend-clinica-dotnet/src/Kura.Api/Controllers/TeleconsultaController.cs:26-49`
// (`POST`/`GET .../{idAgendamento:long}/sala`, os dois `[Authorize]`).
export async function sala(config: InternalAxiosRequestConfig): Promise<TeleconsultaResponse> {
  const match = config.url?.match(/\/teleconsulta\/(\d+)\/sala$/);
  const idAgendamento = match ? Number(match[1]) : 0;

  // GET (obterSala): espelha o estado real "sala ainda não criada" — mesmo shape,
  // campos nulos (a tela usa isso pra mostrar o botão "Iniciar chamada" em vez de
  // "Entrar na sala"). POST (criarOuObterSala) devolve a sala já criada.
  if (config.method?.toLowerCase() === 'get') {
    return {
      idAgendamento,
      dsSalaUrl: null,
      dsProvedorVideo: null,
      dtInicioSessao: null,
      stFallbackManual: false,
    };
  }

  return {
    idAgendamento,
    dsSalaUrl: `https://kura.daily.co/mock-room-${idAgendamento}`,
    dsProvedorVideo: 'daily',
    dtInicioSessao: new Date().toISOString(),
    stFallbackManual: false,
  };
}
