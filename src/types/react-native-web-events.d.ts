// CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1): `onMouseEnter`/`onMouseLeave`
// SÃO reconhecidos e repassados de verdade pelo react-native-web (confirmado
// na fonte: `node_modules/react-native-web/dist/modules/forwardedProps/
// index.js`, `mouseProps` — a MESMA allowlist que já inclui `onFocus`/
// `onBlur`, e essas duas o RN já declara em `ViewProps`) — só faltam nos
// tipos oficiais do RN (`ViewPropTypes.d.ts` declara `onFocus`/`onBlur`, mas
// não `onMouseEnter`/`onMouseLeave`). Esta extensão de módulo fecha só essa
// lacuna de TIPO; não muda comportamento em runtime em nenhuma plataforma —
// no nativo, `View`/`TouchableOpacity`/`Pressable` simplesmente ignoram
// props que não reconhecem (sem erro, sem warning), então declarar o tipo
// aqui não risca nada fora da web.
declare module 'react-native' {
  interface ViewProps {
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }
  // `TouchableOpacityProps` (via `TouchableWithoutFeedbackProps`) declara
  // `onFocus`/`onBlur` PRÓPRIOS — não herda de `ViewProps` — então a extensão
  // acima não alcança `TouchableOpacity`. Mesma extensão, alvo diferente.
  interface TouchableWithoutFeedbackProps {
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }
}

// Necessário para o TS tratar este arquivo como MÓDULO (permitindo `declare
// module` de aumento em vez de redeclaração global) — sem isso, um arquivo
// `.d.ts` sem import/export vira script global e `declare module` dentro
// dele às vezes é mal interpretado dependendo da config de `isolatedModules`.
export {};
