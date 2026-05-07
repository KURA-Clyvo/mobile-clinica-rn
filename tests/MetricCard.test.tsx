import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { MetricCard } from '../src/components/domain/MetricCard';

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
});
