import { renderHook, act } from '@testing-library/react-native';
import React from 'react';
import { ThemeProvider, useTheme, lightColors, darkColors } from '../src/theme';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ThemeProvider, null, children);
}

describe('theme', () => {
  it('useTheme returns lightColors by default', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.colors).toEqual(lightColors);
    expect(result.current.isDark).toBe(false);
  });

  it('toggleTheme switches isDark', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    await act(async () => {
      result.current.toggleTheme();
    });
    expect(result.current.isDark).toBe(true);
    expect(result.current.colors).toEqual(darkColors);
  });

  it('toggleTheme back to light', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    await act(async () => {
      result.current.toggleTheme();
    });
    await act(async () => {
      result.current.toggleTheme();
    });
    expect(result.current.isDark).toBe(false);
  });

  it('no color token is undefined in lightColors', () => {
    for (const [key, val] of Object.entries(lightColors)) {
      expect(val).toBeDefined();
      expect(typeof val).toBe('string');
      expect(val.startsWith('#')).toBe(true);
    }
  });

  it('no color token is undefined in darkColors', () => {
    for (const [key, val] of Object.entries(darkColors)) {
      expect(val).toBeDefined();
      expect(typeof val).toBe('string');
      expect(val.startsWith('#')).toBe(true);
    }
  });

  it('darkColors has same keys as lightColors', () => {
    const lightKeys = Object.keys(lightColors).sort();
    const darkKeys = Object.keys(darkColors).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it('spacing tokens are positive numbers', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    for (const val of Object.values(result.current.spacing)) {
      expect(typeof val).toBe('number');
      expect(val).toBeGreaterThan(0);
    }
  });
});
