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
import { relatorioTriagens as mockRelatorio, ready as mockReady } from '../src/mocks/luna.mock';
import type { InternalAxiosRequestConfig } from 'axios';

const mockApiGet = apiClient.get as jest.Mock;
const mockLunaGet = lunaClient.get as jest.Mock;
const mockLunaPost = lunaClient.post as jest.Mock;

// Shape de FIO real emitido por GET /api/v1/luna/triagens/relatorio (.NET) — CQ-09
// item 1/2: totalTriagens/porUrgencia/encaminhadasParaVet, urgência ALTA/MEDIA/BAIXA
// (feminino). Copiado literalmente do contrato do ledger, não escrito de memória a
// partir do tipo interno do app.
const MOCK_RELATORIO_API_DATA = {
  totalTriagens: 142,
  porUrgencia: { BAIXA: 68, MEDIA: 45, ALTA: 22 },
  encaminhadasParaVet: 29,
};

// Shape real de GET /ready (CQ-09 item 4/6): {status, oracle, kura_api} — sem
// sgStatus/servicos/twilio/visaoComputacional, que nenhum endpoint real da Luna emite.
const MOCK_READY_DATA = {
  status: 'ok',
  oracle: 'ok',
  kura_api: 'ok',
};

const MOCK_WHATSAPP_DATA = {
  status: 'enviado',
  sid: 'SMmock1234567890',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApiGet.mockResolvedValue({ data: MOCK_RELATORIO_API_DATA });
  mockLunaGet.mockResolvedValue({ data: MOCK_READY_DATA, status: 200 });
  mockLunaPost.mockResolvedValue({ data: MOCK_WHATSAPP_DATA });
});

describe('luna.service', () => {
  describe('getRelatorioTriagens — CQ-09 item 1/2 (nomes de campo + vocabulário de urgência)', () => {
    it('traduz o shape real do .NET (totalTriagens/porUrgencia/ALTA-MEDIA-BAIXA) para o tipo interno', async () => {
      const query = { dataInicio: '2026-05-04', dataFim: '2026-05-11' };
      const result = await getRelatorioTriagens(query);

      expect(mockApiGet).toHaveBeenCalledWith(
        '/api/v1/luna/triagens/relatorio',
        { params: query },
      );
      expect(mockLunaGet).not.toHaveBeenCalled();

      // Prova de mordida: se o parser ainda lesse nrTotalTriagens (chave que o .NET
      // real nunca emite) em vez de totalTriagens, isto seria NaN/undefined — não 142.
      expect(result.nrTotalTriagens).toBe(142);
      // Vocabulário traduzido: ALTA->ALTO, MEDIA->MEDIO, BAIXA->BAIXO. Se o parser
      // ainda esperasse ALTO/MEDIO/BAIXO no corpo da API, estes 3 ficariam 0.
      expect(result.distribuicaoUrgencia).toEqual({ BAIXO: 68, MEDIO: 45, ALTO: 22 });
      expect(result.nrEncaminhadasParaVet).toBe(29);
      // CRITICO não existe mais no tipo interno — não deve sobreviver à tradução.
      expect('CRITICO' in result.distribuicaoUrgencia).toBe(false);
    });

    it('ignora chaves de urgência que a API real não deveria emitir (ex. CRITICA) sem quebrar o parse', async () => {
      mockApiGet.mockResolvedValue({
        data: {
          totalTriagens: 150,
          porUrgencia: { BAIXA: 68, MEDIA: 45, ALTA: 22, CRITICA: 15 },
          encaminhadasParaVet: 29,
        },
      });
      const result = await getRelatorioTriagens({ dataInicio: '2026-05-04', dataFim: '2026-05-11' });
      // CRITICA é descartada — os 3 níveis conhecidos continuam corretos, sem lançar.
      expect(result.distribuicaoUrgencia).toEqual({ BAIXO: 68, MEDIO: 45, ALTO: 22 });
      expect(result.nrTotalTriagens).toBe(150);
    });
  });

  describe('getLunaHealth — CQ-09 item 4/6 (GET /ready, armadilha do 503)', () => {
    it('usa lunaClient.get("/ready") com validateStatus aceitando 200 e 503', async () => {
      await getLunaHealth();
      expect(mockLunaGet).toHaveBeenCalledWith(
        '/ready',
        expect.objectContaining({ validateStatus: expect.any(Function) }),
      );
      const { validateStatus } = mockLunaGet.mock.calls[0][1] as { validateStatus: (s: number) => boolean };
      expect(validateStatus(200)).toBe(true);
      expect(validateStatus(503)).toBe(true);
      expect(validateStatus(500)).toBe(false);
      expect(validateStatus(404)).toBe(false);
    });

    it('HTTP 200 com corpo {status,oracle,kura_api} — devolve o corpo com httpStatus 200 (chave real, não sgStatus)', async () => {
      const result = await getLunaHealth();
      expect(mockApiGet).not.toHaveBeenCalled();
      expect('oracle' in result).toBe(true);
      if ('oracle' in result) {
        expect(result.oracle).toBe('ok');
        expect(result.kura_api).toBe('ok');
        expect(result.httpStatus).toBe(200);
      }
      // sgStatus nunca existiu no shape real — não deve reaparecer no resultado.
      expect('sgStatus' in result).toBe(false);
    });

    it('HTTP 503 com corpo válido — devolve o estado degradado LIDO DO CORPO, não {status:"indisponivel"}', async () => {
      // axios com validateStatus aceitando 503 RESOLVE (não rejeita) com o corpo real —
      // é exatamente essa resposta que o mock abaixo simula.
      mockLunaGet.mockResolvedValue({
        data: { status: 'degraded', oracle: 'ok', kura_api: 'down' },
        status: 503,
      });

      const result = await getLunaHealth();

      // Não pode ser o catch genérico — isso seria PIOR que o card mentiroso antigo:
      // um 503 real virando indisponível não aparece nem na tela nem no teste.
      expect(result).not.toEqual({ status: 'indisponivel' });
      expect('oracle' in result).toBe(true);
      if ('oracle' in result) {
        expect(result.httpStatus).toBe(503);
        expect(result.oracle).toBe('ok');
        expect(result.kura_api).toBe('down');
      }
    });

    it('falha de rede genuína (ECONNREFUSED) — continua caindo em {status:"indisponivel"}', async () => {
      mockLunaGet.mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await getLunaHealth();
      expect(result).toEqual({ status: 'indisponivel' });
    });

    it('timeout genuíno (ECONNABORTED) — continua caindo em {status:"indisponivel"}', async () => {
      mockLunaGet.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' });
      const result = await getLunaHealth();
      expect(result).toEqual({ status: 'indisponivel' });
    });
  });

  it('enviarWhatsApp uses lunaClient e retorna status enviado + sid, no formato esperado pela Luna', async () => {
    const req = { telefone: '11999990001', mensagem: 'Olá!', tipo: 'receituario' as const };
    const result = await enviarWhatsApp(req);
    expect(mockLunaPost).toHaveBeenCalledWith('/whatsapp/enviar', req);
    expect(result.status).toBe('enviado');
    expect(result.sid).toBe('SMmock1234567890');
  });

  it('enviarWhatsApp offline — retorna {status:"indisponivel"} sem lançar', async () => {
    mockLunaPost.mockRejectedValue(new Error('Network Error'));

    const result = await enviarWhatsApp({ telefone: '11999990001', mensagem: 'teste', tipo: 'manual' });

    // nunca lança — UI não quebra
    expect(result.status).toBe('indisponivel');
  });

  it('enviarWhatsApp timeout — retorna {status:"indisponivel"} sem lançar', async () => {
    mockLunaPost.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' });

    const result = await enviarWhatsApp({ telefone: '11999990001', mensagem: 'teste', tipo: 'manual' });

    expect(result.status).toBe('indisponivel');
  });

  it('mock relatorioTriagens (shape de fio): soma de porUrgencia bate com totalTriagens', async () => {
    const data = await mockRelatorio({} as InternalAxiosRequestConfig);
    const soma = Object.values(data.porUrgencia).reduce((a, b) => a + b, 0);
    expect(soma).toBe(data.totalTriagens);
  });

  it('mock ready: espelha o shape real de GET /ready, sem sgStatus/servicos', async () => {
    const data = await mockReady({} as InternalAxiosRequestConfig);
    expect(data).toEqual({ status: 'ok', oracle: 'ok', kura_api: 'ok' });
    expect('sgStatus' in data).toBe(false);
  });
});
