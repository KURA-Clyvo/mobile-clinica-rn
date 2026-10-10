import React from 'react';
import { Animated, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { ThemeProvider, lightColors } from '../src/theme';
import { Abertura, PLANO_ABERTURA } from '../src/components/brand/Abertura';
import { KuraMark } from '../src/components/brand/KuraMark';

let mockReduzir = false;
const mockHideAsync = jest.fn(() => Promise.resolve());

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => mockReduzir,
}));
jest.mock('expo-router', () => ({
  SplashScreen: { hideAsync: () => mockHideAsync(), preventAutoHideAsync: jest.fn() },
}));

function montar(onTerminou?: () => void) {
  return render(
    <ThemeProvider>
      <Abertura onTerminou={onTerminou} />
    </ThemeProvider>,
  );
}

const patas = (r: ReturnType<typeof montar>) => r.UNSAFE_getByType(KuraMark).props.patas as [string, string, string];
const avancar = (ms: number) => act(() => void jest.advanceTimersByTime(ms));

describe('Abertura', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReduzir = false;
    mockHideAsync.mockClear();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('plano: teto duro de 600 ms e fade reduzido de no máximo 150 ms', () => {
    expect(PLANO_ABERTURA.fimMs).toBeLessThanOrEqual(600);
    expect(PLANO_ABERTURA.fadeReduzidoMs).toBeLessThanOrEqual(150);
  });

  it('termina sozinha em no máximo 600 ms', () => {
    const fim = jest.fn();
    montar(fim);
    avancar(599);
    expect(fim).not.toHaveBeenCalled();
    avancar(1); // 600 ms no total: o teto
    expect(fim).toHaveBeenCalledTimes(1);
  });

  it('as 3 patas acendem em sequência (meio, depois laterais) e voltam à cor do símbolo', () => {
    const r = montar();
    const base = lightColors.primary;
    const ambar = lightColors.amber;
    expect(patas(r)).toEqual([base, base, base]); // primeiro quadro = splash
    avancar(PLANO_ABERTURA.pataCentralMs);
    expect(patas(r)).toEqual([ambar, base, base]);
    avancar(PLANO_ABERTURA.pataLateraisMs - PLANO_ABERTURA.pataCentralMs);
    expect(patas(r)).toEqual([ambar, ambar, ambar]);
    avancar(PLANO_ABERTURA.voltaMs - PLANO_ABERTURA.pataLateraisMs);
    expect(patas(r)).toEqual([base, base, base]);
  });

  it('o primeiro quadro tem o símbolo de 100 dp sobre o bg do tema (o mesmo do splash)', () => {
    const r = montar();
    expect(r.UNSAFE_getByType(KuraMark).props.size).toBe(100);
    const estilo = r.getByTestId('abertura', { includeHiddenElements: true }).props.style;
    expect(estilo).toEqual(expect.arrayContaining([{ backgroundColor: lightColors.bg }]));
  });

  it('esconde o splash nativo quando o primeiro quadro é montado (onLayout)', () => {
    const r = montar();
    expect(mockHideAsync).not.toHaveBeenCalled();
    act(() => r.getByTestId('abertura', { includeHiddenElements: true }).props.onLayout({ nativeEvent: { layout: {} } }));
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
  });

  it('Reduce Motion: as patas nunca acendem; só a opacidade anima e acaba em no máximo 150 ms', () => {
    mockReduzir = true;
    const timing = jest.spyOn(Animated, 'timing');
    const fim = jest.fn();
    const r = montar(fim);
    const base = lightColors.primary;
    // Única animação: opacidade, com duração <= 150 ms, e nenhuma etapa de pata agendada.
    expect(timing).toHaveBeenCalledTimes(1);
    const cfg = timing.mock.calls[0]![1];
    expect(cfg.toValue).toBe(1);
    expect(cfg.duration).toBeLessThanOrEqual(150);
    expect(Object.keys(cfg).sort()).toEqual(['duration', 'toValue', 'useNativeDriver']);
    avancar(PLANO_ABERTURA.fadeReduzidoMs);
    expect(fim).toHaveBeenCalledTimes(1);
    // passado o teto da abertura normal, nenhuma pata acendeu
    avancar(PLANO_ABERTURA.fimMs);
    expect(patas(r)).toEqual([base, base, base]);
    expect(fim).toHaveBeenCalledTimes(1);
  });

  it('desmonta antes do fim sem disparar nada: a sessão resolver corta a animação', () => {
    const fim = jest.fn();
    const r = montar(fim);
    avancar(PLANO_ABERTURA.pataCentralMs);
    r.unmount();
    avancar(2000);
    expect(fim).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('não contém nenhum <Text> (sem texto, porcentagem ou dica)', () => {
    const r = montar();
    expect(r.UNSAFE_queryAllByType(Text)).toHaveLength(0);
    avancar(PLANO_ABERTURA.fimMs);
    expect(r.UNSAFE_queryAllByType(Text)).toHaveLength(0);
  });
});
