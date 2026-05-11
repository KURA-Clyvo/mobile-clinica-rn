import type { InternalAxiosRequestConfig } from 'axios';
import * as authMock from '../../mocks/auth.mock';
import * as dashboardMock from '../../mocks/dashboard.mock';
import * as agendaMock from '../../mocks/agenda.mock';
import * as petsMock from '../../mocks/pets.mock';
import * as eventosMock from '../../mocks/eventos-clinicos.mock';
import * as lunaMock from '../../mocks/luna.mock';

type MockHandler = (config: InternalAxiosRequestConfig) => Promise<unknown>;

const ROUTES: Array<[RegExp, MockHandler]> = [
  [/\/auth\/login$/, authMock.login],
  [/\/auth\/register$/, authMock.register],
  [/\/agenda$/, agendaMock.agenda],
  [/\/dashboard\/hoje$/, dashboardMock.hoje],
  [/\/dashboard\/alertas$/, dashboardMock.alertas],
  [/\/dashboard\/recentes$/, dashboardMock.recentes],
  [/\/pets\/\d+\/timeline$/, petsMock.timeline],
  [/\/pets\/\d+$/, petsMock.byId],
  [/\/pets$/, petsMock.list],
  [/\/eventos-clinicos\/consultas$/, eventosMock.criarConsulta],
  [/\/eventos-clinicos\/prescricoes$/, eventosMock.criarPrescricao],
  [/\/medicamentos$/, eventosMock.medicamentos],
  [/\/whatsapp\/enviar$/, lunaMock.enviarWhatsApp],
  [/\/health$/, lunaMock.health],
  [/\/luna\/triagens\/relatorio$/, lunaMock.relatorioTriagens],
];

const MOCK_LATENCY_MS = 300;

export async function resolveMock(config: InternalAxiosRequestConfig): Promise<{
  data: unknown;
  status: number;
  config: InternalAxiosRequestConfig;
}> {
  const url = config.url ?? '';
  const method = config.method?.toUpperCase() ?? 'GET';

  for (const [pattern, handler] of ROUTES) {
    if (pattern.test(url)) {
      await new Promise<void>((r) => setTimeout(r, MOCK_LATENCY_MS));
      const data = await handler(config);
      return { data, status: 200, config };
    }
  }

  throw new Error(`No mock for ${method} ${url}`);
}
