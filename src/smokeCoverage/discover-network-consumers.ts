// Espelho exato de mobile-tutor-rn/src/smokeCoverage/discover-network-consumers.ts
// (repos separados, sem forma de compartilhar módulo entre eles — duplicado de
// propósito, não por descuido).
//
// TASK-81 (KURA_BACKLOG_FIX_7), reescrito na rodada de fix 1 depois de reprovação G2
// (`task-81-review.md`) — o walker original (versão 1) enumerava FUNÇÕES EXPORTADAS
// no escopo de módulo de `*.service.ts` topo-de-pasta e tentava adivinhar quais
// faziam rede. Isso é o mesmo erro que a regra de ouro v7 existe para proibir, uma
// camada abaixo: um inventário de "formas de função que eu lembrei de reconhecer" é
// tão frágil quanto o inventário manual de checks que originou a v7. O revisor G2
// provou empiricamente: 7 de 8 formas plausíveis de indireção (wrapper interno,
// alias de import, método de classe, propriedade de objeto literal, re-export
// separado, arquivo fora do glob `*.service.ts`, subpasta) eram invisíveis, sem
// quebrar teste nenhum.
//
// DESENHO (v2): em vez de "enumerar funções exportadas e adivinhar quais fazem
// rede", **enumera os pontos onde a rede é de fato tocada** — toda CallExpression
// cujo objeto resolve para um dos clients HTTP reais deste app (`apiClient`/
// `lunaClient`, os 2 axios instances de `api/client.ts` — a fronteira que
// `resolveMock()` intercepta) ou para `File.downloadFileAsync` (expo-file-system,
// usado pelo download binário de receituário) — e SÓ DEPOIS deriva, subindo a
// árvore a partir de cada chamada, qual função a contém. Um consumidor não pode
// fazer uma chamada de rede sem que ela apareça como CallExpression na AST — essa é
// a superfície mínima que não tem como ser burlada só trocando a FORMA da função que
// a envolve (export default, método de classe, propriedade de objeto, wrapper
// indireto de 1 nível...). O invariante não é "toda função exportada com nome tal",
// é "toda chamada de rede tem uma função-mãe, não importa a forma dela".
//
// REVISÃO (v3, G2 rodada 2, `task-81-review-rodada2.md`): a v2 resolvia o objeto de
// uma chamada por um MAPA PLANO de arquivo inteiro ("identificador → nome canônico"),
// sem noção de escopo léxico. Isso deixava 2 buracos:
//   - Ataque X (Critical): `const { get } = apiClient; get('/rota')` — a chamada
//     final é um IDENTIFICADOR SOLTO (`get(...)`), não `objeto.metodo(...)`, então
//     nunca batia em `extrairObjetoEPropriedade` (que só reconhece PropertyAccess/
//     ElementAccess como callee). Invisível, zero sinal.
//   - Falso positivo (Minor): `resolverObjetoDaChamada` caía num fallback de TEXTO
//     CRU (`aliasParaCanonico.get(texto) ?? texto`) quando não havia import nenhum
//     — uma variável LOCAL chamada `apiClient`, sem qualquer import, era tratada
//     como o client real só por coincidência de nome.
// A v3 substitui o mapa plano por uma PILHA DE ESCOPOS LÉXICOS real (um escopo novo
// por `Block` — cobre corpo de função com chaves, if/for/while/try aninhados — mais
// um escopo raiz para o nível de módulo), com 2 tipos de vínculo por identificador:
//   - 'objeto': o identificador É (direta ou transitivamente) um dos clients
//     canônicos (import direto, alias de import, `const x = apiClient`).
//   - 'membro': o identificador é um MÉTODO DESESTRUTURADO de um client canônico
//     (`const { get } = apiClient` → 'get' vira vínculo membro{objeto:'apiClient',
//     propriedade:'get'}). Fecha o ataque X de forma geral — qualquer propriedade
//     desestruturada de qualquer client canônico, em qualquer escopo (módulo ou
//     dentro de função), não só o caso específico `{ get }`.
// A resolução por escopo (busca da pilha de dentro pra fora, parando no primeiro
// vínculo encontrado) é o que fecha o falso positivo de brinde: uma variável local
// `apiClient` SEM import correspondente nunca ganha vínculo 'objeto' (não há mais
// fallback de texto cru — só vira vínculo se houver import real ou cadeia de
// `const` que remonte a um import real), e sombreamento de nome entre 2 FUNÇÕES
// IRMÃS, cada uma com seu próprio escopo, é resolvido corretamente (não vazam vínculo
// entre si porque cada uma só enxerga o escopo pai por busca explícita, não por um
// mapa global compartilhado). ⚠️ Esta frase, na sua forma original, foi cobrada de
// overclaim pelo G2 rodada 3 (Ataque D, ver INCREMENTO abaixo) — era verdadeira para
// sombra entre irmãos, mas não cobria sombra de uma redeclaração LOCAL do mesmo nome
// dentro da MESMA função; o incremento fechou esse caso também, mas a lição
// permanece: descrever a prova que sustenta a frase, não generalizar além dela.
//
// INCREMENTO pós-G2 rodada 3 (`task-81-review-rodada3.md`) — 4 achados sobre a v3,
// aprovada com ressalva de que não fossem parqueados. Mesma pilha de escopos, sem
// redesenho:
//   - Ataques A/B (Critical): `resolverExpressaoParaCanonico` não reconhecia
//     `ConditionalExpression` (`cond ? lunaClient : apiClient`) nem `BinaryExpression`
//     com `??` (`clienteInjetado ?? apiClient`) como fonte de um client — ambos
//     escapavam por completo. Adicionados como mais 2 `case`s da mesma função
//     (resolve os 2 ramos, qualquer um que resolva para canônico basta), mais
//     desembrulho de `ParenthesizedExpression` (necessário porque `(cond ? a :
//     b).metodo(...)` chega com o ternário ENVOLTO em parênteses como objeto da
//     chamada).
//   - Ataque C (Important, julgamento do incremento — não obrigatório, fechado):
//     `let cliente;` sem inicializador, atribuído depois por `=` solto (fora de
//     `VariableStatement`) dentro de `if`/`else`, nunca virava vínculo. Fechado com 2
//     peças: (1) `let x;` sem inicializador agora vira vínculo 'bloqueado' já na
//     declaração — dá um ALVO na pilha de escopos; (2) `processarAtribuicaoSolta`,
//     nova função chamada para todo `BinaryExpression` com operador `=`, acha (via
//     `encontrarEscopoDono`) o escopo ANCESTRAL onde o nome já está declarado e MUTA
//     o vínculo lá — é isso que faz o valor atribuído dentro de um bloco aninhado
//     (`if`/`else`) ficar visível depois, no escopo da função onde foi declarado.
//     ⚠️ Esta peça, na sua forma original, foi cobrada de falso NEGATIVO pela revisão
//     seguinte (`task-81-incremento-review.md`, Critical-1): a mutação era
//     incondicional, então "última atribuição visitada EM ORDEM DE TEXTO" vencia —
//     não "o ramo que executaria em runtime". `if (real) cliente = apiClient; else
//     cliente = { fake };` perdia o vínculo 'objeto' porque o `else`, visitado
//     depois no texto, escrevia 'bloqueado' por cima. Corrigido na rodada de fix 1
//     sobre o incremento com WRITE-ONCE: um vínculo POSITIVO ('objeto'/'membro') não
//     é mais sobrescrito por uma atribuição solta subsequente — só um vínculo NÃO
//     positivo pode. Ver o comentário de `processarAtribuicaoSolta` e
//     `docs/smoke-coverage-limitations.md` para a prova e a consequência aceita
//     (superinclusão deliberada de um caso: nome reatribuído de real para inofensivo
//     DEPOIS de já vinculado permanece marcado — falso positivo, nunca negativo).
//   - Ataque D (Important, OBRIGATÓRIO): uma redeclaração LOCAL do mesmo nome de um
//     client canônico, com valor não-resolvível (`const apiClient = { get: ... }`
//     dentro de uma função, com o import real presente no arquivo), não escrevia
//     NADA no Map do escopo da função — a busca de escopo não encontrava sombra ali
//     e subia para o escopo pai, onde o import real ainda resolvia, produzindo falso
//     positivo (função marcada como consumidora de rede sem tocar rede de verdade).
//     Fechado introduzindo um 3º tipo de vínculo, 'bloqueado': toda declaração local
//     (identificador OU nome de destructuring) cujo inicializador não resolve para
//     nada rastreável agora escreve 'bloqueado' em vez de omitir — a busca de escopo
//     já para no primeiro vínculo que encontra, de QUALQUER tipo, então 'bloqueado'
//     sombreia corretamente sem nunca contar como toque de rede positivo.
// Ver `docs/smoke-coverage-limitations.md` para a prova de mutação de cada um (antes/
// depois, nos 2 apps) e a fronteira atualizada.
//
// Também fecha, na mesma rodada (`task-81-review-rodada2.md` §1):
//   - Ataque Y (Important): getter/setter de classe (`get x() { return
//     apiClient.get(...); }`) não era reconhecido como "função-mãe" válida —
//     `GetAccessorDeclaration`/`SetAccessorDeclaration` são nós de AST distintos de
//     `MethodDeclaration`. Adicionados a `ehFuncaoOuMetodo`/`nomeDoConsumidor`.
//   - Ataque Z (Minor): 2 funções distintas dentro de objetos literais passados como
//     ARGUMENTO de chamada (sem `const` própria) e com a mesma chave de propriedade
//     colidiam na mesma chave sintética (`arquivo::queryFn` para as 2), porque
//     `nomeDoContainer` só resolvia nome de dono quando o objeto literal estava
//     atribuído a uma `const`. Generalizado: quando não há `const`, o container usa
//     a LINHA do próprio literal como qualificador (`<literal:linhaN>`) — sempre
//     único por ocorrência, mesma estratégia que os fallbacks `<anonimo:linhaN>`/
//     `<nivel-de-modulo:linhaN>` já usavam.
//
// O que isso resolve dos 7 ataques do G2 rodada 1 (ver task-81-review.md §1 para a
// tabela completa) continua valendo — a reescrita da v3 é um superconjunto estrito
// da v2 na resolução de binding, não uma mudança de comportamento nos casos que já
// funcionavam:
//   A (wrapper indireto)         → a função INTERNA que faz a chamada é detectada
//                                   diretamente (não dependemos mais de achar a
//                                   chamada dentro do corpo da função EXPORTADA).
//   C (export {} separado)       → não olhamos mais para o modificador `export` em
//                                   lugar nenhum — a checagem é feita na chamada,
//                                   não na declaração.
//   D (método de classe)         → MethodDeclaration é um dos formatos de
//                                   "função-mãe" reconhecidos.
//   H (propriedade de objeto)    → PropertyAssignment com função/arrow como valor
//                                   também é reconhecido.
//   I (alias de import)          → resolução de binding real via vínculo de escopo
//                                   (propertyName → nome local), não mais o texto
//                                   literal do identificador.
//   F (arquivo fora do glob)     → a varredura é recursiva sobre TODO `.ts` dentro
//                                   de `serviceDir` (exceto testes), não só
//                                   `*.service.ts`.
//   G (.service.ts em subpasta)  → a mesma recursividade cobre subdiretórios.
//
// Continua sem usar regex sobre o texto do arquivo — anda a árvore sintática real
// via `typescript` (já é devDependency, usada por `npm run type-check`). Continua
// sem `ts.TypeChecker`/`ts.Program` de propósito — resolução de escopo léxico
// manual é suficiente para os padrões atacados até aqui e não paga o custo de
// resolver módulos externos; ver `docs/smoke-coverage-limitations.md` para os
// padrões que EXIGIRIAM `ts.TypeChecker` (indireção por parâmetro, cast, nome de
// método dinâmico via variável, `.call`/`.apply`/`.bind`) e continuam fora.
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export interface ConsumerFn {
  /** Chave estável usada no registry de cobertura: "<arquivo-relativo>::<nome>". */
  key: string;
  file: string;
  name: string;
  line: number;
}

/** Nomes canônicos que, quando é o objeto de QUALQUER chamada `.metodo(...)`, contam
 *  como toque de rede — não importa o método chamado (`.get`/`.post`/`.put`/`.patch`/
 *  `.delete`/`.request`/etc.), porque o próprio objeto É a fronteira HTTP. */
const NOMES_CANONICOS_DE_REDE = new Set(['apiClient', 'lunaClient']);

/** Objetos cujo toque de rede depende do MÉTODO específico chamado (não é a
 *  fronteira inteira — só um método pontual dela faz I/O real). */
const METODOS_ESTATICOS_DE_REDE = new Map<string, Set<string>>([
  ['File', new Set(['downloadFileAsync'])],
]);

const TODOS_NOMES_CANONICOS_RASTREAVEIS = new Set<string>([
  ...NOMES_CANONICOS_DE_REDE,
  ...METODOS_ESTATICOS_DE_REDE.keys(),
]);

/** Um vínculo léxico: o identificador É um client canônico (transitivamente), é um
 *  MÉTODO desestruturado de um client canônico, ou está BLOQUEADO — declarado
 *  localmente (por `let x;` sem inicializador, ou `const x = <algo não-resolvível>`)
 *  sem resolver para nada rastreável. 'bloqueado' existe para um propósito
 *  específico, adicionado no incremento pós-G2 rodada 3 (Ataque D): fazer a busca de
 *  escopo (`resolverNoEscopo`) PARAR nesse ponto em vez de subir ao escopo pai —
 *  sem ele, uma redeclaração local com valor fake do MESMO NOME de um client
 *  canônico não cria sombra própria (porque nada era escrito no Map), e a busca
 *  encontrava por engano o vínculo do escopo pai. */
type Vinculo =
  | { tipo: 'objeto'; nome: string }
  | { tipo: 'membro'; objeto: string; propriedade: string }
  | { tipo: 'bloqueado' };

/** Escopo léxico: um `Map` de vínculos próprios do bloco + referência ao escopo pai
 *  (busca de dentro pra fora, parando no primeiro que encontrar — sombreamento
 *  correto: um `get` local declarado dentro de uma função não enxerga nem é
 *  enxergado por um `get` desestruturado dentro de outra função irmã). */
interface Escopo {
  vinculos: Map<string, Vinculo>;
  pai?: Escopo;
}

function resolverNoEscopo(escopo: Escopo, nome: string): Vinculo | undefined {
  let atual: Escopo | undefined = escopo;
  while (atual) {
    const vinculo = atual.vinculos.get(nome);
    if (vinculo) return vinculo;
    atual = atual.pai;
  }
  return undefined;
}

/** Acha o ESCOPO (não o vínculo) onde `nome` já tem alguma entrada — usado por
 *  `processarAtribuicaoSolta` para mutar o Map correto quando uma atribuição solta
 *  (`cliente = apiClient`, sem `let`/`const`) acontece dentro de um bloco ANINHADO
 *  (ex.: um `if`/`else`) em relação a onde a variável foi declarada. */
function encontrarEscopoDono(escopo: Escopo, nome: string): Escopo | undefined {
  let atual: Escopo | undefined = escopo;
  while (atual) {
    if (atual.vinculos.has(nome)) return atual;
    atual = atual.pai;
  }
  return undefined;
}

/** Resolve o nome canônico de uma expressão (identificador simples — via busca de
 *  escopo, SEM fallback de texto cru — ou cadeia de propriedade, pelo último
 *  segmento). Usado tanto para o objeto de uma chamada `objeto.metodo(...)` quanto
 *  para a origem de um alias/destructuring (`const x = <expr>` /
 *  `const { a } = <expr>`).
 *
 *  Estendido no incremento pós-G2 rodada 3 (`task-81-review-rodada3.md`, Ataques A e
 *  B) com 3 casos novos, mesma pilha de escopos, sem redesenho:
 *   - `ParenthesizedExpression` — desembrulha parênteses antes de tentar os outros
 *     casos (necessário para o ternário/`??` funcionarem como OBJETO de uma chamada
 *     `(expr).metodo(...)`, onde `expr` chega envolta em parênteses pela própria
 *     sintaxe: `(cond ? a : b).get(...)`).
 *   - `ConditionalExpression` (ternário) — `cond ? a : b` resolve os DOIS ramos; o
 *     primeiro que resolver para um nome canônico vence. Fecha o Ataque A
 *     (`(preferirLuna ? lunaClient : apiClient).get(...)`).
 *   - `BinaryExpression` com operador `??` — `a ?? b` resolve os 2 lados da mesma
 *     forma. Fecha o Ataque B (`(clienteInjetado ?? apiClient).get(...)`).
 *  Os dois casos novos deliberadamente NÃO tentam decidir qual ramo "vence" quando os
 *  2 resolvem para nomes DIFERENTES (ex.: ternário entre `apiClient` e `lunaClient`)
 *  — qualquer um dos 2 nomes basta para o chamador classificar a chamada como toque
 *  de rede via `NOMES_CANONICOS_DE_REDE` (que não depende de qual dos 2 clients foi
 *  o escolhido em runtime, só de que O OBJETO é um client real). A única perda
 *  teórica é um ternário entre 2 âncoras de `METODOS_ESTATICOS_DE_REDE` com métodos
 *  DIFERENTES — não observado em código real dos 2 apps, e fora do escopo deste
 *  incremento (ver `docs/smoke-coverage-limitations.md`). */
function resolverExpressaoParaCanonico(expressao: ts.Expression, escopo: Escopo): string | undefined {
  if (ts.isParenthesizedExpression(expressao)) {
    return resolverExpressaoParaCanonico(expressao.expression, escopo);
  }
  if (ts.isIdentifier(expressao)) {
    const vinculo = resolverNoEscopo(escopo, expressao.text);
    return vinculo?.tipo === 'objeto' ? vinculo.nome : undefined;
  }
  if (ts.isPropertyAccessExpression(expressao)) {
    // `ns.apiClient` (ou cadeia mais profunda `a.b.apiClient`) — o segmento que
    // importa é o último, porque é ele que precisa ser um dos clients reais.
    return expressao.name.text;
  }
  if (ts.isElementAccessExpression(expressao) && ts.isStringLiteralLike(expressao.argumentExpression)) {
    // `ns['apiClient']` — mesma ideia, mas notação de colchete com literal de string.
    return expressao.argumentExpression.text;
  }
  if (ts.isConditionalExpression(expressao)) {
    return (
      resolverExpressaoParaCanonico(expressao.whenTrue, escopo) ??
      resolverExpressaoParaCanonico(expressao.whenFalse, escopo)
    );
  }
  if (ts.isBinaryExpression(expressao) && expressao.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    return (
      resolverExpressaoParaCanonico(expressao.left, escopo) ??
      resolverExpressaoParaCanonico(expressao.right, escopo)
    );
  }
  return undefined;
}

/** Extrai `{ objeto, propriedade }` de uma CallExpression na forma `objeto.metodo(...)`
 *  OU `objeto['metodo'](...)` (colchete com literal de string apenas — nome de método
 *  dinâmico via variável não é resolvível estaticamente, ver limitações declaradas em
 *  `docs/smoke-coverage-limitations.md`). */
function extrairObjetoEPropriedade(
  callee: ts.Expression,
  escopo: Escopo,
): { objeto: string; propriedade: string } | undefined {
  if (ts.isPropertyAccessExpression(callee)) {
    const objeto = resolverExpressaoParaCanonico(callee.expression, escopo);
    if (!objeto) return undefined;
    return { objeto, propriedade: callee.name.text };
  }
  if (ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression)) {
    const objeto = resolverExpressaoParaCanonico(callee.expression, escopo);
    if (!objeto) return undefined;
    return { objeto, propriedade: callee.argumentExpression.text };
  }
  return undefined;
}

/** Popula, num único escopo (sem descer para funções/blocos aninhados — isso é
 *  responsabilidade do chamador, ao criar o escopo filho), os vínculos vindos de:
 *  imports nomeados (bindings reais de import — cobre alias de import, ataque I do
 *  G2), `const x = <expr resolvível>` (alias por atribuição — cobre o padrão
 *  `const cliente = apiClient`), e `const { a, b: c } = <expr resolvível>`
 *  (destructuring — fecha o ataque X do G2 rodada 2, de forma geral: qualquer
 *  propriedade desestruturada de qualquer client canônico, não só `get`).
 *
 *  Roda em FIXPOINT limitado (5 iterações) para não depender da ORDEM textual das
 *  declarações dentro do mesmo bloco — mesma garantia que a v2 já dava, só que agora
 *  vale em QUALQUER escopo (função/bloco aninhado), não só topo de módulo. */
function popularEscopoComDeclaracoesDiretas(statements: readonly ts.Statement[], escopo: Escopo): void {
  // Imports só existem de fato no topo do módulo, mas não há problema em checar em
  // qualquer lista de statements (não há import válido dentro de bloco em JS/TS).
  for (const stmt of statements) {
    if (ts.isImportDeclaration(stmt) && stmt.importClause?.namedBindings) {
      const bindings = stmt.importClause.namedBindings;
      if (ts.isNamedImports(bindings)) {
        for (const especificador of bindings.elements) {
          const nomeImportado = (especificador.propertyName ?? especificador.name).text;
          const nomeLocal = especificador.name.text;
          if (TODOS_NOMES_CANONICOS_RASTREAVEIS.has(nomeImportado)) {
            escopo.vinculos.set(nomeLocal, { tipo: 'objeto', nome: nomeImportado });
          }
        }
      }
    }
  }

  // Fixpoint principal: para cada `const`/`let` do bloco, tenta resolver o
  // inicializador para um vínculo positivo ('objeto'/'membro'). Quando NÃO resolve —
  // seja por não ter inicializador (`let cliente;`) seja por inicializador
  // não-rastreável (objeto literal, chamada de função, número...) — escreve um
  // vínculo 'bloqueado' em vez de simplesmente pular a declaração.
  //
  // Isso corrige o Ataque D (`task-81-review-rodada3.md` §2): antes, uma
  // redeclaração local do MESMO NOME de um client canônico com valor fake
  // (`const apiClient = { get: ... }`) não escrevia NADA no Map deste escopo — a
  // busca de `resolverNoEscopo` não encontrava `apiClient` aqui e subia para o
  // escopo pai, onde o import real ainda tinha vínculo 'objeto', resolvendo por
  // engano para o client de verdade. Um vínculo 'bloqueado' faz a busca de escopo
  // PARAR neste ponto (`resolverNoEscopo` já retorna no primeiro vínculo que
  // encontra, de QUALQUER tipo) sem nunca contar como toque de rede (nenhum dos
  // `if (vinculo?.tipo === 'objeto'|'membro')` espalhados pelo arquivo trata
  // 'bloqueado' como positivo).
  //
  // O mesmo raciocínio fecha, de brinde, a variante para `let cliente;` sem
  // inicializador: registrar 'bloqueado' já no momento da declaração dá um ALVO na
  // pilha de escopos para uma atribuição solta posterior (`cliente = apiClient`,
  // ver `processarAtribuicaoSolta` — Ataque C) mutar em vez de precisar recriar a
  // lógica de resolução do zero.
  for (let iteracao = 0; iteracao < 5; iteracao++) {
    let mudou = false;
    for (const stmt of statements) {
      if (!ts.isVariableStatement(stmt)) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          if (!decl.initializer) {
            const existente = escopo.vinculos.get(decl.name.text);
            if (!existente) {
              escopo.vinculos.set(decl.name.text, { tipo: 'bloqueado' });
              mudou = true;
            }
            continue;
          }
          const canonico = resolverExpressaoParaCanonico(decl.initializer, escopo);
          const existente = escopo.vinculos.get(decl.name.text);
          if (canonico) {
            if (!existente || existente.tipo !== 'objeto' || existente.nome !== canonico) {
              escopo.vinculos.set(decl.name.text, { tipo: 'objeto', nome: canonico });
              mudou = true;
            }
          } else if (!existente) {
            escopo.vinculos.set(decl.name.text, { tipo: 'bloqueado' });
            mudou = true;
          }
          continue;
        }

        if (ts.isObjectBindingPattern(decl.name)) {
          if (!decl.initializer) continue; // sintaticamente inválido — defesa
          const canonico = resolverExpressaoParaCanonico(decl.initializer, escopo);
          for (const elemento of decl.name.elements) {
            if (elemento.dotDotDotToken) continue; // `...resto` — não rastreável
            if (!ts.isIdentifier(elemento.name)) continue; // padrão aninhado — não rastreável
            const nomePropriedade = textoDeNomePropriedade(elemento.propertyName ?? elemento.name);
            if (nomePropriedade === undefined) continue; // ComputedPropertyName — não rastreável
            const nomeLocal = elemento.name.text;
            const existente = escopo.vinculos.get(nomeLocal);
            if (!canonico) {
              // Mesma correção do Ataque D, para a forma de destructuring: `const
              // { apiClient } = configNaoRelacionada` também precisa sombrear um
              // eventual `apiClient` do escopo pai, não deixar a busca subir.
              if (!existente) {
                escopo.vinculos.set(nomeLocal, { tipo: 'bloqueado' });
                mudou = true;
              }
              continue;
            }
            const jaIgual =
              existente?.tipo === 'membro' &&
              existente.objeto === canonico &&
              existente.propriedade === nomePropriedade;
            if (!jaIgual) {
              escopo.vinculos.set(nomeLocal, { tipo: 'membro', objeto: canonico, propriedade: nomePropriedade });
              mudou = true;
            }
          }
        }
      }
    }
    if (!mudou) break;
  }
}

type NoFuncaoOuMetodo =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

/** Extrai o texto de um `PropertyName` quando ele é estaticamente legível
 *  (`Identifier`/`StringLiteral`/`NumericLiteral`) — devolve `undefined` para
 *  `ComputedPropertyName` (`{ [expr]: nome }`), que não tem texto fixo. */
function textoDeNomePropriedade(node: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function ehFuncaoOuMetodo(n: ts.Node): n is NoFuncaoOuMetodo {
  return (
    ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n)
  );
}

/** Sobe a árvore a partir de uma CallExpression até achar a função/método/acessor
 *  mais próximo que a contém — essa é a "função-mãe" real, não importa se ela é
 *  exportada, método de classe, getter/setter, propriedade de objeto literal ou
 *  wrapper interno nunca exportado diretamente. */
function funcaoEnvolvente(node: ts.Node): NoFuncaoOuMetodo | undefined {
  let atual: ts.Node | undefined = node.parent;
  while (atual) {
    if (ehFuncaoOuMetodo(atual)) return atual;
    atual = atual.parent;
  }
  return undefined;
}

/** Nome de um container nomeado (classe, ou variável que recebe um objeto literal) —
 *  usado para prefixar métodos/propriedades e evitar colisão entre, por exemplo,
 *  `ClasseA.f` e `ClasseB.f`. Quando o objeto literal não está atribuído a nenhuma
 *  `const` (ex.: passado direto como argumento de chamada — `registrar({ queryFn:
 *  ... })`), não há nome estável de container — em vez de deixar a propriedade SEM
 *  qualificador (o que colide entre 2 objetos inline distintos com a mesma chave de
 *  propriedade, ataque Z do G2 rodada 2), usa a LINHA do próprio literal como
 *  qualificador: sempre único por ocorrência, mesma estratégia que os fallbacks
 *  `<anonimo:linhaN>`/`<nivel-de-modulo:linhaN>` já usam neste arquivo. */
function nomeDoContainer(node: ts.Node, sf: ts.SourceFile): string | undefined {
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    return node.name?.text;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const pai = node.parent;
    if (ts.isVariableDeclaration(pai) && ts.isIdentifier(pai.name)) return pai.name.text;
    const linha = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    return `<literal:linha${linha}>`;
  }
  return undefined;
}

/** Deriva um nome estável para a função-mãe de uma chamada de rede, cobrindo:
 *  função nomeada direta, `const x = () => ...`/`function expression`, método de
 *  classe (`Classe.metodo`), getter/setter de classe (`Classe.get metodo`/`Classe.set
 *  metodo`), método/propriedade de objeto literal (`objeto.propriedade`, com
 *  fallback de linha quando `objeto` não tem nome estável — ver `nomeDoContainer`).
 *  Quando nada disso resolve (função anônima passada inline, ex. callback de outro
 *  utilitário chamando rede diretamente), cai num nome sintético baseado na linha —
 *  NUNCA descarta a descoberta silenciosamente. */
function nomeDoConsumidor(fn: NoFuncaoOuMetodo, sf: ts.SourceFile): string {
  if ((ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn)) && fn.name) {
    return fn.name.text;
  }
  if (ts.isMethodDeclaration(fn) && ts.isIdentifier(fn.name)) {
    const dono = nomeDoContainer(fn.parent, sf);
    return dono ? `${dono}.${fn.name.text}` : fn.name.text;
  }
  if ((ts.isGetAccessorDeclaration(fn) || ts.isSetAccessorDeclaration(fn)) && ts.isIdentifier(fn.name)) {
    const dono = nomeDoContainer(fn.parent, sf);
    const prefixo = ts.isGetAccessorDeclaration(fn) ? 'get ' : 'set ';
    return dono ? `${dono}.${prefixo}${fn.name.text}` : `${prefixo}${fn.name.text}`;
  }
  const pai = fn.parent;
  if (pai) {
    if (ts.isVariableDeclaration(pai) && ts.isIdentifier(pai.name)) {
      return pai.name.text;
    }
    if (ts.isPropertyAssignment(pai) && ts.isIdentifier(pai.name)) {
      const dono = nomeDoContainer(pai.parent, sf);
      return dono ? `${dono}.${pai.name.text}` : pai.name.text;
    }
    if (ts.isShorthandPropertyAssignment(pai)) {
      const dono = nomeDoContainer(pai.parent, sf);
      return dono ? `${dono}.${pai.name.text}` : pai.name.text;
    }
  }
  const linha = sf.getLineAndCharacterOfPosition(fn.getStart(sf)).line + 1;
  return `<anonimo:linha${linha}>`;
}

/** Lista recursivamente todo `.ts`/`.tsx` sob `dir`, excluindo arquivos de teste
 *  (`.test.ts(x)`/`.spec.ts(x)`) e declarações (`.d.ts`). Devolve caminhos RELATIVOS
 *  a `dir`, em forma POSIX (`/`), para a chave do registry não depender de
 *  plataforma. */
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

interface ContextoDeArquivo {
  sf: ts.SourceFile;
  arquivo: string;
  jaVisto: Set<ts.Node>;
  resultado: ConsumerFn[];
  linhaDe: (n: ts.Node) => number;
}

/** Verifica se uma CallExpression toca rede — direto (`objeto.metodo(...)`,
 *  `objeto['metodo'](...)`), por identificador desestruturado (`get(...)`, quando
 *  `get` tem vínculo 'membro' no escopo — fecha o ataque X) ou `fetch(...)` cru. */
function detectarToqueDeRede(n: ts.CallExpression, escopo: Escopo, ctx: ContextoDeArquivo): void {
  const expr = n.expression;
  let tocaRede = false;

  const par = extrairObjetoEPropriedade(expr, escopo);
  if (par) {
    if (NOMES_CANONICOS_DE_REDE.has(par.objeto)) tocaRede = true;
    else if (METODOS_ESTATICOS_DE_REDE.get(par.objeto)?.has(par.propriedade)) tocaRede = true;
  } else if (ts.isIdentifier(expr)) {
    if (expr.text === 'fetch') {
      tocaRede = true;
    } else {
      const vinculo = resolverNoEscopo(escopo, expr.text);
      if (vinculo?.tipo === 'membro') {
        if (NOMES_CANONICOS_DE_REDE.has(vinculo.objeto)) tocaRede = true;
        else if (METODOS_ESTATICOS_DE_REDE.get(vinculo.objeto)?.has(vinculo.propriedade)) tocaRede = true;
      }
    }
  }

  if (!tocaRede) return;

  const fn = funcaoEnvolvente(n);
  const chaveDedupe: ts.Node = fn ?? n;
  if (ctx.jaVisto.has(chaveDedupe)) return;
  ctx.jaVisto.add(chaveDedupe);
  const nome = fn ? nomeDoConsumidor(fn, ctx.sf) : `<nivel-de-modulo:linha${ctx.linhaDe(n)}>`;
  ctx.resultado.push({
    key: `${ctx.arquivo}::${nome}`,
    file: ctx.arquivo,
    name: nome,
    line: ctx.linhaDe(fn ?? n),
  });
}

/** Atribuição SOLTA (`cliente = apiClient`, sem `let`/`const`/`var` — Ataque C,
 *  `task-81-review-rodada3.md` §2): diferente de uma declaração (`popularEscopoCom
 *  DeclaracoesDiretas`, que só olha `VariableStatement`), isto é uma
 *  `BinaryExpression` com operador `=` fora de qualquer declaração, tipicamente
 *  usada para atribuir depois de um `let x;` sem inicializador (comum dentro de
 *  `if`/`else`, cada ramo seu próprio escopo de `Block`).
 *
 *  A variável já precisa estar declarada em ALGUM escopo ancestral (`let cliente;`
 *  vira vínculo 'bloqueado' no momento da declaração, ver `popularEscopoCom
 *  DeclaracoesDiretas`) — `encontrarEscopoDono` acha ESSE escopo (que pode ser um
 *  ancestral do escopo onde a atribuição realmente acontece, ex.: `let` no corpo da
 *  função, atribuição dentro de um `if` aninhado) e MUTA o vínculo lá, não no escopo
 *  local da atribuição — é isso que faz o valor ficar visível depois do `if`/`else`
 *  terminar, na mesma função. Atribuição a um nome nunca declarado em escopo nenhum
 *  (`globalImplicito = x`, prática não recomendada e rara no código real dos 2 apps)
 *  é ignorada — sem alvo para mutar, sem invariante de escopo para preservar. */
function processarAtribuicaoSolta(n: ts.BinaryExpression, escopo: Escopo): void {
  if (!ts.isIdentifier(n.left)) return;
  const dono = encontrarEscopoDono(escopo, n.left.text);
  if (!dono) return;
  // WRITE-ONCE para o lado positivo (fix rodada 1 sobre o incremento,
  // `task-81-incremento-review.md` Critical-1): a mutação incondicional acima
  // (herdada do incremento pós-G2 rodada 3) sobrescrevia o vínculo em ORDEM
  // TEXTUAL de visita, sem modelar `if`/`else` como ramos mutuamente exclusivos —
  // `let cliente; if (real) cliente = apiClient; else cliente = { fake };` perdia o
  // vínculo 'objeto' do ramo `if` quando o `else` (visitado depois, no texto) escrevia
  // 'bloqueado' por cima, mesmo sem exclusão mútua em runtime nenhuma ter sido
  // observada. A partir daqui: uma vez que o nome já está vinculado a 'objeto' OU
  // 'membro' (ambos POSITIVOS — tocam rede) NESTE escopo, uma atribuição solta
  // POSTERIOR nunca apaga esse vínculo, mesmo que resolva para algo não-rastreável.
  // Só um vínculo NÃO positivo (ausente ou já 'bloqueado') pode ser sobrescrito.
  // Consequência aceita e declarada (ver `docs/smoke-coverage-limitations.md`): um
  // nome legitimamente reatribuído de um client real para um valor inofensivo,
  // DEPOIS de já ter sido vinculado a 'objeto'/'membro' no mesmo escopo, permanece
  // marcado — o detector passa a SUPERINCLUIR esse caso (falso positivo), nunca a
  // escondê-lo. Correto para um detector de cobertura: falso positivo faz teste
  // falhar e alguém investigar; falso negativo é silencioso.
  const existente = dono.vinculos.get(n.left.text);
  if (existente?.tipo === 'objeto' || existente?.tipo === 'membro') return;
  const canonico = resolverExpressaoParaCanonico(n.right, escopo);
  dono.vinculos.set(n.left.text, canonico ? { tipo: 'objeto', nome: canonico } : { tipo: 'bloqueado' });
}

/** Anda a árvore com uma PILHA DE ESCOPOS explícita: todo `Block` (corpo de função
 *  com chaves, if/for/while/try aninhado) cria um escopo filho, populado com as
 *  declarações diretas daquele bloco, antes de recursar nos filhos. Corpo de arrow
 *  function SEM chaves (`() => apiClient.get(...)`) não cria escopo novo — não pode
 *  ter declaração local mesmo. */
function visitarComEscopo(n: ts.Node, escopo: Escopo, ctx: ContextoDeArquivo): void {
  if (ts.isCallExpression(n)) {
    detectarToqueDeRede(n, escopo, ctx);
  }

  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    processarAtribuicaoSolta(n, escopo);
  }

  if (ts.isBlock(n)) {
    const filho: Escopo = { vinculos: new Map(), pai: escopo };
    popularEscopoComDeclaracoesDiretas(n.statements, filho);
    ts.forEachChild(n, (c) => visitarComEscopo(c, filho, ctx));
    return;
  }

  ts.forEachChild(n, (c) => visitarComEscopo(c, escopo, ctx));
}

/**
 * Varre recursivamente TODO `.ts`/`.tsx` em `serviceDir` (exceto testes/`.d.ts`) e
 * devolve toda função — em qualquer forma sintática (nomeada, arrow atribuída,
 * método de classe, getter/setter, propriedade de objeto, wrapper interno nunca
 * exportado, identificador desestruturado de um client) — cuja árvore contém uma
 * CallExpression que toca um dos primitivos de rede reais deste app. Ordenado por
 * chave, para diffs estáveis. Deduplicado por nó de função (uma função com 2+
 * chamadas de rede aparece 1 vez só).
 */
export function discoverNetworkConsumers(serviceDir: string): ConsumerFn[] {
  const arquivos = listarArquivosTs(serviceDir).sort();
  const resultado: ConsumerFn[] = [];

  for (const arquivo of arquivos) {
    const caminho = path.join(serviceDir, arquivo);
    const texto = fs.readFileSync(caminho, 'utf-8');
    const sf = ts.createSourceFile(caminho, texto, ts.ScriptTarget.Latest, true);

    const raiz: Escopo = { vinculos: new Map() };
    popularEscopoComDeclaracoesDiretas(sf.statements, raiz);

    const ctx: ContextoDeArquivo = {
      sf,
      arquivo,
      jaVisto: new Set<ts.Node>(),
      resultado,
      linhaDe: (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
    };

    visitarComEscopo(sf, raiz, ctx);
  }

  return resultado.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Extrai os nomes de check reais (1º argumento de `chamar`/`chamar_apikey`/
 * `chamar_idempotency`) de um `smoke-contratos.sh` já lido em memória — é o que
 * fecha o laço da metade "coberto: <nome>" do registry contra o script de verdade,
 * em vez de confiar que o nome citado no registry ainda existe.
 */
export function extrairNomesDeCheck(conteudoScript: string): Set<string> {
  const nomes = new Set<string>();
  const regex = /^chamar(?:_apikey|_idempotency)?\s+"((?:[^"\\]|\\.)*)"/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(conteudoScript)) !== null) {
    const nome = m[1];
    if (nome !== undefined) nomes.add(nome);
  }
  return nomes;
}
