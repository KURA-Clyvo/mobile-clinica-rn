import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { KCIcon, ICON_NAMES, KCIconName } from '../src/components/primitives/KCIcon';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('KCIcon', () => {
  it('renders all 27 icon names without crash', () => {
    ICON_NAMES.forEach((name) => {
      expect(() => wrap(<KCIcon name={name} />)).not.toThrow();
    });
  });

  it('renders every icon name in the list', () => {
    expect(ICON_NAMES).toHaveLength(27);
  });

  it('passes size prop to Svg width and height', () => {
    const { getByTestId } = wrap(<KCIcon name="plus" size={32} />);
    const svg = getByTestId('Svg');
    expect(svg.props.width).toBe(32);
    expect(svg.props.height).toBe(32);
  });

  it('uses default size 18 when size not provided', () => {
    const { getByTestId } = wrap(<KCIcon name="check" />);
    const svg = getByTestId('Svg');
    expect(svg.props.width).toBe(18);
    expect(svg.props.height).toBe(18);
  });

  it('accepts a custom color prop', () => {
    expect(() =>
      wrap(<KCIcon name="close" color="#FF0000" />),
    ).not.toThrow();
  });

  it('accepts a custom strokeWidth prop', () => {
    expect(() =>
      wrap(<KCIcon name="bell" strokeWidth={2.5} />),
    ).not.toThrow();
  });

  it('returns null and warns for unknown icon name', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { toJSON } = wrap(
      <KCIcon name={'nonexistent' as KCIconName} />,
    );
    expect(toJSON()).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('nonexistent'),
    );
    warnSpy.mockRestore();
  });

  it('each icon name is unique in ICON_NAMES', () => {
    const set = new Set(ICON_NAMES);
    expect(set.size).toBe(ICON_NAMES.length);
  });
});
