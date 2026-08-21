import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider, lightColors } from '../src/theme';
import { KuraMark } from '../src/components/brand/KuraMark';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('KuraMark', () => {
  it('renders without crashing', () => {
    expect(() => wrap(<KuraMark />)).not.toThrow();
  });

  it('derives height from size preserving the 5:6 (40:48) viewBox ratio', () => {
    const { getByTestId } = wrap(<KuraMark size={40} color={lightColors.primary} />);
    const svg = getByTestId('Svg');
    expect(svg.props.width).toBe(40);
    expect(svg.props.height).toBe(48);
  });

  it('derives height from a non-default size, keeping the same ratio', () => {
    const { getByTestId } = wrap(<KuraMark size={24} color={lightColors.primary} />);
    const svg = getByTestId('Svg');
    expect(svg.props.width).toBe(24);
    expect(svg.props.height).toBeCloseTo(24 * (48 / 40));
  });

  it('uses a default size of 32 when none is provided', () => {
    const { getByTestId } = wrap(<KuraMark color={lightColors.primary} />);
    const svg = getByTestId('Svg');
    expect(svg.props.width).toBe(32);
    expect(svg.props.height).toBe(32 * (48 / 40));
  });

  it('declares the viewBox as 0 0 40 48', () => {
    const { getByTestId } = wrap(<KuraMark color={lightColors.primary} />);
    const svg = getByTestId('Svg');
    expect(svg.props.viewBox).toBe('0 0 40 48');
  });

  it('applies the color prop (a token value) to every fill/stroke-bearing shape', () => {
    const { getAllByTestId } = wrap(<KuraMark color={lightColors.textOnPrimary} />);
    const paths = getAllByTestId('Path');
    const circles = getAllByTestId('Circle');
    expect(paths.length).toBeGreaterThan(0);
    expect(circles).toHaveLength(3);

    // O contorno e o corpo usam `stroke`, o preenchimento usa `fill` — os
    // três círculos ("patas/cabeças") são sempre preenchidos (restrição do
    // brand book: "círculos sempre preenchidos"), nunca só contornados.
    circles.forEach((circle) => {
      expect(circle.props.fill).toBe(lightColors.textOnPrimary);
    });
    paths.forEach((path) => {
      const usesColor =
        path.props.fill === lightColors.textOnPrimary ||
        path.props.stroke === lightColors.textOnPrimary;
      expect(usesColor).toBe(true);
    });
  });

  it('defaults color to colors.primary (token) when no color prop is given', () => {
    const { getAllByTestId } = wrap(<KuraMark />);
    const circles = getAllByTestId('Circle');
    // Sem override, todo círculo tem que usar exatamente o mesmo valor de
    // cor — provando que a cor vem de um único token (`colors.primary`),
    // não de hex por-forma divergente.
    const fills = new Set(circles.map((c) => c.props.fill));
    expect(fills.size).toBe(1);
  });
});
