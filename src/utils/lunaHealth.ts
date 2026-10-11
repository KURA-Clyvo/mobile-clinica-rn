import type { LunaHealthResult } from '@services/luna.service';

// Movido de luna.tsx na BR-CLI-T07 (C6): a tela Luna so mostra o estado geral; o detalhe
// Oracle/API Kura vive em Configuracoes (gestor). Comentarios de origem (CQ-09) preservados.
// getLunaHealth() nunca rejeita: quando a Luna está fora do ar ela resolve com
// {status: 'indisponivel'} em vez de lançar. Este type guard estreita a união antes de
// acessar oracle/kura_api — sem ele o acesso direto é um crash real em runtime.
// CQ-09: o guard antigo testava 'sgStatus', uma chave que nunca existiu em nenhum
// endpoint real da Luna — resultado medido: sempre falso em modo real, a tela sempre
// mostrava "Offline" com a Luna perfeitamente no ar.
// CQ-09 fix wave (G2 Important-1): testar 'oracle' tinha o MESMO modo de falha — é
// outra chave do corpo do upstream, cujo shape não foi reverificado contra a Luna
// real (ver limite declarado em LunaReadyResponse). Se a Luna renomear/omitir
// `oracle`, o guard voltaria a falhar e a tela voltaria a mostrar "Offline" com a
// Luna no ar. 'httpStatus' não depende do corpo do upstream — é anexado só no
// caminho de sucesso de getLunaHealth() (luna.service.ts: `{...data, httpStatus:
// status}`), nunca no caminho de erro (`{status:'indisponivel'}`), então é um
// discriminante estável mesmo que o shape real do corpo mude.
export function isLunaHealthUp(
  health: LunaHealthResult | undefined,
): health is Exclude<LunaHealthResult, { status: 'indisponivel' }> {
  return health != null && 'httpStatus' in health;
}

// CQ-09: o tipo exato de oracle/kura_api (enum? boolean? string livre?) não foi
// reverificado contra a Luna real nesta sessão — tratado como string opaca, comparada
// de forma defensiva e case-insensitive contra algo como 'ok'/'up'. Ver
// LunaReadyResponse (src/types/api.ts) para o limite declarado.
// CQ-09 fix wave (G2 Important-1): aceita undefined/null além de string — desde que
// isLunaHealthUp() não dependa mais de uma chave específica do corpo (ver acima), uma
// chave individual como `oracle` pode estar ausente sem que isso seja um crash; nesse
// caso trata como "não confirmado up", não lança.
export function isServicoUp(valor: boolean | string | undefined | null): boolean {
  if (valor == null) return false;
  // A Luna real devolve booleano (ver LunaReadyResponse); string fica por compatibilidade.
  if (typeof valor === 'boolean') return valor;
  const v = valor.toLowerCase();
  return v === 'ok' || v === 'up';
}

