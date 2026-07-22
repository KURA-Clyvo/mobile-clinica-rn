jest.mock('@services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  lunaClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiClient, lunaClient } from '../src/services/api/client';
import {
  getRelatorioTriagens,
  getLunaHealth,
  enviarWhatsApp,
} from '../src/services/luna.service';
import { relatorioTriagens as mockRelatorio } from '../src/mocks/luna.mock';
import type { InternalAxiosRequestConfig } from 'axios';

const mockApiGet = apiClient.get as jest.Mock;
const mockLunaGet = lunaClient.get as jest.Mock;
const mockLunaPost = lunaClient.post as jest.Mock;

const MOCK_RELATORIO_DATA = {
  nrTotalTriagens: 142,
  distribuicaoUrgencia: { BAIXO: 68, MEDIO: 45, ALTO: 22, CRITICO: 7 },
  nrEncaminhadasParaVet: 29,
};

const MOCK_HEALTH_DATA = {
  sgStatus: 'UP' as const,
  dtUltimaVerificacao: new Date().toISOString(),
  servicos: { twilio: 'UP' as const, oracle: 'UP' as const, visaoComputacional: 'UP' as const },
};

const MOCK_WHATSAPP_DATA = {
  idEnvio: 5001,
  dtEnvio: new Date().toISOString(),
  sgStatus: 'ENVIADO' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApiGet.mockResolvedValue({ data: MOCK_RELATORIO_DATA });
  mockLunaGet.mockResolvedValue({ data: MOCK_HEALTH_DATA });
  mockLunaPost.mockResolvedValue({ data: MOCK_WHATSAPP_DATA });
});

describe('luna.service', () => {
  it('getRelatorioTriagens uses apiClient and returns TriagensRelatorioResponse', async () => {
    const query = { dataInicio: '2026-05-04', dataFim: '2026-05-11' };
    const result = await getRelatorioTriagens(query);
    expect(mockApiGet).toHaveBeenCalledWith(
      '/api/v1/luna/triagens/relatorio',
      { params: query },
    );
    expect(mockLunaGet).not.toHaveBeenCalled();
    expect(result.nrTotalTriagens).toBe(142);
    expect(result.distribuicaoUrgencia).toBeDefined();
  });

  it('getLunaHealth uses lunaClient and returns LunaHealthResponse', async () => {
    const result = await getLunaHealth();
    expect(mockLunaGet).toHaveBeenCalledWith('/health');
    expect(mockApiGet).not.toHaveBeenCalled();
    // quando online, retorna os campos do LunaHealthResponse
    expect('sgStatus' in result).toBe(true);
    if ('sgStatus' in result) {
      expect(result.sgStatus).toBe('UP');
      expect(result.servicos).toBeDefined();
    }
  });

  it('getLunaHealth offline — retorna {status:"indisponivel"} sem lançar', async () => {
    mockLunaGet.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await getLunaHealth();

    // nunca lança — retorna degradado
    expect(result).toEqual({ status: 'indisponivel' });
  });

  it('enviarWhatsApp uses lunaClient e retorna status enviado', async () => {
    const req = { idPet: 1, idTutor: 10, dsMensagem: 'Olá!' };
    const result = await enviarWhatsApp(req);
    expect(mockLunaPost).toHaveBeenCalledWith('/whatsapp/enviar', req);
    expect(result.status).toBe('enviado');
  });

  it('enviarWhatsApp offline — retorna {status:"indisponivel"} sem lançar', async () => {
    mockLunaPost.mockRejectedValue(new Error('Network Error'));

    const result = await enviarWhatsApp({ idPet: 1, idTutor: 10, dsMensagem: 'teste' });

    // nunca lança — UI não quebra
    expect(result.status).toBe('indisponivel');
  });

  it('enviarWhatsApp timeout — retorna {status:"indisponivel"} sem lançar', async () => {
    mockLunaPost.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' });

    const result = await enviarWhatsApp({ idPet: 1, idTutor: 10, dsMensagem: 'teste' });

    expect(result.status).toBe('indisponivel');
  });

  it('mock relatorio: sum of urgency levels equals nrTotalTriagens', async () => {
    const data = await mockRelatorio({} as InternalAxiosRequestConfig);
    const { BAIXO, MEDIO, ALTO, CRITICO } = data.distribuicaoUrgencia;
    expect(BAIXO + MEDIO + ALTO + CRITICO).toBe(data.nrTotalTriagens);
  });
});
