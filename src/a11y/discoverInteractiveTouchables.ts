// CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — detector de lacuna de alvo de
// toque (WCAG 2.5.8/2.5.5, `touchTarget.min` em tokens.ts), regra de ouro v7:
// "inventário de cobertura escrito à mão apodrece em silêncio — o gate tem que
// derivar a lista de consumidores do código e falhar quando aparecer consumidor
// sem check". Mesmo padrão de `src/smokeCoverage/discover-network-consumers.ts`
// (TASK-81, `backend-clinica-dotnet` `TenantFilterCoverageTests.cs`, TASK-38):
// descoberta por AST, nunca lista hardcoded — qualquer `TouchableOpacity`/
// `Pressable` novo em `src/components/{primitives,layout,domain}` OU em
// `src/app/` (fix wave 2b, achado 2 — antes `src/app/` inteiro ficava fora
// da varredura, 14 tocáveis de 7 telas invisíveis) entra automaticamente na
// cobertura deste teste (`tests/touch-target-coverage.test.ts`), sem
// precisar editar este arquivo.
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
// REBINDAR EM SILÊNCIO — não "quebrar" — se a ORDEM dos touchables dentro
// do mesmo componente mudar — mesmo trade-off aceito lá).
//
// ⚠️ Fix wave 3 (achado I-4 da G2 rodada 2): este parágrafo dizia "ao custo
// de QUEBRAR" — falso, medido. Reordenar 2 touchables irmãos (recortar/
// colar blocos JSX, `tsc` limpo) NÃO derruba nada: as chaves `#1`/`#2`/`#3`
// continuam existindo, só passam a apontar para o touchable ERRADO — a
// entrada do registry de `#1` continua validando o QUE FOI `#1` antes da
// reordenação, agora medindo um elemento diferente. Reproduzido: mover o
// bloco das abas de dia (`agenda.tsx`) para ANTES do `weekNav` fez `#1`
// (antes `btn-prev-week`, `no-explicit-geometry`) e `#3` (antes `navBtn`
// do botão seguinte, `no-explicit-geometry`) trocarem de identidade com
// `day-tab-0` (`meets-min`) — classificação INVERTIDA, gate 56/56 verde.
// Aceito como trade-off (ruling do maestro, não reaberto nesta wave) — a
// alternativa (chave por posição textual/linha) é mais frágil a
// reformatação, que é mais comum que reordenação deliberada. Registrado
// como ponto cego real no bloco "Limitação" abaixo.
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
 *  ver task-CQ-08-report.md, seção "Fix wave".
 *
 *  ⚠️ Fix wave 3 (achado I-2 da G2 rodada 2, mesma classe de fraqueza do
 *  parágrafo acima, eixo novo): a lista cobria as 5 formas de
 *  `Touchable*`/`Pressable` e NENHUMA outra primitiva interativa do próprio
 *  `react-native`. `<Switch>` (`src/app/(app)/settings.tsx:119`/`:140`,
 *  medido nesta wave) é controle interativo real com alvo de toque — WCAG
 *  2.5.5 se aplica a ele tanto quanto a um botão — e ficava invisível.
 *  Mordida (G2): `<Switch style={{height:8,width:8}}>` novo em
 *  `settings.tsx` passava 56/56. `<Text onPress>` e `<Button>` do
 *  `react-native` NÃO entraram nesta lista: medido por grep (ver bloco
 *  "Limitação" no fim deste arquivo) que nenhum dos dois existe hoje no
 *  escopo varrido — decisão explícita, não omissão. */
const INTERACTIVE_TAGS = new Set([
  'TouchableOpacity',
  'Pressable',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'Switch',
]);

/** Acha o nome do componente (função nomeada, `const X = () => {}`/
 *  `function X() {}`, ou método de acesso `get`/`set`) que contém o nó dado,
 *  subindo a árvore. `'<module>'` é o valor de fallback — não observado em
 *  código real deste repo hoje, mas mantido em vez de lançar exceção, para
 *  não silenciar um bug do próprio walker atrás de uma exceção genérica.
 *
 *  ⚠️ Fix wave 3 (achado Mi-4 da G2 rodada 2): este comentário dizia que um
 *  touchable JSX solto no nível de módulo é "sintaticamente impossível em
 *  React (JSX só existe dentro de uma função)" e que o fallback seria
 *  "morto por construção" — FALSO, medido. `const X = <TouchableOpacity/>`
 *  é TSX válido (refuta a frase literalmente) e caem no mesmo fallback
 *  `React.memo(() => <TouchableOpacity/>)`, `React.forwardRef(...)`, e
 *  `class X extends React.Component { render() { return <TouchableOpacity/> } }`
 *  — as 3 primeiras são idiomas React ORDINÁRIOS, não exotismo — mais JSX
 *  dentro de um array de módulo. A DETECÇÃO continua fechando vermelho
 *  quando qualquer uma aparece (medido: 6 failed / 61 com um probe
 *  descartável exercitando as 5 formas) — não é buraco de cobertura, é
 *  identidade de componente: todas compartilham o mesmo contador
 *  `<module>#n`, então um `memo`/`forwardRef`/classe real no escopo
 *  colidiria de chave com qualquer outro na mesma situação. Nenhuma das 5
 *  formas existe hoje no escopo varrido — confirmado por
 *  `grep -rln "React\.memo\|React\.forwardRef\|extends.*Component" src/components/{primitives,layout,domain} src/app`
 *  (0 ocorrências) — mas, ao contrário do parágrafo original, isso é fato
 *  medido agora, não impossibilidade sintática. */
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

// Limitação declarada (mesmo espírito de docs/smoke-coverage-limitations.md)
// — reescrita na fix wave 2b (achado 7 da G2: este bloco garantia o que o
// código não fazia — enumerava 4 lacunas hipotéticas inexistentes e OMITIA
// a única real e grande, `src/app/` inteiro fora da varredura. Padrão que
// já apareceu 8× neste projeto, defeito de primeira classe, não estilo).
// ⚠️ Reescrita DE NOVO na fix wave 3 (achados I-2+I-4+Mi-1+Mi-2+Mi-3 da G2
// rodada 2): a versão da 2b tinha o MESMO defeito de novo, num eixo
// diferente — enumerava lacunas "em teoria, e não existe hoje" e OMITIA
// `<Switch>` (I-2, existe hoje, movida para a lista de DESCOBERTA e
// corrigida — ver `INTERACTIVE_TAGS` acima) e 4 pontos cegos que SÃO reais
// e PRESENTES agora (reordenação, porcentagem, `maxHeight`/`maxWidth`/
// `transform`, `hitSlop`), listados abaixo em vez de omitidos.
//
// ESCOPO ATUAL (pós fix wave 2b): `src/components/{primitives,layout,
// domain}` + `src/app/` inteiro, recursivo. As 2 afirmações "confirmado por
// grep" abaixo foram RE-VERIFICADAS sobre esse escopo novo nesta rodada
// (não herdadas da rodada anterior, que só tinha checado os 3 diretórios de
// componentes) — se `src/app/` crescer, re-rodar os greps antes de confiar
// nelas de novo:
//   grep -rn "Touchable.*as \|Pressable as " src/components/{primitives,layout,domain} src/app
//   grep -rln "react-native-gesture-handler" src/components/{primitives,layout,domain} src/app
//
// Este walker NÃO resolve escopo léxico. Ele detecta (1) toda tag JSX literal
// de qualquer nome em INTERACTIVE_TAGS, em qualquer profundidade, e (2) o
// único padrão de alias condicional observado hoje no código real deste repo
// (`KCChip.tsx`). O que ficaria invisível, em teoria, e não existe hoje
// (nem em `primitives`/`layout`/`domain`, nem em `src/app/`):
//   - Qualquer um dos 6 tocáveis de INTERACTIVE_TAGS importado com ALIAS de
//     import (`import { Pressable as Btn } from 'react-native'`) — a tag JSX
//     seria `<Btn>`, não reconhecida. Confirmado por grep (ver acima) que
//     não existe hoje no escopo inteiro.
//   - Um tocável de BIBLIOTECA TERCEIRA — o candidato mais plausível deste
//     projeto é `react-native-gesture-handler` (dependência real, usada
//     internamente por `@react-navigation/drawer`), que exporta seu próprio
//     `TouchableOpacity`/`Pressable`/`RectButton`/`BorderlessButton` com
//     geometria própria. Confirmado por grep (ver acima) que NENHUM arquivo
//     do escopo inteiro importa de `'react-native-gesture-handler'` hoje —
//     todo `TouchableOpacity`/`Pressable` vem de `'react-native'` puro. Se
//     algum consumir esse pacote depois, a tag JSX (`RectButton` etc.) não
//     está em INTERACTIVE_TAGS e ficaria invisível.
//   - Um componente cujo alias condicional (`cond ? Pressable : View`) é
//     declarado dentro de uma função, e OUTRA função do MESMO arquivo declara
//     uma variável de mesmo nome com sentido diferente (não-interativo) — a
//     varredura de arquivo inteiro marcaria as duas como interativas.
// Se qualquer um dos 3 aparecer, este arquivo precisa de extensão antes de
// confiar na cobertura.
//
// PONTOS CEGOS REAIS E PRESENTES HOJE (fix wave 3, diferente da lista acima
// — estes NÃO são hipóteses, existem no mecanismo atual e a G2 rodada 2
// mediu os 4 por mutação; nenhum silencioso o suficiente para justificar
// correção nesta wave — registrados para não virarem a mesma "documentação
// que garante o que o código não faz" que já reescreveu este bloco 2×):
//   - REORDENAÇÃO (I-4): a chave `#n` é posicional (ver comentário no topo
//     deste arquivo). Reordenar touchables irmãos REBINDA as entradas do
//     registry em silêncio, podendo INVERTER a classificação — medido:
//     mover as abas de dia para antes do `weekNav` em `agenda.tsx` trocou o
//     que `#1`/`#3` mediam, com o gate 56/56 verde. Aceito como trade-off
//     (chave por linha seria mais frágil a reformatação, que é mais comum).
//   - GEOMETRIA EM PORCENTAGEM (Mi-2): `maiorDeclarado()` (registry) exige
//     `typeof === 'number'` — `height: '12%'` é invisível, a entrada cai em
//     `no-explicit-geometry` mesmo que a % resolva bem abaixo de 44px em
//     tela real. Medido: `navBtn` com `height:'12%', width:'12%'` mantém
//     `tsc --noEmit` limpo e a suíte 56/56 verde. Direção inofensiva para
//     `meets-min` (uma % nunca vira falso `meets-min`, porque
//     `expect(...).toBeDefined()` reprovaria), mas esvazia a garantia de
//     "ausência real" que `no-explicit-geometry` promete.
//   - `maxHeight`/`maxWidth`/`transform: scale` (Mi-1): `maiorDeclarado()`
//     só lê `height`/`minHeight` e `width`/`minWidth` — um alvo `meets-min`
//     de 44×44 CLAMPADO por `maxHeight:20, maxWidth:20` ou encolhido por
//     `transform:[{scale:0.4}]` continua passando. Medido: os 3 aplicados
//     juntos no `iconBtn` (44×44) do `AppHeader` mantêm as 2 entradas
//     `meets-min` e nada na suíte pega (coverage + AppHeader + webInteraction
//     todos verdes).
//   - `hitSlop` (Mi-3): invisível pelo mesmo motivo — `maiorDeclarado()` não
//     olha essa prop. É justamente o remédio mais barato para os 21
//     `no-explicit-geometry` hoje (aumentar área de toque sem mudar
//     layout) — registrado ANTES de algum follow-up usá-lo: medido que
//     `hitSlop={{top:20,bottom:20,left:20,right:20}}` no botão de logout
//     (o "pior caso" do registry) deixa a suíte 72/72 verde SEM a `reason`
//     da entrada mudar — ela continuaria dizendo "sem margem de toque
//     nenhuma" depois do gap corrigido de verdade.
//
// LIMITAÇÃO DE VERIFICAÇÃO (distinta da de DESCOBERTA acima — vale para o
// registry, `tests/touchTargetRegistry.tsx`, não para este walker): o
// ambiente de teste (`react-test-renderer`, via `@testing-library/react-
// native`) NÃO computa layout Yoga real. Por isso a categoria
// `no-explicit-geometry` significa estritamente "não afirmamos
// conformidade" — NUNCA "está conforme". Um touchable com só `padding`+
// ícone (ex.: `navBtn` de `agenda.tsx`, `padding:4` sobre ícone de 20px,
// ≈28px reais — abaixo do mínimo, mas SEM height/width EXPLÍCITOS no
// estilo) fica classificado como `no-explicit-geometry`, não como
// `allowlisted-below-min`: a categoria `allowlisted-below-min` exige
// geometria EXPLÍCITA (height/minHeight/width/minWidth numéricos) abaixo do
// mínimo, comprovável por render mesmo sem Yoga — o que padding sozinho não
// permite provar. Achado da fix wave 2b: nenhum dos 14 tocáveis novos de
// `src/app/` tem geometria explícita abaixo de 44px. `allowlisted-below-min`
// continua sem nenhuma entrada real neste repo — ver task-CQ-08-report.md,
// seção "Fix wave 2b", para o detalhe completo (a suposição inicial do
// maestro era que `src/app/` seria o primeiro uso real dessa categoria; a
// classificação por render, não por estimativa visual, não confirmou isso).
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
