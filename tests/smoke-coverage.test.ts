// TASK-81 (KURA_BACKLOG_FIX_7) — detector de lacuna, regra de ouro v7:
// "inventário de cobertura escrito à mão apodrece em silêncio — o gate tem que
// derivar a lista de consumidores do código e falhar quando aparecer consumidor sem
// check". O FIX_6 acertou o diagnóstico e errou a implementação (4 checks à mão,
// ninguém verificou o resto). Este teste troca "lembrar de auditar" por "o build
// quebra" — mesmo padrão de `TenantFilterCoverageTests.cs` (backend-clinica-dotnet,
// TASK-38): descoberta por reflection/AST, não lista hardcoded; qualquer função nova
// que bata no critério de descoberta entra automaticamente na cobertura deste teste.
//
// Espelho de mobile-tutor-rn/src/__tests__/smoke-coverage.test.ts (repos separados,
// duplicado de propósito). Duas metades, cada uma com prova de mordida documentada
// no relatório da TASK-81 (não neste arquivo — reproduzida manualmente antes do
// commit, revertida depois):
//   (1) toda função de service que a AST marca como "chama a rede" tem entrada no
//       registry (SMOKE_COVERAGE_REGISTRY) — adicionar uma função nova sem registrar
//       quebra aqui;
//   (2) toda entrada `coberto: "<nome>"` do registry aponta pra um check que existe
//       DE VERDADE em DevOps-Cloud/scripts/smoke-contratos.sh — apontar para um nome
//       inexistente quebra aqui.
//
// TASK-81, rodada de fix 1 (G2 Important #5 — task-81-review.md seção 7): o walker
// e o registry viviam em tests/support/ e tests/smoke-coverage.registry.ts,
// excluídos de `tsc --noEmit` (tsconfig.json exclui "tests") E de `eslint src`
// (o script `lint` só varre `src`) — provado por mutação pelo G2 (erro de tipo
// injetado, nenhum dos 2 comandos acusou). Movidos para src/smokeCoverage/,
// espelhando onde mobile-tutor-rn já colocava o código equivalente (que SEMPRE
// teve tsc/eslint cobrindo, por estar em src/) — só o arquivo de teste em si
// (que precisa ficar sob `tests/` para o testPathPattern do jest.config.js
// encontrá-lo) continua aqui, importando de ../src/smokeCoverage como qualquer
// outro teste deste repo já faz (ex.: tests/dashboard.service.test.ts).
import * as fs from 'fs';
import * as path from 'path';
import { discoverNetworkConsumers, extrairNomesDeCheck } from '../src/smokeCoverage/discover-network-consumers';
import { SMOKE_COVERAGE_REGISTRY } from '../src/smokeCoverage/registry';

const SERVICE_DIR = path.join(__dirname, '..', 'src', 'services');

describe('smoke-coverage — detector de lacuna do smoke-contratos.sh (TASK-81)', () => {
  const consumidores = discoverNetworkConsumers(SERVICE_DIR);
  const chavesDescobertas = new Set(consumidores.map((c) => c.key));
  const chavesRegistry = Object.keys(SMOKE_COVERAGE_REGISTRY);

  it('sanidade: a varredura por AST encontrou funções de rede de verdade (não zero por engano de path)', () => {
    expect(consumidores.length).toBeGreaterThan(0);
    // Trava um piso conhecido — se cair abaixo disso é sinal de que o glob de
    // serviceDir ou a detecção de `apiClient.`/`lunaClient.`/`File.downloadFileAsync`
    // quebrou silenciosamente (falso negativo, o pior tipo de falha para este teste).
    expect(consumidores.length).toBeGreaterThanOrEqual(21);
  });

  // Metade 1: toda função descoberta por AST precisa estar no registry. Uma função
  // exportada nova que chama apiClient/lunaClient e não tem entrada aqui FALHA este
  // teste — é o mecanismo central do detector.
  it.each(consumidores.map((c) => [c.key] as const))(
    'função consumidora de rede tem entrada no registry: %s',
    (chave) => {
      // NÃO usar toHaveProperty(chave): a chave tem o formato
      // "arquivo.service.ts::função", com pontos — toHaveProperty interpreta ponto
      // como separador de path aninhado (achado rodando o espelho deste teste em
      // mobile-tutor-rn pela primeira vez, TASK-81). `in` não sofre desse problema.
      expect(chave in SMOKE_COVERAGE_REGISTRY).toBe(true);
    },
  );

  // Metade 1, sentido inverso: nenhuma entrada do registry pode ser órfã (função que
  // não existe mais, ou nome digitado errado que nunca bateu com nada). Sem este
  // teste o registry também apodreceria — só que na direção oposta (acumulando lixo
  // em vez de ficar incompleto).
  it('o registry não tem entrada órfã (chave que não corresponde a nenhuma função descoberta)', () => {
    const orfas = chavesRegistry.filter((k) => !chavesDescobertas.has(k));
    expect(orfas).toEqual([]);
  });

  // Metade 2: fecha o laço "coberto: <nome>" contra o script real. Cross-repo por
  // natureza (DevOps-Cloud é outro repo) — precisa dele disponível localmente, seja
  // como repo irmão (ambiente de trabalho deste ciclo — CLAUDE.md descreve os 6
  // repos como irmãos sob a mesma raiz) seja como checkout aninhado dentro deste
  // workspace (CI, ver `.github/workflows/ci.yml` — passo "Checkout DevOps-Cloud",
  // adicionado na rodada de fix 1 da TASK-81 depois de o G2 apontar que a
  // alternativa de ler o repo público via `actions/checkout` com `repository:`
  // nunca tinha sido avaliada, só a de vendorizar cópia, que foi corretamente
  // rejeitada por criar fonte dupla). Os 2 primeiros candidatos cobrem o layout de
  // repos irmãos local; o 3º cobre o checkout aninhado de CI
  // (`$GITHUB_WORKSPACE/DevOps-Cloud`, filho do checkout deste app, não irmão —
  // `path.join(__dirname, '..', 'DevOps-Cloud', ...)` sobe só 1 nível a partir de
  // `tests/`, o suficiente para chegar na raiz do checkout deste app e descer para
  // `DevOps-Cloud/`). Se nenhum dos 3 existir (ex.: alguém rodou este teste fora
  // dos 2 ambientes cobertos), a suíte pula esta metade explicitamente
  // (console.warn visível no output, não falha silenciosa) em vez de fingir tê-la
  // validado.
  const candidatosDevOpsCloud = [
    path.join(__dirname, '..', '..', 'DevOps-Cloud', 'scripts', 'smoke-contratos.sh'),
    path.join(__dirname, '..', '..', '..', 'DevOps-Cloud', 'scripts', 'smoke-contratos.sh'),
    path.join(__dirname, '..', 'DevOps-Cloud', 'scripts', 'smoke-contratos.sh'),
  ];
  const smokeScriptPath = candidatosDevOpsCloud.find((p) => fs.existsSync(p));

  if (smokeScriptPath) {
    const nomesDeCheckReais = extrairNomesDeCheck(fs.readFileSync(smokeScriptPath, 'utf-8'));
    const cobertos = Object.entries(SMOKE_COVERAGE_REGISTRY).filter(
      (e): e is [string, { coberto: string }] => 'coberto' in e[1],
    );

    it.each(cobertos.map(([k, v]) => [k, v.coberto] as const))(
      "entrada 'coberto' de %s aponta para um check que existe de fato: %s",
      (_chave, nomeCheck) => {
        expect(nomesDeCheckReais.has(nomeCheck)).toBe(true);
      },
    );
  } else {
    it.skip('DevOps-Cloud não encontrado (nem irmão local, nem checkout aninhado de CI) — metade 2 (validação contra o script real) não rodou nesta execução', () => {
      // Intencionalmente vazio — o it.skip por si só já deixa a lacuna visível no
      // relatório do Jest (não conta como sucesso silencioso).
    });
    // eslint-disable-next-line no-console
    console.warn(
      '[smoke-coverage] DevOps-Cloud/scripts/smoke-contratos.sh não encontrado em nenhum dos 3 ' +
        'caminhos candidatos — a verificação de que os nomes "coberto" existem de fato no script ' +
        'NÃO rodou nesta execução. O CI deste app faz checkout do DevOps-Cloud público desde a ' +
        'rodada de fix 1 da TASK-81 (ver .github/workflows/ci.yml); isto só deveria disparar rodando ' +
        'este teste fora dos ambientes cobertos (ver task-81-report.md/task-81-fixround1-report.md).',
    );
  }

  // Toda entrada 'naoCoberto' precisa de razão visível e não-trivial — nunca uma
  // string vazia ou um "TODO" que equivale a silêncio.
  it('toda entrada naoCoberto carrega razão explícita, não trivial', () => {
    const naoCobertos = Object.entries(SMOKE_COVERAGE_REGISTRY).filter(
      (e): e is [string, { naoCoberto: string }] => 'naoCoberto' in e[1],
    );
    for (const [chave, entrada] of naoCobertos) {
      expect(entrada.naoCoberto.trim().length).toBeGreaterThan(10);
      // eslint-disable-next-line no-console
      console.log(`[smoke-coverage] não coberto — ${chave}: ${entrada.naoCoberto}`);
    }
  });

  // Resumo sempre visível no output — números "cobertos x não cobertos" nunca ficam
  // só na cabeça de quem rodou o teste uma vez.
  it('imprime o resumo de cobertura (visível, não silencioso)', () => {
    const cobertos = Object.values(SMOKE_COVERAGE_REGISTRY).filter((e) => 'coberto' in e).length;
    const naoCobertos = Object.values(SMOKE_COVERAGE_REGISTRY).filter((e) => 'naoCoberto' in e).length;
    // eslint-disable-next-line no-console
    console.log(
      `[smoke-coverage] mobile-clinica-rn: ${cobertos} cobertos / ${naoCobertos} não cobertos / ` +
        `${consumidores.length} funções de rede descobertas por AST`,
    );
    expect(cobertos + naoCobertos).toBe(consumidores.length);
  });
});
