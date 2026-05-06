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
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
      >
        <Stack screenOptions={{ headerShown: false }} />
        {process.env.NODE_ENV !== 'production' && null}
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
