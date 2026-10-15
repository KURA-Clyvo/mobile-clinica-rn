// BR-CLI-T09 (BR-CLI-11): Kicker e a assinatura da marca -- no maximo 1 por tela, sempre com
// funcao. Este gate conta `<Kicker` por arquivo de tela (src/app) e soma o dos componentes
// PERMITIDOS que a tela importa (derivado do import, ver abaixo).
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', 'src');
const ler = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const conta = (t: string) => (t.match(/<Kicker[\s>]/g) ?? []).length;

const telas = (dir: string): string[] =>
  fs.readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return telas(rel);
    return /\.tsx$/.test(e.name) ? [rel] : [];
  });

// I2 (fix wave G2): estrutural, sem mapa de composicao escrito a mao.
//  1) todo arquivo fora de `app/` (e fora do proprio Kicker.tsx) que renderiza `<Kicker` precisa estar
//     em PERMITIDOS, com razao > 30 chars -- componente reutilizavel com Kicker (ex.: dentro de card
//     repetido) e justamente o caso proibido, entao entrar na lista e decisao consciente;
//  2) o Kicker de um PERMITIDO conta na tela que o importa (derivado do `import`, nao de mapa).
const PERMITIDOS: Record<string, string> = {
  'components/domain/ProximosDoDia.tsx':
    'bloco unico do dashboard (1 por tela, fora de .map): o kicker da secao Proximos do dia',
};

const todos = (dir: string): string[] =>
  fs.readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return todos(rel);
    return /\.tsx?$/.test(e.name) ? [rel] : [];
  });

const nome = (rel: string) => path.posix.basename(rel).replace(/\.tsx?$/, '');
const importa = (tela: string, comp: string) =>
  new RegExp(`from\\s+['"][^'"]*/${nome(comp)}['"]`).test(tela);
const totalDaTela = (f: string) => {
  const src = ler(f);
  return (
    conta(src) +
    Object.keys(PERMITIDOS).reduce((a, c) => a + (importa(src, c) ? conta(ler(c)) : 0), 0)
  );
};

describe('gate: Kicker no maximo 1 por tela', () => {
  it('a contagem enxerga a isca (controle positivo)', () => {
    expect(conta('<Kicker>a</Kicker><Kicker cor="x">b</Kicker>')).toBe(2);
    expect(conta('<KickerOutro />')).toBe(0);
    expect(importa("import { X } from '@components/domain/ProximosDoDia';", 'components/domain/ProximosDoDia.tsx')).toBe(true);
    expect(importa('const a = 1;', 'components/domain/ProximosDoDia.tsx')).toBe(false);
  });

  it('o Kicker existe em pelo menos 3 telas (o componente esta em uso)', () => {
    const comKicker = telas('app').filter((f) => totalDaTela(f) > 0);
    expect(comKicker.length).toBeGreaterThanOrEqual(3);
  });

  it('fora de app/, so renderiza <Kicker quem esta em PERMITIDOS (com razao)', () => {
    const fora = todos('.')
      .filter((f) => !f.startsWith('app/') && f !== 'components/primitives/Kicker.tsx')
      .filter((f) => conta(ler(f)) > 0)
      .filter((f) => !((PERMITIDOS[f] ?? '').length > 30));
    expect(fora).toEqual([]);
  });

  it('PERMITIDOS nao esta obsoleto: cada entrada existe e renderiza exatamente 1 Kicker', () => {
    for (const f of Object.keys(PERMITIDOS)) expect(conta(ler(f))).toBe(1);
  });

  it.each(telas('app').map((f) => [f]))('%s: <= 1 Kicker', (f) => {
    expect(totalDaTela(f)).toBeLessThanOrEqual(1);
  });
});
