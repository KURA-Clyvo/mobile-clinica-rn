// CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — detector de lacuna de alvo
// de toque, regra de ouro v7: "inventário de cobertura escrito à mão apodrece
// em silêncio — o gate tem que derivar a lista de consumidores do código e
// falhar quando aparecer consumidor sem check". Mesmo padrão de
// `tests/smoke-coverage.test.ts` (TASK-81) e de `TenantFilterCoverageTests.cs`
// (backend-clinica-dotnet, TASK-38): descoberta por AST
// (`src/a11y/discoverInteractiveTouchables.ts`), nunca lista hardcoded — um
// `TouchableOpacity`/`Pressable` novo em `src/components/{primitives,layout,
// domain}` OU em `src/app/` (fix wave 2b, achado 2) sem entrada no registry
// (`tests/touchTargetRegistry.tsx`) FALHA este teste.
import * as path from 'path';
import { discoverInteractiveTouchables } from '../src/a11y/discoverInteractiveTouchables';
import { TOUCH_TARGET_REGISTRY } from './touchTargetRegistry';

const SRC_DIR = path.join(__dirname, '..', 'src');
const COMPONENTS_DIR = path.join(SRC_DIR, 'components');
const DIRS = [
  path.join(COMPONENTS_DIR, 'primitives'),
  path.join(COMPONENTS_DIR, 'layout'),
  path.join(COMPONENTS_DIR, 'domain'),
  // Achado 2 (fix wave 2b, G2): `src/app/` estava INTEIRAMENTE fora da
  // varredura — 14 tocáveis de 7 telas (agenda, pacientes/[id],
  // pacientes/index, receituario/[idPet], settings, login, register)
  // invisíveis a este gate, medido: 26 tocáveis totais (12 dos 3
  // diretórios de componentes + 14 novos) contra 46% de cobertura real
  // antes desta wave. `discoverInteractiveTouchables` já varre
  // recursivamente (fix wave 2), então só precisou entrar na lista.
  path.join(SRC_DIR, 'app'),
];

describe('touch-target-coverage — detector de lacuna de alvo de toque (CQ-08)', () => {
  const consumidores = discoverInteractiveTouchables(DIRS);
  const chavesDescobertas = new Set(consumidores.map((c) => c.key));
  const chavesRegistry = Object.keys(TOUCH_TARGET_REGISTRY);

  it('sanidade: a varredura por AST encontrou touchables de verdade (não zero por engano de path)', () => {
    expect(consumidores.length).toBeGreaterThan(0);
    // Trava um piso conhecido — 28 na medição da fix wave 3 (26 na fix wave
    // 2b: 12 dos 3 diretórios de componentes — KCButton, KCCard, KCChip,
    // KCTextField, AppHeader×2, NavDrawerItem, NavDrawer/logout,
    // LunaSuggestionBadge, PetListItem, TimelineItem, WhatsAppModal — MAIS
    // 14 de `src/app/`: AgendaAppointmentCard#1, AgendaScreen#1/#2/#3,
    // TimelineItemRow#1 e PacienteDetailScreen#1/#2 de pacientes/[id],
    // PacientesScreen#1, ReceituarioScreen#1/#2, SettingsScreen#1,
    // LoginScreen#1, RegisterScreen#1/#2 — MAIS 2 na fix wave 3, achado I-2
    // da G2 rodada 2: `Switch` entrou em `INTERACTIVE_TAGS`, achando os 2
    // `<Switch>` de `settings.tsx` que renumeraram SettingsScreen#1 para
    // #1/#2/#3). Se cair abaixo disso, é sinal de que o glob de diretório
    // ou a detecção de tag JSX quebrou silenciosamente (falso negativo, o
    // pior tipo de falha para este teste) — incluindo `src/app/` voltar a
    // cair fora da varredura, ou `Switch` sair de `INTERACTIVE_TAGS`.
    expect(consumidores.length).toBeGreaterThanOrEqual(28);
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
  // NOS DOIS EIXOS por RENDER real — é isto que dá a prova de mordida
  // exigida pelo brief: mutar a fonte (ex.: baixar um `height`) faz o
  // `verify()` correspondente falhar aqui.
  //
  // Fix wave 3 (achados I-1+I-3 da G2 rodada 2): até esta wave, o teste só
  // chamava `entrada.verify()` e confiava no `expect.hasAssertions()` —
  // nada confrontava o que `verify()` MEDIU contra a categoria DECLARADA.
  // A G2 mediu 2 explorações disso: (a) reetiquetar uma entrada
  // 'no-explicit-geometry' para 'meets-min' sem tocar `verify()` passava
  // 56/56 (o `verify()` seguia provando ausência, mas ninguém comparava);
  // (b) `verify: () => { expect(true).toBe(true); return; }` satisfazia
  // `hasAssertions()` sem medir nada de verdade. Hoje `verify()` DEVOLVE
  // `ResultadoVerify` e os 2 `expect()` abaixo fecham as duas: o primeiro
  // reprova (a) e qualquer `verify()` que não devolva 'meets-min'; o
  // segundo reprova WCAG 2.5.5 provado pela metade (só um eixo) — é o que
  // pegava `KCButton.tsx::KCButton#1` e `agenda.tsx::AgendaScreen#3` antes
  // desta wave corrigi-los (ver `touchTargetRegistry.tsx`).
  const meetsMin = Object.entries(TOUCH_TARGET_REGISTRY).filter(
    ([, v]) => v.category === 'meets-min',
  );
  it.each(meetsMin.map(([k, v]) => [k, v] as const))(
    "entrada 'meets-min' resolve os DOIS eixos (44×44) por render real: %s",
    (_chave, entrada) => {
      // Achado 3 da G2 (fix wave 2a): sem isto, um `verify: () => {}` vazio
      // PASSA — Jest não reprova teste sem asserção nenhuma. `hasAssertions()`
      // continua como defesa em profundidade — não é mais a ÚNICA defesa
      // (fix wave 3): mesmo que sobreviva a ela, o resultado precisa bater
      // com a categoria declarada e provar os dois eixos, abaixo.
      expect.hasAssertions();
      const resultado = entrada.verify();
      expect(resultado.categoriaMedida).toBe('meets-min');
      expect(resultado.eixos).toEqual(expect.arrayContaining(['altura', 'largura']));
    },
  );

  // Fix wave 3 (achado I-1 da G2 rodada 2): categoria nova — geometria
  // EXPLÍCITA em UM eixo só, com o outro genuinamente não fixável sem
  // quebrar layout (ex.: `KCButton`, full-width/dimensionado por
  // conteúdo). Diferente do bloco 'meets-min' acima: exige exatamente 1
  // eixo provado, não os 2 — mas ainda confronta a categoria medida contra
  // a declarada, pelo mesmo motivo do bloco acima.
  const meetsMinOneAxis = Object.entries(TOUCH_TARGET_REGISTRY).filter(
    ([, v]) => v.category === 'meets-min-one-axis',
  );
  it.each(meetsMinOneAxis.map(([k, v]) => [k, v] as const))(
    "entrada 'meets-min-one-axis' resolve EXATAMENTE 1 eixo (>=44px) por render real: %s",
    (_chave, entrada) => {
      expect.hasAssertions();
      const resultado = entrada.verify();
      expect(resultado.categoriaMedida).toBe('meets-min-one-axis');
      expect(resultado.eixos.length).toBe(1);
    },
  );

  // Metade 2, sentido inverso: cada entrada 'no-explicit-geometry' (ou
  // 'allowlisted-below-min') precisa REALMENTE confirmar o estado
  // declarado — se alguém adicionar minHeight depois e esquecer de
  // reclassificar a entrada como 'meets-min', este teste pega a alegação
  // stale (a categoria mentiria "não coberto" quando na verdade já está
  // coberto). Fix wave 3: agora confrontando `categoriaMedida` também,
  // pelo mesmo motivo do bloco 'meets-min' (I-1+I-3 da G2 rodada 2) — uma
  // entrada reetiquetada sem tocar `verify()` FALHA aqui, nomeando a chave.
  const semGeometria = Object.entries(TOUCH_TARGET_REGISTRY).filter(
    ([, v]) => v.category === 'no-explicit-geometry' || v.category === 'allowlisted-below-min',
  );
  it.each(semGeometria.map(([k, v]) => [k, v] as const))(
    'entrada não-conforme confirma o estado declarado por render real: %s',
    (_chave, entrada) => {
      // Mesmo raciocínio do bloco 'meets-min' acima (achado 3 da G2).
      expect.hasAssertions();
      const resultado = entrada.verify();
      expect(resultado.categoriaMedida).toBe(entrada.category);
    },
  );

  // Toda entrada que NÃO é 'meets-min' precisa de razão explícita e não
  // trivial — nunca uma string vazia ou um "TODO" que equivale a silêncio.
  // Fix wave 3: 'meets-min-one-axis' também precisa (não é 'meets-min'
  // puro) — provar 1 eixo só exige explicar por que o outro não é
  // fixável, mesmo contrato das categorias não-conformes.
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
  //
  // Fix wave 3 (achado I-1 da G2 rodada 2): antes desta wave, o número sob
  // a chave `"meets-min"` incluía entradas que só provavam 1 eixo (ex.:
  // `{"meets-min":5}` quando só 3 provavam os dois) — lia como conformidade
  // plena de WCAG 2.5.5 (44×44) sem ser. Com `meets-min-one-axis` como
  // categoria própria, o número sob `"meets-min"` só pode contar entradas
  // com os dois eixos provados — nenhuma mudança de código neste teste foi
  // necessária além de a categoria existir: `porCategoria` agrupa por
  // `entrada.category`, e a distinção já é a chave do objeto.
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
