// BR-CLI-T05 (ciclo BRANDING) — toda rota de `src/app/(app)` tem SAÍDA visível: hambúrguer, Voltar no
// cabeçalho do layout, ou um Voltar da própria tela.
//
// Regra v7: a lista de rotas é DERIVADA do roteador (`discoverRealAppRouteNames`, via `getMockConfig`),
// nunca escrita à mão — rota nova sem saída reprova este teste.
//
// Como se mede: o `<Drawer>` real não monta fora do app (ver tests/AppLayoutSidebar.test.tsx), então o
// mock captura cada `<Drawer.Screen>` do `_layout.tsx` e renderiza `options.header({navigation, route})`
// exatamente como o Drawer faria. A rota é "coberta pelo layout" se existe Drawer.Screen com esse nome e
// o header renderizado traz um botão com `accessibilityRole="button"` e rótulo "Abrir menu" ou "Voltar".
//
// Rotas que NÃO estão no layout só passam se o ARQUIVO da própria tela declara um botão "Voltar"
// (`accessibilityLabel="Voltar…"` + `accessibilityRole="button"` no código-fonte) — é leitura estática: prova que o
// botão existe no código, NÃO que está visível em cada estado da tela (declarado; o print de BR-CLI-T05 cobre as 4 telas
// de ação clínica). `TELAS_COM_VOLTAR_PROPRIO` é o único trecho escrito à mão e é confrontado com as rotas reais.
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { discoverRealAppRouteNames } from '../src/components/layout/discoverRealAppRouteNames';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
jest.mock('expo-router', () => ({
  // O roteador real carrega o _layout raiz (SplashScreen etc.) ao derivar as rotas: preserva o módulo real.
  ...jest.requireActual('expo-router'),
  Redirect: () => null,
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
    canGoBack: () => mockCanGoBack(),
  }),
  usePathname: () => '/dashboard',
}));

type HeaderFn = (p: {
  navigation: { toggleDrawer: () => void };
  route: { name: string; params?: Record<string, string> };
}) => React.ReactNode;
const mockRouteParams: Record<string, Record<string, string>> = {};
jest.mock('expo-router/drawer', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  const Drawer = ({ children }: { children: React.ReactNode }) =>
    ReactLocal.createElement(View, { testID: 'mock-drawer' }, children);
  Drawer.Screen = ({ name, options }: { name: string; options?: { header?: HeaderFn } }) => {
    const header = options?.header
      ? options.header({
          navigation: { toggleDrawer: jest.fn() },
          route: { name, params: mockRouteParams[name] },
        })
      : null;
    return ReactLocal.createElement(View, { testID: `mock-drawer-screen-${name}` }, header);
  };
  return { Drawer };
});

import AppLayout from '../src/app/(app)/_layout';

const SRC_APP = path.join(__dirname, '..', 'src', 'app');

/** Telas que desenham o próprio Voltar (cabeçalho de página ou etapa). Confrontado com as rotas reais abaixo. */
const TELAS_COM_VOLTAR_PROPRIO = [
  'agenda-novo',
  'pacientes/novo',
  'tutores/novo',
  'financeiro/index',
  'servicos-preco/index',
  'usuarios/index',
];

function arquivoDaRota(nome: string): string {
  const base = path.join(SRC_APP, '(app)', nome);
  return fs.existsSync(base + '.tsx') ? base + '.tsx' : path.join(base, 'index.tsx');
}

function temVoltarNoCodigo(nome: string): boolean {
  const src = fs.readFileSync(arquivoDaRota(nome), 'utf8');
  return /accessibilityLabel=["{`']*Voltar/.test(src) && /accessibilityRole=["{]*['"]?button/.test(src);
}

beforeEach(() => {
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    usuario: { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-1', dsEmail: 'a@b.c' },
  });
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  for (const k of Object.keys(mockRouteParams)) delete mockRouteParams[k];
});

const ROTAS = discoverRealAppRouteNames(SRC_APP);

describe('toda rota de (app) tem saída visível (BR-CLI-T05)', () => {
  it('sanidade: o roteador devolveu as rotas reais (controle positivo)', () => {
    expect(ROTAS.length).toBeGreaterThanOrEqual(15);
    expect(ROTAS).toEqual(expect.arrayContaining(['dashboard', 'consulta/[idPet]', 'pacientes/[id]']));
  });

  it('TELAS_COM_VOLTAR_PROPRIO só cita rotas que existem', () => {
    for (const nome of TELAS_COM_VOLTAR_PROPRIO) expect(ROTAS).toContain(nome);
  });

  it.each(ROTAS)('rota %s: hambúrguer, Voltar no cabeçalho ou Voltar da própria tela', (nome) => {
    const { queryByTestId } = render(
      <ThemeProvider>
        <AppLayout />
      </ThemeProvider>,
    );
    const tela = queryByTestId(`mock-drawer-screen-${nome}`);
    if (tela) {
      const menu = queryByTestId(`mock-drawer-screen-${nome}`)?.findAll?.(
        (n: { props: { testID?: string; accessibilityRole?: string; accessibilityLabel?: string } }) =>
          n.props.accessibilityRole === 'button' &&
          (n.props.accessibilityLabel === 'Abrir menu' || n.props.accessibilityLabel === 'Voltar'),
      );
      expect(menu?.length ?? 0).toBeGreaterThan(0);
      return;
    }
    expect(TELAS_COM_VOLTAR_PROPRIO).toContain(nome);
    expect(temVoltarNoCodigo(nome)).toBe(true);
  });
});

describe('Voltar do cabeçalho das telas de ação clínica', () => {
  const ACAO = [
    ['pacientes/[id]', { id: '7' }, '/pacientes'],
    ['consulta/[idPet]', { idPet: '7' }, '/pacientes/7'],
    ['receituario/[idPet]', { idPet: '7' }, '/pacientes/7'],
    ['teleorientacao/[idPet]', { idPet: '7' }, '/pacientes/7'],
  ] as const;

  it.each(ACAO)('%s: Voltar com role e rótulo; usa router.back() quando há histórico', (nome, params) => {
    mockRouteParams[nome] = { ...params };
    const { getByTestId } = render(
      <ThemeProvider>
        <AppLayout />
      </ThemeProvider>,
    );
    const tela = getByTestId(`mock-drawer-screen-${nome}`);
    const voltar = tela.findAll((n) => n.props.testID === 'app-header-back')[0]!;
    expect(voltar).toBeDefined();
    expect(voltar.props.accessibilityRole).toBe('button');
    expect(voltar.props.accessibilityLabel).toBe('Voltar');
    fireEvent.press(voltar);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it.each(ACAO)('%s: sem histórico (acesso direto por URL) cai na lista certa', (nome, params, destino) => {
    mockCanGoBack.mockReturnValue(false);
    mockRouteParams[nome] = { ...params };
    const { getByTestId } = render(
      <ThemeProvider>
        <AppLayout />
      </ThemeProvider>,
    );
    const voltar = getByTestId(`mock-drawer-screen-${nome}`).findAll((n) => n.props.testID === 'app-header-back')[0]!;
    fireEvent.press(voltar);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(destino);
  });
});
