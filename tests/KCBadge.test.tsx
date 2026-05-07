import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { KCBadge } from '../src/components/primitives/KCBadge';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('KCBadge', () => {
  it('renders null when count is 0 and dot is false', () => {
    const { toJSON } = wrap(<KCBadge count={0} />);
    expect(toJSON()).toBeNull();
  });

  it('renders null when no props given', () => {
    const { toJSON } = wrap(<KCBadge />);
    expect(toJSON()).toBeNull();
  });

  it('renders count as string', () => {
    const { getByText } = wrap(<KCBadge count={5} />);
    expect(getByText('5')).toBeTruthy();
  });

  it('renders "99+" when count > 99', () => {
    const { getByText } = wrap(<KCBadge count={150} />);
    expect(getByText('99+')).toBeTruthy();
  });

  it('renders "99+" exactly at boundary 100', () => {
    const { getByText } = wrap(<KCBadge count={100} />);
    expect(getByText('99+')).toBeTruthy();
  });

  it('renders "99" at exactly 99', () => {
    const { getByText } = wrap(<KCBadge count={99} />);
    expect(getByText('99')).toBeTruthy();
  });

  it('renders dot when dot=true', () => {
    const { getByTestId } = wrap(<KCBadge dot />);
    expect(getByTestId('kc-badge-dot')).toBeTruthy();
  });

  it('dot takes priority over count=0', () => {
    const { getByTestId } = wrap(<KCBadge dot count={0} />);
    expect(getByTestId('kc-badge-dot')).toBeTruthy();
  });

  it('accepts custom color prop', () => {
    const { getByTestId } = wrap(<KCBadge count={3} color="#FF0000" />);
    expect(getByTestId('kc-badge-pill')).toBeTruthy();
  });
});
