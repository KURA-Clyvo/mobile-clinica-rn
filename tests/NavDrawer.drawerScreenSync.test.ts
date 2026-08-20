// Fix wave pós-G2 da task CQ-03 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — item 2.
//
// O G2 provou por mutação que renomear o `name=` de um `<Drawer.Screen>` em
// `src/app/(app)/_layout.tsx` (para um valor que não é chave de `ROUTES.app`)
// quebra o realce do item ativo do `NavDrawer` em silêncio — `tsc` e a suíte
// antiga ficavam verdes porque nada compara os dois lados do acoplamento:
// `NAV_ITEMS[].name` (o que o drawer OFERECE, com highlight) contra
// `<Drawer.Screen name=...>` (o que `_layout.tsx` REGISTRA como tela do
// navigator, de onde vem `state.routes[].name` que `NavDrawer.tsx:108` lê).
//
// Este teste deriva os dois lados do código-fonte (regra de ouro v7: nunca
// lista à mão) e falha se divergirem, em qualquer direção:
//   - tela em `_layout.tsx` sem item correspondente em `NAV_ITEMS` (usuário
//     não consegue navegar até ela pelo drawer, ou o highlight nunca acende
//     porque o nome não bate);
//   - item em `NAV_ITEMS` sem tela correspondente em `_layout.tsx` (o
//     highlight nunca acende porque `state.routes[].name` nunca vai ter esse
//     valor — o navigator não registrou nenhuma tela com esse nome).
import * as path from 'path';
import { discoverDrawerScreenNames } from '../src/components/layout/discoverDrawerScreenNames';
import { NAV_ITEMS } from '../src/components/layout/NavDrawer';

const LAYOUT_PATH = path.join(__dirname, '..', 'src', 'app', '(app)', '_layout.tsx');

describe('NavDrawer × _layout.tsx — sincronia derivada do código (fix wave pós-G2, CQ-03 item 2)', () => {
  const telasRegistradas = discoverDrawerScreenNames(LAYOUT_PATH);
  const nomesRegistrados = telasRegistradas.map((t) => t.nome);
  const nomesDrawer = NAV_ITEMS.map((item) => item.name);

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
