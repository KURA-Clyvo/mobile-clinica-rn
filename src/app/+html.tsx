import React from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

/**
 * Documento raiz do export web (`expo export --platform web`).
 *
 * Sem este arquivo, o expo-router usa o `Html` default de
 * `expo-router/build/static/html.js`, que não declara `lang="pt-BR"`.
 * Mantido por causa desse atributo (e dos metas abaixo) — não pelo título.
 *
 * ⚠️ Fix wave da CQ-12 (dev VsClaude, KURA_BACKLOG_CLINICA_1): este arquivo
 * ATÉ chegou a declarar `<title>{STRINGS.app.name}</title>` aqui, e o
 * `grep` no HTML estático exportado passava — mas a aba do navegador
 * continuava vazia. Causa medida por CDP em browser real: o expo-router
 * usa `react-helmet-async` (`expo-router/vendor/react-helmet-async`)
 * internamente, e `renderStaticContent.js` SEMPRE injeta o resultado do
 * Helmet no INÍCIO do `<head>` — mesmo sem nenhum `<Head>` explícito no
 * app, o Helmet gera um `<title data-rh="true"></title>` vazio, que
 * `document.title` lê primeiro (o browser usa o primeiro `<title>` do
 * documento). O `<title>` deste arquivo nascia sempre em segundo lugar e
 * nunca valia. Correção: o título agora é declarado via
 * `<Head><title>...</Head>` de `expo-router/head` em `_layout.tsx` — o
 * MESMO mecanismo (Helmet) que estava competindo com este arquivo. Ver
 * `.superpowers/sdd/KURA_BACKLOG_CLINICA_1/task-CQ-12-report.md` (dev
 * VsClaude) para a medição CDP antes/depois.
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
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
