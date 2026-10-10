import type { lightColors } from '@theme/tokens';

// BR-CLI-T07 — vocabulário e cores de nível numa tabela só (BR-CLI-13).
// M-2 da T01: Média (`warning`) e Alta (`amber`) tinham o mesmo hex nos dois temas, e o
// ponto e a barra do relatório não se distinguiam. Agora cada nível tem um token PRÓPRIO
// e de luminosidade diferente (a diferença não pode ser só de matiz: ver o teste).
export type Urgencia = 'ALTA' | 'MEDIA' | 'BAIXA';
export type TokenCor = keyof typeof lightColors;

export interface UrgenciaVisual {
  label: string;
  chipTone: 'clay' | 'amber' | 'mute';
  /** Token do ponto/barra (grafismo, >= 3:1 contra a superfície). */
  grafico: TokenCor;
}

export const URGENCIA_VISUAL: Record<Urgencia, UrgenciaVisual> = {
  ALTA: { label: 'Alta', chipTone: 'clay', grafico: 'clayInk' },
  MEDIA: { label: 'Média', chipTone: 'amber', grafico: 'amber' },
  BAIXA: { label: 'Baixa', chipTone: 'mute', grafico: 'textMute' },
};

export interface SegmentoTrecho {
  texto: string;
  destaque: boolean;
}

// Um caractere -> um caractere: tira acento e caixa sem mudar o comprimento, para que os
// índices do texto normalizado valham no original.
function normalizar(texto: string): string {
  return Array.from(texto)
    .map((c) => {
      const base = c.normalize('NFD').charAt(0).toLowerCase();
      return base.length === 1 ? base : c;
    })
    .join('');
}

const LETRA = /[\p{L}\p{N}]/u;

/**
 * Divide o trecho da mensagem em segmentos, marcando as ocorrências das palavras que
 * decidiram o nível. Insensível a caixa e a acento. Se nenhuma palavra aparece no trecho,
 * devolve um único segmento sem destaque (o card cai para o chip "disparou: ...").
 */
export function destacarTrecho(trecho: string, palavras: string[]): SegmentoTrecho[] {
  const alvo = normalizar(trecho);
  const faixas: Array<[number, number]> = [];
  for (const p of palavras) {
    const n = normalizar(p.trim());
    if (!n) continue;
    let i = alvo.indexOf(n);
    while (i !== -1) {
      // O motor casa por trecho de palavra ("vomito" casa "vomitou"): realca a palavra INTEIRA
      // da mensagem, senao o destaque corta "vomit|ou" no meio.
      let ini = i;
      let fim = i + n.length;
      while (ini > 0 && LETRA.test(alvo.charAt(ini - 1))) ini--;
      while (fim < alvo.length && LETRA.test(alvo.charAt(fim))) fim++;
      faixas.push([ini, fim]);
      i = alvo.indexOf(n, fim);
    }
  }
  if (faixas.length === 0) return [{ texto: trecho, destaque: false }];
  faixas.sort((a, b) => a[0] - b[0]);
  const fundidas: Array<[number, number]> = [];
  for (const f of faixas) {
    const ultima = fundidas[fundidas.length - 1];
    if (ultima && f[0] <= ultima[1]) ultima[1] = Math.max(ultima[1], f[1]);
    else fundidas.push([f[0], f[1]]);
  }
  const segs: SegmentoTrecho[] = [];
  let cursor = 0;
  for (const [ini, fim] of fundidas) {
    if (ini > cursor) segs.push({ texto: trecho.slice(cursor, ini), destaque: false });
    segs.push({ texto: trecho.slice(ini, fim), destaque: true });
    cursor = fim;
  }
  if (cursor < trecho.length) segs.push({ texto: trecho.slice(cursor), destaque: false });
  return segs;
}
