import type { InternalAxiosRequestConfig } from 'axios';
import type {
  TutorDetalheApiResponse,
  TutorCreateWireDto,
  TutorComInviteWireDto,
  InviteReemitidoWireDto,
  InviteWireDto,
  TutorBuscaWireDto,
} from '../types/api';

// LU-09: shape de FIO (TutorDetalheApiResponse — TutorResponseDto real) para a ação
// "Responder no WhatsApp" da Fila da Luna. `id` extraído da URL para casar com o
// `tutor.id` que luna.mock.ts::triagens() devolve no item ALTA (201) — um id fora
// dessa faixa ainda devolve um tutor plausível (fallback), nunca lança.
export async function byId(config: InternalAxiosRequestConfig): Promise<TutorDetalheApiResponse> {
  const match = /\/tutores\/(\d+)$/.exec(config.url ?? '');
  const id = match ? Number(match[1]) : 0;
  if (id === 201) {
    return {
      id: 201,
      nmTutor: 'Ana Beatriz',
      nrCpf: '12345678900',
      dsEmail: 'ana.beatriz@example.com',
      nrTelefone: '11988887777',
      stAtiva: true,
    };
  }
  return {
    id,
    nmTutor: 'Tutor Mock',
    nrCpf: '00000000000',
    dsEmail: 'tutor.mock@example.com',
    nrTelefone: '11999990000',
    stAtiva: true,
  };
}

// ─── REC-03: cadastro de tutor + convite (POST /tutores, POST /tutores/{id}/convite) ───
//
// 2º consumidor do shape de fio (regra v5, FIX_5) — este mock precisa imitar
// o CONTRATO do backend (rec-03-report.md), não o shape que a tela produz, e
// nenhum par service×mock pode lançar exceção sob EXPO_PUBLIC_USE_MOCKS=true.
//
// STATEFUL (mesmo padrão de usuarios-clinica.mock.ts::getStore): criar e
// depois reemitir convite para o MESMO id precisa achar o tutor que acabou
// de ser criado.
interface TutorArmazenado {
  id: number;
  nmTutor: string;
  nrCpf: string;
  dsEmail: string;
  nrTelefone: string;
  stAtiva: boolean;
  // REC-03, sentinela de teste (mordida (e)): tutor criado com o CPF
  // CPF_SENTINELA_SEM_LINK nasce (e permanece, em reemissão) com
  // dsLinkConvite: null — replica o caso em que o backend não conseguiu
  // gerar o link (ex.: WEBHOOK_PUBLIC_URL ausente).
  semLinkConvite: boolean;
}

// CPFs fictícios, nunca reais — reservados para os dois cenários que a
// mordida obrigatória do brief precisa reproduzir sem tocar em HTTP real:
// duplicado (409) e "link não configurado" (dsLinkConvite: null).
export const CPF_MOCK_DUPLICADO = '11122233344';
export const CPF_MOCK_SEM_LINK = '00099988877';

function buildTutoresArmazenados(): TutorArmazenado[] {
  return [
    {
      id: 900,
      nmTutor: 'Tutor Já Cadastrado',
      nrCpf: CPF_MOCK_DUPLICADO,
      dsEmail: 'ja.cadastrado@example.com',
      nrTelefone: '11999998888',
      stAtiva: true,
      semLinkConvite: false,
    },
  ];
}

let _storeTutores: TutorArmazenado[] | null = null;

function getStoreTutores(): TutorArmazenado[] {
  if (!_storeTutores) {
    _storeTutores = buildTutoresArmazenados();
  }
  return _storeTutores;
}

// Exportado só para teste — mesmo motivo de agenda.mock.ts::__resetStoreParaTeste.
export function __resetTutoresParaTeste(): void {
  _storeTutores = null;
  _proximoIdInvite = 5000;
}

function parseBody<T>(config: InternalAxiosRequestConfig): T {
  return (typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})) as T;
}

function rejeitar(status: number, code: string, message: string): Promise<never> {
  return Promise.reject({ status, code, message });
}

function rejeitarValidacao(message: string, details: Record<string, string[]>): Promise<never> {
  return Promise.reject({ status: 400, code: 'VALIDACAO', message, details });
}

let _proximoIdInvite = 5000;

function novoInvite(canal: string): InviteWireDto {
  const id = _proximoIdInvite++;
  return {
    id,
    nrToken: `mock-invite-token-${id}`,
    dtExpiracao: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    dsCanal: canal,
    stUtilizado: false,
  };
}

// ─── Réplica ANCORADA de NormalizadorTelefone.cs (regra v11 do CLAUDE.md —
// cópia de regra de negócio de OUTRO repo precisa de âncora fixa) ──────────
//
// G2 REC-03 (achado m2): o mock devolvia `nrTelefone` CRU no corpo da
// resposta (ex. "11987654321"), mas o servidor real devolve NORMALIZADO
// (ex. "5511987654321", TutorService.cs:128 — `tutor.NrTelefone` é
// `telefoneArmazenado`, saída de `TentarNormalizar`, nunca a entrada crua).
//
// FONTE:   backend-clinica-dotnet
//          src/Kura.Domain/Tutores/NormalizadorTelefone.cs
// COMMIT:  e33da98 (origin/main)
// CONFERIDO EM: 2026-09-27 (fix wave G2 da REC-03, achado m2)
// REPRODUZIR:
//     git show origin/main:src/Kura.Domain/Tutores/NormalizadorTelefone.cs | sed -n '79p;88-112p'
//
// Regra (ordem importa, ancorada linha a linha):
//   :79      comDdiExplicito = entrada começa com '+' (TrimStart().StartsWith('+'))
//   :88-90   ramo 1: comDdiExplicito -> guarda só os dígitos, SEM o '+'
//   :93-95   ramo 2: sem '+', 12 ou 13 dígitos começando com "55" -> guarda como veio
//   :98-100  ramo 3: sem '+', 10 ou 11 dígitos -> prefixa "55"
//   :105     ramo 4: nenhuma forma reconhecida -> inválido (null)
//   :112     fora de [10,15] dígitos (só o ramo 1 pode violar isso) -> inválido (null)
const PISO_DIGITOS_TELEFONE = 10;
const TETO_DIGITOS_TELEFONE = 15;
function normalizarTelefoneComoServidor(entrada: string): string | null {
  if (!entrada || !entrada.trim()) return null;
  const comDdiExplicito = entrada.trimStart().startsWith('+');
  const digitos = entrada.replace(/\D/g, '');
  if (!digitos) return null;

  let candidato: string;
  if (comDdiExplicito) {
    candidato = digitos;
  } else if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    candidato = digitos;
  } else if (digitos.length === 10 || digitos.length === 11) {
    candidato = `55${digitos}`;
  } else {
    return null;
  }

  if (candidato.length < PISO_DIGITOS_TELEFONE || candidato.length > TETO_DIGITOS_TELEFONE) {
    return null;
  }
  return candidato;
}

// clinicaId fixo — mesmo padrão de usuarios-clinica.mock.ts::buildUsuarios
// (ambiente de demo single-tenant, `idClinica: 1` hardcoded em vários mocks).
const CLINICA_ID_MOCK = 1;

// G2 (m2): formato alinhado a GeradorLinkConvite.cs:69 (origin/main e33da98)
// — `{baseUrl}/register?token={token}&clinicaId={id}`. Base fictícia (nunca
// um domínio real); ANTES desta correção era `.../convite/<token>`, um
// caminho que o servidor real não produz.
function linkConvite(nrToken: string): string {
  return `https://app.kura.vet/register?token=${encodeURIComponent(nrToken)}&clinicaId=${CLINICA_ID_MOCK}`;
}

// POST /api/v1/tutores.
export async function criar(
  config: InternalAxiosRequestConfig,
): Promise<TutorComInviteWireDto> {
  const body = parseBody<TutorCreateWireDto>(config);
  const store = getStoreTutores();

  // Espelha TutorCreateValidator.cs (rec-03-report.md): sem aviso ⇒ 400.
  if (!body.stAvisoPrivacidadeInformado) {
    return rejeitarValidacao('Um ou mais campos são inválidos.', {
      StAvisoPrivacidadeInformado: [
        'É necessário confirmar que o aviso de privacidade foi informado ao tutor.',
      ],
    });
  }

  // E46 — CPF/e-mail únicos GLOBAIS. Mensagem de propósito REVELADORA aqui
  // (cita o CPF) para provar, do lado da tela, que ela NUNCA aparece —
  // mensagemErroCadastroTutor() troca por uma genérica em 409/500.
  if (store.some((t) => t.nrCpf === body.nrCpf)) {
    return rejeitar(
      409,
      'CPF_DUPLICADO',
      `O CPF ${body.nrCpf} já está cadastrado no sistema (outra clínica já cadastrou este tutor).`,
    );
  }
  if (store.some((t) => t.dsEmail.trim().toLowerCase() === body.dsEmail.trim().toLowerCase())) {
    return rejeitar(
      409,
      'EMAIL_DUPLICADO',
      `O e-mail ${body.dsEmail} já está em uso por outro tutor cadastrado.`,
    );
  }

  // G2 (m2): TutorService.CreateAsync (backend-clinica-dotnet, origin/main e33da98)
  // normaliza ANTES de persistir/devolver — o mock replica isso, não só o formato do
  // corpo. `RegraDeNegocioException("Telefone inválido."/"WhatsApp inválido.")` vira 422
  // real quando `TentarNormalizar` falha; defesa em profundidade (inalcançável quando o
  // cliente valida direito, mas o app deste repo é só UM dos clientes possíveis).
  const telefoneNormalizado = normalizarTelefoneComoServidor(body.nrTelefone);
  if (!telefoneNormalizado) {
    return rejeitar(422, 'TELEFONE_INVALIDO', 'Telefone inválido.');
  }
  const whatsappNormalizado =
    body.dsWhatsapp && body.dsWhatsapp.trim()
      ? normalizarTelefoneComoServidor(body.dsWhatsapp)
      : telefoneNormalizado;
  if (!whatsappNormalizado) {
    return rejeitar(422, 'WHATSAPP_INVALIDO', 'WhatsApp inválido.');
  }

  const semLinkConvite = body.nrCpf === CPF_MOCK_SEM_LINK;
  const novo: TutorArmazenado = {
    id: Math.max(0, ...store.map((t) => t.id)) + 1,
    nmTutor: body.nmTutor,
    nrCpf: body.nrCpf,
    dsEmail: body.dsEmail,
    nrTelefone: telefoneNormalizado,
    stAtiva: true,
    semLinkConvite,
  };
  store.push(novo);

  const invite = novoInvite(body.dsCanalConvite ?? 'WHATSAPP');
  return {
    id: novo.id,
    nmTutor: novo.nmTutor,
    nrCpf: novo.nrCpf,
    dsEmail: novo.dsEmail,
    nrTelefone: novo.nrTelefone,
    stAtiva: novo.stAtiva,
    invite,
    dsLinkConvite: semLinkConvite ? null : linkConvite(invite.nrToken),
  };
}

// REC-04 — exportado para `pets.mock.ts::criar` resolver o nome/telefone/
// e-mail do tutor vinculado ao montar a resposta de `POST /pets` (o mock
// precisa do MESMO dado que o backend real ecoaria via JOIN — ver
// `PetService.BuildResponseAsync`). Devolve `undefined` quando o id não
// existe no store — o chamador decide o que fazer (404, mesma semântica de
// `PetService.CreateAsync` recusando `idTutor` desconhecido).
export function buscarTutorArmazenadoPorId(id: number): TutorArmazenado | undefined {
  return getStoreTutores().find((t) => t.id === id);
}

// REC-04 — GET /api/v1/tutores?busca= (TutoresController.cs:29-35), usado
// pela busca de "tutor existente" em pacientes/novo.tsx. Filtro textual
// simples por nome OU CPF (case-insensitive), mesmo critério informal do
// `ITutorService.SearchAsync` real (substring, não fuzzy). Sem `busca`
// (string vazia/ausente), devolve todo o store — mesmo comportamento do
// backend real sem query param.
export async function buscar(config: InternalAxiosRequestConfig): Promise<TutorBuscaWireDto[]> {
  const busca = ((config.params as { busca?: string } | undefined)?.busca ?? '').trim().toLowerCase();
  const store = getStoreTutores();
  const resultado = busca
    ? store.filter((t) => t.nmTutor.toLowerCase().includes(busca) || t.nrCpf.includes(busca))
    : store;
  return resultado.map((t) => ({
    id: t.id,
    nmTutor: t.nmTutor,
    nrCpf: t.nrCpf,
    dsEmail: t.dsEmail,
    nrTelefone: t.nrTelefone,
    stAtiva: t.stAtiva,
  }));
}

// GET /api/v1/tutores$ | POST /api/v1/tutores$ — mesma URL, 2 métodos
// (mesmo padrão de usuarios-clinica.mock.ts::colecao, ver comentário de
// ordem em mock-adapter.ts). GET busca (LISTAGEM, REC-04), POST cadastra
// (REC-03, já existia como `criar` antes desta rota GET nascer).
export async function colecao(
  config: InternalAxiosRequestConfig,
): Promise<TutorBuscaWireDto[] | TutorComInviteWireDto> {
  if ((config.method ?? 'get').toUpperCase() === 'POST') {
    return criar(config);
  }
  return buscar(config);
}

// POST /api/v1/tutores/{id}/convite.
export async function reemitirConvite(
  config: InternalAxiosRequestConfig,
): Promise<InviteReemitidoWireDto> {
  const match = /\/tutores\/(\d+)\/convite$/.exec(config.url ?? '');
  const id = match ? Number(match[1]) : 0;
  const item = getStoreTutores().find((t) => t.id === id);

  if (!item) {
    return rejeitar(404, 'NOT_FOUND', `Tutor ${id} não encontrado`);
  }

  const invite = novoInvite('WHATSAPP');
  return {
    invite,
    dsLinkConvite: item.semLinkConvite ? null : linkConvite(invite.nrToken),
  };
}
