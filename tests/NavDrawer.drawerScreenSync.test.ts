// Fix wave pós-G2 da task CQ-03 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — item 2.
// Estendida na fix wave pós-G2 da CQ-05 (mesmo backlog) — item 2, ver bloco
// "terceiro lado" mais abaixo.
//
// O G2 provou por mutação que renomear o `name=` de um `<Drawer.Screen>` em
// `src/app/(app)/_layout.tsx` (para um valor que não é chave de `ROUTES.app`)
// quebra o realce do item ativo do `NavDrawer` em silêncio — `tsc` e a suíte
// antiga ficavam verdes porque nada compara os dois lados do acoplamento:
// `NAV_ITEMS[].routeName ?? .name` (o que o drawer OFERECE, com highlight)
// contra `<Drawer.Screen name=...>` (o que `_layout.tsx` REGISTRA como tela
// do navigator, de onde vem `state.routes[].name` que `NavDrawer.tsx` lê).
//
// Este teste deriva os dois lados do código-fonte (regra de ouro v7: nunca
// lista à mão) e falha se divergirem, em qualquer direção:
//   - tela em `_layout.tsx` sem item correspondente em `NAV_ITEMS` (usuário
//     não consegue navegar até ela pelo drawer, ou o highlight nunca acende
//     porque o nome não bate);
//   - item em `NAV_ITEMS` sem tela correspondente em `_layout.tsx` (o
//     highlight nunca acende porque `state.routes[].name` nunca vai ter esse
//     valor — o navigator não registrou nenhuma tela com esse nome).
//
// LIMITE que a G2 achou, e que a CQ-05 fix wave fecha logo abaixo: os dois
// lados aqui são escritos à mão pelo próprio app. Se os dois concordarem no
// MESMO nome errado (foi exatamente o caso de "pacientes", que não bate com
// a rota real "pacientes/index"), esta comparação de dois lados passa
// verde — ela nunca confronta nenhum dos dois contra a tabela de rotas real
// do expo-router.
import * as path from 'path';
import { discoverDrawerScreenNames } from '../src/components/layout/discoverDrawerScreenNames';
import { discoverRealAppRouteNames } from '../src/components/layout/discoverRealAppRouteNames';
import { NAV_ITEMS } from '../src/components/layout/NavDrawer';

const LAYOUT_PATH = path.join(__dirname, '..', 'src', 'app', '(app)', '_layout.tsx');

describe('NavDrawer × _layout.tsx — sincronia derivada do código (fix wave pós-G2, CQ-03 item 2)', () => {
  const telasRegistradas = discoverDrawerScreenNames(LAYOUT_PATH);
  const nomesRegistrados = telasRegistradas.map((t) => t.nome);
  // `routeName ?? name`: é o valor real usado para o realce do item ativo
  // (ver NavDrawer.tsx) — não `name` puro, que só alimenta `href` e pode
  // divergir do nome de tela real (caso "pacientes", fix wave pós-G2 CQ-05
  // item 1).
  const nomesDrawer = NAV_ITEMS.map((item) => item.routeName ?? item.name);

  it('sanidade: a varredura por AST encontrou `<Drawer.Screen>` de verdade (não zero por engano de path)', () => {
    // Piso conhecido — se cair abaixo disso é sinal de que o parser ou o
    // caminho do layout quebrou silenciosamente (falso negativo).
    expect(telasRegistradas.length).toBeGreaterThanOrEqual(5);
  });

  it('nenhuma tela registrada em _layout.tsx é órfã de item no NavDrawer', () => {
    const orfas = nomesRegistrados.filter((n) => !nomesDrawer.includes(n));
    expect(orfas).toEqual([]);
  });

  it('nenhum item do NavDrawer é órfão de tela registrada em _layout.tsx', () => {
    const orfaos = nomesDrawer.filter((n) => !nomesRegistrados.includes(n));
    expect(orfaos).toEqual([]);
  });

  it('os dois lados têm exatamente o mesmo conjunto de nomes, sem duplicata escondendo divergência', () => {
    expect(new Set(nomesRegistrados)).toEqual(new Set(nomesDrawer));
    expect(nomesRegistrados.length).toBe(nomesDrawer.length);
  });
});

describe('terceiro lado: nomes registrados batem com a tabela de rotas REAL do expo-router (fix wave pós-G2, CQ-05 item 2)', () => {
  // `getMockConfig('src/app')` lê o sistema de arquivos de rotas — caminho é
  // relativo ao cwd do processo (raiz do repo quando o jest roda), não a
  // este arquivo de teste, por isso não é `path.join(__dirname, ...)` como
  // `LAYOUT_PATH` acima.
  const rotasReais = discoverRealAppRouteNames('src/app');
  const telasRegistradas = discoverDrawerScreenNames(LAYOUT_PATH);
  const nomesRegistrados = telasRegistradas.map((t) => t.nome);
  const nomesDrawer = NAV_ITEMS.map((item) => item.routeName ?? item.name);

  it('sanidade: a tabela de rotas real do grupo (app) tem um piso conhecido (9, medido pela G2)', () => {
    expect(rotasReais.length).toBeGreaterThanOrEqual(9);
  });

  it('todo <Drawer.Screen name=...> de _layout.tsx existe como rota real do expo-router', () => {
    // Esta é a asserção que fecha o furo da G2: se _layout.tsx e NavDrawer.tsx
    // concordarem no MESMO nome errado (ex.: reintroduzir "pacientes" nos
    // dois lados), o bloco acima passa verde — mas este `includes` contra a
    // tabela derivada de `getMockConfig` fica vermelho, porque "pacientes"
    // não é chave de nenhuma rota real registrada (a real é
    // "pacientes/index").
    const inexistentes = nomesRegistrados.filter((n) => !rotasReais.includes(n));
    expect(inexistentes).toEqual([]);
  });

  it('todo nome usado pelo NavDrawer para o realce do item ativo existe como rota real do expo-router', () => {
    const inexistentes = nomesDrawer.filter((n) => !rotasReais.includes(n));
    expect(inexistentes).toEqual([]);
  });
});
