import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { KCPetPortrait, PetPalette } from '../src/components/primitives/KCPetPortrait';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

const PALETTES: PetPalette[] = [
  'lab', 'siam', 'border', 'poodle', 'persa', 'srd', 'golden', 'husky',
];

describe('KCPetPortrait', () => {
  describe('palette snapshots', () => {
    PALETTES.forEach((palette) => {
      it(`renders ${palette} palette`, () => {
        const { toJSON } = wrap(<KCPetPortrait palette={palette} />);
        expect(toJSON()).toMatchSnapshot();
      });
    });
  });

  it('renders all 8 palettes without crash', () => {
    PALETTES.forEach((palette) => {
      expect(() => wrap(<KCPetPortrait palette={palette} />)).not.toThrow();
    });
  });

  it('applies size to container dimensions', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="lab" size={64} />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.width).toBe(64);
    expect(flat.height).toBe(64);
  });

  it('uses default size 88 when size not provided', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="golden" />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.width).toBe(88);
    expect(flat.height).toBe(88);
  });

  it('borderRadius equals half of size', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="husky" size={100} />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.borderRadius).toBe(50);
  });

  it('renders ring decorative border when ring=true', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="border" ring />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.borderWidth).toBe(2);
  });

  it('renders without ring when ring=false (default)', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="lab" />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.borderWidth).toBeUndefined();
  });
});
