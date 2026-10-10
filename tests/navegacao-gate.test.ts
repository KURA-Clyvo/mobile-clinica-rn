// BR-CLI-T05 fix wave 2 (re-G2 I-4) — gate derivado do código (regra v7): nenhum arquivo de `src/` pode chamar
// `.back()`/`.goBack()` direto. Com `backBehavior="history"` o `GO_BACK` não é tratado em tela aberta por URL direta
// e o botão fica parado; o único lugar que pode chamar `router.back()` é `voltarOu` (src/utils/navegacao.ts), que
// tem o fallback para a tela-pai. Comentários são removidos antes de varrer (AppHeader cita `router.back()` em doc).
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', 'src');
const PERMITIDO = path.join('utils', 'navegacao.ts');
const CHAMADA = /\.\s*(back|goBack)\s*\(/;

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** Linhas com chamada direta de `.back()`/`.goBack()` (já sem comentários). */
export function chamadasDiretas(fonte: string): number[] {
  return semComentarios(fonte)
    .split('\n')
    .flatMap((l, i) => (CHAMADA.test(l) ? [i + 1] : []));
}

describe('gate: nenhum back() fora do helper de navegação', () => {
  const todos = arquivos(SRC);

  it('o gate enxerga o código (controle positivo: o helper contém a chamada permitida)', () => {
    const helper = fs.readFileSync(path.join(SRC, PERMITIDO), 'utf8');
    expect(todos.length).toBeGreaterThan(50);
    expect(chamadasDiretas(helper).length).toBeGreaterThan(0);
  });

  it('controle positivo: isca com router.back() / navigation.goBack() é flagrada; comentário e string não', () => {
    expect(chamadasDiretas('const a = () => router.back();')).toEqual([1]);
    expect(chamadasDiretas('x\nnavigation.goBack();')).toEqual([2]);
    expect(chamadasDiretas('// router.back() aqui\n/* e router.back()\n aqui */\nok();')).toEqual([]);
  });

  it('src/ não tem router.back()/goBack() fora de utils/navegacao.ts', () => {
    const ofensores = todos
      .filter((f) => !f.endsWith(PERMITIDO))
      .flatMap((f) => chamadasDiretas(fs.readFileSync(f, 'utf8')).map((n) => `${path.relative(SRC, f)}:${n}`));
    expect(ofensores).toEqual([]);
  });
});
