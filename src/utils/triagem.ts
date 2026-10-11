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

// M-5 (G2): o motor devolve `combinacao:{categoria}` quando um verbo e um objeto da MESMA
// oracao disparam ALTA juntos (ex. "comeu" + "chocolate"). Isso nao e palavra da mensagem:
// nao se destaca no trecho e, na tela, vira texto humano.
// Ancora: kura-luna-ai/luna/src/ai/triage_engine.py:190 (`f"combinacao:{categoria}"`) e as
// categorias de triage_rules.py:225-278 (`COMBINACOES_ALTA`) @ e011335, conferido em
// 2026-10-11 com `grep -n 'combinacao' luna/src/ai/triage_engine.py`.
const PREFIXO_COMBINACAO = 'combinacao:';
const CATEGORIAS_COMBINACAO: Record<string, string> = {
  ingestao_toxica: 'ingestão de algo tóxico',
  picada_mordida: 'picada ou mordida',
  queda_altura: 'queda de altura',
};

export const ehCombinacao = (sintoma: string) => sintoma.startsWith(PREFIXO_COMBINACAO);

/** Texto para o vet: palavra casada como veio; combinacao vira "combinação: <categoria>". */
export function rotuloSintoma(sintoma: string): string {
  if (!ehCombinacao(sintoma)) return sintoma;
  const cat = sintoma.slice(PREFIXO_COMBINACAO.length);
  return `combinação: ${CATEGORIAS_COMBINACAO[cat] ?? cat.replace(/_/g, ' ')}`;
}

export interface SegmentoTrecho {
  texto: string;
  destaque: boolean;
}

// Mesma normalizacao do motor da Luna (lowercase + NFKD sem marcas combinantes) e mesma
// tokenizacao ([a-z0-9]+, onde pontuacao, emoji e espaco NAO viram token e dao a fronteira
// de palavra: "chuva" e UM token, nunca casa "uva"; "prato" nunca casa "rato").
// Ancora: kura-luna-ai/luna/src/ai/triage_engine.py:22 (_TOKEN_RE), :31-34 (_normalize),
// :37-43 (_tokenize), :46-51 (_find_positions: sequencia CONTIGUA de tokens) @ e011335,
// conferido em 2026-10-11 com `sed -n '22p;31,51p' luna/src/ai/triage_engine.py`.
const TOKEN_RE = /[a-z0-9]+/g;
const MARCA = /\p{M}/u;

function normalizarTexto(texto: string): string {
  return texto.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
}

interface Token {
  tok: string;
  /** Offsets UTF-16 no texto ORIGINAL (nunca no meio de um surrogate). */
  ini: number;
  fim: number;
}

/** Tokeniza o texto original guardando, por token, onde ele esta no original. */
function tokenizar(original: string): Token[] {
  // Mapa por code point: cada code point gera 0..n caracteres normalizados.
  let norm = '';
  const origIni: number[] = []; // por caractere normalizado -> inicio (UTF-16) do code point de origem
  const origFim: number[] = []; // idem, fim
  let off = 0;
  for (const cp of Array.from(original)) {
    const n = normalizarTexto(cp);
    for (let k = 0; k < n.length; k++) {
      origIni.push(off);
      origFim.push(off + cp.length);
    }
    norm += n;
    off += cp.length;
  }
  const tokens: Token[] = [];
  for (const m of norm.matchAll(TOKEN_RE)) {
    const i = m.index ?? 0;
    const ini = origIni[i]!;
    let fim = origFim[i + m[0].length - 1]!;
    // marcas combinantes soltas logo depois (NFD: "e" + U+0301) pertencem a palavra.
    while (fim < original.length) {
      const cp = String.fromCodePoint(original.codePointAt(fim)!);
      if (!MARCA.test(cp)) break;
      fim += cp.length;
    }
    tokens.push({ tok: m[0], ini, fim });
  }
  return tokens;
}

/**
 * Divide o trecho da mensagem em segmentos, marcando as ocorrencias das palavras que
 * decidiram o nivel. Casa como o motor: por sequencia contigua de TOKENS inteiros, sem
 * caixa e sem acento, e sem expandir substring. `palavras` e o que a API devolve (a
 * palavra casada, ex. "vomitou"). Se nada casa, devolve um segmento sem destaque (o card
 * cai para o chip "disparou: ...").
 */
export function destacarTrecho(trecho: string, palavras: string[]): SegmentoTrecho[] {
  const tokens = tokenizar(trecho);
  const faixas: Array<[number, number]> = [];
  for (const p of palavras) {
    if (ehCombinacao(p)) continue;
    const alvo = tokenizar(p.trim()).map((t) => t.tok);
    const n = alvo.length;
    if (n === 0) continue;
    for (let i = 0; i + n <= tokens.length; i++) {
      if (alvo.every((t, k) => tokens[i + k]!.tok === t)) {
        faixas.push([tokens[i]!.ini, tokens[i + n - 1]!.fim]);
      }
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
