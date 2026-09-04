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
          // FM-08 — valores DELIBERADAMENTE diferentes de `ultimosPetsAtendidos.length`
          // (2) e do `0` hardcoded antigo: se o mapper regredisse para as aproximações
          // velhas (`.length`/`0`), esta asserção pegaria — o teste não passaria por
          // acidente com a implementação anterior.
          totalPacientesAtendidosHoje: 11,
          totalTeleorientacoesHoje: 4,
        },
      });

      const result = await getHoje();

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/dashboard/hoje');
      expect(result.metrics.nrConsultasHoje).toBe(8);
      expect(result.metrics.nrAlertasAtivos).toBe(3);
      // FM-08 — vem de `totalPacientesAtendidosHoje` (11), NÃO de
      // `ultimosPetsAtendidos.length` (2, que seria o valor se ainda usasse a versão velha).
      expect(result.metrics.nrPacientesAtendidos).toBe(11);
      // FM-08 — vem de `totalTeleorientacoesHoje` (4); backend passou a rastrear (FD-17),
      // não é mais o `0` hardcoded.
      expect(result.metrics.nrTeleorientacoes).toBe(4);
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
      expect(result[0]!.dsTipoAlerta).toBe('IOT_TEMPERATURA');
      expect(result[0]!.idPet).toBeUndefined();
      expect(result[0]!.nmPet).toBeUndefined();
      expect(result[0]!.dsMensagem).toBe('Temp alta');
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

      expect(result[0]!.dsTipoAlerta).toBe('VACINA_VENCIDA');
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
      expect(result[0]!.id).toBe(42);
      expect(result[0]!.nmPet).toBe('Rex');
      expect(result[0]!.nmTipoConsulta).toBe('Consulta de rotina');
      expect(result[0]!.dtAgendamento).toBe('2026-07-19T10:00:00Z');
      // sem equivalente no backend — string vazia documentada, nunca fabricada
      expect(result[0]!.nmTutor).toBe('');
      expect(result[0]!.sgStatus).toBe('CONCLUIDA');
    });

    // FM-04 (revisão pós-medição do maestro, 2026-09-02): esta suíte
    // asseverava a tabela ANTIGA (CONFIRMADO->'EM_ANDAMENTO', NAO_COMPARECEU
    // ->'CANCELADA') — a mesma tradução com perda que o achado nº 2 da FM-04
    // já tinha corrigido do lado da agenda, só que aqui redigitada e
    // divergente. Prova de mordida: rodar esta suíte ANTES desta correção
    // (contra o dashboard.service.ts anterior) falha exatamente assim —
    // esperado ['AGENDADA','AGENDADA','CONFIRMADA','CONCLUIDA','CANCELADA',
    // 'NAO_COMPARECEU'], recebido [...,'EM_ANDAMENTO',...,'CANCELADA',
    // 'CANCELADA'] (RED capturado ao vivo antes deste commit).
    it('translates each backend status to the correct RN enum value (own buckets for CONFIRMADO/NAO_COMPARECEU — mesma tabela da agenda)', async () => {
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
        'CONFIRMADA',
        'CONCLUIDA',
        'CANCELADA',
        'NAO_COMPARECEU',
      ]);
    });
  });
});
