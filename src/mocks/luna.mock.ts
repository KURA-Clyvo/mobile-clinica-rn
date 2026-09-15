import type { InternalAxiosRequestConfig } from 'axios';
import type {
  WhatsAppEnvioResponse,
  LunaReadyResponse,
  TriagensRelatorioApiResponse,
  TriagensListaApiResponse,
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

// LU-09: shape de FIO (TriagensListaApiResponse) do mesmo jeito que relatorioTriagens
// acima — este mock É a resposta do .NET do ponto de vista de luna.service.ts, e
// passa pelo MESMO tradutor (toTriagensListaResponse) que o modo real usaria. Um item
// ALTA com tutor/pets preenchidos (dispara "Responder no WhatsApp" e "Abrir paciente")
// e um item MEDIA com tutor nulo (prova que a ação fica ausente sem quebrar a tela).
export async function triagens(
  _config: InternalAxiosRequestConfig,
): Promise<TriagensListaApiResponse> {
  return {
    items: [
      {
        idTriagem: 501,
        dtTriagem: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        urgencia: 'ALTA',
        sintomas: ['vômito', 'letargia'],
        score: 87,
        regrasVersao: '1.1',
        encaminhadoVet: true,
        tutor: { id: 201, nome: 'Ana Beatriz' },
        pets: [{ id: 301, nome: 'Rex', especie: 'Cão' }],
        trechoMensagem: 'Meu cachorro vomitou 3 vezes hoje e está muito quieto...',
      },
      {
        idTriagem: 502,
        dtTriagem: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        urgencia: 'MEDIA',
        sintomas: ['coceira'],
        score: 34,
        regrasVersao: '1.1',
        encaminhadoVet: false,
        tutor: null,
        pets: [],
        trechoMensagem: 'Notei que ela está se coçando bastante desde ontem...',
      },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
  };
}
