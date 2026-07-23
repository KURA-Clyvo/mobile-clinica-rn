jest.mock('@services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  lunaClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../src/services/api/client';
import { getHoje, getAlertas, getRecentes } from '../src/services/dashboard.service';

const mockApiGet = apiClient.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('dashboard.service', () => {
  describe('getHoje', () => {
    it('maps DashboardHojeDto fields to DashboardHojeResponse', async () => {
      mockApiGet.mockResolvedValue({
        data: {
          totalConsultasHoje: 8,
          totalAlertasAtivos: 3,
          totalRetornosPendentes: 2,
          ultimosPetsAtendidos: [
            { id: 1, nmPet: 'Thor', ultimoAtendimento: '2026-07-20T10:00:00Z' },
            { id: 2, nmPet: 'Mel', ultimoAtendimento: '2026-07-20T11:00:00Z' },
          ],
          proximosAgendamentos: [],
        },
      });

      const result = await getHoje();

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/dashboard/hoje');
      expect(result.metrics.nrConsultasHoje).toBe(8);
      expect(result.metrics.nrAlertasAtivos).toBe(3);
      expect(result.metrics.nrPacientesAtendidos).toBe(2);
      // sem equivalente no backend — default documentado, nunca fabricado
      expect(result.metrics.nrTeleorientacoes).toBe(0);
      expect(result.dailySummary.dsResumo).toBe('');
      expect(typeof result.dailySummary.dtUltimaAtualizacao).toBe('string');
    });
  });

  describe('getAlertas', () => {
    it('translates TEMPERATURA -> IOT_TEMPERATURA and leaves idPet/nmPet undefined', async () => {
      mockApiGet.mockResolvedValue({
        data: [
          {
            tipo: 'TEMPERATURA',
            id: 1,
            dsTipoAlerta: 'ACIMA_LIMITE',
            dsMensagem: 'Temp alta',
            dtCriacao: '2026-07-20T10:00:00Z',
          },
        ],
      });

      const result = await getAlertas();

      expect(result).toHaveLength(1);
      expect(result[0].dsTipoAlerta).toBe('IOT_TEMPERATURA');
      expect(result[0].idPet).toBeUndefined();
      expect(result[0].nmPet).toBeUndefined();
      expect(result[0].dsMensagem).toBe('Temp alta');
    });

    it('translates VACINA_VENCENDO/PROXIMA_DOSE -> VACINA_VENCIDA', async () => {
      mockApiGet.mockResolvedValue({
        data: [
          {
            tipo: 'VACINA_VENCENDO',
            id: 5,
            dsTipoAlerta: 'PROXIMA_DOSE',
            dsMensagem: "Vacina 'Raiva' com próxima dose em 30/07/2026.",
            dtCriacao: '2026-07-20T10:00:00Z',
          },
        ],
      });

      const result = await getAlertas();

      expect(result[0].dsTipoAlerta).toBe('VACINA_VENCIDA');
    });
  });

  describe('getRecentes', () => {
    it('maps AgendamentoResumoDto[] to RecentAppointmentResponse[]', async () => {
      mockApiGet.mockResolvedValue({
        data: [
          {
            id: 42,
            nmPaciente: 'Rex',
            dtAgendamento: '2026-07-19T10:00:00Z',
            dsServico: 'Consulta de rotina',
            stStatus: 'REALIZADO',
          },
        ],
      });

      const result = await getRecentes();

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/dashboard/recentes');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(42);
      expect(result[0].nmPet).toBe('Rex');
      expect(result[0].nmTipoConsulta).toBe('Consulta de rotina');
      expect(result[0].dtAgendamento).toBe('2026-07-19T10:00:00Z');
      // sem equivalente no backend — string vazia documentada, nunca fabricada
      expect(result[0].nmTutor).toBe('');
      expect(result[0].sgStatus).toBe('CONCLUIDA');
    });

    it('translates each backend status to the correct RN enum value', async () => {
      mockApiGet.mockResolvedValue({
        data: [
          { id: 1, nmPaciente: 'A', dtAgendamento: 'x', dsServico: 's', stStatus: 'INTENCAO' },
          { id: 2, nmPaciente: 'B', dtAgendamento: 'x', dsServico: 's', stStatus: 'AGENDADO' },
          { id: 3, nmPaciente: 'C', dtAgendamento: 'x', dsServico: 's', stStatus: 'CONFIRMADO' },
          { id: 4, nmPaciente: 'D', dtAgendamento: 'x', dsServico: 's', stStatus: 'REALIZADO' },
          { id: 5, nmPaciente: 'E', dtAgendamento: 'x', dsServico: 's', stStatus: 'CANCELADO' },
          { id: 6, nmPaciente: 'F', dtAgendamento: 'x', dsServico: 's', stStatus: 'NAO_COMPARECEU' },
        ],
      });

      const result = await getRecentes();

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
});
