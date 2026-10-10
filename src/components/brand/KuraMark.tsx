import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '@theme/index';

export interface KuraMarkProps {
  /**
   * Largura do mark, em px. A altura é sempre derivada como `size * 48/40`
   * para preservar a proporção 5:6 do brand book (ver ruling D-3, dev
   * VsClaude, KURA_BACKLOG_CLINICA_1, CQ-12) — width/height não são aceitos
   * como props independentes de propósito, para não permitir distorção.
   */
  size?: number;
  /**
   * Cor do mark, sempre por token (`useTheme()`), nunca hex literal — o CI
   * roda `check:colors`/`check:no-ocean`, que grepam hex entre aspas.
   * Default: `colors.primary` (superfície clara). Para uso em knockout
   * sobre fundo `colors.primary` (ex.: header do NavDrawer), passar
   * `colors.textOnPrimary` explicitamente.
   */
  color?: string;
  /**
   * Decisão C2 (BR-CLI-T04): corpo SÓLIDO em vez de `color` a 18% — a 18% o ocean
   * sobre a areia compõe um cinza (#D0D1CB) que não lê como azul. Quando passado
   * (ex.: `colors.primaryPale`), o corpo vira cor cheia e a haste usa `haste`.
   * Sem `corpo`, o desenho é o de sempre (18% + haste a 50%).
   */
  corpo?: string;
  /** Cor da haste quando `corpo` é sólido (ex.: `colors.primarySoft`); default: `color`. */
  haste?: string;
  /**
   * Cores por pata, na ordem [central, esquerda, direita] — usadas pela abertura
   * para acender as patas em âmbar uma a uma. Default: `color` nas três.
   */
  patas?: [string, string, string];
}

const VIEWBOX_WIDTH = 40;
const VIEWBOX_HEIGHT = 48;
const DEFAULT_SIZE = 32;

/**
 * `KuraMark` — marca canônica do KURA (ruling D-3, dev VsClaude,
 * KURA_BACKLOG_CLINICA_1, CQ-12). Copiado literalmente do brand book
 * (`design-system-docs-KURA/.../brandbook-logo.jsx:3-28`): viewBox 40×48,
 * corpo de folha/semente + 3 círculos ("patas/cabeças"). Aposenta o ícone
 * de pata (`KCIcon name="paw"`) usado antes no app da clínica.
 *
 * Restrições do brand book: proporção 5:6 preservada, mínimo 24px digital /
 * 48px em UI, sem sombra/glow/bisel, sem rotação, círculos sempre
 * preenchidos.
 */
export function KuraMark({ size = DEFAULT_SIZE, color, corpo, haste, patas }: KuraMarkProps) {
  const { colors } = useTheme();
  const c = color ?? colors.primary;
  const height = size * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH);
  const solido = corpo !== undefined;
  const [pataCentral, pataEsq, pataDir] = patas ?? [c, c, c];

  return (
    <Svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      width={size}
      height={height}
      fill="none"
      aria-label="Kura mark"
    >
      {/* corpo */}
      <Path
        d="M20 44 C8 44 4 34 4 24 C4 10 12 4 20 4 C28 4 36 10 36 24 C36 34 32 44 20 44Z"
        fill={solido ? corpo : c}
        fillOpacity={solido ? 1 : 0.18}
      />
      {/* haste */}
      <Path
        d="M20 44 L20 16"
        stroke={solido ? (haste ?? c) : c}
        strokeWidth="1.2"
        opacity={solido ? 1 : 0.5}
        strokeLinecap="round"
      />
      {/* 3 "patas/cabeças" */}
      <Circle cx="20" cy="8" r="3.5" fill={pataCentral} />
      <Circle cx="13" cy="12" r="2.8" fill={pataEsq} opacity={patas ? 1 : 0.85} />
      <Circle cx="27" cy="12" r="2.8" fill={pataDir} opacity={patas ? 1 : 0.85} />
      {/* contorno do corpo */}
      <Path
        d="M20 44 C8 44 4 34 4 24 C4 10 12 4 20 4 C28 4 36 10 36 24 C36 34 32 44 20 44Z"
        stroke={c}
        strokeWidth="1.5"
        fill="none"
        opacity="0.7"
      />
    </Svg>
  );
}
