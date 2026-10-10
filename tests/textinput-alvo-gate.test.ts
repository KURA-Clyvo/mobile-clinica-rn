// BR-CLI-T05 fix wave 2 (re-G2 M-5) — o gate de toque (AST de Touchable/Pressable/Switch) NÃO enxerga `TextInput`
// cru, e a sonda de DOM da re-G2 achou 4 campos de busca com o <input> em ~19px (caixa 41px). Este gate deriva do
// código (regra v7): todo `<TextInput` fora do `KCTextField` precisa apontar para um estilo (`style={styles.X}`)
// que DECLARE altura mínima >= 44 (`minHeight`/`height`; `touchTarget.min` vale 44). Estilo ausente, sem altura ou
// com altura < 44 reprova. Limite declarado: avalia só `minHeight`/`height` literais/`touchTarget.min` e somas;
// estilo composto por array/ternário no `style` não é resolvido e reprova (força a forma simples).
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', 'src');
const MIN = 44;

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return /\.tsx$/.test(e.name) ? [p] : [];
  });
}

function avalia(expr: string): number | null {
  const e = expr.replace(/touchTarget\.min/g, String(MIN)).trim();
  if (!/^[\d\s+*().-]+$/.test(e)) return null;
  try {
    const v = Function(`"use strict"; return (${e});`)() as unknown;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** Para cada `<TextInput`, devolve problemas (vazio = ok). */
export function problemasTextInput(fonte: string): string[] {
  const out: string[] = [];
  const re = /<TextInput\b([\s\S]*?)(?:\/>|>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fonte))) {
    const linha = fonte.slice(0, m.index).split('\n').length;
    const st = /style=\{styles\.(\w+)\}/.exec(m[1]!);
    if (!st) {
      out.push(`linha ${linha}: style não é \`styles.X\` simples`);
      continue;
    }
    const bloco = new RegExp(String.raw`\b${st[1]}:\s*\{([\s\S]*?)\}`).exec(fonte);
    if (!bloco) {
      out.push(`linha ${linha}: estilo ${st[1]} não encontrado`);
      continue;
    }
    const alturas = [...bloco[1]!.matchAll(/\b(?:minHeight|height):\s*([^,\n]+)/g)]
      .map((a) => avalia(a[1]!))
      .filter((v): v is number => v !== null);
    if (!alturas.some((v) => v >= MIN)) {
      out.push(`linha ${linha}: ${st[1]} sem minHeight/height >= ${MIN} (declarado: ${alturas.join(',') || 'nenhum'})`);
    }
  }
  return out;
}

describe('gate: TextInput cru declara alvo >= 44', () => {
  const todos = arquivos(SRC).filter((f) => !f.endsWith('KCTextField.tsx'));
  const comTextInput = todos.filter((f) => fs.readFileSync(f, 'utf8').includes('<TextInput'));

  it('o gate enxerga TextInput de verdade (sanidade: >= 5 arquivos)', () => {
    expect(comTextInput.length).toBeGreaterThanOrEqual(5);
  });

  it('controle positivo: isca de 19px/sem altura/43px reprova; 44 e touchTarget.min passam', () => {
    const src = (estilo: string) => `<TextInput style={styles.x} />\nconst a = { x: { ${estilo} } };`;
    expect(problemasTextInput(src('flex: 1, fontSize: 15'))).toHaveLength(1);
    expect(problemasTextInput(src('padding: 12'))).toHaveLength(1);
    expect(problemasTextInput(src('minHeight: 43'))).toHaveLength(1);
    expect(problemasTextInput(src('minHeight: 44'))).toHaveLength(0);
    expect(problemasTextInput(src('minHeight: touchTarget.min'))).toHaveLength(0);
    expect(problemasTextInput(src('minHeight: 90 + 24'))).toHaveLength(0);
    expect(problemasTextInput('<TextInput style={[a, b]} />')).toHaveLength(1);
  });

  it('nenhum TextInput cru em src/ com alvo < 44', () => {
    const ofensores = comTextInput.flatMap((f) =>
      problemasTextInput(fs.readFileSync(f, 'utf8')).map((p) => `${path.relative(SRC, f)} ${p}`),
    );
    expect(ofensores).toEqual([]);
  });
});
