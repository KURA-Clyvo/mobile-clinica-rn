// CQ-16 — detector automatizado (Camada B, roda em todo `npm test`).
//
// Contexto: `expo export --platform web` gerava um bundle com `import.meta`
// fora de módulo (o HTML carrega o bundle como <script defer>, sem
// type="module" — decisão hardcoded do @expo/cli, ver comentário em
// babel.config.js) e o browser real quebrava com
// `SyntaxError: Cannot use 'import.meta' outside a module`, tela em branco.
// Fix: `babel.config.js` novo, com
// `presets: [['babel-preset-expo', { web: { unstable_transformImportMeta: true } }]]`.
//
// Este teste NÃO roda `expo export` (isso já acontece 1x por push no CI —
// ver ".github/workflows/ci.yml", passo "Web export (prova de build da
// plataforma web)", e de novo em ".github/workflows/*" via smoke E o teste
// de shell em "scripts/check-web-bundle-import-meta.sh", que inspeciona o
// bundle real gerado por esse passo — ver Camada A). Rodar outro export
// aqui duplicaria ~60-90s no mesmo run de CI sem ganhar fidelidade.
//
// Em vez disso, este teste chama o MESMO transformador Babel que o Metro
// usa de verdade para compilar `zustand/esm/middleware.mjs` — o arquivo que
// causou o defeito original — via `@expo/metro-config/babel-transformer`
// (`transformer.transform({ filename, src, options, plugins })`). É o ponto
// de entrada mais fiel disponível sem subir o bundler Metro inteiro: ele
// resolve `babel.config.js` da raiz do projeto (via `loadBabelConfig`) e
// constrói o objeto `caller` (`getBabelCaller`) do mesmo jeito que o Metro
// constrói em produção — este teste não monta esse objeto à mão.
//
// PONTO CEGO DECLARADO: este teste é cego a uma mudança na FORMA como o
// Metro monta o objeto `options`/`caller` de bundling real (isso não é
// exercitado aqui — usamos um objeto `options` mínimo, não o que o
// `expo-router`/`@expo/cli` de fato passa em um export real). A Camada A
// (script de shell sobre o bundle exportado de verdade, no CI) cobre esse
// ponto cego: ela inspeciona a saída real do `expo export`, não uma
// simulação do transformador.
//
// `transformer.transform(...)` devolve `{ ast, metadata }` (não `code`) —
// o `babel-transformer.js` do `@expo/metro-config` sempre pede
// `ast: true, code: false` ao babel (comentário no arquivo: Metro precisa
// do AST para parsing Hermes). Duas checagens complementares sobre o
// resultado, para não depender só de uma:
//   1. Nenhum nó `MetaProperty` com `meta.name === 'import'` sobra na AST
//      (checagem estrutural, imune a diferença de formatação/nome de
//      variável que um grep em código gerado teria).
//   2. O código gerado a partir da AST (via `@babel/generator`, só para
//      esta segunda checagem) não contém a substring `import.meta` nem
//      deixa de conter `ExpoImportMetaRegistry` — replica o que o grep da
//      Camada A faz, mas sobre a saída do transformador isolado.
//
// ARMADILHA DE CACHE (seção 3 do relatório desta task): o cache do Metro em
// disco NÃO está em jogo aqui — chamamos o transformador diretamente, sem
// passar pelo bundler, então não há cache a limpar. Isso só importa para
// quem rodar `expo export` manualmente (Camada A / verificação manual).

import fs from 'fs';
import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const transformer = require('@expo/metro-config/babel-transformer');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const traverse = require('@babel/traverse').default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const generate = require('@babel/generator').default;

describe('babel.config.js — import.meta não sobrevive à transformação web (CQ-16)', () => {
  it('zustand/esm/middleware.mjs, transformado para a plataforma web, não contém import.meta', () => {
    const projectRoot = path.resolve(__dirname, '..');
    const zustandPkgJson = require.resolve('zustand/package.json');
    // `require.resolve('zustand/esm/middleware.mjs')` falha em Node puro: o
    // "exports" map do zustand só resolve esse arquivo sob a condição
    // "import", que o `require()` do CommonJS não pede. Resolvemos o
    // caminho físico direto — é o mesmo arquivo que o resolvedor de
    // "package exports" do Metro escolhe na plataforma web (ver seção 1.3
    // do relatório desta task).
    const filename = path.join(path.dirname(zustandPkgJson), 'esm', 'middleware.mjs');
    const src = fs.readFileSync(filename, 'utf8');
    expect(src).toContain('import.meta');

    const options = {
      platform: 'web',
      dev: false,
      projectRoot,
      customTransformOptions: {},
      type: 'module',
      enableBabelRCLookup: true,
      experimentalImportSupport: false,
      hermesParser: false,
      minify: false,
    };

    const result = transformer.transform({ filename, src, options, plugins: [] });

    let metaImportCount = 0;
    traverse(result.ast, {
      MetaProperty(nodePath: { node: { meta: { name: string } } }) {
        if (nodePath.node.meta.name === 'import') {
          metaImportCount += 1;
        }
      },
    });
    expect(metaImportCount).toBe(0);

    const { code } = generate(result.ast, {}, src);
    expect(code).not.toContain('import.meta');
    expect(code).toContain('ExpoImportMetaRegistry');
  });
});
