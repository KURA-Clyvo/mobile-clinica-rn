// CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — detector de lacuna de alvo
// de toque, regra de ouro v7: "inventário de cobertura escrito à mão apodrece
// em silêncio — o gate tem que derivar a lista de consumidores do código e
// falhar quando aparecer consumidor sem check". Mesmo padrão de
// `tests/smoke-coverage.test.ts` (TASK-81) e de `TenantFilterCoverageTests.cs`
// (backend-clinica-dotnet, TASK-38): descoberta por AST
// (`src/a11y/discoverInteractiveTouchables.ts`), nunca lista hardcoded — um
// `TouchableOpacity`/`Pressable` novo em `src/components/{primitives,layout,
// domain}` sem entrada no registry (`tests/touchTargetRegistry.tsx`) FALHA
// este teste.
import * as path from 'path';
import { discoverInteractiveTouchables } from '../src/a11y/discoverInteractiveTouchables';
import { TOUCH_TARGET_REGISTRY } from './touchTargetRegistry';

const COMPONENTS_DIR = path.join(__dirname, '..', 'src', 'components');
const DIRS = [
  path.join(COMPONENTS_DIR, 'primitives'),
  path.join(COMPONENTS_DIR, 'layout'),
  path.join(COMPONENTS_DIR, 'domain'),
];

describe('touch-target-coverage — detector de lacuna de alvo de toque (CQ-08)', () => {
  const consumidores = discoverInteractiveTouchables(DIRS);
  const chavesDescobertas = new Set(consumidores.map((c) => c.key));
  const chavesRegistry = Object.keys(TOUCH_TARGET_REGISTRY);

  it('sanidade: a varredura por AST encontrou touchables de verdade (não zero por engano de path)', () => {
    expect(consumidores.length).toBeGreaterThan(0);
    // Trava um piso conhecido — 12 na medição desta task (KCButton, KCCard,
    // KCChip, KCTextField, AppHeader×2, NavDrawerItem, NavDrawer/logout,
    // LunaSuggestionBadge, PetListItem, TimelineItem, WhatsAppModal). Se cair
    // abaixo disso, é sinal de que o glob de diretório ou a detecção de tag
    // JSX quebrou silenciosamente (falso negativo, o pior tipo de falha para
    // este teste).
    expect(consumidores.length).toBeGreaterThanOrEqual(12);
  });

  // Metade 1: todo touchable descoberto por AST precisa estar no registry.
  // Um `TouchableOpacity`/`Pressable` novo (ou um alias condicional como o
  // `Container` de `KCChip.tsx`) sem entrada aqui FALHA este teste — é o
  // mecanismo central do detector (regra de ouro v7).
  it.each(consumidores.map((c) => [c.key] as const))(
    'touchable descoberto tem entrada no registry: %s',
    (chave) => {
      // `in`, não `toHaveProperty` — a chave tem pontos (formato
      // "arquivo.tsx::Componente#n"), e `toHaveProperty` interpreta ponto
      // como separador de path aninhado (mesma armadilha documentada em
      // tests/smoke-coverage.test.ts, achada na TASK-81).
      expect(chave in TOUCH_TARGET_REGISTRY).toBe(true);
    },
  );

  // Metade 1, sentido inverso: nenhuma entrada do registry pode ser órfã
  // (touchable que não existe mais, ou chave digitada errada que nunca bateu
  // com nada descoberto). Sem este teste o registry também apodreceria — só
  // que acumulando lixo em vez de ficar incompleto.
  it('o registry não tem entrada órfã (chave que não corresponde a nenhum touchable descoberto)', () => {
    const orfas = chavesRegistry.filter((k) => !chavesDescobertas.has(k));
    expect(orfas).toEqual([]);
  });

  // Metade 2: cada entrada 'meets-min' precisa REALMENTE resolver >= 44px
  // por RENDER real (não confiar na categoria declarada) — é isto que dá a
  // prova de mordida exigida pelo brief: mutar a fonte (ex.: baixar um
  // `height`) faz o `verify()` correspondente falhar aqui.
  const meetsMin = Object.entries(TOUCH_TARGET_REGISTRY).filter(
    ([, v]) => v.category === 'meets-min',
  );
  it.each(meetsMin.map(([k, v]) => [k, v] as const))(
    "entrada 'meets-min' resolve geometria >= touchTarget.min por render real: %s",
    (_chave, entrada) => {
      entrada.verify();
    },
  );

  // Metade 2, sentido inverso: cada entrada 'no-explicit-geometry' precisa
  // REALMENTE não ter geometria declarada — se alguém adicionar minHeight
  // depois e esquecer de reclassificar a entrada como 'meets-min', este
  // teste pega a alegação stale (a categoria mentiria "não coberto" quando
  // na verdade já está coberto).
  const semGeometria = Object.entries(TOUCH_TARGET_REGISTRY).filter(
    ([, v]) => v.category === 'no-explicit-geometry' || v.category === 'allowlisted-below-min',
  );
  it.each(semGeometria.map(([k, v]) => [k, v] as const))(
    'entrada não-conforme confirma o estado declarado por render real: %s',
    (_chave, entrada) => {
      entrada.verify();
    },
  );

  // Toda entrada que NÃO é 'meets-min' precisa de razão explícita e não
  // trivial — nunca uma string vazia ou um "TODO" que equivale a silêncio.
  it('toda entrada não-conforme carrega razão explícita (>10 caracteres)', () => {
    for (const [chave, entrada] of Object.entries(TOUCH_TARGET_REGISTRY)) {
      if (entrada.category === 'meets-min') continue;
      expect(entrada.reason?.trim().length ?? 0).toBeGreaterThan(10);
      // eslint-disable-next-line no-console
      console.log(`[touch-target-coverage] ${entrada.category} — ${chave}: ${entrada.reason}`);
    }
  });

  // Resumo sempre visível no output — números "conformes x não-conformes"
  // nunca ficam só na cabeça de quem rodou o teste uma vez.
  it('imprime o resumo de cobertura (visível, não silencioso)', () => {
    const porCategoria = Object.values(TOUCH_TARGET_REGISTRY).reduce<Record<string, number>>(
      (acc, entrada) => {
        acc[entrada.category] = (acc[entrada.category] ?? 0) + 1;
        return acc;
      },
      {},
    );
    // eslint-disable-next-line no-console
    console.log(
      `[touch-target-coverage] mobile-clinica-rn: ${JSON.stringify(porCategoria)} / ` +
        `${consumidores.length} touchables descobertos por AST`,
    );
    expect(Object.values(porCategoria).reduce((a, b) => a + b, 0)).toBe(consumidores.length);
  });
});
