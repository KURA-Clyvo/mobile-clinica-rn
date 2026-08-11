# Limitações declaradas do detector de lacuna (`discover-network-consumers.ts`)

TASK-81 (`KURA_BACKLOG_FIX_7`). Histórico de rodadas:
- **Rodada de fix 1** (v1 → v2): reprovação G2 por `Critical` #1 — a versão 1 do
  walker (enumerava *funções exportadas* em `*.service.ts` topo-de-pasta) era cega a
  7 de 8 formas plausíveis de indireção. A v2 trocou "enumerar declarações e
  adivinhar" por "enumerar toda `CallExpression` que toca rede e subir a árvore até
  achar a função-mãe", resolvida por um MAPA PLANO de arquivo inteiro
  (identificador → nome canônico).
- **Rodada de fix 2** (v2 → v3), esta revisão: reprovação G2 rodada 2 por `Critical`
  novo — o mapa plano da v2 não reconhecia identificador desestruturado
  (`const { get } = apiClient; get(...)`) como chamada de rede, e caía num
  *fallback* de texto cru que gerava falso positivo para variável local homônima
  sem import. A v3 troca o mapa plano por uma **pilha de escopos léxicos real** (um
  escopo novo por `Block`, com busca de dentro pra fora) — ver o cabeçalho do
  próprio `discover-network-consumers.ts` para o raciocínio completo, com os 2
  tipos de vínculo (`objeto`/`membro`) que ela usa.

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
existem 2 tipos de vínculo (objeto canônico direto, e MEMBRO desestruturado de um
objeto canônico), resolvidos por busca de escopo (de dentro pra fora, correto sobre
sombreamento) em vez de por texto — e não há mais fallback: um identificador sem
vínculo confirmado nunca conta como toque de rede.

As 4 lacunas que sobram (acima) não são sobre RESOLUÇÃO DE ESCOPO (que a v3 já
resolve corretamente) — são sobre INDIREÇÃO DE VALOR que atravessa a fronteira de
uma função (parâmetro) ou de um tipo (cast) ou que só é decidível em runtime (nome
dinâmico, invocação indireta). Fechar essas 4 exigiria resolução de tipo real (via
`ts.TypeChecker`, não `ts.createSourceFile` isolado por arquivo) ou análise de
fluxo de dados interprocedural — categoricamente mais caro que trocar mapa plano por
pilha de escopos, que foi suficiente para fechar X/Y/Z desta rodada.
