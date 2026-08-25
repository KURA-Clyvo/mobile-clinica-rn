// CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — detector de lacuna de alvo de
// toque (WCAG 2.5.8/2.5.5, `touchTarget.min` em tokens.ts), regra de ouro v7:
// "inventário de cobertura escrito à mão apodrece em silêncio — o gate tem que
// derivar a lista de consumidores do código e falhar quando aparecer consumidor
// sem check". Mesmo padrão de `src/smokeCoverage/discover-network-consumers.ts`
// (TASK-81, `backend-clinica-dotnet` `TenantFilterCoverageTests.cs`, TASK-38):
// descoberta por AST, nunca lista hardcoded — qualquer `TouchableOpacity`/
// `Pressable` novo em `src/components/{primitives,layout,domain}` entra
// automaticamente na cobertura deste teste (`tests/touch-target-coverage.test.ts`),
// sem precisar editar este arquivo.
//
// DESENHO: bem mais simples que o walker de rede (que precisa resolver
// indireção arbitrária de um valor de client HTTP através de imports/aliases/
// destructuring). Aqui o sinal é sintático na maior parte dos casos — o alvo
// de toque É o próprio elemento JSX `<TouchableOpacity>`/`<Pressable>`, não
// precisa de resolução de escopo léxico para achar quem "toca rede". A única
// indireção real observada no código deste repo é `KCChip.tsx`
// (`const Container = onPress ? TouchableOpacity : View`) — tratada como caso
// especial abaixo (`coletarAliasesCondicionais`), documentada, não generalizada
// para resolução de escopo completa (ver "Limitação" no fim deste arquivo).
//
// Cada ocorrência de touchable dentro de um componente vira uma chave estável
// `"<arquivo>::<componente>#<n>"` (`n` = ordem de aparição no arquivo,
// 1-based) — igual ao princípio de `key` de `discover-network-consumers.ts`,
// mas sem o fallback de linha (mais estável a reformatação, ao custo de
// quebrar se a ORDEM dos touchables dentro do mesmo componente mudar — mesmo
// trade-off aceito lá).
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export interface TouchableConsumer {
  /** Chave estável usada no registry de cobertura: "<arquivo>::<componente>#<n>". */
  key: string;
  file: string;
  component: string;
  occurrence: number;
}

/** Tags JSX que, sozinhas, já são o alvo de toque — não precisam de resolução
 *  de escopo porque a interatividade é da PRÓPRIA tag, não de uma chamada que
 *  ela faz. `Link` do expo-router NÃO entra aqui de propósito: quando usado
 *  com `asChild`, o filho real (`Pressable`/`TouchableOpacity`/etc.) já
 *  aparece como tag JSX própria dentro dele — é esse filho, não o `<Link>`,
 *  que carrega a geometria (ver `NavDrawer.tsx`). Um `<Link>` sem `asChild`
 *  renderiza `<a>` nativo do react-native-web, fora do escopo de geometria
 *  declarada por `StyleSheet` que este detector verifica.
 *
 *  ⚠️ Fix wave (achado do maestro no G1, não visto pela rodada original de
 *  mutação): a lista original só tinha `TouchableOpacity`/`Pressable` — os
 *  outros 3 tocáveis que o próprio `react-native` exporta
 *  (`TouchableHighlight`, `TouchableWithoutFeedback`,
 *  `TouchableNativeFeedback` — nomes confirmados em
 *  `node_modules/react-native/types/index.d.ts:97-101`, reexportados de
 *  `Libraries/Components/Touchable/*.d.ts`) ficavam INVISÍVEIS ao walker,
 *  mesma forma de fraqueza do `check:no-ocean` que o brief da CQ-08 citou
 *  como exemplo a não repetir (guarda que pega só uma forma da coisa e
 *  deixa passar as outras em silêncio). Mordida: um `TouchableHighlight`
 *  com `height: 12, width: 12` inserido em `KCBadge.tsx` passava por
 *  `tsc` limpo e pela suíte de cobertura 28/28 verde antes desta correção —
 *  ver task-CQ-08-report.md, seção "Fix wave". */
const INTERACTIVE_TAGS = new Set([
  'TouchableOpacity',
  'Pressable',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
]);

/** Acha o nome do componente (função nomeada, `const X = () => {}`/
 *  `function X() {}`, ou método de acesso `get`/`set`) que contém o nó dado,
 *  subindo a árvore. `'<module>'` é o valor de fallback — não observado em
 *  código real deste repo hoje (todo touchable descoberto vive dentro de uma
 *  função componente), mas mantido em vez de lançar exceção: um touchable
 *  JSX solto no nível de módulo é sintaticamente impossível em React (JSX só
 *  existe dentro de uma função), então este fallback é morto por construção
 *  — documentado, não removido, para não silenciar um bug do próprio walker
 *  atrás de uma exceção genérica. */
function acharComponenteDono(node: ts.Node): string {
  let atual: ts.Node | undefined = node.parent;
  while (atual) {
    if (ts.isFunctionDeclaration(atual) && atual.name) {
      return atual.name.text;
    }
    if (
      ts.isVariableDeclaration(atual) &&
      ts.isIdentifier(atual.name) &&
      atual.initializer &&
      (ts.isArrowFunction(atual.initializer) || ts.isFunctionExpression(atual.initializer))
    ) {
      return atual.name.text;
    }
    if (ts.isFunctionExpression(atual) && atual.name) {
      return atual.name.text;
    }
    atual = atual.parent;
  }
  return '<module>';
}

/** Caso especial documentado: `const X = cond ? TouchableOpacity : Y` (ou
 *  `Y : TouchableOpacity`/`Pressable` em qualquer um dos 2 ramos) — o
 *  identificador `X` passa a contar como touchable quando usado como tag JSX.
 *  Varredura de ARQUIVO INTEIRO (não por escopo léxico) de propósito: a única
 *  ocorrência real hoje (`KCChip.tsx::Container`) é módulo-de-função único,
 *  sem 2 componentes irmãos declarando o mesmo nome com sentidos diferentes
 *  no mesmo arquivo — ver "Limitação" no fim deste arquivo para o que isso
 *  deixaria passar em teoria. */
function coletarAliasesCondicionais(sourceFile: ts.SourceFile): Set<string> {
  const aliases = new Set<string>();
  function ramoEhInterativo(expr: ts.Expression): boolean {
    return ts.isIdentifier(expr) && INTERACTIVE_TAGS.has(expr.text);
  }
  function visitar(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isConditionalExpression(node.initializer)
    ) {
      const { whenTrue, whenFalse } = node.initializer;
      if (ramoEhInterativo(whenTrue) || ramoEhInterativo(whenFalse)) {
        aliases.add(node.name.text);
      }
    }
    ts.forEachChild(node, visitar);
  }
  visitar(sourceFile);
  return aliases;
}

function descobrirNoArquivo(caminhoCompleto: string, nomeArquivo: string): TouchableConsumer[] {
  const conteudo = fs.readFileSync(caminhoCompleto, 'utf-8');
  const sourceFile = ts.createSourceFile(
    nomeArquivo,
    conteudo,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const aliasesCondicionais = coletarAliasesCondicionais(sourceFile);
  const contadoresPorComponente = new Map<string, number>();
  const encontrados: TouchableConsumer[] = [];

  function tagNameDoElemento(node: ts.Node): string | undefined {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName;
      if (ts.isIdentifier(tag)) return tag.text;
      // G2 (fix wave 2): <RN.TouchableOpacity> — import de namespace
      // (`import * as RN from 'react-native'`). `tagName` aqui é um
      // PropertyAccessExpression (`RN.TouchableOpacity`); o segmento que
      // importa é o ÚLTIMO (`.name`), mesmo princípio de
      // `discover-network-consumers.ts` para cadeia de propriedade
      // (`ns.apiClient` resolve pelo último segmento). Sem isso, um
      // `TouchableOpacity` importado por namespace era invisível — mesma
      // classe de defeito do `INTERACTIVE_TAGS` incompleto (fix wave 1),
      // eixo novo (forma de REFERENCIAR o componente, não nome do
      // componente em si).
      if (ts.isPropertyAccessExpression(tag)) return tag.name.text;
    }
    return undefined;
  }

  function visitar(node: ts.Node) {
    const tagName = tagNameDoElemento(node);
    if (tagName && (INTERACTIVE_TAGS.has(tagName) || aliasesCondicionais.has(tagName))) {
      const componente = acharComponenteDono(node);
      const n = (contadoresPorComponente.get(componente) ?? 0) + 1;
      contadoresPorComponente.set(componente, n);
      encontrados.push({
        key: `${nomeArquivo}::${componente}#${n}`,
        file: nomeArquivo,
        component: componente,
        occurrence: n,
      });
    }
    ts.forEachChild(node, visitar);
  }
  visitar(sourceFile);

  return encontrados;
}

/** Lista recursivamente todo `.tsx` sob `dir`, ordem estável (sort no fim).
 *  G2 (fix wave 2): a versão original só varria o TOPO de cada diretório —
 *  correto para `primitives`/`layout`/`domain` (sem subpasta hoje), mas
 *  `src/app/` (adicionado nesta fix wave) TEM subpastas reais
 *  (`(app)/pacientes/`, `(app)/consulta/`, etc.) e ficaria parcialmente
 *  invisível sem recursão. */
function listarTsxRecursivo(dir: string): string[] {
  const resultado: string[] = [];
  const entradas = fs.readdirSync(dir, { withFileTypes: true });
  for (const entrada of entradas) {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      resultado.push(...listarTsxRecursivo(caminho));
    } else if (entrada.isFile() && entrada.name.endsWith('.tsx')) {
      resultado.push(caminho);
    }
  }
  return resultado;
}

/** Varre `.tsx` recursivamente sob cada diretório em `dirs`. A chave usa o
 *  caminho RELATIVO ao diretório escaneado (não só o basename) — necessário
 *  desde que `src/app/` entrou na varredura: `src/app/index.tsx` e
 *  `src/app/(app)/pacientes/index.tsx` têm o MESMO basename
 *  (`index.tsx`), e colidiriam numa chave baseada só em nome de arquivo.
 *  Para `primitives`/`layout`/`domain` (sem subpasta), o caminho relativo
 *  já É o basename — nenhuma chave existente muda. */
export function discoverInteractiveTouchables(dirs: string[]): TouchableConsumer[] {
  const resultado: TouchableConsumer[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const arquivos = listarTsxRecursivo(dir).sort();
    for (const caminhoCompleto of arquivos) {
      const nomeRelativo = path.relative(dir, caminhoCompleto).split(path.sep).join('/');
      resultado.push(...descobrirNoArquivo(caminhoCompleto, nomeRelativo));
    }
  }
  return resultado;
}

// Limitação declarada (mesmo espírito de docs/smoke-coverage-limitations.md):
// este walker NÃO resolve escopo léxico. Ele detecta (1) toda tag JSX literal
// de qualquer nome em INTERACTIVE_TAGS, em qualquer profundidade, e (2) o
// único padrão de alias condicional observado hoje no código real deste repo
// (`KCChip.tsx`). O que ficaria invisível, em teoria, e não existe hoje:
//   - Qualquer um dos 5 tocáveis de INTERACTIVE_TAGS importado com ALIAS de
//     import (`import { Pressable as Btn } from 'react-native'`) — a tag JSX
//     seria `<Btn>`, não reconhecida. Confirmado por grep que não existe
//     hoje em `primitives`/`layout`/`domain` (nenhuma ocorrência de
//     "TouchableXxx as" nem "Pressable as").
//   - Um tocável de BIBLIOTECA TERCEIRA — o candidato mais plausível deste
//     projeto é `react-native-gesture-handler` (dependência real, usada
//     internamente por `@react-navigation/drawer`), que exporta seu próprio
//     `TouchableOpacity`/`Pressable`/`RectButton`/`BorderlessButton` com
//     geometria própria. Confirmado por grep que NENHUM arquivo de
//     `primitives`/`layout`/`domain` importa de
//     `'react-native-gesture-handler'` hoje — todo `TouchableOpacity`/
//     `Pressable` destes 3 diretórios vem de `'react-native'` puro. Se
//     algum consumir esse pacote depois, a tag JSX (`RectButton` etc.) não
//     está em INTERACTIVE_TAGS e ficaria invisível.
//   - Um componente cujo alias condicional (`cond ? Pressable : View`) é
//     declarado dentro de uma função, e OUTRA função do MESMO arquivo declara
//     uma variável de mesmo nome com sentido diferente (não-interativo) — a
//     varredura de arquivo inteiro marcaria as duas como interativas.
//   - Subpastas dentro de `primitives`/`layout`/`domain` (a varredura não é
//     recursiva) — nenhuma existe hoje nesses 3 diretórios.
// Nenhum dos 4 apareceu em código real deste repo (conferido por leitura +
// grep de todos os arquivos de `primitives`/`layout`/`domain` nesta
// rodada — não só herdado da rodada anterior). Se aparecer, este arquivo
// precisa de extensão antes de confiar na cobertura.
//
// ⚠️ Histórico: a lista INTERACTIVE_TAGS original (rodada de implementação)
// cobria só `TouchableOpacity`/`Pressable` — 2 das 5 formas REAIS que o
// próprio `react-native` exporta (`TouchableHighlight`,
// `TouchableWithoutFeedback`, `TouchableNativeFeedback` ficavam de fora,
// não porque fossem exóticas, mas porque a rodada de mutação original nunca
// testou contra elas). O maestro achou isso no G1 com um `TouchableHighlight`
// de `height:12,width:12` em `KCBadge.tsx` — passava por `tsc` limpo e pela
// suíte de cobertura 28/28 verde. Ver task-CQ-08-report.md, seção "Fix wave",
// para a mordida completa (vermelho→verde) desta correção.
