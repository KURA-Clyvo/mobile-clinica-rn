import { useEffect } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import Head from 'expo-router/head';
import { useFonts } from 'expo-font';
import { Cormorant_500Medium } from '@expo-google-fonts/cormorant';
import { Lexend_400Regular, Lexend_500Medium } from '@expo-google-fonts/lexend';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ThemeProvider } from '@theme/index';
import { queryClient, persistOptions } from '@services/queryClient';
import { STRINGS } from '@constants/strings';

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
      {/*
        Fix wave da CQ-12 (dev VsClaude, KURA_BACKLOG_CLINICA_1): o título
        precisa ser declarado via `Head` de `expo-router/head`, não via
        `<title>` cru em `+html.tsx`. O expo-router usa `react-helmet-async`
        internamente e SEMPRE injeta o resultado do Helmet primeiro no
        `<head>` do export web — inclusive um `<title>` vazio quando nenhum
        `<Head>` explícito existe. `document.title` lê o primeiro `<title>`
        do documento, então um `<title>` fora do Helmet (como o antigo, em
        `+html.tsx`) nunca vale, mesmo aparecendo certo no HTML estático via
        `grep`. Ver `+html.tsx` e o relatório da task para a medição CDP.
      */}
      <Head>
        <title>{STRINGS.app.name}</title>
      </Head>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <Stack screenOptions={{ headerShown: false }} />
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}