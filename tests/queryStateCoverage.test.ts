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

// G2-M5: controle negativo só vale se o detector CONTOU a chamada (um detector nulo também sai 0 sem violação).
function exigirPassa(dir: string) {
  const { status, r } = rodar(dir);
  expect(r.violacoes).toEqual([]);
  expect(r.chamadas.length).toBeGreaterThanOrEqual(1);
  expect(r.chamadas.every((c) => c.ok)).toBe(true);
  expect(status).toBe(0);
}

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
    exigirPassa(dir);
  });

  it('isca: isError lido e USADO passa; lido e ignorado reprova', () => {
    const usado = montarIsca("export default function T(){ const { data, isError } = useCoisas(); return isError && data == null ? 1 : 2; }");
    exigirPassa(usado);
    const ignorado = montarIsca("export default function T(){ const { data, isError } = useCoisas(); return data; }");
    expect(rodar(ignorado).status).toBe(1);
  });

  // G4 BR-CLI-G4 (achado 3): "isError antes de data" descarta o dado salvo quando o refetch falha.
  it('isca: isError testado ANTES do dado (isError ? / isError || !data) => violação nominal', () => {
    const ternario = montarIsca("export default function T(){ const { data, isError } = useCoisas(); return isError ? 'erro' : data; }");
    const r1 = rodar(ternario);
    expect(r1.status).toBe(1);
    expect(r1.r.violacoes[0]!.motivo).toMatch(/isError antes de data/);
    const ou = montarIsca("export default function T(){ const { data: lista, isError } = useCoisas(); if (isError || !lista) return 'erro'; return lista; }");
    expect(rodar(ou).status).toBe(1);
    // reprodução do maestro: retorno antecipado `if (isError) {` passava verde
    const cedo = montarIsca(
      "export default function T(){ const { data, isError } = useCoisas();\n  if (isError) {\n    return 'erro';\n  }\n  return data; }",
    );
    const r3 = rodar(cedo);
    expect(r3.status).toBe(1);
    expect(r3.r.violacoes[0]!.motivo).toMatch(/retorno antecipado/);
  });

  it('controle: isError só quando NÃO há dado, ou ligado à faixa de dados salvos, passa', () => {
    const guarda = montarIsca("export default function T(){ const { data, isError } = useCoisas(); return isError && data == null ? 'erro' : data; }");
    exigirPassa(guarda);
    const faixa = montarIsca("export default function T(){ const { data, isError } = useCoisas(); return <>{isError ? <FaixaDadosSalvos/> : null}{data}</>; }");
    exigirPassa(faixa);
  });

  // As 4 iscas obrigatórias do brief da BR-TUT-T03 (portadas do tutor 6fb15d5), no FORMATO que o Prettier e o código real produzem (não one-liners de sonda).
  describe('iscas obrigatórias (formato real)', () => {
    it('isError testado DEPOIS do dado, em ternário encadeado de uma linha e no formato multilinha do Prettier => violação (conservador)', () => {
      // `data ? ... : isError ? ... : ...` é a ordem certa, mas o detector é textual: qualquer `isError ?` sem guarda `&& data == null`
      // reprova. Declarado: o caminho aceito é QueryState (ou `isError && data == null`). Se isto passar a EXIT 0 sem o dev mudar a
      // tela, o detector perdeu a regra.
      const umaLinha = montarIsca('export default function T(){ const { data, isError } = useCoisas(); return data ? <L d={data}/> : isError ? <Erro/> : <Skel/>; }');
      const r1 = rodar(umaLinha);
      expect(r1.status).toBe(1);
      expect(r1.r.violacoes[0]!.motivo).toMatch(/isError antes de data/);
      const multilinha = montarIsca(
        'export default function T(){\n  const { data, isError } = useCoisas();\n  return data ? (\n    <L d={data}/>\n  ) : isError ? (\n    <Erro/>\n  ) : null;\n}',
      );
      expect(rodar(multilinha).status).toBe(1);
    });

    it('`if (isError) {\\n return ... }` multilinha (Prettier), antes de usar o dado => violação "retorno antecipado"', () => {
      const dir = montarIsca(
        'export default function T(){\n  const { data, isError } = useCoisas();\n  if (isError) {\n    return <Erro/>;\n  }\n  return <L d={data}/>;\n}',
      );
      const { status, r } = rodar(dir);
      expect(status).toBe(1);
      expect(r.violacoes[0]!.motivo).toMatch(/retorno antecipado/);
    });

    it('desestruturação renomeada (`data: vacinas`, `isError: falhou`) é seguida pelo alias => violação; com guarda de dado passa', () => {
      const ruim = montarIsca(
        'export default function T(){\n  const { data: vacinas, isError: falhou } = useCoisas();\n  if (falhou) return <Erro/>;\n  return <L d={vacinas}/>;\n}',
      );
      const r1 = rodar(ruim);
      expect(r1.status).toBe(1);
      expect(r1.r.violacoes[0]!.motivo).toMatch(/falhou.*vacinas|vacinas/);
      const ruimTernario = montarIsca('export default function T(){ const { data: vacinas, isError: falhou } = useCoisas(); return falhou ? <Erro/> : <L d={vacinas}/>; }');
      expect(rodar(ruimTernario).status).toBe(1);
      const boa = montarIsca('export default function T(){ const { data: vacinas, isError: falhou } = useCoisas(); return falhou && vacinas == null ? <Erro/> : <L d={vacinas}/>; }');
      exigirPassa(boa);
      const lidoEIgnorado = montarIsca('export default function T(){ const { data: vacinas, isError: falhou } = useCoisas(); return <L d={vacinas}/>; }');
      expect(rodar(lidoEIgnorado).status).toBe(1);
    });

    it('`?? \'OK\'` sobre dado que pode estar ausente (o código antigo do perfil do pet) => violação por não tratar isError', () => {
      const dir = montarIsca(
        "const STATUS = { OK: 'Tudo certo', ALERTA: 'Atenção' };\n" +
          'export default function T(){\n  const { data: pet } = useCoisas();\n  const statusCfg = STATUS[pet?.dsStatusGeral ?? \'OK\'];\n  return <Chip>{statusCfg}</Chip>;\n}',
      );
      const { status, r } = rodar(dir);
      expect(status).toBe(1);
      expect(r.violacoes[0]!.motivo).toMatch(/destructuring sem isError/);
    });
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
      { 'src/app/t.tsx': "function A(){ const { data, isError } = useCoisas(); return isError&&data==null?1:data; }\nfunction B(){ const { data = [], isError } = useCoisas(); return data.length?data:'Nenhum'; }\nexport default function T(){return <><A/><B/></>;}" },
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


  // BR-CLI-DET (porte do F3-I1 da BR-TUT-T03, tutor 6fb15d5): as iscas da G2 que o detector antigo da clínica (773ae66) NÃO via, no formato multilinha do Prettier.
  describe('F3-I1: formas que o detector herdado não enxergava', () => {
    const tela = (corpo: string) => `export default function T() {\n${corpo}\n}`;
    const CASOS: [string, string, RegExp][] = [
      [
        'a) objeto: `if (q.isError) { return <Erro/> }` descarta o dado salvo',
        tela(
          '  const petsQuery = useCoisas();\n  if (petsQuery.isError) {\n    return <ErrorState onRetry={() => petsQuery.refetch()} />;\n  }\n  return <Text>{petsQuery.data?.length ?? 0}</Text>;',
        ),
        /isError antes de data/,
      ],
      [
        'a) objeto: ternário `q.isError ? <Erro/> : ...`',
        tela('  const q = useCoisas();\n  return q.isError ? (\n    <Erro />\n  ) : (\n    <L d={q.data} />\n  );'),
        /isError antes de data/,
      ],
      [
        'a) objeto: `q.isError || !q.data`',
        tela('  const q = useCoisas();\n  if (q.isError || !q.data) return <Erro />;\n  return <L d={q.data} />;'),
        /isError antes de data/,
      ],
      [
        'b) desestruturado: `if (isError && !isFetching) return <Erro/>`',
        tela('  const { data, isError, isFetching } = useCoisas();\n  if (isError && !isFetching) {\n    return <Erro />;\n  }\n  return <L d={data} />;'),
        /condição composta sem guarda de data/,
      ],
      [
        'b) objeto: `if (q.isError && !q.isFetching) return <Erro/>`',
        tela('  const q = useCoisas();\n  if (q.isError && !q.isFetching) {\n    return <Erro />;\n  }\n  return <L d={q.data} />;'),
        /condição composta sem guarda de q\.data/,
      ],
      [
        // Reprodução do maestro (sessão 6): desestruturação em 2ª instrução a partir do objeto, com renomeação, e o
        // objeto também indo para <QueryState>. O detector só olhava `q.isError` e aceitava pelo <QueryState>.
        'a) objeto + desestruturação renomeada depois: `const { isError: falhou } = q; if (falhou) return null`',
        tela(
          '  const q = useCoisas();\n  const { isError: falhou } = q;\n  if (falhou) return null;\n  return (\n    <QueryState\n      query={q}\n      empty={<Text>Nenhum</Text>}\n    >\n      {(d) => <L d={d} />}\n    </QueryState>\n  );',
        ),
        /isError antes de data/,
      ],
      [
        'c) erro E vazio ao mesmo tempo (Review Focus §5)',
        tela(
          '  const { data = [], isError } = useCoisas();\n  return (\n    <>\n      {isError && <ErrorState onRetry={() => 1} />}\n      {data.length === 0 && <Text>Nenhum pet ainda</Text>}\n      {data.length > 0 && <L d={data} />}\n    </>\n  );',
        ),
        /erro e vazio podem coincidir/,
      ],
      [
        'c) erro E vazio, forma objeto, `!q.length`',
        tela(
          '  const q = useCoisas();\n  return (\n    <>\n      {q.isError && <ErrorState onRetry={() => 1} />}\n      {!q.data?.length && (\n        <Text>Nenhum</Text>\n      )}\n    </>\n  );',
        ),
        /erro e vazio podem coincidir/,
      ],
    ];
    it.each(CASOS)('isca: %s => violação nominal, EXIT 1', (_n, src, motivo) => {
      const { status, r } = rodar(montarIsca(src));
      expect(status).toBe(1);
      expect(r.violacoes).toHaveLength(1);
      expect(r.violacoes[0]!.motivo).toMatch(motivo);
    });

    const QUERIES = (corpo: string) => tela(`  const petsQuery = useCoisas();\n  const vacinas = useQueries({ queries: [] });\n${corpo}`);
    const QUERY_LIKE = 'isLoading: false, refetch: () => 1, data: petsQuery.data';
    const CASOS_QUERIES: [string, string][] = [
      [
        'd) M8b da G2: o erro dos itens do useQueries é descartado (só `petsQuery.isError`)',
        QUERIES(`  const agregada = { ${QUERY_LIKE}, isError: petsQuery.isError };\n  return (\n    <QueryState query={agregada} empty={null}>\n      {() => null}\n    </QueryState>\n  );`),
      ],
      [
        'd) `isError` lido do array e jogado fora (`void algumErro`)',
        QUERIES('  const algumErro = vacinas.some((r) => r.isError);\n  void algumErro;\n  return petsQuery.isError && petsQuery.data == null ? 1 : 2;'),
      ],
      ['d) a palavra isError só aparece em outro lugar', QUERIES('  return petsQuery.isError && petsQuery.data == null ? vacinas.length : 2;')],
    ];
    it.each(CASOS_QUERIES)('isca (useQueries): %s => violação em useQueries, EXIT 1', (_n, src) => {
      const { status, r } = rodar(montarIsca(src));
      expect(status).toBe(1);
      expect(r.violacoes.map((v) => v.hook)).toEqual(['useQueries']);
      expect(r.violacoes[0]!.motivo).toMatch(/useQueries: o isError de cada item/);
    });

    const PASSAM_F3: [string, string][] = [
      ['objeto com guarda de dado', tela('  const q = useCoisas();\n  if (q.isError && q.data == null) {\n    return <Erro />;\n  }\n  return <L d={q.data} />;')],
      ['desestruturado com guarda de dado na condição composta', tela('  const { data, isError, isFetching } = useCoisas();\n  if (isError && data == null && !isFetching) {\n    return <Erro />;\n  }\n  return <L d={data} />;')],
      [
        'erro e vazio, com `!isError` na cadeia do vazio',
        tela('  const { data = [], isError } = useCoisas();\n  return (\n    <>\n      {isError && data.length === 0 && <ErrorState onRetry={() => 1} />}\n      {!isError && data.length === 0 && <Text>Nenhum pet ainda</Text>}\n    </>\n  );'),
      ],
      [
        'useQueries: o erro de cada item entra no agregado, COM guarda de dado, e o agregado é usado',
        tela('  const vacinas = useQueries({ queries: [] });\n  const falhou = vacinas.some((r) => r.isError && r.data == null);\n  return falhou ? <Erro /> : <L />;'),
      ],
      [
        'objeto + desestruturação renomeada depois, com guarda do dado renomeado',
        tela('  const q = useCoisas();\n  const { isError: falhou, data: d } = q;\n  if (falhou && !d) return null;\n  return <QueryState query={q} empty={<Text>N</Text>}>{(x) => <L d={x} />}</QueryState>;'),
      ],
      [
        'useQueries: `res[0].isError` lido, com guarda de dado',
        tela('  const vacinas = useQueries({ queries: [] });\n  return vacinas[0]?.isError && vacinas[0]?.data == null ? <Erro /> : <L />;'),
      ],
      [
        // padrão da Saúde do tutor: o erro dos itens vira um QueryLike entregue ao kit (o kit decide o que o erro faz ao dado)
        'useQueries: erro agregado num objeto entregue a <QueryState query>',
        tela(
          '  const vacinas = useQueries({ queries: [] });\n  const agregada = {\n    isLoading: false,\n    refetch: () => 1,\n    data: vacinas.map((r) => r.data),\n    isError: vacinas.some((r) => r.isError),\n  };\n  return (\n    <QueryState query={agregada} empty={null}>\n      {() => null}\n    </QueryState>\n  );',
        ),
      ],
      ['if (q.isError && (q.data == null)) aninhado', tela('  const q = useCoisas();\n  if (q.isError && (q.data == null)) {\n    return <Erro />;\n  }\n  return <L d={q.data} />;')],
      ['`!q.data && q.isError` (guarda antes do erro)', tela('  const q = useCoisas();\n  if (!q.data && q.isError) {\n    return <Erro />;\n  }\n  return <L d={q.data} />;')],
    ];
    it.each(PASSAM_F3)('controle negativo: %s => passa', (_n, src) => {
      exigirPassa(montarIsca(src));
    });
  });

  const PASSAM: [string, Record<string, string | null>][] = [
    ['componente com isError usado', { 'src/components/Lista.tsx': "export function Lista(){ const { data = [], isError } = useCoisas(); return isError && data.length === 0 ? 'erro' : data; }" }],
    ['hook local com consumidor em QueryState', { 'src/hooks/useCoisa.ts': null, 'src/app/t.tsx': "function useLocal(){ return useQuery({queryKey:['x'],queryFn:async()=>[]}); }\nexport default function T(){ const q = useLocal(); return <QueryState query={q} empty={null}>{() => null}</QueryState>; }" }],
    ['2 componentes, cada um usa o próprio isError', { 'src/app/t.tsx': "function A(){ const { data, isError } = useCoisas(); return isError&&data==null?1:data; }\nfunction B(){ const { data = [], isError } = useCoisas(); return isError&&data.length===0?2:data; }\nexport default function T(){return <><A/><B/></>;}" }],
    ['useQueries com isError lido, com guarda de dado', { 'src/app/t.tsx': 'export default function T(){ const rs = useQueries({ queries: [] }); return rs.some((r) => r.isError && r.data == null) ? 1 : 2; }' }],
    ['useInfiniteQuery direto em QueryState', { 'src/app/t.tsx': 'export default function T(){ const q = useInfiniteQuery({queryKey:[1]}); return <QueryState query={q} empty={null}>{() => null}</QueryState>; }' }],
  ];
  it.each(PASSAM)('controle negativo: %s => passa', (_nome, arquivos) => {
    exigirPassa(montar(arquivos));
  });

  // BR-CLI-DET fix wave da G2 (br-cli-det-revisao.md): cada isca é uma sonda da revisão, no formato multilinha do Prettier, e
  // o detector herdado (cb36c2a) a aceitava com EXIT 0. Todas DEVEM reprovar com violação nominal.
  describe('fix wave G2: formas que o detector herdado aceitava', () => {
    const tela = (corpo: string) => `export default function T() {\n${corpo}\n}`;
    const ERRO_SEM_DADO = /isError antes de data/;
    const CASOS_G2: [string, string, RegExp][] = [
      // G2-I1: a guarda de dado só vale em conjunção com o erro, nunca dentro de `||`
      ['I1 `!data || isError`', tela('  const { data, isError } = useCoisas();\n  if (!data || isError) {\n    return <ErrorState />;\n  }\n  return <L d={data} />;'), ERRO_SEM_DADO],
      ['I1 `q.data == null || q.isError`', tela('  const q = useCoisas();\n  if (q.data == null || q.isError) {\n    return <ErrorState />;\n  }\n  return <L d={q.data} />;'), ERRO_SEM_DADO],
      ['I1 `isError || data?.length === 0`', tela('  const { data, isError } = useCoisas();\n  if (isError || data?.length === 0) {\n    return <ErrorState />;\n  }\n  return <L d={data} />;'), ERRO_SEM_DADO],
      // G2-I2: erro negado
      ['I2 `!isError ? <L/> : <Erro/>`', tela('  const { data, isError } = useCoisas();\n  return !isError ? (\n    <L d={data} />\n  ) : (\n    <ErrorState />\n  );'), ERRO_SEM_DADO],
      ['I2 `!q.isError ? <L/> : <Erro/>` (objeto)', tela('  const q = useCoisas();\n  return !q.isError ? (\n    <L d={q.data} />\n  ) : (\n    <ErrorState />\n  );'), ERRO_SEM_DADO],
      ['I2 `{!isError && <L d={data}/>}` esconde o dado salvo', tela('  const { data, isError } = useCoisas();\n  return (\n    <>\n      {!isError && <L d={data} />}\n    </>\n  );'), ERRO_SEM_DADO],
      // G2-I3: erro guardado em variável local
      ['I3 `const erro = q.isError; if (erro)`', tela('  const q = useCoisas();\n  const erro = q.isError;\n  if (erro) {\n    return <ErrorState />;\n  }\n  return <L d={q.data} />;'), ERRO_SEM_DADO],
      [
        'I3 `const mostrarErro = isError && !isFetching; if (mostrarErro)`',
        tela('  const { data, isError, isFetching } = useCoisas();\n  const mostrarErro = isError && !isFetching;\n  if (mostrarErro) {\n    return <ErrorState />;\n  }\n  return <L d={data} />;'),
        ERRO_SEM_DADO,
      ],
      // G2-I5: ramo `{ query: q }` passa pelas mesmas regras
      ['I5 `{ query: q }` + `if (q.isError)`', tela('  const { query: q } = useCoisas();\n  if (q.isError) {\n    return <ErrorState />;\n  }\n  return <L d={q.data} />;'), ERRO_SEM_DADO],
      ['I5 `{ query: q }` + `q.isError ? <Erro/> : <L/>`', tela('  const { query: q } = useCoisas();\n  return q.isError ? (\n    <ErrorState />\n  ) : (\n    <L d={q.data} />\n  );'), ERRO_SEM_DADO],
      [
        'I5 forma da teleorientação: erro derivado de `{ query, mutation }` testado antes da sala salva',
        tela(
          '  const { query: salaQuery, mutation } = useCoisas();\n  const sala = mutation.data ?? salaQuery.data;\n  const erro = mutation.error ?? salaQuery.error;\n  return erro ? <Text>Nao foi possivel</Text> : sala ? <Sala /> : null;',
        ),
        ERRO_SEM_DADO,
      ],
      // G2-M1: outros campos de erro
      ['M1 `q.error`', tela('  const q = useCoisas();\n  if (q.error) {\n    return <ErrorState />;\n  }\n  return <QueryState query={q} empty={null}>{() => null}</QueryState>;'), ERRO_SEM_DADO],
      ["M1 `q.status === 'error'`", tela("  const q = useCoisas();\n  if (q.status === 'error') {\n    return <ErrorState />;\n  }\n  return <QueryState query={q} empty={null}>{() => null}</QueryState>;"), ERRO_SEM_DADO],
      ['M1 `q.isRefetchError`', tela('  const q = useCoisas();\n  if (q.isRefetchError) {\n    return <ErrorState />;\n  }\n  return <QueryState query={q} empty={null}>{() => null}</QueryState>;'), ERRO_SEM_DADO],
      ['M1 `q?.isError`', tela('  const q = useCoisas();\n  if (q?.isError) {\n    return <ErrorState />;\n  }\n  return <QueryState query={q} empty={null}>{() => null}</QueryState>;'), ERRO_SEM_DADO],
      // parênteses aninhados na condição (antes o `if` era lido só até o 1º `)`)
      ['`if (Boolean(ativo) && q.isError)`', tela('  const q = useCoisas();\n  if (Boolean(ativo) && q.isError) {\n    return <ErrorState />;\n  }\n  return <L d={q.data} />;'), ERRO_SEM_DADO],
    ];
    it.each(CASOS_G2)('isca: %s => violação nominal, EXIT 1', (_n, src, motivo) => {
      const { status, r } = rodar(montarIsca(src));
      expect(status).toBe(1);
      expect(r.violacoes).toHaveLength(1);
      expect(r.violacoes[0]!.motivo).toMatch(motivo);
    });

    // G2-I4: `useQueries` — o erro de um item não pode vencer o dado dos outros
    const QUERIES = (corpo: string) => tela(`  const vacinas = useQueries({ queries: [] });\n${corpo}`);
    const CASOS_USEQUERIES: [string, string][] = [
      ['I4 `if (rs.some(r => r.isError)) return <Erro/>`', QUERIES('  if (vacinas.some((r) => r.isError)) {\n    return <ErrorState />;\n  }\n  return <L d={vacinas.map((r) => r.data)} />;')],
      ['I4 `falhou ? <Erro/> : <L/>` com `falhou` derivado do array', QUERIES('  const falhou = vacinas.some((r) => r.isError);\n  return falhou ? (\n    <ErrorState />\n  ) : (\n    <L d={vacinas.map((r) => r.data)} />\n  );')],
      ['I4 `vacinas[0]?.isError ? <Erro/> : <L/>`', QUERIES('  return vacinas[0]?.isError ? <ErrorState /> : <L d={vacinas[0]?.data} />;')],
    ];
    it.each(CASOS_USEQUERIES)('isca (useQueries): %s => violação em useQueries, EXIT 1', (_n, src) => {
      const { status, r } = rodar(montarIsca(src));
      expect(status).toBe(1);
      expect(r.violacoes.map((v) => v.hook)).toEqual(['useQueries']);
      expect(r.violacoes[0]!.motivo).toMatch(ERRO_SEM_DADO);
    });

    // G2-M4 (falso positivo): o retorno antecipado COM guarda de dado exclui o erro quando há dado; o vazio, que só existe com dado,
    // não coincide com ele.
    const CORRETAS: [string, string][] = [
      [
        'M4 retorno antecipado com guarda + vazio depois',
        tela('  const { data, isError } = useCoisas();\n  if (isError && data == null) {\n    return <ErrorState />;\n  }\n  return (\n    <>\n      {data?.length === 0 && <Text>Nenhum</Text>}\n      <L d={data} />\n    </>\n  );'),
      ],
      [
        'M4 `{isError && data == null && <Erro/>}` + vazio',
        tela('  const { data, isError } = useCoisas();\n  return (\n    <>\n      {isError && data == null && <ErrorState />}\n      {data?.length === 0 && <Text>Nenhum</Text>}\n    </>\n  );'),
      ],
      [
        'M4 2 queries: erro guardado da A, vazio da B',
        tela(
          '  const a = useCoisas();\n  const b = useCoisas();\n  if (a.isError && a.data == null) {\n    return <ErrorState />;\n  }\n  return (\n    <>\n      {b.data?.length === 0 && <Text>Nenhum</Text>}\n      <QueryState query={b} empty={null}>{() => null}</QueryState>\n    </>\n  );',
        ),
      ],
      ['I3 alias de erro COM guarda na definição', tela('  const { data, isError } = useCoisas();\n  const semDado = isError && data == null;\n  if (semDado) {\n    return <ErrorState />;\n  }\n  return <L d={data} />;')],
      ['I2 erro negado só no vazio (a lista continua com o erro)', tela('  const { data = [], isError } = useCoisas();\n  return (\n    <>\n      {isError && data.length === 0 && <ErrorState />}\n      {!isError && data.length === 0 && <Text>Nenhum</Text>}\n      <L d={data} />\n    </>\n  );')],
      ['I5 `{ query: q }` com guarda de dado', tela('  const { query: q } = useCoisas();\n  if (q.isError && q.data == null) {\n    return <ErrorState />;\n  }\n  return <L d={q.data} />;')],
    ];
    it.each(CORRETAS)('controle negativo (chamada contada): %s => passa', (_n, src) => {
      exigirPassa(montarIsca(src));
    });
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
