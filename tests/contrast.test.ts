// BR-CLI-T01 — gate de contraste WCAG 2.x sobre os tokens REAIS do app.
// Valores de referência: Design System KURA (tema "Noite" = dark, "Areia" = light).
// Limiar de texto = 4.5, sem exceção (sem "par limítrofe").
import fs from 'fs';
import path from 'path';
import { darkColors, lightColors } from '../src/theme/tokens';

type Cores = Record<string, string>;
type Tema = 'claro' | 'escuro';
const TEMA_NOMES: Tema[] = ['claro', 'escuro'];
const TEMAS: Record<Tema, Cores> = {
  claro: lightColors as unknown as Cores,
  escuro: darkColors as unknown as Cores,
};
const SRC_DIR = path.join(__dirname, '..', 'src');

function canal(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminancia(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}
export function ratio(a: string, b: string): number {
  const x = luminancia(a);
  const y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
// Trunca a 2 casas — nunca arredonda a favor: 4.495 NÃO vira 4.50.
const truncado = (r: number) => Math.floor(r * 100) / 100;

type Par = { tema: Tema; texto: string; fundo: string; limiar: number; nota?: string };
const TEXTO = 4.5;
const BORDA = 3;

const PARES: Par[] = [
  // --- escuro: os pares que a auditoria F5 reprova no marinho ---
  { tema: 'escuro', texto: 'textOnPrimary', fundo: 'primary', limiar: TEXTO },
  { tema: 'escuro', texto: 'textOnPrimary', fundo: 'primarySoft', limiar: TEXTO },
  { tema: 'escuro', texto: 'primary', fundo: 'surface', limiar: TEXTO },
  { tema: 'escuro', texto: 'primary', fundo: 'bg', limiar: TEXTO },
  { tema: 'escuro', texto: 'primary', fundo: 'primaryPale', limiar: TEXTO },
  { tema: 'escuro', texto: 'textMuteInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'escuro', texto: 'textMuteInk', fundo: 'bgSunk', limiar: TEXTO },
  { tema: 'escuro', texto: 'textMuteInk', fundo: 'primaryPale', limiar: TEXTO },
  { tema: 'escuro', texto: 'info', fundo: 'infoBg', limiar: TEXTO },
  { tema: 'escuro', texto: 'success', fundo: 'successBg', limiar: TEXTO },
  { tema: 'escuro', texto: 'danger', fundo: 'surface', limiar: TEXTO },
  { tema: 'escuro', texto: 'danger', fundo: 'primaryPale', limiar: TEXTO },
  { tema: 'escuro', texto: 'danger', fundo: 'dangerBg', limiar: TEXTO },
  { tema: 'escuro', texto: 'amberInk', fundo: 'amberPale', limiar: TEXTO },
  { tema: 'escuro', texto: 'clayInk', fundo: 'clayPale', limiar: TEXTO },
  { tema: 'escuro', texto: 'amberInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'escuro', texto: 'clayInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'escuro', texto: 'text', fundo: 'bg', limiar: TEXTO },
  { tema: 'escuro', texto: 'borderControl', fundo: 'bg', limiar: BORDA, nota: 'borda de controle' },
  { tema: 'escuro', texto: 'borderControl', fundo: 'surface', limiar: BORDA, nota: 'borda de controle' },
  // --- nav, vídeo e fundos tingidos (tokens semânticos / pares de uso real) ---
  { tema: 'escuro', texto: 'navText', fundo: 'navBg', limiar: TEXTO },
  { tema: 'escuro', texto: 'navBrand', fundo: 'navBg', limiar: TEXTO },
  { tema: 'escuro', texto: 'navActiveText', fundo: 'navActiveBg', limiar: TEXTO },
  { tema: 'escuro', texto: 'videoText', fundo: 'videoBg', limiar: TEXTO },
  { tema: 'escuro', texto: 'textSoft', fundo: 'infoBg', limiar: TEXTO },
  { tema: 'escuro', texto: 'textSoft', fundo: 'sagePale', limiar: TEXTO },
  { tema: 'escuro', texto: 'textSoft', fundo: 'bgSunk', limiar: TEXTO },
  { tema: 'escuro', texto: 'textOnPrimary', fundo: 'clayInk', limiar: TEXTO },
  // --- claro ---
  { tema: 'claro', texto: 'amberInk', fundo: 'amberPale', limiar: TEXTO },
  { tema: 'claro', texto: 'amberInk', fundo: 'bg', limiar: TEXTO },
  { tema: 'claro', texto: 'amberInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'claro', texto: 'clayInk', fundo: 'clayPale', limiar: TEXTO },
  { tema: 'claro', texto: 'clayInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'claro', texto: 'clayInk', fundo: 'bg', limiar: TEXTO },
  { tema: 'claro', texto: 'textMuteInk', fundo: 'bg', limiar: TEXTO },
  { tema: 'claro', texto: 'textMuteInk', fundo: 'surface', limiar: TEXTO },
  { tema: 'claro', texto: 'danger', fundo: 'surface', limiar: TEXTO },
  { tema: 'claro', texto: 'primary', fundo: 'primaryPale', limiar: TEXTO },
  { tema: 'claro', texto: 'textOnPrimary', fundo: 'primary', limiar: TEXTO },
  { tema: 'claro', texto: 'text', fundo: 'bg', limiar: TEXTO },
  { tema: 'claro', texto: 'borderControl', fundo: 'bg', limiar: BORDA, nota: 'borda de controle' },
  { tema: 'claro', texto: 'borderControl', fundo: 'surface', limiar: BORDA, nota: 'borda de controle' },
  { tema: 'claro', texto: 'navText', fundo: 'navBg', limiar: TEXTO },
  { tema: 'claro', texto: 'navBrand', fundo: 'navBg', limiar: TEXTO },
  { tema: 'claro', texto: 'navActiveText', fundo: 'navActiveBg', limiar: TEXTO },
  { tema: 'claro', texto: 'videoText', fundo: 'videoBg', limiar: TEXTO },
  { tema: 'claro', texto: 'textSoft', fundo: 'infoBg', limiar: TEXTO },
  { tema: 'claro', texto: 'textSoft', fundo: 'sagePale', limiar: TEXTO },
  { tema: 'claro', texto: 'textSoft', fundo: 'bgSunk', limiar: TEXTO },
  { tema: 'claro', texto: 'textOnPrimary', fundo: 'clayInk', limiar: TEXTO },
];

describe('ratio (sanidade WCAG)', () => {
  it('preto x branco = 21', () => {
    expect(ratio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });
  it('controle do DS: amber sobre bg (claro) = 2.85', () => {
    expect(ratio('#C8810D', '#F8F2E6')).toBeCloseTo(2.85, 2);
  });
  it('controle do DS: danger sobre dangerBg (claro) = 4.43 — por isso o botão danger não usa dangerBg', () => {
    expect(truncado(ratio('#B14A2F', '#F7E5DF'))).toBeLessThan(TEXTO);
  });
  it('truncamento não arredonda a favor (4.495 -> 4.49)', () => {
    expect(truncado(4.495)).toBe(4.49);
  });
});

describe('contraste dos tokens reais', () => {
  it.each(PARES)('$tema: $texto sobre $fundo >= $limiar', ({ tema, texto, fundo, limiar }) => {
    const t = TEMAS[tema];
    const a = t[texto];
    const b = t[fundo];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(truncado(ratio(a as string, b as string))).toBeGreaterThanOrEqual(limiar);
  });
});

function arquivosFonte(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__') continue;
      arquivosFonte(p, acc);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}
const ler = (arq: string) => fs.readFileSync(path.join(SRC_DIR, arq), 'utf8');

// Pares de USO REAL: arquivo -> fg/bg efetivos (o fundo é o do JSX, não o do tema).
// `ancora` precisa casar no arquivo: se alguém trocar o token no componente, a
// âncora deixa de bater e o par aqui deixa de ser verdade.
type Uso = { arq: string; ancora: RegExp; texto: string; fundo: string; limiar?: number };
const TELE = 'app/(app)/teleorientacao/[idPet].tsx';
const PD = 'components/domain/ProximosDoDia.tsx';
const USOS: Uso[] = [
  {
    arq: 'components/primitives/KCButton.tsx',
    ancora: /backgroundColor: colors\.surface, borderWidth: 1, borderColor: colors\.danger/,
    texto: 'danger',
    fundo: 'surface',
  },
  { arq: TELE, ancora: /fontSize: 12,\s*color: colors\.textSoft,\s*flex: 1/, texto: 'textSoft', fundo: 'infoBg' },
  { arq: TELE, ancora: /color: colors\.textSoft,\s*marginTop: 8/, texto: 'textSoft', fundo: 'infoBg' },
  {
    arq: 'components/domain/LancarCobrancaCard.tsx',
    ancora: /confirmacaoDetalhe: .*color: colors\.textSoft/,
    texto: 'textSoft',
    fundo: 'sagePale',
  },
  { arq: 'app/(app)/tutores/novo.tsx', ancora: /avisoNota: .*color: colors\.textSoft/, texto: 'textSoft', fundo: 'bgSunk' },
  { arq: 'components/primitives/KCBadge.tsx', ancora: /color \?\? colors\.clayInk/, texto: 'textOnPrimary', fundo: 'clayInk' },
  { arq: 'components/layout/NavDrawer.tsx', ancora: /color: colors\.navText,/, texto: 'navText', fundo: 'navBg' },
  { arq: 'components/layout/NavDrawer.tsx', ancora: /color: colors\.navBrand,/, texto: 'navBrand', fundo: 'navBg' },
  {
    arq: 'components/layout/NavDrawer.tsx',
    ancora: /color: colors\.navActiveText/,
    texto: 'navActiveText',
    fundo: 'navActiveBg',
  },
  { arq: TELE, ancora: /color: colors\.videoText,\s*\},\s*videoSubtitle/, texto: 'videoText', fundo: 'videoBg' },
  { arq: TELE, ancora: /backgroundColor: colors\.videoBg/, texto: 'videoText', fundo: 'videoBg' },
  // BR-CLI-T02: sheet de confirmação e toast, ambos sobre bgElev.
  {
    arq: 'components/feedback/ConfirmHost.tsx',
    ancora: /backgroundColor: colors\.bgElev,[\s\S]*titulo: .*color: colors\.text \}/,
    texto: 'text',
    fundo: 'bgElev',
  },
  {
    arq: 'components/feedback/ConfirmHost.tsx',
    ancora: /backgroundColor: colors\.bgElev,[\s\S]*mensagem: .*color: colors\.textSoft/,
    texto: 'textSoft',
    fundo: 'bgElev',
  },
  {
    arq: 'components/feedback/Toast.tsx',
    ancora: /backgroundColor: colors\.bgElev,\s*\},\s*texto: .*color: colors\.text,/,
    texto: 'text',
    fundo: 'bgElev',
  },
  // BR-CLI-T02 fix wave (M-2): ícone (`color={cor}`) e borda (`borderColor: cor`) do toast são
  // componentes gráficos / limite de componente — WCAG 1.4.11, limiar 3, sobre bgElev.
  ...(['success', 'danger', 'info'] as const).map(
    (cor): Uso => ({
      arq: 'components/feedback/Toast.tsx',
      ancora: new RegExp(
        String.raw`[?:] colors\.${cor}\b[\s\S]*?borderColor: cor[\s\S]*?color=\{cor\}`,
      ),
      texto: cor,
      fundo: 'bgElev',
      limiar: BORDA,
    }),
  ),
  // BR-CLI-T03: QueryState / ErrorState. O ErrorState aparece direto no `bg` da tela e dentro
  // de KCCard (`surface`, ficha do pet); a faixa "dados salvos" é `infoBg`.
  ...(['bg', 'surface'] as const).flatMap((fundo): Uso[] => [
    {
      arq: 'components/feedback/ErrorState.tsx',
      ancora: /titulo: \{[^}]*color: colors\.text,/,
      texto: 'text',
      fundo,
    },
    {
      arq: 'components/feedback/ErrorState.tsx',
      ancora: /descricao: \{[^}]*color: colors\.textSoft,/,
      texto: 'textSoft',
      fundo,
    },
    {
      arq: 'components/feedback/ErrorState.tsx',
      ancora: /linhaTexto: \{[^}]*color: colors\.text,/,
      texto: 'text',
      fundo,
    },
    // M-4 (G2): botão ghost do ErrorState `compacto` (texto `primary`, 4.5) e ícone do bloco
    // centrado (`textMuteInk`, componente gráfico, limiar 3).
    {
      arq: 'components/feedback/ErrorState.tsx',
      ancora: /variant="ghost"\s*size="sm"\s*onPress=\{onRetry\}/,
      texto: 'primary',
      fundo,
    },
    {
      arq: 'components/feedback/ErrorState.tsx',
      ancora: /<KCIcon name="alert" size=\{40\} color=\{colors\.textMuteInk\}/,
      texto: 'textMuteInk',
      fundo,
      limiar: BORDA,
    },
  ]),
  {
    arq: 'components/feedback/QueryState.tsx',
    ancora: /backgroundColor: colors\.infoBg,[\s\S]*faixaTexto: \{[^}]*color: colors\.text,/,
    texto: 'text',
    fundo: 'infoBg',
  },
  {
    arq: 'components/feedback/QueryState.tsx',
    ancora: /backgroundColor: colors\.infoBg,[\s\S]*variant="ghost"[\s\S]*query-state-salvos-retry/,
    texto: 'primary',
    fundo: 'infoBg',
  },
  // I-4: botão secondary "Tentar novamente" dentro do vídeo, com fundo surface próprio.
  {
    arq: TELE,
    ancora: /style=\{\{ backgroundColor: colors\.surface \}\}\s*onPress=\{\(\) => criarSalaMutation\.mutate\(\)\}\s*testID="btn-tentar-novamente"/,
    texto: 'text',
    fundo: 'surface',
  },
  // BR-CLI-T05: "Entrar na sala" e "Iniciar chamada" (secondary, fundo surface) dentro do vídeo — texto.
  {
    arq: TELE,
    ancora: /style=\{\{ backgroundColor: colors\.surface \}\}\s*onPress=\{handleEntrarNaSala\}\s*testID="btn-entrar-sala"/,
    texto: 'text',
    fundo: 'surface',
  },
  {
    arq: TELE,
    ancora: /style=\{\{ backgroundColor: colors\.surface \}\}\s*onPress=\{\(\) => criarSalaMutation\.mutate\(\)\}\s*testID="btn-iniciar-chamada"/,
    texto: 'text',
    fundo: 'surface',
  },
  // ...e a FORMA: a borda do `secondary` (borderControl) contra o painel de vídeo, componente de UI >= 3:1 (o primary tinha o mesmo hex do painel no claro).
  {
    arq: TELE,
    ancora: /variant="secondary"\s*size="md"[\s\S]{0,420}onPress=\{handleEntrarNaSala\}/,
    texto: 'borderControl',
    fundo: 'videoBg',
    limiar: 3,
  },
  {
    arq: TELE,
    ancora: /variant="secondary"\s*size="md"[\s\S]{0,420}onPress=\{\(\) => criarSalaMutation\.mutate\(\)\}\s*testID="btn-iniciar-chamada"/,
    texto: 'borderControl',
    fundo: 'videoBg',
    limiar: 3,
  },
  // BR-CLI-T05 fix wave (G2 I-3): o trilho DESLIGADO do KCSwitchRow é o único sinal de forma do estado "off" —
  // componente de UI >= 3:1 contra o fundo da linha. Com `border` dava 1.25/1.12. Fundos reais: `surface`
  // (linhas dentro do KCCard de Configurações) e `bg` (Novo tutor, direto na tela).
  ...(['surface', 'bg'] as const).map((fundo) => ({
    arq: 'components/primitives/KCSwitchRow.tsx',
    ancora: /trackColor=\{\{ false: colors\.borderControl,/,
    texto: 'borderControl',
    fundo,
    limiar: 3,
  })),
  // ...e o polegar (`bgElev`) sobre o trilho nos dois estados: desligado = borderControl, ligado = primary (UI >= 3).
  {
    arq: 'components/primitives/KCSwitchRow.tsx',
    ancora: /thumbColor=\{colors\.bgElev\}/,
    texto: 'bgElev',
    fundo: 'borderControl',
    limiar: 3,
  },
  {
    arq: 'components/primitives/KCSwitchRow.tsx',
    ancora: /activeThumbColor: colors\.bgElev/,
    texto: 'bgElev',
    fundo: 'primary',
    limiar: 3,
  },
  // BR-CLI-T05 fix wave (G2 M-4): Voltar do AppHeader (rótulo = texto 4.5; ícone = UI 3) sobre o fundo do cabeçalho (`bg`).
  { arq: 'components/layout/AppHeader.tsx', ancora: /backLabel: \{[^}]*color: colors\.text,/, texto: 'text', fundo: 'bg' },
  { arq: 'components/layout/AppHeader.tsx', ancora: /safe: \{ backgroundColor: colors\.bg \}/, texto: 'text', fundo: 'bg' },
  {
    arq: 'components/layout/AppHeader.tsx',
    ancora: /<KCIcon name="back" size=\{22\} color=\{colors\.text\} \/>/,
    texto: 'text',
    fundo: 'bg',
    limiar: 3,
  },
  // ...e o ícone `sair` do rodapé do NavDrawer (UI >= 3) sobre `navBg`.
  {
    arq: 'components/layout/NavDrawer.tsx',
    ancora: /<KCIcon name="sair" size=\{22\} color=\{colors\.navText\} \/>/,
    texto: 'navText',
    fundo: 'navBg',
    limiar: 3,
  },
  // BR-CLI-T06: destaque do proximo (ocean-pale = primaryPale) e blocos do dia sobre `bg`. Texto secundario SOBRE o destaque
  // e `textSoft` (9.33/7.79), NUNCA `textMuteInk` (4.24 no claro: reprova) -- controle negativo registrado no G0.
  { arq: PD, ancora: /kicker: \{[^}]*color: colors\.textSoft/, texto: 'textSoft', fundo: 'primaryPale' },
  { arq: PD, ancora: /destaqueHora: \{[^}]*color: colors\.text \}/, texto: 'text', fundo: 'primaryPale' },
  { arq: PD, ancora: /fontSize: fontSize\['2xl'\],\s*lineHeight: fontSize\['2xl'\] \* 1\.2,\s*color: colors\.text,/, texto: 'text', fundo: 'primaryPale' },
  { arq: PD, ancora: /destaqueTutor: \{[^}]*color: colors\.textSoft/, texto: 'textSoft', fundo: 'primaryPale' },
  { arq: PD, ancora: /destaqueServico: \{[^}]*color: colors\.textSoft/, texto: 'textSoft', fundo: 'primaryPale' },
  { arq: PD, ancora: /destaqueTextoSuave: \{[^}]*color: colors\.textSoft/, texto: 'textSoft', fundo: 'primaryPale' },
  { arq: PD, ancora: /marcaTexto: \{[^}]*color: colors\.amberInk/, texto: 'amberInk', fundo: 'bg' },
  { arq: PD, ancora: /marcaLinha: \{[^}]*backgroundColor: colors\.amberInk/, texto: 'amberInk', fundo: 'bg', limiar: 3 },
  { arq: PD, ancora: /borderColor: colors\.primary,\s*borderRadius: radius\.xl/, texto: 'primary', fundo: 'bg', limiar: 3 },
  { arq: PD, ancora: /linhaHora: \{[^}]*color: colors\.text,/, texto: 'text', fundo: 'bg' },
  { arq: PD, ancora: /linhaPet: \{[^}]*color: colors\.text \}/, texto: 'text', fundo: 'bg' },
  { arq: PD, ancora: /linhaSub: \{[^}]*color: colors\.textMuteInk/, texto: 'textMuteInk', fundo: 'bg' },
  { arq: PD, ancora: /linhaAtraso: \{[^}]*color: colors\.textMuteInk/, texto: 'textMuteInk', fundo: 'bg' },
  { arq: PD, ancora: /secaoContagem: \{[^}]*color: colors\.textMuteInk/, texto: 'textMuteInk', fundo: 'bg' },
  { arq: PD, ancora: /secaoTitulo: \{[^}]*color: colors\.text \}/, texto: 'text', fundo: 'bg' },
  { arq: PD, ancora: /faixaTexto: \{[^}]*color: colors\.text,/, texto: 'text', fundo: 'bg' },
  { arq: 'components/domain/OnboardingChecklist.tsx', ancora: /recolhidoTexto: \{[^}]*color: colors\.textMuteInk/, texto: 'textMuteInk', fundo: 'bg' },
  // ...e o realce do proximo na Hoje (mesmo par: textSoft sobre primaryPale).
  { arq: 'app/(app)/agenda.tsx', ancora: /hojeCardDestaque: \{\s*backgroundColor: colors\.primaryPale/, texto: 'textSoft', fundo: 'primaryPale' },
  { arq: 'app/(app)/agenda.tsx', ancora: /hojeMetaTextDestaque: \{ color: colors\.textSoft \}/, texto: 'textSoft', fundo: 'primaryPale' },
  { arq: 'app/(app)/agenda.tsx', ancora: /hojeEsperaTextDestaque: \{ color: colors\.textSoft \}/, texto: 'textSoft', fundo: 'primaryPale' },
];

describe('contraste dos pares de uso real (arquivo -> fg/bg)', () => {
  const casos = USOS.flatMap((u) => TEMA_NOMES.map((tema) => ({ ...u, tema, min: u.limiar ?? TEXTO })));
  it.each(casos)('$tema: $arq $texto sobre $fundo >= $min', ({ arq, ancora, tema, texto, fundo, min }) => {
    expect(ancora.test(ler(arq))).toBe(true);
    const t = TEMAS[tema];
    expect(truncado(ratio(t[texto] as string, t[fundo] as string))).toBeGreaterThanOrEqual(min);
  });

  it('texto de vídeo e de nav sem opacidade', () => {
    expect(/video(Title|Subtitle|Message): \{[^}]*opacity/.test(ler(TELE))).toBe(false);
    expect(/user(Name|Crmv): \{[^}]*opacity/.test(ler('components/layout/NavDrawer.tsx'))).toBe(false);
  });

  it('botão danger não volta a dangerBg (danger/dangerBg = 4.43 no claro)', () => {
    expect(ler('components/primitives/KCButton.tsx').includes('dangerBg')).toBe(false);
  });

  it('surface2 não é usado em src/ (por isso textMuteInk/surface2 4.48 saiu da tabela)', () => {
    const usos: string[] = [];
    let viuTokens = false;
    for (const f of arquivosFonte(SRC_DIR)) {
      const txt = fs.readFileSync(f, 'utf8');
      if (f.endsWith(path.join('theme', 'tokens.ts'))) {
        viuTokens = txt.includes('surface2');
        continue;
      }
      if (/\bsurface2\b/.test(txt)) usos.push(path.relative(SRC_DIR, f));
    }
    expect(viuTokens).toBe(true); // controle positivo
    expect(usos).toEqual([]);
  });
});

describe('gate: amber/clay (e aliases de mesmo hex) nunca como cor de texto', () => {
  const arquivos = arquivosFonte(SRC_DIR);
  // amber/clay e qualquer alias de MESMO hex NO CLARO (ex.: `warning` = `amber`; é lá que o
  // texto reprova, 2.85-3.11). No escuro `danger` coincide com `clay` e é texto legítimo
  // (5.99 sobre surface) — por isso a comparação é só no claro. Tintas *Ink ficam de fora.
  const hexes = new Set([TEMAS.claro.amber, TEMAS.claro.clay]);
  // M-6 (re-G2): `textMute` também é proibido como texto (3.99 claro / 4.31 escuro) — use `textMuteInk`.
  const chaves = [
    ...Object.keys(TEMAS.claro).filter((k) => !/Ink$/.test(k) && hexes.has(TEMAS.claro[k])),
    'textMute',
  ];
  const re = new RegExp(`(?<![A-Za-z])color[:=]\\s*\\{?\\s*colors\\.(${chaves.join('|')})\\b`);

  it('varre arquivos de src/ (controle: a varredura enxerga o tokens.ts)', () => {
    expect(arquivos.some((f) => f.endsWith(path.join('theme', 'tokens.ts')))).toBe(true);
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it('as chaves proibidas incluem o alias warning (mesmo hex de amber)', () => {
    expect(chaves).toEqual(expect.arrayContaining(['amber', 'clay', 'warning']));
  });

  it('nenhum `color: colors.amber|clay|warning` (nem `color={...}`) em src/', () => {
    const achados: string[] = [];
    for (const f of arquivos) {
      fs.readFileSync(f, 'utf8')
        .split('\n')
        .forEach((l, i) => {
          if (re.test(l)) achados.push(`${path.relative(SRC_DIR, f)}:${i + 1}: ${l.trim()}`);
        });
    }
    expect(achados).toEqual([]);
  });

  it('regex pega o padrão proibido (controle positivo)', () => {
    expect(re.test('      color: colors.clay,')).toBe(true);
    expect(re.test('      color: colors.warning,')).toBe(true);
    expect(re.test('<KCIcon color={colors.amber} />')).toBe(true);
    expect(re.test('      color: colors.textMute,')).toBe(true);
    expect(re.test('      color: colors.textMuteInk,')).toBe(false); // a tinta ink é a permitida
    expect(re.test('      borderColor: colors.clay,')).toBe(false); // borderColor não é texto
  });
});
