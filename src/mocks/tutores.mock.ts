import type { InternalAxiosRequestConfig } from 'axios';
import type {
  TutorDetalheApiResponse,
  TutorCreateWireDto,
  TutorComInviteWireDto,
  InviteReemitidoWireDto,
  InviteWireDto,
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

function linkConvite(nrToken: string): string {
  // Mesmo formato de link declarado no relatório da task (rec-03-report.md)
  // — plausível, nunca um domínio real de produção.
  return `https://app.kura.vet/convite/${nrToken}`;
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

  const semLinkConvite = body.nrCpf === CPF_MOCK_SEM_LINK;
  const novo: TutorArmazenado = {
    id: Math.max(0, ...store.map((t) => t.id)) + 1,
    nmTutor: body.nmTutor,
    nrCpf: body.nrCpf,
    dsEmail: body.dsEmail,
    nrTelefone: body.nrTelefone,
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
