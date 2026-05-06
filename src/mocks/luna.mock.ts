import type { InternalAxiosRequestConfig } from 'axios';
import type {
  WhatsAppEnvioResponse,
  LunaHealthResponse,
  TriagensRelatorioResponse,
} from '../types/api';

let _envioId = 5000;

export async function enviarWhatsApp(
  _config: InternalAxiosRequestConfig,
): Promise<WhatsAppEnvioResponse> {
  return {
    idEnvio: ++_envioId,
    dtEnvio: new Date().toISOString(),
    sgStatus: 'ENVIADO',
  };
}

export async function health(_config: InternalAxiosRequestConfig): Promise<LunaHealthResponse> {
  return {
    sgStatus: 'UP',
    dtUltimaVerificacao: new Date().toISOString(),
    servicos: {
      twilio: 'UP',
      oracle: 'UP',
      visaoComputacional: 'UP',
    },
  };
}

export async function relatorioTriagens(
  _config: InternalAxiosRequestConfig,
): Promise<TriagensRelatorioResponse> {
  return {
    nrTotalTriagens: 142,
    distribuicaoUrgencia: {
      BAIXO: 68,
      MEDIO: 45,
      ALTO: 22,
      CRITICO: 7,
    },
    nrEncaminhadasParaVet: 29,
  };
}
