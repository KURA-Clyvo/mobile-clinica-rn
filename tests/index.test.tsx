import React from 'react';
import { act, render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { FontesProntasProvider } from '../src/components/brand/FontesProntas';
import { ROUTES } from '../src/constants/routes';

// BR-CLI-T04, I1/I3 do G2. O `index.tsx` REAL (não a Abertura montada à mão) tem de:
//  - mostrar a abertura enquanto a sessão não hidratou OU as fontes não carregaram (§2b);
//  - tirá-la assim que as duas coisas ficam prontas, sem esperar a animação (600 ms).
// Antes desta suíte a mutação "index espera a animação terminar" deixava 1682/1682 verdes.

let mockHydrated = false;
let mockRedirect: string | null = null;

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('expo-router', () => ({
  SplashScreen: { hideAsync: jest.fn(() => Promise.resolve()), preventAutoHideAsync: jest.fn() },
  Redirect: ({ href }: { href: string }) => {
    mockRedirect = href;
    return null;
  },
}));
jest.mock('@store/authStore', () => ({
  useAuthStore: () => ({ isAuthenticated: () => false, _hasHydrated: mockHydrated }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Index = require('../src/app/index').default;

const abertura = (r: ReturnType<typeof montar>) => r.queryByTestId('abertura', { includeHiddenElements: true });
function montar(fontesProntas = true) {
  return render(
    <ThemeProvider>
      <FontesProntasProvider value={fontesProntas}>
        <Index />
      </FontesProntasProvider>
    </ThemeProvider>,
  );
}
const remontar = (r: ReturnType<typeof montar>, fontesProntas: boolean) =>
  r.rerender(
    <ThemeProvider>
      <FontesProntasProvider value={fontesProntas}>
        <Index />
      </FontesProntasProvider>
    </ThemeProvider>,
  );

describe('index.tsx: a abertura cobre sessão e fontes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockHydrated = false;
    mockRedirect = null;
  });
  afterEach(() => jest.useRealTimers());

  it('sessão resolvendo em 50 ms: a abertura some antes dos 600 ms (não espera a animação)', () => {
    const r = montar();
    expect(abertura(r)).not.toBeNull();
    act(() => void jest.advanceTimersByTime(50));
    mockHydrated = true;
    remontar(r, true);
    expect(abertura(r)).toBeNull();
    expect(mockRedirect).toBe(ROUTES.login);
  });

  it('sessão hidratada mas fontes ainda não carregadas: a abertura continua; carregou, sai', () => {
    mockHydrated = true;
    const r = montar(false);
    expect(abertura(r)).not.toBeNull();
    expect(mockRedirect).toBeNull();
    act(() => void jest.advanceTimersByTime(1000)); // bem depois dos 600 ms da animação
    expect(abertura(r)).not.toBeNull();
    remontar(r, true);
    expect(abertura(r)).toBeNull();
    expect(mockRedirect).toBe(ROUTES.login);
  });

  it('fontes prontas mas sessão ainda não hidratada: a abertura continua', () => {
    const r = montar(true);
    act(() => void jest.advanceTimersByTime(1000));
    expect(abertura(r)).not.toBeNull();
    expect(mockRedirect).toBeNull();
  });
});
