import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '@theme/index';
import { resolverSimbolo, type VarianteSimbolo } from './simboloCores';

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
   * Cores por contexto (BR-CLI-T04), de `simboloCores.json` — a mesma fonte do
   * `gerar-assets.mjs`. `sobreNeutro`: corpo `primaryPale` SÓLIDO (decisão C2: a 18% o ocean
   * sobre a areia compõe um cinza que não lê como azul). `sobreOcean`: knockout sobre fundo
   * ocean (mesmo tratamento do `icon.png`). Quando passada, `color` é ignorado. Sem `variante`,
   * o desenho é o de sempre (corpo a 18%, haste a 50%, tudo em `color`).
   */
  variante?: VarianteSimbolo;
  /**
   * Cores por pata, na ordem [central, esquerda, direita] — usadas pela abertura
   * para acender as patas em âmbar uma a uma. Default: as patas da variante (ou `color`).
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
export function KuraMark({ size = DEFAULT_SIZE, color, variante, patas }: KuraMarkProps) {
  const { colors } = useTheme();
  const height = size * (VIEWBOX_HEIGHT / VIEWBOX_WIDTH);
  const c = color ?? colors.primary;
  const v = variante ? resolverSimbolo(variante, colors) : undefined;
  const base = v?.patas ?? c;
  const [pataCentral, pataEsq, pataDir] = patas ?? [base, base, base];
  const lateraisOpac = v ? v.lateraisOpac : patas ? 1 : 0.85;

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
        fill={v ? v.corpo : c}
        fillOpacity={v ? v.corpoOpac : 0.18}
      />
      {/* haste */}
      <Path
        d="M20 44 L20 16"
        stroke={v ? v.haste : c}
        strokeWidth="1.2"
        opacity={v ? v.hasteOpac : 0.5}
        strokeLinecap="round"
      />
      {/* 3 "patas/cabeças" */}
      <Circle cx="20" cy="8" r="3.5" fill={pataCentral} />
      <Circle cx="13" cy="12" r="2.8" fill={pataEsq} opacity={lateraisOpac} />
      <Circle cx="27" cy="12" r="2.8" fill={pataDir} opacity={lateraisOpac} />
      {/* contorno do corpo */}
      <Path
        d="M20 44 C8 44 4 34 4 24 C4 10 12 4 20 4 C28 4 36 10 36 24 C36 34 32 44 20 44Z"
        stroke={v ? v.contorno : c}
        strokeWidth="1.5"
        fill="none"
        opacity={v ? v.contornoOpac : 0.7}
      />
    </Svg>
  );
}
