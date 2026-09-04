jest.mock('@services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  lunaClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../src/services/api/client';
import {
  getAgenda,
  atualizarStatusAgendamento,
  getTransicoesPermitidas,
} from '../src/services/agenda.service';
import type { AgendaQuery } from '../src/types/api';

const mockApiGet = apiClient.get as jest.Mock;
const mockApiPatch = apiClient.patch as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('agenda.service', () => {
  const query: AgendaQuery = { dataInicio: '2026-07-20', dataFim: '2026-07-26' };

  it('unwraps response.data.agendamentos (nested shape) and maps fields', async () => {
    mockApiGet.mockResolvedValue({
      data: {
        dataInicio: '2026-07-20T00:00:00Z',
        dataFim: '2026-07-26T23:59:59Z',
        agendamentos: [
          {
            idAgendamento: 10,
            dtAgendamento: '2026-07-21T09:00:00Z',
            duracaoMinutos: 30,
            nmTutor: 'Carlos Mendes',
            nmPet: 'Thor',
            idVeterinario: 1,
            nmVeterinario: 'Dr. Felipe Ferrete',
            dsTipoConsulta: 'Consulta de Retorno',
            dsStatus: 'AGENDADO',
            nrVersion: 1,
          },
        ],
      },
    });

    const result = await getAgenda(query);

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/agenda', { params: query });
    expect(result).toHaveLength(1);
    const item = result[0]!; // FM-09: length checada na linha acima (toHaveLength(1))
    expect(item.id).toBe(10);
    expect(item.dtInicio).toBe('2026-07-21T09:00:00Z');
    expect(item.nrDuracaoMinutos).toBe(30);
    expect(item.sgStatus).toBe('AGENDADA');
    expect(item.pet).toEqual({ id: 0, nmPet: 'Thor', nmEspecie: '', nmRaca: '' });
    expect(item.tutor).toEqual({ id: 0, nmTutor: 'Carlos Mendes', dsTelefone: '' });
    expect(item.veterinario).toEqual({ id: 1, nmVeterinario: 'Dr. Felipe Ferrete', nrCRMV: '' });
    expect(item.dsObservacao).toBeUndefined();
    // FM-04: nrVersion e dsStatusOrigem (cru) precisam sobreviver ao mapeamento —
    // são os 2 campos que o PATCH de status precisa (achado nº 1 do brief).
    expect(item.nrVersion).toBe(1);
    expect(item.dsStatusOrigem).toBe('AGENDADO');
  });

  // FM-04, achado nº 2 do brief: antes desta task, CONFIRMADO virava
  // 'EM_ANDAMENTO' e NAO_COMPARECEU virava 'CANCELADA' — um "faltou" era
  // indistinguível de um cancelamento de verdade na tela. Rodar esta suíte
  // ANTES do fix (git stash da mudança em agenda.service.ts) reproduz
  // exatamente essa mordida: o array esperado abaixo bate errado contra
  // ['AGENDADA','AGENDADA','EM_ANDAMENTO','CONCLUIDA','CANCELADA','CANCELADA']
  // — ver fm-04-report.md §6 para a saída literal do RED capturado.
  it('translates each backend status to the correct RN enum value (own buckets for CONFIRMADO/NAO_COMPARECEU)', async () => {
    const baseItem = {
      dtAgendamento: 'x',
      duracaoMinutos: 30,
      nmTutor: 't',
      nmPet: 'p',
      idVeterinario: 1,
      nmVeterinario: 'v',
      dsTipoConsulta: 'c',
      nrVersion: 1,
    };
    mockApiGet.mockResolvedValue({
      data: {
        dataInicio: 'x',
        dataFim: 'x',
        agendamentos: [
          { ...baseItem, idAgendamento: 1, dsStatus: 'INTENCAO' },
          { ...baseItem, idAgendamento: 2, dsStatus: 'AGENDADO' },
          { ...baseItem, idAgendamento: 3, dsStatus: 'CONFIRMADO' },
          { ...baseItem, idAgendamento: 4, dsStatus: 'REALIZADO' },
          { ...baseItem, idAgendamento: 5, dsStatus: 'CANCELADO' },
          { ...baseItem, idAgendamento: 6, dsStatus: 'NAO_COMPARECEU' },
        ],
      },
    });

    const result = await getAgenda(query);

    expect(result.map((r) => r.sgStatus)).toEqual([
      'AGENDADA',
      'AGENDADA',
      'CONFIRMADA',
      'CONCLUIDA',
      'CANCELADA',
      'NAO_COMPARECEU',
    ]);
    // dsStatusOrigem preserva o valor CRU, mesmo quando sgStatus colapsa
    // INTENCAO e AGENDADO no mesmo bucket 'AGENDADA'.
    expect(result.map((r) => r.dsStatusOrigem)).toEqual([
      'INTENCAO',
      'AGENDADO',
      'CONFIRMADO',
      'REALIZADO',
      'CANCELADO',
      'NAO_COMPARECEU',
    ]);
  });
});

describe('atualizarStatusAgendamento', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // FM-04: primeiro PATCH da história deste repo — prova que a função chama
  // o verbo, a rota ABSOLUTA e o corpo certos.
  it('calls PATCH on the absolute /api/v1/agendamentos/{id}/status route with the exact body', async () => {
    mockApiPatch.mockResolvedValue({
      data: {
        idAgendamento: 42,
        dtAgendamento: '2026-07-21T09:00:00Z',
        duracaoMinutos: 30,
        nmTutor: 'Carlos Mendes',
        nmPet: 'Thor',
        idVeterinario: 1,
        nmVeterinario: 'Dr. Felipe Ferrete',
        dsTipoConsulta: 'Consulta de Retorno',
        dsStatus: 'CONFIRMADO',
        nrVersion: 2,
      },
    });

    const result = await atualizarStatusAgendamento(42, { dsStatus: 'CONFIRMADO', nrVersion: 1 });

    expect(mockApiPatch).toHaveBeenCalledWith('/api/v1/agendamentos/42/status', {
      dsStatus: 'CONFIRMADO',
      nrVersion: 1,
    });
    // A resposta já vem mapeada (AgendamentoResponse), com nrVersion
    // ATUALIZADO (2, incrementado pelo servidor) — não o nrVersion enviado.
    expect(result.sgStatus).toBe('CONFIRMADA');
    expect(result.nrVersion).toBe(2);
    expect(result.dsStatusOrigem).toBe('CONFIRMADO');
  });

  it('forwards dsObservacao when provided', async () => {
    mockApiPatch.mockResolvedValue({
      data: {
        idAgendamento: 42,
        dtAgendamento: 'x',
        duracaoMinutos: 30,
        nmTutor: 't',
        nmPet: 'p',
        idVeterinario: 1,
        nmVeterinario: 'v',
        dsTipoConsulta: 'c',
        dsStatus: 'CANCELADO',
        nrVersion: 2,
      },
    });

    await atualizarStatusAgendamento(42, {
      dsStatus: 'CANCELADO',
      nrVersion: 1,
      dsObservacao: 'Tutor cancelou por telefone',
    });

    expect(mockApiPatch).toHaveBeenCalledWith('/api/v1/agendamentos/42/status', {
      dsStatus: 'CANCELADO',
      nrVersion: 1,
      dsObservacao: 'Tutor cancelou por telefone',
    });
  });
});

// FM-04 — espelha, do lado cliente, AgendaService.TransicoesPermitidas
// (backend-clinica-dotnet). Ver comentário completo em agenda.service.ts.
describe('getTransicoesPermitidas', () => {
  it('AGENDADO offers all 4 destinations', () => {
    expect(getTransicoesPermitidas('AGENDADO')).toEqual([
      'CONFIRMADO',
      'REALIZADO',
      'CANCELADO',
      'NAO_COMPARECEU',
    ]);
  });

  it('CONFIRMADO offers 3 destinations (not CONFIRMADO again)', () => {
    expect(getTransicoesPermitidas('CONFIRMADO')).toEqual([
      'REALIZADO',
      'CANCELADO',
      'NAO_COMPARECEU',
    ]);
  });

  it('INTENCAO only offers CANCELADO (different from AGENDADO, despite sharing the AGENDADA bucket)', () => {
    expect(getTransicoesPermitidas('INTENCAO')).toEqual(['CANCELADO']);
  });

  it.each(['REALIZADO', 'CANCELADO', 'NAO_COMPARECEU'])(
    '%s is terminal — offers no destination',
    (statusOrigem) => {
      expect(getTransicoesPermitidas(statusOrigem)).toEqual([]);
    },
  );

  it('unknown status origin offers no destination (fail-safe, not fail-open)', () => {
    expect(getTransicoesPermitidas('ALGO_QUE_NAO_EXISTE')).toEqual([]);
  });
});
