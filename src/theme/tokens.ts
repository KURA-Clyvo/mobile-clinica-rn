export const lightColors = {
  primary: '#1A3A52',
  primarySoft: '#2D5E7E',
  primaryPale: '#D8E8F2',
  textOnPrimary: '#FFFCF7',

  sage: '#4A6944',
  sagePale: '#E0ECDB',
  amber: '#C8810D',
  amberPale: '#FBF0DB',
  clay: '#D9624A',
  clayPale: '#F7E5DF',

  bg: '#F8F2E6',
  bgElev: '#FFFCF7',
  bgSunk: '#EDE3CD',
  surface: '#FFFCF7',
  surface2: '#F2EBDB',

  border: '#EDE3CD',
  borderStrong: '#D9CDB0',
  borderFocus: '#1A3A52',

  text: '#1B1006',
  textSoft: '#4A3418',
  textMute: '#8A7458',

  success: '#4A6944',
  successBg: '#E0ECDB',
  warning: '#C8810D',
  warningBg: '#FBF0DB',
  danger: '#B14A2F',
  dangerBg: '#F7E5DF',
  info: '#2D5E7E',
  infoBg: '#D8E8F2',
};

export const darkColors: typeof lightColors = {
  primary: '#4A8AB5',
  primarySoft: '#5A9DC8',
  primaryPale: '#1A3A52',
  textOnPrimary: '#FFFCF7',

  sage: '#6A9964',
  sagePale: '#1E3A1C',
  amber: '#E8A030',
  amberPale: '#3A2800',
  clay: '#E8826A',
  clayPale: '#3A1510',

  bg: '#0F1F2E',
  bgElev: '#16293B',
  bgSunk: '#0A1520',
  surface: '#16293B',
  surface2: '#1C3248',

  border: '#1E3A52',
  borderStrong: '#2D5070',
  borderFocus: '#4A8AB5',

  text: '#F0EAD8',
  textSoft: '#C8B898',
  textMute: '#7A8A98',

  success: '#6A9964',
  successBg: '#1E3A1C',
  warning: '#E8A030',
  warningBg: '#3A2800',
  danger: '#D06A50',
  dangerBg: '#3A1510',
  info: '#5A9DC8',
  infoBg: '#1A3A52',
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// Alvo de toque mínimo para elementos interativos. WCAG 2.2 SC 2.5.8 (AA) exige
// piso de 24×24 CSS px; SC 2.5.5 (AAA) e a boa prática de mercado pedem 44×44 —
// é esse o valor que usamos como meta (CQ-07). Vale só para componentes que
// respondem a onPress — um rótulo não-interativo não é alvo de toque e a WCAG
// 2.5.8 não se aplica a ele. Não é dimensão de espaçamento (não pertence a
// `spacing`, que é gap/padding entre elementos, não o tamanho mínimo de um
// elemento).
export const touchTarget = {
  min: 44,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  '2xl': 28,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 26,
  '2xl': 34,
  '3xl': 44,
} as const;

export const fonts = {
  display: 'Cormorant_500Medium',
  body: 'Lexend_400Regular',
  bodyMedium: 'Lexend_500Medium',
  mono: 'JetBrainsMono_400Regular',
} as const;

// Breakpoints de viewport (largura mínima, em px, para cada faixa).
// `sm` é a faixa "base" (celular em pé) e começa em 0 de propósito — todo
// layout parte do menor viewport e vai ganhando espaço a partir daí (mobile-first).
// `md` (768) é o limiar clássico de tablet retrato (iPad = 768×1024 em pontos,
// e é o valor que Bootstrap/Tailwind usam para "tablet"), `lg` (1024) é
// paisagem de tablet / notebook pequeno, `xl` (1440) é monitor de desktop —
// o app agora roda em web (CQ-02) e o painel de gestão da clínica é usado de
// notebook/monitor com frequência real, não só de celular.
//
// Regra dura desta task (CQ-04): nenhum número de largura de viewport pode
// existir fora deste arquivo. `useBreakpoint` e `ScreenContainer` importam
// daqui — nunca reescrever 768/1024/1440 em outro arquivo.
export const breakpoints = {
  sm: 0,
  md: 768,
  lg: 1024,
  xl: 1440,
} as const;

export type BreakpointKey = keyof typeof breakpoints;

export const layout = {
  // Largura de leitura confortável para um painel de gestão (dashboard,
  // relatório de triagens, agenda) — não é o mesmo critério de uma coluna de
  // texto corrido (~65-75 caracteres, ~600-700px), é largura de conteúdo
  // *estruturado* (cards, tabelas, formulários em grade). 1200px é o valor
  // que Bootstrap/Material usam para o container "xl" de aplicações de
  // gestão, e cabe com folga abaixo do breakpoint `xl` (1440) — em monitor
  // de 1440px sobra ~120px de respiro de cada lado antes mesmo de contar o
  // padding interno, em vez de esticar o conteúdo de borda a borda.
  maxContentWidth: 1200,
} as const;
