jest.mock('@services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  lunaClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../src/services/api/client';
import { getAgenda } from '../src/services/agenda.service';
import type { AgendaQuery } from '../src/types/api';

const mockApiGet = apiClient.get as jest.Mock;

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
    const item = result[0];
    expect(item.id).toBe(10);
    expect(item.dtInicio).toBe('2026-07-21T09:00:00Z');
    expect(item.nrDuracaoMinutos).toBe(30);
    expect(item.sgStatus).toBe('AGENDADA');
    expect(item.pet).toEqual({ id: 0, nmPet: 'Thor', nmEspecie: '', nmRaca: '' });
    expect(item.tutor).toEqual({ id: 0, nmTutor: 'Carlos Mendes', dsTelefone: '' });
    expect(item.veterinario).toEqual({ id: 1, nmVeterinario: 'Dr. Felipe Ferrete', nrCRMV: '' });
    expect(item.dsObservacao).toBeUndefined();
  });

  it('translates each backend status to the correct RN enum value', async () => {
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
      'EM_ANDAMENTO',
      'CONCLUIDA',
      'CANCELADA',
      'CANCELADA',
    ]);
  });
});
