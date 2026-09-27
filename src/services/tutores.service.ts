import { apiClient } from './api/client';
import type {
  TutorDetalheApiResponse,
  TutorDetalheResponse,
  NovoTutorInput,
  ConviteTutor,
  TutorCreateWireDto,
  TutorComInviteWireDto,
  InviteReemitidoWireDto,
  ApiError,
} from '../types/api';
import { somenteDigitos } from '../utils/telefone';

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
export async function criarTutor(input: NovoTutorInput): Promise<ConviteTutor> {
  const nrTelefone = somenteDigitos(input.nrTelefone);
  const usaMesmoWhatsapp = input.usaMesmoWhatsapp;
  const dsWhatsappDigitos = input.dsWhatsapp ? somenteDigitos(input.dsWhatsapp) : '';

  const body: TutorCreateWireDto = {
    nmTutor: input.nmTutor.trim(),
    nrCpf: somenteDigitos(input.nrCpf),
    dsEmail: input.dsEmail.trim(),
    nrTelefone,
    stAvisoPrivacidadeInformado: input.aceitouAvisoPrivacidade,
    ...(usaMesmoWhatsapp ? {} : { dsWhatsapp: dsWhatsappDigitos }),
  };

  const { data } = await apiClient.post<TutorComInviteWireDto>('/api/v1/tutores', body);

  return mapConviteDeCriacao(data, usaMesmoWhatsapp ? nrTelefone : dsWhatsappDigitos);
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
// esse fim). Por isso 409 e 500 do CADASTRO nunca mostram `err.message` —
// sempre a mensagem genérica abaixo. 400 (validação de campo, FluentValidation)
// continua expondo `err.details`, que são mensagens de formato, não de
// duplicidade.
const MENSAGEM_GENERICA_CADASTRO_TUTOR =
  'Não foi possível cadastrar o tutor. Verifique os dados informados (CPF e e-mail ' +
  'precisam ser únicos) e tente novamente. Se o problema continuar, procure o suporte.';

export function mensagemErroCadastroTutor(err: ApiError | null | undefined): string {
  if (!err) return MENSAGEM_GENERICA_CADASTRO_TUTOR;
  if (err.status === 400 && err.details) {
    const mensagens = Object.values(err.details).flat();
    if (mensagens.length > 0) return mensagens.join(' ');
  }
  if (err.status === 409 || err.status === 500) {
    return MENSAGEM_GENERICA_CADASTRO_TUTOR;
  }
  return err.message || MENSAGEM_GENERICA_CADASTRO_TUTOR;
}
