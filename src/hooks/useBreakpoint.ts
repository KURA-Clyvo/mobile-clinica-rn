import { useWindowDimensions } from 'react-native';
import { breakpoints, type BreakpointKey } from '@theme/tokens';

// Ordem crescente de largura mínima — usada tanto para resolver o breakpoint
// atual (maior faixa cuja largura mínima cabe na largura atual) quanto para
// comparações relativas (`isAtLeast`). Derivada de `breakpoints`, nunca
// hardcoded — se um breakpoint novo entrar em tokens.ts, esta ordenação
// já reflete ele sem precisar editar este arquivo.
const ORDERED_KEYS = (Object.keys(breakpoints) as BreakpointKey[]).sort(
  (a, b) => breakpoints[a] - breakpoints[b],
);

function resolveBreakpoint(width: number): BreakpointKey {
  // Seed com 'sm', que em tokens.ts sempre tem largura mínima 0 — o loop
  // abaixo sempre encontra e sobrescreve isso para qualquer width >= 0 real.
  // (Evita indexar ORDERED_KEYS[0], que sob `noUncheckedIndexedAccess` o TS
  // tipa como possivelmente `undefined`.)
  let current: BreakpointKey = 'sm';
  for (const key of ORDERED_KEYS) {
    if (width >= breakpoints[key]) {
      current = key;
    }
  }
  return current;
}

export interface UseBreakpointResult {
  /** Largura atual da janela/viewport, em px. */
  width: number;
  /** Altura atual da janela/viewport, em px. */
  height: number;
  /** Maior breakpoint (ver `breakpoints` em tokens.ts) cuja largura mínima cabe na largura atual. */
  breakpoint: BreakpointKey;
  /**
   * `true` quando a largura atual é igual ou maior que a largura mínima do
   * breakpoint informado. É a forma pretendida de fazer perguntas como
   * "estou em `lg` ou acima?" sem o consumidor reimplementar a comparação
   * numérica (e sem reintroduzir um número de viewport fora de tokens.ts).
   *
   * Exemplo: com os valores de `breakpoints` em tokens.ts, `isAtLeast('lg')`
   * é `true` em qualquer largura igual ou maior que `breakpoints.lg`, e
   * `false` abaixo disso — inclusive em `breakpoints.md`.
   */
  isAtLeast: (key: BreakpointKey) => boolean;
}

/**
 * Breakpoint responsivo derivado de `useWindowDimensions()` (react-native) —
 * NUNCA `Dimensions.get()`, que tira um retrato estático e não re-renderiza
 * quando a janela do navegador muda de tamanho. Essa diferença importa desde
 * que o app passou a rodar em web (CQ-02): em nativo a "janela" só muda com
 * rotação de tela, mas no navegador o usuário redimensiona a qualquer momento.
 */
export function useBreakpoint(): UseBreakpointResult {
  const { width, height } = useWindowDimensions();
  const breakpoint = resolveBreakpoint(width);

  return {
    width,
    height,
    breakpoint,
    isAtLeast: (key: BreakpointKey) => width >= breakpoints[key],
  };
}
