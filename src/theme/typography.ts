import { fontSize, fonts } from './tokens';

export const typography = {
  display: {
    fontFamily: fonts.display,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * 1.2,
    letterSpacing: -0.5,
  },
  heading: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * 1.3,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.5,
  },
  bodyMedium: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.5,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.4,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },
} as const;
