import type { InternalAxiosRequestConfig } from 'axios';
import type {
  WhatsAppEnvioResponse,
  LunaReadyResponse,
  TriagensRelatorioApiResponse,
} from '../types/api';

const SOAP_SUGESTOES: Record<'S' | 'O' | 'A' | 'P', string> = {
  S: 'Tutor relata apatia há 2 dias e diminuição do apetite.',
  O: 'Animal alerta, mucosas normocoradas, TPC < 2s. Ausculta cardiopulmonar sem alterações.',
  A: 'Suspeita de gastroenterite. Aguardar exames complementares.',
  P: 'Dieta hipossódica por 5 dias. Retorno em 7 dias ou se piorar.',
};

export function sugestaoSOAP(campo: 'S' | 'O' | 'A' | 'P', _idPet: number): string {
  return SOAP_SUGESTOES[campo];
}

export async function enviarWhatsApp(
  _config: InternalAxiosRequestConfig,
): Promise<WhatsAppEnvioResponse> {
  return {
    status: 'enviado',
    sid: 'SMmock1234567890',
  };
}

// CQ-09: mock passou a espelhar o corpo real de GET /ready ({status, oracle,
// kura_api}) em vez do shape antigo (sgStatus/servicos/{twilio,oracle,
// visaoComputacional}), que nenhum endpoint real da Luna jamais emitiu.
export async function ready(_config: InternalAxiosRequestConfig): Promise<LunaReadyResponse> {
  return {
    status: 'ok',
    oracle: 'ok',
    kura_api: 'ok',
  };
}

// CQ-09: devolve o shape de FIO (TriagensRelatorioApiResponse — totalTriagens/
// porUrgencia/encaminhadasParaVet, ALTA/MEDIA/BAIXA), não mais o tipo interno do app.
// resolveMock() substitui a rede: do ponto de vista de luna.service.ts, este mock É a
// resposta do .NET, e passa pelo MESMO tradutor (toTriagensRelatorioResponse) que o
// modo real usaria — é assim que modo real e modo mock ficam garantidos de bater no
// mesmo número para o mesmo dado (critério de aceite da CQ-09), em vez de dois
// caminhos de parsing divergentes.
export async function relatorioTriagens(
  _config: InternalAxiosRequestConfig,
): Promise<TriagensRelatorioApiResponse> {
  return {
    totalTriagens: 142,
    porUrgencia: {
      BAIXA: 71,
      MEDIA: 47,
      ALTA: 24,
    },
    encaminhadasParaVet: 29,
  };
}
