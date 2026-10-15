import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../src/theme';
import { MetricCard, fonteQueCabe } from '../src/components/domain/MetricCard';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('MetricCard', () => {
  it('renders the numeric value', () => {
    const { getByTestId } = wrap(
      <MetricCard label="Consultas hoje" value={8} icon="consult" tone="ocean" />,
    );
    expect(getByTestId('metric-value').props.children).toBe(8);
  });

  it('renders the label', () => {
    const { getByTestId } = wrap(
      <MetricCard label="Pacientes atendidos" value={6} icon="patients" tone="sage" />,
    );
    expect(getByTestId('metric-label').props.children).toBe('Pacientes atendidos');
  });

  it('renders without crashing for each tone', () => {
    const tones = ['ocean', 'sage', 'amber', 'clay'] as const;
    tones.forEach((tone) => {
      const { unmount } = wrap(
        <MetricCard label="Test" value={0} icon="alert" tone={tone} />,
      );
      unmount();
    });
  });

  it('displays zero value', () => {
    const { getByTestId } = wrap(
      <MetricCard label="Teleorientações" value={0} icon="tele" tone="amber" />,
    );
    expect(getByTestId('metric-value').props.children).toBe(0);
  });

  it('displays large value without crash', () => {
    const { getByTestId } = wrap(
      <MetricCard label="Alertas ativos" value={999} icon="alert" tone="clay" />,
    );
    expect(getByTestId('metric-value').props.children).toBe(999);
  });

  // FM-07 — `value` ampliado para `number | string` (ver MetricCardProps). Os cards
  // financeiros passam string PRÉ-FORMATADA (formatarMoeda()) ou "—" (ticketMedio: null) —
  // nenhum dos dois é number. Mudança aditiva: os 4 testes acima (todos numéricos) continuam
  // passando sem alteração.
  it('renders a pre-formatted string value (financeiro, FM-07)', () => {
    const { getByTestId } = wrap(
      <MetricCard label="Receita bruta" value="R$ 4.820,50" icon="dashboard" tone="sage" />,
    );
    expect(getByTestId('metric-value').props.children).toBe('R$ 4.820,50');
  });

  it('renders the dash placeholder for a null-backed metric (ticketMedio: null)', () => {
    const { getByTestId } = wrap(
      <MetricCard label="Ticket médio" value="—" icon="check" tone="ocean" />,
    );
    expect(getByTestId('metric-value').props.children).toBe('—');
  });

  // G4 BR-CLI-G4 (BR-T09-MC): "R$ 4.820,50" partia no meio do número ("R$ 4.820,5" / "0").
  describe('valor monetário nunca parte', () => {
    it('o valor fica em UMA linha e pede encolhimento nativo', () => {
      const { getByTestId } = wrap(
        <MetricCard label="Receita" value="R$ 4.820,50" icon="dashboard" tone="sage" />,
      );
      const v = getByTestId('metric-value');
      expect(v.props.numberOfLines).toBe(1);
      expect(v.props.adjustsFontSizeToFit).toBe(true);
    });

    it('com a largura medida estreita (136), "R$ 4.820,50" ganha fonte menor que a base; valor curto mantém a base', () => {
      const { getByTestId } = wrap(
        <MetricCard label="Receita" value="R$ 4.820,50" icon="dashboard" tone="sage" />,
      );
      const base = StyleSheet.flatten(getByTestId('metric-value').props.style).fontSize as number;
      fireEvent(getByTestId('metric-value'), 'layout', { nativeEvent: { layout: { width: 136, height: 36 } } });
      const depois = StyleSheet.flatten(getByTestId('metric-value').props.style).fontSize as number;
      expect(depois).toBeLessThan(base);
      // cabe: largura >= caracteres * 0,5 * fonte
      expect(11 * 0.5 * depois).toBeLessThanOrEqual(136);
    });

    it('fonteQueCabe: largura desconhecida ou valor curto => base; nunca abaixo do mínimo', () => {
      expect(fonteQueCabe('R$ 4.820,50', null, 34)).toBe(34);
      expect(fonteQueCabe('8', 136, 34)).toBe(34);
      expect(fonteQueCabe('R$ 4.820,50', 136, 34)).toBeLessThan(34);
      expect(fonteQueCabe('R$ 999.999.999,99', 50, 34)).toBeGreaterThanOrEqual(14);
    });
  });
});
