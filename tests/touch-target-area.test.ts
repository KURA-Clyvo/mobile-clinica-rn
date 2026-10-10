// BR-CLI-T05 — gate de ÁREA EFETIVA de toque e de ROLE (WCAG 2.5.8 / 2.5.5).
//
// O que mede (estático, por AST, sobre `src/app` e `src/components/{primitives,layout,domain}`):
//   1. todo interativo declara `accessibilityRole`/`role` (exceto `<Switch>`, ver 3);
//   2. em cada eixo em que o tamanho está DECLARADO (height/minHeight, width/minWidth em `style` inline ou
//      em `styles.x` do mesmo arquivo), declarado + hitSlop (soma dos dois lados) >= `touchTarget.min` (44);
//   3. `<Switch>` só existe em `KCSwitchRow.tsx` (a linha de 44px é o alvo; o Switch nativo mede ~40×20);
//   4. regressão nominal da F6 (auditoria da clínica): os alvos que mediram < 44 no DOM seguem declarando
//      44 nos DOIS eixos.
//
// PONTOS CEGOS declarados (não fingimos cobrir):
//   - eixo sem tamanho declarado (padding/conteúdo definem a área): o detector não vê — são as entradas
//     'no-explicit-geometry' do `touchTargetRegistry.tsx` (15 na medição desta task), cada uma com razão;
//   - `style` vindo de variável, spread, função ou de outro arquivo: tratado como "não declarado";
//   - `hitSlop` só compensa no nativo (no web o RN-web ignora): a área do web depende do tamanho declarado;
//   - tamanho DECLARADO não é tamanho RENDERIZADO (Yoga/Dynamic Type): o jest não computa layout. A medição
//     de DOM da F6 é feita nos prints/sonda da task, não aqui.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { discoverInteractiveTouchables } from '../src/a11y/discoverInteractiveTouchables';
import type { TouchableConsumer } from '../src/a11y/discoverInteractiveTouchables';

const MIN = 44;
const SRC = path.join(__dirname, '..', 'src');
const DIRS = [
  path.join(SRC, 'components', 'primitives'),
  path.join(SRC, 'components', 'layout'),
  path.join(SRC, 'components', 'domain'),
  path.join(SRC, 'app'),
];

export function eixosAbaixoDoMinimo(c: TouchableConsumer): string[] {
  const falhas: string[] = [];
  if (c.declaredHeight !== undefined && c.declaredHeight + c.hitSlopVertical < MIN) {
    falhas.push(`altura ${c.declaredHeight}+hitSlop ${c.hitSlopVertical}`);
  }
  if (c.declaredWidth !== undefined && c.declaredWidth + c.hitSlopHorizontal < MIN) {
    falhas.push(`largura ${c.declaredWidth}+hitSlop ${c.hitSlopHorizontal}`);
  }
  return falhas;
}

/** Interativos sem role (o `Switch` mora só no KCSwitchRow, que tem o role na linha). */
export function semRole(cs: TouchableConsumer[]): string[] {
  return cs.filter((c) => !c.hasRole && !c.key.startsWith('KCSwitchRow.tsx::KCSwitchRow#2')).map((c) => c.key);
}

const consumidores = discoverInteractiveTouchables(DIRS);

describe('touch-target-area — role e área efetiva (BR-CLI-T05)', () => {
  it('sanidade: a varredura achou os interativos (não zero por engano de path)', () => {
    expect(consumidores.length).toBeGreaterThanOrEqual(60);
  });

  it('todo interativo declara accessibilityRole/role', () => {
    expect(semRole(consumidores)).toEqual([]);
  });

  it('nenhum interativo declara tamanho efetivo < 44 em um eixo declarado', () => {
    const ruins = consumidores
      .map((c) => [c.key, eixosAbaixoDoMinimo(c)] as const)
      .filter(([, f]) => f.length > 0)
      .map(([k, f]) => `${k}: ${f.join('; ')}`);
    expect(ruins).toEqual([]);
  });

  it('<Switch> só aparece em KCSwitchRow.tsx', () => {
    const achados: string[] = [];
    const varrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) varrer(p);
        else if (/\.tsx$/.test(e.name) && /<Switch[\s/>]/.test(fs.readFileSync(p, 'utf8'))) {
          achados.push(path.relative(SRC, p).split(path.sep).join('/'));
        }
      }
    };
    DIRS.forEach(varrer);
    expect(achados).toEqual(['components/primitives/KCSwitchRow.tsx']);
  });

  // Regressão nominal da F6: 17 interativos mediram < 44 no DOM. Por testID literal (os com testID
  // dinâmico, p.ex. `btn-status-menu-${id}`, são cobertos pelo teste de "tamanho efetivo" acima).
  const F6 = [
    'nav-drawer-logout', // "×" Sair 20×20
    'btn-voltar-agenda-novo-form', // seta Voltar 20×20
    'btn-voltar-selecao-tutor',
    'btn-voltar-novo-paciente',
    'btn-voltar-form-tutor',
    'register-back', // controle 22×22 sem nome nem role
    'btn-prev-week', // semana 28×28
    'btn-next-week',
    'password-toggle', // 👁 24×21
    'btn-iniciar-teleconsulta', // chip 99×22
    'login-register-link', // 342×18
    'register-go-login',
    'app-header-back',
    'expand-toggle', // "Ver mais" 306×17
  ];
  it.each(F6)('F6: %s declara 44 nos DOIS eixos', (testID) => {
    const c = consumidores.find((x) => x.testID === testID);
    expect(c).toBeDefined();
    expect((c?.declaredHeight ?? 0) + (c?.hitSlopVertical ?? 0)).toBeGreaterThanOrEqual(MIN);
    expect((c?.declaredWidth ?? 0) + (c?.hitSlopHorizontal ?? 0)).toBeGreaterThanOrEqual(MIN);
  });
});

// Controle positivo do PRÓPRIO gate (regra 13): fixtures sintéticas provam que o instrumento enxerga
// um 30×30 sem hitSlop, aceita o mesmo com hitSlop suficiente e acusa a falta de role.
describe('touch-target-area — controle positivo do detector', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-area-'));
  const escreve = (nome: string, jsx: string) =>
    fs.writeFileSync(
      path.join(tmp, nome),
      `import React from 'react';\nimport { Pressable, StyleSheet } from 'react-native';\n` +
        `const styles = StyleSheet.create({ pequeno: { width: 30, height: 30 }, ok: { width: 44, height: 44 } });\n` +
        `export function Tela() { return (${jsx}); }\n`,
    );
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('30×30 sem hitSlop é flagrado', () => {
    escreve('a.tsx', `<Pressable accessibilityRole="button" style={styles.pequeno} testID="p" />`);
    const c = discoverInteractiveTouchables([tmp])[0]!;
    expect(eixosAbaixoDoMinimo(c).length).toBe(2);
  });

  it('30×30 com hitSlop 7 (14 somados) passa; 44×44 passa', () => {
    escreve('a.tsx', `<><Pressable accessibilityRole="button" style={styles.pequeno} hitSlop={7} testID="p" /><Pressable accessibilityRole="button" style={styles.ok} testID="q" /></>`);
    const cs = discoverInteractiveTouchables([tmp]);
    expect(cs.length).toBe(2);
    cs.forEach((c) => expect(eixosAbaixoDoMinimo(c)).toEqual([]));
  });

  it('interativo sem role é flagrado', () => {
    escreve('a.tsx', `<Pressable style={styles.ok} testID="p" />`);
    expect(semRole(discoverInteractiveTouchables([tmp])).length).toBe(1);
  });
});
