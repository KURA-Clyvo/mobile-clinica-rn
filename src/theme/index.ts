import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  lightColors,
  darkColors,
  spacing,
  radius,
  fontSize,
  fonts,
} from './tokens';

const THEME_OVERRIDE_KEY = 'KURA_THEME_OVERRIDE';

interface ThemeContextValue {
  colors: typeof lightColors;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fonts: typeof fonts;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_OVERRIDE_KEY).then((override) => {
      if (override === 'dark') setIsDark(true);
      else if (override === 'light') setIsDark(false);
      else setIsDark(systemScheme === 'dark');
    });
  }, [systemScheme]);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem(THEME_OVERRIDE_KEY, next ? 'dark' : 'light');
  };

  const value: ThemeContextValue = {
    colors: isDark ? darkColors : lightColors,
    spacing,
    radius,
    fontSize,
    fonts,
    isDark,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export { lightColors, darkColors, spacing, radius, fontSize, fonts };
