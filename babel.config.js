// CQ-16: sem este arquivo, o Metro cai no fallback interno do @expo/metro-config
// (loadBabelConfig.js), que chama `babel-preset-expo` sem opcoes — identico ao
// preset abaixo, exceto pela chave `web.unstable_transformImportMeta` adicionada
// aqui. Nenhuma outra opcao de preset muda: mesmo comportamento de hoje para
// iOS/Android e para os testes Jest (jest-expo forca caller.platform='ios',
// entao a chave `web` nunca ativa nesse caminho).
//
// Motivo da mudanca: `zustand/middleware` reexporta o middleware `devtools`,
// que contem `import.meta.env` (arquivo ESM `zustand/esm/middleware.mjs`,
// escolhido pelo resolvedor de "package exports" do Metro so na plataforma
// web, porque so la nao existe a condicao "react-native" no exports map do
// pacote). O HTML gerado por `expo export --platform web` carrega o bundle
// como <script defer> classico (sem type="module") — decisao hardcoded em
// @expo/cli/.../serializeHtml.js, sem opcao de configuracao — entao
// `import.meta` fora de modulo e SyntaxError de parse: o arquivo inteiro
// nunca executa, e nenhum try/catch interno salva.
//
// A opcao `unstable_transformImportMeta` liga um plugin baby ja existente em
// `babel-preset-expo` (import-meta-transform-plugin.js) que substitui
// `import.meta` por `globalThis.__ExpoImportMetaRegistry` no bundle web. Esse
// global ja e registrado em runtime pelo proprio pacote `expo`
// (`expo/src/Expo.fx.web.tsx` -> `./winter` -> `./winter/runtime.ts`), entao
// nao e um polyfill que este projeto precisa manter.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          web: {
            unstable_transformImportMeta: true,
          },
        },
      ],
    ],
  };
};
