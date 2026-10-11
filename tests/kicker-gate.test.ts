// BR-CLI-T09 (BR-CLI-11): Kicker e a assinatura da marca -- no maximo 1 por tela, sempre com
// funcao. Este gate conta `<Kicker` por arquivo de tela (src/app) e, para blocos usados por mais
// de uma tela, soma o que cada tela monta (dashboard = dashboard.tsx + ProximosDoDia.tsx).
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

// componentes de `domain` que uma tela monta inteiros (o kicker deles conta na tela)
const COMPOSTAS: Record<string, string[]> = {
  'app/(app)/dashboard.tsx': ['components/domain/ProximosDoDia.tsx'],
};

describe('gate: Kicker no maximo 1 por tela', () => {
  it('a contagem enxerga a isca (controle positivo)', () => {
    expect(conta('<Kicker>a</Kicker><Kicker cor="x">b</Kicker>')).toBe(2);
    expect(conta('<KickerOutro />')).toBe(0);
  });

  it('o Kicker existe em pelo menos 3 telas (o componente esta em uso)', () => {
    const comKicker = telas('app').filter((f) => conta(ler(f)) + (COMPOSTAS[f] ?? []).reduce((a, c) => a + conta(ler(c)), 0) > 0);
    expect(comKicker.length).toBeGreaterThanOrEqual(3);
  });

  it.each(telas('app').map((f) => [f]))('%s: <= 1 Kicker', (f) => {
    const total = conta(ler(f)) + (COMPOSTAS[f] ?? []).reduce((a, c) => a + conta(ler(c)), 0);
    expect(total).toBeLessThanOrEqual(1);
  });
});
