import React from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';
import { STRINGS } from '@constants/strings';

/**
 * Documento raiz do export web (`expo export --platform web`).
 *
 * Sem este arquivo, o expo-router usa o `Html` default de
 * `expo-router/build/static/html.js`, que NÃO inclui `<title>` — a aba do
 * navegador mostrava o host (`127.0.0.1:8090`) em vez do nome do app. Ver
 * task CQ-12 (dev VsClaude, KURA_BACKLOG_CLINICA_1): `app.json` já declara
 * `expo.name: "KURA Clínica"`, mas essa chave não vira `<title>` sozinha —
 * precisa deste componente. `STRINGS.app.name` reaproveita o mesmo literal
 * já usado no `NavDrawer` em vez de duplicá-lo.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>{STRINGS.app.name}</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
