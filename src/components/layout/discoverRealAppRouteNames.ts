// Fix wave pós-G2 da task CQ-05 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — item 2.
//
// A trava de sincronia da CQ-03 (`discoverDrawerScreenNames.ts` +
// `tests/NavDrawer.drawerScreenSync.test.ts`) compara dois textos escritos à
// mão pelo próprio app: `<Drawer.Screen name=...>` de `_layout.tsx` contra
// `NAV_ITEMS[].name`/`routeName` de `NavDrawer.tsx`. A G2 mediu que ela passa
// VERDE quando os dois lados concordam no MESMO nome errado — foi
// exatamente o caso de `name="pacientes"` (item 1 desta fix wave): nenhum
// dos dois lados batia com a rota real `pacientes/index`, e a trava nunca
// notou, porque nenhum dos dois lados era confrontado com a tabela de rotas
// real do expo-router.
//
// Este módulo é o TERCEIRO lado, derivado do próprio roteador — zero render,
// poucos segundos —, via a API oficial `getMockConfig` de
// `expo-router/testing-library` (o mesmo mecanismo que a G2 usou para achar
// o item 1: `getMockConfig('src/app')` lê o sistema de arquivos de rotas e
// devolve a tabela real, sem montar nada). Devolve o conjunto de nomes de
// tela REGISTRADOS pelo expo-router dentro do grupo `(app)` — a mesma chave
// que `state.routes[].name` carrega em runtime (ex.: "pacientes/index", não
// "pacientes").
//
// Vive em `src/` (não em `tests/`), mesmo motivo de `discoverDrawerScreenNames.ts`:
// `tsconfig.json` exclui `tests/` e o script `lint` só varre `src`
// (`package.json`) — colocar a derivação aqui garante que ela própria fica
// sob `tsc --noEmit` e `eslint src`. Só é importado por testes hoje, então
// não entra no bundle de produção (Metro resolve pelo grafo de import real a
// partir das telas, não por pasta).
import { getMockConfig } from 'expo-router/testing-library';

interface RotaComFilhas {
  screens?: Record<string, unknown>;
}

function ehRotaComFilhas(valor: unknown): valor is RotaComFilhas {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'screens' in valor &&
    typeof (valor as RotaComFilhas).screens === 'object' &&
    (valor as RotaComFilhas).screens !== null
  );
}

/**
 * Nomes de tela REAIS (registrados pelo expo-router) dentro do grupo
 * `(app)` de `diretorioApp` — as mesmas chaves que aparecem em
 * `state.routes[].name` em runtime. Lança se a forma esperada
 * (`__root > (app) > screens`) não for encontrada, em vez de devolver lista
 * vazia em silêncio — um `getMockConfig` que mudasse de forma derrubaria
 * este módulo sem aviso, e a regra de ouro v7 é falhar ruidosamente diante
 * de inventário que não pôde ser derivado.
 */
export function discoverRealAppRouteNames(diretorioApp: string): string[] {
  const cfg = getMockConfig(diretorioApp) as { screens?: Record<string, unknown> };
  const root = cfg.screens?.__root;
  if (!ehRotaComFilhas(root)) {
    throw new Error(
      `discoverRealAppRouteNames: getMockConfig("${diretorioApp}").screens.__root não tem "screens" — a forma da API mudou?`,
    );
  }
  const grupoApp = root.screens?.['(app)'];
  if (!ehRotaComFilhas(grupoApp)) {
    throw new Error(
      `discoverRealAppRouteNames: grupo "(app)" não encontrado (ou sem "screens") em getMockConfig("${diretorioApp}") — a estrutura de rotas mudou?`,
    );
  }
  return Object.keys(grupoApp.screens as Record<string, unknown>);
}
