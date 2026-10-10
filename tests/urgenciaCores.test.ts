// BR-CLI-T07 (M-2 da T01) -- Alta/Media/Baixa distinguiveis por LUMINOSIDADE, nos 2 temas.
import fs from 'fs';
import path from 'path';
import { darkColors, lightColors } from '../src/theme/tokens';
import { URGENCIA_VISUAL } from '../src/utils/triagem';
import type { Urgencia } from '../src/utils/triagem';

const canal = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const lum = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
};
const ratio = (a: string, b: string) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const trunc = (r: number) => Math.floor(r * 100) / 100;

const TEMAS = { claro: lightColors, escuro: darkColors } as const;
const NIVEIS: Urgencia[] = ['ALTA', 'MEDIA', 'BAIXA'];
// Diferenca minima de luminosidade entre dois niveis (razao de contraste entre as cores).
// 1.25 e o maior valor redondo abaixo do pior par real medido (claro 1.31, escuro 1.26).
const DIF_MIN = 1.25;

describe.each(Object.keys(TEMAS) as Array<keyof typeof TEMAS>)('cores de nivel (%s)', (tema) => {
  const c = TEMAS[tema] as unknown as Record<string, string>;

  it('os 3 niveis tem hex distintos', () => {
    const hex = NIVEIS.map((n) => c[URGENCIA_VISUAL[n].grafico]);
    expect(new Set(hex).size).toBe(3);
  });

  it(`os 3 niveis tem luminancias distintas (razao >= ${DIF_MIN})`, () => {
    for (let i = 0; i < NIVEIS.length; i++) {
      for (let j = i + 1; j < NIVEIS.length; j++) {
        const a = c[URGENCIA_VISUAL[NIVEIS[i]!].grafico]!;
        const b = c[URGENCIA_VISUAL[NIVEIS[j]!].grafico]!;
        expect(trunc(ratio(a, b))).toBeGreaterThanOrEqual(DIF_MIN);
      }
    }
  });

  it.each(NIVEIS)('ponto/barra de %s >= 3:1 sobre a superficie', (n) => {
    expect(trunc(ratio(c[URGENCIA_VISUAL[n].grafico]!, c.surface!))).toBeGreaterThanOrEqual(3);
  });

  it('texto do chip >= 4.5: clayInk/clayPale, amberInk/amberPale, textMuteInk/surface', () => {
    expect(trunc(ratio(c.clayInk!, c.clayPale!))).toBeGreaterThanOrEqual(4.5);
    expect(trunc(ratio(c.amberInk!, c.amberPale!))).toBeGreaterThanOrEqual(4.5);
    expect(trunc(ratio(c.textMuteInk!, c.surface!))).toBeGreaterThanOrEqual(4.5);
  });

  it('palavra destacada: text sobre amberPale >= 4.5; trecho: textSoft sobre surface >= 4.5', () => {
    expect(trunc(ratio(c.text!, c.amberPale!))).toBeGreaterThanOrEqual(4.5);
    expect(trunc(ratio(c.textSoft!, c.surface!))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('a tela usa a tabela unica', () => {
  const luna = fs.readFileSync(path.join(__dirname, '..', 'src/app/(app)/luna.tsx'), 'utf8');
  it('luna.tsx pinta nivel pela tabela, nao por warning/amber/success direto', () => {
    expect(luna).toMatch(/URGENCIA_VISUAL/);
    expect(luna).not.toMatch(/case 'MEDIO': return colors\./);
  });
  it('vocabulario unico: sem Alto/Medio/Baixo como rotulo de nivel', () => {
    expect(luna).not.toMatch(/'(Alto|Médio|Baixo)'/);
  });
});
