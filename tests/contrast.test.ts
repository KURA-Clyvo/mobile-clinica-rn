// BR-CLI-T01 — gate de contraste WCAG 2.x sobre os tokens REAIS do app.
// Valores de referência: Design System KURA (tema "Noite" = dark, "Areia" = light).
import fs from 'fs';
import path from 'path';
import { darkColors, lightColors } from '../src/theme/tokens';

type Cores = Record<string, string>;
const TEMAS: Record<'claro' | 'escuro', Cores> = {
  claro: lightColors as unknown as Cores,
  escuro: darkColors as unknown as Cores,
};

function canal(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminancia(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}
export function ratio(a: string, b: string): number {
  const x = luminancia(a);
  const y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

type Par = { tema: 'claro' | 'escuro'; texto: string; fundo: string; limiar: number; nota?: string };
const TEXTO = 4.5;
const BORDA = 3;
// 4.4: pares que o próprio DS declara "limítrofes" (danger/dangerBg 4.43 e
// textMuteInk/surface2 4.48 no claro) — aceitos só para texto >=13px/500 ou com ícone.
const LIMITROFE = 4.4;

const PARES: Par[] = [
  // --- escuro: os pares que a auditoria F5 reprova no marinho ---
  { tema: 'escuro', texto: 'textOnPrimary', fundo: 'primary', limiar: TEXTO },
  { tema: 'escuro', texto: 'textOnPrimary', fundo: 'primarySoft', limiar: TEXTO },
  { tema: 'escuro', texto: 'primary', fundo: 'surface', limiar: TEXTO },
  { tema: 'escuro', texto: 'primary', fundo: 'bg', limiar: TEXTO },
  { tema: 'escuro', texto: 'primary', fundo: 'primaryPale', limiar: TEXTO },
  { tema: 'escuro', texto: 'textMuteInk', fundo: 'surface2', limiar: TEXTO },
  { tema: 'escuro', texto: 'textMuteInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'escuro', texto: 'textMuteInk', fundo: 'bgSunk', limiar: TEXTO },
  { tema: 'escuro', texto: 'textMuteInk', fundo: 'primaryPale', limiar: TEXTO },
  { tema: 'escuro', texto: 'info', fundo: 'infoBg', limiar: TEXTO },
  { tema: 'escuro', texto: 'success', fundo: 'successBg', limiar: TEXTO },
  { tema: 'escuro', texto: 'danger', fundo: 'surface', limiar: TEXTO },
  { tema: 'escuro', texto: 'danger', fundo: 'primaryPale', limiar: TEXTO },
  { tema: 'escuro', texto: 'danger', fundo: 'dangerBg', limiar: TEXTO },
  { tema: 'escuro', texto: 'amberInk', fundo: 'amberPale', limiar: TEXTO },
  { tema: 'escuro', texto: 'clayInk', fundo: 'clayPale', limiar: TEXTO },
  { tema: 'escuro', texto: 'amberInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'escuro', texto: 'clayInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'escuro', texto: 'text', fundo: 'bg', limiar: TEXTO },
  { tema: 'escuro', texto: 'borderControl', fundo: 'bg', limiar: BORDA, nota: 'borda de controle' },
  { tema: 'escuro', texto: 'borderControl', fundo: 'surface', limiar: BORDA, nota: 'borda de controle' },
  // --- claro ---
  { tema: 'claro', texto: 'amberInk', fundo: 'amberPale', limiar: TEXTO },
  { tema: 'claro', texto: 'amberInk', fundo: 'bg', limiar: TEXTO },
  { tema: 'claro', texto: 'amberInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'claro', texto: 'clayInk', fundo: 'clayPale', limiar: TEXTO },
  { tema: 'claro', texto: 'clayInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'claro', texto: 'clayInk', fundo: 'bg', limiar: TEXTO },
  { tema: 'claro', texto: 'textMuteInk', fundo: 'bg', limiar: TEXTO },
  { tema: 'claro', texto: 'textMuteInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'claro', texto: 'textMuteInk', fundo: 'surface2', limiar: LIMITROFE },
  { tema: 'claro', texto: 'danger', fundo: 'dangerBg', limiar: LIMITROFE },
  { tema: 'claro', texto: 'primary', fundo: 'primaryPale', limiar: TEXTO },
  { tema: 'claro', texto: 'textOnPrimary', fundo: 'primary', limiar: TEXTO },
  { tema: 'claro', texto: 'text', fundo: 'bg', limiar: TEXTO },
  { tema: 'claro', texto: 'borderControl', fundo: 'bg', limiar: BORDA, nota: 'borda de controle' },
  { tema: 'claro', texto: 'borderControl', fundo: 'surface', limiar: BORDA, nota: 'borda de controle' },
];

describe('ratio (sanidade WCAG)', () => {
  it('preto x branco = 21', () => {
    expect(ratio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });
  it('controle do DS: amber sobre bg (claro) = 2.85', () => {
    expect(ratio('#C8810D', '#F8F2E6')).toBeCloseTo(2.85, 2);
  });
});

describe('contraste dos tokens reais', () => {
  it.each(PARES)('$tema: $texto sobre $fundo >= $limiar', ({ tema, texto, fundo, limiar }) => {
    const t = TEMAS[tema];
    const a = t[texto];
    const b = t[fundo];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    const r = ratio(a as string, b as string);
    // arredonda a 2 casas, como os números citados na auditoria e no DS
    expect(Math.round(r * 100) / 100).toBeGreaterThanOrEqual(limiar);
  });
});

function arquivosFonte(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__') continue;
      arquivosFonte(p, acc);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

describe('gate: amber/clay nunca como cor de texto', () => {
  const SRC = path.join(__dirname, '..', 'src');
  const arquivos = arquivosFonte(SRC);

  it('varre arquivos de src/ (controle: a varredura enxerga o tokens.ts)', () => {
    expect(arquivos.some((f) => f.endsWith(path.join('theme', 'tokens.ts')))).toBe(true);
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it('nenhum `color: colors.amber|clay` em src/', () => {
    const re = /color:\s*colors\.(amber|clay)\b/;
    const achados: string[] = [];
    for (const f of arquivos) {
      fs.readFileSync(f, 'utf8')
        .split('\n')
        .forEach((l, i) => {
          if (re.test(l)) achados.push(`${path.relative(SRC, f)}:${i + 1}: ${l.trim()}`);
        });
    }
    expect(achados).toEqual([]);
  });

  it('regex pega o padrão proibido (controle positivo)', () => {
    const re = /color:\s*colors\.(amber|clay)\b/;
    expect(re.test('      color: colors.clay,')).toBe(true);
    expect(re.test('      borderColor: colors.clay,')).toBe(false); // borderColor não é texto (o regex é sensível a maiúscula)
  });
});
