// Fix wave pós-G2 da task CQ-03 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — item 2.
//
// O G2 provou por mutação que renomear o `name=` de um `<Drawer.Screen>` em
// `src/app/(app)/_layout.tsx` quebra o realce do item ativo do `NavDrawer` EM
// SILÊNCIO: `tsc` continua verde (o prop `name` do `Drawer.Screen` do
// `expo-router/drawer` é `string` solto, não amarrado a `ROUTES.app` nem ao
// arquivo de rota real) e a suíte antiga não tinha nenhum teste que comparasse
// os dois lados. `NavDrawer.tsx` já tinha uma trava de tipo (`ScreenRouteName`)
// prendendo `NAV_ITEMS[].name` a `keyof typeof ROUTES.app` — mas isso só protege
// UM dos dois lados do acoplamento. O outro lado (`_layout.tsx`) não tem, e não
// pode ter, tipo nenhum amarrado a `ROUTES.app`: `Drawer.Screen` é um componente
// de terceiro (`expo-router/drawer`), seu prop `name` não é genérico sobre nada
// deste app.
//
// Regra de ouro v7 do projeto: inventário escrito à mão apodrece em silêncio —
// o gate tem que DERIVAR a lista do código, não confiar em lista paralela
// mantida por lembrança. Este módulo deriva a lista de nomes de
// `<Drawer.Screen name="...">` diretamente da AST de `_layout.tsx` (mesmo
// mecanismo de `src/smokeCoverage/discover-network-consumers.ts`: `typescript`
// como parser, não regex sobre o texto) — para que o teste em
// `tests/NavDrawer.drawerScreenSync.test.ts` possa comparar essa lista contra
// `NAV_ITEMS` de `NavDrawer.tsx` e falhar quando divergirem.
//
// Vive em `src/` (não em `tests/`) de propósito: `tsconfig.json` exclui
// `tests/` e o script `lint` só varre `src` (`package.json:12`) — o mesmo
// buraco que a TASK-81 (FIX_7) achou e corrigiu no `smokeCoverage`. Colocar a
// lógica de derivação aqui garante que ela própria fica sob `tsc --noEmit` e
// `eslint src`.
import * as fs from 'fs';
import * as ts from 'typescript';

/** Um `<Drawer.Screen name="...">` encontrado na AST, com a linha de origem (para mensagem de diagnóstico). */
export interface DrawerScreenNameOcorrencia {
  nome: string;
  linha: number;
}

function tagEhDrawerScreen(tagName: ts.JsxTagNameExpression): boolean {
  return (
    ts.isPropertyAccessExpression(tagName) &&
    ts.isIdentifier(tagName.expression) &&
    tagName.expression.text === 'Drawer' &&
    ts.isIdentifier(tagName.name) &&
    tagName.name.text === 'Screen'
  );
}

function extrairNomeLiteral(attrs: ts.JsxAttributes): string | null {
  for (const attr of attrs.properties) {
    if (
      ts.isJsxAttribute(attr) &&
      ts.isIdentifier(attr.name) &&
      attr.name.text === 'name' &&
      attr.initializer &&
      ts.isStringLiteral(attr.initializer)
    ) {
      return attr.initializer.text;
    }
  }
  return null;
}

/**
 * Varre um arquivo de layout (ex.: `src/app/(app)/_layout.tsx`) e devolve, na
 * ordem em que aparecem no JSX, o `name=` literal de cada `<Drawer.Screen>`
 * encontrado — self-closing (`<Drawer.Screen name="x" />`) e com filhos
 * (`<Drawer.Screen name="x">...</Drawer.Screen>`), os dois cobertos.
 *
 * `name=` dinâmico (não `StringLiteral` — ex.: `name={variavel}`) é
 * deliberadamente ignorado: não há como comparar valor não-estático contra
 * `NAV_ITEMS` sem executar o módulo, e nenhum `Drawer.Screen` deste layout usa
 * essa forma hoje. Se isso mudar, o teste de sanidade de contagem mínima
 * (`discoverDrawerScreenNames(...).length` bater com o número de
 * `<Drawer.Screen` no arquivo) pega a lacuna.
 */
export function discoverDrawerScreenNames(caminhoLayout: string): DrawerScreenNameOcorrencia[] {
  const texto = fs.readFileSync(caminhoLayout, 'utf-8');
  const sf = ts.createSourceFile(caminhoLayout, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const ocorrencias: DrawerScreenNameOcorrencia[] = [];

  function linhaDe(node: ts.Node): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxSelfClosingElement(node) && tagEhDrawerScreen(node.tagName)) {
      const nome = extrairNomeLiteral(node.attributes);
      if (nome !== null) {
        ocorrencias.push({ nome, linha: linhaDe(node) });
      }
    } else if (ts.isJsxElement(node) && tagEhDrawerScreen(node.openingElement.tagName)) {
      const nome = extrairNomeLiteral(node.openingElement.attributes);
      if (nome !== null) {
        ocorrencias.push({ nome, linha: linhaDe(node) });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return ocorrencias;
}
