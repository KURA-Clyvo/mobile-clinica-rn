// LU-10 (KURA_BACKLOG_LUNA_AI) — detector de lacuna, regra de ouro v7: "inventário
// de cobertura escrito à mão apodrece em silêncio — o gate tem que derivar a lista
// de consumidores do código e falhar quando aparecer consumidor sem check". Mesmo
// padrão de `src/smokeCoverage/discover-network-consumers.ts` (TASK-81) e
// `src/a11y/discoverInteractiveTouchables.ts` (CQ-08): descoberta por AST via
// `typescript` (já devDependency), nunca regex sobre texto cru nem lista hardcoded.
//
// Achado que motivou este arquivo (N4 do backlog): `LunaSuggestionBadge.tsx`
// importava `sugestaoSOAP` DIRETO de `src/mocks/luna.mock.ts`, contornando o
// `mock-adapter.ts` — o único ponto por onde `mocks/*.mock.ts` deveria ser
// alcançado fora do próprio diretório `src/mocks/` (que importa entre si — ver
// `cobrancas.mock.ts` referenciando `servicos-preco.mock.ts`). Isso fazia o badge
// exibir IA inventada mesmo com `EXPO_PUBLIC_USE_MOCKS=false`, porque o import
// nunca passava pelo interceptor que `EXPO_PUBLIC_USE_MOCKS` controla.
//
// Varre TODO `.ts`/`.tsx` de `src/` (exceto teste/`.d.ts` — os arquivos de teste
// deste repo vivem em `tests/`, fora de `src/`, então já ficam fora por
// construção; o filtro aqui é defesa em profundidade caso isso mude) e reconhece
// import estático (`import ... from '...'`), `import(...)` dinâmico e
// `require(...)` — as 3 formas sintáticas de puxar um módulo em TS/JS. Cada
// especificador é testado contra `MOCK_PATH_SEGMENT`: um segmento de path literal
// `mocks/`, precedido por início de string, `/` ou `@` (cobre tanto o relativo
// `../../mocks/luna.mock` quanto o alias `@mocks/luna.mock` do tsconfig, hoje sem
// uso mas já mapeado em `tsconfig.json`).
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export interface MockImporter {
  /** Caminho relativo a `src/`, forma POSIX — estável entre plataformas. */
  file: string;
  /** Todo especificador de import encontrado neste arquivo que aponta para mocks/. */
  specifiers: string[];
}

const MOCK_PATH_SEGMENT = /(^|\/|@)mocks\//;

/** Lista recursivamente todo `.ts`/`.tsx` sob `dir`, excluindo teste (`.test`/
 *  `.spec`) e declaração (`.d.ts`). Espelha `listarArquivosTs` de
 *  `discover-network-consumers.ts` — mesmo contrato, mesma justificativa. */
function listarArquivosTs(dir: string, raiz: string = dir): string[] {
  const resultado: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminhoAbsoluto = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      resultado.push(...listarArquivosTs(caminhoAbsoluto, raiz));
      continue;
    }
    if (!entrada.isFile()) continue;
    if (!/\.tsx?$/.test(entrada.name)) continue;
    if (/\.(test|spec)\.tsx?$/.test(entrada.name)) continue;
    if (entrada.name.endsWith('.d.ts')) continue;
    resultado.push(path.relative(raiz, caminhoAbsoluto).split(path.sep).join('/'));
  }
  return resultado;
}

/** Extrai todo especificador de import/require/import() deste arquivo cujo texto
 *  bate com `MOCK_PATH_SEGMENT`. Não resolve módulos (sem `ts.Program`/
 *  `TypeChecker`) — para import estático e `require`/`import()` com literal de
 *  string direto (a forma real de TODOS os imports de `mocks/` hoje neste repo),
 *  o texto do especificador já é suficiente; nome dinâmico via variável
 *  (`require(algumaVariavel)`) fica fora, mesma fronteira declarada pelo detector
 *  irmão de rede. */
function especificadoresDeMock(sf: ts.SourceFile): string[] {
  const encontrados: string[] = [];

  function registrar(spec: string | undefined): void {
    if (spec !== undefined && MOCK_PATH_SEGMENT.test(spec)) encontrados.push(spec);
  }

  function visitar(n: ts.Node): void {
    if (ts.isImportDeclaration(n) && ts.isStringLiteralLike(n.moduleSpecifier)) {
      registrar(n.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(n) &&
      ts.isExternalModuleReference(n.moduleReference) &&
      ts.isStringLiteralLike(n.moduleReference.expression)
    ) {
      registrar(n.moduleReference.expression.text);
    } else if (ts.isCallExpression(n)) {
      const callee = n.expression;
      const ehRequire = ts.isIdentifier(callee) && callee.text === 'require';
      const ehImportDinamico = callee.kind === ts.SyntaxKind.ImportKeyword;
      const primeiroArg = n.arguments[0];
      if ((ehRequire || ehImportDinamico) && primeiroArg && ts.isStringLiteralLike(primeiroArg)) {
        registrar(primeiroArg.text);
      }
    }
    ts.forEachChild(n, visitar);
  }

  visitar(sf);
  return encontrados;
}

/**
 * Varre recursivamente `srcDir` e devolve, ordenado por `file`, todo arquivo que
 * importa de um path com segmento `mocks/` — junto dos especificadores literais
 * encontrados (para o controle positivo: prova que o detector ENXERGA import de
 * mock, não só que a lista de violadores deu vazio).
 */
export function discoverMockImporters(srcDir: string): MockImporter[] {
  const arquivos = listarArquivosTs(srcDir).sort();
  const resultado: MockImporter[] = [];

  for (const arquivo of arquivos) {
    const caminho = path.join(srcDir, arquivo);
    const texto = fs.readFileSync(caminho, 'utf-8');
    const sf = ts.createSourceFile(caminho, texto, ts.ScriptTarget.Latest, true);
    const specifiers = especificadoresDeMock(sf);
    if (specifiers.length > 0) resultado.push({ file: arquivo, specifiers });
  }

  return resultado;
}

/**
 * Regra de exceção (brief LU-10 §Escopo): só `src/mocks/**` (mocks referenciando
 * mocks entre si — ex.: `cobrancas.mock.ts` lendo a store de
 * `servicos-preco.mock.ts`) e `src/services/api/mock-adapter.ts` (o único portão
 * de entrada para fora de `mocks/`, controlado por `EXPO_PUBLIC_USE_MOCKS`) têm
 * permissão de importar de `mocks/`. Qualquer outro arquivo que apareça aqui é a
 * mesma classe de defeito do N4: IA/dado fixo entregue fora do portão que a flag
 * de ambiente controla.
 */
export function ehImportadorLegitimo(arquivoRelativo: string): boolean {
  return arquivoRelativo.startsWith('mocks/') || arquivoRelativo === 'services/api/mock-adapter.ts';
}
