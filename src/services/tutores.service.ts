import { apiClient } from './api/client';
import type {
  TutorDetalheApiResponse,
  TutorDetalheResponse,
  NovoTutorInput,
  ConviteTutor,
  TutorCreateWireDto,
  TutorComInviteWireDto,
  InviteReemitidoWireDto,
  TutorBuscaWireDto,
  ApiError,
} from '../types/api';
import { somenteDigitos, paraEnvioServidor } from '../utils/telefone';

// LU-09 fix wave 1 (item 2, lu-09-revisao.md G2-3): sentinela que o .NET grava em
// `NR_TELEFONE` quando o cadastro do tutor não tem telefone (TutorService.cs:97-99,
// TASK-60, coalesce de NOT NULL do Oracle) — confirmado literalmente na fonte:
// `grep -rn "Não informado" src` em backend-clinica-dotnet, 2 ocorrências. Um
// telefone igual a este literal (ou vazio) não é um número real e nunca deve ser
// oferecido como destino de WhatsApp — mandar `para: "Não informado"` para a Luna
// resulta em falha de envio (502, Twilio rejeita o destinatário).
export const TELEFONE_SENTINELA = 'Não informado';

export function telefoneDisponivel(telefone: string | null | undefined): boolean {
  return !!telefone && telefone.trim().length > 0 && telefone !== TELEFONE_SENTINELA;
}

/**
 * LU-09: busca o tutor pelo ID para a ação "Responder no WhatsApp" da Fila da Luna.
 * GET /api/v1/tutores/{id} (TutoresController.cs:44) — JWT de clínica, escopado por
 * IClinicaContext no service (.NET), NUNCA vaza tutor de outra clínica. Só 3 campos do
 * TutorResponseDto real (Id/NmTutor/NrTelefone) entram no tipo interno — o resto
 * (NrCpf/DsEmail/StAtiva) não é necessário para este fluxo.
 */
export async function getTutorById(id: number): Promise<TutorDetalheResponse> {
  const { data } = await apiClient.get<TutorDetalheApiResponse>(`/api/v1/tutores/${id}`);
  return {
    id: data.id,
    nmTutor: data.nmTutor,
    nrTelefone: data.nrTelefone,
  };
}

// ─── REC-03: cadastro de tutor + convite ────────────────────────
// POST /api/v1/tutores (rec-03-report.md — contrato confirmado na fonte
// contra backend-clinica-dotnet `origin/main` e33da98, TutorCreateDto ->
// TutorComInviteResponseDto). `dsWhatsapp` só entra no corpo quando o tutor
// NÃO usa "mesmo número" — omitido (não enviado como string vazia/undefined
// explícito) é o sinal que o backend espera para assumir o `nrTelefone`.
//
// G2 (I-1): `nrTelefone`/`dsWhatsapp` usam `paraEnvioServidor` (preserva o
// '+' quando presente), NÃO `somenteDigitos` puro — o '+' é o sinal que
// `NormalizadorTelefone.cs` usa para decidir se o número é estrangeiro/
// já-prefixado (ramo 1) ou nacional (ramo 3, prefixa 55 sozinho). Enviar só
// dígitos, sem o '+', fazia o servidor tratar QUALQUER estrangeiro de
// 11-13 dígitos como nacional brasileiro — corrompendo o número em silêncio.
//
// `stAvisoPrivacidadeInformado` repassa o booleano LITERAL do input — nunca
// fixar `true` aqui (a defesa em profundidade do servidor, 400 quando
// ausente/false, só vale se o valor que chega for o que a recepção marcou de
// verdade; ver mordida m4 em tutores.service.test.ts).
export async function criarTutor(input: NovoTutorInput): Promise<ConviteTutor> {
  const nrTelefoneEnvio = paraEnvioServidor(input.nrTelefone);
  const usaMesmoWhatsapp = input.usaMesmoWhatsapp;
  const dsWhatsappEnvio = input.dsWhatsapp ? paraEnvioServidor(input.dsWhatsapp) : '';

  const body: TutorCreateWireDto = {
    nmTutor: input.nmTutor.trim(),
    nrCpf: somenteDigitos(input.nrCpf),
    dsEmail: input.dsEmail.trim(),
    nrTelefone: nrTelefoneEnvio,
    stAvisoPrivacidadeInformado: input.aceitouAvisoPrivacidade,
    ...(usaMesmoWhatsapp ? {} : { dsWhatsapp: dsWhatsappEnvio }),
  };

  const { data } = await apiClient.post<TutorComInviteWireDto>('/api/v1/tutores', body);

  return mapConviteDeCriacao(data, usaMesmoWhatsapp ? nrTelefoneEnvio : dsWhatsappEnvio);
}

// POST /api/v1/tutores/{id}/convite. Não devolve nome/whatsapp do tutor
// (só o invite) — quem chama já tem esses dois valores da tela de convite
// aberta (estado local), e os repassa de volta para o resultado.
export async function reemitirConvite(
  idTutor: number,
  nomeTutor: string,
  whatsapp: string,
): Promise<ConviteTutor> {
  const { data } = await apiClient.post<InviteReemitidoWireDto>(
    `/api/v1/tutores/${idTutor}/convite`,
  );
  return {
    idTutor,
    nomeTutor,
    whatsapp,
    nrToken: data.invite.nrToken,
    dtExpiracao: data.invite.dtExpiracao,
    dsLinkConvite: data.dsLinkConvite,
  };
}

// REC-04 — "Adicionar pet a partir de um tutor existente" (pacientes/novo.tsx).
// GET /api/v1/tutores?busca= (TutoresController.cs:29-35 -> ITutorService.
// SearchAsync) — busca textual por nome OU CPF, idempotente, sem side effect.
// Sem parâmetro (`busca` vazio/ausente) o backend devolve TODOS os tutores
// ativos; o CHAMADOR desta função decide quando vale a pena chamar (ver
// useBuscarTutores — gate de 2+ caracteres, evita listar tudo a cada tecla).
export async function buscarTutores(busca: string): Promise<TutorBuscaWireDto[]> {
  const { data } = await apiClient.get<TutorBuscaWireDto[]>('/api/v1/tutores', {
    params: busca.trim() ? { busca: busca.trim() } : undefined,
  });
  return data;
}

function mapConviteDeCriacao(data: TutorComInviteWireDto, whatsapp: string): ConviteTutor {
  return {
    idTutor: data.id,
    nomeTutor: data.nmTutor,
    whatsapp,
    nrToken: data.invite.nrToken,
    dtExpiracao: data.invite.dtExpiracao,
    dsLinkConvite: data.dsLinkConvite,
  };
}

// E46 (rec-03-report.md): CPF/e-mail são únicos GLOBAIS no .NET, sem
// checagem explícita no service — um duplicado vira DbUpdateException não
// tratada (500) ou, dependendo do caminho, 409; o `title`/`ex.Message` cru
// pode conter o valor duplicado ou detalhe de constraint Oracle. Mostrar
// isso na tela seria um ORÁCULO cross-tenant (alguém descobre se um
// CPF/e-mail já existe em OUTRA clínica, que este .NET não segrega para
// esse fim).
//
// G2 (m1): a regra não é "409 e 500 são genéricos" — é "SÓ 400 pode mostrar
// texto do servidor". Antes desta correção, qualquer status FORA de
// {400, 409, 500} (o caso real: 404 na reemissão, "Tutor id 42 não
// encontrado.") caía no fallback `err.message || MENSAGEM_GENERICA`, ou
// seja, mostrava a mensagem crua — o oposto do que a regra pretendia. Hoje
// SÓ o 400 (validação de campo, FluentValidation — mensagens de formato,
// nunca de duplicidade) pode expor `err.details`/`err.message`; qualquer
// outro status (401/403/404/409/422/500/o-que-vier) é genérico, sempre.
function mensagemGenericaOuDetalhesDeValidacao(
  err: ApiError | null | undefined,
  mensagemGenerica: string,
): string {
  if (!err) return mensagemGenerica;
  if (err.status === 400) {
    if (err.details) {
      const mensagens = Object.values(err.details).flat();
      if (mensagens.length > 0) return mensagens.join(' ');
    }
    return err.message || mensagemGenerica;
  }
  return mensagemGenerica;
}

const MENSAGEM_GENERICA_CADASTRO_TUTOR =
  'Não foi possível cadastrar o tutor. Verifique os dados informados (CPF e e-mail ' +
  'precisam ser únicos) e tente novamente. Se o problema continuar, procure o suporte.';

export function mensagemErroCadastroTutor(err: ApiError | null | undefined): string {
  return mensagemGenericaOuDetalhesDeValidacao(err, MENSAGEM_GENERICA_CADASTRO_TUTOR);
}

// G2 (m1): a reemissão (`POST /tutores/{id}/convite`) mostrava `err.message`
// cru em TODO erro (404 "Tutor com id N não encontrado.", 409 "Tutor id N já
// possui conta…") — texto técnico, nunca pensado pra tela, ainda que sem PII.
// Mesma regra do cadastro: só 400 pode mostrar detalhe do servidor.
const MENSAGEM_GENERICA_REEMISSAO_CONVITE =
  'Não foi possível gerar um novo convite para este tutor. Tente novamente e, se o ' +
  'problema continuar, procure o suporte.';

export function mensagemErroReemissaoConvite(err: ApiError | null | undefined): string {
  return mensagemGenericaOuDetalhesDeValidacao(err, MENSAGEM_GENERICA_REEMISSAO_CONVITE);
}
