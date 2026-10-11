// BR-CLI-T07 fix wave (G2 I-3) -- GATE DE RENDER do contraste de texto.
// O gate de texto-fonte (contrast.test.ts) so enxerga `color: colors.X` literal e e cego a cor
// indireta (`statusColor`, `colors[visual.grafico]`). Este mede o VALOR RESOLVIDO: renderiza,
// e para cada `Text` com texto, StyleSheet.flatten(style).color contra o backgroundColor do
// ancestral mais proximo (ou o proprio, para Text aninhado), >= 4.5 nos 2 temas.
import React from 'react';
import * as RN from 'react-native';
import { StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import { darkColors, lightColors } from '../src/theme/tokens';
import LunaScreen from '../src/app/(app)/luna';
import { KCChip } from '../src/components/primitives/KCChip';
import type { ChipTone } from '../src/components/primitives/KCChip';
import { TriagemCard } from '../src/components/domain/TriagemCard';
import { LunaDiagnostico } from '../src/components/domain/LunaDiagnostico';
import type { TriagemListaItem } from '../src/types/api';
import { URGENCIA_VISUAL } from '../src/utils/triagem';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: { children: unknown; style: unknown }) => {
    const { View } = require('react-native');
    const R = require('react');
    return R.createElement(View, { style }, children);
  },
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@hooks/useLuna', () => ({
  useLunaHealth: jest.fn(),
  useRelatorioTriagens: jest.fn(),
  useTriagens: jest.fn(),
}));
jest.mock('@hooks/useDashboard', () => ({ useAlertas: jest.fn() }));

import { useLunaHealth, useRelatorioTriagens, useTriagens } from '../src/hooks/useLuna';
import { useAlertas } from '../src/hooks/useDashboard';

const canal = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const lum = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
};
const ratio = (a: string, b: string) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const trunc = (r: number) => Math.floor(r * 100) / 100;
const LIMIAR = 4.5;
const HEX = /^#[0-9a-fA-F]{6}$/;

const SAUDE = {
  online: { status: 'ok', oracle: 'ok', kura_api: 'ok', httpStatus: 200 as const },
  degradado: { status: 'degraded', oracle: 'ok', kura_api: 'down', httpStatus: 503 as const },
  offline: { status: 'indisponivel' },
};

const item = (id: number, urgencia: TriagemListaItem['urgencia']): TriagemListaItem => ({
  idTriagem: id,
  dtTriagem: new Date(Date.now() - 60 * 60 * 1000),
  urgencia,
  sintomas: ['vomitou'],
  score: 40,
  regrasVersao: '1.4',
  encaminhadoVet: false,
  tutor: { id: 1, nome: 'Ana' },
  pets: [{ id: 2, nome: 'Rex', especie: 'Cão' }],
  trechoMensagem: 'Ele vomitou hoje cedo e esta quieto.',
});
const FILA = {
  items: [item(1, 'ALTA'), item(2, 'MEDIA'), item(3, 'BAIXA')],
  total: 3,
  page: 1,
  pageSize: 20,
};

interface Violacao {
  texto: string;
  cor: string;
  fundo: string;
  razao: number;
}

const estilo = (n: ReactTestInstance) =>
  StyleSheet.flatten(n.props.style) as Record<string, unknown> | undefined;
const ehHost = (n: ReactTestInstance) => typeof n.type === 'string';

/** Cada Text com texto direto: cor (propria ou herdada de Text pai) x fundo resolvido. */
function medirTextos(raiz: ReactTestInstance, fundoTela: string) {
  const violacoes: Violacao[] = [];
  let total = 0;
  for (const t of raiz.findAll((n) => String(n.type) === 'Text')) {
    const diretos = React.Children.toArray(t.props.children as React.ReactNode).filter(
      (c) => typeof c === 'string' || typeof c === 'number',
    );
    if (diretos.length === 0) continue;
    let cor: string | undefined;
    let fundo: string | undefined;
    for (let n: ReactTestInstance | null = t; n && (!cor || !fundo); n = n.parent) {
      if (!ehHost(n)) continue;
      const s = estilo(n);
      if (!cor && String(n.type) === 'Text' && typeof s?.color === 'string') cor = s.color;
      // 'transparent' (botoes ghost/secondary) nao e fundo: segue para o ancestral.
      if (!fundo && typeof s?.backgroundColor === 'string' && HEX.test(s.backgroundColor)) {
        fundo = s.backgroundColor;
      }
    }
    if (!cor) continue; // sem cor explicita: cor padrao do sistema, fora do escopo deste gate
    total++;
    const f = fundo ?? fundoTela;
    // Cor que nao e #RRGGBB daria NaN (e `NaN < 4.5` e falso => passaria calado): falha alto.
    const r = HEX.test(cor) && HEX.test(f) ? trunc(ratio(cor, f)) : 0;
    if (r < LIMIAR) violacoes.push({ texto: diretos.join(''), cor, fundo: f, razao: r });
  }
  return { total, violacoes };
}

const TEMAS = [
  ['claro', 'light', lightColors],
  ['escuro', 'dark', darkColors],
] as const;

function comTema(esquema: 'light' | 'dark', ui: React.ReactElement) {
  jest.spyOn(RN, 'useColorScheme').mockReturnValue(esquema);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  (useRelatorioTriagens as jest.Mock).mockReturnValue({
    data: {
      nrTotalTriagens: 10,
      distribuicaoUrgencia: { BAIXO: 5, MEDIO: 3, ALTO: 2 },
      nrEncaminhadasParaVet: 1,
    },
    isLoading: false,
  });
  (useTriagens as jest.Mock).mockReturnValue({ data: FILA, isLoading: false, isError: false });
  (useAlertas as jest.Mock).mockReturnValue({ data: [] });
});
afterEach(() => jest.restoreAllMocks());

describe.each(TEMAS)('gate de render -- texto resolvido >= 4.5 (%s)', (_nome, esquema, cores) => {
  it.each(Object.keys(SAUDE) as Array<keyof typeof SAUDE>)('status da Luna: %s', (estado) => {
    (useLunaHealth as jest.Mock).mockReturnValue({ data: SAUDE[estado] });
    const { getByTestId, UNSAFE_root } = comTema(esquema, <LunaScreen />);
    const status = medirTextos(getByTestId('status-text').parent!, cores.surface);
    expect(status.total).toBeGreaterThan(0);
    expect(status.violacoes).toEqual([]);
    const tela = medirTextos(UNSAFE_root, cores.bg);
    expect(tela.total).toBeGreaterThan(10);
    expect(tela.violacoes).toEqual([]);
  });

  it.each(['sage', 'amber', 'clay', 'ocean', 'mute'] as ChipTone[])('KCChip tom %s', (tone) => {
    const { UNSAFE_root } = comTema(esquema, <KCChip tone={tone}>Rotulo</KCChip>);
    const r = medirTextos(UNSAFE_root, cores.bg);
    expect(r.total).toBe(1);
    expect(r.violacoes).toEqual([]);
  });

  it.each(['ALTA', 'MEDIA', 'BAIXA'] as const)('TriagemCard %s (recolhido e aberto)', (urg) => {
    const { UNSAFE_root, getByTestId } = comTema(esquema, <TriagemCard item={item(9, urg)} />);
    expect(medirTextos(UNSAFE_root, cores.bg).violacoes).toEqual([]);
    fireEvent.press(getByTestId('fila-toque-9'));
    const r = medirTextos(UNSAFE_root, cores.bg);
    expect(r.total).toBeGreaterThan(5);
    expect(r.violacoes).toEqual([]);
  });

  it.each(['degradado', 'offline'] as const)('LunaDiagnostico (%s)', (estado) => {
    (useLunaHealth as jest.Mock).mockReturnValue({ data: SAUDE[estado] });
    const { UNSAFE_root } = comTema(esquema, <LunaDiagnostico />);
    const r = medirTextos(UNSAFE_root, cores.bg);
    expect(r.total).toBeGreaterThan(1);
    expect(r.violacoes).toEqual([]);
  });

  // G2 M-2: a barra do relatorio contra o TRILHO REAL (fundo resolvido do pai), >= 3:1 (1.4.11).
  it.each(['ALTO', 'MEDIO', 'BAIXO'])('barra do relatorio %s contra o trilho', (nivel) => {
    (useLunaHealth as jest.Mock).mockReturnValue({ data: SAUDE.online });
    const { getByTestId } = comTema(esquema, <LunaScreen />);
    const trilho = getByTestId(`urg-trilho-${nivel}`);
    const barra = getByTestId(`urg-barra-${nivel}`);
    const fundoTrilho = estilo(trilho)?.backgroundColor as string;
    const fundoBarra = estilo(barra)?.backgroundColor as string;
    expect(fundoBarra).toMatch(HEX);
    expect(fundoTrilho).toMatch(HEX);
    expect(trunc(ratio(fundoBarra, fundoTrilho))).toBeGreaterThanOrEqual(3);
  });

  // G2 M-1: o chip que o vet ve primeiro na fila tem de distinguir os 3 niveis (fundo, borda e
  // texto resolvidos). MUT-A: Baixa com tom 'amber' (igual a Media) tem de cair aqui.
  it('chips de Alta, Media e Baixa tem aparencia resolvida distinta', () => {
    const triplas = (['ALTA', 'MEDIA', 'BAIXA'] as const).map((n) => {
      const { getByTestId, getByText, unmount } = comTema(
        esquema,
        <KCChip tone={URGENCIA_VISUAL[n].chipTone} testID="c">
          x
        </KCChip>,
      );
      const caixa = estilo(getByTestId('c'));
      const texto = estilo(getByText('x'));
      unmount();
      return [caixa?.backgroundColor, caixa?.borderColor, texto?.color].join('|');
    });
    expect(new Set(triplas).size).toBe(3);
  });
});
