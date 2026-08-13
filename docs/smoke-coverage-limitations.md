# Limitações declaradas do detector de lacuna (`discover-network-consumers.ts`)

TASK-81 (`KURA_BACKLOG_FIX_7`). Histórico de rodadas:
- **Rodada de fix 1** (v1 → v2): reprovação G2 por `Critical` #1 — a versão 1 do
  walker (enumerava *funções exportadas* em `*.service.ts` topo-de-pasta) era cega a
  7 de 8 formas plausíveis de indireção. A v2 trocou "enumerar declarações e
  adivinhar" por "enumerar toda `CallExpression` que toca rede e subir a árvore até
  achar a função-mãe", resolvida por um MAPA PLANO de arquivo inteiro
  (identificador → nome canônico).
- **Rodada de fix 2** (v2 → v3): reprovação G2 rodada 2 por `Critical`
  novo — o mapa plano da v2 não reconhecia identificador desestruturado
  (`const { get } = apiClient; get(...)`) como chamada de rede, e caía num
  *fallback* de texto cru que gerava falso positivo para variável local homônima
  sem import. A v3 troca o mapa plano por uma **pilha de escopos léxicos real** (um
  escopo novo por `Block`, com busca de dentro pra fora) — ver o cabeçalho do
  próprio `discover-network-consumers.ts` para o raciocínio completo, com os 2
  tipos de vínculo (`objeto`/`membro`) que ela usa.
- **Incremento pós-G2 rodada 3** (v3, sem mudança de arquitetura): aprovação
  condicional (`task-81-review-rodada3.md`) exigiu fechar 4 achados antes do
  próximo backlog tocar este arquivo — 2 `Critical` (ternário/`??` como fonte de
  client, Ataques A/B) e 2 `Important` (atribuição solta pós-`let` sem
  inicializador, Ataque C; falso positivo por sombra local incompleta, Ataque D).
  Fechados com 3 extensões pontuais da mesma pilha de escopos (mais 2 `case`s em
  `resolverExpressaoParaCanonico`, uma função nova `processarAtribuicaoSolta`, e um
  3º tipo de vínculo `'bloqueado'`) — ver §"Incremento pós-G2 rodada 3" abaixo para
  a prova de mutação de cada um.
- **Rodada de fix 1 sobre o incremento** (mesma v3, sem mudança de arquitetura):
  reprovação (`task-81-incremento-review.md`) por 1 `Critical` — `processarAtribuicaoSolta`
  mutava o vínculo em ORDEM TEXTUAL de visita, não por exclusão mútua real de
  `if`/`else`, então um roteamento client-real/fallback-fake escapava ou não
  dependendo de qual ramo foi escrito primeiro. Corrigido com WRITE-ONCE (um vínculo
  positivo `'objeto'`/`'membro'` nunca é sobrescrito por atribuição solta posterior) —
  1 condicional em `processarAtribuicaoSolta`. A seção "Risco específico atacado"
  abaixo também foi corrigida: a alegação original testava só reatribuição sequencial
  no mesmo escopo e generalizava a conclusão para além do que foi testado.

Este documento é a contrapartida honesta de cada correção: diz exatamente o que a
versão atual detecta, com prova, e o que **ainda** escapa, também com prova — em vez
de reivindicar completude que não existe. "Detector que se declara completo sem ser"
é, junto com "documentação que garante o que o código não faz", um dos padrões que já
reprovaram task neste ciclo (ver `CLAUDE.md`).

Espelho: este documento vale igualmente para `mobile-clinica-rn` — o walker é
código idêntico nos 2 apps (`src/smokeCoverage/discover-network-consumers.ts` nos
dois, só o comentário de cabeçalho distingue "original" de "espelho").

## Desenho (v3)

Em vez de "enumerar funções exportadas e adivinhar quais fazem rede", o walker
**enumera os pontos onde a rede é de fato tocada** — toda `CallExpression` cujo
objeto resolve (por uma pilha de escopos léxicos real, não por texto) para
`apiClient`/`lunaClient` (os 2 axios instances de `api/client.ts`) ou
`File.downloadFileAsync`, seja diretamente (`objeto.metodo(...)`) ou através de um
identificador desestruturado de um desses objetos (`const { get } = apiClient;
get(...)`) — e só depois sobe a árvore a partir de cada chamada para achar qual
função a contém. Ver o cabeçalho do próprio arquivo `discover-network-consumers.ts`
para o raciocínio completo, incluindo por que a resolução por escopo (em vez do mapa
plano da v2) fecha ao mesmo tempo um `Critical` e um falso positivo.

## O que É detectado hoje — prova por mutação

### Herdado da rodada de fix 1 (8 ataques do G2 + 3 padrões novos), reconfirmado nesta rodada

Reproduzidos de novo nesta rodada (não só herdados por leitura) em
`mobile-tutor-rn/src/services/pets.service.ts` (+ `pets.gateway.ts` para o F, +
`services/sub/pets.service.ts` para o G), junto com a combinação A+I da rodada 2:
contador foi de **16 → 27** (11 ataques simultâneos: os 8 originais + 2 padrões
novos da rodada 1 + a combinação A+I inventada na rodada 2), todos com falha
"função consumidora de rede tem entrada no registry" esperada — nenhuma regressão.

| # | Padrão | Origem | Detectado? |
|---|---|---|---|
| A | Wrapper indireto — exportada delega para helper interno que toca a rede | G2 rodada 1 | **SIM** |
| C | `const` não exportada, exportada via `export { nome }` separado | G2 rodada 1 | **SIM** |
| D | Método de classe exportada | G2 rodada 1 | **SIM** |
| E | `export default function` | G2 rodada 1 | **SIM** |
| H | Objeto exportado com método (`{ f: async () => ... }`) | G2 rodada 1 | **SIM** |
| I | `apiClient` importado com alias | G2 rodada 1 | **SIM** |
| F | Arquivo de rede fora do glob `*.service.ts` | G2 rodada 1 | **SIM** |
| G | `.service.ts` em subdiretório | G2 rodada 1 | **SIM** |
| — | `namespace.apiClient.get(...)` | Novo, rodada de fix 1 | **SIM** |
| — | `const cliente = apiClient; cliente.get(...)` | Novo, rodada de fix 1 | **SIM** |
| — | `apiClient['get'](...)` (colchete com literal de string) | Novo, rodada de fix 1 | **SIM** |
| — | Wrapper indireto (A) **+** alias de import (I) combinados no mesmo arquivo | G2 rodada 2 | **SIM** |

### Novo nesta rodada — os 3 ataques do G2 rodada 2 + o falso positivo

| # | Padrão | Severidade no G2 | Resultado |
|---|---|---|---|
| X | `const { get } = apiClient; get(path)` — identificador desestruturado chamado solto | 🔴 Critical | **FECHADO.** `16 → 17` no tutor (chave `g2r2-ataque-x.service.ts::funcaoAtaqueXDestructuring`), `21 → 22` na clínica. Antes do fix: `16 → 16` / `21 → 21`, invisível, zero sinal — reproduzido nos 2 apps com o walker v2 original antes de aplicar a v3, não só citado do relatório do G2. |
| — | Falso positivo: variável local homônima ao client, sem import | 🟢 Minor | **FECHADO** (de brinde, pela mesma mudança de escopo/binding que fecha X — não houve código extra dedicado a este caso). `16 → 16`, sem falha, depois do fix. |
| Y | Getter de classe (`get x() { return apiClient.get(...); }`) | 🟡 Important | **FECHADO.** Antes: descoberto, mas caía no fallback sintético `<nivel-de-modulo:linhaN>` (chave instável, sensível a reformatação). Depois: `GetAccessorDeclaration`/`SetAccessorDeclaration` viraram formas de "função-mãe" reconhecidas — chave estável `Classe.get nomeDoAcessor` (`16 → 17`, chave `g2r2-ataque-y.service.ts::ClasseAtaqueYGetter.get statusRemoto`). |
| Z | 2 funções distintas em objetos literais passados como ARGUMENTO (sem `const`), mesma chave de propriedade | 🟢 Minor | **FECHADO.** Antes: as 2 colidiam na mesma chave sintética (`arquivo::queryFn`), risco de uma "emprestar" cobertura da outra silenciosamente. Depois: quando o objeto literal não tem `const` própria, o container usa a LINHA do literal como qualificador (`<literal:linhaN>.queryFn`) — sempre único por ocorrência. Testado com 2 chamadas `registrar({ queryFn: ... })` no mesmo arquivo: `16 → 18`, 2 chaves distintas (`<literal:linha11>.queryFn`, `<literal:linha12>.queryFn`), sem colisão. |

Corroboração cruzada: o ataque X foi reaplicado em `mobile-clinica-rn/src/services/
pets.service.ts` (equivalente) — `21 → 22`, mesmo resultado do tutor.

### 2 ataques próprios desta rodada (não reusam os do G2 nem os já declarados abaixo)

| # | Padrão | Resultado |
|---|---|---|
| Próprio 1 | Destructuring dentro de um BLOCO ANINHADO (`if`), não no corpo direto da função nem no nível de módulo — testa se a pilha de escopos cria um escopo novo corretamente em profundidade, não só 1 nível | **Detectado.** `16 → 17`, chave `g2r2-meu-ataque-1.service.ts::funcaoComDestructuringEmBlocoAninhado`. |
| Próprio 2 | Destructuring COM RENOMEAÇÃO (`const { get: buscar } = apiClient`, caminho de `propertyName` distinto do `{ get }` curto do ataque X) **+** 2 funções irmãs desestruturando o MESMO nome local (`buscar`) de forma independente — testa que a pilha de escopos não vaza entre funções irmãs | **Detectado, sem colisão.** `16 → 19` (2 funções), 2 chaves distintas (`funcaoIrmaUmComRenomeacao`, `funcaoIrmaDoisComRenomeacao`), cada uma com sua própria entrada — nenhuma "empresta" cobertura da outra. |

Todas as mutações de prova desta rodada foram revertidas antes do commit
(`git status --porcelain -uall src/services/` limpo nos 2 apps depois de cada uma).

### Incremento pós-G2 rodada 3 (`task-81-review-rodada3.md`) — 4 achados fechados

Aprovação condicional: o revisor achou 2 `Critical` novos (ternário/`??` como fonte de um
client — categoria diferente dos bugs de resolução de escopo que motivaram X/Y/Z; aqui o
problema é que tipos de NÓ DE EXPRESSÃO `resolverExpressaoParaCanonico` reconhece) e 2
`Important` (atribuição solta pós-`let` sem inicializador; falso positivo por sombra local
incompleta), com a condição de virarem item de Bloco 0 do próximo backlog que tocasse este
arquivo — fechados já neste incremento, mesma pilha de escopos, sem redesenho.

Código de ataque copiado literalmente do relatório do revisor (`task-81-review-rodada3.md`
§2), reexecutado nesta sessão (não só herdado) — "antes" obtido revertendo só o walker para
`origin/main` (`git checkout origin/main -- src/smokeCoverage/discover-network-consumers.ts`),
"depois" com o walker fixado, nos 2 apps:

| # | Padrão | Severidade no G2 rodada 3 | Resultado |
|---|---|---|---|
| A | `(cond ? lunaClient : apiClient).get(...)` — ternário selecionando entre os 2 clients reais, inline ou via `const` | 🔴 Critical | **FECHADO.** Tutor: `16 → 16` antes (0 sinal) / `16 → 18` depois (as 2 formas detectadas). Clínica: `21 → 21` antes / `21 → 23` depois. `resolverExpressaoParaCanonico` ganhou `case ConditionalExpression` (resolve os 2 ramos, qualquer um que resolva para canônico basta) + desembrulho de `ParenthesizedExpression` (necessário para a forma inline, onde o ternário chega envolto em parênteses como objeto da chamada). |
| B | `(clienteInjetado ?? apiClient).get(...)` — fallback `??` para o client real, inline ou via `const` | 🔴 Critical | **FECHADO.** Tutor: `16 → 16` antes / `16 → 18` depois. Clínica: `21 → 21` antes / `21 → 23` depois. `resolverExpressaoParaCanonico` ganhou `case BinaryExpression` com `operatorToken === QuestionQuestionToken` (mesma estratégia: resolve os 2 lados, qualquer um basta). |
| C | `let cliente; if (...) { cliente = apiClient; } else { cliente = apiClient; }` — atribuição solta pós-declaração sem inicializador | 🟡 Important | **FECHADO.** Tutor: `16 → 16` antes / `16 → 17` depois (`g2r3-ataque-c.service.ts::ataqueReassign`). Clínica: `21 → 21` antes / `21 → 22` depois. `let x;` sem inicializador agora grava vínculo `'bloqueado'` já na declaração (dá um alvo na pilha de escopos); `processarAtribuicaoSolta` (nova função, chamada para todo `BinaryExpression` com operador `=`) acha o escopo ancestral dono via `encontrarEscopoDono` e MUTA o vínculo lá — é isso que faz o valor atribuído dentro de um `if`/`else` ficar visível depois, no escopo da função. |
| D | `const apiClient = { get: ... }` redeclarado LOCALMENTE dentro de uma função, com o import real presente no arquivo — falso positivo por sombra incompleta | 🟡 Important | **FECHADO.** Tutor: `16 → 17` antes (bug — `funcaoComSombraLocal` marcada por engano) / `16 → 16` depois (função corretamente NÃO marcada). Clínica: `21 → 22` antes / `21 → 21` depois. Toda declaração (identificador OU destructuring) cujo inicializador não resolve para nada rastreável agora grava `'bloqueado'` em vez de simplesmente omitir — a busca de escopo PARA nesse ponto (primeiro vínculo que encontra, de qualquer tipo) em vez de subir ao escopo pai e achar por engano o vínculo do import real. |

**Risco específico atacado — falso NEGATIVO introduzido pelo vínculo `'bloqueado'` — testado
SÓ para reatribuição SEQUENCIAL no mesmo escopo, ⚠️ overclaim corrigido na rodada de fix 1:**
esta seção, na sua forma original (incremento pós-G2 rodada 3), testou 2 variantes de
**reatribuição sequencial no MESMO escopo** (`let cliente; cliente = { fake: true }; cliente =
apiClient; cliente.get(...)`, sem `if`/`else`) e concluiu "risco não se materializou" —
generalizando essa conclusão para a hipótese inteira ("sequência de 2+ atribuições soltas"). A
`task-81-incremento-review.md` (Critical-1) provou que essa generalização era falsa: o cenário
que de fato importa — **ramos DIVERGENTES de `if`/`else`**, que é a motivação original do
Ataque C — tinha um falso negativo real, dependente da ORDEM TEXTUAL dos ramos:

```ts
let cliente;
if (usarReal) { cliente = apiClient; }          // client REAL, ramo if
else { cliente = { get: async () => ({}) }; }   // fake, ramo else
return cliente.get('/rota');                     // ANTES: NÃO detectado (mutação
                                                   // incondicional do else apagava o
                                                   // vínculo 'objeto' do if, por ser
                                                   // visitado depois no texto)
```

Invertendo os ramos (fake no `if`, real no `else`), o mesmo código sintático passava a ser
detectado — a detecção dependia de qual ramo foi ESCRITO primeiro, não do que a função faz em
runtime.

**Fix da rodada 1 sobre o incremento:** write-once para o lado positivo em
`processarAtribuicaoSolta` — uma vez que o nome está vinculado a `'objeto'`/`'membro'` NESTE
escopo, uma atribuição solta posterior nunca apaga esse vínculo (só um vínculo NÃO positivo pode
ser sobrescrito). Reatacado nos 2 apps, **nas 2 ordens** (real primeiro / fake primeiro) e numa
3ª variante (`for` com `if`/`else` interno escolhendo o client por item) — as 3 formas
**detectadas** nos 2 apps depois do fix; a ordem deixou de importar. Prova completa (antes/
depois, saída colada) em
`.superpowers/sdd/KURA_BACKLOG_FIX_7/task-81-incremento-fixround1-report.md`.

**Consequência aceita e declarada do write-once — superinclusão deliberada:** um nome
legitimamente reatribuído de um client real para um valor inofensivo DEPOIS de já ter sido
vinculado a `'objeto'`/`'membro'` no mesmo escopo permanece marcado como consumidor de rede,
mesmo no ramo onde não toca rede de verdade:

```ts
let cliente = apiClient;               // vínculo 'objeto' — client real
if (fallback) { cliente = { get: async () => ({ mock: true }) }; } // tentativa de
                                        // reatribuir para algo inofensivo — write-once
                                        // BLOQUEIA essa sobrescrita
return cliente.get('/nunca-toca-rede-no-fallback'); // MARCADA mesmo assim (falso
                                                       // positivo aceito)
```

Isto é intencional, não um bug: o objetivo do detector é nunca esconder um consumidor real
(falso negativo silencioso); superincluir (falso positivo, que faz o teste falhar e alguém
investigar) é o erro seguro. Confirmado por teste nos 2 apps — a função aparece na lista de
chaves descobertas mesmo sem tocar rede no ramo `fallback`.

**Sem falso positivo novo em nomes que NUNCA foram vinculados a um client real** — testado com 3
casos de código legítimo sem rede nos 2 apps: ternário/`??` entre 2 valores locais que não são
clients; `let` sem inicializador atribuído depois a um valor que nunca é client (2+
atribuições, todas para objetos inofensivos); e um caso dedicado que confirma que o write-once
só protege vínculos que chegaram a ser `'objeto'`/`'membro'` — nenhuma das funções legítimas foi
sinalizada.

**Sem regressão** nos 13+ padrões já cobertos, mais os 4 achados do próprio incremento (A, B, C
simétrico, D): reaplicados nos 2 apps os 8 ataques do G2 rodada 1 + 2 novos da rodada 1
(namespace-chain, const-alias-local) + X/Y/Z + Próprio1/Próprio2 da rodada 2/fix 2 + a combinação
A+I + A/B/C-simétrico/D do incremento — todos continuam detectados (ou, no caso de D, continuam
corretamente NÃO detectados), com as mesmas chaves, sem colisão nova. As 4 limitações abaixo
(parâmetro, cast, nome dinâmico, `.call`/`.apply`/`.bind`) não foram tocadas por este fix — a
fronteira declarada abaixo não mudou.

Detalhe completo com os números exatos de cada medição, nas 2 rodadas:
`.superpowers/sdd/KURA_BACKLOG_FIX_7/task-81-incremento-report.md` e
`.superpowers/sdd/KURA_BACKLOG_FIX_7/task-81-incremento-fixround1-report.md` (workspace de
planejamento, fora deste repo).

Todos os arquivos/harnesses de ataque desta seção foram revertidos/removidos depois da medição;
`git status --porcelain -uall` confirmado vazio nos 2 apps.

## O que AINDA escapa — declarado, não escondido

Reconfirmado NESTA rodada (não só herdado da rodada 1) que os 4 padrões abaixo
continuam invisíveis sob o walker v3 — testados de novo, isolados, contador **não se
move** (`16 → 16`):

1. **Indireção por parâmetro.** O client é passado como argumento de função, não
   resolvido por import nem por `const`/destructuring em nenhum escopo léxico:
   ```ts
   function helper(cliente: typeof apiClient) { return cliente.get('/x'); }
   export async function f() { return helper(apiClient); }
   ```
   `helper` nunca é ligado a `apiClient` estaticamente pela pilha de escopos (que só
   resolve declarações locais — import, `const`, destructuring — não o valor
   passado por um CALL SITE para um parâmetro) — o parâmetro `cliente` é
   indistinguível de qualquer outro parâmetro sem análise de fluxo interprocedural
   completa, que este walker não faz. Fechar isso exigiria rastrear, para cada
   `CallExpression` que invoca uma função local, quais argumentos concretos foram
   passados em CADA call site — um problema de análise de fluxo de dados
   interprocedural, categoricamente diferente de resolução de escopo léxico (que é
   o que a v3 resolve). `ts.TypeChecker`/`ts.Program` sozinho também não resolveria
   isso de graça — precisaria de análise de fluxo (dataflow), não só resolução de
   símbolo.

2. **Objeto embrulhado em cast/parêntese antes da propriedade/colchete.**
   ```ts
   export async function f() { return (apiClient as any)['get']('/x'); }
   ```
   `resolverExpressaoParaCanonico` só reconhece `Identifier`, `PropertyAccessExpression`
   e `ElementAccessExpression` com literal — um `AsExpression`/
   `ParenthesizedExpression` no meio do caminho quebra a resolução. (Sem o cast,
   `apiClient['get'](...)` simples **é** detectado — ver tabela acima.)

3. **Nome de método dinâmico via variável** (`apiClient[metodoVar](...)`, onde
   `metodoVar` não é um literal de string) — não resolvível estaticamente por
   desenho (exigiria avaliação de valor em runtime, não só de sintaxe — o walker
   não executa código, só lê a AST).

4. **Invocação indireta via `.call`/`.apply`/`.bind`**
   (`apiClient.get.call(null, '/x')`) — o `callee` da `CallExpression` externa é
   `apiClient.get.call`, cujo "último segmento" resolve para `'call'`, não
   `'apiClient'`; a cadeia de propriedade não é andada por inteiro, só o segmento
   imediato do objeto.

Nenhum destes 4 é o tipo de forma que apareceu nos 8 ataques do G2 rodada 1 nem nos
3 do G2 rodada 2 (X/Y/Z, todos fechados) — são deliberadamente mais adversariais
(exigem ofuscação ativa ou análise de fluxo, não só uma escolha de estilo comum como
alias de import, método de classe ou destructuring). Ainda assim, ficam registrados
aqui em vez de escondidos.

**Julgamento explícito sobre por que estes 4 continuam fora do escopo desta rodada**
(a rodada 2 do G2 já cobrou isso da rodada 1 — não repetir o mesmo erro): #1 e #3
são as mais plausíveis das 4 (indireção por parâmetro é um padrão de DI manual/teste
reconhecível; nome de método dinâmico aparece em clients HTTP genéricos), mas fechar
qualquer uma delas exige `ts.TypeChecker`/`ts.Program` real (resolução de tipo,
possivelmente com resolução de módulo) OU análise de fluxo de dados
interprocedural — uma mudança de escala de esforço bem maior que trocar mapa plano
por pilha de escopos (que foi suficiente para X/Y/Z). Nenhuma das 4 apareceu em
código real deste projeto até hoje (reconfirmado por leitura de todos os
`*.service.ts` dos 2 apps nesta rodada, não só herdado da rodada 1) — mas, seguindo
a mesma régua que fez o ataque X ser `Critical` na rodada passada ("plausível o
bastante para importar", não "já apareceu"), não afirmamos aqui que #1/#3 são baixo
risco só porque não apareceram ainda. Ficam como candidato explícito de próxima
rodada SE o custo de um `ts.TypeChecker`/`ts.Program` completo for julgado
proporcional — não foi julgado proporcional nesta rodada porque o Critical
obrigatório (X) e os achados desta rodada fecharam sem precisar dele.

## Por que a v3 é mais difícil de burlar que a v2

A v2 dependia de um MAPA PLANO por arquivo — todo identificador com um dado nome
resolvia para o mesmo vínculo em QUALQUER lugar do arquivo, sem noção de escopo.
Isso deixava 2 buracos: um identificador desestruturado (`get`) nunca era
reconhecido como acesso a `apiClient.get`, porque o mapa só sabia resolver o OBJETO
de uma chamada `objeto.metodo(...)`, nunca um identificador solto; e o fallback de
texto cru (para quando o mapa não tinha entrada) tratava qualquer identificador com
o NOME "apiClient" como o client real, mesmo sem vínculo nenhum. A v3 resolve os 2
de uma vez trocando o mapa plano por uma pilha de escopos léxicos real: agora
existem 3 tipos de vínculo (objeto canônico direto; MEMBRO desestruturado de um
objeto canônico; e, desde o incremento pós-G2 rodada 3, `'bloqueado'` — declaração
local sem inicializador resolvível, que faz a busca de escopo PARAR ali em vez de
subir ao pai e achar por engano um vínculo do escopo externo, ver Ataque D acima),
resolvidos por busca de escopo (de dentro pra fora, correto sobre sombreamento —
incluindo redeclaração local do MESMO nome com valor não-resolvível, não só
sombreamento entre funções irmãs) em vez de por texto — e não há mais fallback: um
identificador sem vínculo confirmado nunca conta como toque de rede.

As 4 lacunas que sobram (acima) não são sobre RESOLUÇÃO DE ESCOPO (que a v3 já
resolve corretamente) — são sobre INDIREÇÃO DE VALOR que atravessa a fronteira de
uma função (parâmetro) ou de um tipo (cast) ou que só é decidível em runtime (nome
dinâmico, invocação indireta). Fechar essas 4 exigiria resolução de tipo real (via
`ts.TypeChecker`, não `ts.createSourceFile` isolado por arquivo) ou análise de
fluxo de dados interprocedural — categoricamente mais caro que trocar mapa plano por
pilha de escopos, que foi suficiente para fechar X/Y/Z desta rodada.
