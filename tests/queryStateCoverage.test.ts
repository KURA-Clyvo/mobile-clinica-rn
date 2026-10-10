// BR-CLI-T03 — gate 2 (regra v7): roda o detector `scripts/check-query-state.mjs` sobre o app
// real (telas derivadas de src/app, hooks de dado derivados de src/hooks) e sobre uma ISCA
// (controle positivo: o detector precisa enxergar a violação). Roda por processo filho porque
// o script é ESM puro (.mjs) e a suíte Jest é CJS.
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const RAIZ = path.join(__dirname, '..');
const SCRIPT = path.join(RAIZ, 'scripts', 'check-query-state.mjs');

type Resultado = {
  telas: string[];
  hooks: string[];
  chamadas: { tela: string; hook: string; ok: boolean; motivo?: string }[];
  violacoes: { tela: string; hook: string; motivo?: string }[];
};
function rodar(root: string): { status: number | null; r: Resultado } {
  const p = spawnSync('node', [SCRIPT, '--root', root, '--json'], { encoding: 'utf8' });
  return { status: p.status, r: JSON.parse(p.stdout) as Resultado };
}

function montarIsca(telaSrc: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-isca-'));
  fs.mkdirSync(path.join(dir, 'src', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src', 'app'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'src', 'hooks', 'useCoisa.ts'),
    "import { useQuery } from '@tanstack/react-query';\nexport function useCoisas() {\n  return useQuery({ queryKey: ['c'], queryFn: async () => [] });\n}\n",
  );
  fs.writeFileSync(path.join(dir, 'src', 'app', 'tela.tsx'), telaSrc);
  return dir;
}

describe('gate: tela que lê dado de servidor trata o erro (check-query-state)', () => {
  it('app real: 0 violações (EXIT 0), sem allowlist', () => {
    const { status, r } = rodar(RAIZ);
    expect(r.violacoes).toEqual([]);
    expect(status).toBe(0);
  });

  it('controle: o detector enxerga telas e hooks de dado derivados do código', () => {
    const { r } = rodar(RAIZ);
    expect(r.telas.length).toBeGreaterThan(15);
    expect(r.hooks).toEqual(expect.arrayContaining(['usePets', 'useAlertas', 'useServicosPreco', 'useUsuariosClinica']));
    expect(r.chamadas.length).toBeGreaterThan(20);
    // tela sem dado de servidor não vira "chamada"
    expect(r.chamadas.some((c) => c.tela.includes('settings.tsx'))).toBe(false);
  });

  it('isca: tela que desestrutura só data/isLoading => violação nominal, EXIT 1', () => {
    const dir = montarIsca("export default function T(){ const { data = [], isLoading } = useCoisas(); return null; }");
    const { status, r } = rodar(dir);
    expect(status).toBe(1);
    expect(r.violacoes).toHaveLength(1);
    expect(r.violacoes[0]).toMatchObject({ tela: 'tela.tsx', hook: 'useCoisas' });
  });

  it('isca: tela com <QueryState query={q}> passa', () => {
    const dir = montarIsca("export default function T(){ const q = useCoisas(); return <QueryState query={q} empty={null}>{() => null}</QueryState>; }");
    expect(rodar(dir).status).toBe(0);
  });

  it('isca: isError lido e USADO passa; lido e ignorado reprova', () => {
    const usado = montarIsca("export default function T(){ const { data, isError } = useCoisas(); return isError ? 1 : 2; }");
    expect(rodar(usado).status).toBe(0);
    const ignorado = montarIsca("export default function T(){ const { data, isError } = useCoisas(); return data; }");
    expect(rodar(ignorado).status).toBe(1);
  });

  it('allowlist com razão curta não vale (contrato do script)', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    expect(src).toMatch(/RAZAO_MIN = 30/);
    expect(src).toMatch(/export const ALLOWLIST = \{\}/);
  });

  it('o CLI imprime a contagem e sai 0 no app real', () => {
    const out = execFileSync('node', [SCRIPT], { encoding: 'utf8' });
    expect(out).toMatch(/violacoes: 0/);
  });
});
