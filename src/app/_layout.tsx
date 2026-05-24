import { useEffect } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { Cormorant_500Medium } from '@expo-google-fonts/cormorant';
import { Lexend_400Regular, Lexend_500Medium } from '@expo-google-fonts/lexend';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ThemeProvider } from '@theme/index';
import { queryClient, persistOptions } from '@services/queryClient';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cormorant_500Medium,
    Lexend_400Regular,
    Lexend_500Medium,
    JetBrainsMono_400Regular,
  });

  useEffect(() => {
    const timeout = setTimeout(() => SplashScreen.hideAsync(), 3000);
    if (fontsLoaded || fontError) {
      clearTimeout(timeout);
      SplashScreen.hideAsync();
    }
    return () => clearTimeout(timeout);
  }, [fontsLoaded, fontError]);

  // ✅ Sem early return null — sempre renderiza o Stack
  // A SplashScreen cobre a tela enquanto as fontes carregam
  return (
    <ThemeProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <Stack screenOptions={{ headerShown: false }} />
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}