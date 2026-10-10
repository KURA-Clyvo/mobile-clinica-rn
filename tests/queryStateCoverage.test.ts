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

const HOOK = [
  "import { useQuery } from '@tanstack/react-query';",
  'export function useCoisas() {',
  "  return useQuery({ queryKey: ['c'], queryFn: async () => [] });",
  '}',
  '',
].join('\n');

/** Monta uma árvore src/ falsa. `null` remove o arquivo-base src/hooks/useCoisa.ts. */
function montar(arquivos: Record<string, string | null>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qs-isca-'));
  for (const [rel, src] of Object.entries({ 'src/hooks/useCoisa.ts': HOOK, ...arquivos })) {
    if (src === null) continue;
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), src);
  }
  fs.mkdirSync(path.join(dir, 'src', 'app'), { recursive: true });
  return dir;
}
const montarIsca = (telaSrc: string) => montar({ 'src/app/tela.tsx': telaSrc });

describe('gate: tela que lê dado de servidor trata o erro (check-query-state)', () => {
  it('app real: 0 violações (EXIT 0)', () => {
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
    expect(r.violacoes[0]).toMatchObject({ tela: 'app/tela.tsx', hook: 'useCoisas' });
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

  // I-1 (G2): cada forma que o detector antigo NÃO via ganha uma isca que DEVE reprovar (regra 13).
  // Os corpos são as sondas da revisão G2 (br-cli-t03-revisao.md, F2).
  const SEM_ERRO = 'export default function T(){ const { data = [] } = useCoisas(); return data; }';
  const hookEm = (corpo: string) => ({ 'src/hooks/useCoisa.ts': `export function useCoisas(){ ${corpo} }` });
  const ISCAS: [string, Record<string, string | null>][] = [
    ['q passado por prop ao filho', { 'src/app/t.tsx': 'export default function T(){ const q = useCoisas(); return <Lista q={q}/>; }' }],
    ['if (q.isError) {} vazio', { 'src/app/t.tsx': 'export default function T(){ const q = useCoisas(); if (q.isError) {} return q.data?.length ? q.data : <Text>Nenhum</Text>; }' }],
    ['isError só no console.log', { 'src/app/t.tsx': "export default function T(){ const { data = [], isError } = useCoisas(); console.log(isError); return data.length ? data : 'Nenhum'; }" }],
    ['hook useInfiniteQuery', { ...hookEm("return useInfiniteQuery({ queryKey:['c'], queryFn: async()=>[] });"), 'src/app/t.tsx': SEM_ERRO }],
    ['hook useQueries', { ...hookEm('return useQueries({ queries: [] });'), 'src/app/t.tsx': SEM_ERRO }],
    ['hook useSuspenseQuery', { ...hookEm("return useSuspenseQuery({ queryKey:['c'], queryFn: async()=>[] });"), 'src/app/t.tsx': SEM_ERRO }],
    ['hook definido em src/services', { 'src/hooks/useCoisa.ts': null, 'src/services/coisa.ts': HOOK, 'src/app/t.tsx': SEM_ERRO }],
    [
      'hook local no próprio arquivo de tela',
      { 'src/hooks/useCoisa.ts': null, 'src/app/t.tsx': "function useLocal(){ return useQuery({queryKey:['x'],queryFn:async()=>[]}); }\nexport default function T(){ const { data = [] } = useLocal(); return data; }" },
    ],
    ['componente de src/components chama hook', { 'src/components/Lista.tsx': "export function Lista(){ const { data = [] } = useCoisas(); return data.length ? data : 'Nenhum'; }" }],
    ['useQuery direto na tela', { 'src/app/t.tsx': "export default function T(){ const { data = [] } = useQuery({queryKey:['x'],queryFn:async()=>[]}); return data; }" }],
    ['useQuery direto num componente', { 'src/components/L.tsx': "export function L(){ const { data = [] } = useQuery({queryKey:['x'],queryFn:async()=>[]}); return data; }" }],
    ['useInfiniteQuery direto', { 'src/app/t.tsx': "export default function T(){ const { data } = useInfiniteQuery({queryKey:['x'],queryFn:async()=>[]}); return data; }" }],
    ['useSuspenseQuery direto', { 'src/app/t.tsx': "export default function T(){ const { data } = useSuspenseQuery({queryKey:['x'],queryFn:async()=>[]}); return data; }" }],
    ['2 chamadas, isError usado só na 1ª', { 'src/app/t.tsx': "export default function T(){ const { data: a, isError } = useCoisas(); const { data: b = [], isError: e2 } = useCoisas(); return isError ? 'x' : b; }" }],
    [
      '2 componentes no arquivo reaproveitando o nome isError',
      { 'src/app/t.tsx': "function A(){ const { data, isError } = useCoisas(); return isError?1:data; }\nfunction B(){ const { data = [], isError } = useCoisas(); return data.length?data:'Nenhum'; }\nexport default function T(){return <><A/><B/></>;}" },
    ],
    ['export default function useX', { 'src/hooks/useCoisa.ts': "export default function useCoisas(){ return useQuery({ queryKey:['c'], queryFn: async()=>[] }); }", 'src/app/t.tsx': SEM_ERRO }],
    ['arrow const + export { useX }', { 'src/hooks/useCoisa.ts': "const useCoisas = () => useQuery({ queryKey:['c'], queryFn: async()=>[] });\nexport { useCoisas };", 'src/app/t.tsx': SEM_ERRO }],
    ['export { useX as useY }', { 'src/hooks/useCoisa.ts': "const useBase = () => useQuery({ queryKey:['c'], queryFn: async()=>[] });\nexport { useBase as useCoisas };", 'src/app/t.tsx': SEM_ERRO }],
    ['query={q} num componente que não é QueryState', { 'src/app/t.tsx': 'export default function T(){ const q = useCoisas(); return <Grafico query={q} />; }' }],
    ['arquivo .ts em src/app', { 'src/app/t.ts': SEM_ERRO }],
    ['useQueries direto sem isError', { 'src/app/t.tsx': 'export default function T(){ const rs = useQueries({ queries: [] }); return rs.length; }' }],
  ];
  it.each(ISCAS)('isca (controle positivo): %s => violação, EXIT 1', (_nome, arquivos) => {
    const { status, r } = rodar(montar(arquivos));
    expect(r.violacoes.length).toBeGreaterThan(0);
    expect(status).toBe(1);
  });

  const PASSAM: [string, Record<string, string | null>][] = [
    ['componente com isError usado', { 'src/components/Lista.tsx': "export function Lista(){ const { data = [], isError } = useCoisas(); return isError ? 'erro' : data; }" }],
    ['hook local com consumidor em QueryState', { 'src/hooks/useCoisa.ts': null, 'src/app/t.tsx': "function useLocal(){ return useQuery({queryKey:['x'],queryFn:async()=>[]}); }\nexport default function T(){ const q = useLocal(); return <QueryState query={q} empty={null}>{() => null}</QueryState>; }" }],
    ['2 componentes, cada um usa o próprio isError', { 'src/app/t.tsx': "function A(){ const { data, isError } = useCoisas(); return isError?1:data; }\nfunction B(){ const { data = [], isError } = useCoisas(); return isError?2:data; }\nexport default function T(){return <><A/><B/></>;}" }],
    ['useQueries com isError lido', { 'src/app/t.tsx': 'export default function T(){ const rs = useQueries({ queries: [] }); return rs.some((r) => r.isError) ? 1 : 2; }' }],
    ['useInfiniteQuery direto em QueryState', { 'src/app/t.tsx': 'export default function T(){ const q = useInfiniteQuery({queryKey:[1]}); return <QueryState query={q} empty={null}>{() => null}</QueryState>; }' }],
  ];
  it.each(PASSAM)('controle negativo: %s => passa', (_nome, arquivos) => {
    const { status, r } = rodar(montar(arquivos));
    expect(r.violacoes).toEqual([]);
    expect(status).toBe(0);
  });

  it('allowlist: toda entrada tem razão > 30 caracteres, aponta para chamada que existe e NÃO cobre os blocos da F2', () => {
    const lista = JSON.parse(execFileSync('node', [SCRIPT, '--allowlist'], { encoding: 'utf8' })) as Record<string, string>;
    const { r } = rodar(RAIZ);
    for (const [chave, razao] of Object.entries(lista)) {
      expect(razao.length).toBeGreaterThan(30);
      const [tela, hook] = chave.split('::');
      expect(r.chamadas.some((c) => c.tela === tela && c.hook === hook)).toBe(true);
      // hooks dos blocos que mentiam na F2 (BR-CLI-02) nunca entram em allowlist
      expect(hook).not.toMatch(/^(useUsuariosClinica|useServicosPreco|useAlertas|useRecentes|useRelatorioTriagens|useAgendaSemana|usePets|usePetTimeline|useVeterinariosParaSelecao)$/);
    }
  });

  it('o CLI imprime a contagem e sai 0 no app real', () => {
    const out = execFileSync('node', [SCRIPT], { encoding: 'utf8' });
    expect(out).toMatch(/violacoes: 0/);
  });
});
