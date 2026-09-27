jest.mock('@services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  lunaClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../src/services/api/client';
import {
  telefoneDisponivel,
  TELEFONE_SENTINELA,
  criarTutor,
  reemitirConvite,
  mensagemErroCadastroTutor,
  mensagemErroReemissaoConvite,
} from '../src/services/tutores.service';
import type { NovoTutorInput } from '../src/types/api';

const mockApiPost = apiClient.post as jest.Mock;

// LU-09 fix wave 1 (item 2, lu-09-revisao.md G2-3): TutorService.cs:97-99/129-131
// (backend-clinica-dotnet) grava o literal "Não informado" em NR_TELEFONE quando o
// cadastro do tutor não tem telefone — confirmado na fonte (`grep -rn "Não informado"
// src` → 2 ocorrências). `telefoneDisponivel` é o único ponto de decisão sobre oferecer
// ou não a ação "Responder no WhatsApp" da Fila da Luna.
describe('telefoneDisponivel — LU-09 fix wave 1 (item 2, G2-3)', () => {
  it('recusa o sentinela literal do backend', () => {
    expect(telefoneDisponivel('Não informado')).toBe(false);
    expect(telefoneDisponivel(TELEFONE_SENTINELA)).toBe(false);
  });

  it('recusa vazio, só espaço, null e undefined', () => {
    expect(telefoneDisponivel('')).toBe(false);
    expect(telefoneDisponivel('   ')).toBe(false);
    expect(telefoneDisponivel(null)).toBe(false);
    expect(telefoneDisponivel(undefined)).toBe(false);
  });

  it('CONTROLE POSITIVO — telefone real é aceito', () => {
    expect(telefoneDisponivel('11988887777')).toBe(true);
  });
});

const RAW_INPUT: NovoTutorInput = {
  nmTutor: 'Ana Beatriz',
  nrCpf: '123.456.789-00',
  dsEmail: 'ana@example.com',
  nrTelefone: '(11) 91234-5678',
  usaMesmoWhatsapp: true,
  aceitouAvisoPrivacidade: true,
};

// TutorComInviteResponseDto real (rec-03-report.md, contrato confirmado
// contra backend-clinica-dotnet `origin/main` e33da98) — shape CRU do .NET,
// não o que a UI produz.
const WIRE_TUTOR_COM_INVITE = {
  id: 42,
  nmTutor: 'Ana Beatriz',
  nrCpf: '12345678900',
  dsEmail: 'ana@example.com',
  nrTelefone: '11912345678',
  stAtiva: true,
  invite: {
    id: 7,
    nrToken: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    dtExpiracao: '2026-10-04T12:00:00Z',
    dsCanal: 'WHATSAPP',
    stUtilizado: false,
  },
  dsLinkConvite: 'https://app.kura.vet/convite/f47ac10b-58cc-4372-a567-0e02b2c3d479',
};

// Mordida (a): o service mapeia o shape CRU do .NET (invite aninhado,
// snake não, campos PT-BR) para o shape de UI (ConviteTutor), sem perder
// nem inventar campo.
describe('criarTutor — mordida (a): mapeia o shape cru do .NET', () => {
  beforeEach(() => jest.clearAllMocks());

  it('monta o body sem dsWhatsapp quando usaMesmoWhatsapp=true e mapeia a resposta', async () => {
    mockApiPost.mockResolvedValue({ data: WIRE_TUTOR_COM_INVITE });

    const resultado = await criarTutor(RAW_INPUT);

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/tutores', {
      nmTutor: 'Ana Beatriz',
      nrCpf: '12345678900',
      dsEmail: 'ana@example.com',
      nrTelefone: '11912345678',
      stAvisoPrivacidadeInformado: true,
    });

    expect(resultado).toEqual({
      idTutor: 42,
      nomeTutor: 'Ana Beatriz',
      whatsapp: '11912345678', // == nrTelefone, porque usaMesmoWhatsapp
      nrToken: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      dtExpiracao: '2026-10-04T12:00:00Z',
      dsLinkConvite: 'https://app.kura.vet/convite/f47ac10b-58cc-4372-a567-0e02b2c3d479',
    });
  });

  it('envia dsWhatsapp normalizado quando usaMesmoWhatsapp=false', async () => {
    mockApiPost.mockResolvedValue({ data: WIRE_TUTOR_COM_INVITE });

    await criarTutor({ ...RAW_INPUT, usaMesmoWhatsapp: false, dsWhatsapp: '(11) 98888-7777' });

    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/v1/tutores',
      expect.objectContaining({ dsWhatsapp: '11988887777' }),
    );
  });

  it('CONTROLE — dsLinkConvite null é preservado, não substituído por string vazia', async () => {
    mockApiPost.mockResolvedValue({ data: { ...WIRE_TUTOR_COM_INVITE, dsLinkConvite: null } });

    const resultado = await criarTutor(RAW_INPUT);
    expect(resultado.dsLinkConvite).toBeNull();
  });
});

describe('reemitirConvite — mordida (a): mapeia InviteReemitidoWireDto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('mapeia o invite reemitido preservando nome/whatsapp repassados pelo chamador', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        invite: {
          id: 8,
          nrToken: 'novo-token-123',
          dtExpiracao: '2026-10-11T12:00:00Z',
          dsCanal: 'WHATSAPP',
          stUtilizado: false,
        },
        dsLinkConvite: 'https://app.kura.vet/convite/novo-token-123',
      },
    });

    const resultado = await reemitirConvite(42, 'Ana Beatriz', '11912345678');

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/tutores/42/convite');
    expect(resultado).toEqual({
      idTutor: 42,
      nomeTutor: 'Ana Beatriz',
      whatsapp: '11912345678',
      nrToken: 'novo-token-123',
      dtExpiracao: '2026-10-11T12:00:00Z',
      dsLinkConvite: 'https://app.kura.vet/convite/novo-token-123',
    });
  });
});

// Mordida (d): 409/500 do cadastro NUNCA mostram a mensagem crua do
// servidor (E46 — CPF/e-mail únicos globais, oráculo cross-tenant); 400
// pode mostrar as mensagens de `details`.
describe('mensagemErroCadastroTutor — mordida (d)', () => {
  it('409 vira mensagem genérica, mesmo revelando CPF na mensagem crua', () => {
    const resultado = mensagemErroCadastroTutor({
      status: 409,
      code: 'CPF_DUPLICADO',
      message: 'O CPF 12345678900 já está cadastrado no sistema (outra clínica).',
    });
    expect(resultado).not.toContain('12345678900');
    expect(resultado).not.toContain('outra clínica');
  });

  it('500 vira mensagem genérica', () => {
    const resultado = mensagemErroCadastroTutor({
      status: 500,
      code: 'HTTP_500',
      message: 'ORA-00001: unique constraint (KURA.UQ_TUTOR_CPF) violated',
    });
    expect(resultado).not.toContain('ORA-00001');
  });

  it('CONTROLE POSITIVO — 400 com details mostra as mensagens de validação', () => {
    const resultado = mensagemErroCadastroTutor({
      status: 400,
      code: 'VALIDACAO',
      message: 'genérico',
      details: { StAvisoPrivacidadeInformado: ['É necessário confirmar o aviso.'] },
    });
    expect(resultado).toContain('É necessário confirmar o aviso.');
  });

  // G2 (m1): a regra não era "409/500 são genéricos", era "SÓ 400 pode mostrar texto do
  // servidor" — um 404 (nem 409 nem 500 nem 400) caía no fallback `err.message ||
  // MENSAGEM_GENERICA` e mostrava a mensagem crua. Mordida: reverter pra "só 409/500
  // genérico" faz este teste falhar (404 voltaria a mostrar "Tutor id 42...").
  it('G2 m1 — 404 (nem 400 nem 409 nem 500) TAMBÉM vira mensagem genérica', () => {
    const resultado = mensagemErroCadastroTutor({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Tutor com id 42 não encontrado.',
    });
    expect(resultado).not.toContain('42');
    expect(resultado).not.toContain('Tutor com id');
  });

  it('400 sem details cai no err.message (formato/validação simples, sem PII)', () => {
    const resultado = mensagemErroCadastroTutor({
      status: 400,
      code: 'VALIDACAO',
      message: "'NrTelefone' inválido.",
    });
    expect(resultado).toBe("'NrTelefone' inválido.");
  });
});

// G2 (m1): a reemissão mostrava `err.message` cru em TODO status (404 "Tutor com id N não
// encontrado.", 409 "Tutor id N já possui conta…") — texto técnico, nunca pensado pra tela.
// Mesma regra do cadastro: só 400 pode expor detalhe do servidor.
describe('mensagemErroReemissaoConvite — mordida (m1)', () => {
  it('404 vira mensagem genérica (não "Tutor com id N não encontrado")', () => {
    const resultado = mensagemErroReemissaoConvite({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Tutor com id 42 não encontrado.',
    });
    expect(resultado).not.toContain('42');
    expect(resultado).not.toContain('não encontrado');
  });

  it('409 vira mensagem genérica (não "Tutor id N já possui conta")', () => {
    const resultado = mensagemErroReemissaoConvite({
      status: 409,
      code: 'CONTA_EXISTENTE',
      message: 'Tutor id 42 já possui conta. Não é possível reemitir convite.',
    });
    expect(resultado).not.toContain('42');
    expect(resultado).not.toContain('já possui conta');
  });

  it('CONTROLE POSITIVO — 400 com details mostra as mensagens de validação', () => {
    const resultado = mensagemErroReemissaoConvite({
      status: 400,
      code: 'VALIDACAO',
      message: 'genérico',
      details: { Id: ['inválido'] },
    });
    expect(resultado).toContain('inválido');
  });
});

// G2 (m4): nenhum teste chamava `criarTutor` com `aceitouAvisoPrivacidade: false` e
// conferia o CORPO enviado — um `stAvisoPrivacidadeInformado: true` fixo no service
// sobreviveria à suíte inteira (medido pelo revisor, mutação M5, 1229/1229 verde).
// O gate real do servidor (400 se ausente/false) só protege se o valor que chega for o
// que a recepção marcou de verdade.
describe('criarTutor — mordida (m4): repassa aceitouAvisoPrivacidade do INPUT, nunca fixo', () => {
  beforeEach(() => jest.clearAllMocks());

  it('input com false -> corpo com stAvisoPrivacidadeInformado: false', async () => {
    mockApiPost.mockResolvedValue({ data: WIRE_TUTOR_COM_INVITE });

    await criarTutor({ ...RAW_INPUT, aceitouAvisoPrivacidade: false });

    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/v1/tutores',
      expect.objectContaining({ stAvisoPrivacidadeInformado: false }),
    );
  });

  it('CONTROLE POSITIVO — input com true -> corpo com true', async () => {
    mockApiPost.mockResolvedValue({ data: WIRE_TUTOR_COM_INVITE });

    await criarTutor({ ...RAW_INPUT, aceitouAvisoPrivacidade: true });

    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/v1/tutores',
      expect.objectContaining({ stAvisoPrivacidadeInformado: true }),
    );
  });
});

// G2 (I-1), no nível de SERVICE: `criarTutor` precisa preservar o '+' no corpo enviado
// (`paraEnvioServidor`, não `somenteDigitos` puro) — senão o servidor lê qualquer
// estrangeiro como BR nacional (ver tests/telefone.test.ts para a cobertura pura).
describe('criarTutor — mordida (I-1): preserva + no corpo enviado ao servidor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('nrTelefone com + é enviado com o + preservado (nunca só dígitos)', async () => {
    mockApiPost.mockResolvedValue({ data: WIRE_TUTOR_COM_INVITE });

    await criarTutor({ ...RAW_INPUT, nrTelefone: '+1 415 555 2671' });

    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/v1/tutores',
      expect.objectContaining({ nrTelefone: '+14155552671' }),
    );
  });

  it('dsWhatsapp com + (usaMesmoWhatsapp=false) preserva o +', async () => {
    mockApiPost.mockResolvedValue({ data: WIRE_TUTOR_COM_INVITE });

    await criarTutor({
      ...RAW_INPUT,
      usaMesmoWhatsapp: false,
      dsWhatsapp: '+351 912 345 678',
    });

    expect(mockApiPost).toHaveBeenCalledWith(
      '/api/v1/tutores',
      expect.objectContaining({ dsWhatsapp: '+351912345678' }),
    );
  });
});
