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
});
